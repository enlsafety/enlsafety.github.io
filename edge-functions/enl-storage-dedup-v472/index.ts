// One-run, fixed-manifest maintenance. Disable this endpoint after completion.
// It never accepts object paths, SQL, a bucket, or a manifest from the caller.
import postgres from 'npm:postgres@3.4.5';
import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';

const PROJECT='wjelumpbjklfrdjxbesj';
const MIGRATION='enl-storage-dedup-20261023-v472';
const MANIFEST_SHA256='b2c5fee07b3ec3eab83ecf65362dd24c5d5537eb320f4bf73c9d310cfbc56522';
const EXPECTED_ROWS=55,EXPECTED_REMOVALS=31;
// Private builder supplies a one-hour gate. Unbuilt repository source fails closed.
const MAINTENANCE_GATE=/*__MAINTENANCE_GATE__*/ null as any;
const ORIGIN='https://enlsafety.github.io',APP='incident-report-v2';
const clean=(v:any)=>String(v??'').trim();
const fail=(code:string):never=>{throw Error(code)};
const stable=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
const hash=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
type Entry={batchId:string,fileId:string,oldPath:string,canonicalPath:string,sha256:string,bytes:number,rowSha256:string};
function validateManifest(m:any){
 if(m?.version!==1||m.project!==PROJECT||m.migrationId!==MIGRATION||m.bucket!=='enl-import-originals'||!Array.isArray(m.entries)||m.entries.length!==EXPECTED_ROWS)fail('manifest_invalid');
 const ids=new Set<string>(),paths=new Map<string,Entry>();
 for(const e of m.entries as Entry[]){
  if(!/^[a-f0-9-]{36}$/.test(e.batchId)||!/[a-f0-9]{64}/.test(e.fileId)||e.fileId!==e.sha256||!/^[a-f0-9]{64}$/.test(e.sha256)||!/^[a-f0-9]{64}$/.test(e.rowSha256)||!Number.isSafeInteger(e.bytes)||e.bytes<=0||e.bytes>12*1024*1024)fail('manifest_invalid');
  if(!/^[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(e.oldPath)||!/^[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(e.canonicalPath)||ids.has(e.batchId+':'+e.fileId)||paths.has(e.oldPath))fail('manifest_invalid');
  ids.add(e.batchId+':'+e.fileId);paths.set(e.oldPath,e);
 }
 for(const e of m.entries as Entry[]){const c=paths.get(e.canonicalPath);if(!c||c.sha256!==e.sha256||c.bytes!==e.bytes||c.canonicalPath!==c.oldPath)fail('canonical_invalid');}
 if(m.entries.filter((e:Entry)=>e.oldPath!==e.canonicalPath).length!==EXPECTED_REMOVALS)fail('manifest_invalid');
 return m as {version:number,migrationId:string,project:string,bucket:string,entries:Entry[]};
}
async function readRun(sql:any){
 const rows=await sql`select * from private.enl_storage_dedup_runs where migration_id=${MIGRATION}`;
 const row=rows[0];if(!row||row.manifest_sha256!==MANIFEST_SHA256)fail('manifest_missing');
 if(await hash(new TextEncoder().encode(stable(row.manifest)))!==MANIFEST_SHA256)fail('manifest_changed');
 return {...row,manifest:validateManifest(row.manifest)};
}
function backupReady(run:any){const p=run.backup_proof;if(!p||p.manifestSha256!==MANIFEST_SHA256||p.objectCount!==EXPECTED_ROWS||!/^[a-f0-9]{64}$/.test(p.archiveSha256||'')||!/^libfile_[a-f0-9]+$/.test(p.libraryFileId||''))fail('durable_backup_required');}
async function authenticate(sql:any,b:any){
 const rows=await sql`select user_id,active,role,password_hash from public.enl_hq_users where user_id=${clean(b.actor?.id)} limit 1`,u=rows[0];
 if(!u||u.active!==true||u.role!=='safety'||!u.password_hash||clean(b.actorPasswordHash)!==u.password_hash)fail('auth_safety_required');
 return u.user_id;
}
async function state(sql:any,m:any,kind:'before'|'after'){
 const rows=await sql`select f.batch_id::text as batch_id,f.file_id,f.path,encode(sha256(convert_to((to_jsonb(f)||jsonb_build_object('path',e.value->>'oldPath'))::text,'UTF8')),'hex') as original_sha
 from private.enl_historical_files f join jsonb_array_elements(${sql.json(m.entries)}::jsonb) e(value) on f.batch_id::text=e.value->>'batchId' and f.file_id=e.value->>'fileId'`;
 if(rows.length!==EXPECTED_ROWS)fail('metadata_rows_changed');
 const found=new Map(rows.map((r:any)=>[r.batch_id+':'+r.file_id,r]));
 for(const e of m.entries as Entry[]){const r:any=found.get(e.batchId+':'+e.fileId);if(!r||r.original_sha!==e.rowSha256||r.path!==(kind==='before'?e.oldPath:e.canonicalPath))fail('metadata_changed');}
}
async function verifyObject(storage:any,path:string,e:Entry,allowMissing=false){
 const r=await storage.download(path);
 if(allowMissing&&r.error){
  const prefix=path.slice(0,path.lastIndexOf('/')),name=path.slice(path.lastIndexOf('/')+1);
  const listing=await storage.list(prefix,{limit:1000});
  if(!listing.error&&Array.isArray(listing.data)&&listing.data.length<1000&&!listing.data.some((item:any)=>item.name===name))return false;
 }
 if(r.error||!r.data)fail('object_download_failed');
 const b=new Uint8Array(await r.data.arrayBuffer());if(b.byteLength!==e.bytes||await hash(b)!==e.sha256)fail('object_hash_mismatch');
 return true;
}
async function verifySet(storage:any,m:any,kind:'before'|'after'){
 const paths=new Map<string,Entry>();for(const e of m.entries as Entry[])paths.set(kind==='before'?e.oldPath:e.canonicalPath,e);
 const queue=[...paths.entries()];let index=0;
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(index<queue.length){const [path,e]=queue[index++];await verifyObject(storage,path,e);}}));
 return {objects:paths.size,bytes:[...paths.values()].reduce((n,e)=>n+e.bytes,0)};
}
async function noReferences(sql:any,paths:string[]){
 const tables=await sql`select schemaname,tablename from pg_tables where schemaname in ('public','private') and left(tablename,4)='enl_' and tablename not in ('enl_storage_dedup_runs','enl_storage_dedup_events')`;
 for(const table of tables)if(!/^[a-z][a-z0-9_]*$/.test(table.schemaname)||!/^enl_[a-z0-9_]+$/.test(table.tablename))fail('table_identifier_invalid');
 if(!tables.length)return;
 // Values remain bind parameters; catalog identifiers are strictly validated above.
 // One UNION query avoids a network round trip per table during every deletion check.
 const scans=tables.map((table:any)=>`select 1 from "${table.schemaname}"."${table.tablename}" t where exists(select 1 from jsonb_array_elements_text($1::text::jsonb) p(value) where strpos(to_jsonb(t)::text,p.value)>0)`);
 const hit=await sql.unsafe(`select 1 as referenced where exists(${scans.join(' union all ')})`,[JSON.stringify(paths)]);
 if(hit.length)fail('duplicate_still_referenced');
}
async function event(sql:any,actor:string,kind:string,details:any){await sql`insert into private.enl_storage_dedup_events(migration_id,actor_id,action,details) values(${MIGRATION},${actor},${kind},${sql.json(details)}::jsonb)`;}
const summary=(r:any)=>({phase:r.phase,manifestSha256:MANIFEST_SHA256,rows:EXPECTED_ROWS,duplicateObjects:EXPECTED_REMOVALS,removedObjects:(r.removed_paths||[]).length});

Deno.serve(async(req:Request)=>{
 const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type,x-enl-app,x-enl-maintenance-token','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({ok:false,message:'method_not_allowed'},405);
 const now=Date.now(),gate=MAINTENANCE_GATE;
 if(!gate||gate.expiresAt-gate.builtAt>3600000||gate.expiresAt<=gate.builtAt||now<gate.builtAt-30000||now>=gate.expiresAt)return json({ok:false,message:'maintenance_expired'},410);
 const token=req.headers.get('x-enl-maintenance-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token)||await hash(new TextEncoder().encode(token))!==gate.tokenSha256)return json({ok:false,message:'forbidden'},403);
 if((req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)||req.headers.get('x-enl-app')!==APP)return json({ok:false,message:'forbidden'},403);
 if(Deno.env.get('SUPABASE_URL')!==`https://${PROJECT}.supabase.co`)return json({ok:false,message:'project_mismatch'},503);
 let b:any;try{const raw=await req.text();if(raw.length>4096)throw Error();b=JSON.parse(raw);}catch{return json({ok:false,message:'invalid_request'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['action','actor','actorPasswordHash'].includes(k)))return json({ok:false,message:'invalid_request'},400);
 if(b.actor?.id!==gate.actorId||b.actor?.role!=='safety')return json({ok:false,message:'forbidden'},403);
 const action=clean(b.action);if(!['status','verify_before','relink','verify_after','remove_duplicates'].includes(action))return json({ok:false,message:'invalid_action'},400);
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:2,connect_timeout:5});
 try{
  const actor=await authenticate(sql,b),run=await readRun(sql),m=run.manifest;
  if(action==='status')return json({ok:true,...summary(run)});
  if(run.phase==='completed')return json({ok:false,message:'already_completed'},409);
  const storage=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}).storage.from(m.bucket);
  if(action==='verify_before'){
   if(!['planned','verified'].includes(run.phase))fail('phase_conflict');
   await state(sql,m,'before');const verified=await verifySet(storage,m,'before');await state(sql,m,'before');
   await sql.begin(async(t:any)=>{await event(t,actor,'verified_before',verified);await t`update private.enl_storage_dedup_runs set phase='verified',verified_before_at=now(),updated_at=now() where migration_id=${MIGRATION} and phase in ('planned','verified')`;});
   return json({ok:true,phase:'verified',...verified});
  }
  if(action==='relink'){
   if(run.phase!=='verified')fail('phase_conflict');backupReady(run);
   await state(sql,m,'before');await verifySet(storage,m,'before');
   await sql.begin(async(t:any)=>{
    if(Date.now()>=gate.expiresAt)fail('maintenance_expired');
    await t`select set_config('lock_timeout','5s',true)`;
    await t`lock table private.enl_historical_files in share row exclusive mode`;
    const locked=await t`select phase from private.enl_storage_dedup_runs where migration_id=${MIGRATION} for update`;if(locked[0]?.phase!=='verified')fail('phase_conflict');
    await state(t,m,'before');
    for(const e of m.entries as Entry[])if(e.oldPath!==e.canonicalPath){const changed=await t`update private.enl_historical_files set path=${e.canonicalPath} where batch_id=${e.batchId}::uuid and file_id=${e.fileId} and path=${e.oldPath} returning file_id`;if(changed.length!==1)fail('metadata_changed');}
    await state(t,m,'after');await event(t,actor,'relinked',{rows:EXPECTED_REMOVALS,manifestSha256:MANIFEST_SHA256});
    await t`update private.enl_storage_dedup_runs set phase='relinked',relinked_at=now(),updated_at=now() where migration_id=${MIGRATION}`;
   });
   return json({ok:true,phase:'relinked',rows:EXPECTED_REMOVALS});
  }
  if(action==='verify_after'){
   if(!['relinked','relinked_verified'].includes(run.phase))fail('phase_conflict');backupReady(run);
   await state(sql,m,'after');const verified=await verifySet(storage,m,'after');
   await noReferences(sql,m.entries.filter((e:Entry)=>e.oldPath!==e.canonicalPath).map((e:Entry)=>e.oldPath));await state(sql,m,'after');
   await sql.begin(async(t:any)=>{await event(t,actor,'verified_after',verified);await t`update private.enl_storage_dedup_runs set phase='relinked_verified',verified_after_at=now(),updated_at=now() where migration_id=${MIGRATION} and phase in ('relinked','relinked_verified')`;});
   return json({ok:true,phase:'relinked_verified',...verified});
  }
  if(action==='remove_duplicates'){
   if(run.phase!=='relinked_verified')fail('phase_conflict');backupReady(run);
   await state(sql,m,'after');const duplicates=(m.entries as Entry[]).filter(e=>e.oldPath!==e.canonicalPath);
   await noReferences(sql,duplicates.map(e=>e.oldPath));
   const removed=new Set<string>(run.removed_paths||[]);
   // Five fixed-manifest objects per request keeps downloads and validation within Edge limits.
   for(const e of duplicates.filter(e=>!removed.has(e.oldPath)).slice(0,5)){
    if(Date.now()>=gate.expiresAt)fail('maintenance_expired');
    await verifyObject(storage,e.canonicalPath,e);
    const exists=await verifyObject(storage,e.oldPath,e,true);await state(sql,m,'after');await noReferences(sql,[e.oldPath]);
    if(exists){const result=await storage.remove([e.oldPath]);if(result.error||!Array.isArray(result.data)||result.data.length!==1)fail('storage_remove_failed');}
    // A crash can occur after Storage.remove but before the database journal commits.
    // Missing originals are acknowledged only after prior verification, durable backup,
    // canonical byte verification and zero live references; the event says exactly that.
    await sql.begin(async(t:any)=>{await event(t,actor,exists?'duplicate_removed':'duplicate_already_absent_after_verified',{path:e.oldPath,canonicalPath:e.canonicalPath,sha256:e.sha256,bytes:e.bytes});await t`update private.enl_storage_dedup_runs set removed_paths=removed_paths||${t.json([e.oldPath])}::jsonb,updated_at=now() where migration_id=${MIGRATION} and not(removed_paths ? ${e.oldPath})`;});
    removed.add(e.oldPath);
   }
   if(removed.size<EXPECTED_REMOVALS)return json({ok:true,phase:'relinked_verified',removed:removed.size,remaining:EXPECTED_REMOVALS-removed.size});
   await state(sql,m,'after');await verifySet(storage,m,'after');
   await sql.begin(async(t:any)=>{await event(t,actor,'completed',{removed:removed.size,bytes:duplicates.reduce((n,e)=>n+e.bytes,0)});await t`update private.enl_storage_dedup_runs set phase='completed',completed_at=now(),updated_at=now() where migration_id=${MIGRATION}`;});
   return json({ok:true,phase:'completed',removed:removed.size,bytes:duplicates.reduce((n,e)=>n+e.bytes,0)});
  }
  return json({ok:false,message:'invalid_action'},400);
 }catch(e:any){const code=clean(e?.message);const known=/^(auth_safety_required|manifest_|canonical_invalid|durable_backup_required|metadata_|object_|duplicate_still_referenced|phase_conflict|table_identifier_invalid|storage_remove_failed)$/.test(code)||/^(manifest_|metadata_|object_)[a-z_]+$/.test(code);const sqlState=/^[A-Z0-9]{5}$/.test(clean(e?.code))?clean(e.code):null;console.error('storage_dedup',known?code:'internal_error',sqlState);return json({ok:false,message:known?code:'maintenance_failed',...(sqlState?{sqlState}:{})},code==='auth_safety_required'?403:409);}
 finally{await sql.end({timeout:1}).catch(()=>{});}
});
