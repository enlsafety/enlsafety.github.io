'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const src=f=>fs.readFileSync(f,'utf8');
const fixture='사업장명,사고일,사고구분,사고유형,사고정도,사고장소,당시작업,사고경위,당시조치,피해자,부상내용,ERP문서번호,ERP결재일,ERP결재상태,사고번호\n테스트CC,2025-05-10,대인,베임,경미,3홀,예초작업,낫에 손가락 베임,응급처치,김00,손가락 베임,ERP-100,2025-05-15,결재완료,OLD-100';
async function run(engine){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="view"></div></body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch();
 const page=await browser.newPage({viewport:{width:390,height:844}});
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.__u={id:'qa-safety',name:'QA 안전관리자',role:'safety',passwordHash:'non-secret-test-hash'};
   window.currentUser=()=>window.__u;
   window.data={users:[],incidents:[]};window.currentView='report';
   window.renderUnifiedReport=(node)=>{node.innerHTML='<div class="report-type-grid"></div>'};
   window.renderShell=(u)=>window.renderUnifiedReport(document.getElementById('view'),u);
   window.__sv={batch:null,files:[],candidates:[],calls:[],sites:[{site_id:'s1',site_name:'테스트CC'}]};
   const clone=v=>JSON.parse(JSON.stringify(v));
   window.fetch=async(url,opt)=>{
    const x=JSON.parse(opt.body),db=window.__sv;db.calls.push(x.action);
    const ok=out=>new Response(JSON.stringify({ok:true,...clone(out)}),{status:200,headers:{'content-type':'application/json'}});
    if(x.action==='options')return ok({sites:db.sites});
    if(x.action==='list')return ok({batches:db.batch?[db.batch]:[]});
    if(x.action==='create'){db.batch={id:x.batchId,created_at:'2026-10-12T09:00:00Z',candidates:[],file_errors:[]};return ok({batch:db.batch})}
    if(x.action==='get')return ok({batch:db.batch,files:db.files.map(f=>({file_id:f.id,name:f.name,size:f.size}))});
    if(x.action==='upload'){const f=x.file;db.files.push({id:f.id,name:f.name,size:f.size,method:f.method,units:f.units});return ok({fileId:f.id})}
    if(x.action==='analyze'){db.batch.candidates=window.ENLHistoricalBulk.analyze(db.files,db.sites);return ok({candidates:db.batch.candidates})}
    if(x.action==='save'){const c=db.batch.candidates.find(c=>c.id===x.candidateId);if(c.revision!==x.revision)return new Response(JSON.stringify({ok:false,message:'revision_conflict'}),{status:409});
     c.values={...c.values,...x.values};c.corrections.push({field:'review',reason:x.reason});c.revision++;c.validation=window.ENLHistoricalBulk.validate(c,db.sites);return ok({candidate:c})}
    if(x.action==='commit'){const c=db.batch.candidates.find(c=>c.id===x.candidateId);if(x.finalConfirmed!==true)throw Error('missing_final_confirmation');c.validation=window.ENLHistoricalBulk.validate(c,db.sites);if(!c.validation.length){c.state='success';c.incidentId='qa-record';c.revision++};return ok({candidate:c})}
    if(x.action==='file_error'){db.batch.file_errors.push({name:x.name,message:x.message});return ok({})}
    if(x.action==='sign')return ok({url:'about:blank'});
    return new Response(JSON.stringify({ok:false,message:'invalid_action'}),{status:400});
   };
  });
  for(const name of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js','historical-bulk-ui-v454.js'])await page.addScriptTag({content:src(name)});
  await page.evaluate(()=>window.renderShell(window.__u));
  assert.equal(await page.locator('[data-bulk-v454]').count(),1,'safety-only entry card');
  await page.locator('[data-bulk-v454]').click();
  await page.waitForSelector('[data-b-new]');
  assert.ok((await page.locator('h2').first().innerText()).includes('과거사고 자동분석'));
  await page.locator('#b-confirm').check();
  await page.locator('[data-b-new]').click();
  await page.waitForSelector('#b-files',{state:'attached'});
  await page.locator('#b-files').setInputFiles({name:'historical.csv',mimeType:'text/csv',buffer:Buffer.from(fixture,'utf8')});
  await page.waitForFunction(()=>window.__sv.files.length===1);
  assert.equal(await page.evaluate(()=>window.__sv.files[0].method),'text');
  await page.waitForSelector('[data-b-analyze]:not([disabled])');
  await page.locator('[data-b-analyze]').click();
  await page.waitForFunction(()=>window.__sv.batch.candidates.length===1);
  assert.equal(await page.locator('[data-b-edit]').count(),1);
  await page.locator('[data-b-edit]').click();
  await page.waitForSelector('#b-reason');
  assert.equal(await page.locator('[data-b-field="incidentHow"]').inputValue(),'낫에 손가락 베임');
  assert.equal(await page.locator('[data-b-field="category"]').inputValue(),'person');
  await page.locator('[data-b-field="incidentHow"]').fill('낫에 왼쪽 검지 베임');
  await page.locator('#b-reason').fill('원본 사고경위서에 기재된 부위를 대조하고 표현을 정정함');
  page.once('dialog',async d=>await d.accept());
  await page.locator('[data-b-commit]').click();
  await page.waitForFunction(()=>window.__sv.batch.candidates[0].state==='success'||!!document.querySelector('.error454'),null,{timeout:9000});
  const debug=await page.evaluate(()=>({status:window.__sv.batch.candidates[0].state,errors:document.querySelector('.error454')?.textContent||'',issues:window.__sv.batch.candidates[0].validation||[],calls:window.__sv.calls}));
  assert.equal(debug.status,'success',JSON.stringify(debug));
  assert.equal(await page.evaluate(()=>window.__sv.batch.candidates[0].values.incidentHow),'낫에 왼쪽 검지 베임');
  assert.equal(await page.evaluate(()=>window.__sv.batch.candidates[0].incidentId),'qa-record');
  assert.equal(await page.locator('.count454 b').first().textContent(),'1');
  const calls=await page.evaluate(()=>window.__sv.calls);
  for(const act of ['options','list','create','upload','get','analyze','save','commit'])assert.ok(calls.includes(act),act);
  await page.locator('[data-b-export]').click();
  // Switching accounts clears private import drafts and source references.
  await page.evaluate(()=>{
    window.__u={id:'other-safety',name:'다른 안전관리자',role:'safety',passwordHash:'other-test'};
    window.renderShell(window.__u);
  });
  assert.equal(await page.locator('.bulk454').count(),0,'previous-user import must not remain visible');
  await page.waitForSelector('[data-bulk-v454]');
  // Non-safety users must not receive the import UI entry.
  await page.evaluate(()=>{window.__u={id:'qa-field',name:'현장소장',role:'field'};window.renderShell(window.__u)});
  assert.equal(await page.locator('[data-bulk-v454]').count(),0);
  console.log('PASS',engine.name(),'file upload, extraction, review, correction, commit, safety-only access and responsive layout');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
(async()=>{for(const browser of [chromium,webkit])await run(browser)})().catch(e=>{console.error(e);process.exit(1)});