'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');

const scenarios=[
  ['first','reported','reported'],['request','supplement_any','supplement'],
  ['resubmission','supplement_any','supplement_submitted'],['waiting','plan_missing','approved'],
  ['plan','action_progress','approved','planned'],['repair','action_progress','approved','in_progress'],
  ['redo','action_progress','approved','rejected'],['submitted','action_review','approved','submitted'],
  ['returned','action_review','approved','submitted','rejected'],['sign','approval','approved','approved','pending'],
  ['done','closed','closed','approved','approved'],['legacy','closed','closed']
];
const items=scenarios.flatMap(([key,stage,status,action,state])=>['person','property'].map(category=>({
  id:category+'-'+key,category,status,stage,
  historicalImport:key==='legacy'?{enabled:true,erpApproved:true,workflowExempt:true,transferState:'closed'}:null,
  corrective:action?{status:action,planDetail:'점검'}:null,
  executiveApproval:state?{state,roster:[{id:'fixture-executive',position:'사장'}],signatures:[]}:null
})));
items.push({id:'other-case',category:'near_miss',status:'reported',stage:'reported'});
async function check(engine,role,width){
  const browser=await engine.launch();
  try{
    const page=await browser.newPage({viewport:{width,height:900}});
    const origin='http://stages.test';
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      const file=path.join(process.cwd(),url.pathname);
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      let body=fs.readFileSync(file);
      if(url.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
      if(url.pathname==='/tests/integrated-home-fixture.js')body=body.toString().replace('const moduleKeys=', 'incidents.splice(0,1,...'+JSON.stringify(items)+'.map(item=>({...incidents[0],...item})));const moduleKeys=');
      const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
      return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
    });
    await page.goto(origin+'/stable412.html?role='+role);
    await page.waitForFunction(()=>currentUser()&&window.enlReturnToPlatform);
    await page.evaluate(()=>window.enlReturnToPlatform(currentUser()));
    const menu=page.locator('.hub-mobile-menu');
    if(await menu.isVisible())await menu.click();
    await page.locator('.hub-sidebar [data-hub="feature:incident"]').click();
    await page.locator('[data-shell-view=home]').click();
    const card=k=>page.locator('[data-safety-status="'+k+'"]');
    await page.waitForFunction(n=>document.querySelector('[data-safety-status=all] b')?.textContent===String(n),items.length);
    for(const cat of ['person','property','other']){
      await page.locator('[data-overview-category="'+cat+'"]').click();
      const rows=items.filter(i=>cat==='other'?i.category==='near_miss':i.category===cat);
      const order=await page.locator('[data-safety-status]').evaluateAll(es=>es.map(e=>e.dataset.safetyStatus));
      assert.deepEqual(order,['all','reported','supplement_any','plan_missing','action_progress','action_review','approval','closed']);
      for(const stage of order){
        const ids=rows.filter(i=>stage==='all'||i.stage===stage).map(i=>i.id).sort();
        assert.equal(await card(stage).locator('b').textContent(),String(ids.length));
        if(cat==='other'&&stage!=='reported')continue;
        await card(stage).click();
        const list=page.locator('#view .shell411-filter-head').locator('..');
        await list.waitFor();
        assert.deepEqual((await list.locator('[data-inc-id]').evaluateAll(es=>es.map(e=>e.dataset.incId))).sort(),ids);
        await page.locator('#backSafetyHome411').click();
        assert.equal(await page.locator('[data-overview-category="'+cat+'"]').getAttribute('aria-pressed'),'true');
      }
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log('PASS incident cards, counts, scoped lists and return navigation',engine.name(),role,width);
  }finally{await browser.close();}
}
(async()=>{await check(chromium,'safety',1400);await check(webkit,'manager',390);await check(chromium,'executive',768)})().catch(e=>{console.error(e);process.exitCode=1;});
