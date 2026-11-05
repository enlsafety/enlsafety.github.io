const moduleKeys=['incident','risk','tbm','organization','training','msds'];
const systemRoles=['worker','field','manager','executive','safety'];
const safetyArt=['policy','law','voice','emergency','ppe','ergonomics','rules'];
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
  if(action==='platform_hub'||action==='platform_hub_favorites'||action==='platform_hub_save'||action==='platform_hub_archive'){
    const actorKey=(['field','worker'].includes(actor.role)?'site:':'hq:')+actor.id;
    if(action==='platform_hub_favorites'){
      const [catalog]=await sql`select modules from private.enl_platform_catalog where singleton`;
      const favorites=body.favorites,keys=[...catalog.modules.map((m:any)=>m.key),...serviceKeys,'bulletins','schedule'];
      if(!Array.isArray(favorites)||favorites.length>15||favorites.some((k:any)=>!keys.includes(k)||k==='system'&&!admin))return reply({ok:false,message:'invalid_favorites'},400);
      await sql`insert into private.enl_hub_preferences(actor_key,favorites) values(${actorKey},${sql.json([...new Set(favorites)])}::jsonb)
        on conflict(actor_key) do update set favorites=excluded.favorites,updated_at=now()`;
      return reply({ok:true});
    }
    if(action==='platform_hub'){
      const selected=String(body.date||new Date(Date.now()+9*3600000).toISOString().slice(0,10));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)||!Number.isFinite(Date.parse(selected))||new Date(selected).toISOString().slice(0,10)!==selected)return reply({ok:false,message:'invalid_date'},400);
      const hq=['safety','manager','executive'].includes(actor.role);
      const rows=await sql`select c.*,s.site_name from private.enl_hub_content c left join public.enl_site_master s on s.site_id=c.site_id
        where c.archived_at is null and (${hq} or c.site_id is null or c.site_id=${actor.siteId})
        and (c.kind='notice' or c.starts_at<((${selected}::date+1)::timestamp at time zone 'Asia/Seoul') and c.ends_at>=(${selected}::date::timestamp at time zone 'Asia/Seoul'))
        order by c.kind,case when c.label='important' then 0 else 1 end,c.starts_at,c.created_at desc limit 250`;
      const [pref]=await sql`select favorites from private.enl_hub_preferences where actor_key=${actorKey}`;
      return reply({ok:true,notices:rows.filter((r:any)=>r.kind==='notice'),events:rows.filter((r:any)=>r.kind==='event'),favorites:pref?.favorites||[]});
    }
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const id=body.id==null?'':String(body.id),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(id&&!uuid.test(id)||id&&(!Number.isSafeInteger(body.revision)||body.revision<1))return reply({ok:false,message:'invalid_content'},400);
    if(action==='platform_hub_archive'){
      if(!id)return reply({ok:false,message:'invalid_content'},400);
      return await sql.begin(async(tx:any)=>{
        const [before]=await tx`select * from private.enl_hub_content where id=${id}::uuid and archived_at is null for update`;
        if(!before||before.revision!==body.revision)return reply({ok:false,message:'content_changed'},409);
        const [after]=await tx`update private.enl_hub_content set archived_at=now(),updated_at=now(),updated_by=${actor.id},revision=revision+1 where id=${id}::uuid returning *`;
        await tx`insert into private.enl_hub_content_audit(content_id,action,actor_id,actor_name,before_record,after_record) values(${id}::uuid,'archive',${actor.id},${actor.name},${tx.json(before)}::jsonb,${tx.json(after)}::jsonb)`;
        return reply({ok:true});
      });
    }
    const kind=String(body.kind||''),title=String(body.title||'').trim(),text=String(body.body||''),label=String(body.label||'info'),site=String(body.siteId||''),start=body.startsAt||null,end=body.endsAt||null;
    if(!['notice','event'].includes(kind)||!title||title.length>150||text.length>10000||!['important','info','general'].includes(label)||site.length>150)return reply({ok:false,message:'invalid_content'},400);
    if(kind==='event'&&(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<Date.parse(start)))return reply({ok:false,message:'invalid_event_time'},400);
    if(site){const [exists]=await sql`select site_id from public.enl_site_master where site_id=${site} and active`;if(!exists)return reply({ok:false,message:'invalid_site'},400);}
    return await sql.begin(async(tx:any)=>{
      let before=null,after;
      if(id){[before]=await tx`select * from private.enl_hub_content where id=${id}::uuid and archived_at is null for update`;
        if(!before||before.revision!==body.revision||before.kind!==kind)return reply({ok:false,message:'content_changed'},409);
        [after]=await tx`update private.enl_hub_content set title=${title},body=${text},label=${label},site_id=${site||null},starts_at=${kind==='event'?start:null}::timestamptz,ends_at=${kind==='event'?end:null}::timestamptz,revision=revision+1,updated_at=now(),updated_by=${actor.id} where id=${id}::uuid returning *`;
      }else [after]=await tx`insert into private.enl_hub_content(kind,title,body,label,site_id,starts_at,ends_at,created_by,updated_by) values(${kind},${title},${text},${label},${site||null},${kind==='event'?start:null}::timestamptz,${kind==='event'?end:null}::timestamptz,${actor.id},${actor.id}) returning *`;
      await tx`insert into private.enl_hub_content_audit(content_id,action,actor_id,actor_name,before_record,after_record) values(${after.id}::uuid,${id?'update':'create'},${actor.id},${actor.name},${before?tx.json(before):null}::jsonb,${tx.json(after)}::jsonb)`;
      return reply({ok:true,item:after});
    });
  }
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
  const [config]=await sql`select * from private.enl_platform_catalog where singleton`;
  const publicItems=(items:any[])=>admin?items:items.filter(m=>m.state!=='hidden'&&m.key!=='system').map(m=>({key:m.key,displayName:m.displayName,iconKey:m.iconKey,state:m.state,enabled:m.enabled!==false,preview:m.preview,canEnter:canEnter(m,actor)}));
  const moduleIds=config.modules.map((m:any)=>m.key);
  const extras=['support','system'];
  const order=[...moduleIds];
  for(const key of [...extras].sort((a,b)=>(config.home_extras?.[a]??Infinity)-(config.home_extras?.[b]??Infinity))){
    order.splice(config.home_extras?.[key]??order.length,0,key);
  }
  if(action==='platform_catalog'){
    const modules=publicItems(config.modules),services=publicItems(config.services);
    const visible=new Set([...modules,...services].map(m=>m.key).concat('support'));
    return reply({ok:true,revision:config.revision,modules,services,omitted:(config.home_omitted||[]).filter((k:string)=>visible.has(k)),homeOrder:order.filter(k=>visible.has(k))});
  }
  if(action==='platform_home_cards'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const removed=body.omitted;
    if(!Array.isArray(removed)||removed.some(k=>!order.includes(k))||new Set(removed).size!==removed.length)return reply({ok:false,message:'invalid_catalog'},400);
    const modules=[...config.modules];
    if(body.newCard){
      const {name,icon}=body.newCard;
      if(typeof name!=='string'||!name.trim()||name.trim().length>30||/[\u0000-\u001f\u007f]/.test(name)||!safetyArt.includes(icon)||modules.length>=100)return reply({ok:false,message:'invalid_card'},400);
      modules.push({key:'custom-'+crypto.randomUUID(),displayName:name.trim(),iconKey:icon,state:'building',enabled:false,preview:false,roles:systemRoles,pilots:[]});
    }
    const rows=await sql`update private.enl_platform_catalog set modules=${sql.json(modules)}::jsonb,home_omitted=${sql.json(removed)}::jsonb,
      revision=revision+1,updated_by=${actor.id},updated_at=now() where singleton and revision=${body.revision} and revision=${config.revision} returning revision`;
    return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
  }
  if(action==='platform_home_order'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const next=body.order;
    if(!Array.isArray(next)||next.length!==order.length||!order.every(k=>next.includes(k)))return reply({ok:false,message:'invalid_catalog'},400);
    const modules=next.filter(k=>moduleIds.includes(k)).map(k=>config.modules.find((m:any)=>m.key===k));
    const positions=Object.fromEntries(extras.map(k=>[k,next.indexOf(k)]));
    const rows=await sql`update private.enl_platform_catalog set modules=${sql.json(modules)}::jsonb,home_extras=${sql.json(positions)}::jsonb,
      revision=revision+1,updated_at=now(),updated_by=${actor.id} where singleton and revision=${body.revision} and revision=${config.revision} returning revision`;
    return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
  }
  if(action==='platform_enter'){
    const m=[...config.modules,...config.services].find(m=>m.key===body.key);
    return canEnter(m,actor)?reply({ok:true,key:m.key,state:m.state}):reply({ok:false,message:'module_unavailable'},403);
  }
  if(action!=='platform_save'||!admin)return reply({ok:false,message:'forbidden'},403);
  if(body.group!==undefined&&!['modules','services'].includes(body.group))return reply({ok:false,message:'invalid_catalog'},400);
  const services=body.group==='services',keys=services?serviceKeys:config.modules.map((m:any)=>m.key),modules=services?config.services:config.modules;
  let next=body.modules;
  // Older cached clients can save the original five modules without dropping MSDS.
  if(!services&&Array.isArray(next)&&next.length===5&&!next.some((m:any)=>m?.key==='msds')){
    const msds=config.modules.find((m:any)=>m.key==='msds');if(msds)next=[...next,msds];
  }
  if(!Array.isArray(next)||next.length!==keys.length||!keys.every(k=>next.some(m=>m?.key===k)))return reply({ok:false,message:'invalid_catalog'},400);
  for(const m of next){
    if(!m||!['live','building','hidden'].includes(m.state)||typeof m.preview!=='boolean'||(m.enabled!==undefined&&typeof m.enabled!=='boolean')||
       !Array.isArray(m.roles)||m.roles.some((r:any)=>!systemRoles.includes(r))||
       !Array.isArray(m.pilots)||m.pilots.length>100||m.pilots.some((p:any)=>typeof p!=='string'||!/^(hq|site):.{1,150}$/.test(p)))return reply({ok:false,message:'invalid_catalog'},400);
    if(m.displayName!==undefined&&(typeof m.displayName!=='string'||!m.displayName.trim()||m.displayName.trim().length>30||/[\u0000-\u001f\u007f]/.test(m.displayName)))return reply({ok:false,message:'invalid_display_name'},400);
    if(m.key==='system'&&m.roles.some((r:any)=>r!=='safety'))return reply({ok:false,message:'forbidden'},403);
    if(m.key==='incident'&&(m.state==='building'||(m.state==='hidden'&&modules.find((x:any)=>x.key==='incident').state!=='hidden'&&body.confirmHideIncident!==true)||(m.enabled===false&&modules.find((x:any)=>x.key==='incident').enabled!==false&&body.confirmDisableIncident!==true)))return reply({ok:false,message:'incident_protected'},409);
  }
  const clean=next.map(({key,state,enabled,preview,roles,pilots,displayName}:any)=>{
    const previous=modules.find((m:any)=>m.key===key);
    const label=displayName?.trim()??previous.displayName;
    return {...(previous.iconKey?{iconKey:previous.iconKey}:{}),...(label?{displayName:label}:{}),key,state,enabled:enabled??(previous.enabled!==false),preview,roles:[...new Set(roles)],pilots:[...new Set(pilots)]};
  });
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
