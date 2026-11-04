-- Incident delivery already uses push_enabled/email_enabled on the account. Other features have separate preferences.
create table private.enl_module_notice_preferences(
 source text not null check(source in ('hq','site')),account_id text not null,
 module_key text not null check(module_key in ('risk','tbm','organization','training')),
 push_enabled boolean not null default true,email_enabled boolean not null default true,
 primary key(source,account_id,module_key)
);
alter table private.enl_module_notice_preferences enable row level security;
revoke all on private.enl_module_notice_preferences from public,anon,authenticated;
grant select,insert,update on private.enl_module_notice_preferences to service_role;

-- The email bridge runs AFTER a push event is inserted. Suppress only initial-stage events at their common source.
create function private.enl_skip_past_initial_notice() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.enl_incident_shared i where i.incident_id=new.incident_id and jsonb_typeof(i.payload->'pastReport')='object') then return null;end if;
 return new;
end $$;
create trigger enl_skip_past_initial_notice before insert on public.enl_push_events for each row
 when(new.kind in ('incident_new','urgent_incident','incident_approved')) execute function private.enl_skip_past_initial_notice();

create function private.enl_email_registered_event() returns trigger language plpgsql set search_path='' as $$
declare hq boolean:=tg_table_name='enl_hq_users'; uid text;site text;
begin
 uid:=case when hq then to_jsonb(new)->>'user_id' else to_jsonb(new)->>'personnel_id' end;
 site:=to_jsonb(new)->>'site_id';
 perform private.enl_platform_event('email:'||gen_random_uuid(),'common',uid,site,new.updated_by_id,new.updated_by_name,new.updated_by_role,
 'email_registered','처리완료',coalesce(new.updated_by_name,'담당자')||'님이 '||new.name||' 계정의 이메일을 등록했습니다.');
 return null;
end $$;
create trigger enl_hq_email_registered after update of email on public.enl_hq_users for each row
 when(coalesce(trim(old.email),'')='' and coalesce(trim(new.email),'')<>'') execute function private.enl_email_registered_event();
create trigger enl_site_email_registered after update of email on public.enl_site_personnel for each row
 when(coalesce(trim(old.email),'')='' and coalesce(trim(new.email),'')<>'') execute function private.enl_email_registered_event();
revoke all on function private.enl_email_registered_event(),private.enl_skip_past_initial_notice() from public,anon,authenticated;
grant execute on function private.enl_email_registered_event(),private.enl_skip_past_initial_notice() to service_role;

-- Carry the existing read position into both feeds at cutover.
insert into private.enl_history_checkpoints(actor_id,seen,marked_at)
select 'hub-history:'||scope||':'||c.actor_id,c.seen,c.marked_at
from private.enl_history_checkpoints c cross join unnest(array['incident','common']) scope
where c.actor_id not like 'hub-history:%' on conflict do nothing;

create or replace function private.enl_hq_setting_audited() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and coalesce(trim(old.email),'')='' and coalesce(trim(new.email),'')<>'' and
 (to_jsonb(new)-array['email','updated_at','updated_by_id','updated_by_name','updated_by_role']) =
 (to_jsonb(old)-array['email','updated_at','updated_by_id','updated_by_name','updated_by_role']) then return null;end if;
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at'-'updated_by_id'-'updated_by_name'-'updated_by_role') =
 (to_jsonb(old)-'updated_at'-'updated_by_id'-'updated_by_name'-'updated_by_role') then return null; end if;
 perform private.enl_setting_activity('hq:'||gen_random_uuid(),new.user_id,clock_timestamp(),new.updated_by_id,new.updated_by_name,
 new.updated_by_role,null,'본사',new.name,case when tg_op='INSERT' then 'hq_create' else 'hq_update' end);
 return null;
end; $$;
