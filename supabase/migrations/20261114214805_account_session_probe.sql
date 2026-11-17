-- Additive hosted-Supabase fix. The initial migration is already applied.
-- postgres cannot delegate USAGE on the managed auth schema to custom roles.
-- Expose only a boolean session check through this private, tightly granted helper.
create function paessed.session_is_active(p_session_id uuid, p_user_id uuid, p_recent boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not pg_catalog.pg_has_role(session_user, 'paessed_server', 'USAGE') then
    raise insufficient_privilege using message = 'Server role required';
  end if;
  if p_session_id is null or p_user_id is null or p_recent is null then
    return false;
  end if;
  return exists (
    select 1 from auth.sessions s
    where s.id=p_session_id and s.user_id=p_user_id
      and (s.not_after is null or s.not_after > pg_catalog.now())
      and (not p_recent or s.created_at > pg_catalog.now() - interval '5 minutes')
  );
end $$;

alter function paessed.session_is_active(uuid,uuid,boolean) owner to postgres;
revoke all on function paessed.session_is_active(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function paessed.session_is_active(uuid,uuid,boolean) to paessed_server;
revoke select on auth.sessions from paessed_server;
