'use strict';
// Verify the existing authoritative pull removes invalidated imports without creating delete requests.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const clone=x=>structuredClone(x),u={id:'qa-safety',name:'격리 안전관리자',role:'safety',passwordHash:'qa-proof'};
const imported={id:'qa-bulk',siteId:'qa-site',status:'approved',updatedAt:'2026-01-01',historicalOrigin:{batchId:'qa-batch',candidateId:'qa-candidate'},externalInitialApproval:{state:'verified'}};
const normal={id:'qa-normal',siteId:'qa-site',status:'reported',updatedAt:'2026-01-01'};
let remote=[imported,normal],requests=[],busy=false;
const context={console,AbortController,Response,structuredClone,crypto,CustomEvent:class{},dispatchEvent(){},session:{manager:u},data:{incidents:clone(remote),users:[u]},currentUser:()=>u,saveData:()=>{},alert:()=>{},renderShell:()=>{},setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,addEventListener:()=>{},document:{querySelector:()=>busy?{}:null,activeElement:null,addEventListener:()=>{},visibilityState:'visible'},fetch:async(url,options)=>{
 const body=JSON.parse(options.body);requests.push(body);
 if(body.action==='pull')return new Response(JSON.stringify({ok:true,incidents:clone(remote)}));
 if(body.action==='push'){
  assert.deepEqual(body.deletedIds,[],'server invalidation must never be turned into client physical deletion');
  // The server ignores a stale invalidated import and preserves unrelated local edits.
  remote=remote.map(i=>body.incidents.find(x=>x.id===i.id)||i);
  return new Response(JSON.stringify({ok:true,pushed:remote.length,ignored:0,incidents:remote.filter(i=>body.incidents.some(x=>x.id===i.id))}));
 }
 throw Error('Unexpected request');
}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('incident-sync-v411.js','utf8'),context);
(async()=>{
 await context.enlIncidentPullNow();
 remote=[clone(normal)];
 await context.enlIncidentPullNow();
 assert.deepEqual(Array.from(context.data.incidents,i=>i.id),['qa-normal'],'ordinary authoritative refresh removes invalidated import');
 assert.equal(requests.filter(r=>r.action==='push').length,0);
 // Restore adds the same existing incident back to the normal list.
 remote=[{...clone(imported),updatedAt:'2026-01-02'},clone(normal)];await context.enlIncidentPullNow();
 assert.equal(context.data.incidents.length,2);
 // A pending unrelated edit must survive the invalidation refresh cycle.
 context.data.incidents.find(i=>i.id==='qa-normal').summary='가상 미전송 수정';context.saveData();remote=[clone(normal)];
 await context.enlIncidentPullNow();assert.equal(context.data.incidents.length,2,'dirty edits defer full replacement until sync');
 await context.enlIncidentSyncNow();
 assert.deepEqual(Array.from(context.data.incidents,i=>i.id),['qa-normal']);assert.equal(context.data.incidents[0].summary,'가상 미전송 수정');
 assert.ok(requests.some(r=>r.action==='push'&&r.incidents.some(i=>i.id==='qa-normal')),'genuine unsent changes reach the server');assert.ok(!requests.some(r=>r.action==='push'&&r.incidents.some(i=>i.id==='qa-bulk')),'unchanged archival records are not rewritten');
 console.log('PASS: authoritative cache removal/restore, no deletedIds, stale-import sync and unrelated unsent edits preserved');
})().catch(e=>{console.error(e);process.exit(1)});
