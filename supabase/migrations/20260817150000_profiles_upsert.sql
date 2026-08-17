-- The app outbox upserts profile rows. PostgREST upsert is INSERT … ON
-- CONFLICT UPDATE and therefore needs INSERT even when the row already
-- exists. Keep it locked to the caller's own id.

grant insert on public.profiles to authenticated;

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
