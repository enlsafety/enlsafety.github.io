-- Staging control room. Custom application sessions are checked by the Edge API.
-- Deliberately no anon/authenticated policies or RPC grants.
create table public.ai_agent_events (
 id uuid primary key default gen_random_uuid(),
 workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
 agent_run_id uuid references public.ai_agent_runs(id) on delete set null,
 agent_id text not null check(agent_id in ('incident_manager','legal_reviewer','final_auditor','safety_director')),
 event_type text not null, title text not null, detail text,
 status text, progress integer check(progress between 0 and 100),
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index ai_events_workflow_time on public.ai_agent_events(workflow_id,created_at,id);
create index ai_events_agent_time on public.ai_agent_events(agent_id,created_at desc);
create index ai_events_time on public.ai_agent_events(created_at desc,id);
create index ai_events_run on public.ai_agent_events(agent_run_id);
alter table public.ai_agent_events enable row level security;
revoke all on public.ai_agent_events from anon,authenticated;
grant all on public.ai_agent_events to service_role;
alter table public.ai_workflows
 add column input_payload jsonb not null default '{}'::jsonb,
 add column step_index integer not null default 0 check(step_index between 0 and 4),
 add column lease_token uuid,
 add column lease_until timestamptz,
 add column request_id uuid,
 add column retry_of uuid references public.ai_workflows(id);
create unique index ai_workflow_request on public.ai_workflows(requested_by,request_id) where request_id is not null;
create unique index ai_workflow_retry on public.ai_workflows(retry_of) where retry_of is not null;
create index ai_workflow_lease on public.ai_workflows(lease_until) where status='running';

-- One transaction for every transition: events cannot disagree with persisted state.
create or replace function public.ai_control_transition(p_op text,p_id uuid,p_data jsonb default '{}',p_actor text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 w public.ai_workflows; r public.ai_agent_runs; a public.ai_approvals;
 child public.ai_workflows; aid text; token uuid; x jsonb; result jsonb; need boolean;
 agents text[] := array['incident_manager','legal_reviewer','final_auditor','safety_director'];
begin
 if p_op='create' then
  perform pg_advisory_xact_lock(hashtextextended('ai-create',0));
  select * into w from public.ai_workflows where requested_by=p_actor and request_id=(p_data->>'request_id')::uuid;
  if found then return to_jsonb(w); end if;
  if (select count(*) from public.ai_workflows where status in ('queued','running'))>=4 then raise exception 'capacity_reached'; end if;
  insert into public.ai_workflows(source_type,source_id,task_type,status,priority,current_agent,input_summary,input_payload,requested_by,request_id)
   values('incident',p_data->>'source_id','incident_review','queued',coalesce(p_data->>'priority','normal'),agents[1],p_data->>'summary',p_data->'incident',p_actor,(p_data->>'request_id')::uuid) returning * into w;
  insert into public.ai_agent_events(workflow_id,agent_id,event_type,title,status,progress)
   values(w.id,'safety_director','workflow_created','사고 검토 지시 접수','queued',0);
  return to_jsonb(w);
 end if;
 select * into w from public.ai_workflows where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if p_op='claim' then
  if w.status='running' and w.lease_until<now() then
   update public.ai_agent_runs set status='failed',error_message='실행 제한시간 초과. 재시도해 주세요.',completed_at=now() where workflow_id=w.id and status='running' returning * into r;
   update public.ai_workflows set status='failed',lease_token=null,lease_until=null,completed_at=now(),updated_at=now() where id=w.id;
   insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,status) values(w.id,r.id,w.current_agent,'failed','실행 제한시간 초과 · 재시도 필요','failed');
   return null;
  end if;
  if w.status<>'queued' or w.step_index>=4 then return null; end if;
  token:=gen_random_uuid(); aid:=agents[w.step_index+1];
  update public.ai_workflows set status='running',current_agent=aid,lease_token=token,lease_until=now()+interval '120 seconds',started_at=coalesce(started_at,now()),updated_at=now() where id=w.id returning * into w;
  insert into public.ai_agent_runs(workflow_id,agent_id,task_type,status,started_at) values(w.id,aid,'incident_review','running',now()) returning * into r;
  insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,status,progress) values
   (w.id,r.id,aid,'task_received','검토 업무 수신','received',0),
   (w.id,r.id,aid,'agent_started','검토 시작','analyzing',10);
  return jsonb_build_object('workflow',to_jsonb(w),'run',to_jsonb(r),'token',token);
 end if;
 if p_op='finish' or p_op='fail' then
  if w.status<>'running' or w.lease_token is distinct from (p_data->>'token')::uuid then return null; end if;
  select * into r from public.ai_agent_runs where workflow_id=w.id and status='running' for update;
  if not found then raise exception 'run_not_found'; end if;
  if p_op='fail' then
   update public.ai_agent_runs set status='failed',error_message=p_data->>'error',completed_at=now() where id=r.id;
   update public.ai_workflows set status='failed',lease_token=null,lease_until=null,completed_at=now(),updated_at=now() where id=w.id;
   insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,detail,status) values(w.id,r.id,r.agent_id,'failed','에이전트 처리 실패',p_data->>'error','failed');
   return jsonb_build_object('status','failed');
  end if;
  result:=p_data->'result'; need:=coalesce((p_data->>'needs_human')::boolean,true);
  update public.ai_agent_runs set status='completed',model=p_data->>'model',output_payload=result || jsonb_build_object('_meta',p_data->'meta'),result_summary=result->>'summary',confidence=(result->>'confidence')::numeric,requires_human_approval=need,completed_at=now() where id=r.id;
  for x in select value from jsonb_array_elements(result->'findings') loop
   insert into public.ai_findings(workflow_id,agent_run_id,agent_id,finding_type,severity,title,detail,legal_obligation,practical_recommendation,uncertainty,official_sources,source_checked_at,confidence,requires_human_approval)
   values(w.id,r.id,r.agent_id,x->>'finding_type',x->>'severity',x->>'title',x->>'detail',x->>'legal_obligation',x->>'practical_recommendation',x->>'uncertainty',result->'official_sources',case when jsonb_array_length(result->'official_sources')>0 then now() end,(result->>'confidence')::numeric,(x->>'requires_human_approval')::boolean);
  end loop;
  for x in select value from jsonb_array_elements(p_data->'events') loop
   insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,detail,status,progress,metadata)
   values(w.id,r.id,r.agent_id,x->>'event_type',x->>'title',x->>'detail',x->>'status',(x->>'progress')::integer,coalesce(x->'metadata','{}'));
  end loop;
  insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,status,progress) values(w.id,r.id,r.agent_id,'completed','담당 검토 완료','completed',100);
  if w.step_index<3 then
   update public.ai_workflows set status='queued',step_index=step_index+1,current_agent=agents[w.step_index+2],lease_token=null,lease_until=null,updated_at=now() where id=w.id;
   insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,status,progress,metadata) values(w.id,r.id,r.agent_id,'handoff','다음 담당자에게 업무 인계','handoff',100,jsonb_build_object('to_agent',agents[w.step_index+2]));
   return jsonb_build_object('status','queued');
  end if;
  need:=need or exists(select 1 from public.ai_agent_runs where workflow_id=w.id and requires_human_approval);
  update public.ai_workflows set status=case when need then 'awaiting_approval' else 'completed' end,step_index=4,priority=case when p_data->>'urgent'='true' then 'urgent' else priority end,result_summary=result->>'summary',requires_human_approval=need,lease_token=null,lease_until=null,completed_at=now(),updated_at=now() where id=w.id returning * into w;
  if need then
   insert into public.ai_approvals(workflow_id,status,approval_type,summary,requested_for) values(w.id,'pending','final_review',result->>'summary','safety');
   insert into public.ai_agent_events(workflow_id,agent_run_id,agent_id,event_type,title,status,progress) values(w.id,r.id,r.agent_id,'human_review_required','최종 보고 작성 완료 · 안전관리자 확인 필요','awaiting_approval',100);
  end if;
  return jsonb_build_object('status',w.status);
 end if;
 if p_op='decide' or p_op='retry' then
  if p_op='retry' and w.status not in ('failed','re_review_requested') then raise exception 'invalid_state'; end if;
  if p_op='decide' then
   if w.status not in ('awaiting_approval','on_hold') or p_data->>'decision' not in ('approved','held','re_review') then raise exception 'invalid_state'; end if;
   select * into a from public.ai_approvals where workflow_id=w.id and status in ('pending','held') order by created_at desc limit 1 for update;
   if not found then raise exception 'approval_not_found'; end if;
   update public.ai_approvals set status=case when p_data->>'decision'='re_review' then 'recheck_requested' else p_data->>'decision' end,decision_note=p_data->>'note',decided_by=p_actor,decided_at=now(),updated_at=now() where id=a.id;
   update public.ai_workflows set status=case p_data->>'decision' when 'approved' then 'completed' when 'held' then 'on_hold' else 're_review_requested' end,approved_by=case when p_data->>'decision'='approved' then p_actor end,approved_at=case when p_data->>'decision'='approved' then now() end,updated_at=now() where id=w.id returning * into w;
   insert into public.ai_agent_events(workflow_id,agent_id,event_type,title,detail,status,progress,metadata) values(w.id,'safety_director','human_decision',case p_data->>'decision' when 'approved' then '안전관리자 승인' when 'held' then '안전관리자 보류' else '재검토 요청 접수' end,p_data->>'note',w.status,100,jsonb_build_object('actor_id',p_actor));
   if p_data->>'decision'<>'re_review' then return to_jsonb(w); end if;
  end if;
  select * into child from public.ai_workflows where retry_of=w.id;
  if found then return to_jsonb(child); end if;
  perform pg_advisory_xact_lock(hashtextextended('ai-create',0));
  if (select count(*) from public.ai_workflows where status in ('queued','running'))>=4 then raise exception 'capacity_reached'; end if;
  insert into public.ai_workflows(source_type,source_id,task_type,status,priority,current_agent,input_summary,input_payload,requested_by,retry_of)
   values(w.source_type,w.source_id,w.task_type,'queued',w.priority,agents[1],w.input_summary,coalesce(p_data->'incident',w.input_payload),p_actor,w.id) returning * into child;
  insert into public.ai_agent_events(workflow_id,agent_id,event_type,title,status,progress,metadata) values(child.id,'safety_director','workflow_created','이전 업무에서 재검토 시작','queued',0,jsonb_build_object('retry_of',w.id));
  return to_jsonb(child);
 end if;
 raise exception 'invalid_operation';
end $$;
revoke all on function public.ai_control_transition(text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.ai_control_transition(text,uuid,jsonb,text) to service_role;
