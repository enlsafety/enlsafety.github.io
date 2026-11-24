'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),{certificateFixture,photo}=require('./supervisor-certificates.cjs');
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await pause()}assert.fail('UI did not settle');}
(async()=>{
 const f=await certificateFixture();let dom;
 try{
  for(const role of ['field','safety','manager','executive','worker']){
   dom?.window.close();dom=new JSDOM('<div id="app"><main class="org-main"></main></div>',{runScripts:'outside-only',url:'https://isolated.test/'});
   const w=dom.window,d=w.document;let busy=false,dirty=false,viewed=false;
   w.confirm=()=>true;w.enlPrepareDocumentPhoto=async()=>({base64:photo});w.enlOpenDocumentPhoto=()=>viewed=true;
   for(const name of ['supervisor-training-model.js','supervisor-certificates.js'])w.eval(fs.readFileSync(name,'utf8'));
   const api=async body=>{const r=await f.call(role,body);if(r.status!==200)throw Error(r.body.message);return r.body;};
   w.enlSupervisorCertificates(d.querySelector('main'),{role},api,{site_id:'qa-site'},{isCurrent:()=>true,busy:v=>busy=v,dirty:v=>dirty=v});
   await until(()=>d.querySelector('.cert-overview')&&!busy);
   assert.ok(d.querySelector('.cert-facts').textContent.includes('2024-12-01'));assert.ok(d.querySelector('.cert-facts').textContent.includes('2026-11-30'));
   const btn=text=>[...d.querySelectorAll('button')].find(b=>b.textContent===text);
   if(role==='field'){
    btn('교육수료증 등록').click();const date=d.querySelector('[name=completedOn]');assert.equal(date.value,'','no invented completion date');
    date.value='2026-11-01';date.dispatchEvent(new w.Event('input'));assert.ok(dirty);
    btn('수료증 저장').click();assert.ok(d.querySelector('.cert-form').textContent.includes('사진을 첨부'));
    const file=d.querySelector('input[type=file]');Object.defineProperty(file,'files',{value:[{name:'QA.jpg'}]});file.dispatchEvent(new w.Event('change'));
    await until(()=>!busy&&d.querySelector('.cert-photo img'));btn('수료증 저장').click();
    await until(()=>!busy&&!dirty&&d.querySelector('.cert-success'));assert.equal(d.querySelector('.cert-state').textContent,'수료증 등록');
    btn('사진 및 저장 이력').click();await until(()=>!busy&&d.querySelector('.cert-editor img'));
    d.querySelector('.enl-proof-thumb').click();assert.ok(viewed,'photo zoom');
    const edit=d.querySelector('[name=completedOn]');edit.value='2026-11-02';edit.dispatchEvent(new w.Event('input'));btn('수료증 수정 저장').click();
    await until(()=>!busy&&!dirty&&d.querySelector('.cert-record').textContent.includes('2026-11-02'));
    const periods=d.querySelector('[aria-label="교육기간 선택"]');periods.value=0;periods.dispatchEvent(new w.Event('change'));
    assert.equal(d.querySelector('.cert-state').textContent,'기한 경과 / 수료증 미등록');assert.equal(d.querySelector('.cert-record'),null,'future period certificate not counted as prior evidence');
   }else if(role==='safety'){
    assert.equal(btn('교육수료증 등록').disabled,false);btn('사진 및 저장 이력').click();await until(()=>!busy&&d.querySelector('.cert-editor img'));
    const approve=btn('수료증 승인'),review=d.querySelector('.cert-review input');assert.ok(approve.disabled);assert.ok(review.disabled);
    d.querySelector('.cert-photo img').dispatchEvent(new w.Event('load'));assert.equal(review.disabled,false);
    review.checked=true;review.dispatchEvent(new w.Event('change'));assert.equal(approve.disabled,false);
    approve.click();await until(()=>!busy&&d.querySelector('.cert-record').textContent.includes('승인 완료'));
    btn('사진 및 저장 이력').click();await until(()=>!busy&&d.querySelector('.cert-editor img'));assert.equal(btn('수료증 승인'),undefined);
    const versions=d.querySelector('[aria-label="수료증 저장 이력"]');assert.equal(versions.options.length,3);versions.value=1;versions.dispatchEvent(new w.Event('change'));
    await until(()=>!busy&&d.querySelector('[name=completedOn]')?.value==='2026-11-01');assert.ok(btn('수료증 수정 저장').disabled,'history is immutable');
   }else{
    assert.equal(btn('수료증 승인'),undefined);assert.ok(btn('교육수료증 등록').disabled);btn('사진 및 저장 이력').click();await until(()=>!busy&&d.querySelector('.cert-editor img'));
    assert.ok(btn('수료증 수정 저장').disabled);assert.ok(d.querySelector('[name=completedOn]').readOnly);assert.ok(d.querySelector('input[type=file]').disabled);
   }
  }
  if(process.env.CERTIFICATE_QA_FIXTURE){
   const result=(await f.call('safety',{action:'platform_org_certificate_list',siteId:'qa-site'})).body;
   fs.writeFileSync(process.env.CERTIFICATE_QA_FIXTURE,JSON.stringify(result));
  }
  console.log('PASS UI with real isolated API: date/photo registration, correction, annual selection, history, zoom, readonly roles and dirty/busy guards');
 }finally{dom?.window.close();await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
