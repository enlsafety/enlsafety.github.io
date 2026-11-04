'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();
 try{
  for(const category of ['person','property']){
   const draft={id:'qa-past-'+category,siteId:'qa-site',category,status:'reported',occurredAt:'2026-01-01T00:00:00Z',pastReport:{drafterName:'당시 기안자',safetyManagerName:'당시 안전'},photos:[],reportDetails:{},corrective:null};
   const push=(role,patch={})=>f.call(role,{action:'push',incidents:[{...structuredClone(draft),...patch,_syncMutationId:crypto.randomUUID()}]});
   assert.equal((await push('field')).status,403);
   assert.equal((await push('manager')).status,403);
   assert.equal((await push('safety',{pastReport:{drafterName:' ',safetyManagerName:'이름'}})).status,400);
   assert.equal((await push('safety',{status:'approved'})).status,409);
   const response=await push('safety',{approvedBy:'가짜 승인',approvedAt:draft.occurredAt});
   assert.equal(response.status,200,JSON.stringify(response.body));
   const record=response.body.incidents[0];
   assert.equal(record.status,'reported');assert.equal(record.approvedAt,null);
   assert.deepEqual(record.pastReport,draft.pastReport);
   assert.equal(record.officialRecord.reporter.id,f.actors.safety.id);
   assert.equal((await push('field',{...record,pastReport:null,_syncBaseVersion:record._syncVersion})).status,409);
  }
  console.log('PASS safety-only registration, both categories, immutable source names, actual registrant and no fabricated approval');
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
