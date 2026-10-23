'use strict';
// Existing operator proof is read privately. Valid calls only read records.
// Negative mutation probes use missing input or nonexistent targets and cannot write.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const proof=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../private-secrets/backup_sign_proof.json'),'utf8'));
let passed=0;const checks=[];
const call=async(name,body)=>{const r=await fetch('https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/'+name,{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
const check=(r,status,label)=>{assert.equal(r.status,status,label);passed++;checks.push(label)};
(async()=>{
 const actor=proof.actor,wrong={actor,actorPasswordHash:'invalid-release-check'};
 for(const b of [{action:'hq_list',actor},{action:'hq_list',...wrong},{action:'hq_upsert',actor,user:{}},{action:'hq_upsert',...wrong,user:{}}])check(await call('enl-login-v411',b),403,'HQ ID-only/wrong-proof action denied');
 const listed=await call('enl-login-v411',{...proof,action:'hq_list'});check(listed,200,'valid safety read');
 assert.ok(Array.isArray(listed.body.users));assert.ok(!JSON.stringify(listed.body).match(/password_hash|passwordHash|pin_hash/));passed++;checks.push('HQ response omits credential fields');
 const own=listed.body.users.find(u=>u.id===actor.id);assert.ok(own);
 check(await call('enl-login-v411',{action:'login_hq',name:own.name,affiliationId:own.affiliationId,passwordHash:proof.actorPasswordHash}),200,'existing HQ login remains valid');
 const siteId='__release_readonly_no_site__';
 for(const endpoint of ['enl-login-v411','enl-personnel-v434']){
  check(await call(endpoint,{action:'personnel_pull',siteId,actor}),403,endpoint+' ID-only personnel denied');
  check(await call(endpoint,{action:'personnel_pull',siteId,...wrong}),403,endpoint+' wrong-proof personnel denied');
  check(await call(endpoint,{...proof,action:'personnel_pull',siteId}),200,endpoint+' valid safety personnel read');
 }
 check(await call('enl-personnel-v434',{action:'personnel_delete',personnelId:'__nonexistent_release_probe__',actor}),403,'personnel delete ID-only denied');
 check(await call('enl-personnel-v434',{action:'personnel_delete',personnelId:'__nonexistent_release_probe__',...wrong}),403,'personnel delete wrong proof denied');
 const result={passed,failed:0,productionWrites:0,hqUserCount:listed.body.users.length,checks};fs.writeFileSync('qa-output/auth-proof-production-readonly.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed,failed:0,productionWrites:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
