-- STAGING ONLY. No public app table, trigger, account or notification is changed.
create schema enl_erp_close_v2;
revoke all on schema enl_erp_close_v2 from public, anon, authenticated;
create table enl_erp_close_v2.tokens (
  token_hash text primary key check (length(token_hash)=64), run_id uuid not null,
  role text not null check(role in ('safety','field','qa')), expires_at timestamptz not null
);
create table enl_erp_close_v2.cases (
  id text primary key check (id like 'qa-%'), run_id uuid not null,
  payload jsonb not null check(jsonb_typeof(payload)='object' and payload @> '{"synthetic":true}'::jsonb), revision int not null default 1,
  scenario text not null, created_at timestamptz not null default now()
);
create index erp_v2_cases_run on enl_erp_close_v2.cases(run_id);
create table enl_erp_close_v2.jobs (
  id uuid primary key default gen_random_uuid(), case_id text not null references enl_erp_close_v2.cases(id),
  revision int not null, client_reference text unique not null, snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  state text not null check(state in ('queued','submitting','retry_wait','submission_unknown','pending','status_unknown','approved','rejected','error')),
  document_id text, attempts int not null default 0, error_code text, lease_until timestamptz,
  next_attempt_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(case_id,revision)
);
create index erp_v2_jobs_due on enl_erp_close_v2.jobs(next_attempt_at) where state in ('queued','retry_wait','submission_unknown','pending','status_unknown','submitting');
create table enl_erp_close_v2.mock_documents (
  id text primary key, client_reference text unique not null references enl_erp_close_v2.jobs(client_reference),
  snapshot_hash text not null, title text not null, body text not null, approval_line jsonb not null,
  attachments jsonb not null default '[]', submitted boolean not null default false,
  result text not null default 'pending', reason text, decided_at timestamptz
);
create table enl_erp_close_v2.audit (
  id bigint generated always as identity primary key, case_id text not null references enl_erp_close_v2.cases(id),
  job_id uuid references enl_erp_close_v2.jobs(id), event text not null, actor_role text not null,
  detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create index erp_v2_audit_case on enl_erp_close_v2.audit(case_id,created_at);
create index erp_v2_audit_job on enl_erp_close_v2.audit(job_id);
alter table enl_erp_close_v2.tokens enable row level security;
alter table enl_erp_close_v2.cases enable row level security;
alter table enl_erp_close_v2.jobs enable row level security;
alter table enl_erp_close_v2.mock_documents enable row level security;
alter table enl_erp_close_v2.audit enable row level security;
revoke all on all tables in schema enl_erp_close_v2 from public, anon, authenticated;
revoke all on all sequences in schema enl_erp_close_v2 from public, anon, authenticated;
-- Direct owner connection is used only by the staging function. No exposed RPC/security-definer.
