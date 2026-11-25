import {validDocumentEvidence,documentEvidenceUrl} from './document-evidence.ts';
// E&L CEO safety policy and objectives: globally dated posters, site-specific proof and approval.
// Routed only after index.ts has verified the actor with current credentials.
const policyKinds = new Set(['policy','objectives']);
const policyText = (value:unknown, max=128) =>
  typeof value==='string' && value.trim().length>0 && value.trim().length<=max && !/[\u0000-\u001f\u007f]/.test(value);
const policyStatus = (value:any) => value?.review_state || 'empty';
function settingsPublic(s:any){
  return {year:Number(s.policy_year),date:s.effective_date,revision:Number(s.revision),updatedAt:s.updated_at,updatedBy:s.updated_by_name};
}
export async function policyRequest(sql:any,actor:any,body:any,reply:any){
  const action=body.action,admin=actor.role==='safety',field=actor.role==='field';
  const siteScoped=field||actor.role==='worker';
  if(!admin&&!['field','worker','manager','executive'].includes(actor.role))
    return reply({ok:false,message:'forbidden'},403);

  if(action==='platform_policy_list'){
    const [settings]=await sql`select policy_year,effective_date::text as effective_date,revision,updated_at,updated_by_name
      from private.enl_policy_settings where singleton`;
    const visible=siteScoped?sql`s.site_id=${actor.siteId}`:sql`true`;
    const sites=await sql`select s.site_id,s.site_name,s.active,coalesce(f.display_name,s.site_name) as folder_name,
      p.id as policy_proof_id,p.review_state as policy_state,
      o.id as objectives_proof_id,o.review_state as objectives_state
      from public.enl_site_master s left join private.enl_org_folders f on f.site_id=s.site_id and not f.deleted
      left join lateral (
        select id,review_state from private.enl_policy_evidence
        where site_id=s.site_id and settings_revision=${settings.revision} and document_kind='policy'
        order by id desc limit 1
      ) p on true
      left join lateral (
        select id,review_state from private.enl_policy_evidence
        where site_id=s.site_id and settings_revision=${settings.revision} and document_kind='objectives'
        order by id desc limit 1
      ) o on true
      where s.site_id <> 'site-hq' and ${visible}
      order by (s.active is false),s.site_name,s.site_id`;
    const sortKo=(a:string,b:string)=>a.trim().localeCompare(b.trim(),'ko',{numeric:true});
    sites.sort((a:any,b:any)=>sortKo(a.folder_name,b.folder_name)||sortKo(a.site_name,b.site_name));
    return reply({ok:true,settings:settingsPublic(settings),sites:sites.map((s:any)=>({
      siteId:s.site_id,siteName:s.site_name,folderName:s.folder_name,active:s.active!==false,
      policyState:s.policy_state||'empty',objectivesState:s.objectives_state||'empty',
      complete:s.active!==false && s.policy_state==='approved' && s.objectives_state==='approved'
    }))});
  }

  if(action==='platform_policy_global_update'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const year=body.year,date=body.date,expected=body.revision;
    if(!Number.isInteger(year)||year<2000||year>2100||
      typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
      !Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||
      !Number.isInteger(expected)||expected<1)
      return reply({ok:false,message:'invalid_settings'},400);
    return sql.begin(async(tx:any)=>{
      const [prior]=await tx`select revision,policy_year,effective_date::text as effective_date
        from private.enl_policy_settings where singleton for update`;
      if(prior.revision!==expected)return reply({ok:false,message:'settings_changed'},409);
      if(prior.policy_year===year&&prior.effective_date===date)return reply({ok:true,unchanged:true,settings:{year,date,revision:expected}});
      const [saved]=await tx`update private.enl_policy_settings
        set policy_year=${year},effective_date=${date}::date,revision=revision+1,
          updated_at=now(),updated_by_id=${actor.id},updated_by_name=${actor.name}
        where singleton returning revision,policy_year,effective_date::text as effective_date,updated_at,updated_by_name`;
      await tx`insert into private.enl_policy_settings_history
        (revision,policy_year,effective_date,updated_at,updated_by_id,updated_by_name)
        values (${saved.revision},${year},${date}::date,${saved.updated_at},${actor.id},${actor.name})`;
      return reply({ok:true,settings:settingsPublic(saved)});
    });
  }

  const siteId=body.siteId,kind=body.kind;
  if(!policyText(siteId)||!policyKinds.has(kind) || siteScoped&&siteId!==actor.siteId)
    return reply({ok:false,message:'forbidden'},403);
  const visible=siteScoped?sql`s.site_id=${actor.siteId}`:sql`true`;
  const [site]=await sql`select s.site_id,s.site_name,s.active,coalesce(f.display_name,s.site_name) as folder_name
    from public.enl_site_master s left join private.enl_org_folders f on f.site_id=s.site_id and not f.deleted
    where s.site_id=${siteId} and s.site_id<>'site-hq' and ${visible}`;
  if(!site)return reply({ok:false,message:'site_unavailable'},404);

  if(action==='platform_policy_open'){
    const [settings]=await sql`select policy_year,effective_date::text as effective_date,revision,updated_at,updated_by_name
      from private.enl_policy_settings where singleton`;
    const [proof]=await sql`select id,review_state,submitted_by_name,submitted_at,reviewed_by_name,reviewed_at,
      review_note,encode(photo_jpeg,'base64') as jpeg
      from private.enl_policy_evidence
      where site_id=${siteId} and document_kind=${kind} and settings_revision=${settings.revision}
      order by id desc limit 1`;
    return reply({ok:true,settings:settingsPublic(settings),site:{
      siteId:site.site_id,siteName:site.site_name,folderName:site.folder_name,active:site.active!==false
    },kind,proof:proof?{
      id:Number(proof.id),state:policyStatus(proof),submittedBy:proof.submitted_by_name,
      submittedAt:proof.submitted_at,reviewedBy:proof.reviewed_by_name,
      reviewedAt:proof.reviewed_at,reviewNote:proof.review_note,
      photo:documentEvidenceUrl(proof.jpeg)
    }:null});
  }

  const revision=body.revision;
  if(!Number.isInteger(revision)||revision<1)return reply({ok:false,message:'invalid_revision'},400);
  if(action==='platform_policy_submit'){
    if(!field||site.active===false)return reply({ok:false,message:'forbidden'},403);
    if(!validDocumentEvidence(body.photo))return reply({ok:false,message:'photo_required'},400);
    return sql.begin(async(tx:any)=>{
      await tx`select pg_advisory_xact_lock(hashtextextended(${siteId+':'+kind},9142026))`;
      const [settings]=await tx`select revision,policy_year,effective_date::text as effective_date
        from private.enl_policy_settings where singleton for share`;
      const [currentSite]=await tx`select active from public.enl_site_master
        where site_id=${siteId} and site_id<>'site-hq' for share`;
      if(!currentSite?.active)return reply({ok:false,message:'site_unavailable'},409);
      if(settings.revision!==revision)return reply({ok:false,message:'settings_changed'},409);
      const [prior]=await tx`select review_state from private.enl_policy_evidence where
        site_id=${siteId} and document_kind=${kind} and settings_revision=${revision}
        order by id desc limit 1`;
      if(prior&&prior.review_state!=='rejected')return reply({ok:false,message:'review_state_changed'},409);
      const [saved]=await tx`insert into private.enl_policy_evidence
        (site_id,document_kind,settings_revision,policy_year,effective_date,photo_jpeg,submitted_by_id,submitted_by_name)
        values(${siteId},${kind},${revision},${settings.policy_year},${settings.effective_date}::date,
          decode(${body.photo},'base64'),${actor.id},${actor.name}) returning id`;
      return reply({ok:true,id:Number(saved.id),state:'pending'});
    });
  }

  if(action==='platform_policy_decide'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const decision=body.decision,evidenceId=body.evidenceId,note=typeof body.note==='string'?body.note.trim():'';
    if(!['approved','rejected'].includes(decision)||!Number.isSafeInteger(evidenceId)||evidenceId<1||
      (decision==='rejected'&&!policyText(note,300))||note.length>300)
      return reply({ok:false,message:'invalid_decision'},400);
    return sql.begin(async(tx:any)=>{
      await tx`select pg_advisory_xact_lock(hashtextextended(${siteId+':'+kind},9142026))`;
      const [settings]=await tx`select revision from private.enl_policy_settings where singleton for share`;
      if(settings.revision!==revision)return reply({ok:false,message:'settings_changed'},409);
      const [latest]=await tx`select id,review_state from private.enl_policy_evidence where
        site_id=${siteId} and document_kind=${kind} and settings_revision=${revision}
        order by id desc limit 1 for update`;
      if(!latest||Number(latest.id)!==evidenceId||latest.review_state!=='pending')
        return reply({ok:false,message:'review_state_changed'},409);
      await tx`update private.enl_policy_evidence
        set review_state=${decision},reviewed_by_id=${actor.id},reviewed_by_name=${actor.name},
          reviewed_at=now(),review_note=${note||null} where id=${evidenceId}`;
      return reply({ok:true,state:decision});
    });
  }
  return reply({ok:false,message:'invalid_action'},400);
}
