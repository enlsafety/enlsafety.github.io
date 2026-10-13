'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const URL='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-final-lifecycle-qa-20261013';
const actors={safety:{id:'qa-safety',role:'safety'},field:{id:'qa-field',role:'field',siteId:'qa-site'},manager:{id:'qa-manager',role:'manager'},executive:{id:'qa-executive',role:'executive'}};
async function call(who,body){const r=await fetch(URL,{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({actor:actors[who],actorPasswordHash:'qa-proof',actorPinHash:'qa-proof',...body})});return {status:r.status,body:await r.json()};}
(async()=>{let count=0,i;const check=(r,code,label)=>{assert.equal(r.status,code,label+': '+JSON.stringify(r.body));count++;return r.body};
 const id='qa-live-'+Date.now();
 let r=await call('field',{action:'push',incidents:[{id,siteId:'qa-site',status:'reported',summary:'가상 사고 통합검증',category:'property',eventType:'접촉',occurredAt:'2026-10-12T01:00:00Z',reportDetails:{incidentHow:'실제 사고가 아닌 QA 자료',repairCost:null},photos:[],corrective:null,_syncBaseVersion:0,_syncMutationId:id+':create'}]});i=check(r,200,'create').incidents[0];
 const push=async(who,edit,label,code=200)=>{const x=structuredClone(i);edit(x);x._syncBaseVersion=i._syncVersion;x._syncMutationId=crypto.randomUUID();const res=await call(who,{action:'push',incidents:[x]});check(res,code,label);if(res.status===200)i=res.body.incidents[0];};
 for(const who of ['manager','executive']){r=await call(who,{action:'pull'});check(r,200,'preapproval visibility');assert.ok(r.body.incidents.some(x=>x.id===id));check(await call(who,{action:'acknowledge',incidentId:id}),410,'approval blocked');}
 await push('safety',x=>{x.status='supplement';x.supplement={requestNote:'자료 보완'}},'supplement');await push('field',x=>x.status='supplement_submitted','resubmit');await push('safety',x=>x.status='approved','safety approval');
 await push('field',x=>x.summary='무단 정정','locked facts',409);await push('field',x=>x.reportDetails.repairCost=35000,'cost addition');
 await push('safety',x=>x.corrective={status:'planned',rootCause:'추정: 동선 겹침',planDetail:'가상 안전표지 설치',ownerName:'QA 현장',dueDate:'2026-10-20'},'plan');
 await push('field',x=>Object.assign(x.corrective,{status:'submitted',actionDetail:'가상 표지 설치 완료',actionDate:'2026-10-13',actionOwner:'QA 현장',afterPhotos:[{name:'가상증빙.pdf',path:'action/site-qa-site/qa.pdf',mime:'application/pdf'}]}),'submit');
 await push('safety',x=>Object.assign(x.corrective,{status:'rejected',reviewNote:'가상 보완요청'}),'action revision');await push('field',x=>x.corrective.status='submitted','action resubmit');await push('safety',x=>{x.corrective.status='approved';x.status='closed'},'closure');
 const stamps={approvedAt:i.approvedAt,closedAt:i.closedAt};
 const op=async(action,extra={},code=200,who='safety')=>{const res=await call(who,{action,incidentId:id,expectedVersion:i._syncVersion,mutationId:crypto.randomUUID(),...extra});check(res,code,action);if(res.body.incident)i=res.body.incident;return res;};
 await op('erp_record',{record:{submitted:true,documentNumber:'QA-ONLY',draftedAt:'2026-10-13'},reason:'가상 기록'});
 await op('correct_closed',{reason:'',changes:{summary:'정정'}},400);await op('correct_closed',{reason:'가상 정정',changes:{summary:'정정된 가상 사고'}},403,'manager');
 const mutationId=crypto.randomUUID(),expectedVersion=i._syncVersion;
 await op('correct_closed',{mutationId,expectedVersion,reason:'가상 정정',changes:{summary:'정정된 가상 사고'}});await op('correct_closed',{mutationId,expectedVersion,reason:'가상 정정',changes:{summary:'정정된 가상 사고'}});
 assert.equal(i.approvedAt,stamps.approvedAt);assert.equal(i.closedAt,stamps.closedAt);assert.equal(i.officialRecord.revisionNumber,1);assert.ok(i.officialRecord.erpCorrectionRequired);
 const snapshotId=crypto.randomUUID();await op('export_snapshot',{mutationId:snapshotId});await op('export_completed',{snapshotId,fileHash:'g'.repeat(64),filename:'QA.xlsx'},409);const completionId=crypto.randomUUID();await op('export_completed',{snapshotId,fileHash:'a'.repeat(64),filename:'QA.xlsx',mutationId:completionId});await op('export_completed',{snapshotId,fileHash:'a'.repeat(64),filename:'QA.xlsx',mutationId:completionId});await op('revision_list',{},200,'executive');await op('view',{},200,'manager');
 fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/final-live-staging.json',JSON.stringify({passed:count,failed:0,id,version:'4.6.0-r1',url:URL,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:count,failed:0,id}));
})().catch(e=>{console.error(e);process.exitCode=1});
