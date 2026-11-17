'use strict';
const {JSDOM}=require('jsdom'),assert=require('node:assert/strict'),fs=require('node:fs');
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{const dom=new JSDOM('<body><aside></aside></body>',{runScripts:'outside-only'}),w=dom.window;try{
 w.eval(fs.readFileSync('storage-usage.js','utf8'));const mount=w.ENLStorageUsage.mount,parent=w.document.querySelector('aside');let calls=0;
 const data={ok:true,fileBytes:3072,databaseBytes:1024,fileCount:3,unknownFiles:0,checkedAt:'2026-11-17T07:00:00Z'};
 const api=async()=>{calls++;return data};
 for(const role of ['field','manager','executive'])assert.equal(mount(parent,{id:role,role},api,()=>true),null);
 assert.equal(calls,0);
 const user={id:'safety-a',role:'safety'},a=mount(parent,user,api,()=>true);await tick();assert.match(a.textContent,/4 KB/);assert.equal(calls,1);
 assert.equal(a.querySelector('i').style.width,'75%');assert.match(a.querySelector('[role=img]').getAttribute('aria-label'),/구성/);
 const b=mount(parent,user,api,()=>true);await tick();assert.equal(calls,1,'cached remount');assert.match(b.textContent,/4 KB/);
 const failed=mount(parent,{id:'safety-b',role:'safety'},async()=>{throw Error('offline')},()=>true);await tick();assert.match(failed.textContent,/확인 필요/);assert.doesNotMatch(failed.textContent,/0 B/);
 let resolve,active=true;const stale=mount(parent,{id:'safety-c',role:'safety'},()=>new Promise(r=>resolve=r),()=>active);await tick();active=false;resolve(data);await tick();assert.doesNotMatch(stale.textContent,/4 KB/,'late response after user switch ignored');
 const unknown=mount(parent,{id:'safety-d',role:'safety'},async()=>({...data,unknownFiles:1}),()=>true);await tick();assert.match(unknown.textContent,/미확인/);
 console.log('PASS storage UI: role gate, totals/composition, cache, unavailable data and stale-response isolation');
}finally{w.close();}})().catch(e=>{console.error(e);process.exitCode=1});
