'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{orgFixture}=require('./organization.cjs');
require('../safety-card-model.js');const model=globalThis.ENLSafetyCardModel;
async function primaryFixture(){
 const f=await orgFixture();
 for(const name of ['20261117000000_risk_assessment_folders','20261117000100_open_risk_assessment_module','20261117042933_risk_assessment_records','20261118083845_safety_cards'])await f.db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
 const columns=(await f.db.query("select column_name from information_schema.columns where table_schema='public' and table_name='enl_site_master'")).rows.map(r=>r.column_name);
 for(const name of [...Object.values(model.masterFields),'updated_by_id','updated_by_name','updated_by_role'])if(!columns.includes(name))await f.db.exec('alter table enl_site_master add column '+name+' text');
 await f.db.exec('alter table enl_site_master add column updated_at timestamptz default now()');
 await f.db.exec("update enl_site_master set regular_count=20,daily_count=3,total_count=23");
 const content={values:Object.fromEntries(Object.keys(model.template.fields).map(k=>[k,''])),notes:{D43:'원본 메모'},provenance:{F3:'원본 표시'},overrides:{}};
 content.values.N6='원본 법인';content.values.D6='엑셀 사업장';content.values.C9='12';content.values.E9='10';
 for(const id of ['qa-site','other-site'])await f.db.query("insert into private.enl_safety_cards values($1,1,$2,$3,'import','import','엑셀 원본',now())",[id,model.template.version,JSON.stringify(content)]);
 await f.db.exec(fs.readFileSync('supabase/migrations/20261119004348_safety_card_master_profile.sql','utf8'));
 await f.db.exec(fs.readFileSync('supabase/migrations/20261119012407_safety_card_primary_source.sql','utf8'));
 return f;
}
module.exports={primaryFixture};
if(require.main===module)(async()=>{
 const f=await primaryFixture();
 try{
  const call=(who,action,extra={})=>f.call(who,{action:'platform_safety_card_'+action,...extra});
  const open=async()=>(await call('field','open',{siteId:'qa-site'})).body;
  let card=await open();assert.equal(card.document.content.authority,'card-v1');assert.equal(card.document.content.masterValues.C9,'20');assert.equal(card.document.content.values.C9,'12','workbook snapshot preserved');assert.equal(card.document.revision,2);
  assert.equal((await call('field','list')).body.sites.length,1);assert.equal((await call('safety','list')).body.sites.length,2);assert.equal((await call('field','open',{siteId:'other-site'})).status,403);
  for(const role of ['manager','executive']){assert.equal((await call(role,'open',{siteId:'qa-site'})).body.canEdit,false);assert.equal((await call(role,'save',{siteId:'qa-site'})).status,403);}
  const edit=()=>({siteId:'qa-site',expectedRevision:card.document.revision,templateVersion:model.template.version,content:structuredClone(card.document.content)});
  const e=edit();e.content.overrides={D6:'카드 기준 사업장',D14:'카드 소장',F14:'010-0000-0000',D23:'카드 대행사',C9:'35',N6:'카드 법인',P23:'보완 필요',P32:'양호',M16:'카드 사고 요약'};e.content.values.D42='직접 작성한 의견';e.content.notes.D43+=' 추가';
  const saved=await call('field','save',e);assert.equal(saved.status,200,JSON.stringify(saved));card=await open();
  assert.equal(card.document.content.masterValues.C9,'35');assert.equal(card.document.content.overrides.C9,undefined);assert.equal(card.document.content.overrides.M16,'카드 사고 요약');assert.equal(card.linked.values.C9,'35');assert.equal(card.linked.values.D6,'카드 기준 사업장');assert.equal(model.cardResults(card.document.content,card.linked).G9,'38');assert.match(model.cardResults(card.document.content,card.linked).N31,/입력 상태/);
  assert.equal(card.document.content.notes.D43,'원본 메모 추가');assert.equal(card.document.content.provenance.F3,'원본 표시');assert.equal((await call('field','save',e)).status,409);
  const master=(await f.db.query("select * from enl_site_master where site_id='qa-site'")).rows[0];assert.equal(master.safety_card_profile._source,'safety_card');assert.equal(master.safety_card_profile.corporation,'카드 법인');assert.equal(master.manager_name,'카드 소장');assert.equal(master.safety_agency,'카드 대행사');
  assert.equal((await f.db.query("select name from enl_site_personnel where personnel_id='qa-field'")).rows[0].name,'QA 현장','card contacts do not edit login identities');
  await f.db.exec("update enl_site_master set site_name='다른 메뉴 이름',manager_name='덮어쓰기',regular_count=1,active=false where site_id='qa-site'");
  const protectedSite=(await f.db.query("select * from enl_site_master where site_id='qa-site'")).rows[0];assert.equal(protectedSite.site_name,'카드 기준 사업장');assert.equal(protectedSite.manager_name,'카드 소장');assert.equal(protectedSite.regular_count,35);assert.equal(protectedSite.active,false,'unrelated lifecycle controls remain editable');
  for(const invalid of [{C9:''},{C9:'-1'},{D6:''},{C9:'2147483647'},{P32:'승인완료'},{N31:'조작'}]){const bad=edit();bad.content.overrides=invalid;assert.equal((await call('safety','save',bad)).status,400,JSON.stringify(invalid));}
  const stale=edit();delete stale.content.authority;assert.equal((await call('safety','save',stale)).status,409,'old editing protocol cannot overwrite canonical data');
  const tampered=edit();tampered.content.masterValues.D6='직접 주입';tampered.content.overrides={};assert.equal((await call('safety','save',tampered)).status,200);card=await open();assert.equal(card.document.content.masterValues.D6,'카드 기준 사업장','canonical values are merged server-side');
  await f.db.exec("insert into enl_site_personnel(personnel_id,site_id,name,job_title,access_role,active) values('qa-worker','qa-site','QA','일반근로자','worker',true)");
  const worker=(await f.raw({actor:{id:'qa-worker',role:'worker',siteId:'qa-site'},action:'platform_safety_card_open',siteId:'qa-site'})).body;assert.equal(worker.document.content.values.M16,'');assert.equal(worker.document.content.overrides.M16,undefined);assert.equal(worker.linked.values.M16,'');
  assert.equal((await f.db.query('select count(*)::int as n from private.enl_org_charts')).rows[0].n,0,'no approval or organization document synthesized');assert.equal((await f.db.query('select count(*)::int as n from enl_incident_shared')).rows[0].n,0,'no incident data mutated');
  assert.ok((await f.db.query("select count(*)::int as n from enl_site_audit where site_id='qa-site'")).rows[0].n>=3);
  const revisionBefore=card.document.revision,rollback=edit();rollback.content.overrides={C9:'40'};
  await f.db.exec("alter table enl_site_audit add constraint qa_reject_card_audit check(editor_id<>'qa-field') not valid");
  const failure=await call('field','save',rollback);assert.equal(failure.status,500);await f.db.exec('alter table enl_site_audit drop constraint qa_reject_card_audit');
  card=await open();assert.equal(card.document.revision,revisionBefore,'audit failure rolls back card revision');assert.equal(card.document.content.masterValues.C9,'35');assert.equal(card.linked.values.C9,'35','audit failure rolls back shared projection');
  await assert.rejects(f.db.query("insert into private.enl_safety_cards(site_id,revision,template_version,content,source,actor_id,actor_name) values('qa-site',999,$1,$2,'edit','old','old')",[model.template.version,JSON.stringify({...card.document.content,authority:undefined,masterValues:undefined})]),/card_primary_required/);
  const grants=(await f.db.query("select has_function_privilege('anon','private.enl_site_from_primary_card()','EXECUTE') as anon,has_function_privilege('authenticated','private.enl_site_from_primary_card()','EXECUTE') as signed_in")).rows[0];assert.equal(grants.anon,false);assert.equal(grants.signed_in,false);

  console.log('PASS primary-card migration, site projection and protection, original history, atomic save, revisions, role scope, account/incident/approval preservation and audit');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
