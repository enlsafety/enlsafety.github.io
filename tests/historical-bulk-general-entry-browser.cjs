'use strict';
const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
async function run(engine){
 const executablePath=process.env[engine===webkit?'PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH':'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
 const browser=await engine.launch(executablePath?{executablePath}:{}),page=await browser.newPage({viewport:{width:engine===webkit?390:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"><div id="view"></div><div id="modalRoot"></div></div></body></html>');
  await page.evaluate(()=>{
   window.__u={id:'qa-safety',name:'격리 안전관리자',role:'safety'};window.currentUser=()=>window.__u;window.currentView='incidents';window.__opened=[];window.__alerts=[];window.__saves=0;
   window.data={users:[],sites:[],incidents:[{id:'qa-bulk',siteId:'qa-site',category:'person',status:'closed',eventType:'넘어짐',occurredAt:'2025-01-01',occurredDate:'2025-01-01',occurrenceTimeKnown:false,summary:'격리 검증 사고',corrective:{status:'approved',planDetail:'격리 계획'},reportDetails:{place:'격리 장소',injuryDetail:'격리 부상',workAction:'격리 작업'},historicalOrigin:{batchId:'qa-batch',candidateId:'qa-candidate'},externalInitialApproval:{state:'verified',documentNo:'QA-ERP',approvalDate:'2025-01-02'},photos:[]}]};
   window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.fmt=v=>'FORMAT('+String(v)+')';window.siteById=()=>({name:'격리 사업장'});window.nowISO=()=>new Date().toISOString();window.saveData=()=>{window.__saves++};window.renderShell=()=>{};window.alert=x=>window.__alerts.push(x);window.confirm=()=>{throw Error('Unexpected destructive confirmation')};window.fetch=()=>{throw Error('Unexpected network access')};
   window.openModal=html=>document.getElementById('modalRoot').innerHTML='<div class="modal">'+html+'</div>';window.closeModal=()=>document.getElementById('modalRoot').innerHTML='';
   window.enlOpenHistoricalCandidate454=(batch,candidate)=>{window.__opened.push([batch,candidate]);window.closeModal()};
  });
  for(const file of ['incidents-v410.js','report-v410.js','closed-incident-reopen-v438.js','official-records-v439.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
  await page.evaluate(()=>window.enlOpenIncidentReview('qa-bulk',true,window.__u));
  await page.waitForFunction(()=>document.getElementById('editInc')?.textContent==='이관정보 수정');
  assert.equal(await page.locator('[data-enl438-reopen]').count(),0,'imported follow-up data cannot be reset through generic rollback');
  assert.ok((await page.locator('#modalRoot').innerText()).includes('ERP 기결재'));
  assert.ok((await page.locator('#modalRoot').innerText()).includes('법정 사고기록'),'ERP evidence supplements existing statutory content');
  assert.ok((await page.locator('#modalRoot').innerText()).includes('시간 미확인'),'unknown time is never displayed as an invented clock time');
  await page.locator('#editInc').click();
  await page.waitForFunction(()=>window.__opened.length===1);
  assert.deepEqual(await page.evaluate(()=>window.__opened[0]),['qa-batch','qa-candidate']);
  await page.evaluate(()=>window.enlOpenIncidentReview('qa-bulk',true,window.__u));
  await page.waitForFunction(()=>document.getElementById('deleteInc')?.textContent==='이관 무효처리 관리');
  await page.locator('#deleteInc').click();await page.waitForFunction(()=>window.__opened.length===2);
  await page.evaluate(()=>window.enlEditIncidentInReportForm(window.data.incidents[0],window.__u));
  assert.equal(await page.evaluate(()=>window.__opened.length),3);
  await page.evaluate(()=>window.enlReopenClosedIncidentToApproved('qa-bulk',window.__u));
  assert.equal(await page.evaluate(()=>window.__saves),0);
  assert.equal(await page.evaluate(()=>window.data.incidents[0].corrective.status),'approved');
  await page.evaluate(()=>{window.__u={id:'qa-field',name:'격리 현장',role:'field',siteId:'qa-site'};window.enlEditIncidentInReportForm(window.data.incidents[0],window.__u)});
  assert.equal(await page.evaluate(()=>window.__opened.length),3,'field role cannot enter bulk correction');
  assert.ok((await page.evaluate(()=>window.__alerts)).includes('수정 권한이 없습니다.'));
  assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),'general detail edit/void routes, protected follow-up, ERP/statutory/unknown-time display, and role denial');
 }finally{await browser.close()}
}
(async()=>{for(const engine of [chromium,webkit])await run(engine)})().catch(e=>{console.error(e);process.exit(1)});
