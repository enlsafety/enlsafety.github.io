'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{chromium,webkit}=require('playwright');
const HOST='https://enlsafety.github.io';
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
(async()=>{
 for(const profile of [{name:'desktop',engine:chromium,width:1360},{name:'iphone',engine:webkit,width:390}]){
  const browser=await profile.engine.launch({headless:true});let page;const unexpected=[],errors=[];
  try{
   page=await browser.newPage({viewport:{width:profile.width,height:880},isMobile:profile.width<500,hasTouch:profile.width<500,timezoneId:'Asia/Seoul'});
   page.on('pageerror',e=>errors.push(String(e.message)));
   page.on('dialog',d=>d.accept());
   page.on('request',r=>{const u=new URL(r.url());if(u.origin!==HOST)unexpected.push(r.url());});
   await page.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(url.origin!==HOST){unexpected.push(url.toString());return route.abort('blockedbyclient');}
     const rel=decodeURIComponent(url.pathname).slice(1);
     if(!rel||rel.includes('..')||!fs.existsSync(rel)||!fs.statSync(rel).isFile())return route.fulfill({status:404,body:'',contentType:'text/plain'});
     const body=fs.readFileSync(rel),ct=TYPES[path.extname(rel)]||'application/octet-stream';
     return route.fulfill({status:200,body,contentType:ct});
   });
   await page.goto(HOST+'/zerowiz-demo.html',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#zwFrame').getAttribute('src'),null,'demo runtime is not requested before PIN');
   assert.equal(await page.locator('#zwRolePanel').isVisible(),false,'role selector requires password');
   await page.locator('#zwPin').fill('0000');
   await page.locator('#zwPinForm button[type=submit]').click();
   assert.equal(await page.locator('#zwRolePanel').isVisible(),false,'wrong PIN never opens roles');
   assert.equal(await page.locator('#zwFrame').getAttribute('src'),null,'wrong PIN never loads demo');
   await page.locator('#zwPin').fill('6846');
   await page.locator('#zwPinForm button[type=submit]').click();
   await page.locator('[data-zw-entry-role="zw-safety"]').waitFor({state:'visible'});
   assert.equal(await page.locator('[data-zw-entry-role]').count(),5,'five demo roles available immediately after PIN');
   await page.locator('[data-zw-entry-role="zw-safety"]').click();
   const frame=page.frameLocator('iframe.frame');
   await frame.locator('.app-shell.shell-v411').waitFor({timeout:20000});
   assert.equal(await frame.locator('#loginName411').count(),0,'production login is never shown in demo');
   const desktop=profile.width>620,tools=frame.locator('#zwRuntimeControls'),toggle=frame.locator('#zwRuntimeToggle');
   if(desktop){
    assert.equal(await tools.isVisible(),false,'desktop toolbar is collapsed by default');
    assert.equal(await toggle.isVisible(),true,'desktop has a small launcher');
    const box=await toggle.boundingBox();
    assert.ok(box&&box.width<=130&&box.height<=50&&box.x>=profile.width-160&&box.y>700,'launcher stays compact at bottom right');
    await toggle.click();
    const opened=await frame.locator('#zwRuntimeToolbar').evaluate(el=>({expanded:el.dataset.expanded,aria:el.querySelector('#zwRuntimeToggle')?.getAttribute('aria-expanded'),display:getComputedStyle(el.querySelector('#zwRuntimeControls')).display}));
    assert.equal(await tools.isVisible(),true,'desktop toolbar opens on demand: '+JSON.stringify(opened));
    assert.equal(await frame.locator('#zwRuntimeReset').isVisible(),true,'reset remains available on demand');
    await toggle.press('Escape');
    assert.equal(await tools.isVisible(),false,'Escape closes desktop toolbar');
   }else{
    assert.equal(await toggle.isVisible(),false,'mobile toolbar launcher hidden');
    assert.equal(await tools.isVisible(),true,'mobile toolbar remains visible');
   }
   const switchRole=async id=>{
    if(desktop)await toggle.click();
    await frame.locator('#zwRuntimeRoleSelect').selectOption(id);
    if(desktop)assert.equal(await tools.isVisible(),false,'desktop closes after role switching');
   };
   assert.equal(await frame.locator('.app-shell.shell-v411').isVisible(),true,'entered directly as safety without extra login');
   const safetyView=await frame.locator('#view').innerText();
   assert.ok(safetyView.includes('사고 대시보드')||safetyView.includes('안전 대시보드')||safetyView.includes('전체 사업장 사고현황'),'real production safety dashboard is rendered: '+safetyView.slice(0,500));
   assert.ok(!safetyView.includes('소피아그린')&&!safetyView.includes('백양우리'),'real site names never shown');
   assert.ok(safetyView.includes('가상 솔빛 골프장'),'fake business appears in real safety site dashboard');
   await frame.locator('[data-sd450-map]').waitFor({timeout:16000});
   assert.ok(await frame.locator('[data-sd450-map-site]').count()>=3,'real production Korea map with synthetic site pins');
   assert.ok(await frame.locator('.shell411-nav').count()>0,'operational app nav present');
   const intro=await frame.locator('body').evaluate(()=>({origin:window.origin,api:window.ENL_ZEROWIZ_FIDELITY?.version,network:window.ENL_ZEROWIZ_FIDELITY?.getNetworkBlocks(),active:window.ENL_ZEROWIZ_FIDELITY?.getRole()}));
   assert.equal(intro.origin,'null','demo must run with opaque sandbox origin');
   assert.equal(intro.active,'zw-safety');
   assert.equal(intro.api,'2.0.2');
   await switchRole('zw-field');
   await frame.locator('.app-shell.shell-v411').waitFor();
   const fieldView=await frame.locator('body').innerText();
   assert.ok(fieldView.includes('가상 솔빛 골프장'),'operational field shell');
   await frame.locator('[data-field-task="accident_report"]').click();
   await frame.locator('[data-report-type="property"]').click();
   await frame.locator('#unifiedReportForm').waitFor({timeout:10000});
   assert.equal(await frame.locator('#environmentCause410,#behaviorCause410').count(),0,'actual field report excludes cause input');
   assert.ok(await frame.locator('.report410-section').count()>=3,'real report section styles and fields');
   await switchRole('zw-worker');
   await frame.locator('.app-shell.shell-v411').waitFor();
   assert.equal(await frame.locator('#zwRuntimeRoleSelect').inputValue(),'zw-worker');
   await switchRole('zw-manager');
   await frame.locator('.app-shell.shell-v411').waitFor();
   assert.ok(await frame.locator('#view').count()>0);
   await switchRole('zw-executive');
   await frame.locator('.app-shell.shell-v411').waitFor();
   // Entire operational script stack, including its decorators, must retain one report.
   await switchRole('zw-safety');
   await frame.locator('body').evaluate(()=>{window.qaAlerts=[];window.alert=m=>qaAlerts.push(m)});
   await frame.locator('body').evaluate(()=>openEditIncidentModal(data.incidents.find(i=>i.id==='ZW-005'),currentUser()));
   await frame.locator('#incidentHow410').fill('QA 전체 앱에서 사고경위 정정');await frame.locator('#safetyFactEditReason').fill('QA 원자료 재확인');
   await frame.locator('#unifiedReportForm button[type=submit]').click();await frame.locator('#unifiedReportForm').waitFor({state:'detached'});
   await frame.locator('body').evaluate(()=>openUnifiedCorrectiveModal('ZW-005',currentUser()));
   await frame.locator('#prev429PlanDetail').fill('QA 안내표지 설치');await frame.locator('#prev429Owner').fill('데모 현장소장');await frame.locator('#prev429Due').fill('2026-10-25');
   await frame.locator('#prev429PlanForm button[type=submit]').click();await frame.locator('#prev429PlanForm').waitFor({state:'detached'});
   await switchRole('zw-field');await frame.locator('body').evaluate(()=>openUnifiedCorrectiveModal('ZW-005',currentUser()));
   await frame.locator('#prev429ActionDetail').fill('QA 안내표지 설치 완료');await frame.locator('#prev429ActionDate').fill('2026-10-14');await frame.locator('#prev432CompletedDate').fill('2026-10-14');
   await frame.locator('#actionPhotoInput').setInputFiles({name:'qa-demo-evidence.png',mimeType:'image/png',buffer:fs.readFileSync('pwa-icon-192.png')});
   await frame.locator('body').evaluate(()=>new Promise(resolve=>{const check=()=>actionPhotos.length?resolve():requestAnimationFrame(check);check();}));
   await frame.locator('#prev429FieldForm button[type=submit]').click();await frame.locator('#prev429FieldForm').waitFor({state:'detached'});
   await switchRole('zw-safety');await frame.locator('body').evaluate(()=>openUnifiedCorrectiveModal('ZW-005',currentUser()));
   assert.equal(await frame.locator('[data-report-stage="A"]').count(),1);assert.equal(await frame.locator('[data-report-stage="B"]').count(),1);
   await frame.locator('#prev429Review').fill('QA 증빙 검토');await frame.locator('#prev429Approve').click();await frame.locator('#prev429ReviewForm').waitFor({state:'detached'});
   await frame.locator('body').evaluate(()=>enlOpenIncidentReview('ZW-005',true,currentUser()));
   await frame.locator('[data-excel421-id="ZW-005"]').waitFor();
   assert.equal(await frame.locator('body').evaluate(()=>data.incidents.find(i=>i.id==='ZW-005').status),'closed');
   await page.screenshot({path:'qa-output/full-app-cumulative-'+profile.name+'.png'});
   await frame.locator('body').evaluate(()=>closeModal());await switchRole('zw-executive');
   const state=await frame.locator('body').evaluate(()=>({role:window.ENL_ZEROWIZ_FIDELITY.getRole(),counts:window.ENL_ZEROWIZ_FIDELITY.getRecords().length,network:window.ENL_ZEROWIZ_FIDELITY.getNetworkBlocks()}));
   assert.equal(state.role,'zw-executive');assert.equal(state.counts,11);
   assert.deepEqual(unexpected,[],'must not send any request to operational Supabase or external URLs');
   assert.deepEqual(errors,[],'operational UI scripts execute without errors in demo sandbox');
   console.log('PASS zerowiz fidelity '+profile.name+' live application layouts, 5 roles, role switch, real accident form, offline sandbox, zero external requests, '+state.counts+' synthetic incidents');
  }catch(e){
   console.error('ALERT DIAG',await page.frameLocator('iframe.frame').locator('body').evaluate(()=>window.qaAlerts));console.error('FRAME DIAG',await page.frameLocator('iframe.frame').locator('body').innerText().catch(()=>''));console.error('DEMO UI DIAG',profile.name,String(e),{errors,unexpected},(await page?.locator('body')?.innerText().catch(()=>''))?.slice(0,1100));
   throw e;
  }finally{await page?.close();await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
