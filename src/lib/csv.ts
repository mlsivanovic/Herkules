// Workout CSV import/export. Canonical units (kg / m / s) so a file
// round-trips across metric and imperial display settings.

import type { ExerciseMeasurement, ExerciseRow, SessionDoc, SessionStatus, SetRow } from '../types/db'

export const WORKOUT_CSV_HEADERS = [
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
] as const

export interface WorkoutCsvRow {
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
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
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

export function serializeWorkoutCsv(sessions: SessionDoc[]): string {
  const lines = [WORKOUT_CSV_HEADERS.join(',')]
  const exported = sessions
    .filter((s) => s.status === 'completed' || s.status === 'skipped')
    .sort((a, b) => a.started_at.localeCompare(b.started_at))

  for (const session of exported) {
    const date = session.planned_date ?? session.started_at.slice(0, 10)
    const base = {
      session_id: session.id,
      date,
      workout_name: session.name,
      status: session.status,
      session_notes: session.notes ?? '',
      session_rpe: session.rpe === null ? '' : String(session.rpe),
    }

    if (session.session_exercises.length === 0) {
      lines.push(
        [
          base.session_id,
          base.date,
          escapeCell(base.workout_name),
          base.status,
          escapeCell(base.session_notes),
          base.session_rpe,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ].join(','),
      )
      continue
    }

    for (const exercise of session.session_exercises) {
      const completedSets = exercise.sets.filter((set) => set.completed_at !== null)
      const sets = completedSets.length > 0 ? completedSets : [null]
      for (const set of sets) {
        lines.push(
          [
            base.session_id,
            base.date,
            escapeCell(base.workout_name),
            base.status,
            escapeCell(base.session_notes),
            base.session_rpe,
            escapeCell(exercise.name_snapshot),
            exercise.measurement_snapshot,
            set ? String(set.position) : '',
            set ? cell(set.weight_kg) : '',
            set ? cell(set.reps) : '',
            set ? cell(set.duration_s) : '',
            set ? cell(set.distance_m) : '',
            set ? cell(set.rpe) : '',
            set ? escapeCell(set.notes ?? '') : '',
            set ? cell(set.round_index) : '',
            set ? cell(set.side) : '',
            set ? cell(set.direction) : '',
            set ? cell(set.is_warmup) : '',
            set ? cell(set.completed_at) : '',
          ].join(','),
        )
      }
    }
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
    throw new Error('This file is not a Herkules workout CSV (missing workout_name / session_id).')
  }

  const take = (row: string[], key: keyof typeof col): string => {
    const at = col[key]
    if (at < 0) return ''
    return (row[at] ?? '').trim()
  }

  const bySession = new Map<string, ParsedWorkoutImport>()
  const body = table.slice(1)

  body.forEach((row, rowIndex) => {
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
