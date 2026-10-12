import postgres from 'npm:postgres@3.4.5';
import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
import './historical-bulk-core.js';
const Core=(globalThis as any).ENLHistoricalBulk;
const ORIGIN='https://enlsafety.github.io',APP='incident-report-v2',BUCKET='enl-import-originals';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type, x-enl-app','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:cors});
const clean=(v:any)=>String(v??'').trim();
const uuid=(v:any)=>/^[0-9a-f-]{36}$/i.test(clean(v));
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const store=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!).storage.from(BUCKET);
function fail(message:string){throw Error(message)}
async function actor(sql:any,b:any){const rows=await sql`select user_id,name,role,active,password_hash from public.enl_hq_users where user_id=${clean(b.actor?.id)} limit 1`;const u=rows[0];if(!u||!u.active||u.role!=='safety'||!clean(u.password_hash)||clean(b.actorPasswordHash)!==u.password_hash)fail('auth_safety_required');return {id:u.user_id,name:u.name,role:u.role};}
async function batch(sql:any,id:string,ownerId=''){const r=await sql`select * from private.enl_historical_batches where id=${id}`;if(!r[0])fail('batch_not_found');if(ownerId&&r[0].owner_id!==ownerId)fail('batch_owner_required');return r[0]}
const sites=async(sql:any)=>await sql`select site_id,site_name,active,start_date,contract_end_date from public.enl_site_master order by site_name`;
const audit=async(t:any,a:any,bat:string,action:string,detail:any)=>t`insert into private.enl_historical_import_audit(batch_id,actor_id,action,detail) values(${bat},${a.id},${action},${t.json(detail)}::jsonb)`;
async function withBatch(sql:any,id:string,fn:any,ownerId=''){return sql.begin(async(t:any)=>{await t`select pg_advisory_xact_lock(hashtextextended(${id},0))`;const row=await batch(t,id,ownerId);return fn(t,row)})}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({ok:false,message:'method_not_allowed'},405);
 if((req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)||req.headers.get('x-enl-app')!==APP)return json({ok:false,message:'invalid_client'},403);
 let b:any;try{const raw=await req.text();if(raw.length>18*1024*1024)return json({ok:false,message:'request_too_large'},413);b=JSON.parse(raw)}catch{return json({ok:false,message:'invalid_json'},400)}
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:2,connect_timeout:5});
 try{
  const a=await actor(sql,b);
  if(b.action==='options')return json({ok:true,sites:await sites(sql),method:'local-structured-extraction-and-ocr',paidAI:false});
  if(b.action==='list'){const rows=await sql`select id,created_at,updated_at,candidates,file_errors from private.enl_historical_batches where owner_id=${a.id} order by updated_at desc limit 30`;return json({ok:true,batches:rows})}
  if(!uuid(b.batchId))fail('invalid_batch_id');
  if(b.action!=='create')await batch(sql,b.batchId,a.id); // All reads/writes are owner-scoped.
  if(b.action==='create'){if(b.erpConfirmed!==true)fail('erp_confirmation_required');await sql`insert into private.enl_historical_batches(id,owner_id,erp_confirmed_at) values(${b.batchId},${a.id},now()) on conflict(id) do nothing`;return json({ok:true,batch:await batch(sql,b.batchId,a.id)})}
  if(b.action==='get'){const row=await batch(sql,b.batchId,a.id),files=await sql`select file_id,name,hash,method,units,size from private.enl_historical_files where batch_id=${b.batchId}`;return json({ok:true,batch:row,files})}
  if(b.action==='file_error'){await withBatch(sql,b.batchId,async(t:any,r:any)=>{const errors=[...r.file_errors.filter((e:any)=>e.name!==clean(b.name)),{name:clean(b.name).slice(0,160),message:clean(b.message).slice(0,300)}];await t`update private.enl_historical_batches set file_errors=${t.json(errors)}::jsonb,updated_at=now() where id=${b.batchId}`;});return json({ok:true})}
  if(b.action==='upload'){
   const bt=await batch(sql,b.batchId,a.id);if(bt.candidates.some((c:any)=>c.state==='success'))fail('batch_registered_create_new');
   const f=b.file||{},name=clean(f.name).replace(/[\\/<>]/g,'_').slice(0,160);if(!/\.(pdf|xlsx|xls|csv|docx|hwpx|jpe?g|png|webp)$/i.test(name))fail('unsupported_file');
   if(typeof f.base64!=='string'||f.base64.length>17*1024*1024)fail('file_too_large');const bytes=Uint8Array.from(atob(f.base64),x=>x.charCodeAt(0));if(!bytes.length||bytes.length>12*1024*1024||bytes.length!==f.size)fail('invalid_file_size');
   const digest=await hash(bytes);if(digest!==f.hash||digest!==f.id)fail('file_hash_mismatch');
   if(!['text','ocr'].includes(f.method)||!Array.isArray(f.units)||JSON.stringify(f.units).length>350000)fail('invalid_extraction');
   const old=await sql`select path from private.enl_historical_files where batch_id=${b.batchId} and file_id=${digest}`;if(old[0])return json({ok:true,fileId:digest,reused:true});
   const count=await sql`select count(*)::int n,sum(size)::bigint bytes from private.enl_historical_files where batch_id=${b.batchId}`;if(count[0].n>=50||Number(count[0].bytes||0)+bytes.length>100*1024*1024)fail('batch_limit_50_files_100mb');
   const path=`${b.batchId}/${digest}`;const upload=await store().upload(path,bytes,{contentType:'application/octet-stream',upsert:false});if(upload.error&&upload.error.statusCode!=='409'&&upload.error.status!==409)fail('source_upload_failed');
   await withBatch(sql,b.batchId,async(t:any,r:any)=>{if(r.candidates.some((c:any)=>c.state==='success'))fail('batch_registered_create_new');await t`insert into private.enl_historical_files(batch_id,file_id,path,name,hash,size,method,units) values(${b.batchId},${digest},${path},${name},${digest},${bytes.length},${f.method},${t.json(f.units)}::jsonb) on conflict(batch_id,file_id) do nothing`;await t`update private.enl_historical_batches set file_errors=${t.json(r.file_errors.filter((e:any)=>e.name!==name))}::jsonb,updated_at=now() where id=${b.batchId}`;});return json({ok:true,fileId:digest});
  }
  if(b.action==='sign'){
   const row=await batch(sql,b.batchId,a.id);if(b.candidateId&&!row.candidates.some((c:any)=>c.id===b.candidateId&&c.sources.includes(b.fileId)))fail('file_not_linked');
   const files=await sql`select path from private.enl_historical_files where batch_id=${b.batchId} and file_id=${clean(b.fileId)}`;if(!files[0])fail('file_not_found');const url=await store().createSignedUrl(files[0].path,60);if(url.error)fail('source_sign_failed');return json({ok:true,url:url.data.signedUrl});
  }
  if(b.action==='analyze'){
   const row=await withBatch(sql,b.batchId,async(t:any,r:any)=>{if(r.candidates.some((c:any)=>c.state==='success'))fail('batch_registered_create_new');if(r.candidates.some((c:any)=>c.corrections?.length)&&!b.resetConfirmed)fail('reviewed_candidates_no_reset');const fs=await t`select file_id as id,name,method,units from private.enl_historical_files where batch_id=${b.batchId}`;const candidates=Core.analyze(fs,await sites(t));if(candidates.length>250)fail('batch_limit_250_incidents');await t`update private.enl_historical_batches set candidates=${t.json(candidates)}::jsonb,updated_at=now() where id=${b.batchId}`;await audit(t,a,b.batchId,'analyze',{count:candidates.length});return candidates;});return json({ok:true,candidates:row});
  }
  if(b.action==='save'){
   const out=await withBatch(sql,b.batchId,async(t:any,r:any)=>{const cs=r.candidates,c=cs.find((c:any)=>c.id===b.candidateId);if(!c||c.state==='success')fail('candidate_locked');if(c.revision!==b.revision)fail('revision_conflict');if(!clean(b.reason))fail('correction_reason_required');const allowed=new Set([...Object.keys(Core.fields),'siteId']);const before=structuredClone(c.values);for(const [k,v] of Object.entries(b.values||{})){if(!allowed.has(k)||typeof v!=='string'||v.length>6000)fail('invalid_field');if(c.values[k]!==v){c.corrections.push({field:k,before:c.values[k]??null,after:v,reason:clean(b.reason).slice(0,500),actorId:a.id,at:new Date().toISOString()});c.values[k]=v;}}
    if(b.resolveIssues===true){c.resolvedCodes=[...new Set((c.issues||[]).map((x:any)=>x.code))];c.corrections.push({field:'review',reason:clean(b.reason),actorId:a.id,at:new Date().toISOString()});}
    c.revision++;c.state='review';c.error=null;c.validation=Core.validate(c,await sites(t));await t`update private.enl_historical_batches set candidates=${t.json(cs)}::jsonb,updated_at=now() where id=${b.batchId}`;await audit(t,a,b.batchId,'review',{candidateId:c.id,before,after:c.values,reason:clean(b.reason)});return c;});return json({ok:true,candidate:out});
  }
  if(b.action==='commit'){
   if(b.finalConfirmed!==true)fail('final_confirmation_required');
   const out=await withBatch(sql,b.batchId,async(t:any,r:any)=>{
    // Serialize importer batches against each other. Never upsert an incident.
    await t`select pg_advisory_xact_lock(hashtextextended('enl-historical-bulk-registration',0))`;
    const cs=r.candidates,c=cs.find((c:any)=>c.id===b.candidateId);if(!c)fail('candidate_not_found');if(c.state==='success')return c;
    if(c.revision!==b.revision)fail('revision_conflict');const ss=await sites(t);c.validation=Core.validate(c,ss);
    const site=ss.find((s:any)=>s.site_id===c.values.siteId);if(site&&((site.start_date&&c.values.occurredDate<site.start_date)||(site.contract_end_date&&c.values.occurredDate>site.contract_end_date)))c.validation.push({code:'contract',message:'발생일이 사업장 계약기간 밖입니다. 사업장 및 발생일을 재확인해 주세요.'});
    if(!c.sources.length)fail('source_required');const fs=await t`select file_id,hash from private.enl_historical_files where batch_id=${b.batchId}`;if(c.sources.some((id:string)=>!fs.some((f:any)=>f.file_id===id)))fail('source_missing');
    const all=await t`select incident_id,payload from public.enl_incident_shared where site_id=${c.values.siteId} or payload->'externalInitialApproval'->>'documentNo'=${c.values.erpRef||'--none--'} or payload->'historicalOrigin'->>'recordNo'=${c.values.recordNo||'--none--'}`;
    const dup=all.filter((x:any)=>{const p=x.payload,v=c.values;return(v.recordNo&&(p.historicalOrigin?.recordNo===v.recordNo||x.incident_id===v.recordNo))||(v.erpRef&&[p.externalInitialApproval?.documentNo,p.historicalImport?.erpApprovalRef,p.historicalTransfer?.erpReference].includes(v.erpRef))||(p.siteId===v.siteId&&String(p.occurredDate||p.occurredAt).slice(0,10)===v.occurredDate&&(Core.norm(p.summary)===Core.norm(v.incidentHow)||Core.norm(p.reportDetails?.injuryDetail||p.reportDetails?.damageDetail)===Core.norm(v.injuryDetail||v.damageDetail)))||(p.historicalOrigin?.sourceFileIds?.some((id:string)=>c.sources.includes(id))&&p.historicalOrigin?.candidateId===c.id);});
    if(dup.length)c.validation.push({code:'duplicate',message:'기존 사고와 사고번호·ERP 문서번호·발생일/피해내용 또는 원본이 일치합니다. 등록을 보류합니다.',incidentIds:dup.map((x:any)=>x.incident_id)});
    if(c.validation.length){c.state='review';await t`update private.enl_historical_batches set candidates=${t.json(cs)}::jsonb,updated_at=now() where id=${b.batchId}`;return c;}
    const at=new Date().toISOString(),id=crypto.randomUUID(),incident=Core.makeIncident(c,b.batchId,a,at,id);
    await t`select set_config('enl.bulk_actor',${JSON.stringify(a)},true)`;
    await t`select set_config('enl.actor',${JSON.stringify({id:a.id,role:'safety'})},true)`;
    const saved=await t`insert into public.enl_incident_shared(incident_id,site_id,payload,created_at,updated_at) values(${id},${incident.siteId},${t.json(incident)}::jsonb,${at},${at}) returning payload`;
    await t`insert into public.enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload) values(${id},${incident.siteId},'external_erp_initial_approval_verified',${a.id},${a.name},'safety','',${at},null,${t.json(saved[0].payload)}::jsonb)`;
    c.state='success';c.incidentId=id;c.registeredAt=at;c.error=null;c.revision++;await t`update private.enl_historical_batches set candidates=${t.json(cs)}::jsonb,updated_at=now() where id=${b.batchId}`;await audit(t,a,b.batchId,'registered',{candidateId:c.id,incidentId:id});return c;
   });return json({ok:true,candidate:out});
  }
  fail('invalid_action');
 }catch(e:any){console.error('historical_bulk_failure',{action:b?.action,code:e?.code||e?.name,message:String(e?.message||'').slice(0,200)});const m=clean(e?.message),known=/^(auth_|invalid_|batch_|erp_|file_|source_|candidate_|revision_|correction_|reviewed_)/.test(m);if(b?.action==='commit'&&uuid(b.batchId)&&!['revision_conflict','auth_safety_required'].includes(m)){try{await withBatch(sql,b.batchId,async(t:any,r:any)=>{const c=r.candidates.find((x:any)=>x.id===b.candidateId);if(c&&c.state!=='success'){c.state='failed';c.error=known?m:'등록 트랜잭션 실패. 재시도 전에 저장상태를 재조회합니다.';await t`update private.enl_historical_batches set candidates=${t.json(r.candidates)}::jsonb where id=${b.batchId}`;}})}catch{}}
 return json({ok:false,message:known?m:'처리 실패. 원본과 저장 상태를 확인하고 다시 시도해 주세요.'},m==='auth_safety_required'?403:m==='revision_conflict'?409:400);
 }finally{await sql.end({timeout:1}).catch(()=>{})}
});
