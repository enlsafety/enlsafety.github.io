-- Add ERP-unverifiable historical accident registration without declaring prior approval.
-- Preserve existing verified imports and all other incident/approval protections.
-- Only the bulk lifecycle function changes; no production accident rows are mutated.
create or replace function private.enl_bulk_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
declare
 p jsonb := case when tg_op='INSERT' then null else old.payload end;
 q jsonb := case when tg_op='DELETE' then null else new.payload end;
 a jsonb := nullif(current_setting('enl.bulk_actor',true),'')::jsonb;
 old_bulk boolean := coalesce(p->'historicalOrigin'->>'batchId','')<>'';
 new_bulk boolean := coalesce(q->'historicalOrigin'->>'batchId','')<>'';
 authorized boolean := false;
 legacy_proof boolean := false;
 approval_actor jsonb := nullif(current_setting('enl.actor',true),'')::jsonb;
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
  if not authorized or jsonb_typeof(q->'corrective') is distinct from 'null'
    or q->>'approvedAt' is not null or coalesce(q->>'approvedBy','')<>''
    or coalesce(jsonb_array_length(q->'acknowledgements'),0)>0 then
   raise exception 'bulk_verified_import_required' using errcode='42501';
  end if;
  if q->'externalInitialApproval'->>'state'='verified' then
   if q->>'status' is distinct from 'approved' or q->'externalInitialApproval'->>'source' is distinct from 'ERP' then
    raise exception 'bulk_verified_import_required' using errcode='42501';
   end if;
  elsif q->'externalInitialApproval'->>'state'='unverifiable' then
   if q->>'status' is distinct from 'reported'
    or q->'externalInitialApproval'->>'source' is distinct from 'HISTORICAL_ARCHIVE'
    or q->'externalInitialApproval'->>'basis' not in ('pre_erp','pre_employment')
    or length(coalesce(q->'externalInitialApproval'->>'reason',''))<10
    or coalesce(q->'externalInitialApproval'->>'recordedBy','')<>coalesce(a->>'id','')
    or coalesce(q->'externalInitialApproval'->>'documentNo','')<>''
    or coalesce(q->'externalInitialApproval'->>'approvalDate','')<>''
    or q->'reportWorkflow'->>'initialApprovalSource' is distinct from 'HISTORICAL_UNVERIFIABLE'
    or coalesce(q->'officialRecord'->'historicalApprovalException'->>'status','')<>'not_verified'
    or q->'officialRecord'->'approval' is not null then
    raise exception 'bulk_legacy_exception_invalid' using errcode='42501';
   end if;
   select exists(
     select 1 from private.enl_historical_batches b
     cross join lateral jsonb_array_elements(b.candidates) c
     where b.owner_id=a->>'id'
       and b.id::text=q->'historicalOrigin'->>'batchId'
       and c->>'id'=q->'historicalOrigin'->>'candidateId'
       and c->'values'->>'legacyApprovalMode'=q->'externalInitialApproval'->>'basis'
       and c->'values'->>'legacyApprovalReason'=q->'externalInitialApproval'->>'reason'
       and c->'values'->>'legacyApprovalConfirmed'='confirmed'
       and exists(
         select 1 from jsonb_array_elements(coalesce(c->'corrections','[]'::jsonb)) a0
         where a0->>'field'='legacyApprovalMode' and a0->>'actorId'=a->>'id'
       )
       and exists(
         select 1 from jsonb_array_elements(coalesce(c->'corrections','[]'::jsonb)) a1
         where a1->>'field'='legacyApprovalReason' and a1->>'actorId'=a->>'id'
       )
       and exists(
         select 1 from jsonb_array_elements(coalesce(c->'corrections','[]'::jsonb)) a2
         where a2->>'field'='legacyApprovalConfirmed' and a2->>'actorId'=a->>'id'
       )
   ) into legacy_proof;
   if legacy_proof is distinct from true then
    raise exception 'bulk_legacy_exception_proof_required' using errcode='42501';
   end if;
  else
   raise exception 'bulk_approval_state_invalid' using errcode='42501';
  end if;
  return new;
 end if;
 if old_bulk is distinct from new_bulk or p->'externalInitialApproval' is distinct from q->'externalInitialApproval'
   or p->'historicalOrigin'->>'batchId' is distinct from q->'historicalOrigin'->>'batchId'
   or p->'historicalOrigin'->>'candidateId' is distinct from q->'historicalOrigin'->>'candidateId' then
  raise exception 'bulk_origin_immutable' using errcode='42501';
 end if;
 if p->'externalInitialApproval'->>'state'='unverifiable' then
   if coalesce(q->>'status','') not in ('reported','supplement','supplement_submitted','rejected','approved','closed')
     or q->'reportWorkflow'->>'initialApprovalSource' is distinct from 'HISTORICAL_UNVERIFIABLE' then
    raise exception 'bulk_legacy_workflow_invalid' using errcode='42501';
   end if;
   -- The old ERP approval is NEVER invented. A later in-app approval must be
   -- an actual authenticated safety decision with its own timestamp and audit.
   if (p->'approvedAt' is distinct from q->'approvedAt'
     or p->'approvedBy' is distinct from q->'approvedBy'
     or p->'officialRecord'->'approval' is distinct from q->'officialRecord'->'approval') then
     if coalesce(p->>'status','') in ('approved','closed')
       or q->>'status' is distinct from 'approved'
       or coalesce(approval_actor->>'role','')<>'safety'
       or coalesce(q->>'approvedAt','')=''
       or coalesce(q->>'approvedBy','')=''
       or q->'officialRecord'->'approval'->>'id' is distinct from approval_actor->>'id' then
      raise exception 'bulk_legacy_approval_proof_required' using errcode='42501';
     end if;
   elsif q->>'status'='approved' and coalesce(p->>'status','') not in ('approved','closed') then
    raise exception 'bulk_legacy_approval_proof_required' using errcode='42501';
   end if;
   if q->>'status'='closed' and coalesce(p->>'status','') not in ('approved','closed') then
    raise exception 'bulk_legacy_close_before_approval' using errcode='42501';
   end if;
 else
   if coalesce(q->>'status','') not in ('approved','closed')
     or p->'approvedAt' is distinct from q->'approvedAt'
     or p->'approvedBy' is distinct from q->'approvedBy'
     or p->'officialRecord'->'approval' is distinct from q->'officialRecord'->'approval' then
    raise exception 'bulk_initial_approval_immutable' using errcode='42501';
   end if;
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
