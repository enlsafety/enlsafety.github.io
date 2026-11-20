'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {orgFixture}=require('./organization.cjs');
const photo='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAMAAwDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AD//Z';
async function policyFixture(){
 const f=await orgFixture();
 await f.db.exec(fs.readFileSync('supabase/migrations/20261120090000_policy_management.sql','utf8'));
 await f.db.exec(`update private.enl_platform_catalog set modules=(select jsonb_agg(case when item->>'key'='policy' then item || '{"roles":["safety","field","worker","manager","executive"],"state":"live","enabled":true,"pilots":[]}'::jsonb else item end) from jsonb_array_elements(modules) item);
 insert into enl_site_personnel(personnel_id,site_id,name,job_title,access_role,active,pin_hash) values('qa-worker','qa-site','검수 근로자','근로자','worker',true,'qa-proof');`);
 f.actors.worker={id:'qa-worker',role:'worker',siteId:'qa-site'};
 return f;
}
module.exports={policyFixture,photo};
if(require.main===module)(async()=>{
 const f=await policyFixture();
 try{
  const call=(who,action,data={})=>f.call(who,{action:'platform_policy_'+action,...data});
  const req={siteId:'qa-site',kind:'policy',revision:1};
  const settings={year:2027,date:'2027-01-01',revision:1};
  assert.equal((await call('field','list')).body.sites.length,1);
  assert.equal((await call('worker','list')).body.sites.length,1);
  for(const role of ['field','worker','manager','executive']){
   assert.equal((await call(role,'global_update',settings)).status,403,role+' cannot change global date');
   assert.equal((await call(role,'decide',{...req,evidenceId:1,decision:'approved'})).status,403);
  }
  for(const role of ['worker','manager','executive','safety'])assert.equal((await call(role,'submit',{...req,photo})).status,403);
  assert.equal((await call('other','open',req)).status,403);
  assert.equal((await call('other','submit',{...req,photo})).status,403);
  assert.equal((await call('field','submit',{...req,photo:'invalid'})).status,400);
  assert.equal((await call('field','submit',{...req,revision:2,photo})).status,409);
  let r=await call('field','submit',{...req,photo});assert.equal(r.status,200,JSON.stringify(r));const first=r.body.id;
  assert.equal((await call('field','submit',{...req,photo})).status,409);
  assert.equal((await call('safety','open',req)).body.proof.photo,'data:image/jpeg;base64,'+photo);
  assert.equal((await call('safety','decide',{...req,evidenceId:first,decision:'rejected',note:''})).status,400);
  assert.equal((await call('safety','decide',{...req,evidenceId:first,decision:'rejected',note:'시행일이 보이도록 촬영'})).status,200);
  r=await call('field','submit',{...req,photo});assert.equal(r.status,200);const second=r.body.id;
  assert.equal((await call('safety','decide',{...req,evidenceId:first,decision:'approved'})).status,409);
  assert.equal((await call('safety','decide',{...req,evidenceId:second,decision:'approved'})).status,200);
  assert.equal((await call('field','list')).body.sites[0].complete,false);
  const goal={...req,kind:'objectives'};
  r=await call('field','submit',{...goal,photo});assert.equal(r.status,200);
  assert.equal((await call('safety','decide',{...goal,evidenceId:r.body.id,decision:'approved'})).status,200);
  assert.equal((await call('field','list')).body.sites[0].complete,true);
  assert.equal((await call('field','submit',{...req,photo})).status,409);
  assert.equal((await call('safety','global_update',{year:2026,date:'2026-01-01',revision:1})).body.unchanged,true);
  assert.equal((await call('safety','global_update',{...settings,date:'2027-02-30'})).status,400);
  r=await call('safety','global_update',settings);assert.equal(r.status,200);assert.equal(r.body.settings.revision,2);
  assert.equal((await call('safety','global_update',settings)).status,409);
  assert.equal((await call('field','list')).body.sites[0].complete,false);
  assert.equal((await call('safety','open',req)).body.proof,null);
  assert.equal((await f.db.query('select count(*)::int n from private.enl_policy_evidence')).rows[0].n,3);
  assert.equal((await call('field','submit',{...req,photo})).status,409);
  assert.equal((await call('field','submit',{...req,revision:2,photo})).status,200);
  await f.db.exec("update enl_site_master set active=false where site_id='qa-site'");
  assert.equal((await call('field','submit',{...goal,revision:2,photo})).status,403);
  await f.db.exec("update private.enl_platform_catalog set modules='[]'");
  assert.equal((await call('safety','list')).status,403);
  console.log('PASS policy workflow: scoped reads, role restrictions, JPEG validation, resubmission, two-document approval, annual rollover, history retention and stale-write guards');
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
