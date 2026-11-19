-- The card owns site facts; the site master is their shared projection.
-- Keep historical workbook values and every prior revision intact.
create function private.enl_card_site_fields() returns jsonb language sql immutable set search_path='' as $$
 select '{"D6":"site_name","J6":"region","D7":"address","N7":"start_date","P8":"site_type","C9":"regular_count","E9":"daily_count","K9":"course_holes","O9":"headcount_basis","D14":"manager_name","F14":"manager_phone","D15":"part_name","F15":"part_phone","D16":"clerk_name","F16":"clerk_phone","D22":"safety_outsource_status","H22":"inspection_cycle","D23":"safety_agency","D24":"agency_manager","F24":"agency_phone","D25":"contract_period","D26":"agency_scope","D27":"agency_note"}'::jsonb
$$;
create function private.enl_card_profile_fields() returns jsonb language sql immutable set search_path='' as $$
 select '{"N6":"corporation","D8":"business_number","J8":"insurance_number","D10":"confirmed_on","H10":"original_check"}'::jsonb
$$;
create function private.enl_card_initial_master(s public.enl_site_master) returns jsonb language sql stable set search_path='' as $$
 select coalesce((select jsonb_object_agg(key,coalesce(to_jsonb(s)->>value,'')) from jsonb_each_text(private.enl_card_site_fields())),'{}') ||
 coalesce((select jsonb_object_agg(key,coalesce(s.safety_card_profile->>value,'')) from jsonb_each_text(private.enl_card_profile_fields())),'{}')
$$;
-- Promote exactly the existing displayed facts, including saved edits, without
-- changing incident records, organization documents, approval events or accounts.
insert into private.enl_safety_cards(site_id,revision,template_version,content,source,actor_id,actor_name)
 select c.site_id,c.revision+1,c.template_version,
 c.content || jsonb_build_object('authority','card-v1','masterValues',private.enl_card_initial_master(s)||
 coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(c.content->'overrides','{}')) where private.enl_card_site_fields()?key or private.enl_card_profile_fields()?key),'{}')),
 'edit','system:card-primary','안전관리카드 원본 전환'
 from (select distinct on(site_id) * from private.enl_safety_cards order by site_id,revision desc)c
 join public.enl_site_master s using(site_id) where coalesce(c.content->>'authority','')<>'card-v1';
create function private.enl_site_from_primary_card() returns trigger language plpgsql set search_path='' as $$
 declare c jsonb; v jsonb; patch jsonb; profile jsonb; rev integer;
 begin
  select content,revision into c,rev from private.enl_safety_cards where site_id=new.site_id order by revision desc limit 1;
  if coalesce(c->>'authority','')<>'card-v1' then return new; end if;
  v:=(c->'masterValues')||coalesce(c->'overrides','{}');
  select jsonb_object_agg(value,v->key) into patch from jsonb_each_text(private.enl_card_site_fields()) where v?key;
  if not coalesce(v->>'C9','') ~ '^[0-9]+$' or not coalesce(v->>'E9','') ~ '^[0-9]+$' or btrim(coalesce(v->>'D6',''))='' then raise exception 'invalid_card_site_facts'; end if;
  patch:=patch||jsonb_build_object('regular_count',(v->>'C9')::integer,'daily_count',(v->>'E9')::integer,'total_count',(v->>'C9')::integer+(v->>'E9')::integer);
  select jsonb_object_agg(value,v->key) into profile from jsonb_each_text(private.enl_card_profile_fields()) where v?key;
  patch:=patch||jsonb_build_object('safety_card_profile',coalesce(new.safety_card_profile,'{}')||coalesce(profile,'{}')||jsonb_build_object('_source','safety_card','_card_revision',rev));
  new:=jsonb_populate_record(new,patch);
  return new;
 end
$$;
create trigger enl_site_primary_card before update on public.enl_site_master for each row execute function private.enl_site_from_primary_card();
revoke all on function private.enl_card_site_fields(),private.enl_card_profile_fields(),private.enl_card_initial_master(public.enl_site_master),private.enl_site_from_primary_card() from public,anon,authenticated;
grant execute on function private.enl_card_site_fields(),private.enl_card_profile_fields(),private.enl_card_initial_master(public.enl_site_master),private.enl_site_from_primary_card() to service_role;
-- Mark the source and synchronize any previously saved card edits.
with before_rows as materialized (select s.site_id,to_jsonb(s) as old from public.enl_site_master s where exists(select 1 from private.enl_safety_cards c where c.site_id=s.site_id)),
 changed as (update public.enl_site_master s set updated_at=now(),updated_by_id='system:card-primary',updated_by_name='안전관리카드 원본 전환',updated_by_role='system' from before_rows b where s.site_id=b.site_id returning s.site_id,to_jsonb(s) as new,b.old)
 insert into public.enl_site_audit(site_id,action,editor_id,editor_name,editor_role,changed_at,before_payload,after_payload)
 select site_id,'update','system:card-primary','안전관리카드 원본 전환','system',now(),old,new from changed;

-- Old clients/servers may not erase source ownership during a rolling deployment.
create function private.enl_preserve_card_primary() returns trigger language plpgsql set search_path='' as $$
 declare previous jsonb;
 begin
  select content into previous from private.enl_safety_cards where site_id=new.site_id order by revision desc limit 1;
  if previous->>'authority'='card-v1' and coalesce(new.content->>'authority','')<>'card-v1' then raise exception 'card_primary_required'; end if;
  return new;
 end
$$;
create trigger enl_card_primary_guard before insert on private.enl_safety_cards for each row execute function private.enl_preserve_card_primary();
revoke all on function private.enl_preserve_card_primary() from public,anon,authenticated;
grant execute on function private.enl_preserve_card_primary() to service_role;
