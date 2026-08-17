-- Herkules initial schema.
-- Canonical units: weight kg, distance m, duration s. Conversion happens in the UI.

create extension if not exists pgcrypto with schema extensions;

-- Generic updated_at toucher, attached to every table below
create or replace function public.fn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  week_start text not null default 'monday' check (week_start in ('monday', 'sunday')),
  default_rest_seconds int not null default 90 check (default_rest_seconds between 0 and 3600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ exercises
-- owner_id NULL  => system exercise (read-only for everyone, seeded here)
-- owner_id set   => private custom exercise of that user
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (category in ('strength', 'cardio', 'mobility')),
  measurement text not null check (measurement in ('weight_reps', 'reps', 'duration', 'distance_duration')),
  muscle_groups text[] not null default '{}',
  equipment text[] not null default '{}',
  instructions text,
  video_url text check (video_url is null or video_url ~ '^https://'),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_exercises_owner on public.exercises (owner_id);
create index idx_exercises_system on public.exercises (category) where owner_id is null;

-- ============================================================ workout_templates
create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_templates_owner on public.workout_templates (owner_id);

-- ============================================================ template_items
-- superset_group: rows sharing the same non-null uuid (adjacent in position)
-- are performed as a superset/circuit block.
create table public.template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position int not null default 0 check (position >= 0),
  planned_sets int not null default 3 check (planned_sets between 1 and 30),
  target_weight_kg numeric(7,2) check (target_weight_kg is null or target_weight_kg >= 0),
  target_reps int check (target_reps is null or target_reps >= 0),
  target_duration_s int check (target_duration_s is null or target_duration_s >= 0),
  target_distance_m int check (target_distance_m is null or target_distance_m >= 0),
  rest_seconds int check (rest_seconds is null or rest_seconds between 0 and 3600),
  notes text,
  superset_group uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_template_items_template on public.template_items (template_id);

-- ============================================================ recurrence_rules
-- weekdays use ISO numbers: 1 = Monday … 7 = Sunday
create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  frequency text not null default 'weekly' check (frequency in ('weekly')),
  weekdays int[] not null check (
    coalesce(array_length(weekdays, 1), 0) between 1 and 7
    and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]
  ),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ schedule_items
-- A scheduled workout is either a single date or driven by a recurrence rule.
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  scheduled_date date,
  recurrence_rule_id uuid references public.recurrence_rules (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_schedule_source check (
    (scheduled_date is not null and recurrence_rule_id is null)
    or (scheduled_date is null and recurrence_rule_id is not null)
  )
);

create index idx_schedule_owner_date on public.schedule_items (owner_id, scheduled_date);
create index idx_schedule_rule on public.schedule_items (recurrence_rule_id);

-- ============================================================ workout_sessions
-- History is a snapshot: later catalog edits never rewrite it.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  schedule_item_id uuid references public.schedule_items (id) on delete set null,
  name text not null default 'Workout' check (length(trim(name)) between 1 and 120),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  planned_date date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  rpe int check (rpe is null or rpe between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_status_times check (
    (status = 'in_progress' and ended_at is null)
    or (status = 'completed' and ended_at is not null)
  )
);

-- At most one active workout per user
create unique index uq_sessions_active on public.workout_sessions (owner_id) where status = 'in_progress';
create index idx_sessions_owner_started on public.workout_sessions (owner_id, started_at desc);

-- ============================================================ session_exercises
create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  name_snapshot text not null check (length(trim(name_snapshot)) between 1 and 120),
  measurement_snapshot text not null check (
    measurement_snapshot in ('weight_reps', 'reps', 'duration', 'distance_duration')
  ),
  position int not null default 0 check (position >= 0),
  planned_sets int not null default 0 check (planned_sets between 0 and 30),
  rest_seconds int check (rest_seconds is null or rest_seconds between 0 and 3600),
  notes text,
  superset_group uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_session_exercises_session on public.session_exercises (session_id);
create index idx_session_exercises_exercise on public.session_exercises (exercise_id);

-- ============================================================ workout_sets
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  position int not null default 1 check (position >= 1),
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg >= 0),
  reps int check (reps is null or reps >= 0),
  duration_s int check (duration_s is null or duration_s >= 0),
  distance_m int check (distance_m is null or distance_m >= 0),
  rpe int check (rpe is null or rpe between 1 and 10),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sets_exercise on public.workout_sets (session_exercise_id);

-- ============================================================ updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'exercises', 'workout_templates', 'template_items',
    'recurrence_rules', 'schedule_items', 'workout_sessions',
    'session_exercises', 'workout_sets'
  ]
  loop
    execute format(
      'create trigger trg_%s_touch before update on public.%I
       for each row execute function public.fn_touch_updated_at();', t, t
    );
  end loop;
end;
$$;

-- ============================================================ profile bootstrap
create or replace function public.fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();
