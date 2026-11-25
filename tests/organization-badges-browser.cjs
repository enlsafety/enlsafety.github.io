'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');

async function check(engine,width) {
  const browser=await engine.launch();
  try {
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<800});
    await page.setContent('<body class="safety-ui"><div id="app"><main class="platform-hub hub-menu-open"><aside class="hub-sidebar"><nav><div class="hub-sidebar-row"><button data-hub="feature:incident">사고보고<span class="org-dot hub-task-dot"></span></button></div><details open class="hub-document-menus"><summary>안전보건 서류관리</summary><div class="hub-sidebar-row"><button data-hub="feature:organization"><svg class="hub-nav-picto"></svg><span>01. 안전보건 조직</span></button></div></details></nav></aside></main></div>');
    for(const file of ['style.css','platform-dashboard.css','organization.css'])await page.addStyleTag({path:file});
    await page.addScriptTag({path:'document-photo-viewer.js'});
    await page.addScriptTag({path:'organization.js'});
    for(const role of ['safety','field','manager','executive','worker']){
      await page.evaluate(role=>{
        const host=document.querySelector('main');
        host.setDocumentApprovalState=(key,count,label)=>{const button=host.querySelector('[data-hub="feature:'+key+'"]');button.querySelector('.hub-document-dot')?.remove();if(count){const dot=document.createElement('span');dot.className='hub-document-dot';dot.setAttribute('aria-label',label);button.append(dot);}};
        window.records=[{active:true,checked:false,state:'empty'},{active:false,checked:false,state:'empty'}];
        window.org=enlOrganization(host,{role},async()=>({sites:window.records}),()=>window.orgRole===role);
        window.orgRole=role;
        window.org.catalog({state:'live',canEnter:true});
      },role);
      const org=page.locator('[data-hub="feature:organization"]>.hub-document-dot');
      for(const state of ['empty','draft','pending','approved','draft']){
        await page.evaluate(state=>{
          window.records[0]={active:true,state,checked:state==='approved',documentStates:{chart:state,appointment:state,certificate:state}};
          window.dispatchEvent(new Event('focus'));
        },state);
        const actionable=state!=='approved'&&!(role==='field'&&state==='pending');
        await org.waitFor({state:actionable?'visible':'detached'});
        if(actionable)assert.match(await org.getAttribute('aria-label'),/1개 사업장/);
      }
      const centers=await page.locator('.hub-sidebar button>:is(.org-dot,.hub-document-dot)').evaluateAll(dots=>dots.map(dot=>{
        const b=dot.getBoundingClientRect(),row=dot.parentElement.getBoundingClientRect();
        return {x:b.x+b.width/2,dy:b.y+b.height/2-row.y-row.height/2};
      }));
      assert.equal(centers.length,2);
      assert.ok(centers.every(p=>Math.abs(p.dy)<1),JSON.stringify(centers));
      for(const closed of [true,false]){
        await page.locator('summary').click();
        assert.equal(await page.locator('details').evaluate(el=>el.open),!closed);
        const marker=await page.locator('summary').evaluate(el=>getComputedStyle(el,'::before').content);
        assert.ok(['none','normal'].includes(marker),marker);
        assert.equal(await org.count(),1);
      }
    }
    console.log('PASS organization work states, role scope, disclosure and badge geometry',engine.name(),width);
  } finally { await browser.close(); }
}
(async()=>{for(const [engine,width] of [[chromium,1365],[chromium,390],[webkit,390]])await check(engine,width)})().catch(err=>{console.error(err);process.exitCode=1});
