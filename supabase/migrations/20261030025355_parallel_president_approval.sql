-- Enforce parallel executive approval followed by the roster's president.
-- Existing incidents, account preferences and historical signatures are not rewritten.
create or replace function public.enl_executive_final_id(ap jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare result text; n integer;
begin
 select count(*),min(r->>'id') into n,result from jsonb_array_elements(coalesce(ap->'roster','[]'::jsonb)) r
 where regexp_replace(coalesce(r->>'position',''),'\s','','g')='사장';
 if n<>1 or coalesce(result,'')='' or (ap->>'finalApproverId' is not null and ap->>'finalApproverId'<>result) then return null; end if;
 return result;
end; $$;
revoke all on function public.enl_executive_final_id(jsonb) from public,anon,authenticated;

create or replace function public.enl_executive_can_decide(ap jsonb,uid text) returns boolean
language plpgsql immutable set search_path='' as $$
declare final_id text:=public.enl_executive_final_id(ap);
begin
 if coalesce(ap->>'state','')<>'pending' or final_id is null or coalesce(uid,'')='' then return false; end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(ap->'roster','[]'::jsonb)) r where r->>'id'=uid) then return false; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(ap->'signatures','[]'::jsonb)) s where s->>'id'=uid and s->>'decision'='approve') then return false; end if;
 if uid=final_id and exists(
  select 1 from jsonb_array_elements(ap->'roster') r where r->>'id'<>final_id and not exists(
   select 1 from jsonb_array_elements(coalesce(ap->'signatures','[]'::jsonb)) s where s->>'id'=r->>'id' and s->>'decision'='approve'
  )
 ) then return false; end if;
 return true;
end; $$;
revoke all on function public.enl_executive_can_decide(jsonb,text) from public,anon,authenticated;

create or replace function public.enl_executive_record_guard() returns trigger language plpgsql set search_path='' as $$
declare p jsonb:=old.payload; q jsonb:=new.payload; a jsonb:=nullif(current_setting('enl.actor',true),'')::jsonb;
begin
 if p->>'status'='closed' and (p->'executiveApproval' is distinct from q->'executiveApproval' or p->'officialRecord'->'documentNumber' is distinct from q->'officialRecord'->'documentNumber') then raise exception 'closure_history_immutable'; end if;
 if p->'executiveApproval'->>'state'='pending' and p is distinct from q and coalesce(current_setting('enl.executive_decision',true),'')<>'1' then raise exception 'executive_review_in_progress'; end if;
 if p->'executiveApproval'->>'state'='pending' and p is distinct from q then
  if a->>'role' is distinct from 'executive' or not public.enl_executive_can_decide(p->'executiveApproval',a->>'id') then raise exception 'approval_turn_not_ready'; end if;
  if (p->'executiveApproval'->'roster',p->'executiveApproval'->'round',p->'executiveApproval'->'requestedAt',p->'executiveApproval'->'finalApproverId') is distinct from (q->'executiveApproval'->'roster',q->'executiveApproval'->'round',q->'executiveApproval'->'requestedAt',q->'executiveApproval'->'finalApproverId') then raise exception 'approval_plan_immutable'; end if;
 end if;
 if p->>'status'<>'closed' and q->>'status'='closed' and not coalesce(q->'historicalImport'->>'workflowExempt'='true',false) then
  if coalesce(current_setting('enl.executive_decision',true),'')<>'1' or a->>'role' is distinct from 'executive' or q->'executiveApproval'->>'state' is distinct from 'approved' or jsonb_array_length(q->'executiveApproval'->'roster')<1 then raise exception 'executive_approval_required'; end if;
  if public.enl_executive_final_id(p->'executiveApproval') is null or a->>'id' is distinct from public.enl_executive_final_id(p->'executiveApproval') then raise exception 'president_final_approval_required'; end if;
  if exists(select 1 from jsonb_array_elements(q->'executiveApproval'->'roster') r where not exists(select 1 from jsonb_array_elements(q->'executiveApproval'->'signatures') v where v->>'id'=r->>'id' and v->>'decision'='approve')) then raise exception 'all_executive_approvals_required'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.enl_executive_record_guard() from public,anon,authenticated;

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

  if tg_op='UPDATE' and old_action is distinct from new_action and new_action='submitted' and coalesce(newp->'executiveApproval'->>'state','')<>'rejected' then
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

  if tg_op='UPDATE' and newp->'executiveApproval'->>'state'='pending' then
    for r in select h.user_id from public.enl_hq_users h where h.active=true and h.role='executive'
      and public.enl_executive_can_decide(newp->'executiveApproval',h.user_id)
      and (oldp->'executiveApproval'->'round' is distinct from newp->'executiveApproval'->'round'
        or not public.enl_executive_can_decide(oldp->'executiveApproval',h.user_id)) loop
      perform public.enl_push_enqueue(r.user_id,'executive_approval_requested',
        case when r.user_id=public.enl_executive_final_id(newp->'executiveApproval') then '[사장 최종결재 요청] ' else '[경영진 병렬결재 요청] ' end||v_site_name,
        body_text||case when r.user_id=public.enl_executive_final_id(newp->'executiveApproval') then ' / 병렬결재가 모두 완료되었습니다. 최종결재를 진행해 주세요.' else ' / 순서 없이 병렬결재를 진행해 주세요.' end,
        new.incident_id,v_site_id,jsonb_build_object('view','incident','stage','executive_approval','approvalRound',newp->'executiveApproval'->'round',
          'approvalStage',case when r.user_id=public.enl_executive_final_id(newp->'executiveApproval') then 'president' else 'parallel' end),
        'approval-round:'||(newp->'executiveApproval'->>'round')||':'||case when r.user_id=public.enl_executive_final_id(newp->'executiveApproval') then 'president' else 'parallel' end);
    end loop;
  end if;
  if tg_op='UPDATE' and newp->'executiveApproval'->>'state'='rejected' and oldp->'executiveApproval'->>'state'='pending' then
    for r in select user_id from public.enl_hq_users where active=true and role='safety' loop
      perform public.enl_push_enqueue(r.user_id,'executive_approval_rejected','[경영진 결재 반려] '||v_site_name,newp->'executiveApproval'->'rejection'->>'note',new.incident_id,v_site_id,jsonb_build_object('view','action'),token);
    end loop;
  end if;

  if tg_op='UPDATE' and old_status is distinct from new_status and new_status='closed' then
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
