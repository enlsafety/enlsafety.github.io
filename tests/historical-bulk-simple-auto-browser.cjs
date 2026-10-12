'use strict';
// Default simplified UI: drop files -> batch creation -> classification ->
// only source-proven ERP-ready incidents auto-register. All browser data is fake.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const header='사업장명,사고일,사고구분,사고유형,사고정도,사고장소,당시작업,사고경위,당시조치,피해자,부상내용,ERP문서번호,ERP결재일,ERP결재상태,사고번호';
const valid=header+'\n테스트CC,2025-05-10,대인,베임,경미,3홀,예초작업,예초작업 중 왼쪽 검지 베임,응급처치,테스트직원,왼쪽 검지 열상,ERP-QA-100,2025-05-12,결재완료,OLD-QA-100';
const missing=header+'\n테스트CC,2025-05-11,대인,넘어짐,경미,4홀,이동작업,걸어가다 넘어짐,응급처치,다른직원,발목 부상,,,,OLD-QA-200';
async function run(engine,width){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="view"></div></body></html>')});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.__u={id:'qa-safety',name:'QA 안전관리자',role:'safety',passwordHash:'qa-password-proof'};
   window.currentUser=()=>window.__u;window.data={users:[],incidents:[]};window.currentView='report';
   window.renderUnifiedReport=node=>{node.innerHTML='<div class="report-type-grid"></div>'};
   window.renderShell=u=>window.renderUnifiedReport(document.getElementById('view'),u);
   window.enlIncidentPullNow=async()=>{};
   window.__sv={batches:new Map(),calls:[],holdUpload:true,sites:[{site_id:'site1',site_name:'테스트CC',start_date:'2020-01-01'}]};
   const clone=x=>JSON.parse(JSON.stringify(x));
   window.fetch=async(url,opt)=>{
    const req=JSON.parse(opt.body),db=window.__sv;db.calls.push(clone(req));
    const success=d=>new Response(JSON.stringify({ok:true,...clone(d)}),{status:200,headers:{'Content-Type':'application/json'}});
    const failure=(message,status=400)=>new Response(JSON.stringify({ok:false,message}),{status,headers:{'Content-Type':'application/json'}});
    if(req.action==='options')return success({sites:db.sites});
    if(req.action==='list')return success({batches:[...db.batches.values()].map(x=>({id:x.id,created_at:x.created_at,count:x.candidates.length})).reverse()});
    if(req.action==='create'){
     if(req.erpConfirmed!==true)return failure('erp_confirmation_required');
     db.batches.set(req.batchId,{id:req.batchId,created_at:'2026-10-12T00:00:00Z',candidates:[],file_errors:[],files:[]});
     return success({batch:db.batches.get(req.batchId)});
    }
    const batch=db.batches.get(req.batchId);if(!batch)return failure('batch_not_found');
    if(req.action==='get')return success({batch:{...batch,files:undefined},files:batch.files.map(f=>({file_id:f.id,hash:f.hash,method:f.method,name:f.name,size:f.size})),incidents:[],history:[]});
    if(req.action==='upload'){
     if(db.holdUpload){db.holdUpload=false;await new Promise(done=>{window.__releaseUpload=done})}
     if(!batch.files.some(f=>f.id===req.file.id))batch.files.push(clone(req.file));
     return success({fileId:req.file.id});
    }
    if(req.action==='file_error'){batch.file_errors.push({name:req.name,message:req.message});return success({})}
    if(req.action==='analyze'){batch.candidates=window.ENLHistoricalBulk.analyze(batch.files,db.sites);return success({candidates:batch.candidates})}
    if(req.action==='commit'){
     const c=batch.candidates.find(c=>c.id===req.candidateId);if(!c||c.revision!==req.revision)return failure('revision_conflict',409);
     if(window.ENLHistoricalBulk.validate(c,db.sites).length)return failure('invalid_candidate');
     if(req.finalConfirmed!==true)return failure('final_confirmation_required');
     if(c.state!=='success'){c.state='success';c.incidentId='qa-incident-'+(c.values.recordNo||c.id);c.revision++;}
     return success({candidate:c});
    }
    return failure('unsupported_mock_action');
   };
  });
  for(const p of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js','historical-bulk-ui-v454.js'])await page.addScriptTag({content:read(p)});
  await page.evaluate(()=>window.renderShell(window.__u));await page.locator('[data-bulk-v454]').click();
  await page.waitForSelector('#b-files:not([disabled])',{state:'attached'});
  assert.equal(await page.locator('[data-b-new]').count(),0,'complex workspace stays hidden by default');
  assert.ok((await page.locator('#b-drop').innerText()).includes('파일'),'drop area is the first action');
  page.once('dialog',d=>d.accept());
  await page.locator('#b-files').setInputFiles({name:'confirmed.csv',mimeType:'text/csv',buffer:Buffer.from(valid,'utf8')});
  await page.waitForFunction(()=>typeof window.__releaseUpload==='function');
  assert.equal(await page.locator('#b-files').isEnabled(),true,'new files can join during an active upload');
  await page.locator('#b-files').setInputFiles({name:'needs-check.csv',mimeType:'text/csv',buffer:Buffer.from(missing,'utf8')});
  await page.evaluate(()=>window.__releaseUpload());
  await page.waitForFunction(()=>window.__sv.batches.size===1&&[...window.__sv.batches.values()][0].candidates.length===2&&document.querySelector('[data-b-count="success"] b')?.textContent==='1'&&!document.querySelector('.bulk454[aria-busy="true"]'),null,{timeout:20000});
  assert.equal(await page.locator('[data-b-count="review"] b').innerText(),'1');
  assert.equal(await page.locator('[data-b-count="failed"] b').innerText(),'0');
  assert.equal(await page.locator('[data-b-edit]').count(),1,'only exceptions remain in the active list');
  const first=await page.evaluate(()=>[...window.__sv.batches.values()][0]);
  assert.equal(first.files.length,2,'two rapid uploads remain in the same batch');
  assert.equal(first.candidates.find(c=>c.values.recordNo==='OLD-QA-100').state,'success');
  assert.equal(first.candidates.find(c=>c.values.recordNo==='OLD-QA-200').state,'review');
  assert.equal(await page.evaluate(()=>window.__sv.calls.filter(x=>x.action==='analyze').length),1,'deferred analysis merges queued files');
  assert.equal(await page.evaluate(()=>window.__sv.calls.filter(x=>x.action==='commit').length),1,'only document-supported ERP approval may auto-register');
  await page.locator('[data-b-advanced]').click();
  assert.equal(await page.locator('#b-confirm').count(),1,'advanced manual workflow preserved');
  await page.locator('[data-b-advanced]').click();
  assert.equal(await page.locator('#b-confirm').count(),0,'advanced sections hidden again');
  // After any registration, subsequent drops start a fresh batch without
  // prompting for approval again in this authenticated browser session.
  await page.locator('#b-files').setInputFiles({name:'more.csv',mimeType:'text/csv',buffer:Buffer.from(valid.replace('OLD-QA-100','OLD-QA-101').replace('ERP-QA-100','ERP-QA-101'),'utf8')});
  await page.waitForFunction(()=>window.__sv.batches.size===2&&[...window.__sv.batches.values()][1].candidates.some(c=>c.state==='success')&&!document.querySelector('.bulk454[aria-busy="true"]'),null,{timeout:20000});
  assert.equal(await page.evaluate(()=>window.__sv.calls.filter(x=>x.action==='create').length),2);
  assert.equal(await page.evaluate(()=>window.__sv.calls.filter(x=>x.action==='commit').length),2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');
  assert.deepEqual(errors,[],'no browser JS errors');
  console.log('PASS',engine.name(),width,'single consent, rapid drop grouping, automatically proven registration, exception queue, advanced screen and next batch');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
}
(async()=>{await run(chromium,1200);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
