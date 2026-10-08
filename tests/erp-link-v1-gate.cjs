/* No network or live browser: verify the feature's off-by-default boundary. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../erp-link-v1.js'), 'utf8');
const model = require('../erp-link-model-v1.js');

test('An absent, false, or string flag cannot read account data or touch the page',()=>{
  for(const config of [undefined,{}, {enabled:false}, {enabled:'true'}, {registryEnabled:true}]) {
    const original=()=>{};
    const fail=()=>{throw new Error('Unexpected side effect while disabled');};
    const win={ENLErpLinkModel:model,ENL_ERP_LINK_CONFIG:config,openIncidentModal:original};
    vm.runInNewContext(source,{
      window:win,document:new Proxy({}, {get:fail}),currentUser:fail,
      fetch:fail,setTimeout:fail,MutationObserver:fail
    });
    assert.equal(win.openIncidentModal,original);
    assert.equal(win.ENL_ERP_LINK_VERSION,undefined);
  }
});

test('Handoff-only preview refuses registry calls before reading identity or credentials',async()=>{
  // Expose only this closure entry for the contract test; production exports no caller.
  const instrumented=source.replace('  function user()','  __test.request = request;\n  function user()');
  assert.notEqual(instrumented,source);
  const fail=()=>{throw new Error('Unexpected account/network access');};
  const probe={};
  vm.runInNewContext(instrumented,{
    __test:probe,
    window:{ENLErpLinkModel:model,ENL_ERP_LINK_CONFIG:{enabled:true}},
    document:{addEventListener(){},getElementById(){return null;}},
    currentUser:fail,fetch:fail,setTimeout:fail
  });
  for(const action of ['get','save']) {
    await assert.rejects(probe.request(action,'qa-only-001'),/registry_disabled/);
  }
});
