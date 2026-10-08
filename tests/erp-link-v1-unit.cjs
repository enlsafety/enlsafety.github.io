/* node --test tests/erp-link-v1-unit.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../erp-link-model-v1.js');

const closed = {
  id:'inc-2026-101',siteId:'site-golf-1',occurredAt:'2026-10-07T14:20:00+09:00',
  category:'person',status:'closed',corrective:{status:'approved'},
  injuredName:'홍길동',reportDetails:{diagnosis:'개인진단정보'}
};
const safety = {role:'safety'}, manager = {role:'manager'}, field = {role:'field'};

test('Only safety manager can hand off approved corrective closed incident',()=>{
  assert.equal(m.canUse(closed,safety),true);
  assert.equal(m.canUse(closed,manager),false);
  assert.equal(m.canUse(closed,field),false);
  assert.equal(m.canUse(closed,null),false);
});
test('Pending, approved but not closed, and closed without corrective approval are rejected',()=>{
  for(const [status,action] of [['reported','approved'],['approved','approved'],['closed','submitted'],['closed',null]]){
    assert.equal(m.canUse({...closed,status,corrective:{status:action}},safety),false);
  }
});
test('Previously approved historical ERP transfers must not re-export',()=>{
  assert.equal(m.canUse({...closed,recordMode:'historical_transfer'},safety),false);
  assert.equal(m.canUse({...closed,historicalTransfer:{mode:'historical_transfer'}},safety),false);
  assert.equal(m.canUse({...closed,historicalImport:{enabled:true,erpApproved:true}},safety),false);
});
test('ERP document reference input is bounded and rejects controls/markup',()=>{
  assert.equal(m.documentNumber(' 2026-안전-113 '),'2026-안전-113');
  assert.equal(m.documentNumber(''),null);
  assert.equal(m.documentNumber('x'.repeat(81)),null);
  assert.equal(m.documentNumber('ABC\n123'),null);
  assert.equal(m.documentNumber('<script>'),null);
});
test('Statuses explicitly require a manual ERP receipt or ERP approval record',()=>{
  assert.equal(m.validStatus('submitted'),true);
  assert.equal(m.validStatus('approved'),true);
  assert.equal(m.validStatus('draft'),false);
  assert.equal(m.validStatus(''),false);
});
test('ERP summary excludes injured name and all sensitive/free-text information',()=>{
  const msg = m.summary(closed,'A 골프장');
  assert.ok(msg.includes('inc-2026-101'));
  assert.ok(msg.includes('A 골프장'));
  assert.ok(!msg.includes('홍길동'));
  assert.ok(!msg.includes('개인진단정보'));
  assert.ok(!msg.includes('undefined'));
});
test('No summary generated for non-final or historical records',()=>{
  assert.equal(m.summary({...closed,status:'approved'},'A 골프장'),'');
  assert.equal(m.summary({...closed,recordMode:'historical_transfer'},'A 골프장'),'');
});
