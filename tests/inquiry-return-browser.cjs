const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'http://qa.localhost';
const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml'};
const roles = [
  ['field','현장소장'], ['field','파트장'], ['field','서무'],
  ['worker','현장근로자'], ['safety','안전관리자'], ['manager','본사실무자'], ['executive','사장']
];

async function check(browser, role, position) {
  const field = ['field','worker'].includes(role);
  const context = await browser.newContext({serviceWorkers:'block', viewport:{width:field ? 390 : 1280, height:850}});
  try {
    const fixture=fs.readFileSync('tests/integrated-home-fixture.js','utf8');
    await context.route('**/*', route => {
      const url = new URL(route.request().url()),name=url.pathname.slice(1);
      if (url.origin!==origin||!name||name.includes('..')||!fs.existsSync(name)) return route.abort();
      let body=fs.readFileSync(name);
      if(name==='stable412.html')body=body.toString().replace('<head>','<head><script>'+fixture+'</script>');
      return route.fulfill({body,contentType:types[path.extname(name)]||'application/octet-stream'});
    });
    const page = await context.newPage();
    await page.goto(origin+'/stable412.html?'+new URLSearchParams({role,position}));
    await page.locator('[data-worktab=home]').click();await page.locator('[data-module=incident]').click();
    await page.locator('[data-worktab=incident][aria-current]').waitFor();
    const entry=page.locator('[data-wf-inquiry-menu]'),back=page.locator('[data-inquiry-back]');
    await page.locator('#userChip').click();
    await entry.evaluate(el=>el.addEventListener('click',()=>{window.qaOrigin=currentView;},{capture:true,once:true}));
    await entry.click();await page.locator('#wf412InquiryList').waitFor();
    if(role==='safety')await page.locator('[data-wf-filter="answered"]').click();
    else await page.locator('#wf412InquirySubject').fill('작성 중');
    await page.evaluate(()=>renderShell(currentUser()));
    if(role!=='safety')assert.equal(await page.locator('#wf412InquirySubject').inputValue(),'작성 중');
    page.once('dialog',d=>d.accept());await back.click();
    await page.waitForFunction(()=>currentView===window.qaOrigin&&!document.querySelector('#wf412InquiryList'));
    const mobile=page.locator('.hub-mobile-menu');if(await mobile.isVisible())await mobile.click();
    await page.locator('[data-wf-inquiry-sidebar]').click();await page.locator('#wf412InquiryList').waitFor();
    await back.click();await page.waitForFunction(()=>currentView===window.qaOrigin);
    console.log('PASS', position);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_EXE || undefined});
  try { for (const [role, position] of roles) await check(browser, role, position); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
