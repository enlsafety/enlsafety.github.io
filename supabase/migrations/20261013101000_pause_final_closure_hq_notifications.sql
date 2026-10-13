-- Temporarily suppress final closure notifications for headquarters managers
-- and executives. Existing queues, recipients and incident records are kept.
-- Apply only to the E&L incident project, not to other app schemas.
CREATE OR REPLACE FUNCTION public.enl_push_enqueue(
  p_user_id text,p_kind text,p_title text,p_body text,p_incident_id text,
  p_site_id text,p_data jsonb,p_token text
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(trim(p_user_id),'') = '' THEN RETURN; END IF;

  -- Preserve the pre-existing policy for safety-recipient approvals.
  IF p_kind IN ('incident_approved','action_approved','incident_closed')
     AND EXISTS (
       SELECT 1 FROM public.enl_hq_users h
       WHERE h.user_id=p_user_id AND h.active IS TRUE AND h.role='safety'
     ) THEN RETURN; END IF;

  -- Pause both push and trigger-derived email to HQ on FINAL closure only.
  IF p_kind IN ('action_approved','incident_closed')
     AND EXISTS (
       SELECT 1 FROM public.enl_hq_users h
       WHERE h.user_id=p_user_id AND h.active IS TRUE
         AND h.role IN ('manager','executive','final')
     ) THEN RETURN; END IF;

  INSERT INTO public.enl_push_events(
    event_key,incident_id,site_id,user_id,kind,title,body,data
  )
  VALUES(
    coalesce(p_incident_id,'none') || ':' || p_kind || ':' || p_token || ':' || p_user_id,
    nullif(p_incident_id,''),nullif(p_site_id,''),p_user_id,
    p_kind,p_title,p_body,coalesce(p_data,'{}'::jsonb)
  )
  ON CONFLICT(event_key) DO NOTHING;
END;
$function$;
