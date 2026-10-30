-- Opt-in temporary copies for approval-link testing. No existing event is replayed.
alter table public.enl_push_config add column approval_email_test_copy_enabled boolean not null default false;
comment on column public.enl_push_config.approval_email_test_copy_enabled is 'Temporary safety email copies at each executive approval stage; disable after link testing.';

-- Preserve one original email per push event. Test copies share its source and
-- use the existing unique event_key to deduplicate by incident/round/stage/user.
alter table public.enl_email_events drop constraint enl_email_events_source_push_event_id_key;
create unique index enl_email_events_original_source_key on public.enl_email_events(source_push_event_id)
 where kind <> 'executive_approval_test_copy';

create or replace function public.enl_email_from_push_trigger() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.kind in (
  'incident_new','urgent_incident','incident_resubmitted',
  'incident_supplement_requested','incident_supplement_submitted',
  'incident_approved','incident_rejected','prevention_plan_assigned',
  'action_submitted','action_resubmitted','action_rejected','action_approved',
  'incident_closed','executive_approval_requested','executive_approval_rejected'
 ) and coalesce(new.incident_id,'')<>'' then
  insert into public.enl_email_events(source_push_event_id,event_key,incident_id,site_id,user_id,kind)
  values(new.id,'email:'||new.event_key,new.incident_id,new.site_id,new.user_id,new.kind)
  on conflict (source_push_event_id) where kind <> 'executive_approval_test_copy' do nothing;
 end if;

 if new.kind='executive_approval_requested' and coalesce(new.incident_id,'')<>''
    and new.data->>'approvalStage' in ('parallel','president')
    and coalesce(new.data->>'approvalRound','')<>''
    and exists(select 1 from public.enl_push_config where id=1 and approval_email_test_copy_enabled=true) then
  insert into public.enl_email_events(source_push_event_id,event_key,incident_id,site_id,user_id,kind)
  select new.id,
   'approval-test:'||new.incident_id||':'||(new.data->>'approvalRound')||':'||(new.data->>'approvalStage')||':'||h.user_id,
   new.incident_id,new.site_id,h.user_id,'executive_approval_test_copy'
  from public.enl_hq_users h
  where h.active=true and h.role='safety' and h.email_enabled is distinct from false and coalesce(trim(h.email),'')<>''
  on conflict(event_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.enl_email_from_push_trigger() from public,anon,authenticated;
