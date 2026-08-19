// Importer for Strong and Hevy workout CSV exports (one row per set).
// Both apps use the same column family:
//   Date | Workout Name | Duration | Exercise Name | Set Order | Weight |
//   Weight Unit | Reps | RPE | Distance | Distance Unit | Seconds | Notes
// Strong may separate with ';' depending on locale; Hevy prefixes some
// headers with '#'. Everything is converted to canonical kg / meters /
// seconds. Session ids are deterministic, so importing the same file twice
// overwrites instead of duplicating.
import type { ExerciseMeasurement } from '../types/db'
import type { ParsedWorkoutImport } from './csv'

const LB_TO_KG = 0.45359237

/** RFC 4180-ish parser with a configurable delimiter (';' exports). */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cellValue = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cellValue += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cellValue += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === delimiter) {
      row.push(cellValue)
      cellValue = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1
      row.push(cellValue)
      cellValue = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    cellValue += ch
  }
  row.push(cellValue)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/** Heuristic: Strong exports use ';' in some locales — pick the delimiter
 * that yields more columns on the header line. */
export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length
  const semis = (headerLine.match(/;/g) ?? []).length
  return semis > commas ? ';' : ','
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Deterministic UUID-shaped id from stable parts (re-import stays idempotent). */
export function deterministicUuid(...parts: (string | number)[]): string {
  const key = parts.join('|')
  const words = [
    fnv1a(key, 0x811c9dc5),
    fnv1a(key, 0x9e3779b1),
    fnv1a(key, 0x85ebca6b),
    fnv1a(key, 0xc2b2ae35),
  ].map((n) => n.toString(16).padStart(8, '0'))
  const hex = words.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function parseExternalDate(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  // "2018-08-08 06:28:31" (Strong) or ISO with 'T'.
  const isoLike = /^(\d{4}-\d{2}-\d{2})[ T]/.exec(trimmed)
  if (isoLike) return isoLike[1] ?? null
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function toNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toKg(weight: number, unit: string): number {
  return unit.trim().toLowerCase().startsWith('lb') ? weight * LB_TO_KG : weight
}

function toMeters(distance: number, unit: string): number {
  const normalized = unit.trim().toLowerCase()
  if (normalized === 'km') return distance * 1000
  if (normalized === 'mi' || normalized === 'mile' || normalized === 'miles') return distance * 1609.344
  return distance
}

function measurementFor(set: {
  weightKg: number | null
  reps: number | null
  seconds: number | null
  meters: number | null
}): ExerciseMeasurement {
  if (set.meters !== null) return 'distance_duration'
  if (set.weightKg !== null && set.reps !== null) return 'weight_reps'
  if (set.weightKg !== null && set.seconds !== null) return 'weight_duration'
  if (set.reps !== null) return 'reps'
  return 'duration'
}

/** Column aliases across the two export flavors. */
const COLUMN_ALIASES: Record<string, string[]> = {
  seconds: ['time'],
}

function findColumn(headers: string[], target: string): number {
  const names = [target, ...(COLUMN_ALIASES[target] ?? [])]
  // Canonical name first, aliases only as a fallback ("seconds" beats "time").
  const exactTarget = headers.indexOf(target)
  if (exactTarget >= 0) return exactTarget
  for (const alias of COLUMN_ALIASES[target] ?? []) {
    const at = headers.indexOf(alias)
    if (at >= 0) return at
  }
  // "# Weight (kg)" / "# Distance (km)" style headers — match the parenthesized
  // unit form first so "weight" never grabs the "weight unit" column.
  for (const name of names) {
    const paren = headers.findIndex(
      (h) => h.startsWith(`${name} (`) || h.startsWith(`${name}(`),
    )
    if (paren >= 0) return paren
  }
  for (const name of names) {
    const prefix = headers.findIndex((h) => h.startsWith(`${name} `))
    if (prefix >= 0) return prefix
  }
  return -1
}

export function parseExternalCsv(
  text: string,
  source: 'strong' | 'hevy' = 'strong',
): ParsedWorkoutImport[] {
  const firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length)
  const table = parseDelimited(text, detectDelimiter(firstLine))
  if (table.length < 2) return []

  const headers = table[0].map((h) => h.trim().toLowerCase().replace(/^#+\s*/, ''))
  const at = (name: string): number => findColumn(headers, name)

  const dateAt = at('date')
  const workoutAt = at('workout name')
  const exerciseAt = at('exercise name')
  if (workoutAt < 0 || exerciseAt < 0) {
    throw new Error('This file does not look like a Strong or Hevy workout export.')
  }

  const take = (row: string[], position: number): string =>
    position >= 0 && position < row.length ? row[position].trim() : ''

  const sessions: ParsedWorkoutImport[] = []
  type DraftSession = ParsedWorkoutImport & { sessionIndex: number }
  let current: DraftSession | null = null
  let sessionIndex = 0

  for (const row of table.slice(1)) {
    const workoutName = take(row, workoutAt) || 'Imported workout'
    const date = parseExternalDate(take(row, dateAt)) ?? new Date().toISOString().slice(0, 10)

    // A new session starts when the workout name or date changes; Strong
    // repeats both on every row of the same session.
    if (!current || current.name !== workoutName || current.date !== date) {
      sessionIndex += 1
      current = {
        sessionId: deterministicUuid(source, date, workoutName, sessionIndex),
        date,
        name: workoutName,
        status: 'completed',
        notes: null,
        rpe: null,
        exercises: [],
        sessionIndex,
      }
      sessions.push(current)
    }

    const exerciseName = take(row, exerciseAt)
    if (exerciseName === '') continue

    let exercise = current.exercises.find((e) => e.name === exerciseName)
    if (!exercise) {
      exercise = { name: exerciseName, measurement: 'duration', sets: [] }
      current.exercises.push(exercise)
    }

    const set = {
      weightKg: (() => {
        const weight = toNumber(take(row, at('weight')))
        return weight === null ? null : Math.round(toKg(weight, take(row, at('weight unit'))) * 100) / 100
      })(),
      reps: toNumber(take(row, at('reps'))),
      seconds: toNumber(take(row, at('seconds'))),
      meters: (() => {
        const distance = toNumber(take(row, at('distance')))
        return distance === null ? null : Math.round(toMeters(distance, take(row, at('distance unit'))))
      })(),
    }

    const setOrder = toNumber(take(row, at('set order')))
    const rpeRaw = toNumber(take(row, at('rpe')))
    exercise.sets.push({
      position: setOrder === null ? exercise.sets.length + 1 : Math.round(setOrder),
      weight_kg: set.weightKg,
      reps: set.reps === null ? null : Math.round(set.reps),
      duration_s: set.seconds === null ? null : Math.round(set.seconds),
      distance_m: set.meters,
      rpe: rpeRaw === null ? null : Math.max(1, Math.min(10, Math.round(rpeRaw))),
      notes: take(row, at('notes')) || null,
      is_warmup: false,
      completed_at: `${date}T12:00:00.000Z`,
    })
    if (exercise.sets.length === 1) exercise.measurement = measurementFor(set)
  }

  // Drop sessions that ended up with no sets at all (header noise etc.).
  return sessions.filter((s) => s.exercises.some((e) => e.sets.length > 0))
}
