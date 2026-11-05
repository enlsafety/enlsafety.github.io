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
    await page.locator('[data-module=incident]').click();
    await active('incident');
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
