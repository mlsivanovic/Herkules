-- Tendon & warm-up support: per-item tempo prescription, loaded-isometric
-- measurement type, warm-up set flag and daily tendon check-ins.

-- Tempo prescription (e.g. "3-0-1" for slow-eccentric tendon work).
alter table public.template_items
  add column if not exists tempo text
    check (tempo is null or char_length(tempo) <= 16);

alter table public.session_exercises
  add column if not exists tempo text
    check (tempo is null or char_length(tempo) <= 16);

-- Warm-up sets are excluded from PR / e1RM / volume statistics.
alter table public.workout_sets
  add column if not exists is_warmup boolean not null default false;

-- weight_duration: loaded isometric hold (e.g. 60 kg × 45 s).
alter table public.exercises
  drop constraint if exists exercises_measurement_check;
alter table public.exercises
  add constraint exercises_measurement_values
  check (measurement in ('weight_reps', 'reps', 'duration', 'distance_duration', 'weight_duration'));

alter table public.session_exercises
  drop constraint if exists session_exercises_measurement_snapshot_check;
alter table public.session_exercises
  add constraint session_exercises_measurement_snapshot_values
  check (measurement_snapshot in ('weight_reps', 'reps', 'duration', 'distance_duration', 'weight_duration'));

-- Daily tendon check-in: morning stiffness and pain per body site (0-10).
create table public.tendon_checkins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_on date not null,
  site text not null check (length(trim(site)) between 1 and 60),
  stiffness int not null check (stiffness between 0 and 10),
  pain int not null check (pain between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, recorded_on, site)
);

create index idx_tendon_checkins_owner_date
  on public.tendon_checkins (owner_id, recorded_on desc);

create trigger trg_tendon_checkins_touch
  before update on public.tendon_checkins
  for each row execute function public.fn_touch_updated_at();

alter table public.tendon_checkins enable row level security;

revoke all on public.tendon_checkins from anon, authenticated;
grant select, insert, update, delete on public.tendon_checkins to authenticated;

create policy tendon_checkins_all on public.tendon_checkins
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
