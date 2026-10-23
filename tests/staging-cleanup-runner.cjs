'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{fixture:lifeFixture}=require('./final-lifecycle.cjs');
const {build,captureSQL,qaSQL,securitySQL,securityCount,temporaryGuard,PROJECT,SCHEMA,PRIVATE,IDS,TARGETS,SECURITY,canonical}=require('./build-staging-cleanup-runner.cjs');
const token='a'.repeat(64),actor={id:'qa-safety',role:'safety'},proof='qa-proof';
async function fixture(){
 const f=await lifeFixture(),db=f.db;
 for(const id of [...IDS,'preexisting-qa-fixture']){
  const p={id,siteId:'qa-site',status:'reported',summary:'Synthetic fixture',category:'property',occurredAt:'2026-10-23T01:00:00Z',photos:[],_syncBaseVersion:0,_syncMutationId:id};
  const r=await f.call('field',{action:'push',incidents:[p]});assert.equal(r.status,200);
  await db.query("insert into enl_incident_revisions(incident_id,revision,mutation_id,reason,editor_id,editor_name,changes,before_payload,after_payload) values($1,1,$2,'QA reason','qa-safety','QA Safety','[]'::jsonb,$3::jsonb,$3::jsonb)",[id,'revision-'+id,JSON.stringify(p)]);
  await db.query("insert into enl_incident_operations(incident_id,mutation_id,action,revision,editor_id,editor_name,details) values($1,$2,'qa',1,'qa-safety','QA Safety','{}')",[id,'operation-'+id]);
  await db.query("insert into enl_document_views(incident_id,document_type,viewer_id) values($1,'report','qa-manager')",[id]);
 }
 await db.exec("insert into enl_document_views(incident_id,document_type,viewer_id) values(null,'null unrelated row','qa-manager');");
 await db.transaction(t=>t.exec(fs.readFileSync('tests/fixtures/evidence-storage-activate.sql','utf8')));
 await db.exec(`alter schema public rename to ${SCHEMA};alter schema private rename to ${PRIVATE};create schema public;set search_path=public;
 alter table ${SCHEMA}.enl_incident_revisions add foreign key(incident_id) references ${SCHEMA}.enl_incident_shared(incident_id);
 alter table ${SCHEMA}.enl_incident_operations add foreign key(incident_id) references ${SCHEMA}.enl_incident_shared(incident_id);
 create table public.kokmatch_groups(group_id text primary key,name text not null,pin_hash text not null,is_active boolean not null default true,sort_order int not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
 create table public.kokmatch_global_admins(admin_id text primary key,display_name text not null,pin_hash text not null,linked_member_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
 create table public.kokmatch_member_auth(club_id text not null,member_id text not null,pin_hash text not null,updated_at timestamptz not null default now(),primary key(club_id,member_id));
 create table public.kokmatch_sessions(token_hash text primary key,club_id text not null,role text not null,member_id text,display_name text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now());
 create table public.kokmatch_state(club_id text primary key,data jsonb not null,updated_at timestamptz not null default now(),revision bigint not null default 0);
 create table public.kokmatch_v34_state_backup(club_id text primary key,data jsonb not null,updated_at timestamptz not null default now(),backed_up_at timestamptz not null default now());
 create table public.kokmatch_v34_member_auth_backup(club_id text not null,member_id text not null,pin_hash text not null,updated_at timestamptz not null default now(),backed_up_at timestamptz not null default now());
 create table public.kokmatch_v34_auth_backup(club_id text primary key,admin_pin_hash text not null,organizer_pin_hash text not null,updated_at timestamptz not null default now(),backed_up_at timestamptz not null default now());
 insert into kokmatch_groups(group_id,name,pin_hash) values('enl_rls_qa_20261023','QA ENL RLS 20261023','qa-proof');
 insert into kokmatch_global_admins(admin_id,display_name,pin_hash) values('qa_admin_20261023','QA Admin 20261023','qa-proof');
 insert into kokmatch_member_auth(club_id,member_id,pin_hash) values('enl_rls_qa_20261023','qa_member','qa-proof');
 insert into kokmatch_sessions(token_hash,club_id,role,member_id,display_name) values('qa-token','enl_rls_qa_20261023','member','qa_member','QA Member 20261023');
 insert into kokmatch_state(club_id,data) values('enl_rls_qa_20261023','{"synthetic":true}');
 insert into kokmatch_v34_state_backup(club_id,data) values('enl_rls_qa_20261023','{"synthetic":true}');
 insert into kokmatch_v34_member_auth_backup(club_id,member_id,pin_hash) values('enl_rls_qa_20261023','qa_member','qa-proof');
 insert into kokmatch_v34_auth_backup(club_id,admin_pin_hash,organizer_pin_hash) values('enl_rls_qa_20261023','qa-proof','qa-proof');
 create table public.unrelated_app(value text);insert into public.unrelated_app values('must remain');`);
 const baseline=(await db.query(captureSQL)).rows[0].baseline;return {db,baseline};
}
function handlerFor(db,baseline,options={}){
 const built=build({baseline,token,...options.build});let handler,connections=0,qaReads=0;
 function adapter(connection){const sql=()=>{throw Error('unexpected tagged SQL');};sql.unsafe=(q,args=[])=>{
  const run=async(simple)=>{if(options.wrongDbRole&&q==='select current_user as role')return [{role:'service_role'}];if(simple){if(options.failRestore&&q===built.sql.restore)throw Error('simulated_restore_failure');return connection.exec(q);}const rows=(await connection.query(q,args)).rows;if(q===built.sql.qa&&++qaReads===2&&options.failPost){rows[0].state.tables.enl_hq_users.keep.sha256='0'.repeat(64);}return rows;};return {then:(ok,bad)=>run(false).then(ok,bad),simple:()=>run(true)};};sql.begin=cb=>db.transaction(t=>cb(adapter(t)));sql.end=async()=>{};return sql;}
 const ctx={Deno:{env:{get:k=>k==='SUPABASE_URL'?`https://${options.project||PROJECT}.supabase.co`:k==='SUPABASE_DB_URL'?'isolated':''},serve:h=>handler=h},postgres:()=>{connections++;return adapter(db);},Request,Response,TextEncoder,crypto};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(built.source.replace(/^import .*;\r?\n/gm,'')),ctx);
 const call=async(body={},override={})=>{const method=override.method||'POST',r=await handler(new Request('https://isolated.test',{method,headers:{'content-type':'application/json','x-enl-maintenance-token':override.token??token},...(method==='GET'?{}:{body:JSON.stringify({action:'cleanup',actor,actorPasswordHash:proof,...body})})}));return {status:r.status,body:await r.json()};};return {built,call,get connections(){return connections;}};
}
(async()=>{let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++;};const {db,baseline}=await fixture();try{
 let h=handlerFor(db,baseline),r;
 for(const value of ['', 'b'.repeat(64),'invalid']){r=await h.call({}, {token:value});check(r.status===403,'wrong token');}check(h.connections===0,'token rejection before DB');
 r=await h.call({actorPasswordHash:'wrong'});check(r.status===403,'wrong proof');
 for(const active of [false,null]){await db.query(`update ${SCHEMA}.enl_hq_users set active=$1 where user_id='qa-safety'`,[active]);r=await h.call();check(r.status===403,'explicit active safety required');}await db.exec(`update ${SCHEMA}.enl_hq_users set active=true where user_id='qa-safety'`);
 for(const body of [{actor:{id:'other',role:'safety'}},{actor:{...actor,role:'manager'}}])check((await h.call(body)).status===403,'wrong actor/role');
 for(const body of [{ids:[...IDS,'preexisting-qa-fixture']},{sql:'delete all'},{schema:'public'},{tables:['unrelated_app']},{action:'execute_sql'}])check((await h.call(body)).status===400,'arbitrary input rejected');
 check((await h.call({}, {method:'GET'})).status===405,'POST only');
 h=handlerFor(db,baseline,{project:'wjelumpbjklfrdjxbesj'});r=await h.call();check(r.status===403&&r.body.code==='project_mismatch'&&h.connections===0,'production project blocked');
 h=handlerFor(db,baseline,{build:{builtAt:Date.now()-3600001,expiresAt:Date.now()-1}});check((await h.call()).status===410&&h.connections===0,'expired before DB');
 const extra=structuredClone(baseline);extra.qa.ids.push('preexisting-qa-fixture');assert.throws(()=>build({baseline:extra,token}),/exact_four_ids_required/);passed++;
 h=handlerFor(db,baseline,{wrongDbRole:true});check((await h.call()).body.code==='database_role_mismatch','postgres required');
 // Temporary guards remain active and reject every non-target deletion/update.
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec(temporaryGuard);await tx.exec(`delete from ${SCHEMA}.enl_incident_audit where incident_id='preexisting-qa-fixture'`);}),/cleanup_scope_forbidden/);passed++;
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec(temporaryGuard);await tx.exec(`update ${SCHEMA}.enl_incident_audit set editor_name='changed' where incident_id='${IDS[0]}'`);}),/cleanup_scope_forbidden/);passed++;
 await db.exec(`create role cleanup_intruder;grant usage on schema ${SCHEMA} to cleanup_intruder;grant select,delete on ${SCHEMA}.enl_incident_audit to cleanup_intruder;`);
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec(temporaryGuard);await tx.exec(`set local role cleanup_intruder;delete from ${SCHEMA}.enl_incident_audit where incident_id='${IDS[0]}'`);}),/cleanup_scope_forbidden/);passed++;
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec(temporaryGuard);await tx.exec(`delete from ${SCHEMA}.enl_incident_audit where incident_id='${IDS[0]}'`);check((await tx.query(`select count(*) n from ${SCHEMA}.enl_incident_audit where incident_id=$1`,[IDS[0]])).rows[0].n===0,'postgres exact target allowed');throw Error('intentional_test_rollback');}),/intentional_test_rollback/);passed++;
 check(canonical((await db.query(captureSQL)).rows[0].baseline)===canonical(baseline),'guard test restores complete baseline');
 h=handlerFor(db,baseline,{failRestore:true});r=await h.call();check(r.status===409,'restore failure rolls back');check(canonical((await db.query(captureSQL)).rows[0].baseline)===canonical(baseline),'restore failure leaves all rows/tables/guards');
 h=handlerFor(db,baseline,{failPost:true});r=await h.call();check(r.status===409&&r.body.code==='postcheck_failed','bad posthash rolls back');check(canonical((await db.query(captureSQL)).rows[0].baseline)===canonical(baseline),'posthash failure restores all');
 await db.exec(`create table public.external_reference(id text references ${SCHEMA}.enl_incident_shared(incident_id) on delete cascade);`);h=handlerFor(db,baseline);check((await h.call()).body.code==='qa_baseline_mismatch','external cascade FK blocked');await db.exec('drop table public.external_reference');
 await db.exec("alter table public.kokmatch_sessions alter column display_name drop not null;update public.kokmatch_sessions set display_name=null;");check((await db.query(securitySQL)).rows[0].state.syntheticOnly===false,'NULL cannot pass synthetic guard');check((await h.call()).body.code==='security_baseline_mismatch','NULL fixture blocks cleanup');await db.exec("update public.kokmatch_sessions set display_name='QA Member 20261023';alter table public.kokmatch_sessions alter column display_name set not null;");
 await db.exec("insert into public.kokmatch_groups(group_id,name,pin_hash) values('unrelated','unrelated','not-a-proof')");check((await h.call()).body.code==='security_baseline_mismatch','non-fixture security row blocks all cleanup');await db.exec("delete from public.kokmatch_groups where group_id='unrelated'");
 await db.exec("create view public.external_view as select * from public.kokmatch_groups");check((await h.call()).status===409,'DROP without CASCADE preserves external dependent view');check(canonical((await db.query(captureSQL)).rows[0].baseline)===canonical(baseline),'external dependency rolls back ENL deletes');await db.exec('drop view public.external_view');
 r=await h.call({action:'status'});check(r.status===200&&r.body.securityTables===8,'status before');check(!h.built.source.includes(token),'no plaintext token source');
 r=await h.call();check(r.status===200&&r.body.guardsRestored&&r.body.unrelatedRowsUnchanged,'cleanup succeeds');check(r.body.removed.enl_incident_shared===4,'exactly four reports removed');
 const after=(await db.query(qaSQL)).rows[0].state;check(after.ids.length===0&&Object.values(after.tables).every(x=>x.remove.count===0),'all exact target references removed');
 for(const [table,state] of Object.entries(baseline.qa.tables))check(canonical(after.tables[table].keep)===canonical(state.keep),'preserves unrelated '+table);
 check(canonical(after.guards)===canonical(baseline.qa.guards),'exact trigger definitions restored');check((await db.query(securityCount)).rows[0].count===0,'only eight fixture tables removed');check((await db.query('select value from public.unrelated_app')).rows[0].value==='must remain','unrelated public app intact');
 await assert.rejects(()=>db.exec(`delete from ${SCHEMA}.enl_incident_audit where incident_id='preexisting-qa-fixture'`),/evidence_is_append_only/);passed++;
 await assert.rejects(()=>db.exec(`delete from ${SCHEMA}.enl_incident_shared where incident_id='preexisting-qa-fixture'`),/incident_deletion_disabled/);passed++;
 check((await h.call()).body.alreadyClean===true,'safe idempotent replay');check((await db.query(`select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='${SCHEMA}' and p.proname='enl_v472_fixed_cleanup_guard'`)).rows[0].n===0,'temporary guard removed');
 await db.exec('create view public.kokmatch_groups as select 1 x');check((await h.call()).body.code==='partial_fixture_state','wrong-kind leftover cannot masquerade as absent');
 console.log(JSON.stringify({suite:'staging-cleanup-runner',passed,failed:0}));
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
