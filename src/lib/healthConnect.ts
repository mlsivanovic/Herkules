// Maps Health Connect workouts into the same import shape as Samsung Health.
// Watch S1 arrives via Mi Fitness, Galaxy Watch 7 via Samsung Health. Both
// write on-device records; this module never talks to a vendor cloud.
import type { AerobicActivityType } from '../types/db'
import type { ParsedWorkoutImport } from './csv'
import { summarizeHeartRate, type HeartRateSample } from './heartRate'
import { deterministicUuid } from './importExternal'
import { linkCandidates, sessionWindow, type SessionWindow } from './samsungHealth'
import { LONG_SESSION_SECONDS } from './sessionDuration'

/** Two records of one workout (Samsung Health and Mi Fitness) share a start minute. */
export const START_BUCKET_MS = 60_000
/** Durations within this gap are the same workout, not two activities. */
export const DURATION_TOLERANCE_MS = 2 * 60_000
/** session_heart_rate allows 86400 samples. Keep the bridge and the row smaller. */
export const MAX_HEART_RATE_SAMPLES = 8_000

export interface HealthWorkout {
  id: string
  /** Writing app, Health Connect `dataOrigin` package. */
  origin: string
  /** Health Connect exercise type int. */
  exerciseType: number
  startMs: number
  endMs: number
  distanceM: number | null
  caloriesKcal: number | null
  heartRate: HeartRateSample[]
}

export interface HealthSessionRef {
  id: string
  status: string
  started_at: string
  ended_at: string | null
  session_exercises?: { sets: { completed_at: string | null }[] }[]
}

/** Where one watch workout goes: the weekly aerobic log or a gym session. */
export type HealthDestination = 'aerobic' | 'session'

export interface HealthImportRow {
  workout: HealthWorkout
  /** Local calendar day the workout started on (YYYY-MM-DD). */
  date: string
  /** An earlier import of this same watch workout as a gym session. */
  alreadyImported: boolean
  /** An earlier import of this same watch workout as an aerobic activity. */
  aerobicImported: boolean
  /** Sport preselected for the aerobic log. */
  aerobicType: AerobicActivityType
  defaultDestination: HealthDestination
  /** Existing session to receive heart rate. Null creates a session. */
  defaultTarget: string | null
  /** Gym sessions the user can pick instead, best match first. */
  options: SessionWindow[]
}

const NAMES: Record<number, string> = {
  0: 'Gym workout',
  2: 'Badminton',
  5: 'Basketball',
  8: 'Cycling',
  9: 'Indoor cycling',
  25: 'Elliptical',
  36: 'HIIT',
  37: 'Hiking',
  53: 'Rowing',
  54: 'Rowing',
  56: 'Running',
  57: 'Treadmill run',
  64: 'Football',
  68: 'Stair climbing',
  70: 'Strength training',
  73: 'Open water swim',
  74: 'Pool swim',
  75: 'Table tennis',
  76: 'Tennis',
  78: 'Volleyball',
  79: 'Walking',
  81: 'Weightlifting',
  83: 'Yoga',
}

/** English session name stored as-is. Unknown types stay a generic workout. */
export function healthWorkoutName(exerciseType: number): string {
  return NAMES[exerciseType] ?? 'Workout'
}

/** Health Connect exercise types and the aerobic log sport they map to. */
const AEROBIC_TYPES: Record<number, AerobicActivityType> = {
  5: 'basketball',
  8: 'cycling',
  9: 'cycling',
  25: 'elliptical',
  37: 'hiking',
  53: 'rowing',
  54: 'rowing',
  56: 'running',
  57: 'running',
  64: 'football',
  73: 'swimming',
  74: 'swimming',
  75: 'table_tennis',
  76: 'tennis',
  78: 'volleyball',
  79: 'walking',
}

/**
 * Types that are gym work, so they default to a session.
 * Other workout, calisthenics, pilates, strength, stretching, weightlifting, yoga.
 */
const GYM_TYPES = new Set([0, 13, 48, 70, 71, 81, 83])

export function aerobicTypeForHealth(exerciseType: number): AerobicActivityType {
  return AEROBIC_TYPES[exerciseType] ?? 'other'
}

export function isGymHealthType(exerciseType: number): boolean {
  return GYM_TYPES.has(exerciseType)
}

export function healthOriginKind(origin: string): 'xiaomi' | 'samsung' | 'other' {
  if (origin === 'com.xiaomi.wearable' || origin.startsWith('com.mi.health')) return 'xiaomi'
  if (origin === 'com.sec.android.app.shealth') return 'samsung'
  return 'other'
}

export function sameWatchWorkout(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number },
): boolean {
  if (Math.floor(a.startMs / START_BUCKET_MS) !== Math.floor(b.startMs / START_BUCKET_MS)) return false
  const aDuration = a.endMs - a.startMs
  const bDuration = b.endMs - b.startMs
  return Math.abs(aDuration - bDuration) <= DURATION_TOLERANCE_MS
}

/** Stable across Mi Fitness and Samsung Health copies of one workout. */
export function healthSessionId(workout: { startMs: number; endMs: number }): string {
  const startMinute = Math.floor(workout.startMs / START_BUCKET_MS)
  const durationMinute = Math.round((workout.endMs - workout.startMs) / START_BUCKET_MS)
  return deterministicUuid('health-connect', startMinute, durationMinute)
}

/**
 * Drop non-positive bpm and collapse identical timestamps.
 * `keep` chooses which copy wins when two sources share a timestamp.
 */
export function mergeHeartRate(
  groups: readonly (readonly HeartRateSample[])[],
  keep: 'first' | 'last' = 'last',
): HeartRateSample[] {
  const byTime = new Map<number, number>()
  for (const group of groups) {
    for (const sample of group) {
      if (!Number.isFinite(sample.at) || !Number.isFinite(sample.bpm)) continue
      const bpm = Math.round(sample.bpm)
      if (bpm <= 0 || bpm > 250) continue
      const at = Math.round(sample.at)
      if (keep === 'first' && byTime.has(at)) continue
      byTime.set(at, bpm)
    }
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, bpm]) => ({ at, bpm }))
}

/** Evenly thin a long series so a workout still fits one heart-rate row. */
export function thinHeartRate(
  samples: readonly HeartRateSample[],
  max = MAX_HEART_RATE_SAMPLES,
): HeartRateSample[] {
  if (samples.length <= max) return [...samples]
  const step = Math.ceil(samples.length / max)
  return samples.filter((_, index) => index % step === 0)
}

function richness(workout: HealthWorkout): number {
  return workout.heartRate.length * 1_000 + (workout.distanceM ?? 0)
}

/**
 * One row per watch workout. Copies that share a start minute and a similar
 * duration collapse, keeping the richer heart-rate series and the longer distance.
 */
export function dedupeHealthWorkouts(workouts: readonly HealthWorkout[]): HealthWorkout[] {
  const kept: HealthWorkout[] = []
  const ordered = [...workouts].sort((a, b) => richness(b) - richness(a))
  for (const workout of ordered) {
    const match = kept.find((known) => sameWatchWorkout(known, workout))
    if (!match) {
      kept.push({ ...workout, heartRate: mergeHeartRate([workout.heartRate]) })
      continue
    }
    match.heartRate = mergeHeartRate([match.heartRate, workout.heartRate], 'first')
    if ((workout.distanceM ?? 0) > (match.distanceM ?? 0)) match.distanceM = workout.distanceM
    if ((workout.caloriesKcal ?? 0) > (match.caloriesKcal ?? 0)) match.caloriesKcal = workout.caloriesKcal
  }
  return kept.sort((a, b) => b.startMs - a.startMs)
}

/** Aerobic log id of a watch workout; stable across re-imports. */
export function healthAerobicId(workout: { startMs: number; endMs: number }): string {
  const startMinute = Math.floor(workout.startMs / START_BUCKET_MS)
  const durationMinute = Math.round((workout.endMs - workout.startMs) / START_BUCKET_MS)
  return deterministicUuid('health-connect-aerobic', startMinute, durationMinute)
}

export function localDate(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function hasLoggedSet(session: HealthSessionRef): boolean {
  return (session.session_exercises ?? []).some((exercise) =>
    exercise.sets.some((set) => set.completed_at !== null),
  )
}

/**
 * Session id of an earlier import of this watch workout: the Health Connect id,
 * or a set-less session with the same start and length (a Samsung CSV import).
 */
export function existingHealthSession(
  workout: { startMs: number; endMs: number },
  sessions: readonly HealthSessionRef[],
): string | null {
  const ownId = healthSessionId(workout)
  if (sessions.some((session) => session.id === ownId)) return ownId
  for (const session of sessions) {
    if (session.status !== 'completed' || hasLoggedSet(session)) continue
    const startMs = Date.parse(session.started_at)
    const endMs = session.ended_at ? Date.parse(session.ended_at) : Number.NaN
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    if (sameWatchWorkout(workout, { startMs, endMs })) return session.id
  }
  return null
}

function positiveOverlap(
  workout: { startMs: number; endMs: number },
  window: SessionWindow,
): boolean {
  return Math.min(window.endMs, workout.endMs) - Math.max(window.startMs, workout.startMs) > 0
}

export function planHealthImport(
  workouts: readonly HealthWorkout[],
  sessions: readonly HealthSessionRef[],
  aerobic: readonly { id: string }[] = [],
): HealthImportRow[] {
  const aerobicIds = new Set(aerobic.map((row) => row.id))
  return dedupeHealthWorkouts(workouts).map((workout) => {
    const importedId = existingHealthSession(workout, sessions)
    const aerobicImported = aerobicIds.has(healthAerobicId(workout))
    const windows = sessions
      .filter((session) => session.id !== importedId)
      .map(sessionWindow)
      .filter((window): window is SessionWindow => window !== null)
    const options = linkCandidates(workout, windows)
    const overlap = options.find((window) => positiveOverlap(workout, window)) ?? null
    const defaultTarget = importedId ?? overlap?.id ?? null
    let defaultDestination: HealthDestination = 'aerobic'
    if (!aerobicImported && (defaultTarget !== null || isGymHealthType(workout.exerciseType))) {
      defaultDestination = 'session'
    }
    return {
      workout,
      date: localDate(workout.startMs),
      alreadyImported: importedId !== null,
      aerobicImported,
      aerobicType: aerobicTypeForHealth(workout.exerciseType),
      defaultDestination,
      defaultTarget,
      options,
    }
  })
}

export function isLongHealthWorkout(workout: { startMs: number; endMs: number }): boolean {
  return workout.endMs - workout.startMs > LONG_SESSION_SECONDS * 1000
}

/** New session, or heart rate for an existing one. Distance becomes one cardio set. */
export function toHealthImport(workout: HealthWorkout): ParsedWorkoutImport {
  const name = healthWorkoutName(workout.exerciseType)
  const durationS = Math.max(0, Math.round((workout.endMs - workout.startMs) / 1000))
  const distanceM =
    workout.distanceM !== null && workout.distanceM > 0 ? Math.round(workout.distanceM) : null
  return {
    sessionId: healthSessionId(workout),
    date: localDate(workout.startMs),
    name,
    status: 'completed',
    notes: `Imported from Health Connect (${workout.origin || 'unknown source'})`,
    rpe: null,
    exercises:
      distanceM === null
        ? []
        : [
            {
              name,
              measurement: 'distance_duration',
              sets: [
                {
                  position: 1,
                  weight_kg: null,
                  reps: null,
                  duration_s: durationS,
                  distance_m: distanceM,
                  rpe: null,
                  notes: null,
                  is_warmup: false,
                  completed_at: new Date(workout.endMs).toISOString(),
                },
              ],
            },
          ],
    startedAt: new Date(workout.startMs).toISOString(),
    endedAt: new Date(workout.endMs).toISOString(),
    heartRate: thinHeartRate(mergeHeartRate([workout.heartRate])),
  }
}

export interface HealthAerobicImport {
  id: string
  date: string
  activityType: AerobicActivityType
  durationS: number
  avgBpm: number | null
  maxBpm: number | null
  notes: string
}

/** One aerobic log entry: day, sport, minutes and the watch heart rate summary. */
export function toHealthAerobic(
  workout: HealthWorkout,
  activityType: AerobicActivityType,
): HealthAerobicImport {
  const seconds = Math.round((workout.endMs - workout.startMs) / 1000)
  const heartRate = summarizeHeartRate(mergeHeartRate([workout.heartRate]))
  return {
    id: healthAerobicId(workout),
    date: localDate(workout.startMs),
    activityType,
    durationS: Math.min(86_400, Math.max(60, seconds)),
    avgBpm: heartRate?.average ?? null,
    maxBpm: heartRate?.peak ?? null,
    notes: `Imported from Health Connect (${workout.origin || 'unknown source'})`,
  }
}

/**
 * Heart-rate samples to attach after Finish.
 * Two or more overlapping watch workouts are ambiguous, so the caller asks.
 * Otherwise every valid sample in the session window is kept.
 */
export function heartRateForFinishedSession(
  session: { startMs: number; endMs: number },
  workouts: readonly HealthWorkout[],
  samplesInWindow: readonly HeartRateSample[],
): HeartRateSample[] | null {
  const overlapping = dedupeHealthWorkouts(workouts).filter((workout) =>
    positiveOverlap(workout, { id: '', startMs: session.startMs, endMs: session.endMs }),
  )
  if (overlapping.length > 1) return null
  const source = overlapping.length === 1 ? overlapping[0].heartRate : samplesInWindow
  return thinHeartRate(mergeHeartRate([source]))
}
