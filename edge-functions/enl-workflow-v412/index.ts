import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const FIELD_TITLES=["현장소장","파트장","서무"];
const INQUIRY_CATEGORIES=["앱 사용법","안전 관련 문의","기타"];
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const norm=(v:any)=>clean(v).replace(/\s+/g,"").toLocaleLowerCase("ko-KR");
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const uuid=()=>crypto.randomUUID();

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
  const action=clean(body.action),raw=body.actor||{},actor={id:clean(raw.id),name:clean(raw.name),role:roleNorm(raw.role),position:clean(raw.position),siteId:clean(raw.siteId)},now=new Date().toISOString();

  async function verifiedActor(){
    if(!actor.id)return null;
    if(["safety","manager","executive"].includes(actor.role)){
      const {data,error}=await db.from("enl_hq_users").select("user_id,name,role,position,department,active,password_hash").eq("user_id",actor.id).maybeSingle();
      if(error)throw error;if(!data||data.active===false||roleNorm(data.role)!==actor.role||!clean(data.password_hash)||clean(body.actorPasswordHash)!==clean(data.password_hash))return null;
      return {id:clean(data.user_id),name:clean(data.name),role:roleNorm(data.role),position:clean(data.position),siteId:"",passwordHash:clean(data.password_hash)};
    }
    if(["field","worker"].includes(actor.role)){
      const {data,error}=await db.from("enl_site_personnel").select("personnel_id,site_id,name,job_title,access_role,active,pin_hash").eq("personnel_id",actor.id).maybeSingle();
      if(error)throw error;if(!data||data.active===false||((actor.role==='field'||clean(data.pin_hash))&&(!clean(data.pin_hash)||clean(body.actorPinHash)!==clean(data.pin_hash))))return null;
      const storedRole=clean(data.access_role)==="field"?"field":"worker";if(storedRole!==actor.role)return null;
      if(storedRole==="field"&&!FIELD_TITLES.includes(clean(data.job_title)))return null;
      if(actor.siteId&&clean(data.site_id)!==actor.siteId)return null;
      return {id:clean(data.personnel_id),name:clean(data.name),role:storedRole,position:clean(data.job_title)||(storedRole==="worker"?"일반근로자":"현장관리"),siteId:clean(data.site_id),passwordHash:clean(data.pin_hash)};
    }
    return null;
  }
  async function incidentRow(incidentId:string){
    const {data,error}=await db.from("enl_incident_shared").select("incident_id,site_id,payload").eq("incident_id",incidentId).maybeSingle();if(error)throw error;return data;
  }
  async function incidentAudit(row:any,act:string,v:any,before:any=null,after:any=null){
    await db.from("enl_incident_audit").insert({incident_id:row.incident_id,site_id:row.site_id,action:act,editor_id:v.id,editor_name:v.name,editor_role:v.role,editor_position:v.position,changed_at:now,before_payload:before,after_payload:after});
  }
  function approved(row:any){return !!row&&["approved","closed"].includes(clean(row.payload?.status))&&!!clean(row.payload?.approvedAt)}

  try{
    const v=await verifiedActor();
    if(!v)return json({ok:false,message:"forbidden"},403);

    if(action==="designate_manager"){
      if(!["field","safety"].includes(v.role))return json({ok:false,message:"forbidden"},403);
      const passwordHash=clean(body.passwordHash);if(!passwordHash||passwordHash!==v.passwordHash)return json({ok:false,message:"invalid_password"},401);
      const p=body.person||{},siteId=clean(p.siteId||body.siteId),name=clean(p.name),jobTitle=clean(p.jobTitle),targetId=clean(p.personnelId);
      if(!siteId||!name||!FIELD_TITLES.includes(jobTitle))return json({ok:false,message:"invalid_personnel"},400);
      if(v.role==="field"&&v.siteId!==siteId)return json({ok:false,message:"site_forbidden"},403);
      const {data:list,error:listErr}=await db.from("enl_site_personnel").select("*").eq("site_id",siteId);if(listErr)throw listErr;
      const prev=(list||[]).find((x:any)=>targetId?clean(x.personnel_id)===targetId:norm(x.name)===norm(name));
      const {data:master,error:mErr}=await db.from("enl_site_master").select("manager_name,manager_phone,part_name,part_phone,clerk_name,clerk_phone").eq("site_id",siteId).maybeSingle();if(mErr)throw mErr;
      let masterName="",phone="";
      if(jobTitle==="현장소장"){masterName=clean(master?.manager_name);phone=clean(master?.manager_phone)}else if(jobTitle==="파트장"){masterName=clean(master?.part_name);phone=clean(master?.part_phone)}else{masterName=clean(master?.clerk_name);phone=clean(master?.clerk_phone)}
      let pinHash=clean(prev?.pin_hash);
      if(!pinHash&&masterName&&norm(masterName)===norm(name)){
        const digits=phone.replace(/\D/g,"");if(digits.length>=4){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(digits.slice(-4)));pinHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
      }
      if(!pinHash)return json({ok:false,message:"manager_phone_required"},400);
      const row:any={site_id:siteId,name,job_title:jobTitle,access_role:"field",active:p.active!==false,pin_hash:pinHash,updated_at:now,updated_by_id:v.id,updated_by_name:v.name,updated_by_role:v.role,updated_by_position:v.position,source:prev?.source||"app-v412"};
      let saved:any;if(prev){const q=await db.from("enl_site_personnel").update(row).eq("personnel_id",prev.personnel_id).select().single();if(q.error)throw q.error;saved=q.data}else{const q=await db.from("enl_site_personnel").insert({...row,created_at:now}).select().single();if(q.error)throw q.error;saved=q.data}
      await db.from("enl_personnel_audit").insert({personnel_id:saved.personnel_id,site_id:siteId,action:prev?"update":"create",editor_id:v.id,editor_name:v.name,editor_role:v.role,editor_position:v.position,changed_at:now,before_payload:prev||null,after_payload:saved});
      return json({ok:true,person:{...saved,pin_hash:undefined}});
    }

    if(action==="comment_list"){
      const incidentId=clean(body.incidentId);if(!incidentId)return json({ok:false,message:"incident_required"},400);const row=await incidentRow(incidentId);if(!row)return json({ok:false,message:"not_found"},404);
      if(['field','worker'].includes(v.role)&&clean(row.site_id)!==v.siteId)return json({ok:false,message:'site_forbidden'},403);
      if(v.role==='worker'&&clean(row.payload?.reporterId)!==v.id)return json({ok:false,message:'forbidden'},403);
      if(["manager","executive"].includes(v.role)&&!approved(row))return json({ok:false,message:"not_approved"},409);
      const {data,error}=await db.from("enl_incident_comments").select("*").eq("incident_id",incidentId).order("created_at",{ascending:true});if(error)throw error;return json({ok:true,comments:data||[]});
    }
    if(action==="comment_add"){
      if(!["manager","executive"].includes(v.role))return json({ok:false,message:"forbidden"},403);const incidentId=clean(body.incidentId),text=clean(body.body);if(!incidentId||!text)return json({ok:false,message:"input_required"},400);if(text.length>2000)return json({ok:false,message:"too_long"},400);
      const row=await incidentRow(incidentId);if(!approved(row))return json({ok:false,message:"not_approved"},409);
      const item={comment_id:uuid(),incident_id:incidentId,site_id:clean(row.site_id),author_id:v.id,author_name:v.name,author_role:v.role,author_position:v.position,body:text,safety_status:"new",created_at:now,updated_at:now};
      const {data,error}=await db.from("enl_incident_comments").insert(item).select().single();if(error)throw error;await incidentAudit(row,"update",v,null,data);return json({ok:true,comment:data});
    }
    if(action==="comment_read"||action==="comment_reply"){
      if(v.role!=="safety")return json({ok:false,message:"forbidden"},403);const id=clean(body.commentId);if(!id)return json({ok:false,message:"comment_required"},400);
      const {data:prev,error:pErr}=await db.from("enl_incident_comments").select("*").eq("comment_id",id).maybeSingle();if(pErr)throw pErr;if(!prev)return json({ok:false,message:"not_found"},404);
      const patch:any={safety_read_at:prev.safety_read_at||now,safety_read_by_id:v.id,safety_read_by_name:v.name,updated_at:now};
      if(action==="comment_reply"){const text=clean(body.body);if(!text)return json({ok:false,message:"reply_required"},400);if(text.length>2000)return json({ok:false,message:"too_long"},400);Object.assign(patch,{safety_status:"answered",reply_body:text,replied_at:now,replied_by_id:v.id,replied_by_name:v.name})}else if(clean(prev.safety_status)==="new")patch.safety_status="read";
      const {data,error}=await db.from("enl_incident_comments").update(patch).eq("comment_id",id).select().single();if(error)throw error;const row=await incidentRow(clean(prev.incident_id));if(row)await incidentAudit(row,"update",v,prev,data);return json({ok:true,comment:data});
    }

    if(action==="inquiry_create"){
      if(!["worker","field","manager","executive"].includes(v.role))return json({ok:false,message:"forbidden"},403);const category=INQUIRY_CATEGORIES.includes(clean(body.category))?clean(body.category):"기타",subject=clean(body.subject),text=clean(body.body);if(!subject||!text)return json({ok:false,message:"input_required"},400);if(subject.length>120||text.length>3000)return json({ok:false,message:"too_long"},400);
      const item={inquiry_id:uuid(),sender_id:v.id,sender_name:v.name,sender_role:v.role,sender_position:v.position,site_id:v.siteId||null,category,subject,body:text,status:"new",created_at:now,updated_at:now};const {data,error}=await db.from("enl_safety_inquiries").insert(item).select().single();if(error)throw error;return json({ok:true,inquiry:data});
    }
    if(action==="inquiry_my_list"){
      if(!["worker","field","manager","executive"].includes(v.role))return json({ok:false,message:"forbidden"},403);const {data,error}=await db.from("enl_safety_inquiries").select("*").eq("sender_id",v.id).is("deleted_at",null).order("created_at",{ascending:false}).limit(100);if(error)throw error;return json({ok:true,inquiries:data||[]});
    }
    if(action==="inquiry_safety_list"){
      if(v.role!=="safety")return json({ok:false,message:"forbidden"},403);let q=db.from("enl_safety_inquiries").select("*").order("created_at",{ascending:false}).limit(200);const deleted=body.deleted===true||clean(body.deleted)==="1";q=deleted?q.not("deleted_at","is",null):q.is("deleted_at",null);const status=clean(body.status);if(!deleted&&["new","read","answered","closed"].includes(status))q=q.eq("status",status);const {data,error}=await q;if(error)throw error;return json({ok:true,inquiries:data||[]});
    }
    if(action==="inquiry_count"){
      if(v.role!=="safety")return json({ok:false,message:"forbidden"},403);const {count,error}=await db.from("enl_safety_inquiries").select("inquiry_id",{count:"exact",head:true}).eq("status","new").is("deleted_at",null);if(error)throw error;return json({ok:true,count:count||0});
    }
    if(action==="inquiry_purge"){
      if(v.role!=="safety")return json({ok:false,message:"forbidden"},403);const id=clean(body.inquiryId);if(!id)return json({ok:false,message:"inquiry_required"},400);
      const {data:prev,error:pErr}=await db.from("enl_safety_inquiries").select("inquiry_id,deleted_at").eq("inquiry_id",id).maybeSingle();if(pErr)throw pErr;if(!prev)return json({ok:false,message:"not_found"},404);if(!prev.deleted_at)return json({ok:false,message:"not_deleted_inquiry"},409);
      const {error}=await db.from("enl_safety_inquiries").delete().eq("inquiry_id",id);if(error)throw error;return json({ok:true,deleted:true,inquiryId:id});
    }
    if(["inquiry_read","inquiry_reply","inquiry_close","inquiry_delete","inquiry_restore"].includes(action)){
      if(v.role!=="safety")return json({ok:false,message:"forbidden"},403);const id=clean(body.inquiryId);if(!id)return json({ok:false,message:"inquiry_required"},400);const {data:prev,error:pErr}=await db.from("enl_safety_inquiries").select("*").eq("inquiry_id",id).maybeSingle();if(pErr)throw pErr;if(!prev)return json({ok:false,message:"not_found"},404);
      const patch:any={updated_at:now};
      if(action==="inquiry_restore"){Object.assign(patch,{deleted_at:null,deleted_by_id:null,deleted_by_name:null});}
      else if(action==="inquiry_delete"){Object.assign(patch,{deleted_at:now,deleted_by_id:v.id,deleted_by_name:v.name});}
      else {
        if(prev.deleted_at)return json({ok:false,message:"deleted_inquiry"},409);
        if(action==="inquiry_read"){Object.assign(patch,{status:prev.status==="new"?"read":prev.status,safety_read_at:prev.safety_read_at||now,safety_read_by_id:v.id,safety_read_by_name:v.name})}
        if(action==="inquiry_reply"){const text=clean(body.body);if(!text)return json({ok:false,message:"reply_required"},400);if(text.length>3000)return json({ok:false,message:"too_long"},400);Object.assign(patch,{status:"answered",safety_read_at:prev.safety_read_at||now,safety_read_by_id:v.id,safety_read_by_name:v.name,answer_body:text,answered_at:now,answered_by_id:v.id,answered_by_name:v.name})}
        if(action==="inquiry_close")Object.assign(patch,{status:"closed",closed_at:now,safety_read_at:prev.safety_read_at||now,safety_read_by_id:v.id,safety_read_by_name:v.name});
      }
      const {data,error}=await db.from("enl_safety_inquiries").update(patch).eq("inquiry_id",id).select().single();if(error)throw error;return json({ok:true,inquiry:data});
    }
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){return json({ok:false,message:e?.message||"workflow_failed"},500)}
});