'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {tab,noOverflow}=require('./field-entry-table-browser.cjs');
async function check(engine,width){
 const browser=await engine.launch();
 try{
  for(const role of ['field','manager','executive','safety','worker']){
   const {c,p}=await tab(browser,width,role);
   const menu=p.locator('[data-field-task="history"],[data-shell-view="history"]');
   await p.waitForFunction(()=>typeof enlHistoryAvailable==='function'&&!!document.querySelector('#view'));
   if(role==='worker'){assert.equal(await menu.count(),0);await c.close();continue;}
   await p.evaluate(async()=>{
    const base=enlIncidentApi;let rows=Array.from({length:3},(_,n)=>({id:String(n+1),kind:'create',incident_id:'sample-1',happened_at:'2026-11-04',role_label:'현장관리자',sentence:'현장관리자님이 테스트 사업장의 작업 차량 접촉 사고 보고서를 최초 등록했습니다.'}));
    window.enlIncidentApi=async b=>{
     if(b.action==='activity_count')return {unread:123};
     if(b.action==='activity_document')return {archived:false};
     if(b.action==='activity_delete'){window.lastDelete=b;rows=b.mode==='one'?rows.filter(x=>x.id!==b.id):[];return {removed:1};}
     if(b.action.startsWith('activity_'))return {rows,more:false};
     return base(b);
    };await enlRefreshHistoryCount(true);
   });
   await menu.locator('.activity-count').waitFor();assert.equal(await menu.locator('.activity-count').innerText(),'123');
   await menu.click();const host=p.locator('.activity-history');
   const rows=host.locator('li');await rows.first().waitFor();
   assert.equal(await menu.locator('.activity-count').count(),0);
   assert.equal(await host.locator('.history-remove').count(),role==='safety'?3:0);
   assert.equal(await host.locator('.history-manage').count(),role==='safety'?1:0);
   await rows.first().locator('button').first().click();await p.locator('[data-incident-view="sample-1"]').waitFor();await p.evaluate(()=>closeModal());
   const filters=host.locator('.activity-filters');await filters.locator('[name=range]').selectOption('custom');
   if(role==='safety'){
    const manage=host.locator('.history-manage');await manage.locator('summary').click();
    await noOverflow(p);assert.ok(await host.locator('input:visible,button:visible,select:visible').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().right<=innerWidth+1&&el.getBoundingClientRect().left>=0)));
    const [x,body]=await Promise.all([rows.first().locator('.history-remove').boundingBox(),rows.first().locator('button').first().boundingBox()]);
    assert.ok(x.width>=44&&x.height>=44&&x.x>=body.x+body.width-1);
    await p.screenshot({path:'qa-output/history-roles-'+width+'.png',fullPage:true});
    p.once('dialog',d=>d.dismiss());await host.locator('.history-remove').first().click();assert.equal(await rows.count(),3);
    p.on('dialog',d=>d.accept());await host.locator('.history-remove').first().click();await p.waitForFunction(()=>document.querySelectorAll('.activity-history li').length===2);
    await manage.locator('[name=start]').fill('2026-11-01');await manage.locator('[name=end]').fill('2026-11-04');await manage.getByText('기간별 삭제').click();
    await p.waitForFunction(()=>window.lastDelete.mode==='range');assert.equal(await p.evaluate(()=>lastDelete.fromDate),'2026-11-01');
    await manage.getByText('전체 삭제').click();await p.waitForFunction(()=>window.lastDelete.mode==='all');
   }else if(role==='field'){await p.locator('[data-field-back]').click();await menu.waitFor();}
   await noOverflow(p);await c.close();
  }
  console.log('PASS role menus, badges, document navigation, delete controls, confirmation and geometry',engine.name(),width);
 }finally{await browser.close()}
}
(async()=>{for(const [e,w] of [[webkit,390],[webkit,820],[chromium,320]])await check(e,w)})().catch(e=>{console.error(e);process.exitCode=1});
