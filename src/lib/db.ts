// IndexedDB mirror of the user's data + the sync outbox.
// Pure planning logic lives in outbox.ts; this file is browser-only I/O.
// Store values are kept as loose records internally; typed rows are restored
// at the read boundary (readOne/readAll).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { resolveAerobicGoalMinutes } from './aerobicGoal'
import { collapseOps, uniqueOpCount } from './outbox'
import { sortByPosition } from './reorder'
import type {
  AerobicActivityRow,
  BodyMeasureRow,
  BodyWeightRow,
  ExerciseRow,
  OutboxOp,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionCommentRow,
  SessionDoc,
  TemplateItemRow,
  TemplateBlockRow,
  TemplateRow,
  TendonCheckinRow,
  TrainingPlanRow,
  PlanRoutineRow,
} from '../types/db'

export type StoreName =
  | 'profiles'
  | 'exercises'
  | 'plans'
  | 'templates'
  | 'planRoutines'
  | 'templateBlocks'
  | 'templateItems'
  | 'rules'
  | 'schedules'
  | 'sessions'
  | 'bodyWeights'
  | 'bodyMeasures'
  | 'checkins'
  | 'aerobicActivities'
  | 'sessionComments'

interface DirtyRow {
  value: Record<string, unknown>
  dirty: boolean
}

interface HerkulesDB extends DBSchema {
  meta: { key: string; value: unknown }
  profiles: { key: string; value: DirtyRow }
  exercises: { key: string; value: DirtyRow }
  plans: { key: string; value: DirtyRow }
  templates: { key: string; value: DirtyRow }
  planRoutines: { key: string; value: DirtyRow }
  templateBlocks: { key: string; value: DirtyRow }
  templateItems: { key: string; value: DirtyRow }
  rules: { key: string; value: DirtyRow }
  schedules: { key: string; value: DirtyRow }
  sessions: { key: string; value: DirtyRow }
  bodyWeights: { key: string; value: DirtyRow }
  bodyMeasures: { key: string; value: DirtyRow }
  checkins: { key: string; value: DirtyRow }
  aerobicActivities: { key: string; value: DirtyRow }
  sessionComments: { key: string; value: DirtyRow }
  outbox: { key: number; value: OutboxOp & { seq: number }; autoIncrement: true }
}

const DB_NAME = 'herkules'
const DB_VERSION = 9

let dbPromise: Promise<IDBPDatabase<HerkulesDB>> | null = null

export function getDb(): Promise<IDBPDatabase<HerkulesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HerkulesDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('meta')
          for (const name of [
            'profiles',
            'exercises',
            'templates',
            'templateItems',
            'rules',
            'schedules',
            'sessions',
          ] as const) {
            db.createObjectStore(name, { keyPath: 'value.id' })
          }
          db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('bodyWeights')) {
          db.createObjectStore('bodyWeights', { keyPath: 'value.id' })
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains('checkins')) {
          db.createObjectStore('checkins', { keyPath: 'value.id' })
        }
        if (oldVersion < 4 && !db.objectStoreNames.contains('plans')) {
          db.createObjectStore('plans', { keyPath: 'value.id' })
        }
        if (oldVersion < 5 && !db.objectStoreNames.contains('templateBlocks')) {
          db.createObjectStore('templateBlocks', { keyPath: 'value.id' })
        }
        if (oldVersion < 6 && !db.objectStoreNames.contains('aerobicActivities')) {
          db.createObjectStore('aerobicActivities', { keyPath: 'value.id' })
        }
        if (oldVersion < 7 && !db.objectStoreNames.contains('bodyMeasures')) {
          db.createObjectStore('bodyMeasures', { keyPath: 'value.id' })
        }
        if (oldVersion < 8 && !db.objectStoreNames.contains('sessionComments')) {
          db.createObjectStore('sessionComments', { keyPath: 'value.id' })
        }
        if (oldVersion < 9 && !db.objectStoreNames.contains('planRoutines')) {
          db.createObjectStore('planRoutines', { keyPath: 'value.id' })
        }
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------- meta

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key)) as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key)
}

// ---------------------------------------------------------------- mirror reads

/** Read a single mirrored row fresh from IndexedDB (avoids stale closures). */
export async function readOne<T>(store: StoreName, id: string): Promise<T | null> {
  const entry = await (await getDb()).get(store, id)
  return entry ? (entry.value as unknown as T) : null
}

export async function readAll(): Promise<{
  exercises: ExerciseRow[]
  plans: TrainingPlanRow[]
  templates: TemplateRow[]
  planRoutines: PlanRoutineRow[]
  templateBlocks: TemplateBlockRow[]
  templateItems: TemplateItemRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  bodyWeights: BodyWeightRow[]
  bodyMeasures: BodyMeasureRow[]
  checkins: TendonCheckinRow[]
  aerobicActivities: AerobicActivityRow[]
  sessionComments: SessionCommentRow[]
}> {
  const db = await getDb()
  const [
    exercises,
    plans,
    templates,
    planRoutines,
    templateBlocks,
    templateItems,
    rules,
    schedules,
    sessions,
    bodyWeights,
    bodyMeasures,
    checkins,
    aerobicActivities,
    sessionComments,
  ] = await Promise.all([
    db.getAll('exercises'),
    db.getAll('plans'),
    db.getAll('templates'),
    db.getAll('planRoutines'),
    db.getAll('templateBlocks'),
    db.getAll('templateItems'),
    db.getAll('rules'),
    db.getAll('schedules'),
    db.getAll('sessions'),
    db.getAll('bodyWeights'),
    db.getAll('bodyMeasures'),
    db.getAll('checkins'),
    db.getAll('aerobicActivities'),
    db.getAll('sessionComments'),
  ])
  const pick = <T>(rows: DirtyRow[]): T[] => rows.map((r) => r.value as unknown as T)
  return {
    exercises: pick<ExerciseRow>(exercises).map(normalizeExercise),
    plans: pick<TrainingPlanRow>(plans).map(normalizePlan),
    templates: pick<TemplateRow>(templates).map(normalizeTemplate),
    planRoutines: pick<PlanRoutineRow>(planRoutines),
    templateBlocks: pick(templateBlocks),
    templateItems: pick<TemplateItemRow>(templateItems).map(normalizeTemplateItem),
    rules: pick(rules),
    schedules: pick<ScheduleItemRow>(schedules).map(normalizeSchedule),
    sessions: pick<SessionDoc>(sessions).map(normalizeSession),
    bodyWeights: pick(bodyWeights),
    bodyMeasures: pick(bodyMeasures),
    checkins: pick(checkins),
    aerobicActivities: pick(aerobicActivities),
    sessionComments: pick(sessionComments),
  }
}

/** Rows written before training plans existed have no plan_id / plan_position. */
function normalizeTemplate(row: TemplateRow): TemplateRow {
  return {
    ...row,
    plan_id: row.plan_id ?? null,
    plan_position: Number.isFinite(row.plan_position) ? row.plan_position : 0,
    source_slot: row.source_slot ?? null,
    assigned_by: row.assigned_by ?? null,
    source_template_id: row.source_template_id ?? null,
    locked: row.locked === true,
  }
}

function normalizePlan(row: TrainingPlanRow): TrainingPlanRow {
  return {
    ...row,
    source_key: row.source_key ?? null,
    source_version: row.source_version ?? 0,
    assigned_by: row.assigned_by ?? null,
    source_plan_id: row.source_plan_id ?? null,
    locked: row.locked === true,
  }
}

function normalizeExercise(row: ExerciseRow): ExerciseRow {
  return {
    ...row,
    source_title: row.source_title ?? null,
    source_provider: row.source_provider ?? null,
    source_url: row.source_url ?? row.video_url ?? null,
    source_verified_at: row.source_verified_at ?? null,
    assigned_by: row.assigned_by ?? null,
    source_exercise_id: row.source_exercise_id ?? null,
    locked: row.locked === true,
  }
}

function normalizeTemplateItem(row: TemplateItemRow): TemplateItemRow {
  return {
    ...row,
    block_id: row.block_id ?? null,
    block_position: row.block_position ?? row.position,
    target_reps_min: row.target_reps_min ?? row.target_reps ?? null,
    target_reps_max: row.target_reps_max ?? row.target_reps ?? null,
    target_duration_min_s: row.target_duration_min_s ?? row.target_duration_s ?? null,
    target_duration_max_s: row.target_duration_max_s ?? row.target_duration_s ?? null,
    target_distance_min_m: row.target_distance_min_m ?? row.target_distance_m ?? null,
    target_distance_max_m: row.target_distance_max_m ?? row.target_distance_m ?? null,
    target_rpe_min: row.target_rpe_min ?? null,
    target_rpe_max: row.target_rpe_max ?? null,
    target_rir_min: row.target_rir_min ?? null,
    target_rir_max: row.target_rir_max ?? null,
    side_mode: row.side_mode ?? 'bilateral',
    directions: row.directions ?? 1,
    load_increment_kg: row.load_increment_kg ?? null,
    tempo_eccentric: row.tempo_eccentric ?? null,
    tempo_stretch_pause: row.tempo_stretch_pause ?? null,
    tempo_concentric: row.tempo_concentric ?? null,
    tempo_contracted_pause: row.tempo_contracted_pause ?? null,
    tempo_intent: row.tempo_intent ?? 'controlled',
    is_warmup: row.is_warmup === true,
  }
}

function normalizeSchedule(row: ScheduleItemRow): ScheduleItemRow {
  return {
    ...row,
    template_id: row.template_id ?? null,
    plan_id: row.plan_id ?? null,
    assigned_by: row.assigned_by ?? null,
  }
}

function normalizeSession(row: SessionDoc): SessionDoc {
  return {
    ...row,
    plan_id: row.plan_id ?? null,
    cycle_week: row.cycle_week ?? null,
    is_deload: row.is_deload ?? false,
    session_blocks: sortByPosition(row.session_blocks ?? []),
    session_exercises: sortByPosition((row.session_exercises ?? []).map((exercise) => ({
      ...exercise,
      template_item_id: exercise.template_item_id ?? null,
      session_block_id: exercise.session_block_id ?? null,
      block_position: exercise.block_position ?? exercise.position,
      target_weight_kg: exercise.target_weight_kg ?? null,
      target_reps: exercise.target_reps ?? null,
      target_duration_s: exercise.target_duration_s ?? null,
      target_distance_m: exercise.target_distance_m ?? null,
      target_reps_min: exercise.target_reps_min ?? exercise.target_reps ?? null,
      target_reps_max: exercise.target_reps_max ?? exercise.target_reps ?? null,
      target_duration_min_s: exercise.target_duration_min_s ?? exercise.target_duration_s ?? null,
      target_duration_max_s: exercise.target_duration_max_s ?? exercise.target_duration_s ?? null,
      target_distance_min_m: exercise.target_distance_min_m ?? exercise.target_distance_m ?? null,
      target_distance_max_m: exercise.target_distance_max_m ?? exercise.target_distance_m ?? null,
      target_rpe_min: exercise.target_rpe_min ?? null,
      target_rpe_max: exercise.target_rpe_max ?? null,
      target_rir_min: exercise.target_rir_min ?? null,
      target_rir_max: exercise.target_rir_max ?? null,
      side_mode: exercise.side_mode ?? 'bilateral',
      directions: exercise.directions ?? 1,
      load_increment_kg: exercise.load_increment_kg ?? null,
      tempo_eccentric: exercise.tempo_eccentric ?? null,
      tempo_stretch_pause: exercise.tempo_stretch_pause ?? null,
      tempo_concentric: exercise.tempo_concentric ?? null,
      tempo_contracted_pause: exercise.tempo_contracted_pause ?? null,
      tempo_intent: exercise.tempo_intent ?? 'controlled',
      is_warmup: exercise.is_warmup === true,
      sets: sortByPosition((exercise.sets ?? []).map((set) => ({
        ...set,
        round_index: set.round_index ?? null,
        side: set.side ?? null,
        direction: set.direction ?? null,
      }))),
    }))),
  }
}

export async function readProfile(): Promise<ProfileRow | null> {
  const db = await getDb()
  const all = await db.getAll('profiles')
  if (all.length === 0) return null
  const row = all[0].value as unknown as ProfileRow
  return {
    ...row,
    account_kind: row.account_kind === 'light' ? 'light' : 'full',
    is_coach: row.is_coach === true,
    aerobic_goal_minutes: resolveAerobicGoalMinutes(row.aerobic_goal_minutes),
  }
}

// ---------------------------------------------------------------- mirror writes

export async function putDirty(store: StoreName, row: object): Promise<void> {
  const db = await getDb()
  await db.put(store, { value: row as Record<string, unknown>, dirty: true })
}

export async function reconcileProfile(serverRow: ProfileRow | null): Promise<void> {
  const db = await getDb()
  const local = await db.getAll('profiles')
  if (local.length > 0 && local[0].dirty) return
  const tx = db.transaction('profiles', 'readwrite')
  await tx.store.clear()
  if (serverRow) {
    await tx.store.put({
      value: serverRow as unknown as Record<string, unknown>,
      dirty: false,
    })
  }
  await tx.done
}

export async function clearProfileDirty(): Promise<void> {
  const db = await getDb()
  const all = await db.getAll('profiles')
  if (all.length > 0 && all[0].dirty) {
    await db.put('profiles', { value: all[0].value, dirty: false })
  }
}

/** Replace local mirror content with the server snapshot, keeping rows that
 * still have queued (dirty) changes, and deleting rows the server no longer has. */
export async function reconcileStore(
  store: StoreName,
  serverRows: { id: string }[],
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(store, 'readwrite')
  const local = await tx.store.getAll()
  const serverMap = new Map(serverRows.map((r) => [r.id, r]))
  const localIdSet = new Set<string>()

  for (const entry of local) {
    const id = String(entry.value.id)
    localIdSet.add(id)
    if (entry.dirty) continue
    const serverRow = serverMap.get(id)
    if (serverRow) {
      await tx.store.put({
        value: serverRow as unknown as Record<string, unknown>,
        dirty: false,
      })
    } else {
      await tx.store.delete(id)
    }
  }
  for (const row of serverRows) {
    if (!localIdSet.has(row.id)) {
      await tx.store.put({ value: row as unknown as Record<string, unknown>, dirty: false })
    }
  }
  await tx.done
}

export async function clearDirtyFlags(): Promise<void> {
  const db = await getDb()
  const stores: StoreName[] = [
    'profiles',
    'exercises',
    'plans',
    'templates',
    'planRoutines',
    'templateBlocks',
    'templateItems',
    'rules',
    'schedules',
    'sessions',
    'bodyWeights',
    'bodyMeasures',
    'checkins',
    'aerobicActivities',
    'sessionComments',
  ]
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) {
    const rows = await tx.objectStore(store).getAll()
    for (const row of rows) {
      if (row.dirty) await tx.objectStore(store).put({ ...row, dirty: false })
    }
  }
  await tx.done
}

// ---------------------------------------------------------------- outbox

export async function appendOps(ops: OutboxOp[]): Promise<void> {
  if (ops.length === 0) return
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  await Promise.all(
    ops.map((op) => tx.store.add(op as OutboxOp & { seq: number })),
  )
  await tx.done
}

export async function listOps(): Promise<(OutboxOp & { seq: number })[]> {
  return (await getDb()).getAll('outbox')
}

export async function removeOps(seqs: number[]): Promise<void> {
  if (seqs.length === 0) return
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  await Promise.all(seqs.map((seq) => tx.store.delete(seq)))
  await tx.done
}

/** Drop queued ops matching a predicate (e.g. stale upserts of discarded rows). */
export async function removeMatchingOps(
  predicate: (op: OutboxOp) => boolean,
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  const all = await tx.store.getAll()
  await Promise.all(all.filter((op) => predicate(op)).map((op) => tx.store.delete(op.seq)))
  await tx.done
}

export async function pendingCount(): Promise<number> {
  return uniqueOpCount(await listOps())
}

export async function pendingBreakdown(): Promise<{ table: string; count: number }[]> {
  const collapsed = collapseOps(await listOps())
  const counts = new Map<string, number>()
  for (const op of collapsed) {
    counts.set(op.table, (counts.get(op.table) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => a.table.localeCompare(b.table))
}

// ---------------------------------------------------------------- lifecycle

export async function removeFrom(store: StoreName, id: string): Promise<void> {
  await (await getDb()).delete(store, id)
}

export async function wipeLocalData(): Promise<void> {
  const db = await getDb()
  const stores = [
    'meta',
    'profiles',
    'exercises',
    'plans',
    'templates',
    'planRoutines',
    'templateBlocks',
    'templateItems',
    'rules',
    'schedules',
    'sessions',
    'bodyWeights',
    'bodyMeasures',
    'checkins',
    'aerobicActivities',
    'sessionComments',
    'outbox',
  ] as const
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) {
    await tx.objectStore(store).clear()
  }
  await tx.done
}
