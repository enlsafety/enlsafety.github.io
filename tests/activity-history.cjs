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
 assert.equal((await ok('safety','activity_count')).unread,3);
 const r=await ok('safety','activity_open');assert.equal(r.rows.length,3);assert.equal(r.rows[2].kind,'create');assert.equal(r.rows[2].actor_name,'QA 현장');assert.match(r.rows[2].incident_title,/충돌/);
 assert.equal((await ok('safety','activity_count')).unread,0);
 const other={id:'qa-safety2',role:'safety'};await f.db.exec("insert into enl_hq_users(user_id,name,role,active,password_hash) values('qa-safety2','두번째','safety',true,'qa-proof')");
 assert.equal((await ok('safety','activity_count',{actor:other})).unread,3);
 await ok('field','view',{incidentId:id,visitId:crypto.randomUUID()});assert.equal((await ok('safety','activity_count')).unread,1);
 assert.equal((await ok('safety','activity_document',{incidentId:id})).archived,false);
 // Simulate the real deletion transaction and retained private snapshot.
 await f.db.transaction(async t=>{
 await t.query("select set_config('enl.delete_actor',$1,true)",[JSON.stringify(f.actors.safety)]);
 await t.query("with a as (insert into enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,changed_at,before_payload) values($1,'qa-site','delete','qa-safety','QA 안전','safety',now(),$2) returning audit_id) insert into private.enl_incident_deletions(incident_id,site_id,deleted_by_id,deleted_by_name,reason,previous_version,audit_id) select $1,'qa-site','qa-safety','QA 안전','중복 등록',1,audit_id from a",[id,JSON.stringify(doc)]);
 });
 const archived=await ok('safety','activity_document',{incidentId:id});assert.ok(archived.archived);assert.equal(archived.reason,'중복 등록');assert.equal(archived.incident.id,id);
 await f.db.exec("insert into enl_incident_audit(incident_id,site_id,action,editor_name,editor_role,changed_at) select 'qa-history','qa-site','update','QA 안전','safety',now() from generate_series(1,65)");
 const first=await ok('safety','activity_open');assert.equal(first.rows.length,50);assert.ok(first.more);
 const next=await ok('safety','activity_page',{before:first.rows.at(-1).id});assert.equal(next.rows.length,20);assert.equal(new Set([...first.rows,...next.rows].map(x=>x.id)).size,70);
 console.log('PASS scoped history, audit/visit idempotency, per-user reads, new unread, pagination and deleted document');
}finally{await f.db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
