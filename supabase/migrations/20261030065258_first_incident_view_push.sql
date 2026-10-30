-- All authenticated detail-reading APIs share this atomic, push-only notification path.
-- Existing view history is retained; deployment does not send historical notifications.
alter table public.enl_document_views enable row level security;
create index if not exists enl_document_views_incident_viewer_idx
  on public.enl_document_views (incident_id, viewer_id);

create or replace function public.enl_dispatch_pending_management_views()
returns void language plpgsql security invoker set search_path = '' as $$
declare v_token text;
begin
  if not exists (select 1 from public.enl_push_events
    where sent_at is null and kind = 'management_view_report') then return; end if;
  select internal_token into v_token from public.enl_push_config where id=1;
  if coalesce(v_token,'') <> '' then
    perform net.http_post(
      url := 'https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-v418',
      headers := pg_catalog.jsonb_build_object('Content-Type','application/json','x-enl-internal',v_token),
      body := '{"action":"dispatch"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
end;
$$;
revoke all on function public.enl_dispatch_pending_management_views() from public, anon, authenticated;
grant execute on function public.enl_dispatch_pending_management_views() to service_role;

create or replace function public.enl_notify_first_incident_view()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_name text; v_role text; v_site text; v_count integer;
begin
  if new.document_type not in ('incident_report','corrective_action','final_pdf') then return new; end if;
  select name,case when role='final' then 'manager' else role end
    into v_name,v_role from public.enl_hq_users
    where user_id=new.viewer_id and active=true;
  if v_role is null or v_role not in ('manager','executive') then return new; end if;
  select site_id into v_site from public.enl_incident_shared
    where incident_id=new.incident_id
      and payload->>'status' in ('reported','supplement','supplement_submitted','approved','closed','rejected')
      and not coalesce(payload->'bulkInvalidation'->>'active'='true',false);
  if not found then return new; end if;
  if exists(select 1 from public.enl_document_views
    where incident_id=new.incident_id and viewer_id=new.viewer_id and id<>new.id) then return new; end if;

  insert into public.enl_push_events(event_key,incident_id,site_id,user_id,kind,title,body,data)
  select 'view:'||new.incident_id||':incident_report:'||new.viewer_id||':'||u.user_id,
    new.incident_id,v_site,u.user_id,'management_view_report',
    '[사고 최초 조회] '||coalesce(v_name,'본사 사용자'),
    coalesce(v_name,'본사 사용자')||' ('||case when v_role='executive' then '경영진' else '본사실무자' end||')님이 사고보고를 최초 조회했습니다.',
    pg_catalog.jsonb_build_object('view','incident','viewerId',new.viewer_id,'viewerName',v_name,'viewerRole',v_role,'documentType',new.document_type)
  from public.enl_hq_users u where u.active=true and u.role='safety'
  on conflict(event_key) do nothing;
  get diagnostics v_count = row_count;
  if v_count>0 then
    -- pg_net sends after commit. A queueing failure must not lose the view/event;
    -- the scheduled retry below picks up any still-pending view notification.
    begin
      perform public.enl_dispatch_pending_management_views();
    exception when others then
      raise warning 'Management view push queued; dispatch will retry (SQLSTATE %)',sqlstate;
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.enl_notify_first_incident_view() from public, anon, authenticated;
grant execute on function public.enl_notify_first_incident_view() to service_role;
drop trigger if exists trg_enl_first_incident_view on public.enl_document_views;
create trigger trg_enl_first_incident_view after insert on public.enl_document_views
  for each row execute function public.enl_notify_first_incident_view();

-- No browser needs to remain open; failed/transient deliveries are retried.
select cron.schedule('enl-management-view-push-retry','* * * * *',
  'select public.enl_dispatch_pending_management_views()');
