'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./final-lifecycle.cjs');
async function orgFixture(){
  const f=await fixture();
  await f.db.exec("insert into enl_site_master(site_id,site_name,active) values ('other-site','두 번째 사업장',true),('closed-site','종료 사업장',false)");
  for(const name of ['20261104234953_integrated_home_content','20261105051542_home_safety_cards','20261110000000_organization_charts','20261110000030_private_org_template','20261110000100_open_organization_module','20261110003000_organization_site_folders','20261110011500_org_record_deletion_document_menu'])
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
    assert.equal((await call('field','save',{...save,revision:3})).status,200);
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
    const erase=(role,id,rev,selected,folderRevision=1)=>call(role,'delete',{siteId:id,period,revision:rev,targetRevision:selected,folderRevision});
    const otherSave={...save,siteId:'other-site'};
    assert.equal((await call('safety','save',otherSave)).status,200);
    for(const who of ['field','manager','executive'])assert.equal((await erase(who,'other-site',1,1)).status,403);
    assert.equal((await erase('other','other-site',1,1)).status,200);
    assert.equal((await call('other','open',{siteId:'other-site'})).body.document,null);
    assert.equal((await call('other','save',otherSave)).body.revision,2);
    for(const ver of [1,2,3,4])assert.equal((await erase('field',siteId,4,ver)).status,403);
    assert.equal((await erase('safety',siteId,4,2)).status,200);
    assert.equal((await erase('field',siteId,4,4,2)).status,403);
    assert.equal((await erase('safety',siteId,4,4,2)).status,200);
    assert.equal((await call('safety','open',{siteId,revision:4})).status,404);
    for(const role of ['safety','field','manager','executive']){
      const {documentMenus}= (await f.call(role,{action:'platform_catalog'})).body;
      assert.deepEqual(documentMenus.map(x=>x.key),['organization','policy','training','msds','law','voice','risk','emergency','ppe','ergonomics']);
      assert.deepEqual(documentMenus.map(x=>x.displayName.slice(0,2)),['01','02','03','05','06','07','08','09','10','11']);
    }
    console.log('PASS folder management permissions, archive, stale writes, recovery, safety editor, site scope and half-year checks');
  }finally{await f.db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
