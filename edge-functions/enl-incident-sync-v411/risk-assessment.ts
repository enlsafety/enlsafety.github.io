// Risk-assessment folder metadata only. Actual evaluations will use a separate record model.
const isText=(value:unknown,max:number)=>typeof value==='string'&&!!value.trim()
  &&value.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(value);

export async function riskRequest(sql:any,actor:any,body:any,reply:any){
  const field=actor.role==='field';
  if(!['field','safety','manager','executive'].includes(actor.role))
    return reply({ok:false,message:'forbidden'},403);
  if(body.action==='platform_risk_list'){
    const visible=field?sql`s.site_id=${actor.siteId}`:sql`true`;
    const sites=await sql`select s.site_id,s.site_name,coalesce(f.display_name,s.site_name) as folder_name,
       f.revision as folder_revision,s.active from public.enl_site_master s
       join private.enl_risk_folders f using(site_id)
       where ${visible} and s.site_id<>'site-hq' and not f.deleted
       order by (s.active is false),s.site_name,s.site_id`;
    const candidates=actor.role==='safety'&&body.manageFolders===true
      ?await sql`select s.site_id,s.site_name,coalesce(f.revision,0) as folder_revision
        from public.enl_site_master s left join private.enl_risk_folders f using(site_id)
        where s.site_id<>'site-hq' and (f.site_id is null or f.deleted)`
      :[];
    const collator=new Intl.Collator('ko-KR',{numeric:true,sensitivity:'base'});
    sites.sort((a:any,b:any)=>collator.compare(a.folder_name,b.folder_name)||collator.compare(a.site_name,b.site_name));
    candidates.sort((a:any,b:any)=>collator.compare(a.site_name,b.site_name));
    return reply({ok:true,sites,candidates});
  }
  if(!body.action.startsWith('platform_risk_folder_'))return reply({ok:false,message:'unknown_action'},400);
  if(actor.role!=='safety')return reply({ok:false,message:'forbidden'},403);
  const action=body.action.slice('platform_risk_folder_'.length);
  const siteId=body.siteId,name=typeof body.name==='string'?body.name.trim():'';
  if(!['create','rename','delete'].includes(action)||!isText(siteId,128)
      ||!Number.isInteger(body.folderRevision)||body.folderRevision<0
      ||(action!=='delete'&&!isText(name,72)))
    return reply({ok:false,message:'invalid_folder'},400);
  return sql.begin(async(tx:any)=>{
    // This lock is scoped to risk folders and never locks the organization module.
    await tx`select pg_advisory_xact_lock(hashtextextended(${siteId},2912))`;
    const [site]=await tx`select site_name from public.enl_site_master
      where site_id=${siteId} and site_id<>'site-hq' for share`;
    if(!site)return reply({ok:false,message:'site_unavailable'},404);
    const [folder]=await tx`select deleted,revision from private.enl_risk_folders
      where site_id=${siteId} for update`;
    if((folder?.revision??0)!==body.folderRevision
       ||(action==='create'?!folder?.deleted&&!!folder:!folder||folder.deleted))
      return reply({ok:false,message:'folder_changed'},409);
    if(action==='delete'){
      await tx`update private.enl_risk_folders set deleted=true,revision=revision+1 where site_id=${siteId}`;
    }else{
      await tx`insert into private.enl_risk_folders(site_id,display_name)
        values(${siteId},${name===site.site_name?null:name})
        on conflict(site_id) do update set
          deleted=false,display_name=excluded.display_name,revision=enl_risk_folders.revision+1`;
    }
    return reply({ok:true});
  });
}
