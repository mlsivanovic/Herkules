// Portable JSON for routines (templates + items). Exercise rows are
// snapshotted by name/measurement so a file can move between accounts;
// catalog matches win, missing names become custom exercises. Re-importing
// the same file upserts by routine/item id instead of duplicating.
import type {
  ExerciseCategory,
  ExerciseMeasurement,
  ExerciseRow,
  TemplateItemRow,
  TemplateRow,
} from '../types/db'
import { BACKUP_FORMAT } from './backup'
import { normalizeBlockRole } from './blockRole'
import { matchExercise } from './csv'

export const ROUTINES_FORMAT = 'herkules-routines'
export const ROUTINES_VERSION = 1

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CATEGORIES: ExerciseCategory[] = ['strength', 'cardio', 'mobility']
const MEASUREMENTS: ExerciseMeasurement[] = [
  'weight_reps',
  'reps',
  'duration',
  'distance_duration',
  'weight_duration',
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
  exercise: RoutineExerciseSnapshot
}

export interface RoutineExport {
  id: string | null
  name: string
  notes: string | null
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
  newExercises: ExerciseRow[]
  itemIdsToDelete: string[]
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
): string {
  const byId = new Map(exercises.map((row) => [row.id, row]))
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name))
  const routines: RoutineExport[] = sorted.map((template) => ({
    id: template.id,
    name: template.name,
    notes: template.notes,
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
    throw new Error('That file is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('That file is not a Herkules routines export.')
  }
  const file = parsed as { format?: unknown; version?: unknown; routines?: unknown }
  if (file.format === BACKUP_FORMAT) {
    throw new Error('That file is a full backup. Restore it from Settings.')
  }
  if (file.format !== ROUTINES_FORMAT) {
    throw new Error('That file is not a Herkules routines export.')
  }
  if (typeof file.version !== 'number' || file.version > ROUTINES_VERSION) {
    throw new Error('This file was made by a newer version of Herkules.')
  }
  if (!Array.isArray(file.routines)) {
    throw new Error('The file is missing the routines list.')
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
  ownerId: string
  now: string
  newId: () => string
}): RoutineImportPlan {
  const catalog = [...input.catalog]
  const existingById = new Map(input.existingTemplates.map((row) => [row.id, row]))
  const existingItemById = new Map(input.existingItems.map((row) => [row.id, row]))
  const newExercises: ExerciseRow[] = []
  const templates: TemplateRow[] = []
  const items: TemplateItemRow[] = []
  const keepByTemplate = new Map<string, Set<string>>()
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
      created_at: previous?.created_at ?? input.now,
      updated_at: input.now,
    })

    const keep = new Set<string>()
    keepByTemplate.set(templateId, keep)

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

  return {
    templates,
    items,
    newExercises,
    itemIdsToDelete,
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
    parts.push(`${result.created} new routine${result.created === 1 ? '' : 's'}`)
  }
  if (result.updated > 0) {
    parts.push(`${result.updated} updated`)
  }
  if (result.createdExercises > 0) {
    parts.push(
      `${result.createdExercises} custom exercise${result.createdExercises === 1 ? '' : 's'}`,
    )
  }
  if (parts.length === 0) {
    return `Imported ${result.items} exercise slot${result.items === 1 ? '' : 's'}.`
  }
  return `Imported ${parts.join(', ')}.`
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
    throw new Error(`Routine ${index + 1} is not an object.`)
  }
  const row = value as Partial<RoutineExport>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (name === '') throw new Error(`Routine ${index + 1} is missing a name.`)
  if (name.length > 120) throw new Error(`Routine "${name}" has a name that is too long.`)
  if (!Array.isArray(row.items)) {
    throw new Error(`Routine "${name}" is missing its exercises list.`)
  }
  return {
    id: isUuid(row.id) ? row.id : null,
    name,
    notes: asOptionalString(row.notes),
    items: row.items.map((item, itemIndex) => parseItem(item, itemIndex, name)),
  }
}

function parseItem(value: unknown, index: number, routineName: string): RoutineItemExport {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Routine "${routineName}" item ${index + 1} is not an object.`)
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
    exercise: parseExerciseSnapshot(row.exercise, index, routineName),
  }
}

function parseExerciseSnapshot(
  value: unknown,
  index: number,
  routineName: string,
): RoutineExerciseSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Routine "${routineName}" item ${index + 1} is missing an exercise.`)
  }
  const row = value as Partial<RoutineExerciseSnapshot>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (name === '') {
    throw new Error(`Routine "${routineName}" item ${index + 1} is missing an exercise name.`)
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
