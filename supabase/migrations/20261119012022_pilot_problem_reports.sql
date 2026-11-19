create table paessed.problem_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  screen text not null,
  steps text not null,
  expected text not null,
  observed text not null,
  device text not null,
  contact text,
  screenshot bytea check (octet_length(screenshot) <= 524288)
);

alter table paessed.problem_reports enable row level security;
revoke all on paessed.problem_reports from public, anon, authenticated, paessed_server;
grant insert on paessed.problem_reports to paessed_server;
create policy submit_report on paessed.problem_reports for insert to paessed_server with check (true);
