// Portable JSON for routines (templates + items). Exercise rows are
// snapshotted by name/measurement so a file can move between accounts;
// catalog matches win, missing names become custom exercises. Re-importing
// the same file upserts by routine/item id instead of duplicating.
import type {
  ExerciseCategory,
  ExerciseMeasurement,
  ExerciseRow,
  TemplateItemRow,
  TemplateBlockRow,
  TemplateRow,
} from '../types/db'
import { BACKUP_FORMAT } from './backup'
import { normalizeBlockRole } from './blockRole'
import { matchExercise } from './csv'
import { t } from './i18n'

export const ROUTINES_FORMAT = 'herkules-routines'
export const ROUTINES_VERSION = 2

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CATEGORIES: ExerciseCategory[] = ['strength', 'cardio', 'mobility']
const MEASUREMENTS: ExerciseMeasurement[] = [
  'weight_reps',
  'reps',
  'duration',
  'distance_duration',
  'weight_duration',
  'weight_distance',
]

export interface RoutineExerciseSnapshot {
  id: string | null
  name: string
  category: ExerciseCategory
  measurement: ExerciseMeasurement
  muscle_groups: string[]
  equipment: string[]
  instructions: string | null
  video_url: string | null
  source_title: string | null
  source_provider: string | null
  source_url: string | null
  source_verified_at: string | null
}

export type RoutineBlockExport = Omit<TemplateBlockRow, 'id' | 'template_id' | 'created_at' | 'updated_at'> & {
  id: string | null
}

export interface RoutineItemExport {
  id: string | null
  position: number
  planned_sets: number
  target_weight_kg: number | null
  target_reps: number | null
  target_duration_s: number | null
  target_distance_m: number | null
  rest_seconds: number | null
  tempo: string | null
  notes: string | null
  superset_group: string | null
  block_role: TemplateItemRow['block_role']
  block_id: string | null
  block_position: number
  target_reps_min: number | null
  target_reps_max: number | null
  target_duration_min_s: number | null
  target_duration_max_s: number | null
  target_distance_min_m: number | null
  target_distance_max_m: number | null
  target_rpe_min: number | null
  target_rpe_max: number | null
  target_rir_min: number | null
  target_rir_max: number | null
  side_mode: NonNullable<TemplateItemRow['side_mode']>
  directions: number
  load_increment_kg: number | null
  tempo_eccentric: number | null
  tempo_stretch_pause: number | null
  tempo_concentric: number | null
  tempo_contracted_pause: number | null
  tempo_intent: NonNullable<TemplateItemRow['tempo_intent']>
  exercise: RoutineExerciseSnapshot
}

export interface RoutineExport {
  id: string | null
  name: string
  notes: string | null
  blocks: RoutineBlockExport[]
  items: RoutineItemExport[]
}

export interface RoutinesFile {
  format: typeof ROUTINES_FORMAT
  version: number
  exported_at: string
  routines: RoutineExport[]
}

export interface RoutineImportPlan {
  templates: TemplateRow[]
  items: TemplateItemRow[]
  blocks: TemplateBlockRow[]
  newExercises: ExerciseRow[]
  itemIdsToDelete: string[]
  blockIdsToDelete: string[]
  createdTemplates: number
  updatedTemplates: number
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function serializeRoutines(
  templates: TemplateRow[],
  templateItems: TemplateItemRow[],
  exercises: ExerciseRow[],
  templateBlocks: TemplateBlockRow[] = [],
): string {
  const byId = new Map(exercises.map((row) => [row.id, row]))
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name))
  const routines: RoutineExport[] = sorted.map((template) => ({
    id: template.id,
    name: template.name,
    notes: template.notes,
    blocks: templateBlocks
      .filter((block) => block.template_id === template.id)
      .sort((a, b) => a.position - b.position)
      .map(({ template_id: _templateId, created_at: _createdAt, updated_at: _updatedAt, ...block }) => block),
    items: templateItems
      .filter((item) => item.template_id === template.id)
      .sort((a, b) => a.position - b.position)
      .flatMap((item) => {
        const exercise = byId.get(item.exercise_id)
        if (!exercise) return []
        return [
          {
            id: item.id,
            position: item.position,
            planned_sets: item.planned_sets,
            target_weight_kg: item.target_weight_kg,
            target_reps: item.target_reps,
            target_duration_s: item.target_duration_s,
            target_distance_m: item.target_distance_m,
            rest_seconds: item.rest_seconds,
            tempo: item.tempo,
            notes: item.notes,
            superset_group: item.superset_group,
            block_role: normalizeBlockRole(item.block_role),
            block_id: item.block_id ?? null,
            block_position: item.block_position ?? item.position,
            target_reps_min: item.target_reps_min ?? item.target_reps,
            target_reps_max: item.target_reps_max ?? item.target_reps,
            target_duration_min_s: item.target_duration_min_s ?? item.target_duration_s,
            target_duration_max_s: item.target_duration_max_s ?? item.target_duration_s,
            target_distance_min_m: item.target_distance_min_m ?? item.target_distance_m,
            target_distance_max_m: item.target_distance_max_m ?? item.target_distance_m,
            target_rpe_min: item.target_rpe_min ?? null,
            target_rpe_max: item.target_rpe_max ?? null,
            target_rir_min: item.target_rir_min ?? null,
            target_rir_max: item.target_rir_max ?? null,
            side_mode: item.side_mode ?? 'bilateral',
            directions: item.directions ?? 1,
            load_increment_kg: item.load_increment_kg ?? null,
            tempo_eccentric: item.tempo_eccentric ?? null,
            tempo_stretch_pause: item.tempo_stretch_pause ?? null,
            tempo_concentric: item.tempo_concentric ?? null,
            tempo_contracted_pause: item.tempo_contracted_pause ?? null,
            tempo_intent: item.tempo_intent ?? 'controlled',
            exercise: snapshotExercise(exercise),
          } satisfies RoutineItemExport,
        ]
      }),
  }))
  const file: RoutinesFile = {
    format: ROUTINES_FORMAT,
    version: ROUTINES_VERSION,
    exported_at: new Date().toISOString(),
    routines,
  }
  return JSON.stringify(file, null, 2)
}

export function parseRoutines(text: string): RoutinesFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(t('errors.invalidJson'))
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(t('errors.notRoutines'))
  }
  const file = parsed as { format?: unknown; version?: unknown; routines?: unknown }
  if (file.format === BACKUP_FORMAT) {
    throw new Error(t('errors.isBackup'))
  }
  if (file.format !== ROUTINES_FORMAT) {
    throw new Error(t('errors.notRoutines'))
  }
  if (typeof file.version !== 'number' || file.version > ROUTINES_VERSION) {
    throw new Error(t('errors.routinesNewer'))
  }
  if (!Array.isArray(file.routines)) {
    throw new Error(t('errors.missingRoutinesList'))
  }
  return {
    format: ROUTINES_FORMAT,
    version: file.version,
    exported_at:
      typeof (parsed as { exported_at?: unknown }).exported_at === 'string'
        ? (parsed as { exported_at: string }).exported_at
        : new Date().toISOString(),
    routines: file.routines.map((row, index) => parseRoutine(row, index)),
  }
}

export function planRoutineImport(input: {
  file: RoutinesFile
  catalog: ExerciseRow[]
  existingTemplates: TemplateRow[]
  existingItems: TemplateItemRow[]
  existingBlocks?: TemplateBlockRow[]
  ownerId: string
  now: string
  newId: () => string
}): RoutineImportPlan {
  const catalog = [...input.catalog]
  const existingById = new Map(input.existingTemplates.map((row) => [row.id, row]))
  const existingItemById = new Map(input.existingItems.map((row) => [row.id, row]))
  const newExercises: ExerciseRow[] = []
  const templates: TemplateRow[] = []
  const blocks: TemplateBlockRow[] = []
  const items: TemplateItemRow[] = []
  const keepByTemplate = new Map<string, Set<string>>()
  const keepBlocksByTemplate = new Map<string, Set<string>>()
  let createdTemplates = 0
  let updatedTemplates = 0

  for (const routine of input.file.routines) {
    const templateId = isUuid(routine.id) ? routine.id : input.newId()
    const previous = existingById.get(templateId)
    if (previous) updatedTemplates += 1
    else createdTemplates += 1
    templates.push({
      id: templateId,
      owner_id: input.ownerId,
      name: routine.name,
      notes: routine.notes,
      plan_id: previous?.plan_id ?? null,
      plan_position: previous?.plan_position ?? 0,
      source_slot: previous?.source_slot ?? null,
      created_at: previous?.created_at ?? input.now,
      updated_at: input.now,
    })

    const keep = new Set<string>()
    keepByTemplate.set(templateId, keep)
    const keepBlocks = new Set<string>()
    keepBlocksByTemplate.set(templateId, keepBlocks)
    const blockIdMap = new Map<string, string>()
    for (const [blockIndex, block] of routine.blocks.entries()) {
      const blockId = isUuid(block.id) ? block.id : input.newId()
      keepBlocks.add(blockId)
      if (block.id) blockIdMap.set(block.id, blockId)
      blocks.push({
        ...block,
        id: blockId,
        template_id: templateId,
        position: Number.isFinite(block.position) ? block.position : blockIndex,
        created_at: input.now,
        updated_at: input.now,
      })
    }

    for (const [index, item] of routine.items.entries()) {
      let exercise = resolveExercise(item.exercise, catalog)
      if (!exercise) {
        exercise = {
          id: input.newId(),
          owner_id: input.ownerId,
          name: item.exercise.name,
          category: item.exercise.category,
          measurement: item.exercise.measurement,
          muscle_groups: item.exercise.muscle_groups,
          equipment: item.exercise.equipment,
          instructions: item.exercise.instructions,
          video_url: item.exercise.video_url,
          source_title: item.exercise.source_title,
          source_provider: item.exercise.source_provider,
          source_url: item.exercise.source_url,
          source_verified_at: item.exercise.source_verified_at,
          is_archived: false,
          created_at: input.now,
          updated_at: input.now,
        }
        catalog.push(exercise)
        newExercises.push(exercise)
      }

      const itemId = isUuid(item.id) ? item.id : input.newId()
      keep.add(itemId)
      const previousItem = existingItemById.get(itemId)
      items.push({
        id: itemId,
        template_id: templateId,
        exercise_id: exercise.id,
        position: Number.isFinite(item.position) ? item.position : index,
        planned_sets: item.planned_sets,
        target_weight_kg: item.target_weight_kg,
        target_reps: item.target_reps,
        target_duration_s: item.target_duration_s,
        target_distance_m: item.target_distance_m,
        rest_seconds: item.rest_seconds,
        tempo: item.tempo,
        notes: item.notes,
        superset_group: item.superset_group,
        block_role: normalizeBlockRole(item.block_role),
        block_id: item.block_id ? blockIdMap.get(item.block_id) ?? null : null,
        block_position: item.block_position,
        target_reps_min: item.target_reps_min,
        target_reps_max: item.target_reps_max,
        target_duration_min_s: item.target_duration_min_s,
        target_duration_max_s: item.target_duration_max_s,
        target_distance_min_m: item.target_distance_min_m,
        target_distance_max_m: item.target_distance_max_m,
        target_rpe_min: item.target_rpe_min,
        target_rpe_max: item.target_rpe_max,
        target_rir_min: item.target_rir_min,
        target_rir_max: item.target_rir_max,
        side_mode: item.side_mode,
        directions: item.directions,
        load_increment_kg: item.load_increment_kg,
        tempo_eccentric: item.tempo_eccentric,
        tempo_stretch_pause: item.tempo_stretch_pause,
        tempo_concentric: item.tempo_concentric,
        tempo_contracted_pause: item.tempo_contracted_pause,
        tempo_intent: item.tempo_intent,
        created_at: previousItem?.created_at ?? input.now,
        updated_at: input.now,
      })
    }
  }

  const itemIdsToDelete = input.existingItems
    .filter((row) => {
      const keep = keepByTemplate.get(row.template_id)
      return keep !== undefined && !keep.has(row.id)
    })
    .map((row) => row.id)

  const blockIdsToDelete = (input.existingBlocks ?? [])
    .filter((row) => {
      const keep = keepBlocksByTemplate.get(row.template_id)
      return keep !== undefined && !keep.has(row.id)
    })
    .map((row) => row.id)

  return {
    templates,
    items,
    blocks,
    newExercises,
    itemIdsToDelete,
    blockIdsToDelete,
    createdTemplates,
    updatedTemplates,
  }
}

export function routinesExportFilename(name?: string): string {
  const date = new Date().toISOString().slice(0, 10)
  if (!name) return `herkules-routines-${date}.json`
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'routine'
  return `herkules-routine-${slug}-${date}.json`
}

export function formatRoutineImportMessage(result: {
  created: number
  updated: number
  items: number
  createdExercises: number
}): string {
  const parts: string[] = []
  if (result.created > 0) {
    parts.push(
      result.created === 1
        ? t('importMsg.newRoutineOne', { count: result.created })
        : t('importMsg.newRoutineOther', { count: result.created }),
    )
  }
  if (result.updated > 0) {
    parts.push(t('importMsg.updated', { count: result.updated }))
  }
  if (result.createdExercises > 0) {
    parts.push(
      result.createdExercises === 1
        ? t('importMsg.customOne', { count: result.createdExercises })
        : t('importMsg.customOther', { count: result.createdExercises }),
    )
  }
  if (parts.length === 0) {
    return result.items === 1
      ? t('importMsg.slotsOne', { count: result.items })
      : t('importMsg.slotsOther', { count: result.items })
  }
  return t('importMsg.imported', { parts: parts.join(', ') })
}

export function downloadTextFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function snapshotExercise(row: ExerciseRow): RoutineExerciseSnapshot {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    measurement: row.measurement,
    muscle_groups: [...row.muscle_groups],
    equipment: [...row.equipment],
    instructions: row.instructions,
    video_url: row.video_url,
    source_title: row.source_title ?? null,
    source_provider: row.source_provider ?? null,
    source_url: row.source_url ?? row.video_url ?? null,
    source_verified_at: row.source_verified_at ?? null,
  }
}

function resolveExercise(
  snapshot: RoutineExerciseSnapshot,
  catalog: ExerciseRow[],
): ExerciseRow | undefined {
  if (snapshot.id) {
    const byId = catalog.find((row) => row.id === snapshot.id && !row.is_archived)
    if (byId) return byId
  }
  return matchExercise(snapshot.name, catalog)
}

function parseRoutine(value: unknown, index: number): RoutineExport {
  if (typeof value !== 'object' || value === null) {
    throw new Error(t('errors.routineNotObject', { n: index + 1 }))
  }
  const row = value as Partial<RoutineExport>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (name === '') throw new Error(t('errors.routineMissingName', { n: index + 1 }))
  if (name.length > 120) throw new Error(t('errors.routineNameLong', { name }))
  if (!Array.isArray(row.items)) {
    throw new Error(t('errors.routineMissingExercises', { name }))
  }
  return {
    id: isUuid(row.id) ? row.id : null,
    name,
    notes: asOptionalString(row.notes),
    blocks: Array.isArray(row.blocks)
      ? row.blocks.map((block, blockIndex) => parseBlock(block, blockIndex))
      : [],
    items: row.items.map((item, itemIndex) => parseItem(item, itemIndex, name)),
  }
}

function parseItem(value: unknown, index: number, routineName: string): RoutineItemExport {
  if (typeof value !== 'object' || value === null) {
    throw new Error(t('errors.itemNotObject', { name: routineName, n: index + 1 }))
  }
  const row = value as Partial<RoutineItemExport>
  const planned = asNumber(row.planned_sets)
  return {
    id: isUuid(row.id) ? row.id : null,
    position: asNumber(row.position) ?? index,
    planned_sets: planned !== null && planned >= 1 ? Math.min(Math.round(planned), 50) : 3,
    target_weight_kg: asNumber(row.target_weight_kg),
    target_reps: asNumber(row.target_reps),
    target_duration_s: asNumber(row.target_duration_s),
    target_distance_m: asNumber(row.target_distance_m),
    rest_seconds: asNumber(row.rest_seconds),
    tempo: asOptionalString(row.tempo),
    notes: asOptionalString(row.notes),
    superset_group: asOptionalString(row.superset_group),
    block_role: normalizeBlockRole(row.block_role),
    block_id: isUuid(row.block_id) ? row.block_id : null,
    block_position: asNumber(row.block_position) ?? index,
    target_reps_min: asNumber(row.target_reps_min) ?? asNumber(row.target_reps),
    target_reps_max: asNumber(row.target_reps_max) ?? asNumber(row.target_reps),
    target_duration_min_s: asNumber(row.target_duration_min_s) ?? asNumber(row.target_duration_s),
    target_duration_max_s: asNumber(row.target_duration_max_s) ?? asNumber(row.target_duration_s),
    target_distance_min_m: asNumber(row.target_distance_min_m) ?? asNumber(row.target_distance_m),
    target_distance_max_m: asNumber(row.target_distance_max_m) ?? asNumber(row.target_distance_m),
    target_rpe_min: asNumber(row.target_rpe_min),
    target_rpe_max: asNumber(row.target_rpe_max),
    target_rir_min: asNumber(row.target_rir_min),
    target_rir_max: asNumber(row.target_rir_max),
    side_mode: row.side_mode === 'per_side' || row.side_mode === 'per_leg' ? row.side_mode : 'bilateral',
    directions: Math.max(1, Math.min(4, Math.round(asNumber(row.directions) ?? 1))),
    load_increment_kg: asNumber(row.load_increment_kg),
    tempo_eccentric: asNumber(row.tempo_eccentric),
    tempo_stretch_pause: asNumber(row.tempo_stretch_pause),
    tempo_concentric: asNumber(row.tempo_concentric),
    tempo_contracted_pause: asNumber(row.tempo_contracted_pause),
    tempo_intent: row.tempo_intent === 'explosive' ? 'explosive' : 'controlled',
    exercise: parseExerciseSnapshot(row.exercise, index, routineName),
  }
}

function parseExerciseSnapshot(
  value: unknown,
  index: number,
  routineName: string,
): RoutineExerciseSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error(t('errors.itemMissingExercise', { name: routineName, n: index + 1 }))
  }
  const row = value as Partial<RoutineExerciseSnapshot>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (name === '') {
    throw new Error(t('errors.itemMissingName', { name: routineName, n: index + 1 }))
  }
  return {
    id: isUuid(row.id) ? row.id : null,
    name: name.slice(0, 120),
    category: parseCategory(row.category),
    measurement: parseMeasurement(row.measurement),
    muscle_groups: asStringArray(row.muscle_groups),
    equipment: asStringArray(row.equipment),
    instructions: asOptionalString(row.instructions),
    video_url: asOptionalString(row.video_url),
    source_title: asOptionalString(row.source_title),
    source_provider: asOptionalString(row.source_provider),
    source_url: asOptionalString(row.source_url) ?? asOptionalString(row.video_url),
    source_verified_at: asOptionalString(row.source_verified_at),
  }
}

function parseBlock(value: unknown, index: number): RoutineBlockExport {
  if (typeof value !== 'object' || value === null) {
    throw new Error(t('errors.blockNotObject', { n: index + 1 }))
  }
  const row = value as Partial<RoutineBlockExport>
  const roles = ['warmup', 'strength', 'assistance', 'power', 'carry', 'core', 'conditioning', 'zone_2', 'tendon'] as const
  const formats = ['straight', 'superset', 'circuit', 'interval'] as const
  const role = roles.find((candidate) => candidate === row.role) ?? 'strength'
  const format = formats.find((candidate) => candidate === row.format) ?? 'straight'
  const roundsInitial = Math.max(1, Math.round(asNumber(row.rounds_initial) ?? 1))
  return {
    id: isUuid(row.id) ? row.id : null,
    position: asNumber(row.position) ?? index,
    role,
    format,
    rounds_initial: roundsInitial,
    rounds_max: Math.max(roundsInitial, Math.round(asNumber(row.rounds_max) ?? roundsInitial)),
    rest_after_round_s: asNumber(row.rest_after_round_s),
    notes: asOptionalString(row.notes),
    interval_prepare_s: asNumber(row.interval_prepare_s),
    interval_work_s: asNumber(row.interval_work_s),
    interval_recovery_s: asNumber(row.interval_recovery_s),
    interval_rounds: asNumber(row.interval_rounds),
    target_rpe_min: asNumber(row.target_rpe_min),
    target_rpe_max: asNumber(row.target_rpe_max),
  }
}

function parseCategory(value: unknown): ExerciseCategory {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value)
    ? (value as ExerciseCategory)
    : 'strength'
}

function parseMeasurement(value: unknown): ExerciseMeasurement {
  return typeof value === 'string' && (MEASUREMENTS as string[]).includes(value)
    ? (value as ExerciseMeasurement)
    : 'weight_reps'
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
