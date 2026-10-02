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
        {id:'inc-approved',siteId:'s01',status:'approved',category:'property',eventType:'카트 충돌',approvedAt:'2026-10-01T10:00:00+09:00',updatedAt:'2026-10-01T10:00:00+09:00',occurredAt:'2026-10-01T09:00:00+09:00',acknowledgements:[]},
        {id:'inc-closed-second',siteId:'s01',status:'closed',category:'person',eventType:'넘어짐',approvedAt:'2026-09-30T10:00:00+09:00',updatedAt:'2026-10-02T10:00:00+09:00',occurredAt:'2026-09-30T09:00:00+09:00',corrective:{status:'approved'},acknowledgements:[{documentType:'incident_report',userId:'u-manager-real',ackAt:'2026-10-01T12:00:00+09:00'}]},
        {id:'inc-done',siteId:'s01',status:'approved',category:'person',eventType:'미끄러짐',approvedAt:'2026-09-29T10:00:00+09:00',occurredAt:'2026-09-29T09:00:00+09:00',acknowledgements:[{documentType:'incident_report',userId:'u-manager-real'}]}
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
    assert.ok((await page.locator('.shell411-approval-head').innerText()).includes('본인 결재가 필요한 사고가 있습니다.'));
    assert.equal(await page.locator('[data-hq-approval-open]').count(),2);
    assert.equal(await page.locator('.shell411-approval-count').textContent(),'2');
    await page.addScriptTag({content:fs.readFileSync('reader-experience-v424.js','utf8')});
    await page.waitForTimeout(60);
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-dot').count(),1,'reader simple-confirmation event should remain a red dot');
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-count').count(),0,'reader simple-confirmation event must not become a number');
    const approvalAlertText=await page.locator('[data-hq-approval-alert]').innerText();
    assert.ok(approvalAlertText.includes('1차 사고보고 결재'));
    assert.ok(approvalAlertText.includes('2차 종결결재'));
    await page.locator('[data-hq-approval-open="inc-approved"]').click();
    assert.equal(await page.evaluate(()=>window.__opened),'inc-approved');

    await page.evaluate(()=>{
      window.__u={id:'u-safety-real',name:'안전관리자',role:'safety',position:'과장',active:true};
      const ack={documentType:'incident_report',userId:'u-safety-real',ackAt:'2026-10-01T10:30:00+09:00'};
      data.incidents=[
        {id:'inc-review',siteId:'s01',status:'reported',category:'person',eventType:'넘어짐',occurredAt:'2026-10-02T09:00:00+09:00',acknowledgements:[]},
        {id:'inc-supp-review',siteId:'s01',status:'supplement_submitted',category:'property',eventType:'시설 파손',occurredAt:'2026-10-02T08:30:00+09:00',acknowledgements:[]},
        {id:'inc-own-approval',siteId:'s01',status:'approved',category:'property',eventType:'카트 충돌',occurredAt:'2026-10-01T09:00:00+09:00',corrective:{status:'planned',planAt:'2026-10-01T11:00:00+09:00',planDetail:'계획'},acknowledgements:[]},
        {id:'inc-own-closure',siteId:'s01',status:'closed',category:'property',eventType:'시설 파손',occurredAt:'2026-09-30T13:00:00+09:00',corrective:{status:'approved'},acknowledgements:[ack]},
        {id:'inc-plan',siteId:'s01',status:'approved',category:'property',eventType:'시설 파손',occurredAt:'2026-09-30T09:00:00+09:00',corrective:null,acknowledgements:[ack]},
        {id:'inc-action-review',siteId:'s01',status:'approved',category:'person',eventType:'베임',occurredAt:'2026-09-29T09:00:00+09:00',corrective:{status:'submitted',planAt:'2026-09-29T10:00:00+09:00',planDetail:'계획',actionDetail:'조치'},acknowledgements:[ack]}
      ];
      currentView='home';window.renderShell(window.__u);
    });
    await page.addScriptTag({content:fs.readFileSync('workflow-prevention-v429.js','utf8')});
    await page.evaluate(()=>window.renderShell(window.__u));
    await page.waitForTimeout(80);

    const badge=async view=>page.locator('[data-shell-view="'+view+'"] > .enl424-nav-count').textContent();
    assert.equal(await badge('home'),'6','home must aggregate all action-required work including closure approval');
    assert.equal(await badge('incidents'),'4','reported + supplement approval + stage1 approval + stage2 closure approval');
    assert.equal(await badge('actions'),'2','plan registration + corrective approval');
    assert.equal(await page.locator('[data-shell-view="actions"] .prev429-nav-alert').count(),0,'legacy plan-only badge must be removed');
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-dot').count(),0,'safety action work must be numeric, not a dot');

    // Merely opening a tab must not clear an action-required number.
    await page.locator('[data-shell-view="incidents"]').click();
    await page.waitForTimeout(30);
    assert.equal(await badge('incidents'),'4');

    // Process each incident-side action. Counts fall only after workflow state changes.
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-review').status='supplement';
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await badge('incidents'),'3');
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-supp-review').status='supplement';
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await badge('incidents'),'2');
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-own-approval').acknowledgements=[{documentType:'incident_report',userId:'u-safety-real',ackAt:new Date().toISOString()}];
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await badge('incidents'),'1');
    await page.evaluate(()=>{
      data.incidents.find(i=>i.id==='inc-own-closure').acknowledgements.push({documentType:'closure_approval',userId:'u-safety-real',ackAt:new Date().toISOString()});
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
    assert.equal(await badge('home'),'1','closing an incident must create the stage2 closure-approval action');
    assert.equal(await badge('incidents'),'1');
    await page.evaluate(()=>{
      const i=data.incidents.find(i=>i.id==='inc-action-review');
      i.acknowledgements.push({documentType:'closure_approval',userId:'u-safety-real',ackAt:new Date().toISOString()});
      window.enlRefreshSafetyActionBadges();
    });
    assert.equal(await page.locator('[data-shell-view="home"] > .enl424-nav-count').count(),0);
    assert.equal(await page.locator('[data-shell-view="incidents"] > .enl424-nav-count').count(),0);
    console.log('PASS:',engine.name(),'reader dots preserved and safety action numbers transition into stage2 closure approval');
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
        {id:'u-safety-real',name:'박안전',role:'safety',position:'과장',department:'경영관리부'},
        {id:'u-m1',name:'이관리',role:'manager',position:'과장',department:'경영관리부'},
        {id:'u-manager-real',name:'김관리',role:'manager',position:'차장',department:'경영관리부'},
        {id:'u-m2',name:'최관리',role:'manager',position:'부장',department:'경영관리부'},
        {id:'u-m3',name:'정관리',role:'manager',position:'부장',department:'운영부'},
        {id:'u-m4',name:'한관리',role:'manager',position:'이사',department:'운영부'},
        {id:'u-m5',name:'윤관리',role:'manager',position:'상무',department:'경영관리부'},
        {id:'u-e1',name:'임경영',role:'executive',position:'전무',department:'경영진'},
        {id:'u-e2',name:'조경영',role:'executive',position:'사장',department:'경영진'}
      ]});
      window.enlIncidentAcknowledge=async(id,u,documentType)=>{
        const i=data.incidents.find(x=>x.id===id),at=documentType==='closure_approval'?'2026-10-02T12:30:00+09:00':'2026-10-01T11:20:00+09:00';
        i.acknowledgements=(i.acknowledgements||[]).filter(a=>!(a.userId===u.id&&a.documentType===documentType));
        i.acknowledgements.push({documentType,userId:u.id,name:u.name,role:u.role,position:u.position,ackAt:at,label:documentType==='closure_approval'?'2차 사고종결 결재':'1차 사고보고 결재'});
        i.updatedAt=at;return {ok:true,incident:i};
      };
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
    assert.equal(await page.locator('[data-enl448-sign="incident_report"]').count(),1);
    const own=page.locator('[data-enl448-sign="incident_report"]');
    assert.ok((await own.innerText()).includes('본인'));
    assert.ok((await own.locator('.enl448-a').innerText()).includes('1차 결재하기'));
    assert.ok((await own.locator('.enl448-d').innerText()).includes('2차 대기'));
    assert.equal(await page.locator('[data-enl448-own-guide]').count(),1);
    let visual=await own.evaluate(el=>{const cs=getComputedStyle(el),pill=getComputedStyle(el.querySelector('.enl448-a'));return {animation:cs.animationName,transform:cs.transform,height:cs.height,pillFont:pill.fontSize}});
    assert.equal(visual.animation,'none');assert.equal(visual.transform,'none');assert.ok(parseFloat(visual.height)<=66);assert.ok(parseFloat(visual.pillFont)>=8.5);

    page.once('dialog',d=>d.accept());await own.click();await page.waitForTimeout(120);
    assert.equal(await page.locator('[data-enl448-sign]').count(),0,'stage2 must stay locked before closure');
    assert.ok((await page.locator('.enl448-s.mine .enl448-a').innerText()).includes('1차 10.01 11:20'));
    assert.ok((await page.locator('.enl448-s.mine .enl448-d').innerText()).includes('2차 대기'));

    await page.evaluate(()=>{
      const i=data.incidents.find(x=>x.id==='inc-approved');i.status='closed';i.corrective={status:'approved'};i.updatedAt='2026-10-02T12:00:00+09:00';
      window.enlOpenIncidentReview('inc-approved');
    });
    await page.waitForTimeout(180);
    assert.equal(await page.locator('[data-enl448-sign="closure_approval"]').count(),1);
    const second=page.locator('[data-enl448-sign="closure_approval"]');
    assert.ok((await second.locator('.enl448-a').innerText()).includes('1차 10.01 11:20'));
    assert.ok((await second.locator('.enl448-d').innerText()).includes('2차 결재하기'));
    page.once('dialog',d=>d.accept());await second.click();await page.waitForTimeout(120);
    assert.equal(await page.locator('[data-enl448-sign]').count(),0);
    assert.ok((await page.locator('.enl448-s.mine .enl448-a').innerText()).includes('1차 10.01 11:20'));
    assert.ok((await page.locator('.enl448-s.mine .enl448-d').innerText()).includes('2차 10.02 12:30'));
    visual=await page.locator('.enl448-s.mine').evaluate(el=>{
      const a=el.querySelector('.enl448-a'),d=el.querySelector('.enl448-d'),grid=el.closest('.enl448-t');
      return {height:getComputedStyle(el).height,aScroll:a.scrollWidth,aClient:a.clientWidth,dScroll:d.scrollWidth,dClient:d.clientWidth,gridHeight:grid.getBoundingClientRect().height};
    });
    assert.ok(parseFloat(visual.height)<=66,'two-stage approval cell must stay compact');
    assert.ok(visual.aScroll<=visual.aClient+1,'stage1 timestamp must be readable without clipping');
    assert.ok(visual.dScroll<=visual.dClient+1,'stage2 timestamp must be readable without clipping');
    assert.ok(visual.gridHeight<=134,'nine-person mobile approval grid must stay within two compact rows');
    console.log('PASS:',engine.name(),'two-stage HQ approval keeps compact 9-person layout and records both timestamps');
  }finally{await browser.close()}
}

(async()=>{for(const engine of [chromium,webkit]){await managerHome(engine);await approvalDetail(engine)}})().catch(e=>{console.error(e);process.exit(1)});
