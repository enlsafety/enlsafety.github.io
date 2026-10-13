'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
async function run(engine,width){
 const server=http.createServer((_,res)=>{res.setHeader('content-type','text/html;charset=utf-8');res.end('<html><body><div id="view"></div></body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:860}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  // Synthetic account, isolated browser, no backend requests.
  await page.evaluate(()=>{
   const u={id:'qa-safety',name:'QA 안전관리자',role:'safety'};
   window.data={incidents:[],users:[u],sites:[{id:'s1',name:'가상CC'}]};
   window.currentUser=()=>u;window.currentView='report';window.incidentPhotos=[];
   window.esc=x=>String(x??'');window.uid=()=> 'qa-manual-inc-1';
   window.saveData=()=>{window.__saved=true};
   window.enlIncidentSyncNow=async()=>{window.__synced=true};
   window.renderUnifiedReport=root=>{root.innerHTML='<div class="report-type-grid"></div>'};
   window.renderShell=()=>window.renderUnifiedReport(document.getElementById('view'));
   window.eventTypeOptions=()=>'<option value="충돌">충돌</option>';
   window.ENLContracts={
    options:()=>'<option value="s1">가상CC</option>',
    site:()=>({site_id:'s1',site_name:'가상CC'}),
    assess:()=>({outsideContractPeriod:false,currentStatus:'active',statusAtOccurrence:'active',warning:''}),
    capture:()=>({occurredDate:'2025-06-03'}),
    detail:()=>'',incidentDetail:()=>'',badge:()=>''
   };
  });
  await page.addScriptTag({content:fs.readFileSync('historical-transfer-v449.js','utf8')});
  await page.evaluate(()=>window.enlStartHistoricalTransfer449());
  assert.equal(await page.locator('[data-type="property"]').count(),1);
  await page.locator('[data-type="property"]').click();
  await page.locator('#hDate').fill('2025-06-03');
  await page.locator('#hTime').fill('12:30');
  await page.locator('#hEvent').selectOption('충돌');
  await page.locator('#hSeverity').selectOption('minor');
  await page.locator('#hPlace').fill('관리동 옆');
  await page.locator('#hHow').fill('가상의 시설물 접촉 사고가 발생하였습니다.');
  await page.locator('#hItem').fill('가드레일');
  await page.locator('#hDamage').fill('일부 파손');
  await page.locator('#hOriginal').fill('기존 사고기록 작성자');
  assert.equal(await page.locator('#hErpRef').getAttribute('required'),null);
  await page.locator('#histForm button[type="submit"]').click();
  await page.locator('#histCommit').click();
  await page.waitForFunction(()=>window.data.incidents.length===1);
  const value=await page.evaluate(()=>({incident:window.data.incidents[0],saved:window.__saved,synced:window.__synced,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.equal(value.incident.status,'approved');
  assert.equal(value.incident.corrective,null);
  assert.equal(value.incident.closedAt,null);
  assert.equal(value.incident.approvedBy,'QA 안전관리자');
  assert.equal(value.incident.historicalImport.manualSafetyApproval,true);
  assert.equal(value.incident.historicalImport.workflowExempt,false);
  assert.equal(value.incident.reportWorkflow.phase,'report_approved');
  assert.equal(value.incident.historicalImport.originalReporterName,'기존 사고기록 작성자');
  assert.equal(value.saved,true);
  assert.equal(value.synced,true);
  assert.equal(value.overflow,false);
  assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),width,'manual safety approval, optional ERP, open corrective status');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium,1366);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
