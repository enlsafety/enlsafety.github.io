import postgres from 'npm:postgres@3.4.5';
// Temporary final synthetic sign-fixture cleanup. No caller-provided SQL or IDs.
const CONFIG=/*__CONFIG__*/ null as any,SQL=/*__SQL__*/ null as any;
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const same=(a:string,b:string)=>{let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0;};
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const canonical=(v:any):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map((x:any)=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const equal=(a:any,b:any)=>same(canonical(a),canonical(b));
const keep=(s:any)=>Object.fromEntries(Object.entries(s.tables).map(([k,v]:[string,any])=>[k,v.keep]));
const counts=(s:any)=>Object.fromEntries(Object.entries(s.tables).filter(([,v]:[string,any])=>v.remove.count).map(([k,v]:[string,any])=>[k,v.remove.count]));
const safe=(s:any)=>['noDeleteTriggers','safeDeleteTopology','noRetainedReferences','fixtureOwnerValid'].every(k=>s[k]===true)&&equal(s.inventory,CONFIG.baseline.inventory)&&equal(keep(s),keep(CONFIG.baseline));
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({ok:false,code:'method_not_allowed'},405);
 const now=Date.now();if(!CONFIG||CONFIG.expiresAt<=CONFIG.builtAt||CONFIG.expiresAt-CONFIG.builtAt>3600000||now<CONFIG.builtAt-30000||now>=CONFIG.expiresAt)return reply({ok:false,code:'expired'},410);
 if(Deno.env.get('SUPABASE_URL')!==`https://${CONFIG.project}.supabase.co`)return reply({ok:false,code:'project_mismatch'},403);
 const token=req.headers.get('x-enl-maintenance-token')||'';if(!/^[a-f0-9]{64}$/.test(token)||!same(await sha(token),CONFIG.tokenSha256))return reply({ok:false,code:'forbidden'},403);
 let b:any;try{if(Number(req.headers.get('content-length')||0)>8192)return reply({ok:false,code:'body_too_large'},413);const raw=await req.text();if(raw.length>8192)return reply({ok:false,code:'body_too_large'},413);b=JSON.parse(raw);}catch{return reply({ok:false,code:'invalid_request'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['action','actor','actorPasswordHash'].includes(k))||!['status','cleanup'].includes(b.action))return reply({ok:false,code:'invalid_request'},400);
 if(b.actor?.id!==CONFIG.actorId||b.actor?.role!=='safety'||typeof b.actorPasswordHash!=='string'||b.actorPasswordHash.length>512)return reply({ok:false,code:'forbidden'},403);
 const url=Deno.env.get('SUPABASE_DB_URL');if(!url)return reply({ok:false,code:'server_not_configured'},503);
 try{const database=new URL(url);if(!['postgres:','postgresql:'].includes(database.protocol)||database.pathname!=='/postgres'||!(database.hostname===`db.${CONFIG.project}.supabase.co`||(database.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(database.username)===`postgres.${CONFIG.project}`)))return reply({ok:false,code:'database_project_mismatch'},403);}catch{return reply({ok:false,code:'database_project_mismatch'},403);}
 const sql=postgres(url,{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
 try{
  const u=(await sql.unsafe(SQL.auth,[CONFIG.actorId]))[0];if(!u||u.active!==true||u.role!=='safety'||typeof u.password_hash!=='string'||!same(u.password_hash,b.actorPasswordHash))return reply({ok:false,code:'forbidden'},403);
  return reply(await sql.begin(async(tx:any)=>{
   await tx.unsafe(SQL.lock).simple();if((await tx.unsafe('select current_user as role'))[0]?.role!=='postgres')throw Error('database_role_mismatch');if(Date.now()>=CONFIG.expiresAt)throw Error('expired');
   const before=(await tx.unsafe(SQL.state))[0]?.state;if(!safe(before))throw Error('retained_state_changed');
   if(Object.keys(counts(before)).length===0)return {ok:true,alreadyClean:true,removed:counts(CONFIG.baseline),retainedHashesMatch:true,storageUnchanged:true};
   if(!equal(before,CONFIG.baseline))throw Error('fixture_state_changed');
   if(b.action==='status')return {ok:true,alreadyClean:false,pending:counts(before)};
   await tx.unsafe(SQL.cleanup).simple();
   const after=(await tx.unsafe(SQL.state))[0]?.state;if(!safe(after)||Object.keys(counts(after)).length!==0)throw Error('postcheck_failed');
   return {ok:true,alreadyClean:false,removed:counts(before),retainedHashesMatch:true,storageUnchanged:true};
  }));
 }catch(e){const allowed=['database_role_mismatch','expired','retained_state_changed','fixture_state_changed','postcheck_failed','dedup_fixture_cleanup_required_first','fixture_users_changed','fixture_user_hash_changed','fixture_batch_changed','fixture_alias_changed','fixture_foreign_key_changed','fixture_external_reference'];return reply({ok:false,code:typeof (e as any)?.message==='string'&&allowed.includes((e as any).message)?(e as any).message:'cleanup_failed'},409);}
 finally{try{await sql.end({timeout:2});}catch{}}
});
