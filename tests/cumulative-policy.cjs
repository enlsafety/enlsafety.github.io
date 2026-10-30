'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();await f.db.exec(require("node:fs").readFileSync("supabase/migrations/20261030004902_executive_closure.sql","utf8"));let checks=0;
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const push=(who,i,change={})=>f.call(who,{action:'push',incidents:[{...structuredClone(i),...change,_syncBaseVersion:i._syncVersion||0,_syncMutationId:crypto.randomUUID()}]});
try{
 const base={id:'qa-race',siteId:'qa-site',status:'reported',category:'property',summary:'QA facts',eventType:'접촉',occurredAt:'2026-10-12T01:00:00Z',reportDetails:{incidentHow:'QA report',environmentCause:'QA environment',behaviorCause:'QA behavior',causeAnalysisNote:'QA note',causeAnalysisStatus:'analyzed'},photos:[]};
 let r=await push('safety',base);eq(r.status,200,'fixture created');const first=r.body.incidents[0];
 r=await push('safety',first,{status:'approved'});eq(r.status,200,'approval wins');let i=r.body.incidents[0];
 r=await push('field',first,{summary:'late recall'});eq(r.status,409,'concurrent recall loses without overwriting approval');
 const approval=i.approvedAt;
 r=await push('field',{...base,id:'qa-race-reverse',reportDetails:{incidentHow:'QA'}});eq(r.status,200,'reverse fixture');let other=r.body.incidents[0];
 r=await push('field',other,{summary:'recalled facts'});eq(r.status,200,'recall wins');
 r=await push('safety',other,{status:'approved',reportDetails:{...other.reportDetails,causeAnalysisStatus:'investigating'}});eq(r.status,409,'stale approval loses');
 r=await push('safety',i,{corrective:{status:'planned',rootCause:'QA cause',planDetail:'QA plan',ownerName:'QA 현장',dueDate:'2026-10-20'}});eq(r.status,200,'plan');i=r.body.incidents[0];
 const action={...i.corrective,status:'submitted',actionDetail:'QA done',actionDate:'2026-10-13',actionCompletedDate:'2026-10-14',actionOwner:'QA 현장',afterPhotos:[{name:'QA.png',path:'action/site-qa-site/qa.png',mime:'image/png'}]};
 for(const who of ['manager','executive','other']){r=await push(who,i,{corrective:action});assert.ok(r.status===403||(r.status===200&&!r.body.incidents.length),who+' cannot submit this site');checks++;}
 for(const date of ['2026-02-30','2099-01-01','2026-10-12']){r=await push('field',i,{corrective:{...action,actionCompletedDate:date}});eq(r.status,400,'invalid/future/before-start completion blocked');}
 r=await push('field',i,{corrective:{...action,submissions:[{actionDetail:'forged'}]}});eq(r.status,403,'cannot forge submission history');
 r=await push('field',i,{corrective:action});eq(r.status,200,'valid action');i=r.body.incidents[0];eq(i.corrective.submissions.length,1,'server snapshots action');
 r=await push('safety',i,{corrective:{...i.corrective,status:'rejected',reviewNote:'QA additional evidence',actionDetail:'reviewer changed evidence'}});eq(r.status,409,'review cannot rewrite submitted evidence');
 r=await push('safety',i,{corrective:{...i.corrective,status:'rejected',reviewNote:'QA additional evidence'}});eq(r.status,200,'request supplement');i=r.body.incidents[0];const originalSubmission=structuredClone(i.corrective.submissions[0]);
 r=await push('safety',i,{corrective:{...i.corrective,planDetail:'QA revised instruction'}});eq(r.status,200,'plan correction during supplement retains D');i=r.body.incidents[0];
 r=await push('field',i,{corrective:{...i.corrective,status:'submitted',actionDetail:'QA resubmission',afterPhotos:[...i.corrective.afterPhotos,{name:'QA2.pdf',path:'action/site-qa-site/qa2.pdf',mime:'application/pdf'}]}});eq(r.status,200,'resubmission');i=r.body.incidents[0];assert.deepEqual(i.corrective.submissions[0],originalSubmission);checks++;eq(i.corrective.submissions[1].requestNote,'QA additional evidence','request preserved with new response');
 r=await push('safety',i,{status:'closed',corrective:{...i.corrective,status:'approved',reviewNote:'QA verified'}});eq(r.status,200,'close');i=r.body.incidents[0];
 r=await f.call('executive',{action:'executive_decide',incidentId:i.id,expectedVersion:i._syncVersion,decision:'approve'});eq(r.status,200,'executive closes');i=r.body.incident;
 const c=structuredClone(i.corrective),closedAt=i.closedAt;
 r=await f.call('safety',{action:'correct_closed',incidentId:i.id,expectedVersion:i._syncVersion,mutationId:crypto.randomUUID(),reason:'QA factual correction',changes:{reportDetails:{incidentHow:'QA corrected after close'}}});eq(r.status,200,'post closure factual correction');i=r.body.incident;assert.deepEqual(i.corrective,c);checks++;eq(i.approvedAt,approval,'approval timestamp preserved');eq(i.closedAt,closedAt,'closure timestamp preserved');eq(i.reportDetails.environmentCause,'QA environment','environment retained');eq(i.reportDetails.behaviorCause,'QA behavior','behavior retained');eq(i.reportDetails.causeAnalysisNote,'QA note','combined cause retained');
 const fetched=(await f.call('safety',{action:'pull'})).body.incidents.find(x=>x.id===i.id);assert.deepEqual(fetched.corrective,c);checks++;
 console.log('PASS cumulative server policy:',checks,'checks; competing approval/recall, roles, dates, append-only submissions, review isolation and A-E preservation');
}finally{await f.db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
