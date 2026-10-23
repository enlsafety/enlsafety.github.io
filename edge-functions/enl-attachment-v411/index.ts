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
async function fileHash(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");}
function optimizationInfo(v:any,size:number,hash:string){
  if(!v||typeof v!=="object")return undefined;
  const out:any={version:"1.0.0",outputBytes:size,sha256:hash,preservedOriginal:v.preservedOriginal===true,mode:v.preservedOriginal===true?"original":"full_resolution"};
  for(const k of ["sourceBytes","sourceWidth","sourceHeight","width","height","targetBytes"]){const n=Number(v[k]);if(Number.isFinite(n)&&n>0&&n<=1024*1024*1024)out[k]=Math.round(n);}
  if(/^[a-f0-9]{64}$/.test(v.sourceSha256||""))out.sourceSha256=v.sourceSha256;
  if(allowedMime.has(v.sourceMime))out.sourceMime=v.sourceMime;
  if(v.sourceColorProfile==="verified_srgb")out.sourceColorProfile="verified_srgb";
  if(clean(v.originalName))out.originalName=clean(v.originalName).replace(/[\\/<>]/g,"_").slice(0,160);
  if(typeof v.reason==="string")out.reason=v.reason.slice(0,80);
  if(typeof v.targetMet==="boolean")out.targetMet=v.targetMet;
  // Client quality measurements are descriptive, never an authorization or evidence guarantee.
  if(v.metrics&&typeof v.metrics==="object"){out.metrics={passed:v.metrics.passed===true};for(const k of ["minTileSSIM","maxTileMAE","maxEdgeMAE","maxAlphaError","tiles"]){const n=Number(v.metrics[k]);if(Number.isFinite(n)&&n>=0)out.metrics[k]=Math.round(n*100000)/100000;}}
  return out;
}
async function immutableUpload(storage:any,path:string,bytes:Uint8Array,mime:string,hash:string){
  const {error}=await storage.upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"3600"});
  if(!error)return;
  if(!["409","Duplicate"].includes(String(error.statusCode||error.error||""))&&!/already exists|duplicate/i.test(String(error.message||"")))throw error;
  const existing=await storage.download(path);if(existing.error||!existing.data)throw existing.error||Error("attachment_verify_failed");
  const original=new Uint8Array(await existing.data.arrayBuffer());
  if(original.byteLength!==bytes.byteLength||await fileHash(original)!==hash)throw Error("attachment_integrity_mismatch");
}

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
      const rows=await sql`select user_id,role,active,password_hash from public.enl_hq_users where user_id=${actor.id} limit 1`,data=rows[0];
      if(!data||data.active===false||roleNorm(data.role)!==actor.role||!clean(data.password_hash)||clean(body.actorPasswordHash)!==clean(data.password_hash))return json({ok:false,message:"forbidden"},403);
    }else if(["field","worker"].includes(actor.role)){
      const rows=await sql`select personnel_id,site_id,access_role,active,pin_hash from public.enl_site_personnel where personnel_id::text=${actor.id} limit 1`,data=rows[0],expected=actor.role==="field"?"field":"worker";
      if(!data||data.active===false||clean(data.access_role)!==expected||clean(data.site_id)!==actor.siteId||(actor.role==="field"&&(!clean(data.pin_hash)||clean(body.actorPinHash)!==clean(data.pin_hash))))return json({ok:false,message:"forbidden"},403);
    }else return json({ok:false,message:"forbidden"},403);

    const storage=createClient(url,key,{auth:{persistSession:false}}).storage.from(BUCKET);
    if(action==="upload"){
      if(!["safety","field","worker"].includes(actor.role))return json({ok:false,message:"reader_upload_forbidden"},403);
      const f=body.file||{},mime=clean(f.mime),name=safeName(f.name),size=Number(f.size)||0,b64=clean(f.base64),scope=clean(body.scope)==="action"?"action":"incident";
      if(!allowedMime.has(mime))return json({ok:false,message:"unsupported_file_type"},400);
      if(!size||size>MAX)return json({ok:false,message:"file_too_large",maxBytes:MAX},413);
      if(!b64)return json({ok:false,message:"file_required"},400);
      const bytes=decodeBase64(b64);if(bytes.byteLength!==size||bytes.byteLength>MAX)return json({ok:false,message:"file_too_large",maxBytes:MAX},413);
      const hash=await fileHash(bytes),ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"heic","image/heif":"heif","application/pdf":"pdf"} as Record<string,string>)[mime],owner=actor.siteId?`site-${safeName(actor.siteId)}`:`hq-${safeName(actor.id)}`,path=`${scope}/${owner}/${safeName(actor.id)}/sha256-${hash}.${ext}`;
      if(f.optimization?.sha256&&f.optimization.sha256!==hash)return json({ok:false,message:"attachment_integrity_mismatch"},400);
      await immutableUpload(storage,path,bytes,mime,hash);
      const {data:signed,error:sErr}=await storage.createSignedUrl(path,600);if(sErr)throw sErr;
      return json({ok:true,attachment:{storage:true,path,name,mime,size,sha256:hash,optimization:optimizationInfo(f.optimization,size,hash),kind:mime==="application/pdf"?"pdf":"image",previewUrl:signed.signedUrl}});
    }
    if(action==="sign"){
      const paths=(Array.isArray(body.paths)?body.paths:[]).map(clean).filter(Boolean).slice(0,30),urls:any={};
      if(paths.some((path:string)=>decodeURIComponent(path).includes("historical-followups")))return json({ok:false,message:"use_followup_authorized_endpoint"},403);
      const rows=actor.role==='safety'||actor.role==='manager'||actor.role==='executive'?await sql`select payload from public.enl_incident_shared`:await sql`select payload from public.enl_incident_shared where site_id=${actor.siteId}`;
      const permitted=new Set<string>();
      const allowSnapshot=(value:any)=>{const i=typeof value==='string'?JSON.parse(value):value;if(!i)return;
        if(actor.role==='worker'&&clean(i.reporterId)!==actor.id)return;
        const reader=['manager','executive'].includes(actor.role);if(reader&&!['reported','supplement','supplement_submitted','approved','closed'].includes(i.status))return;
        const actionVisible=!reader||i.corrective?.status==='approved';
        const submissions=actionVisible?(i.corrective?.submissions||[]).flatMap((s:any)=>s.afterPhotos||[]):[];
        const files=[...(i.photos||[]),...(actionVisible?i.corrective?.afterPhotos||[]:[]),...submissions,...(!reader?i.supplement?.attachments||[]:[]),...(actor.role==='safety'?i.attachments||[]:[])];
        for(const f of files)if(f?.path)permitted.add(clean(f.path));
      };
      for(const row of rows)allowSnapshot(row.payload);
      const own=actor.siteId?'site-'+safeName(actor.siteId):'hq-'+safeName(actor.id);
      const owns=(path:string)=>['incident','action'].some(scope=>path.startsWith(scope+'/'+own+'/'+safeName(actor.id)+'/'));
      // Audit evidence can outlive a correction. Safety already has full audit access;
      // other roles are restricted to still-visible incidents and the same field filtering.
      if(paths.some((path:string)=>!permitted.has(path)&&!owns(path))){
        const history=actor.role==='safety'
          ?await sql`select coalesce(before_payload,private.enl_evidence_get(before_hash)) as before_payload,coalesce(after_payload,private.enl_evidence_get(after_hash)) as after_payload from public.enl_incident_audit`
          :await sql`select coalesce(a.before_payload,private.enl_evidence_get(a.before_hash)) as before_payload,coalesce(a.after_payload,private.enl_evidence_get(a.after_hash)) as after_payload from public.enl_incident_audit a join public.enl_incident_shared s on s.incident_id=a.incident_id where (${actor.role} in ('manager','executive') or s.site_id=${actor.siteId}) and (${actor.role}<>'worker' or s.payload->>'reporterId'=${actor.id}) and (${actor.role} not in ('manager','executive') or s.payload->>'status' in ('reported','supplement','supplement_submitted','approved','closed'))`;
        for(const row of history){allowSnapshot(row.before_payload);allowSnapshot(row.after_payload);}
      }
      for(const path of paths){
        const ownUpload=owns(path);
        if(path.includes('..')||(!permitted.has(path)&&!ownUpload))return json({ok:false,message:'attachment_forbidden'},403);
      }
      for(const path of paths){const {data,error}=await storage.createSignedUrl(path,600);if(!error&&data?.signedUrl)urls[path]=data.signedUrl;}
      return json({ok:true,urls});
    }
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){return json({ok:false,message:String(e?.message||e||"attachment_failed")},500)}finally{await sql.end({timeout:1}).catch(()=>{})}
});
