'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./final-lifecycle.cjs');
require('../safety-card-model.js');
const model=globalThis.ENLSafetyCardModel;
(async()=>{
 const f=await fixture();
 try{
  await f.db.exec(fs.readFileSync('supabase/migrations/20261118083845_safety_cards.sql','utf8'));
  const content={values:Object.fromEntries(Object.keys(model.template.fields).map(k=>[k,''])),notes:{D43:'원본 메모'},provenance:{F3:'원본 표시'}};
  content.values.D6='검수 사업장';content.values.C9='12';content.values.E9='10';
  await f.db.query("insert into public.enl_site_master(site_id,site_name,active) values('other-site','다른 현장',true)");
  for(const id of ['qa-site','other-site'])await f.db.query("insert into private.enl_safety_cards values($1,1,$2,$3,'import','import','엑셀 원본',now())",[id,model.template.version,JSON.stringify(content)]);
  const call=(who,action,extra={})=>f.call(who,{action:'platform_safety_card_'+action,...extra});
  assert.equal((await call('safety','list')).body.sites.length,2);
  assert.equal((await call('field','list')).body.sites.length,1);
  assert.equal((await call('field','open',{siteId:'other-site'})).status,403);
  for(const role of ['manager','executive']){
    assert.equal((await call(role,'open',{siteId:'qa-site'})).body.canEdit,false);
    assert.equal((await call(role,'save',{siteId:'qa-site'})).status,403);
  }
  const edit={siteId:'qa-site',expectedRevision:1,templateVersion:model.template.version,content:structuredClone(content)};
  edit.content.values.C9='24';edit.content.values.D6='다른 이름';edit.content.notes.D43+='\n추가 확인';
  assert.equal((await call('safety','save',edit)).status,200);
  const saved=(await call('field','open',{siteId:'qa-site'})).body.document;
  assert.equal(saved.content.values.C9,'24');assert.equal(saved.content.values.D6,'검수 사업장');
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
  console.log('PASS site-scoped reads, role-protected saves, revision conflicts, preserved source notes, immutable site identity, workbook calculations');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
