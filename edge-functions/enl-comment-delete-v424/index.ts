import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";
  if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({ok:false,message:"server_not_configured"},500);
  const db=createClient(url,key,{auth:{persistSession:false}});
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action);
  if(action==="health")return json({ok:true,version:"4.2.4-comment-delete1"});
  if(action!=="delete")return json({ok:false,message:"invalid_action"},400);

  const raw=body.actor||{};
  const actor={id:clean(raw.id),role:roleNorm(raw.role)};
  const commentId=clean(body.commentId);
  if(!actor.id||!commentId)return json({ok:false,message:"input_required"},400);
  if(!clean(body.actorPasswordHash)||!["manager","executive"].includes(actor.role))return json({ok:false,message:"forbidden"},403);

  try{
    const {data:user,error:uErr}=await db.from("enl_hq_users").select("user_id,name,role,position,active,password_hash").eq("user_id",actor.id).maybeSingle();
    if(uErr)throw uErr;
    if(!user||user.active===false||roleNorm(user.role)!==actor.role||clean(user.password_hash)!==clean(body.actorPasswordHash))return json({ok:false,message:"forbidden"},403);

    const {data:comment,error:cErr}=await db.from("enl_incident_comments").select("*").eq("comment_id",commentId).maybeSingle();
    if(cErr)throw cErr;
    if(!comment)return json({ok:false,message:"not_found"},404);
    if(clean(comment.author_id)!==clean(user.user_id))return json({ok:false,message:"not_owner"},403);

    const {data:incident,error:iErr}=await db.from("enl_incident_shared").select("incident_id,site_id,payload").eq("incident_id",comment.incident_id).maybeSingle();
    if(iErr)throw iErr;
    const status=clean(incident?.payload?.status);
    if(!incident||!["approved","closed"].includes(status))return json({ok:false,message:"incident_not_available"},409);

    const {error:dErr}=await db.from("enl_incident_comments").delete().eq("comment_id",commentId).eq("author_id",user.user_id);
    if(dErr)throw dErr;
    await db.from("enl_incident_audit").insert({incident_id:incident.incident_id,site_id:incident.site_id,action:"comment_delete",editor_id:user.user_id,editor_name:user.name,editor_role:roleNorm(user.role),editor_position:clean(user.position),changed_at:new Date().toISOString(),before_payload:comment,after_payload:null});
    return json({ok:true,deleted:true,commentId});
  }catch(e:any){return json({ok:false,message:e?.message||"delete_failed"},500)}
});