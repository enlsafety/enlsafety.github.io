'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require('playwright');
const { tab } = require('./field-entry-table-browser.cjs');

async function register(browser, category) {
  const pdf = category === 'person';
  const role = pdf ? 'field' : 'safety';
  const { p, c } = await tab(browser, pdf ? 390 : 1365, role);
  const name = pdf ? '현장자료.pdf' : '사고경위.txt';
  const mime = pdf ? 'application/pdf' : 'application/octet-stream';
  const bytes = Buffer.from(pdf ? '%PDF-1.4\n%%EOF' : '가상 사고 경위');
  const path = 'incident/qa/' + name;
  const url = 'http://ui.localhost/qa-evidence';
  const dialogs = [];
  p.on('dialog', async dialog => {dialogs.push(dialog.message());await dialog.accept();});
  await p.route(url, route => route.fulfill({body:bytes,contentType:mime}));
  await p.route('**/functions/v1/enl-attachment-v411', async route => {
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204});
    const body = route.request().postDataJSON();
    if(body.action==='sign')return route.fulfill({json:{ok:true,urls:{[path]:url}}});
    assert.equal(body.scope,'incident');
    assert.equal(body.file.mime,mime);
    assert.deepEqual(Buffer.from(body.file.base64,'base64'),bytes);
    await route.fulfill({json:{ok:true,attachment:{name,mime,path,size:bytes.length,kind:pdf?'pdf':'file',previewUrl:url}}});
  });
  await p.waitForFunction(()=>data.incidents.length>0);
  await p.evaluate(()=>{window.enlCommitOrNotify=async record=>{window.qaSaved=structuredClone(record);return true;};});
  await p.locator(pdf?'[data-field-task="accident_report"]':'[data-shell-view="report"]').click();
  await p.locator('button[data-report-type="'+category+'"]').click();
  if(!pdf)await p.locator('#reportSite').selectOption('s01');
  const values={occurredDate410:'2026-11-03',occurredTime410:'13:20',incidentPlace410:'검수 현장',workAction410:'운전',incidentHow410:'접촉',immediateAction:'정지'};
  Object.assign(values,pdf?{injuredName:'가상 작업자',injuryDetail410:'찰과상'}:{damagedItem410:'시설',damageDetail410:'파손'});
  for(const [id,v] of Object.entries(values))await p.locator('#'+id).fill(v);
  for(const select of await p.locator('#unifiedReportForm select:enabled').all()){
    if(!await select.inputValue())await select.selectOption({index:1});
  }
  const submit=p.locator('#unifiedReportForm button[type=submit]');
  await submit.click();
  assert.match(dialogs.at(-1),/현장 첨부자료를 1개 이상/);
  await p.locator('#incidentPhotoInput').setInputFiles({name,mimeType:pdf?mime:'text/plain',buffer:bytes});
  await p.waitForFunction(()=>document.querySelector('#incidentPhotoBtn').getAttribute('aria-invalid')==='false');
  if(!pdf){
    assert.match(await p.locator('#incidentThumbs').innerText(),/원본 파일 내려받기/);
    const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#incidentThumbs [data-attach-open]').click()]);
    assert.equal(download.suggestedFilename(),name);
    assert.deepEqual(fs.readFileSync(await download.path()),bytes);
  }
  await submit.click();
  await p.waitForFunction(()=>window.qaSaved);
  const saved=await p.evaluate(()=>window.qaSaved);
  assert.equal(saved.category,category);
  assert.deepEqual(saved.photos.map(a=>a.path),[path]);
  assert.equal(saved.status,'reported');
  await c.close();
}
(async()=>{
  for(const engine of [chromium,webkit]){
    const browser=await engine.launch();
    try{for(const category of ['person','property'])await register(browser,category);}
    finally{await browser.close();}
    console.log('PASS',engine.name(),'PDF-only person report, document-only property report, original download and empty validation');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
