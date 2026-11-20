-- E&L safety policy and objectives: one shared annual master, site-scoped photo evidence.
-- Initial settings reproduce the two original 2026 CEO posters; no site is marked completed.
create table private.enl_policy_settings (
  singleton boolean primary key default true check (singleton),
  policy_year integer not null check (policy_year between 2000 and 2100),
  effective_date date not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text
);
insert into private.enl_policy_settings(singleton,policy_year,effective_date,revision,updated_by_id,updated_by_name)
values (true,2026,date '2026-01-01',1,'initial-template','2026년 원본 양식');

create table private.enl_policy_settings_history (
  revision integer primary key check (revision > 0),
  policy_year integer not null check (policy_year between 2000 and 2100),
  effective_date date not null,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text
);
insert into private.enl_policy_settings_history
(revision,policy_year,effective_date,updated_by_id,updated_by_name)
values (1,2026,date '2026-01-01','initial-template','2026년 원본 양식');

create table private.enl_policy_evidence (
  id bigint generated always as identity primary key,
  site_id text not null references public.enl_site_master(site_id),
  document_kind text not null check (document_kind in ('policy','objectives')),
  settings_revision integer not null references private.enl_policy_settings_history(revision),
  policy_year integer not null,
  effective_date date not null,
  photo_jpeg bytea not null check (octet_length(photo_jpeg) between 1 and 350000),
  submitted_by_id text not null,
  submitted_by_name text not null,
  submitted_at timestamptz not null default now(),
  review_state text not null default 'pending' check (review_state in ('pending','approved','rejected')),
  reviewed_by_id text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,
  constraint enl_policy_review_consistency check (
    (review_state='pending' and reviewed_at is null)
    or (review_state in ('approved','rejected') and reviewed_at is not null)
  )
);
create index enl_policy_evidence_lookup_idx
  on private.enl_policy_evidence(site_id,document_kind,settings_revision,id desc);

alter table private.enl_policy_settings enable row level security;
alter table private.enl_policy_settings_history enable row level security;
alter table private.enl_policy_evidence enable row level security;
revoke all on private.enl_policy_settings,private.enl_policy_settings_history,private.enl_policy_evidence from public,anon,authenticated;
grant select,update on private.enl_policy_settings to service_role;
grant select,insert on private.enl_policy_settings_history to service_role;
grant select,insert,update on private.enl_policy_evidence to service_role;
revoke all on sequence private.enl_policy_evidence_id_seq from public,anon,authenticated;
grant usage,select on sequence private.enl_policy_evidence_id_seq to service_role;
