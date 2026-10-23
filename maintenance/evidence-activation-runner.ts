import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

// Temporary, project-pinned release tool. The builder embeds reviewed SQL and
// backup hashes. No request value can select SQL, schema, project, or a path.
// Deploy the tombstone immediately after independent verification.
const CONFIG = /*__CONFIG__*/ null as any;
const SQL = /*__SQL__*/ null as any;
const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const same = (a:string,b:string)=>{
  let d=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return d===0;
};
const sha = async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,"0")).join("");
const baselineMatches = (actual:any)=>["audit","revisions","backups"].every(k=>
  actual?.[k]?.count===CONFIG.baseline[k].count&&same(actual?.[k]?.sha256||"",CONFIG.baseline[k].sha256));
const validStatus = (s:any)=>s&&s.immutableGuards===3&&s.dictionaryHashesValid===true;
const publicStatus = (s:any)=>({audit:s.audit,revisions:s.revisions,backups:s.backups,
  dictionaryObjects:s.dictionaryObjects,compactedSnapshots:s.compactedSnapshots,active:s.compactionTriggers===3});

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return reply({ok:false,code:"method_not_allowed"},405);
  const now=Date.now();
  if(!CONFIG||CONFIG.expiresAt-CONFIG.builtAt>3600000||CONFIG.expiresAt<=CONFIG.builtAt||now<CONFIG.builtAt-30000||now>=CONFIG.expiresAt)
    return reply({ok:false,code:"expired"},410);
  if(Deno.env.get("SUPABASE_URL")!==`https://${CONFIG.project}.supabase.co`)
    return reply({ok:false,code:"project_mismatch"},403);
  const token=req.headers.get("x-enl-maintenance-token")||"";
  if(!/^[a-f0-9]{64}$/.test(token)||!same(await sha(token),CONFIG.tokenSha256))
    return reply({ok:false,code:"forbidden"},403);
  if(Number(req.headers.get("content-length")||0)>8192)return reply({ok:false,code:"body_too_large"},413);
  let body:any;
  try{const raw=await req.text();if(raw.length>8192)return reply({ok:false,code:"body_too_large"},413);body=JSON.parse(raw);}catch{return reply({ok:false,code:"invalid_request"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["action","actor","actorPasswordHash"].includes(k))||
    !["status","activate"].includes(body.action))return reply({ok:false,code:"invalid_request"},400);
  if(body.actor?.id!==CONFIG.actorId||body.actor?.role!=="safety"||typeof body.actorPasswordHash!=="string"||body.actorPasswordHash.length>512)
    return reply({ok:false,code:"forbidden"},403);
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";
  if(!dbUrl)return reply({ok:false,code:"server_not_configured"},503);
  const sql=postgres(dbUrl,{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
  try{
    // Existing application safety authentication, independently of maintenance token.
    const users=await sql.unsafe(SQL.auth,[CONFIG.actorId]);
    const user=users[0];
    if(!user||user.active!==true||user.role!=="safety"||typeof user.password_hash!=="string"||!same(user.password_hash,body.actorPasswordHash))
      return reply({ok:false,code:"forbidden"},403);
    if(body.action==="status"){
      const state=(await sql.unsafe(SQL.status))[0]?.state;
      if(!validStatus(state))return reply({ok:false,code:"verification_failed"},409);
      return reply({ok:true,...publicStatus(state)});
    }
    const state=await sql.begin(async(tx:any)=>{
      // Lock before comparing the complete prechange backup fingerprint. A new
      // legitimate write causes a safe mismatch, never an unbacked-up conversion.
      await tx.unsafe(SQL.lock).simple();
      const identity=(await tx.unsafe("select current_user as role"))[0];
      if(identity?.role!=="postgres")throw new Error("database_role_mismatch");
      if(Date.now()>=CONFIG.expiresAt)throw new Error("activation_expired");
      const before=(await tx.unsafe(SQL.baseline))[0]?.baseline;
      if(!baselineMatches(before))throw new Error("baseline_mismatch");
      const current=(await tx.unsafe(SQL.status))[0]?.state;
      if(!validStatus(current)||![0,3].includes(current.compactionTriggers))throw new Error("verification_failed");
      if(current.compactionTriggers===3)return {...current,alreadyActive:true};
      if(current.dictionaryObjects!==0||current.compactedSnapshots!==0)throw new Error("unexpected_prechange_state");
      await tx.unsafe(SQL.activation).simple();
      const after=(await tx.unsafe(SQL.baseline))[0]?.baseline;
      if(!baselineMatches(after))throw new Error("verification_failed");
      const result=(await tx.unsafe(SQL.status))[0]?.state;
      if(!validStatus(result)||result.compactionTriggers!==3)throw new Error("verification_failed");
      return {...result,alreadyActive:false};
    });
    return reply({ok:true,...publicStatus(state),alreadyActive:state.alreadyActive});
  }catch(e){
    // Never expose SQL, connection details, proof values or evidence in errors.
    const code=e instanceof Error&&["baseline_mismatch","verification_failed","unexpected_prechange_state","database_role_mismatch","activation_expired"].includes(e.message)?e.message:"activation_failed";
    const sqlstate=typeof (e as any)?.code==="string"&&/^[0-9A-Z]{5}$/.test((e as any).code)?(e as any).code:undefined;
    return reply({ok:false,code,...(sqlstate?{sqlstate}:{})},409);
  }finally{try{await sql.end({timeout:2});}catch{/* Preserve the sanitized response if connection shutdown fails. */}}
});
