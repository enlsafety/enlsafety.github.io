'use strict';
// Real forms -> real Edge handler -> isolated PostgreSQL. No operational calls.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./final-lifecycle.cjs'),{chromium,webkit}=require('playwright');
const profiles=[{name:'desktop',engine:chromium,width:1365},{name:'android',engine:chromium,width:412},{name:'iphone',engine:webkit,width:390},{name:'tablet',engine:webkit,width:820}];
(async()=>{fs.mkdirSync('qa-output',{recursive:true});for(const p of profiles.filter(p=>!process.env.QA_CHROMIUM_ONLY||p.engine===chromium)){
 const f=await fixture(),browser=await p.engine.launch({headless:true}),page=await browser.newPage({viewport:{width:p.width,height:900},hasTouch:p.width<1000,isMobile:p.width<1000,timezoneId:'Asia/Seoul'});const errors=[],alerts=[];
 try{
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept()});
  await page.route('**/*',r=>r.request().url()==='https://enl-cumulative.test/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="view"></div><div id="modalRoot"></div></body></html>'}):r.abort());
  await page.goto('https://enl-cumulative.test/');
  await page.exposeFunction('qaApi',async(who,body)=>{const r=await f.call(who,body);if(r.status!==200)throw Error(r.body.message);return r.body});
  for(const file of ['style.css','v3.css','report-v410.css','responsive-v432.css'])await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
  await page.evaluate(()=>{
   window.data={incidents:[],sites:[{id:'qa-site',name:'QA 가상 사업장'}],users:[]};window.currentView='report';window.incidentPhotos=[];window.actionPhotos=[];
   window.qaUser={id:'qa-field',name:'QA 현장',role:'field',position:'현장소장',siteId:'qa-site'};window.currentUser=()=>qaUser;window.session={};
   window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.fmt=v=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});window.siteById=id=>data.sites.find(s=>s.id===id);window.siteName=id=>siteById(id)?.name||id;
   window.won=String;window.roleName=String;window.nowISO=()=>new Date().toISOString();window.uid=()=>crypto.randomUUID();window.eventTypeOptions=v=>'<option value="접촉" '+(v==='접촉'?'selected':'')+'>접촉</option>';window.computePriority=()=> 'normal';window.computeLegalReview=()=>false;
   for(const name of ['categoryBadge','priorityBadge','legalBadge','actionBadge','badge','statusBadge'])window[name]=()=>'';
   window.saveData=()=>{};window.renderShell=()=>{if(currentView==='report')renderUnifiedReport(document.getElementById('view'),currentUser());else document.getElementById('view').innerHTML='<p>사고목록</p>';};
   window.openModal=html=>{document.getElementById('modalRoot').innerHTML='<div class="modal-bg"><div class="modal">'+html+'</div></div>';document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal)};window.closeModal=()=>document.getElementById('modalRoot').innerHTML='';
   window.enlAttachmentGalleryHtml=files=>files.map((x,n)=>'<button type="button" data-file="'+n+'">'+esc(x.name)+'</button>').join('');
   window.openedFiles=[];window.enlBindAttachmentOpen=(root,files)=>root.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>openedFiles.push(files[Number(b.dataset.file)].name));window.enlPersistAttachment=x=>x;
   window.photoPickerHtml=kind=>'<div class="photo-box"><input type="file" id="'+kind+'Upload" multiple><div id="'+kind+'Thumbs"></div></div>';
   window.renderPhotoThumbs=kind=>{const root=document.getElementById(kind+'Thumbs');if(root)root.innerHTML=(kind==='action'?actionPhotos:incidentPhotos).map(x=>'<span>'+esc(x.name)+'</span>').join('')};
   window.bindPhotoButtons=()=>{for(const kind of ['incident','action']){const el=document.getElementById(kind+'Upload');if(el)el.onchange=()=>{const files=[...el.files].map(x=>({name:x.name,mime:x.type,path:kind+'/site-qa-site/'+x.name}));if(kind==='incident')incidentPhotos.push(...files);else actionPhotos.push(...files);renderPhotoThumbs(kind);};}};
   window.enlAcceptSavedIncident=saved=>{const n=data.incidents.findIndex(i=>i.id===saved.id);if(n<0)data.incidents.push(saved);else data.incidents[n]=saved;};
   window.enlIncidentApi=body=>qaApi(currentUser().role,body);
   window.enlCommitOrNotify=async record=>{try{const next={...record,_syncBaseVersion:record._syncVersion||0,_syncMutationId:crypto.randomUUID()};const r=await qaApi(currentUser().role,{action:'push',incidents:[next]});if(!r.incidents?.length)throw Error('not_saved');enlAcceptSavedIncident(r.incidents[0]);return true;}catch(e){alert(e.message);return false;}};
  });
  for(const file of ['incidents-v410.js','report-v410.js','workflow-prevention-v429.js','closed-incident-reopen-v438.js','incident-flow-v440.js','required-fields-v453.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
  const setRole=role=>page.evaluate(role=>{qaUser=role==='safety'?{id:'qa-safety',name:'QA 안전',role:'safety',position:'안전관리자'}:{id:'qa-field',name:'QA 현장',role:'field',position:'현장소장',siteId:'qa-site'};},role);
  const get=async()=> (await f.call('safety',{action:'pull'})).body.incidents[0];
  const openAction=()=>page.evaluate(()=>openUnifiedCorrectiveModal(data.incidents[0].id,currentUser()));
  const assertStage=async stage=>{await page.locator('[data-report-stage="'+stage+'"]').waitFor();await page.waitForFunction(stage=>{const t=document.querySelector('#modalRoot [data-report-stage="'+stage+'"]');return t&&t.getBoundingClientRect().top>=0&&t.getBoundingClientRect().top<500;},stage);assert.equal(await page.locator('#modalRoot [data-report-stage="A"] input').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BODY');};
  await page.evaluate(()=>enlOpenIncidentReport('property',currentUser()));
  for(const [id,v] of Object.entries({occurredDate410:'2026-10-13',occurredTime410:'10:20',incidentPlace410:'QA 진입로',workAction410:'QA 이동 중',incidentHow410:'QA 시설 접촉',immediateAction:'QA 작업 중지',damagedItem410:'QA 표지판',damageDetail410:'QA 파손'}))await page.locator('#'+id).fill(v);
  await page.locator('#eventType').selectOption('접촉');
  await page.locator('#incidentUpload').setInputFiles({name:'사고사진.png',mimeType:'image/png',buffer:fs.readFileSync('pwa-icon-192.png')});
  await page.locator('#unifiedReportForm button[type=submit]').click();await page.locator('#unifiedReportForm').waitFor({state:'detached'});const id=(await get()).id;
  assert.equal((await get()).occurredAt,'2026-10-13T01:20:00.000Z');
  // Same form, same ID, date/photo preserved, one record after resubmission.
  await page.evaluate(()=>enlEditIncidentInReportForm(data.incidents[0],currentUser()));
  assert.equal(await page.locator('#incidentHow410').inputValue(),'QA 시설 접촉');assert.equal(await page.locator('#occurredDate410').inputValue(),'2026-10-13');assert.equal(await page.locator('#incidentThumbs').innerText(),'사고사진.png');
  await page.locator('#incidentHow410').fill('QA 현장 수정 경위');await page.locator('#unifiedReportForm button[type=submit]').click();await page.locator('#unifiedReportForm').waitFor({state:'detached'});
  assert.equal((await get()).id,id);assert.equal((await f.db.query('select count(*)::int n from enl_incident_shared')).rows[0].n,1);
  // Safety edits A+B in the same form before approval.
  await setRole('safety');await page.evaluate(()=>enlEditIncidentInReportForm(data.incidents[0],currentUser()));
  await page.locator('#wf440EnvironmentCause').fill('QA 확인된 협소 동선');await page.locator('#wf440BehaviorCause').fill('QA 회전반경 확인 누락');await page.locator('#wf440CauseAnalysisNote').fill('QA 사진 대조');await page.locator('#wf440CausePending').uncheck();await page.locator('#safetyFactEditReason').fill('QA 원인 확인');
  await page.locator('#unifiedReportForm button[type=submit]').click();await page.locator('#unifiedReportForm').waitFor({state:'detached'});assert.equal((await get()).reportDetails.environmentCause,'QA 확인된 협소 동선');
  await page.evaluate(()=>enlOpenIncidentReview(data.incidents[0].id,true,currentUser()));await page.locator('[data-wf440-final]').click();await page.locator('[data-wf440-final]').waitFor({state:'detached'});const approved=await get();assert.equal(approved.status,'approved');
  // Approved correction must use the very same form, audit server snapshot, preserve B.
  await page.evaluate(()=>openEditIncidentModal(data.incidents[0],currentUser()));
  await page.locator('#unifiedReportForm').waitFor();assert.equal(await page.locator('#wf440EnvironmentCause').inputValue(),'QA 확인된 협소 동선');
  await page.locator('#occurredDate410').fill('2026-10-12');await page.locator('#safetyFactEditReason').fill('QA 원자료 날짜 정정');
  await page.locator('#unifiedReportForm button[type=submit]').click();await page.locator('#unifiedReportForm').waitFor({state:'detached'});let saved=await get();assert.equal(saved.approvedAt,approved.approvedAt);assert.equal(saved.approvedBy,approved.approvedBy);assert.equal(saved.reportDetails.causeAnalysisNote,'QA 사진 대조');assert.equal(saved.officialRecord.revisionNumber,1);
  // C opens at current work, with A+B above and preserved attachment binding.
  await openAction();await assertStage('C');assert.ok((await page.locator('[data-report-stage="B"]').innerText()).includes('QA 확인된 협소 동선'));
  await page.locator('#prev429RootCause').fill('QA 동선 중첩');await page.locator('#prev429PlanDetail').fill('QA 안내표지 설치');await page.locator('#prev429Owner').fill('QA 현장');await page.locator('#prev429Due').fill('2026-10-20');
  await page.locator('#prev429PlanForm button[type=submit]').click();await page.locator('#prev429PlanForm').waitFor({state:'detached'});await openAction();assert.equal(await page.locator('#prev429PlanDetail').inputValue(),'QA 안내표지 설치');await page.evaluate(()=>closeModal());
  // D restores tab draft and uploaded files when reopened; ABC never contain controls.
  await setRole('field');await openAction();await assertStage('D');await page.locator('#prev429ActionDetail').fill('QA 안내표지 설치 완료');await page.locator('#prev429ActionDate').fill('2026-10-14');await page.locator('#prev432CompletedDate').fill('2026-10-14');
  await page.locator('#actionUpload').setInputFiles({name:'조치증빙.png',mimeType:'image/png',buffer:fs.readFileSync('pwa-icon-192.png')});await page.waitForFunction(()=>sessionStorage.length>0);await page.evaluate(()=>closeModal());await openAction();assert.equal(await page.locator('#prev429ActionDetail').inputValue(),'QA 안내표지 설치 완료');assert.ok((await page.locator('#actionThumbs').innerText()).includes('조치증빙.png'));
  await page.locator('#prev429FieldForm button[type=submit]').click();await page.locator('#prev429FieldForm').waitFor({state:'detached'});saved=await get();assert.equal(saved.corrective.submissions.length,1);assert.equal(saved.corrective.actionCompletedDate,'2026-10-14');
  await setRole('safety');await openAction();await assertStage('D');assert.equal(await page.locator('[data-report-stage="D"]').evaluate(el=>el.classList.contains('report410-active-orange')),true);
  await page.locator('[data-report-files="photos"] [data-file]').click();await page.locator('[data-report-files="action"] [data-file]').click();assert.deepEqual(await page.evaluate(()=>openedFiles),['사고사진.png','조치증빙.png']);
  await page.locator('#prev429Review').fill('QA 완료 위치 사진 추가');await page.locator('#prev429Reject').click();await page.locator('#prev429ReviewForm').waitFor({state:'detached'});
  await setRole('field');await openAction();assert.equal(await page.locator('#prev429ActionDetail').inputValue(),'QA 안내표지 설치 완료');assert.ok((await page.locator('[data-report-stage="D"]').innerText()).includes('QA 완료 위치 사진 추가'));
  await page.locator('#prev429ActionDetail').fill('QA 안내표지 설치 완료 및 추가 위치 확인');await page.locator('#actionUpload').setInputFiles({name:'추가증빙.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA')});await page.locator('#prev429FieldForm button[type=submit]').click();await page.locator('#prev429FieldForm').waitFor({state:'detached'});
  saved=await get();assert.equal(saved.corrective.submissions.length,2);assert.equal(saved.corrective.submissions[0].actionDetail,'QA 안내표지 설치 완료');assert.equal(saved.corrective.submissions[0].afterPhotos.length,1);assert.equal(saved.corrective.afterPhotos.length,2);
  await setRole('safety');await openAction();await assertStage('D');await page.locator('#prev429Review').fill('QA 이행내용 및 증빙 확인');await page.screenshot({path:'qa-output/cumulative-'+p.name+'.png'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,'no horizontal overflow');await page.locator('#prev429Approve').click();await page.locator('#prev429ReviewForm').waitFor({state:'detached'});
  saved=await get();assert.equal(saved.status,'closed');assert.equal(saved.id,id);assert.equal(saved.reportDetails.environmentCause,'QA 확인된 협소 동선');assert.equal(saved.approvedAt,approved.approvedAt);assert.equal(saved.corrective.planDetail,'QA 안내표지 설치');assert.equal(saved.corrective.reviewedBy,'QA 안전');
  await page.evaluate(async()=>{data.incidents=(await qaApi('safety',{action:'pull'})).incidents;enlOpenIncidentReview(data.incidents[0].id,true,currentUser());});assert.equal(await page.locator('[data-report-stage="A"]').count(),1);assert.equal(await page.locator('[data-report-stage="E"]').count(),1);
  assert.deepEqual(errors,[]);console.log('PASS cumulative A-E actual browser + isolated server:',p.name,'same form, preservation, scroll, draft, attachment scopes, correction audit, resubmission snapshots, closure');
 }catch(e){console.error('ALERTS',p.name,alerts, 'ERRORS',errors, 'INVALID',await page.locator(':invalid').evaluateAll(xs=>xs.map(x=>({id:x.id,value:x.value,message:x.validationMessage}))));throw e;}finally{await browser.close();await f.db.close();}
}})().catch(e=>{console.error(e);process.exitCode=1});
