'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs'),{chromium,webkit}=require('playwright');
(async()=>{
 for(const [engine,width,label] of [[chromium,1280,'desktop'],[webkit,390,'iphone']]){
  const f=await fixture(),browser=await engine.launch({headless:true});
  let page;
  try{
   const first=await f.call('field',{action:'push',incidents:[{id:'qa-cause-ui',siteId:'qa-site',status:'reported',category:'property',summary:'가상 골프카트 사고',eventType:'접촉',occurredAt:'2026-10-12T01:00:00Z',reportDetails:{incidentHow:'카트가 시설물과 접촉함',repairCost:null},corrective:null,photos:[],_syncBaseVersion:0,_syncMutationId:'qa-cause-ui-create'}]});
   assert.equal(first.status,200);
   page=await browser.newPage({viewport:{width,height:900},hasTouch:width<700,isMobile:width<700});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://enl-cause-ui.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><div id="modalRoot"></div></body></html>'}));
   await page.goto('https://enl-cause-ui.test/');
   await page.exposeFunction('persistQaCause',async record=>{
    const next={...record,_syncBaseVersion:record._syncVersion,_syncMutationId:crypto.randomUUID()};
    const result=await f.call('safety',{action:'push',incidents:[next]});
    if(result.status!==200||!result.body.incidents?.length)throw Error(JSON.stringify(result));
    return result.body.incidents[0];
   });
   await page.evaluate(({incident})=>{
    window.qaUser={id:'qa-safety',role:'safety',name:'QA 안전',position:'안전관리자',passwordHash:'qa-proof'};
    window.data={incidents:[incident],sites:[{id:'qa-site',name:'QA 가상 사업장'}],users:[]};window.app=document.getElementById('app');
    window.currentUser=()=>qaUser;window.currentView='home';window.session={};window.qaAlerts=[];
    window.alert=t=>qaAlerts.push(String(t));window.confirm=()=>true;
    window.esc=t=>String(t??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
    window.siteById=id=>data.sites.find(x=>x.id===id);window.won=String;window.fmt=t=>String(t||'').slice(0,16);
    window.saveData=()=>{};window.renderShell=()=>{};window.nowISO=()=>new Date().toISOString();
    window.openModal=html=>document.getElementById('modalRoot').innerHTML='<div class="modal">'+html+'</div>';window.closeModal=()=>document.getElementById('modalRoot').innerHTML='';
    window.enlCommitOrNotify=async incident=>{const saved=await persistQaCause(incident);data.incidents[0]=saved;return true};
    window.enlOpenIncidentReview=id=>{openModal('<div class="modal-head"><h2>가상 사고 검토</h2></div><div class="modal-actions"></div>');document.querySelector('.modal').dataset.wf440Incident=id;};
   },{incident:first.body.incidents[0]});
   await page.addScriptTag({content:fs.readFileSync('incident-flow-v440.js','utf8')});
   await page.evaluate(()=>enlOpenIncidentReview('qa-cause-ui',true,currentUser()));
   await page.locator('#wf440EnvironmentCause').waitFor();
   assert.ok((await page.locator('[data-wf440-cause]').innerText()).includes('안전관리자 사고원인 분석'));
   assert.match(await page.locator('#wf440EnvironmentCause').inputValue(),/차량|동선/);
   assert.equal(await page.locator('#wf440CausePending').isChecked(),true,'automatic cause suggestions are unconfirmed');
   await page.locator('[data-wf440-final]').click();
   assert.ok((await page.locator('[data-wf440-cause-message]').innerText()).includes('원인을'));
   assert.equal((await f.call('safety',{action:'pull'})).body.incidents[0].status,'reported');
   await page.locator('#wf440EnvironmentCause').fill('가상 시설물과 통행구간 간섭 확인');
   await page.locator('#wf440BehaviorCause').fill('작업 전 주행동선 확인 누락 확인');
   await page.locator('#wf440CausePending').uncheck();
   await page.locator('[data-wf440-cause-save]').click();
   await page.waitForFunction(()=>data.incidents[0].reportDetails.causeAnalysisStatus==='analyzed');
   const saved=(await f.call('safety',{action:'pull'})).body.incidents[0];
   assert.equal(saved.status,'reported');assert.equal(saved.reportDetails.environmentCause,'가상 시설물과 통행구간 간섭 확인');
   assert.equal(saved.reportDetails.causeAnalyzedBy,'QA 안전');
   await page.evaluate(()=>enlOpenIncidentReview('qa-cause-ui',true,currentUser()));
   await page.locator('#wf440EnvironmentCause').waitFor();
   assert.equal(await page.locator('#wf440EnvironmentCause').inputValue(),'가상 시설물과 통행구간 간섭 확인');
   assert.equal(await page.locator('#wf440CausePending').isChecked(),false);
   await page.locator('[data-wf440-final]').click();
   await page.waitForFunction(()=>data.incidents[0].status==='approved');
   const approved=(await f.call('safety',{action:'pull'})).body.incidents[0];
   assert.equal(approved.status,'approved');assert.equal(approved.reportDetails.causeAnalysisStatus,'analyzed');
   assert.equal(approved.reportDetails.causeAnalyzedBy,'QA 안전');
   assert.deepEqual(errors,[]);
   console.log('PASS '+label+' safety cause UI: preapproval mandatory, separate cause save, restored values, final approval, persistent status');
  }finally{if(page)await page.close();await browser.close();await f.db.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});