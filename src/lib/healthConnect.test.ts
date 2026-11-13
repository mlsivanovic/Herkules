import { describe, expect, it } from 'vitest'
import {
  dedupeHealthWorkouts,
  healthOriginKind,
  healthSessionId,
  healthWorkoutName,
  heartRateForFinishedSession,
  mergeHeartRate,
  planHealthImport,
  thinHeartRate,
  toHealthImport,
  type HealthWorkout,
} from './healthConnect'

const START = Date.parse('2026-06-15T18:00:00.000Z')
const END = START + 30 * 60_000

function workout(patch: Partial<HealthWorkout> = {}): HealthWorkout {
  return {
    id: 'record-a',
    origin: 'com.sec.android.app.shealth',
    exerciseType: 56,
    startMs: START,
    endMs: END,
    distanceM: 5000,
    caloriesKcal: 300,
    heartRate: [
      { at: START + 1000, bpm: 140 },
      { at: START + 2000, bpm: 150 },
    ],
    ...patch,
  }
}

describe('healthWorkoutName', () => {
  it('uses English names for known exercise types', () => {
    expect(healthWorkoutName(56)).toBe('Running')
    expect(healthWorkoutName(0)).toBe('Gym workout')
    expect(healthWorkoutName(79)).toBe('Walking')
    expect(healthWorkoutName(12345)).toBe('Workout')
  })
})

describe('healthOriginKind', () => {
  it('recognises the two watch writers', () => {
    expect(healthOriginKind('com.xiaomi.wearable')).toBe('xiaomi')
    expect(healthOriginKind('com.sec.android.app.shealth')).toBe('samsung')
    expect(healthOriginKind('com.example.other')).toBe('other')
  })
})

describe('dedupeHealthWorkouts', () => {
  it('collapses two copies of one workout and keeps the richer heart rate', () => {
    const rows = dedupeHealthWorkouts([
      workout({ id: 'samsung', heartRate: [{ at: START, bpm: 120 }] }),
      workout({
        id: 'xiaomi',
        origin: 'com.xiaomi.wearable',
        distanceM: 5100,
        heartRate: [
          { at: START, bpm: 121 },
          { at: START + 5000, bpm: 130 },
        ],
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.distanceM).toBe(5100)
    const kept = rows[0]
    expect(kept?.heartRate.map((sample) => sample.bpm)).toEqual([121, 130])
    expect(kept).toBeTruthy()
    if (!kept) return
    expect(healthSessionId(kept)).toBe(healthSessionId(workout()))
  })

  it('keeps two workouts that start in different minutes', () => {
    const rows = dedupeHealthWorkouts([
      workout(),
      workout({ id: 'later', startMs: START + 10 * 60_000, endMs: END + 10 * 60_000 }),
    ])
    expect(rows).toHaveLength(2)
  })
})

describe('mergeHeartRate', () => {
  it('drops invalid bpm and duplicate timestamps', () => {
    expect(
      mergeHeartRate([
        [
          { at: 20, bpm: 0 },
          { at: 10, bpm: 80 },
          { at: 10.4, bpm: 81 },
          { at: 30, bpm: 300 },
        ],
      ]),
    ).toEqual([{ at: 10, bpm: 81 }])
  })
})

describe('thinHeartRate', () => {
  it('keeps a short series whole and thins a long one', () => {
    const short = [{ at: 1, bpm: 70 }]
    expect(thinHeartRate(short)).toEqual(short)
    const long = Array.from({ length: 20 }, (_, index) => ({ at: index, bpm: 80 }))
    const thinned = thinHeartRate(long, 5)
    expect(thinned.length).toBeLessThanOrEqual(5)
    expect(thinned[0]).toEqual({ at: 0, bpm: 80 })
  })
})

describe('toHealthImport', () => {
  it('stores distance as one cardio set and a stable session id', () => {
    const imported = toHealthImport(workout())
    expect(imported.sessionId).toBe(healthSessionId(workout()))
    expect(imported.name).toBe('Running')
    expect(imported.notes).toBe('Imported from Health Connect (com.sec.android.app.shealth)')
    expect(imported.startedAt).toBe(new Date(START).toISOString())
    expect(imported.exercises).toHaveLength(1)
    expect(imported.exercises[0]?.sets[0]).toMatchObject({
      duration_s: 1800,
      distance_m: 5000,
      completed_at: new Date(END).toISOString(),
    })
  })

  it('leaves a gym workout without sets when distance is missing', () => {
    const imported = toHealthImport(workout({ exerciseType: 0, distanceM: null }))
    expect(imported.name).toBe('Gym workout')
    expect(imported.exercises).toEqual([])
  })
})

describe('planHealthImport', () => {
  it('points a repeat copy at the set-less session from an earlier import', () => {
    const [row] = planHealthImport(
      [workout({ id: 'new-copy' })],
      [
        {
          id: 'samsung-shell',
          status: 'completed',
          started_at: new Date(START).toISOString(),
          ended_at: new Date(END).toISOString(),
          session_exercises: [],
        },
      ],
    )
    expect(row?.alreadyImported).toBe(true)
    expect(row?.defaultTarget).toBe('samsung-shell')
  })

  it('offers an overlapping gym session before creating a new one', () => {
    const [row] = planHealthImport(
      [workout()],
      [
        {
          id: 'gym',
          status: 'completed',
          started_at: new Date(START + 60_000).toISOString(),
          ended_at: new Date(END).toISOString(),
          session_exercises: [{ sets: [{ completed_at: new Date(END).toISOString() }] }],
        },
      ],
    )
    expect(row?.alreadyImported).toBe(false)
    expect(row?.defaultTarget).toBe('gym')
    expect(row?.options.map((option) => option.id)).toContain('gym')
  })
})

describe('heartRateForFinishedSession', () => {
  const session = { startMs: START, endMs: END }

  it('uses the only overlapping workout', () => {
    const samples = heartRateForFinishedSession(session, [workout()], [{ at: START, bpm: 60 }])
    expect(samples?.map((sample) => sample.bpm)).toEqual([140, 150])
  })

  it('uses the window samples when the watch recorded no workout', () => {
    const samples = heartRateForFinishedSession(session, [], [{ at: START, bpm: 90 }])
    expect(samples).toEqual([{ at: START, bpm: 90 }])
  })

  it('stays quiet when two watch workouts overlap the session', () => {
    const second = workout({
      id: 'other',
      startMs: START + 60_000,
      endMs: START + 10 * 60_000,
      heartRate: [{ at: START + 60_000, bpm: 100 }],
    })
    expect(heartRateForFinishedSession(session, [workout(), second], [])).toBeNull()
  })
})
