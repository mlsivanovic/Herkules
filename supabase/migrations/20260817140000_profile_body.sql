-- Profile body stats + daily body-weight log.

alter table public.profiles
  add column if not exists height_cm numeric(5,1)
    check (height_cm is null or (height_cm >= 80 and height_cm <= 250)),
  add column if not exists sex text
    check (sex is null or sex in ('male', 'female', 'other')),
  add column if not exists birth_date date
    check (birth_date is null or birth_date <= current_date);

create table public.body_weight_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg < 500),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, recorded_on)
);

create index idx_body_weight_owner_date on public.body_weight_entries (owner_id, recorded_on desc);

create trigger trg_body_weight_entries_touch
  before update on public.body_weight_entries
  for each row execute function public.fn_touch_updated_at();

alter table public.body_weight_entries enable row level security;

revoke all on public.body_weight_entries from anon, authenticated;
grant select, insert, update, delete on public.body_weight_entries to authenticated;

create policy body_weight_entries_all on public.body_weight_entries
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
