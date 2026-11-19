'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{orgFixture}=require('./organization.cjs');
require('../safety-card-model.js');
const model=globalThis.ENLSafetyCardModel;
(async()=>{
 const f=await orgFixture();
 try{
  for(const name of ['20261117000000_risk_assessment_folders','20261117000100_open_risk_assessment_module','20261117042933_risk_assessment_records','20261118083845_safety_cards'])await f.db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
  await f.db.exec("alter table enl_site_master add column manager_phone text,add column part_phone text,add column clerk_phone text,add column course_holes text,add column headcount_basis text,add column safety_agency text");
  const content={values:Object.fromEntries(Object.keys(model.template.fields).map(k=>[k,''])),notes:{D43:'원본 메모'},provenance:{F3:'원본 표시'}};
  content.values.N6='원본 법인';content.values.D6='검수 사업장';content.values.C9='12';content.values.E9='10';

  for(const id of ['qa-site','other-site'])await f.db.query("insert into private.enl_safety_cards values($1,1,$2,$3,'import','import','엑셀 원본',now())",[id,model.template.version,JSON.stringify(content)]);
  await f.db.exec(fs.readFileSync('supabase/migrations/20261119004348_safety_card_master_profile.sql','utf8'));
  assert.equal((await f.db.query("select safety_card_profile->>'corporation' as name from enl_site_master where site_id='qa-site'")).rows[0].name,'원본 법인','migration preserves imported source values');
  await f.db.exec("update enl_site_master set regular_count=20,daily_count=3,manager_name='연동 소장',manager_phone='010-0000-0000',safety_card_profile=jsonb_build_object('corporation','변경된 법인') where site_id='qa-site'");
  const call=(who,action,extra={})=>f.call(who,{action:'platform_safety_card_'+action,...extra});
  assert.equal((await call('safety','list')).body.sites.length,2);
  assert.equal((await call('field','list')).body.sites.length,1);
  assert.equal((await call('field','open',{siteId:'other-site'})).status,403);
  for(const role of ['manager','executive']){
    assert.equal((await call(role,'open',{siteId:'qa-site'})).body.canEdit,false);
    assert.equal((await call(role,'save',{siteId:'qa-site'})).status,403);
  }
  const edit={siteId:'qa-site',expectedRevision:1,templateVersion:model.template.version,content:structuredClone(content)};
  edit.content.values.C9='24';edit.content.values.D42='직접 작성한 의견';edit.content.values.D6='다른 이름';edit.content.notes.D43+='\n추가 확인';
  assert.equal((await call('safety','save',edit)).status,200);
  const saved=(await call('field','open',{siteId:'qa-site'})).body.document;
  assert.equal(saved.content.values.C9,'12','linked source snapshots cannot be overwritten');assert.equal(saved.content.values.D42,'직접 작성한 의견');assert.equal(saved.content.values.D6,'검수 사업장');
  assert.equal(saved.content.notes.D43,'원본 메모\n추가 확인');
  assert.equal(saved.content.provenance.F3,'원본 표시');
  assert.equal((await call('field','save',edit)).status,409,'stale revision never overwrites');
  edit.expectedRevision=2;edit.content.values.C9='-1';
  assert.equal((await call('field','save',edit)).status,400);
  edit.content.values.C9='0';edit.content.values.P23='양호';
  assert.equal((await call('field','save',edit)).status,200);
  assert.equal((await f.db.query("select count(*)::int as n from private.enl_safety_cards where site_id='qa-site'")).rows[0].n,3);
  const values={...content.values,C9:'0',E9:'0',L13:'5',P23:'보완 필요'};
  assert.deepEqual(model.calculate(values),{G9:'0',N2:'위험',N31:'보완 필요',N40:'미확인'});
  values.L13='3';assert.equal(model.calculate(values).N2,'주의');
  values.L13='';assert.equal(model.calculate(values).N2,'미확인');
  values.C9='';assert.equal(model.calculate(values).G9,'미확인');
  values.P41='확인완료';assert.equal(model.calculate(values).N40,'없음');
  values.B37='위험요인';values.N37='진행 중';assert.equal(model.calculate(values).N40,'미조치·진행 1건');
  values.N37='조치완료';assert.equal(model.calculate(values).N40,'조치완료');
  const linked=(await call('safety','open',{siteId:'qa-site'})).body.linked;
  assert.equal(linked.values.C9,'20');assert.equal(linked.values.E9,'3');assert.equal(linked.values.D14,'연동 소장');assert.equal(linked.values.N6,'변경된 법인');
  assert.equal(linked.values.P32,'승인자료 없음');assert.equal(linked.values.L13,'0');
  const year=new Date().getFullYear(),period=linked.organization.period;
  await f.db.query("insert into private.enl_org_charts(site_id,revision,site_name,chart,period,confirmed,actor_id,actor_name,review_event) values('qa-site',1,'QA',$1,$2,true,'qa-safety','QA','approve')",[JSON.stringify({lead:'조직도 책임자',supervisor:'관리감독자',teams:[]}),period]);
  await f.db.exec("update private.enl_org_folders set deleted=false where site_id='qa-site';update private.enl_risk_folders set deleted=false where site_id='qa-site'");
  for(const kind of ['initial','regular'])await f.db.query("insert into private.enl_risk_records(site_id,kind,period,template_id,revision,template_version,content,state,actor_id,actor_name) values('qa-site',$1,$2,'course',1,'test','{}','completed','qa-field','QA')",[kind,kind==='initial'?'initial':String(year)]);
  await f.seedLegacy({id:'qa-linked',siteId:'qa-site',category:'person',status:'reported',occurredAt:new Date().toISOString(),summary:'연동 시험',photos:[]});
  const refreshed=(await call('field','links',{siteId:'qa-site'}));assert.equal(refreshed.status,200,JSON.stringify(refreshed));
  assert.equal(refreshed.body.linked.values.P32,'승인완료');assert.equal(refreshed.body.linked.values.P23,'작성완료 / 승인 전');assert.equal(refreshed.body.linked.values.L13,'1');assert.equal(refreshed.body.linked.values.M16,'연동 시험');assert.match(refreshed.body.linked.values.H14,/조직도 책임자/);
  assert.equal((await call('field','links',{siteId:'other-site'})).status,403);
  await f.db.exec("insert into enl_site_personnel(personnel_id,site_id,name,job_title,access_role,active) values('qa-worker','qa-site','QA','일반근로자','worker',true)");
  const worker=await f.raw({actor:{id:'qa-worker',role:'worker',siteId:'qa-site'},action:'platform_safety_card_links',siteId:'qa-site'});assert.equal(worker.status,200,JSON.stringify(worker));assert.equal(worker.body.linked.values.L13,'미확인');assert.equal(worker.body.linked.values.M16,'');
  const overrideEdit={siteId:'qa-site',expectedRevision:3,templateVersion:model.template.version,content:structuredClone(saved.content)};
  overrideEdit.content.overrides={C9:'35',D6:'카드 표시명',P23:'보완 필요',P32:'양호',M16:'카드 사고 요약'};
  const changed=await call('field','save',overrideEdit);assert.equal(changed.status,200,JSON.stringify(changed));
  let card=(await call('field','open',{siteId:'qa-site'})).body;
  assert.equal(card.document.content.overrides.C9,'35');assert.equal(card.linked.values.C9,'20');assert.equal(model.effectiveValues(card.document.content,card.linked).D6,'카드 표시명');
  assert.equal(model.cardResults(card.document.content,card.linked).G9,'38');assert.match(model.cardResults(card.document.content,card.linked).N31,/카드 수정/);
  assert.equal((await f.db.query("select site_name from enl_site_master where site_id='qa-site'")).rows[0].site_name,'QA 가상 사업장');
  const redacted=(await f.raw({actor:{id:'qa-worker',role:'worker',siteId:'qa-site'},action:'platform_safety_card_open',siteId:'qa-site'})).body.document.content;
  assert.equal(redacted.overrides.M16,undefined);assert.equal(redacted.values.M16,'');
  for(const invalid of [{C9:'-2'},{C9:3},{P32:'승인완료'},{N31:'조작'},{D6:'x'.repeat(4001)},null,[]]){
    const bad=await call('safety','save',{...overrideEdit,expectedRevision:4,content:{...overrideEdit.content,overrides:invalid}});assert.equal(bad.status,400,JSON.stringify(invalid));
  }
  const legacy={...overrideEdit,expectedRevision:4,content:structuredClone(saved.content)};delete legacy.content.overrides;
  assert.equal((await call('safety','save',legacy)).status,200,'old clients preserve overrides');
  card=(await call('field','open',{siteId:'qa-site'})).body;assert.equal(card.document.content.overrides.C9,'35');
  const reset={...overrideEdit,expectedRevision:5,content:{...overrideEdit.content,overrides:{C9:''}}};assert.equal((await call('safety','save',reset)).status,200);
  card=(await call('field','open',{siteId:'qa-site'})).body;assert.equal(model.effectiveValues(card.document.content,card.linked).C9,'','blank override is intentional');
  reset.expectedRevision=6;reset.content.overrides={};assert.equal((await call('safety','save',reset)).status,200);
  card=(await call('field','open',{siteId:'qa-site'})).body;assert.equal(model.effectiveValues(card.document.content,card.linked).C9,'20','restoring link resumes source data');
  console.log('PASS site-scoped reads, role-protected saves, revision conflicts, preserved source notes, immutable site identity, workbook calculations');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
