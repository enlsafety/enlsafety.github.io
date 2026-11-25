'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),{policyFixture,photo}=require('./policy-management.cjs');
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await pause()}assert.fail('UI did not settle');}
(async()=>{
 const f=await policyFixture();let dom;
 const template='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"/>';
 try{
  let docId;
  for(const role of ['field','safety','manager','executive','worker']){
   dom?.window.close();dom=new JSDOM('<div id="app"><main data-workspace="organization"><div class="org-panel"><div class="org-main"></div></div></main></div>',{runScripts:'outside-only',url:'https://isolated.test/'});
   const w=dom.window,d=w.document;let busy=false,dirty=false;
   w.HTMLCanvasElement.prototype.getContext=()=>({measureText:t=>({width:t.length*11})});w.confirm=()=>true;w.print=()=>{};
   w.enlPrepareDocumentPhoto=async()=>({base64:photo});
   w.eval(fs.readFileSync('document-photo-viewer.js','utf8'));
   w.eval(fs.readFileSync('document-photo-viewer.js','utf8'));
   w.eval(fs.readFileSync('supervisor-appointments.js','utf8'));
   const api=async body=>{const r=await f.call(role,{...body,includeTemplate:false});if(r.status!==200)throw Error(r.body.message);return {...r.body,template};};
   w.enlSupervisorAppointment(d.querySelector('.org-main'),{role},api,{site_id:'qa-site'},{isCurrent:()=>true,busy:v=>busy=v,dirty:v=>dirty=v});
   await until(()=>d.querySelector('.appt-fields')&&!busy);
   const btn=text=>[...d.querySelectorAll('button')].find(b=>b.textContent.replace(/^✓ /,'')===text);
   const imageLoad=()=>d.querySelectorAll('img').forEach(img=>img.dispatchEvent(new w.Event('load')));
   imageLoad();
   if(role==='field'){
    assert.equal(d.querySelector('[name="department"]').value,'QA 가상 사업장');
    assert.equal(d.querySelector('[name="date"]').value,'','no invented appointment date');
    for(const [name,value] of Object.entries({position:'팀장',name:'검수 관리감독자',date:'2026-11-23'})){
     const input=d.querySelector('[name="'+name+'"]');input.value=value;input.dispatchEvent(new w.Event('input'));
    }
    assert.ok(dirty);assert.ok(btn('PDF 출력').disabled);btn('임명장 저장').click();
    await until(()=>!busy&&!dirty&&d.querySelector('.org-versions'));imageLoad();
    assert.ok(!btn('PDF 출력').disabled);btn('PDF 출력').click();assert.ok(d.querySelector('#org-print-page svg').textContent.includes('검수 관리감독자'));
    assert.equal(d.querySelector('#org-print-page input'),null);w.dispatchEvent(new w.Event('afterprint'));assert.equal(d.querySelector('#org-print-page'),null);
    const file=d.querySelector('input[type="file"]');Object.defineProperty(file,'files',{value:[{name:'QA.jpg'}]});file.dispatchEvent(new w.Event('change'));
    await until(()=>!busy&&d.querySelector('.org-evidence'));assert.ok(btn('임명장 저장').disabled);
    const r=(await f.call('field',{action:'platform_org_appointment_open',siteId:'qa-site'})).body;docId=r.document.document_id;assert.equal(r.document.event,'submit');
   }else if(role==='safety'){
    imageLoad();assert.ok(btn('확인완료').disabled);
    const review=d.querySelector('.org-evidence input');review.checked=true;review.dispatchEvent(new w.Event('change'));assert.ok(!btn('확인완료').disabled);btn('확인완료').click();
    await until(()=>!busy&&d.querySelector('.org-flow-guidance')?.textContent==='임명장 확인완료');
   }else{
    for(const text of ['새 관리감독자 임명장','임명장 저장','제출 완료','확인완료','임명장 수정'])assert.ok(btn(text).disabled,role+' cannot '+text);
    assert.ok(!btn('PDF 출력').disabled,role+' can print');
   }
  }
  if(process.env.APPOINTMENT_QA_FIXTURE){
   const result=(await f.call('safety',{action:'platform_org_appointment_open',siteId:'qa-site',documentId:docId})).body;
   fs.writeFileSync(process.env.APPOINTMENT_QA_FIXTURE,JSON.stringify(result));
  }
  console.log('PASS appointment UI: real isolated save/upload/approval, explicit date, print snapshot, readonly roles and permissions');
 }finally{dom?.window.close();await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
