import postgres from "npm:postgres@3.4.5";
import { createClient } from "jsr:@supabase/supabase-js@2.57.4";
import { transition,canRead,fieldAllowed,historical,eventKind,attachments } from "./model.js";
const ORIGIN="https://enlsafety.github.io",APP="incident-report-v2",VERSION="4.4.27-followup1";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const uuid=(v:any)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(v));
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
  if(strong&&(!stored||hash!==stored))return null;
  return {id:clean(u.personnel_id),name:clean(u.name),role:clean(u.access_role),position:clean(u.job_title),siteId:clean(u.site_id),hasCredential:!!stored,proof:strong&&stored?"pin":"account"};
}

async function parent(sql:any,id:string){const r=await sql`select payload from public.enl_incident_shared where incident_id=${id} limit 1`;if(!historical(r[0]?.payload))throw Error("이관종결된 과거사고만 연결할 수 있습니다.");return r[0].payload}
async function notify(sql:any,row:any,action:string){
 const kind=eventKind(action);if(!kind)return;
 const recipients=action==="submit"?await sql`select user_id as id from public.enl_hq_users where active=true and role='safety'`:await sql`select personnel_id::text as id from public.enl_site_personnel where active=true and site_id=${row.siteId} and access_role='field' and job_title in ('현장소장','파트장','서무')`;
 const label:any={create:"후속 개선조치 요구",submit:"후속 개선조치 결과 제출",revision:"후속 개선조치 보완요청",complete:"후속 개선조치 완료"};
 const title=`[${label[action]}] ${row.title}`,body=`완료기한 ${row.dueDate} · ${row.assigneeName||"해당 현장"}`;
 const meta=JSON.stringify({view:"historical_followup",followupId:row.id,title:row.title,dueDate:row.dueDate,status:row.status,requirement:row.requirement,reviewNote:row.review?.note||"",eventLabel:label[action]});
 for(const r of recipients){
  const key=`followup:${row.id}:${row.version}:${r.id}`;
  const ev=await sql`insert into public.enl_push_events(event_key,incident_id,site_id,user_id,kind,title,body,data) values(${key},${row.incidentId},${row.siteId},${r.id},${kind},${title},${body},${meta}::jsonb) on conflict(event_key) do nothing returning id`;
  if(ev[0])await sql`insert into public.enl_email_events(source_push_event_id,event_key,incident_id,site_id,user_id,kind) values(${ev[0].id},${'email:'+key},${row.incidentId},${row.siteId},${r.id},${kind}) on conflict(source_push_event_id) do nothing`;
 }
 // pg_net sends only after transaction commit. No browser session is required for dispatch.
 await sql`select net.http_post(url := 'https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-v418', headers := jsonb_build_object('Content-Type','application/json','x-enl-internal',internal_token), body := '{"action":"dispatch"}'::jsonb, timeout_milliseconds := 10000) from public.enl_push_config where id=1 and coalesce(internal_token,'')<>''`;
}
async function checkFiles(sql:any,row:any){for(const f of attachments(row)){const r=await sql`select metadata from public.enl_historical_followup_files where path=${f.path} and followup_id=${row.id} and site_id=${row.siteId}`;if(!r[0]||JSON.stringify(r[0].metadata)!==JSON.stringify(f)){if(!r[0]||Object.keys(f).some(k=>r[0].metadata[k]!==f[k]))throw Error("첨부파일을 다시 확인해 주세요.")}}}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
 if((req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)||req.headers.get("x-enl-app")!==APP)return json({ok:false,message:"forbidden"},403);
 let b:any;try{b=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
 const sql=postgres(Deno.env.get("SUPABASE_DB_URL")||"",{prepare:false,max:1,connect_timeout:5,idle_timeout:2});
 try{
  const a=await verifyActor(sql,b,true);if(!a)return json({ok:false,message:"auth_proof_required"},401);
  if(!["safety","manager","executive"].includes(a.role)&&!fieldAllowed(a))return json({ok:false,message:"forbidden"},403);
  if(b.action==="list"){
   const rows=a.role==="field"?await sql`select payload from public.enl_historical_followups where site_id=${a.siteId} order by updated_at desc`:await sql`select payload from public.enl_historical_followups order by updated_at desc`;
   return json({ok:true,version:VERSION,rows:rows.map((r:any)=>r.payload)});
  }
  if(b.action==="options"){
   if(a.role!=="safety")throw Error("forbidden");
   const sites=await sql`select site_id,site_name,active from public.enl_site_master order by site_name`;
   const people=await sql`select personnel_id::text as id,site_id,name,job_title from public.enl_site_personnel where active=true and access_role='field' and job_title in ('현장소장','파트장','서무') order by name`;
   return json({ok:true,sites,people});
  }
  if(!uuid(b.id))throw Error("invalid_id");
  if(b.action==="audit"||b.action==="sign"){
   const rr=await sql`select payload from public.enl_historical_followups where id=${b.id}`;const row=rr[0]?.payload;if(!row||!canRead(a,row))throw Error("forbidden");
   if(b.action==="audit"){const r=await sql`select action,actor_id,actor_name,created_at,before_payload,after_payload from public.enl_historical_followup_audit where followup_id=${b.id} order by created_at`;return json({ok:true,history:r})}
   const path=clean(b.path);const linked=await sql`select path from public.enl_historical_followup_files where followup_id=${b.id} and path=${path}`;if(!linked[0])throw Error("forbidden");
   const storage=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!).storage.from("enl-incident-files");
   const r=await storage.createSignedUrl(path,300);if(r.error)throw r.error;return json({ok:true,url:r.data.signedUrl});
  }
  if(b.action==="upload"){
   const rr=await sql`select payload from public.enl_historical_followups where id=${b.id}`;const row=rr[0]?.payload;
   if(row){if(!fieldAllowed(a)||a.siteId!==row.siteId||!["in_progress","revision_requested"].includes(row.status))throw Error("forbidden");}
   else {if(a.role!=="safety")throw Error("forbidden");await parent(sql,clean(b.incidentId));const sites=await sql`select site_id from public.enl_site_master where site_id=${clean(b.siteId)}`;if(!sites[0])throw Error("사업장을 확인해 주세요.");}
   const siteId=row?.siteId||clean(b.siteId),f=b.file||{},mime=clean(f.mime),size=Number(f.size);
   if(!["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"].includes(mime)||size<=0||size>8*1024*1024||clean(f.base64).length>12*1024*1024)throw Error("이미지·PDF만 8MB까지 첨부할 수 있습니다.");
   const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));if(bytes.length!==size)throw Error("invalid_file");
   const name=clean(f.name).replace(/[\\/<>]/g,"_").slice(0,160)||"첨부",path=`historical-followups/${b.id}/${crypto.randomUUID()}`;
   const metadata={path,name,mime,size,kind:mime.startsWith("image/")?"image":"pdf"};
   const storage=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!).storage.from("enl-incident-files");
   const r=await storage.upload(path,bytes,{contentType:mime,upsert:false});if(r.error)throw r.error;
   await sql`insert into public.enl_historical_followup_files(path,followup_id,site_id,owner_id,metadata) values(${path},${b.id},${siteId},${a.id},${JSON.stringify(metadata)}::jsonb)`;
   return json({ok:true,attachment:metadata});
  }
  if(!uuid(b.mutationId))throw Error("invalid_mutation_id");
  const row=await sql.begin(async(t:any)=>{
   // Row locks serialize concurrent reviewers; mutation IDs make network retries idempotent.
   await t`select pg_advisory_xact_lock(hashtextextended(${b.id},0))`;
   const old=await t`select payload from public.enl_historical_followups where id=${b.id} for update`;const prev=old[0]?.payload||null;
   const duplicate=await t`select actor_id,followup_id from public.enl_historical_followup_audit where mutation_id=${b.mutationId}`;
   if(duplicate[0]){if(duplicate[0].actor_id!==a.id||duplicate[0].followup_id!==b.id||!prev||!canRead(a,prev))throw Error("forbidden");return prev}
   if(b.action==="create"){
    if(prev)throw Error("conflict");if(a.role!=="safety")throw Error("forbidden");await parent(t,clean(b.incidentId));
    const sites=await t`select site_id from public.enl_site_master where site_id=${clean(b.siteId)}`;if(!sites[0])throw Error("사업장을 확인해 주세요.");
    if(b.assigneeId){const p=await t`select name from public.enl_site_personnel where personnel_id::text=${clean(b.assigneeId)} and site_id=${clean(b.siteId)} and active=true and access_role='field' and job_title in ('현장소장','파트장','서무')`;if(!p[0])throw Error("담당자를 다시 선택해 주세요.");b.assigneeName=p[0].name}else b.assigneeName="";
   }else if(!prev)throw Error("not_found");
   const next=transition(prev,b,a,new Date().toISOString());await checkFiles(t,next);
   if(prev)await t`update public.enl_historical_followups set payload=${JSON.stringify(next)}::jsonb,status=${next.status},due_date=${next.dueDate},version=${next.version},updated_at=${next.updatedAt} where id=${next.id}`;
   else await t`insert into public.enl_historical_followups(id,incident_id,site_id,status,due_date,version,payload) values(${next.id},${next.incidentId},${next.siteId},${next.status},${next.dueDate},${next.version},${JSON.stringify(next)}::jsonb)`;
   await t`insert into public.enl_historical_followup_audit(followup_id,mutation_id,action,actor_id,actor_name,actor_role,before_payload,after_payload) values(${next.id},${b.mutationId},${b.action},${a.id},${a.name},${a.role},${prev?JSON.stringify(prev):null}::jsonb,${JSON.stringify(next)}::jsonb)`;
   await notify(t,next,b.action);return next;
  });
  return json({ok:true,row});
 }catch(e:any){const m=clean(e?.message);return json({ok:false,message:m==="forbidden"?"forbidden":m==="conflict"?"conflict":m.startsWith("invalid_")||m==="not_found"?m:/[가-힣]/.test(m)?m:"저장하지 못했습니다. 잠시 후 다시 시도해 주세요."},m==="forbidden"?403:m==="conflict"?409:400)}finally{await sql.end({timeout:1}).catch(()=>{})}
});
