const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function managerHome(engine){
  const browser=await engine.launch();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.setContent('<!doctype html><html><body><div id="app"></div></body></html>');
    await page.evaluate(()=>{
      window.app=document.getElementById('app');
      window.__u={id:'u-manager-real',name:'김관리',role:'manager',position:'차장',active:true};
      window.currentUser=()=>window.__u;
      window.currentView='home';window.session={};window.enlPlatformSection='hub';window.ENL_PLATFORM_SECTION_KEY='qa';
      window.data={sites:[{id:'s01',name:'테스트 사업장'}],users:[],incidents:[
        {id:'inc-reader-pending',siteId:'s01',status:'reported',category:'property',eventType:'시설 파손',occurredAt:'2026-10-02T08:00:00+09:00',acknowledgements:[]},
        {id:'inc-approved',siteId:'s01',status:'approved',category:'property',eventType:'카트 충돌',approvedAt:'2026-10-01T10:00:00+09:00',occurredAt:'2026-10-01T09:00:00+09:00',acknowledgements:[]},
        {id:'inc-done',siteId:'s01',status:'approved',category:'person',eventType:'넘어짐',approvedAt:'2026-09-30T10:00:00+09:00',occurredAt:'2026-09-30T09:00:00+09:00',acknowledgements:[{documentType:'incident_report',userId:'u-manager-real'}]}
      ]};
      window.siteById=id=>data.sites.find(s=>s.id===id);
      window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      window.fmt=v=>String(v||'').replace('T',' ').slice(0,16);
      window.roleName=r=>r==='manager'?'관리자':r==='executive'?'경영진':r==='safety'?'안전관리자':r;
      window.priorityBadge=()=>'';window.statusBadge=s=>'<span>'+s+'</span>';window.actionBadge=()=>'';window.saveSession=()=>{};window.renderLogin=()=>{};
      window.enlIncidentQuickSummary=i=>({when:String(i.occurredAt).slice(0,16).replace('T',' '),site:siteById(i.siteId)?.name,headline:i.eventType,circumstance:'사고 상세'});
      window.enlIncidentTable=()=>'';window.enlOpenIncidentReview=id=>{window.__opened=id};window.ENL_DEPLOY_VERSION='4.4.39';
    });
    await page.addScriptTag({content:fs.readFileSync('app-shell-v411.js','utf8')});
    assert.equal(await page.locator('[data-hq-approval-alert]').count(),1);
    assert.ok((await page.locator('.shell411-approval-head').innerText()).includes('승인완료 사고 결재가 필요합니다.'));
    assert.equal(await page.locator('[data-hq-approval-open]').count(),1);
    assert.equal(await page.locator('.shell411-approval-count').textContent(),'1');
    await page.addScriptTag({content:fs.readFileSync('reader-experience-v424.js','utf8')});
    await page.waitForTimeout(60);
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-dot').count(),1,'reader simple-confirmation event should remain a red dot');
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-count').count(),0,'reader simple-confirmation event must not become a number');
    await page.locator('[data-hq-approval-open]').click();
    assert.equal(await page.evaluate(()=>window.__opened),'inc-approved');

    await page.evaluate(()=>{
      window.__u={id:'u-safety-real',name:'안전관리자',role:'safety',position:'과장',active:true};
      const ack={documentType:'incident_report',userId:'u-safety-real',ackAt:'2026-10-01T10:30:00+09:00'};
      data.incidents=[
        {id:'inc-review',siteId:'s01',status:'reported',category:'person',eventType:'넘어짐',occurredAt:'2026-10-02T09:00:00+09:00',acknowledgements:[]},
        {id:'inc-supp-review',siteId:'s01',status:'supplement_submitted',category:'property',eventType:'시설 파손',occurredAt:'2026-10-02T08:30:00+09:00',acknowledgements:[]},
        {id:'inc-own-approval',siteId:'s01',status:'approved',category:'property',eventType:'카트 충돌',occurredAt:'2026-10-01T09:00:00+09:00',corrective:{status:'planned',planAt:'2026-10-01T11:00:00+09:00',planDetail:'계획'},acknowledgements:[]},
        {id:'inc-plan',siteId:'s01',status:'approved',category:'property',eventType:'시설 파손',occurredAt:'2026-09-30T09:00:00+09:00',corrective:null,acknowledgements:[ack]},
        {id:'inc-action-review',siteId:'s01',status:'approved',category:'person',eventType:'베임',occurredAt:'2026-09-29T09:00:00+09:00',corrective:{status:'submitted',planAt:'2026-09-29T10:00:00+09:00',planDetail:'계획',actionDetail:'조치'},acknowledgements:[ack]}
      ];
      currentView='home';window.renderShell(window.__u);
    });
    await page.addScriptTag({content:fs.readFileSync('workflow-prevention-v429.js','utf8')});
    await page.evaluate(()=>window.renderShell(window.__u));
    await page.waitForTimeout(80);

    const badge=async view=>page.locator('[data-shell-view="'+view+'"] > .enl424-nav-count').textContent();
    assert.equal(await badge('home'),'5','home must aggregate all action-required work');
    assert.equal(await badge('incidents'),'3','reported + supplement approval + own approval');
    assert.equal(await badge('actions'),'2','plan registration + corrective approval');
    assert.equal(await page.locator('[data-shell-view="actions"] .prev429-nav-alert').count(),0,'legacy plan-only badge must be removed');
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-dot').count(),0,'safety action work must be numeric, not a dot');

    // Merely opening a tab must not clear an action-required number.
    await page.locator('[data-shell-view="incidents"]').click();
    await page.waitForTimeout(30);
    assert.equal(await badge('incidents'),'3');

    // Process each incident-side action. Counts fall only after workflow state changes.
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-review').status='supplement';
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await badge('incidents'),'2');
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-supp-review').status='supplement';
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await badge('incidents'),'1');
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-own-approval').acknowledgements=[{documentType:'incident_report',userId:'u-safety-real',ackAt:new Date().toISOString()}];
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-count').count(),0);

    // Process prevention-plan and corrective approval work.
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-plan').corrective={status:'planned',planAt:new Date().toISOString(),planDetail:'재발방지계획'};
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await badge('actions'),'1');
    await page.evaluate(()=>{
      const i=data.incidents.find(i=>i.id==='inc-action-review');i.corrective.status='approved';i.status='closed';
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await page.locator('[data-shell-view="actions"] > .enl424-nav-count').count(),0);
    assert.equal(await page.locator('[data-shell-view="home"] > .enl424-nav-count').count(),0);
    console.log('PASS:',engine.name(),'reader dots preserved and safety action numbers clear only after processing');
  }finally{await browser.close()}
}

async function approvalDetail(engine){
  const browser=await engine.launch();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.setContent('<!doctype html><html><body><div id="modalRoot"></div></body></html>');
    await page.evaluate(()=>{
      window.__u={id:'u-manager-real',name:'김관리',role:'manager',position:'차장',department:'경영관리부'};
      window.currentUser=()=>window.__u;
      window.data={users:[
        {id:'stale1',name:'테스트 경영진',role:'executive',position:'사장',active:true},
        {id:'stale2',name:'테스트 관리자',role:'manager',position:'부장',active:true},
        {id:'stale3',name:'테스트 안전관리자',role:'safety',position:'과장',active:true},
        {id:'u-manager-real',name:'김관리',role:'manager',position:'차장',active:true}
      ],incidents:[{id:'inc-approved',siteId:'s01',status:'approved',eventType:'사고',updatedAt:'2026-10-01T10:00:00+09:00',reporterName:'현장소장',createdAt:'2026-10-01T09:00:00+09:00',acknowledgements:[]}]};
      window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      window.enlIncidentApi=async()=>({users:[
        {id:'u-manager-real',name:'김관리',role:'manager',position:'차장',department:'경영관리부'},
        {id:'u-safety-real',name:'박안전',role:'safety',position:'과장',department:'경영관리부'}
      ]});
      window.enlIncidentAcknowledge=async()=>({ok:true});
      window.enlIncidentPullNow=async()=>{};
      window.enlOpenIncidentReview=id=>{document.getElementById('modalRoot').innerHTML='<div class="modal" data-wf440-incident="'+id+'"><div class="modal-head"><div><h2>사고 상세</h2></div><button class="x" data-close>×</button></div></div>'};
    });
    await page.addScriptTag({content:fs.readFileSync('management-approval-v448.js','utf8')});
    await page.evaluate(()=>window.enlOpenIncidentReview('inc-approved'));
    await page.waitForTimeout(300);
    const text=await page.locator('#modalRoot').innerText();
    assert.ok(!text.includes('테스트 경영진'));
    assert.ok(!text.includes('테스트 관리자'));
    assert.ok(!text.includes('테스트 안전관리자'));
    assert.equal(await page.locator('[data-enl448-sign]').count(),1);
    assert.ok((await page.locator('[data-enl448-sign]').innerText()).includes('본인'));
    assert.ok((await page.locator('[data-enl448-sign]').innerText()).includes('결재하기'));
    assert.equal(await page.locator('[data-enl448-own-guide]').count(),1);
    const visual=await page.locator('[data-enl448-sign]').evaluate(el=>{const cs=getComputedStyle(el),pill=getComputedStyle(el.querySelector('.enl448-a'));return {animation:cs.animationName,transform:cs.transform,height:cs.height,pillFont:pill.fontSize}});
    assert.equal(visual.animation,'none');
    assert.equal(visual.transform,'none');
    assert.ok(parseFloat(visual.height)<=66);
    assert.ok(parseFloat(visual.pillFont)>=9.5);
    console.log('PASS:',engine.name(),'server-authoritative approval roster and crisp own approval cell');
  }finally{await browser.close()}
}

(async()=>{for(const engine of [chromium,webkit]){await managerHome(engine);await approvalDetail(engine)}})().catch(e=>{console.error(e);process.exit(1)});
