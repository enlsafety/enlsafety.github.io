'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');const {orgFixture}=require('./organization.cjs');
const until=async(fn,label)=>{for(let n=0;n<300;n++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+label)};
(async()=>{
 const f=await orgFixture();
 try{
 for(const p of ['supabase/migrations/20261117000000_risk_assessment_folders.sql','supabase/migrations/20261117000100_open_risk_assessment_module.sql','supabase/migrations/20261117042933_risk_assessment_records.sql','supabase/migrations/20261126000002_risk_safety_review.sql'])await f.db.exec(fs.readFileSync(p,'utf8'));
 for(const role of ['field','safety','manager','executive']){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM('<body><div id="app"><div id="host" data-workspace="risk"></div></div></body>',{url:'https://isolated.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window,d=w.document;let confirm=true,fail=false;
  w.structuredClone=structuredClone;w.confirm=()=>confirm;w.HTMLElement.prototype.scrollIntoView=()=>{};w.print=()=>{};
  Object.defineProperty(w,'crypto',{value:crypto.webcrypto});
  for(const p of ['document-photo-viewer.js','attachment-drop-v4813.js','risk-paper-templates.js','risk-paper.js','risk-editor.js','risk-assessment.js'])w.eval(fs.readFileSync(p,'utf8'));
  const user={role,id:'qa-'+role,siteId:'qa-site'};
  const api=async body=>{if(fail&&body.action==='platform_risk_save')throw Error('network_failure');const r=await f.call(role,body);if(r.status!==200)throw Error(r.body.message);return r.body;};
  const mount=w.enlRiskAssessment(d.querySelector('#host'),user,api,()=>true);mount.catalog({enabled:true,state:'live'});await mount.open();
  d.querySelector('[data-site-id="qa-site"]').click();
  assert.equal(d.querySelectorAll('[data-risk-kind]').length,2);assert.match(d.querySelector('[data-risk-kind="initial"]').textContent,/오픈 전 완료 필수/);assert.match(d.querySelector('[data-risk-kind="regular"]').textContent,/매년 1회/);
  d.querySelector('[data-risk-kind="regular"]').click();await until(()=>d.querySelector('[data-risk-template]'),'five books');assert.equal(d.querySelectorAll('[data-risk-template]').length,5);
  const year=d.querySelector('[data-risk-year]');year.value='2027';year.dispatchEvent(new w.Event('change'));await until(()=>d.querySelector('[data-risk-year]')?.value==='2027'&&d.querySelector('[data-risk-template]'),'year');
  d.querySelector('[data-risk-template="office"]').click();await until(()=>d.querySelector('.risk-editor'),'editor');assert.equal(d.querySelectorAll('.risk-row').length,14);
  assert.ok(d.querySelector('.risk-paper [data-cell="B2"]'));assert.equal(d.querySelector('.risk-paper [data-cell="D8"] input'),null,'fixed task label');assert.equal(d.querySelectorAll('.risk-paper-scroll').length,4,'one assessment sheet plus three improvement sheets');
  const editorField=d.querySelector('[data-risk-field="evaluator"]');assert.equal(editorField.disabled,!['field','safety'].includes(role));
  if(['field','safety'].includes(role)){
   editorField.value='QA '+role;editorField.dispatchEvent(new w.Event('input',{bubbles:true}));confirm=false;assert.equal(mount.canLeave(),false,'unsaved guard');confirm=true;
   fail=true;[...d.querySelectorAll('.risk-save-actions button')].find(b=>b.textContent==='저장').click();await until(()=>d.querySelector('.risk-message').textContent.includes('저장하지 못'),'error');assert.equal(editorField.value,'QA '+role,'failed save preserves input');
   fail=false;[...d.querySelectorAll('.risk-save-actions button')].find(b=>b.textContent==='저장').click();await until(()=>d.querySelector('.risk-message')?.textContent==='저장했습니다.','saved');
   assert.equal(d.querySelector('[data-risk-field="evaluator"]').value,'QA '+role);assert.equal(mount.canLeave(),true);
   const add=[...d.querySelectorAll('.risk-editor button')].find(b=>b.textContent==='작업 추가');add.click();assert.equal(d.querySelectorAll('.risk-row').length,15);assert.equal(d.querySelectorAll('.risk-row input').length>0,true);
   [...d.querySelectorAll('.risk-remove')].find(b=>b.textContent==='추가 작업 삭제').click();assert.equal(d.querySelectorAll('.risk-row').length,14);
   const first=d.querySelector('.risk-row input[type=checkbox]');first.checked=true;first.dispatchEvent(new w.Event('change'));assert.ok(d.querySelector('[data-risk-field="excludeReason"]'));
  }else{assert.equal(d.querySelector('.risk-save-actions'),null);assert.ok([...d.querySelectorAll('.risk-fields input,.risk-fields select,.risk-fields textarea')].every(c=>c.disabled));}
  [...d.querySelectorAll('.risk-editor button')].find(b=>b.textContent==='출력하기').click();assert.equal(d.querySelectorAll('#risk-print-page .risk-paper').length,4);assert.equal(d.querySelectorAll('#risk-print-page input,#risk-print-page textarea').length,0,'print renders saved/input text, not editable fields');assert.deepEqual(errors,[]);mount.leave();dom.window.close();
  console.log('PASS risk DOM '+role+': type cards, five templates, annual selection, editor, role controls, dirty/save error guards');
 }
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
