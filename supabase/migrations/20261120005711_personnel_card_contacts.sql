-- Personnel changes must update the card source before its site projection.
-- Keep workbook snapshots, notes, other site facts and all prior revisions.
create function private.enl_apply_personnel_contacts(sid text, contact_patch jsonb, actor_id text, actor_name text, actor_role text)
returns boolean language plpgsql set search_path='' as $$
declare previous private.enl_safety_cards%rowtype; before_site public.enl_site_master%rowtype;
  after_site public.enl_site_master%rowtype; effective jsonb; patch jsonb; content jsonb; projection jsonb;
begin
  select * into before_site from public.enl_site_master where site_id=sid for update;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(sid,2913));
  select * into previous from private.enl_safety_cards where site_id=sid order by revision desc limit 1;
  effective:=case when previous.content->>'authority'='card-v1'
    then (previous.content->'masterValues')||coalesce(previous.content->'overrides','{}')
    else private.enl_card_initial_master(before_site) end;
  select coalesce(jsonb_object_agg(key,value),'{}') into patch from jsonb_each(contact_patch)
    where key=any(array['D14','F14','D15','F15','D16','F16']) and jsonb_typeof(value)='string'
      and coalesce(effective->>key,'') is distinct from value#>>'{}';
  if patch='{}'::jsonb then return false; end if;
  if previous.content->>'authority'='card-v1' then
    content:=previous.content||jsonb_build_object('masterValues',coalesce(previous.content->'masterValues','{}')||patch,
      'overrides',coalesce(previous.content->'overrides','{}')-array(select jsonb_object_keys(patch)));
    insert into private.enl_safety_cards(site_id,revision,template_version,content,source,actor_id,actor_name)
      values(sid,previous.revision+1,previous.template_version,content,'edit',actor_id,actor_name);
  end if;
  select jsonb_object_agg(m.value,patch->m.key) into projection from jsonb_each_text(private.enl_card_site_fields()) m where patch?m.key;
  after_site:=jsonb_populate_record(before_site,projection);
  update public.enl_site_master set manager_name=after_site.manager_name,manager_phone=after_site.manager_phone,
    part_name=after_site.part_name,part_phone=after_site.part_phone,clerk_name=after_site.clerk_name,clerk_phone=after_site.clerk_phone,
    updated_at=now(),updated_by_id=actor_id,updated_by_name=actor_name,updated_by_role=actor_role
    where site_id=sid returning * into after_site;
  insert into public.enl_site_audit(site_id,action,editor_id,editor_name,editor_role,changed_at,before_payload,after_payload)
    values(sid,'update',actor_id,actor_name,actor_role,now(),to_jsonb(before_site),to_jsonb(after_site));
  return true;
end
$$;

create function private.enl_personnel_contact_audited() returns trigger language plpgsql set search_path='' as $$
declare b jsonb:=new.before_payload; a jsonb:=new.after_payload; sid text; patch jsonb; current_values jsonb;
  s public.enl_site_master%rowtype; c jsonb; old_keys jsonb; new_keys jsonb;
  slots jsonb:='{"현장소장":["D14","F14"],"파트장":["D15","F15"],"서무":["D16","F16"]}';
  old_active boolean; new_active boolean; old_name text; new_name text;
begin
  -- Password, email and notification-only changes do not rewrite card contacts.
  if (select jsonb_object_agg(k,b->k) from unnest(array['site_id','name','phone','job_title','access_role','active']) k)
    is not distinct from (select jsonb_object_agg(k,a->k) from unnest(array['site_id','name','phone','job_title','access_role','active']) k) then return new; end if;
  old_keys:=slots->(b->>'job_title'); new_keys:=slots->(a->>'job_title');
  old_active:=coalesce(b->>'active','false')='true' and b->>'access_role'='field' and old_keys is not null;
  new_active:=coalesce(a->>'active','false')='true' and a->>'access_role'='field' and new_keys is not null;
  if not coalesce(old_active,false) and not coalesce(new_active,false) then return new; end if;
  old_name:=btrim(regexp_replace(coalesce(b->>'name',''),' \((현장소장|파트장|서무)\)$',''));
  new_name:=btrim(regexp_replace(coalesce(a->>'name',''),' \((현장소장|파트장|서무)\)$',''));
  for sid in select distinct value from unnest(array[b->>'site_id',a->>'site_id']) value where value is not null order by value loop
    select * into s from public.enl_site_master where site_id=sid for update;
    if not found then continue; end if;
    select content into c from private.enl_safety_cards where site_id=sid order by revision desc limit 1;
    current_values:=case when c->>'authority'='card-v1' then (c->'masterValues')||coalesce(c->'overrides','{}') else private.enl_card_initial_master(s) end;
    patch:='{}';
    if old_active and b->>'site_id'=sid and not coalesce(new_active and a->>'site_id'=sid and old_keys=new_keys,false)
      and regexp_replace(coalesce(current_values->>(old_keys->>0),''),'\s','','g')=regexp_replace(old_name,'\s','','g') then
      patch:=jsonb_build_object(old_keys->>0,'',old_keys->>1,'');
    end if;
    if new_active and a->>'site_id'=sid then patch:=patch||jsonb_build_object(new_keys->>0,new_name,new_keys->>1,btrim(coalesce(a->>'phone',''))); end if;
    perform private.enl_apply_personnel_contacts(sid,patch,new.editor_id,new.editor_name,new.editor_role);
  end loop;
  return new;
end
$$;
create trigger enl_personnel_card_contacts after insert on public.enl_personnel_audit
for each row execute function private.enl_personnel_contact_audited();
revoke all on function private.enl_apply_personnel_contacts(text,jsonb,text,text,text),private.enl_personnel_contact_audited() from public,anon,authenticated;
grant execute on function private.enl_apply_personnel_contacts(text,jsonb,text,text,text),private.enl_personnel_contact_audited() to service_role;

-- Repair the reported registration using its saved personnel record, without
-- creating accounts or changing unrelated card facts and historical evidence.
do $$
declare p public.enl_site_personnel%rowtype;
begin
  if (select count(*) from public.enl_site_personnel where site_id='s19' and job_title='서무' and access_role='field' and active)=1 then
    select * into p from public.enl_site_personnel where site_id='s19' and job_title='서무' and access_role='field' and active;
    perform private.enl_apply_personnel_contacts(p.site_id,jsonb_build_object('D16',p.name,'F16',coalesce(p.phone,'')),
      'system:personnel-contact-sync','근무자 연락망 연동 복구','system');
  end if;
end
$$;
