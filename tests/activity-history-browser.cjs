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
 const menu=p.locator('[data-shell-view="history"]');await menu.locator('.activity-count').waitFor();assert.equal(await menu.locator('.activity-count').innerText(),'2');
 await menu.click();const rows=p.locator('.activity-history li button');await rows.first().waitFor();assert.equal(await menu.locator('.activity-count').count(),0);assert.equal(await rows.count(),2);
 assert.match(await rows.last().innerText(),/2026-10-02/);await rows.first().click();await p.locator('.activity-archive').waitFor();assert.match(await p.locator('.activity-archive').innerText(),/중복 신고/);
 await p.locator('.activity-archive button').first().click();await rows.last().click();await p.locator('[data-incident-view="sample-2"]').waitFor();
 await p.waitForFunction(()=>document.querySelector('.activity-count')?.textContent==='2');
 await p.evaluate(()=>closeModal());await menu.click();await rows.getByText('QA 안전　사고를 조회했습니다').first().waitFor();
 assert.equal(await menu.locator('.activity-count').count(),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const other=await tab(browser,width,'executive');await other.p.waitForFunction(()=>typeof window.enlRenderHistory==='function');assert.equal(await other.p.locator('[data-shell-view="history"]').count(),0);
 console.log('PASS activity menu, unread/reset, linked and archived reports, new activity',engine.name(),width);
 }finally{await browser.close();await f.db.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
