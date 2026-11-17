-- Validate Supabase Auth sessions through a narrowly scoped server-only function.
-- Apply with the migration administrator (the function owner must read auth.sessions).
-- PAESSED application connections must not need USAGE on the auth schema.

create or replace function paessed.session_is_valid(
  p_session_id uuid,
  p_user_id uuid,
  p_require_recent boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions as s
    where s.id = p_session_id
      and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now())
      and (
        not p_require_recent
        or s.created_at > now() - interval '5 minutes'
      )
  );
$$;

revoke all on function
  paessed.session_is_valid(uuid, uuid, boolean)
from public, anon, authenticated, service_role;

grant execute on function
  paessed.session_is_valid(uuid, uuid, boolean)
to paessed_server;

revoke select on auth.sessions from paessed_server;
revoke usage on schema auth from paessed_server;
