import type {
  AerobicActivityRow,
  SessionBlockRow,
  SessionDoc,
  SessionExerciseDoc,
  SessionExerciseRow,
  SetRow,
  TemplateBlockRow,
  TemplateItemRow,
} from '../types/db'

export function cycleWeek(startedOn: string, date: string): 1 | 2 | 3 | 4 {
  const start = new Date(`${startedOn.slice(0, 10)}T12:00:00Z`).getTime()
  const current = new Date(`${date.slice(0, 10)}T12:00:00Z`).getTime()
  const elapsedWeeks = Math.max(0, Math.floor((current - start) / (7 * 86400_000)))
  return ((elapsedWeeks % 4) + 1) as 1 | 2 | 3 | 4
}

export function snapshotBlock(
  block: TemplateBlockRow,
  sessionId: string,
  id: string,
  now: string,
  deload: boolean,
): SessionBlockRow {
  const { template_id: _templateId, ...snapshot } = block
  const rounds = deload && block.format === 'circuit'
    ? Math.max(1, Math.ceil(block.rounds_initial * 0.65))
    : block.rounds_initial
  return {
    ...snapshot,
    id,
    session_id: sessionId,
    template_block_id: block.id,
    rounds_initial: rounds,
    rounds_max: deload ? rounds : block.rounds_max,
    target_rpe_min: deload && block.target_rpe_min !== null
      ? Math.min(block.target_rpe_min, 6)
      : block.target_rpe_min,
    target_rpe_max: deload && block.target_rpe_max !== null
      ? Math.min(block.target_rpe_max, 7)
      : block.target_rpe_max,
    created_at: now,
    updated_at: now,
  }
}

export function snapshotExercise(
  item: TemplateItemRow,
  input: {
    sessionId: string
    sessionExerciseId: string
    sessionBlockId: string | null
    name: string
    measurement: SessionExerciseRow['measurement_snapshot']
    now: string
    deload: boolean
  },
): SessionExerciseRow {
  const plannedSets = input.deload
    ? Math.max(1, Math.ceil(item.planned_sets * 0.65))
    : item.planned_sets
  return {
    id: input.sessionExerciseId,
    session_id: input.sessionId,
    exercise_id: item.exercise_id,
    name_snapshot: input.name,
    measurement_snapshot: input.measurement,
    position: item.position,
    planned_sets: plannedSets,
    rest_seconds: item.rest_seconds,
    tempo: item.tempo,
    notes: item.notes,
    superset_group: item.superset_group,
    block_role: item.block_role,
    template_item_id: item.id,
    session_block_id: input.sessionBlockId,
    block_position: item.block_position ?? item.position,
    target_weight_kg: item.target_weight_kg,
    target_reps: item.target_reps,
    target_duration_s: item.target_duration_s,
    target_distance_m: item.target_distance_m,
    target_reps_min: item.target_reps_min,
    target_reps_max: item.target_reps_max,
    target_duration_min_s: item.target_duration_min_s,
    target_duration_max_s: item.target_duration_max_s,
    target_distance_min_m: item.target_distance_min_m,
    target_distance_max_m: item.target_distance_max_m,
    target_rpe_min: input.deload && item.target_rpe_min != null
      ? Math.min(item.target_rpe_min, 6)
      : item.target_rpe_min,
    target_rpe_max: input.deload && item.target_rpe_max != null
      ? Math.min(item.target_rpe_max, 7)
      : item.target_rpe_max,
    target_rir_min: item.target_rir_min,
    target_rir_max: item.target_rir_max,
    side_mode: item.side_mode ?? 'bilateral',
    directions: item.directions ?? 1,
    load_increment_kg: item.load_increment_kg,
    tempo_eccentric: item.tempo_eccentric,
    tempo_stretch_pause: item.tempo_stretch_pause,
    tempo_concentric: item.tempo_concentric,
    tempo_contracted_pause: item.tempo_contracted_pause,
    tempo_intent: item.tempo_intent ?? 'controlled',
    created_at: input.now,
    updated_at: input.now,
  }
}

export function materializePlannedSets(input: {
  exercise: SessionExerciseRow
  block: SessionBlockRow | null
  newId: () => string
  now: string
}): SetRow[] {
  const { exercise, block } = input
  const groups = block?.format === 'circuit'
    ? block.rounds_initial
    : exercise.planned_sets
  const sides: SetRow['side'][] = (exercise.side_mode ?? 'bilateral') === 'bilateral'
    ? [null]
    : ['left', 'right']
  const directions: SetRow['direction'][] = (exercise.directions ?? 1) > 1
    ? ['pronation', 'supination']
    : [null]
  const rows: SetRow[] = []
  let position = 1
  for (let round = 1; round <= groups; round += 1) {
    for (const side of sides) {
      for (const direction of directions) {
        rows.push({
          id: input.newId(),
          session_exercise_id: exercise.id,
          position: position++,
          weight_kg: null,
          reps: null,
          duration_s: null,
          distance_m: null,
          rpe: null,
          notes: null,
          is_warmup: block?.role === 'warmup',
          round_index: round,
          side,
          direction,
          completed_at: null,
          created_at: input.now,
          updated_at: input.now,
        })
      }
    }
  }
  return rows
}

export function isSetGroupComplete(sets: SetRow[], set: SetRow): boolean {
  const group = set.round_index ?? set.position
  return sets
    .filter((row) => (row.round_index ?? row.position) === group)
    .every((row) => row.id === set.id ? set.completed_at !== null : row.completed_at !== null)
}

/** A block round is complete only after every exercise, side and direction
 * in that round is checked. Used by circuit and superset rest handling. */
export function isBlockRoundComplete(
  exercises: SessionExerciseDoc[],
  set: SetRow,
): boolean {
  const round = set.round_index ?? set.position
  return exercises.every((exercise) =>
    exercise.sets
      .filter((candidate) => (candidate.round_index ?? candidate.position) === round)
      .every((candidate) =>
        candidate.id === set.id ? set.completed_at !== null : candidate.completed_at !== null,
      ),
  )
}

export interface ProgressionSuggestion {
  sessionExerciseId: string
  templateItemId: string
  exerciseName: string
  fromWeightKg: number
  toWeightKg: number
}

export function progressionSuggestions(session: SessionDoc): ProgressionSuggestion[] {
  if (session.is_deload) return []
  const result: ProgressionSuggestion[] = []
  for (const exercise of session.session_exercises) {
    if (!exercise.template_item_id || !exercise.load_increment_kg || exercise.target_reps_max === null) continue
    if (exercise.measurement_snapshot !== 'weight_reps') continue
    const work = exercise.sets.filter((set) => !set.is_warmup)
    if (work.length === 0 || work.some((set) => set.completed_at === null)) continue
    if (work.some((set) => (set.reps ?? -1) < (exercise.target_reps_max ?? 0))) continue
    if (work.some((set) => set.rpe === null || set.rpe > 8)) continue
    const heaviest = Math.max(...work.map((set) => set.weight_kg ?? 0), exercise.target_weight_kg ?? 0)
    if (heaviest <= 0) continue
    result.push({
      sessionExerciseId: exercise.id,
      templateItemId: exercise.template_item_id,
      exerciseName: exercise.name_snapshot,
      fromWeightKg: heaviest,
      toWeightKg: heaviest + exercise.load_increment_kg,
    })
  }
  return result
}

export function aerobicSecondsInWeek(input: {
  sessions: SessionDoc[]
  external: AerobicActivityRow[]
  from: string
  to: string
}): number {
  let total = input.external
    .filter((row) => row.moderate && row.recorded_on >= input.from && row.recorded_on <= input.to)
    .reduce((sum, row) => sum + row.duration_s, 0)
  for (const session of input.sessions) {
    if (session.status !== 'completed') continue
    const date = session.planned_date ?? session.started_at.slice(0, 10)
    if (date < input.from || date > input.to) continue
    const aerobicBlockIds = new Set(
      (session.session_blocks ?? [])
        .filter((block) => block.role === 'zone_2' || block.role === 'conditioning')
        .map((block) => block.id),
    )
    for (const exercise of session.session_exercises) {
      if (!exercise.session_block_id || !aerobicBlockIds.has(exercise.session_block_id)) continue
      total += exercise.sets
        .filter((set) => set.completed_at !== null)
        .reduce((sum, set) => sum + (set.duration_s ?? 0), 0)
    }
  }
  return total
}
