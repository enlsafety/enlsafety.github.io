'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const {tab,noOverflow}=require('./field-entry-table-browser.cjs');
(async()=>{for(const [engine,width] of [[chromium,1365],[webkit,390],[webkit,820],[chromium,320]]){
 const browser=await engine.launch();
 try{
  for(const role of ['safety','manager','field']){
   const {p,c}=await tab(browser,width,role);await p.waitForFunction(()=>!!currentUser()&&!!window.enlPlatformHome);
   await p.evaluate(()=>{
    const base=window.enlIncidentApi;let revision=1,modules=['incident','risk','tbm','organization','training'].map(key=>({key,state:key==='incident'?'live':'building',roles:['worker','field','safety','manager','executive'],preview:false,pilots:[]}));
    window.enlIncidentApi=async b=>{
     if(b.action==='platform_notices')return {rows:modules.map(m=>({key:m.key,push:true,email:true}))};
     if(b.action==='platform_notice_set')return {ok:true};
     if(b.action==='platform_catalog')return {modules,revision};if(b.action==='platform_save'){modules=b.modules;revision++;return {ok:true};}
     if(b.action==='platform_enter'){if(b.key!=='incident')throw Error('module_unavailable');return {key:'incident',state:'live'};}
     if(b.action==='platform_duties')return {duties:['safety','health']};return base(b);
    };
    currentView='platform';window.enlRenderApp(currentUser());
   });
   const card=p.locator('[data-module]');await card.first().waitFor();assert.equal(await card.count(),5);await noOverflow(p);
   const ys=await card.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));assert.ok(ys.every((y,i)=>!i||y>ys[i-1]));
   await p.getByText('추가 예정',{exact:false}).waitFor();await p.getByRole('button',{name:'알림센터',exact:true}).click();
   const push=p.getByRole('switch',{name:'사고보고 앱 푸시',exact:true});await push.click();await p.waitForFunction(()=>document.querySelector('.notice-row [role=switch]')?.getAttribute('aria-checked')==='false');
   await p.locator('[data-platform-home]').click();await card.first().waitFor();
   assert.equal(await p.locator('.shell411-nav:visible').count(),0);assert.equal(await p.locator('.platform-edit').count(),0);assert.equal(await p.locator('.feature-grip').count(),role==='safety'?5:0);
   await p.locator('[data-module=risk]').click();await p.getByText('현재 진입할 수 없는 모듈입니다.').waitFor();
   if(role==='safety'){
    await p.screenshot({path:'qa-output/platform-'+width+'.png',fullPage:true});
    const risk=p.locator('[data-key=risk]'),toggle=risk.getByRole('switch');
    await toggle.click();await p.waitForFunction(()=>document.querySelector('[data-key=risk] [role=switch]').getAttribute('aria-checked')==='true');
    await risk.locator('.feature-grip').click();const panel=p.locator('.feature-settings');
    await panel.locator('[data-role=field]').uncheck();await panel.locator('[type=submit]').click();await panel.waitFor({state:'detached'});
    if(engine===chromium){const src=await risk.locator('.feature-grip').boundingBox(),dest=await p.locator('[data-key=incident]').boundingBox();
      await p.mouse.move(src.x+12,src.y+12);await p.mouse.down();await p.mouse.move(dest.x+10,dest.y+10,{steps:10});await p.mouse.up();}
    else{await risk.locator('.feature-grip').click();await panel.locator('[data-up]').click();}
    await p.waitForFunction(()=>document.querySelector('[data-module]').dataset.module==='risk');
    await p.evaluate(()=>openUserModal(null,currentUser()));const box=p.locator('#hqUserForm422 .platform-duties');await box.waitFor();
    await box.locator('[value=health]').check();await box.locator('[value=safety]').check();assert.equal(await box.locator(':checked').count(),2);await p.evaluate(()=>closeModal());
   }
   await p.locator('[data-module=incident]').click();await p.waitForFunction(()=>currentView!=='platform');await p.locator('[data-platform-home]').click();await card.first().waitFor();
   await p.getByRole('button',{name:'통합 히스토리',exact:true}).click();await p.locator('.activity-history').waitFor();await noOverflow(p);
   let warned=false;p.once('dialog',async d=>{warned=true;await d.dismiss()});await p.locator('[data-platform-home]').click();await card.first().waitFor();assert.equal(warned,false,'history returns without prompting');
   await c.close();
  }
  console.log('PASS platform role menus, ordering, navigation, duties, shared history and viewport',engine.name(),width);
 }finally{await browser.close()}
}})().catch(e=>{console.error(e);process.exitCode=1});
