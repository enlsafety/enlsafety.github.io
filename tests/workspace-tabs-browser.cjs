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
      await page.waitForFunction(()=>window.enlDashboardMetrics?.()!==null&&document.querySelectorAll('#sd450Site option').length===34);
      for(const [w,h] of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768],[820,1180],[393,852],[375,667]]){
        await page.setViewportSize({width:w,height:h});
        const map=page.locator('.incident-overview .sd450-map-viewport');await map.waitFor();
        await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
        const boxes=await page.locator('.incident-overview .stats426-card,.incident-overview .sd450-map-viewport').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.right,r.bottom]}));
        assert.equal(boxes.length,5);assert.ok(boxes.every(([x,y,right,bottom])=>x>=0&&y>=0&&right<=w+1&&bottom<=h),JSON.stringify({w,h,boxes}));
        const cards=boxes.slice(0,4),mapBox=boxes[4],mapSize=Math.round(mapBox[2]-mapBox[0]);
        assert.ok(cards.every(([left,,right],i)=>left===cards[0][0]&&right<=mapBox[0]&&(!i||cards[i-1][3]<=cards[i][1])),'cards stack to the left of the map');
        assert.ok(mapSize>=(w>=1440?570:w>=1200?455:w>=800?395:235),'map width '+mapSize+' at '+w);
        assert.equal(await page.locator('[data-sd450-map-site]:not([hidden])').count(),33,'all sites fit before zoom');
        const bounds=()=>page.locator('.incident-overview :is(.sd450-map-panel,.sd450-map-frame,.sd450-map-viewport,.sd450-primary-legend)').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
        const original=await bounds();
        const [,frame,,legend]=original;
        assert.ok(Math.abs(legend.left-frame.left)<=6 && Math.abs(frame.bottom-legend.bottom)<=6,'legend anchored in the map corner');
        assert.doesNotMatch(await page.locator('.sd450-primary-legend').innerText(),/녹색|검정|주황|빨강/);
        assert.ok((await page.locator('.sd450-primary-legend').innerText()).includes('올해 사고 5건 이상 또는 중대재해'));
        assert.ok(await page.locator('[data-sd450-map-site]').evaluateAll(markers=>{
          const legend=document.querySelector('.sd450-primary-legend').getBoundingClientRect();
          return markers.every(m=>{const r=m.getBoundingClientRect();return r.bottom<=legend.top||r.top>=legend.bottom||r.right<=legend.left||r.left>=legend.right;});
        }),'the legend must leave all default map markers visible');
        await page.locator('#sd450Site').selectOption('s29');await page.locator('[data-sd450-open="s29"]').waitFor();
        assert.deepEqual(await bounds(),original,'showing a site must not resize the map or panel');
        assert.doesNotMatch(await page.locator('#sd450Site').innerText(),/ · (안전|주의|일반|고위험)/);
        await page.locator('#sd450Site').selectOption('');
        // Use the controls without bringing them into view on a short screen.
        await page.locator('[data-map-zoom=in]').evaluate(el=>el.click());
        assert.deepEqual(await bounds(),original,'zoom must not move the legend');
        await page.locator('[data-map-zoom=reset]').evaluate(el=>el.click());
        console.log('PASS dashboard viewport',w,h,'map',mapSize);

      }
      const marker=page.locator('[data-sd450-map-site="s29"]');
      await marker.click();if(await marker.getAttribute('aria-expanded')==='true')await marker.locator('.sd450-marker-label').click();
      assert.equal(await page.locator('#sd450Site').inputValue(),'s29');
      await page.locator('[data-map-zoom=in]').click();assert.equal(await page.locator('[data-map-scale]').innerText(),'150%');
      await page.locator('[data-map-zoom=reset]').click();assert.equal(await page.locator('[data-map-scale]').innerText(),'100%');
      await page.setViewportSize({width,height:900});
      const tileBoxes=selector=>page.locator(selector).evaluateAll(es=>es.map(e=>[e.offsetWidth,e.offsetHeight]));
      const dashboardTiles=await tileBoxes('.stats426-card');
      await page.locator('[data-shell-view=home]').click();
      const [reference]=await tileBoxes('[data-safety-status=all]');
      assert.ok(dashboardTiles.every(([w,h])=>w>reference[0] && h<reference[1]),'dashboard restores its wider, shorter cards');
      await page.locator('[data-shell-view=report]').click();
      assert.ok((await tileBoxes('.report-type-card')).every(([w])=>w>2*reference[0]),'report choices restore their larger card layout');
      await page.locator('[data-shell-view=stats]').click();
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
