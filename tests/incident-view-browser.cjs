'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),{fixture}=require('./final-lifecycle.cjs'),{setup,migration}=require('./incident-view-push.cjs');
async function run(engine,width){
 let options={headless:true};if(process.env.ENL_QA_CHROMIUM==='sparticuz'){const {default:c}=await import('@sparticuz/chromium');options={...options,executablePath:await c.executablePath(),args:c.args.filter(x=>!/(single-process|disable-web-security|allow-running-insecure-content)/.test(x))};}
 const browser=await engine.launch(options),f=await fixture(),calls=[],errors=[];let fail=0,cases=0;
 try{
  await setup(f);await f.db.exec(migration);
  const incidents=[];for(const category of ['property','person'])for(const status of ['reported','supplement','supplement_submitted','approved','closed'])incidents.push({id:category+'-'+status,siteId:'qa-site',category,status,summary:'QA 가상 사고 경위',eventType:'접촉',priority:'normal',occurredAt:'2026-10-30T01:00:00Z',photos:[],reportDetails:{environmentCause:'가상 환경 원인',behaviorCause:'가상 행동 원인',causeAnalysisStatus:'analyzed'},corrective:{status:'approved'},_syncVersion:1});
  for(const id of ['retry','offline','hidden','urgent','click-only','dashboard'])incidents.push({...incidents[0],id,priority:id==='urgent'?'urgent':'normal'});
  const queue={...incidents[0],id:'approval-queue',status:'approved',executiveApproval:{state:'pending',mode:'parallel_then_president',round:1,stage:'president',finalApproverId:'qa-executive',roster:[{id:'qa-executive',position:'사장'}],signatures:[]}};incidents.push(queue);
  for(const i of incidents)await f.db.query('insert into enl_incident_shared(incident_id,site_id,payload) values($1,$2,$3)',[i.id,i.siteId,JSON.stringify(i)]);
  const count=async(id)=>(await f.db.query("select count(*)::int n from enl_push_events where kind='management_view_report' and incident_id=$1",[id])).rows[0].n;
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<1000,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.route('**/*',r=>r.request().url()==='https://qa.test/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="view"></main><div id="modalRoot"></div></body></html>'}):r.abort());await page.goto('https://qa.test/');
  await page.exposeFunction('qaAPI',async body=>{calls.push(body);if(fail){fail--;throw Error('offline simulation');}const r=await f.call(body.actor.role,body);if(r.status!==200)throw Error(r.body.message);return r.body;});
  await page.evaluate(incidents=>{
   window.qaUser={id:'qa-manager',name:'QA 본사',role:'manager'};window.currentUser=window.enlCurrentActor=()=>qaUser;window.data={incidents,sites:[{id:'qa-site',name:'QA 사업장'}]};window.currentView='home';window.session={};window.app=document.body;
   window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.siteById=id=>data.sites.find(s=>s.id===id);window.siteName=()=> 'QA 사업장';window.fmt=String;window.won=String;window.categoryBadge=window.priorityBadge=window.badge=()=>'';window.eventTypeOptions=()=>'';window.enlAttachmentGalleryHtml=()=>'';window.enlBindAttachmentOpen=()=>{};
   window.openModal=html=>modalRoot.innerHTML='<div class="modal-bg"><section class="modal">'+html+'</section></div>';window.closeModal=()=>modalRoot.innerHTML='';window.renderShell=()=>document.getElementById('view').innerHTML='';window.enlPushFlush=()=>{window.qaFlushes=(window.qaFlushes||0)+1};window.enlIncidentApi=b=>qaAPI(b);window.saveData=()=>{};
  },incidents);
  for(const file of ['style.css','report-v410.css'])await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
  for(const file of ['incidents-v410.js','report-v410.js','reader-ui-v414.js','push-session-v425.js','executive-approval-v482.js','approval-sheet-v486.js','management-approval-v448.js','incident-view-v485.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
  const waitSaved=async(id,viewer)=>{await page.waitForFunction(({id,viewer})=>window.qaSaved?.includes(id+':'+viewer),{id,viewer});};
  await page.evaluate(()=>{const base=enlIncidentApi;window.enlIncidentApi=async b=>{const r=await base(b);(window.qaSaved??=[]).push(b.incidentId+':'+b.actor.id);return r};});
  assert.equal(calls.length,0,'list loaded without detail does not count');
  await page.evaluate(()=>{const b=document.createElement('button');b.dataset.incId='click-only';b.click();document.body.appendChild(b);b.click();b.remove();});await page.waitForTimeout(200);assert.equal(calls.length,0,'unopened or synthetic row click does not count');
  for(const who of ['manager','executive'])for(const i of incidents.slice(0,10)){
   await page.evaluate(({who,id})=>{qaUser={id:'qa-'+who,role:who};enlOpenIncidentReview(id,false,qaUser)},{who,id:i.id});await waitSaved(i.id,'qa-'+who);assert.equal(await count(i.id),who==='manager'?1:2);cases++;
   if(i.category==='person')assert.equal(await page.locator('#modalRoot .modal').getAttribute('data-incident-view'),i.id,'masked person modal tracked');
   await page.evaluate(id=>{closeModal();data.incidents.find(x=>x.id===id)._syncVersion++;openIncidentModal(id)},i.id);await page.waitForTimeout(50);
  }
  assert.equal(calls.filter(b=>b.action==='view'&&b.incidentId==='person-reported').length,2,'reopen/revision no repeat per viewer');
  await page.evaluate(()=>{qaUser={id:'qa-manager',role:'manager'};closeModal();data.incidents.find(x=>x.id==='dashboard').occurredAt='2026-10-31';renderShell(qaUser)});await page.locator('[data-reader-open="dashboard"]').click();await waitSaved('dashboard','qa-manager');assert.equal(await count('dashboard'),1,'actual dashboard row recorded');
  await page.evaluate(()=>{qaUser={id:'qa-manager',role:'manager'};closeModal();enlOpenIncidentReview('urgent',false,qaUser)});await waitSaved('urgent','qa-manager');assert.equal(await count('urgent'),1,'urgent fallback recorded');
  await page.evaluate(()=>{qaUser={id:'qa-executive',role:'executive'};closeModal();renderShell()});await page.locator('[data-exec-open="approval-queue"]').click();await waitSaved('approval-queue','qa-executive');assert.equal(await count('approval-queue'),1,'approval queue recorded');
  await page.evaluate(()=>{closeModal();qaUser={id:'qa-manager',role:'manager'};modalRoot.style.display='none';openIncidentModal('hidden')});await page.waitForTimeout(150);assert.equal(await count('hidden'),0,'hidden modal not a view');await page.evaluate(()=>modalRoot.style.display='');await waitSaved('hidden','qa-manager');
  fail=1;await page.evaluate(()=>{closeModal();openIncidentModal('retry')});await waitSaved('retry','qa-manager');assert.equal(await count('retry'),1,'automatic network retry');assert.equal(calls.filter(b=>b.incidentId==='retry').length,2,'one failed then one successful request');
  fail=3;await page.evaluate(()=>{closeModal();openIncidentModal('offline')});await page.waitForTimeout(4400);assert.equal(await count('offline'),0,'failed requests not cached as viewed');await page.evaluate(()=>dispatchEvent(new Event('online')));await waitSaved('offline','qa-manager');assert.equal(await count('offline'),1,'online resumes failed view');
  await page.evaluate(()=>{closeModal();qaUser={id:'qa-safety',role:'safety'};openIncidentModal('click-only')});await page.waitForTimeout(150);assert.equal(await count('click-only'),0,'safety view excluded');
  assert.deepEqual(errors,[]);assert.equal(calls.some(b=>!['view'].includes(b.action)),false,'view never saves or approves accident');
  console.log('PASS first incident views',engine.name(),width,cases,'role/category/stage cases plus queue, urgent, retries, hidden, dedup');await context.close();
 }finally{await browser.close();await f.db.close();}
}
(async()=>{await run(chromium,1365);await run(process.env.ENL_QA_CHROMIUM==='sparticuz'?chromium:webkit,390)})().catch(e=>{console.error(e);process.exitCode=1});
