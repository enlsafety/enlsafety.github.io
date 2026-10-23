'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{PGlite}=require('@electric-sql/pglite');
const {build,baselineFromBackup,mapSQL,projects}=require('./build-evidence-activation-runner.cjs');
const read=n=>fs.readFileSync('tests/fixtures/evidence-storage-'+n+'.sql','utf8');
const setup=fs.readFileSync('tests/evidence-storage.cjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
const token='a'.repeat(64),actor={id:'qa-safety',role:'safety'},proof='qa-proof';
async function fixture(backupDirectory){
 const db=new PGlite();await db.exec(setup);
 await db.exec('create table enl_hq_users(user_id text primary key,role text,active boolean,password_hash text);');
 await db.query('insert into enl_hq_users values($1,$2,true,$3)',[actor.id,'safety',proof]);
 if(backupDirectory){
  for(const table of ['enl_incident_audit','enl_incident_revisions','enl_incident_backups'])for(const r of JSON.parse(fs.readFileSync(path.join(backupDirectory,table+'.json'),'utf8')).rows)
   await db.query('insert into '+table+' select * from jsonb_populate_record(null::'+table+',$1::jsonb)',[r.row_text]);
 }else{
  const payload={id:'qa-runner',summary:'가상 문서',photos:[{dataUrl:'data:image/png;base64,'+'A'.repeat(10000)}]};
  await db.query("insert into enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,before_payload,after_payload) values('qa-runner','qa-site','create','qa-safety','QA 안전',null,$1::jsonb),('qa-runner','qa-site','update','qa-safety','QA 안전',$1::jsonb,$2::jsonb)",[JSON.stringify(payload),JSON.stringify({...payload,status:'closed'})]);
  await db.query("insert into enl_incident_revisions values('qa-runner',1,'qa-mutation','가상 정정 사유','qa-safety','QA 안전',now(),$1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify([{field:'summary',before:'가상 문서',after:'가상 정정'}]),JSON.stringify(payload),JSON.stringify({...payload,summary:'가상 정정'})]);
  await db.query("insert into enl_incident_backups(reason,snapshot) values('가상 보존',$1::jsonb)",[JSON.stringify([payload])]);
 }
 await db.exec(read('schema'));
 return db;
}
function handlerFor(db,baseline,options={}){
 const config={environment:options.environment||'production',actorId:actor.id,baseline,token,...options.build};
 const built=build(config);let handler,connections=0,baselineQueries=0;
 function adapter(connection){
  const sql=()=>{throw Error('unexpected tagged SQL')};
  sql.unsafe=(query,args=[])=>{
   const run=async(simple)=>{
    if(simple){if(options.failSql&&query===built.sql.activation)return await connection.exec('not_valid_sql');return await connection.exec(query);}
    if(options.wrongDbRole&&query==='select current_user as role')return [{role:'service_role'}];
    const rows=(await connection.query(query,args)).rows;
    if(query===built.sql.baseline&&++baselineQueries===2&&options.failAfter){const altered=structuredClone(rows);altered[0].baseline.audit.sha256='0'.repeat(64);return altered;}
    return rows;
   };
   return {then:(ok,bad)=>run(false).then(ok,bad),simple:()=>run(true)};
  };
  sql.begin=async cb=>db.transaction(t=>cb(adapter(t)));sql.end=async()=>{};return sql;
 }
 const ctx={Deno:{env:{get:k=>k==='SUPABASE_URL'?`https://${options.project||built.config.project}.supabase.co`:k==='SUPABASE_DB_URL'?'isolated':''},serve:h=>handler=h},postgres:()=>{connections++;return adapter(db)},Request,Response,TextEncoder,crypto,console};vm.createContext(ctx);
 vm.runInContext(stripTypeScriptTypes(built.source.replace(/^import .*;\r?\n/gm,'')),ctx);
 async function call(body={},override={}){
  const request=new Request('https://'+projects.production.project+'.supabase.co/functions/v1/enl-evidence-activation',{method:override.method||'POST',headers:{'content-type':'application/json','x-enl-maintenance-token':override.token??token},...(override.method==='GET'?{}:{body:JSON.stringify({action:'activate',actor,actorPasswordHash:proof,...body})})});
  const r=await handler(request);return {status:r.status,body:await r.json()};
 }
 return {call,built,get connections(){return connections}};
}
(async()=>{let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};const db=await fixture();try{
 const baseline=(await db.query(read('baseline'))).rows[0].baseline;
 let h=handlerFor(db,baseline),r;
 for(const badToken of ['', 'b'.repeat(64), 'x']){r=await h.call({}, {token:badToken});check(r.status===403,'wrong token blocked');}
 check(h.connections===0,'token rejection before database connection');
 r=await h.call({actorPasswordHash:'wrong'});check(r.status===403,'wrong safety proof blocked');
 for(const active of [false,null]){await db.query('update enl_hq_users set active=$1',[active]);r=await h.call();check(r.status===403,'safety account must be explicitly active');}
 await db.exec('update enl_hq_users set active=true');
 r=await h.call({actor:{id:'qa-other',role:'safety'}});check(r.status===403,'different actor blocked');
 r=await h.call({actor:{...actor,role:'manager'}});check(r.status===403,'wrong role blocked');
 for(const body of [{action:'execute_sql',query:'select 1'},{sql:'delete from public.enl_incident_audit'},{path:'arbitrary'},{schema:'other'}]){r=await h.call(body);check(r.status===400,'arbitrary operation input blocked');}
 r=await h.call({}, {method:'GET'});check(r.status===405,'only POST');
 h=handlerFor(db,baseline,{project:projects.staging.project});r=await h.call();check(r.status===403&&r.body.code==='project_mismatch'&&h.connections===0,'wrong project blocked before db');
 h=handlerFor(db,baseline,{build:{builtAt:Date.now()-3600001,expiresAt:Date.now()-1}});r=await h.call();check(r.status===410&&h.connections===0,'expired credential blocked');
 check(!h.built.source.includes(token),'plaintext token absent source');
 check(h.built.config.expiresAt-h.built.config.builtAt<=3600000,'expiry limited one hour');
 const count=async()=>Number((await db.query('select count(*) n from private.enl_evidence_objects')).rows[0].n);
 const baselineBad=structuredClone(baseline);baselineBad.audit.sha256='0'.repeat(64);
 h=handlerFor(db,baselineBad);r=await h.call();check(r.status===409&&r.body.code==='baseline_mismatch','wrong whole-row baseline refused');check(await count()===0,'baseline mismatch leaves dictionary empty');
 h=handlerFor(db,baseline,{wrongDbRole:true});r=await h.call();check(r.status===409&&r.body.code==='database_role_mismatch','nonpostgres refused');check(await count()===0,'wrong dbrole no writes');
 h=handlerFor(db,baseline,{failSql:true});r=await h.call();check(r.status===409&&r.body.code==='activation_failed'&&r.body.sqlstate==='42601','only sanitized SQLSTATE diagnostic returned');check(!JSON.stringify(r).includes('not_valid_sql'),'SQL text not leaked');
 h=handlerFor(db,baseline,{failAfter:true});r=await h.call();check(r.status===409&&r.body.code==='verification_failed','postwrite hash fault fails closed: '+JSON.stringify(r));
 check(await count()===0,'failed postwrite hash rolls back dictionary');
 assert.deepEqual((await db.query(read('baseline'))).rows[0].baseline,baseline);checks++;
 check((await db.query("select count(*) n from pg_trigger where tgname like '%compact_insert'")).rows[0].n===0,'failed transaction rolls back new triggers');
 check((await db.query("select bool_and(p.proname='enl_evidence_append_only' and t.tgenabled='O') good from pg_trigger t join pg_proc p on t.tgfoid=p.oid where t.tgname in ('enl_audit_immutable','enl_revision_immutable')")).rows[0].good,'rollback keeps original immutable guards');
 h=handlerFor(db,baseline);r=await h.call({action:'status'});check(r.status===200&&r.body.active===false,'authorized status before activation');
 r=await h.call();check(r.status===200&&r.body.active&&r.body.alreadyActive===false,'exact handler activation succeeds');
 check(r.body.audit===2&&r.body.revisions===1&&r.body.backups===1&&r.body.compactedSnapshots===4,'counts preserved');
 check(!JSON.stringify(r).includes('qa-runner')&&!JSON.stringify(r).includes('sha256')&&!JSON.stringify(r).includes(proof),'response has no evidence or credentials');
 assert.deepEqual((await db.query(read('baseline'))).rows[0].baseline,baseline);checks++;
 const nodes=await count();r=await h.call();check(r.status===200&&r.body.alreadyActive===true,'idempotent second activation');check(await count()===nodes,'replay creates no duplicate evidence');
 await assert.rejects(()=>db.exec("update enl_incident_audit set editor_name='modified'"),/evidence_is_append_only/);checks++;
 await db.transaction(t=>t.exec(read('rollback')));assert.deepEqual((await db.query(read('baseline'))).rows[0].baseline,baseline);checks++;
 const mapped=build({environment:'staging',actorId:actor.id,baseline,token});check(mapped.sql.activation.includes("tg_table_schema<>'enl_final_qa_20261013'"),'staging guard project schema pinned');check(mapped.sql.activation.includes("'enl_final_qa_20261013.enl_bulk_lifecycle_guard()'::regprocedure"),'staging existing guard resolution');check(!/\bpublic\.|\bprivate\./.test(mapped.sql.activation),'no production schema in staging activation');
 const stage=new PGlite();try{
  const target=projects.staging;
  await stage.exec('create schema '+target.schema+';set search_path='+target.schema+';');
  await stage.exec(mapSQL(setup,target).replace('create schema private;','create schema '+target.privateSchema+';').replace('create function '+target.privateSchema+'.enl_bulk_lifecycle_guard','create function '+target.schema+'.enl_bulk_lifecycle_guard'));
  await stage.exec('create table '+target.schema+'.enl_hq_users(user_id text,role text,active bool,password_hash text);');
  await stage.query('insert into '+target.schema+'.enl_hq_users values($1,$2,true,$3)',[actor.id,'safety',proof]);
  await stage.query("insert into "+target.schema+".enl_incident_audit(incident_id,site_id,action,after_payload) values('qa-stage','qa-site','create',$1::jsonb)",[JSON.stringify({id:'qa-stage',detail:'Mapped QA schema fixture'})]);
  await stage.exec(mapSQL(read('schema'),target));
  const stageBaseline=(await stage.query(mapSQL(read('baseline'),target))).rows[0].baseline;
  const stageHandler=handlerFor(stage,stageBaseline,{environment:'staging'});
  r=await stageHandler.call();check(r.status===200&&r.body.active,'actual mapped staging handler succeeds');
  assert.deepEqual((await stage.query(mapSQL(read('baseline'),target))).rows[0].baseline,stageBaseline);checks++;
 }finally{await stage.close()}
 console.log(JSON.stringify({suite:'evidence-activation-runner',passed:checks,failed:0}));
}finally{await db.close()}
 if(process.argv[2]){
  const real=await fixture(process.argv[2]);try{
   const baseline=baselineFromBackup(process.argv[2]);assert.deepEqual((await real.query(read('baseline'))).rows[0].baseline,baseline);
   const h=handlerFor(real,baseline),r=await h.call();assert.equal(r.status,200,'real backup exact handler activation');
   assert.deepEqual((await real.query(read('baseline'))).rows[0].baseline,baseline);
   await real.transaction(t=>t.exec(read('rollback')));assert.deepEqual((await real.query(read('baseline'))).rows[0].baseline,baseline);
   console.log(JSON.stringify({suite:'evidence-activation-runner-real-backup',originalWholeRowsMatched:baseline.audit.count+baseline.revisions.count+baseline.backups.count,activation:'passed',rollback:'passed'}));
  }finally{await real.close()}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
