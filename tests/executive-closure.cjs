'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./final-lifecycle.cjs');
async function run(){const f=await fixture();await f.db.exec(fs.readFileSync('supabase/migrations/20261030004902_executive_closure.sql','utf8'));await f.db.exec(fs.readFileSync('supabase/migrations/20261030025355_parallel_president_approval.sql','utf8'));for(let n=2;n<=5;n++){await f.db.query("insert into enl_hq_users values($1,$2,'executive','임원','QA',true,'qa-proof')",['qa-e'+n,'QA 임원'+n]);f.actors['e'+n]={id:'qa-e'+n,role:'executive'}}
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);checks++};
let r=await f.call('field',{action:'push',incidents:[{id:'qa-exec',siteId:'qa-site',status:'reported',category:'property',summary:'가상 사고',eventType:'접촉',occurredAt:'2026-10-12T01:00:00Z',reportDetails:{incidentHow:'가상 경위'},corrective:null,photos:[],_syncBaseVersion:0,_syncMutationId:'create'}]});assert.equal(r.status,200,JSON.stringify(r));let i=r.body.incidents[0];
const push=async(who,fn)=>{let n=structuredClone(i);fn(n);n._syncBaseVersion=i._syncVersion;n._syncMutationId=crypto.randomUUID();let r=await f.call(who,{action:'push',incidents:[n]});if(r.status===200)i=r.body.incidents[0];return r;};
const ok=async(who,fn)=>{const r=await push(who,fn);assert.equal(r.status,200,JSON.stringify(r));checks++};
await ok('safety',x=>{x.status='approved';x.reportDetails.causeAnalysisStatus='investigating'});
await ok('safety',x=>x.corrective={status:'planned',rootCause:'원인',planDetail:'계획',ownerName:'QA 현장',dueDate:'2026-10-30'});
await ok('field',x=>Object.assign(x.corrective,{status:'submitted',actionDetail:'조치완료',actionDate:'2026-10-29',actionOwner:'QA 현장',afterPhotos:[{path:'qa.png',mime:'image/png'}]}));
await f.db.exec("update enl_hq_users set position='부사장' where user_id='qa-executive'");
r=await push('safety',x=>{x.corrective.status='approved'});check(r.status===409&&r.body.message==='president_approver_required','vice president cannot stand in for president');
await f.db.exec("update enl_hq_users set position='사장' where user_id in ('qa-executive','qa-e2')");
r=await push('safety',x=>{x.corrective.status='approved'});check(r.status===409&&r.body.message==='president_approver_required','ambiguous presidents cannot start approval');
await f.db.exec("update enl_hq_users set position='부사장' where user_id='qa-e2'");
await ok('safety',x=>{x.corrective.status='approved';x.status='closed'});check(i.status==='approved'&&i.executiveApproval.state==='pending'&&!i.closedAt,'old client cannot auto close');check(i.executiveApproval.roster.length===5,'five approvers captured');
const initial=i;
const requests=async()=>(await f.db.query("select user_id,data from enl_push_events where kind='executive_approval_requested' order by id")).rows;
check(i.executiveApproval.stage==='parallel'&&i.executiveApproval.finalApproverId==='qa-executive','parallel stage and president snapshot');
check((await requests()).length===4&&!(await requests()).some(x=>x.user_id==='qa-executive'),'only four parallel requests at safety confirmation');
for(const decision of ['approve','reject']){r=await f.call('executive',{action:'executive_decide',incidentId:i.id,decision,note:'early',expectedVersion:i._syncVersion,approvalRound:i.executiveApproval.round});check(r.status===409&&r.body.message==='approval_turn_not_ready','president cannot '+decision+' before parallel completion');}
// Even a direct database write with the decision context cannot bypass the turn guard.
await assert.rejects(()=>f.db.transaction(async tx=>{await tx.query("select set_config('enl.actor',$1,true),set_config('enl.executive_decision','1',true)",[JSON.stringify({id:'qa-executive',role:'executive'})]);await tx.query("update enl_incident_shared set payload=payload||'{\"updatedAt\":\"2026-10-30T03:00:00Z\"}'::jsonb where incident_id='qa-exec'");}),/approval_turn_not_ready/);checks++;

r=await push('safety',x=>x.summary='pending edit');check(r.status===409,'pending facts locked');i=initial;
for(const who of ['manager','field','safety']){r=await f.call(who,{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:i._syncVersion});check(r.status===403,who+' cannot approve')}
r=await f.raw({actor:f.actors.executive,action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:i._syncVersion});check(r.status===403,'credential proof required');
r=await f.call('e2',{action:'executive_decide',incidentId:i.id,decision:'reject',note:'추가 검토',expectedVersion:i._syncVersion});assert.equal(r.status,200,JSON.stringify(r));check(r.body.incident.executiveApproval.state==='rejected','reject recorded');i=(await f.call('safety',{action:'pull'})).body.incidents[0];check(i.corrective.status==='submitted','rejection returns safety review');
await ok('safety',x=>{x.corrective.status='approved'});check(i.executiveApproval.round===2&&i.executiveApproval.history.length===1,'resubmission keeps old round');
const round=i.executiveApproval.round,sharedVersion=i._syncVersion;
for(const who of ['e4','e2','e5','e3']){
 r=await f.call(who,{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:sharedVersion,approvalRound:round});assert.equal(r.status,200,JSON.stringify(r));i=r.body.incident;
 check(i.status==='approved','parallel signatures never close');
 check((await requests()).filter(x=>x.user_id==='qa-executive').length===(who==='e3'?1:0),'president notified exactly at final parallel signature');
}
check(i.executiveApproval.stage==='president'&&!!i.executiveApproval.finalRequestedAt,'president final stage reached');
r=await f.call('e3',{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:sharedVersion,approvalRound:round});check(r.status===200&&r.body.duplicate,'parallel retry does not repeat final request');
check((await requests()).filter(x=>x.user_id==='qa-executive').length===1,'president notification idempotent');
r=await f.call('executive',{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:i._syncVersion,approvalRound:round-1});check(r.status===409,'old round cannot approve current final stage');
r=await f.call('executive',{action:'executive_decide',incidentId:i.id,decision:'reject',note:'최종 확인 보완',expectedVersion:i._syncVersion,approvalRound:round});assert.equal(r.status,200,JSON.stringify(r));i=r.body.incident;
check(i.executiveApproval.state==='rejected'&&i.executiveApproval.history.at(-1).signatures.length===4,'president rejection preserves all parallel signatures');
i=(await f.call('safety',{action:'pull'})).body.incidents[0];
await ok('safety',x=>{x.corrective.status='approved'});check(i.executiveApproval.round===3&&i.executiveApproval.stage==='parallel'&&i.executiveApproval.signatures.length===0,'resubmission restarts parallel approvals');
const thirdVersion=i._syncVersion;for(const who of ['e5','e3','e2','e4']){r=await f.call(who,{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:thirdVersion,approvalRound:3});assert.equal(r.status,200,JSON.stringify(r));i=r.body.incident;}
r=await f.call('executive',{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:i._syncVersion,approvalRound:3});assert.equal(r.status,200,JSON.stringify(r));i=r.body.incident;check(i.status==='closed','only president closes');
check(i.officialRecord.finalApproval.id==='qa-executive'&&i.officialRecord.finalApproval.method==='parallel_then_president','president final signer preserved');
check(/^ENL-ACC-\d{4}-00001$/.test(i.officialRecord.documentNumber),'server document number');
r=await f.call('executive',{action:'executive_decide',incidentId:i.id,decision:'approve',expectedVersion:0});check(r.status===200&&r.body.duplicate,'last approval retry idempotent');
check((await f.db.query('select count(*)::int n from enl_final_documents')).rows[0].n===1,'one immutable document');
for(const who of ['manager','executive','safety']){r=await f.call(who,{action:'final_document',incidentId:i.id});check(r.status===200&&r.body.archived&&r.body.documentNumber===i.officialRecord.documentNumber,who+' can print');}
r=await f.call('field',{action:'final_document',incidentId:i.id});check(r.status===403,'field cannot print HQ record');
await assert.rejects(()=>f.db.exec('delete from enl_final_documents'),/evidence_is_append_only/);checks++;
const ev=(await f.db.query("select user_id,kind from enl_push_events")).rows;
check(ev.filter(x=>x.user_id==='qa-manager').every(x=>['incident_new','incident_closed'].includes(x.kind)),'staff events only first and closed');
check(ev.filter(x=>x.user_id==='qa-executive').every(x=>['incident_new','executive_approval_requested'].includes(x.kind)),'executive first and request only');
check(ev.filter(x=>x.user_id==='qa-manager'&&x.kind==='incident_closed').length===1,'staff receives closure once');
check(ev.filter(x=>x.user_id==='qa-executive'&&x.kind==='executive_approval_requested').length===2,'one president request per completed parallel round');
const mails=(await f.db.query("select user_id,kind from enl_email_events")).rows;check(mails.some(x=>x.user_id==='qa-executive'&&x.kind==='executive_approval_requested'),'approval email queued');check(!mails.some(x=>x.user_id==='qa-executive'&&x.kind==='incident_closed'),'no closure email for executives');
console.log(JSON.stringify({passed:checks,failed:0}));await f.db.close();}
run().catch(e=>{console.error(e);process.exitCode=1});
