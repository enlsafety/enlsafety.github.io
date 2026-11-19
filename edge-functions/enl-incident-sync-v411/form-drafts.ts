/* Private account drafts. No report, audit or notification is created until submission. */
const draftText=(v:any)=>String(v??'');
const draftFail=(message:string,status=409):never=>{throw Object.assign(new Error(message),{httpStatus:status})};
const draftOwner=(a:any)=>a.role+':'+a.id;
const draftSafe=(v:string)=>v.trim().replace(/[\\/]+/g,'-').replace(/[^0-9A-Za-z가-힣._()\- ]/g,'_').slice(0,90)||'file';
const draftPublic=(r:any)=>({id:r.id,kind:r.kind,incidentId:r.incident_id,reportId:r.report_id,siteId:r.site_id,incidentVersion:r.incident_version,revision:r.revision,state:r.state,content:r.content,updatedAt:r.updated_at});
async function draftScope(sql:any,a:any,d:any){
 if(!['field','worker','safety'].includes(a.role))draftFail('forbidden',403);
 if(!['person','property','plan','action'].includes(d.kind))draftFail('draft_invalid',400);
 if(a.role!=='safety'&&d.siteId!==a.siteId)draftFail('forbidden',403);
 if(d.siteId){const [s]=await sql`select site_id from public.enl_site_master where site_id=${d.siteId}`;if(!s)draftFail('site_not_found',404);}
 if(d.incidentId){
  const [r]=await sql`select payload from public.enl_incident_active where incident_id=${d.incidentId}`;
  const p=r?.payload;if(!p)draftFail('draft_incident_missing',409);
  if(p.siteId!==d.siteId||(a.role==='worker'&&p.reporterId!==a.id))draftFail('forbidden',403);
  if(String(p._syncVersion??p.updatedAt??'')!==String(d.incidentVersion))draftFail('draft_incident_changed',409);
  return p;
 }
 if(['plan','action'].includes(d.kind)||!/^inc-[a-zA-Z0-9_-]{1,150}$/.test(d.reportId))draftFail('draft_invalid',400);
 const [r]=await sql`select incident_id from public.enl_incident_active where incident_id=${d.reportId}`;
 if(r)draftFail('draft_already_submitted',409);
 return null;
}
function draftContent(raw:any,a:any,incident:any){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||JSON.stringify(raw).length>500000)draftFail('draft_too_large',400);
 const values=raw.values, captions=raw.captions||{};
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>300)draftFail('draft_invalid',400);
 for(const [k,v] of Object.entries(values))if(!/^[a-zA-Z][\w:-]{0,100}$/.test(k)||!['string','boolean'].includes(typeof v)||(typeof v==='string'&&v.length>40000)||/password|pinHash|passwordHash/i.test(k))draftFail('draft_invalid',400);
 const allowed=new Set([...(incident?.photos||[]),...(incident?.corrective?.afterPhotos||[])].map(x=>x?.path).filter(Boolean));
 const files=raw.files||[];if(!Array.isArray(files)||files.length>8)draftFail('draft_invalid',400);
 const owner=a.siteId?'site-'+draftSafe(a.siteId):'hq-'+draftSafe(a.id);
 const cleanFiles=files.map((f:any)=>{
  if(Number.isInteger(f?.original)&&f.original>=0&&f.original<8&&incident)return {original:f.original};
  const path=draftText(f?.path);
  const own=['incident','action'].some(s=>path.startsWith(s+'/'+owner+'/'+draftSafe(a.id)+'/'));
  if(!path||path.includes('..')||(!own&&!allowed.has(path)))draftFail('draft_attachment_forbidden',403);
  return Object.fromEntries(['storage','path','name','mime','size','sha256','optimization','kind'].filter(k=>f[k]!==undefined).map(k=>[k,f[k]]));
 });
 return {values,files:cleanFiles,confirmed:Array.isArray(raw.confirmed)?raw.confirmed.filter((k:any)=>typeof k==='string'&&Object.hasOwn(values,k)):[],captions:Object.fromEntries(Object.keys(values).map(k=>[k,draftText(captions[k]||k).slice(0,120)]))};
}
export async function formDraftRequest(sql:any,a:any,b:any,json:any){
 if(!['field','worker','safety'].includes(a.role))return json({ok:false,message:'forbidden'},403);
 const owner=draftOwner(a),op=b.action;
 if(op==='draft_list'){
  const rows=await sql`select * from private.enl_form_drafts where owner_key=${owner} and state='active' and (${a.role==='safety'} or site_id=${a.siteId}) order by updated_at desc`;
  return json({ok:true,drafts:rows.map(draftPublic)});
 }
 if(!/^[a-f0-9-]{36}$/i.test(draftText(b.id)))return json({ok:false,message:'draft_invalid'},400);
 if(op==='draft_get'){
  const [r]=await sql`select * from private.enl_form_drafts where owner_key=${owner} and id=${b.id}::uuid`;
  if(!r||(a.role!=='safety'&&r.site_id!==a.siteId))return json({ok:false,message:'draft_not_found'},404);
  return json({ok:true,draft:draftPublic(r)});
 }
 if(!['draft_save','draft_delete'].includes(op))return json({ok:false,message:'invalid_action'},400);
 if(!Number.isSafeInteger(b.revision)||b.revision<0)return json({ok:false,message:'draft_invalid'},400);
 return await sql.begin(async(tx:any)=>{
  if(op==='draft_save')await tx`select pg_advisory_xact_lock(hashtextextended(${draftText(b.incidentId||b.reportId)},0))`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${owner+':'+b.id},0))`;
  const [r]=await tx`select * from private.enl_form_drafts where owner_key=${owner} and id=${b.id}::uuid for update`;
  if(r&&a.role!=='safety'&&r.site_id!==a.siteId)draftFail('forbidden',403);
  if(r?.state&&r.state!=='active')return json({ok:false,message:'draft_finished',draft:draftPublic(r)},409);
  if(op==='draft_save'&&r&&r.mutation_id===b.mutationId){
   // Lost-response retry is idempotent only for the exact operation.
   if(JSON.stringify(r.content)!==JSON.stringify(draftContent(b.content,a,await draftScope(tx,a,b)) )){
    // jsonb changes object key ordering, compare recursively below instead.
    const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    if(JSON.stringify(canonical(r.content))!==JSON.stringify(canonical(draftContent(b.content,a,await draftScope(tx,a,b)))))draftFail('draft_mutation_conflict');
   }
   return json({ok:true,draft:draftPublic(r)});
  }
  if((r?.revision||0)!==b.revision)return json({ok:false,message:'draft_conflict',draft:r?draftPublic(r):null},409);
  if(op==='draft_delete'){
   if(!r)return json({ok:false,message:'draft_not_found'},404);
   const [deleted]=await tx`update private.enl_form_drafts set state='deleted',content='{}',revision=revision+1,updated_at=now() where owner_key=${owner} and id=${b.id}::uuid returning *`;
   return json({ok:true,draft:draftPublic(deleted)});
  }
  if(!/^[a-f0-9-]{36}$/i.test(draftText(b.mutationId)))draftFail('draft_invalid',400);
  for(const k of ['siteId','incidentId','reportId','incidentVersion'])if(typeof b[k]!=='string'||b[k].length>180)draftFail('draft_invalid',400);
  if(r&&(r.kind!==b.kind||r.incident_id!==b.incidentId||r.report_id!==b.reportId||r.incident_version!==b.incidentVersion))draftFail('draft_identity_changed');
  const p=await draftScope(tx,a,b),content=draftContent(b.content,a,p);
  const [saved]=r?await tx`update private.enl_form_drafts set content=${tx.json(content)}::jsonb,site_id=${b.siteId},revision=revision+1,mutation_id=${b.mutationId},updated_at=now() where owner_key=${owner} and id=${b.id}::uuid returning *`:
   await tx`insert into private.enl_form_drafts(owner_key,id,kind,incident_id,report_id,site_id,incident_version,content,mutation_id) values(${owner},${b.id}::uuid,${b.kind},${b.incidentId},${b.reportId},${b.siteId},${b.incidentVersion},${tx.json(content)}::jsonb,${b.mutationId}) returning *`;
  return json({ok:true,draft:draftPublic(saved)});
 });
}
/* Called inside the report transaction. A concurrent autosave and a submit cannot both win. */
export async function consumeFormDraft(sql:any,a:any,proof:any,incidentId:string,siteId:string){
 if(!proof)return;
 if(!/^[a-f0-9-]{36}$/i.test(draftText(proof.id))||!Number.isSafeInteger(proof.revision))draftFail('draft_invalid',400);
 const owner=draftOwner(a);
 const [r]=await sql`select * from private.enl_form_drafts where owner_key=${owner} and id=${proof.id}::uuid for update`;
 if(!r||r.state!=='active'||r.revision!==proof.revision)draftFail('draft_conflict');
 if((r.incident_id||r.report_id)!==incidentId||r.site_id!==siteId)draftFail('draft_invalid',400);
 await sql`select set_config('enl.form_draft_submit',${incidentId},true)`;
 await sql`update private.enl_form_drafts set state='submitted',content='{}',revision=revision+1,updated_at=now() where owner_key=${owner} and id=${proof.id}::uuid`;
}
