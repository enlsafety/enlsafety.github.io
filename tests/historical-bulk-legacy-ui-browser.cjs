'use strict';
const {chromium,webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
async function run(engine,width){
 const server=http.createServer((_,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="view"></div>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.__u={id:'qa-safety',name:'검증 안전관리자',role:'safety',passwordHash:'qa-proof'};
   window.currentUser=()=>window.__u;window.currentView='report';window.data={users:[],incidents:[]};
   window.renderUnifiedReport=node=>{node.innerHTML='<div class="report-type-grid"></div>'};
   window.renderShell=u=>window.renderUnifiedReport(document.getElementById('view'),u);
  });
  for(const path of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js','historical-bulk-ui-v454.js'])await page.addScriptTag({content:fs.readFileSync(path,'utf8')});
  await page.evaluate(()=>{
   const fields=['사업장명','사고일','사고구분','사고유형','사고정도','사고장소','당시작업','사고경위','당시조치','파손물품','파손내용'];
   const record=['QA 현장','2025-01-20','대물','충돌','경미','창고','장비 운반','장비 이동 중 문틀 충돌','현장 확인','창고 문틀','문틀 파손'];
   const sites=[{site_id:'qa-site',site_name:'QA 현장'}];
   const candidate=window.ENLHistoricalBulk.analyze([{id:'file',method:'text',units:[{location:'가상 사고기록',rows:[fields,record]}]}],sites)[0];
   const batch={id:'11111111-1111-4111-8111-111111111111',candidates:[candidate],created_at:'2026-10-12T00:00:00Z',file_errors:[]};
   window.__qa={candidate,batch,sites,calls:[],registered:null};
   const clone=x=>JSON.parse(JSON.stringify(x));
   window.fetch=async(_,init)=>{
    const b=JSON.parse(init.body),q=window.__qa;q.calls.push(clone(b));
    const ok=o=>new Response(JSON.stringify({ok:true,...clone(o)}),{status:200,headers:{'Content-Type':'application/json'}}),bad=m=>new Response(JSON.stringify({ok:false,message:m}),{status:409});
    if(b.action==='options')return ok({sites:q.sites});
    if(b.action==='list')return ok({batches:[{id:q.batch.id,created_at:q.batch.created_at,count:1}]});
    if(b.action==='get')return ok({batch:q.batch,files:[{file_id:'file',name:'QA 문서.pdf',method:'text',size:123}],incidents:[],history:[]});
    if(b.action==='save'){
     const c=q.candidate;if(b.revision!==c.revision)return bad('revision_conflict');
     for(const [field,value]of Object.entries(b.values))if(String(c.values[field]??'')!==value)c.corrections.push({field,actorId:'qa-safety',reason:b.reason});
     c.values={...c.values,...b.values};if(b.resolveIssues)c.resolvedCodes=(c.issues||[]).map(x=>x.code);
     c.revision++;c.validation=window.ENLHistoricalBulk.validate(c,q.sites);c.state=c.validation.length?'review':'ready';
     return ok({candidate:c});
    }
    if(b.action==='commit'){
     const c=q.candidate;if(!b.finalConfirmed||!b.legacyExceptionConfirmed||window.ENLHistoricalBulk.validate(c,q.sites).length)return bad('legacy_exception_confirmation_required');
     q.registered=window.ENLHistoricalBulk.makeIncident(c,q.batch.id,{id:'qa-safety'},'2026-10-12T01:00:00Z','qa-registered');
     c.state='success';c.incidentId='qa-registered';c.revision++;return ok({candidate:c});
    }
    return bad('invalid_action');
   };
   window.enlOpenHistoricalCandidate454(batch.id,candidate.id);
  });
  await page.waitForSelector('#b-legacy-mode');
  assert.ok(await page.locator('.review-legacy454.need454').count()>0,'ERP gap is highlighted in orange');
  assert.ok(await page.locator('.review-field454').count()>0,'missing record fields visibly highlighted');
  await page.locator('[data-b-jump="legacyApprovalMode"]').first().click();
  assert.equal(await page.locator('#b-legacy-mode').evaluate(e=>document.activeElement===e),true,'warning jumps to selection');
  await page.locator('#b-legacy-mode').selectOption('pre_employment');
  await page.locator('#b-legacy-reason').fill('입사하기 이전 보고된 사고로서 종이 사고경위서는 남아 있으나 과거 ERP 결재번호 열람권한이 없어 현재 확인할 수 없음.');
  await page.locator('#b-legacy-confirm').check();
  await page.locator('[data-b-save]').click();
  await page.waitForFunction(()=>!document.querySelector('.bulk454[aria-busy="true"]'));
  assert.equal(await page.evaluate(()=>window.__qa.candidate.state),'ready');
  page.once('dialog',d=>d.accept());await page.locator('[data-b-commit]').click();
  await page.waitForFunction(()=>!!window.__qa.registered&&!document.querySelector('.bulk454[aria-busy="true"]'));
  const r=await page.evaluate(()=>window.__qa.registered);
  assert.equal(r.status,'reported');assert.equal(r.externalInitialApproval.state,'unverifiable');
  assert.equal(r.approvedAt,null);assert.equal(r.externalInitialApproval.documentNo,null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),width,'orange required-field focus, old ERP number unavailable, audited pending-review import');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium,1280);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
