const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

async function run(engine){
  const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.setContent('<!doctype html><html><head></head><body><div id="view"></div></body></html>');
    await page.evaluate(()=>{
      window.currentView='home';
      window.data={sites:[{id:'s01',name:'테스트 사업장'}],incidents:[
        {id:'inc-supp',siteId:'s01',category:'property',eventType:'설비/시설 파손',status:'supplement',reporterName:'현장소장',occurredAt:'2026-10-01T09:00:00+09:00',supplement:{requestedAt:'2026-10-01T10:00:00+09:00',requestNote:'견적서와 복구비용을 입력해 주세요.'},reportDetails:{damagedItem:'홀맵 지주',damageDetail:'찌그러짐'}},
        {id:'inc-approved',siteId:'s01',category:'person',eventType:'베임/찔림',status:'approved',reporterName:'현장소장',occurredAt:'2026-09-30T09:00:00+09:00',reportDetails:{injuryDetail:'손가락 베임'}},
        {id:'inc-action',siteId:'s01',category:'property',eventType:'차량/중장비',status:'approved',reporterName:'현장소장',occurredAt:'2026-09-29T09:00:00+09:00',corrective:{status:'planned',planAt:'2026-09-30T12:00:00+09:00'},reportDetails:{damagedItem:'카트',damageDetail:'범퍼 파손'}},
        {id:'inc-closed',siteId:'s01',category:'property',eventType:'설비/시설 파손',status:'closed',reporterName:'현장소장',occurredAt:'2026-09-28T09:00:00+09:00',corrective:{status:'approved'},reportDetails:{damagedItem:'표지판',damageDetail:'파손'}},
        {id:'inc-review',siteId:'s01',category:'person',eventType:'넘어짐',status:'reported',reporterName:'현장소장',occurredAt:'2026-09-27T09:00:00+09:00',reportDetails:{injuryDetail:'무릎 타박'}}
      ]};
      window.__u={id:'u1',personnelId:'u1',name:'현장소장',role:'field',position:'현장소장',siteId:'s01'};
      window.currentUser=()=>window.__u;
      window.siteById=id=>data.sites.find(s=>s.id===id);
      window.ENL_SITE_DIRECTORY=data.sites;
      window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      window.fmt=v=>String(v||'').replace('T',' ').slice(0,16);
      window.renderShell=()=>{};
      window.enlIncidentOverviewHtml=i=>'<div class="qa-overview">'+(i.reportDetails?.damageDetail||i.reportDetails?.injuryDetail||'-')+'</div>';
      window.enlIncidentQuickSummary=i=>({headline:i.eventType||'사고'});
      window.enlCanEditIncident=()=>true;
      window.enlOpenIncidentReview=id=>window.__opened=id;
      window.enlEditIncidentInReportForm=i=>window.__edited=i.id;
      window.enlOpenIncidentSupplement=i=>window.__supplement=i.id;
      window.openUnifiedCorrectiveModal=id=>window.__action=id;
      window.enlOpenPwaNotificationSettings=()=>window.__notify=true;
      try{Object.defineProperty(window,'Notification',{value:{permission:'default'},configurable:true})}catch(e){}
    });
    await page.addScriptTag({content:fs.readFileSync('field-ui-v411.js','utf8')});
    await page.addScriptTag({content:fs.readFileSync('field-incidents-v411.js','utf8')});

    await page.evaluate(()=>window.enlRenderFieldHome(document.getElementById('view'),window.__u));
    assert.equal(await page.locator('.field-six-new').textContent(),'2');
    const homeAlert=await page.locator('.field-six-alert').innerText();
    assert.ok(homeAlert.includes('사고보고 보완요청 1건'));
    assert.ok(homeAlert.includes('재발방지조치 작성·보완 1건'));
    assert.ok(!homeAlert.includes('안전관리자가 보완을 요청'), 'home alert must not contain the removed helper sentence');
    assert.equal(await page.locator('.field-six-alert span').count(),0,'home alert helper span must be removed');
    assert.ok((await page.locator('[data-field-task="records"]').innerText()).includes('확인·작성 필요 2건'));
    assert.ok((await page.locator('[data-field-task="accident_action"]').innerText()).includes('재발방지조치'));
    assert.ok((await page.locator('[data-field-task="accident_action"]').innerText()).includes('재발방지계획 이행내용 등록'));
    if(await page.locator('[data-field-notification-setup]').count()){
      await page.locator('[data-field-notification-setup]').click();
      assert.equal(await page.evaluate(()=>window.__notify),true);
    }

    await page.evaluate(()=>window.enlRenderFieldRecords(document.getElementById('view'),window.__u));
    assert.equal(await page.locator('.field411-head p').count(),0,'record header description must be removed');
    assert.equal(await page.locator('.field411-manager-note').count(),0,'record processing-order note must be removed');
    for(const key of ['supplement','action','approved','waiting','closed'])assert.ok(await page.locator('[data-field-group="'+key+'"]').count(),key+' group missing');
    const supplementText=await page.locator('[data-field-group="supplement"]').innerText();
    assert.ok(supplementText.includes('안전관리자가 추가자료를 요청한 사고입니다.'));
    assert.ok(!/요청했어|하면 돼|해야 해|등록했어|승인됐어|기록이야|완료했어|기다리면 돼/.test(supplementText));
    assert.ok((await page.locator('[data-field-group="supplement"]').innerText()).includes('보완자료 작성하기'));
    assert.ok((await page.locator('[data-field-group="approved"]').innerText()).includes('재발방지계획'));
    assert.ok((await page.locator('[data-field-group="action"]').innerText()).includes('재발방지조치 작성하기'));
    assert.ok((await page.locator('[data-field-group="action"]').innerText()).includes('재발방지조치 작성이 필요합니다'));
    assert.ok(!(await page.locator('[data-field-group="action"]').innerText()).includes('사고 조치 작성하기'));
    assert.ok((await page.locator('[data-field-group="closed"]').innerText()).includes('종결이 완료되었습니다'));
    // Regression: same-site manager must be able to correct a pending report
    // before safety approval, without opening approved/closed records for editing.
    const pendingEdit=page.locator('[data-field-group="waiting"] [data-field-edit="inc-review"]');
    assert.equal(await pendingEdit.count(),1,'manager needs an accessible edit button on pending incident');
    assert.equal((await pendingEdit.innerText()).trim(),'보고 회수 후 수정');
    assert.equal(await page.locator('[data-field-group="approved"] [data-field-edit]').count(),0);
    assert.equal(await page.locator('[data-field-group="closed"] [data-field-edit]').count(),0);
    assert.equal(await page.locator('[data-field-group="supplement"] [data-field-edit]').count(),0);
    await pendingEdit.click();
    assert.equal(await page.evaluate(()=>window.__edited),'inc-review','manager edit button must open original report form');

    await page.locator('[data-field-supplement="inc-supp"]').click();
    assert.equal(await page.evaluate(()=>window.__supplement),'inc-supp');
    await page.locator('[data-field-action="inc-action"]').click();
    assert.equal(await page.evaluate(()=>window.__action),'inc-action');

    await page.evaluate(()=>{data.incidents.find(i=>i.id==='inc-supp').status='supplement_submitted';window.enlRenderFieldHome(document.getElementById('view'),window.__u)});
    assert.equal(await page.locator('.field-six-new').textContent(),'1');
    assert.ok((await page.locator('.field-six-alert').innerText()).includes('재발방지조치 작성·보완 1건'));
    assert.equal(await page.evaluate(()=>window.enlFieldPreventionActionCount(window.__u)),1);
    assert.equal(await page.evaluate(()=>window.enlFieldAttentionCount(window.__u)),1);

    await page.evaluate(()=>{data.incidents.find(i=>i.id==='inc-action').corrective.status='submitted';window.enlRenderFieldHome(document.getElementById('view'),window.__u)});
    assert.equal(await page.locator('.field-six-new').count(),0);
    assert.equal(await page.evaluate(()=>window.enlFieldAttentionCount(window.__u)),0);
    // Every persisted same-site stage must appear once, including both executive rounds.
    await page.evaluate(()=>{
      const base={siteId:'s01',category:'property',eventType:'접촉',reporterName:'검수 소장',reporterId:'u1',occurredAt:'2026-10-03T09:00:00+09:00',reportDetails:{damagedItem:'표지판',damageDetail:'파손'}};
      data.incidents.push(...[
        {id:'exec-parallel',status:'approved',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'parallel'}},
        {id:'exec-president',status:'approved',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'president'}},
        {id:'exec-rejected',status:'approved',corrective:{status:'submitted'},executiveApproval:{state:'rejected'}},
        {id:'report-rejected',status:'rejected'},
        {id:'action-writing',status:'approved',corrective:{status:'in_progress'}},
        {id:'action-waiting',status:'approved',corrective:{status:'submitted'}},
        {id:'saved-draft',status:'draft'},
        {id:'future-stage',status:'future_status'},
        {id:'closed-with-old-pending',status:'closed',corrective:{status:'approved'},executiveApproval:{state:'pending'}},
        {id:'different-site',siteId:'s02',status:'approved',executiveApproval:{state:'pending'}}
      ].map(x=>({...base,...x})));
      enlRenderFieldRecords(document.getElementById('view'),__u);
    });
    for(const position of ['현장소장','파트장','서무']){
      await page.evaluate(position=>{__u.position=position;enlRenderFieldRecords(document.getElementById('view'),__u)},position);
      const expected=await page.evaluate(()=>data.incidents.filter(i=>i.siteId===__u.siteId).map(i=>i.id).sort());
      const shown=await page.locator('[data-field-open]').evaluateAll(xs=>xs.map(x=>x.dataset.fieldOpen).sort());
      assert.deepEqual(shown,expected,position+' no omitted/duplicated stages');
      assert.equal(await page.locator('[data-field-group="executive"] [data-field-open]').count(),2);
      assert.ok((await page.locator('[data-field-group="waiting"]').innerText()).includes('경영진 반려 후 안전관리자 재검토'));
      assert.equal(await page.locator('[data-field-action="exec-rejected"]').count(),0);
      assert.ok((await page.locator('[data-field-group="executive"]').innerText()).includes('사장 최종결재 대기'));
      assert.equal(await page.locator('[data-field-group="executive"] [data-field-edit]').count(),0,'viewing never grants editing while approval is pending');
      assert.equal(await page.locator('[data-field-group="closed"] [data-field-open="closed-with-old-pending"]').count(),1);
      await page.locator('[data-field-open="exec-president"]').click();assert.equal(await page.evaluate(()=>__opened),'exec-president');
      assert.equal(await page.locator('[data-field-open="different-site"]').count(),0);
    }
    console.log('PASS:',engine.name(),'field supplement + prevention attention badge, guided record groups and prevention terminology');
  }finally{await browser.close()}
}
(async()=>{for(const engine of process.env.UI_CHROMIUM_ONLY?[chromium]:[chromium,webkit])await run(engine)})().catch(e=>{console.error(e);process.exit(1)});
