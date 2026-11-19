'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{fixture,incident}=require('./final-lifecycle.cjs');
const migration='supabase/migrations/20261119015826_account_form_drafts.sql';
async function draftFixture(){return fixture();}
module.exports={draftFixture};
if(require.main===module)(async()=>{
 const f=await draftFixture();try{
 const call=(who,action,body={})=>f.call(who,{action:'draft_'+action,...body});
 const id=crypto.randomUUID(),reportId='inc-qa-draft',body={id,revision:0,kind:'person',incidentId:'',reportId,siteId:'qa-site',incidentVersion:'',mutationId:crypto.randomUUID(),content:{values:{reportSite:'qa-site',incidentHow410:'PC 작성'},files:[],confirmed:[],captions:{incidentHow410:'사고 경위'}}};
 let result=await call('field','save',body);assert.equal(result.status,200,JSON.stringify(result));let row=result.body.draft;assert.equal(row.revision,1);
 assert.equal((await call('field','save',body)).body.draft.revision,1,'lost save response retry is idempotent');
 for(const who of ['safety','other']){assert.equal((await call(who,'list')).body.drafts.length,0,'no cross-account listings');assert.equal((await call(who,'get',{id})).status,404);assert.equal((await call(who,'delete',{id,revision:1})).status,409);}
 for(const who of ['manager','executive'])assert.equal((await call(who,'list')).status,403);
 assert.equal((await f.raw({action:'draft_list',actor:{id:'qa-field',role:'field',siteId:'qa-site'}})).status,403,'authentication mandatory');
 const count=async table=>(await f.db.query('select count(*)::int n from '+table)).rows[0].n;
 assert.equal(await count('enl_incident_shared'),0);assert.equal(await count('enl_push_events'),0);assert.equal(await count('enl_incident_audit'),0);
 const mobile={...body,revision:1,mutationId:crypto.randomUUID(),content:{...body.content,files:[{path:'incident/site-qa-site/qa-field/sha256-abc.jpg',name:'모바일 사진',mime:'image/jpeg',kind:'image'}]}};
 result=await call('field','save',mobile);assert.equal(result.status,200);row=result.body.draft;assert.equal(row.revision,2);
 const stale={...body,revision:1,mutationId:crypto.randomUUID(),content:{...body.content,values:{...body.content.values,incidentHow410:'오래된 PC 수정'}}};
 assert.equal((await call('field','save',stale)).status,409,'stale PC cannot remove mobile photos');assert.equal((await call('field','get',{id})).body.draft.content.files.length,1);
 assert.equal((await call('field','delete',{id,revision:1})).status,409,'stale deletion rejected');
 const foreign={...mobile,revision:2,mutationId:crypto.randomUUID(),content:{...mobile.content,files:[{path:'incident/site-qa-site/another-user/secret.jpg'}]}};assert.equal((await call('field','save',foreign)).status,403);
 const invalidSite={...mobile,revision:2,mutationId:crypto.randomUUID(),siteId:'other-site'};assert.equal((await call('field','save',invalidSite)).status,403);
 const report={id:reportId,siteId:'qa-site',category:'person',eventType:'넘어짐',severity:'minor',leaveEstimate:'none',injuredName:'가상인',summary:'격리 테스트 사고',immediateAction:'확인',occurredAt:'2026-01-01T01:00:00Z',status:'reported',photos:mobile.content.files,reportDetails:{place:'검수',workAction:'테스트',incidentHow:'검수',injuryDetail:'검수'},_syncBaseVersion:0,_syncMutationId:crypto.randomUUID(),_formDraft:{id,revision:1}};
 assert.equal((await f.call('field',{action:'push',incidents:[{...report,_formDraft:undefined}]})).status,409,'old browser cannot bypass server draft');assert.equal((await f.call('field',{action:'push',incidents:[report]})).status,409,'stale submit blocked atomically');assert.equal(await count('enl_incident_shared'),0);
 report._formDraft.revision=2;result=await f.call('field',{action:'push',incidents:[report]});assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.incidents[0]._formDraft,undefined);assert.equal(await count('enl_incident_shared'),1);
 assert.equal((await call('field','list')).body.drafts.length,0);assert.equal((await call('field','get',{id})).body.draft.state,'submitted');assert.deepEqual((await call('field','get',{id})).body.draft.content,{});
 assert.equal((await call('field','save',{...mobile,revision:2,mutationId:crypto.randomUUID()})).status,409,'stale autosave cannot resurrect submitted draft');
 assert.equal((await f.call('field',{action:'push',incidents:[report]})).status,200,'lost submit response retry works');assert.equal(await count('enl_incident_shared'),1);
 const second={...body,id:crypto.randomUUID(),reportId:'inc-qa-second',mutationId:crypto.randomUUID()};assert.equal((await call('field','save',second)).status,200);
 const badReport={...report,id:second.reportId,_syncMutationId:crypto.randomUUID(),_formDraft:{id:second.id,revision:1},status:'closed'};
 assert.equal((await f.call('field',{action:'push',incidents:[badReport]})).status,409);assert.equal((await call('field','get',{id:second.id})).body.draft.state,'active','failed submission rolls back draft consumption');
 assert.equal((await call('field','delete',{id:second.id,revision:1})).status,200);assert.equal((await call('field','save',second)).status,409,'deleted tombstone cannot resurrect');
 const grants=(await f.db.query("select has_table_privilege('anon','private.enl_form_drafts','SELECT') a,has_table_privilege('authenticated','private.enl_form_drafts','SELECT') b")).rows[0];assert.equal(grants.a,false);assert.equal(grants.b,false);
 console.log('PASS account isolation, authenticated access, private attachments, optimistic save/delete/submit, lost-response retries, transaction rollback, no draft notifications and terminal tombstones');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
