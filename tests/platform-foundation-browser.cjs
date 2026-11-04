'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const {tab,noOverflow}=require('./field-entry-table-browser.cjs');
(async()=>{for(const [engine,width] of [[chromium,1365],[webkit,390],[webkit,820],[chromium,320]]){
 const browser=await engine.launch();
 try{
  for(const role of ['safety','manager','field']){
   const {p,c}=await tab(browser,width,role);await p.waitForFunction(()=>!!currentUser()&&!!window.enlPlatformHome);
   let revision=1,modules=['incident','risk','tbm','organization','training'].map(key=>({key,state:key==='incident'?'live':'building',roles:['worker','field','safety','manager','executive'],preview:false,pilots:[]}));
   await c.route('**/*',async route=>{
     const req=route.request(),b=req.method()==='POST'?req.postDataJSON():null;
     if(b?.action==='platform_catalog')return route.fulfill({json:{ok:true,modules,revision}});
     if(b?.action==='platform_save'){modules=b.modules;revision++;return route.fulfill({json:{ok:true,revision}})}
     return route.fallback();
   });
   const mountHub=()=>{
    const base=window.enlIncidentApi;
    window.enlIncidentApi=async b=>{
     if(b.action==='platform_notices')return {rows:[{key:'incident',push:true,email:true}]};
     if(b.action==='platform_notice_set')return {ok:true};
     if(b.action==='platform_enter'){if(b.key!=='incident')throw Error('module_unavailable');return {key:'incident',state:'live'};}
     if(b.action==='platform_duties')return {duties:['safety','health']};return base(b);
    };
    document.querySelector('.platform-hub')?.remove();currentView='platform';window.enlRenderApp(currentUser());
   };await p.evaluate(mountHub);
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
    const grip=risk.locator('.feature-grip');await grip.scrollIntoViewIfNeeded();
    const src=await grip.boundingBox(),dest=await p.locator('[data-key=incident]').boundingBox();
    const x=src.x+src.width/2,y=src.y+src.height/2,target=dest.y+dest.height/2;
    if(engine===chromium&&width===320){
      const session=await c.newCDPSession(p);
      const touch=(type,cy)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:cy==null?[]:[{x,y:cy,id:1}]});
      await touch('touchStart',y);await touch('touchMove',(y+target)/2);await touch('touchMove',target);
      assert.ok(await risk.evaluate(n=>n.classList.contains('moving')&&!!n.style.transform));
      await touch('touchEnd');
    }else{
      await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x,target,{steps:10});
      assert.ok(await risk.evaluate(n=>n.classList.contains('moving')&&!!n.style.transform));
      await p.mouse.up();
    }
    await p.waitForFunction(()=>document.querySelector('[data-module]').dataset.module==='risk');
    assert.equal(await panel.count(),0);await p.reload();await p.waitForFunction(()=>!!currentUser()&&!!window.enlPlatformHome);
    await p.evaluate(mountHub);await p.waitForFunction(()=>document.querySelector('[data-module]')?.dataset.module==='risk');
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
