import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VERSION = "4.4.0-ai-team-mvp2";
const CLIENT = "incident-report-v2";
const DEFAULT_MODEL = Deno.env.get("AI_SAFETY_MODEL") || "gpt-5.6-terra";
const LEGAL_MODEL = Deno.env.get("AI_SAFETY_LEGAL_MODEL") || "gpt-5.6-sol";
const DIRECTOR_MODEL = Deno.env.get("AI_SAFETY_DIRECTOR_MODEL") || "gpt-5.6-sol";
const OFFICIAL_DOMAINS = ["law.go.kr", "moel.go.kr", "kosha.or.kr"];
const ALLOWED_ORIGINS = new Set(["https://enlsafety.github.io","http://127.0.0.1:8729","http://localhost:8729"]);
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const now=()=>new Date().toISOString();
const enc=new TextEncoder();

function cors(req:Request){const o=req.headers.get("origin")||"";const allow=o&&ALLOWED_ORIGINS.has(o)?o:"https://enlsafety.github.io";return {"Access-Control-Allow-Origin":allow,"Vary":"Origin","Access-Control-Allow-Headers":"content-type, x-enl-app, x-enl-session","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors(req)});
function b64uDecode(text:string){const base=text.replace(/-/g,"+").replace(/_/g,"/");const padded=base+"=".repeat((4-base.length%4)%4);return Uint8Array.from(atob(padded),c=>c.charCodeAt(0))}
async function verifySession(token:string,db:any){
  try{
    const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!secret||secret.length<32||!token||token.length>4096)return null;
    const parts=token.split(".");if(parts.length!==2)return null;
    const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
    const ok=await crypto.subtle.verify("HMAC",key,b64uDecode(parts[1]),enc.encode("enl-session-v1:"+parts[0]));if(!ok)return null;
    const claims=JSON.parse(new TextDecoder().decode(b64uDecode(parts[0])));if(claims?.v!==1||!claims.sub||!claims.role||!Number.isInteger(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))return null;
    const role=roleNorm(claims.role);if(!["safety","manager","executive"].includes(role))return null;
    const {data,error}=await db.from("enl_hq_users").select("user_id,name,role,position,active,password_hash").eq("user_id",String(claims.sub)).maybeSingle();
    if(error||!data||data.active===false||roleNorm(data.role)!==role)return null;
    const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode("enl-credential-v1:"+String(data.user_id)+":"+String(data.password_hash||""))));
    const credential=btoa(String.fromCharCode(...sig)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");if(credential!==claims.credential)return null;
    return {id:String(data.user_id),name:clean(data.name),role,position:clean(data.position),siteId:""};
  }catch{return null}
}

const RESULT_SCHEMA:any={type:"object",additionalProperties:false,properties:{summary:{type:"string"},facts:{type:"array",items:{type:"string"}},findings:{type:"array",items:{type:"object",additionalProperties:false,properties:{finding_type:{type:"string"},severity:{type:"string",enum:["info","low","medium","high","critical"]},title:{type:"string"},detail:{type:"string"},legal_obligation:{type:"string"},practical_recommendation:{type:"string"},uncertainty:{type:"string"},requires_human_approval:{type:"boolean"}},required:["finding_type","severity","title","detail","legal_obligation","practical_recommendation","uncertainty","requires_human_approval"]}},missing_information:{type:"array",items:{type:"string"}},official_sources:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},url:{type:"string"},source_type:{type:"string"}},required:["title","url","source_type"]}},confidence:{type:"number",minimum:0,maximum:1},recommended_disposition:{type:"string",enum:["automatic","human_review","urgent_human_review"]}},required:["summary","facts","findings","missing_information","official_sources","confidence","recommended_disposition"]};
function extractText(raw:any){const parts:string[]=[];for(const item of raw?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")parts.push(c.text);return parts.join("\n").trim()}
function officialUrl(url:string){try{const h=new URL(url).hostname.toLowerCase();return OFFICIAL_DOMAINS.some(d=>h===d||h.endsWith("."+d))}catch{return false}}
function normalizeResult(v:any){const out={...v};out.summary=clean(out.summary);out.facts=Array.isArray(out.facts)?out.facts.map(clean).filter(Boolean):[];out.missing_information=Array.isArray(out.missing_information)?out.missing_information.map(clean).filter(Boolean):[];out.findings=Array.isArray(out.findings)?out.findings:[];out.official_sources=(Array.isArray(out.official_sources)?out.official_sources:[]).filter((s:any)=>officialUrl(clean(s?.url))).map((s:any)=>({title:clean(s.title)||clean(s.url),url:clean(s.url),source_type:clean(s.source_type)||"공식자료"}));out.confidence=Math.max(0,Math.min(1,Number(out.confidence)||0));return out}
async function callAgent(opts:{name:string,model:string,instructions:string,input:any,web?:boolean,effort?:string}){
  const key=Deno.env.get("OPENAI_API_KEY")||"";if(!key)throw new Error("openai_not_configured");
  const body:any={model:opts.model,instructions:opts.instructions,input:JSON.stringify(opts.input),reasoning:{effort:opts.effort||"medium"},max_output_tokens:3500,text:{format:{type:"json_schema",name:"enl_ai_safety_result",strict:true,schema:RESULT_SCHEMA}}};
  if(opts.web)body.tools=[{type:"web_search",search_context_size:"medium",filters:{allowed_domains:OFFICIAL_DOMAINS}}];
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
  try{const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});const raw=await res.json();if(!res.ok)throw new Error("openai_"+(raw?.error?.code||res.status)+":"+clean(raw?.error?.message).slice(0,280));const text=extractText(raw);if(!text)throw new Error("openai_empty_output");let parsed:any;try{parsed=JSON.parse(text)}catch{throw new Error("openai_invalid_json")};return {result:normalizeResult(parsed),responseId:clean(raw?.id),model:clean(raw?.model)||opts.model,usage:raw?.usage||null}}finally{clearTimeout(timer)}
}
function sanitizeIncident(src:any){const c=src?.corrective||{};return {incident_id:clean(src?.id||src?.incidentId),site_id:clean(src?.siteId),site_name:clean(src?.siteName),occurred_at:clean(src?.occurredAt||src?.date||src?.incidentDate),category:clean(src?.category),event_type:clean(src?.eventType||src?.type),severity:clean(src?.severity),leave_estimate:clean(src?.leaveEstimate),potential_major:!!src?.potentialMajor,summary:clean(src?.summary||src?.description||src?.content).slice(0,6000),immediate_action:clean(src?.immediateAction||src?.actionTaken).slice(0,4000),status:clean(src?.status),priority:clean(src?.priority),legal_review_flag:!!src?.legalReview,legal_review_status:clean(src?.legalReviewStatus),corrective:{status:clean(c?.status),plan:clean(c?.plan||c?.content).slice(0,4000),completed_at:clean(c?.completedAt)}}}
const AGENT_INSTRUCTIONS={
 incident:`너는 이앤엘 사고관리 에이전트다. 현장 최초보고의 신속성을 해치지 않으면서 사고 사실을 구조화하고 누락·모순·원인 후보·즉시조치·재발방지 후보를 정리한다. 법률을 최종 판단하지 말고 법령검토가 필요한 쟁점을 명확히 표시한다. 입력에 없는 사실을 만들지 않는다. 사람 이름 등 개인정보를 요구하지 않는다. 중대 가능성이나 핵심 사실 부족은 사람 확인 대상으로 올린다. 한국어로 작성한다.`,
 legal:`너는 이앤엘 법령검토 에이전트다. 현재 대한민국 산업안전보건 관련 법적 의무를 검토한다. 반드시 최신 공식자료를 우선 검색하고 국가법령정보센터(law.go.kr), 고용노동부(moel.go.kr), 산업안전보건공단(kosha.or.kr)만 근거로 사용한다. 법적 의무/실무상 권장/확실하지 않음을 분리한다. KOSHA GUIDE를 법령과 동일시하지 않는다. 사실이 부족하면 법정 보고대상이라고 단정하지 말고 무엇을 확인해야 하는지 적는다. 법적 결론이 있으면 official_sources에 직접 확인한 공식 URL을 넣는다. 한국어로 작성한다.`,
 verify:`너는 이앤엘 문서·최종검증 에이전트다. 사고관리 결과와 법령검토 결과를 독립적으로 대조한다. 서로 모순되는 판단, 근거 없는 법적 단정, 공식 출처 누락, 날짜·사실 누락, 권고를 의무로 확대한 표현을 찾아낸다. 새 법률 결론을 임의로 만들지 말고 문제가 있으면 재검토 또는 사람 확인을 요구한다. 안전 쪽으로 보수적으로 검증하되 근거 없는 과잉 요구도 지적한다. 한국어로 작성한다.`,
 director:`너는 이앤엘 AI 안전본부장이다. 사고관리·법령검토·최종검증 결과를 종합해 사용자가 바로 판단할 수 있는 최종 업무보고를 만든다. 전문 에이전트의 불확실성이나 검증 경고를 숨기지 않는다. 법정 보고대상 최종확정, 외부기관 제출, 사고 종결 등 법적 책임이 수반되는 결론은 반드시 사람 승인을 요구한다. 중대재해 가능성·긴급 위험·법정기한 임박 가능성이 있으면 urgent_human_review로 올린다. 단순 초안·요약만 있고 중요한 쟁점이 없을 때만 automatic을 허용한다. 한국어로 작성한다.`};

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});if(req.method!=="POST")return json(req,{ok:false,message:"method_not_allowed"},405);
 const origin=req.headers.get("origin")||"";if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,{ok:false,message:"origin_not_allowed"},403);if(req.headers.get("x-enl-app")!==CLIENT)return json(req,{ok:false,message:"invalid_client"},403);
 let body:any={};try{body=await req.json()}catch{return json(req,{ok:false,message:"invalid_json"},400)}const action=clean(body.action);
 if(action==="health")return json(req,{ok:true,version:VERSION,openaiConfigured:!!Deno.env.get("OPENAI_API_KEY"),models:{default:DEFAULT_MODEL,legal:LEGAL_MODEL,director:DIRECTOR_MODEL}});
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!service)return json(req,{ok:false,message:"server_not_configured"},500);const db=createClient(url,service,{auth:{persistSession:false}});
 const actor=await verifySession(req.headers.get("x-enl-session")||"",db);if(!actor)return json(req,{ok:false,message:"session_required"},401);if(actor.role!=="safety")return json(req,{ok:false,message:"forbidden"},403);
 try{
  if(action==="list_workflows"){
   const limit=Math.max(1,Math.min(50,Number(body.limit)||30));let q=db.from("ai_workflows").select("id,source_type,source_id,task_type,status,priority,current_agent,input_summary,result_summary,requires_human_approval,requested_by,approved_by,approved_at,created_at,completed_at,updated_at").order("created_at",{ascending:false}).limit(limit);if(clean(body.status))q=q.eq("status",clean(body.status));const {data,error}=await q;if(error)throw error;return json(req,{ok:true,workflows:data||[]});
  }
  if(action==="get_workflow"){
   const id=clean(body.workflowId);if(!id)return json(req,{ok:false,message:"workflow_required"},400);const [{data:w,error:e1},{data:r,error:e2},{data:f,error:e3},{data:a,error:e4}]=await Promise.all([db.from("ai_workflows").select("*").eq("id",id).maybeSingle(),db.from("ai_agent_runs").select("*").eq("workflow_id",id).order("created_at"),db.from("ai_findings").select("*").eq("workflow_id",id).order("created_at"),db.from("ai_approvals").select("*").eq("workflow_id",id).order("created_at")]);if(e1||e2||e3||e4)throw(e1||e2||e3||e4);if(!w)return json(req,{ok:false,message:"not_found"},404);return json(req,{ok:true,workflow:w,runs:r||[],findings:f||[],approvals:a||[]});
  }
  if(action==="decide_workflow"){
   const id=clean(body.workflowId),decision=clean(body.decision);if(!id||!["approved","held","re_review"].includes(decision))return json(req,{ok:false,message:"invalid_decision"},400);const {data:pending,error:pErr}=await db.from("ai_approvals").select("id").eq("workflow_id",id).eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();if(pErr)throw pErr;if(!pending)return json(req,{ok:false,message:"approval_not_found"},409);const decided=now();const {error:aErr}=await db.from("ai_approvals").update({status:decision,decided_by:actor.id,decision_note:clean(body.note).slice(0,2000),decided_at:decided,updated_at:decided}).eq("id",pending.id);if(aErr)throw aErr;const nextStatus=decision==="approved"?"completed":decision==="held"?"on_hold":"re_review_requested";const patch:any={status:nextStatus,updated_at:decided};if(decision==="approved"){patch.completed_at=decided;patch.approved_by=actor.id;patch.approved_at=decided}const {error:wErr}=await db.from("ai_workflows").update(patch).eq("id",id);if(wErr)throw wErr;return json(req,{ok:true,workflowId:id,status:nextStatus});
  }
  if(action!=="review_incident")return json(req,{ok:false,message:"invalid_action"},400);if(!Deno.env.get("OPENAI_API_KEY"))return json(req,{ok:false,message:"openai_not_configured"},503);
  const incident=sanitizeIncident(body.incidentSnapshot||{});const incidentId=clean(body.incidentId||incident.incident_id);if(!incidentId)return json(req,{ok:false,message:"incident_required"},400);const created=now();
  const {data:w,error:wErr}=await db.from("ai_workflows").insert({source_type:"incident",source_id:incidentId,task_type:"incident_review",status:"running",priority:incident.potential_major?"urgent":"normal",current_agent:"incident_manager",input_summary:(incident.site_name?incident.site_name+" · ":"")+incident.summary.slice(0,600),requires_human_approval:true,requested_by:actor.id,created_at:created,started_at:created,updated_at:created}).select("*").single();if(wErr)throw wErr;const workflowId=w.id;
  async function runAgent(agentId:string,task:string,input:any,model:string,instructions:string,web=false,effort="medium"){
   const started=now();const {data:run,error:rErr}=await db.from("ai_agent_runs").insert({workflow_id:workflowId,agent_id:agentId,task_type:task,status:"running",model,input_payload:input,started_at:started,created_at:started}).select("*").single();if(rErr)throw rErr;await db.from("ai_workflows").update({current_agent:agentId,updated_at:started}).eq("id",workflowId);
   try{const ai=await callAgent({name:agentId,model,instructions,input,web,effort});const done=now();await db.from("ai_agent_runs").update({status:"completed",output_payload:{...ai.result,_meta:{responseId:ai.responseId,model:ai.model,usage:ai.usage}},result_summary:ai.result.summary,confidence:ai.result.confidence,requires_human_approval:ai.result.recommended_disposition!=="automatic"||ai.result.findings.some((x:any)=>x.requires_human_approval),completed_at:done}).eq("id",run.id);if(ai.result.findings.length){const rows=ai.result.findings.map((x:any)=>({workflow_id:workflowId,agent_run_id:run.id,agent_id:agentId,finding_type:clean(x.finding_type)||task,severity:clean(x.severity)||"info",title:clean(x.title).slice(0,500),detail:clean(x.detail).slice(0,8000),legal_obligation:clean(x.legal_obligation).slice(0,5000),practical_recommendation:clean(x.practical_recommendation).slice(0,5000),uncertainty:clean(x.uncertainty).slice(0,5000),official_sources:ai.result.official_sources,source_checked_at:web?done:null,confidence:ai.result.confidence,requires_human_approval:!!x.requires_human_approval,created_at:done}));const {error:fErr}=await db.from("ai_findings").insert(rows);if(fErr)throw fErr}return ai.result}catch(e:any){const done=now();await db.from("ai_agent_runs").update({status:"failed",error_message:clean(e?.message||e).slice(0,1000),completed_at:done}).eq("id",run.id);throw e}
  }
  try{
   const incidentResult=await runAgent("incident_manager","incident_analysis",{incident},DEFAULT_MODEL,AGENT_INSTRUCTIONS.incident,false,"medium");
   const legalResult=await runAgent("legal_reviewer","legal_review",{incident,incident_analysis:incidentResult,as_of_date:new Date().toISOString().slice(0,10)},LEGAL_MODEL,AGENT_INSTRUCTIONS.legal,true,"high");
   const verifyResult=await runAgent("final_auditor","independent_verification",{incident,incident_analysis:incidentResult,legal_review:legalResult},DEFAULT_MODEL,AGENT_INSTRUCTIONS.verify,false,"high");
   const directorResult=await runAgent("safety_director","final_synthesis",{incident,incident_analysis:incidentResult,legal_review:legalResult,verification:verifyResult},DIRECTOR_MODEL,AGENT_INSTRUCTIONS.director,false,"high");
   const urgent=directorResult.recommended_disposition==="urgent_human_review"||directorResult.findings.some((x:any)=>["critical","high"].includes(clean(x.severity)));const needsHuman=directorResult.recommended_disposition!=="automatic"||legalResult.findings.length>0||verifyResult.missing_information.length>0||incident.legal_review_flag||incident.potential_major;const finished=now(),status=needsHuman?"awaiting_approval":"completed";
   const {error:upErr}=await db.from("ai_workflows").update({status,priority:urgent?"urgent":w.priority,current_agent:"safety_director",result_summary:directorResult.summary,requires_human_approval:needsHuman,completed_at:needsHuman?null:finished,updated_at:finished}).eq("id",workflowId);if(upErr)throw upErr;
   if(needsHuman){const {error:apErr}=await db.from("ai_approvals").insert({workflow_id:workflowId,approval_type:"final_review",status:"pending",summary:directorResult.summary,requested_for:actor.id,created_at:finished,updated_at:finished});if(apErr)throw apErr}
   return json(req,{ok:true,workflowId,status,priority:urgent?"urgent":w.priority,result:directorResult,requiresHumanApproval:needsHuman});
  }catch(e:any){const failed=now();await db.from("ai_workflows").update({status:"failed",result_summary:clean(e?.message||e).slice(0,1000),updated_at:failed,completed_at:failed}).eq("id",workflowId);throw e}
 }catch(e:any){return json(req,{ok:false,message:clean(e?.message||e)||"ai_safety_failed",version:VERSION},500)}
});
