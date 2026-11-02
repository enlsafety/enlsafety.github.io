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
  eventType:'검수 사고',summary:'결재 화면 테스트',reportDetails:{},photos:[],corrective:{status:'approved'},_syncVersion:1,
  executiveApproval:{mode:'parallel_then_president',state:'pending',stage:'parallel',round:1,roster,finalApproverId:'qa-3',signatures:[]}};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
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
      if(url.pathname.endsWith('/enl-global-refresh')){
        assert.equal(req.method(),'GET');return route.fulfill({json:{ok:true,epoch,version:release.build}});
      }
      if(url.pathname.endsWith('/enl-incident-sync-v411')&&req.postDataJSON()?.action==='pull'){
        assert.equal(req.postDataJSON().actorPasswordHash,actor.passwordHash);
        if(pullError==='offline')return route.abort();
        if(pullError)return route.fulfill({status:403,json:{ok:false,message:pullError}});
        return route.fulfill({json:{ok:true,incidents:[incident]}});
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
    await page.locator('[data-exec-open="qa-case"]').click();
    await page.getByRole('button',{name:'결재 승인',exact:true}).waitFor();
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
