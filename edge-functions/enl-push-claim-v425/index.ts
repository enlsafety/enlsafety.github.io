import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const FIELD_TITLES=["현장소장","파트장","서무"];
const VERSION="4.6.0-r1";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const enc=new TextEncoder();
const sha=async(v:string)=>{const b=await crypto.subtle.digest("SHA-256",enc.encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};

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
  if(action==="health")return json({ok:true,version:VERSION});
  if(action!=="claim")return json({ok:false,message:"invalid_action"},400);
  const raw=body.actor||{},actor={id:clean(raw.id),role:roleNorm(raw.role),siteId:clean(raw.siteId)};
  if(!actor.id)return json({ok:false,message:"forbidden"},403);
  let u:any=null;
  if(["safety","manager","executive"].includes(actor.role)){
    const {data,error}=await db.from("enl_hq_users").select("user_id,name,role,position,active,password_hash").eq("user_id",actor.id).maybeSingle();
    if(error)throw error;
    if(!data||data.active===false||roleNorm(data.role)!==actor.role||!clean(data.password_hash)||clean(body.actorPasswordHash)!==clean(data.password_hash))return json({ok:false,message:"forbidden"},403);
    u={id:clean(data.user_id),name:clean(data.name),role:roleNorm(data.role),position:clean(data.position),siteId:""};
  }else if(["field","worker"].includes(actor.role)){
    const {data,error}=await db.from("enl_site_personnel").select("personnel_id,site_id,name,job_title,access_role,active,pin_hash").eq("personnel_id",actor.id).maybeSingle();
    if(error)throw error;
    if(!data||data.active===false||((actor.role==='field'||clean(data.pin_hash))&&(!clean(data.pin_hash)||clean(body.actorPinHash)!==clean(data.pin_hash))))return json({ok:false,message:"forbidden"},403);
    const role=clean(data.access_role)==="field"?"field":"worker";
    if(role!==actor.role||role==="field"&&!FIELD_TITLES.includes(clean(data.job_title)))return json({ok:false,message:"forbidden"},403);
    if(actor.siteId&&clean(data.site_id)!==actor.siteId)return json({ok:false,message:"forbidden"},403);
    u={id:clean(data.personnel_id),name:clean(data.name),role,position:clean(data.job_title)||(role==="worker"?"일반근로자":"현장관리"),siteId:clean(data.site_id)};
  }else return json({ok:false,message:"forbidden"},403);

  const sub=body.subscription||{},endpoint=clean(sub.endpoint),p256dh=clean(sub.keys?.p256dh),auth=clean(sub.keys?.auth);
  if(!endpoint||!p256dh||!auth)return json({ok:false,message:"invalid_subscription"},400);
  const endpointHash=await sha(endpoint),now=new Date().toISOString();
  const preferences=body.preferences&&typeof body.preferences==="object"?body.preferences:{};

  const {data:oldOwners,error:oldErr}=await db.from("enl_push_subscriptions").select("id,user_id,role").eq("endpoint_hash",endpointHash).neq("user_id",u.id);
  if(oldErr)throw oldErr;
  if((oldOwners||[]).length){
    const {error:delErr}=await db.from("enl_push_subscriptions").delete().eq("endpoint_hash",endpointHash).neq("user_id",u.id);
    if(delErr)throw delErr;
  }

  const row={endpoint_hash:endpointHash,endpoint,p256dh,auth,user_id:u.id,user_name:u.name,role:u.role,position:u.position,site_id:u.siteId||null,preferences,user_agent:clean(body.userAgent).slice(0,300),updated_at:now,last_seen_at:now};
  const {error:upErr}=await db.from("enl_push_subscriptions").upsert(row,{onConflict:"endpoint_hash,user_id"});
  if(upErr)throw upErr;
  return json({ok:true,userId:u.id,role:u.role,transferred:(oldOwners||[]).length});
});
