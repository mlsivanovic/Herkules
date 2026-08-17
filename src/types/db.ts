// Row types mirroring supabase/migrations — kept in sync manually.
// Canonical units: weight kg, distance m, duration s.

export type ExerciseCategory = 'strength' | 'cardio' | 'mobility'
export type ExerciseMeasurement = 'weight_reps' | 'reps' | 'duration' | 'distance_duration'
export type UnitSystem = 'metric' | 'imperial'
export type WeekStart = 'monday' | 'sunday'
export type SessionStatus = 'in_progress' | 'completed' | 'skipped'

export interface ProfileRow {
  id: string
  display_name: string
  unit_system: UnitSystem
  week_start: WeekStart
  default_rest_seconds: number
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
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface TemplateRow {
  id: string
  owner_id: string
  name: string
  notes: string | null
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
  notes: string | null
  superset_group: string | null
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
  template_id: string
  scheduled_date: string | null
  recurrence_rule_id: string | null
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
  notes: string | null
  superset_group: string | null
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
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SessionExerciseDoc extends SessionExerciseRow {
  sets: SetRow[]
}

/** Session document as stored locally and fetched with nested selects. */
export interface SessionDoc extends SessionRow {
  session_exercises: SessionExerciseDoc[]
}

/** Tables that can appear in the sync outbox. */
export type SyncTable =
  | 'profiles'
  | 'exercises'
  | 'workout_templates'
  | 'template_items'
  | 'recurrence_rules'
  | 'schedule_items'
  | 'workout_sessions'
  | 'session_exercises'
  | 'workout_sets'

export type OutboxOp =
  | { kind: 'upsert'; table: SyncTable; row: Record<string, unknown> }
  | { kind: 'delete'; table: SyncTable; id: string }
