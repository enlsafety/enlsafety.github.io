'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture(),sent=[];try{
await f.db.exec(fs.readFileSync('supabase/migrations/20261030004902_executive_closure.sql','utf8'));
await f.db.exec(`alter table enl_hq_users add column email text,add column email_enabled boolean default true;alter table enl_site_personnel add column email text,add column email_enabled boolean default true;
update enl_hq_users set email=user_id||'@example.invalid';
alter table enl_email_events add column created_at timestamptz default now(),add column sent_at timestamptz,add column last_error text,add column dead_at timestamptz,add column processing_token text,add column processing_at timestamptz,add column attempt_count int default 1;
create function enl_email_claim_events(text,int) returns setof enl_email_events language sql as $$select * from enl_email_events where sent_at is null$$;
insert into enl_incident_shared(incident_id,site_id,payload) values('qa-mail','qa-site','{"id":"qa-mail","status":"approved","category":"property","executiveApproval":{"state":"pending","round":2,"stage":"president","roster":[{"id":"qa-executive","position":"사장"}],"signatures":[]}}');`);
// Build delivery events directly so the dispatcher must also enforce recipient policy.
for(const [who,kind,round,key] of [['manager','incident_new',0,'staff-new'],['manager','incident_closed',0,'staff-close'],['manager','executive_approval_requested',2,'staff-request'],['executive','incident_new',0,'exec-new'],['executive','incident_closed',0,'exec-close'],['executive','executive_approval_requested',1,'exec-old'],['executive','executive_approval_requested',2,'exec-request']]){
const row=(await f.db.query('insert into enl_push_events(event_key,incident_id,site_id,user_id,kind,data) values($1,$2,$3,$4,$5,$6) returning id',[key,'qa-mail','qa-site','qa-'+who,kind,JSON.stringify({approvalRound:round})])).rows[0];
// The existing email trigger already creates these rows.
assert.ok(row.id);
}
const sql=async(parts,...args)=>(await f.db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;
const ctx={Deno:{env:{get:()=> 'qa-only'},serve(){}},postgres:()=>sql,Request,Response,crypto,console,fetch:async(url,init)=>{if(url.endsWith('/senders'))return new Response(JSON.stringify({senders:[{id:1,active:true,name:'이앤엘 사고보고',email:'qa@example.invalid'}]}));assert.ok(url.endsWith('/smtp/email'));sent.push(JSON.parse(init.body));return new Response(JSON.stringify({messageId:'qa-only'}));}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('executive-approval-v482.js','utf8'),ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-email-v441/index.ts','utf8').replace(/^import .*;\r?\n/gm,''))+';globalThis.flushMail=flush;',ctx);
const result=await ctx.flushMail(sql);assert.equal(result.sent,4);assert.equal(result.failed,0);assert.equal(sent.filter(x=>x.to[0].email==='qa-manager@example.invalid').length,2);assert.equal(sent.filter(x=>x.to[0].email==='qa-executive@example.invalid').length,2);assert.equal(sent.filter(x=>x.subject.includes('사장 최종결재 요청')).length,1);
const events=(await f.db.query('select event_key,last_error from enl_email_events')).rows;
for(const key of ['staff-request','exec-close'])assert.equal(events.find(x=>x.event_key==='email:'+key).last_error,'role_event_policy');assert.equal(events.find(x=>x.event_key==='email:exec-old').last_error,'approval_no_longer_required');
await f.db.exec(`insert into enl_hq_users(user_id,name,role,position,active,email) values('qa-other','QA 임원','executive','부사장',true,'other@example.invalid');
insert into enl_incident_shared(incident_id,site_id,payload) values('qa-phase','qa-site','{"id":"qa-phase","status":"approved","category":"property","executiveApproval":{"state":"pending","round":1,"stage":"parallel","roster":[{"id":"qa-executive","position":"사장"},{"id":"qa-other","position":"부사장"}],"signatures":[]}}');`);
const enqueue=async(key,user,stage)=>f.db.query('insert into enl_push_events(event_key,incident_id,site_id,user_id,kind,data) values($1,$2,$3,$4,$5,$6)',[key,'qa-phase','qa-site',user,'executive_approval_requested',JSON.stringify({approvalRound:1,approvalStage:stage})]);
await enqueue('early-president','qa-executive','president');await enqueue('parallel-ready','qa-other','parallel');await enqueue('parallel-wrong-stage','qa-other','president');
let phase=await ctx.flushMail(sql);assert.equal(phase.sent,1);assert.equal(sent.at(-1).to[0].email,'other@example.invalid');
await f.db.transaction(async tx=>{await tx.query("select set_config('enl.executive_decision','1',true)");await tx.exec(`update enl_incident_shared set payload=jsonb_set(jsonb_set(payload,'{executiveApproval,signatures}','[{"id":"qa-other","decision":"approve"}]'),'{executiveApproval,stage}','"president"') where incident_id='qa-phase'`);});
await enqueue('final-ready','qa-executive','president');await enqueue('final-wrong-stage','qa-executive','parallel');await enqueue('already-signed','qa-other','parallel');
phase=await ctx.flushMail(sql);assert.equal(phase.sent,1);assert.equal(sent.at(-1).to[0].email,'qa-executive@example.invalid');
for(const key of ['early-president','parallel-wrong-stage','final-wrong-stage','already-signed'])assert.equal((await f.db.query('select last_error from enl_email_events where event_key=$1',['email:'+key])).rows[0].last_error,'approval_no_longer_required');
await f.db.exec("update enl_hq_users set email_enabled=false where user_id='qa-executive'");await enqueue('final-email-off','qa-executive','president');assert.equal((await ctx.flushMail(sql)).sent,0);assert.equal((await f.db.query("select last_error from enl_email_events where event_key='email:final-email-off'")).rows[0].last_error,'email_disabled');
console.log('PASS actual email dispatcher: role policy, parallel/president turns, stale requests and email OFF; provider mocked, no mail sent');
}finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
