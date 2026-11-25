'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),{policyFixture}=require('./policy-management.cjs'),{samplePdf}=require('./document-pdf-evidence.cjs');
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let i=0;i<400;i++){if(fn())return;await pause();}assert.fail('document UI did not settle');}
(async()=>{
 const f=await policyFixture();let dom;
 try{
  await f.db.exec(fs.readFileSync('supabase/migrations/20261125070000_document_pdf_evidence.sql','utf8'));
  const siteId='qa-site',documentId='ba9f3b38-ac6b-41e4-8622-992489085d2f';
  const {period}=(await f.call('field',{action:'platform_org_list'})).body;
  const chart={lead:'QA',supervisor:'QA',teams:Array.from({length:4},(_,i)=>({name:'QA '+i,regular:1,daily:0}))};
  for(const body of [{action:'platform_org_save',siteId,period,revision:0,chart},{action:'platform_org_appointment_save',siteId,documentId,folderRevision:1,revision:0,appointment:{department:'QA',name:'QA',position:'QA',date:'2026-01-01'}}])assert.equal((await f.call('field',body)).status,200);
  const pdf=samplePdf(),encoded=pdf.toString('base64'),alerts=[];
  async function mount(role,kind){
   dom?.window.close();dom=new JSDOM('<div id="app"><main data-workspace="organization"></main></div>',{runScripts:'outside-only',url:'https://isolated.test/'});
   const w=dom.window,d=w.document;w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.confirm=()=>true;w.alert=x=>alerts.push(x);
   w.HTMLCanvasElement.prototype.getContext=()=>({measureText:()=>({width:100})});
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
   const revoked=[];w.URL.createObjectURL=()=> 'blob:https://isolated.test/pdf';w.URL.revokeObjectURL=url=>revoked.push(url);
   w.DataTransfer=class{constructor(){this.items=[];this.items.add=file=>this.items.push({kind:'file',getAsFile:()=>file});this.types=['Files'];}get files(){return this.items.map(x=>x.getAsFile());}};
   for(const file of ['document-photo-viewer.js','attachment-drop-v4813.js','supervisor-training-model.js','supervisor-appointments.js','supervisor-certificates.js','organization.js','policy-management.js'])w.eval(fs.readFileSync(file,'utf8'));
   w.enlLoadDocumentPdf=async()=>({getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async()=>({getViewport:({scale})=>({width:300*scale,height:400*scale}),render:()=>({promise:Promise.resolve(),cancel(){}}),cleanup(){}})}),destroy:async()=>{}})});
   const calls=[];
   const api=async body=>{calls.push(body);const r=await f.call(role,{...body,includeTemplate:false});if(!r.body.ok)throw Error(r.body.message);return {...r.body,template:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"/>'};};
   const host=d.querySelector('main');let ui;
   if(['policy','objectives'].includes(kind)){
    host.dataset.workspace='policy';ui=w.enlPolicyManagement(host,{role},api,()=>true);ui.catalog({enabled:true,state:'live',canEnter:true});await ui.open();
    d.querySelector('[data-site-id="qa-site"]').click();d.querySelectorAll('.policy-document-card')[kind==='policy'?0:1].click();await until(()=>d.querySelector('.policy-poster'));
   }else{
    ui=w.enlOrganization(host,{role},api,()=>true);ui.catalog({enabled:true,state:'live',canEnter:true});await ui.open(siteId);
    d.querySelector('.org-document-card[data-doc="'+kind+'"]').click();
    await until(()=>kind==='certificate'?d.querySelector('.cert-overview'):d.querySelector('input[type=file]'));
   }
   const button=text=>[...d.querySelectorAll('button')].find(b=>b.textContent.replace(/^✓ /,'')===text);
   function drop(files){
    const input=d.querySelector('input[type=file]'),zone=d.querySelector('[data-attachment-input="'+input.id+'"]');
    let selection=[];Object.defineProperty(input,'files',{get:()=>selection,set:v=>selection=v,configurable:true});
    const dataTransfer=new w.DataTransfer();for(const spec of files){const file=new w.File([pdf],spec.name||'proof.pdf',{type:spec.type??'application/pdf'});file.arrayBuffer=async()=>Uint8Array.from(pdf).buffer;dataTransfer.items.add(file);}
    const event=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:dataTransfer});zone.dispatchEvent(event);assert.ok(event.defaultPrevented);
   }
   return {w,d,ui,calls,button,drop,revoked};
  }
  for(const kind of ['chart','appointment','certificate','policy','objectives']){
   const {w,d,calls,button,drop}=await mount('field',kind);
   if(kind==='certificate'){button('교육수료증 등록').click();const date=d.querySelector('[name=completedOn]');date.value='2026-11-01';date.dispatchEvent(new w.Event('input'));}
   const before=calls.length;drop([{name:'wrong.exe',type:'application/octet-stream'}]);await pause();assert.equal(calls.length,before,'unsupported file does not upload');
   drop([{},{}]);await pause();assert.equal(calls.length,before,'multiple files never silently discard pages');
   drop([{type:''}]);
   await until(()=>kind==='certificate'?d.querySelector('.cert-record'):d.querySelector('.enl-proof-pdf'));
   const writes=calls.filter(b=>b.photo===encoded);assert.equal(writes.length,1,kind+' uploads original PDF exactly once');
   if(kind==='certificate')button('첨부파일 및 저장 이력').click();
   await until(()=>d.querySelector('.enl-proof-pdf'));
   assert.ok(d.querySelector('.enl-submission-complete')||d.querySelector('.cert-record .cert-success'),kind+' shows submission check');
   if(kind!=='certificate'){
    const count=calls.length;drop([{}]);await pause();assert.equal(calls.length,count,'submitted input blocks duplicate drop');
   }
  }
  for(const kind of ['chart','appointment','certificate','policy','objectives']){
   const {w,d,button,revoked}=await mount('safety',kind);
   if(kind==='certificate'){button('첨부파일 및 저장 이력').click();await until(()=>d.querySelector('.enl-proof-pdf'));}
   const thumb=d.querySelector('.enl-proof-pdf'),approve=button(kind==='certificate'?'수료증 승인':'확인완료');assert.ok(thumb);assert.ok(approve.disabled);
   const check=d.querySelector('.org-evidence input,.cert-review input,.policy-check-photo input');
   thumb.click();const viewer=d.querySelector('.enl-pdf-viewer');assert.ok(viewer.open);assert.ok(viewer.querySelector('a[download]').download.endsWith('.pdf'));
   await until(()=>thumb.dataset.loaded==='true');
   assert.equal(viewer.querySelector('output').textContent,'1 / 2 페이지');
   [...viewer.querySelectorAll('button')].find(b=>b.textContent==='다음 페이지').click();await until(()=>viewer.querySelector('output').textContent==='2 / 2 페이지');
   assert.equal(check.checked,false,'opening PDF never silently approves');assert.ok(approve.disabled);
   check.checked=true;check.dispatchEvent(new w.Event('change'));assert.equal(approve.disabled,false,'explicit review enables approval');
   [...viewer.querySelectorAll('button')].find(b=>b.textContent==='닫기').click();assert.equal(revoked.length,1);assert.equal(d.activeElement,thumb);
   approve.click();await until(()=>kind==='certificate'?d.querySelector('.cert-record')?.textContent.includes('승인 완료'):d.querySelector('.enl-submission-complete')&&button('확인완료')?.textContent.startsWith('✓'));
  }
  for(const role of ['field','safety','manager','executive','worker']){
   const {w,d}=await mount(role,'chart');
   for(const state of ['empty','draft','rejected','pending','approved']){
    assert.equal(w.enlDocumentEvidence.complete(role,state),state==='approved'||role==='field'&&state==='pending');
   }
   assert.ok(d.querySelector('[data-doc=evaluation]').disabled,'unfinished document remains unavailable');
  }
  console.log('PASS real isolated PDF drop/save/reopen/approval in all five forms, automatic dated certificate submit, MIME-less PDF, single-file validation, disabled drops, role checks and PDF URL cleanup');
 }finally{dom?.window.close();await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
