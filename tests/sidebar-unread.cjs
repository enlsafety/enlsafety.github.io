'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./final-lifecycle.cjs');

(async()=>{
  const f=await fixture();
  try{
    await f.db.exec("create table private.enl_incident_report_reader_targets(user_id text primary key); insert into private.enl_incident_report_reader_targets values('qa-manager')");
    for(const id of ['report-1','report-2']){
      await f.seedLegacy({id,siteId:'qa-site',status:'reported',eventType:'QA',occurredAt:'2026-10-02T08:00:00Z'});
    }
    async function unread(who){
      const result=await f.call(who,{action:'pull',includeUnreadReports:true});
      assert.equal(result.status,200,JSON.stringify(result.body));
      assert.equal(result.body.incidents.length,2);
      return result.body.unreadReportIds.sort();
    }
    assert.deepEqual(await unread('manager'),['report-1','report-2']);
    assert.deepEqual(await unread('executive'),[]);
    assert.equal((await f.call('manager',{action:'pull'})).body.unreadReportIds,undefined);
    for(const [id,remaining] of [['report-1',['report-2']],['report-2',[]]]){
      assert.equal((await f.call('manager',{action:'view',incidentId:id})).status,200);
      assert.deepEqual(await unread('manager'),remaining);
    }
    await f.db.exec("insert into private.enl_incident_report_reader_targets values('qa-executive')");
    assert.deepEqual(await unread('executive'),['report-1','report-2']);
    console.log('PASS report reads persist independently for each designated reader');
  }finally{await f.db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
