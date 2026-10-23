import postgres from 'npm:postgres@3.4.5';
// Fixed synthetic fixture cleanup. Tombstone after verification. No request SQL/IDs.
const CONFIG=/*__CONFIG__*/ null as any;
const SQL=/*__SQL__*/ null as any;
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const same=(a:string,b:string)=>{let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0;};
const sha=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const canonical=(v:any):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map((x:any)=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const equal=(a:any,b:any)=>same(canonical(a),canonical(b));
const retained=(state:any)=>Object.fromEntries(Object.entries(state.tables).map(([k,v]:[string,any])=>[k,v.keep]));
const removals=(state:any)=>Object.fromEntries(Object.entries(state.tables).map(([k,v]:[string,any])=>[k,v.remove.count]));
const zeroTargets=(state:any)=>state.ids.length===0&&Object.values(removals(state)).every(n=>n===0);
const safeQA=(state:any)=>state.safeDeleteGraph===true&&state.targetSiteValid===true&&equal(state.guards,CONFIG.baseline.qa.guards)&&equal(retained(state),retained(CONFIG.baseline.qa));
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({ok:false,code:'method_not_allowed'},405);
 const now=Date.now();if(!CONFIG||CONFIG.expiresAt-CONFIG.builtAt>3600000||CONFIG.expiresAt<=CONFIG.builtAt||now<CONFIG.builtAt-30000||now>=CONFIG.expiresAt)return reply({ok:false,code:'expired'},410);
 if(Deno.env.get('SUPABASE_URL')!==`https://${CONFIG.project}.supabase.co`)return reply({ok:false,code:'project_mismatch'},403);
 const token=req.headers.get('x-enl-maintenance-token')||'';if(!/^[a-f0-9]{64}$/.test(token)||!same(await sha(token),CONFIG.tokenSha256))return reply({ok:false,code:'forbidden'},403);
 let body:any;try{if(Number(req.headers.get('content-length')||0)>8192)return reply({ok:false,code:'body_too_large'},413);const raw=await req.text();if(raw.length>8192)return reply({ok:false,code:'body_too_large'},413);body=JSON.parse(raw);}catch{return reply({ok:false,code:'invalid_request'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','actor','actorPasswordHash'].includes(k))||!['status','cleanup'].includes(body.action))return reply({ok:false,code:'invalid_request'},400);
 if(body.actor?.id!==CONFIG.actorId||body.actor?.role!=='safety'||typeof body.actorPasswordHash!=='string'||body.actorPasswordHash.length>512)return reply({ok:false,code:'forbidden'},403);
 const url=Deno.env.get('SUPABASE_DB_URL');if(!url)return reply({ok:false,code:'server_not_configured'},503);
 const sql=postgres(url,{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
 try{
  const user=(await sql.unsafe(SQL.auth,[CONFIG.actorId]))[0];if(!user||user.active!==true||user.role!=='safety'||typeof user.password_hash!=='string'||!same(user.password_hash,body.actorPasswordHash))return reply({ok:false,code:'forbidden'},403);
  const result=await sql.begin(async(tx:any)=>{
   await tx.unsafe(SQL.lockQA).simple();if((await tx.unsafe('select current_user as role'))[0]?.role!=='postgres')throw Error('database_role_mismatch');
   if(Date.now()>=CONFIG.expiresAt)throw Error('expired');
   const catalog=(await tx.unsafe(SQL.securityCount))[0],count=catalog?.count;if(!catalog?.ordinary||![0,8].includes(count))throw Error('partial_fixture_state');
   if(count===8)await tx.unsafe(SQL.lockSecurity).simple();
   const before=(await tx.unsafe(SQL.qa))[0]?.state;if(!safeQA(before))throw Error('qa_baseline_mismatch');
   if(count===0){if(!zeroTargets(before))throw Error('partial_fixture_state');return {ok:true,alreadyClean:true,removed:removals(CONFIG.baseline.qa),securityTables:0,guardsRestored:true,unrelatedRowsUnchanged:true};}
   const security=(await tx.unsafe(SQL.security))[0]?.state;if(!security?.syntheticOnly||!equal(security,CONFIG.baseline.security))throw Error('security_baseline_mismatch');
   if(!equal(before,CONFIG.baseline.qa))throw Error('qa_baseline_mismatch');
   if(body.action==='status')return {ok:true,alreadyClean:false,pending:removals(before),securityTables:8};
   await tx.unsafe(SQL.guard).simple();
   await tx.unsafe(SQL.deleteRows).simple();
   await tx.unsafe(SQL.restore).simple();
   await tx.unsafe(SQL.dropSecurity).simple();
   const after=(await tx.unsafe(SQL.qa))[0]?.state;
   if(!safeQA(after)||!zeroTargets(after)||(await tx.unsafe(SQL.securityCount))[0]?.count!==0)throw Error('postcheck_failed');
   return {ok:true,alreadyClean:false,removed:removals(before),securityTables:0,guardsRestored:true,unrelatedRowsUnchanged:true};
  });return reply(result);
 }catch(e){const allowed=['database_role_mismatch','expired','partial_fixture_state','qa_baseline_mismatch','security_baseline_mismatch','postcheck_failed'];const code=e instanceof Error&&allowed.includes(e.message)?e.message:'cleanup_failed';return reply({ok:false,code},409);}
 finally{try{await sql.end({timeout:2});}catch{}}
});
