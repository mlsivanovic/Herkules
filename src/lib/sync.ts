// Sync transport: push the outbox (idempotent upserts/deletes in FK order),
// then pull the server snapshot and reconcile it into the local mirror.
// Triggered on app start, connectivity regain, focus and after a debounce.
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AerobicActivityRow,
  BodyWeightRow,
  ExerciseRow,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionDoc,
  SessionExerciseDoc,
  SessionBlockRow,
  SetRow,
  TemplateItemRow,
  TemplateBlockRow,
  TemplateRow,
  TendonCheckinRow,
  TrainingPlanRow,
} from '../types/db'
import { listOps, removeOps } from './db'
import { planFlush } from './outbox'

export class SyncError extends Error {}

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
      const { error } = await client.from(batch.table).upsert(
        batch.rows.map(sanitizeRow),
        { onConflict: 'id' },
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
  templateItems: TemplateItemRow[]
  templateBlocks: TemplateBlockRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  bodyWeights: BodyWeightRow[]
  checkins: TendonCheckinRow[]
  aerobicActivities: AerobicActivityRow[]
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
    session_blocks: (row.session_blocks ?? []).sort((a, b) => a.position - b.position),
    session_exercises: (row.session_exercises ?? []).map((se) => ({
      ...se,
      sets: (se.workout_sets ?? []).sort((a, b) => a.position - b.position),
    })),
  }
}

export async function fetchSnapshot(client: SupabaseClient): Promise<ServerSnapshot> {
  const [
    profileRes,
    exercisesRes,
    plansRes,
    templatesRes,
    blocksRes,
    itemsRes,
    rulesRes,
    schedulesRes,
    sessionsRes,
    weightsRes,
    checkinsRes,
    aerobicRes,
  ] = await Promise.all([
    client.from('profiles').select('*').maybeSingle(),
    client.from('exercises').select('*').order('name'),
    client.from('training_plans').select('*').order('created_at'),
    client.from('workout_templates').select('*').order('created_at'),
    client.from('template_blocks').select('*'),
    client.from('template_items').select('*'),
    client.from('recurrence_rules').select('*'),
    client.from('schedule_items').select('*'),
    client
      .from('workout_sessions')
      .select('*, session_blocks(*), session_exercises(*, workout_sets(*))')
      .order('started_at', { ascending: false }),
    client.from('body_weight_entries').select('*').order('recorded_on', { ascending: false }),
    client
      .from('tendon_checkins')
      .select('*')
      .order('recorded_on', { ascending: false })
      .order('site'),
    client.from('aerobic_activities').select('*').order('recorded_on', { ascending: false }),
  ])

  const firstError =
    profileRes.error ??
    exercisesRes.error ??
    plansRes.error ??
    templatesRes.error ??
    blocksRes.error ??
    itemsRes.error ??
    rulesRes.error ??
    schedulesRes.error ??
    sessionsRes.error ??
    weightsRes.error ??
    checkinsRes.error ??
    aerobicRes.error
  if (firstError) throw new SyncError(`Pull failed: ${firstError.message}`)

  return {
    profile: (profileRes.data as ProfileRow | null) ?? null,
    exercises: exercisesRes.data as ExerciseRow[],
    plans: (plansRes.data as TrainingPlanRow[]) ?? [],
    templates: templatesRes.data as TemplateRow[],
    templateBlocks: (blocksRes.data as TemplateBlockRow[]) ?? [],
    templateItems: itemsRes.data as TemplateItemRow[],
    rules: rulesRes.data as RecurrenceRuleRow[],
    schedules: schedulesRes.data as ScheduleItemRow[],
    sessions: (sessionsRes.data as NestedSession[] | null)?.map(normalizeSession) ?? [],
    bodyWeights: (weightsRes.data as BodyWeightRow[]) ?? [],
    checkins: (checkinsRes.data as TendonCheckinRow[]) ?? [],
    aerobicActivities: (aerobicRes.data as AerobicActivityRow[]) ?? [],
  }
}
