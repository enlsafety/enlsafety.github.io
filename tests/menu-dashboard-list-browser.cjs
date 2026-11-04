'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {tab,cases,noOverflow}=require('./field-entry-table-browser.cjs');

async function verify(engine,width){
  const browser=await engine.launch();
  try{
    const records=cases.map(i=>i.status==='closed'?{...i,executiveApproval:{state:'approved'}}:i);
    const {p}=await tab(browser,width,'safety',records);
    await p.waitForFunction(()=>data.incidents.some(i=>i.id==='sample-2'));
    const menu=id=>p.locator('[data-shell-view="'+id+'"]');
    const icon=b=>b.evaluate(el=>getComputedStyle(el,'::before').backgroundImage);
    assert.notEqual(await icon(menu('history')),await icon(menu('incidents')));
    assert.match(await menu('history').innerText(),/사용자 기록/);
    assert.equal(await menu('more').innerText(),'설정');
    await p.evaluate(()=>{
      const api=window.enlIncidentApi;
      window.enlIncidentApi=b=>b.action==='activity_count'?Promise.resolve({unread:window.qaUnread}):api(b);
    });
    const measure=b=>b.evaluate(el=>{const s=getComputedStyle(el);return [el.offsetWidth,el.offsetHeight,s.backgroundColor,s.borderRadius,s.top,s.right,s.fontSize]});
    const common=await measure(menu('home').locator('.enl424-nav-count'));
    for(const count of [2,42,999]){
      await p.evaluate(async n=>{window.qaUnread=n;await enlRefreshHistoryCount(true)},count);
      const badge=menu('history').locator('.activity-count');
      assert.equal(await badge.innerText(),String(count));
      assert.deepEqual(await measure(badge),common);
      assert.equal(common[0],common[1]);
    }
    await menu('incidents').click();
    const cards=p.locator('#view .inc411-card');
    const snapshot=list=>list.evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.dataset.incId,el.innerText])));
    await cards.locator('.exec-required-badge').first().waitFor();
    const full=await snapshot(cards);assert.equal(Object.keys(full).length,3);
    await menu('stats').click();
    await p.locator('[data-stats-filter="all"]').click();
    const drill=p.locator('#stats426Drill'),rows=drill.locator('.inc411-card');
    await rows.locator('.exec-required-badge').first().waitFor();
    assert.deepEqual(await snapshot(rows),full);
    assert.match(full['sample-1'],/대물사고/);assert.match(full['sample-1'],/최종승인/);
    assert.match(full['sample-1'],/재발방지계획/);assert.match(full['sample-2'],/대인사고/);
    const search=drill.getByRole('searchbox');await search.fill('sample-3');
    assert.equal(await drill.locator('.inc411-card:visible').count(),1);
    await p.locator('[data-stats-filter="person"]').click();
    assert.equal(await rows.count(),1);await noOverflow(p);
    await rows.click();await p.locator('[data-incident-view="sample-2"]').waitFor();
    console.log('PASS menu badge geometry, list parity, search, filters and detail',engine.name(),width);
  }finally{await browser.close()}
}
(async()=>{for(const [engine,width] of [[chromium,1365],[webkit,390],[webkit,820]])await verify(engine,width)})().catch(e=>{console.error(e);process.exitCode=1});
