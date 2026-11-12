'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<main></main>');
    await page.evaluate(() => {
      window.currentUser = () => ({id:'fixture',role:'manager'});
      window.replies = [];
      window.fetch = () => new Promise(resolve => {
        window.replies.push(email => resolve(Response.json({profile:{email}})));
      });
      window.openOverlay = () => {
        document.querySelector('main').innerHTML =
          '<section id="enl418Overlay"><p id="enl418Message"></p></section>';
      };
    });
    await page.addScriptTag({path:path.resolve('notification-profile-v441.js')});
    await page.evaluate(() => window.openOverlay());
    await page.waitForFunction(() => window.replies.length === 1);
    await page.evaluate(() => window.openOverlay());
    await page.waitForFunction(() => window.replies.length === 2);
    await page.evaluate(() => window.replies[1]('new@example.test'));
    await page.waitForFunction(() => document.querySelector('#enl441Email').value === 'new@example.test');
    await page.evaluate(() => window.replies[0]('old@example.test'));
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    assert.equal(await page.locator('#enl441Email').inputValue(), 'new@example.test');
    await page.evaluate(() => window.openOverlay());
    await page.waitForFunction(() => window.replies.length === 3);
    await page.evaluate(() => {
      document.querySelector('main').replaceChildren();
      window.replies[2]('closed@example.test');
    });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    assert.deepEqual(errors, []);
    console.log('PASS closing and reopening a notification profile with delayed replies');
  } finally {
    await browser.close();
  }
})().catch(e => {console.error(e); process.exitCode=1});
