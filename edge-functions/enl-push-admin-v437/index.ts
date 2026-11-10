import { pushAdmin as Deno } from "../_shared/device-runtime.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import webpush from "npm:web-push@3.6.7";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const VERSION="4.4.11-hq-notify-db1";
const cors={
  "Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"content-type, x-enl-app",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const enc=new TextEncoder();
const sha=async(v:string)=>{const b=await crypto.subtle.digest("SHA-256",enc.encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};
const token=()=>{const a=new Uint8Array(32);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};

async function verifiedHq(sql:any,raw:any,passwordHash:any,roles=["safety","manager","executive"]){
  const id=clean(raw?.id),role=roleNorm(raw?.role),hash=clean(passwordHash);
  if(!id||!hash||!roles.includes(role))return null;
  const rows=await sql`select user_id,name,role,position,department,active,password_hash
    from public.enl_hq_users where user_id=${id} limit 1`;
  const data=rows[0];
  if(!data||data.active===false||roleNorm(data.role)!==role||clean(data.password_hash)!==hash)return null;
  return {id:clean(data.user_id),name:clean(data.name),role:roleNorm(data.role),position:clean(data.position)};
}
async function pushConfig(sql:any){
  const rows=await sql`select vapid_public_key,vapid_private_key,vapid_subject
    from public.enl_push_config where id=1 limit 1`;
  if(!rows[0])throw new Error("push_config_missing");
  return rows[0];
}
function setVapid(c:any){webpush.setVapidDetails(c.vapid_subject,c.vapid_public_key,c.vapid_private_key)}
function platformFrom(ua:string){
  if(/iPhone|iPad|iPod/i.test(ua))return "iOS";
  if(/Android/i.test(ua))return "Android";
  if(/Windows/i.test(ua))return "Windows";
  if(/Macintosh|Mac OS X/i.test(ua))return "macOS";
  return ua?"기타":"미확인";
}
function deviceMeta(s:any){
  const p=s?.preferences&&typeof s.preferences==="object"?s.preferences:{};
  const d=p.__device&&typeof p.__device==="object"?p.__device:{};
  return {
    displayMode:clean(d.displayMode)||"unknown",
    notificationPermission:clean(d.notificationPermission)||"unknown",
    platform:clean(d.platform)||platformFrom(clean(s?.user_agent)),
    appVersion:clean(d.appVersion),
    capturedAt:clean(d.capturedAt)
  };
}
function isoMax(values:any[]){
  const valid=values.map(v=>clean(v)).filter(Boolean).sort();
  return valid.length?valid[valid.length-1]:null;
}
async function statusList(sql:any,admin:any){
  const users=await sql`select user_id,name,role,position,department,email,push_enabled,email_enabled,active
    from public.enl_hq_users order by active desc,name`;
  const subs=await sql`select id,user_id,role,position,preferences,user_agent,created_at,updated_at,last_seen_at
    from public.enl_push_subscriptions where role in ('safety','manager','executive')`;
  const ids=(users||[]).map((u:any)=>clean(u.user_id)).filter(Boolean);
  let checks:any[]=[];
  if(ids.length){
    checks=await sql`select id,batch_id,target_user_id,send_status,provider_status,sent_at,opened_at,confirmed_at,confirm_method,created_at,last_error
      from public.enl_push_device_checks where target_user_id in ${sql(ids)}
      order by created_at desc limit 500`;
  }
  const now=Date.now(),staleMs=30*24*60*60*1000;
  const rows=(users||[]).map((u:any)=>{
    const userId=clean(u.user_id),role=roleNorm(u.role);
    const userSubs=(subs||[]).filter((s:any)=>clean(s.user_id)===userId);
    const readyDevices=userSubs.filter((s:any)=>{
      const d=deviceMeta(s);
      return d.displayMode==="standalone"&&d.notificationPermission==="granted";
    });
    const lastSeenAt=isoMax(userSubs.map((s:any)=>s.last_seen_at));
    const latestCheck=checks.find((c:any)=>clean(c.target_user_id)===userId);
    let lastTest:any=null;
    if(latestCheck){
      const batch=clean(latestCheck.batch_id);
      const same=checks.filter((c:any)=>clean(c.target_user_id)===userId&&clean(c.batch_id)===batch);
      const sent=same.filter((c:any)=>c.send_status==="sent").length;
      const confirmed=isoMax(same.map((c:any)=>c.confirmed_at||c.opened_at));
      const confirmMethod=clean(same.find((c:any)=>c.confirmed_at||c.opened_at)?.confirm_method)||"legacy";
      const failed=same.filter((c:any)=>c.send_status==="failed").length;
      lastTest={
        at:isoMax(same.map((c:any)=>c.sent_at||c.created_at)),
        confirmedAt:confirmed,
        confirmMethod,
        status:confirmed?"confirmed":sent>0?"sent":failed>0?"failed":"pending",
        sentDevices:sent,
        totalDevices:same.length
      };
    }
    let state="not_configured";
    if(u.active===false)state="inactive";
    else if(userSubs.length){
      const fresh=lastSeenAt?now-new Date(lastSeenAt).getTime()<=staleMs:false;
      const recentConfirmed=lastTest?.status==="confirmed"&&lastTest.confirmedAt&&now-new Date(lastTest.confirmedAt).getTime()<=staleMs;
      state=(readyDevices.length>0&&fresh)||recentConfirmed?"ready":"needs_check";
      if(lastTest?.status==="failed")state="needs_check";
    }
    const latestSub=[...userSubs].sort((a:any,b:any)=>String(b.last_seen_at||"").localeCompare(String(a.last_seen_at||"")))[0];
    const latestDevice=latestSub?deviceMeta(latestSub):null;
    return {
      userId,name:clean(u.name),role,position:clean(u.position),department:clean(u.department),active:u.active!==false,
      email:clean(u.email),pushEnabled:u.push_enabled!==false,emailEnabled:u.email_enabled!==false,
      state,deviceCount:userSubs.length,readyDeviceCount:readyDevices.length,lastSeenAt,
      latestDevice,lastTest
    };
  });
  const targets=rows.filter((r:any)=>r.active&&["manager","executive"].includes(r.role));
  return {
    ok:true,version:VERSION,requestedBy:{id:admin.id,name:admin.name},
    summary:{
      total:targets.length,
      ready:targets.filter((r:any)=>r.state==="ready").length,
      needsCheck:targets.filter((r:any)=>r.state==="needs_check").length,
      notConfigured:targets.filter((r:any)=>r.state==="not_configured").length,
      emailRegistered:targets.filter((r:any)=>!!r.email).length,
      emailEnabled:targets.filter((r:any)=>!!r.email&&r.emailEnabled!==false).length
    },
    users:rows
  };
}
async function sendTest(sql:any,admin:any,targetUserId:string){
  const targets=await sql`select user_id,name,role,position,active from public.enl_hq_users where user_id=${targetUserId} limit 1`;
  const target=targets[0];
  if(!target||target.active===false||!["manager","executive"].includes(roleNorm(target.role)))
    return json({ok:false,message:"invalid_target"},400);
  const subs=await sql`select id,endpoint,p256dh,auth,user_id from public.enl_push_subscriptions where user_id=${targetUserId}`;
  if(!(subs||[]).length)return json({ok:false,message:"not_configured"},409);
  const cfg=await pushConfig(sql);setVapid(cfg);
  const batchId=crypto.randomUUID();
  let sent=0,failed=0,removed=0;
  for(const s of subs||[]){
    const checkId=crypto.randomUUID(),confirmToken=token(),confirmTokenHash=await sha(confirmToken),createdAt=new Date().toISOString();
    await sql`insert into public.enl_push_device_checks(
      id,batch_id,target_user_id,target_user_name,subscription_id,requested_by_id,requested_by_name,
      send_status,confirm_token_hash,created_at
    ) values(
      ${checkId}::uuid,${batchId}::uuid,${targetUserId},${clean(target.name)},${s.id},
      ${admin.id},${admin.name},'pending',${confirmTokenHash},${createdAt}
    )`;
    const payload=JSON.stringify({
      title:"이앤엘 사고보고앱",
      body:"알림 수신 테스트입니다. ‘확인’을 누르면 알림 설정 정상으로 기록됩니다.",
      tag:`enl-admin-push-test-${checkId}`,
      data:{
        kind:"admin_push_test",checkId,confirmToken,
        url:`https://enlsafety.github.io/stable412.html?pushcheck=${encodeURIComponent(checkId)}`
      }
    });
    try{
      const res:any=await webpush.sendNotification(
        {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
        payload,{TTL:600,urgency:"high"} as any
      );
      const status=Number(res?.statusCode||201);
      await sql`update public.enl_push_device_checks
        set send_status='sent',provider_status=${status},sent_at=now(),last_error=null
        where id=${checkId}::uuid`;
      sent++;
    }catch(e:any){
      const status=Number(e?.statusCode||0),msg=clean(e?.message||e).slice(0,500);
      await sql`update public.enl_push_device_checks
        set send_status='failed',provider_status=${status||null},last_error=${msg}
        where id=${checkId}::uuid`;
      if(status===404||status===410){
        await sql`delete from public.enl_push_subscriptions where id=${s.id}`;
        removed++;
      }
      failed++;
    }
  }
  return json({ok:sent>0,batchId,sent,failed,removed,message:sent>0?undefined:"push_failed"},sent>0?200:502);
}
async function ackTest(sql:any,actor:any,checkId:string){
  const rows=await sql`select id,target_user_id,send_status,opened_at,confirmed_at
    from public.enl_push_device_checks where id=${checkId}::uuid limit 1`;
  const row=rows[0];
  if(!row||clean(row.target_user_id)!==actor.id)return json({ok:false,message:"forbidden"},403);
  if(!row.confirmed_at){
    const now=new Date().toISOString();
    await sql`update public.enl_push_device_checks
      set opened_at=coalesce(opened_at,${now}),opened_by_id=${actor.id},confirmed_at=${now},confirm_method='app'
      where id=${checkId}::uuid`;
  }
  return json({ok:true});
}
async function ackTestToken(sql:any,checkId:string,confirmToken:string,method:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkId)||!confirmToken)
    return json({ok:false,message:"invalid_confirmation"},400);
  const rows=await sql`select id,send_status,confirm_token_hash,confirmed_at,created_at
    from public.enl_push_device_checks where id=${checkId}::uuid limit 1`;
  const row=rows[0];
  if(!row||row.send_status!=="sent"||!clean(row.confirm_token_hash))return json({ok:false,message:"invalid_confirmation"},403);
  if(Date.now()-new Date(row.created_at).getTime()>24*60*60*1000)return json({ok:false,message:"confirmation_expired"},410);
  const supplied=await sha(confirmToken);
  if(supplied!==clean(row.confirm_token_hash))return json({ok:false,message:"invalid_confirmation"},403);
  if(!row.confirmed_at){
    await sql`update public.enl_push_device_checks
      set confirmed_at=now(),confirm_method=${["action","notification"].includes(method)?method:"notification"}
      where id=${checkId}::uuid`;
  }
  return json({ok:true,confirmed:true});
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";
  if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action);
  if(action==="health")return json({ok:true,version:VERSION});
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";
  if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const sql=postgres(dbUrl,{prepare:false,max:3,connect_timeout:5,idle_timeout:2});
  try{
    if(action==="ack_test_token")return await ackTestToken(sql,clean(body.checkId),clean(body.confirmToken),clean(body.method));
    if(action==="status_list"||action==="test_send"){
      const admin=await verifiedHq(sql,body.actor,body.actorPasswordHash,["safety"]);
      if(!admin)return json({ok:false,message:"forbidden"},403);
      if(action==="status_list")return json(await statusList(sql,admin));
      const targetUserId=clean(body.targetUserId);
      if(!targetUserId)return json({ok:false,message:"target_required"},400);
      return await sendTest(sql,admin,targetUserId);
    }
    if(action==="ack_test"){
      const actor=await verifiedHq(sql,body.actor,body.actorPasswordHash,["safety","manager","executive"]);
      if(!actor)return json({ok:false,message:"forbidden"},403);
      const checkId=clean(body.checkId);
      if(!checkId)return json({ok:false,message:"check_required"},400);
      return await ackTest(sql,actor,checkId);
    }
    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){
    console.error("enl-push-admin-v437",clean(e?.message||e));
    return json({ok:false,message:"request_failed"},500);
  }finally{
    await sql.end({timeout:1}).catch(()=>{});
  }
});