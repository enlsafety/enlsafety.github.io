-- Registry alignment: activation was executed through the reviewed fixed-SQL
-- runner on 2026-10-23. Its manual registry marker is still pending. Existing
-- active installations verify and make no data changes when this file is replayed.
-- The explicit transaction includes verification and the reviewed activation SQL.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $evidence_migration$
declare existing_count integer;valid_count integer;
begin
 perform set_config('lock_timeout','5s',true);
 perform set_config('statement_timeout','60s',true);
 lock table public.enl_incident_audit,public.enl_incident_revisions,
   public.enl_incident_backups,private.enl_evidence_objects in share row exclusive mode;

 select count(*) into valid_count from pg_trigger t
 where (t.tgrelid,t.tgname) in (
   ('public.enl_incident_audit'::regclass,'enl_audit_immutable'),
   ('public.enl_incident_revisions'::regclass,'enl_revision_immutable'),
   ('private.enl_evidence_objects'::regclass,'enl_evidence_objects_immutable'))
 and t.tgenabled='O' and t.tgtype=27 and t.tgfoid='public.enl_evidence_append_only()'::regprocedure;
 if valid_count<>3 then raise exception 'evidence_migration_immutable_guard_invalid';end if;

 select count(*),count(*) filter(where t.tgenabled='O' and t.tgtype=7
   and t.tgfoid='private.enl_evidence_compact_insert()'::regprocedure)
 into existing_count,valid_count from pg_trigger t
 where (t.tgrelid,t.tgname) in (
   ('public.enl_incident_audit'::regclass,'enl_audit_compact_insert'),
   ('public.enl_incident_revisions'::regclass,'enl_revision_compact_insert'),
   ('public.enl_incident_backups'::regclass,'enl_backup_compact_insert'));
 if existing_count not in (0,3) or (existing_count=3 and valid_count<>3) then
  raise exception 'evidence_migration_partial_activation';
 end if;

 if existing_count=3 then
  -- Validate every dictionary node and each root reference. Missing, corrupt,
  -- or unreconstructable references fail rather than being treated as migrated.
  perform private.enl_evidence_get(hash) from private.enl_evidence_objects;
  perform private.enl_evidence_get(before_hash),private.enl_evidence_get(after_hash) from public.enl_incident_audit;
  perform private.enl_evidence_get(before_hash),private.enl_evidence_get(after_hash),private.enl_evidence_get(changes_hash) from public.enl_incident_revisions;
  perform private.enl_evidence_get(snapshot_hash) from public.enl_incident_backups;
  if exists(select 1 from public.enl_incident_audit where before_payload is not null or after_payload is not null)
   or exists(select 1 from public.enl_incident_revisions where before_payload is not null or after_payload is not null or changes is not null or before_hash is null or after_hash is null or changes_hash is null)
   or exists(select 1 from public.enl_incident_backups where snapshot is not null or snapshot_hash is null) then
   raise exception 'evidence_migration_active_references_invalid';
  end if;
  select count(*) into valid_count from pg_constraint c join pg_attribute a
   on a.attrelid=c.conrelid and c.conkey=array[a.attnum]
   where c.contype='f' and c.convalidated and c.confrelid='private.enl_evidence_objects'::regclass
    and (c.conrelid,a.attname) in (
     ('public.enl_incident_audit'::regclass,'before_hash'),('public.enl_incident_audit'::regclass,'after_hash'),
     ('public.enl_incident_revisions'::regclass,'before_hash'),('public.enl_incident_revisions'::regclass,'after_hash'),
     ('public.enl_incident_revisions'::regclass,'changes_hash'),('public.enl_incident_backups'::regclass,'snapshot_hash'));
  if valid_count<>6 then raise exception 'evidence_migration_reference_constraints_invalid';end if;
  if position('coalesce(r.before_payload,private.enl_evidence_get(r.before_hash))=p'
    in pg_get_functiondef('private.enl_bulk_lifecycle_guard()'::regprocedure))=0 then
   raise exception 'evidence_migration_lifecycle_guard_invalid';
  end if;
  return;
 end if;

 -- A partially converted or manually rolled-back representation needs explicit
 -- review. The automatic first-apply path only accepts the additive phase.
 if exists(select 1 from private.enl_evidence_objects)
  or exists(select 1 from public.enl_incident_audit where before_hash is not null or after_hash is not null)
  or exists(select 1 from public.enl_incident_revisions where before_hash is not null or after_hash is not null or changes_hash is not null)
  or exists(select 1 from public.enl_incident_backups where snapshot_hash is not null) then
  raise exception 'evidence_migration_partial_data';
 end if;

 -- The enclosed SQL is byte-for-byte the reviewed/tested activation fixture.
 execute $reviewed_evidence_activation$
-- Phase 2: run in ONE transaction, only after backup hashes and hydrated readers verify.
-- Locks exclude concurrent writers. Active guards require identical reconstructed
-- content and metadata on every row, and are restored before commit. No rows are deleted.
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.enl_incident_audit,public.enl_incident_revisions,public.enl_incident_backups in share row exclusive mode;
create temp table enl_evidence_verify_before on commit drop as
select 'audit' kind,audit_id::text id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') hash from public.enl_incident_audit a
union all select 'revision',incident_id||':'||revision,encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') from public.enl_incident_revisions r
union all select 'backup',backup_id::text,encode(sha256(convert_to(to_jsonb(b)::text,'UTF8')),'hex') from public.enl_incident_backups b;

alter table public.enl_incident_revisions alter column before_payload drop not null,alter column after_payload drop not null,alter column changes drop not null;
alter table public.enl_incident_backups alter column snapshot drop not null;
-- Temporary, non-bypass guard: the active triggers continue to reject every
-- content/metadata change. Only postgres can move identical JSON between inline
-- columns and verified dictionary references. No trigger is disabled.
create temp table enl_evidence_trigger_restore on commit drop as
select pg_get_triggerdef(oid) definition from pg_trigger
where (tgrelid='public.enl_incident_audit'::regclass and tgname='enl_audit_immutable')
   or (tgrelid='public.enl_incident_revisions'::regclass and tgname='enl_revision_immutable');
do $$ begin
 if (select count(*) from enl_evidence_trigger_restore)<>2 then raise exception 'evidence_guard_missing';end if;
 if exists(select 1 from pg_trigger where ((tgrelid='public.enl_incident_audit'::regclass and tgname='enl_audit_immutable') or (tgrelid='public.enl_incident_revisions'::regclass and tgname='enl_revision_immutable')) and tgenabled<>'O') then raise exception 'evidence_guard_not_enabled';end if;
end; $$;
create function private.enl_evidence_representation_guard() returns trigger
language plpgsql set search_path='' as $$
declare a jsonb:=to_jsonb(old);b jsonb:=to_jsonb(new);fields text[];field text;hash_field text;resolved jsonb;
begin
 if tg_op<>'UPDATE' or current_user<>'postgres' or tg_table_schema<>'public'
   or tg_table_name not in ('enl_incident_audit','enl_incident_revisions','enl_incident_backups') then
  raise exception 'evidence_is_append_only' using errcode='42501';
 end if;
 fields:=case tg_table_name when 'enl_incident_backups' then array['snapshot'] when 'enl_incident_revisions' then array['before_payload','after_payload','changes'] else array['before_payload','after_payload'] end;
 foreach field in array fields loop
  hash_field:=case field when 'before_payload' then 'before_hash' when 'after_payload' then 'after_hash' else field||'_hash' end;
  -- Validate existing and proposed hashes even when an inline value also exists.
  if a->>hash_field is not null then
   resolved:=private.enl_evidence_get(a->>hash_field);
   if a->field is distinct from 'null'::jsonb and a->field is distinct from resolved then raise exception 'evidence_original_reference_mismatch';end if;
   a:=a||jsonb_build_object(field,resolved);
  end if;
  if b->>hash_field is not null then
   resolved:=private.enl_evidence_get(b->>hash_field);
   if b->field is distinct from 'null'::jsonb and b->field is distinct from resolved then raise exception 'evidence_proposed_reference_mismatch';end if;
   b:=b||jsonb_build_object(field,resolved);
  end if;
  a:=a-hash_field;b:=b-hash_field;
 end loop;
 if a is distinct from b then raise exception 'evidence_content_or_metadata_changed' using errcode='42501';end if;
 return new;
end; $$;
revoke all on function private.enl_evidence_representation_guard() from public,anon,authenticated,service_role;
create or replace trigger enl_audit_immutable before update or delete on public.enl_incident_audit for each row execute function private.enl_evidence_representation_guard();
create or replace trigger enl_revision_immutable before update or delete on public.enl_incident_revisions for each row execute function private.enl_evidence_representation_guard();
create trigger enl_backup_representation_guard before update or delete on public.enl_incident_backups for each row execute function private.enl_evidence_representation_guard();

update public.enl_incident_audit set before_hash=private.enl_evidence_put(before_payload),after_hash=private.enl_evidence_put(after_payload),before_payload=null,after_payload=null;
update public.enl_incident_revisions set before_hash=private.enl_evidence_put(before_payload),after_hash=private.enl_evidence_put(after_payload),changes_hash=private.enl_evidence_put(changes),before_payload=null,after_payload=null,changes=null;
update public.enl_incident_backups set snapshot_hash=private.enl_evidence_put(snapshot),snapshot=null;
-- Return to the original unconditional append-only triggers before commit.
do $$ declare r record;begin
 for r in select definition from enl_evidence_trigger_restore loop
  execute replace(r.definition,'CREATE TRIGGER ','CREATE OR REPLACE TRIGGER ');
 end loop;
end; $$;
drop trigger enl_backup_representation_guard on public.enl_incident_backups;
drop function private.enl_evidence_representation_guard();


-- Compare EVERY field, including actors, reasons, timestamps, ERP and nested media.
do $$ declare mismatches bigint; begin
 select count(*) into mismatches from enl_evidence_verify_before old
 join (
  select 'audit' kind,audit_id::text id,encode(sha256(convert_to((to_jsonb(a)||jsonb_build_object('before_payload',private.enl_evidence_get(before_hash),'after_payload',private.enl_evidence_get(after_hash),'before_hash',null,'after_hash',null))::text,'UTF8')),'hex') hash from public.enl_incident_audit a
  union all select 'revision',incident_id||':'||revision,encode(sha256(convert_to((to_jsonb(r)||jsonb_build_object('before_payload',private.enl_evidence_get(before_hash),'after_payload',private.enl_evidence_get(after_hash),'changes',private.enl_evidence_get(changes_hash),'before_hash',null,'after_hash',null,'changes_hash',null))::text,'UTF8')),'hex') from public.enl_incident_revisions r
  union all select 'backup',backup_id::text,encode(sha256(convert_to((to_jsonb(b)||jsonb_build_object('snapshot',private.enl_evidence_get(snapshot_hash),'snapshot_hash',null))::text,'UTF8')),'hex') from public.enl_incident_backups b
 ) current using(kind,id) where old.hash<>current.hash;
 if mismatches<>0 then raise exception 'evidence_migration_mismatch: %',mismatches;end if;
 if (select count(*) from enl_evidence_verify_before)<>(select count(*) from public.enl_incident_audit)+(select count(*) from public.enl_incident_revisions)+(select count(*) from public.enl_incident_backups) then raise exception 'evidence_migration_count_mismatch';end if;
end; $$;

alter table public.enl_incident_revisions add constraint enl_revision_before_available check(before_payload is not null or before_hash is not null),add constraint enl_revision_after_available check(after_payload is not null or after_hash is not null),add constraint enl_revision_changes_available check(changes is not null or changes_hash is not null);
alter table public.enl_incident_backups add constraint enl_backup_snapshot_available check(snapshot is not null or snapshot_hash is not null);
create trigger enl_audit_compact_insert before insert on public.enl_incident_audit for each row execute function private.enl_evidence_compact_insert();
create trigger enl_revision_compact_insert before insert on public.enl_incident_revisions for each row execute function private.enl_evidence_compact_insert();
create trigger enl_backup_compact_insert before insert on public.enl_incident_backups for each row execute function private.enl_evidence_compact_insert();

-- Preserve the audited-correction authorization check against the exact old document.
do $$ declare source text; begin
 select pg_get_functiondef('private.enl_bulk_lifecycle_guard()'::regprocedure) into source;
 if position('r.before_payload=p' in source)=0 then raise exception 'unrecognized_bulk_guard';end if;
 execute replace(source,'r.before_payload=p','coalesce(r.before_payload,private.enl_evidence_get(r.before_hash))=p');
end; $$;
$reviewed_evidence_activation$;
end;
$evidence_migration$;
commit;
