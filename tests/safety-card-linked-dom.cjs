'use strict';
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 for(const role of ['safety','field','manager','executive','worker']){
 const dom=new JSDOM('<main id="host" class="platform-hub"></main>',{url:'https://isolated.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.structuredClone=structuredClone;w.confirm=()=>true;w.print=()=>{};
 const css=w.document.createElement('style');css.textContent=fs.readFileSync('safety-card.css','utf8');w.document.head.append(css);
 w.eval(fs.readFileSync('safety-card-model.js','utf8'));w.eval(fs.readFileSync('safety-card.js','utf8'));
 const model=w.ENLSafetyCardModel,site={site_id:'qa',site_name:'검수 사업장'};
 let revision=1,values=Object.fromEntries(Object.keys(model.template.fields).map(k=>[k,''])),notes={},overrides={},count='12',fail=false,conflict=false;
 const linked=()=>({values:{D6:'연동 사업장',C9:count,E9:'3',L13:'1',P8:'코스현장',P23:'작성완료 / 승인 전',P32:'승인완료'},sources:{C9:'사업장 정보'},calculated:{N31:'조직도 승인 / 나머지 확인 필요'}});
 const api=async b=>{
  if(b.action.endsWith('_list'))return {sites:[site]};
  if(b.action.endsWith('_links')){if(fail)throw Error('network');return {linked:linked()};}
  if(b.action.endsWith('_save')){if(conflict)throw Error('card_changed');assert.equal(b.content.values.C9,'','underlying source snapshot preserved');values=structuredClone(b.content.values);notes=structuredClone(b.content.notes);overrides=structuredClone(b.content.overrides);revision++;}
  return {linked:linked(),site,canEdit:['safety','field'].includes(role),document:{revision,source:'edit',template_version:model.template.version,content:{values,notes,overrides,provenance:{}},saved_at:new Date().toISOString(),actor_name:'QA'}};
 };
 const card=w.enlSafetyCards(w.document.getElementById('host'),{role},api,()=>true,()=>{});
 await card.open();w.document.querySelector('[data-card-site]').click();await tick();
 const q=s=>w.document.querySelector(s),field=k=>q('[data-card-field="'+k+'"]'),set=(k,v)=>{field(k).value=v;field(k).dispatchEvent(new w.Event('input'));};
 assert.equal(field('C9').value,'12');assert.equal(q('[data-card-result="G9"]').textContent,'15');
 assert.ok(q('.safety-card-header-tools [data-card-save]'));assert.equal(q('.safety-card-editor .safety-card-tools'),null);
 if(['safety','field'].includes(role)){
  const colors=['B6','C9','P8','G9'].map(k=>w.getComputedStyle(q('[data-cell="'+k+'"]')).backgroundColor);
  assert.equal(new Set(colors).size,4,'label/input/dropdown/result have distinct colors');
  set('D42','보존할 미저장 의견');const opinion=field('D42');
  set('C9','21');set('P23','보완 필요');set('P32','양호');set('D6','카드 사업장');
  assert.equal(q('[data-card-result="G9"]').textContent,'24');assert.match(q('[data-cell="B2"]').textContent,/카드 사업장/);assert.match(q('[data-card-result="N31"]').textContent,/카드 수정 \/ 보완 필요/);assert.equal(q('[data-card-reset="C9"]').hidden,false);
  count='20';await card.refreshLinked();assert.equal(field('C9').value,'21');assert.equal(field('D42'),opinion);assert.equal(opinion.value,'보존할 미저장 의견');
  fail=true;await card.refreshLinked();assert.match(q('.safety-card-link-status').textContent,/마지막 조회값/);fail=false;
  conflict=true;q('[data-card-save]').click();await tick();assert.match(q('.safety-card-status').textContent,/먼저 저장/);assert.equal(field('C9').value,'21');conflict=false;
  q('[data-card-save]').click();await tick();assert.equal(overrides.C9,'21');assert.equal(overrides.P32,'양호');assert.equal(values.D42,'보존할 미저장 의견');assert.equal(q('.safety-card-header-tools').disabled,false);
  [...w.document.querySelectorAll('button')].find(b=>b.textContent==='새로고침').click();await tick();assert.equal(field('C9').value,'21');
  [...w.document.querySelectorAll('button')].find(b=>b.textContent==='인쇄 / PDF').click();assert.match(q('#safety-card-print [data-cell="P8"]').textContent,/코스현장/);assert.doesNotMatch(q('#safety-card-print').textContent,/__linked__/);assert.match(q('#safety-card-print [data-cell="P23"]').textContent,/보완 필요/);assert.match(q('#safety-card-print [data-cell="P32"]').textContent,/양호/);assert.match(q('#safety-card-print [data-cell="D42"]').textContent,/보존할 미저장 의견/);assert.equal(q('#safety-card-print textarea'),null);assert.match(q('#safety-card-print [data-cell="C9"]').textContent,/카드 수정/);w.dispatchEvent(new w.Event('afterprint'));
  q('[data-card-reset="C9"]').click();assert.equal(field('C9').value,'20');q('[data-card-save]').click();await tick();assert.equal(Object.hasOwn(overrides,'C9'),false);
  count='25';await card.refreshLinked();assert.equal(field('C9').value,'25');assert.equal(q('[data-card-result="G9"]').textContent,'28');
  set('C9','');q('[data-card-save]').click();await tick();assert.equal(overrides.C9,'','explicit blank persists as override');
 }else{assert.equal(field('C9').readOnly,true);assert.equal(field('P32').disabled,true);assert.equal(q('[data-card-reset]'),null);set('C9','8');assert.equal(q('[data-card-save]').disabled,true,'read-only synthetic input cannot mark dirty');}
 card.back();assert.ok(q('[data-card-site]'));card.leave();dom.window.close();
 console.log('PASS card overrides, reset, source refresh, colors, conflict, print, back and permissions:',role);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
