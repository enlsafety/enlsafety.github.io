const moduleKeys=['incident','risk','tbm','organization','training'];
const systemRoles=['worker','field','manager','executive','safety'];
const serviceKeys=['history','approvals','notices','documents','dashboard','system'];
function canEnter(item:any,actor:any){
  if(!item||item.enabled===false||item.state==='hidden')return false;
  const admin=actor.role==='safety';
  if(item.key==='system'&&!admin)return false;
  if(item.key==='history'&&!admin&&!['manager','executive'].includes(actor.role)&&!(actor.role==='field'&&actor.siteId&&['현장소장','파트장','서무'].includes(actor.position)))return false;
  const principal=(['field','worker'].includes(actor.role)?'site:':'hq:')+actor.id;
  return (admin||item.roles.includes(actor.role))&&(item.state==='live'||(item.preview&&(admin||item.pilots.includes(principal))));
}
export async function serviceAllowed(sql:any,actor:any,key:string){
  const [row]=await sql`select item from private.enl_platform_catalog cross join lateral jsonb_array_elements(services) item where singleton and item->>'key'=${key}`;
  return canEnter(row?.item,actor);
}
export async function platformRequest(sql:any,actor:any,body:any,reply:any){
  const admin=actor.role==='safety',action=body.action;
  if(action==='platform_notices'||action==='platform_notice_set'){
    if(!await serviceAllowed(sql,actor,'notices'))return reply({ok:false,message:'service_unavailable'},403);
    const hq=['safety','manager','executive'].includes(actor.role),source=hq?'hq':'site';
    if(action==='platform_notice_set'){
      const {key,channel,enabled}=body;
      if(!moduleKeys.includes(key)||!['push','email'].includes(channel)||typeof enabled!=='boolean')return reply({ok:false,message:'invalid_preference'},400);
      const push=channel==='push'?enabled:null,email=channel==='email'?enabled:null;
      if(key==='incident'){
        if(hq)await sql`update public.enl_hq_users set push_enabled=coalesce(${push}::boolean,push_enabled),email_enabled=coalesce(${email}::boolean,email_enabled) where user_id=${actor.id} and active`;
        else await sql`update public.enl_site_personnel set push_enabled=coalesce(${push}::boolean,push_enabled),email_enabled=coalesce(${email}::boolean,email_enabled) where personnel_id::text=${actor.id} and site_id=${actor.siteId} and active`;
      }else await sql`insert into private.enl_module_notice_preferences as p(source,account_id,module_key,push_enabled,email_enabled)
        values(${source},${actor.id},${key},coalesce(${push}::boolean,true),coalesce(${email}::boolean,true)) on conflict(source,account_id,module_key) do update
        set push_enabled=coalesce(${push}::boolean,p.push_enabled),email_enabled=coalesce(${email}::boolean,p.email_enabled)`;
      return reply({ok:true});
    }
    const [incident]=hq?await sql`select push_enabled,email_enabled from public.enl_hq_users where user_id=${actor.id}`:
      await sql`select push_enabled,email_enabled from public.enl_site_personnel where personnel_id::text=${actor.id} and site_id=${actor.siteId}`;
    const others=await sql`select module_key,push_enabled,email_enabled from private.enl_module_notice_preferences where source=${source} and account_id=${actor.id}`;
    return reply({ok:true,rows:moduleKeys.map(key=>{const p=key==='incident'?incident:others.find((r:any)=>r.module_key===key);return {key,push:p?.push_enabled!==false,email:p?.email_enabled!==false}})});
  }
  if(action==='platform_directory'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const query=String(body.query||'').trim().slice(0,100),duty=String(body.duty||''),offset=Number(body.offset||0);
    if(!Number.isSafeInteger(offset)||offset<0)return reply({ok:false,message:'invalid_page'},400);
    const rows=await sql`select a.*,coalesce(s.site_name,'본사') as site_name,d.codes from private.enl_master_accounts a
      left join public.enl_site_master s on s.site_id=a.site_id cross join lateral
        (select coalesce(array_agg(duty order by duty),'{}'::text[]) codes from private.enl_duty_assignments
         where source=a.source and account_id=a.id and ended_at is null) d
      where (${duty}='' or ${duty}=any(d.codes)) and strpos(lower(concat_ws(' ',a.id,a.name,s.site_name,a.department,a.position)),lower(${query}))>0
      order by a.active desc,a.name,a.source,a.id offset ${offset} limit 51`;
    return reply({ok:true,rows:rows.slice(0,50),more:rows.length>50});
  }
  if(action==='platform_duties'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const rows=await sql`select duty from private.enl_duty_assignments where source=${body.source} and account_id=${body.accountId} and ended_at is null`;
    return reply({ok:true,duties:rows.map((r:any)=>r.duty)});
  }
  const [config]=await sql`select revision,modules,services from private.enl_platform_catalog where singleton`;
  const publicItems=(items:any[])=>admin?items:items.filter(m=>m.state!=='hidden'&&m.key!=='system').map(m=>({key:m.key,state:m.state,enabled:m.enabled!==false,preview:m.preview,canEnter:canEnter(m,actor)}));
  if(action==='platform_catalog')return reply({ok:true,revision:config.revision,modules:publicItems(config.modules),services:publicItems(config.services)});
  if(action==='platform_enter'){
    const m=[...config.modules,...config.services].find(m=>m.key===body.key);
    return canEnter(m,actor)?reply({ok:true,key:m.key,state:m.state}):reply({ok:false,message:'module_unavailable'},403);
  }
  if(action!=='platform_save'||!admin)return reply({ok:false,message:'forbidden'},403);
  if(body.group!==undefined&&!['modules','services'].includes(body.group))return reply({ok:false,message:'invalid_catalog'},400);
  const services=body.group==='services',keys=services?serviceKeys:moduleKeys,modules=services?config.services:config.modules;
  const next=body.modules;
  if(!Array.isArray(next)||next.length!==keys.length||!keys.every(k=>next.some(m=>m?.key===k)))return reply({ok:false,message:'invalid_catalog'},400);
  for(const m of next){
    if(!m||!['live','building','hidden'].includes(m.state)||typeof m.preview!=='boolean'||(m.enabled!==undefined&&typeof m.enabled!=='boolean')||
       !Array.isArray(m.roles)||m.roles.some((r:any)=>!systemRoles.includes(r))||
       !Array.isArray(m.pilots)||m.pilots.length>100||m.pilots.some((p:any)=>typeof p!=='string'||!/^(hq|site):.{1,150}$/.test(p)))return reply({ok:false,message:'invalid_catalog'},400);
    if(m.key==='system'&&m.roles.some((r:any)=>r!=='safety'))return reply({ok:false,message:'forbidden'},403);
    if(m.key==='incident'&&(m.state==='building'||(m.state==='hidden'&&modules.find((x:any)=>x.key==='incident').state!=='hidden'&&body.confirmHideIncident!==true)||(m.enabled===false&&modules.find((x:any)=>x.key==='incident').enabled!==false&&body.confirmDisableIncident!==true)))return reply({ok:false,message:'incident_protected'},409);
  }
  const clean=next.map(({key,state,enabled,preview,roles,pilots}:any)=>({key,state,enabled:enabled??(modules.find((m:any)=>m.key===key).enabled!==false),preview,roles:[...new Set(roles)],pilots:[...new Set(pilots)]}));
  const pilots=Array.from(new Set(clean.flatMap(m=>m.pilots))) as string[];
  if(pilots.length){
    const valid=await sql`select source||':'||id as key from private.enl_master_accounts where active and (source||':'||id) in(select jsonb_array_elements_text(${sql.json(pilots)}::jsonb))`;
    if(valid.length!==pilots.length)return reply({ok:false,message:'unknown_pilot'},400);
  }
  const column=services?sql`services`:sql`modules`;
  const rows=await sql`update private.enl_platform_catalog set ${column}=${sql.json(clean)}::jsonb,revision=revision+1,updated_at=now(),updated_by=${actor.id}
    where singleton and revision=${body.revision} returning revision`;
  return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
}
