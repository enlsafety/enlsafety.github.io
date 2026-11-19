'use strict';
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const dom=new JSDOM('<main id="host"></main>',{url:'https://isolated.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.structuredClone=structuredClone;w.confirm=()=>true;w.print=()=>{};
 w.eval(fs.readFileSync('safety-card-model.js','utf8'));w.eval(fs.readFileSync('safety-card.js','utf8'));
 const model=w.ENLSafetyCardModel,site={site_id:'qa',site_name:'검수 사업장'};
 let revision=1,values=Object.fromEntries(Object.keys(model.template.fields).map(k=>[k,''])),notes={},count='12',fail=false;
 const linked=()=>({values:{D6:'연동 사업장',C9:count,E9:'3',L13:'1',P23:'작성완료 / 승인 전',P32:'승인완료'},sources:{C9:'사업장 정보'},calculated:{N31:'조직도 승인 / 나머지 확인 필요'}});
 const api=async b=>{
  if(b.action.endsWith('_list'))return {sites:[site]};
  if(b.action.endsWith('_links')){if(fail)throw Error('network');return {linked:linked()};}
  if(b.action.endsWith('_save')){assert.equal(b.content.values.C9,'','linked values never enter stored content');values=structuredClone(b.content.values);notes=structuredClone(b.content.notes);revision++;}
  return {linked:linked(),site,canEdit:true,document:{revision,source:'edit',template_version:model.template.version,content:{values,notes,provenance:{}},saved_at:new Date().toISOString(),actor_name:'QA'}};
 };
 const card=w.enlSafetyCards(w.document.getElementById('host'),{role:'safety'},api,()=>true,()=>{});
 await card.open();w.document.querySelector('[data-card-site]').click();await tick();
 const q=s=>w.document.querySelector(s);
 assert.equal(q('[data-card-linked="C9"]').textContent,'12');assert.equal(q('[data-card-result="G9"]').textContent,'15');assert.equal(q('[data-card-field="C9"]'),null);
 assert.ok(q('.safety-card-header-tools [data-card-save]'));assert.equal(q('.safety-card-editor .safety-card-tools'),null);
 const opinion=q('[data-card-field="D42"]');opinion.value='보존할 미저장 의견';opinion.dispatchEvent(new w.Event('input'));
 count='20';await card.refreshLinked();assert.equal(q('[data-card-result="G9"]').textContent,'23');assert.equal(q('[data-card-field="D42"]'),opinion);assert.equal(opinion.value,'보존할 미저장 의견');
 fail=true;await card.refreshLinked();assert.match(q('.safety-card-link-status').textContent,/마지막 조회값/);fail=false;
 q('[data-card-save]').click();await tick();assert.equal(values.D42,'보존할 미저장 의견');assert.equal(q('.safety-card-header-tools').disabled,false);
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='인쇄 / PDF').click();assert.equal(q('#safety-card-print [data-card-linked="C9"]').textContent,'20');assert.equal(q('#safety-card-print textarea'),null);w.dispatchEvent(new w.Event('afterprint'));
 card.back();assert.ok(q('[data-card-site]'));card.leave();dom.window.close();
 console.log('PASS linked readonly values, right header toolbar, source refresh preserves unsaved input, failure notice, save, print and back');
})().catch(e=>{console.error(e);process.exitCode=1});
