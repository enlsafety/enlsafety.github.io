'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),{policyFixture,photo}=require('./policy-management.cjs'),{samplePdf}=require('./document-pdf-evidence.cjs');
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let i=0;i<400;i++){if(fn())return;await pause();}assert.fail('document UI did not settle');}
(async()=>{
 const f=await policyFixture();let dom;
 try{
  const siteId='qa-site',documentId='ba9f3b38-ac6b-41e4-8622-992489085d2f';
  const {period}=(await f.call('field',{action:'platform_org_list'})).body;
  const chart={lead:'QA',supervisor:'QA',teams:Array.from({length:4},(_,i)=>({name:'QA '+i,regular:1,daily:0}))};
  for(const body of [{action:'platform_org_save',siteId,period,revision:0,chart},{action:'platform_org_appointment_save',siteId,documentId,folderRevision:1,revision:0,appointment:{department:'QA',name:'QA',position:'QA',date:'2026-01-01'}}])assert.equal((await f.call('field',body)).status,200);
  const pdf=samplePdf(),encoded=photo,alerts=[];
  async function mount(role,kind){
   dom?.window.close();dom=new JSDOM('<div id="app"><main data-workspace="organization"></main></div>',{runScripts:'outside-only',url:'https://isolated.test/'});
   const w=dom.window,d=w.document;w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.confirm=()=>true;w.alert=x=>alerts.push(x);
   w.HTMLCanvasElement.prototype.getContext=()=>({measureText:()=>({width:100})});
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
   const revoked=[];w.URL.createObjectURL=()=> 'blob:https://isolated.test/pdf';w.URL.revokeObjectURL=url=>revoked.push(url);
   w.DataTransfer=class{constructor(){this.items=[];this.items.add=file=>this.items.push({kind:'file',getAsFile:()=>file});this.types=['Files'];}get files(){return this.items.map(x=>x.getAsFile());}};
   for(const file of ['document-photo-viewer.js','attachment-drop-v4813.js','supervisor-training-model.js','supervisor-appointments.js','supervisor-certificates.js','organization.js','policy-management.js'])w.eval(fs.readFileSync(file,'utf8'));
   w.enlPrepareDocumentPhoto=async()=>({base64:photo,mime:'image/jpeg'});
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
    const dataTransfer=new w.DataTransfer();for(const spec of files){const file=new w.File([photo],spec.name||'proof.jpg',{type:spec.type??'image/jpeg'});file.arrayBuffer=async()=>Uint8Array.from(pdf).buffer;dataTransfer.items.add(file);}
    const event=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:dataTransfer});zone.dispatchEvent(event);assert.ok(event.defaultPrevented);
   }
   return {w,d,ui,calls,button,drop,revoked};
  }
  for(const kind of ['chart','appointment','certificate','policy','objectives']){
   const {w,d,calls,button,drop}=await mount('field',kind);
   if(kind==='certificate'){button('교육수료증 등록').click();const date=d.querySelector('[name=completedOn]');date.value='2026-11-01';date.dispatchEvent(new w.Event('input'));assert.equal(d.querySelector('[aria-label="교육기간 선택"]'),null);}
   const before=calls.length;drop([{name:'proof.pdf',type:'application/pdf'}]);await pause();assert.equal(calls.length,before,'PDF cannot be submitted');
   if(kind!=='certificate'){drop([{},{}]);await pause();assert.equal(calls.length,before,'single-photo slots reject a batch');}
   drop(kind==='certificate'?[{},{}]:[{}]);
   if(kind==='certificate'){await until(()=>d.querySelectorAll('.cert-photo img').length===2);button('수료증 저장').click();await until(()=>d.querySelector('.cert-record'));button('첨부파일 및 저장 이력').click();}
   await until(()=>d.querySelector('.enl-proof-thumb'));
   assert.equal(d.querySelector('.enl-submission-complete'),null,'submission alone does not turn approval green');
   assert.ok(d.querySelector('.org-folder .org-state.progress,.policy-folder .policy-document-dot.is-progress'),kind+' pending site uses orange progress');
   assert.ok(calls.some(b=>b.photo===photo||b.photos?.length===2),kind+' submits photos');
  }
  for(const kind of ['chart','appointment','certificate','policy','objectives']){
   const {w,d,button}=await mount('safety',kind);
   if(kind==='certificate'){button('첨부파일 및 저장 이력').click();await until(()=>d.querySelector('.cert-editor img'));}
   const approve=button(kind==='certificate'?'수료증 승인':'확인완료'),check=d.querySelector('.org-evidence input,.cert-review input,.policy-check-photo input');assert.ok(approve.disabled);
   const images=[...d.querySelectorAll('.enl-proof-thumb img')];assert.ok(images.length);
   images[0].dispatchEvent(new w.Event('load'));
   if(images.length>1)assert.ok(check.disabled,'all bundled photos must load before review');
   images.slice(1).forEach(img=>img.dispatchEvent(new w.Event('load')));
   assert.equal(check.disabled,false);assert.equal(check.checked,false);check.checked=true;check.dispatchEvent(new w.Event('change'));assert.equal(approve.disabled,false);
   approve.click();await until(()=>kind==='certificate'?d.querySelector('.cert-record')?.textContent.includes('반기 확인완료'):button('확인완료')?.textContent.startsWith('✓'));
  }
  const {w,d}=await mount('field','chart'),E=w.enlDocumentEvidence;
  assert.equal(E.aggregate(['empty','empty','empty','unimplemented']),'empty');
  for(const states of [['draft','empty'],['approved','empty'],['approved','pending']])assert.equal(E.aggregate(states),'progress');
  assert.equal(E.aggregate(['approved','approved','approved','unimplemented']),'approved');
  assert.equal(E.complete('field','pending'),false);
  assert.ok(d.querySelector('.org-folder .org-state.approved'),'all implemented organization documents approved turns folder green');
  assert.match(d.querySelector('.org-folder .org-state').textContent,/반기 확인완료/);
  assert.ok(d.querySelector('[data-doc=evaluation]').disabled);
  console.log('PASS real DOM/API photo drops across five forms, multi-photo review, PDF rejection, strict approval checks and excluded unimplemented items');
 }finally{dom?.window.close();await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
