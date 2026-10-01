const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

async function run(engine){
  const browser=await engine.launch();
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
    assert.equal(await page.locator('.field-six-new').textContent(),'1');
    const homeAlert=await page.locator('.field-six-alert').innerText();
    assert.ok(homeAlert.includes('사고보고 보완요청 1건'));
    assert.ok(!homeAlert.includes('안전관리자가 보완을 요청'), 'home alert must not contain the removed helper sentence');
    assert.equal(await page.locator('.field-six-alert span').count(),0,'home alert helper span must be removed');
    assert.ok((await page.locator('[data-field-task="records"]').innerText()).includes('보완요청 1건'));
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
    assert.ok((await page.locator('[data-field-group="action"]').innerText()).includes('사고 조치 작성하기'));
    assert.ok((await page.locator('[data-field-group="closed"]').innerText()).includes('종결이 완료되었습니다'));
    await page.locator('[data-field-supplement="inc-supp"]').click();
    assert.equal(await page.evaluate(()=>window.__supplement),'inc-supp');
    await page.locator('[data-field-action="inc-action"]').click();
    assert.equal(await page.evaluate(()=>window.__action),'inc-action');

    await page.evaluate(()=>{data.incidents.find(i=>i.id==='inc-supp').status='supplement_submitted';window.enlRenderFieldHome(document.getElementById('view'),window.__u)});
    assert.equal(await page.locator('.field-six-new').count(),0);
    console.log('PASS:',engine.name(),'field supplement badge, guided record groups and direct task buttons');
  }finally{await browser.close()}
}
(async()=>{for(const engine of [chromium,webkit])await run(engine)})().catch(e=>{console.error(e);process.exit(1)});
