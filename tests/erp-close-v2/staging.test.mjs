// Writes ONLY synthetic records to the fixed isolated staging endpoint.
// ERP_V2_TEST_CREDENTIALS is a local, untracked JSON path. Never log tokens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {tokens}=JSON.parse(fs.readFileSync(process.env.ERP_V2_TEST_CREDENTIALS,'utf8'));
const endpoint='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-erp-close-v2-staging';
const results=[];const ids=[];
async function api(role,body,status=200){
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(tokens[role]?{authorization:`Bearer ${tokens[role]}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const x=await r.json();assert.equal(r.status,status,JSON.stringify(x));return x;
}
async function check(name,fn){await fn();results.push({name,passed:true});console.log('PASS',name);}
async function seed(scenario='normal'){const x=await api('qa',{action:'seed',scenario});ids.push(x.incident.id);return x.incident.id;}
await check('missing and expired credentials rejected',async()=>{await api('missing',{action:'seed'},401);await api('expired',{action:'seed'},401);});
const id=await seed();
await check('roles, run isolation and real-provider blocker',async()=>{
  await api('field',{action:'request',id},403);await api('safety',{action:'decide',id,result:'approved'},403);
  await api('safety',{action:'seed'},403);await api('other',{action:'get',id},404);
  await api('safety',{action:'request',id,provider:'live'},503);
});
await check('manual close denied before and during ERP processing',async()=>{
  await api('safety',{action:'manual_close',id},409);
  await api('safety',{action:'request',id,result:'approved'});
  await api('safety',{action:'manual_close',id},409);await api('safety',{action:'update',id,status:'closed'},409);
});
await check('eight concurrent requests return a single durable job',async()=>{
  const r=await Promise.all(Array.from({length:8},()=>api('safety',{action:'request',id})));
  assert.equal(new Set(r.map(x=>x.job.id)).size,1);assert.ok(r.every(x=>x.deduplicated));
});
await check('concurrent worker claims submit once and retain pending state',async()=>{
  await Promise.all(Array.from({length:3},()=>api('qa',{action:'step',id})));
  const x=await api('safety',{action:'get',id});assert.equal(x.job.state,'pending');assert.equal(x.incident.status,'approved');assert.equal(x.job.attachmentCount,2);
});
await check('ambiguous 처리완료 result does not close incident',async()=>{
  await api('qa',{action:'decide',id,result:'처리완료'});const x=await api('qa',{action:'step',id});assert.equal(x.job.state,'status_unknown');assert.equal(x.incident.status,'approved');
});
await check('explicit provider approval closes atomically; repeated result is harmless',async()=>{
  await api('qa',{action:'decide',id,result:'approved'});const x=await api('qa',{action:'step',id});assert.equal(x.job.state,'approved');assert.equal(x.incident.status,'closed');assert.ok(x.incident.closedAt);
  const y=await api('qa',{action:'step',id});assert.equal(y.incident.closedAt,x.incident.closedAt);
  await api('qa',{action:'decide',id,result:'rejected'},409);
});
const rejected=await seed();
await check('rejection requests corrective supplementation, retains history and permits a new revision only after recheck',async()=>{
  const a=await api('safety',{action:'request',id:rejected});await api('qa',{action:'step',id:rejected});
  await api('qa',{action:'decide',id:rejected,result:'rejected'});
  const x=await api('qa',{action:'step',id:rejected});assert.equal(x.incident.status,'approved');assert.equal(x.incident.corrective.status,'rejected');
  assert.equal((await api('safety',{action:'request',id:rejected})).job.id,a.job.id);
  await api('qa',{action:'qa_recheck',id:rejected});const b=await api('safety',{action:'request',id:rejected});assert.notEqual(b.job.id,a.job.id);assert.notEqual(b.job.snapshotHash,a.job.snapshotHash);
  const log=await api('qa',{action:'audit',id:rejected});assert.ok(log.events.some(e=>e.event==='synthetic_evidence_rechecked'));
});
for(const scenario of ['timeout_after_submit','transient_before_submit','attachment_failure']){
  await check(`${scenario}: durable error and safe recovery without a second document`,async()=>{
    const caseId=await seed(scenario);await api('safety',{action:'request',id:caseId});
    const x=await api('qa',{action:'step',id:caseId});assert.ok(['submission_unknown','retry_wait'].includes(x.job.state));assert.equal(x.incident.status,'approved');
    const a=await api('qa',{action:'audit',id:caseId});assert.ok(a.events.some(e=>e.event==='integration_error'));
    await api('safety',{action:'retry',id:caseId});const y=await api('qa',{action:'step',id:caseId});assert.equal(y.job.state,'pending');assert.equal(y.job.attempts,2);
  });
}
fs.mkdirSync('tests/erp-close-v2/results',{recursive:true});
fs.writeFileSync('tests/erp-close-v2/results/staging.json',JSON.stringify({testedAt:new Date().toISOString(),endpoint,provider:'mock',liveERP:false,results,caseIds:ids},null,2)+'\n');
console.log(`STAGING ${results.length}/${results.length} scenarios passed`);
