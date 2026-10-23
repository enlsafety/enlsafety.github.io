'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();let checks=0;
 try{
  await f.db.transaction(async t=>t.exec(fs.readFileSync('tests/fixtures/evidence-storage-activate.sql','utf8')));
  let apiChecks=0;
  const source=fs.readFileSync('tests/final-live-staging.cjs','utf8').replace(/\}\)\(\)\.catch\(e=>\{console\.error\(e\);process\.exitCode=1\}\);?\s*$/, '})();');
  const mockFs={...fs,writeFileSync(file,body){if(file.endsWith('final-live-staging.json'))apiChecks=JSON.parse(body).passed;}};
  const ctx={require:n=>n==='node:fs'?mockFs:require(n),console:{log(){}},crypto,structuredClone,AbortSignal,Date,process,fetch:async(_url,options)=>{const r=await f.raw(JSON.parse(options.body));return {status:r.status,json:async()=>r.body}}};vm.createContext(ctx);
  await vm.runInContext(source,ctx);assert.ok(apiChecks>=26);checks+=apiChecks;
  const audit=(await f.db.query('select incident_id,action,editor_id,changed_at,before_payload,after_payload,before_hash,after_hash,private.enl_evidence_get(after_hash) restored from enl_incident_audit order by changed_at')).rows;
  assert.ok(audit.length>5);checks++;
  assert.ok(audit.every(x=>x.before_payload===null&&x.after_payload===null&&x.after_hash&&x.restored&&x.editor_id&&x.changed_at));checks++;
  assert.ok(audit.some(x=>x.action==='create'&&x.restored.id===x.incident_id));checks++;
  const i=(await f.call('safety',{action:'pull'})).body.incidents[0];
  const result=await f.call('executive',{action:'revision_list',incidentId:i.id});assert.equal(result.status,200);assert.ok(result.body.revisions.length);assert.ok(result.body.revisions[0].changes.some(x=>x.field==='summary'));checks+=3;
  const revisions=(await f.db.query('select *,private.enl_evidence_get(before_hash) before_full,private.enl_evidence_get(after_hash) after_full from enl_incident_revisions')).rows;
  assert.ok(revisions.every(r=>r.before_payload===null&&r.after_payload===null&&r.changes===null&&r.reason&&r.before_full.id===i.id&&r.after_full.status==='closed'));checks++;
  const approval=i.approvedAt,closure=i.closedAt,hashes=revisions.map(r=>r.after_hash);
  await f.db.transaction(async t=>t.exec(fs.readFileSync('tests/fixtures/evidence-storage-rollback.sql','utf8')));
  const restored=(await f.db.query('select after_payload from enl_incident_revisions')).rows;
  for(let n=0;n<restored.length;n++){assert.equal(restored[n].after_payload.approvedAt,approval);assert.equal(restored[n].after_payload.closedAt,closure);checks+=2;}
  const after=await f.call('manager',{action:'revision_list',incidentId:i.id});assert.equal(after.status,200);assert.deepEqual(after.body.revisions,result.body.revisions);checks+=2;
  fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/evidence-lifecycle.json',JSON.stringify({passed:checks,failed:0,environment:'actual Edge handler with active compaction in isolated PostgreSQL',auditRows:audit.length,revisionHashes:hashes},null,2));
  console.log(JSON.stringify({passed:checks,failed:0,suite:'evidence-lifecycle'}));
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
