import "./site-contract-v451.js";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const APP="incident-report-v2";
const VERSION="4.4.24-contract-status1";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-client-info, apikey, authorization, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const norm=(v:any)=>clean(v).replace(/\s+/g,"").toLocaleLowerCase("ko-KR");
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const parsePayload=(v:any)=>{if(v&&typeof v==="object")return v;if(typeof v==="string"){try{return JSON.parse(v)}catch{return null}}return null};
const versionOf=(v:any)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.trunc(n):0;};
function actorFrom(body:any){const a=body?.actor||{};return {id:clean(a.id),name:clean(a.name)||"사용자",role:roleNorm(a.role||body?.role),position:clean(a.position),siteId:clean(a.siteId||body?.siteId)};}
async function verifyActor(sql:any,body:any,strong=false){
  const a=actorFrom(body);
  if(!a.id||!["worker","field","safety","manager","executive"].includes(a.role))return null;
  if(["safety","manager","executive"].includes(a.role)){
    const rows=await sql`select user_id,name,role,position,active,password_hash from public.enl_hq_users where user_id=${a.id} limit 1`,u=rows[0];
    if(!u||u.active===false||roleNorm(u.role)!==a.role)return null;
    const hash=clean(body?.actorPasswordHash),stored=clean(u.password_hash);
    if(strong&&(!stored||hash!==stored))return null;
    return {id:clean(u.user_id),name:clean(u.name),role:roleNorm(u.role),position:clean(u.position),siteId:"",hasCredential:!!stored,proof:strong?"password":"account"};
  }
  const rows=await sql`select personnel_id::text as personnel_id,site_id,name,job_title,active,access_role,pin_hash from public.enl_site_personnel where personnel_id::text=${a.id} limit 1`,u=rows[0];
  if(!u||u.active===false||clean(u.site_id)!==a.siteId||clean(u.access_role)!==a.role)return null;
  const hash=clean(body?.actorPinHash),stored=clean(u.pin_hash);
  if(strong&&stored&&hash!==stored)return null;
  return {id:clean(u.personnel_id),name:clean(u.name),role:clean(u.access_role),position:clean(u.job_title),siteId:clean(u.site_id),hasCredential:!!stored,proof:strong&&stored?"pin":"account"};
}
const enc=new TextEncoder();
async function sha256Hex(v:string){const b=await crypto.subtle.digest("SHA-256",enc.encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function canonicalValue(v:any):any{if(Array.isArray(v))return v.map(canonicalValue);if(v&&typeof v==="object"){const o:any={};for(const k of Object.keys(v).sort())o[k]=canonicalValue(v[k]);return o;}return v}
function reportForHash(i:any){if(!i||typeof i!=="object")return {};const x=structuredClone(i);for(const k of ["status","priority","prioritySource","prioritySetBy","prioritySetAt","legalReview","safetyNote","approvedBy","approvedAt","rejectedBy","rejectedAt","rejectionNote","closedAt","corrective","readReceipts","acknowledgements","reportWorkflow","reviewHistory","lifecycleHistory","officialRecord","updatedAt","lastModifiedBy","lastModifiedRole","lastModifiedPosition","lastModifiedAt","resubmittedBy","resubmittedById","resubmittedAt","reopenedBy","reopenedAt","reopenReason","_syncBaseVersion","_syncVersion","_syncMutationId"])delete x[k];return canonicalValue(x)}
async function reportHash(i:any){return sha256Hex(JSON.stringify(reportForHash(i)))}
function finalForHash(i:any){const x=structuredClone(i||{});if(x.officialRecord){x.officialRecord={...x.officialRecord};delete x.officialRecord.reportHash;delete x.officialRecord.finalHash;}for(const k of ["updatedAt","lastModifiedAt","readReceipts","acknowledgements","_syncBaseVersion","_syncVersion","_syncMutationId"])delete x[k];return canonicalValue(x)}
async function finalHash(i:any){return sha256Hex(JSON.stringify(finalForHash(i)))}
function attachmentEntries(i:any){
  const out:any[]=[];const add=(arr:any[],scope:string)=>{for(const f of Array.isArray(arr)?arr:[]){const name=clean(f?.name||f?.fileName),url=clean(f?.url||f?.storageUrl||f?.dataUrl),path=clean(f?.path||f?.storagePath),id=clean(f?.id);const key=[scope,id,path,url,name,clean(f?.size)].join("|");out.push({key,scope,name,id,path,url:url?url.slice(0,240):""})}};
  add(i?.photos||[],"report");add(i?.supplement?.attachments||[],"supplement");add(i?.corrective?.afterPhotos||[],"corrective");return out;
}
function attachmentDiff(prev:any,next:any){
  const a=attachmentEntries(prev),b=attachmentEntries(next),am=new Map(a.map(x=>[x.key,x])),bm=new Map(b.map(x=>[x.key,x]));
  return {added:[...bm].filter(([k])=>!am.has(k)).map(([,v])=>v),removed:[...am].filter(([k])=>!bm.has(k)).map(([,v])=>v)};
}
async function writeAudit(sql:any,id:string,siteId:string,action:string,actor:any,before:any,after:any,at:string){
  await sql`insert into public.enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload) values(${id},${siteId},${action},${actor.id},${actor.name},${actor.role},${actor.position},${at},${before?JSON.stringify(before):null}::jsonb,${after?JSON.stringify(after):null}::jsonb)`;
}
function semanticAction(prev:any,next:any,requestedStatus:string,prevReportHash:string,nextReportHash:string){
  if(!prev)return "create";
  if(["approved","closed"].includes(clean(prev.status))&&prevReportHash!==nextReportHash)return "post_approval_revision";
  if(requestedStatus==="supplement"&&clean(prev.status)!=="supplement")return "supplement_request";
  if(requestedStatus==="supplement_submitted"&&clean(prev.status)==="supplement")return "supplement_submit";
  if(requestedStatus==="supplement_submitted"&&clean(prev.status)==="supplement_submitted")return "supplement_resubmit";
  if(requestedStatus==="rejected"&&clean(prev.status)!=="rejected")return "reject";
  if(requestedStatus==="approved"&&!["approved","closed"].includes(clean(prev.status)))return "approve";
  if(clean(next.status)==="closed"&&clean(prev.status)!=="closed")return "final_approval";
  const a=clean(prev?.corrective?.status),b=clean(next?.corrective?.status);
  if(a!==b&&b==="submitted")return "corrective_submit";
  if(a!==b&&b==="rejected")return "corrective_reject";
  if(a!==b&&b==="approved")return "corrective_approve";
  return "update";
}
function isHistoricalTransfer(i:any){
  if(!i||typeof i!=="object")return false;
  const h=i.historicalImport&&typeof i.historicalImport==="object"?i.historicalImport:{};
  return clean(i.recordMode)==="historical_transfer"
    || clean(i?.historicalTransfer?.mode)==="historical_transfer"
    || (h.enabled===true&&h.erpApproved===true&&h.workflowExempt===true&&clean(h.transferState)==="closed");
}
function historicalMeta(i:any){
  const t=i?.historicalTransfer&&typeof i.historicalTransfer==="object"?i.historicalTransfer:{};
  const h=i?.historicalImport&&typeof i.historicalImport==="object"?i.historicalImport:{};
  const evidence=clean(t.existingActionEvidence)||clean(h.existingActionStatus)||"none";
  const followType=clean(t?.followUp?.type)||(clean(h.additionalAction)==="field_check"?"site_check":clean(h.additionalAction)==="new_improvement"?"improvement":"none");
  return {
    erpApproved:t.erpApproved===true||h.erpApproved===true,
    erpApprovalDate:clean(t.erpApprovalDate||h.erpApprovalDate),
    erpReference:clean(t.erpReference||h.erpApprovalRef),
    originalReporterName:clean(t.originalReporterName||h.originalReporterName),
    existingActionEvidence:evidence==="not_available"?"none":evidence,
    existingActionSummary:clean(t.existingActionSummary||h.existingActionNote),
    followType,
    followStatus:clean(t?.followUp?.status)||(followType==="none"?"not_required":"open"),
    followNote:clean(t?.followUp?.note||h.additionalActionNote),
    transferredBy:clean(t.transferredBy||h.transferredByName),
    transferredAt:clean(t.transferredAt||h.transferredAt),
    closedAt:clean(t.closedAt||h.closedAt),
    closeReason:clean(t.closeReason||h.closureReason)
  };
}
function isMine(i:any,a:any){if(!i||!a||isHistoricalTransfer(i))return false;const rid=clean(i.reporterId);if(rid&&a.id&&rid===a.id)return true;return !!(clean(i.reporterName)&&a.name&&norm(i.reporterName)===norm(a.name));}
function reportApproved(i:any){return ["approved","closed"].includes(clean(i?.status));}
function reportVisibleToReaders(i:any){return ["reported","supplement","supplement_submitted","approved","closed"].includes(clean(i?.status));}
function redact(v:any,names:any[]=[]){let s=clean(v).replace(/\s+/g," ");for(const n0 of names){const n=clean(n0);if(n&&n.length>=2)s=s.split(n).join("근로자");}s=s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[이메일 비공개]");s=s.replace(/(?:01[016789]|02|0[3-6][1-5])-?\d{3,4}-?\d{4}/g,"[연락처 비공개]");s=s.replace(/\b\d{6}-?[1-4]\d{6}\b/g,"[개인정보 비공개]");return s;}
function readerIncident(i:any){
  if(!i||!reportVisibleToReaders(i))return null;
  const out=structuredClone(i);
  const d=out?.reportDetails&&typeof out.reportDetails==="object"?out.reportDetails:{};
  if(clean(out.category)==="person"){
    delete d.diagnosis;delete d.doctorOpinion;delete d.medicalCostDetail;
    if(out.supplement&&typeof out.supplement==="object"){
      out.supplement={...out.supplement,attachments:[],medicalDocumentRestricted:true};
    }
  }
  out.reportDetails=d;
  const c=out.corrective;
  if(!c||typeof c!=="object")out.corrective=null;
  else if(clean(c.status)!=="approved")out.corrective=clean(c.status)?{status:clean(c.status)}:null;
  return out;
}
function publicSummary(i:any){
  const d=i?.reportDetails||{},hist=isHistoricalTransfer(i),hm=historicalMeta(i),c=i?.corrective||{},actionApproved=clean(c.status)==="approved",names=[i?.injuredName,i?.reporterName,i?.approvedBy,c?.ownerName,c?.submittedBy,c?.reviewedBy],place=redact(d.place||i?.place||"",names),work=redact(d.workAction||"",names),how=redact(d.incidentHow||"",names),type=redact(i?.eventType||"사고",names);
  let overview=[place?`${place}에서`:"",work?`${work} 중`:"",how].filter(Boolean).join(" ");
  if(!overview)overview=hist?`${type} 관련 과거사고 이관자료입니다.`:`${type} 관련 사고가 발생하여 안전관리자가 검토·승인하였습니다.`;
  if(hist){
    const ev=hm.existingActionEvidence==="confirmed"?"확인됨":hm.existingActionEvidence==="partial"?"일부 확인":"확인자료 없음";
    const follow=hm.followType==="site_check"?"현장 확인 필요":hm.followType==="improvement"?"신규 개선조치 필요":"추가조치 없음";
    return {occurredDate:clean(i?.occurredAt).slice(0,10),eventType:type||"안전사고",category:clean(i?.category),place,overview,cause:"기존 ERP 기결재 사고자료 이관",preventiveAction:hm.existingActionSummary?redact(hm.existingActionSummary,names):`기존 조치자료: ${ev}`,actionStatus:`과거사고 이관종결 · ${follow}`,approvedAt:"",publishedAt:clean(i?.updatedAt||hm.transferredAt)};
  }
  const cause=actionApproved?(redact(c.rootCause||"",names)||"승인된 사고조치의 원인 분석 내용을 확인하고 있습니다."):"사고조치는 사고보고와 별도로 작성·검토됩니다.";
  const action=actionApproved?(redact(c.actionDetail||"",names)||"안전관리자가 승인한 재발방지 조치를 시행했습니다."):clean(c.status)==="submitted"?"사고조치가 안전관리자 검토대기 중입니다.":clean(c.status)==="rejected"?"사고조치가 반려되어 수정 중입니다.":clean(c.status)?"사고조치를 작성·진행 중입니다.":"승인된 사고보고에 대한 사고조치가 아직 작성되지 않았습니다.";
  const actionStatus=actionApproved?"사고조치 승인완료":clean(c.status)==="submitted"?"사고조치 검토대기":clean(c.status)==="rejected"?"사고조치 반려":clean(c.status)?"사고조치 진행 중":"사고조치 미작성";
  return {occurredDate:clean(i?.occurredAt).slice(0,10),eventType:type||"안전사고",category:clean(i?.category),place,overview,cause,preventiveAction:action,actionStatus,approvedAt:clean(i?.approvedAt),publishedAt:clean(i?.updatedAt||i?.approvedAt)};
}
function publicIncident(i:any){
  const hist=isHistoricalTransfer(i);
  if(!i||!reportApproved(i)||(!hist&&!clean(i.approvedAt)))return null;
  const p=publicSummary(i),hm=historicalMeta(i);
  return {id:clean(i.id),siteId:clean(i.siteId),status:clean(i.status),approvedAt:hist?"":clean(i.approvedAt),updatedAt:clean(i.updatedAt||i.approvedAt||hm.transferredAt),category:p.category,eventType:p.eventType,occurredAt:p.occurredDate,workerPublicOnly:true,workerPublic:p,publicSummary:p,corrective:hist?null:(i?.corrective?.status?{status:clean(i.corrective.status)}:null),recordMode:hist?"historical_transfer":undefined,historicalImport:hist?{enabled:true,erpApproved:true,workflowExempt:true,transferState:"closed",additionalAction:hm.followType==="site_check"?"field_check":hm.followType==="improvement"?"new_improvement":"none"}:undefined,historicalTransfer:hist?{mode:"historical_transfer",status:"closed",erpApproved:true,followUp:{type:hm.followType,status:hm.followStatus}}:undefined};
}
function stableValue(v:any):any{if(Array.isArray(v))return v.map(stableValue);if(v&&typeof v==="object"){const out:any={};for(const k of Object.keys(v).sort())out[k]=stableValue(v[k]);return out;}return v;}
function comparableIncident(v:any){if(!v||typeof v!=="object")return v;const x=structuredClone(v);for(const k of ["updatedAt","lastModifiedBy","lastModifiedRole","lastModifiedPosition","lastModifiedAt","_syncBaseVersion","_syncVersion","_syncMutationId"])delete x[k];if(x.corrective&&typeof x.corrective==="object")for(const k of ["lastModifiedBy","lastModifiedRole","lastModifiedPosition","lastModifiedAt"])delete x.corrective[k];return JSON.stringify(stableValue(x));}
function preserveWorkflow(prev:any,next:any,actor:any){
  if(!prev||!["worker","field"].includes(actor?.role))return next;
  const out={...next},isFieldManager=actor.role==="field"&&["현장소장","파트장","서무"].includes(clean(actor.position));
  const allowSupplement=isFieldManager&&clean(prev.status)==="supplement"&&clean(next.status)==="supplement_submitted";
  for(const k of ["status","approvedBy","approvedAt","closedAt","safetyNote","legalReview"]){if(k in prev)out[k]=prev[k];}
  if(allowSupplement){
    out.status="supplement_submitted";
    out.supplement={...(prev.supplement||{}),...(next.supplement||{}),status:"submitted",submittedBy:actor.name,submittedById:actor.id,submittedAt:new Date().toISOString()};
  }else if(prev.supplement)out.supplement=prev.supplement;
  if(prev.corrective&&out.corrective){out.corrective={...out.corrective,reviewNote:prev.corrective.reviewNote||"",reviewedBy:prev.corrective.reviewedBy||"",reviewedAt:prev.corrective.reviewedAt||null};if(prev.corrective.status==="approved")out.corrective.status="approved";}
  return out;
}
function normalizeLifecycle(prev:any,next:any,actor:any,now:string){
  if(isHistoricalTransfer(next)){
    const hm=historicalMeta(next);
    next.status="closed";
    next.corrective=null;
    next.approvedBy="";
    next.approvedAt=null;
    next.closedAt=hm.closedAt||clean(next.closedAt)||now;
    return next;
  }
  if(prev&&clean(prev.status)==="closed"&&clean(next.status)==="reported"&&clean(prev?.corrective?.status)==="approved"){
    const source=next.corrective&&typeof next.corrective==="object"?next.corrective:prev.corrective||{},history=Array.isArray(source.reviewHistory)?[...source.reviewHistory]:[];history.push({action:"recheck_required",by:clean(next.resubmittedBy)||actor.name,at:now,note:"종결된 사고보고 수정으로 사고조치 재검토 필요"});next.corrective={...source,status:"submitted",submittedAt:now,reviewNote:"",reviewedBy:"",reviewedAt:null,reReviewReason:"종결된 사고보고 수정으로 재검토 필요",reviewHistory:history};next.approvedBy="";next.approvedAt=null;next.closedAt=null;next.rejectionNote="";next.readReceipts=[];
  }
  const cs=clean(next?.corrective?.status);if(clean(next.status)==="closed"&&cs!=="approved"){next.status=clean(next.approvedAt)?"approved":"reported";next.closedAt=null;}if(clean(next.status)==="approved"&&cs==="approved"){next.status="closed";next.closedAt=clean(next.corrective?.reviewedAt)||now;}return next;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==APP)return json({ok:false,message:"invalid_client"},403);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action);if(action==="health")return json({ok:true,version:VERSION});
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const now=new Date().toISOString(),sql=postgres(dbUrl,{prepare:false,max:4,connect_timeout:5,idle_timeout:2});
  try{
    let actor=await verifyActor(sql,body,false);if(!actor)return json({ok:false,message:"forbidden"},403);

    // Shared dashboard: authenticated HQ read access, no incident content or writes.
    if(action==="dashboard_read"){
      if(!["safety","manager","executive"].includes(actor.role))return json({ok:false,message:"forbidden"},403);
      const verified=await verifyActor(sql,body,true);
      if(!verified)return json({ok:false,message:"auth_proof_required"},403);
      const sites=await sql`select site_id,site_name,site_type,region,address,regular_count,daily_count,total_count,manager_name,part_name,clerk_name,active,start_date,contract_end_date from public.enl_site_master order by site_name`;
      const metrics=await sql`select site_id as "siteId",payload->>'occurredAt' as "occurredAt",payload->>'status' as status,payload->>'category' as category,payload->>'priority' as priority,payload->>'severity' as severity,payload->'potentialMajor' as "potentialMajor",payload->>'recordMode' as "recordMode",payload->'historicalTransfer'->>'mode' as "transferMode",payload->'historicalImport'->'enabled' as "historicalEnabled" from public.enl_incident_shared`;
      return json({ok:true,sites,metrics:metrics.map((i:any)=>({...i,historicalTransfer:{mode:i.transferMode},historicalImport:{enabled:i.historicalEnabled===true}}))});
    }

    if(action==="approval_roster"){
      if(!["safety","manager","executive"].includes(actor.role))return json({ok:false,message:"forbidden"},403);
      const users=await sql`select user_id,name,role,position,department from public.enl_hq_users where active=true and role in ('safety','manager','executive','final') order by name`;
      return json({ok:true,users:users.map((u:any)=>({id:clean(u.user_id),name:clean(u.name),role:roleNorm(u.role),position:clean(u.position),department:clean(u.department)}))});
    }

    if(action==="pull"){
      if(!["worker","field","safety","manager","executive"].includes(actor.role))return json({ok:false,message:"forbidden"},403);
      let rows:any[];if(["worker","field"].includes(actor.role)){if(!actor.siteId)return json({ok:false,message:"site_required"},400);rows=await sql`select payload from public.enl_incident_shared where site_id=${actor.siteId} order by updated_at desc`;}else rows=await sql`select payload from public.enl_incident_shared order by updated_at desc`;
      const raw=rows.map((r:any)=>parsePayload(r.payload)).filter(Boolean);
      if(actor.role==="worker"){const incidents:any[]=[];for(const i of raw){if(isMine(i,actor)){const mine={...i};if(reportApproved(i)&&clean(i.approvedAt))mine.workerPublic=publicSummary(i);incidents.push(mine);}else{const pub=publicIncident(i);if(pub)incidents.push(pub);}}incidents.sort((a,b)=>new Date(b.occurredAt||0).getTime()-new Date(a.occurredAt||0).getTime());return json({ok:true,incidents,workerPublicMode:true});}
      if(["manager","executive"].includes(actor.role))return json({ok:true,incidents:raw.map(readerIncident).filter(Boolean)});
      return json({ok:true,incidents:raw});
    }

    if(action==="acknowledge"){
      if(!["field","safety","manager","executive"].includes(actor.role))return json({ok:false,message:"forbidden"},403);
      if(actor.role==="field"&&!["현장소장","파트장","서무"].includes(clean(actor.position)))return json({ok:false,message:"forbidden"},403);
      const strong=await verifyActor(sql,body,true);if(!strong)return json({ok:false,message:"auth_proof_required"},403);actor=strong;
      const incidentId=clean(body.incidentId),documentType=clean(body.documentType)||"incident_report";if(!incidentId)return json({ok:false,message:"incident_required"},400);
      if(!["incident_report","corrective_action"].includes(documentType))return json({ok:false,message:"invalid_document_type"},400);
      const rows=await sql`select incident_id,site_id,payload from public.enl_incident_shared where incident_id=${incidentId} limit 1`,row=rows[0];if(!row)return json({ok:false,message:"not_found"},404);
      const prev=parsePayload(row.payload);if(actor.role==="field"&&clean(row.site_id)!==actor.siteId)return json({ok:false,message:"forbidden"},403);
      if(documentType==="incident_report"){
        if(!reportVisibleToReaders(prev))return json({ok:false,message:"not_available"},409);
        if(!reportApproved(prev)&&!["safety","manager","executive"].includes(actor.role))return json({ok:false,message:"not_approved"},409);
      }
      if(documentType==="corrective_action"&&clean(prev?.corrective?.status)!=="approved")return json({ok:false,message:"action_not_approved"},409);
      const acknowledgements=Array.isArray(prev.acknowledgements)?prev.acknowledgements.filter((x:any)=>!(clean(x.userId)===actor.id&&clean(x.documentType)===documentType)):[];
      const receipt={documentType,userId:actor.id,name:actor.name,role:actor.role,position:actor.position,siteId:actor.siteId,readAt:now,ackAt:now,label:documentType==="incident_report"?"관리자 확인결재(순차 독립)":"조치 확인기록(결재 아님)"};
      acknowledgements.push(receipt);
      const next={...prev,acknowledgements,updatedAt:now};
      if(documentType==="incident_report"&&["manager","executive"].includes(actor.role)){
        const legacy=Array.isArray(prev.readReceipts)?prev.readReceipts.filter((x:any)=>clean(x.userId)!==actor.id):[];legacy.push({userId:actor.id,name:actor.name,role:actor.role,position:actor.position,readAt:now});next.readReceipts=legacy;
      }
      await sql`update public.enl_incident_shared set payload=${JSON.stringify(next)}::jsonb,updated_at=${now} where incident_id=${incidentId}`;
      await writeAudit(sql,incidentId,clean(row.site_id),"acknowledge",actor,prev,next,now);
      const responseIncident=actor.role==="manager"||actor.role==="executive"?readerIncident(next):next;
      return json({ok:true,receipt,incident:responseIncident});
    }

    if(action==="push"){
      if(!["worker","field","safety"].includes(actor.role))return json({ok:false,message:"forbidden"},403);
      if(actor.role==="safety"||(actor.role==="field"&&actor.hasCredential)){const strong=await verifyActor(sql,body,true);if(!strong)return json({ok:false,message:"auth_proof_required"},403);actor=strong;}
      const incoming=Array.isArray(body.incidents)?body.incidents:[],deletedIds=(Array.isArray(body.deletedIds)?body.deletedIds:[]).map(clean).filter(Boolean);
      if(deletedIds.length)return json({ok:false,message:"delete_requires_compliance_api"},409);
      let pushed=0,ignored=0;
      for(const raw0 of incoming){
        if(!raw0||typeof raw0!=="object")continue;const id=clean(raw0.id),siteId=clean(raw0.siteId);if(!id||!siteId)continue;if(["worker","field"].includes(actor.role)&&siteId!==actor.siteId)continue;
        const incomingHistorical=isHistoricalTransfer(raw0);
        if(incomingHistorical){
          if(actor.role!=="safety")return json({ok:false,message:"historical_transfer_safety_only"},403);
          const hm=historicalMeta(raw0);
          if(!hm.erpApproved||clean(raw0.status)!=="closed")return json({ok:false,message:"invalid_historical_transfer"},400);
        }
        const rr=await sql`select incident_id,site_id,payload,created_at from public.enl_incident_shared where incident_id=${id} limit 1`,row=rr[0],prev=parsePayload(row?.payload);
        if(actor.role==="worker"&&prev&&!isMine(prev,actor)){ignored++;continue;}
        if(prev&&isHistoricalTransfer(prev)&&actor.role!=="safety")return json({ok:false,message:"historical_transfer_locked"},403);
        if(prev&&isHistoricalTransfer(prev)&&!incomingHistorical)return json({ok:false,message:"historical_transfer_locked"},409);
        let next={...raw0,id,siteId};
        const contract=(globalThis as any).ENLContracts;
        const occurrenceDate=(i:any)=>{if(clean(i?.historicalTransfer?.occurredDate))return clean(i.historicalTransfer.occurredDate);const d=new Date(i?.occurredAt||"");return Number.isFinite(d.getTime())?new Date(d.getTime()+9*60*60*1000).toISOString().slice(0,10):""};
        if(!prev||clean(prev.siteId)!==siteId||occurrenceDate(prev)!==occurrenceDate(next)){
          const masterRows=await sql`select site_id,active,start_date,contract_end_date from public.enl_site_master where site_id=${siteId} limit 1`;
          const master=masterRows[0]||{site_id:siteId},date=occurrenceDate(next),check=contract.assess(master,date);
          const needsConfirmation=incomingHistorical&&(check.outsideContractPeriod===true||(check.currentStatus==="closed"&&check.statusAtOccurrence==="unknown"));
          const confirmed=actor.role==="safety"&&raw0.siteContractSnapshot?.confirmation?.confirmed===true;
          if(needsConfirmation&&!confirmed)return json({ok:false,message:"contract_period_confirmation_required",detail:check.warning},409);
          next.siteContractSnapshot=contract.snapshot(master,date,actor,needsConfirmation&&confirmed);
        }else if(prev.siteContractSnapshot)next.siteContractSnapshot=structuredClone(prev.siteContractSnapshot);
        else delete next.siteContractSnapshot;
        if(prev&&comparableIncident(next)===comparableIncident(prev)){ignored++;continue;}
        next=preserveWorkflow(prev,next,actor);
        const requestedStatus=clean(raw0.status),prevReportHash=prev?await reportHash(prev):"",candidateHash=await reportHash(next);
        if(prev&&["approved","closed"].includes(clean(prev.status))&&prevReportHash!==candidateHash){
          if(actor.role!=="safety")return json({ok:false,message:"approved_record_locked"},409);
          next.status="reported";
        }
        next=normalizeLifecycle(prev,next,actor,now);
        const official:any=structuredClone(prev?.officialRecord||next?.officialRecord||{});
        if(!prev){
          if(incomingHistorical){
            const hm=historicalMeta(next);
            next.reporterName=hm.originalReporterName||clean(next.reporterName)||"기존 ERP 자료";next.reporterId="";next.registeredAt=now;next.status="closed";next.corrective=null;next.approvedBy="";next.approvedAt=null;next.closedAt=hm.closedAt||now;
            official.transferRegistration={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,proof:actor.proof,source:"erp",erpApproved:true,erpApprovalDate:hm.erpApprovalDate,erpReference:hm.erpReference};
            official.originalReporter=hm.originalReporterName?{name:hm.originalReporterName,source:"erp_record"}:null;
          }else{
            next.reporterName=actor.name;next.reporterId=actor.id;next.registeredAt=now;
            official.reporter={id:actor.id,name:actor.name,role:actor.role,position:actor.position,siteId:actor.siteId,at:now,proof:actor.proof};
            if(actor.role!=="safety"){next.status="reported";next.safetyNote="";next.approvedBy="";next.approvedAt=null;next.closedAt=null;}
          }
        }else{next.reporterName=prev.reporterName||next.reporterName||(incomingHistorical?"기존 ERP 자료":actor.name);next.reporterId=prev.reporterId||next.reporterId||(incomingHistorical?"":actor.id);}
        const nextReportHash=await reportHash(next);
        if(prev&&["approved","closed"].includes(clean(prev.status))&&prevReportHash!==nextReportHash){
          official.revisions=Array.isArray(official.revisions)?official.revisions:[];
          official.revisions.push({fromHash:prevReportHash,toHash:nextReportHash,byId:actor.id,by:actor.name,role:actor.role,position:actor.position,at:now});
          official.approvalInvalidatedAt=now;official.approvalInvalidatedBy=actor.name;
        }
        if(requestedStatus==="supplement"&&actor.role==="safety"){
          next.status="supplement";next.approvedBy="";next.approvedAt=null;next.closedAt=null;
          next.supplement={...(next.supplement||{}),status:"waiting",requestedBy:actor.name,requestedById:actor.id,requestedAt:now};
          official.review={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,result:"supplement_requested",proof:actor.proof};
          official.reportHash="";
        }
        if(requestedStatus==="rejected"&&clean(prev?.status)!=="rejected"&&actor.role==="safety"){
          next.status="rejected";next.rejectedBy=actor.name;next.rejectedAt=now;next.approvedBy="";next.approvedAt=null;next.closedAt=null;
          official.review={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,result:"rejected",proof:actor.proof};
          official.reportHash="";
        }
        if(requestedStatus==="approved"&&!["approved","closed"].includes(clean(prev?.status))&&actor.role==="safety"){
          next.status="approved";next.approvedBy=actor.name;next.approvedAt=now;next.rejectionNote="";
          if(next.supplement&&typeof next.supplement==="object")next.supplement={...next.supplement,status:"accepted",approvedBy:actor.name,approvedById:actor.id,approvedAt:now};
          official.review={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,result:"approved",proof:actor.proof};
          official.approval={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,proof:actor.proof};
          official.reportHash=await reportHash(next);official.approvalInvalidatedAt=null;official.approvalInvalidatedBy="";
        }
        if(clean(next.status)==="approved"&&clean(next?.corrective?.status)==="approved"){next.status="closed";next.closedAt=clean(next.corrective?.reviewedAt)||now;}
        if(clean(next.status)==="closed"&&clean(prev?.status)!=="closed"&&actor.role==="safety"&&!isHistoricalTransfer(next)){
          next.closedAt=now;
          if(next.corrective&&typeof next.corrective==="object"){next.corrective={...next.corrective,status:"approved",reviewedBy:actor.name,reviewedAt:now};}
          official.finalApproval={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,proof:actor.proof};
        }
        if(isHistoricalTransfer(next)){const hm=historicalMeta(next);official.transferClosure={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now,source:"erp",erpApproved:true,erpApprovalDate:hm.erpApprovalDate,erpReference:hm.erpReference,existingActionEvidence:hm.existingActionEvidence,followUpType:hm.followType,closeReason:hm.closeReason||"ERP 기결재 과거사고 이력관리 목적 이관종결"};}
        official.lastModified={id:actor.id,name:actor.name,role:actor.role,position:actor.position,at:now};
        next.officialRecord=official;
        if(clean(next.status)==="closed"&&clean(prev?.status)!=="closed")next.officialRecord.finalHash=await finalHash(next);

        const prevCorr=JSON.stringify(prev?.corrective||null),nextCorr=JSON.stringify(next?.corrective||null);if(next.corrective&&prevCorr!==nextCorr)next.corrective={...next.corrective,lastModifiedBy:actor.name,lastModifiedRole:actor.role,lastModifiedPosition:actor.position,lastModifiedAt:now,submittedBy:next.corrective.submittedBy||actor.name};
        const hadBase=Object.prototype.hasOwnProperty.call(next,"_syncBaseVersion");if(!hadBase){next._syncBaseVersion=versionOf(prev?._syncVersion);next._syncMutationId=`edge:${actor.id||"user"}:${id}:${crypto.randomUUID()}`;}else if(!clean(next._syncMutationId))next._syncMutationId=`edge:${actor.id||"user"}:${id}:${crypto.randomUUID()}`;
        next.lastModifiedBy=actor.name;next.lastModifiedRole=actor.role;next.lastModifiedPosition=actor.position||(actor.role==="worker"?"일반근로자":"");next.lastModifiedAt=now;next.updatedAt=now;
        const saved=await sql`insert into public.enl_incident_shared(incident_id,site_id,payload,created_at,updated_at) values(${id},${siteId},${JSON.stringify(next)}::jsonb,${row?.created_at||now},${now}) on conflict(incident_id) do update set site_id=excluded.site_id,payload=excluded.payload,updated_at=excluded.updated_at returning payload`;
        const after=parsePayload(saved[0]?.payload)||next;
        const actionName=semanticAction(prev,after,requestedStatus,prevReportHash,nextReportHash);
        await writeAudit(sql,id,siteId,actionName,actor,prev,after,now);
        const ad=attachmentDiff(prev,after);
        if(ad.added.length)await writeAudit(sql,id,siteId,"attachment_add",actor,{attachments:[]},{attachments:ad.added},now);
        if(ad.removed.length)await writeAudit(sql,id,siteId,"attachment_delete",actor,{attachments:ad.removed},{attachments:[]},now);
        pushed++;
      }
      return json({ok:true,pushed,ignored,deleted:0});
    }
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){const m=String(e?.message||e);return json({ok:false,message:m},m.includes("enl_sync_conflict")||clean(e?.code)==="40001"?409:500)}finally{await sql.end({timeout:1}).catch(()=>{})}
});
