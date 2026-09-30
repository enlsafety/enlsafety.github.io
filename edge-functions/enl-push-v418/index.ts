import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import webpush from "npm:web-push@3.6.7";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const VERSION="4.4.11-push-db1";
const FIELD_TITLES=["현장소장","파트장","서무"];
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app, x-enl-internal","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const enc=new TextEncoder();
const sha=async(v:string)=>{const b=await crypto.subtle.digest("SHA-256",enc.encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};

async function verifiedActor(sql:any,raw:any){
  const actor={id:clean(raw?.id),name:clean(raw?.name),role:roleNorm(raw?.role),position:clean(raw?.position),siteId:clean(raw?.siteId)};
  if(!actor.id)return null;
  if(["safety","manager","executive"].includes(actor.role)){
    const rows=await sql`select user_id,name,role,position,department,email,push_enabled,email_enabled,active
      from public.enl_hq_users where user_id=${actor.id} limit 1`;
    const d=rows[0];if(!d||d.active===false||roleNorm(d.role)!==actor.role)return null;
    return {id:clean(d.user_id),name:clean(d.name),role:roleNorm(d.role),position:clean(d.position),siteId:"",email:clean(d.email),pushEnabled:d.push_enabled!==false,emailEnabled:d.email_enabled!==false};
  }
  if(["field","worker"].includes(actor.role)){
    const rows=await sql`select personnel_id,site_id,name,job_title,access_role,email,push_enabled,email_enabled,active
      from public.enl_site_personnel where personnel_id::text=${actor.id} limit 1`;
    const d=rows[0];if(!d||d.active===false)return null;
    const role=clean(d.access_role)==="field"?"field":"worker";
    if(role!==actor.role||role==="field"&&!FIELD_TITLES.includes(clean(d.job_title)))return null;
    if(actor.siteId&&clean(d.site_id)!==actor.siteId)return null;
    return {id:clean(d.personnel_id),name:clean(d.name),role,position:clean(d.job_title)||(role==="worker"?"일반근로자":"현장관리"),siteId:clean(d.site_id),email:clean(d.email),pushEnabled:d.push_enabled!==false,emailEnabled:d.email_enabled!==false};
  }
  return null;
}
async function cfg(sql:any){
  const rows=await sql`select vapid_public_key,vapid_private_key,vapid_subject,internal_token from public.enl_push_config where id=1 limit 1`;
  if(!rows[0])throw new Error("push_config_missing");return rows[0];
}
async function notificationProfile(sql:any,userId:string){
  const h=await sql`select user_id,role,email,push_enabled,email_enabled from public.enl_hq_users where user_id=${userId} limit 1`;
  if(h[0])return {role:roleNorm(h[0].role),email:clean(h[0].email),pushEnabled:h[0].push_enabled!==false,emailEnabled:h[0].email_enabled!==false};
  const p=await sql`select personnel_id,access_role,email,push_enabled,email_enabled from public.enl_site_personnel where personnel_id::text=${userId} limit 1`;
  if(p[0])return {role:clean(p[0].access_role)==="field"?"field":"worker",email:clean(p[0].email),pushEnabled:p[0].push_enabled!==false,emailEnabled:p[0].email_enabled!==false};
  return null;
}
async function profileGet(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  return json({ok:true,profile:{email:u.email||"",pushEnabled:u.pushEnabled!==false,emailEnabled:u.emailEnabled!==false,urgentForced:["safety","manager","executive"].includes(u.role)}});
}
async function profileUpdate(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  const email=clean(body.email).toLowerCase(),pushEnabled=body.pushEnabled!==false,emailEnabled=body.emailEnabled!==false;
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({ok:false,message:"invalid_email"},400);
  if(["safety","manager","executive"].includes(u.role)){
    await sql`update public.enl_hq_users set email=${email},push_enabled=${pushEnabled},email_enabled=${emailEnabled},updated_at=now() where user_id=${u.id}`;
  }else{
    await sql`update public.enl_site_personnel set email=${email},push_enabled=${pushEnabled},email_enabled=${emailEnabled},updated_at=now() where personnel_id::text=${u.id}`;
  }
  return json({ok:true,profile:{email,pushEnabled,emailEnabled,urgentForced:["safety","manager","executive"].includes(u.role)}});
}
function setVapid(c:any){webpush.setVapidDetails(c.vapid_subject,c.vapid_public_key,c.vapid_private_key)}
function payload(title:string,body:string,tag:string,data:any){return JSON.stringify({title,body,tag,data:{...(data||{}),url:"https://enlsafety.github.io/"}})}
async function send(c:any,s:any,p:any){setVapid(c);return await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},p,{TTL:600,urgency:"high"} as any)}
function prefKey(kind:string){
  if(["incident_new","incident_resubmitted","incident_supplement_requested","incident_supplement_submitted","incident_approved","incident_rejected","incident_closed"].includes(kind))return "incident_progress";
  if(["prevention_plan_assigned","action_submitted","action_resubmitted","action_approved","action_rejected"].includes(kind))return "action_progress";
  if(["inquiry_new","inquiry_answered"].includes(kind))return "inquiry";
  if(["management_view_report","management_view_action"].includes(kind))return "management_views";
  if(kind==="urgent_incident")return "urgent";
  return "system";
}
function allowed(sub:any,kind:string,pushEnabled=true){
  if(kind==="urgent_incident"&&["safety","manager","executive"].includes(clean(sub.role)))return true;
  if(pushEnabled===false)return false;
  const k=prefKey(kind),p=sub.preferences&&typeof sub.preferences==="object"?sub.preferences:{};
  return p[k]!==false;
}
async function subscribe(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  const sub=body.subscription||{},endpoint=clean(sub.endpoint),p256dh=clean(sub.keys?.p256dh),auth=clean(sub.keys?.auth);
  if(!endpoint||!p256dh||!auth)return json({ok:false,message:"invalid_subscription"},400);
  const endpointHash=await sha(endpoint),preferences=body.preferences&&typeof body.preferences==="object"?body.preferences:{};
  await sql`insert into public.enl_push_subscriptions(
      endpoint_hash,endpoint,p256dh,auth,user_id,user_name,role,position,site_id,preferences,user_agent,updated_at,last_seen_at
    ) values(
      ${endpointHash},${endpoint},${p256dh},${auth},${u.id},${u.name},${u.role},${u.position},${u.siteId||null},
      ${JSON.stringify(preferences)}::jsonb,${clean(body.userAgent).slice(0,300)},now(),now()
    )
    on conflict(endpoint_hash,user_id) do update set
      endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,user_name=excluded.user_name,role=excluded.role,
      position=excluded.position,site_id=excluded.site_id,preferences=excluded.preferences,user_agent=excluded.user_agent,
      updated_at=excluded.updated_at,last_seen_at=excluded.last_seen_at`;
  return json({ok:true,userId:u.id,role:u.role});
}
async function updatePreferences(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  const endpoint=clean(body.endpoint);if(!endpoint)return json({ok:false,message:"endpoint_required"},400);
  const h=await sha(endpoint),preferences=body.preferences&&typeof body.preferences==="object"?body.preferences:{};
  await sql`update public.enl_push_subscriptions set preferences=${JSON.stringify(preferences)}::jsonb,updated_at=now(),last_seen_at=now()
    where endpoint_hash=${h} and user_id=${u.id}`;
  return json({ok:true});
}
async function unsubscribe(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  const endpoint=clean(body.endpoint);if(!endpoint)return json({ok:true});
  const h=await sha(endpoint);
  await sql`delete from public.enl_push_subscriptions where endpoint_hash=${h} and user_id=${u.id}`;
  return json({ok:true});
}
async function testPush(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  const endpoint=clean(body.endpoint);if(!endpoint)return json({ok:false,message:"endpoint_required"},400);
  const h=await sha(endpoint);
  const rows=await sql`select id,endpoint,p256dh,auth,role from public.enl_push_subscriptions where endpoint_hash=${h} and user_id=${u.id} limit 1`;
  const s=rows[0];if(!s)return json({ok:false,message:"subscription_not_found"},404);
  const c=await cfg(sql);
  try{
    await send(c,s,payload("이앤엘 사고보고앱","알림 설정이 완료되었습니다.",`enl-push-test-${Date.now()}`,{kind:"push_test"}));
    return json({ok:true});
  }catch(e:any){
    const status=Number(e?.statusCode||0);
    if(status===404||status===410)await sql`delete from public.enl_push_subscriptions where id=${s.id}`;
    return json({ok:false,message:status===404||status===410?"subscription_expired":"push_failed"},502);
  }
}
async function managementView(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u||!["field","safety","manager","executive"].includes(u.role))return json({ok:false,message:"forbidden"},403);
  if(u.role==="field"&&!FIELD_TITLES.includes(clean(u.position)))return json({ok:false,message:"forbidden"},403);
  const incidentId=clean(body.incidentId),documentType=clean(body.documentType);
  if(!incidentId||!["incident_report","corrective_action"].includes(documentType))return json({ok:false,message:"invalid_view"},400);
  const rr=await sql`select incident_id,site_id,payload from public.enl_incident_shared where incident_id=${incidentId} limit 1`;
  const row=rr[0];if(!row)return json({ok:false,message:"not_found"},404);
  if(u.role==="field"&&clean(row.site_id)!==u.siteId)return json({ok:false,message:"forbidden"},403);
  const status=clean(row.payload?.status),actionStatus=clean(row.payload?.corrective?.status);
  if(documentType==="incident_report"&&!["reported","supplement","supplement_submitted","approved","closed"].includes(status))return json({ok:false,message:"not_viewable"},409);
  if(documentType==="corrective_action"&&actionStatus!=="approved")return json({ok:false,message:"action_not_approved"},409);
  const ex=await sql`select id from public.enl_document_views where incident_id=${incidentId} and document_type=${documentType} and viewer_id=${u.id} limit 1`;
  if(ex[0])return json({ok:true,first:false});
  const now=new Date().toISOString();
  await sql`insert into public.enl_document_views(incident_id,document_type,viewer_id,viewer_name,viewer_role,first_viewed_at)
    values(${incidentId},${documentType},${u.id},${u.name},${u.role},${now})
    on conflict(incident_id,document_type,viewer_id) do nothing`;
  const inserted=await sql`select id from public.enl_document_views where incident_id=${incidentId} and document_type=${documentType} and viewer_id=${u.id} limit 1`;
  if(!inserted[0])return json({ok:true,first:false});
  const kind=documentType==="incident_report"?"management_view_report":"management_view_action",label=documentType==="incident_report"?"사고보고":"재발방지조치",viewer=[u.name,u.position].filter(Boolean).join(" "),tok=`view:${incidentId}:${documentType}:${u.id}`;
  if(["manager","executive"].includes(u.role)){
    const safety=await sql`select user_id from public.enl_hq_users where active=true and role='safety'`;
    for(const s of safety||[]){
      const eventKey=`${tok}:${s.user_id}`;
      await sql`insert into public.enl_push_events(event_key,incident_id,site_id,user_id,kind,title,body,data)
        values(${eventKey},${incidentId},${row.site_id},${s.user_id},${kind},${`[조회 확인] ${label}를 확인했습니다.`},${`${viewer||"관리자"}가 ${label}를 최초 확인했습니다.`},${JSON.stringify({view:documentType==="incident_report"?"incident":"action",viewerId:u.id,viewerName:u.name})}::jsonb)
        on conflict(event_key) do nothing`;
    }
  }
  return json({ok:true,first:true});
}
async function viewList(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u||!["field","safety","manager","executive"].includes(u.role))return json({ok:false,message:"forbidden"},403);
  if(u.role==="field"&&!FIELD_TITLES.includes(clean(u.position)))return json({ok:false,message:"forbidden"},403);
  const incidentId=clean(body.incidentId);if(!incidentId)return json({ok:false,message:"incident_required"},400);
  const rr=await sql`select site_id from public.enl_incident_shared where incident_id=${incidentId} limit 1`;
  const row=rr[0];if(!row)return json({ok:false,message:"not_found"},404);
  if(u.role==="field"&&clean(row.site_id)!==u.siteId)return json({ok:false,message:"forbidden"},403);
  const rows=await sql`select document_type,viewer_id,viewer_name,viewer_role,first_viewed_at
    from public.enl_document_views where incident_id=${incidentId} order by first_viewed_at asc`;
  return json({ok:true,views:rows||[]});
}
async function dispatchCore(sql:any,c:any){
  const events=await sql`select id,event_key,incident_id,site_id,user_id,kind,title,body,data
    from public.enl_push_events where sent_at is null order by id asc limit 200`;
  let sent=0,removed=0,pending=0;
  for(const ev of events||[]){
    if(clean(ev.kind).startsWith("historical_followup_")){
      const permitted=ev.kind==="historical_followup_submitted"
        ? await sql`select user_id as id from public.enl_hq_users where user_id=${ev.user_id} and active=true and role='safety'`
        : await sql`select personnel_id as id from public.enl_site_personnel where personnel_id::text=${ev.user_id} and site_id=${ev.site_id} and active=true and access_role='field' and job_title in ('현장소장','파트장','서무')`;
      if(!permitted[0]){await sql`update public.enl_push_events set sent_at=now(),last_error='followup_recipient_changed' where id=${ev.id}`;continue}
    }
    const subs=await sql`select id,endpoint,p256dh,auth,role,preferences from public.enl_push_subscriptions where user_id=${ev.user_id}`;
    const prof=await notificationProfile(sql,clean(ev.user_id));
    const eligible=(subs||[]).filter((s:any)=>allowed(s,ev.kind,prof?.pushEnabled!==false));
    if(!eligible.length){
      await sql`update public.enl_push_events set sent_at=now(),last_error=null where id=${ev.id}`;
      continue;
    }
    let transient=false;
    for(const s of eligible){
      const dr=await sql`select delivered_at from public.enl_push_deliveries where event_id=${ev.id} and subscription_id=${s.id} limit 1`;
      if(dr[0]?.delivered_at)continue;
      try{
        await send(c,s,payload(ev.title,ev.body,ev.event_key,{...(ev.data||{}),kind:ev.kind,incidentId:ev.incident_id,siteId:ev.site_id,eventId:ev.id}));
        await sql`insert into public.enl_push_deliveries(event_id,subscription_id,delivered_at,last_attempt_at,last_status,last_error)
          values(${ev.id},${s.id},now(),now(),201,null)
          on conflict(event_id,subscription_id) do update set delivered_at=excluded.delivered_at,last_attempt_at=excluded.last_attempt_at,last_status=excluded.last_status,last_error=null`;
        sent++;
      }catch(e:any){
        const status=Number(e?.statusCode||0),msg=clean(e?.message||e).slice(0,500);
        await sql`insert into public.enl_push_deliveries(event_id,subscription_id,last_attempt_at,last_status,last_error)
          values(${ev.id},${s.id},now(),${status||null},${msg})
          on conflict(event_id,subscription_id) do update set last_attempt_at=excluded.last_attempt_at,last_status=excluded.last_status,last_error=excluded.last_error`;
        if(status===404||status===410){
          await sql`delete from public.enl_push_subscriptions where id=${s.id}`;removed++;
        }else transient=true;
      }
    }
    if(transient){
      pending++;await sql`update public.enl_push_events set last_error='temporary_delivery_failure' where id=${ev.id}`;
    }else await sql`update public.enl_push_events set sent_at=now(),last_error=null where id=${ev.id}`;
  }
  return {ok:true,events:(events||[]).length,sent,removed,pending};
}
async function dispatchInternal(sql:any,req:Request){
  const c=await cfg(sql);
  if(clean(req.headers.get("x-enl-internal"))!==clean(c.internal_token))return json({ok:false,message:"forbidden"},403);
  return json(await dispatchCore(sql,c));
}
async function flush(sql:any,body:any){
  const u=await verifiedActor(sql,body.actor);if(!u)return json({ok:false,message:"forbidden"},403);
  const c=await cfg(sql);return json(await dispatchCore(sql,c));
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action);
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const sql=postgres(dbUrl,{prepare:false,max:4,connect_timeout:5,idle_timeout:2});
  try{
    if(action==="dispatch")return await dispatchInternal(sql,req);
    if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
    if(action==="health"){const c=await cfg(sql);return json({ok:true,version:VERSION,vapidPublicKey:c.vapid_public_key});}
    if(action==="profile_get")return await profileGet(sql,body);
    if(action==="profile_update")return await profileUpdate(sql,body);
    if(action==="subscribe")return await subscribe(sql,body);
    if(action==="preferences")return await updatePreferences(sql,body);
    if(action==="unsubscribe")return await unsubscribe(sql,body);
    if(action==="test")return await testPush(sql,body);
    if(action==="management_view")return await managementView(sql,body);
    if(action==="view_list")return await viewList(sql,body);
    if(action==="flush")return await flush(sql,body);
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){
    console.error("enl-push-v418",clean(e?.message||e));
    return json({ok:false,message:clean(e?.message)||"push_error"},500);
  }finally{
    await sql.end({timeout:1}).catch(()=>{});
  }
});
