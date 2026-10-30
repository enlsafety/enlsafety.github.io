// Real sync handler and browser UI, with isolated records and no outbound delivery.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{
 let options={headless:true};
 if(process.env.ENL_QA_CHROMIUM==='sparticuz'){
  const {default:engine}=await import('@sparticuz/chromium');
  options={...options,executablePath:await engine.executablePath(),args:engine.args.filter(x=>!/(single-process|disable-web-security|allow-running-insecure-content)/.test(x))};
 }
 const f=await fixture(),browser=await chromium.launch(options);
 try{
  const base={id:'qa-view-only',siteId:'qa-site',category:'property',status:'approved',summary:'가상 사고',eventType:'접촉',occurredAt:'2026-10-01T01:00:00Z',registeredAt:'2026-10-14T01:00:00Z',createdAt:'2026-10-14T01:00:00Z',approvedAt:'2026-10-14T01:00:00Z',approvedBy:'QA 안전',reportDetails:{place:'QA'},photos:[],corrective:null,reportWorkflow:{phase:'report_approved',initialApprovalSource:'SAFETY_MANUAL_ARCHIVE'},recordMode:'historical_manual',historicalImport:{enabled:true,erpApproved:false,workflowExempt:false},_syncVersion:1};
  await f.db.query('insert into enl_incident_shared(incident_id,site_id,payload) values($1,$2,$3)',[base.id,base.siteId,JSON.stringify(base)]);
  const page=await browser.newPage(),errors=[],requests=[];let fail=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',async r=>{
   if(r.request().url()==='https://qa.test/')return r.fulfill({contentType:'text/html',body:'<div id="app"><main id="view">본사 사용자 설정</main></div><div id="modalRoot"></div>'});
   if(!r.request().url().includes('/enl-incident-sync-v411'))return r.abort();
   const body=r.request().postDataJSON();requests.push(body);
   if(fail&&body.action==='push')return r.abort();
   const result=await f.raw(body);
   return r.fulfill({status:result.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result.body)});
  });
  await page.goto('https://qa.test/');
  await page.evaluate(base=>{
   window.data={incidents:[base],users:[{id:'qa-executive',name:'QA 임원',role:'executive',email:'qa@example.invalid',emailEnabled:true}]};
   window.session={};window.currentView='users';window.currentUser=()=>({id:'qa-safety',name:'QA 안전',role:'safety',passwordHash:'qa-proof'});
   window.userById=id=>data.users.find(u=>u.id===id);window.saveData=()=>{};window.loadData=()=>data;window.render=()=>{};window.renderShell=()=>{};window.nowISO=()=>new Date().toISOString();window.siteById=()=>({name:'QA 사업장'});window.fmt=String;
   window.openModal=html=>{modalRoot.innerHTML='<div class="modal">'+html+'</div>'};window.closeModal=()=>{modalRoot.innerHTML=''};
   window.openIncidentModal=id=>openModal('<div class="modal-head">사고 상세</div><div class="modal-actions"></div>');
   window.qaAccountRequests=[];window.qaAccountFailure=false;
   window.enlAuthApi=async body=>{qaAccountRequests.push(body);if(qaAccountFailure)throw Error('network');return {ok:true,user:body.user}};
  },base);
  for(const file of ['incident-sync-v411.js','ui-stability-v422.js','sync-conflict-v428.js','incident-flow-v440.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
  await page.evaluate(()=>enlIncidentPullNow(false));
  const before=await page.evaluate(()=>structuredClone(data.incidents));
  await page.evaluate(()=>openIncidentModal(data.incidents[0].id));await page.locator('.wf440-stage').waitFor();
  const after=await page.evaluate(()=>structuredClone(data.incidents));
  assert.deepEqual(after,before,'viewing an approved report must not mutate stored incident fields');
  await page.evaluate(()=>{closeModal();openUserModal(data.users[0],currentUser())});
  await page.locator('#hqMail422').selectOption('0');await page.locator('#hqSave422').click();
  await page.waitForFunction(()=>!document.getElementById('hqUserForm422'));
  await page.evaluate(()=>enlIncidentSyncNow());
  assert.equal(await page.evaluate(()=>qaAccountRequests.at(-1).user.emailEnabled),false);
  assert.equal(await page.evaluate(()=>data.users[0].emailEnabled),false);
  assert.equal(requests.filter(r=>r.action==='push').length,0,'HQ account save must not write incident records');
  assert.equal(await page.locator('[data-enl-save-feedback]').count(),0);
  // A real failed incident write must remain visible and recoverable in settings.
  await page.evaluate(()=>{window.qaDraft={...structuredClone(data.incidents[0]),summary:'미저장 내용'}});
  fail=true;await page.evaluate(()=>enlCommitOrNotify(qaDraft));
  assert.match(await page.locator('[data-enl-save-feedback]').innerText(),/사고자료/);
  assert.match(await page.locator('[data-enl-save-feedback]').innerText(),/사용자 정보/);
  assert.equal(await page.locator('[data-enl-save-feedback] button').filter({hasText:'사고 내용 확인'}).count(),1);
  // Retry errors inside the actual report editor still show the original save warning.
  await page.evaluate(()=>openModal('<form id="unifiedReportForm"><input value="입력 유지"></form>'));
  await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('enl-incident-write-error',{detail:{id:'qa-view-only',message:'연결 실패',error:'network',draft:qaDraft},cancelable:true}))});
  assert.match(await page.locator('#unifiedReportForm [data-enl-save-feedback]').innerText(),/저장되지 않았습니다/);
  assert.equal(await page.locator('#unifiedReportForm input').inputValue(),'입력 유지');
  await page.evaluate(()=>closeModal());
  // Account failures must retain the form, with no success alert or incident writes.
  await page.evaluate(()=>{qaAccountFailure=true;openUserModal(data.users[0],currentUser())});
  await page.locator('#hqMail422').selectOption('1');await page.locator('#hqSave422').click();
  assert.equal(await page.locator('#hqSave422').isEnabled(),true);assert.equal(await page.locator('#hqMail422').inputValue(),'1');
  assert.equal(await page.evaluate(()=>data.users[0].emailEnabled),false);
  assert.deepEqual(errors,[]);console.log('PASS report read-only, HQ email OFF save isolation, real failure feedback and preserved account form');
 }finally{await browser.close();await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
