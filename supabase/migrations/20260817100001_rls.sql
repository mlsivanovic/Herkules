-- Row Level Security: deny by default, grant per table.
-- A user sees and changes only their own rows; child tables verify
-- ownership through the parent row. System exercises are read-only.
-- The anon role gets nothing — Herkules has no public data access.

alter table public.profiles          enable row level security;
alter table public.exercises         enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_items    enable row level security;
alter table public.recurrence_rules  enable row level security;
alter table public.schedule_items    enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.session_exercises enable row level security;
alter table public.workout_sets      enable row level security;

revoke all on public.profiles, public.exercises, public.workout_templates,
  public.template_items, public.recurrence_rules, public.schedule_items,
  public.workout_sessions, public.session_exercises, public.workout_sets
from anon, authenticated;

-- ------------------------------------------------------------ profiles
-- INSERT happens only through the auth trigger; DELETE only via cascade.
grant select, update on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------ exercises
-- System rows (owner_id IS NULL): readable by every signed-in user, writable by no one.
-- Custom rows: fully controlled by the owner. No DELETE — archive instead.
grant select, insert, update on public.exercises to authenticated;

create policy exercises_select on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy exercises_update on public.exercises
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ------------------------------------------------------------ workout_templates
grant select, insert, update, delete on public.workout_templates to authenticated;

create policy templates_all on public.workout_templates
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ------------------------------------------------------------ template_items
grant select, insert, update, delete on public.template_items to authenticated;

create policy template_items_all on public.template_items
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

-- ------------------------------------------------------------ recurrence_rules
grant select, insert, update, delete on public.recurrence_rules to authenticated;

create policy recurrence_rules_all on public.recurrence_rules
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ------------------------------------------------------------ schedule_items
grant select, insert, update, delete on public.schedule_items to authenticated;

create policy schedule_items_all on public.schedule_items
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ------------------------------------------------------------ workout_sessions
grant select, insert, update, delete on public.workout_sessions to authenticated;

create policy sessions_all on public.workout_sessions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ------------------------------------------------------------ session_exercises
grant select, insert, update, delete on public.session_exercises to authenticated;

create policy session_exercises_all on public.session_exercises
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

-- ------------------------------------------------------------ workout_sets
-- Ownership two levels up: set -> session_exercise -> workout_session
grant select, insert, update, delete on public.workout_sets to authenticated;

create policy workout_sets_all on public.workout_sets
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
