import "../../safety-card-model.js";

export async function safetyCardRequest(sql:any, actor:any, body:any, reply:any) {
  if(!['safety','field','worker','manager','executive'].includes(actor.role))
    return reply({ok:false,message:'forbidden'},403);
  const scoped=['field','worker'].includes(actor.role);
  const visible=scoped?sql`s.site_id=${actor.siteId}`:sql`true`;
  if(body.action==='platform_safety_card_list'){
    const sites=await sql`select s.site_id,s.site_name,s.active,c.revision,c.saved_at,c.actor_name,c.source
      from public.enl_site_master s join lateral (
        select revision,saved_at,actor_name,source from private.enl_safety_cards
        where site_id=s.site_id order by revision desc limit 1
      ) c on true where ${visible} order by s.site_name`;
    sites.sort((a:any,b:any)=>a.site_name.localeCompare(b.site_name,'ko',{numeric:true}));
    return reply({ok:true,sites});
  }
  if(typeof body.siteId!=='string'||!body.siteId||(scoped&&body.siteId!==actor.siteId))
    return reply({ok:false,message:'forbidden'},403);
  const [site]=await sql`select site_id,site_name,active from public.enl_site_master s where s.site_id=${body.siteId} and ${visible}`;
  if(!site)return reply({ok:false,message:'site_unavailable'},404);
  const canEdit=actor.role==='safety'||actor.role==='field';
  if(body.action==='platform_safety_card_open'){
    const [document]=await sql`select revision,template_version,content,source,saved_at,actor_name
      from private.enl_safety_cards where site_id=${site.site_id} order by revision desc limit 1`;
    if(!document)return reply({ok:false,message:'card_unavailable'},404);
    return reply({ok:true,site,document,canEdit});
  }
  if(body.action!=='platform_safety_card_save')return reply({ok:false,message:'unknown_action'},400);
  if(!canEdit)return reply({ok:false,message:'forbidden'},403);
  const model=(globalThis as any).ENLSafetyCardModel;
  if(body.templateVersion!==model.template.version||!Number.isInteger(body.expectedRevision)||body.expectedRevision<1)
    return reply({ok:false,message:'invalid_card_version'},400);
  const problem=model.validate(body.content);
  if(problem)return reply({ok:false,message:'invalid_card',detail:problem},400);
  return sql.begin(async(tx:any)=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${site.site_id},2913))`;
    const [previous]=await tx`select revision,template_version,content from private.enl_safety_cards
      where site_id=${site.site_id} order by revision desc limit 1`;
    if(!previous)return reply({ok:false,message:'card_unavailable'},404);
    if(previous.revision!==body.expectedRevision)return reply({ok:false,message:'card_changed'},409);
    if(previous.template_version!==body.templateVersion)return reply({ok:false,message:'invalid_card_version'},409);
    const content={values:{...body.content.values,D6:previous.content.values.D6},notes:body.content.notes,provenance:previous.content.provenance};
    const [document]=await tx`insert into private.enl_safety_cards(site_id,revision,template_version,content,source,actor_id,actor_name)
      values(${site.site_id},${previous.revision+1},${body.templateVersion},${sql.json(content)}::jsonb,'edit',${actor.id},${actor.name})
      returning revision,template_version,content,source,saved_at,actor_name`;
    return reply({ok:true,site,document,canEdit});
  });
}
