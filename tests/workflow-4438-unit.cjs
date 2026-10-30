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

assert.ok(!shell.includes('승인완료 사고 결재가 필요합니다.'));assert.ok(!shell.includes('결재하러 가기'));assert.ok(shell.includes('재발방지계획 수립대기'));

for(const x of [
  "preventionPlanMissing",
  "enlRefreshSafetyActionBadges",
  "existing=btn.querySelector('.prev429-nav-alert')",
  "btn.classList.remove('prev429-nav-attention')",
  "window.enlRefreshSafetyActionBadges?.()",
  "재발방지 관리"
]) assert.ok(prevention.includes(x),x);

assert.ok(workflow.includes("4.4.39-comment-empty1"));
assert.ok(workflow.includes('id="wf412CommentBody"'));
assert.ok(workflow.includes('data-enl-optional="1"'));
assert.ok(!workflow.includes('id="wf412CommentBody" maxlength="2000" required'));

assert.ok(approval.includes('과거 결재기록 (읽기 전용)'));assert.ok(!approval.includes('data-enl448-sign'));

for(const x of ["4.4.38-test-hq-cleanup1","테스트 경영진","테스트 관리자","테스트 안전관리자","acknowledgements","readReceipts"]) assert.ok(cleanup.includes(x),x);
for(const x of ["4.7.3-r2-demo-suspended","remote=Array.isArray(r.users)?r.users:[]","ids.has(String(v.id||''))"]) assert.ok(auth.includes(x),x);

console.log('PASS: unified safety action badge wiring, HQ approval attention, optional opinion, own-sign highlight and stale test cleanup');
