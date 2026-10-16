'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const src=fs.readFileSync('incident-flow-v440.js','utf8');
const begin=src.indexOf('  // Rule-based suggestions only:');
const end=src.indexOf('  function causePanel(i){',begin);
assert.ok(begin>=0&&end>begin,'generator block exists');
const {buildCauseDraft,hasSavedCause}=new Function(
  'const text=v=>String(v??"").trim();'+src.slice(begin,end)+'return {buildCauseDraft,hasSavedCause};'
)();
const cases=[
  ['카트 충돌','접촉','카트가 시설물과 접촉','차량·장비','차량 운행'],
  ['넘어짐','넘어짐','젖은 통행로에서 미끄러짐','바닥','보행'],
  ['예초기 베임','베임/찔림','예초기 날에 손가락 접촉','공구','공구'],
  ['안전망 전도','붕괴/전도','강풍에 안전망 지지대가 쓰러짐','고정·지지','고정상태'],
  ['추락','추락','사다리 위 작업 중 추락','발판','고소작업'],
  ['타구','타구','경기 진행 중 골프공에 맞음','경기구역','경기 진행'],
  ['끼임','끼임','기계 회전체에 손이 끼임','설비 위험점','설비 정지']
];
for(const [name,eventType,incidentHow,env,behavior] of cases){
  const draft=buildCauseDraft({eventType,reportDetails:{incidentHow,workAction:'현장 관리작업 중'}});
  assert.ok(draft.environmentCause.includes(env),name+' env '+draft.environmentCause);
  assert.ok(draft.behaviorCause.includes(behavior),name+' behavior '+draft.behaviorCause);
  assert.match(draft.causeAnalysisNote,/미확정/,name);
  assert.ok(Object.values(draft).every(s=>s.length<4000),name+' maxlength');
}
assert.match(buildCauseDraft({eventType:'기타',reportDetails:{}}).causeAnalysisNote,/미확정|자료가 부족/);
assert.equal(hasSavedCause({causeAnalysisStatus:'analyzed'}),true);
assert.equal(hasSavedCause({causeAnalysisStatus:'investigating'}),true);
assert.equal(hasSavedCause({behaviorCause:'현장 재조사 결과'}),true);
assert.equal(hasSavedCause({causeAnalysisStatus:'not_reviewed'}),false);
assert.ok(src.includes("panel.dataset.wf440Draft=auto?'unreviewed':'stored'"));
assert.ok(src.includes("panel.dataset.wf440Draft==='unreviewed'&&!allowAutoDraft"));
assert.ok(src.includes("collectCause({allowAutoDraft:true})"));
assert.ok(src.includes("bindCausePanel(cause,i)"));
console.log('PASS: 7 accident draft cases, unknown case, manual retention and explicit review guard');
