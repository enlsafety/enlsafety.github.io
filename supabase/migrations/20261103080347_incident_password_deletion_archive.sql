-- Retain the original incident, approvals, attachments and every dependent record.
-- A private, append-only deletion ledger hides it from operational readers.
create table private.enl_incident_deletions (
 incident_id text primary key references public.enl_incident_shared(incident_id) on delete restrict,
 site_id text not null,
 deleted_at timestamptz not null default now(),
 deleted_by_id text not null,
 deleted_by_name text not null,
 reason text not null check(length(btrim(reason)) between 2 and 2000),
 previous_version bigint not null,
 audit_id uuid not null references public.enl_incident_audit(audit_id) on delete restrict
);
alter table private.enl_incident_deletions enable row level security;
revoke all on private.enl_incident_deletions from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.enl_incident_deletions to service_role;
create trigger enl_deletion_immutable before update or delete on private.enl_incident_deletions
 for each row execute function public.enl_evidence_append_only();

create table private.enl_incident_delete_attempts (
 actor_id text primary key,
 window_started_at timestamptz not null default now(),
 failures integer not null default 0 check(failures >= 0)
);
alter table private.enl_incident_delete_attempts enable row level security;
revoke all on private.enl_incident_delete_attempts from public,anon,authenticated;

create view public.enl_incident_active with (security_invoker=true) as
 select s.* from public.enl_incident_shared s
 where not exists(select 1 from private.enl_incident_deletions d where d.incident_id=s.incident_id);
revoke all on public.enl_incident_active from public,anon,authenticated;
grant select on public.enl_incident_active to service_role;

-- All current and older write APIs retain their existing guards and additionally
-- cannot modify or recreate an archived incident, including stale/offline saves.
create function private.enl_deleted_incident_write_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from private.enl_incident_deletions where incident_id=new.incident_id) then
  raise exception 'incident_deleted' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function private.enl_deleted_incident_write_guard() from public,anon,authenticated;
create trigger a_enl_deleted_incident_write_guard before insert or update on public.enl_incident_shared
 for each row execute function private.enl_deleted_incident_write_guard();

create function private.enl_deletion_insert_guard() returns trigger
language plpgsql set search_path='' as $$
declare a jsonb:=nullif(current_setting('enl.delete_actor',true),'')::jsonb;
begin
 if coalesce(a->>'id','')<>new.deleted_by_id or coalesce(a->>'role','')<>'safety'
  or not exists(select 1 from public.enl_hq_users where user_id=new.deleted_by_id and role='safety' and active=true)
  or not exists(select 1 from public.enl_incident_audit where audit_id=new.audit_id and incident_id=new.incident_id and action='delete' and editor_id=new.deleted_by_id) then
  raise exception 'authorized_deletion_audit_required' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function private.enl_deletion_insert_guard() from public,anon,authenticated;
create trigger enl_deletion_insert_guard before insert on private.enl_incident_deletions
 for each row execute function private.enl_deletion_insert_guard();
