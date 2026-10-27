'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs'),{client,gate}=require('./sync-races.cjs');
(async()=>{const f=await fixture();try{
 for(const id of ['one','two']){const r=await f.call('field',{action:'push',incidents:[{id,siteId:'qa-site',status:'reported',category:'property',summary:'original',occurredAt:'2026-10-13T00:00:00Z',reportDetails:{incidentHow:'original'},photos:[],corrective:null,_syncBaseVersion:0,_syncMutationId:id}]});assert.equal(r.status,200);}
 const records=new Map((await f.call('safety',{action:'pull'})).body.incidents.map(i=>[i.id,i]));let hold=null,lose=false;
 const adapter={records,async fetch(url,init){const body=JSON.parse(init.body);if(body.action==='push'&&hold){const g=hold;hold=null;g.started.resolve();await g.release.promise;}const r=await f.raw(body);if(body.action==='push'&&lose){lose=false;throw Error('lost response');}return Response.json(r.body,{status:r.status});}};
 const stored=async id=>(await f.call('safety',{action:'pull'})).body.incidents.find(i=>i.id===id);
 const count=async()=>(await f.db.query("select count(*)::int n from enl_incident_audit where incident_id='one'")).rows[0].n;
 const c=client(adapter);await c.ready();c.get().summary='automatic';c.ctx.saveData();const g={started:gate(),release:gate()};hold=g;
 const automatic=c.ctx.enlIncidentSyncNow();await g.started.promise;c.get().reportDetails.incidentHow='direct';const direct=c.ctx.enlCommitIncident(c.get());g.release.resolve();await Promise.all([automatic,direct]);assert.equal((await stored('one')).reportDetails.incidentHow,'direct');
 const before=await count();await c.ctx.enlCommitIncident(c.get());assert.equal(await count(),before);
 c.get().summary='lost first';lose=true;await assert.rejects(c.ctx.enlCommitIncident(c.get()));c.get().summary='changed after loss';await c.ctx.enlCommitIncident(c.get());assert.equal((await stored('one')).summary,'changed after loss');assert.equal(await count(),before+2);
 await f.db.exec("insert into enl_hq_users values('qa-safety-two','QA 안전2','safety','안전관리자','QA',true,'qa-proof')");
 const other=client(adapter,{user:{id:'qa-safety-two',name:'QA 안전2',role:'safety',passwordHash:'qa-proof'}});await other.ready();other.get().summary='other user draft';c.get().summary='safety latest';await c.ctx.enlCommitIncident(c.get());await assert.rejects(other.ctx.enlCommitIncident(other.get()),/enl_sync_conflict/);assert.equal(other.get().summary,'other user draft');assert.equal((await stored('one')).summary,'safety latest');
 const unknown=client(adapter,{user:{id:'qa-other',name:'타현장',role:'field',siteId:'other-site',pinHash:'qa-proof'}});unknown.get().summary='forbidden';await assert.rejects(unknown.ctx.enlCommitIncident(unknown.get()));assert.equal((await stored('one')).summary,'safety latest');
 console.log('PASS actual Edge + PostgreSQL trigger: auto/direct order, no-op, changed lost-response retry, exact audit count, different-user conflict, cross-site denial');
}finally{await f.db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
