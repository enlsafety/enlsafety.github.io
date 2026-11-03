'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');

const root=process.cwd(),origin='http://ui.localhost',capture=process.env.UI_CAPTURE_DIR;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const sites=['가람CC','솔빛CC','새솔연구소','해솔물류센터'].map((site_name,index)=>({site_id:'s0'+(index+1),site_name,active:true}));
const cases=[
  ['sample-1','s01','property','approved','작업 차량 접촉'],
  ['sample-2','s01','person','reported','이동 중 넘어짐'],
  ['sample-3','s02','property','closed','시설물 파손']
].map(([id,siteId,category,status,summary],n)=>({id,siteId,category,status,summary,eventType:summary,priority:'normal',
  occurredAt:'2026-10-2'+n+'T04:10:00Z',updatedAt:'2026-10-2'+n+'T04:30:00Z',reporterId:'sample-field',reporterName:'검수 소장',
  reportDetails:{place:'작업 구역',incidentHow:summary},corrective:status==='closed'?{status:'approved'}:null,photos:[],_syncVersion:1}));

async function tab(browser,width,role){
  const c=await browser.newContext({viewport:{width,height:width<500?844:940},deviceScaleFactor:1,isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const actor={id:'sample-'+role,name:role==='field'?'검수 소장':'검수 담당',position:role==='field'?'현장소장':'안전관리자',role,siteId:role==='field'?'s01':'',active:true};
  await c.addInitScript(u=>localStorage.setItem('enl_safety_session_v3',JSON.stringify({manager:u,loggedAt:new Date().toISOString()})),actor);
  await c.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===origin){
      const n=url.pathname.slice(1);
      if(!/^[\w.-]+$/.test(n)||!fs.existsSync(path.join(root,n)))return route.abort();
      return route.fulfill({body:fs.readFileSync(path.join(root,n)),contentType:types[path.extname(n)]||'application/octet-stream'});
    }
    // Never forward a request to the real service, including reports, mail and push.
    const action=req.method()==='POST'?req.postDataJSON()?.action:'';
    const data={ok:true,epoch:1,incidents:cases,sites,metrics:cases,inquiries:[],count:0,users:[actor],readers:[]};
    if(action==='pull')data.incidents=cases.filter(i=>role!=='field'||i.siteId===actor.siteId);
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
  const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{}),baseline=process.env.UI_BASELINE==='1';
  try{
    const {c,p}=await tab(browser,width,'safety');
    await p.locator('[data-stats426-nav]').click();await p.locator('.stats426-card').first().waitFor();
    await p.waitForFunction(()=>document.querySelector('.stats426-card b')?.textContent.includes('3'));
    await noOverflow(p);await image(p,name+'-dashboard');
    await p.locator('[data-shell-view="home"]').click();await p.locator('[data-safety-site="s01"]').waitFor();
    if(!baseline){
      await p.waitForFunction(()=>document.querySelectorAll('.site-report-card').length===2);
      assert.equal(await p.locator('.site-report-card[data-safety-site="s01"] .site-volume>b').innerText(),'2');
      assert.equal(await p.locator('.overview-metric.tone-amber strong').innerText(),'1건');
      assert.equal(await p.locator('.site-quiet-card').count(),(await p.locator('[data-safety-site]').count())-2);
      assert.equal(await p.locator('.site-quiet-card .site-volume').count(),0);
    }
    const section=baseline?'.panel:has(.shell411-site-grid)':'.site-overview';
    await p.locator(section).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await image(p,name+'-sites');await noOverflow(p);
    await p.locator('[data-safety-site="s01"]').click();await p.locator('#backSafetyHome411').waitFor();
    assert.ok((await p.locator('#view').innerText()).includes('2건'));
    await p.locator('#backSafetyHome411').click();await p.locator('[data-safety-site="s03"]').click();
    await p.locator('#backSafetyHome411').waitFor();assert.ok((await p.locator('#view').innerText()).includes('0건'));
    await c.close();
    const field=await tab(browser,width,'field');
    await field.p.locator('[data-field-task="accident_report"]').waitFor();await noOverflow(field.p);await image(field.p,name+'-field-home');
    await field.p.locator('[data-field-task="accident_report"]').click();await field.p.locator('button[data-report-type="person"]').click();
    await field.p.locator('#unifiedReportForm').waitFor();await noOverflow(field.p);await image(field.p,name+'-report');
    assert.equal(await field.p.locator('#occurredDate410').count(),1);
    await field.c.close();console.log('PASS',name,'dashboard, site counts and drill-down, field reporting, viewport');
  } finally { await browser.close(); }
}
(async()=>{for(const [engine,w,name] of [[chromium,1440,'desktop'],[chromium,390,'mobile'],[chromium,820,'tablet'],[webkit,390,'iphone-webkit']]){
  if(process.env.UI_CHROMIUM_ONLY&&engine===webkit)continue;
  await check(engine,w,name);
}})().catch(e=>{console.error(e);process.exitCode=1});
