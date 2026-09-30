-- Additive only. Incident payload, existing audit checks, policies and triggers are untouched.
create table public.enl_historical_followups (
 id uuid primary key,
 incident_id text not null references public.enl_incident_shared(incident_id) on delete restrict,
 site_id text not null references public.enl_site_master(site_id) on delete restrict,
 status text not null check(status in ('requested','in_progress','submitted','revision_requested','completed')),
 due_date date not null,
 version integer not null check(version > 0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(payload->>'id'=id::text and payload->>'incidentId'=incident_id and payload->>'siteId'=site_id and payload->>'status'=status)
);
create index enl_historical_followups_incident_idx on public.enl_historical_followups(incident_id);
create index enl_historical_followups_site_status_idx on public.enl_historical_followups(site_id,status,due_date);
create table public.enl_historical_followup_audit (
 id uuid primary key default gen_random_uuid(),
 followup_id uuid not null references public.enl_historical_followups(id) on delete restrict,
 mutation_id uuid not null unique,
 action text not null check(action in ('create','start','save','submit','revision','complete')),
 actor_id text not null,
 actor_name text not null,
 actor_role text not null,
 before_payload jsonb,
 after_payload jsonb not null,
 created_at timestamptz not null default now()
);
create index enl_historical_followup_audit_parent_idx on public.enl_historical_followup_audit(followup_id,created_at);
-- Staged files can precede initial requirement creation; no incident fields are used for attachments.
create table public.enl_historical_followup_files (
 path text primary key,
 followup_id uuid not null,
 site_id text not null,
 owner_id text not null,
 metadata jsonb not null,
 created_at timestamptz not null default now()
);
create index enl_historical_followup_files_parent_idx on public.enl_historical_followup_files(followup_id);
alter table public.enl_historical_followups enable row level security;
alter table public.enl_historical_followup_audit enable row level security;
alter table public.enl_historical_followup_files enable row level security;
-- This app uses verified custom HQ/PIN accounts through Edge SQL, not Supabase Auth JWTs.
-- No direct Data API grant/policy; the endpoint authorizes every read, write and signed URL.
revoke all on public.enl_historical_followups,public.enl_historical_followup_audit,public.enl_historical_followup_files from public,anon,authenticated;
