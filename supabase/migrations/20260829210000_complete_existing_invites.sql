-- One-time backfill: pending invites whose email already has an account.
do $$
declare
  invite public.coach_invites%rowtype;
  client_uid uuid;
begin
  for invite in
    select *
    from public.coach_invites
    where accepted_at is null
      and expires_at > now()
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
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;
