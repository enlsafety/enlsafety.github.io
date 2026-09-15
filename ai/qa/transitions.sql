-- Transactional fixture test. Not model output; all records are rolled back.
begin;
do $$
declare w jsonb; c jsonb; d jsonb; child jsonb; rid uuid:=gen_random_uuid(); wid uuid; n integer;
 result jsonb:='{"summary":"QA fixture only","facts":[],"findings":[],"missing_information":[],"official_sources":[],"confidence":0.8,"recommended_disposition":"human_review"}';
begin
 w:=public.ai_control_transition('create',null,jsonb_build_object('source_id','qa-transaction-only','request_id',rid,'incident','{}'::jsonb,'summary','QA transaction only'),'qa-transaction');wid:=(w->>'id')::uuid;
 d:=public.ai_control_transition('create',null,jsonb_build_object('request_id',rid),'qa-transaction');
 if d->>'id'<>w->>'id' then raise exception 'idempotency failed'; end if;
 for n in 1..4 loop
  c:=public.ai_control_transition('claim',wid);
  if c is null then raise exception 'claim failed'; end if;
  if public.ai_control_transition('claim',wid) is not null then raise exception 'duplicate claim'; end if;
  d:=public.ai_control_transition('finish',wid,jsonb_build_object('token',gen_random_uuid(),'result',result,'events','[]'::jsonb,'needs_human',true));
  if d is not null then raise exception 'foreign lease accepted'; end if;
  d:=public.ai_control_transition('finish',wid,jsonb_build_object('token',c->>'token','result',result,'model','QA-fixture-not-real-AI','meta','{}'::jsonb,'events','[]'::jsonb,'needs_human',true));
 end loop;
 if d->>'status'<>'awaiting_approval' then raise exception 'approval not requested'; end if;
 if (select count(*) from public.ai_agent_runs where workflow_id=wid and status='completed')<>4 then raise exception 'four runs missing'; end if;
 if (select count(*) from public.ai_agent_events where workflow_id=wid and event_type='handoff')<>3 then raise exception 'handoff events missing'; end if;
 d:=public.ai_control_transition('decide',wid,'{"decision":"held","note":"QA"}','qa-transaction');
 if d->>'status'<>'on_hold' then raise exception 'hold failed'; end if;
 d:=public.ai_control_transition('decide',wid,'{"decision":"re_review","note":"QA"}','qa-transaction');
 if d->>'retry_of'<>wid::text or d->>'status'<>'queued' then raise exception 're-review did not create work'; end if;
 wid:=(d->>'id')::uuid;c:=public.ai_control_transition('claim',wid);
 update public.ai_workflows set lease_until=now()-interval '1 second' where id=wid;
 perform public.ai_control_transition('claim',wid);
 if (select status from public.ai_workflows where id=wid)<>'failed' then raise exception 'expired lease not failed'; end if;
 child:=public.ai_control_transition('retry',wid,'{}','qa-transaction');
 d:=public.ai_control_transition('retry',wid,'{}','qa-transaction');
 if child->>'id'<>d->>'id' then raise exception 'duplicate retry'; end if;
 if has_table_privilege('anon','public.ai_agent_events','INSERT') or has_table_privilege('authenticated','public.ai_agent_events','SELECT') or has_function_privilege('anon','public.ai_control_transition(text,uuid,jsonb,text)','EXECUTE') then raise exception 'browser access leaked'; end if;
end $$;
rollback;
select 'PASS: transactional four-step run, events, idempotency, lease, hold, re-review, retry and browser isolation (fixtures rolled back)' as result;
