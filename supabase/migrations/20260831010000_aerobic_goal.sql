-- Weekly aerobic minutes on the athlete profile. Coaches set it through an RPC
-- so they cannot rewrite other profile fields.

alter table public.profiles
  add column if not exists aerobic_goal_minutes integer not null default 150
    check (aerobic_goal_minutes >= 1 and aerobic_goal_minutes <= 2000);

create or replace function public.fn_set_client_aerobic_goal(p_client_id uuid, p_minutes integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_client_id is null then
    raise exception 'Client is required';
  end if;
  if not public.fn_is_coach_of(p_client_id) then
    raise exception 'Not this client''s coach';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 2000 then
    raise exception 'Aerobic goal must be between 1 and 2000 minutes';
  end if;

  update public.profiles
    set aerobic_goal_minutes = p_minutes
    where id = p_client_id;
  if not found then
    raise exception 'Client profile not found';
  end if;

  return p_minutes;
end;
$$;

revoke all on function public.fn_set_client_aerobic_goal(uuid, integer) from public, anon;
grant execute on function public.fn_set_client_aerobic_goal(uuid, integer) to authenticated;
