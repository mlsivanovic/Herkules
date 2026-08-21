// Store: the offline-first data layer. Every mutation writes the IndexedDB
// mirror first and queues an idempotent outbox op; a debounced sync pushes
// ops (parents before children, deletes children before parents) and pulls
// the server snapshot back into the mirror. Actions read fresh rows from
// IndexedDB so rapid sequential writes never race on stale React state.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AerobicActivityRow,
  ExerciseRow,
  OutboxOp,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionDoc,
  SessionExerciseRow,
  SessionBlockRow,
  SetRow,
  Sex,
  SyncTable,
  TemplateItemRow,
  TemplateBlockRow,
  TemplateRow,
  BodyWeightRow,
  TendonCheckinRow,
  TrainingPlanRow,
} from '../types/db'
import { backendConfigured, supabase } from './supabase'
import { useAuth } from './auth'
import {
  appendOps,
  clearDirtyFlags,
  clearProfileDirty,
  getMeta,
  pendingBreakdown,
  pendingCount,
  putDirty,
  readAll,
  readOne,
  readProfile,
  reconcileProfile,
  reconcileStore,
  removeFrom,
  removeMatchingOps,
  setMeta,
  wipeLocalData,
  type StoreName,
} from './db'
import { flushOutbox, fetchSnapshot } from './sync'
import { matchExercise, parseWorkoutCsv, serializeWorkoutCsv, type ParsedWorkoutImport } from './csv'
import { parseExternalCsv } from './importExternal'
import { parseBackup, serializeBackup } from './backup'
import { parseRoutines, planRoutineImport, serializeRoutines } from './routinesIo'
import {
  HYBRID_SOURCE_KEY,
  HYBRID_SOURCE_VERSION,
  HYBRID_TEMPLATES,
  buildHybridV2Upgrade,
  isHybridV2CanonicalRecipe,
  hybridTemplatesFrom,
} from './programs/hybrid4day'
import {
  compactPlanPositions,
  hybridPlanFrom,
  HYBRID_PLAN_NAME,
  HYBRID_PLAN_NOTES,
  nextTemplateForPlan,
  nextPlanPosition,
  sortPlanTemplates,
} from './programs/plans'
import { normalizeBlockRole } from './blockRole'
import {
  rotationOccurrences,
  type TrainingFrequency,
} from './programs/rotate'
import {
  cycleWeek,
  materializePlannedSets,
  progressionSuggestions,
  snapshotBlock,
  snapshotExercise,
} from './prescription'

const SYNC_DEBOUNCE_MS = 2500

export function newId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function upsert(table: SyncTable, row: object): OutboxOp {
  return { kind: 'upsert', table, row: row as Record<string, unknown> }
}

export interface ExerciseInput {
  name: string
  category: ExerciseRow['category']
  measurement: ExerciseRow['measurement']
  muscle_groups: string[]
  equipment: string[]
  instructions: string | null
  video_url: string | null
}

export interface TemplateItemInput {
  id: string | null
  exercise_id: string
  position: number
  planned_sets: number
  target_weight_kg: number | null
  target_reps: number | null
  target_duration_s: number | null
  target_distance_m: number | null
  rest_seconds: number | null
  tempo?: string | null
  notes: string | null
  superset_group: string | null
  block_role: TemplateItemRow['block_role']
  block_id?: string | null
  block_position?: number
  target_reps_min?: number | null
  target_reps_max?: number | null
  target_duration_min_s?: number | null
  target_duration_max_s?: number | null
  target_distance_min_m?: number | null
  target_distance_max_m?: number | null
  target_rpe_min?: number | null
  target_rpe_max?: number | null
  target_rir_min?: number | null
  target_rir_max?: number | null
  side_mode?: TemplateItemRow['side_mode']
  directions?: number
  load_increment_kg?: number | null
  tempo_eccentric?: number | null
  tempo_stretch_pause?: number | null
  tempo_concentric?: number | null
  tempo_contracted_pause?: number | null
  tempo_intent?: TemplateItemRow['tempo_intent']
}

export interface StartSessionInput {
  templateId?: string | null
  scheduleItemId?: string | null
  plannedDate?: string | null
  name?: string
}

export interface StoreData {
  ready: boolean
  online: boolean
  syncing: boolean
  pending: number
  pendingByTable: { table: string; count: number }[]
  lastSyncedAt: string | null
  syncError: string | null
  profile: ProfileRow | null
  exercises: ExerciseRow[]
  plans: TrainingPlanRow[]
  templates: TemplateRow[]
  templateBlocks: TemplateBlockRow[]
  templateItems: TemplateItemRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  bodyWeights: BodyWeightRow[]
  checkins: TendonCheckinRow[]
  aerobicActivities: AerobicActivityRow[]
}

export interface StoreActions {
  syncNow(): Promise<void>
  refreshIfOnline(): void

  // exercises
  createExercise(input: ExerciseInput): Promise<ExerciseRow>
  updateExercise(id: string, patch: Partial<ExerciseInput> & { is_archived?: boolean }): Promise<void>

  // training plans
  createPlan(name: string, notes: string | null): Promise<TrainingPlanRow>
  updatePlan(id: string, patch: { name?: string; notes?: string | null }): Promise<void>
  deletePlan(id: string): Promise<void>
  assignTemplateToPlan(templateId: string, planId: string | null): Promise<void>
  reorderPlanDays(planId: string, orderedTemplateIds: string[]): Promise<void>

  // templates
  createTemplate(name: string, notes: string | null, planId?: string | null): Promise<TemplateRow>
  updateTemplate(id: string, patch: { name?: string; notes?: string | null }): Promise<void>
  deleteTemplate(id: string): Promise<void>
  saveTemplateItems(templateId: string, items: TemplateItemInput[]): Promise<void>
  installHybridProgram(): Promise<{ created: boolean; planId: string }>
  ensureHybridV2(): Promise<void>
  ensureHybridBlockRoles(): Promise<void>
  ensureHybridPlan(): Promise<void>

  // scheduling
  scheduleSingleDate(templateId: string, date: string): Promise<void>
  schedulePlanRotation(
    planId: string,
    input: {
      frequency: TrainingFrequency
      weekdays: number[]
      startDate: string
      weeks: number
    },
  ): Promise<number>
  scheduleWeekly(
    templateId: string,
    weekdays: number[],
    startDate: string,
    endDate: string | null,
    scheduleId?: string,
  ): Promise<void>
  deleteSchedule(id: string): Promise<void>
  skipOccurrence(scheduleId: string, date: string): Promise<void>
  unskipOccurrence(sessionId: string): Promise<void>

  // sessions
  startSession(input: StartSessionInput): Promise<SessionDoc>
  updateSessionMeta(
    id: string,
    patch: { name?: string; notes?: string | null; rpe?: number | null },
  ): Promise<void>
  finishSession(id: string, summary: { notes?: string | null; rpe?: number | null }): Promise<void>
  applyProgressionSuggestions(id: string): Promise<number>
  discardSession(id: string): Promise<void>
  deleteSession(id: string): Promise<void>
  exportWorkoutsCsv(): Promise<string>
  importWorkouts(parsed: ParsedWorkoutImport[]): Promise<{
    sessions: number
    sets: number
    createdExercises: number
  }>
  importWorkoutsCsv(text: string): Promise<{ sessions: number; sets: number; createdExercises: number }>
  importExternalCsv(text: string): Promise<{ sessions: number; sets: number; createdExercises: number }>
  exportBackup(): Promise<string>
  restoreBackup(text: string): Promise<{
    sessions: number
    templates: number
    exercises: number
    checkins: number
  }>
  exportRoutines(templateIds?: string[]): Promise<string>
  importRoutines(text: string): Promise<{
    created: number
    updated: number
    items: number
    createdExercises: number
  }>
  addSessionExercise(sessionId: string, exerciseId: string): Promise<void>
  removeSessionExercise(sessionId: string, sessionExerciseId: string): Promise<void>
  swapSessionExercise(sessionId: string, sessionExerciseId: string, exerciseId: string): Promise<void>
  reorderSessionExercises(sessionId: string, orderedIds: string[]): Promise<void>
  upsertSet(sessionId: string, set: SetRow): Promise<void>
  deleteSet(sessionId: string, sessionExerciseId: string, setId: string): Promise<void>
  addWarmupSets(
    sessionId: string,
    sessionExerciseId: string,
    planned: { weightKg: number; reps: number }[],
  ): Promise<void>

  // profile
  updateProfile(
    patch: Partial<
      Pick<
        ProfileRow,
        | 'display_name'
        | 'unit_system'
        | 'week_start'
        | 'default_rest_seconds'
        | 'height_cm'
        | 'sex'
        | 'birth_date'
      >
    >,
  ): Promise<void>
  logWeight(date: string, weightKg: number, notes?: string | null): Promise<void>
  deleteWeight(id: string): Promise<void>

  // tendon check-ins
  logCheckin(input: {
    date: string
    site: string
    stiffness: number
    pain: number
    notes?: string | null
  }): Promise<void>
  deleteCheckin(id: string): Promise<void>

  // aerobic goal
  logAerobicActivity(input: {
    date: string
    activityType: AerobicActivityRow['activity_type']
    durationS: number
    notes?: string | null
  }): Promise<void>
  deleteAerobicActivity(id: string): Promise<void>

  // auth-related
  attemptSync(): Promise<boolean>
  forceWipeAndSignOut(): Promise<void>
}

export type StoreState = StoreData & StoreActions

const StoreContext = createContext<StoreState | null>(null)

const DEFAULT_PROFILE = {
  display_name: '',
  unit_system: 'metric' as const,
  week_start: 'monday' as const,
  default_rest_seconds: 90,
  height_cm: null as number | null,
  sex: null as Sex | null,
  birth_date: null as string | null,
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const userId = session?.user.id ?? null

  const [state, setState] = useState({
    ready: false,
    online: navigator.onLine,
    syncing: false,
    pending: 0,
    pendingByTable: [] as { table: string; count: number }[],
    lastSyncedAt: null as string | null,
    syncError: null as string | null,
    profile: null as ProfileRow | null,
    exercises: [] as ExerciseRow[],
    plans: [] as TrainingPlanRow[],
    templates: [] as TemplateRow[],
    templateBlocks: [] as TemplateBlockRow[],
    templateItems: [] as TemplateItemRow[],
    rules: [] as RecurrenceRuleRow[],
    schedules: [] as ScheduleItemRow[],
    sessions: [] as SessionDoc[],
    bodyWeights: [] as BodyWeightRow[],
    checkins: [] as TendonCheckinRow[],
    aerobicActivities: [] as AerobicActivityRow[],
  })

  const syncingRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const userIdRef = useRef<string | null>(null)
  userIdRef.current = userId
  const clientRef = useRef<SupabaseClient | null>(null)
  if (backendConfigured && userId) clientRef.current = supabase()

  const reloadFromDb = useCallback(async () => {
    const [all, profile, pending, byTable] = await Promise.all([
      readAll(),
      readProfile(),
      pendingCount(),
      pendingBreakdown(),
    ])
    setState((prev) => ({ ...prev, ...all, profile, pending, pendingByTable: byTable, ready: true }))
  }, [])

  const performSync = useCallback(async () => {
    const client = clientRef.current
    if (!client || syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setState((prev) => ({ ...prev, syncing: true }))
    try {
      await flushOutbox(client)
      await clearDirtyFlags()
      await clearProfileDirty()
      const snapshot = await fetchSnapshot(client)
      await Promise.all([
        reconcileProfile(snapshot.profile),
        reconcileStore('exercises', snapshot.exercises),
        reconcileStore('plans', snapshot.plans),
        reconcileStore('templates', snapshot.templates),
        reconcileStore('templateBlocks', snapshot.templateBlocks),
        reconcileStore('templateItems', snapshot.templateItems),
        reconcileStore('rules', snapshot.rules),
        reconcileStore('schedules', snapshot.schedules),
        reconcileStore('sessions', snapshot.sessions),
        reconcileStore('bodyWeights', snapshot.bodyWeights),
        reconcileStore('checkins', snapshot.checkins),
        reconcileStore('aerobicActivities', snapshot.aerobicActivities),
      ])
      await reloadFromDb()
      await actionsRef.current?.ensureHybridV2()
      setState((prev) => ({ ...prev, syncError: null, lastSyncedAt: nowIso() }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.'
      setState((prev) => ({ ...prev, syncError: message }))
    } finally {
      syncingRef.current = false
      setState((prev) => ({ ...prev, syncing: false }))
    }
  }, [reloadFromDb])

  const scheduleDebouncedSync = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      void performSync()
    }, SYNC_DEBOUNCE_MS)
  }, [performSync])

  // Load local data when the signed-in user changes; wipe when switching users.
  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setState((prev) => ({
        ...prev,
        ready: true,
        profile: null,
        exercises: [],
        plans: [],
        templates: [],
        templateBlocks: [],
        templateItems: [],
        rules: [],
        schedules: [],
        sessions: [],
        bodyWeights: [],
        checkins: [],
        aerobicActivities: [],
        pending: 0,
        pendingByTable: [],
        lastSyncedAt: null,
        syncError: null,
      }))
      return
    }
    void (async () => {
      const storedUser = await getMeta<string>('userId')
      if (storedUser !== userId) {
        await wipeLocalData()
        await setMeta('userId', userId)
      }
      if (cancelled) return
      await reloadFromDb()
      await actionsRef.current?.ensureHybridV2()
      void performSync()
    })()
    return () => {
      cancelled = true
    }
  }, [userId, reloadFromDb, performSync])

  // Sync triggers: connectivity regain, tab focus.
  useEffect(() => {
    const goOnline = () => {
      setState((prev) => ({ ...prev, online: true }))
      void performSync()
    }
    const goOffline = () => setState((prev) => ({ ...prev, online: false }))
    const onVisible = () => {
      if (document.visibilityState === 'visible') void performSync()
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [performSync])

  /** Write to the mirror, queue ops, refresh state, schedule the push. */
  const commit = useCallback(
    async (writes: { store: StoreName; row: object }[], ops: OutboxOp[]) => {
      for (const write of writes) {
        await putDirty(write.store, write.row)
      }
      await appendOps(ops)
      await reloadFromDb()
      scheduleDebouncedSync()
    },
    [reloadFromDb, scheduleDebouncedSync],
  )

  const actionsRef = useRef<StoreActions | null>(null)
  if (!actionsRef.current) {
    actionsRef.current = {
      async syncNow() {
        await performSync()
      },
      refreshIfOnline() {
        if (navigator.onLine) void performSync()
      },

      // ------------------------------------------------------------ exercises

      async createExercise(input) {
        const row: ExerciseRow = {
          id: newId(),
          owner_id: userIdRef.current,
          name: input.name,
          category: input.category,
          measurement: input.measurement,
          muscle_groups: input.muscle_groups,
          equipment: input.equipment,
          instructions: input.instructions,
          video_url: input.video_url,
          source_title: null,
          source_provider: null,
          source_url: input.video_url,
          source_verified_at: null,
          is_archived: false,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        await commit([{ store: 'exercises', row }], [upsert('exercises', row)])
        return row
      },

      async updateExercise(id, patch) {
        const existing = await readOne<ExerciseRow>('exercises', id)
        if (!existing) throw new Error('Exercise not found.')
        const row: ExerciseRow = { ...existing, ...patch, updated_at: nowIso() }
        await commit([{ store: 'exercises', row }], [upsert('exercises', row)])
      },

      // ------------------------------------------------------------ training plans

      async createPlan(name, notes) {
        const row: TrainingPlanRow = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          name,
          notes,
          source_key: null,
          source_version: 0,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        await commit([{ store: 'plans', row }], [upsert('training_plans', row)])
        return row
      },

      async updatePlan(id, patch) {
        const existing = await readOne<TrainingPlanRow>('plans', id)
        if (!existing) throw new Error('Plan not found.')
        const row: TrainingPlanRow = { ...existing, ...patch, updated_at: nowIso() }
        await commit([{ store: 'plans', row }], [upsert('training_plans', row)])
      },

      async deletePlan(id) {
        const all = await readAll()
        const members = sortPlanTemplates(all.templates, id)
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        for (const template of members) {
          const row: TemplateRow = {
            ...template,
            plan_id: null,
            plan_position: 0,
            updated_at: stamp,
          }
          writes.push({ store: 'templates', row })
          ops.push(upsert('workout_templates', row))
        }
        for (const write of writes) await putDirty(write.store, write.row)
        await removeFrom('plans', id)
        ops.push({ kind: 'delete', table: 'training_plans', id })
        await appendOps(ops)
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      async assignTemplateToPlan(templateId, planId) {
        const all = await readAll()
        const existing = all.templates.find((row) => row.id === templateId)
        if (!existing) throw new Error('Routine not found.')
        if (planId) {
          const plan = all.plans.find((row) => row.id === planId)
          if (!plan) throw new Error('Plan not found.')
        }
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        const previousPlanId = existing.plan_id
        const row: TemplateRow = {
          ...existing,
          plan_id: planId,
          plan_position: planId ? nextPlanPosition(all.templates, planId) : 0,
          source_slot: null,
          updated_at: stamp,
        }
        writes.push({ store: 'templates', row })
        ops.push(upsert('workout_templates', row))

        if (previousPlanId && previousPlanId !== planId) {
          const remaining = all.templates.map((item) => (item.id === templateId ? row : item))
          for (const compacted of compactPlanPositions(remaining, previousPlanId)) {
            if (compacted.plan_position === remaining.find((item) => item.id === compacted.id)?.plan_position) {
              continue
            }
            const next: TemplateRow = { ...compacted, updated_at: stamp }
            writes.push({ store: 'templates', row: next })
            ops.push(upsert('workout_templates', next))
          }
        }

        await commit(writes, ops)
      },

      async reorderPlanDays(planId, orderedTemplateIds) {
        const all = await readAll()
        const members = sortPlanTemplates(all.templates, planId)
        const memberIds = new Set(members.map((row) => row.id))
        if (orderedTemplateIds.some((id) => !memberIds.has(id))) {
          throw new Error('Those routines are not all in this plan.')
        }
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        orderedTemplateIds.forEach((id, index) => {
          const existing = members.find((row) => row.id === id)
          if (!existing || existing.plan_position === index) return
          const row: TemplateRow = { ...existing, plan_position: index, updated_at: stamp }
          writes.push({ store: 'templates', row })
          ops.push(upsert('workout_templates', row))
        })
        if (writes.length === 0) return
        await commit(writes, ops)
      },

      // ------------------------------------------------------------ templates

      async createTemplate(name, notes, planId = null) {
        const all = await readAll()
        if (planId && !all.plans.some((row) => row.id === planId)) {
          throw new Error('Plan not found.')
        }
        const row: TemplateRow = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          name,
          notes,
          plan_id: planId,
          plan_position: planId ? nextPlanPosition(all.templates, planId) : 0,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        await commit([{ store: 'templates', row }], [upsert('workout_templates', row)])
        return row
      },

      async updateTemplate(id, patch) {
        const existing = await readOne<TemplateRow>('templates', id)
        if (!existing) throw new Error('Routine not found.')
        const row: TemplateRow = { ...existing, ...patch, updated_at: nowIso() }
        await commit([{ store: 'templates', row }], [upsert('workout_templates', row)])
      },

      async deleteTemplate(id) {
        // Items cascade server-side; drop their queued upserts so nothing
        // recreates rows whose parent is being deleted.
        const all = await readAll()
        const existing = all.templates.find((row) => row.id === id)
        const items = all.templateItems.filter((i) => i.template_id === id)
        const blocks = all.templateBlocks.filter((block) => block.template_id === id)
        const itemIds = new Set(items.map((i) => i.id))
        const blockIds = new Set(blocks.map((block) => block.id))
        await removeMatchingOps(
          (op) =>
            op.kind === 'upsert' && op.table === 'template_items' && itemIds.has(String(op.row.id)),
        )
        for (const itemId of itemIds) await removeFrom('templateItems', itemId)
        await removeMatchingOps(
          (op) => op.kind === 'upsert' && op.table === 'template_blocks' && blockIds.has(String(op.row.id)),
        )
        for (const blockId of blockIds) await removeFrom('templateBlocks', blockId)
        await removeFrom('templates', id)
        const ops: OutboxOp[] = [{ kind: 'delete', table: 'workout_templates', id }]
        if (existing?.plan_id) {
          const remaining = all.templates.filter((row) => row.id !== id)
          const stamp = nowIso()
          for (const compacted of compactPlanPositions(remaining, existing.plan_id)) {
            const previous = remaining.find((row) => row.id === compacted.id)
            if (!previous || previous.plan_position === compacted.plan_position) continue
            const row: TemplateRow = { ...compacted, updated_at: stamp }
            await putDirty('templates', row)
            ops.push(upsert('workout_templates', row))
          }
        }
        await appendOps(ops)
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      async saveTemplateItems(templateId, items) {
        const existing = (await readAll()).templateItems.filter((i) => i.template_id === templateId)
        const existingById = new Map(existing.map((i) => [i.id, i]))
        const keptIds = new Set(items.map((i) => i.id).filter((id): id is string => Boolean(id)))
        const ops: OutboxOp[] = []
        const writes: { store: 'templateItems'; row: TemplateItemRow }[] = []

        for (const item of items) {
          const previous = item.id ? existingById.get(item.id) : undefined
          const row: TemplateItemRow = {
            id: item.id ?? newId(),
            template_id: templateId,
            exercise_id: item.exercise_id,
            position: item.position,
            planned_sets: item.planned_sets,
            target_weight_kg: item.target_weight_kg,
            target_reps: item.target_reps,
            target_duration_s: item.target_duration_s,
            target_distance_m: item.target_distance_m,
            rest_seconds: item.rest_seconds,
            tempo: item.tempo ?? null,
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
            created_at: previous?.created_at ?? nowIso(),
            updated_at: nowIso(),
          }
          writes.push({ store: 'templateItems', row })
          ops.push(upsert('template_items', row))
        }

        for (const removed of existing.filter((i) => !keptIds.has(i.id))) {
          await removeMatchingOps(
            (op) =>
              op.kind === 'upsert' &&
              op.table === 'template_items' &&
              String(op.row.id) === removed.id,
          )
          await removeFrom('templateItems', removed.id)
          ops.push({ kind: 'delete', table: 'template_items', id: removed.id })
        }

        await commit(writes, ops)
      },

      async installHybridProgram() {
        const all = await readAll()
        const owner = userIdRef.current ?? ''
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        const installed = hybridTemplatesFrom(all.templates)
        const commonPlanId = installed
          ? (() => {
              const ids = new Set(Object.values(installed).map((row) => row.plan_id).filter(Boolean))
              return ids.size === 1 ? ([...ids][0] as string) : null
            })()
          : null
        const existingPlan =
          all.plans.find((row) => row.source_key === HYBRID_SOURCE_KEY) ??
          (commonPlanId ? all.plans.find((row) => row.id === commonPlanId) : null) ??
          hybridPlanFrom(all.plans)
        const upgrade = buildHybridV2Upgrade({
          ownerId: owner,
          existingPlan: existingPlan ?? null,
          installed: installed as Record<'A' | 'B' | 'C' | 'D', TemplateRow> | null,
          now: stamp,
          newId,
          planName: HYBRID_PLAN_NAME,
          planNotes: HYBRID_PLAN_NOTES,
        })
        const { plan } = upgrade
        writes.push({ store: 'plans', row: plan })
        ops.push(upsert('training_plans', plan))

        for (const definition of HYBRID_TEMPLATES) {
          const template = upgrade.templates[definition.slot]
          writes.push({ store: 'templates', row: template })
          ops.push(upsert('workout_templates', template))
        }

        if (installed) {
          const templateIds = new Set(Object.values(installed).map((row) => row.id))
          const oldItems = all.templateItems.filter((row) => templateIds.has(row.template_id))
          const oldBlocks = all.templateBlocks.filter((row) => templateIds.has(row.template_id))
          const oldItemIds = new Set(oldItems.map((row) => row.id))
          const oldBlockIds = new Set(oldBlocks.map((row) => row.id))
          await removeMatchingOps((op) =>
            op.kind === 'upsert' &&
            ((op.table === 'template_items' && oldItemIds.has(String(op.row.id))) ||
              (op.table === 'template_blocks' && oldBlockIds.has(String(op.row.id)))),
          )
          for (const row of oldItems) {
            await removeFrom('templateItems', row.id)
            ops.push({ kind: 'delete', table: 'template_items', id: row.id })
          }
          for (const row of oldBlocks) {
            await removeFrom('templateBlocks', row.id)
            ops.push({ kind: 'delete', table: 'template_blocks', id: row.id })
          }
        }

        for (const block of upgrade.blocks) {
          writes.push({ store: 'templateBlocks', row: block })
          ops.push(upsert('template_blocks', block))
        }
        for (const item of upgrade.items) {
          writes.push({ store: 'templateItems', row: item })
          ops.push(upsert('template_items', item))
        }
        await commit(writes, ops)
        return { created: upgrade.created, planId: plan.id }
      },

      async ensureHybridV2() {
        const all = await readAll()
        const installed = hybridTemplatesFrom(all.templates)
        if (!installed) return
        const planId = installed.A.plan_id
        const plan = planId ? all.plans.find((row) => row.id === planId) : null
        // A stale client must never overwrite a recipe created by a newer app.
        if (
          plan?.source_key === HYBRID_SOURCE_KEY &&
          (plan.source_version ?? 0) > HYBRID_SOURCE_VERSION
        ) return
        const canonical =
          plan?.source_key === HYBRID_SOURCE_KEY &&
          (plan.source_version ?? 0) >= HYBRID_SOURCE_VERSION &&
          isHybridV2CanonicalRecipe({
            templates: installed,
            blocks: all.templateBlocks,
            items: all.templateItems,
          })
        if (!canonical) await actionsRef.current?.installHybridProgram()
      },

      async ensureHybridBlockRoles() {
        await actionsRef.current?.ensureHybridV2()
      },

      async ensureHybridPlan() {
        await actionsRef.current?.ensureHybridV2()
      },

      // ------------------------------------------------------------ scheduling

      async scheduleSingleDate(templateId, date) {
        const row: ScheduleItemRow = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          template_id: templateId,
          plan_id: null,
          scheduled_date: date,
          recurrence_rule_id: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        await commit([{ store: 'schedules', row }], [upsert('schedule_items', row)])
      },

      async schedulePlanRotation(planId, input) {
        const all = await readAll()
        const days = sortPlanTemplates(all.templates, planId)
        if (days.length === 0) throw new Error('Add at least one routine to the plan first.')

        const occurrences = rotationOccurrences({
          frequency: input.frequency,
          weekdays: input.weekdays,
          start: input.startDate,
          weeks: input.weeks,
          dayCount: days.length,
        })
        if (occurrences.length === 0) return 0

        const owner = userIdRef.current ?? ''
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        for (const occurrence of occurrences) {
          const row: ScheduleItemRow = {
            id: newId(),
            owner_id: owner,
            template_id: null,
            plan_id: planId,
            scheduled_date: occurrence.date,
            recurrence_rule_id: null,
            created_at: stamp,
            updated_at: stamp,
          }
          writes.push({ store: 'schedules', row })
          ops.push(upsert('schedule_items', row))
        }
        await commit(writes, ops)
        return occurrences.length
      },

      async scheduleWeekly(templateId, weekdays, startDate, endDate, scheduleId) {
        let rule: RecurrenceRuleRow
        let schedule: ScheduleItemRow

        if (scheduleId) {
          const existingSchedule = await readOne<ScheduleItemRow>('schedules', scheduleId)
          if (!existingSchedule?.recurrence_rule_id) throw new Error('Schedule not found.')
          const existingRule = await readOne<RecurrenceRuleRow>(
            'rules',
            existingSchedule.recurrence_rule_id,
          )
          if (!existingRule) throw new Error('Recurrence rule not found.')
          rule = { ...existingRule, weekdays, start_date: startDate, end_date: endDate, updated_at: nowIso() }
          schedule = { ...existingSchedule, updated_at: nowIso() }
        } else {
          rule = {
            id: newId(),
            owner_id: userIdRef.current ?? '',
            frequency: 'weekly',
            weekdays,
            start_date: startDate,
            end_date: endDate,
            created_at: nowIso(),
            updated_at: nowIso(),
          }
          schedule = {
            id: newId(),
            owner_id: userIdRef.current ?? '',
          template_id: templateId,
          plan_id: null,
            scheduled_date: null,
            recurrence_rule_id: rule.id,
            created_at: nowIso(),
            updated_at: nowIso(),
          }
        }
        await commit(
          [
            { store: 'rules', row: rule },
            { store: 'schedules', row: schedule },
          ],
          [upsert('recurrence_rules', rule), upsert('schedule_items', schedule)],
        )
      },

      async deleteSchedule(id) {
        const schedule = await readOne<ScheduleItemRow>('schedules', id)
        const ops: OutboxOp[] = [{ kind: 'delete', table: 'schedule_items', id }]
        if (schedule?.recurrence_rule_id) {
          await removeMatchingOps(
            (op) =>
              op.kind === 'upsert' &&
              op.table === 'recurrence_rules' &&
              String(op.row.id) === schedule.recurrence_rule_id,
          )
          await removeFrom('rules', schedule.recurrence_rule_id)
          ops.push({ kind: 'delete', table: 'recurrence_rules', id: schedule.recurrence_rule_id })
        }
        await removeMatchingOps(
          (op) => op.kind === 'upsert' && op.table === 'schedule_items' && String(op.row.id) === id,
        )
        await removeFrom('schedules', id)
        await appendOps(ops)
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      // ------------------------------------------------------------ sessions

      async startSession(input) {
        const all = await readAll()
        const schedule = input.scheduleItemId
          ? all.schedules.find((row) => row.id === input.scheduleItemId)
          : null
        const occurrencePlanId = schedule?.plan_id ?? null
        const template = input.templateId
          ? all.templates.find((t) => t.id === input.templateId)
          : occurrencePlanId
            ? nextTemplateForPlan(occurrencePlanId, all.templates, all.sessions) ?? undefined
            : undefined
        const items = template
          ? all.templateItems
              .filter((i) => i.template_id === template.id)
              .sort((a, b) => a.position - b.position)
          : []
        const templateBlocks = template
          ? all.templateBlocks
              .filter((block) => block.template_id === template.id)
              .sort((a, b) => a.position - b.position)
          : []

        const sessionId = newId()
        if (input.scheduleItemId && input.plannedDate) {
          const skipped = all.sessions.find(
            (s) =>
              s.status === 'skipped' &&
              s.schedule_item_id === input.scheduleItemId &&
              (s.planned_date ?? s.started_at.slice(0, 10)) === input.plannedDate,
          )
          if (skipped) await actionsRef.current?.deleteSession(skipped.id)
        }
        const stamp = nowIso()
        const plan = occurrencePlanId
          ? all.plans.find((row) => row.id === occurrencePlanId) ?? null
          : null
        const currentCycleWeek = plan
          ? cycleWeek(plan.created_at, input.plannedDate ?? stamp.slice(0, 10))
          : null
        const deload = plan?.source_key === HYBRID_SOURCE_KEY && currentCycleWeek === 4
        const blockIdMap = new Map<string, string>()
        const sessionBlocks: SessionBlockRow[] = templateBlocks.map((block) => {
          const id = newId()
          blockIdMap.set(block.id, id)
          return snapshotBlock(block, sessionId, id, stamp, deload)
        })
        const sessionBlockById = new Map(sessionBlocks.map((block) => [block.id, block]))
        const exercises: (SessionExerciseRow & { sets: SetRow[] })[] = items.map((item) => {
          const exercise = all.exercises.find((e) => e.id === item.exercise_id)
          const sessionBlockId = item.block_id ? blockIdMap.get(item.block_id) ?? null : null
          const row = snapshotExercise(item, {
            sessionId,
            sessionExerciseId: newId(),
            sessionBlockId,
            name: exercise?.name ?? 'Exercise',
            measurement: exercise?.measurement ?? 'weight_reps',
            now: stamp,
            deload,
          })
          return {
            ...row,
            sets: materializePlannedSets({
              exercise: row,
              block: sessionBlockId ? sessionBlockById.get(sessionBlockId) ?? null : null,
              newId,
              now: stamp,
            }),
          }
        })

        const doc: SessionDoc = {
          id: sessionId,
          owner_id: userIdRef.current ?? '',
          template_id: template?.id ?? null,
          schedule_item_id: input.scheduleItemId ?? null,
          name: input.name ?? template?.name ?? 'Workout',
          status: 'in_progress',
          planned_date: input.plannedDate ?? null,
          started_at: nowIso(),
          ended_at: null,
          notes: null,
          rpe: null,
          plan_id: occurrencePlanId,
          cycle_week: currentCycleWeek,
          is_deload: deload,
          created_at: stamp,
          updated_at: stamp,
          session_blocks: sessionBlocks,
          session_exercises: exercises,
        }

        const ops: OutboxOp[] = [upsert('workout_sessions', stripNested(doc))]
        for (const block of sessionBlocks) ops.push(upsert('session_blocks', block))
        for (const se of exercises) {
          ops.push(upsert('session_exercises', stripSessionExercise(se)))
          for (const set of se.sets) ops.push(upsert('workout_sets', set))
        }
        await commit([{ store: 'sessions', row: doc }], ops)
        return doc
      },

      async updateSessionMeta(id, patch) {
        const doc = await readOne<SessionDoc>('sessions', id)
        if (!doc) throw new Error('Session not found.')
        const row: SessionDoc = { ...doc, ...patch, updated_at: nowIso() }
        await commit([{ store: 'sessions', row }], [upsert('workout_sessions', stripNested(row))])
      },

      async finishSession(id, summary) {
        const doc = await readOne<SessionDoc>('sessions', id)
        if (!doc) throw new Error('Session not found.')
        const row: SessionDoc = {
          ...doc,
          status: 'completed',
          ended_at: nowIso(),
          notes: summary.notes ?? doc.notes,
          rpe: summary.rpe ?? doc.rpe,
          updated_at: nowIso(),
        }
        await commit([{ store: 'sessions', row }], [upsert('workout_sessions', stripNested(row))])
      },

      async applyProgressionSuggestions(id) {
        const doc = await readOne<SessionDoc>('sessions', id)
        if (!doc) throw new Error('Session not found.')
        const suggestions = progressionSuggestions(doc)
        if (suggestions.length === 0) return 0
        const all = await readAll()
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        for (const suggestion of suggestions) {
          const item = all.templateItems.find((row) => row.id === suggestion.templateItemId)
          if (!item) continue
          const row: TemplateItemRow = {
            ...item,
            target_weight_kg: suggestion.toWeightKg,
            updated_at: stamp,
          }
          writes.push({ store: 'templateItems', row })
          ops.push(upsert('template_items', row))
        }
        if (writes.length > 0) await commit(writes, ops)
        return writes.length
      },

      async discardSession(id) {
        await actionsRef.current?.deleteSession(id)
      },

      async deleteSession(id) {
        const doc = await readOne<SessionDoc>('sessions', id)
        if (!doc) return
        const exerciseIds = doc.session_exercises.map((se) => se.id)
        const setIds = doc.session_exercises.flatMap((se) => se.sets.map((s) => s.id))

        // Drop queued upserts for the whole tree, then enqueue one session
        // delete — server-side cascades clean children if they were synced.
        await removeMatchingOps((op) => {
          if (op.kind !== 'upsert') return false
          if (op.table === 'workout_sessions' && String(op.row.id) === id) return true
          if (op.table === 'session_exercises' && exerciseIds.includes(String(op.row.id))) return true
          if (op.table === 'workout_sets' && setIds.includes(String(op.row.id))) return true
          return false
        })
        await removeFrom('sessions', id)
        await appendOps([{ kind: 'delete', table: 'workout_sessions', id }])
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      async skipOccurrence(scheduleId, date) {
        const all = await readAll()
        const already = all.sessions.find(
          (s) =>
            s.schedule_item_id === scheduleId &&
            (s.planned_date ?? s.started_at.slice(0, 10)) === date &&
            (s.status === 'skipped' || s.status === 'completed' || s.status === 'in_progress'),
        )
        if (already) {
          if (already.status === 'skipped') return
          throw new Error('This day already has a workout. Delete it before skipping.')
        }
        const schedule = all.schedules.find((s) => s.id === scheduleId)
        const template = schedule
          ? schedule.template_id
            ? all.templates.find((t) => t.id === schedule.template_id)
            : schedule.plan_id
              ? nextTemplateForPlan(schedule.plan_id, all.templates, all.sessions) ?? undefined
              : undefined
          : undefined
        const stamp = nowIso()
        const doc: SessionDoc = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          template_id: template?.id ?? schedule?.template_id ?? null,
          schedule_item_id: scheduleId,
          name: template?.name ?? 'Workout',
          status: 'skipped',
          planned_date: date,
          started_at: `${date}T12:00:00.000Z`,
          ended_at: stamp,
          notes: null,
          rpe: null,
          plan_id: schedule?.plan_id ?? null,
          cycle_week: null,
          is_deload: false,
          created_at: stamp,
          updated_at: stamp,
          session_blocks: [],
          session_exercises: [],
        }
        await commit([{ store: 'sessions', row: doc }], [upsert('workout_sessions', stripNested(doc))])
      },

      async unskipOccurrence(sessionId) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        if (!doc || doc.status !== 'skipped') return
        await actionsRef.current?.deleteSession(sessionId)
      },

      async exportWorkoutsCsv() {
        return serializeWorkoutCsv((await readAll()).sessions)
      },

      async exportBackup() {
        const all = await readAll()
        const profile = await readProfile()
        return serializeBackup({
          profile,
          bodyWeights: all.bodyWeights,
          exercises: all.exercises.filter((e) => e.owner_id !== null),
          plans: all.plans,
          templates: all.templates,
          templateBlocks: all.templateBlocks,
          templateItems: all.templateItems,
          rules: all.rules,
          schedules: all.schedules,
          sessions: all.sessions,
          checkins: all.checkins,
          aerobicActivities: all.aerobicActivities,
        })
      },

      async restoreBackup(text) {
        const file = parseBackup(text)
        const owner = userIdRef.current ?? ''
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []
        let sessionCount = 0

        // The profile is restored only when it belongs to this account.
        if (file.profile && file.profile.id === owner) {
          const row = { ...file.profile, updated_at: stamp }
          writes.push({ store: 'profiles', row })
          ops.push(upsert('profiles', row))
        }

        for (const row of file.bodyWeights) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'bodyWeights', row: next })
          ops.push(upsert('body_weight_entries', next))
        }
        for (const row of file.checkins) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'checkins', row: next })
          ops.push(upsert('tendon_checkins', next))
        }
        for (const row of file.aerobicActivities) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'aerobicActivities', row: next })
          ops.push(upsert('aerobic_activities', next))
        }

        // System exercises (owner_id null) are skipped — they already exist.
        for (const row of file.exercises) {
          if (row.owner_id === null) continue
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'exercises', row: next })
          ops.push(upsert('exercises', next))
        }

        for (const row of file.plans) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'plans', row: next })
          ops.push(upsert('training_plans', next))
        }
        for (const row of file.templates) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'templates', row: next })
          ops.push(upsert('workout_templates', next))
        }
        for (const row of file.templateBlocks) {
          const next = { ...row, updated_at: stamp }
          writes.push({ store: 'templateBlocks', row: next })
          ops.push(upsert('template_blocks', next))
        }
        for (const row of file.templateItems) {
          const next = { ...row, updated_at: stamp }
          writes.push({ store: 'templateItems', row: next })
          ops.push(upsert('template_items', next))
        }
        for (const row of file.rules) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'rules', row: next })
          ops.push(upsert('recurrence_rules', next))
        }
        for (const row of file.schedules) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'schedules', row: next })
          ops.push(upsert('schedule_items', next))
        }

        for (const doc of file.sessions) {
          const row = { ...doc, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'sessions', row })
          ops.push(upsert('workout_sessions', stripNested(row)))
          sessionCount += 1
          for (const block of doc.session_blocks ?? []) {
            ops.push(upsert('session_blocks', block))
          }
          for (const se of doc.session_exercises ?? []) {
            ops.push(upsert('session_exercises', stripSessionExercise(se)))
            for (const set of se.sets ?? []) ops.push(upsert('workout_sets', set))
          }
        }

        await commit(writes, ops)
        return {
          sessions: sessionCount,
          templates: file.templates.length,
          exercises: file.exercises.filter((e) => e.owner_id !== null).length,
          checkins: file.checkins.length,
        }
      },

      async exportRoutines(templateIds) {
        const all = await readAll()
        const selected =
          templateIds && templateIds.length > 0
            ? all.templates.filter((row) => templateIds.includes(row.id))
            : all.templates
        if (selected.length === 0) throw new Error('No routines to export.')
        return serializeRoutines(selected, all.templateItems, all.exercises, all.templateBlocks)
      },

      async importRoutines(text) {
        const file = parseRoutines(text)
        if (file.routines.length === 0) throw new Error('No routines found in that file.')
        const all = await readAll()
        const plan = planRoutineImport({
          file,
          catalog: all.exercises,
          existingTemplates: all.templates,
          existingItems: all.templateItems,
          existingBlocks: all.templateBlocks,
          ownerId: userIdRef.current ?? '',
          now: nowIso(),
          newId,
        })
        const writes: { store: StoreName; row: object }[] = [
          ...plan.newExercises.map((row) => ({ store: 'exercises' as const, row })),
          ...plan.templates.map((row) => ({ store: 'templates' as const, row })),
          ...plan.blocks.map((row) => ({ store: 'templateBlocks' as const, row })),
          ...plan.items.map((row) => ({ store: 'templateItems' as const, row })),
        ]
        const ops: OutboxOp[] = [
          ...plan.newExercises.map((row) => upsert('exercises', row)),
          ...plan.templates.map((row) => upsert('workout_templates', row)),
          ...plan.blocks.map((row) => upsert('template_blocks', row)),
          ...plan.items.map((row) => upsert('template_items', row)),
        ]
        for (const id of plan.itemIdsToDelete) {
          await removeMatchingOps(
            (op) =>
              op.kind === 'upsert' && op.table === 'template_items' && String(op.row.id) === id,
          )
          await removeFrom('templateItems', id)
          ops.push({ kind: 'delete', table: 'template_items', id })
        }
        for (const id of plan.blockIdsToDelete) {
          await removeMatchingOps(
            (op) => op.kind === 'upsert' && op.table === 'template_blocks' && String(op.row.id) === id,
          )
          await removeFrom('templateBlocks', id)
          ops.push({ kind: 'delete', table: 'template_blocks', id })
        }
        await commit(writes, ops)
        return {
          created: plan.createdTemplates,
          updated: plan.updatedTemplates,
          items: plan.items.length,
          createdExercises: plan.newExercises.length,
        }
      },

      async importWorkoutsCsv(text) {
        const parsed = parseWorkoutCsv(text)
        if (parsed.length === 0) throw new Error('No workouts found in that file.')
        return (await actionsRef.current?.importWorkouts(parsed)) ?? {
          sessions: 0,
          sets: 0,
          createdExercises: 0,
        }
      },

      async importExternalCsv(text) {
        const parsed = parseExternalCsv(text)
        if (parsed.length === 0) throw new Error('No workouts found in that file.')
        return (await actionsRef.current?.importWorkouts(parsed)) ?? {
          sessions: 0,
          sets: 0,
          createdExercises: 0,
        }
      },

      async importWorkouts(parsed: ParsedWorkoutImport[]) {
        const catalog = [...(await readAll()).exercises]
        let createdExercises = 0
        let setCount = 0
        const uuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

        for (const incoming of parsed) {
          const existing = uuid.test(incoming.sessionId)
            ? await readOne<SessionDoc>('sessions', incoming.sessionId)
            : null
          if (existing) await actionsRef.current?.deleteSession(existing.id)

          const sessionId = uuid.test(incoming.sessionId) ? incoming.sessionId : newId()
          const stamp = nowIso()
          const started = `${incoming.date}T12:00:00.000Z`
          const exercises: (SessionExerciseRow & { sets: SetRow[] })[] = []

          for (const [index, item] of incoming.exercises.entries()) {
            let exercise = matchExercise(item.name, catalog)
            if (!exercise) {
              exercise = {
                id: newId(),
                owner_id: userIdRef.current,
                name: item.name,
                category:
                  item.measurement === 'weight_reps' ||
                  item.measurement === 'reps' ||
                  item.measurement === 'weight_duration' ||
                  item.measurement === 'weight_distance'
                    ? 'strength'
                    : 'cardio',
                measurement: item.measurement,
                muscle_groups: [],
                equipment: [],
                instructions: null,
                video_url: null,
                is_archived: false,
                created_at: stamp,
                updated_at: stamp,
              }
              catalog.push(exercise)
              await commit([{ store: 'exercises', row: exercise }], [upsert('exercises', exercise)])
              createdExercises += 1
            }

            const sessionExerciseId = newId()
            const sets: SetRow[] = item.sets.map((set) => ({
              id: newId(),
              session_exercise_id: sessionExerciseId,
              position: set.position,
              weight_kg: set.weight_kg,
              reps: set.reps,
              duration_s: set.duration_s,
              distance_m: set.distance_m,
              rpe: set.rpe,
              notes: set.notes,
              is_warmup: false,
              completed_at: set.completed_at,
              created_at: stamp,
              updated_at: stamp,
            }))
            setCount += sets.length
            exercises.push({
              id: sessionExerciseId,
              session_id: sessionId,
              exercise_id: exercise.id,
              name_snapshot: exercise.name,
              measurement_snapshot: exercise.measurement,
              position: index,
              planned_sets: Math.max(sets.length, 1),
              rest_seconds: null,
              tempo: null,
              notes: null,
              superset_group: null,
              block_role: 'gym',
              created_at: stamp,
              updated_at: stamp,
              sets,
            })
          }

          const status = incoming.status === 'in_progress' ? 'completed' : incoming.status
          const doc: SessionDoc = {
            id: sessionId,
            owner_id: userIdRef.current ?? '',
            template_id: null,
            schedule_item_id: null,
            name: incoming.name,
            status,
            planned_date: incoming.date,
            started_at: started,
            ended_at: stamp,
            notes: incoming.notes,
            rpe: incoming.rpe,
            created_at: stamp,
            updated_at: stamp,
            session_exercises: exercises,
          }
          const ops: OutboxOp[] = [upsert('workout_sessions', stripNested(doc))]
          for (const se of exercises) {
            ops.push(upsert('session_exercises', stripSessionExercise(se)))
            for (const set of se.sets) ops.push(upsert('workout_sets', set))
          }
          await commit([{ store: 'sessions', row: doc }], ops)
        }

        return { sessions: parsed.length, sets: setCount, createdExercises }
      },

      async addSessionExercise(sessionId, exerciseId) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        const exercise = await readOne<ExerciseRow>('exercises', exerciseId)
        if (!doc || !exercise) throw new Error('Session or exercise not found.')
        const maxPos = doc.session_exercises.reduce((m, se) => Math.max(m, se.position), -1)
        const se: SessionExerciseRow & { sets: SetRow[] } = {
          id: newId(),
          session_id: sessionId,
          exercise_id: exercise.id,
          name_snapshot: exercise.name,
          measurement_snapshot: exercise.measurement,
          position: maxPos + 1,
          planned_sets: 3,
          rest_seconds: null,
          tempo: null,
          notes: null,
          superset_group: null,
          block_role: 'gym',
          created_at: nowIso(),
          updated_at: nowIso(),
          sets: [],
        }
        const row: SessionDoc = {
          ...doc,
          session_exercises: [...doc.session_exercises, se],
          updated_at: nowIso(),
        }
        await commit(
          [{ store: 'sessions', row }],
          [upsert('session_exercises', stripSessionExercise(se))],
        )
      },

      async removeSessionExercise(sessionId, sessionExerciseId) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        if (!doc) throw new Error('Session not found.')
        const target = doc.session_exercises.find((se) => se.id === sessionExerciseId)
        if (!target) return
        const setIds = target.sets.map((s) => s.id)
        await removeMatchingOps((op) => {
          if (op.kind !== 'upsert') return false
          if (op.table === 'session_exercises' && String(op.row.id) === sessionExerciseId) return true
          if (op.table === 'workout_sets' && setIds.includes(String(op.row.id))) return true
          return false
        })
        const row: SessionDoc = {
          ...doc,
          session_exercises: doc.session_exercises.filter((se) => se.id !== sessionExerciseId),
          updated_at: nowIso(),
        }
        await commit([{ store: 'sessions', row }], [
          { kind: 'delete', table: 'session_exercises', id: sessionExerciseId },
        ])
      },

      async swapSessionExercise(sessionId, sessionExerciseId, exerciseId) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        const exercise = await readOne<ExerciseRow>('exercises', exerciseId)
        if (!doc || !exercise) throw new Error('Session or exercise not found.')
        const target = doc.session_exercises.find((se) => se.id === sessionExerciseId)
        if (!target) return

        const ops: OutboxOp[] = []
        const updated = {
          ...target,
          exercise_id: exercise.id,
          name_snapshot: exercise.name,
          measurement_snapshot: exercise.measurement,
          updated_at: nowIso(),
        }
        let nextExercises: (SessionExerciseRow & { sets: SetRow[] })[]

        if (target.measurement_snapshot === exercise.measurement) {
          nextExercises = doc.session_exercises.map((se) =>
            se.id === sessionExerciseId ? updated : se,
          )
        } else {
          // Measurement changed: old values would be meaningless — drop the sets.
          for (const set of target.sets) {
            await removeMatchingOps(
              (op) => op.kind === 'upsert' && op.table === 'workout_sets' && String(op.row.id) === set.id,
            )
            ops.push({ kind: 'delete', table: 'workout_sets', id: set.id })
          }
          nextExercises = doc.session_exercises.map((se) =>
            se.id === sessionExerciseId ? { ...updated, sets: [] } : se,
          )
        }
        const row: SessionDoc = { ...doc, session_exercises: nextExercises, updated_at: nowIso() }
        ops.push(upsert('session_exercises', stripSessionExercise(updated)))
        await commit([{ store: 'sessions', row }], ops)
      },

      async reorderSessionExercises(sessionId, orderedIds) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        if (!doc) throw new Error('Session not found.')
        const oldPositions = new Map(doc.session_exercises.map((se) => [se.id, se.position]))
        const byId = new Map(doc.session_exercises.map((se) => [se.id, se]))
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((se): se is SessionExerciseRow & { sets: SetRow[] } => Boolean(se))
          .map((se, index) =>
            oldPositions.get(se.id) === index ? se : { ...se, position: index, updated_at: nowIso() },
          )
        const changed = reordered.filter((se) => oldPositions.get(se.id) !== se.position)
        const row: SessionDoc = { ...doc, session_exercises: reordered, updated_at: nowIso() }
        const ops = changed.map((se) => upsert('session_exercises', stripSessionExercise(se)))
        await commit([{ store: 'sessions', row }], ops)
      },

      async upsertSet(sessionId, set) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        if (!doc) throw new Error('Session not found.')
        let found = false
        const nextExercises = doc.session_exercises.map((se) => {
          if (se.id !== set.session_exercise_id) return se
          found = true
          const exists = se.sets.some((s) => s.id === set.id)
          const sets = exists ? se.sets.map((s) => (s.id === set.id ? set : s)) : [...se.sets, set]
          return { ...se, sets: sets.sort((a, b) => a.position - b.position), updated_at: nowIso() }
        })
        if (!found) throw new Error('Session exercise not found.')
        const row: SessionDoc = { ...doc, session_exercises: nextExercises, updated_at: nowIso() }
        await commit([{ store: 'sessions', row }], [upsert('workout_sets', set)])
      },

      async deleteSet(sessionId, sessionExerciseId, setId) {
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        if (!doc) throw new Error('Session not found.')
        await removeMatchingOps(
          (op) => op.kind === 'upsert' && op.table === 'workout_sets' && String(op.row.id) === setId,
        )
        const nextExercises = doc.session_exercises.map((se) =>
          se.id === sessionExerciseId
            ? { ...se, sets: se.sets.filter((s) => s.id !== setId), updated_at: nowIso() }
            : se,
        )
        const row: SessionDoc = { ...doc, session_exercises: nextExercises, updated_at: nowIso() }
        await commit([{ store: 'sessions', row }], [
          { kind: 'delete', table: 'workout_sets', id: setId },
        ])
      },

      async addWarmupSets(sessionId, sessionExerciseId, planned) {
        if (planned.length === 0) return
        const doc = await readOne<SessionDoc>('sessions', sessionId)
        if (!doc) throw new Error('Session not found.')
        const target = doc.session_exercises.find((se) => se.id === sessionExerciseId)
        if (!target) throw new Error('Session exercise not found.')

        const stamp = nowIso()
        // Warm-ups take positions 1..n; existing sets shift behind them.
        const warmups: SetRow[] = planned.map((step, index) => ({
          id: newId(),
          session_exercise_id: sessionExerciseId,
          position: index + 1,
          weight_kg: step.weightKg,
          reps: step.reps,
          duration_s: null,
          distance_m: null,
          rpe: null,
          notes: null,
          is_warmup: true,
          completed_at: null,
          created_at: stamp,
          updated_at: stamp,
        }))
        const moved = target.sets.map((set) => ({
          ...set,
          position: set.position + warmups.length,
          updated_at: stamp,
        }))

        const ops: OutboxOp[] = [
          ...warmups.map((set) => upsert('workout_sets', set)),
          ...moved.map((set) => upsert('workout_sets', set)),
        ]
        const nextExercises = doc.session_exercises.map((se) =>
          se.id === sessionExerciseId
            ? {
                ...se,
                sets: [...warmups, ...moved].sort((a, b) => a.position - b.position),
                updated_at: stamp,
              }
            : se,
        )
        const row: SessionDoc = { ...doc, session_exercises: nextExercises, updated_at: stamp }
        await commit([{ store: 'sessions', row }], ops)
      },

      // ------------------------------------------------------------ profile

      async updateProfile(patch) {
        const existing = await readProfile()
        const base: ProfileRow = existing ?? {
          id: userIdRef.current ?? '',
          ...DEFAULT_PROFILE,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        const row: ProfileRow = { ...base, ...patch, updated_at: nowIso() }
        await putDirty('profiles', row)
        await appendOps([upsert('profiles', row)])
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      async logWeight(date, weightKg, notes = null) {
        const all = await readAll()
        const existing = all.bodyWeights.find((row) => row.recorded_on === date)
        const stamp = nowIso()
        const row: BodyWeightRow = existing
          ? { ...existing, weight_kg: weightKg, notes, updated_at: stamp }
          : {
              id: newId(),
              owner_id: userIdRef.current ?? '',
              recorded_on: date,
              weight_kg: weightKg,
              notes,
              created_at: stamp,
              updated_at: stamp,
            }
        await commit([{ store: 'bodyWeights', row }], [upsert('body_weight_entries', row)])
      },

      async deleteWeight(id) {
        await removeMatchingOps(
          (op) =>
            op.kind === 'upsert' &&
            op.table === 'body_weight_entries' &&
            String(op.row.id) === id,
        )
        await removeFrom('bodyWeights', id)
        await appendOps([{ kind: 'delete', table: 'body_weight_entries', id }])
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      async logCheckin(input) {
        const site = input.site.trim()
        if (site === '') throw new Error('Pick a body site for the check-in.')
        const all = await readAll()
        const existing = all.checkins.find(
          (row) => row.recorded_on === input.date && row.site.toLowerCase() === site.toLowerCase(),
        )
        const stamp = nowIso()
        const row: TendonCheckinRow = existing
          ? {
              ...existing,
              site,
              stiffness: input.stiffness,
              pain: input.pain,
              notes: input.notes ?? null,
              updated_at: stamp,
            }
          : {
              id: newId(),
              owner_id: userIdRef.current ?? '',
              recorded_on: input.date,
              site,
              stiffness: input.stiffness,
              pain: input.pain,
              notes: input.notes ?? null,
              created_at: stamp,
              updated_at: stamp,
            }
        await commit([{ store: 'checkins', row }], [upsert('tendon_checkins', row)])
      },

      async deleteCheckin(id) {
        await removeMatchingOps(
          (op) => op.kind === 'upsert' && op.table === 'tendon_checkins' && String(op.row.id) === id,
        )
        await removeFrom('checkins', id)
        await appendOps([{ kind: 'delete', table: 'tendon_checkins', id }])
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      async logAerobicActivity(input) {
        const stamp = nowIso()
        const row: AerobicActivityRow = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          recorded_on: input.date,
          activity_type: input.activityType,
          duration_s: Math.max(60, Math.round(input.durationS)),
          moderate: true,
          notes: input.notes ?? null,
          created_at: stamp,
          updated_at: stamp,
        }
        await commit([{ store: 'aerobicActivities', row }], [upsert('aerobic_activities', row)])
      },

      async deleteAerobicActivity(id) {
        await removeMatchingOps(
          (op) => op.kind === 'upsert' && op.table === 'aerobic_activities' && String(op.row.id) === id,
        )
        await removeFrom('aerobicActivities', id)
        await appendOps([{ kind: 'delete', table: 'aerobic_activities', id }])
        await reloadFromDb()
        scheduleDebouncedSync()
      },

      // ------------------------------------------------------------ auth-related

      async attemptSync() {
        if (!navigator.onLine) return false
        await performSync()
        return (await pendingCount()) === 0
      },

      async forceWipeAndSignOut() {
        await wipeLocalData()
        await signOut()
      },
    }
  }

  return (
    <StoreContext.Provider value={{ ...state, ...(actionsRef.current as StoreActions) }}>
      {children}
    </StoreContext.Provider>
  )
}

/** The outbox only stores flat rows; nested sets travel as their own ops. */
function stripNested(doc: SessionDoc): Record<string, unknown> {
  const { session_exercises: _nested, session_blocks: _blocks, ...flat } = doc
  return flat
}

function stripSessionExercise(row: SessionExerciseRow & { sets?: SetRow[] }): Record<string, unknown> {
  const { sets: _sets, ...flat } = row
  return flat
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
