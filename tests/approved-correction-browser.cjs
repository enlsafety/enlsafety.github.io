'use strict';
// Real incident-detail editor -> real edge handler -> isolated PostgreSQL, without operational writes.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./final-lifecycle.cjs'),{chromium,webkit}=require('playwright');
(async()=>{
 for(const profile of [{engine:chromium,width:1280,name:'desktop'},{engine:webkit,width:390,name:'iphone'}]){
  const f=await fixture(),browser=await profile.engine.launch({headless:true});let page,errors=[];
  try{
   let r=await f.call('field',{action:'push',incidents:[{id:'qa-approved-browser',siteId:'qa-site',category:'property',status:'reported',summary:'원본 가상 사고',eventType:'접촉',occurredAt:'2026-10-12T03:00:00Z',reportDetails:{place:'QA 동선',incidentHow:'원본 경위',repairCost:null,repairCostPending:true,recordedAt:'2026-10-12T03:30:00Z'},corrective:null,photos:[],_syncBaseVersion:0,_syncMutationId:'approved-browser-create'}]});
   assert.equal(r.status,200);const saved=r.body.incidents[0];
   const approved={...saved,status:'approved',approvedBy:'client',approvedAt:'2001-01-01',_syncBaseVersion:saved._syncVersion,_syncMutationId:crypto.randomUUID()};
   r=await f.call('safety',{action:'push',incidents:[approved]});assert.equal(r.status,200);const incident=r.body.incidents[0];
   page=await browser.newPage({viewport:{width:profile.width,height:880},isMobile:profile.width<600,hasTouch:profile.width<600});
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>d.accept());
   await page.route('https://enl-correction-qa.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="modalRoot"></div></body></html>'}));
   await page.goto('https://enl-correction-qa.test/');
   for(const path of ['style.css','v3.css','responsive-v432.css'])await page.addStyleTag({content:fs.readFileSync(path,'utf8')});
   await page.exposeFunction('qaCorrectionApi',async body=>{const result=await f.call('safety',body);if(result.status!==200)throw Error(result.body.message);return result.body;});
   await page.evaluate(({incident})=>{
    window.qaUser={id:'qa-safety',name:'QA 안전',role:'safety',passwordHash:'qa-proof'};
    window.data={incidents:[incident],sites:[{id:'qa-site',name:'QA 가상 사업장'}]};
    window.currentUser=()=>qaUser;window.renderShell=()=>{};window.alert=()=>{};
    window.esc=x=>String(x??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
    window.nowISO=()=>new Date().toISOString();window.siteName=()=> 'QA 가상 사업장';window.fmt=x=>String(x??'').slice(0,16);window.won=x=>String(x);
    window.categoryBadge=()=>'';window.priorityBadge=()=>'';window.legalBadge=()=>'';window.actionBadge=()=>'';window.badge=()=>'';window.statusBadge=()=>'';window.roleName=String;
    window.ENLContracts={badge:()=>'',incidentDetail:()=>'',site:()=>({})};
    window.enlIncidentOverviewHtml=i=>'<section>'+esc(i.summary)+'</section>';window.enlAttachmentGalleryHtml=()=>'';window.enlBindAttachmentOpen=()=>{};
    window.openModal=html=>{document.getElementById('modalRoot').innerHTML='<div class="modal-bg"><div class="modal">'+html+'</div></div>';document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));};
    window.closeModal=()=>{document.getElementById('modalRoot').innerHTML='';};
    window.enlIncidentApi=qaCorrectionApi;window.enlAcceptSavedIncident=record=>{data.incidents[0]=record;};
    window.enlIsHistoricalCorrectionSupported=()=>false;
    window.qaLegacyEditorUsed=false;window.enlEditIncidentInReportForm=()=>{qaLegacyEditorUsed=true;throw Error('Unexpected legacy edit path');};
   },{incident});
   await page.addScriptTag({content:fs.readFileSync('incidents-v410.js','utf8')});
   await page.addScriptTag({content:fs.readFileSync('closed-incident-reopen-v438.js','utf8')});
   await page.evaluate(()=>openIncidentModal('qa-approved-browser',true,currentUser()));
   await page.locator('#editInc').click();await page.locator('#closedCorrectionForm').waitFor();
   assert.equal(await page.evaluate(()=>qaLegacyEditorUsed),false);
   await page.locator('[data-correction-key="summary"]').fill('정정된 가상 사고');
   await page.locator('[data-correction-key="reportDetails.incidentHow"]').fill('수정한 사고경위');
   await page.locator('[data-correction-key="reportDetails.repairCost"]').fill('8000');
   await page.locator('#correctionReason').fill('승인 이후 잘못 기재된 내용 정정');
   await page.locator('#closedCorrectionForm button[type=submit]').click();
   await page.locator('#closedCorrectionForm').waitFor({state:'detached',timeout:12000});
   const updated=(await f.call('safety',{action:'pull'})).body.incidents[0];
   assert.equal(updated.status,'approved');assert.equal(updated.approvedAt,incident.approvedAt);assert.equal(updated.summary,'정정된 가상 사고');
   assert.equal(updated.reportDetails.incidentHow,'수정한 사고경위');assert.equal(updated.reportDetails.place,'QA 동선');assert.equal(updated.reportDetails.repairCost,8000);
   assert.equal(updated.officialRecord.revisionNumber,1);
   await page.evaluate(()=>openEditIncidentModal(data.incidents[0],currentUser()));
   assert.equal(await page.locator('[data-correction-key="summary"]').inputValue(),'정정된 가상 사고');
   assert.equal(await page.evaluate(()=>qaLegacyEditorUsed),false);
   assert.deepEqual(errors,[]);
   console.log('PASS approved correction UI -> backend save: '+profile.name+' '+profile.width+'px');
  }finally{if(page)await page.close();await browser.close();await f.db.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});