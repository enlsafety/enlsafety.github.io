'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function check(browser, role, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    const origin = 'http://workspace.test';
    const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' };
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      const file = path.join(process.cwd(), url.pathname);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status:404, body:'' });
      let body = fs.readFileSync(file);
      if (url.pathname === '/stable412.html') {
        body = body.toString().replace('<head>', '<head><script src="tests/integrated-home-fixture.js"></script>');
      }
      if(url.pathname==='/tests/integrated-home-fixture.js'){
        body=body.toString().replace('localStorage.clear();sessionStorage.clear();','');
      }
      return route.fulfill({ body, contentType:mime[path.extname(file)] || 'application/octet-stream' });
    });
    await page.goto(origin + '/stable412.html?role=' + role);
    await page.waitForFunction(() => currentUser() && window.enlReturnToPlatform);
    await page.evaluate(() => window.enlReturnToPlatform(currentUser()));
    const tab = key => page.locator('[data-worktab="' + key + '"]');
    const active = key => page.waitForFunction(k => document.querySelector('[data-worktab][aria-current]')?.dataset.worktab === k, key);
    const side = async key => {
      const menu = page.locator('.hub-mobile-menu');
      if (await menu.isVisible()) await menu.click();
      await page.locator('.hub-sidebar [data-hub="' + key + '"]').click();
    };
    const editor=page.locator('.hub-sidebar-editor [data-edit]');
    if(role==='safety'){
      await editor.click();
      const rows=page.locator('.hub-sidebar-row.is-editing'), first=await rows.nth(0).locator('[data-hub]').getAttribute('data-hub');
      await rows.nth(0).dragTo(rows.nth(1));await editor.click();
      await page.waitForFunction(()=>document.querySelector('.hub-sidebar-editor [data-edit]')?.textContent==='편집모드');
      assert.equal(await page.locator('.hub-sidebar-row').nth(1).locator('[data-hub]').getAttribute('data-hub'),first);
    }else assert.equal(await editor.count(),0);
    await page.locator('[data-module=incident]').click();
    await active('incident');
    if(role==='safety'){
      for(const [w,h] of [[1366,768],[1280,720],[1024,768],[820,1180],[393,852],[375,667]]){
        await page.setViewportSize({width:w,height:h});
        const map=page.locator('.incident-overview .sd450-map-viewport');await map.waitFor();
        const boxes=await page.locator('.incident-overview .stats426-card,.incident-overview .sd450-map-viewport').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.right,r.bottom]}));
        assert.equal(boxes.length,5);assert.ok(boxes.every(([x,y,right,bottom])=>x>=0&&y>=0&&right<=w+1&&bottom<=h),JSON.stringify({w,h,boxes}));
        if(w>900)assert.ok(boxes[0][2]<=boxes[1][0]);console.log('PASS dashboard viewport',w,h);
      }
      await page.setViewportSize({width,height:900});
    }
    await side('feature:incident');
    assert.equal(await tab('incident').count(), 1);
    await side('support');
    await page.locator('.hub-support [data-service=notices]').click();
    await active('notices');
    await page.locator('.notice-center').waitFor();
    await tab('home').click();
    await page.locator('[data-module=risk]').click();
    assert.equal(await tab('risk').count(), 0);
    await tab('support').click();
    await active('support');
    await page.getByRole('button', {name:'알림센터 탭 닫기', exact:true}).click();
    await active('support');
    await page.getByRole('button', {name:'공통업무지원서비스 탭 닫기', exact:true}).click();
    await active('incident');
    await page.getByRole('button', {name:'사고보고 탭 닫기', exact:true}).click();
    await active('home');
    assert.equal(await page.locator('[data-worktab]').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await side('feature:incident');
    await active('incident');
    if(role==='safety')await page.locator('[data-shell-view=incidents]').click();
    await page.evaluate(()=>window.enlSaveBackgroundState());
    await page.goto(origin + '/stable412.html?_latest=update-test&role=' + role);
    await page.waitForFunction(()=>document.querySelector('#view')?.innerText.trim().length>5);
    assert.equal(await page.locator('.hub-sidebar').count(),1,'the sidebar must mount on an update directly into a saved module');
    await page.locator('.hub-sidebar [data-hub="feature:incident"]').waitFor({state:'attached'});
    await page.evaluate(()=>window.enlRefreshDataNow());
    assert.equal(await page.locator('.hub-worktabs').count(),1);
    if(width<600)assert.ok(await page.locator('.hub-mobile-menu').isVisible());
    else assert.ok(await page.locator('.hub-sidebar').isVisible());
    await side('home');
    await active('home');
    await page.reload();
    await active('home');
    await page.evaluate(()=>window.enlRefreshDataNow());
    await side('support');
    await active('support');
    if(role==='safety'){
      await side('feature:system');
      await active('system');
      await page.reload();
      await active('system');
      await side('home');
      await active('home');
    }
    assert.equal(await page.locator('.hub-sidebar').count(),1);
    assert.equal(await page.locator('.hub-mobile-menu').count(),1);
    console.log('PASS workspace tab navigation, reuse, access and closing:', role, width);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await check(browser, 'safety', 1400);
    await check(browser, 'field', 393);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
