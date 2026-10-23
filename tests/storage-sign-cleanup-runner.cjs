'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{PGlite}=require('@electric-sql/pglite');
const {build,queries,digest,canonical,PROJECT,QA,TABLES,USERS,BATCH}=require('./build-storage-sign-cleanup-runner.cjs');
const token='a'.repeat(64),actor={id:'qa-safety',role:'safety'},proof='qa-proof';
const template=fs.readFileSync('tests/fixtures/storage-sign-cleanup-synthetic.sql','utf8'),file=queries(template).file;
async function fixture(){
 const db=new PGlite();await db.exec(`create schema private;create schema storage;create schema ${QA};
 create table public.enl_hq_users(user_id text primary key,role text,active boolean,password_hash text);
 create table private.enl_historical_batches(id uuid primary key,owner_id text,status text);
 create table private.enl_historical_files(batch_id uuid references private.enl_historical_batches(id) on delete restrict,file_id text,path text,primary key(batch_id,file_id));
 create table private.enl_historical_import_audit(id text,batch_id uuid references private.enl_historical_batches(id) on delete restrict);
 create table storage.objects(id text,path text);create table storage.buckets(id text);
 create table ${QA}.enl_hq_users(user_id text primary key,role text,active boolean,password_hash text);
 insert into ${QA}.enl_hq_users values('qa-safety','safety',true,'qa-proof');
 insert into public.enl_hq_users values('${USERS[0]}','safety',true,'synthetic-owner-proof'),('${USERS[1]}','safety',true,'synthetic-other-proof'),('preexisting-user','safety',true,'unchanged');
 insert into private.enl_historical_batches values('${BATCH}','${USERS[0]}','ready'),('11111111-1111-4111-8111-111111111111','preexisting-user','ready');
 insert into private.enl_historical_files values('${BATCH}','${file}','borrowed-existing-object'),('11111111-1111-4111-8111-111111111111','unrelated-file','borrowed-existing-object');
 insert into private.enl_historical_import_audit values('unrelated','11111111-1111-4111-8111-111111111111');
 insert into storage.objects values('preexisting-object','borrowed-existing-object');insert into storage.buckets values('historical');`);
 const special=['public.enl_hq_users','private.enl_historical_batches','private.enl_historical_files','private.enl_historical_import_audit'];
 for(const table of TABLES.filter(t=>!special.includes(t)))await db.exec(`create table ${table}(value text);insert into ${table} values('retained unrelated row'),(null);`);
 let cleanupSQL=template;
 const rowSQL=[`select * from public.enl_hq_users where user_id='${USERS[0]}'`,`select * from public.enl_hq_users where user_id='${USERS[1]}'`,`select * from private.enl_historical_batches where id='${BATCH}'`,`select * from private.enl_historical_files where batch_id='${BATCH}'`];
 for(let i=0;i<rowSQL.length;i++){const h=(await db.query(`select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from (${rowSQL[i]}) t`)).rows[0].h;cleanupSQL=cleanupSQL.replace(String(i+1).repeat(64),h);}
 const sql=queries(cleanupSQL),capture=async()=>(await db.query(sql.state)).rows[0].state,baseline=await capture();return {db,cleanupSQL,sql,capture,baseline};
}
function handlerFor(f,options={}){
 const built=build({cleanupSQL:f.cleanupSQL,expectedSqlSha256:digest(f.cleanupSQL),baseline:f.baseline,token,...options.build});let handler,connections=0,stateReads=0;
 function adapter(connection){const sql=()=>{throw Error('unexpected tagged SQL');};sql.unsafe=(q,args=[])=>{const run=async(simple)=>{if(options.wrongDbRole&&q==='select current_user as role')return [{role:'service_role'}];if(simple)return connection.exec(q);const rows=(await connection.query(q,args)).rows;if(q===built.sql.state&&++stateReads===2&&options.failPost)rows[0].state.tables['storage.objects'].keep.sha256='0'.repeat(64);return rows;};return {then:(ok,bad)=>run(false).then(ok,bad),simple:()=>run(true)};};sql.begin=cb=>f.db.transaction(t=>cb(adapter(t)));sql.end=async()=>{};return sql;}
 const ctx={Deno:{env:{get:k=>k==='SUPABASE_URL'?`https://${options.project||PROJECT}.supabase.co`:k==='SUPABASE_DB_URL'?(options.databaseUrl||`postgresql://postgres:synthetic@db.${PROJECT}.supabase.co:5432/postgres`):''},serve:h=>handler=h},postgres:()=>{connections++;return adapter(f.db);},Request,Response,TextEncoder,crypto,URL};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(built.source.replace(/^import .*;\r?\n/gm,'')),ctx);
 const call=async(body={},override={})=>{const method=override.method||'POST',r=await handler(new Request('https://isolated.test',{method,headers:{'content-type':'application/json','x-enl-maintenance-token':override.token??token},...(method==='GET'?{}:{body:JSON.stringify({action:'cleanup',actor,actorPasswordHash:proof,...body})})}));return {status:r.status,body:await r.json()};};return {built,call,get connections(){return connections;}};
}
(async()=>{let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++;},f=await fixture(),{db,capture,baseline}=f;try{
 let h=handlerFor(f),r;
 for(const value of ['', 'b'.repeat(64),'invalid'])check((await h.call({}, {token:value})).status===403,'wrong token');check(h.connections===0,'reject token before DB');
 check((await h.call({actorPasswordHash:'wrong'})).status===403,'wrong proof');
 for(const active of [false,null]){await db.query(`update ${QA}.enl_hq_users set active=$1`,[active]);check((await h.call()).status===403,'active must be true');}await db.exec(`update ${QA}.enl_hq_users set active=true`);
 for(const who of [{id:USERS[0],role:'safety'},{id:'unknown',role:'safety'},{id:'qa-safety',role:'manager'}])check((await h.call({actor:who})).status===403,'fixed surviving actor required');
 for(const body of [{ids:['preexisting-user']},{sql:'delete all'},{project:'production'},{tables:['storage.objects']},{action:'execute_sql'}])check((await h.call(body)).status===400,'arbitrary scope rejected');
 check((await h.call({}, {method:'GET'})).status===405,'POST only');
 h=handlerFor(f,{project:'wjelumpbjklfrdjxbesj'});check((await h.call()).body.code==='project_mismatch'&&h.connections===0,'production blocked before DB');
 for(const databaseUrl of ['postgresql://postgres:synthetic@db.wjelumpbjklfrdjxbesj.supabase.co:5432/postgres','postgresql://postgres.wjelumpbjklfrdjxbesj:synthetic@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres','postgresql://postgres:synthetic@unrelated.example/postgres']){h=handlerFor(f,{databaseUrl});check((await h.call()).body.code==='database_project_mismatch'&&h.connections===0,'wrong database project blocked');}
 h=handlerFor(f,{databaseUrl:`postgresql://postgres.${PROJECT}:synthetic@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`});check((await h.call({action:'status'})).status===200,'pinned project pooler accepted');
 h=handlerFor(f,{build:{builtAt:Date.now()-3600001,expiresAt:Date.now()-1}});check((await h.call()).status===410&&h.connections===0,'expired before DB');
 assert.throws(()=>build({cleanupSQL:f.cleanupSQL,baseline,token}),/unreviewed_sql/);passed++;
 assert.throws(()=>handlerFor(f,{build:{expiresAt:Date.now()+7200000}}),/invalid_expiry/);passed++;
 h=handlerFor(f,{wrongDbRole:true});check((await h.call()).body.code==='database_role_mismatch','postgres required');
 h=handlerFor(f,{failPost:true});check((await h.call()).body.code==='postcheck_failed','postcheck failure');check(canonical(await capture())===canonical(baseline),'postcheck transaction rolls back all rows');
 h=handlerFor(f);
 await db.exec(`update public.enl_hq_users set password_hash='changed' where user_id='${USERS[0]}'`);check((await h.call()).body.code==='fixture_state_changed','changed target hash blocks');await db.exec(`update public.enl_hq_users set password_hash='synthetic-owner-proof' where user_id='${USERS[0]}'`);
 await db.exec(`update public.enl_hq_users set password_hash='${USERS[0]}' where user_id='preexisting-user'`);check((await capture()).noRetainedReferences===false,'retained target-table user reference detected');check((await h.call()).body.code==='retained_state_changed','retained user reference blocks');await db.exec("update public.enl_hq_users set password_hash='unchanged' where user_id='preexisting-user'");
 await db.exec(`update private.enl_historical_files set path='${BATCH}' where file_id='unrelated-file'`);check((await capture()).noRetainedReferences===false,'retained alias reference detected');check((await h.call()).status===409,'retained alias blocks');await db.exec("update private.enl_historical_files set path='borrowed-existing-object' where file_id='unrelated-file'");
 await db.exec(`update private.enl_historical_batches set owner_id='${USERS[1]}' where id='11111111-1111-4111-8111-111111111111'`);check((await capture()).noRetainedReferences===false,'retained owner batch detected');check((await h.call()).status===409,'retained owner batch blocks');await db.exec("update private.enl_historical_batches set owner_id='preexisting-user' where id='11111111-1111-4111-8111-111111111111'");
 await db.exec(`update public.enl_incident_shared set value='${BATCH}' where value is not null`);check((await capture()).noRetainedReferences===false,'generic external reference detected');check((await h.call()).status===409,'external reference blocks');await db.exec("update public.enl_incident_shared set value='retained unrelated row' where value is not null");
 await db.exec(`update private.enl_historical_batches set owner_id=null where id='${BATCH}'`);check((await capture()).fixtureOwnerValid===false,'NULL owner invalid');check((await h.call()).status===409,'NULL owner blocks');await db.exec(`update private.enl_historical_batches set owner_id='${USERS[0]}' where id='${BATCH}'`);
 await db.exec('create table public.external_reference(id text references public.enl_hq_users(user_id) on delete cascade)');check((await h.call()).body.code==='fixture_foreign_key_changed','external cascading FK blocks');await db.exec('drop table public.external_reference');
 await db.exec("create rule unsafe_delete as on delete to public.enl_hq_users do also insert into storage.objects values('unexpected','unexpected')");check((await capture()).safeDeleteTopology===false,'DELETE rewrite rule detected');check((await h.call()).status===409,'rewrite rule blocks');await db.exec('drop rule unsafe_delete on public.enl_hq_users');
 await db.exec('create table public.inherited_user() inherits(public.enl_hq_users)');check((await capture()).safeDeleteTopology===false,'inherited child detected');check((await h.call()).status===409,'inherited child blocks');await db.exec('drop table public.inherited_user');
 await db.exec("create function private.unsafe_delete() returns trigger language plpgsql as $$begin return old;end$$;create trigger unsafe_delete before delete on public.enl_hq_users for each row execute function private.unsafe_delete()");check((await capture()).noDeleteTriggers===false,'custom DELETE trigger detected');check((await h.call()).status===409,'custom DELETE trigger blocks');await db.exec('drop trigger unsafe_delete on public.enl_hq_users;drop function private.unsafe_delete()');
 await db.exec('create table private.enl_storage_dedup_runs(id text)');check((await h.call()).body.code==='retained_state_changed','inventory drift blocks');await db.exec('drop table private.enl_storage_dedup_runs');
 check(canonical(await capture())===canonical(baseline),'all rejected test mutations restored baseline');
 r=await h.call({action:'status'});check(r.status===200&&r.body.pending['public.enl_hq_users']===2,'read-only status');check(canonical(await capture())===canonical(baseline),'status no mutation');
 check(!h.built.source.includes(token),'no plaintext token in generated handler');check(!h.built.source.includes('SUPABASE_SERVICE_ROLE_KEY'),'no service secret access');
 r=await h.call();check(r.status===200&&r.body.retainedHashesMatch&&r.body.storageUnchanged,'fixed cleanup succeeds');check(r.body.removed['public.enl_hq_users']===2&&r.body.removed['private.enl_historical_batches']===1&&r.body.removed['private.enl_historical_files']===1,'exact four fixture records removed');
 const after=await capture();check(Object.values(after.tables).every(x=>x.remove.count===0),'target records gone');for(const [table,state] of Object.entries(baseline.tables))check(canonical(after.tables[table].keep)===canonical(state.keep),'retained all rows '+table);
 check((await db.query(`select count(*) n from ${QA}.enl_hq_users where user_id='qa-safety'`)).rows[0].n===1,'auth actor survives');
 check((await h.call()).body.alreadyClean===true,'safe idempotency');
 console.log(JSON.stringify({suite:'storage-sign-cleanup-runner',passed,failed:0}));
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
