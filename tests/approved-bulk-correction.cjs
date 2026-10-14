'use strict';
// Regression for the production historical bulk UPDATE guard, not present in the older generic QA fixture.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();let checks=0;
 const check=(x,message)=>{assert.ok(x,message);checks++};
 const incidentId='qa-approved-bulk';
 try{
  const base={id:incidentId,siteId:'qa-site',category:'property',status:'approved',recordMode:'historical_transfer',
   summary:'가상 과거 카트 접촉사고',eventType:'접촉',occurredAt:'2026-02-01T02:00:00Z',
   reportDetails:{place:'가상 동선',incidentHow:'원본 과거 사고경위',repairCost:null,repairCostPending:true},
   photos:[],corrective:null,
   historicalOrigin:{batchId:'qa-batch',candidateId:'qa-candidate'},
   externalInitialApproval:{state:'verified',source:'ERP',documentNo:'QA-ARCHIVE'},
   approvedAt:'2026-09-01T02:00:00Z',approvedBy:'기존 승인자',
   officialRecord:{},acknowledgements:[],_syncBaseVersion:0,_syncMutationId:crypto.randomUUID()};
  await f.db.query('insert into enl_incident_shared (incident_id,site_id,payload,created_at,updated_at) values ($1,$2,$3::jsonb,now(),now())',[incidentId,'qa-site',JSON.stringify(base)]);
  const before=(await f.db.query('select payload from enl_incident_shared where incident_id=$1',[incidentId])).rows[0].payload;
  check(before._syncVersion===1,'initial normalized version');
  await f.db.exec('create trigger trg_enl_bulk_lifecycle_guard before insert or update or delete on enl_incident_shared for each row execute function private.enl_bulk_lifecycle_guard()');
  const password='qa-audited-bulk-password',hash=crypto.createHash('sha256').update(password).digest('hex');
  await f.db.query("update enl_hq_users set password_hash=$1 where user_id='qa-safety'",[hash]);
  const safety=async(action,details={})=>f.raw({actor:f.actors.safety,actorPasswordHash:hash,action,incidentId,...details});
  let r=await safety('historical_reauth',{reauthPassword:password});
  assert.equal(r.status,200,JSON.stringify(r));checks++;
  const ticket=r.body.reauthTicket;check(typeof ticket==='string'&&ticket.length>40,'signed password gate');
  const changes={summary:'정정된 과거사고 요약',reportDetails:{incidentHow:'정정된 과거사고 경위',repairCost:11000}};
  const corrective=(mutationId)=>safety('correct_closed',{reauthTicket:ticket,expectedVersion:1,mutationId,reason:'이관서류 사실관계 정정',changes});
  r=await corrective(crypto.randomUUID());
  check(r.status===500&&String(r.body.message).includes('bulk_use_import_editor'),'prior production guard blocks approved history even with audit');
  check(Number((await f.db.query("select count(*)::int n from enl_incident_revisions where incident_id=$1",[incidentId])).rows[0].n)===0,'failed correction fully rolled back');
  const sql=fs.readFileSync('supabase/migrations/20261014094500_approved_bulk_audited_corrections.sql','utf8');
  await f.db.exec(sql);
  const mutationId=crypto.randomUUID();r=await corrective(mutationId);
  assert.equal(r.status,200,JSON.stringify(r));checks++;
  let i=r.body.incident;
  check(i.status==='approved'&&i.approvedAt===before.approvedAt&&i.approvedBy===before.approvedBy,'ERP approval unchanged');
  check(i.summary===changes.summary&&i.reportDetails.incidentHow===changes.reportDetails.incidentHow,'approved bulk change persisted');
  check(i.reportDetails.repairCost===11000&&i.reportDetails.repairCostPending===false,'cost correction persisted and pending flag cleared');
  check(JSON.stringify(i.historicalOrigin)===JSON.stringify(before.historicalOrigin),'historical batch identity intact');
  check(JSON.stringify(i.externalInitialApproval)===JSON.stringify(before.externalInitialApproval),'external approval source intact');
  check(i._syncVersion===2&&i.officialRecord.revisionNumber===1,'version and audit incremented');
  const revision=(await f.db.query("select before_payload,after_payload,changes from enl_incident_revisions where incident_id=$1",[incidentId])).rows;
  check(revision.length===1&&revision[0].before_payload.summary===before.summary&&revision[0].after_payload.summary===changes.summary,'immutable before/after evidence');
  r=await corrective(mutationId);check(r.status===200&&r.body.duplicate===true,'same mutation retry idempotent');
  r=await safety('correct_closed',{reauthTicket:ticket,expectedVersion:2,mutationId:crypto.randomUUID(),reason:'승인정보 조작',changes:{externalInitialApproval:{state:'unverifiable'}}});
  check(r.status===400,'external approval remains uneditable');
  await assert.rejects(()=>f.db.query("update enl_incident_shared set payload=jsonb_set(payload,'{summary}',to_jsonb('unlogged edit'::text)) where incident_id=$1",[incidentId]),/bulk_use_import_editor/);checks++;
  check(Number((await f.db.query("select count(*)::int n from enl_incident_revisions where incident_id=$1",[incidentId])).rows[0].n)===1,'unaudited direct edit did not alter history');
  const saved=(await safety('pull')).body.incidents.find(x=>x.id===incidentId);
  check(saved?.summary===changes.summary,'reloaded persisted after server');
  console.log('PASS audited bulk-approved correction '+checks+' checks incl old-guard reproducer, rollback, fix, audit and denial');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});