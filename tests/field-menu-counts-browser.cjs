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

async function check(engine,width,name){
 const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});
 try{
 const base={...cases[0]};
 const dataset=[...cases,
 {...base,id:'supplement',status:'supplement'},
 {...base,id:'rejected',status:'rejected'},
 {...base,id:'pending',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'parallel'}},
 {...base,id:'closed',status:'closed',corrective:{status:'approved'}},
 {...base,id:'history',status:'closed',historicalImport:{enabled:true,erpApproved:true,workflowExempt:true,transferState:'closed'}}];
 const {p,c}=await tab(browser,width,'field',dataset),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.waitForFunction(()=>typeof window.enlFieldActionRecordCount==='function'&&data.incidents.some(i=>i.id==='history'));
 await p.locator('[data-field-task="records"] .field-six-total').waitFor();
 assert.equal(await p.locator('[data-field-task="records"] .field-six-total').innerText(),'7건','total appears on initial home after data sync');
 for(const position of ['현장소장','파트장','서무']){
 await p.evaluate(position=>{const u=currentUser();u.position=position;enlFieldHome(u)},position);
 const homeCount=async task=>Number((await p.locator(`[data-field-task="${task}"] .field-six-total`).innerText()).replace(/[^0-9]/g,''));
 assert.equal(await homeCount('records'),7,'all stages, same site');
 assert.equal(await homeCount('accident_action'),3,'accepted list, historical transfer excluded');
 await noOverflow(p);if(position==='현장소장')await image(p,name+'-home','.field-six-home');
 await p.locator('[data-field-task="records"]').click();
 await p.locator('[data-field-stat="all"]').waitFor();
 assert.equal(await p.locator('.field411-status-tile').count(),6);
 assert.equal(Number(await p.locator('[data-field-stat="all"] b').innerText()),7);
 assert.equal(await p.locator('[data-field-open]').count(),7);
 assert.equal(await p.locator('[data-field-open="sample-3"]').count(),0);
 const icons=await p.locator('.field411-status-tile').evaluateAll(xs=>xs.map(el=>{const s=getComputedStyle(el,'::after');const r=el.getBoundingClientRect();return {image:s.backgroundImage,content:s.content,width:s.width,fits:el.scrollWidth<=el.clientWidth+1,right:r.right}}));
 for(const icon of icons){assert.match(icon.image,/data:image/);assert.equal(icon.width,'30px');assert.ok(icon.fits);assert.ok(icon.right<=width+1)}
 await noOverflow(p);if(position==='현장소장')await image(p,name+'-records','.field411-status-summary');
 await p.locator('[data-field-back]').click();
 await p.locator('[data-field-task="accident_action"]').click();
 await p.locator('.prev429-list').waitFor();assert.equal(await p.locator('[data-prev-card]').count(),3);
 await p.locator('[data-field-back]').click();
 }
 await p.evaluate(()=>{data.incidents=[];window.dispatchEvent(new CustomEvent('enl-incidents-pulled'))});
 assert.equal(await p.locator('[data-field-task="records"] .field-six-total').innerText(),'0건');
 assert.equal(await p.locator('[data-field-task="accident_action"] .field-six-total').innerText(),'0건');
 await p.evaluate(()=>{data.incidents=Array.from({length:1234},(_,i)=>({id:'large-'+i,siteId:'s01',status:'approved'}));window.dispatchEvent(new CustomEvent('enl-incident-saved'))});
 assert.equal(await p.locator('[data-field-task="records"] .field-six-total').innerText(),'1,234건');await noOverflow(p);
 const over=await p.locator('.field-six-btn').evaluateAll(xs=>xs.some(el=>el.scrollWidth>el.clientWidth+1));assert.equal(over,false,'large totals fit');
 assert.deepEqual(errors,[]);await c.close();console.log('PASS',name,width,'three manager positions, totals/list parity, icons, navigation, empty and large counts');
 }finally{await browser.close()}
}
(async()=>{await check(chromium,1365,'desktop');await check(chromium,320,'small-mobile');await check(chromium,390,'mobile');await check(chromium,820,'tablet');if(!process.env.UI_CHROMIUM_ONLY)await check(webkit,390,'iphone-webkit');})().catch(e=>{console.error(e);process.exitCode=1});
