-- Hybrid V2: canonical program metadata, block snapshots, structured targets,
-- plan-driven scheduling, unilateral set semantics and aerobic activity log.
-- Existing sessions remain valid snapshots: all new columns are nullable or
-- have backward-compatible defaults and no historical rows are rewritten.

alter table public.training_plans
  add column if not exists source_key text,
  add column if not exists source_version int not null default 0
    check (source_version >= 0);

create unique index if not exists uq_training_plans_owner_source
  on public.training_plans (owner_id, source_key)
  where source_key is not null;

alter table public.workout_templates
  add column if not exists source_slot text
    check (source_slot is null or source_slot in ('A', 'B', 'C', 'D'));

create unique index if not exists uq_templates_plan_source_slot
  on public.workout_templates (plan_id, source_slot)
  where plan_id is not null and source_slot is not null;

-- ------------------------------------------------------------ block model

create table public.template_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  position int not null default 0 check (position >= 0),
  role text not null check (
    role in ('warmup', 'strength', 'assistance', 'power', 'carry', 'core',
             'conditioning', 'zone_2', 'tendon')
  ),
  format text not null default 'straight'
    check (format in ('straight', 'superset', 'circuit', 'interval')),
  rounds_initial int not null default 1 check (rounds_initial between 1 and 50),
  rounds_max int not null default 1 check (rounds_max between rounds_initial and 50),
  rest_after_round_s int check (rest_after_round_s is null or rest_after_round_s between 0 and 3600),
  notes text,
  interval_prepare_s int check (interval_prepare_s is null or interval_prepare_s between 0 and 600),
  interval_work_s int check (interval_work_s is null or interval_work_s between 1 and 3600),
  interval_recovery_s int check (interval_recovery_s is null or interval_recovery_s between 0 and 3600),
  interval_rounds int check (interval_rounds is null or interval_rounds between 1 and 50),
  target_rpe_min numeric(3,1) check (target_rpe_min is null or target_rpe_min between 1 and 10),
  target_rpe_max numeric(3,1) check (target_rpe_max is null or target_rpe_max between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_block_rpe_range check (
    target_rpe_min is null or target_rpe_max is null or target_rpe_min <= target_rpe_max
  )
);

create index idx_template_blocks_template
  on public.template_blocks (template_id, position);

create trigger trg_template_blocks_touch
  before update on public.template_blocks
  for each row execute function public.fn_touch_updated_at();

create table public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  template_block_id uuid references public.template_blocks (id) on delete set null,
  position int not null default 0 check (position >= 0),
  role text not null check (
    role in ('warmup', 'strength', 'assistance', 'power', 'carry', 'core',
             'conditioning', 'zone_2', 'tendon')
  ),
  format text not null default 'straight'
    check (format in ('straight', 'superset', 'circuit', 'interval')),
  rounds_initial int not null default 1 check (rounds_initial between 1 and 50),
  rounds_max int not null default 1 check (rounds_max between rounds_initial and 50),
  rest_after_round_s int check (rest_after_round_s is null or rest_after_round_s between 0 and 3600),
  notes text,
  interval_prepare_s int check (interval_prepare_s is null or interval_prepare_s between 0 and 600),
  interval_work_s int check (interval_work_s is null or interval_work_s between 1 and 3600),
  interval_recovery_s int check (interval_recovery_s is null or interval_recovery_s between 0 and 3600),
  interval_rounds int check (interval_rounds is null or interval_rounds between 1 and 50),
  target_rpe_min numeric(3,1) check (target_rpe_min is null or target_rpe_min between 1 and 10),
  target_rpe_max numeric(3,1) check (target_rpe_max is null or target_rpe_max between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_block_rpe_range check (
    target_rpe_min is null or target_rpe_max is null or target_rpe_min <= target_rpe_max
  )
);

create index idx_session_blocks_session
  on public.session_blocks (session_id, position);

create trigger trg_session_blocks_touch
  before update on public.session_blocks
  for each row execute function public.fn_touch_updated_at();

-- ------------------------------------------------------------ structured prescription

alter table public.template_items
  add column if not exists block_id uuid references public.template_blocks (id) on delete cascade,
  add column if not exists block_position int not null default 0 check (block_position >= 0),
  add column if not exists target_reps_min int check (target_reps_min is null or target_reps_min >= 0),
  add column if not exists target_reps_max int check (target_reps_max is null or target_reps_max >= 0),
  add column if not exists target_duration_min_s int check (target_duration_min_s is null or target_duration_min_s >= 0),
  add column if not exists target_duration_max_s int check (target_duration_max_s is null or target_duration_max_s >= 0),
  add column if not exists target_distance_min_m int check (target_distance_min_m is null or target_distance_min_m >= 0),
  add column if not exists target_distance_max_m int check (target_distance_max_m is null or target_distance_max_m >= 0),
  add column if not exists target_rpe_min numeric(3,1) check (target_rpe_min is null or target_rpe_min between 1 and 10),
  add column if not exists target_rpe_max numeric(3,1) check (target_rpe_max is null or target_rpe_max between 1 and 10),
  add column if not exists target_rir_min numeric(3,1) check (target_rir_min is null or target_rir_min between 0 and 10),
  add column if not exists target_rir_max numeric(3,1) check (target_rir_max is null or target_rir_max between 0 and 10),
  add column if not exists side_mode text not null default 'bilateral'
    check (side_mode in ('bilateral', 'per_side', 'per_leg')),
  add column if not exists directions int not null default 1 check (directions between 1 and 4),
  add column if not exists load_increment_kg numeric(5,2)
    check (load_increment_kg is null or load_increment_kg > 0),
  add column if not exists tempo_eccentric numeric(4,1) check (tempo_eccentric is null or tempo_eccentric >= 0),
  add column if not exists tempo_stretch_pause numeric(4,1) check (tempo_stretch_pause is null or tempo_stretch_pause >= 0),
  add column if not exists tempo_concentric numeric(4,1) check (tempo_concentric is null or tempo_concentric >= 0),
  add column if not exists tempo_contracted_pause numeric(4,1) check (tempo_contracted_pause is null or tempo_contracted_pause >= 0),
  add column if not exists tempo_intent text not null default 'controlled'
    check (tempo_intent in ('controlled', 'explosive'));

alter table public.template_blocks
  add constraint template_blocks_id_template_unique unique (id, template_id);
alter table public.template_items
  add constraint template_items_block_same_template
  foreign key (block_id, template_id)
  references public.template_blocks (id, template_id) on delete cascade;

alter table public.template_items
  add constraint template_items_reps_range check (
    target_reps_min is null or target_reps_max is null or target_reps_min <= target_reps_max
  ),
  add constraint template_items_duration_range check (
    target_duration_min_s is null or target_duration_max_s is null or target_duration_min_s <= target_duration_max_s
  ),
  add constraint template_items_distance_range check (
    target_distance_min_m is null or target_distance_max_m is null or target_distance_min_m <= target_distance_max_m
  ),
  add constraint template_items_rpe_range check (
    target_rpe_min is null or target_rpe_max is null or target_rpe_min <= target_rpe_max
  ),
  add constraint template_items_rir_range check (
    target_rir_min is null or target_rir_max is null or target_rir_min <= target_rir_max
  );

alter table public.session_exercises
  add column if not exists template_item_id uuid references public.template_items (id) on delete set null,
  add column if not exists session_block_id uuid references public.session_blocks (id) on delete set null,
  add column if not exists block_position int not null default 0 check (block_position >= 0),
  add column if not exists target_weight_kg numeric(7,2) check (target_weight_kg is null or target_weight_kg >= 0),
  add column if not exists target_reps int check (target_reps is null or target_reps >= 0),
  add column if not exists target_duration_s int check (target_duration_s is null or target_duration_s >= 0),
  add column if not exists target_distance_m int check (target_distance_m is null or target_distance_m >= 0),
  add column if not exists target_reps_min int check (target_reps_min is null or target_reps_min >= 0),
  add column if not exists target_reps_max int check (target_reps_max is null or target_reps_max >= 0),
  add column if not exists target_duration_min_s int check (target_duration_min_s is null or target_duration_min_s >= 0),
  add column if not exists target_duration_max_s int check (target_duration_max_s is null or target_duration_max_s >= 0),
  add column if not exists target_distance_min_m int check (target_distance_min_m is null or target_distance_min_m >= 0),
  add column if not exists target_distance_max_m int check (target_distance_max_m is null or target_distance_max_m >= 0),
  add column if not exists target_rpe_min numeric(3,1) check (target_rpe_min is null or target_rpe_min between 1 and 10),
  add column if not exists target_rpe_max numeric(3,1) check (target_rpe_max is null or target_rpe_max between 1 and 10),
  add column if not exists target_rir_min numeric(3,1) check (target_rir_min is null or target_rir_min between 0 and 10),
  add column if not exists target_rir_max numeric(3,1) check (target_rir_max is null or target_rir_max between 0 and 10),
  add column if not exists side_mode text not null default 'bilateral'
    check (side_mode in ('bilateral', 'per_side', 'per_leg')),
  add column if not exists directions int not null default 1 check (directions between 1 and 4),
  add column if not exists load_increment_kg numeric(5,2)
    check (load_increment_kg is null or load_increment_kg > 0),
  add column if not exists tempo_eccentric numeric(4,1) check (tempo_eccentric is null or tempo_eccentric >= 0),
  add column if not exists tempo_stretch_pause numeric(4,1) check (tempo_stretch_pause is null or tempo_stretch_pause >= 0),
  add column if not exists tempo_concentric numeric(4,1) check (tempo_concentric is null or tempo_concentric >= 0),
  add column if not exists tempo_contracted_pause numeric(4,1) check (tempo_contracted_pause is null or tempo_contracted_pause >= 0),
  add column if not exists tempo_intent text not null default 'controlled'
    check (tempo_intent in ('controlled', 'explosive'));

alter table public.session_blocks
  add constraint session_blocks_id_session_unique unique (id, session_id);
alter table public.session_exercises
  add constraint session_exercises_block_same_session
  foreign key (session_block_id, session_id)
  references public.session_blocks (id, session_id) on delete cascade;

alter table public.workout_sets
  add column if not exists round_index int check (round_index is null or round_index >= 1),
  add column if not exists side text check (side is null or side in ('left', 'right')),
  add column if not exists direction text check (direction is null or direction in ('pronation', 'supination'));

-- ------------------------------------------------------------ measurements

alter table public.exercises drop constraint if exists exercises_measurement_values;
alter table public.exercises add constraint exercises_measurement_values
  check (measurement in ('weight_reps', 'reps', 'duration', 'distance_duration',
                         'weight_duration', 'weight_distance'));

alter table public.session_exercises drop constraint if exists session_exercises_measurement_snapshot_values;
alter table public.session_exercises add constraint session_exercises_measurement_snapshot_values
  check (measurement_snapshot in ('weight_reps', 'reps', 'duration', 'distance_duration',
                                  'weight_duration', 'weight_distance'));

update public.exercises
set measurement = 'weight_distance', updated_at = now()
where id in (
  '11111111-1111-4111-8111-111111111154',
  '11111111-1111-4111-8111-111111111227'
);

update public.exercises
set measurement = 'weight_duration', updated_at = now()
where id = '11111111-1111-4111-8111-111111111220';

-- ------------------------------------------------------------ dynamic plan occurrences

alter table public.schedule_items
  alter column template_id drop not null,
  add column if not exists plan_id uuid references public.training_plans (id) on delete cascade;

alter table public.schedule_items
  add constraint one_schedule_workout_source check (
    (template_id is not null and plan_id is null)
    or (template_id is null and plan_id is not null)
  );

alter table public.workout_sessions
  add column if not exists plan_id uuid references public.training_plans (id) on delete set null,
  add column if not exists cycle_week int check (cycle_week is null or cycle_week between 1 and 4),
  add column if not exists is_deload boolean not null default false;

create index if not exists idx_sessions_plan_completed
  on public.workout_sessions (plan_id, ended_at)
  where status = 'completed';

-- ------------------------------------------------------------ instruction sources + aerobic activity

alter table public.exercises
  add column if not exists source_title text,
  add column if not exists source_provider text,
  add column if not exists source_url text check (source_url is null or source_url ~ '^https://'),
  add column if not exists source_verified_at date;

create table public.aerobic_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_on date not null,
  activity_type text not null check (activity_type in ('walking', 'cycling', 'rowing', 'other')),
  duration_s int not null check (duration_s between 60 and 86400),
  moderate boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_aerobic_activities_owner_date
  on public.aerobic_activities (owner_id, recorded_on desc);

create trigger trg_aerobic_activities_touch
  before update on public.aerobic_activities
  for each row execute function public.fn_touch_updated_at();

-- ------------------------------------------------------------ RLS

alter table public.template_blocks enable row level security;
alter table public.session_blocks enable row level security;
alter table public.aerobic_activities enable row level security;

revoke all on public.template_blocks, public.session_blocks, public.aerobic_activities
from anon, authenticated;

grant select, insert, update, delete on public.template_blocks, public.session_blocks,
  public.aerobic_activities to authenticated;

create policy template_blocks_all on public.template_blocks
  for all to authenticated
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.owner_id = auth.uid()
    )
  );

create policy session_blocks_all on public.session_blocks
  for all to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

create policy aerobic_activities_all on public.aerobic_activities
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Plan-owned schedule rows must reference a plan belonging to the owner.
drop policy if exists schedule_items_all on public.schedule_items;
create policy schedule_items_all on public.schedule_items
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      plan_id is null
      or exists (
        select 1 from public.training_plans p
        where p.id = plan_id and p.owner_id = auth.uid()
      )
    )
  );

-- First verified source pass for the movements used by Hybrid V2. The
-- remaining catalog rows keep their existing links until individually
-- verified; these URLs point to the exercise itself, not a search page.
with sources(id, title, provider, url) as (values
  ('11111111-1111-4111-8111-111111111145'::uuid, 'Goblet Squat', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/'),
  ('11111111-1111-4111-8111-111111111136'::uuid, 'Bulgarian Split Squat', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/366/bulgarian-split-squat/'),
  ('11111111-1111-4111-8111-111111111139'::uuid, 'Chest Press', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/19/chest-press/'),
  ('11111111-1111-4111-8111-111111111154'::uuid, 'Farmer''s Carry', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/359/farmer-s-carry/'),
  ('11111111-1111-4111-8111-111111111155'::uuid, 'Swing', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/391/swing/'),
  ('11111111-1111-4111-8111-111111111107'::uuid, 'Romanian Deadlift', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/'),
  ('11111111-1111-4111-8111-111111111224'::uuid, 'Single-leg Romanian Deadlift', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/329/single-leg-romanian-deadlift/'),
  ('11111111-1111-4111-8111-111111111165'::uuid, 'Seated Lat Pulldown', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/'),
  ('11111111-1111-4111-8111-111111111226'::uuid, 'Step-up', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/28/step-up/'),
  ('11111111-1111-4111-8111-111111111177'::uuid, 'Push-up', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/41/push-up/'),
  ('11111111-1111-4111-8111-111111111229'::uuid, 'Supine Dead Bug', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/147/supine-dead-bug/'),
  ('11111111-1111-4111-8111-111111111138'::uuid, 'Standing Calf Raises - Wall', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/73/standing-calf-raises-wall/'),
  ('11111111-1111-4111-8111-111111111217'::uuid, 'Rotator Cuff Exercises', 'E3 Rehab', 'https://e3rehab.com/rotator-cuff-exercises/')
)
update public.exercises e
set source_title = sources.title,
    source_provider = sources.provider,
    source_url = sources.url,
    source_verified_at = date '2026-08-20',
    video_url = sources.url,
    updated_at = now()
from sources
where e.id = sources.id;
