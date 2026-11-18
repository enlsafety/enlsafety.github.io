'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function check(engine,width,height){
 const b=await engine.launch(),p=await b.newPage({viewport:{width,height},deviceScaleFactor:width===390?2:1});
 try{
  const origin='http://depth.test';
  await p.route('**/*',async route=>{
   const u=new URL(route.request().url()),file=path.join(process.cwd(),u.pathname);
   if(u.origin!==origin||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
   let body=fs.readFileSync(file);
   if(u.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
   const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
   await route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  await p.goto(origin+'/stable412.html?role=safety');await p.waitForFunction(()=>currentUser()&&window.enlReturnToPlatform);
  await p.evaluate(()=>window.enlReturnToPlatform(currentUser()));
  const menu=p.locator('.hub-mobile-menu');if(await menu.isVisible())await menu.click();
  await p.locator('.hub-sidebar [data-hub="feature:incident"]').click();
  const rows=p.locator('.sd450-ranked-list button');await rows.first().waitFor();
  const geometry=()=>p.evaluate(()=>{
   const get=s=>document.querySelector(s),rect=e=>e.getBoundingClientRect(),panel=get('.sd450-map-panel'),sc=get('[data-sd450-summary]'),first=get('.sd450-ranked-list button'),second=first.nextElementSibling,last=first.parentElement.lastElementChild,h=get('.analysis-dashboard-context'),right=e=>rect(e).left+e.clientLeft+e.clientWidth;
   const heading=get('.sd450-ranking h3'),desc=get('.sd450-ranking p');
   return {map:[rect(panel).width,rect(get('.sd450-map-viewport')).width,rect(get('.sd450-map-viewport')).height],extent:document.documentElement.scrollWidth,
    left:rect(first).left-rect(sc).left,right:right(sc)-rect(first).right,innerScroll:sc.scrollHeight>sc.clientHeight,rowGap:rect(second).top-rect(first).bottom,
    captionGap:rect(first).top-rect(desc).bottom,titleLeft:rect(heading).left-rect(sc).left,
    headingInset:rect(h.querySelector('h3')).top-rect(h).top,textInset:rect(h.querySelector('p')).left-rect(h).left,
    buttonInset:rect(h).right-rect(h.querySelector('button')).right,shadows:[panel,get('.sd450-map-frame'),h].map(e=>getComputedStyle(e).boxShadow),rows:first.parentElement.children.length};
  });
  await p.evaluate(()=>document.fonts.ready);
  const after=await geometry();
  console.log(engine.name(),width,JSON.stringify(after));
  for(const key of ['left','right','titleLeft','headingInset','textInset','buttonInset'])assert.ok(after[key]>=9,key);
  assert.ok(after.rowGap>=7&&after.captionGap>=10&&after.rows>=30&&after.extent<=width+1);
  assert.ok(after.shadows.every(v=>v!=='none')&&after.shadows.every(v=>!v.includes('inset')));
  await p.screenshot({path:'qa-depth-'+width+'.png'});
  await p.locator('.analysis-dashboard-context').evaluate(el=>el.scrollIntoView({block:'center'}));
  await p.screenshot({path:'qa-summary-'+width+'.png'});
  await rows.last().scrollIntoViewIfNeeded();
  await rows.last().click();
  await p.locator('[data-sd450-summary] .sd450-compact-info').waitFor();
  await p.locator('#sd450Site').selectOption('');
  await rows.first().waitFor();
  await p.locator('[data-map-zoom=in]').click();assert.equal(await p.locator('[data-map-scale]').innerText(),'150%');
 }finally{await b.close()}
}
(async()=>{await check(chromium,1528,814);await check(chromium,1024,768);await check(webkit,390,844)})().catch(e=>{console.error(e);process.exitCode=1});
