const fs=require('node:fs'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');

const incidents=read('incidents-v410.js');
const flow=read('incident-flow-v440.js');
const reader=read('reader-experience-v424.js');
const official=read('official-records-v439.js');
const workflow=read('workflow-v412.js');
const approval=read('management-approval-v448.js');
const stable=read('stable412.html');
const index=read('index.html');
const version=JSON.parse(read('version.json'));

for(const bad of ['ackIncident411','열람확인','열람 확인 저장','readReceipts','readerStatusHtml(']) assert.ok(!incidents.includes(bad),bad);
for(const bad of ['addAckSection(','recordView(','viewHistory(','사고보고 확인 기록','재발방지조치 확인 기록','최초 조회기록','readReceipts']) assert.ok(!flow.includes(bad),bad);
for(const bad of ['readReceipts','receiptFor(','열람 확인이 필요한 종결사고']) assert.ok(!reader.includes(bad),bad);
for(const x of ['4.4.45-two-stage-approval1','enl424-nav-count','safetyActionCounts','safetyOwnApprovalPending','closure_approval','incidentApproval','ownApproval','prevention','enlRefreshSafetyActionBadges']) assert.ok(reader.includes(x),x);
assert.ok(reader.includes('enl424-nav-dot'),'simple confirmation red-dot behavior must remain');
assert.ok(!stable.includes('reader-ack-ux-v423.js'));

for(const x of ['4.4.39-statutory-record1','법정 사고기록','근로자 인적사항','재해 발생 일시','재해 발생 장소','재해 발생 원인 및 과정','재해 재발방지 계획']) assert.ok(official.includes(x),x);
for(const bad of ['공식 사고기록 · 확인이력','사고보고 무결성 해시','최종 기록 해시','data-official439-audit','사고 변경·확인 감사로그','enlOfficialAuditOpen']) assert.ok(!official.includes(bad),bad);
assert.ok(official.includes('backup_restore'));
assert.ok(official.includes('공식기록 · 백업/복원'));

assert.ok(workflow.includes("4.4.39-comment-empty1"));
assert.ok(workflow.includes("target.innerHTML=list.length?list.map(c=>commentHtml(c,safety)).join(''):'<div class=\"wf412-empty\">-</div>'"));
assert.ok(!workflow.includes('의견을 불러오지 못했습니다.'));

for(const x of ['4.4.45-two-stage-approval1','closure_approval','1차 사고보고 결재','2차 종결결재','text-rendering:geometricPrecision','-webkit-font-smoothing:antialiased']) assert.ok(approval.includes(x),x);
assert.ok(!approval.includes('enl448OwnPulse'));
assert.ok(!approval.includes('transform:scale('));

for(const asset of [
  'incidents-v410.js?v=4.4.39-r1&amp;fix=no-read-confirm1',
  'reader-experience-v424.js?v=4.4.45-r1&amp;fix=two-stage-approval1',
  'workflow-v412.js?v=4.4.39-r1&amp;fix=comment-empty1',
  'official-records-v439.js?v=4.4.39-r1&amp;fix=statutory-record1',
  'incident-flow-v440.js?v=4.4.39-r1&amp;fix=no-confirm-history1',
  'management-approval-v448.js?v=4.4.45-r1&amp;fix=two-stage-approval1'
]) assert.ok(stable.includes(asset),asset);

assert.ok(stable.includes('content="4.4.45-r1"'));
assert.ok(index.includes("const BUILD='4445-r1'"));
assert.equal(version.version,'4.4.45');
assert.equal(version.build,'stable-4445-r1');
console.log('PASS: approval-only UX, statutory record view, dash-only empty opinions and audit-button removal');
