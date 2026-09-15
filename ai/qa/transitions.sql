-- Transactional fixture test. Not model output; all records are rolled back.
begin;
do $$
declare w jsonb; c jsonb; d jsonb; child jsonb; rid uuid:=gen_random_uuid(); wid uuid; n integer;
 result jsonb:='{"summary":"QA fixture only","facts":[],"findings":[],"missing_information":[],"official_sources":[],"confidence":0.8,"recommended_disposition":"human_review"}';
begin
 w:=public.ai_control_transition('create',null,jsonb_build_object('source_id','qa-transaction-only','request_id',rid,'incident','{}'::jsonb,'summary','QA transaction only'),'qa-transaction');wid:=(w->>'id')::uuid;
 d:=public.ai_control_transition('create',null,jsonb_build_object('request_id',rid),'qa-transaction');
 if d->>'id'<>w->>'id' then raise exception 'idempotency failed'; end if;
 d:=public.ai_control_transition('create',null,jsonb_build_object('source_id','qa-transaction-only','request_id',gen_random_uuid(),'incident','{}'::jsonb,'summary','QA transaction only'),'qa-transaction');
 if d->>'id'<>w->>'id' then raise exception 'duplicate active source created'; end if;
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
 d:=public.ai_control_transition('decide',wid,'{"decision":"approved","note":"QA"}','qa-transaction');
 if d->>'status'<>'completed' then raise exception 'held approval failed'; end if;
 d:=public.ai_control_transition('decide',wid,'{"decision":"re_review","note":"QA"}','qa-transaction');
 if d->>'retry_of'<>wid::text or d->>'status'<>'queued' then raise exception 're-review did not create work'; end if;
 wid:=(d->>'id')::uuid;c:=public.ai_control_transition('claim',wid);
 update public.ai_workflows set lease_until=now()-interval '1 second' where id=wid;
 perform public.ai_control_transition('claim',wid);
 if (select status from public.ai_workflows where id=wid)<>'failed' then raise exception 'expired lease not failed'; end if;
 child:=public.ai_control_transition('retry',wid,'{}','qa-transaction');
 d:=public.ai_control_transition('retry',wid,'{}','qa-transaction');
 if child->>'id'<>d->>'id' then raise exception 'duplicate retry'; end if;
 update public.ai_workflows set updated_at=now()-interval '3 minutes' where id=(child->>'id')::uuid;
 perform public.ai_expire_stalled_workflows();
 if (select status from public.ai_workflows where id=(child->>'id')::uuid)<>'failed' then raise exception 'queued watchdog failed'; end if;
 if exists(select 1 from public.ai_agent_runs where workflow_id=(child->>'id')::uuid) then raise exception 'watchdog launched an agent'; end if;
 w:=public.ai_control_transition('create',null,jsonb_build_object('source_type','safety_question','source_id','question','request_id',gen_random_uuid(),'incident','{"category":"question","summary":"QA question"}'::jsonb,'summary','QA question'),'qa-transaction');
 wid:=(w->>'id')::uuid;
 if w->>'source_type'<>'safety_question' or w->>'task_type'<>'safety_review' then raise exception 'question source lost'; end if;
 c:=public.ai_control_transition('claim',wid);
 perform public.ai_control_transition('fail',wid,jsonb_build_object('token',c->>'token','error','QA throttled','diagnostic','{"category":"rate_limit","http_status":429}'::jsonb,'retry_not_before',now()+interval '1 minute'));
 if not exists(select 1 from public.ai_agent_runs where workflow_id=wid and output_payload->'_meta'->'error'->>'category'='rate_limit') then raise exception 'diagnostic not atomic'; end if;
 begin
  perform public.ai_control_transition('retry',wid,'{}','qa-transaction');
  raise exception 'cooldown bypassed';
 exception when others then if sqlerrm <> 'retry_cooldown' then raise; end if; end;
 update public.ai_workflows set retry_not_before=now()-interval '1 second' where id=wid;
 d:=public.ai_control_transition('retry',wid,'{}','qa-transaction');
 if d->>'source_type'<>'safety_question' or d->'input_payload'->>'category'<>'question' then raise exception 'question retry lost input'; end if;
 if has_table_privilege('anon','public.ai_agent_events','INSERT') or has_table_privilege('authenticated','public.ai_agent_events','SELECT') or has_function_privilege('anon','public.ai_control_transition(text,uuid,jsonb,text)','EXECUTE') then raise exception 'browser access leaked'; end if;
end $$;
rollback;
select 'PASS: transactional four-step run, events, idempotency, lease, hold, re-review, retry and browser isolation (fixtures rolled back)' as result;
