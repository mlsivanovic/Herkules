// Sync transport: push the outbox (idempotent upserts/deletes in FK order),
// then pull the server snapshot and reconcile it into the local mirror.
// Triggered on app start, connectivity regain, focus and after a debounce.
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AerobicActivityRow,
  BodyMeasureRow,
  BodyWeightRow,
  ExerciseRow,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionCommentRow,
  SessionDoc,
  SessionExerciseDoc,
  SessionBlockRow,
  SetRow,
  TemplateItemRow,
  TemplateBlockRow,
  TemplateRow,
  TendonCheckinRow,
  TrainingPlanRow,
  PlanRoutineRow,
} from '../types/db'
import { listOps, removeOps } from './db'
import { planFlush } from './outbox'
import { sortByPosition } from './reorder'

export class SyncError extends Error {}

function isMissingRelation(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /session_comments|plan_routines|schema cache/i.test(error.message)
  )
}

function uniquePlanRoutineRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const best = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const key = `${String(row.plan_id)}:${String(row.template_id)}`
    best.set(key, row)
  }
  return [...best.values()]
}

/** Drop client-only / nested fields that PostgREST would reject. */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const {
    session_exercises: _se,
    session_blocks: _sb,
    sets: _sets,
    workout_sets: _ws,
    dirty: _dirty,
    ...rest
  } = row
  return rest
}

/** Push everything queued. Returns the number of flushed ops. */
export async function flushOutbox(client: SupabaseClient): Promise<number> {
  const ops = await listOps()
  if (ops.length === 0) return 0
  const batches = planFlush(ops)
  let removed = 0

  for (const batch of batches) {
    if (batch.kind === 'upsert' && batch.table === 'profiles') {
      // Profiles are created by the auth trigger. Upsert would need INSERT,
      // which is revoked — so we UPDATE the existing row.
      for (const raw of batch.rows) {
        const row = sanitizeRow(raw)
        const id = String(row.id ?? '')
        if (!id) throw new SyncError('Sync failed on profiles: missing id')
        const { error } = await client.from('profiles').update(row).eq('id', id)
        if (error) {
          throw new SyncError(`Sync failed on profiles: ${error.message}`)
        }
      }
    } else if (batch.kind === 'upsert') {
      const onConflict = batch.table === 'plan_routines' ? 'plan_id,template_id' : 'id'
      const rows = batch.rows.map(sanitizeRow)
      const payload = batch.table === 'plan_routines' ? uniquePlanRoutineRows(rows) : rows
      const { error } = await client.from(batch.table).upsert(
        payload,
        { onConflict },
      )
      if (error) {
        throw new SyncError(`Sync failed on ${batch.table}: ${error.message}`)
      }
    } else {
      const { error } = await client.from(batch.table).delete().in('id', batch.ids)
      if (error) {
        throw new SyncError(`Sync failed on ${batch.table}: ${error.message}`)
      }
    }
    // Drop each successful batch immediately so a later failure does not
    // leave already-pushed rows in the outbox (blue "Pending sync" forever
    // while the phone already shows the data).
    await removeOps(batch.seqs)
    removed += batch.seqs.length
  }

  return removed
}

export interface ServerSnapshot {
  profile: ProfileRow | null
  exercises: ExerciseRow[]
  plans: TrainingPlanRow[]
  templates: TemplateRow[]
  planRoutines: PlanRoutineRow[]
  templateItems: TemplateItemRow[]
  templateBlocks: TemplateBlockRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  bodyWeights: BodyWeightRow[]
  bodyMeasures: BodyMeasureRow[]
  checkins: TendonCheckinRow[]
  aerobicActivities: AerobicActivityRow[]
  sessionComments: SessionCommentRow[]
}

interface NestedSession
  extends Omit<SessionDoc, 'session_exercises' | 'session_blocks'> {
  session_blocks: SessionBlockRow[] | null
  session_exercises: (Omit<SessionExerciseDoc, 'sets'> & {
    workout_sets: SetRow[]
  })[] | null
}

function normalizeSession(row: NestedSession): SessionDoc {
  return {
    ...row,
    session_blocks: sortByPosition(row.session_blocks ?? []),
    session_exercises: sortByPosition(
      (row.session_exercises ?? []).map((se) => ({
        ...se,
        sets: sortByPosition(se.workout_sets ?? []),
      })),
    ),
  }
}

export async function fetchSnapshot(client: SupabaseClient): Promise<ServerSnapshot> {
  const { data: sessionData } = await client.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) throw new SyncError('Pull failed: not signed in')

  const owned = (column = 'owner_id') => column

  const [
    profileRes,
    exercisesRes,
    plansRes,
    templatesRes,
    rulesRes,
    schedulesRes,
    sessionsRes,
    weightsRes,
    measuresRes,
    checkinsRes,
    aerobicRes,
  ] = await Promise.all([
    client.from('profiles').select('*').eq('id', uid).maybeSingle(),
    client.from('exercises').select('*').or(`owner_id.is.null,owner_id.eq.${uid}`).order('name'),
    client.from('training_plans').select('*').eq(owned(), uid).order('created_at'),
    client.from('workout_templates').select('*').eq(owned(), uid).order('created_at'),
    client.from('recurrence_rules').select('*').eq(owned(), uid),
    client.from('schedule_items').select('*').eq(owned(), uid),
    client
      .from('workout_sessions')
      .select('*, session_blocks(*), session_exercises(*, workout_sets(*))')
      .eq(owned(), uid)
      .order('started_at', { ascending: false }),
    client.from('body_weight_entries').select('*').eq(owned(), uid).order('recorded_on', { ascending: false }),
    client.from('body_measure_entries').select('*').eq(owned(), uid).order('recorded_on', { ascending: false }),
    client
      .from('tendon_checkins')
      .select('*')
      .eq(owned(), uid)
      .order('recorded_on', { ascending: false })
      .order('site'),
    client.from('aerobic_activities').select('*').eq(owned(), uid).order('recorded_on', { ascending: false }),
  ])

  const templates = (templatesRes.data as TemplateRow[]) ?? []
  const templateIds = templates.map((row) => row.id)
  const sessions = (sessionsRes.data as NestedSession[] | null) ?? []
  const sessionIds = sessions.map((row) => row.id)

  const [blocksRes, itemsRes, commentsRes, planRoutinesRes] = await Promise.all([
    templateIds.length > 0
      ? client.from('template_blocks').select('*').in('template_id', templateIds)
      : Promise.resolve({ data: [], error: null }),
    templateIds.length > 0
      ? client.from('template_items').select('*').in('template_id', templateIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length > 0
      ? client.from('session_comments').select('*').in('session_id', sessionIds).order('created_at')
      : Promise.resolve({ data: [], error: null }),
    client.from('plan_routines').select('*').eq(owned(), uid).order('position'),
  ])

  const firstError =
    profileRes.error ??
    exercisesRes.error ??
    plansRes.error ??
    templatesRes.error ??
    rulesRes.error ??
    schedulesRes.error ??
    sessionsRes.error ??
    weightsRes.error ??
    measuresRes.error ??
    checkinsRes.error ??
    aerobicRes.error ??
    blocksRes.error ??
    itemsRes.error ??
    (isMissingRelation(commentsRes.error) ? null : commentsRes.error) ??
    (isMissingRelation(planRoutinesRes.error) ? null : planRoutinesRes.error)
  if (firstError) throw new SyncError(`Pull failed: ${firstError.message}`)

  return {
    profile: (profileRes.data as ProfileRow | null) ?? null,
    exercises: (exercisesRes.data as ExerciseRow[]) ?? [],
    plans: (plansRes.data as TrainingPlanRow[]) ?? [],
    templates,
    planRoutines: isMissingRelation(planRoutinesRes.error)
      ? []
      : ((planRoutinesRes.data as PlanRoutineRow[]) ?? []),
    templateBlocks: (blocksRes.data as TemplateBlockRow[]) ?? [],
    templateItems: (itemsRes.data as TemplateItemRow[]) ?? [],
    rules: (rulesRes.data as RecurrenceRuleRow[]) ?? [],
    schedules: (schedulesRes.data as ScheduleItemRow[]) ?? [],
    sessions: sessions.map(normalizeSession),
    bodyWeights: (weightsRes.data as BodyWeightRow[]) ?? [],
    bodyMeasures: (measuresRes.data as BodyMeasureRow[]) ?? [],
    checkins: (checkinsRes.data as TendonCheckinRow[]) ?? [],
    aerobicActivities: (aerobicRes.data as AerobicActivityRow[]) ?? [],
    sessionComments: (commentsRes.data as SessionCommentRow[]) ?? [],
  }
}
