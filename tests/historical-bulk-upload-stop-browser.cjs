'use strict';
// Real importer UI with an isolated, abort-aware API double. No live data.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const source=p=>fs.readFileSync(p,'utf8');
const columns='사업장명,사고일,사고구분,사고유형,사고정도,사고장소,당시작업,사고경위,당시조치,피해자,부상내용,ERP문서번호,ERP결재일,ERP결재상태,사고번호';
const csv=(n)=>columns+'\n테스트CC,2025-05-10,대인,베임,경미,3홀,예초작업,낫에 손가락 베임,응급처치,QA직원,손가락 베임,ERP-QA-'+n+',2025-05-11,결재완료,OLD-QA-'+n;
async function run(engine,width){
 const server=http.createServer((_,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="view"></div></body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',x=>errors.push(x.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.__u={id:'qa-safety',name:'QA 안전관리자',role:'safety',passwordHash:'qa-secret-test-only'};
   window.currentUser=()=>window.__u;window.data={users:[],incidents:[]};window.currentView='report';
   window.renderUnifiedReport=node=>{node.innerHTML='<div class="report-type-grid"></div>'};window.renderShell=u=>window.renderUnifiedReport(document.getElementById('view'),u);
   window.enlIncidentPullNow=async()=>{};
   window.__db={batches:new Map(),getCalls:0,uploadCalls:0,holdNetwork:false,uploadHolding:false,uploadAborted:false,fileErrors:0,ocrStarted:false,ocrAborted:false,sites:[{site_id:'qa-site',site_name:'테스트CC',start_date:'2020-01-01'}]};
   const clone=x=>JSON.parse(JSON.stringify(x)),ok=v=>new Response(JSON.stringify({ok:true,...clone(v)}),{status:200,headers:{'content-type':'application/json'}});
   window.fetch=async (_,options)=>{
    const b=JSON.parse(options.body),db=window.__db;
    if(b.action==='options')return ok({sites:db.sites});
    if(b.action==='list')return ok({batches:[...db.batches.values()].map(x=>({id:x.id,created_at:x.created_at,count:x.candidates.length}))});
    if(b.action==='create'){db.batches.set(b.batchId,{id:b.batchId,created_at:'2026-10-12T00:00:00Z',candidates:[],file_errors:[],files:[]});return ok({})}
    const batch=db.batches.get(b.batchId);if(!batch)throw Error('batch not found');
    if(b.action==='get'){db.getCalls++;return ok({batch:{id:batch.id,created_at:batch.created_at,candidates:batch.candidates,file_errors:batch.file_errors},files:batch.files.map(f=>({file_id:f.id,name:f.name,hash:f.hash,size:f.size,method:f.method})),incidents:[],history:[]})}
    if(b.action==='upload'){
     db.uploadCalls++;
     if(!batch.files.some(f=>f.id===b.file.id))batch.files.push(clone(b.file));
     if(db.holdNetwork){
      db.holdNetwork=false;db.uploadHolding=true;
      return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{db.uploadAborted=true;reject(new DOMException('user abort','AbortError'))},{once:true}));
     }
     return ok({fileId:b.file.id});
    }
    if(b.action==='analyze'){batch.candidates=window.ENLHistoricalBulk.analyze(batch.files,db.sites);return ok({candidates:batch.candidates})}
    if(b.action==='commit'){
     const c=batch.candidates.find(x=>x.id===b.candidateId);
     if(!c||c.revision!==b.revision)throw Error('revision_conflict');
     if(c.validation.length||!b.finalConfirmed)throw Error('invalid');
     c.state='success';c.incidentId='qa-'+c.values.recordNo;c.revision++;
     return ok({candidate:c});
    }
    if(b.action==='file_error'){db.fileErrors++;batch.file_errors.push({name:b.name,message:b.message});return ok({})}
    throw Error('Unexpected action '+b.action);
   };
  });
  for(const name of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js','historical-bulk-ui-v454.js'])await page.addScriptTag({content:source(name)});
  await page.evaluate(()=>window.renderShell(window.__u));await page.locator('[data-bulk-v454]').click();await page.waitForSelector('#b-files',{state:'attached'});
  await page.evaluate(()=>{
   const extract=window.ENLHistoricalBulkExtract454,original=extract.read;
   window.__originalRead=original;
   extract.read=async(file,progress,opts)=>{
    window.__db.ocrStarted=true;
    return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>{window.__db.ocrAborted=true;const e=new Error('cancel');e.name='AbortError';reject(e)},{once:true}));
   };
  });
  page.once('dialog',d=>d.accept());
  await page.locator('#b-files').setInputFiles({name:'first.csv',mimeType:'text/csv',buffer:Buffer.from(csv('1'),'utf8')});
  await page.waitForFunction(()=>window.__db.ocrStarted);
  await page.locator('[data-b-stop]:not([disabled])').click();
  await page.waitForFunction(()=>window.__db.ocrAborted&&!document.querySelector('.bulk454[aria-busy="true"]'));
  assert.equal(await page.evaluate(()=>window.__db.uploadCalls),0,'stop interrupts extraction before network transfer');
  assert.equal(await page.evaluate(()=>window.__db.fileErrors),0,'user cancellation is not a failed document');
  assert.equal(await page.locator('[data-b-resume]:visible').count(),1,'resume remains visible outside collapsed progress details');
  await page.evaluate(()=>window.ENLHistoricalBulkExtract454.read=window.__originalRead);
  await page.locator('[data-b-resume]').click();
  await page.waitForFunction(()=>[...window.__db.batches.values()].some(x=>x.candidates.some(c=>c.state==='success'))&&!document.querySelector('.bulk454[aria-busy="true"]'),null,{timeout:20000});
  assert.equal(await page.evaluate(()=>window.__db.uploadCalls),1);
  await page.evaluate(()=>{window.__db.holdNetwork=true});
  await page.locator('#b-files').setInputFiles({name:'second.csv',mimeType:'text/csv',buffer:Buffer.from(csv('2'),'utf8')});
  await page.waitForFunction(()=>window.__db.uploadHolding);
  await page.locator('[data-b-stop]:not([disabled])').click();
  await page.waitForFunction(()=>window.__db.uploadAborted&&!document.querySelector('.bulk454[aria-busy="true"]'));
  assert.equal(await page.evaluate(()=>window.__db.uploadCalls),2,'one in-flight transfer was aborted');
  assert.equal(await page.evaluate(()=>window.__db.fileErrors),0,'client aborted upload is not reported as corrupted file');
  await page.locator('[data-b-resume]:visible').click();
  await page.waitForFunction(()=>[...window.__db.batches.values()].filter(x=>x.candidates.some(c=>c.state==='success')).length===2&&!document.querySelector('.bulk454[aria-busy="true"]'),null,{timeout:20000});
  assert.equal(await page.evaluate(()=>window.__db.uploadCalls),2,'resumption reconciles server-committed file by hash without re-upload');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no mobile horizontal overflow');
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  console.log('PASS',engine.name(),width,'OCR interruption, HTTP abort, resume, server reconciliation, no duplicate, no false file errors');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium,1200);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
