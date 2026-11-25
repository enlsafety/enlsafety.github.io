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
 const {validDocumentEvidence,MAX_DOCUMENT_PDF_BYTES}=await import('../edge-functions/enl-incident-sync-v411/document-evidence.ts');
 const bytes=samplePdf(400000),pdf=bytes.toString('base64');
 assert.ok(validDocumentEvidence(pdf));assert.ok(validDocumentEvidence(photo));
 for(const value of ['bad',Buffer.from('<html>%PDF-1.7</html>').toString('base64'),Buffer.from('%PDF-1.7\ntruncated').toString('base64'),samplePdf(MAX_DOCUMENT_PDF_BYTES).toString('base64')])assert.equal(validDocumentEvidence(value),false);
 const f=await policyFixture();
 try{
  await f.db.exec(fs.readFileSync('supabase/migrations/20261125070000_document_pdf_evidence.sql','utf8'));
  const siteId='qa-site',folderRevision=1;
  const call=async(role,action,p={},status=200)=>{const r=await f.call(role,{action,siteId,folderRevision,...p});assert.equal(r.status,status,action+': '+JSON.stringify(r.body));return r.body;};
  const list=()=>call('field','platform_org_list');
  const {period}=await list();
  const chart={lead:'QA lead',supervisor:'QA supervisor',teams:Array.from({length:4},(_,i)=>({name:'QA '+i,regular:1,daily:0}))};
  await call('field','platform_org_save',{period,revision:0,chart});
  await call('field','platform_org_confirm',{period,revision:1,photo:'bad'},400);
  await call('other','platform_org_confirm',{period,revision:1,photo:pdf},403);
  await call('field','platform_org_confirm',{period,revision:1,photo:pdf});
  let opened=await call('field','platform_org_open');assert.equal(opened.document.photo,'data:application/pdf;base64,'+pdf);
  await call('field','platform_org_approve',{period,revision:2,reviewedPhotoRevision:2},403);
  await call('safety','platform_org_approve',{period,revision:2,reviewedPhotoRevision:1},409);
  await call('safety','platform_org_approve',{period,revision:2,reviewedPhotoRevision:2});
  assert.equal((await call('safety','platform_org_open')).document.photo,opened.document.photo);
  await call('safety','platform_org_reopen',{period,revision:3});
  assert.equal((await list()).sites[0].documentStates.chart,'draft');
  await call('field','platform_org_confirm',{period,revision:4,photo:pdf});
  const documentId='e2791b68-1395-42aa-8cc4-afc7a4cf4fe0';
  const appointment={department:'QA site',name:'QA supervisor',position:'QA lead',date:'2026-01-01'};
  await call('field','platform_org_appointment_save',{documentId,revision:0,appointment});
  assert.equal((await list()).sites[0].documentStates.appointment,'draft');
  await call('field','platform_org_appointment_submit',{documentId,revision:1,photo:pdf});
  opened=await call('field','platform_org_appointment_open',{documentId});assert.equal(opened.document.photo,'data:application/pdf;base64,'+pdf);
  await call('safety','platform_org_appointment_approve',{documentId,revision:2,reviewedPhotoRevision:2});
  assert.equal((await call('field','platform_org_appointment_open',{documentId,revision:2})).document.photo,opened.document.photo);
  const certificateId='a8e24ad3-d42f-47c3-9fb4-5110860ced67';
  const cert={certificateId,appointmentId:documentId,appointmentRevision:3,revision:0,completedOn:'2026-11-01',photo:pdf};
  for(const role of ['other','worker','manager','executive'])await call(role,'platform_org_certificate_save',cert,403);
  await call('field','platform_org_certificate_save',cert);
  assert.equal((await list()).sites[0].documentStates.certificate,'pending');
  opened=await call('field','platform_org_certificate_open',{certificateId});assert.equal(opened.document.photo,'data:application/pdf;base64,'+pdf);
  await call('safety','platform_org_certificate_approve',{...cert,revision:1,reviewedPhotoRevision:1});
  assert.equal((await list()).sites[0].documentStates.certificate,'approved');
  await call('field','platform_org_certificate_save',{...cert,photo:undefined,revision:2,completedOn:'2026-11-02'});
  assert.equal((await call('field','platform_org_certificate_open',{certificateId})).document.photo,opened.document.photo);
  assert.equal((await list()).sites[0].documentStates.certificate,'pending');
  for(const kind of ['policy','objectives']){
   await call('field','platform_policy_submit',{kind,revision:1,photo:pdf});
   const proof=(await call('field','platform_policy_open',{kind})).proof;
   assert.equal(proof.photo,'data:application/pdf;base64,'+pdf);
   await call('field','platform_policy_decide',{kind,revision:1,evidenceId:proof.id,decision:'approved'},403);
   await call('safety','platform_policy_decide',{kind,revision:1,evidenceId:proof.id,decision:'rejected',note:'QA resubmit'});
   await call('field','platform_policy_submit',{kind,revision:1,photo:pdf});
   const replacement=(await call('field','platform_policy_open',{kind})).proof;
   assert.notEqual(replacement.id,proof.id);assert.equal(replacement.photo,proof.photo);
  }
  const states=(await list()).sites[0].documentStates;assert.equal(states.chart,'pending');assert.equal(states.appointment,'approved');assert.equal(states.certificate,'pending');
  for(const role of ['field','safety','worker','manager','executive'])assert.equal((await call(role,'platform_org_open')).document.photo,'data:application/pdf;base64,'+pdf);
  const rights=(await f.db.query("select bool_and(relrowsecurity) as rls from pg_class where oid in ('private.enl_org_charts'::regclass,'private.enl_supervisor_appointments'::regclass,'private.enl_supervisor_certificates'::regclass,'private.enl_policy_evidence'::regclass)")).rows[0];assert.ok(rights.rls);
  fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/evidence-two-pages.pdf',samplePdf());
  const fixture={};
  for(const action of ['platform_catalog','platform_org_list','platform_org_open','platform_org_appointment_open','platform_org_certificate_list','platform_org_certificate_open','platform_policy_list'])fixture[action]=await call('field',action,{documentId,certificateId});
  for(const kind of ['policy','objectives'])fixture['platform_policy_open_'+kind]=await call('field','platform_policy_open',{kind});
  fs.writeFileSync('qa-output/document-evidence-fixture.json',JSON.stringify(fixture));
  console.log('PASS original multi-page PDF bytes: all five submission types, >350KB, size/type guards, version history, roles, stale reviews, resubmission, state reset and RLS');
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
