-- A small searchable index of actual audit events. Source evidence stays in the existing archive.
create table private.enl_activity_events (
 id bigint generated always as identity primary key, source_key text not null unique,
 incident_id text not null, happened_at timestamptz not null, actor_id text, actor_name text, actor_role text,
 site_id text, site_name text, incident_title text, occurred_text text, kind text not null
);
create index enl_activity_chronological on private.enl_activity_events(happened_at desc,id desc);
create index enl_activity_by_incident on private.enl_activity_events(incident_id);
create table private.enl_activity_reads (
 actor_id text not null, event_id bigint not null references private.enl_activity_events(id),
 primary key(actor_id,event_id)
);
alter table private.enl_activity_events enable row level security;
alter table private.enl_activity_reads enable row level security;
revoke all on private.enl_activity_events,private.enl_activity_reads from public,anon,authenticated;
grant select,insert on private.enl_activity_events,private.enl_activity_reads to service_role;
grant usage on sequence private.enl_activity_events_id_seq to service_role;

create function private.enl_activity_add(src text, iid text, ts timestamptz, uid text, uname text, urole text, site text, verb text, doc jsonb)
returns void language sql set search_path='' as $$
 insert into private.enl_activity_events(source_key,incident_id,happened_at,actor_id,actor_name,actor_role,site_id,site_name,incident_title,occurred_text,kind)
 select src,iid,ts,uid,uname,urole,site,(select site_name from public.enl_site_master where site_id=site),
 nullif(concat_ws(' / ',case when doc->>'category'='person' then '대인' when doc->>'category'='property' then '대물' end,
 nullif(doc->>'eventType',''),nullif(left(doc#>>'{reportDetails,place}',65),'')),''),coalesce(nullif(doc->>'occurredDate',''),doc->>'occurredAt'),verb
 where ts is not null on conflict(source_key) do nothing;
$$;

create function private.enl_activity_from_audit(a public.enl_incident_audit, old_doc jsonb, new_doc jsonb)
returns void language plpgsql set search_path='' as $$
declare
 k text:=a.action; doc jsonb; old_c jsonb:=old_doc->'corrective'; new_c jsonb:=new_doc->'corrective';
begin
 doc:=case when new_doc->>'category' is not null then new_doc else old_doc end;
 if doc->>'category' is null then select payload into doc from public.enl_incident_shared where incident_id=a.incident_id; end if;
 if k='acknowledge' and a.editor_role='executive' then
   if new_doc#>>'{executiveApproval,state}'='rejected' and old_doc#>'{executiveApproval,rejection}' is distinct from new_doc#>'{executiveApproval,rejection}' then k:='executive_reject';
   elsif old_doc#>'{executiveApproval,signatures}' is distinct from new_doc#>'{executiveApproval,signatures}' then k:='executive_sign'; end if;
 elsif k in ('update','post_approval_revision','cost_added','corrective_submit') then
   k:=case
     when old_doc->>'status' in ('reported','supplement_submitted') and new_doc->>'status'='approved' then 'approve'
     when new_doc->>'status'='supplement' and old_doc->'supplement' is distinct from new_doc->'supplement' then 'supplement_request'
     when new_c->>'status'='submitted' and old_c->>'status' is distinct from 'submitted' then 'corrective_submit'
     when old_c->>'status' is distinct from new_c->>'status' and new_c->>'status'='approved' then 'corrective_approve'
     when old_c->>'status' is distinct from new_c->>'status' and new_c->>'status'='rejected' then 'corrective_reject'
     when nullif(new_c->>'planDetail','') is not null and (old_c->>'planDetail') is distinct from (new_c->>'planDetail') then
       case when nullif(old_c->>'planDetail','') is null then 'plan_create' else 'plan_edit' end
     when new_c->>'actionDetail' is not null and old_c->>'actionDetail' is distinct from new_c->>'actionDetail' then 'action_save'
     when old_doc->>'status'='rejected' and new_doc->>'status'='reported' then 'resubmit'
     when (old_doc#>'{reportDetails,environmentCause}',old_doc#>'{reportDetails,behaviorCause}',old_doc#>'{reportDetails,causeAnalysisNote}',old_doc#>'{reportDetails,causeAnalysisStatus}')
       is distinct from (new_doc#>'{reportDetails,environmentCause}',new_doc#>'{reportDetails,behaviorCause}',new_doc#>'{reportDetails,causeAnalysisNote}',new_doc#>'{reportDetails,causeAnalysisStatus}') then 'cause_save'
     else k end;
 end if;
 perform private.enl_activity_add('audit:'||a.audit_id,a.incident_id,a.changed_at,a.editor_id,a.editor_name,a.editor_role,a.site_id,k,doc);
end;
$$;
create function private.enl_activity_audit_insert() returns trigger language plpgsql set search_path='' as $$
begin
 perform private.enl_activity_from_audit(new,new.before_payload,new.after_payload);
 return new;
end;
$$;
-- Capture the snapshots before the existing evidence-compaction trigger replaces them with hashes.
create trigger aa_enl_activity_audit before insert on public.enl_incident_audit
for each row execute function private.enl_activity_audit_insert();

create function private.enl_activity_view_insert() returns trigger language plpgsql set search_path='' as $$
declare doc jsonb; site text;
begin
 select s.payload,s.site_id into doc,site from public.enl_incident_shared s where s.incident_id=new.incident_id;
 perform private.enl_activity_add(coalesce(nullif(current_setting('enl.activity_visit',true),''),'first:'||new.id),new.incident_id,new.first_viewed_at,new.viewer_id,new.viewer_name,new.viewer_role,site,
 case new.document_type when 'final_pdf' then 'final_view' when 'corrective_action' then 'action_view' else 'view' end,doc);
 return new;
end;
$$;
create trigger enl_activity_first_view after insert on public.enl_document_views for each row execute function private.enl_activity_view_insert();

select private.enl_activity_from_audit(a,coalesce(a.before_payload,private.enl_evidence_get(a.before_hash)),coalesce(a.after_payload,private.enl_evidence_get(a.after_hash)))
from public.enl_incident_audit a order by a.changed_at,a.audit_id;
select private.enl_activity_add('first:'||v.id,v.incident_id,v.first_viewed_at,v.viewer_id,v.viewer_name,v.viewer_role,s.site_id,
 case v.document_type when 'final_pdf' then 'final_view' when 'corrective_action' then 'action_view' else 'view' end,s.payload)
from public.enl_document_views v left join public.enl_incident_shared s using(incident_id);

revoke all on function private.enl_activity_add(text,text,timestamptz,text,text,text,text,text,jsonb), private.enl_activity_from_audit(public.enl_incident_audit,jsonb,jsonb), private.enl_activity_view_insert(), private.enl_activity_audit_insert() from public,anon,authenticated;
grant execute on function private.enl_activity_add(text,text,timestamptz,text,text,text,text,text,jsonb), private.enl_activity_from_audit(public.enl_incident_audit,jsonb,jsonb), private.enl_activity_view_insert(), private.enl_activity_audit_insert() to service_role;
