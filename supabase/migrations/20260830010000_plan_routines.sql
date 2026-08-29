-- Plan membership is many-to-many for trainer-created routines so the same
-- routine can sit on more than one plan. Starter program days stay exclusive
-- via workout_templates.plan_id + source_slot; this table is the ordered
-- membership used by the editor and rotation.

create table public.plan_routines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, template_id)
);

create index idx_plan_routines_plan on public.plan_routines (plan_id, position);
create index idx_plan_routines_template on public.plan_routines (template_id);
create index idx_plan_routines_owner on public.plan_routines (owner_id);

create trigger trg_plan_routines_touch
  before update on public.plan_routines
  for each row execute function public.fn_touch_updated_at();

alter table public.plan_routines enable row level security;

revoke all on public.plan_routines from anon, authenticated;
grant select, insert, update, delete on public.plan_routines to authenticated;

create policy plan_routines_all on public.plan_routines
  for all to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.training_plans p
      where p.id = plan_id and p.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.training_plans p
      where p.id = plan_id and p.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.owner_id = auth.uid()
    )
  );

insert into public.plan_routines (owner_id, plan_id, template_id, position, created_at, updated_at)
select t.owner_id, t.plan_id, t.id, t.plan_position, t.created_at, t.updated_at
from public.workout_templates t
where t.plan_id is not null
on conflict (plan_id, template_id) do nothing;
