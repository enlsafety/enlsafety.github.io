-- Keep each environment's existing optimistic/auth guard. Permit only an actor's
-- own acknowledgement of an already-approved corrective action, without edits.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enl_is_own_corrective_ack(p jsonb, q jsonb, a jsonb)
returns boolean language plpgsql stable set search_path = '' as $body$
declare
 receipt jsonb;
 old_others jsonb;
 new_others jsonb;
 actor_name text;
 actor_role text;
 actor_position text;
 actor_site text;
 own_count integer;
 incidental text[] := array['acknowledgements','updatedAt','_syncBaseVersion','_syncMutationId'];
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(q) is distinct from 'object'
    or coalesce(a->>'id','')='' or coalesce(p->>'id','')='' or coalesce(a->>'role','') not in ('manager','executive','field')
    or coalesce(p->>'status','') not in ('approved','closed') or p->'corrective'->>'status' is distinct from 'approved'
    or p-incidental is distinct from q-incidental
    or jsonb_typeof(coalesce(p->'acknowledgements','[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(q->'acknowledgements') is distinct from 'array'
    or left(coalesce(q->>'_syncMutationId',''),length('ack:'||(a->>'id')||':'||(p->>'id')||':'))
       is distinct from 'ack:'||(a->>'id')||':'||(p->>'id')||':' then
  return false;
 end if;
 if a->>'role'='field' then
  select u.name,u.access_role,u.job_title,u.site_id into actor_name,actor_role,actor_position,actor_site
   from public.enl_site_personnel u where u.personnel_id::text=a->>'id' and u.active is true;
  if coalesce(actor_position,'') not in ('현장소장','파트장','서무') or actor_site is distinct from p->>'siteId' then return false; end if;
 else
  select u.name,case when u.role='final' then 'manager' else u.role end,u.position,''
   into actor_name,actor_role,actor_position,actor_site
   from public.enl_hq_users u where u.user_id=a->>'id' and u.active is true;
 end if;
 if actor_role is distinct from a->>'role' then return false; end if;
 select count(*) into own_count from jsonb_array_elements(q->'acknowledgements') x
  where x->>'userId'=a->>'id' and x->>'documentType'='corrective_action';
 if own_count<>1 then return false; end if;
 select x into receipt from jsonb_array_elements(q->'acknowledgements') x
  where x->>'userId'=a->>'id' and x->>'documentType'='corrective_action';
 if receipt is distinct from jsonb_build_object(
    'documentType','corrective_action','userId',a->>'id','name',coalesce(actor_name,''),
    'role',actor_role,'position',coalesce(actor_position,''),'siteId',coalesce(actor_site,''),
    'ackAt',q->>'updatedAt','label','재발방지조치 결재')
    or coalesce(receipt->>'ackAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' then
  return false;
 end if;
 select coalesce(jsonb_agg(x order by ord),'[]'::jsonb) into old_others
  from jsonb_array_elements(coalesce(p->'acknowledgements','[]'::jsonb)) with ordinality as entry(x,ord)
  where not (coalesce(x->>'userId','')=a->>'id' and coalesce(x->>'documentType','')='corrective_action');
 select coalesce(jsonb_agg(x order by ord),'[]'::jsonb) into new_others
  from jsonb_array_elements(q->'acknowledgements') with ordinality as entry(x,ord)
  where not (coalesce(x->>'userId','')=a->>'id' and coalesce(x->>'documentType','')='corrective_action');
 return old_others=new_others;
end;
$body$;
revoke all on function private.enl_is_own_corrective_ack(jsonb,jsonb,jsonb) from public,anon,authenticated;

do $body$
declare
 definition text;
 anchor text := E' if r in (''manager'',''executive'') then\n';
 addition text := E' -- enl_own_corrective_ack_v1\n if tg_op=''UPDATE'' and private.enl_is_own_corrective_ack(p,new.payload,a) then\n   ignored := array_append(ignored,''acknowledgements'');\n end if;\n';
begin
 select pg_get_functiondef('public.enl_incident_optimistic_sync_guard()'::regprocedure) into definition;
 -- Production's version-only guard already allows this Edge-authorized action.
 if position('reader_write_forbidden' in definition)=0 or position('-- enl_own_corrective_ack_v1' in definition)>0 then return; end if;
 if position(anchor in definition)=0 or position('ignored text[]' in definition)=0
    or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'corrective_ack_guard_unrecognized_shape';
 end if;
 execute replace(definition,anchor,addition||anchor);
end;
$body$;
