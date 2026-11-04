const moduleKeys=['incident','risk','tbm','organization','training'];
const systemRoles=['worker','field','manager','executive','safety'];
export async function platformRequest(sql:any,actor:any,body:any,reply:any){
  const admin=actor.role==='safety',action=body.action;
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
  const [config]=await sql`select revision,modules from private.enl_platform_catalog where singleton`;
  const modules=config.modules;
  const principal=(['field','worker'].includes(actor.role)?'site:':'hq:')+actor.id;
  const enter=(m:any)=>m&&m.state!=='hidden'&&(admin||m.roles.includes(actor.role))&&(m.state==='live'||(m.preview&&(admin||m.pilots.includes(principal))));
  if(action==='platform_catalog')return reply({ok:true,revision:config.revision,modules:admin?modules:modules.filter((m:any)=>m.state!=='hidden').map((m:any)=>({key:m.key,state:m.state,canEnter:!!enter(m)}))});
  if(action==='platform_enter'){
    const m=modules.find((m:any)=>m.key===body.key);
    return enter(m)?reply({ok:true,key:m.key,state:m.state}):reply({ok:false,message:'module_unavailable'},403);
  }
  if(action!=='platform_save'||!admin)return reply({ok:false,message:'forbidden'},403);
  const next=body.modules;
  if(!Array.isArray(next)||next.length!==moduleKeys.length||!moduleKeys.every(k=>next.some(m=>m?.key===k)))return reply({ok:false,message:'invalid_catalog'},400);
  for(const m of next){
    if(!m||!['live','building','hidden'].includes(m.state)||typeof m.preview!=='boolean'||
       !Array.isArray(m.roles)||m.roles.some((r:any)=>!systemRoles.includes(r))||
       !Array.isArray(m.pilots)||m.pilots.length>100||m.pilots.some((p:any)=>typeof p!=='string'||!/^(hq|site):.{1,150}$/.test(p)))return reply({ok:false,message:'invalid_catalog'},400);
    if(m.key==='incident'&&(m.state==='building'||(m.state==='hidden'&&modules.find((x:any)=>x.key==='incident').state!=='hidden'&&body.confirmHideIncident!==true)||!systemRoles.every(r=>m.roles.includes(r))))return reply({ok:false,message:'incident_protected'},409);
  }
  const clean=next.map(({key,state,preview,roles,pilots}:any)=>({key,state,preview,roles:[...new Set(roles)],pilots:[...new Set(pilots)]}));
  const pilots=Array.from(new Set(clean.flatMap(m=>m.pilots))) as string[];
  if(pilots.length){
    const valid=await sql`select source||':'||id as key from private.enl_master_accounts where active and (source||':'||id) in(select jsonb_array_elements_text(${sql.json(pilots)}::jsonb))`;
    if(valid.length!==pilots.length)return reply({ok:false,message:'unknown_pilot'},400);
  }
  const rows=await sql`update private.enl_platform_catalog set modules=${sql.json(clean)}::jsonb,revision=revision+1,updated_at=now(),updated_by=${actor.id}
    where singleton and revision=${body.revision} returning revision`;
  return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
}
