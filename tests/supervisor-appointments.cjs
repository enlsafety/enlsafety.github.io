'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {policyFixture,photo}=require('./policy-management.cjs');
(async()=>{
 const f=await policyFixture();
 try{
  await f.db.exec(fs.readFileSync('supabase/migrations/20261123090000_supervisor_appointments.sql','utf8'));
  const call=(role,op,data={})=>f.call(role,{action:'platform_org_appointment_'+op,siteId:'qa-site',...data});
  const data={department:'QA 가상 사업장',position:'팀장',name:'가상 관리감독자',date:'2026-11-23'};
  const req={documentId:'bbaca1de-8689-451a-9781-b2c11d7c95a4',revision:0,folderRevision:1,appointment:data};
  for(const role of ['worker','manager','executive']){
   assert.equal((await call(role,'open')).status,200);
   for(const op of ['save','submit','approve','reopen'])assert.equal((await call(role,op,req)).status,403);
  }
  assert.equal((await call('other','open')).status,403);
  assert.equal((await call('other','save',req)).status,403);
  assert.equal((await call('field','save',{...req,appointment:{...data,date:'2026-02-30'}})).status,400);
  assert.equal((await call('field','save',{...req,appointment:{...data,name:''}})).status,400);
  assert.equal((await call('field','save',req)).status,200);
  assert.equal((await call('field','save',req)).status,409);
  const first=(await call('field','open')).body;
  assert.equal(first.records.length,1);assert.equal(first.document.appointment.name,data.name);
  assert.equal((await call('field','approve',{...req,revision:1})).status,403);
  assert.equal((await call('safety','submit',{...req,revision:1,photo})).status,403);
  assert.equal((await call('field','submit',{...req,revision:1,photo:'bad'})).status,400);
  assert.equal((await call('field','submit',{...req,revision:1,photo})).status,200);
  assert.equal((await call('safety','save',{...req,revision:2})).status,409);
  assert.equal((await call('safety','approve',{...req,revision:2,reviewedPhotoRevision:1})).status,409);
  assert.equal((await call('safety','approve',{...req,revision:2,reviewedPhotoRevision:2})).status,200);
  const approved=(await call('safety','open')).body;
  assert.equal(approved.document.event,'approve');assert.equal(approved.document.photo,'data:image/jpeg;base64,'+photo);
  assert.equal((await call('field','save',{...req,documentId:'abaca1de-8689-451a-9781-b2c11d7c95a4',appointment:{...data,name:'두 번째 관리감독자'}})).status,200);
  assert.equal((await call('safety','open')).body.records.length,2);
  assert.equal((await call('field','reopen',{...req,revision:3})).status,200);
  assert.equal((await call('field','save',{...req,revision:4,appointment:{...data,position:'소장'}})).status,200);
  const old=(await call('field','open',{documentId:req.documentId,revision:3})).body;
  assert.equal(old.document.event,'approve');assert.equal(old.document.appointment.position,'팀장');assert.ok(old.document.photo);assert.equal(old.history.length,5);
  assert.equal((await call('field','save',{...req,revision:5,folderRevision:9})).status,409);
  await f.db.exec("update enl_site_master set active=false where site_id='qa-site'");
  assert.equal((await call('field','save',{...req,revision:5})).status,403);
  await f.db.exec("update private.enl_org_folders set deleted=true where site_id='qa-site'");
  assert.equal((await call('safety','open')).status,404);
  const privileges=(await f.db.query("select has_table_privilege('anon','private.enl_supervisor_appointments','SELECT') as readable,relrowsecurity from pg_class where oid='private.enl_supervisor_appointments'::regclass")).rows[0];
  assert.equal(privileges.readable,false);assert.equal(privileges.relrowsecurity,true);
  await f.db.exec("update private.enl_platform_catalog set modules='[]'");assert.equal((await call('safety','open')).status,403);
  console.log('PASS appointment permissions, site scope, dates, concurrent revisions, photo review, multiple appointees, immutable history, folder locks and RLS');
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
