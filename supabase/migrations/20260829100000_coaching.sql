-- Coach / client: roles, invites, copy-on-assign provenance, session comments.
-- Trainers read active clients; programming writes go to the client's owner_id.
-- Light accounts cannot create programs. Personal sync still filters to auth.uid().

-- ============================================================ profile roles

alter table public.profiles
  add column if not exists account_kind text not null default 'full'
    check (account_kind in ('full', 'light')),
  add column if not exists is_coach boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_light_not_coach;

alter table public.profiles
  add constraint profiles_light_not_coach
  check (account_kind <> 'light' or is_coach = false);

-- ============================================================ assignment provenance

alter table public.training_plans
  add column if not exists assigned_by uuid references auth.users (id) on delete set null,
  add column if not exists source_plan_id uuid,
  add column if not exists locked boolean not null default false;

alter table public.workout_templates
  add column if not exists assigned_by uuid references auth.users (id) on delete set null,
  add column if not exists source_template_id uuid,
  add column if not exists locked boolean not null default false;

alter table public.exercises
  add column if not exists assigned_by uuid references auth.users (id) on delete set null,
  add column if not exists source_exercise_id uuid,
  add column if not exists locked boolean not null default false;

alter table public.schedule_items
  add column if not exists assigned_by uuid references auth.users (id) on delete set null;

create index if not exists idx_plans_assigned_by on public.training_plans (assigned_by);
create index if not exists idx_templates_assigned_by on public.workout_templates (assigned_by);
create index if not exists idx_schedules_assigned_by on public.schedule_items (assigned_by);

-- ============================================================ coaching tables

create table public.coaching_relationships (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  last_viewed_at timestamptz,
  check (trainer_id <> client_id),
  check (status <> 'active' or accepted_at is not null),
  check (status <> 'ended' or ended_at is not null)
);

create unique index uq_coaching_active_pair
  on public.coaching_relationships (trainer_id, client_id)
  where status in ('pending', 'active');

create index idx_coaching_trainer on public.coaching_relationships (trainer_id, status);
create index idx_coaching_client on public.coaching_relationships (client_id, status);

create table public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (length(trim(email)) between 3 and 320),
  display_name text not null default '',
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  account_kind text not null default 'light' check (account_kind in ('full', 'light')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  relationship_id uuid references public.coaching_relationships (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index uq_coach_invites_pending
  on public.coach_invites (trainer_id, lower(email))
  where accepted_at is null;

create index idx_coach_invites_trainer on public.coach_invites (trainer_id, created_at desc);

create table public.session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_session_comments_session on public.session_comments (session_id, created_at);

create trigger trg_session_comments_touch
  before update on public.session_comments
  for each row execute function public.fn_touch_updated_at();

-- ============================================================ helpers

create or replace function public.fn_is_light()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.account_kind = 'light' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.fn_is_coach_of(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coaching_relationships r
    where r.trainer_id = auth.uid()
      and r.client_id = target
      and r.status = 'active'
  );
$$;

create or replace function public.fn_owns_or_coaches(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = auth.uid() or public.fn_is_coach_of(target);
$$;

create or replace function public.fn_protect_profile_roles()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.account_kind is distinct from old.account_kind
       and current_setting('herkules.allow_role_change', true) is distinct from 'on' then
      raise exception 'account_kind cannot be changed';
    end if;
    if new.is_coach and new.account_kind = 'light' then
      raise exception 'light accounts cannot be coaches';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_roles on public.profiles;
create trigger trg_protect_profile_roles
  before update on public.profiles
  for each row execute function public.fn_protect_profile_roles();

create or replace function public.fn_light_session_requires_template()
returns trigger
language plpgsql
as $$
begin
  if public.fn_is_light() and new.template_id is null then
    raise exception 'Light accounts can only start assigned workouts';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_light_session_requires_template on public.workout_sessions;
create trigger trg_light_session_requires_template
  before insert or update of template_id on public.workout_sessions
  for each row execute function public.fn_light_session_requires_template();

-- One active trainer per light client.
create or replace function public.fn_one_trainer_for_light()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and exists (
    select 1 from public.profiles p
    where p.id = new.client_id and p.account_kind = 'light'
  ) and exists (
    select 1 from public.coaching_relationships r
    where r.client_id = new.client_id
      and r.status = 'active'
      and r.id is distinct from new.id
  ) then
    raise exception 'Light accounts can only have one coach';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_one_trainer_for_light on public.coaching_relationships;
create trigger trg_one_trainer_for_light
  before insert or update on public.coaching_relationships
  for each row execute function public.fn_one_trainer_for_light();

-- ============================================================ invite RPCs

create or replace function public.fn_peek_coach_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invite public.coach_invites%rowtype;
  trainer_name text;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('valid', false);
  end if;
  select * into invite
  from public.coach_invites
  where token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('valid', false);
  end if;
  select display_name into trainer_name from public.profiles where id = invite.trainer_id;
  return jsonb_build_object(
    'valid', invite.accepted_at is null and invite.expires_at > now(),
    'email', invite.email,
    'display_name', invite.display_name,
    'trainer_name', coalesce(trainer_name, ''),
    'expires_at', invite.expires_at
  );
end;
$$;

create or replace function public.fn_accept_coach_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.coach_invites%rowtype;
  uid uuid := auth.uid();
  user_email text;
  rel_id uuid;
  profile_created timestamptz;
  became_light boolean := false;
  kind text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_token is null or length(p_token) < 32 then
    raise exception 'Invalid invite';
  end if;

  select * into invite
  from public.coach_invites
  where token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now();
  if not found then
    raise exception 'Invite not found or expired';
  end if;

  if invite.trainer_id = uid then
    raise exception 'You cannot accept your own invite';
  end if;

  select email into user_email from auth.users where id = uid;
  if lower(coalesce(user_email, '')) is distinct from lower(invite.email) then
    raise exception 'Invite email does not match this account';
  end if;

  if exists (
    select 1 from public.coaching_relationships r
    where r.trainer_id = invite.trainer_id
      and r.client_id = uid
      and r.status in ('pending', 'active')
  ) then
    raise exception 'Already connected to this coach';
  end if;

  insert into public.coaching_relationships (trainer_id, client_id, status, accepted_at)
  values (invite.trainer_id, uid, 'active', now())
  returning id into rel_id;

  select created_at into profile_created from public.profiles where id = uid;
  if invite.account_kind = 'light' and profile_created >= invite.created_at then
    perform set_config('herkules.allow_role_change', 'on', true);
    update public.profiles
      set account_kind = 'light',
          is_coach = false,
          display_name = case
            when length(trim(display_name)) = 0 then invite.display_name
            else display_name
          end
      where id = uid;
    became_light := true;
  end if;

  update public.coach_invites
    set accepted_at = now(), accepted_by = uid, relationship_id = rel_id
    where id = invite.id;

  select account_kind into kind from public.profiles where id = uid;
  return jsonb_build_object(
    'relationship_id', rel_id,
    'account_kind', coalesce(kind, case when became_light then 'light' else 'full' end)
  );
end;
$$;

-- ============================================================ RLS: new tables

alter table public.coaching_relationships enable row level security;
alter table public.coach_invites enable row level security;
alter table public.session_comments enable row level security;

revoke all on public.coaching_relationships, public.coach_invites, public.session_comments
from anon, authenticated;

grant select, update, delete on public.coaching_relationships to authenticated;
grant select, insert, update, delete on public.coach_invites to authenticated;
grant select, insert, update, delete on public.session_comments to authenticated;

create policy coaching_relationships_select on public.coaching_relationships
  for select to authenticated
  using (trainer_id = auth.uid() or client_id = auth.uid());

create policy coaching_relationships_update on public.coaching_relationships
  for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

create policy coaching_relationships_delete on public.coaching_relationships
  for delete to authenticated
  using (trainer_id = auth.uid());

create policy coach_invites_all on public.coach_invites
  for all to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

create policy session_comments_select on public.session_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and public.fn_owns_or_coaches(s.owner_id)
    )
  );

create policy session_comments_insert on public.session_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and public.fn_is_coach_of(s.owner_id)
    )
  );

create policy session_comments_update on public.session_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and public.fn_is_coach_of(s.owner_id)
    )
  );

create policy session_comments_delete on public.session_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and public.fn_is_coach_of(s.owner_id)
    )
  );

-- ============================================================ RLS: widen existing owner policies

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.fn_is_coach_of(id));

-- exercises
drop policy if exists exercises_select on public.exercises;
drop policy if exists exercises_insert on public.exercises;
drop policy if exists exercises_update on public.exercises;

create policy exercises_select on public.exercises
  for select to authenticated
  using (owner_id is null or public.fn_owns_or_coaches(owner_id));

create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (
    owner_id is not null
    and (
      (owner_id = auth.uid() and not public.fn_is_light())
      or public.fn_is_coach_of(owner_id)
    )
  );

create policy exercises_update on public.exercises
  for update to authenticated
  using (
    owner_id is not null
    and (
      (owner_id = auth.uid() and not public.fn_is_light() and locked = false)
      or public.fn_is_coach_of(owner_id)
    )
  )
  with check (
    owner_id is not null
    and (
      (owner_id = auth.uid() and not public.fn_is_light())
      or public.fn_is_coach_of(owner_id)
    )
  );

-- training plans
drop policy if exists training_plans_all on public.training_plans;

create policy training_plans_select on public.training_plans
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));

create policy training_plans_insert on public.training_plans
  for insert to authenticated
  with check (
    (owner_id = auth.uid() and not public.fn_is_light())
    or public.fn_is_coach_of(owner_id)
  );

create policy training_plans_update on public.training_plans
  for update to authenticated
  using (
    (owner_id = auth.uid() and locked = false and not public.fn_is_light())
    or public.fn_is_coach_of(owner_id)
  )
  with check (
    (owner_id = auth.uid() and not public.fn_is_light())
    or public.fn_is_coach_of(owner_id)
  );

create policy training_plans_delete on public.training_plans
  for delete to authenticated
  using (
    (owner_id = auth.uid() and locked = false)
    or public.fn_is_coach_of(owner_id)
  );

-- workout templates
drop policy if exists templates_all on public.workout_templates;

create policy templates_select on public.workout_templates
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));

create policy templates_insert on public.workout_templates
  for insert to authenticated
  with check (
    (
      (owner_id = auth.uid() and not public.fn_is_light())
      or public.fn_is_coach_of(owner_id)
    )
    and (
      plan_id is null
      or exists (
        select 1 from public.training_plans p
        where p.id = plan_id and p.owner_id = workout_templates.owner_id
      )
    )
  );

create policy templates_update on public.workout_templates
  for update to authenticated
  using (
    (owner_id = auth.uid() and locked = false and not public.fn_is_light())
    or public.fn_is_coach_of(owner_id)
  )
  with check (
    (
      (owner_id = auth.uid() and not public.fn_is_light())
      or public.fn_is_coach_of(owner_id)
    )
    and (
      plan_id is null
      or exists (
        select 1 from public.training_plans p
        where p.id = plan_id and p.owner_id = workout_templates.owner_id
      )
    )
  );

create policy templates_delete on public.workout_templates
  for delete to authenticated
  using (
    (owner_id = auth.uid() and locked = false)
    or public.fn_is_coach_of(owner_id)
  );

-- child programming tables follow the parent template
drop policy if exists template_items_all on public.template_items;
create policy template_items_select on public.template_items
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and public.fn_owns_or_coaches(t.owner_id)
    )
  );
create policy template_items_write on public.template_items
  for all to authenticated
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and (
          (t.owner_id = auth.uid() and t.locked = false and not public.fn_is_light())
          or public.fn_is_coach_of(t.owner_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and (
          (t.owner_id = auth.uid() and t.locked = false and not public.fn_is_light())
          or public.fn_is_coach_of(t.owner_id)
        )
    )
  );

drop policy if exists template_blocks_all on public.template_blocks;
create policy template_blocks_select on public.template_blocks
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and public.fn_owns_or_coaches(t.owner_id)
    )
  );
create policy template_blocks_write on public.template_blocks
  for all to authenticated
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and (
          (t.owner_id = auth.uid() and t.locked = false and not public.fn_is_light())
          or public.fn_is_coach_of(t.owner_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id
        and (
          (t.owner_id = auth.uid() and t.locked = false and not public.fn_is_light())
          or public.fn_is_coach_of(t.owner_id)
        )
    )
  );

-- recurrence / schedule
drop policy if exists recurrence_rules_all on public.recurrence_rules;
create policy recurrence_rules_select on public.recurrence_rules
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));

create policy recurrence_rules_insert on public.recurrence_rules
  for insert to authenticated
  with check (owner_id = auth.uid() or public.fn_is_coach_of(owner_id));

create policy recurrence_rules_update on public.recurrence_rules
  for update to authenticated
  using (owner_id = auth.uid() or public.fn_is_coach_of(owner_id))
  with check (owner_id = auth.uid() or public.fn_is_coach_of(owner_id));

create policy recurrence_rules_delete on public.recurrence_rules
  for delete to authenticated
  using (
    public.fn_is_coach_of(owner_id)
    or (
      owner_id = auth.uid()
      and not exists (
        select 1 from public.schedule_items s
        where s.recurrence_rule_id = recurrence_rules.id
          and s.assigned_by is not null
      )
    )
  );

drop policy if exists schedule_items_all on public.schedule_items;
create policy schedule_items_select on public.schedule_items
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));

create policy schedule_items_insert on public.schedule_items
  for insert to authenticated
  with check (
    (owner_id = auth.uid() or public.fn_is_coach_of(owner_id))
    and (
      plan_id is null
      or exists (
        select 1 from public.training_plans p
        where p.id = plan_id and p.owner_id = schedule_items.owner_id
      )
    )
    and (
      template_id is null
      or exists (
        select 1 from public.workout_templates t
        where t.id = template_id and t.owner_id = schedule_items.owner_id
      )
    )
  );

create policy schedule_items_update on public.schedule_items
  for update to authenticated
  using (owner_id = auth.uid() or public.fn_is_coach_of(owner_id))
  with check (owner_id = auth.uid() or public.fn_is_coach_of(owner_id));

create policy schedule_items_delete on public.schedule_items
  for delete to authenticated
  using (
    public.fn_is_coach_of(owner_id)
    or (owner_id = auth.uid() and assigned_by is null)
  );

-- sessions: coach may read, never write
drop policy if exists sessions_all on public.workout_sessions;
create policy sessions_select on public.workout_sessions
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));

create policy sessions_insert on public.workout_sessions
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy sessions_update on public.workout_sessions
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy sessions_delete on public.workout_sessions
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists session_exercises_all on public.session_exercises;
create policy session_exercises_select on public.session_exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and public.fn_owns_or_coaches(s.owner_id)
    )
  );

create policy session_exercises_write on public.session_exercises
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

drop policy if exists session_blocks_all on public.session_blocks;
create policy session_blocks_select on public.session_blocks
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and public.fn_owns_or_coaches(s.owner_id)
    )
  );

create policy session_blocks_write on public.session_blocks
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

drop policy if exists workout_sets_all on public.workout_sets;
create policy workout_sets_select on public.workout_sets
  for select to authenticated
  using (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id and public.fn_owns_or_coaches(s.owner_id)
    )
  );

create policy workout_sets_write on public.workout_sets
  for all to authenticated
  using (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id and s.owner_id = auth.uid()
    )
  );

-- body / tendon / aerobic: coach read, owner write
drop policy if exists body_weight_entries_all on public.body_weight_entries;
create policy body_weight_entries_select on public.body_weight_entries
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));
create policy body_weight_entries_write on public.body_weight_entries
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists body_measure_entries_all on public.body_measure_entries;
create policy body_measure_entries_select on public.body_measure_entries
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));
create policy body_measure_entries_write on public.body_measure_entries
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists tendon_checkins_all on public.tendon_checkins;
create policy tendon_checkins_select on public.tendon_checkins
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));
create policy tendon_checkins_write on public.tendon_checkins
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists aerobic_activities_all on public.aerobic_activities;
create policy aerobic_activities_select on public.aerobic_activities
  for select to authenticated
  using (public.fn_owns_or_coaches(owner_id));
create policy aerobic_activities_write on public.aerobic_activities
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================ grants for RPCs

revoke all on function public.fn_is_light() from public, anon;
revoke all on function public.fn_is_coach_of(uuid) from public, anon;
revoke all on function public.fn_owns_or_coaches(uuid) from public, anon;
revoke all on function public.fn_peek_coach_invite(text) from public;
revoke all on function public.fn_accept_coach_invite(text) from public, anon;

grant execute on function public.fn_is_light() to authenticated;
grant execute on function public.fn_is_coach_of(uuid) to authenticated;
grant execute on function public.fn_owns_or_coaches(uuid) to authenticated;
grant execute on function public.fn_peek_coach_invite(text) to anon, authenticated;
grant execute on function public.fn_accept_coach_invite(text) to authenticated;
