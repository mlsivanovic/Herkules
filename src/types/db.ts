// Row types mirroring supabase/migrations — kept in sync manually.
// Canonical units: weight kg, distance m, duration s.

export type ExerciseCategory = 'strength' | 'cardio' | 'mobility'
export type ExerciseMeasurement =
  | 'weight_reps'
  | 'reps'
  | 'duration'
  | 'distance_duration'
  | 'weight_duration'
  | 'weight_distance'
export type ExerciseBlockRole = 'gym' | 'cardio' | 'tendon'
export type WorkoutBlockRole =
  | 'warmup'
  | 'strength'
  | 'assistance'
  | 'power'
  | 'carry'
  | 'core'
  | 'conditioning'
  | 'zone_2'
  | 'tendon'
export type WorkoutBlockFormat = 'straight' | 'superset' | 'circuit' | 'interval'
export type SideMode = 'bilateral' | 'per_side' | 'per_leg'
export type TempoIntent = 'controlled' | 'explosive'
export type UnitSystem = 'metric' | 'imperial'
export type WeekStart = 'monday' | 'sunday'
export type SessionStatus = 'in_progress' | 'completed' | 'skipped'
export type Sex = 'male' | 'female' | 'other'
export type AccountKind = 'full' | 'light'
export type CoachingStatus = 'pending' | 'active' | 'ended'

export interface ProfileRow {
  id: string
  display_name: string
  unit_system: UnitSystem
  week_start: WeekStart
  default_rest_seconds: number
  height_cm: number | null
  sex: Sex | null
  birth_date: string | null
  account_kind: AccountKind
  is_coach: boolean
  /** Weekly moderate aerobic minutes. Coaches may assign this for a client. */
  aerobic_goal_minutes: number
  created_at: string
  updated_at: string
}

export interface BodyWeightRow {
  id: string
  owner_id: string
  recorded_on: string
  weight_kg: number
  notes: string | null
  created_at: string
  updated_at: string
}

/** Daily tape measurements (canonical cm). Computed BF% is derived, not stored. */
export interface BodyMeasureRow {
  id: string
  owner_id: string
  recorded_on: string
  neck_cm: number | null
  waist_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  calf_cm: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Daily tendon check-in per body site: morning stiffness / pain, 0–10. */
export interface TendonCheckinRow {
  id: string
  owner_id: string
  recorded_on: string
  site: string
  stiffness: number
  pain: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ExerciseRow {
  id: string
  /** null = system exercise (read-only) */
  owner_id: string | null
  name: string
  category: ExerciseCategory
  measurement: ExerciseMeasurement
  muscle_groups: string[]
  equipment: string[]
  instructions: string | null
  video_url: string | null
  source_title?: string | null
  source_provider?: string | null
  source_url?: string | null
  source_verified_at?: string | null
  assigned_by?: string | null
  source_exercise_id?: string | null
  locked?: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface TrainingPlanRow {
  id: string
  owner_id: string
  name: string
  notes: string | null
  source_key?: string | null
  source_version?: number
  assigned_by?: string | null
  source_plan_id?: string | null
  locked?: boolean
  created_at: string
  updated_at: string
}

export interface TemplateRow {
  id: string
  owner_id: string
  name: string
  notes: string | null
  /** Exclusive membership for starter days; pool routines keep this null. */
  plan_id: string | null
  plan_position: number
  source_slot?: 'A' | 'B' | 'C' | 'D' | null
  assigned_by?: string | null
  source_template_id?: string | null
  locked?: boolean
  created_at: string
  updated_at: string
}

/** Ordered plan ↔ routine membership. Pool routines may appear on many plans. */
export interface PlanRoutineRow {
  id: string
  owner_id: string
  plan_id: string
  template_id: string
  position: number
  created_at: string
  updated_at: string
}

export interface TemplateItemRow {
  id: string
  template_id: string
  exercise_id: string
  position: number
  planned_sets: number
  target_weight_kg: number | null
  target_reps: number | null
  target_duration_s: number | null
  target_distance_m: number | null
  rest_seconds: number | null
  /** tempo prescription, e.g. "3-0-1" */
  tempo: string | null
  notes: string | null
  superset_group: string | null
  block_role: ExerciseBlockRole
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
  side_mode?: SideMode
  directions?: number
  load_increment_kg?: number | null
  tempo_eccentric?: number | null
  tempo_stretch_pause?: number | null
  tempo_concentric?: number | null
  tempo_contracted_pause?: number | null
  tempo_intent?: TempoIntent
  /** Whole-exercise warm-up slot. Sets materialize with is_warmup. */
  is_warmup?: boolean
  created_at: string
  updated_at: string
}

export interface TemplateBlockRow {
  id: string
  template_id: string
  position: number
  role: WorkoutBlockRole
  format: WorkoutBlockFormat
  rounds_initial: number
  rounds_max: number
  rest_after_round_s: number | null
  notes: string | null
  interval_prepare_s: number | null
  interval_work_s: number | null
  interval_recovery_s: number | null
  interval_rounds: number | null
  target_rpe_min: number | null
  target_rpe_max: number | null
  created_at: string
  updated_at: string
}

/** weekdays use ISO numbers: 1 = Monday … 7 = Sunday */
export interface RecurrenceRuleRow {
  id: string
  owner_id: string
  frequency: 'weekly'
  weekdays: number[]
  start_date: string
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleItemRow {
  id: string
  owner_id: string
  template_id: string | null
  plan_id?: string | null
  scheduled_date: string | null
  recurrence_rule_id: string | null
  assigned_by?: string | null
  created_at: string
  updated_at: string
}

export interface CoachingRelationshipRow {
  id: string
  trainer_id: string
  client_id: string
  status: CoachingStatus
  created_at: string
  accepted_at: string | null
  ended_at: string | null
  last_viewed_at: string | null
}

export interface CoachInviteRow {
  id: string
  trainer_id: string
  email: string
  display_name: string
  token_hash: string
  account_kind: AccountKind
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
  relationship_id: string | null
  created_at: string
}

export interface SessionCommentRow {
  id: string
  session_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
}

export interface SessionRow {
  id: string
  owner_id: string
  template_id: string | null
  schedule_item_id: string | null
  name: string
  status: SessionStatus
  planned_date: string | null
  started_at: string
  ended_at: string | null
  notes: string | null
  rpe: number | null
  plan_id?: string | null
  cycle_week?: number | null
  is_deload?: boolean
  created_at: string
  updated_at: string
}

export interface SessionExerciseRow {
  id: string
  session_id: string
  exercise_id: string | null
  name_snapshot: string
  measurement_snapshot: ExerciseMeasurement
  position: number
  planned_sets: number
  rest_seconds: number | null
  tempo: string | null
  notes: string | null
  superset_group: string | null
  block_role: ExerciseBlockRole
  template_item_id?: string | null
  session_block_id?: string | null
  block_position?: number
  target_weight_kg?: number | null
  target_reps?: number | null
  target_duration_s?: number | null
  target_distance_m?: number | null
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
  side_mode?: SideMode
  directions?: number
  load_increment_kg?: number | null
  tempo_eccentric?: number | null
  tempo_stretch_pause?: number | null
  tempo_concentric?: number | null
  tempo_contracted_pause?: number | null
  tempo_intent?: TempoIntent
  /** Copied from the routine slot; new sets on this exercise stay warm-up. */
  is_warmup?: boolean
  created_at: string
  updated_at: string
}

export interface SessionBlockRow {
  id: string
  session_id: string
  template_block_id: string | null
  position: number
  role: WorkoutBlockRole
  format: WorkoutBlockFormat
  rounds_initial: number
  rounds_max: number
  rest_after_round_s: number | null
  notes: string | null
  interval_prepare_s: number | null
  interval_work_s: number | null
  interval_recovery_s: number | null
  interval_rounds: number | null
  target_rpe_min: number | null
  target_rpe_max: number | null
  created_at: string
  updated_at: string
}

export interface SetRow {
  id: string
  session_exercise_id: string
  position: number
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  rpe: number | null
  notes: string | null
  is_warmup: boolean
  round_index?: number | null
  side?: 'left' | 'right' | null
  direction?: 'pronation' | 'supination' | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SessionExerciseDoc extends SessionExerciseRow {
  sets: SetRow[]
}

/** Session document as stored locally and fetched with nested selects. */
export interface SessionDoc extends SessionRow {
  session_blocks?: SessionBlockRow[]
  session_exercises: SessionExerciseDoc[]
}

export const AEROBIC_ACTIVITY_TYPES = [
  'walking',
  'cycling',
  'rowing',
  'basketball',
  'table_tennis',
  'tennis',
  'swimming',
  'football',
  'volleyball',
  'other',
] as const

export type AerobicActivityType = (typeof AEROBIC_ACTIVITY_TYPES)[number]

export function isAerobicActivityType(value: string): value is AerobicActivityType {
  return (AEROBIC_ACTIVITY_TYPES as readonly string[]).includes(value)
}

export interface AerobicActivityRow {
  id: string
  owner_id: string
  recorded_on: string
  activity_type: AerobicActivityType
  duration_s: number
  moderate: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

/** Tables that can appear in the sync outbox. */
export type SyncTable =
  | 'profiles'
  | 'exercises'
  | 'training_plans'
  | 'workout_templates'
  | 'plan_routines'
  | 'template_blocks'
  | 'template_items'
  | 'recurrence_rules'
  | 'schedule_items'
  | 'workout_sessions'
  | 'session_blocks'
  | 'session_exercises'
  | 'workout_sets'
  | 'body_weight_entries'
  | 'body_measure_entries'
  | 'tendon_checkins'
  | 'aerobic_activities'

export type OutboxOp =
  | { kind: 'upsert'; table: SyncTable; row: Record<string, unknown> }
  | { kind: 'delete'; table: SyncTable; id: string }
