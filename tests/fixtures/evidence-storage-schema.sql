-- Phase 1: additive only. Deploy hydrated readers before enabling compaction.
create schema if not exists private;
create table private.enl_evidence_objects (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  encoding text not null check (encoding in ('literal','object','array')),
  value jsonb not null,
  original_bytes bigint not null check (original_bytes >= 0),
  created_at timestamptz not null default now()
);
alter table private.enl_evidence_objects enable row level security;
revoke all on private.enl_evidence_objects from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert on private.enl_evidence_objects to service_role;
create trigger enl_evidence_objects_immutable before update or delete on private.enl_evidence_objects
  for each row execute function public.enl_evidence_append_only();

-- Each node has an explicit encoding. User JSON is never interpreted as a reference.
create function private.enl_evidence_get(p_hash text) returns jsonb
language plpgsql volatile strict set search_path='' as $$
declare r private.enl_evidence_objects%rowtype; result jsonb; item record; child jsonb;
begin
 select * into r from private.enl_evidence_objects where hash=p_hash;
 if not found then raise exception 'evidence_reference_missing' using errcode='23503'; end if;
 if r.encoding='literal' then result:=r.value;
 elsif r.encoding='object' then
  result:='{}'::jsonb;
  for item in select key,value from jsonb_each(r.value) loop
   child:=case when item.value ? 'ref' then private.enl_evidence_get(item.value->>'ref') else item.value->'value' end;
   result:=result || jsonb_build_object(item.key,child);
  end loop;
 elsif r.encoding='array' then
  result:='[]'::jsonb;
  for item in select value from jsonb_array_elements(r.value) loop
   child:=case when item.value ? 'ref' then private.enl_evidence_get(item.value->>'ref') else item.value->'value' end;
   result:=result || jsonb_build_array(child);
  end loop;
 end if;
 if result is null or octet_length(result::text)<>r.original_bytes
   or encode(sha256(convert_to(result::text,'UTF8')),'hex')<>p_hash then
  raise exception 'evidence_hash_mismatch' using errcode='22000';
 end if;
 return result;
end; $$;

create function private.enl_evidence_put(p_value jsonb) returns text
language plpgsql strict set search_path='' as $$
declare h text:=encode(sha256(convert_to(p_value::text,'UTF8')),'hex'); n bigint:=octet_length(p_value::text);
 kind text:='literal'; packed jsonb:=p_value; item record; child jsonb;
begin
 if exists(select 1 from private.enl_evidence_objects where hash=h) then
  if private.enl_evidence_get(h) is distinct from p_value then raise exception 'evidence_hash_collision'; end if;
  return h;
 end if;
 if n>2048 and jsonb_typeof(p_value)='object' then
  kind:='object'; packed:='{}'::jsonb;
  for item in select key,value from jsonb_each(p_value) loop
   child:=case when octet_length(item.value::text)>2048 then jsonb_build_object('ref',private.enl_evidence_put(item.value)) else jsonb_build_object('value',item.value) end;
   packed:=packed || jsonb_build_object(item.key,child);
  end loop;
 elsif n>2048 and jsonb_typeof(p_value)='array' then
  kind:='array'; packed:='[]'::jsonb;
  for item in select value from jsonb_array_elements(p_value) loop
   child:=case when octet_length(item.value::text)>2048 then jsonb_build_object('ref',private.enl_evidence_put(item.value)) else jsonb_build_object('value',item.value) end;
   packed:=packed || jsonb_build_array(child);
  end loop;
 end if;
 insert into private.enl_evidence_objects(hash,encoding,value,original_bytes) values(h,kind,packed,n) on conflict(hash) do nothing;
 if private.enl_evidence_get(h) is distinct from p_value then raise exception 'evidence_roundtrip_mismatch'; end if;
 return h;
end; $$;
revoke all on function private.enl_evidence_get(text),private.enl_evidence_put(jsonb) from public,anon,authenticated;
grant execute on function private.enl_evidence_get(text),private.enl_evidence_put(jsonb) to service_role;

alter table public.enl_incident_audit add column before_hash text references private.enl_evidence_objects(hash), add column after_hash text references private.enl_evidence_objects(hash);
alter table public.enl_incident_revisions add column before_hash text references private.enl_evidence_objects(hash), add column after_hash text references private.enl_evidence_objects(hash), add column changes_hash text references private.enl_evidence_objects(hash);
alter table public.enl_incident_backups add column snapshot_hash text references private.enl_evidence_objects(hash);

create function private.enl_evidence_compact_insert() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_table_name='enl_incident_backups' then
  new.snapshot_hash:=private.enl_evidence_put(new.snapshot);new.snapshot:=null;
 else
  new.before_hash:=private.enl_evidence_put(new.before_payload);new.before_payload:=null;
  new.after_hash:=private.enl_evidence_put(new.after_payload);new.after_payload:=null;
  if tg_table_name='enl_incident_revisions' then new.changes_hash:=private.enl_evidence_put(new.changes);new.changes:=null;end if;
 end if;
 return new;
end; $$;
revoke all on function private.enl_evidence_compact_insert() from public,anon,authenticated;
grant execute on function private.enl_evidence_compact_insert() to service_role;
