const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

(async()=>{
  for(const engine of [chromium,webkit]){
    const browser=await engine.launch();
    const page=await browser.newPage({viewport:{width:390,height:844}});
    try{
      await page.setContent(`<!doctype html><html><body>
        <form id="f">
          <label><span>이름 *</span><input id="name"></label>
          <label><span>구분 *</span><select id="kind"><option value="a">A</option><option value="b">B</option></select></label>
          <label><span>기존 구분 *</span><select id="existing"><option value="a" selected>A</option><option value="b">B</option></select></label>
          <label><span>날짜 *</span><input id="date" type="date" required></label>
          <label><span>선택값 *</span><select id="withBlank" required><option value="">선택</option><option value="x">X</option></select></label>
          <label><span>비활성 *</span><input id="disabled" required disabled></label>
        </form>
        <div id="dynamic"></div>
      </body></html>`);
      await page.addScriptTag({content:fs.readFileSync('required-fields-v453.js','utf8')});
      await page.waitForFunction(()=>document.querySelector('#kind')?.dataset.enl453Prepared==='1');

      assert.equal(await page.locator('#name').getAttribute('required'),'');
      assert.ok(await page.locator('#name').evaluate(el=>el.classList.contains('enl432-required-empty')));
      assert.equal(await page.locator('#kind').inputValue(),'');
      assert.ok(await page.locator('#kind').evaluate(el=>el.classList.contains('enl432-required-empty')));
      assert.equal(await page.locator('#kind option').first().inputValue(),'');
      assert.equal(await page.locator('#existing').inputValue(),'a');
      assert.ok(await page.locator('#existing').evaluate(el=>el.classList.contains('enl432-required-filled')));
      assert.ok(await page.locator('#withBlank').evaluate(el=>el.classList.contains('enl432-required-empty')));
      assert.ok(!(await page.locator('#disabled').evaluate(el=>el.classList.contains('enl432-required-empty'))));

      await page.locator('#name').fill('홍길동');
      await page.locator('#kind').selectOption('b');
      await page.locator('#date').fill('2026-10-01');
      await page.locator('#withBlank').selectOption('x');
      for(const id of ['name','kind','date','withBlank']){
        assert.ok(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-filled')));
        assert.ok(!(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-empty'))));
      }

      await page.evaluate(()=>document.querySelector('#dynamic').innerHTML='<form><label><span>동적 필수 *</span><select id="dynamicSelect"><option value="one">One</option><option value="two">Two</option></select></label></form>');
      await page.waitForFunction(()=>document.querySelector('#dynamicSelect')?.dataset.enl453Prepared==='1');
      assert.equal(await page.locator('#dynamicSelect').inputValue(),'');
      assert.ok(await page.locator('#dynamicSelect').evaluate(el=>el.required&&el.classList.contains('enl432-required-empty')));
      await page.locator('#dynamicSelect').selectOption('two');
      assert.ok(await page.locator('#dynamicSelect').evaluate(el=>el.classList.contains('enl432-required-filled')));

      console.log('PASS:',engine.name(),'required controls red when empty, selects require explicit choice, existing values preserved');
    }finally{await browser.close()}
  }
})().catch(e=>{console.error(e);process.exit(1)});