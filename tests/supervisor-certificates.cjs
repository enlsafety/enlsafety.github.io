'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {policyFixture,photo}=require('./policy-management.cjs');
require('../supervisor-training-model.js');
const M=globalThis.enlSupervisorTrainingModel;
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_supervisor_certificates.sql'));
async function certificateFixture(){
 const f=await policyFixture();
 await f.db.exec(fs.readFileSync('supabase/migrations/20261123090000_supervisor_appointments.sql','utf8'));
 await f.db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
 const appointmentId='bbaca1de-8689-451a-9781-b2c11d7c95a4';
 const appointment={department:'QA 가상 사업장',position:'팀장',name:'검수 감독자',date:'2024-12-01'};
 assert.equal((await f.call('field',{action:'platform_org_appointment_save',siteId:'qa-site',documentId:appointmentId,revision:0,folderRevision:1,appointment})).status,200);
 return {...f,appointmentId,appointment};
}
module.exports={certificateFixture,photo};
if(require.main===module)(async()=>{
 assert.equal(M.current('2024-12-01','2025-11-30').end,'2025-11-30');
 assert.equal(M.current('2024-12-01','2025-12-01').index,1);
 assert.equal(M.current('2024-12-01','2026-11-24').end,'2026-11-30');
 assert.equal(M.period('2024-02-29',0).end,'2025-02-28');
 assert.equal(M.period('2024-02-29',1).start,'2025-03-01');
 assert.equal(M.period('2024-02-29',3).end,'2028-02-28');
 assert.equal(M.current('2024-02-29','2028-02-29').index,4);
 assert.equal(M.validDate('2026-02-30'),false);
 assert.equal(M.today(new Date('2026-11-24T15:00:00Z')),'2026-11-25');
 assert.equal(M.current('2026-12-01','2026-11-24').index,0);
 const a={name:'검수',date:'2024-12-01'},records=[{appointment:a,completed_on:'2025-06-01'}];
 assert.equal(M.summary(a,records,M.current(a.date,'2025-12-01'),'2025-12-01').state,'pending','previous year does not fulfill new period');
 assert.equal(M.summary(a,records,M.period(a.date,0),'2026-11-24').state,'registered');
 assert.equal(M.summary(a,[],M.period(a.date,0),'2026-11-24').state,'overdue');
 assert.equal(M.summary(a,[],M.period(a.date,1),'2026-11-24').state,'due');
 assert.equal(M.summary(a,[],M.period(a.date,1),'2026-11-30').remaining,0);
 assert.equal(M.summary({...a,name:'다른 사람'},records,M.period(a.date,0),'2026-11-24').state,'overdue');
 const f=await certificateFixture();
 try{
  const call=(role,op,body={})=>f.call(role,{action:'platform_org_certificate_'+op,siteId:'qa-site',...body});
  const req={certificateId:'abaca1de-8689-451a-9781-b2c11d7c95a4',appointmentId:f.appointmentId,appointmentRevision:1,folderRevision:1,revision:0,completedOn:'2026-11-01',photo};
  for(const role of ['worker','manager','executive']){assert.equal((await call(role,'list')).status,200);assert.equal((await call(role,'save',req)).status,403);}
  assert.equal((await call('other','list')).status,403);
  assert.equal((await call('other','save',req)).status,403);
  for(const completedOn of ['2026-02-30','2199-01-01','2024-11-30',''])assert.equal((await call('field','save',{...req,completedOn})).status,400);
  assert.equal((await call('field','save',{...req,photo:'bad'})).status,400);
  assert.equal((await call('field','save',{...req,photo:undefined})).status,400);
  assert.equal((await call('field','save',{...req,appointmentRevision:2})).status,409);
  assert.equal((await call('field','save',{...req,folderRevision:9})).status,409);
  assert.equal((await call('field','save',{...req,appointmentId:'cbaca1de-8689-451a-9781-b2c11d7c95a4'})).status,400);
  let result=await call('field','save',req);assert.equal(result.status,200,JSON.stringify(result));
  assert.equal((await call('field','save',req)).status,409,'retry cannot duplicate');
  const list=(await call('field','list')).body;assert.equal(list.records.length,1);assert.equal(list.records[0].completed_on,req.completedOn);assert.equal(list.records[0].photo,undefined);
  assert.equal((await call('field','open',{certificateId:req.certificateId})).body.document.photo,'data:image/jpeg;base64,'+photo);
  assert.equal((await call('field','open',{certificateId:req.certificateId,revision:9})).status,404);
  assert.equal((await call('field','save',{...req,revision:1,completedOn:'2026-11-02',photo:undefined})).status,200);
  result=await call('manager','open',{certificateId:req.certificateId});assert.equal(result.body.history.length,2);assert.equal(result.body.document.completed_on,'2026-11-02');assert.ok(result.body.document.photo);
  assert.equal((await call('manager','open',{certificateId:req.certificateId,revision:1})).body.document.completed_on,'2026-11-01');
  assert.equal((await f.db.query('select count(*)::int n from private.enl_supervisor_certificates where photo_jpeg is not null')).rows[0].n,1,'date-only correction reuses image');
  assert.equal((await call('safety','save',{...req,certificateId:'cbaca1de-8689-451a-9781-b2c11d7c95a4',completedOn:'2025-11-01'})).status,200);
  assert.equal((await call('field','list')).body.records.length,2,'annual history retained');
  await f.call('safety',{action:'platform_org_appointment_save',siteId:'qa-site',documentId:f.appointmentId,revision:1,folderRevision:1,appointment:{...f.appointment,date:'2025-01-01'}});
  assert.equal((await call('field','save',{...req,revision:2})).status,409,'stale appointment rejected');
  assert.equal((await call('field','save',{...req,revision:2,appointmentRevision:2})).status,409,'old evidence cannot be reassigned to changed appointment');
  await f.db.exec("update enl_site_master set active=false where site_id='qa-site'");assert.equal((await call('field','save',req)).status,403);
  const rights=(await f.db.query("select has_table_privilege('anon','private.enl_supervisor_certificates','SELECT') a,has_table_privilege('authenticated','private.enl_supervisor_certificates','INSERT') b,relrowsecurity from pg_class where oid='private.enl_supervisor_certificates'::regclass")).rows[0];
  assert.equal(rights.a,false);assert.equal(rights.b,false);assert.equal(rights.relrowsecurity,true);
  await f.db.exec("update private.enl_org_folders set deleted=true where site_id='qa-site'");assert.equal((await call('safety','list')).status,404);
  await f.db.exec("update private.enl_platform_catalog set modules='[]'");assert.equal((await call('safety','list')).status,403);
  console.log('PASS annual boundaries, leap years, Korean midnight, historical periods, scoped roles, real SQL save/read/correction, photos, stale writes, appointment changes, RLS and module restrictions');
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
