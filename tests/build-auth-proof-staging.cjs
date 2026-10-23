'use strict';
// Builds a time-limited staging-only wrapper; no production table or SQL input route.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),output=path.resolve(root,'../private-secrets/auth-proof-staging');
const names=['hq_users','site_master','site_personnel','personnel_audit','push_subscriptions'];
const prefix='enl_final_qa_20261013.auth472_',hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const transform=s=>s.replace(/public\.enl_([a-z_]+)/g,(_,name)=>{if(!names.includes(name))throw Error('unexpected_table');return prefix+name});
const handlers=['enl-login-v411','enl-personnel-v434'].map((n,i)=>{
 const original=fs.readFileSync(path.join(root,'edge-functions',n,'index.ts'),'utf8');
 const source=transform(original.replace(/^import .*;\r?\n/gm,''));
 if(source.includes('public.'))throw Error('unmapped_public_reference');
 return {name:n,sha256:hash(original),code:`const handler${i}=(()=>{let captured:any;const Deno={env:globalThis.Deno.env,serve:(h:any)=>{captured=h}};\n${source}\nreturn captured;})();`};
});
const fixture=transform(fs.readFileSync(path.join(root,'tests/fixtures/login-proof-schema.sql'),'utf8'));
const tables=names.map(n=>prefix+n),setup=fixture+'\n'+tables.map(t=>`alter table ${t} enable row level security;revoke all on ${t} from public,anon,authenticated,service_role;`).join('\n');
const cleanup=`do $guard$ begin
 if exists(select 1 from ${prefix}hq_users where user_id not like 'qa-auth-%') or exists(select 1 from ${prefix}site_master where site_id<>'qa-auth-site-472') or exists(select 1 from ${prefix}site_personnel where personnel_id not in ('qa-auth-field-472','qa-auth-worker-472') or site_id<>'qa-auth-site-472') or exists(select 1 from ${prefix}personnel_audit where editor_id not in ('qa-auth-field-472','qa-auth-safety-472') or site_id<>'qa-auth-site-472') or exists(select 1 from ${prefix}push_subscriptions) then raise exception 'unexpected_fixture_data';end if;
 end;$guard$;drop table ${tables.join(',')};`;
const token=crypto.randomBytes(32).toString('hex'),expires=Date.now()+3600000;
const source=`import postgres from 'npm:postgres@3.4.5';
${handlers.map(x=>x.code).join('\n')}
const TOKEN_SHA=${JSON.stringify(hash(token))},EXPIRES=${expires};
const fixtureTables=${JSON.stringify(tables)},setupSql=${JSON.stringify(setup)},cleanupSql=${JSON.stringify(cleanup)};
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(Deno.env.get('SUPABASE_URL')!=='https://zgwxzfvvpqgdedyobwmg.supabase.co')return reply({ok:false,code:'project_mismatch'},403);
 if(Date.now()>=EXPIRES)return reply({ok:false,code:'expired'},410);
 if(req.method!=='POST')return reply({ok:false,code:'method'},405);
 const token=req.headers.get('x-enl-qa-token')||'';const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(!/^[a-f0-9]{64}$/.test(token)||digest!==TOKEN_SHA)return reply({ok:false,code:'forbidden'},403);
 let body:any;try{const raw=await req.text();if(raw.length>16384)throw Error();body=JSON.parse(raw)}catch{return reply({ok:false,code:'invalid_request'},400)}
 if(!body||Object.keys(body).some(k=>!['action','payload'].includes(k))||!['setup','login','personnel','cleanup'].includes(body.action))return reply({ok:false,code:'invalid_request'},400);
 if(body.action==='login'||body.action==='personnel')return await (body.action==='login'?handler0:handler1)(new Request(req.url,{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify(body.payload||{})}));
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
 try{return await sql.begin(async(t:any)=>{await t.unsafe("set local lock_timeout='5s';set local statement_timeout='30s';").simple();
 if((await t.unsafe('select current_user as role'))[0]?.role!=='postgres')throw Error('role');
 if(body.action==='setup'){for(const name of fixtureTables){if((await t.unsafe('select to_regclass($1) as present',[name]))[0]?.present)throw Error('already_exists');}await t.unsafe(setupSql).simple();return reply({ok:true,tablesCreated:5});}
 await t.unsafe(cleanupSql).simple();return reply({ok:true,tablesRemoved:5});});}catch{return reply({ok:false,code:'fixture_operation_failed'},409)}finally{await sql.end({timeout:1}).catch(()=>{})}
});
`;
fs.mkdirSync(output,{recursive:true,mode:0o700});for(const [name,value] of [['index.ts',source],['token.txt',token],['manifest.json',JSON.stringify({expiresAt:new Date(expires).toISOString(),handlers:handlers.map(({name,sha256})=>({name,sha256})),sourceSha256:hash(source)},null,2)]]){fs.writeFileSync(path.join(output,name),value,{mode:0o600});fs.chmodSync(path.join(output,name),0o600)}
console.log(JSON.stringify({output,expiresAt:new Date(expires).toISOString(),handlerHashes:handlers.map(x=>x.sha256)}));
