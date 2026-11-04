'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {tab} = require('./field-entry-table-browser.cjs');

(async () => {
  const browser = await chromium.launch();
  try {
    const {p} = await tab(browser,1365,'safety');
    const view = () => p.evaluate(() => currentView);
    const back = () => p.keyboard.press('Backspace');
    const menu = id => p.locator('[data-shell-view="' + id + '"]').first().click();
    await p.locator('[data-shell-view="incidents"]').first().waitFor();
    await p.waitForFunction(() => data.incidents.some(i => i.id === 'sample-1'));
    const firstView = await view();
    await menu('actions');
    await menu('incidents');
    const url = p.url();
    await p.locator('[data-inc-id]').first().click();
    await p.locator('#modalRoot .modal').waitFor();
    await back();
    await p.locator('#modalRoot .modal').waitFor({state:'detached'});
    assert.equal(await view(),'incidents');
    await back();
    assert.equal(await view(),'actions');
    await back();
    assert.equal(await view(),firstView);
    await back();
    assert.equal(p.url(),url);

    await menu('report');
    await p.locator('[data-report-type="property"]').first().click();
    const form = p.locator('#unifiedReportForm');
    const field = form.locator('#incidentHow410');
    await field.fill('접촉사고');
    await back();
    assert.equal(await field.inputValue(),'접촉사');
    const dialogs = [];
    p.on('dialog', async dialog => {dialogs.push(dialog.message());await dialog.dismiss();});
    await p.evaluate(() => document.activeElement.blur());
    await back();
    assert.match(dialogs.at(-1),/저장되지/);
    assert.equal(await field.inputValue(),'접촉사');

    for (const type of ['number','date','search','password']) {
      await form.evaluate((f,type) => {
        const input = document.createElement('input');
        input.type = type;
        input.id = 'qa-' + type;
        input.value = type === 'date' ? '2026-11-04' : '123';
        f.appendChild(input);
        input.focus();
      },type);
      await back();
      if(type !== 'date')assert.equal(await p.locator('#qa-' + type).inputValue(),'12');
      assert.equal(await view(),'report');
    }
    const upload = p.locator('#incidentPhotoBtn');
    const chooser = p.waitForEvent('filechooser');
    await upload.click();
    const picker = await chooser;
    await back();
    assert.equal(await form.count(),1);
    await picker.setFiles([]);
    await upload.focus();
    await back();
    assert.equal(dialogs.length,1,'file selection and editable controls must not navigate');
    await p.evaluate(() => document.activeElement.blur());
    await p.evaluate(() => {window.qaPriorSaving = window.enlIncidentSaveInProgress;window.enlIncidentSaveInProgress = () => true;});
    await back();
    assert.match(dialogs.at(-1),/저장 중/);
    assert.equal(await field.inputValue(),'접촉사');
    await p.evaluate(() => {window.enlIncidentSaveInProgress = window.qaPriorSaving;delete window.qaPriorSaving;});
    p.removeAllListeners('dialog');
    p.on('dialog', async dialog => {assert.equal(dialog.type(),'confirm');await dialog.accept();});
    await back();
    await p.locator('[data-report-picker]').waitFor();
    await back();
    assert.equal(await view(),firstView);
    assert.equal(p.url(),url);
    const fieldPage = (await tab(browser,1365,'field')).p;
    await fieldPage.locator('[data-field-task="records"]').click();
    await fieldPage.locator('.field411-screen').waitFor();
    await fieldPage.keyboard.press('Backspace');
    await fieldPage.locator('[data-field-task="records"]').waitFor();
    console.log('PASS app menu history, list/modal, editing, picker, unsaved cancel/leave and home boundary');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
