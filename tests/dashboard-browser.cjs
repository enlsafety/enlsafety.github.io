// Offline fixtures only. All network writes are denied; never creates production incidents.
const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
fs.mkdirSync('qa-output',{recursive:true});const browsers={chromium:await chromium.launch({headless:true}),webkit:await webkit.launch({headless:true})};
let activePage;try{for(const profile of [{engine:'chromium',width:1280,touch:false},{engine:'chromium',width:390,touch:true},{engine:'chromium',width:820,touch:true},{engine:'webkit',width:390,touch:true},{engine:'webkit',width:820,touch:true}]){
 const {width,engine,touch}=profile,browser=browsers[engine],page=await browser.newPage({viewport:{width,height:900},hasTouch:touch,isMobile:touch}),errors=[];activePage=page;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request();assert.equal(req.method(),'GET','No network mutation in QA');
  const path=new URL(req.url()).pathname.slice(1);
  if(path==='fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div></body></html>'});
  if(path==='korea-map-natural-earth-10m.svg')return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path)});
  return route.abort();
 });
 await page.goto('http://enl-qa.test/fixture');
 for(const path of ['style.css','v3.css','responsive-v432.css'])await page.addStyleTag({content:fs.readFileSync(path,'utf8')});
 await page.evaluate(()=>{
  window.app=document.getElementById('app');window.currentView='home';window.qaUser={id:'qa-safety',role:'safety',name:'안전관리자'};window.currentUser=()=>qaUser;
  window.data={sites:[],incidents:[]};window.roleName=x=>x;window.siteById=id=>data.sites.find(s=>s.id===id);window.fmt=x=>String(x).slice(0,10);window.statusBadge=x=>x;window.priorityBadge=x=>x||'';
  window.renderLogin=()=>{app.innerHTML='<div>LOGIN</div>'};window.saveSession=()=>{};
  window.enlIncidentTable=(arr,edit)=>'<div data-qa-table data-edit="'+edit+'">'+arr.map(i=>'<button data-inc-id="'+i.id+'">'+i.id+'</button>').join(',')+'</div>';window.enlOpenIncidentReview=(id,edit)=>{window.qaReview={id,edit}};
 });
 await page.addScriptTag({content:fs.readFileSync('site-locations-v450.js','utf8')});
 await page.evaluate(()=>{
  window.ENL_SITE_MASTER_SEED=Object.entries(ENL_SITE_LOCATIONS).map(([id,p])=>({site_id:id,site_name:id==='s29'?'캐슬렉스 제주':'사업장 '+id,address:p.address,regular_count:3,daily_count:2,total_count:5,manager_name:'소장',part_name:'파트장',clerk_name:'서무'}));
  ENL_SITE_MASTER_SEED.push({site_id:'s34',site_name:'파주CC',address:'',active:true});
  ENL_SITE_MASTER_SEED.push({site_id:'s99',site_name:'좌표 미확인 사업장',address:'확인 대기'});
  data.sites=ENL_SITE_MASTER_SEED.map(s=>({id:s.site_id,name:s.site_name}));
  const year=new Date().getFullYear();data.incidents=[{id:'urgent-prior-year',siteId:'s29',occurredAt:`${year-1}-01-01`,status:'approved',priority:'urgent'}, {id:'ordinary-current',siteId:'s01',occurredAt:`${year}-05-01`,status:'closed'}];
  window.enlIncidentApi=async ({action})=>{if(action!=='dashboard_read')throw Error('Mutation blocked');return {sites:ENL_SITE_MASTER_SEED,metrics:[...data.incidents,{siteId:'s01',occurredAt:`${year}-01-01`,status:'rejected',category:'person'}]}};
 });
 for(const path of ['app-shell-v411.js','reader-ui-v414.js','incident-stats-v426.js','workflow-enhancements-v432.js','site-dashboard-v450.js'])await page.addScriptTag({content:fs.readFileSync(path,'utf8')});
 await page.locator('[data-shell-view="stats"]').click();await page.locator('[data-sd450-kpis]').waitFor();
 assert.equal(await page.locator('.sd450-kpis>div').count(),7);assert.equal(await page.locator('[data-sd450-map]').count(),1);
 assert.ok(await page.locator('.sd450-map-img').evaluate(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.locator('[data-sd450-map-site]').count(),33);
 assert.equal(await page.locator('#sd450Site option[value="s34"]').count(),0);
 assert.ok((await page.locator('.sd450-map-note').innerText()).includes('파주CC'));
 for(const id of await page.evaluate(()=>Object.keys(ENL_SITE_LOCATIONS))){await page.locator('#sd450Site').selectOption(id);assert.ok((await page.locator('[data-sd450-summary]').innerText()).includes(await page.evaluate(id=>ENL_SITE_LOCATIONS[id].address,id)));}
 await page.locator('[data-sd450-map-site="s29"]').click();assert.ok((await page.locator('[data-sd450-summary]').innerText()).includes('고위험'));
 assert.equal(await page.locator('[data-sd450-map-site="s29"].high').count(),1);

 const circles=await page.locator('[data-sd450-map-site]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return {w:r.width,h:r.height,radius:s.borderRadius,min:s.minHeight}}));
 circles.forEach(c=>{assert.ok(Math.abs(c.w-c.h)<.1,`${engine}: marker must be circular, got ${c.w}x${c.h}`);assert.ok(c.h<=18.1,'touch button 44px rule must not stretch marker');assert.equal(c.radius,'50%')});
 // Screen-space separation, every requested close pair must be individually clickable.
 const centers=await page.locator('[data-sd450-map-site]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {id:b.dataset.sd450MapSite,x:r.x+r.width/2,y:r.y+r.height/2}}));
 centers.forEach((p,i)=>centers.slice(0,i).forEach(q=>assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=8.8,`${p.id}/${q.id} overlap at ${width}`)));
 for(const id of ['s05','s30','s15','s16','s24','s25']){await page.locator(`[data-sd450-map-site="${id}"]`).click();assert.equal(await page.locator('#sd450Site').inputValue(),id)}
 const viewport=page.locator('.sd450-map-viewport');await viewport.scrollIntoViewIfNeeded();const box=await viewport.boundingBox();
 const transform=()=>page.locator('.sd450-map-canvas').evaluate(x=>x.style.transform);
 const scale=async()=>parseInt(await page.locator('[data-map-scale]').innerText());
 const before=await transform();
 await page.mouse.move(box.x+box.width*.8,box.y+box.height*.8);await page.mouse.down();await page.mouse.move(box.x+box.width*.8-30,box.y+box.height*.8-25,{steps:5});await page.mouse.up();
 assert.notEqual(await transform(),before,'drag must pan even at 100%');
 const yBefore=await page.evaluate(()=>scrollY);
 await page.mouse.wheel(0,-100);await page.waitForFunction(()=>parseInt(document.querySelector('[data-map-scale]').textContent)>100);
 const zoomed=await scale();await page.mouse.wheel(0,100);await page.waitForFunction(z=>parseInt(document.querySelector('[data-map-scale]').textContent)<z,zoomed);
 assert.equal(await page.evaluate(()=>scrollY),yBefore,'wheel over map must not scroll page');
 await page.locator('[data-map-zoom="reset"]').click();
 if(touch){
  await viewport.scrollIntoViewIfNeeded();const b=await viewport.boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2;
  let send;
  if(engine==='chromium'){
   const cdp=await page.context().newCDPSession(page);
   send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:1,radiusY:1,force:1}))});
  }else{
   // WebKit exposes no native multi-touch injection through Playwright. Exercise
   // the same PointerEvent path here; actual touch routing also runs in Chromium.
   let last=[];
   send=async(type,points)=>{const previous=last;await viewport.evaluate((el,{type,points,previous})=>{
    if(type==='touchEnd'){for(const [id,x,y] of previous)el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y}));return;}
    for(const [id,x,y] of points){const existed=previous.some(p=>p[0]===id);el.dispatchEvent(new PointerEvent(existed?'pointermove':'pointerdown',{bubbles:true,pointerId:id,pointerType:'touch',button:0,buttons:1,clientX:x,clientY:y}))}
   },{type,points,previous});last=points};
  }
  const initial=await transform();
  await send('touchStart',[[1,cx,cy]]);await send('touchMove',[[1,cx+24,cy+20]]);await send('touchEnd',[]);
  assert.notEqual(await transform(),initial,'one-finger pan');
  const pageY=await page.evaluate(()=>scrollY);
  await send('touchStart',[[1,cx-35,cy],[2,cx+35,cy]]);
  await send('touchMove',[[1,cx-65,cy],[2,cx+65,cy]]);
  const enlarged=await scale();assert.ok(enlarged>150,'two fingers apart zoom in');
  await send('touchMove',[[1,cx-42,cy],[2,cx+42,cy]]);assert.ok(await scale()<enlarged,'two fingers together zoom out');
  await send('touchEnd',[]);assert.equal(await page.evaluate(()=>scrollY),pageY,'pinch keeps page stationary');
  assert.ok(await page.evaluate(()=>!visualViewport||Math.abs(visualViewport.scale-1)<.01),'pinch zooms map, not page');
 }
 await page.locator('[data-map-zoom="reset"]').click();assert.equal(await scale(),100);assert.equal(await page.locator('[data-map-zoom="out"]').isDisabled(),true);
 await page.locator('[data-map-zoom="in"]').click();assert.equal(await scale(),150);await page.locator('[data-map-zoom="reset"]').click();
 await page.locator('[data-sd450-map-site="s29"]').click();
 await page.screenshot({path:`qa-output/dashboard-${engine}-${width}.png`,fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 await page.locator('[data-sd450-open]').click();await page.locator('[data-sd450-info]').waitFor();
 assert.ok((await page.locator('[data-sd450-info]').innerText()).includes('캐슬렉스 제주'));
 assert.equal(await page.locator('[data-qa-table]').innerText(),'urgent-prior-year');
 await page.locator('[data-shell-view="incidents"]').click();assert.equal(await page.locator('[data-sd450-info]').count(),0,'no stale site profile on all incidents');
 await page.locator('[data-shell-view="home"]').click();assert.equal(await page.locator('[data-sd450-map]').count(),0);
 assert.equal(await page.locator('[data-safety-site="s34"]').count(),1,'ended site remains in historical incident view');
 await page.locator('[data-safety-site="s01"]').click();await page.locator('[data-sd450-info]').waitFor();assert.equal(await page.locator('[data-qa-table]').innerText(),'ordinary-current');
 await page.locator('[data-shell-view="stats"]').click();await page.locator('#sd450Site').selectOption('s99');assert.ok((await page.locator('[data-sd450-summary]').innerText()).includes('좌표 확인 필요'));
 await page.locator('#stats426Year').selectOption(String(new Date().getFullYear()-1));await page.locator('[data-sd450-map]').waitFor();assert.equal(await page.locator('[data-sd450-kpis]').count(),1);
 await page.locator('[data-stats-filter="all"]').click();assert.ok((await page.locator('#stats426Drill').innerText()).includes('1건'));

 const safetyKpis=await page.locator('.sd450-kpis').innerText();
 for(const role of ['manager','executive','final']){
  await page.evaluate(role=>{qaUser={id:role,role,name:'본사 조회자'};currentView='stats';renderShell(qaUser)},role);
  await page.locator('[data-sd450-map]').waitFor();await page.waitForFunction(()=>window.enlDashboardMetrics?.()!==null);
  assert.equal(await page.locator('[data-sd450-map-site]').count(),33);assert.equal(await page.locator('.sd450-kpis').innerText(),safetyKpis,'same company metrics for HQ');assert.equal(await page.locator('[data-stats-filter=all] b').innerText(),'2건');await page.locator('[data-stats-filter=all]').click();assert.equal(await page.locator('[data-stats-inc]').count(),1,'aggregate-only rejected record must not disclose details');
  await page.locator('[data-sd450-map-site="s29"]').click();await page.locator('[data-sd450-open]').click();await page.locator('[data-sd450-info]').waitFor();
  assert.equal(await page.locator('[data-qa-table]').getAttribute('data-edit'),'false');
  await page.locator('[data-inc-id="urgent-prior-year"]').click();assert.equal(await page.evaluate(()=>qaReview.edit),false,'existing review remains read-only');
 }
 for(const role of ['field','worker']){await page.evaluate(role=>{qaUser={id:role,role,name:'현장'};currentView='stats';renderShell(qaUser)},role);assert.equal(await page.locator('[data-sd450-map]').count(),0);assert.equal(await page.locator('[data-stats426-nav]').count(),0)}

 assert.deepEqual(errors,[]);console.log(`PASS: ${engine} ${width}px touch=${touch}, circular markers, minimal separation, drag/wheel/pinch, map, summary, risk, existing incident routing, filters, role guard`);await page.close();
}}catch(e){if(activePage){await activePage.screenshot({path:'qa-output/failure.png',fullPage:true}).catch(()=>{});fs.writeFileSync('qa-output/failure.json',JSON.stringify(await activePage.locator('[data-sd450-map-site]').evaluateAll(bs=>bs.map(b=>({id:b.dataset.sd450MapSite,rect:b.getBoundingClientRect().toJSON(),css:getComputedStyle(b).cssText}))).catch(()=>[]),null,2))}throw e}finally{await Promise.all(Object.values(browsers).map(b=>b.close()))}
})().catch(e=>{console.error(e);process.exit(1)});
