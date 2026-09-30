import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const BREVO_BASE="https://api.brevo.com/v3";
const VERSION="4.4.27-historical-followup1";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app, x-enl-internal","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";

async function verifiedActor(sql:any,raw:any){
  const a={id:clean(raw?.id),role:roleNorm(raw?.role),siteId:clean(raw?.siteId)};
  if(!a.id)return null;
  if(["safety","manager","executive"].includes(a.role)){
    const rows=await sql`select user_id,role,active from public.enl_hq_users where user_id=${a.id} limit 1`;
    const d=rows[0];if(!d||d.active===false||roleNorm(d.role)!==a.role)return null;
    return {id:clean(d.user_id),role:roleNorm(d.role)};
  }
  if(["field","worker"].includes(a.role)){
    const rows=await sql`select personnel_id,site_id,access_role,active from public.enl_site_personnel where personnel_id::text=${a.id} limit 1`;
    const d=rows[0];if(!d||d.active===false||clean(d.access_role)!==a.role)return null;
    if(a.siteId&&clean(d.site_id)!==a.siteId)return null;
    return {id:clean(d.personnel_id),role:a.role};
  }
  return null;
}
async function profile(sql:any,userId:string){
  const h=await sql`select user_id,name,role,email,email_enabled,active from public.enl_hq_users where user_id=${userId} limit 1`;
  if(h[0]&&h[0].active!==false)return {name:clean(h[0].name),role:roleNorm(h[0].role),email:clean(h[0].email),emailEnabled:h[0].email_enabled!==false};
  const p=await sql`select personnel_id,name,access_role,email,email_enabled,active from public.enl_site_personnel where personnel_id::text=${userId} limit 1`;
  if(p[0]&&p[0].active!==false)return {name:clean(p[0].name),role:clean(p[0].access_role)==="field"?"field":"worker",email:clean(p[0].email),emailEnabled:p[0].email_enabled!==false};
  return null;
}
const esc=(v:any)=>clean(v).replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"} as any)[m]);
function dateTime(v:any){
  const d=new Date(clean(v));if(!Number.isFinite(d.getTime()))return clean(v)||"-";
  return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
}
function dateOnly(v:any){const s=dateTime(v);return s.replace(/\.\s?/g,".").split(" ")[0]||s}
function stateLabel(s:string){return s==="reported"?"즉시보고 접수 · 안전관리자 검토 중":s==="supplement"?"보완대기":s==="supplement_submitted"?"보완자료 검토 중":s==="approved"?"사고보고 승인":s==="closed"?"종결":s||"-"}
function mailContent(incident:any,siteName:string,urgent:boolean,kind:string){
  const d=incident?.reportDetails||{},c=incident?.corrective||{},s=incident?.supplement||{};
  const person=clean(incident?.category)==="person",type=person?"대인사고":"대물사고",typeShort=person?"대인":"대물";
  const when=dateTime(incident?.occurredAt);
  const place=clean(d.place)||"-",work=clean(d.workAction),how=clean(d.incidentHow);
  const content=[work?work+" 중":"",how].filter(Boolean).join(" ")||clean(incident?.summary)||"-";
  const immediate=clean(incident?.immediateAction)||"-",state=stateLabel(clean(incident?.status));

  let subjectWhen="-";
  try{
    const dt=new Date(clean(incident?.occurredAt));
    if(Number.isFinite(dt.getTime())){
      const p=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(dt);
      const get=(x:string)=>p.find(v=>v.type===x)?.value||"";
      subjectWhen=`${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
    }
  }catch(_){}

  const labelMap:any={
    incident_new:"즉시 사고보고",urgent_incident:"긴급 즉시 사고보고",incident_resubmitted:"사고보고 재제출",
    incident_supplement_requested:"사고보고 보완요청",incident_supplement_submitted:"사고보고 보완완료",
    incident_approved:"사고보고 승인",incident_rejected:"사고보고 반려",prevention_plan_assigned:"재발방지계획 하달",
    action_submitted:"재발방지조치 제출",action_resubmitted:"재발방지조치 재제출",
    action_rejected:"재발방지조치 보완요청",action_approved:"재발방지조치 승인 · 사고종결",incident_closed:"사고 종결"
  };
  const subjectMap:any={
    incident_new:"사고발생/즉시보고",
    urgent_incident:"긴급사고/즉시보고",
    incident_resubmitted:"사고보고/재제출",
    incident_supplement_requested:"사고보고/보완요청",
    incident_supplement_submitted:"사고보고/보완완료",
    incident_approved:"사고보고/승인",
    incident_rejected:"사고보고/반려",
    prevention_plan_assigned:"재발방지계획/하달",
    action_submitted:"재발방지조치/제출",
    action_resubmitted:"재발방지조치/재제출",
    action_rejected:"재발방지조치/보완요청",
    action_approved:"사고종결/조치승인",
    incident_closed:"사고종결"
  };
  const label=labelMap[kind]||"사고보고";
  const subjectLabel=subjectMap[kind]||label;
  const subject=`[${subjectLabel}] ${siteName||"사업장"} | ${typeShort} | ${subjectWhen}`;

  const incidentId=clean(incident?.id);
  const link=`https://enlsafety.github.io/stable412.html?push=1&incident=${encodeURIComponent(incidentId)}`;

  const summary=`${siteName||"사업장"} · ${typeShort} · ${place} · ${content}`;
  const rows:any[]=[
    ["사고발생일시",when],
    ["사업장",siteName||"-"],
    ["사고유형",type],
    ["사고장소",place],
    ["사고내용",content],
    ["현재 상태",state],
    ["긴급조치 내용",immediate]
  ];
  if(kind==="incident_supplement_requested")rows.push(["보완 요청사항",clean(s.requestNote)||"앱에서 보완 요청내용을 확인해 주세요."]);
  if(kind==="incident_supplement_submitted")rows.push(["보완 제출",[clean(s.submittedBy),dateTime(s.submittedAt)].filter(Boolean).join(" · ")||"보완자료 제출 완료"]);
  if(kind==="incident_rejected")rows.push(["반려 사유",clean(incident?.rejectionNote)||clean(incident?.safetyNote)||"앱에서 반려 사유를 확인해 주세요."]);
  if(kind==="prevention_plan_assigned"){
    rows.push(["재발방지계획",clean(c.planDetail)||"-"]);
    rows.push(["담당 / 목표일",[clean(c.ownerName),clean(c.dueDate)].filter(Boolean).join(" · ")||"-"]);
  }
  if(["action_submitted","action_resubmitted","action_rejected","action_approved"].includes(kind)){
    rows.push(["재발방지조치",clean(c.actionDetail)||"-"]);
    if(clean(c.submittedBy)||clean(c.submittedAt))rows.push(["현장 제출",[clean(c.submittedBy),dateTime(c.submittedAt)].filter(Boolean).join(" · ")]);
    if(kind==="action_rejected")rows.push(["보완요청 사유",clean(c.reviewNote)||"앱에서 확인의견을 확인해 주세요."]);
    if(kind==="action_approved")rows.push(["안전관리자 승인",[clean(c.reviewedBy),dateTime(c.reviewedAt)].filter(Boolean).join(" · ")||"-"]);
  }

  const text=`${label}\n\n한줄요약: ${summary}\n\n`+
    rows.map(([a,b])=>`${a}: ${b}`).join("\n")+
    `\n\n사고보고앱에서 상세내용과 결재상태를 확인해 주세요.\n${link}`;

  const html=`<div style="font-family:Arial,'Malgun Gothic',sans-serif;color:#173b66;max-width:680px;margin:auto">
    <h2 style="margin:0 0 14px">${esc(label)}</h2>
    <div style="margin:0 0 16px;padding:14px 16px;border:1px solid #bfd8ea;border-radius:10px;background:#f3f9fd;line-height:1.6">
      <div style="font-size:11px;font-weight:700;color:#5f7b90;margin-bottom:4px">한눈에 보는 사고</div>
      <div style="font-size:15px;font-weight:800;color:#173b66">${esc(summary)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${rows.map(([a,b])=>`<tr><th style="width:145px;text-align:left;padding:10px;border:1px solid #d8e3eb;background:#eef7fd">${esc(a)}</th><td style="padding:10px;border:1px solid #d8e3eb;line-height:1.55">${esc(b)}</td></tr>`).join("")}
    </table>
    <p style="margin:16px 0 10px;color:#617b8d">사고보고앱에서 상세내용과 결재상태를 확인해 주세요.</p>
    <a href="${link}" style="display:inline-block;background:#1e5d91;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">사고보고 확인하기</a>
    <p style="margin-top:16px;font-size:12px;color:#8192a0">진단서·영수증·사진·PDF 등 민감한 첨부자료는 이메일에 포함하지 않습니다.</p>
  </div>`;

  return {subject,text,html};
}

function brevoKey(){return clean(Deno.env.get("BREVO_API_KEY"))}
async function replyTo(sql:any){
  const env=clean(Deno.env.get("BREVO_REPLY_TO"));if(env)return env;
  const rows=await sql`select email from public.enl_hq_users where user_id='u-safety-demo' limit 1`;
  return clean(rows[0]?.email)||"hanarin0130@enlife.co.kr";
}
async function internalToken(sql:any){
  const rows=await sql`select internal_token from public.enl_push_config where id=1 limit 1`;
  return clean(rows[0]?.internal_token);
}
async function brevo(path:string,init:RequestInit={}){
  const apiKey=brevoKey();if(!apiKey)throw new Error("brevo_not_configured");
  const r=await fetch(BREVO_BASE+path,{...init,headers:{"accept":"application/json","api-key":apiKey,"content-type":"application/json",...(init.headers||{})}});
  const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!r.ok)throw new Error(clean(data?.message)||clean(data?.code)||`brevo_http_${r.status}`);
  return data;
}
async function activeSender(){
  const r=await brevo("/senders",{method:"GET"});
  const list=Array.isArray(r?.senders)?r.senders:[];
  const preferred=list.find((x:any)=>x?.active===true&&clean(x?.name)==="이앤엘 사고보고")||list.find((x:any)=>x?.active===true);
  if(!preferred?.id)throw new Error("brevo_verified_sender_missing");
  return {id:Number(preferred.id),name:clean(preferred.name),email:clean(preferred.email)};
}
async function sendBrevo(sql:any,to:string,content:any,sandbox=false){
  const sender=await activeSender(),reply=await replyTo(sql);
  const body:any={sender:{id:sender.id},to:[{email:to}],subject:content.subject,htmlContent:content.html,textContent:content.text,tags:["enl-incident-report"]};
  if(reply)body.replyTo={email:reply,name:"이앤엘 안전관리"};
  if(sandbox)body.headers={"X-Sib-Sandbox":"drop"};
  const r=await brevo("/smtp/email",{method:"POST",body:JSON.stringify(body)});
  return {ok:true,messageId:clean(r?.messageId),sender,replyTo:reply||""};
}
function followupMail(event:any,siteName:string){
  const d=event?.data||{},label=clean(d.eventLabel)||"후속 개선조치",title=clean(d.title)||"개선조치";
  const link="https://enlsafety.github.io/stable412.html?followup="+encodeURIComponent(clean(d.followupId));
  const subject=`[이앤엘 · ${label}] ${siteName} · ${title}`;
  const lines=[label,`담당 사업장: ${siteName}`,`조치명: ${title}`,`완료기한: ${clean(d.dueDate)}`,`요구사항: ${clean(d.requirement)}`,d.reviewNote?`검토의견: ${clean(d.reviewNote)}`:"","원 과거사고는 이관종결을 유지합니다."];
  return {subject,text:lines.filter(Boolean).join("\n")+"\n후속 개선조치 확인: "+link,html:`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#234861"><h2>${esc(label)}</h2>${lines.slice(1).filter(Boolean).map(x=>`<p style="white-space:pre-wrap">${esc(x)}</p>`).join("")}<p><a href="${esc(link)}">후속 개선조치 확인하기</a></p></div>`};
}
async function finishEvent(sql:any,id:any,patch:any){
  const sentAt=patch.sent_at??null,lastError=patch.last_error??null,deadAt=patch.dead_at??null;
  await sql`update public.enl_email_events set processing_token=null,processing_at=null,
    sent_at=coalesce(${sentAt}::timestamptz,sent_at),last_error=${lastError},dead_at=coalesce(${deadAt}::timestamptz,dead_at)
    where id=${id}`;
}
async function flush(sql:any){
  const configured=!!brevoKey();if(!configured)return {ok:true,configured:false,claimed:0,sent:0,pending:0,message:"brevo_not_configured"};
  const claimToken=crypto.randomUUID();
  const events=await sql`select * from public.enl_email_claim_events(${claimToken},100)`;
  let sent=0,skipped=0,failed=0;
  for(const ev of events||[]){
    const age=Date.now()-new Date(ev.created_at).getTime();
    if(age>24*60*60*1000){await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:"expired"});skipped++;continue}
    const p=await profile(sql,clean(ev.user_id)),urgent=clean(ev.kind)==="urgent_incident"&&["safety","manager","executive"].includes(p?.role||"");
    if(!p?.email){await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:"email_missing"});skipped++;continue}
    if(p.emailEnabled===false&&!urgent){await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:"email_disabled"});skipped++;continue}
    if(clean(ev.kind).startsWith("historical_followup_")){
      try{
        const events=await sql`select data from public.enl_push_events where id=${ev.source_push_event_id}`;
        const event=events[0];if(!event?.data?.followupId)throw Error("followup_event_missing");
        const targets=await sql`select payload from public.enl_historical_followups where id=${event.data.followupId}`;
        const target=targets[0]?.payload;if(!target)throw Error("followup_missing");
        if(p.role==="field"){
          const allowed=await sql`select personnel_id from public.enl_site_personnel where personnel_id::text=${ev.user_id} and active=true and site_id=${target.siteId} and access_role='field' and job_title in ('현장소장','파트장','서무')`;
          if(!allowed[0]){await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:"followup_recipient_changed"});skipped++;continue}
        }else if(p.role!=="safety"){await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:"followup_recipient_changed"});skipped++;continue}
        const sites=await sql`select site_name from public.enl_site_master where site_id=${target.siteId}`;
        await sendBrevo(sql,p.email,followupMail(event,clean(sites[0]?.site_name)||target.siteId),false);
        await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:null});sent++;
      }catch(e:any){await finishEvent(sql,ev.id,{last_error:clean(e?.message||e).slice(0,500),dead_at:Number(ev.attempt_count||0)>=5?new Date().toISOString():null});failed++}
      continue;
    }
    const rr=await sql`select payload,site_id from public.enl_incident_shared where incident_id=${ev.incident_id} limit 1`;
    const row=rr[0];if(!row?.payload){await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:"incident_missing"});skipped++;continue}
    const sr=await sql`select site_name from public.enl_site_master where site_id=${row.site_id} limit 1`;
    try{
      await sendBrevo(sql,p.email,mailContent(row.payload,clean(sr[0]?.site_name)||clean(row.site_id),urgent,clean(ev.kind)),false);
      await finishEvent(sql,ev.id,{sent_at:new Date().toISOString(),last_error:null});sent++;
    }catch(e:any){
      const terminal=Number(ev.attempt_count||0)>=5;
      await finishEvent(sql,ev.id,{last_error:clean(e?.message||e).slice(0,500),dead_at:terminal?new Date().toISOString():null});failed++;
    }
  }
  return {ok:true,configured:true,provider:"brevo",claimed:(events||[]).length,sent,skipped,failed,pending:failed};
}
async function health(sql:any){
  const reply=await replyTo(sql);
  return {ok:true,version:VERSION,configured:!!brevoKey(),provider:brevoKey()?"brevo":null,replyToConfigured:!!reply};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="GET"&&req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const sql=postgres(dbUrl,{prepare:false,max:3,connect_timeout:5,idle_timeout:2});
  try{
    if(req.method==="GET")return json(await health(sql));
    let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
    const action=clean(body.action);
    if(action==="dispatch"||action==="keepalive"){
      const expected=await internalToken(sql);
      if(!expected||clean(req.headers.get("x-enl-internal"))!==expected)return json({ok:false,message:"forbidden"},403);
      if(action==="keepalive"){const sender=await activeSender();return json({ok:true,provider:"brevo",senderId:sender.id});}
      return json(await flush(sql));
    }
    if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
    if(action==="health")return json(await health(sql));
    if(action==="brevo_probe"){
      const u=await verifiedActor(sql,body.actor);if(!u||u.role!=="safety")return json({ok:false,message:"forbidden"},403);
      const sender=await activeSender();return json({ok:true,configured:true,sender,replyTo:await replyTo(sql)});
    }
    if(action==="brevo_sandbox_test"){
      const u=await verifiedActor(sql,body.actor);if(!u||u.role!=="safety")return json({ok:false,message:"forbidden"},403);
      const to=await replyTo(sql);if(!to)return json({ok:false,message:"reply_to_missing"},409);
      return json(await sendBrevo(sql,to,{subject:"[이앤엘 사고보고앱] Brevo API 연결 테스트",text:"Brevo API 샌드박스 연결 테스트입니다. 실제 메일은 발송되지 않습니다.",html:"<p><b>Brevo API 샌드박스 연결 테스트</b>입니다. 실제 메일은 발송되지 않습니다.</p>"},true));
    }
    if(action==="brevo_test"){
      const u=await verifiedActor(sql,body.actor);if(!u||u.role!=="safety")return json({ok:false,message:"forbidden"},403);
      const to=await replyTo(sql);if(!to)return json({ok:false,message:"reply_to_missing"},409);
      return json(await sendBrevo(sql,to,{subject:"[이앤엘 사고보고앱] 이메일 자동발송 테스트",text:"사고보고앱의 Brevo 이메일 자동발송 연결이 정상적으로 구성되었습니다.",html:"<div style=\"font-family:Arial,'Malgun Gothic',sans-serif\"><h2>이앤엘 사고보고앱</h2><p>Brevo 이메일 자동발송 연결 테스트입니다.</p><p><b>이 메일이 도착했다면 실제 발송 경로가 정상입니다.</b></p></div>"},false));
    }
    if(action==="brevo_status"){
      const u=await verifiedActor(sql,body.actor);if(!u||u.role!=="safety")return json({ok:false,message:"forbidden"},403);
      const messageId=clean(body.messageId);if(!messageId)return json({ok:false,message:"message_id_required"},400);
      const list=await brevo("/smtp/emails?messageId="+encodeURIComponent(messageId),{method:"GET"});
      const item=Array.isArray(list?.transactionalEmails)?list.transactionalEmails[0]:null;
      if(!item?.uuid)return json({ok:true,found:false});
      const detail=await brevo("/smtp/emails/"+encodeURIComponent(clean(item.uuid)),{method:"GET"});
      return json({ok:true,found:true,email:clean(detail?.email),subject:clean(detail?.subject),events:Array.isArray(detail?.events)?detail.events:[]});
    }
    if(action==="flush"){const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);return json(await flush(sql))}
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){
    console.error("enl-email-v441",clean(e?.message||e));
    return json({ok:false,message:clean(e?.message)||"email_error"},500);
  }finally{
    await sql.end({timeout:1}).catch(()=>{});
  }
});
