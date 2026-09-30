import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const APP="incident-report-v2";
const BUCKET="enl-incident-files";
const MAX=8*1024*1024;
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const allowedMime=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"]);
function actorFrom(body:any){const a=body?.actor||{};return {id:clean(a.id),name:clean(a.name),role:roleNorm(a.role),siteId:clean(a.siteId),position:clean(a.position)};}
function safeName(v:any){const s=clean(v).replace(/[\\/]+/g,"-").replace(/[^0-9A-Za-z가-힣._()\- ]/g,"_").slice(0,90);return s||"file";}
function decodeBase64(s:string){const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==APP)return json({ok:false,message:"invalid_client"},403);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";
  if(!url||!key||!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const actor=actorFrom(body),action=clean(body.action);if(!actor.id||!actor.role)return json({ok:false,message:"actor_required"},401);
  const sql=postgres(dbUrl,{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
  try{
    if(["safety","manager","executive"].includes(actor.role)){
      const rows=await sql`select user_id,role,active from public.enl_hq_users where user_id=${actor.id} limit 1`,data=rows[0];
      if(!data||data.active===false||roleNorm(data.role)!==actor.role)return json({ok:false,message:"forbidden"},403);
    }else if(["field","worker"].includes(actor.role)){
      const rows=await sql`select personnel_id,site_id,access_role,active from public.enl_site_personnel where personnel_id::text=${actor.id} limit 1`,data=rows[0],expected=actor.role==="field"?"field":"worker";
      if(!data||data.active===false||clean(data.access_role)!==expected||(actor.siteId&&clean(data.site_id)!==actor.siteId))return json({ok:false,message:"forbidden"},403);
    }else return json({ok:false,message:"forbidden"},403);

    const storage=createClient(url,key,{auth:{persistSession:false}}).storage.from(BUCKET);
    if(action==="upload"){
      const f=body.file||{},mime=clean(f.mime),name=safeName(f.name),size=Number(f.size)||0,b64=clean(f.base64),scope=clean(body.scope)==="action"?"action":"incident";
      if(!allowedMime.has(mime))return json({ok:false,message:"unsupported_file_type"},400);
      if(!size||size>MAX)return json({ok:false,message:"file_too_large",maxBytes:MAX},413);
      if(!b64)return json({ok:false,message:"file_required"},400);
      const bytes=decodeBase64(b64);if(bytes.byteLength>MAX)return json({ok:false,message:"file_too_large",maxBytes:MAX},413);
      const ext=(name.includes(".")?name.split(".").pop():mime==="application/pdf"?"pdf":"bin")||"bin",owner=actor.siteId?`site-${safeName(actor.siteId)}`:`hq-${safeName(actor.id)}`,day=new Date().toISOString().slice(0,7),path=`${scope}/${owner}/${day}/${crypto.randomUUID()}.${safeName(ext).toLowerCase()}`;
      const {error}=await storage.upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"3600"});if(error)throw error;
      const {data:signed,error:sErr}=await storage.createSignedUrl(path,600);if(sErr)throw sErr;
      return json({ok:true,attachment:{storage:true,path,name,mime,size,kind:mime==="application/pdf"?"pdf":"image",previewUrl:signed.signedUrl}});
    }
    if(action==="sign"){
      const paths=(Array.isArray(body.paths)?body.paths:[]).map(clean).filter(Boolean).slice(0,30),urls:any={};
      if(paths.some((path:string)=>decodeURIComponent(path).includes("historical-followups")))return json({ok:false,message:"use_followup_authorized_endpoint"},403);
      for(const path of paths){const {data,error}=await storage.createSignedUrl(path,600);if(!error&&data?.signedUrl)urls[path]=data.signedUrl;}
      return json({ok:true,urls});
    }
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){return json({ok:false,message:String(e?.message||e||"attachment_failed")},500)}finally{await sql.end({timeout:1}).catch(()=>{})}
});
