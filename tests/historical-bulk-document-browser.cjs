'use strict';
// Actual JSZip + browser XML/File/Crypto APIs. No external libraries are downloaded by this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const {chromium,webkit}=require('playwright'),JSZip=require('jszip');
const Core=require('../historical-bulk-core-v454.js');
const values={siteName:'테스트CC',occurredDate:'2025-05-10',category:'person',eventType:'베임',severity:'minor',place:'3홀',workAction:'예초 작업',incidentHow:'낫에 왼손 베임',immediateAction:'응급처치',name:'김00',injuryDetail:'왼손 열상',erpRef:'ERP-001',erpDate:'2025-05-11',erpStatus:'결재완료',medicalCost:'120,000원'};
const xml=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function fixture(ext){
 const pre=ext==='docx'?'w':'hp';
 const p=t=>`<${pre}:p><${pre}:r><${pre}:t>${xml(t)}</${pre}:t></${pre}:r></${pre}:p>`;
 const cell=t=>`<${pre}:tc>${p(t)}</${pre}:tc>`;
 const table=v=>`<${pre}:tbl>${Object.entries(v).map(([k,val])=>`<${pre}:tr>${cell(Core.fields[k][0])}${cell(val)}</${pre}:tr>`).join('')}</${pre}:tbl>`;
 const first=p('사고번호: OLD-001')+table(values),second=p('사고번호: OLD-002')+table({...values,occurredDate:'2025-05-09',erpRef:'ERP-002',incidentHow:'낫에 오른손 베임'});
 const root=`<?xml version="1.0" encoding="UTF-8"?><${pre}:document xmlns:${pre}="urn:test"><${pre}:body>${first}${second}</${pre}:body></${pre}:document>`;
 const zip=new JSZip();zip.file(ext==='docx'?'word/document.xml':'Contents/section0.xml',root);return [...await zip.generateAsync({type:'uint8array'})];
}
async function run(engine){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head></head><body></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{browser=await engine.launch();const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({path:require.resolve('jszip/dist/jszip.min.js')});for(const f of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js'])await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
  for(const ext of ['docx','hwpx']){
   const result=await page.evaluate(async({bytes,ext})=>{const file=new File([new Uint8Array(bytes)],'검증.'+ext),extracted=await window.ENLHistoricalBulkExtract454.read(file);return {hash:extracted.hash,candidates:window.ENLHistoricalBulk.analyze([extracted],[{site_id:'s1',site_name:'테스트CC'}])};},{bytes:await fixture(ext),ext});
   assert.equal(result.candidates.length,2,ext);assert.ok(result.candidates.every(c=>c.state==='ready'),JSON.stringify(result.candidates.map(c=>c.validation)));assert.equal(result.candidates[0].values.recordNo,'OLD-001');assert.equal(result.candidates[1].values.recordNo,'OLD-002');assert.equal(result.candidates[0].values.medicalCost,'120,000원');assert.equal(result.hash.length,64);
   console.log('PASS',engine.name(),ext,'real ZIP/XML extraction, original document order, two incidents, SHA-256 and evidence-ready classification');
  }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
}
(async()=>{for(const engine of [chromium,webkit])await run(engine)})().catch(e=>{console.error(e);process.exit(1)});
