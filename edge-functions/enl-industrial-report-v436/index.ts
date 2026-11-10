import { hasHealth as Deno } from "../_shared/device-runtime.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const ORIGIN="https://enlsafety.github.io";
const APP="incident-report-v2";
const TEMPLATE_VERSION="moel-form30-2025-10-01";
const TEMPLATE_URL="https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110202&flSeq=156779685&gubun=";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-client-info, apikey, authorization, x-enl-app","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const parsePayload=(v:any)=>{if(v&&typeof v==="object")return v;if(typeof v==="string"){try{return JSON.parse(v)}catch{return null}}return null};
const actorFrom=(body:any)=>{const a=body?.actor||{};return {id:clean(a.id),name:clean(a.name)||"안전관리자",role:roleNorm(a.role),position:clean(a.position)};};
const source=(name:string,note="")=>({source:name,note,at:new Date().toISOString()});
const isBlank=(v:any)=>v===null||v===undefined||clean(v)==="";
const clone=(v:any)=>structuredClone(v);

function localParts(iso:any){
  const d=new Date(clean(iso));
  if(Number.isNaN(d.getTime()))return {date:"",time:"",weekday:""};
  const parts=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(d);
  const get=(t:string)=>parts.find(x=>x.type===t)?.value||"";
  return {date:`${get("year")}-${get("month")}-${get("day")}`,time:/^\d{4}-\d{2}-\d{2}$/.test(clean(iso))?"":`${get("hour")}:${get("minute")}`,weekday:get("weekday").replace("요일","")};
}
function defaultDraft(incident:any,site:any,person:any,actor:any){
  const d=incident?.reportDetails||{},lp=localParts(incident?.occurredAt),cause=[clean(d.environmentCause),clean(d.behaviorCause)].filter(Boolean).join(" / "),prevention=clean(incident?.corrective?.planDetail)||clean(d.preventionPlan);
  const fallbackCount=(Number(site?.regular_count)||0)+(Number(site?.daily_count)||0);
  const explicitCount=site?.total_count;
  const workerCount=(explicitCount===null||explicitCount===undefined)?fallbackCount:explicitCount;
  const injury=clean(d.diagnosis)||clean(d.injuryDetail);
  const draft={
    workplace:{industrialInsuranceNo:"",businessRegistrationNo:"",name:clean(site?.site_name)||clean(incident?.siteId),workerCount:workerCount?String(workerCount):"",industry:"",address:clean(site?.address),subcontracted:false,primeContractorName:"",primeInsuranceNo:"",dispatched:false,dispatchEmployerName:"",dispatchInsuranceNo:"",construction:false,ordererType:"",primeName:"",primeIndustrialInsuranceNo:"",constructionSiteName:"",constructionType:"",progressRate:"",constructionAmount:""},
    worker:{name:clean(d.injuredName)||clean(incident?.injuredName),rrnFront7:"",address:"",phone:clean(person?.phone),nationalityType:"domestic",nationality:"",visaStatus:"",occupation:clean(d.job)||clean(incident?.job),hireDate:"",sameJobYears:"",sameJobMonths:"",employmentType:"",employmentOther:"",workPattern:"normal",workPatternOther:"",injuryType:injury,injuryPart:"",expectedLeaveDays:"",fatal:false},
    accident:{occurredDate:lp.date,occurredTime:lp.time,weekday:lp.weekday,place:clean(d.place),relatedWorkType:clean(d.workAction),situation:clean(d.incidentHow),cause,preventionPlan:prevention},
    support:{techSupportRequested:false,workersCompGuideConsent:false},
    writer:{name:actor.name,phone:"",writtenDate:new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})},
    submission:{laborOffice:"",referenceNo:"",note:""}
  };
  const sources:any={};
  const put=(p:string,s:string,n="")=>sources[p]=source(s,n);
  put("workplace.name","사업장마스터","현장명 자동입력 - 법정 사업장명 확인 필요");if(draft.workplace.workerCount)put("workplace.workerCount","사업장마스터");if(draft.workplace.address)put("workplace.address","사업장마스터");
  put("worker.name","사고보고");if(draft.worker.phone)put("worker.phone","인사정보");if(draft.worker.occupation)put("worker.occupation","사고보고");if(draft.worker.injuryType)put("worker.injuryType","사고보고","진단명 또는 부상내용에서 자동입력 - 최종 확인 필요");
  put("accident.occurredDate","사고보고");put("accident.occurredTime","사고보고");put("accident.weekday","사고보고");if(draft.accident.place)put("accident.place","사고보고");if(draft.accident.relatedWorkType)put("accident.relatedWorkType","사고보고");if(draft.accident.situation)put("accident.situation","사고보고");if(draft.accident.cause)put("accident.cause",incident?.corrective?.rootCause?"안전관리자 원인분석":"사고보고");if(draft.accident.preventionPlan)put("accident.preventionPlan",incident?.corrective?.planDetail?"재발방지계획":"사고보고");put("writer.name","현재 사용자");put("writer.writtenDate","시스템");
  return {draft,sources};
}
function mergeBlank(target:any,auto:any,path="",sources:any={},autoSources:any={}){
  for(const [k,v] of Object.entries(auto||{})){const p=path?`${path}.${k}`:k;if(v&&typeof v==="object"&&!Array.isArray(v)){target[k]=target[k]&&typeof target[k]==="object"?target[k]:{};mergeBlank(target[k],v,p,sources,autoSources);}else if(isBlank(target[k])&&!isBlank(v)){target[k]=v;if(autoSources[p])sources[p]=autoSources[p];}}
}
function dataUrlBytes(dataUrl:string){const i=dataUrl.indexOf(",");if(i<0)throw new Error("invalid_overlay");const b64=dataUrl.slice(i+1);return Uint8Array.from(atob(b64),c=>c.charCodeAt(0));}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.method==="GET"){
    const url=new URL(req.url);if(url.searchParams.get("template")!=="1")return json({ok:false,message:"not_found"},404);
    try{const r=await fetch(TEMPLATE_URL,{headers:{"User-Agent":"Mozilla/5.0"}});if(!r.ok)throw new Error(`template_http_${r.status}`);const b=await r.arrayBuffer();return new Response(b,{status:200,headers:{...cors,"Content-Type":"application/pdf","Content-Disposition":"inline; filename=industrial-accident-form30-2025-10-01.pdf"}});}catch(e:any){return json({ok:false,message:String(e?.message||e)},502)}
  }
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  if(req.headers.get("x-enl-app")!==APP)return json({ok:false,message:"invalid_client"},403);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action);if(action==="health")return json({ok:true,templateVersion:TEMPLATE_VERSION});
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const actor=actorFrom(body),sql=postgres(dbUrl,{prepare:false,max:3,connect_timeout:5,idle_timeout:2});
  try{
    if(actor.role!=="safety"||!actor.id||!clean(body.actorPasswordHash))return json({ok:false,message:"forbidden"},403);
    const users=await sql`select user_id,name,role,active from public.enl_hq_users where user_id=${actor.id} and password_hash=${clean(body.actorPasswordHash)} limit 1`,user=users[0];
    if(!user||user.active===false||roleNorm(user.role)!=="safety")return json({ok:false,message:"forbidden"},403);
    actor.name=clean(user.name)||actor.name;
    const incidentId=clean(body.incidentId);if(!incidentId)return json({ok:false,message:"incident_required"},400);
    const ir=await sql`select incident_id,site_id,payload from public.enl_incident_active where incident_id=${incidentId} limit 1`,incidentRow=ir[0],incident=parsePayload(incidentRow?.payload);if(!incident)return json({ok:false,message:"incident_not_found"},404);
    if(clean(incident.category)!=="person")return json({ok:false,message:"person_incident_required"},409);
    const siteId=clean(incident.siteId)||clean(incidentRow.site_id),now=new Date().toISOString();
    const loadState=async()=>{const rows=await sql`select * from public.enl_industrial_accident_reports where incident_id=${incidentId} limit 1`;return rows[0]||null};
    const audit=async(actionName:string,before:any,after:any)=>{await sql`insert into public.enl_industrial_accident_report_audit(incident_id,action,editor_id,editor_name,changed_at,before_payload,after_payload) values(${incidentId},${actionName},${actor.id},${actor.name},${now},${before?JSON.stringify(before):null}::jsonb,${after?JSON.stringify(after):null}::jsonb)`};
    if(action==="get")return json({ok:true,state:await loadState(),templateVersion:TEMPLATE_VERSION});
    if(action==="bootstrap"||action==="set_decision"){
      const decision=clean(body.decision)||(action==="bootstrap"?"target":"pending");if(!["pending","target","non_target","deferred"].includes(decision))return json({ok:false,message:"invalid_decision"},400);
      const before=await loadState();let draft=before?.payload&&typeof before.payload==="object"?clone(before.payload):{},sources=before?.field_sources&&typeof before.field_sources==="object"?clone(before.field_sources):{};
      if(decision==="target"){
        const sr=await sql`select * from public.enl_site_master where site_id=${siteId} limit 1`,site=sr[0]||null,d=incident.reportDetails||{},victim=clean(d.injuredName)||clean(incident.injuredName),pr=victim?await sql`select personnel_id,name,phone,job_title from public.enl_site_personnel where site_id=${siteId} and active is not false and name=${victim} limit 1`:[],person=pr[0]||null,auto=defaultDraft(incident,site,person,actor);if(!Object.keys(draft).length){draft=auto.draft;sources=auto.sources}else mergeBlank(draft,auto.draft,"",sources,auto.sources);
      }
      const reason=clean(body.reason)||clean(before?.decision_reason);const status=decision==="target"?(clean(before?.status)||"draft"):"draft";
      const saved=await sql`insert into public.enl_industrial_accident_reports(incident_id,site_id,decision,decision_reason,status,template_version,payload,field_sources,created_by_id,created_by_name,updated_by_id,updated_by_name,created_at,updated_at) values(${incidentId},${siteId},${decision},${reason},${status},${TEMPLATE_VERSION},${JSON.stringify(draft)}::jsonb,${JSON.stringify(sources)}::jsonb,${actor.id},${actor.name},${actor.id},${actor.name},${now},${now}) on conflict(incident_id) do update set decision=excluded.decision,decision_reason=excluded.decision_reason,status=excluded.status,template_version=excluded.template_version,payload=excluded.payload,field_sources=excluded.field_sources,updated_by_id=excluded.updated_by_id,updated_by_name=excluded.updated_by_name,updated_at=excluded.updated_at returning *`;
      await audit(action==="bootstrap"?"bootstrap":"set_decision",before,saved[0]);return json({ok:true,state:saved[0]});
    }
    if(action==="save"){
      const before=await loadState();if(!before||clean(before.decision)!=="target")return json({ok:false,message:"target_required"},409);if(clean(before.status)==="submitted")return json({ok:false,message:"submitted_locked"},409);
      const payload=body.payload&&typeof body.payload==="object"?body.payload:null,fieldSources=body.fieldSources&&typeof body.fieldSources==="object"?body.fieldSources:{};if(!payload)return json({ok:false,message:"payload_required"},400);
      const saved=await sql`update public.enl_industrial_accident_reports set payload=${JSON.stringify(payload)}::jsonb,field_sources=${JSON.stringify(fieldSources)}::jsonb,status=${clean(body.status)==="ready"?"ready":"draft"},updated_by_id=${actor.id},updated_by_name=${actor.name},updated_at=${now} where incident_id=${incidentId} returning *`;await audit("save",before,saved[0]);return json({ok:true,state:saved[0]});
    }
    if(action==="mark_submitted"){
      const before=await loadState();if(!before||clean(before.decision)!=="target")return json({ok:false,message:"target_required"},409);if(clean(before.status)!=="ready")return json({ok:false,message:"ready_required"},409);const ref=clean(body.referenceNo)||clean(before.submission_ref);const saved=await sql`update public.enl_industrial_accident_reports set status='submitted',submission_ref=${ref},submitted_by_id=${actor.id},submitted_by_name=${actor.name},submitted_at=${now},updated_by_id=${actor.id},updated_by_name=${actor.name},updated_at=${now} where incident_id=${incidentId} returning *`;await audit("mark_submitted",before,saved[0]);return json({ok:true,state:saved[0]});
    }
    if(action==="reopen_correction"){
      const before=await loadState();if(!before||clean(before.status)!=="submitted")return json({ok:false,message:"submitted_required"},409);const saved=await sql`update public.enl_industrial_accident_reports set status='draft',revision=revision+1,submission_ref='',submitted_by_id='',submitted_by_name='',submitted_at=null,updated_by_id=${actor.id},updated_by_name=${actor.name},updated_at=${now} where incident_id=${incidentId} returning *`;await audit("reopen_correction",before,saved[0]);return json({ok:true,state:saved[0]});
    }
    if(action==="render_pdf"){
      const state=await loadState();if(!state||clean(state.decision)!=="target")return json({ok:false,message:"target_required"},409);if(!["ready","submitted"].includes(clean(state.status)))return json({ok:false,message:"ready_required"},409);const overlay=clean(body.overlayPng);if(!overlay.startsWith("data:image/png;base64,"))return json({ok:false,message:"overlay_required"},400);
      const tr=await fetch(TEMPLATE_URL,{headers:{"User-Agent":"Mozilla/5.0"}});if(!tr.ok)return json({ok:false,message:`template_http_${tr.status}`},502);const template=await tr.arrayBuffer(),pdf=await PDFDocument.load(template),pages=pdf.getPages();if(!pages.length)return json({ok:false,message:"template_invalid"},502);const png=await pdf.embedPng(dataUrlBytes(overlay)),p=pages[0],size=p.getSize();p.drawImage(png,{x:0,y:0,width:size.width,height:size.height});const out=await pdf.save();return new Response(out,{status:200,headers:{...cors,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename=industrial-accident-${incidentId}.pdf`}});
    }
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){return json({ok:false,message:String(e?.message||e)},500)}finally{await sql.end({timeout:1}).catch(()=>{})}
});