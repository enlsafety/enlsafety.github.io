-- Server-only account drafts. The Edge verifies the current active account on every request.
create table private.enl_form_drafts (
 owner_key text not null,
 id uuid not null,
 kind text not null check(kind in ('person','property','plan','action')),
 incident_id text not null default '',
 report_id text not null default '',
 site_id text not null default '',
 incident_version text not null default '',
 revision integer not null default 1 check(revision>0),
 content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=2000000),
 mutation_id text not null,
 state text not null default 'active' check(state in ('active','submitted','deleted')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(owner_key,id)
);
create index enl_form_drafts_owner_recent on private.enl_form_drafts(owner_key,updated_at desc) where state='active';
alter table private.enl_form_drafts enable row level security;
revoke all on private.enl_form_drafts from public,anon,authenticated;
grant select,insert,update on private.enl_form_drafts to service_role;
comment on table private.enl_form_drafts is 'Unsubmitted owner-private working copies. CAS revisions and terminal tombstones prevent stale-device overwrite or resurrection. Submitted/deleted content is cleared; original incident records are unaffected.';

-- Old open browser tabs also cannot submit a report behind a newer server draft.
create or replace function private.enl_require_draft_submission() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(current_setting('enl.form_draft_submit',true),'')<>new.incident_id and exists(select 1 from private.enl_form_drafts where report_id=new.incident_id and incident_id='' and state='active') then
  raise exception 'draft_submit_required' using errcode='40001';
 end if;
 return new;
end $$;
revoke all on function private.enl_require_draft_submission() from public,anon,authenticated;
grant execute on function private.enl_require_draft_submission() to service_role;
create trigger enl_require_draft_submission before insert on public.enl_incident_shared
 for each row execute function private.enl_require_draft_submission();
create index enl_form_drafts_report on private.enl_form_drafts(report_id) where state='active' and incident_id='';
