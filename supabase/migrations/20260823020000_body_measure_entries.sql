-- Daily tape measurements for the body-composition calculator.
-- Canonical unit is centimetres. Computed BF% is not stored — it is derived
-- from these girths plus profile height/sex/age and body_weight_entries.

create table public.body_measure_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_on date not null,
  neck_cm numeric(5,1) check (neck_cm is null or (neck_cm >= 15 and neck_cm <= 80)),
  waist_cm numeric(5,1) check (waist_cm is null or (waist_cm >= 40 and waist_cm <= 220)),
  hip_cm numeric(5,1) check (hip_cm is null or (hip_cm >= 40 and hip_cm <= 220)),
  arm_cm numeric(5,1) check (arm_cm is null or (arm_cm >= 15 and arm_cm <= 80)),
  thigh_cm numeric(5,1) check (thigh_cm is null or (thigh_cm >= 25 and thigh_cm <= 120)),
  calf_cm numeric(5,1) check (calf_cm is null or (calf_cm >= 15 and calf_cm <= 80)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, recorded_on),
  check (
    neck_cm is not null
    or waist_cm is not null
    or hip_cm is not null
    or arm_cm is not null
    or thigh_cm is not null
    or calf_cm is not null
  )
);

create index idx_body_measure_owner_date
  on public.body_measure_entries (owner_id, recorded_on desc);

create trigger trg_body_measure_entries_touch
  before update on public.body_measure_entries
  for each row execute function public.fn_touch_updated_at();

alter table public.body_measure_entries enable row level security;

revoke all on public.body_measure_entries from anon, authenticated;
grant select, insert, update, delete on public.body_measure_entries to authenticated;

create policy body_measure_entries_all on public.body_measure_entries
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
