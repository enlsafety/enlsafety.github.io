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
