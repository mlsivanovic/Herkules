-- Workout heart rate (Bluetooth sensor or Samsung Health import), one row per
-- session. `id` is the workout session id, so the generic outbox can upsert
-- and delete by id; deleting the session cascades here.
-- Samples are parallel arrays: unix ms timestamps and beats per minute.

create table public.session_heart_rate (
  id uuid primary key references public.workout_sessions (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sample_at bigint[] not null,
  sample_bpm smallint[] not null,
  -- Lets clients compare against their local copy without downloading samples.
  sample_count int generated always as (cardinality(sample_bpm)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_heart_rate_arrays_match
    check (cardinality(sample_at) = cardinality(sample_bpm)),
  constraint session_heart_rate_not_empty check (cardinality(sample_bpm) > 0),
  constraint session_heart_rate_size check (cardinality(sample_bpm) <= 86400),
  constraint session_heart_rate_bpm_range
    check (0 < all (sample_bpm) and 251 > all (sample_bpm))
);

create index idx_session_heart_rate_owner on public.session_heart_rate (owner_id);

create trigger trg_session_heart_rate_touch
  before update on public.session_heart_rate
  for each row execute function public.fn_touch_updated_at();

-- ------------------------------------------------------------ RLS

alter table public.session_heart_rate enable row level security;

revoke all on public.session_heart_rate from anon, authenticated;
grant select, insert, update, delete on public.session_heart_rate to authenticated;

-- Owners and their coaches can read; only the owner writes, and only for
-- a session they own.
create policy session_heart_rate_select on public.session_heart_rate
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));

create policy session_heart_rate_write on public.session_heart_rate
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_heart_rate.id and s.owner_id = auth.uid()
    )
  );
