import postgres from "npm:postgres@3.4.5";
import { hasHealth as Deno, hashToken, issueSession } from "../_shared/device-runtime.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const FIELD_TITLES=["현장소장","파트장","서무"];
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const validHash=(v:any)=>/^[0-9a-f]{64}$/i.test(clean(v));

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";
  if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({ok:false,message:"server_not_configured"},500);
  const db=createClient(url,key,{auth:{persistSession:false}});
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action),actor=body.actor||{},actorId=clean(actor.id),actorRole=roleNorm(actor.role),actorSite=clean(actor.siteId),now=new Date().toISOString();

  async function verifiedSafety(proof:string){
    if(!actorId||actorRole!=="safety"||!validHash(proof))return null;
    const {data,error}=await db.from("enl_hq_users").select("user_id,name,role,position,active,password_hash").eq("user_id",actorId).maybeSingle();
    if(error)throw error;
    if(!data||data.active===false||roleNorm(data.role)!=="safety"||clean(data.password_hash)!==proof)return null;
    return {id:clean(data.user_id),name:clean(data.name),role:"safety",position:clean(data.position)};
  }

  try{
    if(action==="health")return json({ok:true,version:"4.2.0-account1"});

    if(action==="password_change_self"){
      const currentHash=clean(body.currentPasswordHash),newHash=clean(body.newPasswordHash);
      if(!validHash(currentHash)||!validHash(newHash))return json({ok:false,message:"invalid_password_hash"},400);
      if(currentHash===newHash)return json({ok:false,message:"same_password"},409);
      const hq=["safety","manager","executive"].includes(actorRole),key=(hq?'hq:':'site:')+actorId;
      const sql=postgres(Deno.env.get('SUPABASE_DB_URL')||'',{prepare:false,max:1,connect_timeout:5});
      try{return await sql.begin(async(tx:any)=>{
        const [u]=hq?await tx`select role,password_hash as proof from public.enl_hq_users where user_id=${actorId} and active for update`:
          await tx`select access_role as role,pin_hash as proof,site_id,job_title,phone from public.enl_site_personnel where personnel_id::text=${actorId} and active for update`;
        if(!u||roleNorm(u.role)!==actorRole||!hq&&u.site_id!==actorSite)return json({ok:false,message:'forbidden'},403);
        if(u.proof!==currentHash)return json({ok:false,message:'current_password_incorrect'},401);
        const [session]=await tx`select device_hash from private.enl_device_sessions where token_hash=${await hashToken(body.deviceSession)} and account_key=${key} and expires_at>now()`;
        if(!session)return json({ok:false,message:'device_session_required'},403);
        const digits=String(u.phone||'').replace(/\D/g,'');
        if(!hq&&digits.length>=4&&await hashToken(digits.slice(-4))===newHash)return json({ok:false,message:'initial_password_reused'},400);
        if(hq)await tx`update public.enl_hq_users set password_hash=${newHash},updated_at=now(),updated_by_id=${actorId},updated_by_role=${actorRole} where user_id=${actorId}`;
        else await tx`update public.enl_site_personnel set pin_hash=${newHash},updated_at=now(),updated_by_id=${actorId},updated_by_role=${actorRole},updated_by_position=${u.job_title} where personnel_id::text=${actorId}`;
        const [policy]=await tx`select initial,next_prompt as "nextPrompt",now() as "serverNow" from private.enl_password_schedule where account_key=${key}`;
        return json({ok:true,...await issueSession(tx,key,session.device_hash),passwordPolicy:policy});
      })}finally{await sql.end({timeout:1})}
    }

    if(action==="password_reset_safety"){
      const proof=clean(body.actorPasswordHash),newHash=clean(body.newPasswordHash),target=body.target||{},kind=clean(target.kind),targetId=clean(target.id);
      if(!validHash(proof)||!validHash(newHash)||!targetId||!["hq","site"].includes(kind))return json({ok:false,message:"invalid_input"},400);
      const safety=await verifiedSafety(proof);
      if(!safety)return json({ok:false,message:"safety_password_incorrect"},401);
      if(kind==="hq"){
        const {data,error}=await db.from("enl_hq_users").select("user_id,name,role,active").eq("user_id",targetId).maybeSingle();
        if(error)throw error;
        if(!data||data.active===false||!["manager","executive"].includes(roleNorm(data.role)))return json({ok:false,message:"invalid_target"},404);
        const q=await db.from("enl_hq_users").update({password_hash:newHash,updated_at:now,updated_by_id:safety.id,updated_by_name:safety.name,updated_by_role:"safety"}).eq("user_id",targetId);
        if(q.error)throw q.error;
        return json({ok:true,target:{kind:"hq",id:targetId,name:clean(data.name),role:roleNorm(data.role)}});
      }
      const {data,error}=await db.from("enl_site_personnel").select("personnel_id,site_id,name,job_title,access_role,active").eq("personnel_id",targetId).maybeSingle();
      if(error)throw error;
      if(!data||data.active===false||clean(data.access_role)!=="field"||!FIELD_TITLES.includes(clean(data.job_title)))return json({ok:false,message:"invalid_target"},404);
      const q=await db.from("enl_site_personnel").update({pin_hash:newHash,updated_at:now,updated_by_id:safety.id,updated_by_name:safety.name,updated_by_role:"safety",updated_by_position:safety.position}).eq("personnel_id",targetId);
      if(q.error)throw q.error;
      return json({ok:true,target:{kind:"site",id:targetId,name:clean(data.name),position:clean(data.job_title),siteId:clean(data.site_id)}});
    }

    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){console.error(e);return json({ok:false,message:clean(e?.message)||"account_error"},500)}
});
