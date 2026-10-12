'use strict';
// Isolated browser regression: OCR summary and embedded quote must be easy to
// find. Synthetic people, locations, documents and values only.
const {chromium,webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const src=p=>fs.readFileSync(p,'utf8');
async function run(engine,width){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="view"></div></body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.__user={id:'qa-safety',role:'safety',name:'검증자',passwordHash:'fixture-only'};
   window.currentUser=()=>window.__user;window.currentView='report';
   window.data={users:[],incidents:[]};
   window.renderUnifiedReport=node=>{node.innerHTML='<div class="report-type-grid"></div>'};
   window.renderShell=u=>window.renderUnifiedReport(document.getElementById('view'),u);
  });
  for(const name of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js','historical-bulk-ui-v454.js'])await page.addScriptTag({content:src(name)});
  await page.evaluate(()=>{
   const sites=[{site_id:'q1',site_name:'가상골프장',active:true}];
   const file={id:'fictional-file',name:'가상경위서.pdf',method:'ocr',units:[
    {location:'1페이지',method:'ocr',text:[
     '사고경위서','이앤엘 가상골프장','카트 풍우막 훼손',
     '사고일자        2025.07.14','사고장소        R9홀 카트로',
     '카트 교차 중 적재물(나못가지)에 의한 카트 풍우막 훼손',
     '7월 14일 16시 40분경 R7홀에서 부러진 URINE 수거하여 관리동으로 복귀하',
     '던 중 R9홀 카트로에 정차중이던 카트와 교차 시 적재함에서 삐져나온 LIRIK',
     '발생경위 카트 풍우막이 HOI.',
     '피해정도   캐디 카트 풍우막 파손 (견적서 첨부)'
    ].join('\n')},
    {location:'2페이지',method:'ocr',text:'견 적 서\n합계금액 (\u20a9 135,700)\n(공급가액+세액)'},
    {location:'3페이지',method:'ocr',text:'o  -  +'}
   ]};
   const candidate=window.ENLHistoricalBulk.analyze([file],sites)[0];
   const batchId='11111111-1111-4111-8111-111111111111';
   const batch={id:batchId,candidates:[candidate],created_at:'2026-10-12T01:00:00Z',file_errors:[]};
   window.__qa={batch,candidate,sites,file:{file_id:file.id,name:file.name,method:file.method,size:55000}};
   window.fetch=async(url,options)=>{
    const body=JSON.parse(options.body),qa=window.__qa;
    const data=body.action==='options'?{sites:qa.sites}:
      body.action==='list'?{batches:[{id:qa.batch.id,created_at:qa.batch.created_at,count:1}]}:
      body.action==='get'?{batch:qa.batch,files:[qa.file],history:[],incidents:[]}:
      {ok:false,message:'unexpected_action'};
    return new Response(JSON.stringify({ok:true,...data}),{status:200,headers:{'Content-Type':'application/json'}});
   };
   window.enlOpenHistoricalCandidate454(batchId,candidate.id);
  });
  await page.waitForSelector('[data-b-estimate]');
  const statement=await page.locator('[data-b-field="incidentHow"]').inputValue();
  assert.match(statement,/16:40경/);
  assert.match(statement,/나뭇가지/);
  assert.match(statement,/돌출된/);
  assert.doesNotMatch(statement,/URINE|LIRIK|HOI/);
  assert.ok(statement.length<190,'short accident synopsis, not OCR transcript');
  assert.equal(await page.locator('[data-b-field="repairCost"]').inputValue(),'135,700');
  assert.equal(await page.locator('[data-b-field="repairCost"]').isVisible(),true,'quote must not be hidden');
  assert.match(await page.locator('[data-b-estimate]').innerText(),/135,700원/);
  assert.match(await page.locator('[data-b-estimate]').innerText(),/지급/);
  assert.equal(await page.locator('[data-b-field="damageDetail"]').isVisible(),true);
  assert.match(await page.locator('[data-b-summary-note]').innerText(),/원본/);
  assert.equal(await page.locator('[data-b-field="erpStatus"]').inputValue(),'','no invented ERP approval');
  assert.equal(await page.locator('[data-b-field="immediateAction"]').inputValue(),'','no invented immediate response');
  const summary=page.locator('details').filter({hasText:'원본 추출 근거 보기'}).first();
  await summary.locator('summary').click();
  assert.match(await summary.innerText(),/URINE|LIRIK/,'original damaged OCR evidence remains available');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'responsive layout');
  assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),width,'concise OCR statement, visible quote, unchanged evidence/ERP and responsive review');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium,1260);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
