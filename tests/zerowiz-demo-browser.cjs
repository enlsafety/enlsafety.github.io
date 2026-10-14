(function browserSource(){
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright');
const ORIGIN='https://enl-vendor-qa.test';
async function run(profile){
 const browser=await profile.engine.launch({headless:true}),page=await browser.newPage({viewport:{width:profile.width,height:850},isMobile:profile.width<700,hasTouch:profile.width<700});
 const errs=[],unexpected=[],visited=[];
 const role=async r=>{await page.locator('[data-logout]').click();await page.locator(`[data-role="${r}"]`).click()};
 const open=async id=>{await page.locator('nav [data-nav="incidents"]').click();await page.locator(`[data-open="${id}"]`).click()};
 const state=()=>page.evaluate(()=>window.ENL_ZEROWIZ_DEMO.getState());
 try{
  page.on('pageerror',e=>errs.push(e.message));
  page.on('request',r=>{const u=new URL(r.url());visited.push(u.pathname);if(u.origin!==ORIGIN||!['/zerowiz-demo.html','/zerowiz-demo.js','/zerowiz-demo.css'].includes(u.pathname))unexpected.push(r.url())});
  page.on('dialog',d=>d.accept());
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.origin!==ORIGIN||!['/zerowiz-demo.html','/zerowiz-demo.js','/zerowiz-demo.css'].includes(u.pathname)){unexpected.push(u.toString());return r.abort('blockedbyclient')}
   const f=u.pathname.slice(1),type=f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':'text/css';
   return r.fulfill({status:200,contentType:type,body:fs.readFileSync(f,'utf8')});
  });
  await page.goto(ORIGIN+'/zerowiz-demo.html');
  await page.locator('.role-card').first().waitFor();
  assert.equal(await page.locator('.role-card').count(),5);
  assert.equal(await page.locator('#zerowizDemoEntry').count(),0,'demo itself does not import operational login');
  assert.equal(await page.evaluate(()=>ENL_ZEROWIZ_DEMO.storageMode),'session-only');

  // Field manager: report an accident. Cause fields are intentionally absent.
  await page.locator('[data-role="field"]').click();
  await page.locator('nav [data-nav="new"]').click();
  assert.equal(await page.locator('#demoForm [name="environmentCause"],#demoForm [name="behaviorCause"]').count(),0);
  await page.locator('#demoForm [name="summary"]').fill('QA 제로위즈 현장 사고등록');
  await page.locator('#demoForm [name="place"]').fill('가상 8홀 카트 도로');
  await page.locator('#demoForm [name="workAction"]').fill('작업차량 이동');
  await page.locator('#demoForm [name="incidentHow"]').fill('시설물과 접촉 후 작업 중지');
  await page.locator('#demoForm [name="immediateAction"]').fill('현장 통제');
  await page.locator('#demoForm [name="damageDetail"]').fill('가상 표지판 손상');
  await page.locator('#demoForm button[type="submit"]').click();
  let items=(await state()).incidents,created=items.find(i=>i.summary==='QA 제로위즈 현장 사고등록');
  assert.ok(created,'field report saved only in demo memory');
  assert.equal(created.status,'reported');
  assert.equal(created.reportDetails.causeAnalysisStatus,'not_reviewed');
  assert.equal(await page.locator('[data-action="cause"]').count(),0,'field must not edit cause');
  const id=created.id;

  // Safety: approval must fail before cause review, then succeed after analysis.
  await role('safety');await open(id);
  await page.locator('[data-action="approve"]').click();
  assert.match(await page.locator('[role="status"]').innerText(),/승인 불가/);
  assert.equal((await state()).incidents.find(i=>i.id===id).status,'reported');
  await page.locator('[data-action="cause"]').click();
  await page.locator('#demoForm [name="environmentCause"]').fill('작업구역 시설물과 통행 동선이 겹친 사실 확인');
  await page.locator('#demoForm [name="behaviorCause"]').fill('차량 이동 전 회전반경 확인 누락');
  await page.locator('#demoForm button[type="submit"]').click();
  assert.equal((await state()).incidents.find(i=>i.id===id).reportDetails.causeAnalysisStatus,'analyzed');
  await page.locator('[data-action="approve"]').click();
  items=(await state()).incidents;
  const approved=items.find(i=>i.id===id);
  assert.equal(approved.status,'approved');assert.ok(approved.approvedAt);
  await page.locator('[data-action="plan"]').click();
  await page.locator('#demoForm [name="rootCause"]').fill('가상 시설물 배치 부적절');
  await page.locator('#demoForm [name="planDetail"]').fill('장비 동선 구분 및 표지 위치 조정');
  await page.locator('#demoForm button[type="submit"]').click();
  assert.equal((await state()).incidents.find(i=>i.id===id).corrective.status,'planned');

  // Field manager: evidence submission -> safety final closure.
  await role('field');await open(id);
  await page.locator('[data-action="action-submit"]').click();
  await page.locator('#demoForm [name="actionDetail"]').fill('가상 동선 경계 표지 설치 완료');
  await page.locator('#demoForm [name="actionOwner"]').fill('데모 현장소장');
  await page.locator('#demoForm [name="evidence"]').check();
  await page.locator('#demoForm button[type="submit"]').click();
  assert.equal((await state()).incidents.find(i=>i.id===id).corrective.status,'submitted');
  await role('safety');await open(id);
  await page.locator('[data-action="action-approve"]').click();
  let closed=(await state()).incidents.find(i=>i.id===id);
  assert.equal(closed.status,'closed');assert.ok(closed.closedAt);
  const original={approvedAt:closed.approvedAt,closedAt:closed.closedAt};

  // After approval / closure: safety correction must preserve originals and append audit.
  await page.locator('[data-action="correction"]').click();
  await page.locator('#demoForm [name="environmentCause"]').fill('추가 사진 검토 후 시설물 고정상태 불량 확인');
  await page.locator('#demoForm [name="reason"]').fill('추가 확보 사진으로 환경 요인 재분석');
  await page.locator('#demoForm button[type="submit"]').click();
  closed=(await state()).incidents.find(i=>i.id===id);
  assert.equal(closed.status,'closed');
  assert.equal(closed.approvedAt,original.approvedAt);
  assert.equal(closed.closedAt,original.closedAt);
  assert.equal(closed.revisions.length,1);
  assert.equal(closed.revisions[0].reason,'추가 확보 사진으로 환경 요인 재분석');
  assert.ok(closed.revisions[0].changes.some(c=>c.field==='reportDetails.environmentCause'&&c.before.includes('동선')&&c.after.includes('고정상태')));
  assert.match(await page.locator('#demoMain').innerText(),/승인 후 변경 이력/);

  // Pending analysis is explicitly allowed, without inventing a confirmed cause.
  await open('DEMO-002');
  await page.locator('[data-action="cause"]').click();
  await page.locator('#demoForm [name="pending"]').check();
  await page.locator('#demoForm button[type="submit"]').click();
  await page.locator('[data-action="approve"]').click();
  const pending=(await state()).incidents.find(i=>i.id==='DEMO-002');
  assert.equal(pending.status,'approved');assert.equal(pending.reportDetails.causeAnalysisStatus,'investigating');

  // HQ and executive accounts are read-only and see restricted medical details.
  for(const user of ['manager','executive']){
   await role(user);await open('DEMO-002');
   assert.equal(await page.locator('[data-action]').count(),0,'HQ reader has no mutation actions');
   assert.match(await page.locator('#demoMain').innerText(),/의료·개인정보 제한/);
  }
  await role('worker');
  await page.locator('nav [data-nav="incidents"]').click();
  assert.equal(await page.locator(`[data-open="${id}"]`).count(),0,'worker cannot see manager incident');
  assert.ok(await page.locator('[data-open="DEMO-002"]').count()>0,'worker can see own incident');

  // Role switching remains in same tab; reset restores original demo fixtures.
  await page.locator('[data-reset]').click();
  const reset=await state();
  assert.equal(reset.incidents.length,11);assert.ok(!reset.incidents.some(i=>i.id===id));
  const storage=await page.evaluate(()=>({demoKeys:Object.keys(sessionStorage),localKeys:Object.keys(localStorage)}));
  assert.ok(storage.demoKeys.every(x=>x.startsWith('enl_zerowiz_demo_')),'no production session storage keys touched');
  assert.deepEqual(storage.localKeys,[],'production localStorage untouched');
  assert.deepEqual(errs,[],'no page errors');
  assert.deepEqual(unexpected,[],'no operational or unexpected network requests');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'mobile width/layout stable');
  fs.mkdirSync('qa-output',{recursive:true});
  await page.screenshot({path:'qa-output/zerowiz-demo-'+profile.name+'.png',fullPage:true});
  console.log('PASS zerowiz demo '+profile.name+': 5 accounts, offline workflow, field-to-safety approval, plan/action/closure, correction audit, read-only roles, reset, no backend requests');
 }finally{await browser.close()}
}
(async()=>{for(const p of [{engine:chromium,name:'desktop',width:1280},{engine:webkit,name:'iphone',width:390}])await run(p)})().catch(e=>{console.error(e);process.exitCode=1});
})();
