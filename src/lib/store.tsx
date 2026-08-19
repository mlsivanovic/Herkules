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
  ExerciseRow,
  OutboxOp,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionDoc,
  SessionExerciseRow,
  SetRow,
  Sex,
  SyncTable,
  TemplateItemRow,
  TemplateRow,
  BodyWeightRow,
  TendonCheckinRow,
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
import { HYBRID_TEMPLATES, hybridRolePatches, hybridTemplatesFrom } from './programs/hybrid4day'
import { normalizeBlockRole } from './blockRole'
import {
  rotationOccurrences,
  type TrainingFrequency,
} from './programs/rotate'

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
  templates: TemplateRow[]
  templateItems: TemplateItemRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  bodyWeights: BodyWeightRow[]
  checkins: TendonCheckinRow[]
}

export interface StoreActions {
  syncNow(): Promise<void>
  refreshIfOnline(): void

  // exercises
  createExercise(input: ExerciseInput): Promise<ExerciseRow>
  updateExercise(id: string, patch: Partial<ExerciseInput> & { is_archived?: boolean }): Promise<void>

  // templates
  createTemplate(name: string, notes: string | null): Promise<TemplateRow>
  updateTemplate(id: string, patch: { name?: string; notes?: string | null }): Promise<void>
  deleteTemplate(id: string): Promise<void>
  saveTemplateItems(templateId: string, items: TemplateItemInput[]): Promise<void>
  installHybridProgram(): Promise<{ created: boolean }>
  ensureHybridBlockRoles(): Promise<void>

  // scheduling
  scheduleSingleDate(templateId: string, date: string): Promise<void>
  scheduleHybridRotation(input: {
    frequency: TrainingFrequency
    weekdays: number[]
    startDate: string
    weeks: number
  }): Promise<number>
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
    templates: [] as TemplateRow[],
    templateItems: [] as TemplateItemRow[],
    rules: [] as RecurrenceRuleRow[],
    schedules: [] as ScheduleItemRow[],
    sessions: [] as SessionDoc[],
    bodyWeights: [] as BodyWeightRow[],
    checkins: [] as TendonCheckinRow[],
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
        reconcileStore('templates', snapshot.templates),
        reconcileStore('templateItems', snapshot.templateItems),
        reconcileStore('rules', snapshot.rules),
        reconcileStore('schedules', snapshot.schedules),
        reconcileStore('sessions', snapshot.sessions),
        reconcileStore('bodyWeights', snapshot.bodyWeights),
        reconcileStore('checkins', snapshot.checkins),
      ])
      await reloadFromDb()
      await actionsRef.current?.ensureHybridBlockRoles()
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
        templates: [],
        templateItems: [],
        rules: [],
        schedules: [],
        sessions: [],
        bodyWeights: [],
        checkins: [],
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
      await actionsRef.current?.ensureHybridBlockRoles()
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

      // ------------------------------------------------------------ templates

      async createTemplate(name, notes) {
        const row: TemplateRow = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          name,
          notes,
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
        const items = (await readAll()).templateItems.filter((i) => i.template_id === id)
        const itemIds = new Set(items.map((i) => i.id))
        await removeMatchingOps(
          (op) =>
            op.kind === 'upsert' && op.table === 'template_items' && itemIds.has(String(op.row.id)),
        )
        for (const itemId of itemIds) await removeFrom('templateItems', itemId)
        await removeFrom('templates', id)
        await appendOps([{ kind: 'delete', table: 'workout_templates', id }])
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
        if (hybridTemplatesFrom(all.templates)) return { created: false }

        const owner = userIdRef.current ?? ''
        const stamp = nowIso()
        const writes: { store: StoreName; row: object }[] = []
        const ops: OutboxOp[] = []

        for (const definition of HYBRID_TEMPLATES) {
          const templateId = newId()
          const template: TemplateRow = {
            id: templateId,
            owner_id: owner,
            name: definition.name,
            notes: definition.notes,
            created_at: stamp,
            updated_at: stamp,
          }
          writes.push({ store: 'templates', row: template })
          ops.push(upsert('workout_templates', template))

          const groups = new Map<string, string>()
          definition.items.forEach((item, index) => {
            let group: string | null = null
            if (item.circuit) {
              const existing = groups.get(item.circuit)
              if (existing) {
                group = existing
              } else {
                group = newId()
                groups.set(item.circuit, group)
              }
            }
            const row: TemplateItemRow = {
              id: newId(),
              template_id: templateId,
              exercise_id: item.exerciseId,
              position: index,
              planned_sets: item.plannedSets,
              target_weight_kg: null,
              target_reps: item.targetReps ?? null,
              target_duration_s: item.targetDurationS ?? null,
            target_distance_m: item.targetDistanceM ?? null,
            rest_seconds: item.restSeconds ?? null,
            tempo: null,
            notes: item.notes ?? null,
              superset_group: group,
              block_role: item.blockRole ?? 'gym',
              created_at: stamp,
              updated_at: stamp,
            }
            writes.push({ store: 'templateItems', row })
            ops.push(upsert('template_items', row))
          })
        }

        await commit(writes, ops)
        await setMeta('hybridBlockRolesApplied', true)
        return { created: true }
      },

      async ensureHybridBlockRoles() {
        if ((await getMeta<boolean>('hybridBlockRolesApplied')) === true) return
        const all = await readAll()
        if (!hybridTemplatesFrom(all.templates)) return
        const patches = hybridRolePatches(all.templates, all.templateItems)
        if (patches.length > 0) {
          const stamp = nowIso()
          const writes: { store: StoreName; row: object }[] = []
          const ops: OutboxOp[] = []
          for (const patch of patches) {
            const existing = all.templateItems.find((item) => item.id === patch.id)
            if (!existing) continue
            const row: TemplateItemRow = {
              ...existing,
              block_role: patch.block_role,
              updated_at: stamp,
            }
            writes.push({ store: 'templateItems', row })
            ops.push(upsert('template_items', row))
          }
          if (writes.length > 0) await commit(writes, ops)
        }
        await setMeta('hybridBlockRolesApplied', true)
      },

      // ------------------------------------------------------------ scheduling

      async scheduleSingleDate(templateId, date) {
        const row: ScheduleItemRow = {
          id: newId(),
          owner_id: userIdRef.current ?? '',
          template_id: templateId,
          scheduled_date: date,
          recurrence_rule_id: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        await commit([{ store: 'schedules', row }], [upsert('schedule_items', row)])
      },

      async scheduleHybridRotation(input) {
        const all = await readAll()
        const installed = hybridTemplatesFrom(all.templates)
        if (!installed) throw new Error('Add the Hybrid 4-day program first.')

        const occurrences = rotationOccurrences({
          frequency: input.frequency,
          weekdays: input.weekdays,
          start: input.startDate,
          weeks: input.weeks,
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
            template_id: installed[occurrence.slot].id,
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
        const template = input.templateId
          ? all.templates.find((t) => t.id === input.templateId)
          : undefined
        const items = template
          ? all.templateItems
              .filter((i) => i.template_id === template.id)
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
        const exercises: (SessionExerciseRow & { sets: SetRow[] })[] = items.map((item) => {
          const exercise = all.exercises.find((e) => e.id === item.exercise_id)
          return {
            id: newId(),
            session_id: sessionId,
            exercise_id: item.exercise_id,
            name_snapshot: exercise?.name ?? 'Exercise',
            measurement_snapshot: exercise?.measurement ?? 'weight_reps',
            position: item.position,
            planned_sets: item.planned_sets,
            rest_seconds: item.rest_seconds,
            tempo: item.tempo ?? null,
            notes: item.notes,
            superset_group: item.superset_group,
            block_role: normalizeBlockRole(item.block_role),
            created_at: nowIso(),
            updated_at: nowIso(),
            sets: [],
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
          created_at: nowIso(),
          updated_at: nowIso(),
          session_exercises: exercises,
        }

        const ops: OutboxOp[] = [upsert('workout_sessions', stripNested(doc))]
        for (const se of exercises) {
          ops.push(upsert('session_exercises', stripSessionExercise(se)))
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
          ? all.templates.find((t) => t.id === schedule.template_id)
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
          created_at: stamp,
          updated_at: stamp,
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
          templates: all.templates,
          templateItems: all.templateItems,
          rules: all.rules,
          schedules: all.schedules,
          sessions: all.sessions,
          checkins: all.checkins,
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

        // System exercises (owner_id null) are skipped — they already exist.
        for (const row of file.exercises) {
          if (row.owner_id === null) continue
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'exercises', row: next })
          ops.push(upsert('exercises', next))
        }

        for (const row of file.templates) {
          const next = { ...row, owner_id: owner, updated_at: stamp }
          writes.push({ store: 'templates', row: next })
          ops.push(upsert('workout_templates', next))
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
                  item.measurement === 'weight_duration'
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
  const { session_exercises: _nested, ...flat } = doc
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
