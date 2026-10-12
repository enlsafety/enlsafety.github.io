import postgres from 'npm:postgres@3.4.5';
import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
import './historical-bulk-core.js';
const Core=(globalThis as any).ENLHistoricalBulk;
const ORIGIN='https://enlsafety.github.io',APP='incident-report-v2',BUCKET='enl-import-originals',VERSION='4.5.4-lifecycle-2';
const clean=(v:any)=>String(v??'').trim();
const uuid=(v:any)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean(v));
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const store=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}).storage.from(BUCKET);
function fail(message:string):never{throw Error(message)}
const isRegistered=(c:any)=>!!c.incidentId;
const isBulk=(p:any)=>!!(p?.historicalOrigin?.batchId&&p?.historicalOrigin?.candidateId&&p?.externalInitialApproval?.state==='verified');
const progressed=(p:any)=>p.status==='closed'||!!p.closedAt||!!p.corrective&&Object.keys(p.corrective).length>0||(p.acknowledgements||[]).length>0||!!(p.officialRecord?.review||p.officialRecord?.approval||p.officialRecord?.finalApproval);
const lateFields=new Set(['cost','medicalCost','repairCost','damageAmount','diagnosis','doctorOpinion','followupNote','injuryDetail','damageDetail','medicalCostDetail','repairCostDetail']);
const immutableFields=new Set(['siteId','siteName','recordNo','erpRef','erpDate','erpStatus']);
async function actor(sql:any,b:any){
 const rows=await sql`select user_id,name,role,active,password_hash from public.enl_hq_users where user_id=${clean(b.actor?.id)} limit 1`,u=rows[0];
 if(!u||!u.active||u.role!=='safety'||!clean(u.password_hash)||clean(b.actorPasswordHash)!==u.password_hash)fail('auth_safety_required');
 return {id:u.user_id,name:u.name,role:u.role};
}
async function batch(sql:any,id:string,ownerId:string){const r=await sql`select * from private.enl_historical_batches where id=${id}`;if(!r[0])fail('batch_not_found');if(r[0].owner_id!==ownerId)fail('batch_owner_required');return r[0]}
const sites=async(sql:any)=>await sql`select site_id,site_name,active,start_date,contract_period from public.enl_site_master order by site_name`;
const audit=async(t:any,a:any,bat:string,action:string,detail:any)=>t`insert into private.enl_historical_import_audit(batch_id,actor_id,action,detail) values(${bat},${a.id},${action},${t.json(detail)}::jsonb)`;
const persist=async(t:any,id:string,cs:any)=>t`update private.enl_historical_batches set candidates=${t.json(cs)}::jsonb,updated_at=now() where id=${id}`;
async function withBatch(sql:any,id:string,ownerId:string,fn:any){return sql.begin(async(t:any)=>{await t`select pg_advisory_xact_lock(hashtextextended(${id},0))`;const row=await batch(t,id,ownerId);return fn(t,row)})}
async function setActor(t:any,a:any){await t`select set_config('enl.bulk_actor',${JSON.stringify(a)},true),set_config('enl.actor',${JSON.stringify({id:a.id,role:'safety'})},true)`;}
function candidate(r:any,b:any){const c=r.candidates.find((x:any)=>x.id===b.candidateId);if(!c)fail('candidate_not_found');return c}
function reason(b:any){const s=clean(b.reason);if(s.length<2||s.length>500)fail('correction_reason_required');return s}
function revision(c:any,b:any){if(c.revision!==b.revision)fail('revision_conflict')}
function applyValues(c:any,values:any,a:any,why:string){
 if(!values||Array.isArray(values)||typeof values!=='object')fail('invalid_field');
 const allowed=new Set([...Object.keys(Core.fields),'siteId']);
 for(const [k,v] of Object.entries(values)){
  if(!allowed.has(k)||typeof v!=='string'||v.length>6000)fail('invalid_field');
  if(clean(c.values[k])!==v){c.corrections.push({field:k,before:c.values[k]??null,after:v,reason:why,actorId:a.id,at:new Date().toISOString()});c.values[k]=v;}
 }
}
async function incident(t:any,c:any,bat:string){
 if(!c.incidentId)fail('candidate_not_registered');
 const rows=await t`select * from public.enl_incident_shared where incident_id=${c.incidentId} for update`,row=rows[0];
 if(!row||!isBulk(row.payload)||row.payload.historicalOrigin.batchId!==bat||row.payload.historicalOrigin.candidateId!==c.id)fail('candidate_scope_mismatch');
 return row;
}
async function updateIncident(t:any,a:any,bat:string,c:any,row:any,next:any,action:string,why:string){
 const at=new Date().toISOString();next._syncBaseVersion=Number(row.payload._syncVersion||0);next._syncMutationId=crypto.randomUUID();next.updatedAt=at;
 next.lastModifiedBy=a.id;next.lastModifiedRole='safety';next.lastModifiedAt=at;
 await setActor(t,a);
 const updated=await t`update public.enl_incident_shared set payload=${t.json(next)}::jsonb,updated_at=${at} where incident_id=${c.incidentId} returning payload`;
 await t`insert into public.enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload) values(${c.incidentId},${row.site_id},'update',${a.id},${a.name},'safety','',${at},${t.json(row.payload)}::jsonb,${t.json(updated[0].payload)}::jsonb)`;
 await audit(t,a,bat,action,{candidateId:c.id,incidentId:c.incidentId,before:row.payload,after:updated[0].payload,reason:why});
 c.incidentVersion=updated[0].payload._syncVersion;c.revision++;return updated[0].payload;
}
async function validateCandidate(t:any,c:any,ss:any,excludeId=''){
 const issues=Core.validate(c,ss),site=ss.find((s:any)=>s.site_id===c.values.siteId);
 if(site){
  const start=clean(site.start_date),m=clean(site.contract_period).match(/(?:~|〜|∼|부터|to)\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*$/i);
  const from=Core.date(start)||(/^\d{4}-\d{2}$/.test(start)?start+'-01':''),until=m?Core.date(m[1]):'';
  if(from&&c.values.occurredDate<from||until&&c.values.occurredDate>until)issues.push({code:'contract',message:'발생일이 사업장 계약기간 밖입니다. 사업장과 발생일을 확인해 주세요.'});
 }
 const fs=await t`select file_id from private.enl_historical_files where batch_id=${c.batchId}`;
 if(!c.sources?.length||c.sources.some((id:string)=>!fs.some((f:any)=>f.file_id===id)))issues.push({code:'source',message:'등록할 사고의 비공개 원본 연결이 없습니다.'});
 const all=await t`select incident_id,payload from public.enl_incident_shared where incident_id<>${excludeId} and coalesce(payload->'bulkInvalidation'->>'active','false')<>'true' and (site_id=${c.values.siteId} or payload->'historicalOrigin'->>'recordNo'=${c.values.recordNo||'--none--'})`;
 const dup=all.filter((x:any)=>{
  const p=x.payload,v=c.values;
  if(v.recordNo&&(p.historicalOrigin?.recordNo===v.recordNo||x.incident_id===v.recordNo))return true;
  if(p.siteId!==v.siteId||String(p.occurredDate||p.occurredAt||'').slice(0,10)!==v.occurredDate)return false;
  const sameSummary=!!Core.norm(v.incidentHow)&&Core.norm(p.summary)===Core.norm(v.incidentHow);
  const person=Core.norm(p.injuredName||p.reportDetails?.injuredName),victim=Core.norm(v.name);
  const samePerson=person&&victim&&person===victim;
  const damage=Core.norm(p.reportDetails?.injuryDetail||p.reportDetails?.damageDetail),incoming=Core.norm(v.injuryDetail||v.damageDetail);
  return sameSummary||samePerson&&damage&&damage===incoming;
 });
 if(dup.length)issues.push({code:'duplicate',message:'기존 사고와 사고번호 또는 사업장·발생일·사고내용이 일치합니다. 중복 여부를 확인해 주세요.',incidentIds:dup.map((x:any)=>x.incident_id)});
 return issues;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',stage=Deno.env.get('SUPABASE_URL')==='https://zgwxzfvvpqgdedyobwmg.supabase.co';
 const allowed=!origin||origin===ORIGIN||stage&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
 const cors={'Access-Control-Allow-Origin':allowed&&origin?origin:ORIGIN,'Access-Control-Allow-Headers':'content-type, x-enl-app','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:cors});
 if(!allowed)return json({ok:false,message:'invalid_origin'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({ok:false,message:'method_not_allowed'},405);
 if(req.headers.get('x-enl-app')!==APP)return json({ok:false,message:'invalid_client'},403);
 let b:any;try{const raw=await req.text();if(raw.length>18*1024*1024)return json({ok:false,message:'request_too_large'},413);b=JSON.parse(raw);if(!b||typeof b!=='object')throw Error()}catch{return json({ok:false,message:'invalid_json'},400)}
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:2,connect_timeout:5});let a:any=null,owned=false;
 try{
  a=await actor(sql,b);
  if(b.action==='options')return json({ok:true,sites:await sites(sql),version:VERSION,method:'local-structured-extraction-and-ocr',paidAI:false});
  if(b.action==='list'){const rows=await sql`select id,created_at,updated_at,jsonb_array_length(candidates) as count from private.enl_historical_batches where owner_id=${a.id} order by updated_at desc limit 100`;return json({ok:true,batches:rows})}
  if(!uuid(b.batchId))fail('invalid_batch_id');
  if(b.action==='create'){
   if(b.erpConfirmed!==true)fail('erp_confirmation_required');
   await sql`insert into private.enl_historical_batches(id,owner_id,erp_confirmed_at) values(${b.batchId},${a.id},now()) on conflict(id) do nothing`;
   return json({ok:true,batch:await batch(sql,b.batchId,a.id)});
  }
  await batch(sql,b.batchId,a.id);owned=true;
  if(b.action==='get'){
   const row=await batch(sql,b.batchId,a.id),fs=await sql`select file_id,name,hash,method,size from private.enl_historical_files where batch_id=${b.batchId}`;
   const ids=row.candidates.filter(isRegistered).map((c:any)=>c.incidentId);
   const incidents=ids.length?await sql`select incident_id,payload from public.enl_incident_shared where incident_id in ${sql(ids)}`:[];
   for(const c of row.candidates){const p=incidents.find((x:any)=>x.incident_id===c.incidentId)?.payload;if(p){c.values=Core.valuesFromIncident(p,c.values);c.incidentVersion=p._syncVersion||0;c.workflowStarted=progressed(p);c.state=p.bulkInvalidation?.active?'voided':'success';}}
   const history=await sql`select actor_id,action,created_at,detail from private.enl_historical_import_audit where batch_id=${b.batchId} order by created_at desc limit 500`;
   return json({ok:true,batch:row,files:fs,incidents,history});
  }
  if(b.action==='file_error'){
   await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{const errors=[...r.file_errors.filter((e:any)=>e.name!==clean(b.name)),{name:clean(b.name).slice(0,160),message:clean(b.message).slice(0,300)}].slice(-100);await t`update private.enl_historical_batches set file_errors=${t.json(errors)}::jsonb,updated_at=now() where id=${b.batchId}`;});return json({ok:true});
  }
  if(b.action==='upload'){
   const f=b.file||{},name=clean(f.name).replace(/[\\/<>]/g,'_').slice(0,160);
   if(!/\.(pdf|xlsx|xls|csv|docx|hwpx|jpe?g|png|webp)$/i.test(name))fail('unsupported_file');
   if(typeof f.base64!=='string'||f.base64.length>17*1024*1024)fail('file_too_large');
   const bytes=Uint8Array.from(atob(f.base64),x=>x.charCodeAt(0));if(!bytes.length||bytes.length>12*1024*1024||bytes.length!==f.size)fail('invalid_file_size');
   const digest=await hash(bytes);if(digest!==f.hash||digest!==f.id)fail('file_hash_mismatch');
   if(!['text','ocr'].includes(f.method)||!Array.isArray(f.units)||JSON.stringify(f.units).length>350000)fail('invalid_extraction');
   const out=await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{
    const linked=b.candidateId?candidate(r,b):null;if(linked?.state==='voided')fail('candidate_voided');
    if(!linked&&r.candidates.some(isRegistered))fail('batch_registered_create_new');
    const count=await t`select count(*)::int n,coalesce(sum(size),0)::bigint bytes from private.enl_historical_files where batch_id=${b.batchId}`;
    const old=await t`select file_id from private.enl_historical_files where batch_id=${b.batchId} and file_id=${digest}`;
    if(!old.length){
     if(count[0].n>=50||Number(count[0].bytes)+bytes.length>100*1024*1024)fail('batch_limit_50_files_100mb');
     const path=`${b.batchId}/${digest}`,upload=await store().upload(path,bytes,{contentType:({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',csv:'text/csv'} as Record<string,string>)[name.split('.').pop()!.toLowerCase()]||'application/octet-stream',upsert:false});
     if(upload.error&&String(upload.error.statusCode||upload.error.status)!=='409')fail('source_upload_failed');
     await t`insert into private.enl_historical_files(batch_id,file_id,path,name,hash,size,method,units) values(${b.batchId},${digest},${path},${name},${digest},${bytes.length},${f.method},${t.json(f.units)}::jsonb)`;
    }
    if(linked&&!linked.sources.includes(digest)){
     linked.sources.push(digest);
     if(linked.incidentId){const row=await incident(t,linked,b.batchId),next=structuredClone(row.payload);if(next.bulkInvalidation?.active)fail('candidate_voided');next.historicalOrigin.sourceFileIds=[...linked.sources];await updateIncident(t,a,b.batchId,linked,row,next,'bulk_source_added','후속 원본자료 첨부');}
     else linked.revision++;
     await audit(t,a,b.batchId,'source_linked',{candidateId:linked.id,fileId:digest});await persist(t,b.batchId,r.candidates);
    }
    await t`update private.enl_historical_batches set file_errors=${t.json(r.file_errors.filter((e:any)=>e.name!==name))}::jsonb,updated_at=now() where id=${b.batchId}`;
    return {ok:true,fileId:digest,reused:old.length>0};
   });return json(out);
  }
  if(b.action==='sign'){
   const row=await batch(sql,b.batchId,a.id);if(b.candidateId&&!row.candidates.some((c:any)=>c.id===b.candidateId&&c.sources.includes(b.fileId)))fail('file_not_linked');
   const fs=await sql`select path,name from private.enl_historical_files where batch_id=${b.batchId} and file_id=${clean(b.fileId)}`;if(!fs[0])fail('file_not_found');
   const url=await store().createSignedUrl(fs[0].path,60);if(url.error)fail('source_sign_failed');return json({ok:true,url:url.data.signedUrl});
  }
  if(b.action==='analyze'){
   const out=await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{
    if(r.candidates.some(isRegistered))fail('batch_registered_create_new');
    if(r.candidates.some((c:any)=>c.corrections?.length||c.state==='excluded')&&!b.resetConfirmed)fail('reviewed_candidates_no_reset');
    const fs=await t`select file_id as id,name,method,units from private.enl_historical_files where batch_id=${b.batchId}`,ss=await sites(t),cs=Core.analyze(fs,ss);
    if(cs.length>250)fail('batch_limit_250_incidents');
    for(const c of cs){c.batchId=b.batchId;c.validation=await validateCandidate(t,c,ss);c.state=c.validation.length?'review':'ready';}
    await persist(t,b.batchId,cs);await audit(t,a,b.batchId,'analyze',{count:cs.length});return cs;
   });return json({ok:true,candidates:out});
  }
  if(['save','exclude','restore_candidate'].includes(b.action)){
   const out=await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{
    const c=candidate(r,b);if(isRegistered(c))fail('candidate_locked');revision(c,b);const why=reason(b),before=structuredClone(c.values);c.batchId=b.batchId;
    if(b.action==='save'){
     if(c.state==='excluded')fail('candidate_excluded');applyValues(c,b.values,a,why);
     if(b.resolveIssues===true)c.resolvedCodes=[...new Set((c.issues||[]).map((x:any)=>x.code))];
     c.corrections.push({field:'review',reason:why,actorId:a.id,at:new Date().toISOString(),resolvedWarnings:b.resolveIssues===true});
     c.validation=await validateCandidate(t,c,await sites(t));c.state=c.validation.length?'review':'ready';
    }else if(b.action==='exclude'){c.state='excluded';}
    else {if(c.state!=='excluded')fail('candidate_not_excluded');c.validation=await validateCandidate(t,c,await sites(t));c.state=c.validation.length?'review':'ready';}
    c.error=null;c.revision++;await persist(t,b.batchId,r.candidates);await audit(t,a,b.batchId,b.action,{candidateId:c.id,before,after:c.values,state:c.state,reason:why});return c;
   });return json({ok:true,candidate:out});
  }
  if(['update_incident','void_incident','restore_incident'].includes(b.action)){
   const out=await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{
    const c=candidate(r,b);revision(c,b);const why=reason(b),row=await incident(t,c,b.batchId),p=row.payload;
    if(Number(b.incidentVersion)!==Number(p._syncVersion||0))fail('incident_revision_conflict');
    let next=structuredClone(p);c.values=Core.valuesFromIncident(p,c.values);
    if(b.action==='update_incident'){
     if(p.bulkInvalidation?.active)fail('candidate_voided');
     for(const [k,v] of Object.entries(b.values||{}))if(clean(c.values[k])!==v){if(immutableFields.has(k))fail('candidate_identity_locked');if(progressed(p)&&!lateFields.has(k))fail('candidate_workflow_locked');}
     applyValues(c,b.values,a,why);c.batchId=b.batchId;
     // Missing legacy facts can remain unknown; changed fields and mandatory values are revalidated.
     const test={...c,evidence:{...c.evidence},corrections:[...c.corrections]};
     for(const k of Object.keys(c.values))if(!test.evidence[k]?.length)test.corrections.push({field:k,reason:'기등록 자료 유지'});
     const invalid=await validateCandidate(t,test,await sites(t),c.incidentId);if(invalid.length)fail('candidate_invalid_update');
     next=Core.patchIncident(p,c.values,a,new Date().toISOString());
    }else if(b.action==='void_incident'){
     if(p.bulkInvalidation?.active)return c;
     if(progressed(p))fail('candidate_workflow_locked');
     next.bulkInvalidation={active:true,at:new Date().toISOString(),actorId:a.id,reason:why};c.state='voided';
    }else{
     if(!p.bulkInvalidation?.active)fail('candidate_not_voided');
     c.batchId=b.batchId;const invalid=await validateCandidate(t,c,await sites(t),c.incidentId);
     if(invalid.some((x:any)=>x.code==='duplicate'))fail('candidate_restore_duplicate');
     next.bulkInvalidation={...p.bulkInvalidation,active:false,restoredAt:new Date().toISOString(),restoredBy:a.id,restoreReason:why};c.state='success';
    }
    await updateIncident(t,a,b.batchId,c,row,next,b.action,why);await persist(t,b.batchId,r.candidates);return c;
   });return json({ok:true,candidate:out});
  }
  if(b.action==='commit'){
   if(b.finalConfirmed!==true)fail('final_confirmation_required');
   const out=await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{
    await t`select pg_advisory_xact_lock(hashtextextended('enl-historical-bulk-registration',0))`;
    const c=candidate(r,b);if(isRegistered(c))return c;revision(c,b);if(c.state==='excluded')fail('candidate_excluded');c.batchId=b.batchId;
    c.validation=await validateCandidate(t,c,await sites(t));
    if(c.validation.length){c.state='review';await persist(t,b.batchId,r.candidates);return c;}
    // finalConfirmed records one batch-level review; manual_review_required only for unresolved issues.
    c.corrections.push({field:'review',reason:'분석 요약 및 ERP 기결재 근거 최종 확인',actorId:a.id,at:new Date().toISOString()});
    const at=new Date().toISOString(),id=crypto.randomUUID(),p=Core.makeIncident(c,b.batchId,a,at,id);await setActor(t,a);
    const saved=await t`insert into public.enl_incident_shared(incident_id,site_id,payload,created_at,updated_at) values(${id},${p.siteId},${t.json(p)}::jsonb,${at},${at}) returning payload`;
    await t`insert into public.enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload) values(${id},${p.siteId},'create',${a.id},${a.name},'safety','',${at},null,${t.json(saved[0].payload)}::jsonb)`;
    c.state='success';c.incidentId=id;c.registeredAt=at;c.incidentVersion=saved[0].payload._syncVersion;c.error=null;c.revision++;
    await persist(t,b.batchId,r.candidates);await audit(t,a,b.batchId,'registered',{candidateId:c.id,incidentId:id});return c;
   });return json({ok:true,candidate:out});
  }
  fail('invalid_action');
 }catch(e:any){
  const m=clean(e?.message),known=/^(auth_|invalid_|batch_|erp_|file_|source_|candidate_|incident_revision_|revision_|correction_|reviewed_|unsupported_|final_)/.test(m);
  // Never write an error state until both authentication and batch ownership have succeeded.
  if(a&&owned&&b?.action==='commit'&&!['revision_conflict','candidate_excluded'].includes(m))try{await withBatch(sql,b.batchId,a.id,async(t:any,r:any)=>{const c=r.candidates.find((x:any)=>x.id===b.candidateId);if(c&&!isRegistered(c)&&c.state!=='excluded'){c.state='failed';c.error=known?m:'등록 트랜잭션 실패. 저장상태를 다시 확인한 뒤 재시도해 주세요.';await persist(t,b.batchId,r.candidates);}})}catch{}
  console.error('historical_bulk_failure',{action:['options','list','create','get','upload','sign','analyze','save','commit','update_incident','void_incident','restore_incident','exclude','restore_candidate'].includes(b?.action)?b.action:'unknown',code:known?m:'database_or_service_failure',sqlState:/^[0-9A-Z]{5}$/.test(e?.code||'')?e.code:undefined,errorType:e?.name});
  return json({ok:false,message:known?m:'처리 실패. 저장상태를 확인하고 다시 시도해 주세요.'},m.startsWith('auth_')||m==='batch_owner_required'?403:m.includes('conflict')?409:400);
 }finally{await sql.end({timeout:1}).catch(()=>{})}
});
