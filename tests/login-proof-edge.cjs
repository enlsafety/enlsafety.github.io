'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{PGlite}=require('@electric-sql/pglite');
const safety={id:'qa-auth-safety-472',role:'safety'},field={id:'qa-auth-field-472',role:'field',siteId:'qa-auth-site-472'};
async function fixture(){
 const db=new PGlite();await db.exec(fs.readFileSync('tests/fixtures/login-proof-schema.sql','utf8'));await db.exec('create schema private;'+fs.readFileSync('supabase/migrations/20261104080927_platform_foundation.sql','utf8').split('create table private.enl_platform_catalog')[0]);let handler;
 const sql=async(parts,...args)=>(await db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;sql.json=JSON.stringify;sql.end=async()=>{};
 const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,Request,Response,TextEncoder,crypto};vm.createContext(ctx);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-login-v411/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),ctx);
 const call=async body=>{const response=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 return {db,call};
}
(async()=>{const {db,call}=await fixture();let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++};try{
 const hqTarget={duties:['safety','supervisor'],id:'qa-auth-target-472',name:'QA 변경대상',role:'manager',department:'QA',passwordHash:'qa-auth-target-proof-472'};
 const worker={personnelId:'qa-auth-worker-472',siteId:field.siteId,name:'QA 근로자',jobTitle:'일반근로자',accessRole:'worker',active:true};
 for(const body of [
  {action:'hq_list',actor:safety},
  {action:'hq_upsert',actor:safety,user:hqTarget},
  {action:'personnel_pull',actor:field,siteId:field.siteId},
  {action:'personnel_upsert',actor:field,person:worker},
  {action:'personnel_upsert',actor:safety,person:worker}
 ]){check((await call(body)).status===403,'ID-only request denied');check((await call({...body,actorPasswordHash:'incorrect',actorPinHash:'incorrect'})).status===403,'wrong proof denied');}
 check((await db.query('select count(*) n from public.enl_hq_users')).rows[0].n===2,'denied HQ creation has no writes');
 check((await db.query('select count(*) n from public.enl_personnel_audit')).rows[0].n===0,'denied personnel actions have no audit writes');
 let r=await call({action:'login_hq',name:'QA 안전',affiliationId:'dept:qa',passwordHash:'qa-auth-safety-proof-472'});check(r.status===200&&r.body.user.id===safety.id,'normal HQ login unchanged');check(!('password_hash' in r.body.user)&&!('passwordHash' in r.body.user),'login never returns credential hash');
 check((await call({action:'login_hq',name:'QA 안전',affiliationId:'dept:qa',passwordHash:'incorrect'})).status===401,'wrong login password denied');
 r=await call({action:'login_site',name:'QA 현장',siteId:field.siteId,passwordHash:'qa-auth-field-proof-472'});check(r.status===200&&r.body.person.access_role==='field','normal field login unchanged');
 check((await call({action:'login_site',name:'QA 근로자',siteId:field.siteId})).status===200,'existing worker login unchanged');
 r=await call({action:'lookup',name:'QA 안전'});check(r.status===200&&r.body.options.length===1,'public affiliation lookup unchanged');
 r=await call({action:'hq_list',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472'});check(r.status===200&&r.body.users.length===2,'valid active safety can list HQ');
 r=await call({action:'hq_upsert',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472',user:hqTarget});check(r.status===200&&r.body.user.id===hqTarget.id,'valid active safety can manage synthetic HQ');check((await db.query("select count(*) n from private.enl_duty_assignments where ended_at is null")).rows[0].n===2,'HQ multiselect stored separately');
 check((await call({action:'hq_list',actor:{id:'qa-auth-manager-472',role:'safety'},actorPasswordHash:'qa-auth-manager-proof-472'})).status===403,'stored role blocks safety impersonation');
 check((await call({action:'hq_list',actor:{...safety,role:'manager'},actorPasswordHash:'qa-auth-safety-proof-472'})).status===403,'claimed role must match safety');
 for(const active of [false,null]){await db.query('update public.enl_hq_users set active=$1 where user_id=$2',[active,safety.id]);check((await call({action:'hq_list',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472'})).status===403,'inactive/null safety denied');}
 await db.query('update public.enl_hq_users set active=true where user_id=$1',[safety.id]);
 r=await call({action:'personnel_pull',actor:field,actorPinHash:'qa-auth-field-proof-472',siteId:field.siteId});check(r.status===200&&r.body.personnel.length===2,'valid field can read own site');
 check((await call({action:'personnel_pull',actor:{...field,siteId:'qa-other-site'},actorPinHash:'qa-auth-field-proof-472',siteId:field.siteId})).status===403,'claimed site mismatch denied');
 check((await call({action:'personnel_pull',actor:field,actorPinHash:'qa-auth-field-proof-472',siteId:'qa-other-site'})).status===403,'other requested site denied');
 check((await call({action:'personnel_upsert',actor:field,actorPinHash:'qa-auth-field-proof-472',person:{...worker,jobTitle:'파트장',accessRole:'field'}})).status===403,'field cannot assign privileged roles');
 r=await call({action:'personnel_upsert',actor:field,actorPinHash:'qa-auth-field-proof-472',person:worker});check(r.status===200&&r.body.person.personnel_id===worker.personnelId,'verified field can edit own-site worker');
 check((await db.query('select editor_id from public.enl_personnel_audit')).rows[0].editor_id===field.id,'audit uses server-verified identity');
 for(const active of [false,null]){await db.query('update public.enl_site_personnel set active=$1 where personnel_id=$2',[active,field.id]);check((await call({action:'personnel_pull',actor:field,actorPinHash:'qa-auth-field-proof-472',siteId:field.siteId})).status===403,'inactive/null field denied');}
 await db.query('update public.enl_site_personnel set active=true where personnel_id=$1',[field.id]);
 check((await call({action:'personnel_pull',actor:{id:worker.personnelId,role:'field',siteId:field.siteId},actorPinHash:'qa-auth-field-proof-472',siteId:field.siteId})).status===403,'worker ID cannot impersonate field account');
 const hqLogin={action:'login_hq',name:'QA 안전',affiliationId:'dept:qa',accountKey:'hq:'+safety.id,passwordHash:'qa-auth-safety-proof-472',companyLocal:'qa.safety'};
 check((await call({...hqLogin,passwordHash:'wrong'})).status===401,'email enrollment requires valid credentials');
 check((await call(hqLogin)).body.user.email==='qa.safety@enlife.co.kr','enroll corporate email');
 check((await call({...hqLogin,companyLocal:'new-address'})).status===409,'login cannot replace an existing email');
 check((await call({...hqLogin,companyLocal:'q@external.test'})).status===400,'server checks fixed domain');
 check((await call({action:'lookup',name:'QA 안전',fixedAccount:true})).body.options[0].companyLocal==='qa.safety','return saved corporate address');
 const fieldLogin={action:'login_site',name:'QA 현장',siteId:field.siteId,accountKey:'site:'+field.id,passwordHash:'qa-auth-field-proof-472',companyLocal:'qa.field'};
 check((await call(fieldLogin)).body.person.email==='qa.field@enlife.co.kr','site-bound email enrollment');
 check((await call({...fieldLogin,siteId:'different-site'})).status===403,'site cannot be substituted');
 check((await call({action:'login_site',name:'QA 근로자',siteId:field.siteId,companyLocal:'other'})).status===403,'name-only session cannot enroll mail');
 const issue={action:'email_registration_code',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472',personnelId:worker.personnelId,siteId:field.siteId};
 check((await call({...issue,actor:field})).status===403,'enrollment codes issued only by safety manager');
 const issued=await call(issue);check(issued.status===200,'account-bound worker enrollment code issued');
 const enroll={action:'login_site',name:'QA 근로자',siteId:field.siteId,companyLocal:'worker.first',registrationCode:issued.body.code};
 check((await call(enroll)).body.person.email==='worker.first@enlife.co.kr','worker can register at login with own code');
 check((await call({...enroll,companyLocal:'overwrite'})).status===409,'code cannot overwrite saved address');
 await db.query("insert into enl_site_personnel(personnel_id,site_id,name,access_role,active) values('qa-double','other-site','QA 안전','worker',true)");
 const duplicate=await call({action:'lookup',name:'QA 안전',fixedAccount:true});check(duplicate.body.ambiguous&&duplicate.body.options.length===0,'no arbitrary site list for ambiguous names');
 check((await call({action:'lookup',name:'QA 안전',fixedAccount:true,knownEmail:'qa.safety@enlife.co.kr'})).body.options[0].accountKey==='hq:'+safety.id,'same-name resolution');
 // Retired scripts execute without touching browser account data or emitting credentials.
 const before={users:[{id:'existing',passwordHash:'user-chosen-proof'}],incidents:[{id:'saved'}]};const ctx={window:{},data:before,localStorage:{getItem(){throw Error('seed accessed storage')},setItem(){throw Error('seed wrote storage')}}};vm.createContext(ctx);
 for(const file of ['account-admin-v21.js','site-accounts-v340.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 assert.deepEqual(before,{users:[{id:'existing',passwordHash:'user-chosen-proof'}],incidents:[{id:'saved'}]});checks++;
 check(!fs.readFileSync('stable412.html','utf8').includes('account-admin-v21.js')&&!fs.readFileSync('stable412.html','utf8').includes('site-accounts-v340.js'),'current production entry does not depend on retired seeds');
 console.log(JSON.stringify({suite:'login-proof-edge',passed:checks,failed:0,productionWrites:0}));
}finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
