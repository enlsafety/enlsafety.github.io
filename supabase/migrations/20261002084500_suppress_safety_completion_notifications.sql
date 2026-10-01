-- Notification policy: safety users do not need self-completion notifications.
-- Keep urgent/new report, supplement submission, inquiry and action-submission alerts unchanged.
create or replace function public.enl_push_enqueue(
  p_user_id text,
  p_kind text,
  p_title text,
  p_body text,
  p_incident_id text,
  p_site_id text,
  p_data jsonb,
  p_token text
)
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if coalesce(trim(p_user_id),'') = '' then return; end if;

  -- Approval/closure events are initiated or finalized by safety.
  -- Suppress both app push and derived email for safety recipients only.
  if p_kind in ('incident_approved','action_approved','incident_closed')
     and exists (
       select 1
       from public.enl_hq_users h
       where h.user_id = p_user_id
         and h.active is true
         and h.role = 'safety'
     ) then
    return;
  end if;

  insert into public.enl_push_events(
    event_key, incident_id, site_id, user_id, kind, title, body, data
  )
  values (
    coalesce(p_incident_id,'none') || ':' || p_kind || ':' || p_token || ':' || p_user_id,
    nullif(p_incident_id,''),
    nullif(p_site_id,''),
    p_user_id,
    p_kind,
    p_title,
    p_body,
    coalesce(p_data,'{}'::jsonb)
  )
  on conflict (event_key) do nothing;
end;
$function$;
