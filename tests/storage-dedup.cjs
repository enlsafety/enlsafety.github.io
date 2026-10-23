'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const {PGlite}=require('@electric-sql/pglite');
const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table public.enl_hq_users(user_id text primary key,active boolean,role text,password_hash text);
 insert into public.enl_hq_users values('qa-safety',true,'safety','qa-proof'),('qa-reader',true,'manager','qa-proof');
 create table private.enl_historical_files(batch_id uuid,file_id text,path text,name text,hash text,size bigint,method text,units jsonb,primary key(batch_id,file_id));
 create table public.enl_other_reference(payload jsonb);`);
 await db.exec(fs.readFileSync('tests/fixtures/storage-dedup-schema.sql','utf8'));
 const bytes=Buffer.from('Synthetic byte-identical document. No production evidence.');
 const digest=sha(bytes),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',canonical=a+'/'+digest,duplicate=b+'/'+digest;
 for(const [batch,path] of [[a,canonical],[b,duplicate]])await db.query('insert into private.enl_historical_files values($1,$2,$3,$4,$5,$6,$7,$8)',[batch,digest,path,'QA.txt',digest,bytes.length,'text',JSON.stringify([{text:'QA unchanged original extraction'}])]);
 const rows=(await db.query("select batch_id::text,file_id,path,encode(sha256(convert_to(to_jsonb(f)::text,'UTF8')),'hex') as row_sha from private.enl_historical_files f order by batch_id")).rows;
 const manifest={version:1,migrationId:'enl-storage-dedup-20261023-v472',project:'wjelumpbjklfrdjxbesj',bucket:'enl-import-originals',entries:rows.map(r=>({batchId:r.batch_id,fileId:r.file_id,oldPath:r.path,canonicalPath:canonical,sha256:digest,bytes:bytes.length,rowSha256:r.row_sha}))};
 const manifestSha=sha(stable(manifest));
 await db.query('insert into private.enl_storage_dedup_runs(migration_id,manifest_sha256,manifest) values($1,$2,$3)',[manifest.migrationId,manifestSha,JSON.stringify(manifest)]);
 const objects=new Map([[canonical,bytes],[duplicate,bytes]]);let removed=0,downloads=0,handler,tx=null,failJournalOnce=false;
 const sql=async(parts,...args)=>{
  const query=parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'');
  if(failJournalOnce&&query.startsWith('insert into private.enl_storage_dedup_events')&&args[2]==='duplicate_removed'){failJournalOnce=false;throw Error('injected_after_remove_before_journal');}
  return (await (tx||db).query(query,args)).rows;
 };
 sql.json=JSON.stringify;sql.end=async()=>{};sql.unsafe=async(q,args)=>(await(tx||db).query(q,args)).rows;
 sql.begin=async f=>db.transaction(async t=>{tx=t;try{return await f(sql);}finally{tx=null;}});
 const storage={list:async prefix=>({data:[...objects.keys()].filter(p=>p.startsWith(prefix+'/')).map(p=>({name:p.slice(prefix.length+1)})),error:null}),download:async path=>{downloads++;return objects.has(path)?{data:new Blob([objects.get(path)]),error:null}:{data:null,error:{statusCode:'400',message:'Storage endpoint error format varies'}};},remove:async paths=>{const data=[];for(const path of paths)if(objects.delete(path)){removed++;data.push({name:path});}return {data,error:null};}};
 const ctx={Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://wjelumpbjklfrdjxbesj.supabase.co':'isolated'},serve:f=>handler=f},postgres:()=>sql,createClient:()=>({storage:{from:()=>storage}}),Request,Response,Blob,TextEncoder,crypto:crypto.webcrypto,console:{error:()=>{}}};
 vm.createContext(ctx);
 const token='8'.repeat(64),gate={actorId:'qa-safety',tokenSha256:sha(token),builtAt:Date.now(),expiresAt:Date.now()+3600000};
 let source=fs.readFileSync('edge-functions/enl-storage-dedup-v472/index.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace(/const MANIFEST_SHA256='[^']+';/,"const MANIFEST_SHA256='"+manifestSha+"';").replace('EXPECTED_ROWS=55,EXPECTED_REMOVALS=31','EXPECTED_ROWS=2,EXPECTED_REMOVALS=1').replace('/*__MAINTENANCE_GATE__*/ null as any',JSON.stringify(gate));
 vm.runInContext(stripTypeScriptTypes(source),ctx);
 const call=async(action,extra={})=>{const r=await handler(new Request('https://isolated.test',{method:'POST',headers:{origin:'https://enlsafety.github.io','content-type':'application/json','x-enl-app':'incident-report-v2','x-enl-maintenance-token':token},body:JSON.stringify({actor:{id:'qa-safety',role:'safety'},actorPasswordHash:'qa-proof',action,...extra})}));return {status:r.status,body:await r.json()};};
 const backup=async()=>db.query('update private.enl_storage_dedup_runs set backup_proof=$1',[JSON.stringify({manifestSha256:manifestSha,objectCount:2,archiveSha256:'a'.repeat(64),libraryFileId:'libfile_0123456789abcdef'})]);
 return {db,call,backup,objects,canonical,duplicate,bytes,manifest,manifestSha,stats:()=>({removed,downloads}),crashAfterRemove:()=>{failJournalOnce=true;}};
}
(async()=>{
 const f=await fixture();let passed=0;const check=(actual,expected,label)=>{assert.equal(actual,expected,label);passed++;};
 try{
 check((await f.call('status',{actorPasswordHash:'wrong'})).status,403,'wrong proof');
 check((await f.call('status',{actor:{id:'qa-reader'}})).status,403,'non-safety reader');
 check((await f.call('remove_duplicates')).body.message,'phase_conflict','cannot remove before verification');
 f.objects.set(f.duplicate,Buffer.from('corrupted'));
 check((await f.call('verify_before')).body.message,'object_hash_mismatch','corrupt duplicate blocks verification');
 check(f.stats().removed,0,'no deletion before verification');f.objects.set(f.duplicate,f.bytes);
 check((await f.call('verify_before')).status,200,'all original hashes verified');
 check((await f.call('relink')).body.message,'durable_backup_required','relink requires durable backup');
 await f.backup();check((await f.call('relink')).status,200,'atomic path-only relink');
 const metadata=(await f.db.query('select * from private.enl_historical_files')).rows;
 check(metadata.length,2,'all evidence metadata rows retained');check(metadata.every(r=>r.path===f.canonical),true,'canonical paths');
 check(metadata.every(r=>r.name==='QA.txt'&&r.units[0].text==='QA unchanged original extraction'),true,'names/extraction retained');
 await f.db.query('insert into public.enl_other_reference values($1)',[JSON.stringify({path:f.duplicate})]);
 check((await f.call('verify_after')).body.message,'duplicate_still_referenced','foreign reference blocks removal');
 check(f.stats().removed,0,'no referenced original removed');await f.db.exec('delete from public.enl_other_reference');
 check((await f.call('verify_after')).status,200,'canonical originals and no references verified');
 f.objects.set(f.canonical,Buffer.from('corrupted'));
 check((await f.call('remove_duplicates')).body.message,'object_hash_mismatch','canonical corruption blocks deletion');f.objects.set(f.canonical,f.bytes);
 f.crashAfterRemove();check((await f.call('remove_duplicates')).status,409,'journal crash is reported');
 check(f.objects.has(f.duplicate),false,'injected failure occurs after removal');
 const retry=await f.call('remove_duplicates');check(retry.status,200,'crash-safe missing-object resume');check(retry.body.phase,'completed','completed after verified resume');
 check(f.stats().removed,1,'only exact duplicate removed');check(f.objects.has(f.canonical),true,'canonical original retained');
 const audit=(await f.db.query('select action from private.enl_storage_dedup_events')).rows.map(r=>r.action);
 check(audit.includes('duplicate_already_absent_after_verified'),true,'honest missing-after-crash audit');
 let blocked=false;try{await f.db.exec('delete from private.enl_storage_dedup_events');}catch{blocked=true;}check(blocked,true,'provenance append-only');
 check((await f.call('remove_duplicates')).body.message,'already_completed','completed run closed');
 const final=(await f.db.query('select f.batch_id::text,encode(sha256(convert_to((to_jsonb(f)||jsonb_build_object(\'path\',e.value->>\'oldPath\'))::text,\'UTF8\')),\'hex\') sha from private.enl_historical_files f join jsonb_array_elements($1::jsonb) e(value) on f.batch_id::text=e.value->>\'batchId\' and f.file_id=e.value->>\'fileId\'',[JSON.stringify(f.manifest.entries)])).rows;
 check(final.every(r=>r.sha===f.manifest.entries.find(e=>e.batchId===r.batch_id).rowSha256),true,'all original metadata reconstructed exactly');
 const result={passed,failed:0,suite:'storage-dedup-postgres-handler',productionRequests:0};fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/storage-dedup.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await f.db.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
