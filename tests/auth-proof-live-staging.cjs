'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const token=fs.readFileSync(path.resolve(__dirname,'../../private-secrets/auth-proof-staging/token.txt'),'utf8').trim();
const endpoint='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-auth-proof-qa-v472';
const safety={id:'qa-auth-safety-472',role:'safety'},field={id:'qa-auth-field-472',role:'field',siteId:'qa-auth-site-472'};
let passed=0,created=false,cleaned=false;const checks=[];
async function call(action,payload,wrong=false){const r=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(60000),headers:{'content-type':'application/json','x-enl-qa-token':wrong?'0'.repeat(64):token},body:JSON.stringify({action,...(payload?{payload}:{})})});return {status:r.status,body:await r.json()};}
const check=(r,status,label)=>{assert.equal(r.status,status,label+': '+JSON.stringify(r.body));passed++;checks.push(label)};
(async()=>{try{
 check(await call('setup',null,true),403,'test endpoint requires private gate');
 check(await call('setup'),200,'isolated five-table setup');created=true;
 check(await call('login',{action:'login_hq',name:'QA 안전',affiliationId:'dept:qa',passwordHash:'qa-auth-safety-proof-472'}),200,'normal HQ login');
 check(await call('login',{action:'login_hq',name:'QA 안전',affiliationId:'dept:qa',passwordHash:'wrong'}),401,'invalid HQ password');
 check(await call('login',{action:'login_site',name:'QA 현장',siteId:field.siteId,passwordHash:'qa-auth-field-proof-472'}),200,'normal field login');
 check(await call('login',{action:'hq_list',actor:safety}),403,'HQ list ID-only denied');
 check(await call('login',{action:'hq_list',actor:safety,actorPasswordHash:'wrong'}),403,'HQ list wrong proof denied');
 check(await call('login',{action:'hq_list',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472'}),200,'HQ list valid proof');
 const user={id:'qa-auth-target-472',name:'QA 신규',role:'manager',department:'QA',passwordHash:'qa-auth-target-proof-472'};
 check(await call('login',{action:'hq_upsert',actor:safety,user}),403,'HQ mutation ID-only denied');
 check(await call('login',{action:'hq_upsert',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472',user}),200,'verified synthetic HQ creation');
 for(const route of ['login','personnel']){
  const person={personnelId:'qa-auth-worker-472',siteId:field.siteId,name:'QA 근로자',jobTitle:'일반근로자',accessRole:'worker'};
  for(const payload of [{action:'personnel_pull',siteId:field.siteId},{action:'personnel_upsert',person}]){
   check(await call(route,{...payload,actor:field}),403,route+' ID-only denied '+payload.action);
   check(await call(route,{...payload,actor:field,actorPinHash:'wrong'}),403,route+' wrong proof denied '+payload.action);
   check(await call(route,{...payload,actor:field,actorPinHash:'qa-auth-field-proof-472'}),200,route+' normal field '+payload.action);
  }
  check(await call(route,{action:'personnel_pull',siteId:'other-site',actor:field,actorPinHash:'qa-auth-field-proof-472'}),403,route+' cross-site denied');
  check(await call(route,{action:'personnel_pull',siteId:field.siteId,actor:safety,actorPasswordHash:'qa-auth-safety-proof-472'}),200,route+' valid safety personnel read');
 }
 check(await call('personnel',{action:'personnel_delete',personnelId:'qa-auth-worker-472',actor:field}),403,'delete ID-only denied');
 check(await call('personnel',{action:'personnel_delete',personnelId:'qa-auth-worker-472',actor:field,actorPinHash:'wrong'}),403,'delete wrong proof denied');
 check(await call('personnel',{action:'personnel_delete',personnelId:'qa-auth-worker-472',actor:field,actorPinHash:'qa-auth-field-proof-472'}),200,'verified synthetic worker delete');
 }finally{if(created){const r=await call('cleanup');check(r,200,'only five synthetic tables cleaned');cleaned=true;}}
 const result={passed,failed:0,project:'zgwxzfvvpqgdedyobwmg',productionWrites:0,syntheticTablesRemoved:cleaned?5:0,checks};fs.writeFileSync('qa-output/auth-proof-live-staging.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1});
