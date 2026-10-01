const fs=require('node:fs'),assert=require('node:assert/strict');

const read=f=>fs.readFileSync(f,'utf8');
const fieldUi=read('field-ui-v411.js');
const field=read('field-incidents-v411.js');
const flow=read('incident-flow-v440.js');
const approval=read('management-approval-v448.js');
const reader=read('reader-ui-v414.js');
const shell=read('app-shell-v411.js');
const stable=read('stable412.html');
const version=JSON.parse(read('version.json'));

for(const bad of ['요청했어','하면 돼','해야 해','등록했어','승인됐어','기록이야','완료했어','기다리면 돼','확인 중이야','보여줘']){
  assert.ok(!fieldUi.includes(bad),'informal field home copy: '+bad);
  assert.ok(!field.includes(bad),'informal field record copy: '+bad);
}
assert.ok(!fieldUi.includes('안전관리자가 보완을 요청했어.'));
assert.ok(field.includes('안전관리자가 추가자료를 요청한 사고입니다.'));
assert.ok(field.includes('보완자료 작성이 필요합니다'));
assert.ok(flow.includes('wf440-supplement-submitted'));
assert.ok(flow.includes('현장 보완 제출내용'));
assert.ok(flow.includes("if(!(isSafety(u)||isReader(u)))return"));
assert.ok(flow.includes("status==='approved'||(status==='closed'&&actionStatus==='approved')"));
assert.ok(approval.includes("function signable(i)"));
assert.ok(approval.includes("st==='approved'||(st==='closed'&&act==='approved')"));
assert.ok(!approval.includes("SIGN=['reported','supplement','supplement_submitted','approved','closed']"));
assert.ok(reader.includes("window.enlRenderHqHome"));
assert.ok(reader.includes('검토대기·보완대기 단계에서는 조회만 가능하며'));
assert.ok(shell.includes("function renderReaderHome(root,u){return renderSafetyHome(root,u)}"));
assert.ok(shell.includes('즉시보고·보완 진행중'));
assert.ok(shell.includes("window.enlRenderHqHome=renderSafetyHome"));
for(const asset of [
  'field-ui-v411.js?v=4.4.37-r1&amp;fix=field-copy1',
  'field-incidents-v411.js?v=4.4.37-r1&amp;fix=field-copy2',
  'app-shell-v411.js?v=4.4.38-r1&amp;fix=hq-attention1',
  'reader-ui-v414.js?v=4.4.37-r1&amp;fix=hq-dashboard1',
  'incident-flow-v440.js?v=4.4.37-r1&amp;fix=supplement-review1',
  'management-approval-v448.js?v=4.4.38-r1&amp;fix=own-sign1'
]) assert.ok(stable.includes(asset),asset);
assert.equal(version.version,'4.4.38');
assert.equal(version.build,'stable-4438-r1');
console.log('PASS: formal field copy, supplement highlight, finalized-only approval and unified HQ dashboard wiring');
