'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {tab,noOverflow}=require('./field-entry-table-browser.cjs');
(async()=>{
 for(const [engine,width,roles] of [[chromium,1365,['safety','field','manager','executive']],[chromium,320,['safety']],[webkit,390,['safety']],[webkit,820,['safety']]]){
  const browser=await engine.launch();
  try{for(const role of roles){
   const {p,c}=await tab(browser,width,role);
   let enabled=true;const gates=[],savedUsers=[];
   await c.route('**/*',async route=>{
    const req=route.request(),b=req.method()==='POST'?req.postDataJSON():null;
    if(b?.action==='platform_catalog')return route.fulfill({json:{revision:1,modules:[{key:'incident',state:'live'}],services:[{key:'system',state:'live'}]}});
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
    assert.equal(await p.locator('[data-service=system],.feature-grip,.feature-controls [role=switch],#settingsBtn411').count(),0);
    await p.evaluate(()=>{currentView='system-admin';renderShell(currentUser())});
    await p.locator('[data-module=incident]').waitFor();assert.equal(await p.locator('.system-admin').count(),0);
   }else{
    await p.locator('[data-service=system]').click();
    const workspace=p.locator('.system-admin');await workspace.locator('#sa415CreateSite').waitFor();
    assert.equal(await p.evaluate(()=>currentView),'system-admin');assert.equal(await p.locator('.shell411-nav').count(),0);
    assert.ok(gates.includes('system'));await noOverflow(p);
    await workspace.locator('[data-sa415-site=s01]').click();await p.locator('#sa415SiteForm').waitFor();await p.evaluate(()=>closeModal());
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
