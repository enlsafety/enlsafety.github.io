const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

(async()=>{
  for(const engine of [chromium,webkit]){
    const browser=await engine.launch();
    const page=await browser.newPage({viewport:{width:390,height:844}});
    try{
      await page.setContent('<!doctype html><html><head></head><body><div id="view"></div></body></html>');
      await page.evaluate(()=>{
        window.data={sites:[{id:'s01',name:'테스트 사업장'}],incidents:[]};
        window.currentView='report';
        window.incidentPhotos=[];
        window.currentUser=()=>({id:'u1',name:'현장소장',role:'field',siteId:'s01'});
        window.siteById=id=>data.sites.find(s=>s.id===id);
        window.ENL_SITE_DIRECTORY=[{id:'s01',name:'테스트 사업장'}];
        window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        window.eventTypeOptions=sel=>['넘어짐','부딪힘'].map(x=>'<option '+(x===sel?'selected':'')+'>'+x+'</option>').join('');
        window.photoPickerHtml=()=>'<div></div>';
        window.renderPhotoThumbs=()=>{};
        window.bindPhotoButtons=()=>{};
        window.renderShell=()=>{};
        window.nowISO=()=>new Date().toISOString();
        window.computePriority=()=> 'normal';
        window.computeLegalReview=()=>false;
        window.saveData=()=>{};
        window.uid=()=> 'qa-id';
      });
      await page.addStyleTag({content:fs.readFileSync('report-v410.css','utf8')});
      await page.addStyleTag({content:fs.readFileSync('report-calendar-v465.css','utf8')});
      await page.addStyleTag({content:fs.readFileSync('responsive-v432.css','utf8')});
      await page.addScriptTag({content:fs.readFileSync('report-v410.js','utf8')});
      await page.addScriptTag({content:fs.readFileSync('report-calendar-v465.js','utf8')});
      await page.addScriptTag({content:fs.readFileSync('required-fields-v453.js','utf8')});
      await page.evaluate(()=>window.enlOpenIncidentReport('person',window.currentUser()));
      await page.waitForFunction(()=>document.querySelector('#occurredDate410')?.classList.contains('enl432-required-empty'));
      await page.locator('.report410-date-launch').waitFor();

      for(const id of ['occurredDate410','occurredTime410']){
        assert.equal(await page.locator('#'+id).inputValue(),'');
        assert.ok(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-empty')));
      }
      const placeholders=page.locator('.report410-picker-placeholder');
      assert.equal(await placeholders.count(),2);
      assert.equal(await placeholders.nth(0).innerText(),'선택하세요');
      assert.equal(await placeholders.nth(1).innerText(),'선택하세요');
      assert.ok(await placeholders.nth(0).isVisible());
      assert.ok(await placeholders.nth(1).isVisible());

      // Month choice must not commit or close. The user must still pick a day.
      await page.locator('.report410-date-launch').click();
      assert.equal(await page.locator('[data-report-calendar]').count(),1);
      await page.locator('[data-report-cal-year]').selectOption('2024');
      await page.locator('[data-report-cal-month]').selectOption('2');
      assert.equal(await page.locator('[data-report-calendar]').count(),1);
      assert.equal(await page.locator('#occurredDate410').inputValue(),'');
      assert.equal(await page.locator('[data-report-cal-day="29"]').count(),1);
      await page.locator('[data-report-cal-day="29"]').click();
      assert.equal(await page.locator('#occurredDate410').inputValue(),'2024-02-29');
      assert.equal(await page.locator('[data-report-calendar]').count(),0);
      await page.locator('.report410-date-launch').click();
      await page.locator('[data-report-cal-year]').selectOption('2025');
      await page.locator('[data-report-cal-month]').selectOption('2');
      assert.equal(await page.locator('[data-report-cal-day="29"]').count(),0);
      await page.locator('[data-report-cal-cancel]').click();
      assert.equal(await page.locator('#occurredDate410').inputValue(),'2024-02-29');

      await page.locator('#occurredDate410').fill('2026-10-01');
      await page.locator('#occurredTime410').fill('10:45');
      for(const id of ['occurredDate410','occurredTime410']){
        assert.ok(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-filled')));
        assert.ok(!(await page.locator('#'+id).evaluate(el=>el.classList.contains('enl432-required-empty'))));
      }
      assert.ok(!(await placeholders.nth(0).isVisible()));
      assert.ok(!(await placeholders.nth(1).isVisible()));
      await page.evaluate(()=>window.enlOpenIncidentReport('property',window.currentUser()));
      await page.locator('.report410-date-launch').click();
      await page.locator('[data-report-cal-year]').selectOption('2026');
      await page.locator('[data-report-cal-month]').selectOption('4');
      await page.locator('[data-report-cal-day="30"]').click();
      assert.equal(await page.locator('#occurredDate410').inputValue(),'2026-04-30');
      console.log('PASS:',engine.name(),'month-to-day selection, leap year, cancel, required states');
    }finally{await browser.close()}
  }
})().catch(e=>{console.error(e);process.exit(1)});