'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {safetyCardLinks}=await import('../edge-functions/enl-incident-sync-v411/safety-card-links.ts');
 const at=new Date('2026-11-19T00:00:00Z'),base={site:{site_name:'QA'},org:null,orgTip:null,risk:[],incidents:[]};
 const row=(id,date,extra={})=>({id,occurredAt:date,status:'reported',category:'property',summary:id,...extra});
 base.incidents=[row('one','2025-11-19'),row('three','2023-11-19'),row('older','2023-11-18'),row('midnight','2026-11-18T15:00:00Z'),row('future','2026-11-20'),row('draft','2026-11-19',{status:'draft'}),row('invalidated','2026-11-19',{bulkInvalidation:{active:true}}),row('invalid','n/a')];
 let r=safetyCardLinks(base,'safety',at);assert.equal(r.values.L13,'2');assert.equal(r.values.P13,'3');assert.equal(r.values.J16,'2026-11-19');assert.equal(r.values.M16,'midnight');assert.equal(r.incidentCount,4);
 assert.equal(safetyCardLinks(base,'worker',at).values.M16,'');
 base.org={revision:1,period:'2026-2',review_event:'approve'};base.orgTip=1;
 assert.equal(safetyCardLinks(base,'safety',at).values.P32,'승인완료');
 base.orgTip=2;assert.equal(safetyCardLinks(base,'safety',at).values.P32,'최신화 필요','deleted latest revision cannot revive approval');
 base.orgTip=1;assert.equal(safetyCardLinks(base,'safety',new Date('2027-01-01T00:00:00Z')).values.P32,'최신화 필요','approval expires with reporting period');
 console.log('PASS annual boundaries, Korea timezone, invalid/future/draft exclusions, worker access and stale/deleted organization approval');
})().catch(e=>{console.error(e);process.exitCode=1});
