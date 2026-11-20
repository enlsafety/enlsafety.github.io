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
   assert.equal(!!button(d,'최신화 및 게시 사진 제출'),role==='field');
   assert.equal(!!button(d,'확인완료'),false);
   w.print=()=>{assert.ok(d.querySelector('#enl-policy-print-page svg'));const ids=[...d.querySelectorAll('svg filter')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,'screen and print filter IDs must be distinct');w.dispatchEvent(new w.Event('afterprint'));};
   button(d,'PDF 출력').click();assert.equal(d.querySelector('#enl-policy-print-page'),null);
  }
  let state=await open('field');
  const input=state.d.querySelector('input[type=file]');
  Object.defineProperty(input,'files',{value:[new state.w.File(['qa'],'evidence.jpg',{type:'image/jpeg'})]});
  input.dispatchEvent(new state.w.Event('change'));
  await waitFor(()=>state.d.querySelector('.policy-proof-photo'));
  assert.equal(!!button(state.d,'최신화 및 게시 사진 제출'),false);
  state=await open('safety');assert.ok(button(state.d,'전체 수정'));
  assert.ok(button(state.d,'확인완료').disabled);
  const check=state.d.querySelector('.policy-check-photo input');check.checked=true;check.dispatchEvent(new state.w.Event('change'));
  button(state.d,'확인완료').click();
  await waitFor(()=>!button(state.d,'확인완료')&&state.d.querySelector('.policy-review-panel .is-approved'));
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
