'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {tab,noOverflow}=require('./field-entry-table-browser.cjs');
(async()=>{
 for(const [engine,width,roles] of [[chromium,1365,['safety','field','manager','executive']],[chromium,320,['safety']],[webkit,390,['safety']],[webkit,820,['safety']]]){
  const browser=await engine.launch();
  try{for(const role of roles){
   const {p,c}=await tab(browser,width,role);
   let enabled=true,modules=[{key:'incident',state:'live'}],services=[{key:'system',state:'live'}];const gates=[],savedUsers=[],personnel=[];
   await c.route('**/*',async route=>{
    const req=route.request(),b=req.method()==='POST'?req.postDataJSON():null;
    if(b?.action==='platform_catalog')return route.fulfill({json:{revision:1,modules,services}});
    if(b?.action==='platform_save'){if(b.group==='services')services=b.modules;else modules=b.modules;return route.fulfill({json:{ok:true,revision:2}})}
    if(b?.action==='personnel_pull')return route.fulfill({json:{ok:true,personnel}});
    if(b?.action==='personnel_upsert'){
      assert.equal(b.person.accessRole,'field');assert.equal(b.person.jobTitle,'파트장');
      personnel.splice(0,1,{personnel_id:'sample-person',name:b.person.name,access_role:'field',job_title:b.person.jobTitle,duties:b.person.duties,active:true});
      return route.fulfill({json:{ok:true,person:personnel[0]}});
    }
    if(b?.action==='platform_duties')return route.fulfill({json:{ok:true,duties:personnel[0].duties}});
    if(b?.action==='platform_enter'){gates.push(b.key);return route.fulfill({status:enabled?200:403,json:{ok:enabled,key:b.key,message:enabled?'ok':'module_unavailable'}})}
    if(b?.action==='hq_upsert'){const {passwordHash,...record}=b.user;savedUsers.push(record);return route.fulfill({json:{ok:true,user:record}})}
    if(b?.action==='hq_list'&&savedUsers.length)return route.fulfill({json:{ok:true,users:[{id:'sample-safety',role:'safety',name:'검수 담당'},...savedUsers]}});
    if(b?.action==='platform_directory')return route.fulfill({json:{ok:true,rows:[],more:false}});
    return route.fallback();
   });
   await p.waitForFunction(()=>!!currentUser()&&!!window.enlOpenSystemAdmin);
   await p.evaluate(()=>{currentView='platform';renderShell(currentUser())});
   await p.locator('[data-module=incident]').waitFor();
   if(role!=='safety'){
    assert.equal(await p.locator('[data-service=system],.feature-pencil,.feature-grip,.feature-controls [role=switch],#settingsBtn411').count(),0);
    await p.evaluate(()=>{currentView='system-admin';renderShell(currentUser())});
    await p.locator('[data-module=incident]').waitFor();assert.equal(await p.locator('.system-admin').count(),0);
   }else{
    await p.locator('[data-key=incident] .feature-pencil').click();await p.getByLabel('업무기능 이름',{exact:true}).fill('사고 <보고>');
    await p.locator('.feature-name-form [type=submit]').click();await p.getByRole('button',{name:'사고 <보고>',exact:true}).waitFor();assert.equal(modules[0].displayName,'사고 <보고>');
    await p.locator('[data-key=system] .feature-pencil').click();await p.getByLabel('서비스 이름',{exact:true}).fill('공통 설정');
    await p.locator('.feature-name-form [type=submit]').click();await p.getByRole('button',{name:'공통 설정',exact:true}).waitFor();
    assert.equal(services[0].displayName,'공통 설정');assert.equal(modules[0].displayName,'사고 <보고>');
    await noOverflow(p);await p.locator('[data-service=system]').click();
    const workspace=p.locator('.system-admin');await workspace.locator('#sa415CreateSite').waitFor();
    assert.equal(await p.evaluate(()=>currentView),'system-admin');assert.equal(await p.locator('.shell411-nav').count(),0);
    assert.ok(gates.includes('system'));await noOverflow(p);
    await workspace.locator('[data-sa415-site=s01]').click();await p.locator('#sa415SiteForm').waitFor();
    assert.equal(await workspace.locator('[data-platform-modules]').count(),0);
    assert.deepEqual(await workspace.locator('#sa415SiteStatus option').allTextContents(),['운영중','계약종료']);
    await p.locator('#sa415NewManager').waitFor();assert.equal(await p.locator('#sa415People .platform-duties').count(),0);
    for(const id of ['sa415NewManager','sa415AddWorkers'])assert.ok(await p.locator('#'+id).evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.clientHeight>=42));
    await p.locator('#sa415NewManager').click();await p.locator('#sa415PersonName').fill('검수 파트장');await p.locator('#sa415PersonPosition').selectOption('파트장');await p.locator('#sa415PersonPassword').fill('isolated-test');
    await p.locator('#sa415PersonForm [value=supervisor]').check();await p.locator('#sa415PersonForm button[type=submit]').click();
    await p.getByText('(관리감독자)',{exact:true}).waitFor();
    await p.locator('[data-sa415-person=sample-person]').click();await p.locator('#sa415PersonForm [value=health]').check();
    await p.locator('#sa415PersonForm button[type=submit]').click();await p.getByText('(관리감독자, 보건관리자)',{exact:true}).waitFor();
    await noOverflow(p);await p.evaluate(()=>closeModal());
    await workspace.locator('[data-sa415-tab=hq]').click();await workspace.locator('#sa415AddHq').click();await p.locator('#hqUserForm422').waitFor();
    await p.locator('#hqName422').fill('검수 사용자');await p.locator('#hqRole422').selectOption('manager');
    await p.locator('#hqPw422').fill('isolated-test');await p.locator('#hqSave422').click();
    await workspace.locator('#sa415HqList').getByText('검수 사용자',{exact:true}).waitFor();
    assert.equal(savedUsers.length,1);
    await workspace.locator('[data-sa415-tab=directory]').click();await workspace.locator('.platform-accounts').waitFor();
    await p.locator('[data-platform-home]').click();await p.locator('[data-module=incident]').click();
    await p.locator('[data-shell-view=more]').click();await workspace.locator('.platform-accounts').waitFor();
    await p.evaluate(()=>{currentView='platform';renderShell(currentUser())});await p.locator('[data-module=incident]').waitFor();
    enabled=false;
    await p.evaluate(()=>{currentView='more';renderShell(currentUser())});await workspace.getByText(/시스템 관리에 진입할 수 없습니다/).waitFor();
    assert.equal(await workspace.locator('[data-sa415-tab]').count(),0);
   }
   console.log('PASS common system workspace',engine.name(),width,role);await c.close();
  }}finally{await browser.close()}
 }
})().catch(err=>{console.error(err);process.exitCode=1});
