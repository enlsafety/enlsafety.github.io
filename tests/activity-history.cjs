'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();try{
 const q=(who,action,extra={})=>f.call(who,{action,...extra});
 const ok=async(who,action,extra)=>{const r=await q(who,action,extra);assert.equal(r.status,200,JSON.stringify(r));return r.body;};
 const doc={id:'qa-history',siteId:'qa-site',status:'reported',category:'property',summary:'가상 사고',eventType:'충돌',occurredAt:'2026-11-01',reportDetails:{place:'가상 장소'},corrective:null,photos:[],_syncBaseVersion:0,_syncMutationId:'create'};
 await ok('field','push',{incidents:[doc]});
 let id=doc.id,visitId=crypto.randomUUID();for(let n=0;n<2;n++)await ok('manager','view',{incidentId:id,visitId});
 await ok('manager','view',{incidentId:id,visitId:crypto.randomUUID()});
 for(const role of ['manager','executive','field','other'])for(const action of ['activity_count','activity_open','activity_list','activity_page','activity_document'])assert.equal((await q(role,action,{incidentId:id})).status,403);
 assert.equal((await q('other','view',{incidentId:id,visitId:crypto.randomUUID()})).status,403);
 assert.equal((await ok('safety','activity_count')).unread,2);
 const r=await ok('safety','activity_open');assert.equal(r.rows.length,2);assert.equal(r.rows[1].kind,'create');assert.equal(r.rows[1].actor_name,'QA 현장');assert.match(r.rows[1].incident_title,/충돌/);
 assert.equal((await ok('safety','activity_count')).unread,0);
 const other={id:'qa-safety2',role:'safety'};await f.db.exec("insert into enl_hq_users(user_id,name,role,active,password_hash) values('qa-safety2','두번째','safety',true,'qa-proof')");
 assert.equal((await ok('safety','activity_count',{actor:other})).unread,2);
 await ok('safety','view',{incidentId:id,visitId:crypto.randomUUID()});assert.equal((await ok('safety','activity_count')).unread,1);
 assert.equal((await ok('safety','activity_document',{incidentId:id})).archived,false);
 // Simulate the real deletion transaction and retained private snapshot.
 await f.db.transaction(async t=>{
 await t.query("select set_config('enl.delete_actor',$1,true)",[JSON.stringify(f.actors.safety)]);
 await t.query("with a as (insert into enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,changed_at,before_payload) values($1,'qa-site','delete','qa-safety','QA 안전','safety',now(),$2) returning audit_id) insert into private.enl_incident_deletions(incident_id,site_id,deleted_by_id,deleted_by_name,reason,previous_version,audit_id) select $1,'qa-site','qa-safety','QA 안전','중복 등록',1,audit_id from a",[id,JSON.stringify(doc)]);
 });
 const archived=await ok('safety','activity_document',{incidentId:id});assert.ok(archived.archived);assert.equal(archived.reason,'중복 등록');assert.equal(archived.incident.id,id);
 await f.db.exec("insert into enl_incident_audit(incident_id,site_id,action,editor_name,editor_role,changed_at) select 'qa-history','qa-site','update','QA 안전','safety',now() from generate_series(1,65)");
 const first=await ok('safety','activity_open');assert.equal(first.rows.length,50);assert.ok(first.more);
 const next=await ok('safety','activity_page',{before:first.rows.at(-1).id});assert.equal(next.rows.length,19);assert.equal(new Set([...first.rows,...next.rows].map(x=>x.id)).size,69);
 await f.db.exec(`insert into enl_personnel_audit(personnel_id,site_id,action,editor_id,editor_name,editor_role,changed_at,after_payload)
 values('worker1','qa-site','create','qa-field','QA 현장','field','2025-12-31T15:00:00Z','{"name":"가상 직원","pin_hash":"qa-secret"}');
 insert into enl_site_audit(site_id,action,editor_id,editor_name,editor_role,changed_at,after_payload) values('qa-site','update','qa-safety','QA 안전','safety',now(),'{"site_name":"QA 가상 사업장"}');
 update enl_hq_users set name='QA 수정',updated_by_id='qa-safety',updated_by_name='QA 안전',updated_by_role='safety' where user_id='qa-manager';`);
 const find=async(filters)=>(await ok('safety','activity_list',filters)).rows;
 const jan=await find({fromDate:'2026-01-01',toDate:'2026-01-01',search:'현장관리자 직원 등록'});
 assert.equal(jan.length,1);assert.match(jan[0].sentence,/QA 현장님이 QA 가상 사업장의 가상 직원 사용자 계정을 등록했습니다/);assert.ok(!JSON.stringify(jan).includes('qa-secret'));
 assert.equal((await find({toDate:'2025-12-31',search:'가상 직원'})).length,0);
 for(const keyword of ['현장 정보','본사 사용자','최초 등록','처음 조회','최초조회','현장설정'])assert.ok((await find({search:keyword==='본사 사용자'?'본사 계정':keyword})).length>0);
 assert.equal((await q('safety','activity_list',{fromDate:'2026-02-31'})).status,400);
 console.log('PASS scoped history, audit/visit idempotency, per-user reads, new unread, pagination and deleted document');
}finally{await f.db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
