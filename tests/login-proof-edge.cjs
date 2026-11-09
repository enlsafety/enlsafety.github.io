'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{PGlite}=require('@electric-sql/pglite');
const safety={id:'qa-auth-safety-472',role:'safety'},field={id:'qa-auth-field-472',role:'field',siteId:'qa-auth-site-472'};
async function fixture(){
 const db=new PGlite();await db.exec(fs.readFileSync('tests/fixtures/login-proof-schema.sql','utf8'));await db.exec('create role anon;create role authenticated;create role service_role;create schema private;'+fs.readFileSync('supabase/migrations/20261104080927_platform_foundation.sql','utf8').split('create table private.enl_platform_catalog')[0]);await db.exec("update enl_hq_users set name='박태영' where user_id='qa-auth-safety-472'");
 await db.exec(fs.readFileSync('supabase/migrations/20261104091401_email_enrollment_gate.sql','utf8'));
 await db.exec("update enl_hq_users set name='QA 안전' where user_id='qa-auth-safety-472'");let handler;const mailbox=[];
 await db.exec('create table private.enl_platform_catalog(singleton boolean)');
 await db.exec(fs.readFileSync('supabase/migrations/20261105152600_email_challenge_sidebar.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261105160000_unique_account_email.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261109022811_joint_site_email_members.sql','utf8'));
 const tag=conn=>async(parts,...args)=>(await conn.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;const sql=tag(db);sql.begin=f=>db.transaction(tx=>f(tag(tx)));sql.json=JSON.stringify;sql.end=async()=>{};
 const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,Request,Response,TextEncoder,crypto,AbortSignal,fetch:async(url,opts)=>{
  if(url.endsWith('/senders'))return Response.json({senders:[{active:true,email:'qa@example.test'}]});
  const mail=JSON.parse(opts.body);mailbox.push({to:mail.to[0].email,code:mail.textContent.match(/\d{6}/)[0]});return Response.json({messageId:'isolated'});
 }};vm.createContext(ctx);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-login-v411/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),ctx);
 const call=async body=>{const response=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 return {db,call,mailbox};
}
(async()=>{const {db,call,mailbox}=await fixture();let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++};try{
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
 await db.exec("update enl_hq_users set email=user_id||'@example.test'; update enl_site_personnel set email=personnel_id||'@example.test'");
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
 await db.exec("update enl_hq_users set email=null;update enl_site_personnel set email=null");
 const reg={action:'email_code_send',name:'QA 안전',affiliationId:'dept:qa',accountKey:'hq:'+safety.id,passwordHash:'qa-auth-safety-proof-472',companyLocal:'qa.safety',registrationPassword:'registration-test-only'};
 const manage={action:'email_gate_set',actor:safety,actorPasswordHash:'qa-auth-safety-proof-472',newRegistrationPassword:reg.registrationPassword};
 check((await call({...reg,action:'login_hq'})).status===409,'old login cannot save an address');
 check((await call({...reg,action:'register_company_email'})).status===410,'retired registration cannot bypass OTP');
 await db.exec("insert into enl_hq_users(user_id,name,role,active,password_hash) values('other-safety','동료','safety',true,'proof')");
 check((await call({...manage,actor:{id:'other-safety',role:'safety'},actorPasswordHash:'proof'})).status===403,'other safety cannot configure gate');
 check((await call(manage)).status===200,'designated account sets separate gate');
 check((await call({...reg,passwordHash:'wrong'})).status===403,'own account protected');
 check((await call({...reg,companyLocal:'bad@example.com'})).status===400,'fixed email domain');
 check((await call(reg)).status===200&&mailbox.length===1,'deliver only to supplied mailbox');
 check((await call(reg)).status===429,'resend cooldown');
 const verify={...reg,action:'email_code_verify',code:mailbox[0].code};
 check((await call({...verify,companyLocal:'other'})).status===409,'code bound to address');
 check((await call({...verify,code:verify.code==='999999'?'111111':'999999'})).status===403,'wrong code denied');
 check((await call({...reg,action:'login_hq'})).body.message==='email_required','cannot skip enrollment');
 // An admin can assign the address to a site user between the send and confirm requests.
 await db.query('update enl_site_personnel set email=$1 where personnel_id=$2',[' QA.SAFETY@ENLIFE.CO.KR ',field.id]);
 check((await call(reg)).body.message==='email_in_use'&&mailbox.length===1,'duplicate request never sends mail');
 check((await call(verify)).body.message==='email_in_use','issued code cannot claim another owner');
 await assert.rejects(db.query('update enl_hq_users set email=$1 where user_id=$2',[mailbox[0].to,safety.id]),e=>e.code==='23505');
 await db.query("update enl_site_personnel set email='' where personnel_id=$1",[field.id]);
 check((await call(verify)).body.email===mailbox[0].to,'verified email persisted');
 check((await call(verify)).status===409,'consumed challenge rejected');
 check((await db.query("select email from private.enl_master_accounts where id=$1",[safety.id])).rows[0].email===mailbox[0].to,'master reflects registration');
 const fieldReg={...reg,name:'QA 현장',accountKey:'site:'+field.id,affiliationId:'site:'+field.siteId,passwordHash:'qa-auth-field-proof-472',companyLocal:'qa.field'};
 check((await call({...fieldReg,affiliationId:'site:wrong'})).status===403,'site is fixed');
 check((await call(fieldReg)).status===200,'field can request OTP');
 await db.exec("update private.enl_email_challenges set expires_at=now()-interval '1 minute'");
 check((await call({...fieldReg,action:'email_code_verify',code:mailbox.at(-1).code})).body.message==='code_expired','expiry enforced');
 const workerReg={...fieldReg,name:'QA 근로자',accountKey:'site:'+worker.personnelId,passwordHash:'',companyLocal:'qa.worker'};
 check((await call({...workerReg,registrationPassword:''})).status===403,'passwordless worker needs enrollment proof');
 check((await call(workerReg)).status===200,'worker can receive OTP');
 check((await call({...workerReg,action:'email_code_verify',code:mailbox.at(-1).code})).status===200,'worker code verified');
 await db.query("insert into enl_site_personnel(personnel_id,site_id,name,access_role,active) values('qa-double','other-site','QA 안전','worker',true)");
 const duplicate=await call({action:'lookup',name:'QA 안전',fixedAccount:true});check(duplicate.body.ambiguous&&duplicate.body.options.length===0,'no arbitrary site list for ambiguous names');
 check((await call({action:'lookup',name:'QA 안전',fixedAccount:true,knownEmail:'qa.safety@enlife.co.kr'})).body.options[0].accountKey==='hq:'+safety.id,'same-name resolution');
 // One confirmed person can work at two sites, without releasing the address to third parties.
 const shared='joint@enlife.co.kr';
 await db.query("insert into private.enl_account_email_owners values($1,'joint:'||$1)",[shared]);
 for(const [id,site] of [['joint-a','site-a'],['joint-b','site-b']]){
  await db.query("insert into private.enl_joint_site_email_members values('site:'||$1,$2)",[id,shared]);
  await db.query("insert into enl_site_personnel(personnel_id,site_id,name,job_title,access_role,active,email,pin_hash) values($1,$2,'QA 겸임','현장소장','field',true,$3,'synthetic-proof')",[id,site,shared]);
 }
 const lookup={action:'lookup',name:'QA 겸임',fixedAccount:true};
 check((await call(lookup)).body.jointSites.length===2,'joint site chooser');
 for(const [id,site] of [['joint-a','site-a'],['joint-b','site-b']]){
  const choice=await call({...lookup,accountKey:'site:'+id});
  check(choice.body.options.length===1&&choice.body.options[0].siteId===site,'select specific joint site');
  const login={action:'login_site',name:lookup.name,accountKey:'site:'+id,siteId:site,passwordHash:'synthetic-proof'};
  check((await call(login)).body.person.site_id===site,'scoped joint login');
  check((await call({...login,passwordHash:'wrong'})).status===401,'wrong joint site password');
 }
 await assert.rejects(db.query("update enl_hq_users set email=$1 where user_id=$2",[shared,safety.id]),e=>e.code==='23505');
 await db.query("update enl_site_personnel set pin_hash='worker-synthetic' where personnel_id=$1",[worker.personnelId]);
 await db.query("update enl_site_personnel set pin_hash=null where personnel_id=$1",[worker.personnelId]);
 const workerLogin={action:'login_site',name:worker.name,siteId:worker.siteId,accountKey:'site:'+worker.personnelId};
 check((await call(workerLogin)).status===401,'worker with an assigned password cannot skip it');
 check((await call({...workerLogin,passwordHash:'worker-synthetic'})).body.person.access_role==='worker','worker password login');
 for(const id of ['joint-a','joint-b'])await db.query("delete from enl_site_personnel where personnel_id=$1",[id]);
 check(!(await db.query("select 1 from private.enl_account_email_owners where address=$1",[shared])).rows.length,'last joint membership releases address');
 // Retired scripts execute without touching browser account data or emitting credentials.
 const before={users:[{id:'existing',passwordHash:'user-chosen-proof'}],incidents:[{id:'saved'}]};const ctx={window:{},data:before,localStorage:{getItem(){throw Error('seed accessed storage')},setItem(){throw Error('seed wrote storage')}}};vm.createContext(ctx);
 for(const file of ['account-admin-v21.js','site-accounts-v340.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 assert.deepEqual(before,{users:[{id:'existing',passwordHash:'user-chosen-proof'}],incidents:[{id:'saved'}]});checks++;
 check(!fs.readFileSync('stable412.html','utf8').includes('account-admin-v21.js')&&!fs.readFileSync('stable412.html','utf8').includes('site-accounts-v340.js'),'current production entry does not depend on retired seeds');
 console.log(JSON.stringify({suite:'login-proof-edge',passed:checks,failed:0,productionWrites:0}));
}finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
