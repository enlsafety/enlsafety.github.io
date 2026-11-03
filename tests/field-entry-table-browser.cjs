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

async function entry(engine,width,name){
 const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});
 try{const dataset=[...cases,{...cases[0],id:'pending-parallel',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'parallel'}},{...cases[0],id:'pending-president',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'president'}}];const {p,c}=await tab(browser,width,'field',dataset),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.waitForFunction(()=>typeof window.enlOpenIncidentReport==='function'&&data.incidents.some(i=>i.id==='pending-president'));
 await p.evaluate(()=>enlRenderFieldRecords(document.getElementById('view'),currentUser()));
 assert.equal(await p.locator('[data-field-group="executive"] [data-field-open]').count(),2);
 assert.equal(await p.locator('[data-field-open="sample-3"]').count(),0,'different site stays excluded');
 await p.locator('[data-field-open="pending-president"]').click();await p.locator('#modalRoot [data-incident-summary]').waitFor();
 assert.equal(await p.locator('#modalRoot .modal').getAttribute('data-incident-view'),'pending-president');
 assert.equal(await p.locator('#modalRoot [data-executive-record] button').filter({hasText:/결재 승인|사장 최종결재/}).count(),0,'viewing never grants field approval rights');
 await p.locator('#modalRoot [data-close]').first().click();

 for(const type of ['property','person']){
   await p.evaluate(type=>enlOpenIncidentReport(type,currentUser()),type);
   await p.locator('#unifiedReportForm .report410-work-table').first().waitFor();
   await p.waitForFunction(()=>document.querySelector('#unifiedReportForm')?.dataset.wf440Bound==='1');
   const fields=await p.locator('#unifiedReportForm .report410-section:not(.report410-photo) :is(input:not([type="hidden"]):not([type="file"]),select,textarea)').evaluateAll(xs=>xs.map(el=>({id:el.id,table:!!el.closest('td'),outside:el.getBoundingClientRect().right>innerWidth+1})));
   for(const f of fields){assert.equal(f.table,true,'tabular input '+f.id);assert.equal(f.outside,false,'input fits '+f.id);}
   for(const id of ['occurredDate410','occurredTime410','incidentPlace410','workAction410','incidentHow410','immediateAction'])assert.ok(await p.locator('#'+id).evaluate(el=>el.required));
   const cell=p.locator('#incidentHow410').locator('xpath=ancestor::tr/th');assert.equal(await cell.innerText(),'발생 경위 *');
   const cost=p.locator(type==='person'?'#medicalCost410':'#repairCost410');await cost.fill('5000');assert.equal(await cost.inputValue(),'5,000');assert.equal(await cost.getAttribute('required'),null);
   await p.locator('#workAction410').fill('작업 구역을 정리하고 이동하던 중');await p.locator('#incidentHow410').fill('이동 중 작업 구역의 장애물에 접촉함.');
   await noOverflow(p);
   await image(p,name+'-'+type+'-entry','#unifiedReportForm');
   await image(p,name+'-'+type+'-circumstances','#unifiedReportForm .report410-section:has(#incidentHow410)');
 }
 assert.deepEqual(errors,[]);await c.close();console.log('PASS entry tables',name,width,'person/property required fields, short labels, money, layout');
 }finally{await browser.close()}
}
if(require.main===module)(async()=>{await entry(chromium,1365,'desktop');await entry(chromium,320,'small-mobile');await entry(chromium,412,'android');if(!process.env.UI_CHROMIUM_ONLY){await entry(webkit,390,'iphone');await entry(webkit,820,'tablet');}})().catch(e=>{console.error(e);process.exitCode=1});

module.exports={tab,cases,noOverflow};
