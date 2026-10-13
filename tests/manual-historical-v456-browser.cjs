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
   window.currentUser=()=>u;window.currentView='report';
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
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium,1366);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
