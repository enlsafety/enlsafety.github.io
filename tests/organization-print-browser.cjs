'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {orgFixture}=require('./organization.cjs');

(async()=>{
  const f=await orgFixture(),browser=await chromium.launch({channel:process.env.PW_CHANNEL||undefined});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    page.on('dialog',dialog=>dialog.accept());
    await page.route('http://localhost/**',route=>route.fulfill({contentType:'text/html',body:'<main data-workspace="organization"></main>'}));
    await page.exposeFunction('api',async(role,body)=>{
      const result=await f.call(role,{...body,includeTemplate:false});
      if(!result.body.ok)throw Error(result.body.message);
      if(body.includeTemplate)result.body.template='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840"/>';
      return result.body;
    });
    async function open(role){
      await page.goto('http://localhost/'+role);
      for(const path of ['risk-editor.js','organization.js'])await page.addScriptTag({path});
      await page.evaluate(async role=>{
        const org=enlOrganization(document.querySelector('main'),{role},body=>api(role,body),()=>true);
        org.catalog({enabled:true,state:'live',canEnter:true});await org.open('qa-site');
        window.print=()=>{window.didPrint=true;window.dispatchEvent(new Event('afterprint'));};
      },role);
      await page.locator('.org-document-card').first().click();await page.locator('.org-paper').waitFor();
    }
    const btn=name=>page.getByRole('button',{name,exact:true});
    await open('field');
    assert.ok(await btn('게시 사진 제출').isDisabled());
    await page.locator('[name=lead]').fill('검수 소장');await page.locator('[name=supervisor]').fill('검수 감독자');
    await btn('조직도 저장').click();
    await btn('PDF 출력').click();await page.waitForFunction(()=>window.didPrint);
    assert.ok(await btn('확인완료').isDisabled());
    const chooser=page.waitForEvent('filechooser');await btn('게시 사진 제출').click();
    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=60;return c.toDataURL().split(',')[1];});
    await (await chooser).setFiles({name:'검수.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await page.locator('.org-evidence img').waitFor();
    for(const role of ['manager','executive']){
      await open(role);
      for(const name of ['조직도 저장','게시 사진 제출','확인완료','최신화 수정','저장본 삭제'])assert.ok(await btn(name).isDisabled(),role+name);
      assert.equal(await page.locator('input.org-inline').count(),0);
    }
    await open('safety');assert.ok(await btn('확인완료').isDisabled());
    await page.locator('.org-evidence input[type=checkbox]').check();await btn('확인완료').click();
    await page.getByText(/반기 확인완료/).first().waitFor();
    assert.ok(await btn('조직도 저장').isDisabled());
    console.log('PASS field save/print/photo upload; reader permissions; safety photo comparison and approval with isolated database');
  }finally{await browser.close();await f.db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
