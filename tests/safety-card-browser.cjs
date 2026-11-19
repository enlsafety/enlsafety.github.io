'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function verify(engine,mobile) {
 const browser=await engine.launch();
 try{
  for(const role of ['safety','field','manager','executive']){
   const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:900},hasTouch:mobile,isMobile:mobile});
   const errors=[];
   p.on('pageerror',err=>errors.push(err.message));
   const origin='http://sidebar.test';
   await p.route('**/*',async route=>{
    const u=new URL(route.request().url()),file=path.join(process.cwd(),u.pathname);
    if(u.origin!==origin||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
    let body=fs.readFileSync(file);
    if(u.pathname==='/stable412.html')body=body.toString().replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
    const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
    return route.fulfill({body,contentType:mime[path.extname(file)]||'application/octet-stream'});
   });
   await p.goto(origin+'/stable412.html?role='+role);
   const nav=p.locator('.hub-sidebar nav'),hub=p.locator('.platform-hub');
   await nav.locator('[data-hub="safetyCard"]').waitFor({state:'attached'});
   if(mobile)await p.locator('.hub-mobile-menu').click();
   await nav.locator('[data-hub="safetyCard"]').click();
   await p.locator('[data-card-site="qa-site"]').click();
   const field=key=>p.locator('[data-card-field="'+key+'"]');
   await field('C9').waitFor();
   assert.ok(!await p.locator('.safety-card-panel').innerText().then(t=>t.includes('엑셀 원본을 반영한 카드입니다.')));
   assert.ok(await p.locator('[data-cell="C9"]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14.6));
   assert.equal(await field('D6').inputValue(),'검수 골프장');
   assert.equal(await p.locator('[data-card-result="G9"]').innerText(),'22');
   await p.getByRole('button',{name:'원본 확인사항 셀 메모 보기'}).click();
   assert.equal(await p.locator('.safety-card-note textarea').inputValue(),'검수 원본 메모');
   await p.locator('.safety-card-note').getByRole('button',{name:'안전관리카드로 뒤로가기',exact:true}).click();
   if(['safety','field'].includes(role)){
    await field('C9').fill('18');assert.equal(await p.locator('[data-card-result="G9"]').innerText(),'28');
    assert.equal(await field('P23').inputValue(),'__linked__');await field('P23').selectOption('보완 필요');
    await field('D42').fill('현장 확인 후 작성한 종합 의견');
    await p.locator('.safety-card-tools').getByRole('button',{name:'종합 관리의견 메모',exact:true}).click();
    await p.locator('.safety-card-note textarea').fill('확인 내용과 증빙 위치');
    await p.locator('.safety-card-note').getByRole('button',{name:'메모 반영'}).click();
    await p.locator('[data-worktab="home"]').click();
    await p.locator('[data-worktab="safetyCard"]').click();
    assert.equal(await field('D42').inputValue(),'현장 확인 후 작성한 종합 의견','tab change preserves unsaved form');
    await p.locator('[data-card-save]').click();
    await p.locator('.safety-card-status').filter({hasText:'저장했습니다.'}).waitFor();
    await p.getByRole('button',{name:'최신 내용 불러오기',exact:true}).click();
    await field('C9').waitFor();assert.equal(await field('D42').inputValue(),'현장 확인 후 작성한 종합 의견');
    await p.getByRole('button',{name:'종합 관리의견 셀 메모 보기'}).click();
    assert.equal(await p.locator('.safety-card-note textarea').inputValue(),'확인 내용과 증빙 위치');
    await p.locator('.safety-card-note').getByRole('button',{name:'안전관리카드로 뒤로가기',exact:true}).click();
    await p.evaluate(()=>{window.__cardApi=window.enlIncidentApi;window.enlIncidentApi=body=>body.action==='platform_safety_card_save'?Promise.reject(Error('card_changed')):window.__cardApi(body)});
    await field('D42').fill('충돌 후 보존할 의견');await p.locator('[data-card-save]').click();
    await p.locator('.safety-card-status').filter({hasText:'다른 사용자가 먼저 저장했습니다.'}).waitFor();
    assert.equal(await field('D42').inputValue(),'충돌 후 보존할 의견','conflict preserves input');
    await p.evaluate(()=>window.enlIncidentApi=window.__cardApi);
    await p.locator('[data-card-save]').click();await p.locator('.safety-card-status').filter({hasText:'저장했습니다.'}).waitFor();
   }else{
    assert.equal(await field('D42').getAttribute('readonly'),'');
    assert.equal(await field('P23').isDisabled(),true);
    assert.equal(await p.locator('[data-card-save]').isDisabled(),true);
   }
   if(!mobile){const h=await p.locator('.safety-card-header h2').boundingBox(),b=await p.locator('.safety-card-header-tools').boundingBox();assert.ok(b.x>=h.x+h.width&&Math.abs((b.y+b.height/2)-(h.y+h.height/2))<2,'toolbar remains to the right of title');}
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'page fits viewport; only the card scrolls sideways');
   if(role==='safety'){
    fs.mkdirSync('qa-output',{recursive:true});
    await p.locator('.safety-card-panel').screenshot({path:'qa-output/safety-card-'+engine.name()+'.png'});
    await p.evaluate(()=>window.print=()=>{});
    await p.getByRole('button',{name:'인쇄 / PDF',exact:true}).click();
    assert.equal(await p.locator('#safety-card-print textarea,#safety-card-print select').count(),0);
    if(!mobile)await p.pdf({path:'qa-output/safety-card.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
    await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   }
   await p.getByRole('button',{name:'사업장 목록으로 뒤로가기',exact:true}).click();
   await p.locator('[data-card-site="qa-site"]').waitFor();
   await p.getByRole('button',{name:'통합 홈으로 뒤로가기',exact:true}).click();
   assert.equal(await p.locator('[data-worktab="home"]').getAttribute('aria-current'),'page');
   assert.deepEqual(errors,[]);
   await p.close();
   console.log('PASS card template, source notes, live totals, saves, tab retention, conflicts, print and role access',role,engine.name());
  }
 }finally{await browser.close()}
}
(async()=>{await verify(chromium,false);await verify(webkit,true)})().catch(err=>{console.error(err);process.exitCode=1});
