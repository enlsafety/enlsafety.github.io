'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function verify(engine,mobile) {
 const browser=await engine.launch();
 try{
  for(const role of ['safety','field','manager','executive']){
   const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:900},hasTouch:mobile,isMobile:mobile});
   const errors=[];
   p.on('pageerror',err=>errors.push(err.message));
   const origin='http://sidebar.test';
   await p.route('**/*',async route=>{
    const u=new URL(route.request().url()),file=path.join(process.cwd(),u.pathname);
    if(u.origin!==origin||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
    let body=fs.readFileSync(file);
    if(u.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
    const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
    return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
   });
   await p.goto(origin+'/stable412.html?role='+role);
   const nav=p.locator('.hub-sidebar nav'),hub=p.locator('.platform-hub');
   const drawer=async()=>{if(mobile&&!await hub.evaluate(el=>el.classList.contains('hub-menu-open')))await p.locator('.hub-mobile-menu').click()};
   const menus=()=>nav.locator('[data-hub]').evaluateAll(bs=>bs.map(b=>b.dataset.hub));
   await p.locator('.hub-sidebar nav [data-hub="feature:incident"]').waitFor({state:'attached'});
   await drawer();
   const before=await menus();assert.deepEqual(before.slice(0,3),['home','safetyCard','boards']);
   const edit=p.locator('.hub-sidebar-editor [data-edit]');
   if(role==='safety'){
    const up=label=>nav.getByRole('button',{name:label+' 위로',exact:true});
    await edit.click();assert.equal(await up('안전관리카드').isDisabled(),true);
    await up('게시판').click();assert.deepEqual((await menus()).slice(0,3),['home','boards','safetyCard']);
    await p.locator('.hub-sidebar-editor [data-cancel]').click();assert.deepEqual(await menus(),before);
    await edit.click();await up('게시판').click();await edit.click();
    await p.waitForFunction(()=>document.querySelector('.hub-sidebar-editor [data-edit]').getAttribute('aria-pressed')==='false');
    await hub.evaluate(el=>el.reloadCatalog());assert.deepEqual((await menus()).slice(0,3),['home','boards','safetyCard']);
    await edit.click();await up('안전관리카드').click();await edit.click();
    await p.waitForFunction(()=>document.querySelector('.hub-sidebar-editor [data-edit]').getAttribute('aria-pressed')==='false');
    assert.deepEqual(await menus(),before);
   }else assert.equal(await edit.count(),0);
   await nav.locator('[data-hub="safetyCard"]').click();
   await p.locator('.safety-card-panel').getByRole('heading',{name:'안전관리카드',exact:true}).waitFor();
   assert.equal(await nav.locator('[data-hub="safetyCard"]').getAttribute('aria-current'),'page');
   await drawer();await nav.locator('[data-hub="boards"]').click();
   await p.locator('[data-list-workspace="boardAll"]').waitFor();
   await p.locator('[data-worktab="safetyCard"]').click();
   await p.locator('.safety-card-sites button').first().waitFor();
   assert.deepEqual(errors,[]);
   await p.close();
   console.log('PASS sidebar order, access and navigation',role,engine.name());
  }
 }finally{await browser.close()}
}
(async()=>{await verify(chromium,false);await verify(webkit,true)})().catch(err=>{console.error(err);process.exitCode=1});
