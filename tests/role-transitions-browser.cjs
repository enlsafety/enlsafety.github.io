'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='https://transition.test';
const roles=['executive','manager','field','worker','safety'];
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function exercise(browser,role,width){
  const field=role==='field'||role==='worker';
  const page=await browser.newPage({viewport:{width,height:850}});
  page.setDefaultTimeout(9000);
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('dialog',d=>d.accept());
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    const file=path.join(process.cwd(),url.pathname);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
    let body=fs.readFileSync(file);
    if(url.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
    if(url.pathname.endsWith('/integrated-home-fixture.js')){
      body=body.toString().replace('const sites=',`if(location.hash)localStorage.setItem('enl_safety_view_refresh_v412',location.hash.slice(1));const sites=`);
    }
    if(url.pathname==='/workflow-enhancements-v432.js'||url.pathname==='/activity-history.js')await sleep(180);
    return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  await page.addInitScript(()=>{
    window.framesSeen=[];
    function sample(){
      const root=document.getElementById('view');
      if(root){
        const visible=s=>[...root.querySelectorAll(s)].some(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
        const markers=[['home','.shell411-safety-home'],['stats','.stats426'],['field','.field-six-home'],['queue','[data-executive-queue]'],['history','.activity-history'],['hub','.hub-hero'],['records','.field411-screen'],['inquiry','.wf412-page']];
        const state=markers.filter(([,s])=>visible(s)).map(([s])=>s).join('+');
        if(state!==window.framesSeen.at(-1))window.framesSeen.push(state);
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const start=async(view='')=>{
    await page.goto(origin+'/stable412.html?role='+role+'&restore='+encodeURIComponent(view)+'#'+view);
    await page.waitForFunction(()=>!!document.querySelector('.platform-hub')&&typeof window.enlReturnToPlatform==='function');
    await page.waitForTimeout(580);
    return page.evaluate(()=>framesSeen);
  };
  const select=async key=>{
    if(key==='home')await page.locator('[data-worktab=home]').click();
    else if(key==='incident')await page.locator('[data-module=incident]').click();
    else {
      const mobile=page.locator('.hub-mobile-menu');
      if(await mobile.isVisible())await mobile.click();
      await page.locator('.hub-sidebar [data-hub='+key+']').click();
    }
  };
  const active=key=>page.waitForFunction(k=>document.querySelector('[aria-current][data-worktab]')?.dataset.worktab===k,key);
  const cold=await start();
  const history=await start(role==='worker'?'incidents':'common-history');
  console.log(role,width,'entry',cold,'restored history',history);
  if(!field)assert.ok(!cold.some(s=>s.split('+').includes('home')),'intermediate HQ home '+cold);
  assert.ok(!history.some(s=>s.split('+').includes(field?'field':'home')),'wrong home during restore '+history);
  assert.ok(history.some(s=>s.split('+').includes(role==='worker'?'records':'history')),'restored destination '+history);
  await select('home');await active('home');
  await select('incident');await active('incident');
  await page.locator(role==='worker'?'.field411-screen':field?'.field-six-home':'.stats426').waitFor();
  if(role==='field'){
    await page.locator('[data-field-task=records]').click();await page.locator('.field411-screen').waitFor();
  }else if(!field){
    await page.locator('.shell411-nav [data-shell-view=incidents]').click();
    await page.waitForFunction(()=>currentView==='incidents');
  }
  if(role==='field'){
    const stale=await page.evaluate(async()=>{
      const api=window.enlAuthApi;
      const pending=[];
      window.enlAuthApi=b=>b.action==='personnel_pull'?new Promise(resolve=>pending.push(resolve)):api(b);
      try{
        const u=currentUser();
        const older=window.enlRenderPersonnelPage(u);
        const newer=window.enlRenderPersonnelPage(u);
        pending[1]({personnel:[{name:'현재 명단',personnel_id:'new',access_role:'worker'}]});await newer;
        pending[0]({personnel:[{name:'이전 명단',personnel_id:'old',access_role:'worker'}]});await older;
        return document.getElementById('pm434Body').innerText.includes('이전 명단');
      }finally{window.enlAuthApi=api}
    });
    assert.equal(stale,false);
  }
  await select('home');await active('home');
  await select('boards');await active('boardAll');
  await page.waitForTimeout(180);
  assert.equal(await page.locator('#view [data-executive-queue]:visible').count(),0);
  await select('home');await active('home');
  const result=await page.evaluate(async()=>{
    const frame=document.querySelector('.platform-hub');
    const pending=frame.activateWorkTab('incident');
    await frame.activateWorkTab('home');await pending;
    return [frame.dataset.workspace,currentView];
  });
  assert.deepEqual(result,['home','platform']);
  await page.locator('#userChip').click();await page.locator('#logoutBtn').click();
  await page.locator('#loginName411').waitFor();
  await page.evaluate(role=>{
    const field=['worker','field'].includes(role),name='검수 담당',id='fixture-'+role;
    const accountKey=(field?'site:':'hq:')+id;
    const session={deviceSession:'b'.repeat(64),expiresAt:new Date(Date.now()+86400000).toISOString(),passwordPolicy:{initial:false}};
    // The login handler has its own API reference, so intercept the transport.
    const fetch=window.fetch;
    window.fetch=async(input,init)=>{
      let body;try{body=JSON.parse(init?.body)}catch{}
      let reply;
      if(body?.action==='lookup')reply={options:[{kind:field?'site':'hq',accountKey,siteId:'qa-site',affiliationId:'dept:qa',affiliationLabel:'검수 사업장',requiresPassword:true,passwordOnly:true}]};
      if(body?.action==='login_hq')reply={...session,user:{id,name,role,department:'검수',active:true}};
      if(body?.action==='login_site')reply={...session,person:{personnel_id:id,name,site_id:'qa-site',site_name:'검수 사업장',job_title:role==='field'?'현장소장':'일반근로자',access_role:role,active:true}};
      if(reply)return Response.json({ok:true,...reply});
      return fetch(input,init);
    };
    window.framesSeen.length=0;
  },role);
  await page.locator('#loginName411').fill('검수 담당');
  await page.locator('#loginPassword411').fill('isolated');
  await page.locator('#loginSubmit411').click();await active('home');
  await page.locator('[data-module=incident]').waitFor();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>currentUser()?.role),role);
  assert.ok(!(await page.evaluate(()=>framesSeen)).some(s=>s.split('+').some(m=>['stats','home','field','queue'].includes(m))),'unrelated view after login');
  assert.deepEqual(errors,[]);
  console.log('PASS navigation',role,width);
}
(async()=>{
  for(const role of process.env.ENL_TEST_ROLES?.split(',')||roles){
    for(const width of process.env.ENL_TEST_WIDTHS?.split(',').map(Number)||[1365,393]){
      const browser=await chromium.launch();
      try{await exercise(browser,role,width)}finally{await browser.close()}
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1});
