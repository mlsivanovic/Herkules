import { describe, expect, it } from 'vitest'
import {
  isLongWorkout,
  linkCandidates,
  sessionWindow,
  exerciseCsvCandidates,
  heartRateFileFor,
  heartRateFileKey,
  indexHeartRateFiles,
  parseOffset,
  parseSamsungExerciseCsv,
  parseSamsungHeartRate,
  samsungSessionId,
  selectedByDefault,
  toWorkoutImport,
} from './samsungHealth'

const P = 'com.samsung.health.exercise.'
const HEADER = [
  'live_data_internal',
  'total_calorie',
  `${P}duration`,
  `${P}start_time`,
  `${P}exercise_type`,
  `${P}mean_heart_rate`,
  `${P}max_heart_rate`,
  `${P}distance`,
  `${P}time_offset`,
  `${P}live_data`,
  `${P}pkg_name`,
  `${P}end_time`,
  `${P}datauuid`,
].join(',')

function row(fields: {
  uuid: string
  pkg: string
  type: string
  start: string
  end: string
  durationMs: number
  offset?: string
  mean?: string
  max?: string
  distance?: string
  liveData?: string
}): string {
  return [
    '',
    '',
    fields.durationMs,
    fields.start,
    fields.type,
    fields.mean ?? '',
    fields.max ?? '',
    fields.distance ?? '',
    fields.offset ?? 'UTC+0100',
    fields.liveData ?? '',
    fields.pkg,
    fields.end,
    fields.uuid,
    '', // Samsung rows end with a trailing comma
  ].join(',')
}

const GYM = row({
  uuid: 'aaaa1111-0000-4000-8000-000000000001',
  pkg: 'com.xiaomi.wearable',
  type: '0',
  start: '2026-11-12 19:24:50.000',
  end: '2026-11-12 20:09:18.000',
  durationMs: 2_668_000,
  mean: '104.0',
  max: '132.0',
  liveData: 'aaaa1111-0000-4000-8000-000000000001.com.samsung.health.exercise.live_data.json',
})
const OVERNIGHT = row({
  uuid: 'aaaa1111-0000-4000-8000-000000000002',
  pkg: 'com.xiaomi.wearable',
  type: '0',
  start: '2026-11-09 22:08:27.000',
  end: '2026-11-10 06:50:28.000',
  durationMs: 31_321_000,
  mean: '64.0',
})
const WALK = row({
  uuid: 'aaaa1111-0000-4000-8000-000000000003',
  pkg: 'com.xiaomi.wearable',
  type: '1001',
  start: '2026-11-11 14:01:08.000',
  end: '2026-11-11 14:16:03.000',
  durationMs: 895_000,
  distance: '1033.0',
})
const PHONE = row({
  uuid: 'aaaa1111-0000-4000-8000-000000000004',
  pkg: 'com.sec.android.app.shealth',
  type: '0',
  start: '2026-07-01 23:30:00.000',
  end: '2026-07-02 00:10:00.000',
  durationMs: 2_400_000,
  offset: 'UTC+0200',
})

const CSV = ['com.samsung.shealth.exercise,7013005,18', HEADER, GYM, OVERNIGHT, WALK, PHONE].join('\n')

describe('parseSamsungExerciseCsv', () => {
  it('reads every row, newest first, with UTC times and local date/time', () => {
    const workouts = parseSamsungExerciseCsv(CSV)
    expect(workouts.map((w) => w.uuid.slice(-1))).toEqual(['1', '3', '2', '4'])
    const gym = workouts[0]
    expect(gym.source).toBe('com.xiaomi.wearable')
    expect(gym.exerciseType).toBe('0')
    expect(new Date(gym.startMs).toISOString()).toBe('2026-11-12T19:24:50.000Z')
    expect(new Date(gym.endMs).toISOString()).toBe('2026-11-12T20:09:18.000Z')
    expect(gym.offsetMinutes).toBe(60)
    expect(gym.localDate).toBe('2026-11-12')
    expect(gym.localTime).toBe('20:24')
    expect(gym.durationS).toBe(2668)
    expect(gym.meanHeartRate).toBe(104)
    expect(gym.maxHeartRate).toBe(132)
    expect(gym.distanceM).toBeNull()
    expect(gym.liveDataFile).toMatch(/live_data\.json$/)
    expect(workouts[1].distanceM).toBe(1033)
  })

  it('moves the local date across midnight using the recorded offset', () => {
    const phone = parseSamsungExerciseCsv(CSV).find((w) => w.uuid.endsWith('4'))
    expect(phone?.localDate).toBe('2026-07-02')
    expect(phone?.localTime).toBe('01:30')
  })

  it('rejects files that are not the exercise export', () => {
    expect(() => parseSamsungExerciseCsv('Date,Workout Name\n2026-01-01,Push')).toThrow()
    expect(() =>
      parseSamsungExerciseCsv('com.samsung.shealth.exercise.periodization_training_schedule,1,1\na,b'),
    ).toThrow()
  })
})

describe('selection rules', () => {
  it('preselects Xiaomi workouts of the unspecified type up to four hours', () => {
    const [gym, walk, overnight, phone] = parseSamsungExerciseCsv(CSV)
    expect(selectedByDefault(gym)).toBe(true)
    expect(selectedByDefault(overnight)).toBe(false)
    expect(isLongWorkout(overnight)).toBe(true)
    expect(selectedByDefault(walk)).toBe(false)
    expect(selectedByDefault(phone)).toBe(false)
  })
})

describe('parseOffset', () => {
  it('parses signed offsets with or without a colon', () => {
    expect(parseOffset('UTC+0100')).toBe(60)
    expect(parseOffset('UTC-05:30')).toBe(-330)
    expect(parseOffset('')).toBeNull()
  })
})

describe('parseSamsungHeartRate', () => {
  it('keeps valid samples sorted and rounded, dropping noise and duplicates', () => {
    const json = JSON.stringify([
      { heart_rate: 100.0, start_time: 2000 },
      { heart_rate: 99.4, start_time: 1000 },
      { heart_rate: 0, start_time: 3000 },
      { speed: 1.2, start_time: 4000 },
      { heart_rate: 101, start_time: 2000 },
    ])
    expect(parseSamsungHeartRate(json)).toEqual([
      { at: 1000, bpm: 99 },
      { at: 2000, bpm: 101 },
    ])
  })

  it('rejects non-array JSON', () => {
    expect(() => parseSamsungHeartRate('{"heart_rate":1}')).toThrow()
    expect(() => parseSamsungHeartRate('not json')).toThrow()
  })
})

describe('folder discovery', () => {
  const file = (name: string, lastModified = 0) => ({ name, lastModified })

  it('picks the main exercise CSV, newest export first, and ignores companions', () => {
    const picked = exerciseCsvCandidates([
      file('com.samsung.shealth.exercise.20261001090000.csv'),
      file('com.samsung.shealth.exercise.hr_zone.20261113144875.csv'),
      file('com.samsung.shealth.exercise.periodization_training_schedule.20261113144875.csv'),
      file('com.samsung.shealth.exercise.20261113144875 (1).csv'),
      file('com.samsung.health.weight.20261113144875.csv'),
    ])
    expect(picked.map((f) => f.name)).toEqual([
      'com.samsung.shealth.exercise.20261113144875 (1).csv',
      'com.samsung.shealth.exercise.20261001090000.csv',
    ])
  })

  it('keys live_data files by record and skips other per-workout JSON', () => {
    expect(heartRateFileKey('abc-1.com.samsung.health.exercise.live_data.json')).toBe('abc-1')
    expect(heartRateFileKey('abc-1.com.samsung.health.exercise.live_data (2).json')).toBe('abc-1')
    expect(heartRateFileKey('abc-1.com.samsung.health.exercise.location_data.json')).toBeNull()
    expect(heartRateFileKey('abc-1.com.samsung.health.exercise.live_data_internal.json')).toBeNull()
  })

  it('finds the heart-rate file of a workout, newest copy first', () => {
    const gym = parseSamsungExerciseCsv(CSV)[0]
    const live = `${gym.uuid}.com.samsung.health.exercise.live_data.json`
    const index = indexHeartRateFiles([
      file(live, 1),
      file(`${gym.uuid}.com.samsung.health.exercise.live_data (1).json`, 5),
      file(`${gym.uuid}.com.samsung.health.exercise.location_data.json`, 9),
      file('other.com.samsung.health.exercise.live_data.json', 3),
    ])
    expect(index.size).toBe(2)
    expect(heartRateFileFor(gym, index)?.lastModified).toBe(5)
    expect(heartRateFileFor(parseSamsungExerciseCsv(CSV)[1], index)).toBeUndefined()
  })
})

describe('toWorkoutImport', () => {
  it('builds a set-less gym session with a stable id and real times', () => {
    const gym = parseSamsungExerciseCsv(CSV)[0]
    const samples = [{ at: gym.startMs + 3000, bpm: 99 }]
    const parsed = toWorkoutImport(gym, samples)
    expect(parsed.sessionId).toBe(samsungSessionId(gym.uuid))
    expect(parsed.sessionId).toBe(toWorkoutImport(gym).sessionId)
    expect(parsed.date).toBe('2026-11-12')
    expect(parsed.name).toBe('Gym workout')
    expect(parsed.exercises).toEqual([])
    expect(parsed.startedAt).toBe('2026-11-12T19:24:50.000Z')
    expect(parsed.endedAt).toBe('2026-11-12T20:09:18.000Z')
    expect(parsed.heartRate).toEqual(samples)
  })
})

describe('sessionWindow', () => {
  it('spans start to the last logged set and ignores unfinished sessions', () => {
    const base = {
      id: 's1',
      status: 'completed',
      started_at: '2026-11-12T19:20:00.000Z',
      ended_at: '2026-11-12T21:30:00.000Z',
      session_exercises: [{ sets: [{ completed_at: '2026-11-12T20:05:00.000Z' }, { completed_at: null }] }],
    }
    expect(sessionWindow(base)).toEqual({
      id: 's1',
      startMs: Date.parse('2026-11-12T19:20:00.000Z'),
      endMs: Date.parse('2026-11-12T20:05:00.000Z'),
    })
    expect(sessionWindow({ ...base, status: 'in_progress' })).toBeNull()
    expect(sessionWindow({ ...base, status: 'skipped' })).toBeNull()
  })
})

describe('linkCandidates', () => {
  const gym = parseSamsungExerciseCsv(CSV)[0] // 19:24:50-20:09:18 UTC
  const at = (iso: string) => Date.parse(iso)
  const windows = [
    { id: 'small-overlap', startMs: at('2026-11-12T20:00:00Z'), endMs: at('2026-11-12T20:40:00Z') },
    { id: 'big-overlap', startMs: at('2026-11-12T19:20:00Z'), endMs: at('2026-11-12T20:05:00Z') },
    { id: 'near', startMs: at('2026-11-12T20:20:00Z'), endMs: at('2026-11-12T20:50:00Z') },
    { id: 'far', startMs: at('2026-11-12T08:00:00Z'), endMs: at('2026-11-12T09:00:00Z') },
  ]

  it('ranks overlapping sessions by overlap, then nearby ones, and drops distant ones', () => {
    expect(linkCandidates(gym, windows).map((w) => w.id)).toEqual(['big-overlap', 'small-overlap', 'near'])
  })

  it('returns nothing when no session is close', () => {
    expect(linkCandidates(gym, [windows[3]])).toEqual([])
  })
})
