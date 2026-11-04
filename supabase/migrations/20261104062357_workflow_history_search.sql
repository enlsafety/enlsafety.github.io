-- Keep underlying audit evidence intact. Index only user-facing workflow milestones.
create function private.enl_workflow_event(k text,r text) returns boolean
language sql immutable set search_path='' as $$
 select case when k='view' then r in ('safety','manager','final','executive')
 when k in ('update','delete','correct_closed','post_approval_revision','cause_save','cost_added') then r in ('safety','field')
 else k in ('create','approve','reject','resubmit','supplement_request','supplement_submit','supplement_resubmit',
 'plan_create','plan_edit','corrective_submit','corrective_reject','corrective_approve','executive_sign','executive_reject','final_approval') end;
$$;
alter table private.enl_activity_events add column listed boolean not null default true;
update private.enl_activity_events set listed=false where not coalesce(private.enl_workflow_event(kind,actor_role),false);
with ranked as (select id,row_number() over(partition by incident_id,actor_id order by happened_at,id) as rn
 from private.enl_activity_events where listed and kind='view')
update private.enl_activity_events set listed=false where id in(select id from ranked where rn>1);
create unique index enl_activity_first_open on private.enl_activity_events(incident_id,actor_id) where listed and kind='view';
create or replace function private.enl_activity_add(src text, iid text, ts timestamptz, uid text, uname text, urole text, site text, verb text, doc jsonb)
returns void language sql set search_path='' as $$
 insert into private.enl_activity_events(source_key,incident_id,happened_at,actor_id,actor_name,actor_role,site_id,site_name,incident_title,occurred_text,kind)
 select src,iid,ts,uid,uname,urole,site,(select site_name from public.enl_site_master where site_id=site),
 nullif(concat_ws(' / ',case when doc->>'category'='person' then '대인' when doc->>'category'='property' then '대물' end,
 nullif(doc->>'eventType',''),nullif(left(doc#>>'{reportDetails,place}',65),'')),''),coalesce(nullif(doc->>'occurredDate',''),doc->>'occurredAt'),verb
 where ts is not null and private.enl_workflow_event(verb,urole) on conflict do nothing;
$$;


-- Only operator and target labels go into the activity index, never account credentials or contact details.
create function private.enl_setting_activity(src text, target text, ts timestamptz, actor text, uname text, role_name text,
 site text, site_label text, target_label text, verb text)
returns void language sql set search_path='' as $$
 insert into private.enl_activity_events(source_key,incident_id,happened_at,actor_id,actor_name,actor_role,site_id,site_name,incident_title,kind)
 select src,target,ts,actor,uname,role_name,site,coalesce(nullif(site_label,''),(select site_name from public.enl_site_master where site_id=site)),
 left(target_label,100),verb where role_name in ('safety','field') and ts is not null on conflict do nothing;
$$;
create function private.enl_setting_audited() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='enl_personnel_audit' then
 perform private.enl_setting_activity('personnel:'||new.audit_id,coalesce(new.personnel_id::text,'unknown'),new.changed_at,new.editor_id,new.editor_name,new.editor_role,new.site_id,null,
 coalesce(new.after_payload->>'name',new.before_payload->>'name','근무자'),'personnel_'||new.action);
 else
 perform private.enl_setting_activity('site:'||new.audit_id,new.site_id,new.changed_at,new.editor_id,new.editor_name,new.editor_role,new.site_id,
 coalesce(new.after_payload->>'site_name',new.before_payload->>'site_name'),null,'site_'||new.action);
 end if;
 return null;
end; $$;
create trigger enl_workflow_personnel after insert on public.enl_personnel_audit for each row execute function private.enl_setting_audited();
create trigger enl_workflow_site after insert on public.enl_site_audit for each row execute function private.enl_setting_audited();
select private.enl_setting_activity('personnel:'||audit_id,coalesce(personnel_id::text,'unknown'),changed_at,editor_id,editor_name,editor_role,site_id,null,
 coalesce(after_payload->>'name',before_payload->>'name','근무자'),'personnel_'||action) from public.enl_personnel_audit;
select private.enl_setting_activity('site:'||audit_id,site_id,changed_at,editor_id,editor_name,editor_role,site_id,
 coalesce(after_payload->>'site_name',before_payload->>'site_name'),null,'site_'||action) from public.enl_site_audit;
create function private.enl_hq_setting_audited() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at'-'updated_by_id'-'updated_by_name'-'updated_by_role') =
 (to_jsonb(old)-'updated_at'-'updated_by_id'-'updated_by_name'-'updated_by_role') then return null; end if;
 perform private.enl_setting_activity('hq:'||gen_random_uuid(),new.user_id,clock_timestamp(),new.updated_by_id,new.updated_by_name,
 new.updated_by_role,null,'본사',new.name,case when tg_op='INSERT' then 'hq_create' else 'hq_update' end);
 return null;
end; $$;
-- Only the settings write includes the verified operator columns in its SET list.
create trigger enl_workflow_hq after insert or update of updated_by_id on public.enl_hq_users for each row execute function private.enl_hq_setting_audited();

-- One read snapshot per reviewer replaces one receipt for every event. An in-flight
-- write is not visible in the snapshot and will still be unread after it commits.
alter table private.enl_activity_events add column write_xid xid8 not null default pg_current_xact_id();
create table private.enl_history_checkpoints(actor_id text primary key, seen pg_snapshot not null, marked_at timestamptz not null);
alter table private.enl_history_checkpoints enable row level security;
revoke all on private.enl_history_checkpoints from public,anon,authenticated;
grant select,insert,update on private.enl_history_checkpoints to service_role;
create index enl_unseen_workflow_xid on private.enl_activity_events(write_xid) where listed;
create view private.enl_workflow_history with(security_invoker=true) as
select e.*,case actor_role when 'safety' then '안전관리자' when 'executive' then '경영진' when 'manager' then '본사실무자' when 'final' then '본사실무자' when 'field' then '현장관리자' when 'worker' then '근로자' else '역할 미기록' end as role_label,
 coalesce(nullif(actor_name,''),'작성자 미기록')||'님이 '||
 case when kind like 'hq_%' then '본사 ' else regexp_replace(coalesce(nullif(site_name,''),nullif(site_id,''),'미지정'),'\s*사업장$','')||' 사업장의 ' end ||
 case when kind like 'personnel_%' or kind like 'hq_%' then coalesce(incident_title,'대상')||' 사용자 계정을 '
 when kind like 'site_%' then '현장 정보를 '
 else case when split_part(incident_title,' / ',1) in ('대인','대물') then split_part(incident_title,' / ',1)||'사고'||
 case when strpos(incident_title,' / ')>0 then '('||replace(substr(incident_title,strpos(incident_title,' / ')+3),' / ',', ')||')' else '' end
 else coalesce(incident_title,incident_id)||' 사고' end end ||
 case kind
 when 'create' then ' 보고서를 최초 등록했습니다.' when 'view' then ' 보고서를 처음 조회했습니다.'
 when 'approve' then ' 보고서를 최초 승인했습니다.' when 'supplement_request' then ' 보고서의 자료 보완을 요청했습니다.'
 when 'reject' then ' 보고서를 반려했습니다.' when 'resubmit' then ' 보고서를 수정해 다시 제출했습니다.'
 when 'supplement_submit' then '의 보완자료를 제출했습니다.' when 'supplement_resubmit' then '의 보완자료를 다시 제출했습니다.'
 when 'plan_create' then '의 재발방지계획을 작성해 현장에 조치를 요청했습니다.' when 'plan_edit' then '의 재발방지계획을 수정했습니다.'
 when 'corrective_submit' then '의 재발방지조치를 작성해 안전관리자에게 제출했습니다.'
 when 'corrective_reject' then '의 재발방지조치에 보완을 요청했습니다.'
 when 'corrective_approve' then '의 재발방지조치를 승인해 경영진에 최종 결재를 요청했습니다.'
 when 'executive_sign' then ' 보고서의 경영진 결재를 완료했습니다.' when 'executive_reject' then ' 보고서의 경영진 결재를 반려했습니다.'
 when 'final_approval' then case when actor_role='executive' then ' 보고서의 최종 결재를 완료해 사고를 종결했습니다.' else '의 종결 처리를 완료했습니다.' end
 when 'delete' then ' 보고서를 삭제했습니다.' when 'correct_closed' then ' 보고서를 정정했습니다.' when 'cause_save' then '의 원인분석을 저장했습니다.'
 when 'cost_added' then '의 비용을 추가했습니다.' when 'update' then ' 보고서를 수정했습니다.' when 'post_approval_revision' then ' 보고서를 수정했습니다.'
 when 'personnel_create' then '등록했습니다.' when 'personnel_delete' then '삭제했습니다.' when 'personnel_retire' then '퇴사 처리했습니다.'
 when 'personnel_reactivate' then '다시 활성화했습니다.' when 'hq_create' then '등록했습니다.' when 'site_create' then '등록했습니다.'
 else '수정했습니다.' end as sentence
from private.enl_activity_events e where listed;
revoke all on private.enl_workflow_history from public,anon,authenticated;
grant select on private.enl_workflow_history to service_role;
revoke all on function private.enl_workflow_event(text,text), private.enl_setting_activity(text,text,timestamptz,text,text,text,text,text,text,text),
 private.enl_setting_audited(),private.enl_hq_setting_audited() from public,anon,authenticated;
grant execute on function private.enl_workflow_event(text,text), private.enl_setting_activity(text,text,timestamptz,text,text,text,text,text,text,text),
 private.enl_setting_audited(),private.enl_hq_setting_audited() to service_role;
