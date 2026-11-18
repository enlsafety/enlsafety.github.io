'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function check(engine,width,height){
 const b=await engine.launch(),p=await b.newPage({viewport:{width,height},hasTouch:width===390,isMobile:width===390});
 try{
  const origin='http://depth.test';
  await p.route('**/*',async route=>{
   const u=new URL(route.request().url()),file=path.join(process.cwd(),u.pathname);
   if(u.origin!==origin||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
   let body=fs.readFileSync(file);
   if(u.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
   if(u.pathname==='/tests/integrated-home-fixture.js')body=body.toString().replace('const moduleKeys=',    "incidents.splice(0,1,...Array.from({length:15},(_,i)=>({...incidents[0],id:'qa-'+i,siteId:i<6?'s22':i<11?'s03':i<14?'s26':'s01'}))); const moduleKeys=");
   const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
   await route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  await p.goto(origin+'/stable412.html?role=safety');await p.waitForFunction(()=>currentUser()&&window.enlReturnToPlatform);
  await p.evaluate(()=>window.enlReturnToPlatform(currentUser()));
  const menu=p.locator('.hub-mobile-menu');if(await menu.isVisible())await menu.click();
  await p.locator('.hub-sidebar [data-hub="feature:incident"]').click();
  const marker=id=>p.locator('[data-sd450-map-site="'+id+'"]');
  const visible=()=>p.locator('.sd450-marker:not([hidden])').evaluateAll(bs=>bs.filter(b=>
    getComputedStyle(b.querySelector('.sd450-marker-label')).visibility==='visible').map(b=>b.dataset.sd450MapSite));
  const panel=p.locator('[data-sd450-map]'),viewport=panel.locator('.sd450-map-viewport');
  await p.waitForFunction(()=>document.querySelectorAll('.sd450-marker.high').length===2);
  assert.deepEqual(await visible(),[]);
  assert.equal(await panel.locator('[data-map-scale]').innerText(),'120%');
  assert.equal(await panel.locator('.sd450-marker[hidden]').count(),0);
  const ids=await panel.locator('[data-sd450-map-site]').evaluateAll(bs=>bs.map(b=>b.dataset.sd450MapSite));
  assert.equal(ids.length,33);
  for(const id of ids){
    await marker(id).evaluate(el=>el.click());
    assert.deepEqual(await visible(),[id]);
    await viewport.evaluate(el=>el.click());
    assert.deepEqual(await visible(),[],'clear '+id);
    assert.equal(await p.locator('#sd450Site').inputValue(),'');
  }
  async function select(id){
    const b=marker(id);
    if(width===390){await b.tap();await b.locator('.sd450-marker-label').tap();}
    else await b.click();
    assert.equal(await p.locator('#sd450Site').inputValue(),id);
    assert.deepEqual(await visible(),[id]);
  }
  const gradeSites=['s29','s01','s26','s22'];
  const styles=await Promise.all(gradeSites.map(id=>marker(id).evaluate(el=>{
    const css=getComputedStyle(el);
    return {fill:css.backgroundColor,frame:[css.width,css.height,css.border,css.boxShadow]};
  })));
  assert.equal(new Set(styles.map(s=>s.fill)).size,4);
  for(const s of styles)assert.deepEqual(s.frame,styles[0].frame,'high-risk markers must have the same size, border and shadow');
  async function redraw(){
    const old=await viewport.elementHandle();
    await p.evaluate(()=>window.enlRenderIncidentStats(document.getElementById('view'),currentUser(),{year:document.querySelector('#stats426Year').value}));
    await p.waitForFunction(el=>!el.isConnected,old);
    await viewport.waitFor();
  }
  for(const id of gradeSites){
    if(width===390){
      await marker(id).tap();
      await redraw();
      assert.deepEqual(await visible(),[id],'first tap survives redraw '+id);
      await marker(id).locator('.sd450-marker-label').tap();
    }else{
      await marker(id).click();
      const neighbor=marker(id==='s22'?'s26':'s22');
      await neighbor.hover();
      assert.deepEqual(new Set(await visible()),new Set([id,await neighbor.getAttribute('data-sd450-map-site')]));
      assert.equal(await p.locator('#sd450Site').inputValue(),id,'hover must not change selection');
      await p.mouse.move(0,0);
    }
    assert.deepEqual(await visible(),[id],'only the clicked name stays visible '+id);
    await redraw();
    assert.deepEqual(await visible(),[id],'selection survives dashboard refresh '+id);
    assert.equal(await p.locator('#sd450Site').inputValue(),id);
  }
  await select('s22');
  await select('s29');
  await panel.locator('.sd450-map-head h2').click();
  assert.deepEqual(await visible(),[]);
  assert.equal(await p.locator('#sd450Site').inputValue(),'');
  await select('s03');
  await p.locator('.stats426-head h2').click();
  assert.deepEqual(await visible(),[]);
  assert.equal(await p.locator('#sd450Site').inputValue(),'');
  if(width!==390){
    await marker('s22').focus();await p.keyboard.press('Enter');
    assert.deepEqual(await visible(),['s22']);
    await viewport.click({position:{x:12,y:12}});
    assert.deepEqual(await visible(),[]);
  }
  console.log('PASS all 33 sites including Sofia Green, Pine Ridge, grade-independent appearance, persistent selection, blank map and outside dismissal',engine.name(),width);
 }finally{await b.close()}
}
(async()=>{await check(chromium,1528,814);await check(webkit,390,844)})().catch(e=>{console.error(e);process.exitCode=1});
