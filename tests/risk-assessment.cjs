'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {orgFixture}=require('./organization.cjs');

(async()=>{
 const f=await orgFixture();
 try{
  await f.db.exec(fs.readFileSync('supabase/migrations/20261117000000_risk_assessment_folders.sql','utf8'));
  await f.db.exec(fs.readFileSync('supabase/migrations/20261117000100_open_risk_assessment_module.sql','utf8'));
  const call=(who,action,more={})=>f.call(who,{action:'platform_risk_'+action,...more});
  const list=async who=>(await call(who,'list',{manageFolders:true})).body;
  const safety=await list('safety');
  assert.equal(safety.sites.length,2);
  assert.equal(safety.candidates.length,1);
  assert.equal(safety.candidates[0].site_id,'closed-site');
  assert.deepEqual((await list('field')).sites.map(s=>s.site_id),['qa-site']);
  assert.deepEqual((await list('other')).sites.map(s=>s.site_id),['other-site']);
  for(const who of ['manager','executive'])assert.equal((await list(who)).sites.length,2);
  for(const who of ['field','other','manager','executive']){
   assert.equal((await call(who,'folder_rename',{siteId:'qa-site',folderRevision:1,name:'허용되지 않은 수정'})).status,403);
  }
  assert.equal((await call('safety','folder_rename',{siteId:'qa-site',folderRevision:1,name:'QA 위험성평가'})).status,200);
  assert.equal((await call('safety','folder_rename',{siteId:'qa-site',folderRevision:1,name:'오래된 수정'})).status,409);
  assert.equal((await list('field')).sites[0].folder_name,'QA 위험성평가');
  const {rows:orgRows}=await f.db.query("select display_name,deleted,revision from private.enl_org_folders where site_id='qa-site'");
  assert.equal(orgRows[0].display_name,null,'organization folder must stay unchanged');
  assert.equal(orgRows[0].revision,1);
  assert.equal((await call('safety','folder_create',{siteId:'closed-site',folderRevision:0,name:'종료 사업장 위험성평가'})).status,200);
  assert.equal((await list('safety')).sites.length,3);
  assert.equal((await call('safety','folder_delete',{siteId:'closed-site',folderRevision:1})).status,200);
  assert.equal((await list('safety')).sites.length,2);
  assert.equal((await call('safety','folder_create',{siteId:'closed-site',folderRevision:2,name:'종료 사업장 재등록'})).status,200);
  assert.equal((await list('safety')).sites.length,3);
  assert.equal((await call('safety','folder_open',{siteId:'qa-site'})).status,400,'evaluation documents are not yet implemented');
  const {rows:catalog}=await f.db.query("select m->>'state' as state,m->>'enabled' as enabled,m->'roles' as roles from private.enl_platform_catalog c,lateral jsonb_array_elements(c.modules) m where m->>'key'='risk'");
  assert.equal(catalog[0].state,'live');
  assert.equal(catalog[0].enabled,'true');
  assert.deepEqual(catalog[0].roles.sort(),['field','safety','manager','executive'].sort());
  console.log('PASS risk navigation, field site scope, four roles, admin-only edits, revision conflicts, isolation, hide/restore, catalog');
 }finally{await f.db.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
