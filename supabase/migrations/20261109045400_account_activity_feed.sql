-- Historic personal actions survive later retirement or deletion of an account.
create or replace view private.enl_platform_history with(security_invoker=true) as
 select h.*,coalesce(x.display_text,h.sentence) as display_sentence,coalesce(x.module_key,case when split_part(h.kind,'_',1) in ('hq','site','personnel') then 'common' else 'incident' end) module_key,
 coalesce(x.result_label,case when h.kind in ('reject','executive_reject') then '반려' when h.kind in ('supplement_request','corrective_reject') then '보완요청'
 when h.kind in ('approve','corrective_approve','executive_sign') then '승인' when h.kind='final_approval' then '종결' else '처리완료' end) result_label
 from private.enl_workflow_history h join private.enl_activity_events x using(id)
 where nullif(btrim(h.actor_id),'') is not null and h.actor_role is distinct from 'system'
 and h.actor_id !~* '^(system(-v[0-9]+)?|roster-(import|reconcile)-[0-9]{8})$';

-- Classify new events at write time, while the operator's account is available.
-- Offline jobs using a real operator ID can mark their transaction as maintenance.
create function private.enl_account_activity_only() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_setting('enl.activity_origin',true)='maintenance'
    or current_setting('application_name',true)='mgmt-api'
    or current_setting('application_name',true) like 'pg_cron%'
    or nullif(btrim(new.actor_id),'') is null or new.actor_role='system'
    or new.actor_id ~* '^(system(-v[0-9]+)?|roster-(import|reconcile)-[0-9]{8})$' then return null; end if;
 if not exists(select 1 from public.enl_hq_users where user_id=new.actor_id)
    and not exists(select 1 from public.enl_site_personnel where personnel_id::text=new.actor_id) then return null; end if;
 return new;
end $$;
create trigger enl_account_activity_only before insert on private.enl_activity_events
 for each row execute function private.enl_account_activity_only();
