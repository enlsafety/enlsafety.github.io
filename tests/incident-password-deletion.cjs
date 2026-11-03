'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const {fixture}=require('./final-lifecycle.cjs');
async function run(){
 const f=await fixture(),db=f.db;let handler,tx=null,checks=0;
 const check=(condition,label)=>{assert.ok(condition,label);checks++};
 const password='Isolated-delete-QA-2026!';
 const hash=require('node:crypto').createHash('sha256').update(password).digest('hex');
 await db.query("update enl_hq_users set password_hash=$1 where user_id='qa-safety'",[hash]);
 const sql=async(parts,...args)=>(await(tx||db).query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;
 sql.json=JSON.stringify;sql.end=async()=>{};sql.begin=fn=>db.transaction(async t=>{tx=t;try{return await fn(sql)}finally{tx=null}});
 const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,Request,Response,TextEncoder,crypto,console};vm.createContext(ctx);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-incident-compliance-v439/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),ctx);
 const call=async extras=>{const r=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({action:'delete_incident',actor:f.actors.safety,actorPasswordHash:hash,incidentId:'qa-delete-reported',expectedVersion:1,password,reason:'격리 환경 삭제 검증',...extras})}));return {status:r.status,body:await r.json()}};
 const states=[['draft'],['reported'],['supplement'],['supplement_submitted'],['rejected'],['approved'],['approved','planned'],['approved','in_progress'],['approved','submitted'],['approved','rejected'],['approved','approved','parallel'],['approved','approved','president'],['closed'],['closed','approved','historical']];
 const originals=[];
 // Synthetic fixtures only. Disable lifecycle notification triggers during setup.
 await db.exec('alter table enl_incident_shared disable trigger user');
 for(let n=0;n<states.length;n++){
  const [status,corrective,stage]=states[n],id=n===1?'qa-delete-reported':'qa-delete-'+n;
  const payload={id,siteId:'qa-site',status,summary:'격리 테스트 '+n,_syncVersion:1,photos:[{path:'qa-only/original.jpg'}],reportDetails:{incidentHow:'원본 보존 검증'},corrective:corrective?{status:corrective,afterPhotos:[{path:'qa-only/action.jpg'}]}:null,executiveApproval:stage?{state:'pending',stage}:null};
  if(stage==='historical'){payload.historicalOrigin={batchId:'qa',candidateId:'qa'};payload.externalInitialApproval={state:'verified'}}
  await db.query('insert into enl_incident_shared(incident_id,site_id,payload) values($1,$2,$3)',[id,'qa-site',JSON.stringify(payload)]);originals.push(payload);
 }
 await db.exec('alter table enl_incident_shared enable trigger user');
 for(const [extra,status] of [[{password:''},400],[{reason:' '},400],[{reason:'x'.repeat(2001)},400],[{expectedVersion:0},409],[{actor:f.actors.field},403],[{actor:f.actors.manager},403],[{actor:{id:'qa-manager',role:'safety'},actorPasswordHash:'qa-proof'},403],[{actorPasswordHash:'stale'},403],[{password:hash},403]]){let r=await call(extra);check(r.status===status,JSON.stringify({extra:{...extra,password:extra.password?'[redacted]':extra.password},r}));}
 check((await db.query('select count(*)::int n from private.enl_incident_deletions')).rows[0].n===0,'failed requests never delete');
 for(let n=0;n<4;n++)check((await call({password:'wrong'})).status===403,'incorrect password');
 check((await call({})).status===429,'fifth failure blocks further guesses');
 await db.exec("update private.enl_incident_delete_attempts set window_started_at=now()-interval '16 minutes'");
 // An audit failure must roll back deletion and vice versa.
 await db.exec("create function private.qa_reject_deletion() returns trigger language plpgsql as $$begin raise exception 'qa_rollback';end;$$;create trigger qa_reject_deletion before insert on private.enl_incident_deletions for each row execute function private.qa_reject_deletion();");
 check((await call({})).status===500,'ledger failure reported');
 check((await db.query("select count(*)::int n from enl_incident_audit where action='delete'")).rows[0].n===0,'audit rolled back atomically');
 await db.exec('drop trigger qa_reject_deletion on private.enl_incident_deletions');
 for(const original of originals){
  const r=await call({incidentId:original.id});check(r.status===200&&r.body.deleted,original.id+' deletion '+JSON.stringify(r));
  const retained=(await db.query('select payload from enl_incident_shared where incident_id=$1',[original.id])).rows[0].payload;
  assert.deepEqual(retained,original);checks++;
  check((await db.query('select count(*)::int n from enl_incident_active where incident_id=$1',[original.id])).rows[0].n===0,'archived incident hidden');
 }
 const duplicate=await call({});check(duplicate.status===200&&duplicate.body.duplicate,'retry idempotent');
 check((await db.query("select count(*)::int n from enl_incident_audit where action='delete'")).rows[0].n===states.length,'one audit per deleted incident');
 for(const who of ['safety','field','manager','executive','other']){
  const r=await f.call(who,{action:'pull',...(who==='safety'?{actorPasswordHash:hash}:{})});check(r.status===200&&r.body.incidents.length===0,who+' active list excludes deleted');
  check(r.body.deletedIds.length===(who==='other'?0:states.length),who+' tombstones obey site authorization');
 }
 const audited=await call({action:'audit_list'});check(audited.status===200&&audited.body.audits[0].after_payload.reason==='격리 환경 삭제 검증','reason accessible in retained audit');
 check(!JSON.stringify(audited).includes(password)&&!JSON.stringify(audited).includes(hash),'password not in audit');
 await assert.rejects(()=>db.exec("update enl_incident_shared set payload=payload where incident_id='qa-delete-reported'"),/incident_deleted/);checks++;
 await assert.rejects(()=>db.exec('delete from private.enl_incident_deletions'),/evidence_is_append_only/);checks++;
 await assert.rejects(()=>db.exec("update private.enl_incident_deletions set reason='변조'"),/evidence_is_append_only/);checks++;
 await assert.rejects(()=>db.exec('delete from enl_incident_shared'),/incident_deletion_disabled|foreign key/);checks++;
 for(const action of ['export_snapshot','final_document','correct_closed']){const r=await f.call('safety',{action,actorPasswordHash:hash,incidentId:'qa-delete-reported',expectedVersion:1,mutationId:crypto.randomUUID(),reason:'가상 정정',changes:{summary:'변조'}});check(r.status>=400,'deleted record direct '+action+' denied');}
 check((await db.query('select count(*)::int n from enl_push_events')).rows[0].n===0,'deletion does not create notifications');
 check((await db.query('select count(*)::int n from enl_email_events')).rows[0].n===0,'deletion does not create emails');
 await db.exec("update enl_hq_users set active=false where user_id='qa-safety'");check((await call({})).status===403,'inactive safety denied');
 await db.exec('set role anon');await assert.rejects(()=>db.query('select * from private.enl_incident_deletions'),/permission denied/);checks++;await db.exec('reset role');
 console.log(JSON.stringify({passed:checks,failed:0,states:states.length,environment:'isolated PostgreSQL and actual compliance/sync handlers'}));await db.close();
}
run().catch(e=>{console.error(e);process.exitCode=1});
