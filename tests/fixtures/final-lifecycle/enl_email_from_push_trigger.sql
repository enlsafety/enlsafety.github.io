CREATE OR REPLACE FUNCTION public.enl_email_from_push_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.kind in (
    'incident_new','urgent_incident','incident_resubmitted',
    'incident_supplement_requested','incident_supplement_submitted',
    'incident_approved','incident_rejected',
    'prevention_plan_assigned',
    'action_submitted','action_resubmitted','action_rejected','action_approved',
    'incident_closed'
  ) and coalesce(new.incident_id,'') <> '' then
    insert into public.enl_email_events(
      source_push_event_id,event_key,incident_id,site_id,user_id,kind
    )
    values(
      new.id,'email:'||new.event_key,new.incident_id,new.site_id,new.user_id,new.kind
    )
    on conflict (source_push_event_id) do nothing;
  end if;
  return new;
end;
$function$
