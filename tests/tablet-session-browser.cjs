// Real app shell with isolated storage and intercepted network. All actors are synthetic.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const origin='http://tablet.localhost',entry=origin+'/stable412.html';
const meta=JSON.parse(fs.readFileSync('version.json'));
const newer={...meta,build:meta.build.replace(/-r(\d+)$/,(_,n)=>'-r'+(Number(n)+1))};
const primary='enl_safety_session_v3',backup='enl_safety_session_refresh_v412';
const actor={id:'qa-exec',name:'시험 임원',role:'executive',position:'상무',active:true,passwordHash:'synthetic-proof'};
const roster=[actor,...['상무','전무','부사장','사장'].map((position,i)=>({id:'qa-'+i,name:'시험'+i,position}))];
const incident={id:'qa-case',siteId:'qa-site',status:'approved',category:'property',occurredAt:'2026-10-30T02:00:00Z',
  eventType:'작업차량 접촉',summary:'가상 사고',reporterName:'검수 소장',immediateAction:'통행 중지 및 현장 확인',
  reportDetails:{place:'작업로 입구',workerName:'검수 직원',workAction:'차량 이동',incidentHow:'후진 중 안내판에 접촉함',
    damagedItem:'안내판',damageDetail:'지지대 파손',repairCost:125000,causeAnalysisStatus:'investigating',environmentCause:'후방 시야 제한'},
  photos:[{name:'현장 검수 사진.png',mime:'image/png'}],
  corrective:{status:'approved',planDetail:'통행로 분리',actionDetail:'차량 유도선 설치 완료',actionOwner:'검수 반장',actionCompletedDate:'2026-10-31',reviewNote:'조치 현장 확인'},_syncVersion:1,
  executiveApproval:{mode:'parallel_then_president',state:'pending',stage:'parallel',round:1,roster,finalApproverId:'qa-3',signatures:[]}};
// Same ordinary badges, different approval turns. Compare them in the real accident list.
const rawCause='발생 메커니즘: 그레이팅이 튕기면서 후미등 파손\n환경적 요인: 작업로에 쌓인 눈으로 인해 그레이팅의 위치가 가려져 식별이 어려웠으며, 제설작업 중 그레이팅이 튀어 위험한 환경이 형성됨.\n행동적 요인: 제설로 인해 시야 확보가 어려운 상황에서 작업로 내 그레이팅 등 장애물의 위치와 충돌 위험을 충분히 확인하지 못한 채 제설작업을 진행함.\n확인할 관리요인(추정): 차량 동선 분리와 사각지대 확인 절차를 검토해야 함.';
const rawPlan='1. 사고 지점의 차량·장비 동선과 보행 동선을 분리하고 교차구간·사각지대에는 정지선, 표지, 반사경 등 필요한 통제수단을 보완한다.\n2. 후진·협소구간·시야불량 작업은 유도자 배치 또는 작업구역 출입통제를 적용하고 제한속도·정지·확인 절차를 준수한다.\n3. 운전자와 작업자에게 현장 동선 및 충돌예방 수칙을 TBM으로 재교육하고 동일 위험구간을 함께 점검한다.\n4. 조치 완료 후 현장소장이 이행 여부를 확인하고 사진 등 증빙을 남겨 안전관리자에게 제출한다.';
incident.corrective.rootCause=rawCause;incident.corrective.planDetail=rawPlan;
const waiting={...incident,id:'qa-waiting',executiveApproval:{...incident.executiveApproval,finalApproverId:actor.id,
  roster:roster.map(u=>({...u,position:u.id===actor.id?'사장':u.position==='사장'?'상무':u.position}))}};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
async function verifyRecentBadges(page){
  await page.locator('[data-exec-open="qa-case"]').waitFor();
  await page.locator('[data-shell-view="home"]').click();
  const marked=page.locator('.shell411-recent [data-safety-inc="qa-case"]');
  await marked.locator('[data-exec-kind="required"]').waitFor();
  for(const width of [320,390,700,701,820,1280]){
    await page.setViewportSize({width,height:900});
    const result=await marked.evaluate(row=>{
      const rect=el=>el.getBoundingClientRect();
      const pills=card=>Array.from(card.querySelectorAll('.shell411-recent-status .pill'),el=>{
        const {width,height}=rect(el);return [el.textContent,width,height];
      });
      const plain=document.querySelector('[data-safety-inc="qa-no-approval"]');
      const circle=row.querySelector('.exec-required-badge'),c=rect(circle),r=rect(row);
      const peers=Array.from(row.children).filter(el=>el!==circle);
      const separated=peers.every(el=>{const b=rect(el);return b.right<=c.left||b.left>=c.right||b.bottom<=c.top||b.top>=c.bottom});
      return {sizes:pills(row),baseline:pills(plain),ownSlot:circle.parentElement===row,
        separated,inside:c.left>=r.left&&c.right<=r.right&&r.right<=innerWidth&&r.left>=0,diameter:[c.width,c.height]};
    });
    assert.ok(result.sizes.length>=2,'recent report should show both incident and action status');
    assert.deepEqual(result.sizes,result.baseline,'approval must not resize status pills at '+width);
    assert.ok(result.ownSlot&&result.separated&&result.inside,'separate approval area at '+width);
    assert.deepEqual(result.diameter,[36,36]);
  }
  console.log('PASS recent report status pills keep their native sizes alongside a separate approval circle at six viewport widths');
  await page.setViewportSize({width:820,height:1180});
}
async function verifyIncidentCardBadges(page){
  await page.locator('[data-shell-view="incidents"]').click();
  const row=page.locator('.inc411-card[data-inc-id="qa-waiting"]');
  await row.locator('[data-exec-kind="scheduled"]').waitFor();
  for(const width of [1280,820,721,720,390,320]){
    await page.setViewportSize({width,height:900});
    const result=await row.evaluate(card=>{
      const reference=document.querySelector('.inc411-card[data-inc-id="qa-no-approval"]');
      const sizes=el=>Array.from(el.querySelectorAll('.inc411-card-tags .pill'),p=>{
        const r=p.getBoundingClientRect();return [p.textContent,r.width,r.height];
      });
      const tags=card.querySelector('.inc411-card-tags'),badge=card.querySelector('.exec-required-badge');
      const t=tags.getBoundingClientRect(),b=badge.getBoundingClientRect(),r=card.getBoundingClientRect();
      return {sizes:sizes(card),reference:sizes(reference),outside:!tags.contains(badge),
        separate:t.right<=b.left||b.right<=t.left||t.bottom<=b.top||b.bottom<=t.top,
        fits:b.left>=r.left&&b.right<=r.right&&r.right<=innerWidth&&r.left>=0,
        circle:[badge.textContent,b.width,b.height]};
    });
    assert.deepEqual(result.sizes.map(p=>p[0]),['대물사고','사고보고 최종승인','재발방지조치 확인완료']);
    assert.deepEqual(result.sizes,result.reference,'status pill sizes with and without pending approval at '+width);
    assert.ok(result.outside&&result.separate&&result.fits,'independent approval region at '+width);
    assert.deepEqual(result.circle,['결재대기',36,36]);
  }
  await page.setViewportSize({width:820,height:1180});
  await row.locator('[data-exec-kind="scheduled"]').click();
  await page.locator('[data-executive-record]').waitFor();
  assert.equal(await page.getByRole('button',{name:'결재 승인',exact:true}).count(),0);
  await page.evaluate(()=>closeModal());
  await page.locator('[data-shell-view="home"]').click();
  console.log('PASS accident list keeps three native pills separate from the pending circle at six widths');
}
async function verifyExecutiveReport(page,engine){
  const report=page.locator('[data-executive-summary]'),table=report.getByRole('table',{name:'사고 경위서'});
  await table.waitFor();
  const modal=page.locator('#modalRoot .modal');
  assert.equal(await modal.locator('[data-report-stage],.inc411-overview,[data-official439-box]').count(),0);
  for(const value of ['후진 중 안내판에 접촉함','125,000원','원인 (조사 중)','차량과 보행자 동선을 분리','차량 유도선 설치 완료','조치 현장 확인'])assert.ok((await table.innerText()).includes(value),value);
  const readCells=modal.locator('[data-reader-person]');
  await readCells.first().waitFor();assert.equal(await readCells.count(),4);
  assert.equal(await readCells.first().locator('time').getAttribute('datetime'),'2026-10-30T03:14:00Z');
  assert.equal(await readCells.first().locator('time').innerText(),'10.30 12:14');
  assert.match(await readCells.nth(1).innerText(),/미조회/);
  const originals=table.locator('.inc411-brief-original');
  assert.equal(await originals.count(),2);
  for(const [index,value] of [rawCause,rawPlan].entries()){
    const details=originals.nth(index);assert.equal(await details.getAttribute('open'),null);
    assert.ok((await details.locator('..').innerText()).length<value.length*0.65);
    await details.locator('summary').click();assert.equal(await details.locator('div').textContent(),value);
    await details.locator('summary').click();
  }
  const attachments=report.locator('.inc411-summary-files');
  assert.equal(await attachments.getAttribute('open'),null);
  await attachments.locator('summary').click();
  await attachments.locator('[data-report-files="photos"]').waitFor();
  await attachments.locator('summary').click();
  for(const width of [320,390,820,1280]){
    await page.setViewportSize({width,height:900});
    assert.ok(await table.evaluate(t=>t.scrollWidth<=t.clientWidth+1&&t.getBoundingClientRect().right<=innerWidth+1),'summary width '+width);
  }
  await page.setViewportSize({width:820,height:1180});
  const sparse=await page.evaluate(()=>{
    const div=document.createElement('div');
    div.innerHTML=enlExecutiveSummaryHtml({category:'person',occurredDate:'2026-10-30',occurrenceTimeKnown:false,summary:'이관된 경위',
      reportDetails:{injuryDetail:'발목 부상',diagnosis:'비공개 진단',doctorOpinion:'비공개 소견'},supplement:{attachments:[{name:'비공개 진단서.pdf'}]}});
    return div.textContent;
  });
  assert.match(sparse,/시간 미상/);assert.match(sparse,/이관된 경위/);assert.match(sparse,/발목 부상/);
  assert.doesNotMatch(sparse,/비공개|미입력|복구 예상비|현장 조치 결과|보고자|첨부자료/);
  const downloadEvent=page.waitForEvent('download');
  await modal.getByRole('button',{name:'엑셀 사고보고서 출력'}).click();
  const download=await downloadEvent;
  fs.mkdirSync('qa-output',{recursive:true});
  const file='qa-output/executive-summary-'+engine.name()+'.xlsx';
  await download.saveAs(file);
  const bytes=fs.readFileSync(file);
  let last=-1;
  for(const heading of ['A. 현장 최초 사고보고','B. 안전관리자 원인분석 및 검토','C. 안전관리자 재발방지계획','D. 현장 재발방지조치 및 증빙','E. 안전관리자 최종 확인']){
    const pos=bytes.indexOf(heading);assert.ok(pos>last,'cumulative export '+heading);last=pos;
  }
  console.log('PASS executive approval table, attachments, sparse personal record, 4 widths and downloaded A–E workbook');
}
async function run(engine){
  const local=engine===chromium&&process.env.CHROME_EXE;
  const browser=await engine.launch(local?{executablePath:local,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{});
  try{
    const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const messages=[],errors=[];
    let epoch=1,release=meta,metadataOffline=false,pullError='';
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin===origin){
        if(url.pathname==='/version.json')return metadataOffline?route.abort():route.fulfill({json:release});
        const name=url.pathname.slice(1);
        if(!/^[\w.-]+$/.test(name)||!fs.existsSync(name))return route.abort();
        return route.fulfill({contentType:mime[path.extname(name)]||'application/octet-stream',body:fs.readFileSync(name)});
      }
      if(url.pathname.endsWith('/enl-push-v418')&&req.postDataJSON()?.action==='view_list'){
        assert.equal(req.postDataJSON().includeHqReaders,true);
        return route.fulfill({json:{ok:true,readers:[0,1,2,3].map(n=>({id:'qa-staff-'+n,name:'검수 실무'+n,position:'차장',first_viewed_at:n===0?'2026-10-30T03:14:00Z':null}))}});
      }
      if(url.pathname.endsWith('/enl-global-refresh')){
        assert.equal(req.method(),'GET');return route.fulfill({json:{ok:true,epoch,version:release.build}});
      }
      if(url.pathname.endsWith('/enl-incident-sync-v411')&&req.postDataJSON()?.action==='pull'){
        assert.equal(req.postDataJSON().actorPasswordHash,actor.passwordHash);
        if(pullError==='offline')return route.abort();
        if(pullError)return route.fulfill({status:403,json:{ok:false,message:pullError}});
        return route.fulfill({json:{ok:true,incidents:[incident,waiting,{...incident,id:'qa-no-approval',executiveApproval:null}]}});
      }
      return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(8000);
    function listen(p){p.on('pageerror',e=>errors.push(e.stack||e.message));p.on('dialog',async d=>{messages.push(d.message());await d.accept()})}
    listen(page);
    await page.goto(entry);
    const old=Date.now()-3*86400000;
    await page.evaluate(({backup,actor,old})=>{
      localStorage.setItem(backup,JSON.stringify({session:{loggedAt:new Date(old).toISOString(),manager:actor},savedAt:old}));
      localStorage.setItem('enl_safety_platform_section','incident');
    },{backup,actor,old});
    // Delay the incident module on cold start. A concurrent tab may notify the
    // restored tab after auth loads but before a dashboard can be rendered.
    let releaseModule;
    const moduleGate=new Promise(resolve=>{releaseModule=resolve});
    await page.route('**/incidents-v410.js?*',async route=>{await moduleGate;await route.fallback()});
    const reloading=page.reload();
    await page.waitForFunction(()=>window.ENL_AUTH_VERSION&&!window.sortIncidents);
    await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'enl_safety_v3'})));
    releaseModule();await reloading;await page.unroute('**/incidents-v410.js?*');
    await verifyRecentBadges(page);
    await verifyIncidentCardBadges(page);
    await page.locator('[data-exec-open="qa-case"]').click();
    await page.getByRole('button',{name:'결재 승인',exact:true}).waitFor();
    await verifyExecutiveReport(page,engine);
    await page.evaluate(()=>{
      const original=Date.now;Date.now=()=>original()+3*86400000;
      try{document.dispatchEvent(new Event('resume'));window.dispatchEvent(new Event('pageshow'))}finally{Date.now=original}
    });
    release=newer;epoch++;
    metadataOffline=true;
    const check=()=>page.evaluate(()=>window.enlCheckGlobalUpdate());
    await check();
    assert.equal(page.url(),entry);
    metadataOffline=false;
    await page.waitForFunction(()=>window.enlCheckGlobalUpdate());
    assert.equal(await page.locator('#enlUpdateNotice').count(),0);
    await page.getByRole('button',{name:'결재 승인',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>currentUser()?.id),actor.id);
    await page.evaluate(()=>closeModal());
    await page.locator('[data-update-later]').click();
    await check();assert.equal(await page.locator('#enlUpdateNotice').count(),0);
    await page.locator('[data-resume-update]').click();
    await Promise.all([page.waitForURL('**/*_latest=*'),page.locator('[data-update-now]').click()]);
    assert.equal(await page.evaluate(()=>currentUser()?.id),actor.id);
    assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).manager.passwordHash,primary),actor.passwordHash);
    const pull=()=>page.evaluate(()=>window.enlIncidentPullNow(false).catch(()=>false));
    for(const failure of ['offline','forbidden','auth_proof_required','auth_proof_required']){pullError=failure;await pull()}
    assert.equal(messages.filter(m=>m.includes('다시 로그인')).length,1);
    assert.equal(await page.evaluate(()=>currentUser()?.id),actor.id);
    const peer=await context.newPage();listen(peer);pullError='';await peer.goto(entry);await peer.locator('#userChip').waitFor();
    await page.locator('#userChip').click();await page.locator('#logoutBtn').click();
    await peer.waitForFunction(()=>!currentUser());await peer.evaluate(()=>window.enlSaveBackgroundState());
    await peer.reload();await peer.locator('.login-v411').waitFor();
    assert.equal(await peer.evaluate(k=>localStorage.getItem(k),backup),null);
    await peer.evaluate(()=>sessionStorage.setItem('enl_last_session_clear_reason','global_update'));
    await peer.reload();await peer.locator('.login-v411').waitFor();
    await peer.reload();await peer.locator('.login-v411').waitFor();
    assert.equal(messages.filter(m=>m.includes('이전 버전')).length,1);
    assert.deepEqual(errors,[]);
    console.log('PASS',engine.name(),'72h restore, resumed approval, offline metadata, same-version revision, defer/apply with login, rejected proof, explicit logout across tabs');
  }finally{await browser.close()}
}
(async()=>{for(const engine of process.env.CHROME_EXE?[chromium]:[chromium,webkit])await run(engine)})().catch(e=>{console.error(e);process.exitCode=1});
