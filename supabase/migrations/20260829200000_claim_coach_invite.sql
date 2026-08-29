-- Complete coach invites by matching email, not only the raw join token.
-- New sign-ups often never return to /join/<token> after email confirmation.

create or replace function public.fn_finalize_coach_invite(p_invite_id uuid, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.coach_invites%rowtype;
  rel_id uuid;
  profile_created timestamptz;
  became_light boolean := false;
  kind text;
begin
  if p_invite_id is null or p_client_id is null then
    raise exception 'Invalid invite';
  end if;

  select * into invite
  from public.coach_invites
  where id = p_invite_id
  for update;
  if not found then
    raise exception 'Invite not found or expired';
  end if;

  if invite.trainer_id = p_client_id then
    raise exception 'You cannot accept your own invite';
  end if;

  if invite.accepted_at is not null then
    select account_kind into kind from public.profiles where id = p_client_id;
    return jsonb_build_object(
      'relationship_id', invite.relationship_id,
      'account_kind', coalesce(kind, 'full')
    );
  end if;

  if invite.expires_at <= now() then
    raise exception 'Invite not found or expired';
  end if;

  select r.id into rel_id
  from public.coaching_relationships r
  where r.trainer_id = invite.trainer_id
    and r.client_id = p_client_id
    and r.status in ('pending', 'active')
  limit 1;

  if rel_id is null then
    insert into public.coaching_relationships (trainer_id, client_id, status, accepted_at)
    values (invite.trainer_id, p_client_id, 'active', now())
    returning id into rel_id;

    select created_at into profile_created from public.profiles where id = p_client_id;
    if invite.account_kind = 'light' and profile_created >= invite.created_at then
      perform set_config('herkules.allow_role_change', 'on', true);
      update public.profiles
        set account_kind = 'light',
            is_coach = false,
            display_name = case
              when length(trim(display_name)) = 0 then invite.display_name
              else display_name
            end
        where id = p_client_id;
      became_light := true;
    end if;
  end if;

  update public.coach_invites
    set accepted_at = now(), accepted_by = p_client_id, relationship_id = rel_id
    where id = invite.id;

  select account_kind into kind from public.profiles where id = p_client_id;
  return jsonb_build_object(
    'relationship_id', rel_id,
    'account_kind', coalesce(kind, case when became_light then 'light' else 'full' end)
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

  select email into user_email from auth.users where id = uid;
  if lower(coalesce(user_email, '')) is distinct from lower(invite.email) then
    raise exception 'Invite email does not match this account';
  end if;

  return public.fn_finalize_coach_invite(invite.id, uid);
end;
$$;

create or replace function public.fn_claim_pending_coach_invite()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  invite public.coach_invites%rowtype;
  result jsonb := jsonb_build_object('claimed', false);
  applied jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into user_email from auth.users where id = uid;
  if user_email is null or length(trim(user_email)) = 0 then
    return result;
  end if;

  for invite in
    select *
    from public.coach_invites
    where accepted_at is null
      and expires_at > now()
      and lower(email) = lower(user_email)
    order by created_at
  loop
    begin
      applied := public.fn_finalize_coach_invite(invite.id, uid);
      result := applied || jsonb_build_object('claimed', true);
    exception
      when others then
        null;
    end;
  end loop;

  return result;
end;
$$;

create or replace function public.fn_complete_pending_coach_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite public.coach_invites%rowtype;
  client_uid uuid;
  n int := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  for invite in
    select *
    from public.coach_invites
    where trainer_id = uid
      and accepted_at is null
      and expires_at > now()
    order by created_at
  loop
    select u.id into client_uid
    from auth.users u
    where lower(u.email) = lower(invite.email)
    limit 1;
    if client_uid is null or client_uid = invite.trainer_id then
      continue;
    end if;
    begin
      perform public.fn_finalize_coach_invite(invite.id, client_uid);
      n := n + 1;
    exception
      when others then
        null;
    end;
  end loop;

  return jsonb_build_object('completed', n);
end;
$$;

revoke all on function public.fn_finalize_coach_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_claim_pending_coach_invite() from public, anon;
revoke all on function public.fn_complete_pending_coach_invites() from public, anon;

grant execute on function public.fn_claim_pending_coach_invite() to authenticated;
grant execute on function public.fn_complete_pending_coach_invites() to authenticated;
grant execute on function public.fn_accept_coach_invite(text) to authenticated;
