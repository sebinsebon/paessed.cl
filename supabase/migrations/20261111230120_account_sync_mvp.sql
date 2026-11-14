-- Prepared locally only. paessed is intentionally absent from PostgREST schemas.
create schema if not exists paessed;
revoke all on schema paessed from public, anon, authenticated;
do $$ begin
  if not exists(select 1 from pg_roles where rolname = 'paessed_server') then
    create role paessed_server nologin;
  end if;
end $$;
grant usage on schema paessed to paessed_server;
grant usage on schema auth to paessed_server;
grant select on auth.sessions to paessed_server;

create table paessed.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(80) not null default '',
  timezone text not null default 'America/Santiago' check (timezone = 'America/Santiago'),
  updated_at timestamptz not null default now()
);
create table paessed.account_sync_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check(revision >= 0),
  generation integer not null default 0 check(generation >= 0),
  active_route text not null default 'current',
  reset_revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table paessed.learning_states (
  owner_id uuid primary key references paessed.account_sync_state(owner_id) on delete cascade,
  generation integer not null default 0,
  revision bigint not null,
  state jsonb not null check(jsonb_typeof(state) = 'object' and state->>'version' = '1'),
  updated_at timestamptz not null default now()
);
create table paessed.practice_sessions (
  owner_id uuid not null references paessed.account_sync_state(owner_id) on delete cascade,
  id uuid not null,
  mode text not null check(mode in ('exam','playground')),
  source_id varchar(120) not null,
  generation integer not null,
  revision bigint not null,
  state jsonb not null check(jsonb_typeof(state) = 'object'),
  completed_at timestamptz,
  provisional boolean not null default false,
  last_device_id uuid,
  answer_devices jsonb not null default '{}',
  answer_revisions jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key(owner_id, id),
  unique(owner_id, mode, source_id, generation, id)
);
create unique index practice_one_open_source on paessed.practice_sessions(owner_id,mode,source_id,generation) where completed_at is null;
create index practice_changes on paessed.practice_sessions(owner_id,revision);
create table paessed.original_answers (
  owner_id uuid not null references paessed.account_sync_state(owner_id) on delete cascade,
  generation integer not null,
  route_id varchar(180) not null default 'current',
  session_id varchar(180) not null,
  question_id varchar(180) not null,
  answer char(1) not null check(answer in ('A','B','C','D','E')),
  evidence jsonb not null check(jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now(),
  primary key(owner_id,generation,route_id,session_id,question_id)
);
create table paessed.question_exposures (
  owner_id uuid not null references paessed.account_sync_state(owner_id) on delete cascade,
  generation integer not null,
  route_id varchar(180) not null default 'current',
  session_id varchar(180) not null,
  question_id varchar(180) not null,
  state jsonb not null check(jsonb_typeof(state) = 'object'),
  primary key(owner_id,generation,route_id,session_id,question_id)
);
create table paessed.saved_questions (
  owner_id uuid not null references paessed.account_sync_state(owner_id) on delete cascade,
  question_id varchar(180) not null,
  generation integer not null,
  deleted boolean not null default false,
  revision bigint not null,
  primary key(owner_id,question_id,generation)
);
create index saved_changes on paessed.saved_questions(owner_id,revision);
create table paessed.sync_devices (
  owner_id uuid not null references paessed.account_sync_state(owner_id) on delete cascade,
  id uuid not null,
  last_sequence bigint not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(owner_id,id)
);
-- Compact receipt fingerprints survive retention; detailed payloads do not.
create table paessed.sync_operations (
  owner_id uuid not null,
  id uuid primary key,
  device_id uuid not null,
  sequence bigint not null check(sequence > 0),
  generation integer not null,
  digest char(64) not null,
  status text not null check(status in ('accepted','conflict')),
  revision bigint not null,
  payload jsonb,
  response jsonb,
  confirmed_at timestamptz not null default now(),
  foreign key(owner_id,device_id) references paessed.sync_devices(owner_id,id) on delete cascade,
  unique(owner_id,device_id,sequence)
);
create index operations_retention on paessed.sync_operations(confirmed_at) where payload is not null;
create table paessed.sync_conflicts (
  owner_id uuid not null references paessed.account_sync_state(owner_id) on delete cascade,
  id uuid primary key,
  generation integer not null,
  kind text not null,
  revision bigint not null,
  current_value jsonb not null,
  alternative jsonb not null,
  resolved boolean not null default false,
  choice text check(choice in ('incoming','current')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index conflict_owner on paessed.sync_conflicts(owner_id,revision);
create table paessed.rate_limit_counters (
  key varchar(220) primary key,
  count bigint not null default 0 check(count >= 0),
  expires_at timestamptz not null,
  touched_at timestamptz not null default now()
);
create index counter_expiry on paessed.rate_limit_counters(expires_at);
create table paessed.technical_events (
  id bigint generated always as identity primary key,
  code varchar(64) not null,
  count integer not null default 1,
  created_at timestamptz not null default now()
);
create index technical_retention on paessed.technical_events(created_at);
create table paessed.auth_flows (
  nonce_hash text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  purpose text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index auth_flow_expiry on paessed.auth_flows(expires_at);
create table paessed.capacity_state (
  singleton boolean primary key default true check(singleton),
  database_bytes bigint not null default 0,
  egress_bytes bigint not null default 0,
  egress_measured_at timestamptz,
  writes_paused boolean not null default false,
  warning boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into paessed.capacity_state(singleton) values(true);

do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'paessed' loop
    execute format('alter table paessed.%I enable row level security',t.tablename);
    execute format('revoke all on table paessed.%I from public, anon, authenticated',t.tablename);
    execute format('grant select, insert, update, delete on table paessed.%I to paessed_server',t.tablename);
    execute format('create policy server_only on paessed.%I to paessed_server using (true) with check (true)',t.tablename);
  end loop;
end $$;
grant usage, select on all sequences in schema paessed to paessed_server;
-- Original submissions are append-only even for the application's privileged role.
revoke update, delete on paessed.original_answers from paessed_server;
alter default privileges in schema paessed revoke all on tables from public, anon, authenticated;
alter default privileges in schema paessed revoke execute on functions from public, anon, authenticated;

-- Shared atomic fixed-window quota. Called inside the same transaction as writes.
create function paessed.consume_limit(p_key text,p_limit integer,p_window integer,p_amount integer default 1)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n bigint; begin
  insert into paessed.rate_limit_counters(key,count,expires_at)
  values(p_key,p_amount,clock_timestamp()+make_interval(secs=>p_window))
  on conflict(key) do update set
    count = case when paessed.rate_limit_counters.expires_at <= clock_timestamp() then p_amount else paessed.rate_limit_counters.count+p_amount end,
    expires_at = case when paessed.rate_limit_counters.expires_at <= clock_timestamp() then clock_timestamp()+make_interval(secs=>p_window) else paessed.rate_limit_counters.expires_at end,
    touched_at = clock_timestamp()
  returning count into n;
  return n <= p_limit;
end $$;
revoke all on function paessed.consume_limit(text,integer,integer,integer) from public,anon,authenticated;
grant execute on function paessed.consume_limit(text,integer,integer,integer) to paessed_server;

-- Check physical database usage on each sync request, independently of daily retention.
create function paessed.refresh_capacity()
returns void language plpgsql security invoker set search_path = '' as $$
declare measured bigint := pg_database_size(current_database()); begin
  update paessed.capacity_state set database_bytes=measured,
    warning=(measured>=367001600 or egress_bytes>=3758096384),
    writes_paused=(measured>=445644800 or egress_bytes>=4563402752),updated_at=now()
    where singleton;
end $$;
revoke all on function paessed.refresh_capacity() from public,anon,authenticated;
grant execute on function paessed.refresh_capacity() to paessed_server;

-- Bounded housekeeping. Never deletes educational data, conflicts or receipts.
create function paessed.cleanup_batch(p_batch integer default 1000)
returns void language plpgsql security invoker set search_path = '' as $$ begin
  if p_batch < 1 or p_batch > 10000 then raise exception 'invalid cleanup batch'; end if;
  delete from paessed.rate_limit_counters where key in (select key from paessed.rate_limit_counters where expires_at <= now() and touched_at < now()-interval '1 hour' order by touched_at limit p_batch);
  delete from paessed.technical_events where id in (select id from paessed.technical_events where created_at < now()-interval '7 days' order by created_at limit p_batch);
  update paessed.sync_operations set payload=null,response=null where id in (select id from paessed.sync_operations where confirmed_at < now()-interval '30 days' and payload is not null order by confirmed_at limit p_batch);
  delete from paessed.auth_flows where nonce_hash in (select nonce_hash from paessed.auth_flows where expires_at < now()-interval '1 hour' order by expires_at limit p_batch);
  update paessed.capacity_state set database_bytes=pg_database_size(current_database()),
    warning=(pg_database_size(current_database())>=367001600 or egress_bytes>=3758096384),
    writes_paused=(pg_database_size(current_database())>=445644800 or egress_bytes>=4563402752),updated_at=now() where singleton;
end $$;
revoke all on function paessed.cleanup_batch(integer) from public,anon,authenticated;
grant execute on function paessed.cleanup_batch(integer) to paessed_server;

-- Install schedule only where Supabase Cron has been enabled by the operator.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('paessed-daily-cleanup','17 4 * * *','select paessed.cleanup_batch(10000)');
  end if;
end $$;
