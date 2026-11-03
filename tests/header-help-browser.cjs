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
  const c=await browser.newContext({userAgent:width===390?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1':width===412?'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36':undefined,viewport:{width,height:width<500?844:940},deviceScaleFactor:1,isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const actor={id:'sample-'+role,name:role==='field'?'검수 소장':'검수 담당',position:role==='field'?'현장소장':'안전관리자',role,siteId:role==='field'?'s01':'',active:true};
  await c.addInitScript(u=>localStorage.setItem('enl_safety_session_v3',JSON.stringify({manager:u,loggedAt:new Date().toISOString()})),actor);
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
    const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':req.headers()['access-control-request-headers']||'content-type,x-enl-app','access-control-allow-credentials':'true'};
    return req.method()==='OPTIONS'?route.fulfill({status:204,headers}):route.fulfill({json:data,headers});
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

async function verifyAndroidEntry(){
 const b=await chromium.launch(process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE,args:['--no-sandbox']}:{}),c=await b.newContext({userAgent:'Mozilla/5.0 (Linux; Android 15) Chrome/130.0.0.0 Mobile',serviceWorkers:'block'});
 try{await c.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin?r.fulfill({contentType:'text/html; charset=utf-8',body:u.pathname==='/'?fs.readFileSync('index.html','utf8'):'<h1>앱 시작</h1>'}):r.abort()});const p=await c.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>console.error('entry',e.message));await p.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:10000});await p.locator('#androidInstaller').waitFor();await p.locator('#continueBtn').click();await p.waitForURL('**/stable412.html?**');await p.goto(origin+'/');await p.waitForURL('**/stable412.html?**');assert.equal(await p.locator('#androidInstaller').count(),0);console.log('PASS Android entry introduction shown only once');}finally{await b.close()}
}
(async()=>{await verifyAndroidEntry();for(const [width,role,engine] of [[1365,'safety',chromium],[390,'executive',webkit],[412,'field',chromium],[820,'manager',webkit],[320,'safety',chromium]].filter(x=>!process.env.UI_CHROMIUM_ONLY||x[2]===chromium)){
 const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE,args:['--no-sandbox']}:{});
 try{const {p,c}=await tab(browser,width,role),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.locator('#enlSetupHelp').waitFor();assert.equal(await p.locator('#enl418Overlay').count(),0);
 await p.locator('#enlSetupHelp [data-help-close]').last().click();
 await p.locator('.topbar-tools #enlAppHelp').waitFor();await p.waitForTimeout(2000);
 assert.equal(await p.locator('#enlSetupHelp').count(),0);await noOverflow(p);
 const boxes=await p.locator('.topbar-tools>*,.topbar .brand,.topbar .user-wrap').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width}}));
 for(const b of boxes)assert.ok(b.x>=-1&&b.right<=width+1,JSON.stringify(b));
 if(width<=720){assert.ok(await p.locator('.topbar').evaluate(el=>el.getBoundingClientRect().height)<130,'compact two-row mobile header');assert.equal(await p.locator('.header-version').isVisible(),false)}
 assert.equal(await p.locator('[data-enl-global-update]').count(),role==='safety'?1:0);
 if(role==='safety'){await p.locator('#userChip').click();assert.ok(await p.locator('#userMenu [data-enl-global-update]').isVisible());await p.locator('#userChip').click()}
 await image(p,'header-'+role+'-'+width,'.topbar');
 await p.locator('#enlAppHelp').click();assert.ok((await p.locator('#enlSetupHelp').innerText()).includes('알림 켜기'));assert.equal(await p.locator('#enlSetupHelp details').count(),3);await image(p,'help-'+role+'-'+width);
 await p.locator('#enlSetupHelp [data-help-settings]').click();await p.locator('#enl418Overlay').waitFor();await p.locator('#enl418Overlay [data-enl-close]').click();
 await p.reload();await p.locator('#enlAppHelp').waitFor();await p.waitForTimeout(1200);assert.equal(await p.locator('#enlSetupHelp').count(),0,'reload must not repeat introduction');
 await p.evaluate(()=>renderShell(currentUser()));await p.locator('#enlAppHelp').waitFor();await p.waitForTimeout(900);assert.equal(await p.locator('#enlSetupHelp').count(),0,'navigation must not repeat introduction');
 await p.locator('#enlAppHelp').click();await p.locator('#enlSetupHelp [data-help-close]').first().press('Escape');assert.equal(await p.locator('#enlSetupHelp').count(),0);assert.deepEqual(errors,[]);
 await c.close();console.log('PASS header/help/once-only intro',role,width);
 }finally{await browser.close()}
}})().catch(e=>{console.error(e);process.exitCode=1});
