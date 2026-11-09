'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./final-lifecycle.cjs');
async function orgFixture(){
  const f=await fixture();
  await f.db.exec("insert into enl_site_master(site_id,site_name,active) values ('other-site','두 번째 사업장',true),('closed-site','종료 사업장',false)");
  for(const name of ['20261110000000_organization_charts','20261110000030_private_org_template','20261110000100_open_organization_module','20261110003000_organization_site_folders'])
    await f.db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
  return f;
}
module.exports={orgFixture};
if(require.main===module)(async()=>{
  const f=await orgFixture();
  try{
    const {halfYear}=await import('../edge-functions/enl-incident-sync-v411/organization.ts');
    for(const [time,period] of [['2026-06-30T14:59:59Z','2026-1'],['2026-06-30T15:00:00Z','2026-2'],['2026-12-31T15:00:00Z','2027-1']])assert.equal(halfYear(new Date(time)),period);
    const call=(who,action,p={})=>f.call(who,{action:'platform_org_'+action,...p});
    const list=async who=>(await call(who,'list')).body;
    const siteId='qa-site',{period,sites}=await list('field');
    assert.deepEqual(sites.map(s=>s.site_id),[siteId]);assert.equal(sites[0].checked,false);
    const chart={lead:'소장 가상',supervisor:'팀장 가상',teams:Array.from({length:4},(_,i)=>({name:'업무'+i,regular:1,daily:0}))};
    const save={siteId,period,revision:0,chart};
    for(const role of ['manager','executive','safety']){
      assert.equal((await list(role)).sites.length,2);
      if(role!=='safety')assert.equal((await call(role,'save',save)).status,403);
      assert.equal((await call(role,'confirm',save)).status,403);
    }
    assert.equal((await call('other','open',{siteId})).status,403);
    assert.equal((await call('other','save',save)).status,403);
    assert.equal((await call('field','confirm',save)).status,400);
    assert.equal((await call('field','save',{...save,chart:{...chart,teams:[]}})).status,400);
    assert.equal((await call('field','save',save)).status,200);
    assert.equal((await call('field','save',save)).status,409);
    assert.equal((await call('field','confirm',{...save,revision:1,period:'1999-1'})).status,409);
    assert.equal((await list('field')).sites[0].checked,false);
    assert.equal((await call('field','confirm',{...save,revision:1})).status,200);
    assert.equal((await list('field')).sites[0].checked,true);
    for(const role of ['manager','executive','safety']){
      const result=(await call(role,'open',{siteId})).body;
      assert.equal(result.history.length,2);assert.equal(result.document.confirmed,true);assert.deepEqual(result.document.chart,chart);
    }
    assert.equal((await call('field','save',{...save,revision:2,chart:{...chart,lead:'변경'}})).status,200);
    assert.equal((await list('field')).sites[0].checked,false);
    assert.equal((await call('safety','open',{siteId,revision:1})).body.document.chart.lead,chart.lead);
    await f.db.exec("update enl_site_master set active=false where site_id='qa-site'");
    assert.equal((await call('field','save',{...save,revision:3})).status,403);
    assert.equal((await list('safety')).sites.some(s=>s.site_id===siteId),true);
    const managed=await call('safety','list',{manageFolders:true});
    assert.equal(managed.body.candidates.length,1);
    const entry={siteId:'closed-site',name:'가나다 현장',folderRevision:0};
    for(const role of ['manager','executive','field','other']){
      for(const op of ['create','rename','delete'])assert.equal((await call(role,'folder_'+op,entry)).status,403);
    }
    assert.equal((await call('safety','folder_create',entry)).status,200);
    assert.equal((await call('safety','folder_create',entry)).status,409);
    assert.equal((await call('safety','folder_rename',{...entry,folderRevision:1,name:'다솜'})).status,200);
    const edited=await call('safety','save',{...save,siteId:entry.siteId,folderRevision:2});
    assert.equal(edited.status,200,JSON.stringify(edited));
    assert.equal((await call('safety','confirm',{...save,siteId:entry.siteId,revision:1})).status,403);
    assert.equal((await call('safety','folder_delete',{...entry,folderRevision:2})).status,200);
    assert.equal((await call('manager','open',{siteId:entry.siteId})).status,404);
    assert.equal((await call('safety','save',{...save,siteId:entry.siteId,revision:1})).status,404);
    assert.equal((await call('safety','folder_create',{...entry,folderRevision:3})).status,200);
    assert.equal((await call('manager','open',{siteId:entry.siteId})).body.document.revision,1);
    assert.equal((await call('safety','save',{...save,siteId:entry.siteId,revision:1,folderRevision:2})).status,409);
    console.log('PASS folder management permissions, archive, stale writes, recovery, safety editor, site scope and half-year checks');
  }finally{await f.db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
