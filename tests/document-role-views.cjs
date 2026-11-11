'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {orgFixture}=require('./organization.cjs');
const origin='https://docs.test';
const roles=['field','manager','executive','safety'];
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'};
const chart={lead:'검수 책임자',supervisor:'검수 감독자',teams:['코스관리','스프링쿨러','서무','기타'].map(name=>({name,regular:2,daily:1}))};

async function verify(f,role,saved){
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:saved?1365:393,height:850}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('documentRequest',async body=>{
      const {actor,...payload}=body;
      return f.call(role,payload);
    });
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      const local=path.join(process.cwd(),url.pathname);
      if(!fs.existsSync(local)||!fs.statSync(local).isFile())return route.fulfill({status:404,body:''});
      let body=fs.readFileSync(local);
      if(url.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
      if(url.pathname.endsWith('integrated-home-fixture.js')){
        body=body.toString().replace('let out={ok:true',`if(['platform_catalog','platform_enter'].includes(b.action)||b.action?.startsWith('platform_org_')){
          const r=await window.documentRequest(b);return Response.json(r.body,{status:r.status});
        }
        let out={ok:true`);
      }
      return route.fulfill({body,contentType:mime[path.extname(local)]||'application/octet-stream'});
    });
    await page.goto(origin+'/stable412.html?role='+role);
    const sidebar=page.locator('.hub-document-menus');
    const buttons=sidebar.locator('button[data-hub]');
    async function showSidebar(){
      const mobile=page.locator('.hub-mobile-menu');
      if(await mobile.isVisible()&&!await sidebar.isVisible())await mobile.click();
      else if(await mobile.isVisible()&&!await page.locator('.platform-hub').evaluate(e=>e.classList.contains('hub-menu-open')))await mobile.click();
    }
    await buttons.first().waitFor({state:'attached'});
    const keys=await buttons.evaluateAll(es=>es.map(e=>e.dataset.hub.slice(8)));
    assert.equal(keys.length,10);
    if(!saved)for(const key of keys.filter(k=>k!=='organization')){
      await showSidebar();
      const link=sidebar.locator('[data-hub="feature:'+key+'"]');
      const label=await link.locator('span').last().textContent();
      await link.click();await page.locator('.hub-module-preview:visible').waitFor();
      assert.equal(await page.locator('.hub-module-preview h2').innerText(),label);
    }
    await showSidebar();await sidebar.locator('[data-hub="feature:organization"]').click();
    const site=page.locator('.org-folder[data-site-id="qa-site"]');
    await site.click();
    const main=page.locator('.org-main');
    for(const key of ['appointment','evaluation','chart']){
      const rail=page.locator('.org-rail');if(!await rail.evaluate(e=>e.open))await rail.locator('summary').click();
      await page.locator('[data-owner="qa-site"][data-doc="'+key+'"]').click();
      if(key!=='chart')assert.match(await main.innerText(),/준비 중/);
    }
    await main.locator('.org-paper img').waitFor();
    assert.ok(await main.locator('.org-paper img').evaluate(async e=>{await e.decode();return e.naturalWidth>0}));
    const reader=['manager','executive'].includes(role);
    assert.equal(await main.locator('form').count(),reader||saved?0:1);
    assert.equal(await page.locator('[data-folder-action]').count(),role==='safety'?3:0);
    if(reader)assert.equal(await main.getByRole('button',{name:/조직도 저장|최신화 (수정|확인|승인)|저장본 삭제/}).count(),0);
    if(saved){
      assert.equal(await main.locator('.org-versions option').count(),3);
      assert.match(await main.innerText(),/승인 완료/);
      assert.ok(await main.getByRole('button',{name:'PDF 출력'}).isVisible());
      await main.locator('.org-versions select').selectOption('1');
      await page.waitForFunction(()=>document.querySelector('.org-versions select')?.value==='1');
      assert.match(await main.locator('svg').textContent(),/검수 책임자/);
    }else{
      assert.match(await main.innerText(),/미작성 기본 양식/);
      await main.getByRole('button',{name:'양식 확대'}).click();
      assert.ok(await main.locator('.org-preview').evaluate(e=>e.classList.contains('org-zoomed')));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS',role,saved?'approved and historical':'empty template and ten category links');
  }finally{await browser.close()}
}
(async()=>{
  const f=await orgFixture();
  try{
    // Only a fixture image is needed to verify decoding and rendering.
    await f.db.query("insert into private.enl_org_templates values('v1',$1)",[fs.readFileSync('assets/banners/golf-r86.webp')]);
    for(const role of roles)await verify(f,role,false);
    const {period}= (await f.call('field',{action:'platform_org_list'})).body;
    for(const [i,op] of ['save','confirm','approve'].entries()){
      const r=await f.call(op==='approve'?'safety':'field',{action:'platform_org_'+op,siteId:'qa-site',revision:i,folderRevision:1,period,...(i===0?{chart}:{})});
      assert.equal(r.status,200,JSON.stringify(r.body));
      const open={action:'platform_org_open',siteId:'qa-site'};
      const reference=(await f.call('safety',open)).body;
      assert.equal(reference.state,['draft','pending','approved'][i]);
      for(const role of roles){
        const result=await f.call(role,open);
        assert.equal(result.status,200);
        assert.deepEqual(result.body.document,reference.document);
        assert.deepEqual(result.body.history,reference.history);
        assert.equal(result.body.state,reference.state);
      }
    }
    for(const role of ['manager','executive']){
      for(const op of ['save','confirm','approve','reopen','delete']){
        const r=await f.call(role,{action:'platform_org_'+op,siteId:'qa-site',revision:3,targetRevision:3,folderRevision:1,period,chart});
        assert.equal(r.status,403);
      }
    }
    for(const role of roles)await verify(f,role,true);
  }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
