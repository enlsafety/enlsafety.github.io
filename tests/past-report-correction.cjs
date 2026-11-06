'use strict';
// Synthetic records in an isolated PostgreSQL fixture. Never writes production.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};try{
 let r=await f.call('safety',{action:'push',incidents:[{id:'qa-past-names',siteId:'qa-site',category:'property',status:'reported',summary:'QA 과거사고',eventType:'접촉',occurredAt:'2026-10-12T03:00:00Z',pastReport:{drafterName:'당시 소장',safetyManagerName:'당시 담당자'},reportDetails:{place:'QA',incidentHow:'QA',causeAnalysisStatus:'investigating'},photos:[],_syncBaseVersion:0,_syncMutationId:crypto.randomUUID()}]});eq(r.status,200,JSON.stringify(r));let i=r.body.incidents[0];
 const push=async(role,patch)=>f.call(role,{action:'push',incidents:[{...structuredClone(i),...patch,_syncBaseVersion:i._syncVersion,_syncMutationId:crypto.randomUUID()}]});
 r=await push('field',{pastReport:{drafterName:'위조',safetyManagerName:'위조'}});eq(r.status,409,'field cannot change historical names');
 r=await push('safety',{pastReport:{drafterName:'  원자료 소장  ',safetyManagerName:'원자료 안전'}});eq(r.status,200,JSON.stringify(r));i=r.body.incidents[0];eq(i.pastReport.drafterName,'원자료 소장','trim preapproval correction');
 r=await push('safety',{status:'approved'});eq(r.status,200,JSON.stringify(r));i=r.body.incidents[0];const original=structuredClone(i);
 const correction=(changes,role='safety',reason='원자료 재확인 후 당시 담당자 정정',version=i._syncVersion)=>f.call(role,{action:'correct_closed',incidentId:i.id,changes,reason,expectedVersion:version,mutationId:crypto.randomUUID()});
 const names={drafterName:'수정 소장',safetyManagerName:'수정 안전'};
 r=await push('safety',{pastReport:names});eq(r.status,409,'approved generic overwrite rejected');
 r=await correction({pastReport:names},'field');eq(r.status,403,'field correction denied');
 r=await correction({pastReport:names},'manager');eq(r.status,403,'manager correction denied');
 r=await correction({pastReport:names},'safety','');eq(r.status,400,'reason required');
 for(const value of [null,[],{}, {...names,drafterName:' '},{...names,safetyManagerName:'x'.repeat(81)},{...names,approvedBy:'forged'}]){r=await correction({pastReport:value});eq(r.status,400,'invalid historical names rejected '+JSON.stringify(value));}
 r=await correction({pastReport:names});eq(r.status,200,JSON.stringify(r));i=r.body.incident;eq(i.pastReport,names,'names returned');
 for(const key of ['status','approvedBy','approvedAt','reporterId','reporterName','reportDetails','corrective','executiveApproval','photos'])eq(i[key],original[key],key+' preserved');
 eq(i.officialRecord.revisionNumber,1,'revision created');eq(!!i.officialRecord.actionRecheckRequired,false,'metadata edit does not restart action');
 const saved=(await f.call('safety',{action:'pull'})).body.incidents.find(x=>x.id===i.id);eq(saved.pastReport,names,'database roundtrip');
 const rev=(await f.db.query('select changes,reason,before_payload,after_payload from enl_incident_revisions where incident_id=$1',[i.id])).rows;eq(rev.length,1,'append only revision');eq(rev[0].before_payload.pastReport,original.pastReport,'previous names retained');eq(rev[0].after_payload.pastReport,names,'new names retained');eq(rev[0].changes.map(d=>d.field).sort(),['pastReport.drafterName','pastReport.safetyManagerName'],'audit field names');
 r=await correction({pastReport:{...names,drafterName:'stale'}},'safety','원자료 정정',original._syncVersion);eq(r.status,409,'stale version rejected');
 // Existing actual plan/action actors are never replaced by historical metadata.
 const {stripTypeScriptTypes}=require('node:module'),fs=require('node:fs');const source=stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-incident-sync-v411/lifecycle-policy.ts','utf8'));const policy=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const active={...i,corrective:{status:'rejected',planBy:'현재 안전',submittedBy:'현재 소장',planAt:'2026-11-01',submittedAt:'2026-11-02'}};
 const out=policy.correctedIncident(active,{pastReport:original.pastReport},'추가 원자료 확인',{id:'qa-safety',name:'QA 안전',role:'safety'},'2026-11-06T00:00:00Z');
 eq(out.next.corrective,active.corrective,'active prevention action remains unchanged');
 assert.throws(()=>policy.correctedIncident({...i,executiveApproval:{state:'pending'}},{pastReport:original.pastReport},'정정',{role:'safety'},'now'),/executive_review_in_progress/);checks++;
 assert.throws(()=>policy.correctedIncident({...i,pastReport:undefined},{pastReport:names},'정정',{role:'safety'},'now'),/revision_field_forbidden/);checks++;
 console.log('PASS historical names: '+checks+' checks; authenticated save, audit, permissions, workflow preservation, validation and stale conflict');
 }finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
