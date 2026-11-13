// Workout CSV import/export. Canonical units (kg / m / s) so a file
// round-trips across metric and imperial display settings.

import type {
  AerobicActivityRow,
  BodyWeightRow,
  ExerciseMeasurement,
  ExerciseRow,
  SessionDoc,
  SessionStatus,
  SetRow,
} from '../types/db'
import { summarizeHeartRate, type HeartRateSample } from './heartRate'
import { t } from './i18n'

export const WORKOUT_CSV_HEADERS = [
  'record_type',
  'session_id',
  'date',
  'workout_name',
  'status',
  'session_notes',
  'session_rpe',
  'exercise_name',
  'measurement',
  'set_number',
  'weight_kg',
  'reps',
  'duration_s',
  'distance_m',
  'set_rpe',
  'set_notes',
  'round_index',
  'side',
  'direction',
  'is_warmup',
  'completed_at',
  'activity_type',
  'moderate',
  'hr_avg_bpm',
  'hr_peak_bpm',
  'hr_samples',
  'note',
] as const

export interface WorkoutCsvRow {
  record_type: string
  session_id: string
  date: string
  workout_name: string
  status: SessionStatus
  session_notes: string
  session_rpe: string
  exercise_name: string
  measurement: string
  set_number: string
  weight_kg: string
  reps: string
  duration_s: string
  distance_m: string
  set_rpe: string
  set_notes: string
  round_index: string
  side: string
  direction: string
  is_warmup: string
  completed_at: string
  activity_type: string
  moderate: string
  hr_avg_bpm: string
  hr_peak_bpm: string
  hr_samples: string
  note: string
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

type CsvCellValue = string | number | boolean | null | undefined
type CsvCells = Partial<Record<(typeof WORKOUT_CSV_HEADERS)[number], CsvCellValue>>

/** Builds a line by header name so positional mistakes cannot shift columns. */
function formatRow(cells: CsvCells): string {
  return WORKOUT_CSV_HEADERS.map((header) => escapeCell(cell(cells[header]))).join(',')
}

/** RFC 4180-ish parser that understands quoted commas and newlines. */
export function parseCsv(text: string): string[][] {
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
    if (ch === ',') {
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

export interface WorkoutCsvExtras {
  /** Every recorded body-weight entry, exported as `body_weight` rows. */
  bodyWeights?: readonly BodyWeightRow[]
  /** Every recorded aerobic activity, exported as `aerobic` rows. */
  aerobicActivities?: readonly AerobicActivityRow[]
  /** Per-session heart-rate samples, summarized into one `heart_rate` row each. */
  heartRate?: ReadonlyMap<string, readonly HeartRateSample[]>
}

export function serializeWorkoutCsv(
  sessions: SessionDoc[],
  extras: WorkoutCsvExtras = {},
): string {
  const lines = [WORKOUT_CSV_HEADERS.join(',')]
  const exported = sessions
    .filter((s) => s.status === 'completed' || s.status === 'skipped')
    .sort((a, b) => a.started_at.localeCompare(b.started_at))

  const sessionDate = (session: SessionDoc): string =>
    session.planned_date ?? session.started_at.slice(0, 10)

  for (const session of exported) {
    const base = {
      record_type: 'set' as const,
      session_id: session.id,
      date: sessionDate(session),
      workout_name: session.name,
      status: session.status,
      session_notes: session.notes ?? '',
      session_rpe: session.rpe === null ? '' : String(session.rpe),
    }

    if (session.session_exercises.length === 0) {
      lines.push(formatRow(base))
      continue
    }

    for (const exercise of session.session_exercises) {
      const completedSets = exercise.sets.filter((set) => set.completed_at !== null)
      const sets = completedSets.length > 0 ? completedSets : [null]
      for (const set of sets) {
        lines.push(
          formatRow({
            ...base,
            exercise_name: exercise.name_snapshot,
            measurement: exercise.measurement_snapshot,
            set_number: set ? set.position : '',
            weight_kg: set ? set.weight_kg : '',
            reps: set ? set.reps : '',
            duration_s: set ? set.duration_s : '',
            distance_m: set ? set.distance_m : '',
            set_rpe: set ? set.rpe : '',
            set_notes: set ? set.notes ?? '' : '',
            round_index: set ? set.round_index : '',
            side: set ? set.side : '',
            direction: set ? set.direction : '',
            is_warmup: set ? set.is_warmup : '',
            completed_at: set ? set.completed_at : '',
          }),
        )
      }
    }
  }

  const bodyWeights = [...(extras.bodyWeights ?? [])].sort(
    (a, b) => a.recorded_on.localeCompare(b.recorded_on) || a.id.localeCompare(b.id),
  )
  for (const entry of bodyWeights) {
    lines.push(
      formatRow({
        record_type: 'body_weight',
        date: entry.recorded_on,
        weight_kg: entry.weight_kg,
        note: entry.notes ?? '',
      }),
    )
  }

  const aerobicActivities = [...(extras.aerobicActivities ?? [])].sort(
    (a, b) => a.recorded_on.localeCompare(b.recorded_on) || a.id.localeCompare(b.id),
  )
  for (const activity of aerobicActivities) {
    lines.push(
      formatRow({
        record_type: 'aerobic',
        date: activity.recorded_on,
        activity_type: activity.activity_type,
        duration_s: activity.duration_s,
        moderate: activity.moderate,
        note: activity.notes ?? '',
      }),
    )
  }

  for (const session of exported) {
    const samples = extras.heartRate?.get(session.id)
    if (!samples || samples.length === 0) continue
    const summary = summarizeHeartRate(samples)
    if (!summary) continue
    lines.push(
      formatRow({
        record_type: 'heart_rate',
        session_id: session.id,
        date: sessionDate(session),
        workout_name: session.name,
        hr_avg_bpm: summary.average,
        hr_peak_bpm: summary.peak,
        hr_samples: samples.length,
      }),
    )
  }

  return `${lines.join('\n')}\n`
}

export interface ParsedWorkoutImport {
  sessionId: string
  date: string
  name: string
  status: SessionStatus
  notes: string | null
  rpe: number | null
  exercises: {
    name: string
    measurement: ExerciseMeasurement
    sets: Omit<SetRow, 'id' | 'session_exercise_id' | 'created_at' | 'updated_at'>[]
  }[]
  /** Real start/end (ISO) when the source knows them; otherwise noon / import time. */
  startedAt?: string
  endedAt?: string
  /** Heart-rate samples stored locally with the session (not synced). */
  heartRate?: HeartRateSample[]
}

const MEASUREMENTS: ExerciseMeasurement[] = [
  'weight_reps',
  'reps',
  'duration',
  'distance_duration',
  'weight_duration',
  'weight_distance',
]

function asStatus(value: string): SessionStatus {
  if (value === 'skipped') return 'skipped'
  if (value === 'in_progress') return 'in_progress'
  return 'completed'
}

function asMeasurement(value: string): ExerciseMeasurement {
  return MEASUREMENTS.includes(value as ExerciseMeasurement)
    ? (value as ExerciseMeasurement)
    : 'weight_reps'
}

function asNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function asInt(value: string): number | null {
  const parsed = asNumber(value)
  if (parsed === null) return null
  return Math.round(parsed)
}

export function parseWorkoutCsv(text: string): ParsedWorkoutImport[] {
  const table = parseCsv(text)
  if (table.length === 0) return []
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase())
  const index = (name: string): number => header.indexOf(name)

  const col = {
    record_type: index('record_type'),
    session_id: index('session_id'),
    date: index('date'),
    workout_name: index('workout_name'),
    status: index('status'),
    session_notes: index('session_notes'),
    session_rpe: index('session_rpe'),
    exercise_name: index('exercise_name'),
    measurement: index('measurement'),
    set_number: index('set_number'),
    weight_kg: index('weight_kg'),
    reps: index('reps'),
    duration_s: index('duration_s'),
    distance_m: index('distance_m'),
    set_rpe: index('set_rpe'),
    set_notes: index('set_notes'),
    round_index: index('round_index'),
    side: index('side'),
    direction: index('direction'),
    is_warmup: index('is_warmup'),
    completed_at: index('completed_at'),
  }

  if (col.workout_name < 0 && col.session_id < 0) {
    throw new Error(t('errors.notHerkulesCsv'))
  }

  const take = (row: string[], key: keyof typeof col): string => {
    const at = col[key]
    if (at < 0) return ''
    return (row[at] ?? '').trim()
  }

  const bySession = new Map<string, ParsedWorkoutImport>()
  const body = table.slice(1)

  body.forEach((row, rowIndex) => {
    // Newer exports also carry body weights, aerobic activities and heart-rate
    // rows in the same table; only set rows belong to the workout import.
    const recordType = take(row, 'record_type')
    if (col.record_type >= 0 && (recordType === '' || recordType !== 'set')) return

    const sessionId = take(row, 'session_id') || `import-${rowIndex}`
    const existing = bySession.get(sessionId)
    const session: ParsedWorkoutImport = existing ?? {
      sessionId,
      date: take(row, 'date') || new Date().toISOString().slice(0, 10),
      name: take(row, 'workout_name') || 'Imported workout',
      status: asStatus(take(row, 'status')),
      notes: take(row, 'session_notes') || null,
      rpe: asInt(take(row, 'session_rpe')),
      exercises: [],
    }
    if (!existing) bySession.set(sessionId, session)

    const exerciseName = take(row, 'exercise_name')
    if (!exerciseName) return

    let exercise = session.exercises.find((e) => e.name === exerciseName)
    if (!exercise) {
      exercise = {
        name: exerciseName,
        measurement: asMeasurement(take(row, 'measurement')),
        sets: [],
      }
      session.exercises.push(exercise)
    }

    const setNumber = asInt(take(row, 'set_number'))
    if (setNumber === null && take(row, 'weight_kg') === '' && take(row, 'reps') === '') return

    exercise.sets.push({
      position: setNumber ?? exercise.sets.length + 1,
      weight_kg: asNumber(take(row, 'weight_kg')),
      reps: asInt(take(row, 'reps')),
      duration_s: asInt(take(row, 'duration_s')),
      distance_m: asNumber(take(row, 'distance_m')),
      rpe: asInt(take(row, 'set_rpe')),
      notes: take(row, 'set_notes') || null,
      is_warmup: take(row, 'is_warmup') === 'true',
      round_index: asInt(take(row, 'round_index')),
      side: asSide(take(row, 'side')),
      direction: asDirection(take(row, 'direction')),
      completed_at: take(row, 'completed_at') || `${session.date}T12:00:00.000Z`,
    })
  })

  return [...bySession.values()]
}

function asSide(value: string): SetRow['side'] {
  return value === 'left' || value === 'right' ? value : null
}

function asDirection(value: string): SetRow['direction'] {
  return value === 'pronation' || value === 'supination' ? value : null
}

export function matchExercise(
  name: string,
  catalog: ExerciseRow[],
): ExerciseRow | undefined {
  const needle = name.trim().toLowerCase()
  return catalog.find((e) => e.name.toLowerCase() === needle && !e.is_archived)
}
