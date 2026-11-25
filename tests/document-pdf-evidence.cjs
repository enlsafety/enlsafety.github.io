'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {policyFixture,photo}=require('./policy-management.cjs');
function samplePdf(padding=0){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
 '<< /Length 43 >>\nstream\nBT /F1 18 Tf 30 340 Td (QA page one) Tj ET\nendstream',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
 '<< /Length 43 >>\nstream\nBT /F1 18 Tf 30 340 Td (QA page two) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let text='%PDF-1.7\n'+(padding?'%'+ 'x'.repeat(padding)+'\n':'');const offsets=[0];
 objects.forEach((object,i)=>{const stream=object.match(/stream\n([\s\S]*?)endstream/);if(stream)object=object.replace('/Length 43','/Length '+Buffer.byteLength(stream[1]));offsets.push(Buffer.byteLength(text));text+=(i+1)+' 0 obj\n'+object+'\nendobj\n';});
 const xref=Buffer.byteLength(text);text+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))text+=String(offset).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(text+'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
}
module.exports={samplePdf};
if(require.main===module)(async()=>{
 const {validDocumentEvidence}=await import('../edge-functions/enl-incident-sync-v411/document-evidence.ts');
 const pdf=samplePdf().toString('base64');assert.equal(validDocumentEvidence(pdf),false);assert.ok(validDocumentEvidence(photo));
 const f=await policyFixture();
 try{
  const siteId='qa-site',folderRevision=1;
  const call=async(role,action,p={},status=200)=>{const r=await f.call(role,{action,siteId,folderRevision,...p});assert.equal(r.status,status,action+': '+JSON.stringify(r.body));return r.body;};
  const {period}=await call('field','platform_org_list');
  const chart={lead:'QA',supervisor:'QA',teams:Array.from({length:4},(_,i)=>({name:'QA '+i,regular:1,daily:0}))};
  await call('field','platform_org_save',{period,revision:0,chart});
  await call('field','platform_org_confirm',{period,revision:1,photo:pdf},400);
  await call('field','platform_org_confirm',{period,revision:1,photo});
  assert.match((await call('field','platform_org_open')).document.photo,/^data:image\/jpeg/);
  const appointmentId='e2791b68-1395-42aa-8cc4-afc7a4cf4fe0',certificateId='a8e24ad3-d42f-47c3-9fb4-5110860ced67';
  await call('field','platform_org_appointment_save',{documentId:appointmentId,revision:0,appointment:{department:'QA',name:'QA',position:'QA',date:'2024-12-01'}});
  await call('field','platform_org_appointment_submit',{documentId:appointmentId,revision:1,photo:pdf},400);
  await call('field','platform_org_appointment_submit',{documentId:appointmentId,revision:1,photo});
  const base={certificateId,appointmentId,appointmentRevision:2,revision:0,completedOn:'2026-11-01'};
  for(const photos of [[pdf],[photo,pdf],[],Array(21).fill(photo)])await call('field','platform_org_certificate_save',{...base,photos},400);
  await call('other','platform_org_certificate_save',{...base,photos:[photo,photo]},403);
  await call('field','platform_org_certificate_save',{...base,photos:[photo,photo]});
  let opened=await call('safety','platform_org_certificate_open',{certificateId});
  assert.equal(opened.document.photos.length,2);assert.ok(opened.document.photos.every(p=>p==='data:image/jpeg;base64,'+photo));assert.equal(opened.document.timing_warning.deadline,'2025-11-30');
  assert.ok((await call('field','platform_org_certificate_list')).records[0].timing_warning);
  await call('field','platform_org_certificate_approve',{...base,revision:1,reviewedPhotoRevision:1},403);
  await call('safety','platform_org_certificate_approve',{...base,revision:1,reviewedPhotoRevision:0},400);
  await call('safety','platform_org_certificate_approve',{...base,revision:1,reviewedPhotoRevision:1});
  opened=await call('field','platform_org_certificate_open',{certificateId});assert.equal(opened.document.photos.length,2);assert.equal(opened.document.timing_warning,null);
  assert.equal((await call('field','platform_org_certificate_list')).records[0].timing_warning,null);
  assert.ok((await call('field','platform_org_certificate_open',{certificateId,revision:1})).document.timing_warning,'audit history retains warning');
  await call('field','platform_org_certificate_save',{...base,revision:2,completedOn:'2026-11-02'});
  opened=await call('field','platform_org_certificate_open',{certificateId});assert.equal(opened.document.photos.length,2);assert.ok(opened.document.timing_warning);assert.equal(opened.document.event,'save');
  await call('field','platform_org_certificate_save',{...base,revision:3,photos:Array(20).fill(photo)});
  assert.equal((await call('field','platform_org_certificate_open',{certificateId})).document.photos.length,20);
  assert.equal((await call('field','platform_org_certificate_open',{certificateId,revision:1})).document.photos.length,2,'older bundle unchanged');
  for(const kind of ['policy','objectives']){
   const data=await call('field','platform_policy_open',{kind});
   await call('field','platform_policy_submit',{kind,revision:data.settings.revision,photo:pdf},400);
   await call('field','platform_policy_submit',{kind,revision:data.settings.revision,photo});
   assert.match((await call('field','platform_policy_open',{kind})).proof.photo,/^data:image\/jpeg/);
  }
  require('../supervisor-training-model.js');const M=globalThis.enlSupervisorTrainingModel,a={name:'QA',date:'2024-12-01'};
  assert.equal(M.timingWarning(a,[],'2025-11-30'),null);assert.equal(M.timingWarning(a,[],'2025-12-01').deadline,'2025-11-30');
  assert.equal(M.timingWarning(a,[{appointment:a,completed_on:'2025-11-01'}],'2026-11-01'),null);
  assert.equal(M.timingWarning(a,[{appointment:a,completed_on:'2025-11-01'}],'2026-12-01').deadline,'2026-11-30');
  assert.equal(M.timingWarning({name:'QA',date:'2024-02-29'},[],'2025-02-28'),null);
  console.log('PASS photo-only API guards, 1-20 photo bundles, immutable history, approval warning dismissal, resubmission and anniversary boundaries');
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
