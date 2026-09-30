// Offline fixtures only. All network writes are denied; never creates production incidents.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
fs.mkdirSync('qa-output',{recursive:true});const browser=await chromium.launch({headless:true});
try{for(const width of [1280,820,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
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
  window.enlIncidentTable=arr=>'<div data-qa-table>'+arr.map(i=>i.id).join(',')+'</div>';
 });
 await page.addScriptTag({content:fs.readFileSync('site-locations-v450.js','utf8')});
 await page.evaluate(()=>{
  window.ENL_SITE_MASTER_SEED=Object.entries(ENL_SITE_LOCATIONS).map(([id,p])=>({site_id:id,site_name:id==='s29'?'캐슬렉스 제주':'사업장 '+id,address:p.address,regular_count:3,daily_count:2,total_count:5,manager_name:'소장',part_name:'파트장',clerk_name:'서무'}));
  ENL_SITE_MASTER_SEED.push({site_id:'s34',site_name:'파주CC',address:'',active:true});
  ENL_SITE_MASTER_SEED.push({site_id:'s99',site_name:'좌표 미확인 사업장',address:'확인 대기'});
  data.sites=ENL_SITE_MASTER_SEED.map(s=>({id:s.site_id,name:s.site_name}));
  const year=new Date().getFullYear();data.incidents=[{id:'urgent-prior-year',siteId:'s29',occurredAt:`${year-1}-01-01`,status:'approved',priority:'urgent'}, {id:'ordinary-current',siteId:'s01',occurredAt:`${year}-05-01`,status:'closed'}];
  window.enlIncidentApi=async ({action})=>{if(action!=='site_list')throw Error('Mutation blocked');return {sites:ENL_SITE_MASTER_SEED}};
 });
 for(const path of ['app-shell-v411.js','incident-stats-v426.js','site-dashboard-v450.js'])await page.addScriptTag({content:fs.readFileSync(path,'utf8')});
 await page.locator('[data-shell-view="stats"]').click();await page.locator('[data-sd450-kpis]').waitFor();
 assert.equal(await page.locator('.sd450-kpis>div').count(),7);assert.equal(await page.locator('[data-sd450-map]').count(),1);
 assert.ok(await page.locator('.sd450-map-img').evaluate(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.locator('[data-sd450-map-site]').count(),33);
 assert.equal(await page.locator('#sd450Site option[value="s34"]').count(),0);
 assert.ok((await page.locator('.sd450-map-note').innerText()).includes('파주CC'));
 for(const id of await page.evaluate(()=>Object.keys(ENL_SITE_LOCATIONS))){await page.locator('#sd450Site').selectOption(id);assert.ok((await page.locator('[data-sd450-summary]').innerText()).includes(await page.evaluate(id=>ENL_SITE_LOCATIONS[id].address,id)));}
 await page.locator('[data-sd450-map-site="s29"]').click();assert.ok((await page.locator('[data-sd450-summary]').innerText()).includes('고위험'));
 assert.equal(await page.locator('[data-sd450-map-site="s29"].high').count(),1);
 await page.screenshot({path:`qa-output/dashboard-${width}.png`,fullPage:true});
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
 await page.evaluate(()=>{qaUser={id:'manager',role:'manager',name:'관리자'};currentView='stats';renderShell(qaUser)});assert.equal(await page.locator('[data-sd450-map]').count(),0,'safety-only company map');
 assert.deepEqual(errors,[]);console.log(`PASS: ${width}px map, summary, risk, existing incident routing, filters, role guard`);await page.close();
}}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
