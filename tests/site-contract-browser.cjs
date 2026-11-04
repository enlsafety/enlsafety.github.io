// Real UI with isolated data; all network traffic denied.
const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{for(const [engine,width] of [[chromium,1280],[webkit,390]]){const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:900},timezoneId:'Asia/Seoul'});try{
 await page.route('**/*',r=>r.abort());await page.setContent('<html><head></head><body><div id="view"></div></body></html>');
 await page.evaluate(()=>{window.data={sites:[{id:'s01',name:'운영사업장'},{id:'s34',name:'파주CC'}],incidents:[]};window.esc=String;window.fmt=String;window.qaUser={id:'qa',name:'안전관리자',role:'safety'};window.currentUser=()=>qaUser;window.siteById=id=>data.sites.find(s=>s.id===id);window.currentView='report';window.renderShell=()=>document.getElementById('view');window.incidentPhotos=[];window.saveData=()=>{window.saved=true};window.alert=()=>{};window.confirm=()=>{window.confirmed=(window.confirmed||0)+1;return window.acceptWarning};window.uid=()=> 'isolated-'+data.incidents.length;window.ENL_SITE_MASTER_SEED=[{site_id:'s01',site_name:'운영사업장',active:true,start_date:'2026-01-01',contract_end_date:'2026-12-31'},{site_id:'s34',site_name:'파주CC',active:false,start_date:'2026-03',contract_end_date:'2026-04'}]});
 for(const f of ['style.css','report-v410.css'])await page.addStyleTag({content:fs.readFileSync(f,'utf8')});
 for(const f of ['site-contract-v451.js','required-fields-v453.js','incidents-v410.js','incident-stats-v426.js'])await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
 await page.evaluate(()=>{
  for(const [index,siteId] of ['s34','s34','s34','s01'].entries()){
   data.incidents.push({id:'qa-'+index,siteId,category:'property',status:'approved',occurredAt:'2026-03-15T01:00:00Z',photos:[],siteContractSnapshot:ENLContracts.capture(siteId,'2026-03-15',qaUser,false)});
  }
 });
 await page.evaluate(()=>enlRenderIncidentStats(document.getElementById('view'),qaUser,{year:2026}));assert.equal(await page.locator('#stats426Status').count(),0);assert.equal(await page.locator('#stats426Site').count(),0);assert.equal(await page.locator('#stats426Year').inputValue(),'2026');assert.equal(await page.locator('[data-stats-filter=all] b').innerText(),'1건');assert.equal(await page.evaluate(()=>data.incidents.filter(i=>i.siteId==='s34').length),3);assert.equal(await page.evaluate(()=>ENLContracts.closed('s34')),true);assert.ok(!(await page.locator('.stats426-sites').innerText()).includes('파주CC'));
 await page.locator('[data-stats-filter=all]').click();assert.equal(await page.locator('#stats426Drill [data-inc-id]').count(),1);
 await page.screenshot({path:`qa-output/contracts-${width}.png`,fullPage:true});console.log(`PASS: ${width}px historical records retained, dashboard active-site scope and drilldown`);
 }finally{await browser.close()}}})().catch(e=>{console.error(e);process.exit(1)});
