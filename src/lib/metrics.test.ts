import { describe, expect, it } from 'vitest'
import type {
  ExerciseRow,
  SessionDoc,
  SessionExerciseDoc,
  SetRow,
} from '../types/db'
import {
  adherence,
  bestE1RM,
  e1RM,
  exerciseProgress,
  personalRecords,
  previousSetsForExercise,
  sessionTotals,
  sessionVolume,
  setVolume,
  setsPerMuscleGroup,
  workoutStreak,
  weeklyVolume,
  workoutsPerWeekday,
} from './metrics'

let seq = 0
function makeSet(overrides: Partial<SetRow> = {}): SetRow {
  seq += 1
  return {
    id: `set-${seq}`,
    session_exercise_id: 'se-1',
    position: seq,
    weight_kg: null,
    reps: null,
    duration_s: null,
    distance_m: null,
    rpe: null,
    notes: null,
    completed_at: '2026-08-15T10:00:00Z',
    created_at: '2026-08-15T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    ...overrides,
  }
}

function makeSessionEx(
  overrides: Partial<SessionExerciseDoc> = {},
  sets: SetRow[] = [],
): SessionExerciseDoc {
  return {
    id: 'se-1',
    session_id: 's-1',
    exercise_id: 'ex-1',
    name_snapshot: 'Bench Press',
    measurement_snapshot: 'weight_reps',
    position: 0,
    planned_sets: 3,
    rest_seconds: null,
    notes: null,
    superset_group: null,
    created_at: '2026-08-15T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    sets,
    ...overrides,
  }
}

function makeSession(overrides: Partial<SessionDoc> = {}): SessionDoc {
  return {
    id: 's-1',
    owner_id: 'u1',
    template_id: null,
    schedule_item_id: null,
    name: 'Push',
    status: 'completed',
    planned_date: null,
    started_at: '2026-08-15T10:00:00Z',
    ended_at: '2026-08-15T11:00:00Z',
    notes: null,
    rpe: null,
    created_at: '2026-08-15T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    session_exercises: [],
    ...overrides,
  }
}

describe('volume and e1RM', () => {
  it('computes volume only from completed sets', () => {
    expect(setVolume(makeSet({ weight_kg: 100, reps: 5 }))).toBe(500)
    expect(setVolume(makeSet({ weight_kg: 100, reps: 5, completed_at: null }))).toBe(0)
  })

  it('aggregates session volume', () => {
    const doc = makeSession({
      session_exercises: [
        makeSessionEx(
          { id: 'se-1' },
          [makeSet({ weight_kg: 60, reps: 8 }), makeSet({ weight_kg: 60, reps: 8 })],
        ),
        makeSessionEx(
          { id: 'se-2', session_id: 's-1' },
          [makeSet({ weight_kg: 20, reps: 12 })],
        ),
      ],
    })
    expect(sessionVolume(doc)).toBe(60 * 8 * 2 + 20 * 12)
  })

  it('Epley e1RM formula', () => {
    expect(e1RM(100, 1)).toBeCloseTo(100 * (1 + 1 / 30), 5)
    expect(e1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5)
    expect(e1RM(0, 5)).toBeNull()
    expect(e1RM(100, 0)).toBeNull()
    expect(e1RM(null, 5)).toBeNull()
  })

  it('picks the best e1RM across sets', () => {
    const sets = [
      makeSet({ weight_kg: 80, reps: 5 }),
      makeSet({ weight_kg: 90, reps: 3 }),
      makeSet({ weight_kg: 100, reps: 1, completed_at: null }), // not completed
    ]
    expect(bestE1RM(sets)).toBeCloseTo(90 * (1 + 3 / 30), 5)
  })
})

describe('personal records', () => {
  it('finds PRs per measurement type', () => {
    const sessions = [
      makeSession({
        id: 's-old',
        started_at: '2026-07-01T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-a', session_id: 's-old' }, [
            makeSet({ weight_kg: 90, reps: 5, session_exercise_id: 'se-a' }),
          ]),
        ],
      }),
      makeSession({
        id: 's-new',
        started_at: '2026-08-15T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-b', session_id: 's-new' }, [
            makeSet({ weight_kg: 100, reps: 4, session_exercise_id: 'se-b' }),
          ]),
        ],
      }),
    ]
    const records = personalRecords(sessions)
    const e1rm = records.find((r) => r.kind === 'e1rm')
    const weight = records.find((r) => r.kind === 'weight')
    expect(e1rm?.value).toBeCloseTo(100 * (1 + 4 / 30), 5)
    expect(e1rm?.date).toBe('2026-08-15')
    expect(weight?.value).toBe(100)
  })

  it('tracks distance and duration PRs for cardio', () => {
    const sessions = [
      makeSession({
        started_at: '2026-08-15T10:00:00Z',
        session_exercises: [
          makeSessionEx(
            {
              id: 'se-run',
              name_snapshot: 'Treadmill Run',
              measurement_snapshot: 'distance_duration',
            },
            [makeSet({ distance_m: 5200, duration_s: 1800, session_exercise_id: 'se-run' })],
          ),
        ],
      }),
    ]
    const records = personalRecords(sessions)
    expect(records.find((r) => r.kind === 'distance')?.value).toBe(5200)
    expect(records.find((r) => r.kind === 'duration')?.value).toBe(1800)
  })

  it('uses name snapshot when exercise was deleted from the catalog', () => {
    const sessions = [
      makeSession({
        started_at: '2026-08-15T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-x', exercise_id: null, name_snapshot: 'Old Move' }, [
            makeSet({ reps: 12, session_exercise_id: 'se-x' }),
          ]),
        ],
      }),
    ]
    const records = personalRecords(sessions)
    expect(records).toHaveLength(1)
    expect(records[0]?.exerciseName).toBe('Old Move')
    expect(records[0]?.exerciseId).toBeNull()
  })
})

describe('previous performance', () => {
  it('returns the most recent completed performance', () => {
    const sessions = [
      makeSession({
        id: 's-1',
        started_at: '2026-07-01T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-1', session_id: 's-1' }, [
            makeSet({ weight_kg: 60, reps: 10, session_exercise_id: 'se-1' }),
          ]),
        ],
      }),
      makeSession({
        id: 's-2',
        started_at: '2026-08-15T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-2', session_id: 's-2' }, [
            makeSet({ weight_kg: 70, reps: 8, session_exercise_id: 'se-2' }),
          ]),
        ],
      }),
    ]
    const previous = previousSetsForExercise(sessions, 'ex-1', 'Bench Press')
    expect(previous).toHaveLength(1)
    expect(previous?.[0]?.weight_kg).toBe(70)
  })

  it('excludes the active session', () => {
    const sessions = [
      makeSession({
        id: 's-active',
        status: 'in_progress',
        ended_at: null,
        started_at: '2026-08-16T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-1', session_id: 's-active' }, [
            makeSet({ weight_kg: 999, session_exercise_id: 'se-1' }),
          ]),
        ],
      }),
      makeSession({
        id: 's-prev',
        started_at: '2026-08-15T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-2', session_id: 's-prev' }, [
            makeSet({ weight_kg: 70, session_exercise_id: 'se-2' }),
          ]),
        ],
      }),
    ]
    const previous = previousSetsForExercise(sessions, 'ex-1', 'Bench Press', 's-active')
    expect(previous?.[0]?.weight_kg).toBe(70)
  })
})

describe('aggregations', () => {
  const sessions = [
    makeSession({ id: 's-a', started_at: '2026-08-17T10:00:00Z', ended_at: '2026-08-17T10:45:00Z' }),
    makeSession({ id: 's-b', started_at: '2026-08-18T10:00:00Z', ended_at: '2026-08-18T11:00:00Z' }),
    makeSession({ id: 's-c', status: 'in_progress', ended_at: null, started_at: '2026-08-19T10:00:00Z' }),
  ]

  it('totals only completed sessions', () => {
    const totals = sessionTotals(sessions)
    expect(totals.workouts).toBe(2)
    expect(totals.totalMinutes).toBe(105)
    expect(totals.avgMinutes).toBe(53)
  })

  it('zero-fills weekly volume buckets', () => {
    const weeks = weeklyVolume([], 4, 'monday', '2026-08-19')
    expect(weeks).toHaveLength(4)
    expect(weeks.every((w) => w.volume === 0)).toBe(true)
  })

  it('buckets volume by week start', () => {
    const withVolume = [
      makeSession({
        started_at: '2026-08-17T10:00:00Z', // Monday of the ending week
        session_exercises: [
          makeSessionEx({}, [makeSet({ weight_kg: 50, reps: 10 })]),
        ],
      }),
    ]
    const weeks = weeklyVolume(withVolume, 2, 'monday', '2026-08-19')
    expect(weeks[1]?.weekStart).toBe('2026-08-17')
    expect(weeks[1]?.volume).toBe(500)
    expect(weeks[0]?.volume).toBe(0)
  })

  it('counts sets per muscle group using the catalog', () => {
    const exercises: ExerciseRow[] = [
      {
        id: 'ex-1',
        owner_id: null,
        name: 'Squat',
        category: 'strength',
        measurement: 'weight_reps',
        muscle_groups: ['quads', 'glutes'],
        equipment: [],
        instructions: null,
        video_url: null,
        is_archived: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ]
    const doc = makeSession({
      started_at: '2026-08-17T10:00:00Z',
      session_exercises: [
        makeSessionEx({ id: 'se-1' }, [
          makeSet({ session_exercise_id: 'se-1' }),
          makeSet({ session_exercise_id: 'se-1' }),
        ]),
      ],
    })
    const totals = setsPerMuscleGroup([doc], exercises, '2026-08-01')
    expect(totals.find((t) => t.group === 'quads')?.sets).toBe(2)
    expect(totals.find((t) => t.group === 'glutes')?.sets).toBe(2)
  })

  it('computes the day streak ending today or yesterday', () => {
    expect(workoutStreak(sessions, '2026-08-18')).toBe(2)
    expect(workoutStreak(sessions, '2026-08-19')).toBe(2) // yesterday still counts
    expect(workoutStreak(sessions, '2026-08-21')).toBe(0) // gap breaks the chain
    expect(workoutStreak([], '2026-08-19')).toBe(0)
  })

  it('computes adherence within the window', () => {
    const result = adherence(4, sessions, '2026-08-17', '2026-08-23')
    expect(result.completed).toBe(2)
    expect(result.percent).toBe(50)
  })

  it('histograms workouts per ISO weekday', () => {
    const counts = workoutsPerWeekday(sessions)
    expect(counts[0]).toBe(1) // Monday 2026-08-17
    expect(counts[1]).toBe(1) // Tuesday 2026-08-18
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2)
  })
})

describe('per-exercise progress', () => {
  it('lists newest sessions first with stats', () => {
    const sessions = [
      makeSession({
        id: 's-old',
        started_at: '2026-07-01T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-1', session_id: 's-old' }, [
            makeSet({ weight_kg: 60, reps: 8, session_exercise_id: 'se-1' }),
          ]),
        ],
      }),
      makeSession({
        id: 's-new',
        started_at: '2026-08-15T10:00:00Z',
        session_exercises: [
          makeSessionEx({ id: 'se-2', session_id: 's-new' }, [
            makeSet({ weight_kg: 70, reps: 6, session_exercise_id: 'se-2' }),
          ]),
        ],
      }),
    ]
    const progress = exerciseProgress(sessions, { id: 'ex-1', name: 'Bench Press' })
    expect(progress).toHaveLength(2)
    expect(progress[0]?.sessionId).toBe('s-new')
    expect(progress[0]?.bestE1RM).toBeCloseTo(70 * (1 + 6 / 30), 5)
    expect(progress[0]?.volume).toBe(420)
  })
})
