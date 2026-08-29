// Online-only coach transport. Never writes the trainer's IndexedDB mirror.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AerobicActivityRow,
  BodyMeasureRow,
  BodyWeightRow,
  CoachInviteRow,
  CoachingRelationshipRow,
  ExerciseRow,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionCommentRow,
  SessionDoc,
  SessionBlockRow,
  SessionExerciseDoc,
  SetRow,
  TemplateBlockRow,
  TemplateItemRow,
  TemplateRow,
  TendonCheckinRow,
  TrainingPlanRow,
  PlanRoutineRow,
} from '../types/db'
import { copyPlanToClient, type AssignablePlan } from './coachAssign'
import { sortPlanTemplates } from './programs/plans'
import { hashInviteToken, newInviteToken } from './coachInvite'
import { applyPlanPushUpdate } from './planPushUpdate'
import { rotationOccurrences, type TrainingFrequency } from './programs/rotate'
import { sortByPosition } from './reorder'

export class CoachError extends Error {}

function throwIf(error: { message: string } | null, fallback: string): void {
  if (error) throw new CoachError(error.message || fallback)
}

export interface CoachRosterEntry {
  relationship: CoachingRelationshipRow
  profile: Pick<ProfileRow, 'id' | 'display_name' | 'account_kind' | 'height_cm' | 'sex' | 'birth_date'>
  lastSessionAt: string | null
  completedThisWeek: number
  plannedThisWeek: number
  lastWeightKg: number | null
  finishedSinceViewed: boolean
  invitePending: boolean
}

export interface PendingInvite {
  invite: CoachInviteRow
  joinPath: string | null
}

export interface CoachClientSnapshot {
  relationship: CoachingRelationshipRow
  profile: ProfileRow
  plans: TrainingPlanRow[]
  templates: TemplateRow[]
  templateBlocks: TemplateBlockRow[]
  templateItems: TemplateItemRow[]
  exercises: ExerciseRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  comments: SessionCommentRow[]
  bodyWeights: BodyWeightRow[]
  bodyMeasures: BodyMeasureRow[]
  checkins: TendonCheckinRow[]
  aerobicActivities: AerobicActivityRow[]
}

interface NestedSession {
  session_blocks: SessionBlockRow[] | null
  session_exercises: (Omit<SessionExerciseDoc, 'sets'> & { workout_sets: SetRow[] })[] | null
}

function normalizeSession(row: Omit<SessionDoc, 'session_exercises' | 'session_blocks'> & NestedSession): SessionDoc {
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

export async function peekCoachInvite(
  client: SupabaseClient,
  token: string,
): Promise<{
  valid: boolean
  email?: string
  display_name?: string
  trainer_name?: string
  expires_at?: string
}> {
  const { data, error } = await client.rpc('fn_peek_coach_invite', { p_token: token })
  throwIf(error, 'Could not read invite')
  if (!data || typeof data !== 'object') return { valid: false }
  return data as {
    valid: boolean
    email?: string
    display_name?: string
    trainer_name?: string
    expires_at?: string
  }
}

export async function acceptCoachInvite(
  client: SupabaseClient,
  token: string,
): Promise<{ relationship_id: string; account_kind: string }> {
  const { data, error } = await client.rpc('fn_accept_coach_invite', { p_token: token })
  throwIf(error, 'Could not accept invite')
  return data as { relationship_id: string; account_kind: string }
}

export async function claimPendingCoachInvite(
  client: SupabaseClient,
): Promise<{ claimed: boolean; relationship_id?: string; account_kind?: string }> {
  const { data, error } = await client.rpc('fn_claim_pending_coach_invite')
  throwIf(error, 'Could not accept invite')
  if (!data || typeof data !== 'object') return { claimed: false }
  return data as { claimed: boolean; relationship_id?: string; account_kind?: string }
}

export async function completePendingCoachInvites(
  client: SupabaseClient,
): Promise<{ completed: number }> {
  const { data, error } = await client.rpc('fn_complete_pending_coach_invites')
  throwIf(error, 'Could not load clients')
  const completed =
    data && typeof data === 'object' && 'completed' in data ? Number((data as { completed: unknown }).completed) : 0
  return { completed: Number.isFinite(completed) ? completed : 0 }
}

export async function createCoachInvite(
  client: SupabaseClient,
  trainerId: string,
  input: { email: string; displayName: string },
): Promise<{ invite: CoachInviteRow; token: string }> {
  const token = newInviteToken()
  const tokenHash = await hashInviteToken(token)
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('coach_invites')
    .insert({
      trainer_id: trainerId,
      email: input.email.trim().toLowerCase(),
      display_name: input.displayName.trim(),
      token_hash: tokenHash,
      account_kind: 'light',
      expires_at: expires,
    })
    .select()
    .single()
  throwIf(error, 'Could not create invite')
  return { invite: data as CoachInviteRow, token }
}

export async function listCoachInvites(client: SupabaseClient): Promise<CoachInviteRow[]> {
  const { data, error } = await client
    .from('coach_invites')
    .select('*')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
  throwIf(error, 'Could not load invites')
  return (data as CoachInviteRow[]) ?? []
}

export async function revokeCoachInvite(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('coach_invites').delete().eq('id', id)
  throwIf(error, 'Could not revoke invite')
}

export async function regenerateCoachInvite(
  client: SupabaseClient,
  inviteId: string,
): Promise<{ invite: CoachInviteRow; token: string }> {
  const token = newInviteToken()
  const tokenHash = await hashInviteToken(token)
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('coach_invites')
    .update({ token_hash: tokenHash, expires_at: expires })
    .eq('id', inviteId)
    .is('accepted_at', null)
    .select()
    .single()
  throwIf(error, 'Could not refresh the invite link')
  return { invite: data as CoachInviteRow, token }
}

export async function listRelationships(client: SupabaseClient): Promise<CoachingRelationshipRow[]> {
  const { data, error } = await client
    .from('coaching_relationships')
    .select('*')
    .eq('status', 'active')
    .order('accepted_at', { ascending: false })
  throwIf(error, 'Could not load clients')
  return (data as CoachingRelationshipRow[]) ?? []
}

export async function markRelationshipViewed(
  client: SupabaseClient,
  relationshipId: string,
): Promise<void> {
  const { error } = await client
    .from('coaching_relationships')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', relationshipId)
  throwIf(error, 'Could not update client')
}

export async function endRelationship(client: SupabaseClient, relationshipId: string): Promise<void> {
  const { error } = await client
    .from('coaching_relationships')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', relationshipId)
  throwIf(error, 'Could not end coaching')
}

export async function loadCoachRoster(
  client: SupabaseClient,
  trainerId: string,
): Promise<{ clients: CoachRosterEntry[]; invites: CoachInviteRow[] }> {
  const [relationships, invites] = await Promise.all([listRelationships(client), listCoachInvites(client)])
  const clientIds = relationships.map((row) => row.client_id)
  if (clientIds.length === 0) return { clients: [], invites }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekKey = weekAgo.toISOString().slice(0, 10)

  const [profilesRes, sessionsRes, weightsRes, schedulesRes] = await Promise.all([
    client
      .from('profiles')
      .select('id, display_name, account_kind, height_cm, sex, birth_date')
      .in('id', clientIds),
    client
      .from('workout_sessions')
      .select('id, owner_id, status, started_at, planned_date, ended_at')
      .in('owner_id', clientIds)
      .order('started_at', { ascending: false }),
    client
      .from('body_weight_entries')
      .select('owner_id, weight_kg, recorded_on')
      .in('owner_id', clientIds)
      .order('recorded_on', { ascending: false }),
    client.from('schedule_items').select('owner_id, scheduled_date').in('owner_id', clientIds),
  ])
  throwIf(profilesRes.error, 'Could not load clients')
  throwIf(sessionsRes.error, 'Could not load client sessions')
  throwIf(weightsRes.error, 'Could not load client weights')
  throwIf(schedulesRes.error, 'Could not load client schedules')

  const profiles = new Map(
    ((profilesRes.data ?? []) as CoachRosterEntry['profile'][]).map((row) => [row.id, row]),
  )
  const sessions = (sessionsRes.data ?? []) as {
    id: string
    owner_id: string
    status: string
    started_at: string
    planned_date: string | null
    ended_at: string | null
  }[]
  const weights = (weightsRes.data ?? []) as { owner_id: string; weight_kg: number; recorded_on: string }[]
  const schedules = (schedulesRes.data ?? []) as { owner_id: string; scheduled_date: string | null }[]

  const clients: CoachRosterEntry[] = relationships.map((relationship) => {
    const profile = profiles.get(relationship.client_id)
    const theirs = sessions.filter((row) => row.owner_id === relationship.client_id)
    const last = theirs[0] ?? null
    const completedThisWeek = theirs.filter((row) => {
      if (row.status !== 'completed') return false
      const key = row.planned_date ?? row.started_at.slice(0, 10)
      return key >= weekKey
    }).length
    const plannedThisWeek = schedules.filter(
      (row) => row.owner_id === relationship.client_id && row.scheduled_date && row.scheduled_date >= weekKey,
    ).length
    const lastWeight = weights.find((row) => row.owner_id === relationship.client_id) ?? null
    const lastCompleted = theirs.find((row) => row.status === 'completed')
    const finishedSinceViewed = Boolean(
      lastCompleted &&
        (!relationship.last_viewed_at ||
          (lastCompleted.ended_at ?? lastCompleted.started_at) > relationship.last_viewed_at),
    )
    return {
      relationship,
      profile: profile ?? {
        id: relationship.client_id,
        display_name: '',
        account_kind: 'full',
        height_cm: null,
        sex: null,
        birth_date: null,
      },
      lastSessionAt: last?.started_at ?? null,
      completedThisWeek,
      plannedThisWeek,
      lastWeightKg: lastWeight?.weight_kg ?? null,
      finishedSinceViewed,
      invitePending: false,
    }
  })

  void trainerId
  return { clients, invites }
}

export async function loadCoachClient(
  client: SupabaseClient,
  clientId: string,
): Promise<CoachClientSnapshot> {
  const { data: relationship, error: relError } = await client
    .from('coaching_relationships')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()
  throwIf(relError, 'Could not load client')
  if (!relationship) throw new CoachError('Client not found')

  const [
    profileRes,
    plansRes,
    templatesRes,
    sessionsRes,
    weightsRes,
    measuresRes,
    checkinsRes,
    aerobicRes,
    rulesRes,
    schedulesRes,
    exercisesRes,
  ] = await Promise.all([
    client.from('profiles').select('*').eq('id', clientId).maybeSingle(),
    client.from('training_plans').select('*').eq('owner_id', clientId).order('created_at'),
    client.from('workout_templates').select('*').eq('owner_id', clientId).order('created_at'),
    client
      .from('workout_sessions')
      .select('*, session_blocks(*), session_exercises(*, workout_sets(*))')
      .eq('owner_id', clientId)
      .order('started_at', { ascending: false }),
    client.from('body_weight_entries').select('*').eq('owner_id', clientId).order('recorded_on', { ascending: false }),
    client.from('body_measure_entries').select('*').eq('owner_id', clientId).order('recorded_on', { ascending: false }),
    client.from('tendon_checkins').select('*').eq('owner_id', clientId).order('recorded_on', { ascending: false }),
    client.from('aerobic_activities').select('*').eq('owner_id', clientId).order('recorded_on', { ascending: false }),
    client.from('recurrence_rules').select('*').eq('owner_id', clientId),
    client.from('schedule_items').select('*').eq('owner_id', clientId),
    client.from('exercises').select('*').or(`owner_id.eq.${clientId},owner_id.is.null`).order('name'),
  ])

  const firstError =
    profileRes.error ??
    plansRes.error ??
    templatesRes.error ??
    sessionsRes.error ??
    weightsRes.error ??
    measuresRes.error ??
    checkinsRes.error ??
    aerobicRes.error ??
    rulesRes.error ??
    schedulesRes.error ??
    exercisesRes.error
  throwIf(firstError, 'Could not load client')
  if (!profileRes.data) throw new CoachError('Client profile not found')

  const templates = (templatesRes.data as TemplateRow[]) ?? []
  const templateIds = templates.map((row) => row.id)
  const sessions = ((sessionsRes.data as (SessionDoc & NestedSession)[]) ?? []).map(normalizeSession)
  const sessionIds = sessions.map((row) => row.id)

  const [blocksRes, itemsRes, commentsRes] = await Promise.all([
    templateIds.length
      ? client.from('template_blocks').select('*').in('template_id', templateIds)
      : Promise.resolve({ data: [], error: null }),
    templateIds.length
      ? client.from('template_items').select('*').in('template_id', templateIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? client.from('session_comments').select('*').in('session_id', sessionIds).order('created_at')
      : Promise.resolve({ data: [], error: null }),
  ])
  throwIf(blocksRes.error, 'Could not load client routines')
  throwIf(itemsRes.error, 'Could not load client routines')
  throwIf(commentsRes.error, 'Could not load comments')

  return {
    relationship: relationship as CoachingRelationshipRow,
    profile: profileRes.data as ProfileRow,
    plans: (plansRes.data as TrainingPlanRow[]) ?? [],
    templates,
    templateBlocks: (blocksRes.data as TemplateBlockRow[]) ?? [],
    templateItems: (itemsRes.data as TemplateItemRow[]) ?? [],
    exercises: (exercisesRes.data as ExerciseRow[]) ?? [],
    rules: (rulesRes.data as RecurrenceRuleRow[]) ?? [],
    schedules: (schedulesRes.data as ScheduleItemRow[]) ?? [],
    sessions,
    comments: (commentsRes.data as SessionCommentRow[]) ?? [],
    bodyWeights: (weightsRes.data as BodyWeightRow[]) ?? [],
    bodyMeasures: (measuresRes.data as BodyMeasureRow[]) ?? [],
    checkins: (checkinsRes.data as TendonCheckinRow[]) ?? [],
    aerobicActivities: (aerobicRes.data as AerobicActivityRow[]) ?? [],
  }
}

async function insertAssignCopy(client: SupabaseClient, copy: ReturnType<typeof copyPlanToClient>): Promise<void> {
  if (copy.exercises.length) {
    const { error } = await client.from('exercises').insert(copy.exercises)
    throwIf(error, 'Could not copy exercises')
  }
  {
    const { error } = await client.from('training_plans').insert(copy.plan)
    throwIf(error, 'Could not copy plan')
  }
  if (copy.templates.length) {
    const { error } = await client.from('workout_templates').insert(copy.templates)
    throwIf(error, 'Could not copy routines')
  }
  if (copy.blocks.length) {
    const { error } = await client.from('template_blocks').insert(copy.blocks)
    throwIf(error, 'Could not copy routine blocks')
  }
  if (copy.items.length) {
    const { error } = await client.from('template_items').insert(copy.items)
    throwIf(error, 'Could not copy routine items')
  }
}

export async function assignPlanToClient(
  client: SupabaseClient,
  input: {
    trainerId: string
    clientId: string
    source: AssignablePlan
    now: string
    newId: () => string
    schedule?: { frequency: TrainingFrequency; weekdays: number[]; startDate: string; weeks: number }
    existing: {
      plans: TrainingPlanRow[]
      templates: TemplateRow[]
      schedules: ScheduleItemRow[]
      rules: RecurrenceRuleRow[]
    }
  },
): Promise<void> {
  const copy = copyPlanToClient({
    source: input.source,
    trainerId: input.trainerId,
    clientId: input.clientId,
    now: input.now,
    newId: input.newId,
  })

  const previousPlans = input.existing.plans.filter(
    (row) => row.locked && row.assigned_by === input.trainerId,
  )
  const previousPlanIds = new Set(previousPlans.map((row) => row.id))
  const previousTemplates = input.existing.templates.filter(
    (row) => row.locked && row.assigned_by === input.trainerId,
  )
  const previousTemplateIds = previousTemplates.map((row) => row.id)
  const previousSchedules = input.existing.schedules.filter(
    (row) =>
      row.assigned_by === input.trainerId ||
      (row.plan_id && previousPlanIds.has(row.plan_id)) ||
      (row.template_id && previousTemplateIds.includes(row.template_id)),
  )

  await insertAssignCopy(client, copy)

  if (previousSchedules.length) {
    const ruleIds = previousSchedules
      .map((row) => row.recurrence_rule_id)
      .filter((id): id is string => Boolean(id))
    const { error } = await client.from('schedule_items').delete().in(
      'id',
      previousSchedules.map((row) => row.id),
    )
    throwIf(error, 'Could not replace schedule')
    if (ruleIds.length) {
      const { error: ruleError } = await client.from('recurrence_rules').delete().in('id', ruleIds)
      throwIf(ruleError, 'Could not replace schedule')
    }
  }
  if (previousTemplates.length) {
    const { error } = await client.from('workout_templates').delete().in('id', previousTemplateIds)
    throwIf(error, 'Could not replace previous assignment')
  }
  if (previousPlans.length) {
    const { error } = await client.from('training_plans').delete().in(
      'id',
      previousPlans.map((row) => row.id),
    )
    throwIf(error, 'Could not replace previous assignment')
  }

  if (input.schedule && copy.templates.length) {
    const days = [...copy.templates].sort((a, b) => a.plan_position - b.plan_position)
    const occurrences = rotationOccurrences({
      frequency: input.schedule.frequency,
      weekdays: input.schedule.weekdays,
      start: input.schedule.startDate,
      weeks: input.schedule.weeks,
      dayCount: days.length,
    })
    const rows: ScheduleItemRow[] = occurrences.map((occurrence) => ({
      id: input.newId(),
      owner_id: input.clientId,
      template_id: days[occurrence.dayIndex % days.length]?.id ?? null,
      plan_id: null,
      scheduled_date: occurrence.date,
      recurrence_rule_id: null,
      assigned_by: input.trainerId,
      created_at: input.now,
      updated_at: input.now,
    }))
    if (rows.length) {
      const { error } = await client.from('schedule_items').insert(rows)
      throwIf(error, 'Could not schedule assigned plan')
    }
  }
}

export async function pushPlanToClient(
  client: SupabaseClient,
  input: {
    trainerId: string
    clientId: string
    master: AssignablePlan
    copy: AssignablePlan
    now: string
    newId: () => string
    inProgressTemplateIds: string[]
  },
): Promise<{ kind: 'updated' } | { kind: 'replace' }> {
  const result = applyPlanPushUpdate({
    master: input.master,
    copy: input.copy,
    trainerId: input.trainerId,
    clientId: input.clientId,
    now: input.now,
    newId: input.newId,
    inProgressTemplateIds: input.inProgressTemplateIds,
  })
  if (result.kind === 'replace') return result

  const next = result.copy
  const previousBlockIds = input.copy.blocks.map((row) => row.id)
  const previousItemIds = input.copy.items.map((row) => row.id)
  const keepTemplateIds = new Set(next.templates.map((row) => row.id))
  const removedTemplates = input.copy.templates.filter((row) => !keepTemplateIds.has(row.id))

  if (next.exercises.length) {
    const { error } = await client.from('exercises').upsert(next.exercises, { onConflict: 'id' })
    throwIf(error, 'Could not update exercises')
  }
  {
    const { error } = await client.from('training_plans').upsert(next.plan, { onConflict: 'id' })
    throwIf(error, 'Could not update plan')
  }
  if (next.templates.length) {
    const { error } = await client.from('workout_templates').upsert(next.templates, { onConflict: 'id' })
    throwIf(error, 'Could not update routines')
  }
  if (previousItemIds.length) {
    const { error } = await client.from('template_items').delete().in('id', previousItemIds)
    throwIf(error, 'Could not update routine items')
  }
  if (previousBlockIds.length) {
    const { error } = await client.from('template_blocks').delete().in('id', previousBlockIds)
    throwIf(error, 'Could not update routine blocks')
  }
  if (next.blocks.length) {
    const { error } = await client.from('template_blocks').insert(next.blocks)
    throwIf(error, 'Could not update routine blocks')
  }
  if (next.items.length) {
    const { error } = await client.from('template_items').insert(next.items)
    throwIf(error, 'Could not update routine items')
  }
  if (removedTemplates.length) {
    const { error } = await client.from('workout_templates').delete().in(
      'id',
      removedTemplates.map((row) => row.id),
    )
    throwIf(error, 'Could not remove old routines')
  }
  return { kind: 'updated' }
}

export async function addSessionComment(
  client: SupabaseClient,
  input: { sessionId: string; authorId: string; body: string; now: string; newId: () => string },
): Promise<SessionCommentRow> {
  const row: SessionCommentRow = {
    id: input.newId(),
    session_id: input.sessionId,
    author_id: input.authorId,
    body: input.body.trim(),
    created_at: input.now,
    updated_at: input.now,
  }
  const { error } = await client.from('session_comments').insert(row)
  throwIf(error, 'Could not save comment')
  return row
}

export function collectAssignablePlan(
  planId: string,
  data: {
    plans: TrainingPlanRow[]
    templates: TemplateRow[]
    templateBlocks: TemplateBlockRow[]
    templateItems: TemplateItemRow[]
    exercises: ExerciseRow[]
    planRoutines?: PlanRoutineRow[]
  },
): AssignablePlan | null {
  const plan = data.plans.find((row) => row.id === planId)
  if (!plan) return null
  const templates = sortPlanTemplates(data.templates, planId, data.planRoutines)
  const templateIds = new Set(templates.map((row) => row.id))
  const blocks = data.templateBlocks.filter((row) => templateIds.has(row.template_id))
  const items = data.templateItems.filter((row) => templateIds.has(row.template_id))
  const exerciseIds = new Set(items.map((row) => row.exercise_id))
  const exercises = data.exercises.filter((row) => exerciseIds.has(row.id))
  return { plan, templates, blocks, items, exercises }
}
