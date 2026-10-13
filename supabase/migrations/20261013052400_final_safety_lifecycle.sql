-- Additive evidence only. No incident/user/attachment rows are rewritten.
create table public.enl_incident_revisions (
  incident_id text not null,
  revision integer not null check (revision>0),
  mutation_id text not null,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  editor_id text not null,
  editor_name text not null,
  created_at timestamptz not null default now(),
  changes jsonb not null,
  before_payload jsonb not null,
  after_payload jsonb not null,
  primary key (incident_id,revision),unique(incident_id,mutation_id)
);
create table public.enl_incident_operations (
  incident_id text not null,
  mutation_id text not null,
  action text not null,
  revision integer not null,
  editor_id text not null,
  editor_name text not null,
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  primary key(incident_id,mutation_id)
);
alter table public.enl_incident_revisions enable row level security;
alter table public.enl_incident_operations enable row level security;
revoke all on public.enl_incident_revisions,public.enl_incident_operations from public,anon,authenticated;
create or replace function public.enl_evidence_append_only() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'evidence_is_append_only' using errcode='42501'; end;
$$;
revoke all on function public.enl_evidence_append_only() from public,anon,authenticated;
create trigger enl_revision_immutable before update or delete on public.enl_incident_revisions for each row execute function public.enl_evidence_append_only();
create trigger enl_operation_immutable before update or delete on public.enl_incident_operations for each row execute function public.enl_evidence_append_only();
create trigger enl_audit_immutable before update or delete on public.enl_incident_audit for each row execute function public.enl_evidence_append_only();
alter table public.enl_incident_audit drop constraint enl_incident_audit_action_check;
alter table public.enl_incident_audit add constraint enl_incident_audit_action_check check(action in ('create','update','delete','restore','approve','reject','final_approval','post_approval_revision','supplement_request','supplement_submit','supplement_resubmit','corrective_submit','corrective_reject','corrective_approve','acknowledge','attachment_add','attachment_delete','cost_added','correct_closed','erp_record'));

-- Former approval APIs and stale clients cannot overwrite historical signatures.
create or replace function public.enl_final_record_guard() returns trigger
language plpgsql set search_path='' as $$
declare a jsonb:=nullif(current_setting('enl.actor',true),'')::jsonb;
begin
 if tg_op='DELETE' then raise exception 'incident_deletion_disabled' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if old.payload->'acknowledgements' is distinct from new.payload->'acknowledgements' then raise exception 'approval_retired_read_only' using errcode='42501'; end if;
  if old.payload->>'status'='closed' and old.payload is distinct from new.payload then
   if coalesce(a->>'role','')<>'safety' or not exists(select 1 from public.enl_hq_users where user_id=a->>'id' and role='safety' and active=true) then raise exception 'closed_safety_correction_only' using errcode='42501'; end if;
   if new.payload->>'status' is distinct from 'closed' or old.payload->'approvedAt' is distinct from new.payload->'approvedAt' or old.payload->'approvedBy' is distinct from new.payload->'approvedBy' or old.payload->'closedAt' is distinct from new.payload->'closedAt' or old.payload->'officialRecord'->'approval' is distinct from new.payload->'officialRecord'->'approval' or old.payload->'officialRecord'->'finalApproval' is distinct from new.payload->'officialRecord'->'finalApproval' then raise exception 'closure_history_immutable' using errcode='42501'; end if;
   if not exists(select 1 from public.enl_incident_revisions r where r.incident_id=new.incident_id and r.mutation_id=new.payload->>'_syncMutationId') and (old.payload-'officialRecord'-'_syncBaseVersion'-'_syncVersion'-'_syncMutationId'-'updatedAt'-'lastModifiedBy'-'lastModifiedAt'-'lastModifiedRole') is distinct from (new.payload-'officialRecord'-'_syncBaseVersion'-'_syncVersion'-'_syncMutationId'-'updatedAt'-'lastModifiedBy'-'lastModifiedAt'-'lastModifiedRole') then raise exception 'audited_correction_required' using errcode='42501'; end if;
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.enl_final_record_guard() from public,anon,authenticated;
create trigger trg_enl_final_record_guard before update or delete on public.enl_incident_shared for each row execute function public.enl_final_record_guard();

CREATE OR REPLACE FUNCTION public.enl_push_enqueue(p_user_id text, p_kind text, p_title text, p_body text, p_incident_id text, p_site_id text, p_data jsonb, p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if coalesce(trim(p_user_id),'') = '' then return; end if;

  -- Approval/closure events are initiated or finalized by safety.
  -- Suppress both app push and derived email for safety recipients only.
  if p_kind in ('incident_approved','action_approved','incident_closed')
     and exists (
       select 1
       from public.enl_hq_users h
       where h.user_id = p_user_id
         and h.active is true
         and h.role = 'safety'
     ) then
    return;
  end if;

  if p_kind in ('action_approved','incident_closed') and exists(select 1 from public.enl_hq_users h where h.user_id=p_user_id and h.role in ('manager','executive','final')) then return; end if;
  insert into public.enl_push_events(
    event_key, incident_id, site_id, user_id, kind, title, body, data
  )
  values (
    case when p_kind in ('incident_new','urgent_incident') then coalesce(p_incident_id,'none')||':initial_awareness:'||p_user_id else coalesce(p_incident_id,'none') || ':' || p_kind || ':' || p_token || ':' || p_user_id end,
    nullif(p_incident_id,''),
    nullif(p_site_id,''),
    p_user_id,
    p_kind,
    p_title,
    p_body,
    coalesce(p_data,'{}'::jsonb)
  )
  on conflict (event_key) do nothing;
end;
$function$;
CREATE OR REPLACE FUNCTION public.enl_incident_push_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  oldp jsonb := case when tg_op='INSERT' then '{}'::jsonb else coalesce(old.payload,'{}'::jsonb) end;
  newp jsonb := coalesce(new.payload,'{}'::jsonb);
  old_status text := coalesce(oldp->>'status','');
  new_status text := coalesce(newp->>'status','');
  old_action text := coalesce(oldp->'corrective'->>'status','');
  new_action text := coalesce(newp->'corrective'->>'status','');
  old_plan_at text := coalesce(oldp->'corrective'->>'planAt','');
  new_plan_at text := coalesce(newp->'corrective'->>'planAt','');
  v_site_id text := coalesce(new.site_id,newp->>'siteId','');
  v_site_name text := '';
  event_type text := coalesce(newp->>'eventType','사고');
  occurred_date text := left(coalesce(newp->>'occurredAt',''),10);
  token text := replace(clock_timestamp()::text,' ','T') || ':' || txid_current()::text;
  urgent boolean := false;
  r record;
  body_text text;
begin
  -- enl_bulk_silent_lifecycle_v1
  if nullif(current_setting('enl.bulk_actor',true),'') is not null and coalesce(new.payload->'historicalOrigin'->>'batchId','')<>'' then return new; end if;
  select coalesce(sm.site_name,sm.site_id) into v_site_name
  from public.enl_site_master sm where sm.site_id = v_site_id limit 1;
  if v_site_name is null or v_site_name='' then v_site_name := v_site_id; end if;

  urgent := lower(coalesce(newp->>'priority','')) in ('urgent','immediate')
    or lower(coalesce(newp->>'severity',''))='major'
    or lower(coalesce(newp->>'potentialMajor','false'))='true'
    or lower(coalesce(newp->>'fatal','false'))='true'
    or lower(coalesce(newp->>'fatality','false'))='true';
  body_text := trim(both ' · ' from concat_ws(' · ',nullif(v_site_name,''),nullif(occurred_date,''),nullif(event_type,'')));

  if tg_op='INSERT' and new_status='reported' then
    for r in select h.user_id from public.enl_hq_users h
      where h.active is true and h.role in ('safety','manager','executive') loop
      perform public.enl_push_enqueue(
        r.user_id,
        case when urgent then 'urgent_incident' else 'incident_new' end,
        case when urgent then '[긴급 즉시 사고보고] ' else '[즉시 사고보고] ' end||coalesce(v_site_name,'사업장'),
        body_text,
        new.incident_id,v_site_id,
        jsonb_build_object('view','incident','urgent',urgent,'stage','immediate','approvalRequired',false,'legalReportCompleted',false),
        token
      );
    end loop;
  end if;

  if tg_op='UPDATE' and old_status='rejected' and new_status='reported' then
    for r in select h.user_id from public.enl_hq_users h where h.active is true and h.role='safety' loop
      perform public.enl_push_enqueue(r.user_id,'incident_resubmitted','[사고보고 재제출] '||coalesce(v_site_name,'사업장'),body_text,new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','immediate'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_status is distinct from new_status and new_status='supplement' then
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'incident_supplement_requested','[사고보고 보완요청] '||coalesce(v_site_name,'사업장'),body_text||' · 보완자료 입력이 필요합니다.',new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','supplement'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_status is distinct from new_status and new_status='supplement_submitted' then
    for r in select h.user_id from public.enl_hq_users h where h.active is true and h.role='safety' loop
      perform public.enl_push_enqueue(r.user_id,'incident_supplement_submitted','[사고보고 보완완료] 검토해 주세요',body_text,new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','supplement_submitted'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_status is distinct from new_status and new_status='approved' then
    for r in select h.user_id from public.enl_hq_users h where h.active is true and h.role in ('safety','manager','executive') loop
      perform public.enl_push_enqueue(r.user_id,'incident_approved','[사고보고 승인] '||coalesce(v_site_name,'사업장'),body_text||' · 재발방지계획 단계로 진행합니다.',new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','approved'),token);
    end loop;
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'incident_approved','[사고보고 승인] '||coalesce(v_site_name,'사업장'),body_text||' · 재발방지계획 수립을 기다려 주세요.',new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','approved'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_status is distinct from new_status and new_status='rejected' then
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'incident_rejected','[사고보고 반려] '||coalesce(v_site_name,'사업장'),body_text||' · 반려 사유를 확인하고 수정해 주세요.',new.incident_id,v_site_id,jsonb_build_object('view','incident'),token);
    end loop;
  end if;

  if tg_op='UPDATE'
     and coalesce(old_plan_at,'')=''
     and coalesce(new_plan_at,'')<>''
     and new_action in ('planned','in_progress','rejected') then
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'prevention_plan_assigned','[재발방지계획 하달] '||coalesce(v_site_name,'사업장'),body_text||' · 재발방지계획을 확인하고 현장 조치를 진행해 주세요.',new.incident_id,v_site_id,jsonb_build_object('view','action','stage','plan_assigned'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_action is distinct from new_action and new_action='submitted' then
    for r in select h.user_id from public.enl_hq_users h where h.active is true and h.role='safety' loop
      perform public.enl_push_enqueue(r.user_id,case when old_action='rejected' then 'action_resubmitted' else 'action_submitted' end,case when old_action='rejected' then '[재발방지조치 재제출] ' else '[재발방지조치 제출] ' end||coalesce(v_site_name,'사업장'),body_text,new.incident_id,v_site_id,jsonb_build_object('view','action','urgent',urgent),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_action is distinct from new_action and new_action='rejected' then
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'action_rejected','[재발방지조치 보완요청] '||coalesce(v_site_name,'사업장'),body_text||' · 안전관리자 확인의견을 반영해 다시 제출해 주세요.',new.incident_id,v_site_id,jsonb_build_object('view','action'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_action is distinct from new_action and new_action='approved' then
    for r in select h.user_id from public.enl_hq_users h where h.active is true and h.role in ('safety','manager','executive') loop
      perform public.enl_push_enqueue(r.user_id,'action_approved','[재발방지조치 승인 · 사고종결] '||coalesce(v_site_name,'사업장'),body_text||' · 재발방지조치가 승인되어 사고가 종결되었습니다.',new.incident_id,v_site_id,jsonb_build_object('view','action','stage','closed'),token);
    end loop;
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'action_approved','[재발방지조치 승인 · 사고종결] '||coalesce(v_site_name,'사업장'),body_text||' · 재발방지조치가 승인되어 사고가 종결되었습니다.',new.incident_id,v_site_id,jsonb_build_object('view','action','stage','closed'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_status is distinct from new_status and new_status='closed'
     and not (old_action is distinct from new_action and new_action='approved') then
    for r in select h.user_id from public.enl_hq_users h where h.active is true and h.role in ('safety','manager','executive') loop
      perform public.enl_push_enqueue(r.user_id,'incident_closed','[사고 종결] '||coalesce(v_site_name,'사업장'),body_text,new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','closed'),token);
    end loop;
    for r in select p.personnel_id::text as personnel_id from public.enl_site_personnel p
      where p.active is true and p.site_id=v_site_id and p.access_role='field' and p.job_title in ('현장소장','파트장','서무') loop
      perform public.enl_push_enqueue(r.personnel_id,'incident_closed','[사고 종결] '||coalesce(v_site_name,'사업장'),body_text,new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','closed'),token);
    end loop;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.enl_bulk_lifecycle_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 if not authorized and p->>'status'='closed' and q->>'status'='closed' and approval_actor->>'role'='safety' and exists(select 1 from public.enl_incident_revisions r where r.incident_id=new.incident_id and r.mutation_id=q->>'_syncMutationId' and r.editor_id=approval_actor->>'id' and r.before_payload=p) then authorized:=true; end if;
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
$function$;
