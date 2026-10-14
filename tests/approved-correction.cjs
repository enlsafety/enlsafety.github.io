'use strict';
// Isolated approval-correction regression. No production DB writes.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();let checks=0;
 const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
 const call=(role,action,extra={})=>f.call(role,{action,incidentId:'qa-approved-correction',...extra});
 try{
  let r=await f.call('field',{action:'push',incidents:[{
   id:'qa-approved-correction',siteId:'qa-site',status:'reported',category:'property',summary:'QA 최초 내용',eventType:'접촉',occurredAt:'2026-10-12T03:00:00Z',
   reportDetails:{templateVersion:'v411',place:'QA 진입로',incidentHow:'기존 사고경위',repairCost:null,repairCostPending:true,recordedAt:'2026-10-12T04:00:00Z'},
   corrective:null,photos:[],_syncBaseVersion:0,_syncMutationId:'create-approved-test'
  }]});eq(r.status,200,'created');let i=r.body.incidents[0];
  r=await call('safety','correct_closed',{changes:{summary:'승인 전 오류 수정'},reason:'테스트',expectedVersion:i._syncVersion,mutationId:crypto.randomUUID()});
  eq(r.status,409,'unapproved correction denied');
  const approve={...i,status:'approved',reportDetails:{...i.reportDetails,causeAnalysisStatus:'investigating'},approvedBy:'client-not-authoritative',approvedAt:'2000-01-01',_syncBaseVersion:i._syncVersion,_syncMutationId:crypto.randomUUID()};
  r=await f.call('safety',{action:'push',incidents:[approve]});eq(r.status,200,'approval succeeded');i=r.body.incidents[0];
  const original={by:i.approvedBy,at:i.approvedAt,reportedBy:i.reporterId,site:i.siteId,version:i._syncVersion};
  const pushCount=Number((await f.db.query('select count(*)::int n from enl_push_events')).rows[0].n);
  let attempted={...i,summary:'old generic edit forbidden',_syncBaseVersion:i._syncVersion,_syncMutationId:crypto.randomUUID()};
  r=await f.call('safety',{action:'push',incidents:[attempted]});eq(r.status,409,'generic approved overwrite blocked');
  r=await call('field','correct_closed',{changes:{summary:'비인가'},reason:'QA',mutationId:crypto.randomUUID(),expectedVersion:i._syncVersion});
  eq(r.status,403,'field correction blocked');
  r=await call('manager','correct_closed',{changes:{summary:'비인가'},reason:'QA',mutationId:crypto.randomUUID(),expectedVersion:i._syncVersion});
  eq(r.status,403,'manager correction blocked');
  r=await call('safety','correct_closed',{changes:{summary:'사고내용 정정'},reason:'',mutationId:crypto.randomUUID(),expectedVersion:i._syncVersion});
  eq(r.status,400,'reason required');
  r=await call('safety','correct_closed',{changes:{reportDetails:{recordedAt:'forged'}},reason:'금지필드',mutationId:crypto.randomUUID(),expectedVersion:i._syncVersion});
  eq(r.status,400,'recordedAt immutable');
  const mutationId=crypto.randomUUID(),changes={summary:'QA 승인 후 정정 내용',reportDetails:{incidentHow:'QA 수정된 사고경위',repairCost:12000}};
  r=await call('safety','correct_closed',{changes,reason:'사고 내용과 확정 수리비 정정',mutationId,expectedVersion:i._syncVersion});
  assert.equal(r.status,200,JSON.stringify(r));checks++;i=r.body.incident;
  eq(i.status,'approved','approval still approved');eq(i.approvedBy,original.by,'approver unchanged');eq(i.approvedAt,original.at,'approval timestamp unchanged');
  eq(i.siteId,original.site,'site remains locked');eq(i.reporterId,original.reportedBy,'reporter unchanged');
  eq(i.reportDetails.incidentHow,'QA 수정된 사고경위','report patch persisted');eq(i.reportDetails.place,'QA 진입로','untouched detail preserved');
  eq(i.reportDetails.recordedAt,'2026-10-12T04:00:00Z','original detail metadata preserved');
  eq(i.reportDetails.repairCost,12000,'corrected cost persists');eq(i.reportDetails.repairCostPending,false,'cost pending flag cleared');
  eq(i.officialRecord.revisionNumber,1,'audit revision incremented');eq(i.officialRecord.actionRecheckRequired,true,'action recheck flagged');
  const saved=(await call('safety','pull')).body.incidents.find(x=>x.id===i.id);
  eq(saved.summary,'QA 승인 후 정정 내용','read back from database');
  eq(saved._syncVersion,original.version+1,'optimistic version increased');
  const rev=(await f.db.query('select changes,reason,before_payload,after_payload from enl_incident_revisions where incident_id=$1',[i.id])).rows;
  eq(rev.length,1,'one immutable audit revision');eq(rev[0].before_payload.reportDetails.incidentHow,'기존 사고경위','old text recorded');eq(rev[0].after_payload.reportDetails.incidentHow,'QA 수정된 사고경위','new text recorded');
  r=await call('safety','correct_closed',{changes,reason:'사고 내용과 확정 수리비 정정',mutationId,expectedVersion:original.version});
  eq(r.status,200,'same request retry accepted');eq(r.body.duplicate,true,'idempotency flag');
  r=await call('safety','correct_closed',{changes:{summary:'stale'} ,reason:'버전 충돌',mutationId:crypto.randomUUID(),expectedVersion:original.version});
  eq(r.status,409,'stale edit blocked');
  eq(Number((await f.db.query('select count(*)::int n from enl_push_events')).rows[0].n),pushCount,'corrections send no new approval/incident push');
  eq(Number((await f.db.query("select count(*)::int n from enl_incident_audit where action='correct_closed'")).rows[0].n),1,'correction audit committed');
  console.log('PASS ordinary approved correction: '+checks+' checks; persistent update, unchanged approval, audit, access denial, stale conflict and no push');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});