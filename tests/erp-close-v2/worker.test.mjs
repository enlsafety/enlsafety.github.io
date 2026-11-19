import test from 'node:test';import assert from 'node:assert/strict';import {runOnce} from '../../erp-close-v2/worker.mjs';
test('runner uses due work, requires no browser and stops on transport failure',async()=>{
  const calls=[];const result=await runOnce(async b=>{calls.push(b);return b.action==='due'?{caseIds:['qa-one','qa-two']}:{job:{state:'pending'}};});
  assert.deepEqual(calls.map(x=>x.action),['due','step','step']);assert.equal(result.length,2);
  await assert.rejects(runOnce(async()=>{throw Error('unauthorized');}),/unauthorized/);
});
