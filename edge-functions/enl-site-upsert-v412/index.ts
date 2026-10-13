import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
async function forward(body:any){const base=Deno.env.get("SUPABASE_URL");if(!base)throw new Error("server_not_configured");const r=await fetch(`${base}/functions/v1/enl-incident-sync`,{method:"POST",headers:{"Content-Type":"application/json","X-ENL-App":CLIENT},body:JSON.stringify(body)});const t=await r.text();let d:any={};try{d=JSON.parse(t)}catch{d={ok:false,message:t||`http_${r.status}`}}return {status:r.status,data:d};}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
 const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
 if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
 let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
 const a=body.actor||{},actor={id:clean(a.id),name:clean(a.name),role:clean(a.role)==="final"?"manager":clean(a.role),position:clean(a.position)};
 if(clean(body.action)!=="site_upsert"||actor.role!=="safety"||!actor.id)return json({ok:false,message:"forbidden"},403);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)return json({ok:false,message:"server_not_configured"},500);
 const db=createClient(url,key,{auth:{persistSession:false}});
 try{
   const {data:user,error:uErr}=await db.from("enl_hq_users").select("user_id,name,role,active,password_hash").eq("user_id",actor.id).maybeSingle();if(uErr)throw uErr;if(!user||user.active===false||clean(user.role)!=="safety"||!clean(user.password_hash)||clean(body.actorPasswordHash)!==clean(user.password_hash))return json({ok:false,message:"forbidden"},403);
   const p=body.site||{},sid=clean(p.site_id);let prev:any=null;if(sid){const q=await db.from("enl_site_master").select("manager_name,part_name,clerk_name").eq("site_id",sid).maybeSingle();if(q.error)throw q.error;prev=q.data}
   const changed=!prev
     ? [p.manager_name,p.part_name,p.clerk_name].some(v=>!!clean(v))
     : clean(prev.manager_name)!==clean(p.manager_name)||clean(prev.part_name)!==clean(p.part_name)||clean(prev.clerk_name)!==clean(p.clerk_name);
   if(changed){const passwordHash=clean(body.passwordHash);if(!passwordHash)return json({ok:false,message:"password_required"},428);if(passwordHash!==clean(user.password_hash))return json({ok:false,message:"invalid_password"},401);}
   const f=await forward({action:"site_upsert",actor:{id:actor.id,name:clean(user.name)||actor.name,role:"safety",position:actor.position},role:"safety",actorPasswordHash:clean(body.actorPasswordHash),site:p});return json(f.data,f.status||200);
 }catch(e:any){return json({ok:false,message:e?.message||"site_upsert_failed"},500)}
});