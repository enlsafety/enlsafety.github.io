const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:900,height:700}});
  try{
    await page.route('http://enl-qa.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><div id="app"></div><input id="incidentPhotoInput" type="file"><input id="actionPhotoInput" type="file"><div id="gallery"></div><div id="modalRoot"></div></body></html>'}));
    await page.goto('http://enl-qa.test/fixture');
    await page.evaluate(()=>{
      localStorage.setItem('enl_safety_v3',JSON.stringify({version:3,sites:[{id:'s01',name:'테스트'}],users:[{id:'u1',name:'현장소장',role:'field',siteId:'s01',active:true}],incidents:[]}));
      localStorage.setItem('enl_safety_session_v3',JSON.stringify({userId:'u1',loggedAt:new Date().toISOString()}));
    });
    await page.addScriptTag({content:fs.readFileSync('core.js','utf8')});
    await page.evaluate(()=>{
      window.fetch=async(url,init)=>{
        const body=JSON.parse(init?.body||'{}');
        if(body.action==='sign')return {ok:true,json:async()=>({ok:true,urls:Object.fromEntries((body.paths||[]).map(p=>[p,p.endsWith('.pdf')?'https://files.test/sample.pdf':'https://files.test/sample.jpg']))})};
        return {ok:true,json:async()=>({ok:true})};
      };
      window.__opened='';
      window.open=()=>({document:{open(){},write(){},close(){}},location:{replace:u=>window.__opened=u},focus(){},close(){}});
      window.qaAttachments=[
        {path:'incident/a.jpg',name:'현장사진.jpg',mime:'image/jpeg',kind:'image',size:12345},
        {path:'incident/b.pdf',name:'견적서.pdf',mime:'application/pdf',kind:'pdf',size:54321}
      ];
      const root=document.getElementById('gallery');
      root.innerHTML=window.enlAttachmentGalleryHtml(qaAttachments);
      window.enlBindAttachmentOpen(root,qaAttachments);
    });
    await page.waitForFunction(()=>document.querySelector('[data-attach-preview="0"] img')&&document.querySelector('[data-attach-preview="1"] iframe'));
    assert.equal(await page.evaluate(()=>qaAttachments[0].previewUrl),undefined,'signed preview URL must not mutate the persisted attachment object');
    assert.equal(await page.evaluate(()=>qaAttachments[1].previewUrl),undefined,'signed PDF preview URL must remain ephemeral');
    assert.ok((await page.locator('[data-attach-preview="0"] img').getAttribute('src')).includes('sample.jpg'));
    assert.ok((await page.locator('[data-attach-preview="1"] iframe').getAttribute('src')).includes('sample.pdf'));
    assert.equal(await page.locator('[data-attach-open="0"]').getAttribute('aria-label'),'현장사진.jpg 원본 열기');
    assert.equal(await page.locator('[data-attach-open="1"]').getAttribute('aria-label'),'견적서.pdf 원본 열기');
    await page.locator('[data-attach-open="1"]').click();
    await page.waitForFunction(()=>window.__opened.includes('sample.pdf'));
    const persisted=await page.evaluate(()=>window.enlPersistAttachment(qaAttachments[0]));
    assert.equal(persisted.previewUrl,undefined);

    await page.evaluate(()=>{
      data.incidents=[{id:'inc-sensitive',siteId:'s01',category:'person',eventType:'베임/찔림',status:'reported',priority:'normal',severity:'minor',injuredName:'테스트 근로자',occurredAt:'2026-10-01T13:20:00+09:00',createdAt:'2026-10-01T13:21:00+09:00',updatedAt:'2026-10-01T13:21:00+09:00',summary:'테스트 사고',immediateAction:'응급처치',photos:[],readReceipts:[],reportDetails:{place:'작업구역',workAction:'예지 작업',incidentHow:'작업 중 베임',injuryDetail:'왼쪽 손가락 베임',diagnosis:'민감진단명',doctorOpinion:'민감의사소견',medicalCost:50000,preventionPlan:'작업방법 개선'}}];
    });
    await page.addScriptTag({content:fs.readFileSync('incidents-v410.js','utf8')});
    await page.evaluate(()=>window.enlOpenIncidentReview('inc-sensitive',false,{id:'hq1',name:'본사관리자',role:'manager'}));
    let reviewText=await page.locator('#modalRoot').innerText();
    assert.ok(reviewText.includes('왼쪽 손가락 베임'),'pending reader must see the reported injury context');
    assert.ok(!reviewText.includes('민감진단명'),'pending HQ reader must not see diagnosis before final approval');
    assert.ok(!reviewText.includes('민감의사소견'),'pending HQ reader must not see doctor opinion before final approval');
    await page.evaluate(()=>{data.incidents[0].status='approved';window.enlOpenIncidentReview('inc-sensitive',false,{id:'hq1',name:'본사관리자',role:'manager'})});
    reviewText=await page.locator('#modalRoot').innerText();
    assert.ok(reviewText.includes('민감진단명'),'approved HQ reader should see the finalized diagnosis');
    assert.ok(reviewText.includes('민감의사소견'),'approved HQ reader should see the finalized doctor opinion');
    console.log('PASS: previews stay ephemeral, originals open, and pending HQ read-only view masks medical details');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});