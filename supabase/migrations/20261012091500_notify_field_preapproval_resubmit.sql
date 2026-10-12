-- Field pre-approval corrections: notify the safety reviewer only when the same
-- pending report is materially edited and resubmitted by the field.
-- Existing rejected -> reported notifications, approvals, and ERP are untouched.

create or replace function public.enl_is_preapproval_report_correction(
  before_payload jsonb,
  after_payload jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $guard$
  select coalesce(before_payload->>'status','') = 'reported'
     and coalesce(after_payload->>'status','') = 'reported'
     and nullif(coalesce(after_payload->>'resubmittedAt',''),'') is not null
     and (before_payload->>'resubmittedAt') is distinct from (after_payload->>'resubmittedAt')
     and (
       (coalesce(before_payload->'reportDetails','{}'::jsonb) - 'recordedAt')
         is distinct from
       (coalesce(after_payload->'reportDetails','{}'::jsonb) - 'recordedAt')
       or before_payload->'photos' is distinct from after_payload->'photos'
       or before_payload->>'summary' is distinct from after_payload->>'summary'
       or before_payload->>'occurredAt' is distinct from after_payload->>'occurredAt'
       or before_payload->>'siteId' is distinct from after_payload->>'siteId'
       or before_payload->>'category' is distinct from after_payload->>'category'
       or before_payload->>'eventType' is distinct from after_payload->>'eventType'
       or before_payload->>'injuredName' is distinct from after_payload->>'injuredName'
       or before_payload->>'job' is distinct from after_payload->>'job'
       or before_payload->>'immediateAction' is distinct from after_payload->>'immediateAction'
       or before_payload->>'severity' is distinct from after_payload->>'severity'
       or before_payload->>'leaveEstimate' is distinct from after_payload->>'leaveEstimate'
       or before_payload->>'potentialMajor' is distinct from after_payload->>'potentialMajor'
     );
$guard$;

create or replace function public.enl_incident_preapproval_reedit_notify()
returns trigger
language plpgsql
set search_path = ''
as $trigger$
declare
  reviewer record;
  site_label text;
  notice_body text;
  event_token text := replace(clock_timestamp()::text,' ','T') || ':' || txid_current()::text;
begin
  if not public.enl_is_preapproval_report_correction(old.payload,new.payload) then
    return new;
  end if;

  select coalesce(sm.site_name,sm.site_id) into site_label
    from public.enl_site_master sm where sm.site_id=new.site_id limit 1;
  site_label := coalesce(nullif(site_label,''),new.site_id,'사업장');
  notice_body := concat_ws(' · ',
    site_label,
    nullif(left(coalesce(new.payload->>'occurredAt',''),10),''),
    nullif(coalesce(new.payload->>'eventType',''),''),
    '안전관리자 승인 전 수정된 보고내용을 다시 확인해 주세요.'
  );

  -- Reuse incident_resubmitted: web-push preferences + email bridge already handle it.
  -- Do NOT notify HQ readers, field recipients, or the ERP.
  for reviewer in
    select h.user_id from public.enl_hq_users h
    where h.active is true and h.role='safety'
  loop
    perform public.enl_push_enqueue(
      reviewer.user_id,
      'incident_resubmitted',
      '[사고보고 수정·재제출] ' || site_label,
      notice_body,
      new.incident_id,
      new.site_id,
      jsonb_build_object('view','incident','stage','immediate','preapprovalCorrection',true),
      event_token
    );
  end loop;

  return new;
end;
$trigger$;

drop trigger if exists trg_enl_incident_preapproval_reedit_notify on public.enl_incident_shared;
create trigger trg_enl_incident_preapproval_reedit_notify
after update of payload on public.enl_incident_shared
for each row
when (old.payload is distinct from new.payload)
execute function public.enl_incident_preapproval_reedit_notify();
