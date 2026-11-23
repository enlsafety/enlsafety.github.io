'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {policyFixture,photo}=require('./policy-management.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(fn){for(let i=0;i<200;i++){if(fn())return;await tick()}assert.fail('document did not render')}
(async()=>{
 const f=await policyFixture();let dom;
 const template='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840"/>';
 try{
  const {period}= (await f.call('field',{action:'platform_org_list'})).body;
  const chart={lead:'검수 책임자',supervisor:'검수 감독자',teams:['코스관리','스프링쿨러','서무','기타'].map(name=>({name,regular:2,daily:1}))};
  for(const body of [{action:'platform_org_save',siteId:'qa-site',period,revision:0,chart},{action:'platform_org_confirm',siteId:'qa-site',period,revision:1,photo}])assert.equal((await f.call('field',body)).status,200);
  for(const kind of ['policy','objectives'])assert.equal((await f.call('field',{action:'platform_policy_submit',siteId:'qa-site',kind,revision:1,photo})).status,200);
  for(const role of ['field','safety','manager','executive','worker']){
   dom?.window.close();dom=new JSDOM('<div id="app"><main data-workspace="organization"></main></div>',{runScripts:'outside-only',url:'https://isolated.test/'});
   const w=dom.window,d=w.document,calls=[];
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
   w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
   w.HTMLElement.prototype.scrollTo=function(){};
   w.structuredClone=structuredClone;
   w.HTMLCanvasElement.prototype.getContext=()=>({measureText:text=>({width:text.length*10})});
   for(const file of ['document-photo-viewer.js','organization.js'])w.eval(fs.readFileSync(file,'utf8'));
   const api=async body=>{calls.push(body.action);const r=await f.call(role,{...body,includeTemplate:false});assert.equal(r.status,200);return {...r.body,template}};
   const ui=w.enlOrganization(d.querySelector('main'),{role},api,()=>true);
   ui.catalog({enabled:true,state:'live',canEnter:true});await ui.open('qa-site');
   d.querySelector('.org-document-card').click();await waitFor(()=>d.querySelector('.org-evidence .enl-proof-thumb'));
   const preview=d.querySelector('.enl-proof-thumb'),original=d.querySelector('.org-evidence img'),check=d.querySelector('.org-evidence input');
   original.dispatchEvent(new w.Event('load'));
   const before=d.querySelector('.org-main').innerHTML;
   preview.click();const viewer=d.querySelector('dialog.enl-photo-viewer'),image=viewer.querySelector('img');
   assert.ok(viewer.open);assert.equal(viewer.parentElement.classList.contains('org-panel'),true);
   assert.equal(d.querySelector('.org-main').innerHTML,before,'modal must not replace or enlarge the inline photo');
   assert.equal(image.src,original.src,'viewer uses stored original bytes');
   Object.defineProperty(image,'naturalWidth',{value:1400});Object.defineProperty(image,'naturalHeight',{value:2000});
   image.dispatchEvent(new w.Event('load'));assert.equal(image.style.objectFit,'contain');
   image.click();assert.equal(image.style.width,'1400px');
   const button=text=>[...viewer.querySelectorAll('button')].find(b=>b.textContent===text);
   button('확대').click();assert.equal(image.style.width,'1750px');
   image.click();assert.equal(image.style.objectFit,'contain');
   assert.equal(check.checked,false,'opening or zooming never marks evidence reviewed');
   button('닫기').click();assert.equal(d.querySelector('.enl-photo-viewer'),null);assert.equal(d.activeElement,preview);
   preview.click();ui.leave();assert.equal(d.querySelector('.enl-photo-viewer'),null);
   assert.ok(calls.every(x=>['platform_org_list','platform_org_open'].includes(x)),'viewer must not write records');
  }
  if(process.env.PHOTO_QA_FIXTURE){
   const responses={};
   for(const action of ['platform_catalog','platform_org_list','platform_org_open','platform_policy_list','platform_policy_open']){
    const args={action,siteId:'qa-site',kind:'policy',includeTemplate:false};
    responses[action]=(await f.call('safety',args)).body;
   }
   responses.platform_org_open.template=template;
   fs.writeFileSync(process.env.PHOTO_QA_FIXTURE,JSON.stringify(responses));
  }
  console.log('PASS document photos: all five roles, compact preview retained, separate modal, fit/zoom/original, focus restoration, navigation cleanup, no approval or data writes');
 }finally{dom?.window.close();await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
