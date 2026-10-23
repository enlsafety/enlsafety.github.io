'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();await db.exec(fs.readFileSync('tests/fixtures/login-proof-schema.sql','utf8'));let handler,passed=0;
 const sql=async(parts,...args)=>(await db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;sql.end=async()=>{};
 const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,Request,Response,TextEncoder,crypto};vm.createContext(ctx);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-personnel-v434/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),ctx);
 const call=async b=>{const r=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify(b)}));return {status:r.status,body:await r.json()};};
 const check=(v,label)=>{assert.ok(v,label);passed++},safety={id:'qa-auth-safety-472',role:'safety'},field={id:'qa-auth-field-472',role:'field',siteId:'qa-auth-site-472'};
 const worker={personnelId:'qa-auth-worker-472',siteId:field.siteId,name:'QA 근로자',jobTitle:'일반근로자',accessRole:'worker'};
 try{
 for(const actor of [safety,field])for(const b of [{action:'personnel_pull',siteId:field.siteId},{action:'personnel_upsert',person:worker},{action:'personnel_delete',personnelId:worker.personnelId}]){
  check((await call({...b,actor})).status===403,'ID-only action denied');check((await call({...b,actor,actorPasswordHash:'wrong',actorPinHash:'wrong'})).status===403,'wrong proof denied');
 }
 check((await db.query('select count(*) n from public.enl_site_personnel')).rows[0].n===2,'denied mutations preserve people');
 check((await db.query('select count(*) n from public.enl_personnel_audit')).rows[0].n===0,'denied mutations produce no audit');
 for(const actor of [safety,field])check((await call({action:'personnel_pull',siteId:field.siteId,actor,actorPasswordHash:'qa-auth-safety-proof-472',actorPinHash:'qa-auth-field-proof-472'})).status===200,'valid role can read own scope');
 check((await call({action:'personnel_pull',siteId:'other-site',actor:field,actorPinHash:'qa-auth-field-proof-472'})).status===403,'cross-site denied');
 check((await call({action:'personnel_pull',siteId:field.siteId,actor:{...field,siteId:'other-site'},actorPinHash:'qa-auth-field-proof-472'})).status===403,'claimed site mismatch denied');
 check((await call({action:'personnel_pull',siteId:field.siteId,actor:{id:'qa-auth-manager-472',role:'safety'},actorPasswordHash:'qa-auth-manager-proof-472'})).status===403,'stored role blocks impersonation');
 for(const active of [false,null]){await db.query('update public.enl_hq_users set active=$1 where user_id=$2',[active,safety.id]);check((await call({action:'personnel_pull',siteId:field.siteId,actor:safety,actorPasswordHash:'qa-auth-safety-proof-472'})).status===403,'inactive/null safety denied');}
 await db.query('update public.enl_hq_users set active=true where user_id=$1',[safety.id]);
 check((await call({action:'personnel_upsert',person:{...worker,accessRole:'field',jobTitle:'파트장'},actor:field,actorPinHash:'qa-auth-field-proof-472'})).status===403,'field cannot grant field role');
 const edited=await call({action:'personnel_upsert',person:worker,actor:field,actorPinHash:'qa-auth-field-proof-472'});check(edited.status===200,'valid field edits worker');check(!('pin_hash' in edited.body.person),'response omits credential');
 check((await db.query('select editor_id from public.enl_personnel_audit')).rows[0].editor_id===field.id,'audit uses verified identity');
 check((await call({action:'personnel_delete',personnelId:worker.personnelId,actor:field,actorPinHash:'qa-auth-field-proof-472'})).status===200,'verified field deletes synthetic own-site worker');
 check((await db.query('select count(*) n from public.enl_site_personnel')).rows[0].n===1,'only target worker removed');
 console.log(JSON.stringify({suite:'personnel-proof-edge',passed,failed:0,productionWrites:0}));
 }finally{await db.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
