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
  const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{}),baseline=process.env.UI_BASELINE==='1';
  try{
    const {c,p}=await tab(browser,width,'safety');
    await p.locator('[data-stats426-nav]').click();await p.locator('.stats426-card').first().waitFor();
    await p.waitForFunction(()=>document.querySelector('.stats426-card b')?.textContent.includes('3'));
    await noOverflow(p);await image(p,name+'-dashboard');
    await p.locator('#sd450Site').selectOption('s01');
    await p.locator('[data-sd450-summary] [data-sd450-open]').waitFor();
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
    await p.locator('#backSafetyHome411').click();
    const quiet=p.locator('[data-safety-site="s03"]'),fold=p.locator('[data-fold="quiet"]');
    if(!baseline){
      assert.equal(await p.locator('.site-quiet-card:visible').count(),5);
      if(!await quiet.isVisible())await fold.locator('summary').click();
    }
    await quiet.scrollIntoViewIfNeeded();
    await p.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('[data-safety-site]'))window.qaSiteOrigin=scrollY},true));
    await quiet.click();
    await p.locator('#backSafetyHome411').waitFor();assert.ok((await p.locator('#view').innerText()).includes('0건'));
    if(!baseline){
      await p.locator('#backSafetyHome411').click();
      await quiet.waitFor();
      await p.waitForFunction(()=>Math.abs(scrollY-window.qaSiteOrigin)<5);
    }
    await p.locator('[data-lifecycle-closed]').click();
    if(!baseline){
      await p.locator('[data-closed-site]').selectOption('s02');
      await p.locator('[data-site-closed-records] [data-closed-pdf]').waitFor();
      await p.locator('[data-wf-inquiry-nav]').click();
      await p.locator('[data-inquiry-back]').click();
      await p.locator('[data-closed-site]').waitFor();
      const popupPromise=p.waitForEvent('popup');
      await p.locator('[data-closed-pdf]').first().click();
      const popup=await popupPromise;
      await popup.getByText('인쇄 / PDF로 저장',{exact:true}).waitFor();
      await popup.close();
    }
    await p.locator('[data-lifecycle-open="sample-3"]').click();
    await p.locator('[data-executive-record]').waitFor();
    await noOverflow(p);
    await image(p,name+'-closed');
    if(!baseline){
      await p.locator('[data-final-pdf]').waitFor();
      const popupPromise=p.waitForEvent('popup');
      await p.locator('[data-final-pdf]').click();
      const popup=await popupPromise;
      await popup.getByText('인쇄 / PDF로 저장',{exact:true}).waitFor();
      assert.equal(await popup.locator('link[href*="safety-ui"]').count(),0);
      if(engine===chromium)assert.ok((await popup.pdf({format:'A4'})).length>1000);
      await popup.close();
    }
    await c.close();
    const field=await tab(browser,width,'field');
    await field.p.locator('[data-field-task="accident_report"]').waitFor();
    await field.p.evaluate(()=>enlIncidentPullNow(false));
    await field.p.waitForFunction(()=>data.incidents.some(i=>i.id==='sample-1'&&i.corrective?.status==='planned'));
    await noOverflow(field.p);await image(field.p,name+'-field-home');
    await field.p.locator('[data-field-task="accident_report"]').click();await field.p.locator('button[data-report-type="person"]').click();
    await field.p.locator('#unifiedReportForm').waitFor();await noOverflow(field.p);await image(field.p,name+'-report');
    assert.equal(await field.p.locator('#occurredDate410').count(),1);
    if(!baseline){
      await field.p.locator('[data-photo-required="true"]').waitFor();
      assert.equal(await field.p.getByText('원본사진 저장',{exact:true}).count(),1);
      const cost=field.p.locator('#medicalCost410');
      await cost.fill('5000');assert.equal(await cost.inputValue(),'5,000');
      await cost.press('End');await cost.press('0');assert.equal(await cost.inputValue(),'50,000');
    }
    await field.p.locator('[data-report-home]').click();
    await field.p.locator('[data-field-task="accident_action"]').click();
    await field.p.waitForFunction(()=>data.incidents.some(i=>i.id==='sample-1'&&i.corrective?.status==='planned'));
    await field.p.evaluate(()=>openUnifiedCorrectiveModal('sample-1',currentUser()));
    const form=field.p.locator('#prev429FieldForm');await form.waitFor();
    await form.locator('#prev429ActionDate').scrollIntoViewIfNeeded();
    await noOverflow(field.p);
    assert.ok(await form.locator('input[type=date]').evaluateAll(inputs=>inputs.every(el=>{
      const box=el.getBoundingClientRect(),parent=el.closest('form').getBoundingClientRect();
      return box.left>=parent.left-1&&box.right<=parent.right+1;
    })));
    await image(field.p,name+'-action');
    await field.c.close();console.log('PASS',name,'dashboard, site counts and drill-down, field reporting, viewport');
  } finally { await browser.close(); }
}
async function workflowListsAndFiles(browser,role){
  const incidents=Array.from({length:8},(_,n)=>({...cases[2],id:'closed-'+n,siteId:'s0'+(n+1),
    occurredAt:'2026-10-'+(10+n)+'T04:10:00Z',closedAt:'2026-10-'+(28-n)+'T04:10:00Z'}));
  const {p,c}=await tab(browser,390,role,incidents);
  p.on('dialog',async d=>{console.error(role,d.message());await d.dismiss()});
  try{
    await p.evaluate(()=>enlIncidentPullNow(false));
    await p.locator('[data-shell-view="home"]').click();
    const recent=p.locator('[data-safety-inc]:visible'),active=p.locator('.site-report-card:visible');
    assert.equal(await recent.count(),5);assert.equal(await recent.first().getAttribute('data-safety-inc'),'closed-7');
    assert.equal(await active.count(),5);assert.equal(await active.first().getAttribute('data-safety-site'),'s08');
    for(const key of ['recent','active']){
      const summary=p.locator('[data-fold="'+key+'"] summary');
      await summary.focus();await summary.press('Enter');assert.equal(await (key==='recent'?recent:active).count(),8);await summary.press('Enter');
    }
    const nav=p.locator('.shell411-nav');
    assert.ok(await nav.evaluate(n=>n.scrollWidth<=n.clientWidth+1 && [...n.querySelectorAll('button')].every(b=>b.getBoundingClientRect().right<=innerWidth+1)));
    await p.locator('[data-lifecycle-closed]').click();
    const rows=p.locator('[data-lifecycle-open]:visible');
    assert.equal(await rows.count(),5);assert.equal(await rows.first().getAttribute('data-lifecycle-open'),'closed-0');
    await p.locator('[data-fold="closed"] summary').click();assert.equal(await rows.count(),8);
    const save=async(locator)=>{
      const waiting=p.waitForEvent('download',{timeout:8000});
      await locator.click();const dl=await waiting;return fs.readFileSync(await dl.path());
    };
    const outside=await save(p.locator('[data-closed-xlsx="closed-0"]'));
    await rows.first().click();
    const inside=await save(p.locator('[data-official439-excel]'));
    // ZIP storage is uncompressed. Ignore time-varying package metadata and CRC.
    const {execFileSync}=require('node:child_process'),os=require('node:os');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enl-workbook-'));
    try{
      fs.writeFileSync(path.join(dir,'outside.xlsx'),outside);fs.writeFileSync(path.join(dir,'inside.xlsx'),inside);
      execFileSync('python3',['-c',
        "import zipfile,sys; a,b=[zipfile.ZipFile(sys.argv[1]+'/'+n+'.xlsx') for n in ('outside','inside')]; assert a.namelist()==b.namelist(); assert all(a.read(n)==b.read(n) for n in a.namelist() if n!='docProps/core.xml'); assert '최종 사고보고서' in a.read('xl/workbook.xml').decode()",dir]);
    }finally{fs.rmSync(dir,{recursive:true,force:true})}
    console.log('PASS',role,'five-item ordering, mobile menu and matching closed list/modal XLSX');
  }finally{await c.close()}
}
(async()=>{for(const [engine,w,name] of [[chromium,1440,'desktop'],[chromium,390,'mobile'],[chromium,820,'tablet'],[webkit,390,'iphone-webkit']]){
  if(process.env.UI_CHROMIUM_ONLY&&engine===webkit)continue;
  await check(engine,w,name);
}
  if(process.env.UI_BASELINE!=='1'){
    const b=await chromium.launch(process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});
    try{for(const role of ['safety','manager','executive'])await workflowListsAndFiles(b,role)}finally{await b.close()}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
