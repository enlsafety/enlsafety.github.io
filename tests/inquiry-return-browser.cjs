const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'http://qa.localhost';
const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml'};
const roles = [
  ['field','현장소장'], ['field','파트장'], ['field','서무'],
  ['safety','안전관리자'], ['manager','본사실무자'], ['executive','사장']
];

async function check(browser, role, position) {
  const field = role === 'field';
  const context = await browser.newContext({serviceWorkers:'block', viewport:{width:field ? 390 : 1280, height:850}});
  try {
    await context.addInitScript(user => {
      localStorage.setItem('enl_setup_intro_seen_v1','1'); // Returning-user navigation regression.
      localStorage.setItem('enl_safety_session_v3', JSON.stringify({manager:user, loggedAt:new Date().toISOString()}));
    }, {id:'qa-'+role, role, position, name:'검증 사용자', siteId:field ? 's01' : '', active:true});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.fulfill({json:{ok:true, incidents:[], inquiries:[], count:0}});
      const name = url.pathname.slice(1);
      if (!/^[\w.-]+$/.test(name) || !fs.existsSync(name)) return route.abort();
      return route.fulfill({body:fs.readFileSync(name), contentType:types[path.extname(name)] || 'application/octet-stream'});
    });
    const page = await context.newPage();
    await page.goto(origin+'/stable412.html');
    const entry = page.locator(field ? '[data-field-task="inquiry"]' : '[data-wf-inquiry-nav]');
    const back = page.locator(field ? '[data-field-back]' : '[data-inquiry-back]');
    await entry.evaluate(el => el.addEventListener('click', () => { window.qaOrigin=currentView; }, {capture:true, once:true}));
    await entry.click();
    await page.locator('#wf412InquiryList').waitFor();
    if (role === 'safety') await page.locator('[data-wf-filter="answered"]').click();
    else await page.locator('#wf412InquirySubject').fill('작성 중');
    await page.evaluate(() => renderShell(currentUser()));
    if (role !== 'safety') assert.equal(await page.locator('#wf412InquirySubject').inputValue(), '작성 중');
    await back.click();
    await page.waitForFunction(() => currentView===window.qaOrigin && !document.querySelector('#wf412InquiryList'));

    const nav = page.locator('[data-wf-inquiry-nav]');
    await nav.click();
    if (field) {
      await page.locator('.topbar .brand').click();
      await entry.waitFor();
      await page.locator('#userChip').click();
      await page.locator('[data-wf-inquiry-menu]').click();
      await back.click();
      await entry.waitFor();
    } else {
      await page.locator('[data-shell-view="incidents"]').click();
      await page.waitForFunction(() => currentView==='incidents' && !document.querySelector('#wf412InquiryList'));
      await nav.click();
      await back.click();
      await page.waitForFunction(() => currentView==='incidents' && !document.querySelector('#wf412InquiryList'));
    }
    console.log('PASS', position);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_EXE || undefined});
  try { for (const [role, position] of roles) await check(browser, role, position); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
