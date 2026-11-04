-- Additive platform foundation. No account, credential, incident or existing event is rewritten.
create view private.enl_master_accounts with(security_invoker=true) as
 select 'hq'::text as source,user_id::text as id,name,role,null::text as site_id,department,position,active from public.enl_hq_users
 union all select 'site',personnel_id::text,name,access_role,site_id,null,job_title,active from public.enl_site_personnel;
create table private.enl_duty_assignments(
 id bigint generated always as identity primary key, source text not null check(source in ('hq','site')),
 account_id text not null,site_id text, duty text not null check(duty in ('supervisor','safety','responsible','health')),
 recorded_at timestamptz not null default now(),ended_at timestamptz,recorded_by text not null,ended_by text,
 designation_date date,release_date date,evidence_ref text
);
create unique index enl_current_duty on private.enl_duty_assignments(source,account_id,duty) where ended_at is null;
create function private.enl_assign_duties(src text,uid text,site text,selected jsonb,editor text) returns boolean
language plpgsql set search_path='' as $$
begin
 if selected is null then return false; end if;
 if jsonb_typeof(selected)<>'array' or exists(select from jsonb_array_elements_text(selected) d where d not in ('supervisor','safety','responsible','health') or d is null) then raise exception 'invalid_duty';end if;
 update private.enl_duty_assignments set ended_at=now(),ended_by=editor where source=src and account_id=uid and ended_at is null and not(selected ? duty);
 insert into private.enl_duty_assignments(source,account_id,site_id,duty,recorded_by)
 select src,uid,site,d,editor from (select distinct jsonb_array_elements_text(selected) d) s on conflict do nothing;
 return true;
end $$;
create table private.enl_platform_catalog(singleton boolean primary key default true check(singleton),revision integer not null default 1,modules jsonb not null,updated_by text,updated_at timestamptz not null default now());
insert into private.enl_platform_catalog(modules)
 select jsonb_agg(jsonb_build_object('key',k,'state',case when k='incident' then 'live' else 'building' end,'preview',false,'roles',jsonb_build_array('worker','field','manager','executive','safety'),'pilots','[]'::jsonb) order by n)
 from unnest(array['incident','risk','tbm','organization','training']) with ordinality v(k,n);
create table private.enl_platform_cleanup(
 id bigint generated always as identity primary key,actor_id text not null,actor_name text not null,at timestamptz not null default now(),
 mode text not null,scope jsonb not null,reason text not null,event_ids bigint[] not null,restored_at timestamptz,restored_by text,restore_reason text
);
-- Extend the compact event index; older records keep their incident or settings classification.
alter table private.enl_activity_events add column module_key text,add column result_label text,add column display_text text;
create view private.enl_platform_history with(security_invoker=true) as
 select h.*,coalesce(x.display_text,h.sentence) as display_sentence,coalesce(x.module_key,case when split_part(h.kind,'_',1) in ('hq','site','personnel') then 'common' else 'incident' end) module_key,
 coalesce(x.result_label,case when h.kind in ('reject','executive_reject') then '반려' when h.kind in ('supplement_request','corrective_reject') then '보완요청'
 when h.kind in ('approve','corrective_approve','executive_sign') then '승인' when h.kind='final_approval' then '종결' else '처리완료' end) result_label
 from private.enl_workflow_history h join private.enl_activity_events x using(id);
alter table private.enl_platform_cleanup enable row level security;
alter table private.enl_platform_catalog enable row level security;
alter table private.enl_duty_assignments enable row level security;
revoke all on private.enl_master_accounts,private.enl_duty_assignments,private.enl_platform_catalog,private.enl_platform_history,private.enl_platform_cleanup from public,anon,authenticated;
revoke all on function private.enl_assign_duties(text,text,text,jsonb,text) from public,anon,authenticated;
grant select on private.enl_master_accounts,private.enl_platform_history to service_role;
grant select,insert,update on private.enl_platform_cleanup,private.enl_platform_catalog,private.enl_duty_assignments to service_role;
grant execute on function private.enl_assign_duties(text,text,text,jsonb,text) to service_role;
grant usage on sequence private.enl_duty_assignments_id_seq,private.enl_platform_cleanup_id_seq to service_role;

-- Only a trusted module writer may append a workflow event, inside the document transaction.
create function private.enl_platform_event(src text,mod text,doc_id text,site text,uid text,uname text,urole text,kind text,outcome text,description text)
returns void language sql set search_path='' as $$
 insert into private.enl_activity_events(source_key,module_key,incident_id,site_id,site_name,actor_id,actor_name,actor_role,kind,result_label,display_text,happened_at)
 select 'module:'||mod||':'||src,mod,doc_id,site,(select site_name from public.enl_site_master where site_id=site),uid,uname,urole,kind,outcome,description,now()
 where mod in ('common','risk','tbm','organization','training') on conflict(source_key) do nothing;
$$;
revoke all on function private.enl_platform_event(text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.enl_platform_event(text,text,text,text,text,text,text,text,text,text) to service_role;
