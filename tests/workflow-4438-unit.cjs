const fs=require('node:fs'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');

const shell=read('app-shell-v411.js');
const prevention=read('workflow-prevention-v429.js');
const workflow=read('workflow-v412.js');
const approval=read('management-approval-v448.js');
const cleanup=read('production-cleanup-v431.js');
const auth=read('auth-v411.js');
const stable=read('stable412.html');
const index=read('index.html');
const version=JSON.parse(read('version.json'));

for(const x of [
  "4.4.38-hq-attention1",
  "approvalPendingIncidents",
  "승인완료 사고 결재가 필요합니다.",
  "결재하러 가기",
  "shell411-approval-alert",
  "재발방지계획 수립대기"
]) assert.ok(shell.includes(x),x);

for(const x of [
  "4.4.43-safety-action-counts1",
  "preventionPlanMissing",
  "enlRefreshSafetyActionBadges",
  "기존 계획대기 전용 숫자/강조는 제거",
  "재발방지 관리"
]) assert.ok(prevention.includes(x),x);

assert.ok(workflow.includes("4.4.39-comment-empty1"));
assert.ok(workflow.includes('id="wf412CommentBody"'));
assert.ok(workflow.includes('data-enl-optional="1"'));
assert.ok(!workflow.includes('id="wf412CommentBody" maxlength="2000" required'));

for(const x of [
  "4.4.39-crisp-sign1",
  "legacyTestPerson",
  "serverOk=true",
  "aria-label=\"본인 결재하기\"",
  "enl448-own-guide",
  "본인 이름이 표시된 빨간 결재칸"
]) assert.ok(approval.includes(x),x);
assert.ok(approval.includes("list.map(function(x){return Object.assign({},local.get(x.id)||{},x)})"));
assert.ok(!approval.includes("var m=new Map(localRoster().map"));

for(const x of ["4.4.38-test-hq-cleanup1","테스트 경영진","테스트 관리자","테스트 안전관리자","acknowledgements","readReceipts"]) assert.ok(cleanup.includes(x),x);
for(const x of ["4.4.38-hq-cache-prune1","remote=Array.isArray(r.users)?r.users:[]","ids.has(String(v.id||''))"]) assert.ok(auth.includes(x),x);

for(const asset of [
  'auth-v411.js?v=4.4.38-r1&amp;fix=hq-cache-prune1',
  'app-shell-v411.js?v=4.4.38-r1&amp;fix=hq-attention1',
  'workflow-v412.js?v=4.4.39-r1&amp;fix=comment-empty1',
  'workflow-prevention-v429.js?v=4.4.43-r1&amp;fix=safety-action-counts1',
  'production-cleanup-v431.js?v=4.4.38-r1&amp;fix=test-hq-cleanup1',
  'management-approval-v448.js?v=4.4.39-r1&amp;fix=crisp-sign1'
]) assert.ok(stable.includes(asset),asset);

assert.ok(stable.includes('content="4.4.43-r1"'));
assert.ok(index.includes("const BUILD='4443-r1'"));
assert.equal(version.version,'4.4.43');
assert.equal(version.build,'stable-4443-r1');
console.log('PASS: unified safety action badge wiring, HQ approval attention, optional opinion, own-sign highlight and stale test cleanup');
