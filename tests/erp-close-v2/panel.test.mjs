import test from 'node:test';import assert from 'node:assert/strict';
import {controller,panelState} from '../../erp-close-v2/panel.mjs';import {fixture} from '../../erp-close-v2/fixtures.mjs';
test('request button is safety-only, enabled only after reviews, and no local closing control',()=>{
  const view={incident:fixture('qa-ui'),job:null};assert.equal(panelState(view,'safety').canRequest,true);
  for(const role of ['field','worker','manager','executive'])assert.equal(panelState(view,role).showRequest,false);
  for(const state of ['pending','status_unknown','submission_unknown','approved','rejected'])assert.equal(panelState({...view,job:{state}},'safety').canRequest,false);
});
test('double click sends once, refreshes from server, and network errors never close',async()=>{
  let count=0,release;let view={incident:fixture('qa-ui'),job:null};
  const c=controller({id:'qa-ui',role:'safety',transport:async b=>{if(b.action==='get')return structuredClone(view);count++;await new Promise(r=>release=r);view.job={state:'pending'};return {};}});
  await c.refresh();const first=c.request();assert.equal(await c.request(),false);release();await first;assert.equal(count,1);assert.equal(c.state().isClosed,false);assert.equal(c.state().label,'ERP 결재 진행 중');
  const error=controller({id:'qa-ui',role:'safety',transport:async()=>{throw Error('offline');}});await error.refresh();assert.equal(error.state().isClosed,false);assert.equal(error.state().canRequest,false);assert.ok(error.state().error);
});
