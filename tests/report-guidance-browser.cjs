const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

async function setup(engine){
  const browser=await engine.launch();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<!doctype html><html><head></head><body><div id="view"></div></body></html>');
  await page.evaluate(()=>{
    window.data={sites:[{id:'s01',name:'테스트 사업장'}],incidents:[]};
    window.currentView='report';window.incidentPhotos=[];
    window.currentUser=()=>({id:'u1',personnelId:'u1',name:'현장소장',role:'field',siteId:'s01'});
    window.siteById=id=>data.sites.find(s=>s.id===id);
    window.ENL_SITE_DIRECTORY=[{id:'s01',name:'테스트 사업장'}];
    window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.eventTypeOptions=sel=>['넘어짐','부딪힘'].map(x=>'<option '+(x===sel?'selected':'')+'>'+x+'</option>').join('');
    window.photoPickerHtml=()=>'<div></div>';window.renderPhotoThumbs=()=>{};window.bindPhotoButtons=()=>{};window.renderShell=()=>{};
    window.nowISO=()=>new Date().toISOString();window.computePriority=()=> 'normal';window.computeLegalReview=()=>false;
    window.saveData=()=>{};window.uid=()=> 'qa-id';
  });
  await page.addScriptTag({content:fs.readFileSync('report-v410.js','utf8')});
  return {browser,page};
}

(async()=>{
  for(const engine of [chromium,webkit]){
    const {browser,page}=await setup(engine);
    try{
      await page.evaluate(()=>window.enlOpenIncidentReport('person',window.currentUser()));
      for(const id of ['environmentCause410','behaviorCause410','injuryDetail410','doctorOpinion410','medicalCostDetail410','preventionPlan410','specialNote410']){
        const ph=await page.locator('#'+id).getAttribute('placeholder');
        assert.ok(ph&&ph.startsWith('예:'),id+' needs a concrete example placeholder');
      }

      await page.evaluate(()=>window.enlOpenIncidentReport('property',window.currentUser()));
      for(const id of ['environmentCause410','behaviorCause410','damageDetail410','preventionPlan410','specialNote410']){
        const ph=await page.locator('#'+id).getAttribute('placeholder');
        assert.ok(ph&&ph.startsWith('예:'),id+' needs a concrete example placeholder');
      }
      const cost=page.locator('#repairCost410'),detail=page.locator('#repairCostDetail410');
      assert.equal(await cost.inputValue(),'사후 보완 예정');
      assert.equal(await detail.inputValue(),'사후 보완 예정');
      await cost.focus();assert.equal(await cost.inputValue(),'');await cost.blur();assert.equal(await cost.inputValue(),'사후 보완 예정');
      await detail.focus();assert.equal(await detail.inputValue(),'');await detail.blur();assert.equal(await detail.inputValue(),'사후 보완 예정');

      const fill={occurredDate410:'2026-10-01',occurredTime410:'13:20',incidentPlace410:'3번홀 카트도로',workAction410:'작업차량 이동 중',incidentHow410:'회전 중 지주와 접촉',immediateAction:'차량 정지 후 현장 통제',damagedItem410:'홀맵 지주',damageDetail410:'지주 하단부 찌그러짐',preventionPlan410:'이동 전 회전반경 확인 및 유도자 배치'};
      for(const [id,val] of Object.entries(fill))await page.locator('#'+id).fill(val);
      await page.locator('#unifiedReportForm button[type="submit"]').click();
      await page.waitForFunction(()=>window.data.incidents.length===1);
      const saved=await page.evaluate(()=>data.incidents[0]);
      assert.equal(saved.reportDetails.repairCost,0);
      assert.equal(saved.reportDetails.repairCostPending,true);
      assert.equal(saved.reportDetails.repairCostDetail,'사후 보완 예정');
      assert.ok(saved.summary.includes('복구 예상비용: 사후 보완 예정'));
      console.log('PASS:',engine.name(),'narrative examples and pending repair-cost defaults');
    }finally{await browser.close()}
  }
})().catch(e=>{console.error(e);process.exit(1)});