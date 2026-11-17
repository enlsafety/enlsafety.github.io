import riskTemplates from "./risk-templates.json" with { type: "json" };
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
  if(!body.action.startsWith('platform_risk_folder_'))return evaluationRequest(sql,actor,body,reply);
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

const riskText=(v:any,max=2000)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const riskDate=(v:any)=>v===''||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const photoId=(v:any)=>v===''||typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function riskDefault(book:any){
 return {assessmentDate:'',openingDate:'',evaluator:'',target:'',notes:'',
  rows:book.sections.flatMap((s:any)=>s.rows.map((r:any)=>({...r,section:s.name}))),
  improvements:Array.from({length:3},()=>({number:'',process:'',task:'',hazard:'',measure:'',date:'',reviewer:'',beforePhoto:'',afterPhoto:''}))};
}
export function riskContent(value:any,book:any,complete:boolean,kind:string,period:string){
 if(!value||!['assessmentDate','openingDate'].every(k=>riskDate(value[k]))||!['evaluator','target','notes'].every(k=>riskText(value[k]))
   ||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>300||!Array.isArray(value.improvements)||value.improvements.length!==3)return null;
 const ids=new Set();
 for(const row of value.rows){
  if(!row||!riskText(row.id,100)||!row.id||ids.has(row.id)||!Number.isInteger(row.number)||row.number<1||row.number>9999
   ||!['section','process','task','hazard','measure','owner','excludeReason'].every(k=>riskText(row[k]))
   ||!['','상','중','하'].includes(row.level)||typeof row.excluded!=='boolean'||!riskDate(row.dueDate)||!riskDate(row.doneDate))return null;
  ids.add(row.id);
  if(complete&&(row.excluded?!row.excludeReason.trim():!row.level||!row.task.trim()||!row.hazard.trim()||(['상','중'].includes(row.level)&&(!row.measure.trim()||!row.owner.trim()||!row.dueDate))))return null;
 }
 // Base rows remain available; non-applicable work is explicitly excluded with a reason.
 if(book.sections.some((s:any)=>s.rows.some((r:any)=>!ids.has(r.id))))return null;
 for(const r of value.improvements){if(!r||!['number','process','task','hazard','measure','reviewer'].every(k=>riskText(r[k]))||!riskDate(r.date)||!photoId(r.beforePhoto)||!photoId(r.afterPhoto))return null;}
 if(complete&&(!value.assessmentDate||!value.evaluator.trim()||!value.rows.some((r:any)=>!r.excluded)))return null;
 if(kind==='regular'&&value.assessmentDate&&value.assessmentDate.slice(0,4)!==period)return null;
 // Opening date is an explicit user input; do not infer it from a current contract.
 const rowKeys=['id','number','section','process','task','hazard','level','measure','dueDate','doneDate','owner','excluded','excludeReason'];
 const improvementKeys=['number','process','task','hazard','measure','date','reviewer','beforePhoto','afterPhoto'];
 return {assessmentDate:value.assessmentDate,openingDate:value.openingDate,evaluator:value.evaluator,target:value.target,notes:value.notes,
  rows:value.rows.map((r:any)=>Object.fromEntries(rowKeys.map(k=>[k,r[k]]))),improvements:value.improvements.map((r:any)=>Object.fromEntries(improvementKeys.map(k=>[k,r[k]])))};
}
async function evaluationRequest(sql:any,actor:any,body:any,reply:any){
 const siteId=body.siteId,kind=body.kind,period=body.period;
 if(!isText(siteId,128)||actor.role==='field'&&siteId!==actor.siteId)return reply({ok:false,message:'forbidden'},403);
 if(!['initial','regular'].includes(kind)||!(kind==='initial'?period==='initial':typeof period==='string'&&/^[12][0-9]{3}$/.test(period)))return reply({ok:false,message:'invalid_period'},400);
 const [site]=await sql`select s.site_id,s.site_name,s.active,f.revision as folder_revision from public.enl_site_master s join private.enl_risk_folders f using(site_id) where s.site_id=${siteId} and not f.deleted`;
 if(!site)return reply({ok:false,message:'site_unavailable'},404);
 const where=sql`site_id=${siteId} and kind=${kind} and period=${period}`;
 if(body.action==='platform_risk_documents'){
  const records=await sql`select distinct on (template_id) template_id,revision,state,saved_at,actor_name from private.enl_risk_records where ${where} order by template_id,revision desc`;
  const years=await sql`select distinct period from private.enl_risk_records where site_id=${siteId} and kind='regular' order by period desc`;
  return reply({ok:true,site,records,years:years.map((r:any)=>r.period),templates:riskTemplates.books.map(b=>({id:b.id,name:b.name,count:b.sections.reduce((n,s)=>n+s.rows.length,0)}))});
 }
 const book=riskTemplates.books.find(b=>b.id===body.templateId);
 if(!book)return reply({ok:false,message:'invalid_template'},400);
 if(body.action==='platform_risk_open'){
  const history=await sql`select revision,state,saved_at,actor_name from private.enl_risk_records where ${where} and template_id=${book.id} order by revision desc limit 50`;
  const revision=body.revision??history[0]?.revision??0;
  if(!Number.isInteger(revision)||revision<0)return reply({ok:false,message:'invalid_revision'},400);
  const [doc]=revision?await sql`select * from private.enl_risk_records where ${where} and template_id=${book.id} and revision=${revision}`:[];
  if(revision&&!doc)return reply({ok:false,message:'record_unavailable'},404);
  const content=doc?.content||riskDefault(book),ids=content.improvements.flatMap((r:any)=>[r.beforePhoto,r.afterPhoto]).filter(Boolean);
  const photos=ids.length?await sql`select id,mime,replace(encode(bytes,'base64'),E'\\n','') as base64 from private.enl_risk_photos where site_id=${siteId} and id in (select jsonb_array_elements_text(${sql.json(ids)}::jsonb))`:[];
  return reply({ok:true,site,template:{id:book.id,name:book.name,version:riskTemplates.version},document:doc?{revision:doc.revision,state:doc.state,saved_at:doc.saved_at,actor_name:doc.actor_name,content}:{revision:0,state:'draft',content},history,photos,latestRevision:history[0]?.revision||0});
 }
 if(body.action!=='platform_risk_save')return reply({ok:false,message:'unknown_action'},400);
 if(!['field','safety'].includes(actor.role))return reply({ok:false,message:'forbidden'},403);
 if(!Number.isInteger(body.revision)||body.revision<0||!Number.isInteger(body.folderRevision)||!['draft','completed'].includes(body.state))return reply({ok:false,message:'invalid_record'},400);
 const content=riskContent(body.content,book,body.state==='completed',kind,period);
 if(!content)return reply({ok:false,message:'invalid_record'},400);
 const refs=[...new Set(content.improvements.flatMap((r:any)=>[r.beforePhoto,r.afterPhoto]).filter(Boolean))];
 const inputs=body.photos??[];if(!Array.isArray(inputs)||inputs.length>6)return reply({ok:false,message:'invalid_photo'},400);
 const photos=[];
 for(const p of inputs){
  if(!p||!refs.includes(p.id)||!['image/jpeg','image/png'].includes(p.mime)||typeof p.base64!=='string'||p.base64.length>466668||! /^[A-Za-z0-9+/]+={0,2}$/.test(p.base64))return reply({ok:false,message:'invalid_photo'},400);
  const bytes=Uint8Array.from(atob(p.base64),(c:string)=>c.charCodeAt(0));
  if(bytes.length>350000||bytes.length<24||!(p.mime==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):bytes[0]===255&&bytes[1]===216&&bytes[2]===255))return reply({ok:false,message:'invalid_photo'},400);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==p.id)return reply({ok:false,message:'invalid_photo'},400);
  photos.push(p);
 }
 return sql.begin(async(tx:any)=>{
  // Same folder lock serializes document saves and folder hide/rename safely.
  await tx`select pg_advisory_xact_lock(hashtextextended(${siteId},2912))`;
  const [folder]=await tx`select revision,deleted from private.enl_risk_folders where site_id=${siteId} for update`;
  if(!folder||folder.deleted)return reply({ok:false,message:'site_unavailable'},404);
  if(folder.revision!==body.folderRevision)return reply({ok:false,message:'folder_changed'},409);
  const [last]=await tx`select revision from private.enl_risk_records where ${where} and template_id=${book.id} order by revision desc limit 1`;
  if((last?.revision||0)!==body.revision)return reply({ok:false,message:'record_changed'},409);
  const existing=refs.length?await tx`select id from private.enl_risk_photos where site_id=${siteId} and id in (select jsonb_array_elements_text(${tx.json(refs)}::jsonb))`:[];
  if(refs.some(id=>!existing.some((p:any)=>p.id===id)&&!photos.some(p=>p.id===id)))return reply({ok:false,message:'invalid_photo'},400);
  for(const p of photos)await tx`insert into private.enl_risk_photos(site_id,id,mime,bytes,actor_id) values(${siteId},${p.id},${p.mime},decode(${p.base64},'base64'),${actor.id}) on conflict(site_id,id) do nothing`;
  const revision=body.revision+1;
  await tx`insert into private.enl_risk_records(site_id,kind,period,template_id,revision,template_version,content,state,actor_id,actor_name) values(${siteId},${kind},${period},${book.id},${revision},${riskTemplates.version},${tx.json(content)},${body.state},${actor.id},${actor.name})`;
  return reply({ok:true,revision});
 });
}
