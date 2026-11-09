-- Only per-user feed read markers depend on these disposable event rows.
set local lock_timeout='4s';
alter table private.enl_activity_reads drop constraint enl_activity_reads_event_id_fkey,
 add constraint enl_activity_reads_event_id_fkey foreign key(event_id) references private.enl_activity_events(id) on delete cascade;
create or replace view private.enl_platform_history with(security_invoker=true) as
 select h.*,coalesce(x.display_text,h.sentence) as display_sentence,coalesce(x.module_key,case when split_part(h.kind,'_',1) in ('hq','site','personnel') then 'common' else 'incident' end) module_key,
 coalesce(x.result_label,case when h.kind in ('reject','executive_reject') then '반려' when h.kind in ('supplement_request','corrective_reject') then '보완요청'
 when h.kind in ('approve','corrective_approve','executive_sign') then '승인' when h.kind='final_approval' then '종결' else '처리완료' end) result_label
 from private.enl_workflow_history h join private.enl_activity_events x using(id)
 where nullif(btrim(h.actor_id),'') is not null and h.actor_role is distinct from 'system'
 and h.actor_id !~* '^(system(-v[0-9]+)?|roster-(import|reconcile)-[0-9]{8})$'
 and h.happened_at>now()-interval '720 hours';

delete from private.enl_activity_events where happened_at<=now()-interval '720 hours';
select cron.schedule('enl-feed-expiry','*/5 * * * *',
 $$delete from private.enl_activity_events where happened_at<=now()-interval '720 hours'$$);
