'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {tab}=require('./field-entry-table-browser.cjs');
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [1365,390]){
   const {p,c}=await tab(browser,width,'safety');
   p.on('dialog',d=>d.accept());
   await p.waitForFunction(()=>data.incidents.some(i=>i.id==='sample-1'));
   await p.evaluate(()=>{window.enlCommitOrNotify=async record=>{window.qaSaved=structuredClone(record);return true;};});
   for(const category of ['person','property']){
    await p.locator('[data-shell-view="report"]').click();
    assert.equal(await p.locator('[data-hist449]').count(),0);
    await p.locator('button[data-report-type="'+category+'"]').click();
    const toggle=p.locator('#pastReportMode');
    assert.equal(await toggle.isChecked(),false);
    await toggle.check();await p.locator('#pastReportDrafter').fill('가상 기안자');
    await p.locator('#pastReportSafety').fill('가상 안전관리자');
    await toggle.uncheck();assert.equal(await p.locator('#pastReportSafety').isDisabled(),true);
    await toggle.check();
    await p.locator('#reportSite').selectOption('s01');
    await p.evaluate(()=>{incidentPhotos=[{path:'qa/fixture.png',name:'가상 현장.png',mime:'image/png'}];});
    const values={occurredDate410:'2026-01-15',occurredTime410:'13:20',incidentPlace410:'가상 현장',workAction410:'운전',incidentHow410:'접촉',immediateAction:'정지'};
    Object.assign(values,category==='property'?{damagedItem410:'시설',damageDetail410:'파손'}:{injuredName:'가상 작업자',injuryDetail410:'찰과상'});
    for(const [id,val] of Object.entries(values))await p.locator('#'+id).fill(val);
    for(const select of await p.locator('#unifiedReportForm select:enabled').all()){
     if(!await select.inputValue())await select.selectOption({index:1});
    }
    await p.locator('#unifiedReportForm button[type="submit"]').click();
    await p.waitForFunction(type=>window.qaSaved?.category===type,category,{timeout:4000});
    const saved=await p.evaluate(()=>window.qaSaved);
    assert.deepEqual(saved.pastReport,{drafterName:'가상 기안자',safetyManagerName:'가상 안전관리자'});
    assert.equal(saved.status,'reported');assert.equal(saved.approvedAt,null);
    const html=await p.evaluate(i=>[enlExecutiveSummaryHtml(i),ENLApprovalSheet.render(i),enlCumulativeReportHtml(i)],saved);
    for(const doc of html){assert.match(doc,/가상 기안자/);assert.match(doc,/가상 안전관리자/);}
   }
   await c.close();
  }
  const {p}=await tab(browser,1365,'field');
  await p.locator('[data-field-task="accident_report"]').click();
  await p.locator('button[data-report-type="person"]').click();
  assert.equal(await p.locator('#pastReportMode').count(),0);
  console.log('PASS standard person/property forms, recorded names in summary/approval/PDF, field permissions, desktop and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
