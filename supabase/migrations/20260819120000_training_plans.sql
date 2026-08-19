-- Training plans: an ordered collection of routines (workout_templates).
-- A routine belongs to at most one plan. Deleting a plan unassigns its
-- routines (ON DELETE SET NULL) instead of cascading.

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_training_plans_owner on public.training_plans (owner_id);

create trigger trg_training_plans_touch
  before update on public.training_plans
  for each row execute function public.fn_touch_updated_at();

alter table public.workout_templates
  add column if not exists plan_id uuid references public.training_plans (id) on delete set null,
  add column if not exists plan_position int not null default 0 check (plan_position >= 0);

create index idx_templates_plan on public.workout_templates (plan_id, plan_position);

alter table public.training_plans enable row level security;

revoke all on public.training_plans from anon, authenticated;
grant select, insert, update, delete on public.training_plans to authenticated;

create policy training_plans_all on public.training_plans
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Recreate template policy so plan_id must point at a plan the user owns.
drop policy if exists templates_all on public.workout_templates;

create policy templates_all on public.workout_templates
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
