import test from 'node:test';
import assert from 'node:assert/strict';
import {assertReady,packageIncident,applyProviderResult,enforceClosureWrite,liveProvider,unb64,sha256} from '../../erp-close-v2/core.mjs';
import {fixture,MOCK_LINE} from '../../erp-close-v2/fixtures.mjs';

test('initial approval, action approval, plan and evidence are prerequisites',()=>{
  assert.doesNotThrow(()=>assertReady(fixture('qa-unit'),'safety'));
  for(const change of [i=>i.status='reported',i=>i.approvedAt=null,i=>i.corrective.status='submitted',i=>i.corrective.planDetail='',i=>i.corrective.afterPhotos=[],i=>i.recordMode='historical_transfer']){
    const i=fixture('qa-unit');change(i);assert.throws(()=>assertReady(i,'safety'));
  }
  for(const role of ['worker','field','manager','executive','qa'])assert.throws(()=>assertReady(fixture('qa-unit'),role),/safety_only/);
});
test('template 4 package includes original facts, preventive plan and verified bytes',async()=>{
  const i=fixture('qa-unit'),p=await packageIncident(i,1,MOCK_LINE);
  assert.equal(p.templateId,4);assert.equal(p.attachments.length,2);
  assert.ok(p.body.includes(i.summary)&&p.body.includes(i.corrective.planDetail)&&p.body.includes(i.corrective.actionDetail));
  assert.equal(p.approvalLine[0].id,'qa-manager');
  for(const a of p.attachments){assert.equal(await sha256(unb64(a.base64)),a.sha256);assert.equal(unb64(a.base64)[0],0x50);}
  assert.equal((await packageIncident(i,1,MOCK_LINE)).snapshotHash,p.snapshotHash);
  i.corrective.actionDetail+=' changed';assert.notEqual((await packageIncident(i,1,MOCK_LINE)).snapshotHash,p.snapshotHash);
  await assert.rejects(packageIncident(i,1,[]),/approval_line_not_configured/);
});
test('result identity and explicit decision are mandatory; 처리완료 is not approval',async()=>{
  const i=fixture('qa-unit'),snapshot=await packageIncident(i,1,MOCK_LINE),j={state:'pending',client_reference:snapshot.clientReference,document_id:'MOCK-1',snapshot};
  const d={id:'MOCK-1',clientReference:snapshot.clientReference,snapshotHash:snapshot.snapshotHash,result:'approved',decidedAt:'2026-10-08T10:00:00Z'};
  assert.equal(applyProviderResult(i,j,d).incident.status,'closed');
  for(const result of [undefined,null,'처리완료','complete','pending'])assert.notEqual(applyProviderResult(i,j,{...d,result}).incident.status,'closed');
  for(const key of ['id','clientReference','snapshotHash'])assert.throws(()=>applyProviderResult(i,j,{...d,[key]:'wrong'}),/identity_mismatch/);
  const r=applyProviderResult(i,j,{...d,result:'rejected',reason:'보완'});assert.equal(r.incident.corrective.status,'rejected');assert.equal(r.incident.status,'approved');
  assert.throws(()=>applyProviderResult(i,j,{...d,decidedAt:null}),/decision_time_missing/);
  assert.equal(applyProviderResult(i,{...j,state:'approved'},{...d,result:'rejected'}).ignored,true);
});
test('direct finalization and edits remain blocked while result is unresolved',()=>{
  const i=fixture('qa-unit');
  for(const state of ['queued','submitting','submission_unknown','pending','status_unknown','retry_wait','error'])assert.throws(()=>enforceClosureWrite(i,{...i,status:'closed'},{state}),/erp_decision_pending/);
  assert.throws(()=>enforceClosureWrite(i,{...i,status:'closed'},null),/erp_approval_required/);
  assert.throws(()=>liveProvider(),/erp_integration_not_authorized/);
});
