'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {policyFixture,photo}=require('./policy-management.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(fn){for(let i=0;i<200;i++){if(fn())return;await tick();}assert.fail('DOM did not reach expected state');}
(async()=>{
 const f=await policyFixture();let dom;
 try{
  async function open(role,kind='policy'){
   dom?.window.close();
   dom=new JSDOM('<!doctype html><html><body><main id="app"><button data-module="policy">방침 및 목표</button></main></body></html>',{runScripts:'outside-only',url:'https://isolated.test/'});
   const w=dom.window;w.confirm=()=>true;w.prompt=()=> '날짜 확인 필요';w.alert=msg=>{throw Error(msg)};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
   w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
   w.enlPrepareDocumentPhoto=async()=>({base64:photo});
   w.eval(fs.readFileSync('policy-management.js','utf8'));
   const api=async body=>{const r=await f.call(role,body);if(!r.body.ok)throw Error(r.body.message);return r.body;};
   const ui=w.enlPolicyManagement(w.document.getElementById('app'),{role},api,()=>true);
   ui.catalog({enabled:true,state:'live',canEnter:true});await ui.open();
   const d=w.document;
   d.querySelector('.policy-folder[data-site-id="qa-site"]').click();
   d.querySelectorAll('.policy-document-card')[kind==='policy'?0:1].click();
   await waitFor(()=>d.querySelector('.policy-poster'));
   return {w,d,ui};
  }
  const button=(d,text)=>[...d.querySelectorAll('button')].find(b=>b.textContent===text);
  for(const role of ['field','manager','executive','worker']){
   const {w,d}=await open(role);
   assert.equal(!!button(d,'전체 수정'),false);
   assert.equal(button(d,'게시 사진 제출').disabled,role!=='field');
   assert.equal(button(d,'확인완료').disabled,true);
   assert.equal(d.querySelectorAll('.policy-flow-steps [data-action-state=required]').length,role==='field'?2:0);
   assert.equal(d.querySelectorAll('.policy-rail .policy-document-dot').length,role==='field'?3:0);
   assert.equal(d.querySelector('.policy-document-layout').firstChild.className,'policy-review-panel');
   w.print=()=>{assert.ok(d.querySelector('#enl-policy-print-page svg'));const ids=[...d.querySelectorAll('svg filter')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,'screen and print filter IDs must be distinct');w.dispatchEvent(new w.Event('afterprint'));};
   button(d,'PDF 출력').click();assert.equal(d.querySelector('#enl-policy-print-page'),null);
  }
  let state=await open('field');
  const input=state.d.querySelector('input[type=file]');
  Object.defineProperty(input,'files',{value:[new state.w.File(['qa'],'evidence.jpg',{type:'image/jpeg'})]});
  input.dispatchEvent(new state.w.Event('change'));
  await waitFor(()=>state.d.querySelector('.policy-proof-photo'));
  assert.equal(button(state.d,'게시 사진 제출').disabled,true);
  assert.equal(state.d.querySelectorAll('.policy-flow-steps [data-action-state=required]').length,0);
  // Opening original photos must remain read-only for every permitted role.
  await f.call('field',{action:'platform_policy_submit',siteId:'qa-site',kind:'objectives',revision:1,photo});
  for(const role of ['field','safety','manager','executive','worker'])for(const kind of ['policy','objectives']){
   const {w,d,ui}=await open(role,kind),trigger=d.querySelector('.policy-proof-open');
   assert.ok(trigger,role+' can view '+kind+' evidence');trigger.click();
   const viewer=d.querySelector('.policy-photo-viewer'),image=viewer.querySelector('img');
   assert.equal(image.src,d.querySelector('.policy-proof-photo').src,'use the stored original without resampling');
   Object.defineProperty(image,'naturalWidth',{value:2400});image.dispatchEvent(new w.Event('load'));
   assert.equal(image.style.width,'2400px');
   button(viewer,'확대').click();assert.equal(image.style.width,'3000px');
   button(viewer,'축소').click();assert.equal(image.style.width,'2400px');
   button(viewer,'화면 맞춤').click();assert.equal(image.style.objectFit,'contain');
   button(viewer,'원본 크기').click();assert.equal(image.style.width,'2400px');
   assert.equal(button(d,'확인완료').disabled,true,'viewing never approves evidence');
   button(viewer,'닫기').click();assert.equal(d.querySelector('.policy-photo-viewer'),null);
   assert.equal(d.activeElement,trigger);trigger.click();ui.leave();
   assert.equal(d.querySelector('.policy-photo-viewer'),null,'leaving removes private photo');
  }
  state=await open('safety');assert.ok(button(state.d,'전체 수정'));
  assert.ok(button(state.d,'확인완료').disabled);
  assert.equal(state.d.querySelector('.policy-flow-steps [data-action-state=required]').dataset.step,'3');
  const check=state.d.querySelector('.policy-check-photo input');check.checked=true;check.dispatchEvent(new state.w.Event('change'));
  button(state.d,'확인완료').click();
  await waitFor(()=>state.d.querySelector('.policy-document-heading').textContent.includes('최신화 완료'));
  assert.equal(button(state.d,'확인완료').disabled,true);
  assert.equal(state.d.querySelectorAll('.policy-flow-steps [data-action-state=required]').length,0);
  assert.equal(state.d.querySelectorAll('.policy-rail-child')[0].querySelector('.policy-document-dot'),null,'approved policy clears its dot');
  assert.ok(state.d.querySelectorAll('.policy-rail-child')[1].querySelector('.policy-document-dot'),'objectives remain incomplete');
  button(state.d,'전체 수정').click();
  let form=state.d.querySelector('dialog form');form.elements.year.value='2027';form.elements.date.value='2027-01-01';
  form.dispatchEvent(new state.w.Event('submit',{cancelable:true}));
  await waitFor(()=>!state.d.querySelector('dialog')&&state.d.querySelector('.policy-poster')?.textContent.includes('2027. 01. 01'));
  assert.ok(!state.d.querySelector('.policy-proof-photo'));
  for(const kind of ['policy','objectives']){
   state=await open('safety',kind);
   assert.ok(state.d.querySelector('.policy-poster').textContent.includes('2027'));
   const images=[...state.d.querySelectorAll('.policy-poster svg image')];assert.equal(images.length,2);
   for(const im of images)assert.ok(im.getAttribute('href').startsWith('data:image/png;base64,'));
   if(process.env.POLICY_QA_OUTPUT){fs.mkdirSync(process.env.POLICY_QA_OUTPUT,{recursive:true});fs.writeFileSync(process.env.POLICY_QA_OUTPUT+'/'+kind+'.svg',state.d.querySelector('.policy-poster').innerHTML);}
  }
  console.log('PASS policy DOM: role controls, print cleanup, field upload, approval checkbox, global dates and original poster artwork');
 }finally{dom?.window.close();await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
