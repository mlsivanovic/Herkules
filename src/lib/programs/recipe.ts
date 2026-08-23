import type {
  ExerciseBlockRole,
  SideMode,
  TemplateBlockRow,
  TemplateItemRow,
  TemplateRow,
  TempoIntent,
  TrainingPlanRow,
  WorkoutBlockFormat,
  WorkoutBlockRole,
} from '../../types/db'
import type { HybridSlot } from './rotate'

export type DaySlot = HybridSlot

export interface ProgramTempo {
  eccentric: number
  stretchPause: number
  concentric: number
  contractedPause: number
  intent: TempoIntent
}

export interface ProgramItem {
  exerciseId: string
  plannedSets: number
  reps?: [number, number]
  durationS?: [number, number]
  distanceM?: [number, number]
  targetWeightKg?: number | null
  rpe?: [number, number]
  rir?: [number, number]
  restSeconds?: number | null
  sideMode?: SideMode
  directions?: number
  loadIncrementKg?: number | null
  tempo: ProgramTempo
  notes?: string | null
}

export interface ProgramBlock {
  key: string
  role: WorkoutBlockRole
  format: WorkoutBlockFormat
  roundsInitial?: number
  roundsMax?: number
  restAfterRoundS?: number | null
  notes?: string | null
  interval?: {
    prepareS: number
    workS: number
    recoveryS: number
    rounds: number
    targetRpe: [number, number]
  }
  items: ProgramItem[]
}

export interface ProgramTemplate {
  slot: DaySlot
  name: string
  notes: string
  blocks: ProgramBlock[]
  items: ProgramItem[]
}

export const controlled = (
  eccentric = 2,
  stretchPause = 0,
  concentric = 1,
  contractedPause = 0,
): ProgramTempo => ({ eccentric, stretchPause, concentric, contractedPause, intent: 'controlled' })

export const explosive: ProgramTempo = {
  eccentric: 1,
  stretchPause: 0,
  concentric: 0,
  contractedPause: 0,
  intent: 'explosive',
}

export function withFlatItems(definitions: Omit<ProgramTemplate, 'items'>[]): ProgramTemplate[] {
  return definitions.map((template) => ({
    ...template,
    items: template.blocks.flatMap((block) => block.items),
  }))
}

export function tempoLabel(tempo: ProgramTempo): string {
  const concentric = tempo.intent === 'explosive' ? 'X' : String(tempo.concentric)
  return `${tempo.eccentric}-${tempo.stretchPause}-${concentric}-${tempo.contractedPause}`
}

export function legacyRoleForBlock(role: WorkoutBlockRole): ExerciseBlockRole {
  if (role === 'tendon') return 'tendon'
  if (role === 'conditioning' || role === 'zone_2') return 'cardio'
  return 'gym'
}

export function asDaySlot(value: string | undefined | null): DaySlot | null {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' ? value : null
}

export function templatesBySlot<T extends { source_slot?: string | null }>(
  templates: T[],
  slots: readonly DaySlot[],
): Record<DaySlot, T> | null {
  const found: Partial<Record<DaySlot, T>> = {}
  for (const template of templates) {
    const slot = asDaySlot(template.source_slot)
    if (slot && !found[slot]) found[slot] = template
  }
  if (!slots.every((slot) => found[slot])) return null
  return found as Record<DaySlot, T>
}

export function buildProgramRows(input: {
  definitions: ProgramTemplate[]
  templates: Partial<Record<DaySlot, Pick<TemplateRow, 'id'>>>
  now: string
  newId: () => string
}): { blocks: TemplateBlockRow[]; items: TemplateItemRow[] } {
  const blocks: TemplateBlockRow[] = []
  const items: TemplateItemRow[] = []
  for (const definition of input.definitions) {
    const templateId = input.templates[definition.slot]?.id
    if (!templateId) continue
    let globalPosition = 0
    definition.blocks.forEach((definitionBlock, blockIndex) => {
      const blockId = input.newId()
      const interval = definitionBlock.interval
      blocks.push({
        id: blockId, template_id: templateId, position: blockIndex,
        role: definitionBlock.role, format: definitionBlock.format,
        rounds_initial: definitionBlock.roundsInitial ?? 1,
        rounds_max: definitionBlock.roundsMax ?? definitionBlock.roundsInitial ?? 1,
        rest_after_round_s: definitionBlock.restAfterRoundS ?? null,
        notes: definitionBlock.notes ?? null,
        interval_prepare_s: interval?.prepareS ?? null,
        interval_work_s: interval?.workS ?? null,
        interval_recovery_s: interval?.recoveryS ?? null,
        interval_rounds: interval?.rounds ?? null,
        target_rpe_min: interval?.targetRpe[0] ?? null,
        target_rpe_max: interval?.targetRpe[1] ?? null,
        created_at: input.now, updated_at: input.now,
      })
      definitionBlock.items.forEach((item, blockPosition) => {
        const reps = item.reps ?? null
        const duration = item.durationS ?? null
        const distance = item.distanceM ?? null
        const rpe = item.rpe ?? null
        const rir = item.rir ?? null
        items.push({
          id: input.newId(), template_id: templateId, exercise_id: item.exerciseId,
          position: globalPosition++, planned_sets: item.plannedSets,
          target_weight_kg: item.targetWeightKg ?? null,
          target_reps: reps?.[1] ?? null,
          target_duration_s: duration?.[1] ?? null,
          target_distance_m: distance?.[1] ?? null,
          rest_seconds: item.restSeconds ?? null,
          tempo: tempoLabel(item.tempo), notes: item.notes ?? null,
          superset_group: null, block_role: legacyRoleForBlock(definitionBlock.role),
          block_id: blockId, block_position: blockPosition,
          target_reps_min: reps?.[0] ?? null, target_reps_max: reps?.[1] ?? null,
          target_duration_min_s: duration?.[0] ?? null, target_duration_max_s: duration?.[1] ?? null,
          target_distance_min_m: distance?.[0] ?? null, target_distance_max_m: distance?.[1] ?? null,
          target_rpe_min: rpe?.[0] ?? null, target_rpe_max: rpe?.[1] ?? null,
          target_rir_min: rir?.[0] ?? null, target_rir_max: rir?.[1] ?? null,
          side_mode: item.sideMode ?? 'bilateral', directions: item.directions ?? 1,
          load_increment_kg: item.loadIncrementKg ?? null,
          tempo_eccentric: item.tempo.eccentric,
          tempo_stretch_pause: item.tempo.stretchPause,
          tempo_concentric: item.tempo.concentric,
          tempo_contracted_pause: item.tempo.contractedPause,
          tempo_intent: item.tempo.intent,
          is_warmup: definitionBlock.role === 'warmup',
          created_at: input.now, updated_at: input.now,
        })
      })
    })
  }
  return { blocks, items }
}

const BLOCK_RECIPE_FIELDS = [
  'position',
  'role',
  'format',
  'rounds_initial',
  'rounds_max',
  'rest_after_round_s',
  'notes',
  'interval_prepare_s',
  'interval_work_s',
  'interval_recovery_s',
  'interval_rounds',
  'target_rpe_min',
  'target_rpe_max',
] as const satisfies readonly (keyof TemplateBlockRow)[]

const ITEM_RECIPE_FIELDS = [
  'exercise_id',
  'position',
  'planned_sets',
  'target_weight_kg',
  'target_reps',
  'target_duration_s',
  'target_distance_m',
  'rest_seconds',
  'tempo',
  'notes',
  'superset_group',
  'block_role',
  'block_position',
  'target_reps_min',
  'target_reps_max',
  'target_duration_min_s',
  'target_duration_max_s',
  'target_distance_min_m',
  'target_distance_max_m',
  'target_rpe_min',
  'target_rpe_max',
  'target_rir_min',
  'target_rir_max',
  'side_mode',
  'directions',
  'load_increment_kg',
  'tempo_eccentric',
  'tempo_stretch_pause',
  'tempo_concentric',
  'tempo_contracted_pause',
  'tempo_intent',
] as const satisfies readonly (keyof TemplateItemRow)[]

function sameFields<T extends object>(
  actual: T,
  expected: T,
  fields: readonly (keyof T)[],
): boolean {
  return fields.every((field) => (actual[field] ?? null) === (expected[field] ?? null))
}

export function isCanonicalRecipe(input: {
  definitions: ProgramTemplate[]
  templates: Partial<Record<DaySlot, Pick<TemplateRow, 'id' | 'name' | 'notes'> & { source_slot?: string | null }>>
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
}): boolean {
  let sequence = 0
  const expected = buildProgramRows({
    definitions: input.definitions,
    templates: input.templates,
    now: '2000-01-01T00:00:00.000Z',
    newId: () => `expected-${++sequence}`,
  })
  for (const definition of input.definitions) {
    const template = input.templates[definition.slot]
    if (!template) return false
    if (template.source_slot !== definition.slot || template.name !== definition.name) return false
    const actualBlocks = input.blocks
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    const expectedBlocks = expected.blocks
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    if (actualBlocks.length !== expectedBlocks.length) return false
    if (!actualBlocks.every((row, index) => sameFields(row, expectedBlocks[index]!, BLOCK_RECIPE_FIELDS))) return false

    const actualBlockPosition = new Map(actualBlocks.map((row) => [row.id, row.position]))
    const expectedBlockPosition = new Map(expectedBlocks.map((row) => [row.id, row.position]))
    const actualItems = input.items
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    const expectedItems = expected.items
      .filter((row) => row.template_id === template.id)
      .sort((a, b) => a.position - b.position)
    if (actualItems.length !== expectedItems.length) return false
    if (!actualItems.every((row, index) => {
      const expectedRow = expectedItems[index]!
      return sameFields(row, expectedRow, ITEM_RECIPE_FIELDS) &&
        actualBlockPosition.get(row.block_id ?? '') === expectedBlockPosition.get(expectedRow.block_id ?? '')
    })) return false
  }
  return true
}

export function buildProgramUpgrade(input: {
  ownerId: string
  existingPlan: TrainingPlanRow | null
  installed: Partial<Record<DaySlot, TemplateRow>> | null
  now: string
  newId: () => string
  sourceKey: string
  sourceVersion: number
  planName: string
  planNotes: string
  definitions: ProgramTemplate[]
}): {
  created: boolean
  plan: TrainingPlanRow
  templates: Record<DaySlot, TemplateRow>
  blocks: TemplateBlockRow[]
  items: TemplateItemRow[]
} {
  const plan: TrainingPlanRow = input.existingPlan
    ? {
        ...input.existingPlan,
        name: input.planName,
        notes: input.planNotes,
        source_key: input.sourceKey,
        source_version: input.sourceVersion,
        updated_at: input.now,
      }
    : {
        id: input.newId(), owner_id: input.ownerId, name: input.planName, notes: input.planNotes,
        source_key: input.sourceKey, source_version: input.sourceVersion,
        created_at: input.now, updated_at: input.now,
      }
  const templates = {} as Record<DaySlot, TemplateRow>
  input.definitions.forEach((definition, index) => {
    const previous = input.installed?.[definition.slot]
    templates[definition.slot] = {
      id: previous?.id ?? input.newId(), owner_id: input.ownerId,
      name: definition.name, notes: definition.notes,
      plan_id: plan.id, plan_position: index, source_slot: definition.slot,
      created_at: previous?.created_at ?? input.now, updated_at: input.now,
    }
  })
  return {
    created: !input.installed,
    plan,
    templates,
    ...buildProgramRows({
      definitions: input.definitions,
      templates,
      now: input.now,
      newId: input.newId,
    }),
  }
}
