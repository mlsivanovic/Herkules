// Importer for Samsung Health exercise exports, used to bring in workouts that
// other wearables (e.g. a Xiaomi watch via Mi Fitness) sync into Samsung Health.
//
// The exercise CSV starts with one metadata line
// ("com.samsung.shealth.exercise,<version>,<count>"), then a header row whose
// columns are mostly prefixed with "com.samsung.health.exercise.". Data rows
// carry a trailing comma. Start/end times are UTC wall-clock strings and
// `time_offset` ("UTC+0100") gives the local offset at recording time.
// Heart-rate detail lives in separate "<datauuid>.com.samsung.health.exercise.
// live_data.json" files: an array of { heart_rate, start_time (unix ms) }.
import type { ParsedWorkoutImport } from './csv'
import type { HeartRateSample } from './heartRate'
import { t } from './i18n'
import { deterministicUuid, parseDelimited } from './importExternal'
import { LONG_SESSION_SECONDS, sessionDurationSeconds } from './sessionDuration'

const PREFIX = 'com.samsung.health.exercise.'
export const XIAOMI_SOURCE = 'com.xiaomi.wearable'
/** Samsung's code for an unspecified / "other" workout. */
export const OTHER_WORKOUT_TYPE = '0'

export interface SamsungWorkout {
  /** Samsung `datauuid`, stable across exports. */
  uuid: string
  /** Package that recorded the workout (`pkg_name`). */
  source: string
  exerciseType: string
  startMs: number
  endMs: number
  /** Local offset in minutes, or null when the export did not carry one. */
  offsetMinutes: number | null
  /** Local date (YYYY-MM-DD) and time (HH:MM) at recording time. */
  localDate: string
  localTime: string
  durationS: number
  distanceM: number | null
  meanHeartRate: number | null
  maxHeartRate: number | null
  /** Name of the matching live_data JSON file, if Samsung recorded one. */
  liveDataFile: string | null
}

/** Cheap check on the first line so other Samsung CSVs are rejected early. */
export function isSamsungExerciseCsv(text: string): boolean {
  return /^﻿?com\.samsung\.shealth\.exercise,/.test(text)
}

/** "2026-11-12 19:24:50.000" (UTC) -> unix ms. */
function parseUtc(value: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(value.trim())
  if (!match) return null
  const ms = Date.parse(`${match[1]}T${match[2]}Z`)
  return Number.isFinite(ms) ? ms : null
}

/** "UTC+0100" / "UTC-05:30" -> minutes east of UTC. */
export function parseOffset(value: string): number | null {
  const match = /^UTC([+-])(\d{2}):?(\d{2})$/.exec(value.trim())
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

function positive(value: string): number | null {
  const parsed = Number(value.trim())
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function localParts(ms: number, offsetMinutes: number | null): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (offsetMinutes === null) {
    const d = new Date(ms)
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    }
  }
  const iso = new Date(ms + offsetMinutes * 60_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** Every exercise row in the export, newest first. */
export function parseSamsungExerciseCsv(text: string): SamsungWorkout[] {
  if (!isSamsungExerciseCsv(text)) throw new Error(t('errors.notSamsungExport'))
  const table = parseDelimited(text, ',')
  const headerAt = table.findIndex((row) => row.includes(`${PREFIX}start_time`))
  if (headerAt < 0) throw new Error(t('errors.notSamsungExport'))
  const headers = table[headerAt].map((h) => h.trim())
  const index = new Map(headers.map((h, i) => [h, i]))
  const take = (row: string[], name: string): string => {
    const at = index.get(`${PREFIX}${name}`) ?? index.get(name)
    return at === undefined ? '' : (row[at] ?? '').trim()
  }

  const workouts: SamsungWorkout[] = []
  for (const row of table.slice(headerAt + 1)) {
    const uuid = take(row, 'datauuid')
    const startMs = parseUtc(take(row, 'start_time'))
    if (uuid === '' || startMs === null) continue
    const durationMs = positive(take(row, 'duration'))
    const endMs = parseUtc(take(row, 'end_time')) ?? (durationMs === null ? startMs : startMs + durationMs)
    const offsetMinutes = parseOffset(take(row, 'time_offset'))
    const local = localParts(startMs, offsetMinutes)
    const mean = positive(take(row, 'mean_heart_rate'))
    const max = positive(take(row, 'max_heart_rate'))
    workouts.push({
      uuid,
      source: take(row, 'pkg_name'),
      exerciseType: take(row, 'exercise_type'),
      startMs,
      endMs: Math.max(startMs, endMs),
      offsetMinutes,
      localDate: local.date,
      localTime: local.time,
      durationS: Math.round((durationMs ?? Math.max(0, endMs - startMs)) / 1000),
      distanceM: positive(take(row, 'distance')),
      meanHeartRate: mean === null ? null : Math.round(mean),
      maxHeartRate: max === null ? null : Math.round(max),
      liveDataFile: take(row, 'live_data') || null,
    })
  }
  return workouts.sort((a, b) => b.startMs - a.startMs)
}

/** Heart-rate samples from a live_data JSON file; other record kinds are skipped. */
export function parseSamsungHeartRate(text: string): HeartRateSample[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(t('errors.samsungHeartRateFile'))
  }
  if (!Array.isArray(data)) throw new Error(t('errors.samsungHeartRateFile'))
  const byTime = new Map<number, number>()
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue
    const { heart_rate: bpm, start_time: at } = entry as Record<string, unknown>
    if (typeof bpm !== 'number' || typeof at !== 'number') continue
    if (!Number.isFinite(bpm) || !Number.isFinite(at) || bpm <= 0 || bpm > 250) continue
    byTime.set(at, Math.round(bpm))
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([at, bpm]) => ({ at, bpm }))
}

// Main exercise CSV only: companions such as "exercise.hr_zone.<ts>.csv" or
// "exercise.periodization_training_schedule.<ts>.csv" have a word before the timestamp.
const EXERCISE_CSV = /^com\.samsung\.shealth\.exercise\.(\d+)(?: \(\d+\))?\.csv$/i
// Per-workout heart-rate detail; "location_data" / "live_data_internal" files are not it.
const LIVE_DATA_JSON = /^(.+?)\.com\.samsung\.health\.exercise\.live_data(?: \(\d+\))?\.json$/i

interface NamedFile {
  name: string
  lastModified: number
}

/** Exercise CSVs in a picked folder or file list, newest export first. */
export function exerciseCsvCandidates<T extends NamedFile>(files: readonly T[]): T[] {
  const stamp = (file: T) => EXERCISE_CSV.exec(file.name)?.[1] ?? ''
  return files
    .filter((file) => EXERCISE_CSV.test(file.name))
    .sort((a, b) => {
      const byStamp = stamp(b).padStart(20, '0').localeCompare(stamp(a).padStart(20, '0'))
      return byStamp !== 0 ? byStamp : b.lastModified - a.lastModified
    })
}

/** The record key a live_data file belongs to (re-downloads add " (1)"), or null. */
export function heartRateFileKey(name: string): string | null {
  return LIVE_DATA_JSON.exec(name)?.[1] ?? null
}

/** live_data files by record key; with several exports in the folder the newest copy wins. */
export function indexHeartRateFiles<T extends NamedFile>(files: readonly T[]): Map<string, T> {
  const index = new Map<string, T>()
  for (const file of files) {
    const key = heartRateFileKey(file.name)
    if (key === null) continue
    const known = index.get(key)
    if (!known || file.lastModified > known.lastModified) index.set(key, file)
  }
  return index
}

export function heartRateFileFor<T>(workout: SamsungWorkout, index: ReadonlyMap<string, T>): T | undefined {
  const named = workout.liveDataFile ? heartRateFileKey(workout.liveDataFile) : null
  return (named === null ? undefined : index.get(named)) ?? index.get(workout.uuid)
}

export function isLongWorkout(workout: SamsungWorkout): boolean {
  return workout.durationS > LONG_SESSION_SECONDS
}

/** Default pick: watch workouts of the unspecified type with a plausible length. */
export function selectedByDefault(workout: SamsungWorkout): boolean {
  return workout.source === XIAOMI_SOURCE &&
    workout.exerciseType === OTHER_WORKOUT_TYPE &&
    workout.durationS > 0 &&
    !isLongWorkout(workout)
}

export function samsungSessionId(uuid: string): string {
  return deterministicUuid('samsung-health', uuid)
}

/** A gym session without sets: start/end times plus optional heart-rate samples. */
export function toWorkoutImport(
  workout: SamsungWorkout,
  heartRate: HeartRateSample[] = [],
): ParsedWorkoutImport {
  return {
    sessionId: samsungSessionId(workout.uuid),
    date: workout.localDate,
    // Canonical stored data stays English.
    name: 'Gym workout',
    status: 'completed',
    notes: `Imported from Samsung Health (${workout.source || 'unknown source'})`,
    rpe: null,
    exercises: [],
    startedAt: new Date(workout.startMs).toISOString(),
    endedAt: new Date(workout.endMs).toISOString(),
    heartRate,
  }
}

/** How far apart a watch workout and a Herkules session may be and still be offered as a link. */
export const LINK_GAP_MS = 30 * 60_000

export interface SessionWindow {
  id: string
  startMs: number
  endMs: number
}

/** Logged span of a finished Herkules session (start to last set, else to Finish). */
export function sessionWindow(session: {
  id: string
  status: string
  started_at: string
  ended_at: string | null
  session_exercises?: { sets: { completed_at: string | null }[] }[]
}): SessionWindow | null {
  if (session.status !== 'completed') return null
  const startMs = Date.parse(session.started_at)
  const seconds = sessionDurationSeconds(session)
  if (!Number.isFinite(startMs) || seconds === null) return null
  return { id: session.id, startMs, endMs: startMs + seconds * 1000 }
}

/**
 * Herkules sessions that a watch workout plausibly belongs to: overlapping
 * ones first (largest overlap wins), then those within LINK_GAP_MS (closest first).
 */
export function linkCandidates(
  workout: { startMs: number; endMs: number },
  windows: readonly SessionWindow[],
): SessionWindow[] {
  const scored = windows.map((w) => {
    const overlap = Math.min(w.endMs, workout.endMs) - Math.max(w.startMs, workout.startMs)
    return { window: w, overlap }
  }).filter(({ overlap }) => overlap > -LINK_GAP_MS)
  // Positive overlap sorts by size; negative values are gaps, so larger (closer to 0) is better too.
  return scored.sort((a, b) => b.overlap - a.overlap).map(({ window }) => window)
}
