// Real Edge handler + real isolated PostgreSQL (PGlite). No production or external delivery.
const fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module'),{PGlite}=require('@electric-sql/pglite');
async function fixture(){
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;
 create table enl_incident_shared(incident_id text primary key,site_id text,payload jsonb);
 create table enl_site_master(site_id text primary key,site_name text,active boolean);
 create table enl_hq_users(user_id text primary key,name text,role text,position text,active boolean,password_hash text);
 create table enl_site_personnel(personnel_id text primary key,site_id text,name text,job_title text,active boolean,access_role text,pin_hash text);
 create table enl_push_events(id bigint generated always as identity primary key,event_key text unique,incident_id text,site_id text,user_id text,kind text,title text,body text,data jsonb);
 create table enl_email_events(id bigint generated always as identity primary key,source_push_event_id bigint unique,event_key text unique,incident_id text,site_id text,user_id text,kind text);
 create table enl_push_config(id integer,internal_token text);insert into enl_push_config values(1,'isolated-never-sent');
 create schema net;create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
 insert into enl_site_master values('s1','QA 골프장',true),('s2','다른 사업장',true),('s34','파주CC',false);
 insert into enl_hq_users values('qa-safety','QA 안전','safety','안전관리자',true,'qa-proof'),('qa-exec','QA 경영','executive','경영진',true,'qa-proof');
 insert into enl_site_personnel values('qa-field','s1','QA 소장','현장소장',true,'field','qa-proof'),('qa-other','s2','타현장','현장소장',true,'field','qa-proof');
 insert into enl_incident_shared values('qa-paju','s34','{"id":"qa-paju","siteId":"s34","status":"closed","recordMode":"historical_transfer","category":"property","historicalImport":{"enabled":true,"erpApproved":true,"workflowExempt":true,"transferState":"closed"},"corrective":null}'),('qa-normal','s1','{"status":"approved","corrective":{"status":"planned"}}');
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20260930104503_historical_followup_actions.sql','utf8'));
 let handler,tx=null;const queries=[],uploads=new Map();
 const sql=async(parts,...args)=>{const q=parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'');queries.push(q);return ((await (tx||db).query(q,args)).rows)};
 sql.begin=async f=>db.transaction(async t=>{tx=t;try{return await f(sql)}finally{tx=null}});sql.end=async()=>{};
 const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,createClient:()=>({storage:{from:()=>({upload:async(path,bytes)=>{uploads.set(path,bytes);return {error:null}},createSignedUrl:async path=>({data:{signedUrl:'https://isolated-files.test/'+path}})})}}),Request,Response,TextEncoder,Uint8Array,atob,crypto,structuredClone,console};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('edge-functions/enl-historical-followup/model.js','utf8').replace(/export /g,''),ctx);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-historical-followup/index.ts','utf8').replace(/^import .*;\n/gm,'')),ctx);
 const actors={safety:{id:'qa-safety',name:'QA 안전',role:'safety',position:'안전관리자',passwordHash:'qa-proof'},field:{id:'qa-field',name:'QA 소장',role:'field',position:'현장소장',siteId:'s1',pinHash:'qa-proof'},other:{id:'qa-other',name:'타현장',role:'field',position:'현장소장',siteId:'s2',pinHash:'qa-proof'},executive:{id:'qa-exec',name:'QA 경영',role:'executive',position:'경영진',passwordHash:'qa-proof'}};
 async function raw(body){const r=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()}}
 const call=(who,body)=>{const a=actors[who];return raw({actor:a,actorPasswordHash:a.passwordHash,actorPinHash:a.pinHash,...body})};
 return {db,raw,call,actors,queries,uploads,close:()=>db.close()};
}
module.exports={fixture};
