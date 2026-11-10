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
  ['카트 충돌','접촉','카트가 시설물과 접촉','통행 공간','차량 이동'],
  ['넘어짐','넘어짐','젖은 통행로에서 미끄러짐','젖은 바닥','노면'],
  ['예초기 베임','베임/찔림','예초기 날에 손가락 접촉','예초기','날의 진행 방향'],
  ['안전망 전도','붕괴/전도','강풍에 안전망 지지대가 쓰러짐','고정 상태','고정상태'],
  ['추락','추락','사다리 위 작업 중 추락','발판','발 디딤 위치'],
  ['타구','타구','경기 진행 중 골프공에 맞음','경기구역','경기 진행'],
  ['끼임','끼임','기계 회전체에 손이 끼임','설비 가동부','설비 정지']
];
for(const [name,eventType,incidentHow,env,behavior] of cases){
  const draft=buildCauseDraft({eventType,reportDetails:{incidentHow,workAction:'현장 관리작업 중'}});
  assert.ok(draft.environmentCause.includes(env),name+' env '+draft.environmentCause);
  assert.ok(draft.behaviorCause.includes(behavior),name+' behavior '+draft.behaviorCause);
  assert.match(draft.causeAnalysisNote,/확인 필요/,name);
  assert.ok(Object.values(draft).every(s=>s.length<100),name+' maxlength');
}
assert.match(buildCauseDraft({eventType:'기타',reportDetails:{}}).causeAnalysisNote,/특정하기 어려움/);
const turning=buildCauseDraft({eventType:'설비/시설 파손',reportDetails:{workAction:'차량 회전',incidentHow:'좁은 구간에서 회전하다 뒷바퀴 파손',damagedItem:'뒷바퀴'}});
assert.match(turning.environmentCause,/회전 공간이 좁아/);assert.match(turning.behaviorCause,/뒷바퀴 이동 경로/);assert.match(turning.causeAnalysisNote,/회전 중 뒷바퀴 파손/);
assert.doesNotMatch(Object.values(turning).join(' '),/과실|확인 미흡|확인하지 않/);
const post=buildCauseDraft({eventType:'설비/시설 파손',reportDetails:{incidentHow:'카트 후진 중 홀맵지주에 충돌'}});
assert.match(post.causeAnalysisNote,/후진 중 홀맵지주 접촉/);assert.doesNotMatch(post.environmentCause,/좁아/);
const sparse=buildCauseDraft({eventType:'기타',summary:'[사고 개요] 미상 [재발 방지 대책] 사다리 추락 방지'});
assert.match(sparse.causeAnalysisNote,/특정하기 어려움/);
assert.equal(hasSavedCause({causeAnalysisStatus:'analyzed'}),true);
assert.equal(hasSavedCause({causeAnalysisStatus:'investigating'}),true);
assert.equal(hasSavedCause({behaviorCause:'현장 재조사 결과'}),true);
assert.equal(hasSavedCause({causeAnalysisStatus:'not_reviewed'}),false);
assert.ok(src.includes("panel.dataset.wf440Draft=auto?'unreviewed':'stored'"));
assert.ok(src.includes("box.dataset.wf440Draft==='unreviewed'&&!allowAutoDraft"));
assert.ok(src.includes("collectCause({allowAutoDraft:true})"));
assert.ok(src.includes("bindCausePanel(cause,i)"));
console.log('PASS: 7 accident draft cases, unknown case, manual retention and explicit review guard');

const carrying={category:'person',eventType:'부딪힘',reportDetails:{
  place:'1번 그린 우측 카트도로',workAction:'그린 카바를 정리 후 운반 하던 중',
  incidentHow:'넘어질때 주머니에 있던 휴대폰이 옆구리에 부딪힘',injuryDetail:'갈비뼈 부위 통증이 있음'
}};
const carryDraft=buildCauseDraft(carrying);
assert.match(carryDraft.environmentCause,/1번 그린 우측 카트도로/);
assert.match(carryDraft.behaviorCause,/그린 카바.*운반.*시야/);
assert.match(carryDraft.causeAnalysisNote,/휴대폰에 의한 옆구리 충격이 보고됨/);
assert.match(carryDraft.causeAnalysisNote,/최초로 넘어진 직접 원인은 확인 필요/);
assert.doesNotMatch(Object.values(carryDraft).join(' '),/차량 이동|젖은 바닥|골절/);
const dry=buildCauseDraft({eventType:'넘어짐',reportDetails:{incidentHow:'노면에 물기는 없었고 이동 중 넘어짐'}});
assert.doesNotMatch(dry.environmentCause,/젖은 바닥/);
const archived=buildCauseDraft({summary:'[사고 개요] 예제 [사고 경위] 계단에서 발을 헛디뎌 넘어짐 [재발 방지 대책] 지게차 진입 금지'});
assert.match(archived.causeAnalysisNote,/발을 헛디뎌/);
assert.doesNotMatch(Object.values(archived).join(' '),/지게차/);
console.log('PASS: fall with secondary impact, dry surface, legacy incident narrative');
const hose=buildCauseDraft({eventType:'넘어짐',reportDetails:{incidentHow:'호스에 발이 걸려 넘어짐'}});
assert.match(hose.environmentCause,/호스 관련 걸림/);
