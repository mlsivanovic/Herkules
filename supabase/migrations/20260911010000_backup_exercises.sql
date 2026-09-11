-- One optional, pre-approved substitute per routine exercise. Active sessions
-- keep both snapshots so substitutions remain available offline and history
-- records the exercise that was actually performed.

alter table public.template_items
  add column backup_exercise_id uuid references public.exercises (id) on delete set null,
  add constraint template_items_backup_differs
    check (backup_exercise_id is null or backup_exercise_id <> exercise_id);

create index idx_template_items_backup_exercise
  on public.template_items (backup_exercise_id)
  where backup_exercise_id is not null;

alter table public.session_exercises
  add column primary_exercise_id uuid references public.exercises (id) on delete set null,
  add column primary_name_snapshot text,
  add column primary_measurement_snapshot text,
  add column primary_target_weight_kg numeric(7,2)
    check (primary_target_weight_kg is null or primary_target_weight_kg >= 0),
  add column backup_exercise_id uuid references public.exercises (id) on delete set null,
  add column backup_name_snapshot text,
  add column backup_measurement_snapshot text,
  add column uses_backup boolean not null default false;

update public.session_exercises
set primary_exercise_id = exercise_id,
    primary_name_snapshot = name_snapshot,
    primary_measurement_snapshot = measurement_snapshot,
    primary_target_weight_kg = target_weight_kg
where primary_name_snapshot is null;

alter table public.session_exercises
  add constraint session_exercises_primary_name_length
    check (length(trim(primary_name_snapshot)) between 1 and 120),
  add constraint session_exercises_primary_measurement_values
    check (primary_measurement_snapshot in (
      'weight_reps', 'reps', 'duration', 'distance_duration',
      'weight_duration', 'weight_distance'
    )),
  add constraint session_exercises_backup_name_length
    check (backup_name_snapshot is null or length(trim(backup_name_snapshot)) between 1 and 120),
  add constraint session_exercises_backup_measurement_values
    check (backup_measurement_snapshot is null or backup_measurement_snapshot in (
      'weight_reps', 'reps', 'duration', 'distance_duration',
      'weight_duration', 'weight_distance'
    )),
  add constraint session_exercises_backup_snapshot_pair
    check ((backup_name_snapshot is null) = (backup_measurement_snapshot is null)),
  add constraint session_exercises_backup_requires_snapshot
    check (not uses_backup or backup_name_snapshot is not null);

create index idx_session_exercises_primary_exercise
  on public.session_exercises (primary_exercise_id);

create index idx_session_exercises_backup_exercise
  on public.session_exercises (backup_exercise_id)
  where backup_exercise_id is not null;
