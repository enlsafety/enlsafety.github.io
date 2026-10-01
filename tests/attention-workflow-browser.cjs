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
    await page.locator('[data-hq-approval-open]').click();
    assert.equal(await page.evaluate(()=>window.__opened),'inc-approved');

    await page.evaluate(()=>{
      window.__u={id:'u-safety-real',name:'안전관리자',role:'safety',position:'과장',active:true};
      data.incidents=[{id:'inc-plan',siteId:'s01',status:'approved',category:'property',eventType:'시설 파손',occurredAt:'2026-10-01T09:00:00+09:00',corrective:null}];
      currentView='home';window.renderShell(window.__u);
    });
    await page.addScriptTag({content:fs.readFileSync('workflow-prevention-v429.js','utf8')});
    await page.evaluate(()=>window.renderShell(window.__u));
    await page.waitForTimeout(60);
    assert.equal(await page.locator('[data-shell-view="actions"] .prev429-nav-alert').textContent(),'1');
    assert.ok(await page.locator('[data-shell-view="actions"]').evaluate(el=>el.classList.contains('prev429-nav-attention')));
    assert.ok(await page.locator('#safetyActionMissing411').evaluate(el=>el.classList.contains('shell411-attention')));
    console.log('PASS:',engine.name(),'HQ approval home alert and safety prevention-plan red badge');
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
