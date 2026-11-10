import { restricted as Deno } from "../_shared/device-runtime.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const VERSION="4.4.10-global-refresh-db1";
const headers={
  "Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"content-type, x-enl-app",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  const origin=req.headers.get("origin")||"";
  if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);

  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";
  if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const sql=postgres(dbUrl,{prepare:false,max:2,connect_timeout:5,idle_timeout:2});

  try{
    if(req.method==="GET"){
      const rows=await sql`select epoch,version,updated_at from public.enl_app_control where id=1 limit 1`;
      const data=rows[0];if(!data)return json({ok:false,message:"control_missing"},500);
      return json({ok:true,epoch:String(data.epoch),version:clean(data.version),updatedAt:data.updated_at,serviceVersion:VERSION});
    }

    if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
    let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
    if(clean(body.action)!=="global-refresh")return json({ok:false,message:"invalid_action"},400);

    const actor=body.actor||{},actorId=clean(actor.id),actorRole=roleNorm(actor.role),passwordHash=clean(body.passwordHash);
    if(!actorId||actorRole!=="safety"||!passwordHash)return json({ok:false,message:"forbidden"},403);

    const users=await sql`select user_id,name,role,active,password_hash from public.enl_hq_users where user_id=${actorId} limit 1`;
    const user=users[0];
    if(!user||user.active===false||roleNorm(user.role)!=="safety"||clean(user.password_hash)!==passwordHash){
      return json({ok:false,message:"invalid_password"},403);
    }

    const requested=clean(body.version);
    const rows=await sql`
      update public.enl_app_control
         set epoch=coalesce(epoch,0)+1,
             version=coalesce(nullif(${requested},''),nullif(version,''),'4.4.10-r1'),
             updated_at=now()
       where id=1
       returning epoch,version,updated_at
    `;
    const data=rows[0];if(!data)return json({ok:false,message:"control_missing"},500);
    return json({ok:true,epoch:String(data.epoch),version:clean(data.version),updatedAt:data.updated_at,triggeredBy:clean(user.name),serviceVersion:VERSION});
  }catch(e:any){
    console.error("enl-global-refresh",clean(e?.message||e));
    return json({ok:false,message:"server_error"},500);
  }finally{
    await sql.end({timeout:1}).catch(()=>{});
  }
});