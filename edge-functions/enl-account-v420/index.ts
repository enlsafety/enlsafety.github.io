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

  async function selfTarget(){
    if(!actorId)return null;
    if(["safety","manager","executive"].includes(actorRole)){
      const {data,error}=await db.from("enl_hq_users").select("user_id,name,role,position,active,password_hash").eq("user_id",actorId).maybeSingle();
      if(error)throw error;
      if(!data||data.active===false||roleNorm(data.role)!==actorRole)return null;
      return {kind:"hq",id:clean(data.user_id),name:clean(data.name),role:roleNorm(data.role),position:clean(data.position),hash:clean(data.password_hash)};
    }
    if(actorRole==="field"){
      const {data,error}=await db.from("enl_site_personnel").select("personnel_id,site_id,name,job_title,access_role,active,pin_hash").eq("personnel_id",actorId).maybeSingle();
      if(error)throw error;
      if(!data||data.active===false||clean(data.access_role)!=="field"||!FIELD_TITLES.includes(clean(data.job_title)))return null;
      if(actorSite&&clean(data.site_id)!==actorSite)return null;
      return {kind:"site",id:clean(data.personnel_id),name:clean(data.name),role:"field",position:clean(data.job_title),siteId:clean(data.site_id),hash:clean(data.pin_hash)};
    }
    return null;
  }

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
      const target=await selfTarget();
      if(!target)return json({ok:false,message:"forbidden"},403);
      if(target.hash!==currentHash)return json({ok:false,message:"current_password_incorrect"},401);
      if(currentHash===newHash)return json({ok:false,message:"same_password"},409);
      if(target.kind==="hq"){
        const q=await db.from("enl_hq_users").update({password_hash:newHash,updated_at:now,updated_by_id:target.id,updated_by_name:target.name,updated_by_role:target.role}).eq("user_id",target.id).eq("active",true).eq("password_hash",currentHash).select("user_id").maybeSingle();
        if(q.error)throw q.error;
        if(!q.data)return json({ok:false,message:"current_password_incorrect"},409);
      }else{
        const q=await db.from("enl_site_personnel").update({pin_hash:newHash,updated_at:now,updated_by_id:target.id,updated_by_name:target.name,updated_by_role:"field",updated_by_position:target.position}).eq("personnel_id",target.id).eq("active",true).eq("pin_hash",currentHash).select("personnel_id").maybeSingle();
        if(q.error)throw q.error;
        if(!q.data)return json({ok:false,message:"current_password_incorrect"},409);
      }
      return json({ok:true});
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
