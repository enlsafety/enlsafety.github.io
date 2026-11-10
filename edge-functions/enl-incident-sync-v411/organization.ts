const groups = 4;
const validText = (value:unknown, limit:number) => typeof value === 'string'
  && !!value.trim() && value.trim().length <= limit && !/[\u0000-\u001f\u007f]/.test(value);

function chartData(input:any) {
  if (!validText(input?.lead, 32) || !validText(input?.supervisor, 32)
      || !Array.isArray(input.teams) || input.teams.length !== groups) return null;
  const teams = [];
  for (const team of input.teams) {
    if (!validText(team?.name, 18) || ![team.regular, team.daily].every(n =>
      Number.isInteger(n) && n >= 0 && n <= 9999)) return null;
    teams.push({name:team.name.trim(), regular:team.regular, daily:team.daily});
  }
  return {lead:input.lead.trim(), supervisor:input.supervisor.trim(), teams};
}

export function halfYear(at = new Date()) {
  const kst = new Date(at.getTime() + 9 * 3600000);
  return kst.getUTCFullYear() + '-' + (kst.getUTCMonth() < 6 ? 1 : 2);
}

function reviewState(row:any, period:string, tip:number) {
  if(!row?.revision)return 'empty';
  // Deleting a newer version must not silently reapprove an earlier snapshot.
  if(row.period!==period || row.revision!==tip)return 'draft';
  if(row.review_event==='approve')return 'approved';
  return row.confirmed?'pending':'draft';
}

async function changeFolder(sql:any,actor:any,body:any,reply:any) {
  if (actor.role !== 'safety') return reply({ok:false,message:'forbidden'},403);
  const action=body.action.slice('platform_org_folder_'.length);
  const siteId=body.siteId, name=typeof body.name==='string'?body.name.trim():'';
  if (!['create','rename','delete'].includes(action) || !validText(siteId,128)
      || !Number.isInteger(body.folderRevision) || body.folderRevision<0
      || (action!=='delete' && !validText(name,72))) return reply({ok:false,message:'invalid_folder'},400);
  return sql.begin(async (tx:any)=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${siteId},2911))`;
    const [site]=await tx`select site_name from public.enl_site_master where site_id=${siteId} and site_id<>'site-hq' for share`;
    if (!site) return reply({ok:false,message:'site_unavailable'},404);
    const [folder]=await tx`select deleted,revision from private.enl_org_folders where site_id=${siteId} for update`;
    if ((folder?.revision??0)!==body.folderRevision || (action==='create' ? folder && !folder.deleted : !folder || folder.deleted))
      return reply({ok:false,message:'folder_changed'},409);
    if(action==='delete'){
      await tx`update private.enl_org_folders set deleted=true,revision=revision+1 where site_id=${siteId}`;
    }else{
      await tx`insert into private.enl_org_folders(site_id,display_name) values(${siteId},${name===site.site_name?null:name})
        on conflict(site_id) do update set deleted=false,display_name=excluded.display_name,revision=enl_org_folders.revision+1`;
    }
    return reply({ok:true});
  });
}

export async function organizationRequest(sql:any, actor:any, body:any, reply:any) {
  const field = actor.role === 'field';
  if (!field && !['safety','manager','executive'].includes(actor.role))
    return reply({ok:false, message:'forbidden'},403);
  if(body.action.startsWith('platform_org_folder_'))return changeFolder(sql,actor,body,reply);
  const period = halfYear();
  const visible = field ? sql`s.site_id = ${actor.siteId}` : sql`true`;
  const recent = sql`left join lateral (
    select revision, period, confirmed, review_event, saved_at, actor_name from private.enl_org_charts
    where site_id=s.site_id and deleted_at is null order by revision desc limit 1
  ) v on true`;
  if (body.action === 'platform_org_list') {
    const sites = await sql`select s.site_id,s.site_name,coalesce(f.display_name,s.site_name) as folder_name,f.revision as folder_revision,s.active,v.revision,v.saved_at,
        v.period,v.confirmed,v.review_event,(select max(revision) from private.enl_org_charts where site_id=s.site_id) as tip
      from public.enl_site_master s join private.enl_org_folders f using(site_id) ${recent}
      where ${visible} and s.site_id <> 'site-hq' and not f.deleted
      order by (s.active is false),s.site_name,s.site_id`;
    const candidates = actor.role==='safety' && body.manageFolders===true ? await sql`select s.site_id,s.site_name,coalesce(f.revision,0) as folder_revision
      from public.enl_site_master s left join private.enl_org_folders f using(site_id)
      where s.site_id<>'site-hq' and (f.site_id is null or f.deleted)` : [];
    const sortKo=(a:string,b:string)=>a.trim().localeCompare(b.trim(),'ko',{numeric:true});
    sites.sort((a:any,b:any)=>sortKo(a.folder_name,b.folder_name)||sortKo(a.site_name,b.site_name));
    candidates.sort((a:any,b:any)=>sortKo(a.site_name,b.site_name));
    return reply({ok:true,period,candidates,sites:sites.map((s:any)=>{
      const state=reviewState(s,period,s.tip);
      const {tip,confirmed,review_event,...summary}=s;
      return {...summary,state,checked:state==='approved'};
    })});
  }
  const siteId = body.siteId;
  if (!validText(siteId,128) || (field && siteId !== actor.siteId))
    return reply({ok:false,message:'forbidden'},403);
  const [site] = await sql`select s.site_id,s.site_name,s.active,f.revision as folder_revision from public.enl_site_master s join private.enl_org_folders f using(site_id)
    where not f.deleted and s.site_id=${siteId} and site_id <> 'site-hq' and ${visible}`;
  if (!site) return reply({ok:false,message:'site_unavailable'},404);
  if (body.action === 'platform_org_open') {
    if (body.revision != null && (!Number.isInteger(body.revision) || body.revision < 1))
      return reply({ok:false,message:'invalid_revision'},400);
    // One snapshot for both the history index and the selected document.
    const [result] = await sql`with versions as (
        select revision,period,confirmed,review_event,saved_at,actor_name,chart,site_name from private.enl_org_charts where site_id=${siteId} and deleted_at is null
      ) select (select jsonb_agg(to_jsonb(v)-'chart'-'site_name' order by revision desc) from versions v) as history,
        (select to_jsonb(v) from versions v where ${body.revision ?? null}::integer is null or revision=${body.revision ?? null}::integer order by revision desc limit 1) as document,
        (select coalesce(jsonb_agg(distinct period),'[]'::jsonb) from private.enl_org_charts where site_id=${siteId} and confirmed) as confirmed_periods,
        (select max(revision) from private.enl_org_charts where site_id=${siteId}) as tip`;
    if (body.revision != null && !result.document) return reply({ok:false,message:'unavailable'},404);
    let template;
    if (body.includeTemplate === true) {
      const [row] = await sql`select encode(image_webp,'base64') as image from private.enl_org_templates where template_key='v1'`;
      if (!row) return reply({ok:false,message:'template_unavailable'},503);
      template = 'data:image/webp;base64,' + row.image.replace(/\s/g,'');
    }
    return reply({ok:true,period,site,state:reviewState(result.history?.[0],period,result.tip),history:result.history||[],document:result.document,confirmedPeriods:result.confirmed_periods,template});
  }
  const op=body.action.slice('platform_org_'.length);
  if(!['save','confirm','approve','reopen','delete'].includes(op))return reply({ok:false,message:'unknown_action'},400);
  if(!field && actor.role!=='safety' || op==='approve' && actor.role!=='safety')
    return reply({ok:false,message:'forbidden'},403);
  const suppliesChart=op==='save' || op==='confirm' && body.chart!==undefined;
  const chart=suppliesChart?chartData(body.chart):null;
  if(suppliesChart && !chart || !Number.isInteger(body.revision) || body.revision<0 ||
     op==='delete' && (!Number.isInteger(body.targetRevision) || body.targetRevision<1) ||
     ['approve','reopen','delete'].includes(op) && !Number.isInteger(body.folderRevision))
    return reply({ok:false,message:'invalid_chart'},400);
  return sql.begin(async (tx:any) => {
    // Serialize first insert as well as later revisions. Reject stale edits and checks.
    await tx`select pg_advisory_xact_lock(hashtextextended(${siteId}, 2911))`;
    const [currentSite] = await tx`select s.site_name,s.active,f.revision from public.enl_site_master s join private.enl_org_folders f using(site_id) where s.site_id=${siteId} and not f.deleted for share`;
    if (!currentSite) return reply({ok:false,message:'site_unavailable'},409);
    if(body.folderRevision!=null && currentSite.revision!==body.folderRevision)return reply({ok:false,message:'folder_changed'},409);
    const [last] = await tx`select revision, chart, period, confirmed, review_event from private.enl_org_charts where site_id=${siteId} and deleted_at is null order by revision desc limit 1`;
    if ((last?.revision ?? 0) !== body.revision || body.period !== halfYear() || body.period !== period)
      return reply({ok:false,message:'chart_changed'},409);
    if(field && currentSite.active===false && (!last || op==='confirm'))return reply({ok:false,message:'forbidden'},403);
    if(op==='delete'){
      const [target]=await tx`select period from private.enl_org_charts where site_id=${siteId} and revision=${body.targetRevision} and deleted_at is null`;
      if(!target)return reply({ok:false,message:'chart_changed'},409);
      if(field){
        // A later edit or removal of a confirmed snapshot never unlocks its half-year.
        const [locked]=await tx`select 1 from private.enl_org_charts where site_id=${siteId} and confirmed
          and period in (${period},${target.period}) limit 1`;
        if(locked)return reply({ok:false,message:'confirmed_delete_forbidden'},403);
      }
      await tx`update private.enl_org_charts set deleted_at=now(),deleted_by=${actor.id}
        where site_id=${siteId} and revision=${body.targetRevision}`;
      await tx`update private.enl_org_folders set revision=revision+1 where site_id=${siteId}`;
      return reply({ok:true});
    }
    const [{tip}]=await tx`select coalesce(max(revision),0) as tip from private.enl_org_charts where site_id=${siteId}`;
    const state=reviewState(last,period,tip);
    if(state==='approved' && op!=='reopen')return reply({ok:false,message:'chart_locked'},409);
    if(op==='approve' && state!=='pending' || op==='reopen' && state!=='approved')
      return reply({ok:false,message:'review_state_changed'},409);
    if(!chart && !last)return reply({ok:false,message:'chart_required'},400);
    if(op==='confirm' && state==='pending' && !chart)return reply({ok:true,revision:last.revision});
    const revision=tip+1;
    const event=op==='approve'||op==='reopen'?op:null;
    await tx`insert into private.enl_org_charts (site_id,revision,site_name,chart,period,confirmed,review_event,actor_id,actor_name)
      values (${siteId},${revision},${currentSite.site_name},${tx.json(chart??last.chart)},${period},${op==='confirm'||op==='approve'},${event},${actor.id},${actor.name})`;
    return reply({ok:true,revision});
  });
}
