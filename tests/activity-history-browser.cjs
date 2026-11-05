'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs'),{chromium,webkit}=require('playwright'),{tab}=require('./field-entry-table-browser.cjs');
(async()=>{for(const [engine,width] of [[chromium,1280],[webkit,390]]){
 const f=await fixture(),browser=await engine.launch();
 try{
 const {p}=await tab(browser,width,'safety');await p.waitForFunction(()=>data.incidents.some(i=>i.id==='sample-2'));
 const seed=await f.call('field',{action:'push',incidents:[{id:'sample-2',siteId:'qa-site',status:'reported',category:'person',eventType:'넘어짐',summary:'가상 사고',occurredAt:'2026-10-01T16:00:00Z',reportDetails:{},_syncBaseVersion:0,_syncMutationId:'create'}]});assert.equal(seed.status,200);
 const removed={...seed.body.incidents[0],id:'qa-removed',eventType:'파손'};
 await f.seedLegacy(removed);await f.db.transaction(async t=>{
 await t.query("select set_config('enl.delete_actor',$1,true)",[JSON.stringify(f.actors.safety)]);
 await t.query("with a as (insert into enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,changed_at,before_payload) values('qa-removed','qa-site','delete','qa-safety','QA 안전','safety',now(),$1) returning audit_id) insert into private.enl_incident_deletions(incident_id,site_id,deleted_by_id,deleted_by_name,reason,previous_version,audit_id) select 'qa-removed','qa-site','qa-safety','QA 안전','중복 신고',1,audit_id from a",[JSON.stringify(removed)]);});
 await p.exposeFunction('historyApi',async body=>{const r=await f.call('safety',body);if(r.status!==200)throw Error(r.body.message);return r.body;});
 await p.evaluate(()=>{const old=enlIncidentApi;window.enlIncidentApi=b=>{if(b.action.startsWith('activity_')||b.action==='view'){const {actor,...body}=b;return historyApi(body);}return old(b);};enlRefreshHistoryCount(true);});
 await p.locator('[data-worktab=home]').click();
 const menu=p.locator('[data-hub=recent]');await menu.locator('.activity-count').waitFor();assert.equal(await menu.locator('.activity-count').innerText(),'2');
 await menu.click();const rows=p.locator('.activity-history li button:first-child');await rows.first().waitFor();assert.equal(await menu.locator('.activity-count').count(),0);assert.equal(await rows.count(),2);
 assert.match(await rows.last().innerText(),/2026-10-02/);await p.locator('.activity-filters input[type=search]').fill('중복없는검색');await p.locator('.activity-filters button').click();await p.getByText('조건에 맞는 기록이 없습니다.').waitFor();await p.locator('.activity-filters input[type=search]').fill('');await p.locator('.activity-filters button').click();await rows.first().click();await p.locator('.activity-archive').waitFor();assert.match(await p.locator('.activity-archive').innerText(),/중복 신고/);
 await p.locator('.activity-archive button').first().click();await rows.last().click();await p.locator('[data-incident-view="sample-2"]').waitFor();
 await p.waitForFunction(()=>document.querySelector('.activity-count')?.textContent==='1');
 await p.evaluate(()=>closeModal());await p.locator('[data-worktab=home]').click();await menu.click();await rows.getByText(/QA 안전님이 .*처음 조회했습니다/).first().waitFor();
 assert.equal(await menu.locator('.activity-count').count(),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await f.db.exec(`insert into enl_personnel_audit(personnel_id,site_id,action,editor_id,editor_name,editor_role,changed_at,before_payload)
 values('qa-removed-worker','qa-site','delete','qa-field','QA 현장','field','2025-12-31T15:00:00Z','{"name":"검색검수"}')`);
 await p.locator('[data-worktab=home]').click();await p.locator('.hub-support-card button').click();await p.locator('[data-platform-history-feed]').click();
 const filters=p.locator('.activity-filters');await filters.locator('[name=range]').selectOption('month');await filters.locator('[type=month]').fill('2026-01');
 await filters.locator('[type=search]').fill('검색검수 삭제');await filters.getByRole('button',{name:'검색'}).click();
 await rows.getByText(/QA 현장님이 .*검색검수 사용자 계정을 삭제했습니다/).click();await p.getByRole('heading',{name:'설정 변경 기록'}).waitFor();
 await p.evaluate(()=>closeModal());await filters.locator('[name=range]').selectOption('recent');await p.getByText('조건에 맞는 기록이 없습니다.').waitFor();
 const other=await tab(browser,width,'executive');await other.p.waitForFunction(()=>typeof window.enlRenderHistory==='function');await other.p.locator('[data-worktab=home]').click();await other.p.locator('[data-hub=recent]').click();await other.p.locator('.activity-history').waitFor();assert.equal(await other.p.locator('.history-manage,.history-remove').count(),0);
 console.log('PASS activity menu, unread/reset, linked and archived reports, new activity',engine.name(),width);
 }finally{await browser.close();await f.db.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
