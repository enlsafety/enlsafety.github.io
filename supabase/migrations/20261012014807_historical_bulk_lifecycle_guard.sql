-- Scope corrections and logical invalidation to records created by this importer.
-- Existing manual transfers, ordinary incidents and workflow authorizations are retained.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.enl_bulk_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
declare
 p jsonb := case when tg_op='INSERT' then null else old.payload end;
 q jsonb := case when tg_op='DELETE' then null else new.payload end;
 a jsonb := nullif(current_setting('enl.bulk_actor',true),'')::jsonb;
 old_bulk boolean := coalesce(p->'historicalOrigin'->>'batchId','')<>'';
 new_bulk boolean := coalesce(q->'historicalOrigin'->>'batchId','')<>'';
 authorized boolean := false;
 protected_keys text[] := array['siteId','category','occurredAt','occurredDate','occurredTime','occurrenceTimeKnown','eventType','severity','summary','immediateAction','injuredName','job','leaveEstimate','reportDetails','reporterId','reporterName','historicalOrigin','externalInitialApproval','bulkInvalidation'];
 k text;
begin
 if not old_bulk and not new_bulk then return coalesce(new,old); end if;
 if tg_op='DELETE' then raise exception 'bulk_physical_delete_forbidden' using errcode='42501'; end if;
 if a is not null then
  select exists(select 1 from public.enl_hq_users u
    join private.enl_historical_batches b on b.owner_id=u.user_id
    where u.user_id=a->>'id' and u.role='safety' and u.active is true
      and b.id::text=coalesce(p->'historicalOrigin'->>'batchId',q->'historicalOrigin'->>'batchId')
      and exists(select 1 from jsonb_array_elements(b.candidates) c
        where c->>'id'=coalesce(p->'historicalOrigin'->>'candidateId',q->'historicalOrigin'->>'candidateId')))
   into authorized;
 end if;
 if tg_op='INSERT' then
  if not authorized or q->'externalInitialApproval'->>'state' is distinct from 'verified'
    or q->>'status' is distinct from 'approved' or jsonb_typeof(q->'corrective') is distinct from 'null'
    or q->>'approvedAt' is not null or coalesce(jsonb_array_length(q->'acknowledgements'),0)>0 then
   raise exception 'bulk_verified_import_required' using errcode='42501';
  end if;
  return new;
 end if;
 if old_bulk is distinct from new_bulk or p->'externalInitialApproval' is distinct from q->'externalInitialApproval'
   or p->'historicalOrigin'->>'batchId' is distinct from q->'historicalOrigin'->>'batchId'
   or p->'historicalOrigin'->>'candidateId' is distinct from q->'historicalOrigin'->>'candidateId' then
  raise exception 'bulk_origin_immutable' using errcode='42501';
 end if;
 if coalesce(q->>'status','') not in ('approved','closed')
   or p->'approvedAt' is distinct from q->'approvedAt'
   or p->'approvedBy' is distinct from q->'approvedBy'
   or p->'officialRecord'->'approval' is distinct from q->'officialRecord'->'approval' then
  raise exception 'bulk_initial_approval_immutable' using errcode='42501';
 end if;
 if coalesce(p->'bulkInvalidation'->>'active','false')='true' and not authorized then
  raise exception 'bulk_voided_read_only' using errcode='42501';
 end if;
 if not authorized then
  foreach k in array protected_keys loop
   if p->k is distinct from q->k then raise exception 'bulk_use_import_editor' using errcode='42501'; end if;
  end loop;
 end if;
 if p->'bulkInvalidation' is distinct from q->'bulkInvalidation' then
  if not authorized then raise exception 'bulk_invalidation_safety_only' using errcode='42501'; end if;
  if coalesce(q->'bulkInvalidation'->>'active','false')='true' and (
     p->>'status'='closed' or p->>'closedAt' is not null
     or (p->'corrective' is not null and p->'corrective'<>'null'::jsonb and p->'corrective'<>'{}'::jsonb)
     or coalesce(jsonb_array_length(p->'acknowledgements'),0)>0
     or p->'officialRecord' ?| array['review','approval','finalApproval']) then
   raise exception 'bulk_workflow_locked' using errcode='42501';
  end if;
 end if;
 return new;
end;
$body$;
revoke all on function private.enl_bulk_lifecycle_guard() from public,anon,authenticated;
drop trigger if exists trg_enl_bulk_lifecycle_guard on public.enl_incident_shared;
create trigger trg_enl_bulk_lifecycle_guard before insert or update or delete on public.enl_incident_shared
for each row execute function private.enl_bulk_lifecycle_guard();

-- Empty-origin maintenance calls do not authorize writes. Existing custom actor authentication
-- and optimistic version checks remain on the incident table and in each Edge Function.
-- Silent import/correction: retain the production push function body and its later workflow rules.
do $body$
declare definition text;
begin
 select pg_get_functiondef('public.enl_incident_push_trigger()'::regprocedure) into definition;
 if position('-- enl_bulk_silent_lifecycle_v1' in definition)=0 then
  definition := regexp_replace(definition,E'\\mbegin\\M', E'begin\n  -- enl_bulk_silent_lifecycle_v1\n  if nullif(current_setting(''enl.bulk_actor'',true),'''') is not null and coalesce(new.payload->''historicalOrigin''->>''batchId'','''')<>'''' then return new; end if;', 'i');
  execute definition;
 end if;
end;
$body$;
