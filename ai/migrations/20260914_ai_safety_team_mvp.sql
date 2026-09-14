-- 이앤엘 AI 안전관리팀 MVP schema
-- Server-side only. RLS is enabled intentionally and no browser policy is created.

create extension if not exists pgcrypto;

create table if not exists public.ai_workflows (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'incident',
  source_id text,
  task_type text not null default 'incident_review',
  status text not null default 'queued',
  priority text not null default 'normal',
  current_agent text,
  input_summary text,
  result_summary text,
  requires_human_approval boolean not null default true,
  requested_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ai_workflows_priority_check check (priority in ('low','normal','high','urgent')),
  constraint ai_workflows_status_check check (status in ('queued','running','awaiting_approval','completed','failed','cancelled','on_hold','re_review_requested'))
);

create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
  agent_id text not null,
  task_type text,
  status text not null default 'queued',
  model text,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  result_summary text,
  confidence numeric,
  requires_human_approval boolean not null default false,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_agent_runs_agent_id_check check (agent_id in ('safety_director','legal_reviewer','incident_manager','final_auditor')),
  constraint ai_agent_runs_status_check check (status in ('queued','running','completed','failed','blocked'))
);

create table if not exists public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
  agent_run_id uuid references public.ai_agent_runs(id) on delete set null,
  agent_id text,
  finding_type text,
  severity text not null default 'info',
  title text,
  detail text,
  legal_obligation text,
  practical_recommendation text,
  uncertainty text,
  official_sources jsonb not null default '[]'::jsonb,
  source_checked_at timestamptz,
  confidence numeric,
  requires_human_approval boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ai_findings_finding_type_check check (finding_type in ('incident_fact','missing_information','contradiction','legal_obligation','practical_recommendation','uncertainty','immediate_action','prevention_candidate','validation','source')),
  constraint ai_findings_severity_check check (severity in ('info','low','medium','high','critical')),
  constraint ai_findings_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
  status text not null default 'pending',
  approval_type text not null default 'final_review',
  summary text,
  decision_note text,
  requested_for text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_approvals_status_check check (status in ('pending','approved','held','rejected','recheck_requested'))
);

-- Bring older MVP tables forward without destructive renames.
alter table public.ai_agent_runs
  add column if not exists result_summary text,
  add column if not exists confidence numeric,
  add column if not exists requires_human_approval boolean not null default false;

alter table public.ai_findings
  add column if not exists legal_obligation text,
  add column if not exists practical_recommendation text,
  add column if not exists uncertainty text;

alter table public.ai_workflows drop constraint if exists ai_workflows_status_check;
alter table public.ai_workflows add constraint ai_workflows_status_check
  check (status in ('queued','running','awaiting_approval','completed','failed','cancelled','on_hold','re_review_requested'));

create index if not exists idx_ai_workflows_status_created on public.ai_workflows(status, created_at desc);
create index if not exists idx_ai_agent_runs_workflow on public.ai_agent_runs(workflow_id, created_at);
create index if not exists idx_ai_findings_workflow on public.ai_findings(workflow_id, created_at);
create index if not exists idx_ai_approvals_workflow_status on public.ai_approvals(workflow_id, status);

alter table public.ai_workflows enable row level security;
alter table public.ai_agent_runs enable row level security;
alter table public.ai_findings enable row level security;
alter table public.ai_approvals enable row level security;
