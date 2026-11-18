'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function verify(engine,mobile) {
 const browser=await engine.launch();
 try{
  for(const role of ['safety','manager','executive']){
   const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:900},hasTouch:mobile,isMobile:mobile});
   const errors=[];
   p.on('pageerror',err=>errors.push(err.message));
   const origin='http://sidebar.test';
   await p.route('**/*',async route=>{
    const u=new URL(route.request().url()),file=path.join(process.cwd(),u.pathname);
    if(u.origin!==origin||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
    let body=fs.readFileSync(file);
    if(u.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
    if(u.pathname==='/tests/integrated-home-fixture.js')body=body.toString().replace(' const moduleKeys='," incidents.push({...incidents[0],id:'qa-pending',status:'approved',corrective:{status:'approved'},executiveApproval:{state:'pending',round:1,roster:[{id:'fixture-executive',name:'검수 임원',position:'상무'},{id:'qa-president',name:'검수 사장',position:'사장'}],signatures:[]}}); const moduleKeys=");
    const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
    return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
   });
   await p.goto(origin+'/stable412.html?role='+role);
   const nav=p.locator('.hub-sidebar nav'),hub=p.locator('.platform-hub');
   await nav.locator('[data-hub="feature:incident"]').waitFor({state:'attached'});
   if(mobile)await p.locator('.hub-mobile-menu').click();
   await nav.locator('[data-hub="feature:incident"]').click();
   await p.locator('.stats426-head').getByRole('heading',{name:'사고 대시보드',exact:true}).waitFor();
   await p.locator('[data-sd450-map]').waitFor();
   await p.locator('[data-analysis-month-card]').waitFor();
   const sections=await p.locator('.stats426-head,.analysis-dashboard-context,.analysis-dashboard-cost,[data-analysis-month-card]').evaluateAll(els=>els.map(el=>({name:el.textContent,top:el.getBoundingClientRect().top})));
   assert.equal(sections.length,4);
   assert.ok(sections.every((s,i)=>!i||s.top>sections[i-1].top),'dashboard, summary, costs, monthly sections in order');
   for(const view of ['home','incidents','closed','stats']){
    await p.locator(view==='closed'?'[data-lifecycle-closed]':'[data-shell-view="'+view+'"]').click();
    await p.waitForFunction(view=>currentView===view,view);
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await p.locator('[data-executive-queue]').count(),0,'no personal approval block on '+view);
    assert.equal(await p.getByRole('heading',{name:/내 결재|경영진 결재현황/}).count(),0);
   }
   assert.deepEqual(errors,[]);
   await p.close();
   console.log('PASS dashboard first entry, section order and removed approval block',role,engine.name());
  }
 }finally{await browser.close()}
}
(async()=>{await verify(chromium,false);await verify(webkit,true)})().catch(err=>{console.error(err);process.exitCode=1});
