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
          <label><span>필수표시 없음</span><select id="requiredNoStar" required><option value="a">A</option><option value="b">B</option></select></label>
          <label><span>날짜 *</span><input id="date" type="date" required></label>
          <label><span>발생 날짜 *</span><input id="seedDate" type="date" required data-enl-confirm-required="1" value="2026-10-01"></label>
          <label><span>발생 시간 *</span><input id="seedTime" type="time" required data-enl-confirm-required="1" value="10:30"></label>
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
      assert.equal(await page.locator('#requiredNoStar').inputValue(),'a');
      assert.ok(!(await page.locator('#requiredNoStar').evaluate(el=>el.classList.contains('enl432-required-empty'))));
      assert.ok(!(await page.locator('#requiredNoStar').evaluate(el=>el.classList.contains('enl432-required-filled'))));
      assert.ok(await page.locator('#seedDate').evaluate(el=>el.classList.contains('enl432-required-empty')));
      assert.ok(await page.locator('#seedTime').evaluate(el=>el.classList.contains('enl432-required-empty')));
      assert.ok(await page.locator('#withBlank').evaluate(el=>el.classList.contains('enl432-required-empty')));
      assert.ok(!(await page.locator('#disabled').evaluate(el=>el.classList.contains('enl432-required-empty'))));

      await page.locator('#name').fill('홍길동');
      await page.locator('#kind').selectOption('b');
      await page.locator('#date').fill('2026-10-01');
      await page.locator('#seedDate').fill('2026-10-01');
      await page.locator('#seedTime').fill('10:31');
      await page.locator('#withBlank').selectOption('x');
      for(const id of ['name','kind','date','seedDate','seedTime','withBlank']){
        assert.ok(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-filled')));
        assert.ok(!(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-empty'))));
      }

      await page.evaluate(()=>document.querySelector('#dynamic').innerHTML='<form><label><span>동적 필수 *</span><select id="dynamicSelect"><option value="one">One</option><option value="two">Two</option></select></label></form>');
      await page.waitForFunction(()=>document.querySelector('#dynamicSelect')?.dataset.enl453Prepared==='1');
      assert.equal(await page.locator('#dynamicSelect').inputValue(),'');
      assert.ok(await page.locator('#dynamicSelect').evaluate(el=>el.required&&el.classList.contains('enl432-required-empty')));
      await page.locator('#dynamicSelect').selectOption('two');
      assert.ok(await page.locator('#dynamicSelect').evaluate(el=>el.classList.contains('enl432-required-filled')));

      const mutationMs=await page.evaluate(async()=>{
        const host=document.querySelector('#dynamic'),start=performance.now();
        host.innerHTML=Array.from({length:250},(_,i)=>`<div><label><span>항목 ${i}</span><input value="${i}"></label></div>`).join('');
        await new Promise(r=>setTimeout(r,0));
        return performance.now()-start;
      });
      assert.ok(mutationMs<500,`required-field dynamic rescan too slow: ${mutationMs}ms`);

      console.log('PASS:',engine.name(),'starred selects only, seeded date/time require confirmation, local rescans stay responsive');
    }finally{await browser.close()}
  }
})().catch(e=>{console.error(e);process.exit(1)});