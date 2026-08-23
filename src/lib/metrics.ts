// Progress metrics: volume, estimated 1RM (Epley), personal records,
// streaks and plan adherence — all pure functions over session documents.
import type {
  ExerciseRow,
  SessionDoc,
  SessionExerciseDoc,
  SetRow,
} from '../types/db'
import { addDays, isoWeekday, startOfWeek, type DateKey } from './dates'

/** A set counts toward stats once it has been checked (completed). */
export function isCompleted(set: SetRow): boolean {
  return set.completed_at !== null
}

/** Stats only count real work: completed sets that are not warm-up ramps. */
export function countsForStats(set: SetRow): boolean {
  return set.completed_at !== null && !set.is_warmup
}

/** Volume of a strength set: weight × reps. 0 when incomplete. */
export function setVolume(set: SetRow): number {
  if (!countsForStats(set)) return 0
  const weight = set.weight_kg ?? 0
  const reps = set.reps ?? 0
  return weight * reps
}

function exerciseSetVolume(exercise: SessionExerciseDoc, set: SetRow): number {
  const sharedUnilateralResult =
    (exercise.side_mode === 'per_side' || exercise.side_mode === 'per_leg') && set.side == null
  return setVolume(set) * (sharedUnilateralResult ? 2 : 1)
}

function completedSetGroups(exercise: SessionExerciseDoc): number {
  const groups = new Set<string>()
  for (const set of exercise.sets.filter(countsForStats)) {
    groups.add(`${set.round_index ?? set.position}:${set.direction ?? ''}`)
  }
  return groups.size
}

export function sessionVolume(doc: SessionDoc): number {
  let total = 0
  for (const exercise of doc.session_exercises) {
    for (const set of exercise.sets) total += exerciseSetVolume(exercise, set)
  }
  return total
}

/** Epley estimated 1RM; null when the inputs make the estimate meaningless. */
export function e1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null) return null
  if (weightKg <= 0 || reps < 1) return null
  return weightKg * (1 + reps / 30)
}

export function bestE1RM(sets: SetRow[]): number | null {
  let best: number | null = null
  for (const set of sets) {
    if (!countsForStats(set)) continue
    const estimate = e1RM(set.weight_kg, set.reps)
    if (estimate !== null && (best === null || estimate > best)) best = estimate
  }
  return best
}

export interface SessionExerciseStat {
  sessionId: string
  sessionName: string
  date: DateKey
  volume: number
  bestE1RM: number | null
  topSet: SetRow | null
  completedSets: number
}

/** Per-session stats for one exercise (matched by catalog id, else by name snapshot). */
export function exerciseProgress(
  sessions: SessionDoc[],
  exercise: Pick<ExerciseRow, 'id' | 'name'>,
): SessionExerciseStat[] {
  const rows: SessionExerciseStat[] = []
  const sorted = [...sessions].sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  for (const doc of sorted) {
    const match = doc.session_exercises.find(
      (se) => se.exercise_id === exercise.id || se.name_snapshot === exercise.name,
    )
    if (!match) continue
    rows.push({
      sessionId: doc.id,
      sessionName: doc.name,
      date: doc.started_at.slice(0, 10),
      volume: match.sets.reduce((sum, s) => sum + exerciseSetVolume(match, s), 0),
      bestE1RM: bestE1RM(match.sets),
      topSet: topSetOf(match),
      completedSets: completedSetGroups(match),
    })
  }
  return rows
}

function topSetOf(exercise: SessionExerciseDoc): SetRow | null {
  let top: SetRow | null = null
  let topEstimate = -1
  for (const set of exercise.sets) {
    if (!countsForStats(set)) continue
    const estimate = e1RM(set.weight_kg, set.reps) ?? 0
    if (estimate > topEstimate) {
      topEstimate = estimate
      top = set
    }
  }
  return top
}

export type PrKind = 'e1rm' | 'weight' | 'reps' | 'distance' | 'duration'

export interface PersonalRecord {
  exerciseId: string | null
  exerciseName: string
  kind: PrKind
  /** Canonical value: kg / reps / meters / seconds. */
  value: number
  date: DateKey
}

/** Best-of kind for a list of completed sets. */
function bestOfKind(sets: SetRow[], kind: PrKind): number | null {
  let best: number | null = null
  for (const set of sets) {
    if (!countsForStats(set)) continue
    let value: number | null = null
    if (kind === 'e1rm') value = e1RM(set.weight_kg, set.reps)
    else if (kind === 'reps') value = set.reps
    else if (kind === 'weight') value = set.weight_kg
    else if (kind === 'distance') value = set.distance_m
    else value = set.duration_s
    if (value !== null && (best === null || value > best)) best = value
  }
  return best
}

function kindsForMeasurement(measurement: string): PrKind[] {
  switch (measurement) {
    case 'weight_reps':
      return ['e1rm', 'weight', 'reps']
    case 'reps':
      return ['reps']
    case 'distance_duration':
      return ['distance', 'duration']
    case 'duration':
      return ['duration']
    case 'weight_duration':
      return ['weight', 'duration']
    case 'weight_distance':
      return ['weight', 'distance']
    default:
      return []
  }
}

/**
 * Personal records across all history. Exercises are identified by catalog id
 * when present, falling back to the frozen name snapshot (history stays stable
 * even if the catalog changes later).
 */
export function personalRecords(sessions: SessionDoc[]): PersonalRecord[] {
  const byExercise = new Map<string, { name: string; measurement: string }>()
  const byDate = new Map<string, { sets: SetRow[]; date: DateKey }[]>()

  for (const doc of sessions) {
    for (const se of doc.session_exercises) {
      const key = se.exercise_id ?? `name:${se.name_snapshot}`
      byExercise.set(key, {
        name: se.name_snapshot,
        measurement: se.measurement_snapshot,
      })
      const bucket = byDate.get(key) ?? []
      bucket.push({ sets: se.sets, date: doc.started_at.slice(0, 10) })
      byDate.set(key, bucket)
    }
  }

  const records: PersonalRecord[] = []
  for (const [key, info] of byExercise) {
    for (const kind of kindsForMeasurement(info.measurement)) {
      let best: PersonalRecord | null = null
      for (const entry of byDate.get(key) ?? []) {
        const value = bestOfKind(entry.sets, kind)
        if (value === null) continue
        if (best === null || value > best.value) {
          best = {
            exerciseId: key.startsWith('name:') ? null : key,
            exerciseName: info.name,
            kind,
            value,
            date: entry.date,
          }
        }
      }
      if (best) records.push(best)
    }
  }
  return records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

const PR_KIND_ORDER: readonly PrKind[] = ['e1rm', 'weight', 'reps', 'distance', 'duration']

export interface GroupedPersonalRecord {
  key: string
  exerciseId: string | null
  exerciseName: string
  records: PersonalRecord[]
  latestDate: DateKey
}

/** Collapse per-kind PRs into one row per exercise, newest first. */
export function groupPersonalRecords(records: PersonalRecord[]): GroupedPersonalRecord[] {
  const map = new Map<string, GroupedPersonalRecord>()
  for (const rec of records) {
    const key = rec.exerciseId ?? `name:${rec.exerciseName}`
    const existing = map.get(key)
    if (existing) {
      existing.records.push(rec)
      if (rec.date > existing.latestDate) existing.latestDate = rec.date
    } else {
      map.set(key, {
        key,
        exerciseId: rec.exerciseId,
        exerciseName: rec.exerciseName,
        records: [rec],
        latestDate: rec.date,
      })
    }
  }
  return [...map.values()]
    .map((group) => ({
      ...group,
      records: [...group.records].sort(
        (a, b) => PR_KIND_ORDER.indexOf(a.kind) - PR_KIND_ORDER.indexOf(b.kind),
      ),
    }))
    .sort((a, b) => {
      if (a.latestDate !== b.latestDate) return a.latestDate < b.latestDate ? 1 : -1
      return a.exerciseName.localeCompare(b.exerciseName)
    })
}

/** Previous performance for an exercise, from the most recent session that
 * contains it (excluding the given session). Returns formatted raw sets. */
export function previousSetsForExercise(
  sessions: SessionDoc[],
  exerciseId: string,
  exerciseName: string,
  excludeSessionId?: string,
): SetRow[] | null {
  const sorted = [...sessions]
    .filter((s) => s.id !== excludeSessionId && s.status === 'completed')
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  for (const doc of sorted) {
    const match = doc.session_exercises.find(
      (se) => se.exercise_id === exerciseId || se.name_snapshot === exerciseName,
    )
    const completed = match?.sets.filter(isCompleted) ?? []
    if (match && completed.length > 0) return completed
  }
  return null
}

export interface WeekVolume {
  weekStart: DateKey
  volume: number
}

/** Weekly volume for the last `weeks` weeks (oldest first), zero-filled. */
export function weeklyVolume(
  sessions: SessionDoc[],
  weeks: number,
  weekStartDay: 'monday' | 'sunday',
  endingOn: DateKey,
): WeekVolume[] {
  const buckets = new Map<DateKey, number>()
  let cursor = startOfWeek(endingOn, weekStartDay)
  for (let i = 0; i < weeks; i++) {
    buckets.set(cursor, 0)
    cursor = addDays(cursor, -7)
  }
  for (const doc of sessions) {
    const dateKey = doc.started_at.slice(0, 10)
    const week = startOfWeek(dateKey, weekStartDay)
    const bucket = buckets.get(week)
    if (bucket !== undefined) buckets.set(week, bucket + sessionVolume(doc))
  }
  return [...buckets.entries()]
    .map(([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
}

/** Completed sets per muscle group in the given date window. */
export function setsPerMuscleGroup(
  sessions: SessionDoc[],
  exercises: ExerciseRow[],
  sinceKey: DateKey,
): { group: string; sets: number }[] {
  const catalog = new Map(exercises.map((e) => [e.id, e]))
  const totals = new Map<string, number>()
  for (const doc of sessions) {
    const dateKey = doc.started_at.slice(0, 10)
    if (dateKey < sinceKey) continue
    for (const se of doc.session_exercises) {
      const info = se.exercise_id ? catalog.get(se.exercise_id) : undefined
      const groups = info?.muscle_groups?.length ? info.muscle_groups : [se.name_snapshot]
      const count = completedSetGroups(se)
      if (count === 0) continue
      for (const group of groups) {
        totals.set(group, (totals.get(group) ?? 0) + count)
      }
    }
  }
  return [...totals.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets)
}

export interface Totals {
  workouts: number
  totalMinutes: number
  avgMinutes: number
  volume: number
}

/** Totals over completed sessions. */
export function sessionTotals(sessions: SessionDoc[]): Totals {
  const completed = sessions.filter((s) => s.status === 'completed')
  const minutes = completed.reduce((sum, s) => {
    if (!s.ended_at) return sum
    return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
  }, 0)
  return {
    workouts: completed.length,
    totalMinutes: Math.round(minutes),
    avgMinutes: completed.length > 0 ? Math.round(minutes / completed.length) : 0,
    volume: completed.reduce((sum, s) => sum + sessionVolume(s), 0),
  }
}

/** Consecutive days with at least one completed workout, ending today or yesterday. */
export function workoutStreak(sessions: SessionDoc[], today: DateKey): number {
  const days = new Set(
    sessions
      .filter((s) => s.status === 'completed')
      .map((s) => s.started_at.slice(0, 10)),
  )
  if (days.size === 0) return 0
  let streak = 0
  let cursor = days.has(today) ? today : addDays(today, -1)
  if (!days.has(cursor)) return 0
  while (days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export interface Adherence {
  planned: number
  completed: number
  percent: number
}

/**
 * Plan adherence in a window: completed sessions dated within the window over
 * planned occurrences (from schedules) in the same window.
 */
export function adherence(
  plannedCountInRange: number,
  sessions: SessionDoc[],
  from: DateKey,
  to: DateKey,
): Adherence {
  const completed = sessions.filter((s) => {
    if (s.status !== 'completed') return false
    const dateKey = s.planned_date ?? s.started_at.slice(0, 10)
    return dateKey >= from && dateKey <= to
  }).length
  const planned = Math.max(plannedCountInRange, completed)
  return {
    planned,
    completed,
    percent: planned === 0 ? 0 : Math.round((completed / planned) * 100),
  }
}

/** Weekday histogram of completed workouts (1 = Monday … 7 = Sunday). */
export function workoutsPerWeekday(sessions: SessionDoc[]): number[] {
  const counts = new Array<number>(8).fill(0)
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    counts[isoWeekday(s.started_at.slice(0, 10))] += 1
  }
  return counts.slice(1)
}
