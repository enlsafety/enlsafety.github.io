'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');

const root=process.cwd(),origin='http://ui.localhost',capture=process.env.UI_CAPTURE_DIR;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const sites=['가람CC','솔빛CC','새솔연구소','해솔물류센터'].map((site_name,index)=>({site_id:'s0'+(index+1),site_name,active:true,manager_name:'검수 소장',manager_phone:'',part_name:'',part_phone:'',clerk_name:'',clerk_phone:'',safety_agency:'',agency_manager:'',agency_phone:''}));
const cases=[
  ['sample-1','s01','property','approved','작업 차량 접촉'],
  ['sample-2','s01','person','reported','이동 중 넘어짐'],
  ['sample-3','s02','property','closed','시설물 파손']
].map(([id,siteId,category,status,summary],n)=>({id,siteId,category,status,summary,eventType:summary,priority:'normal',
  occurredAt:'2026-10-2'+n+'T04:10:00Z',updatedAt:'2026-10-2'+n+'T04:30:00Z',reporterId:'sample-field',reporterName:'검수 소장',
  reportDetails:{place:'작업 구역',incidentHow:summary},corrective:status==='closed'?{status:'approved'}:null,photos:[],_syncVersion:1}));

async function tab(browser,width,role,dataset=cases){
  const c=await browser.newContext({viewport:{width,height:width<500?844:940},deviceScaleFactor:1,isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const actor={id:'sample-'+role,name:role==='field'?'검수 소장':'검수 담당',position:role==='field'?'현장소장':'안전관리자',role,siteId:role==='field'?'s01':'',active:true};
  await c.addInitScript(u=>{localStorage.setItem('enl_setup_intro_seen_v1','1');localStorage.setItem('enl_safety_session_v3',JSON.stringify({manager:u,loggedAt:new Date().toISOString()}))},actor);
  const records=dataset.map(i=>role==='field' && i.id==='sample-1'
    ? {...i,corrective:{status:'planned',planDetail:'작업 전 이동 구역을 확인합니다.',actionOwner:'검수 소장',planAt:'2026-10-23T00:00:00Z'}}
    : i);
  await c.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===origin){
      const n=url.pathname.slice(1);
      if(!/^[\w.-]+$/.test(n)||!fs.existsSync(path.join(root,n)))return route.abort();
      return route.fulfill({body:fs.readFileSync(path.join(root,n)),contentType:types[path.extname(n)]||'application/octet-stream'});
    }
    // Never forward a request to the real service, including reports, mail and push.
    const action=req.method()==='POST'?req.postDataJSON()?.action:'';
    const data={ok:true,epoch:1,incidents:dataset,sites,metrics:dataset,inquiries:[],count:0,users:[actor],readers:[]};
    if(action==='export_snapshot')data.incident=dataset.find(i=>i.id===req.postDataJSON().incidentId);
    if(action==='export_completed')data.generated=true;
    if(action==='final_document'){data.incident=cases[2];data.documentNumber='검수-2026-001';}
    if(action==='pull')data.incidents=records.filter(i=>role!=='field'||i.siteId===actor.siteId);
    return route.fulfill({json:data});
  });
  const p=await c.newPage();p.setDefaultTimeout(7000);await p.goto(origin+'/stable412.html');return {p,c};
}
async function image(p,name,selector){
  if(!capture)return;
  fs.mkdirSync(capture,{recursive:true});
  await p.evaluate(()=>document.fonts.ready);
  if(selector)await p.locator(selector).first().screenshot({path:path.join(capture,name+'.png')});
  else await p.screenshot({path:path.join(capture,name+'.png')});
}
async function noOverflow(p){
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'viewport should fit');
}

const details={place:'89홀 카트로',workAction:'폐가지와 폐목재를 수거하여 카트로 운반',incidentHow:'운반 중 카트 적재함 밖으로 나온 나뭇가지가 풍우막에 닿아 파손됨.',damagedItem:'캐디 카트 풍우막',damageDetail:'풍우막 파손 (견적 첨부)',repairCost:96250,workerName:'검수 작업자',job:'현장관리',specialNote:'원자료 확인사항',diagnosis:'비공개 진단',doctorOpinion:'비공개 소견',injuryDetail:'발목 부상',environmentCause:'적재물 돌출',behaviorCause:'회전반경 확인 부족',causeAnalysisStatus:'analyzed'};
const photo={name:'현장사진.png',mime:'image/png',dataUrl:'data:image/png;base64,'+fs.readFileSync('pwa-icon-192.png').toString('base64')};
const records=['reported','supplement','supplement_submitted','approved','closed'].flatMap(status=>['person','property'].map(category=>({
 id:status+'-'+category,siteId:'s01',category,status,summary:'이전 원본 경위도 보존',eventType:'접촉',priority:'normal',occurredAt:'2026-01-26T07:40:00Z',reporterId:'sample-field',reporterName:'검수 소장',createdAt:'2026-01-26T08:00:00Z',
 reportDetails:{...details},immediateAction:'적재 기준을 준수하도록 주의하고 풍우막 교체 예정',photos:[photo],supplement:{attachments:[{name:'비공개 진단서.pdf',mime:'application/pdf',dataUrl:'data:application/pdf;base64,JVBERi0xLjQ='}]},
 corrective:{status:status==='closed'?'approved':'planned',rootCause:'동선 중첩',planDetail:'이동 전 적재물과 동선을 점검한다.',planAt:'2026-01-27T00:00:00Z',actionDetail:status==='closed'?'풍우막 교체 완료':'',afterPhotos:status==='closed'?[photo]:[]},_syncVersion:1
})));
async function sharedSummary(engine,width,name){
 const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});
 try{
  for(const role of ['safety','field','manager','executive','final']){
   const {p,c}=await tab(browser,width,role,records),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.waitForFunction(()=>typeof window.enlOpenIncidentReview==='function'&&data.incidents.length===10);
   const before=await p.evaluate(()=>JSON.stringify(data.incidents));
   for(const i of records){
    await p.evaluate(id=>{closeModal();enlOpenIncidentReview(id,false,currentUser())},i.id);
    const summary=p.locator('#modalRoot [data-incident-summary]').first(),table=summary.locator(':scope>table');
    await table.waitFor();
    assert.equal(await table.locator('caption').innerText(),'사고 경위서');
    for(const fact of [details.place,details.workAction,details.incidentHow,'검수 소장'])assert.ok((await table.innerText()).includes(fact),role+' '+i.id+' '+fact);
    if(i.category==='property')assert.ok((await table.innerText()).includes('96,250원'));
    if(role==='field'){
     assert.equal(await p.locator('#modalRoot [data-official439-excel],#modalRoot [data-excel421-id]').count(),0,'field has no Excel export');
     if(i.status==='closed')await p.locator('#modalRoot [data-final-pdf]').waitFor();
     else assert.equal(await p.locator('#modalRoot [data-final-pdf]').count(),0,'only closed records printable');
    }
    if(i.category==='property')assert.equal(await table.locator('.inc411-cost-fact td').first().evaluate(el=>getComputedStyle(el).fontWeight),'700');
    assert.equal(await p.locator('#modalRoot .report410-readonly:visible').count(),0,'raw form is collapsed for '+role);
    assert.equal(await p.locator('#modalRoot .inc411-overview').count(),0,'no duplicate overview');
    assert.equal(await p.locator('#modalRoot .report410-cumulative,#modalRoot [data-report-stage="A"],#modalRoot [data-report-stage="C"],#modalRoot [data-report-stage="D"],#modalRoot [data-report-stage="E"]').count(),0,'record lookup must not show A-E document sections');
    if(['safety','field'].includes(role))assert.ok((await table.innerText()).includes('이동 전 적재물과 동선을 점검한다.'),'current plan remains visible in summary');
    if(['manager','executive','final'].includes(role)){
     assert.equal(await p.locator('#modalRoot .inc411-summary-original').count(),0);
     const markup=await p.locator('#modalRoot').innerHTML();for(const secret of ['비공개 진단','비공개 소견','비공개 진단서.pdf'])if(i.category==='person')assert.ok(!markup.includes(secret),'private data excluded from reader DOM');
    }else{
     const original=summary.locator('.inc411-summary-original');assert.equal(await original.getAttribute('open'),null);
     await original.locator(':scope>summary').click();assert.ok((await original.innerText()).includes('원자료 확인사항'),'retained original facts');
     await original.locator(':scope>summary').click();
    }
    assert.equal(await p.locator('#modalRoot .modal').evaluate(el=>el.scrollWidth>el.clientWidth+2),false,'modal fits '+name+' '+role);
    if(i.id==='reported-property'&&role==='safety'){
      await p.locator('#modalRoot .modal').evaluate(el=>el.scrollTop=0);
      await image(p,name+'-safety-summary');
      await image(p,name+'-summary-table','#modalRoot [data-incident-summary]');
    }
   }
   assert.equal(await p.evaluate(()=>JSON.stringify(data.incidents)),before,'rendering does not rewrite records');
   const print=await p.evaluate(()=>enlCumulativeReportHtml(data.incidents[0]));
   assert.ok(print.includes('report410-readonly')&&!print.includes('data-incident-summary'),'document output remains the original full template');
   await p.evaluate(()=>{closeModal();openUnifiedCorrectiveModal('closed-property',currentUser())});
   await p.locator('#modalRoot [data-incident-summary]>table').waitFor();
   assert.equal(await p.locator('#modalRoot [data-report-stage]').count(),0,'approved action read-only view also uses summary');
   assert.ok((await p.locator('#modalRoot [data-incident-summary]').first().innerText()).includes('풍우막 교체 완료'));
   if(role==='safety'||role==='field'){
    await p.evaluate(()=>{closeModal();openUnifiedCorrectiveModal('approved-property',currentUser())});
    await p.locator('#modalRoot [data-report-stage="A"] [data-incident-summary]>table').waitFor();
    assert.equal(await p.locator('#modalRoot .report410-readonly:visible').count(),0);
   }
   assert.deepEqual(errors,[]);await c.close();console.log('PASS shared summary',name,role,'10 category/status cases, no mutations, original access, privacy, output template');
  }
 }finally{await browser.close();}
}
(async()=>{
 await sharedSummary(chromium,1365,'desktop');
 await sharedSummary(chromium,390,'mobile');
 if(!process.env.UI_CHROMIUM_ONLY){await sharedSummary(webkit,390,'iphone');await sharedSummary(webkit,820,'tablet');}
})().catch(e=>{console.error(e);process.exitCode=1});
