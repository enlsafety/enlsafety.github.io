import postgres from 'npm:postgres@3.4.5';
import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
// Private builder embeds fixed reviewed SQL and at most two synthetic staging files.
// Request data never selects a project, schema, path, bucket, manifest or SQL.
const CONFIG=/*__CONFIG__*/ null as any;
const SQL=/*__SQL__*/ null as any;
const FILES=/*__FILES__*/ null as any;
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
const same=(a:string,b:string)=>{let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0;};
const reply=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({ok:false,code:'method_not_allowed'},405);
 const now=Date.now();if(!CONFIG||CONFIG.expiresAt-CONFIG.builtAt>3600000||CONFIG.expiresAt<=CONFIG.builtAt||now<CONFIG.builtAt-30000||now>=CONFIG.expiresAt)return reply({ok:false,code:'expired'},410);
 if(Deno.env.get('SUPABASE_URL')!==`https://${CONFIG.project}.supabase.co`)return reply({ok:false,code:'project_mismatch'},403);
 const token=req.headers.get('x-enl-maintenance-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token)||!same(await sha(new TextEncoder().encode(token)),CONFIG.tokenSha256))return reply({ok:false,code:'forbidden'},403);
 let body:any;try{const raw=await req.text();if(raw.length>8192)return reply({ok:false,code:'body_too_large'},413);body=JSON.parse(raw);}catch{return reply({ok:false,code:'invalid_request'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','actor','actorPasswordHash'].includes(k))||!['status','bootstrap',...(CONFIG.staging?['cleanup']:[])].includes(body.action))return reply({ok:false,code:'invalid_request'},400);
 if(body.actor?.id!==CONFIG.actorId||body.actor?.role!=='safety'||typeof body.actorPasswordHash!=='string'||body.actorPasswordHash.length>512)return reply({ok:false,code:'forbidden'},403);
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
 try{
  const u=(await sql.unsafe(SQL.auth,[CONFIG.actorId]))[0];
  if(!u||u.active!==true||u.role!=='safety'||!same(u.password_hash||'',body.actorPasswordHash))return reply({ok:false,code:'forbidden'},403);
  if(body.action==='status')return reply({ok:true,...(await sql.unsafe(SQL.status))[0]});
  if(body.action==='cleanup'){
   // Staging-only deletion targets are the two new synthetic objects compiled in FILES.
   await sql.unsafe(SQL.cleanupCheck).simple();
   const storage=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}).storage.from('enl-import-originals');
   for(const f of FILES){
    const prefix=f.path.split('/')[0],listing=await storage.list(prefix,{limit:1000});
    if(listing.error||listing.data.some((item:any)=>item.name!==f.path.split('/')[1]))throw Error('fixture_cleanup_failed');
    const present=listing.data.some((item:any)=>item.name===f.path.split('/')[1]);
    if(!present&&!f.canonical)continue;
    const got=await storage.download(f.path);
    if(got.error||!got.data||await sha(new Uint8Array(await got.data.arrayBuffer()))!==f.sha256)throw Error('fixture_hash_mismatch');
   }
   const result=await storage.remove(FILES.map((f:any)=>f.path));if(result.error)throw Error('fixture_cleanup_failed');
   await sql.begin(async(t:any)=>{await t.unsafe("set local lock_timeout='5s';lock table private.enl_historical_files,private.enl_historical_batches,private.enl_storage_dedup_runs,private.enl_storage_dedup_events in share row exclusive mode;").simple();await t.unsafe(SQL.cleanupCheck).simple();await t.unsafe(SQL.cleanup).simple();});
   return reply({ok:true,cleaned:true});
  }
  await sql.begin(async(t:any)=>{
   await t.unsafe("set local lock_timeout='5s';set local statement_timeout='60s';").simple();
   if((await t.unsafe('select current_user as role'))[0]?.role!=='postgres')throw Error('database_role_mismatch');
   if(Date.now()>=CONFIG.expiresAt)throw Error('expired');
   await t.unsafe(SQL.bootstrap).simple();
  });
  if(CONFIG.staging){
   const storage=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}).storage.from('enl-import-originals');
   for(const f of FILES){const bytes=Uint8Array.from(atob(f.base64),(x:string)=>x.charCodeAt(0));
    if(await sha(bytes)!==f.sha256)throw Error('fixture_hash_mismatch');
    const uploaded=await storage.upload(f.path,bytes,{upsert:false,contentType:'image/png'});
    if(uploaded.error&&![409,'409','Duplicate'].includes(uploaded.error.statusCode||uploaded.error.error))throw Error('fixture_upload_failed');
    const got=await storage.download(f.path);if(got.error||await sha(new Uint8Array(await got.data.arrayBuffer()))!==f.sha256)throw Error('fixture_hash_mismatch');
   }
  }
  return reply({ok:true,...(await sql.unsafe(SQL.status))[0],fixtureObjects:FILES.length});
 }catch(e:any){const code=['database_role_mismatch','expired','fixture_cleanup_failed','fixture_upload_failed','fixture_hash_mismatch'].includes(e?.message)?e.message:'bootstrap_failed';const sqlstate=/^[0-9A-Z]{5}$/.test(e?.code||'')?e.code:undefined;return reply({ok:false,code,...(sqlstate?{sqlstate}:{})},409);}
 finally{await sql.end({timeout:2}).catch(()=>{});}
});
