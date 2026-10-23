import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const VERSION="4.7.2-personnel-proof";
const FIELD_TITLES=["현장소장","파트장","서무"];
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any)=>String(v??"").trim();
const sameProof=(a:string,b:string)=>{let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0;};
const norm=(v:any)=>clean(v).replace(/\s+/g,"").toLocaleLowerCase("ko-KR");
const roleNorm=(v:any)=>clean(v)==="final"?"manager":clean(v);
const isFieldTitle=(v:any)=>FIELD_TITLES.includes(clean(v));
const stripTitle=(v:any)=>clean(v).replace(/ \((현장소장|파트장|서무)\)$/,'');
const sha256=async(v:string)=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action),rawActor=body.actor||{},actor={id:clean(rawActor.id),name:clean(rawActor.name),role:roleNorm(rawActor.role),position:clean(rawActor.position),siteId:clean(rawActor.siteId)},now=new Date().toISOString();
  const sql=postgres(dbUrl,{prepare:false,max:3,connect_timeout:5,idle_timeout:2});
  try{
    async function verifiedActor(){
      if(!actor.id)return null;
      if(actor.role==="safety"){
        const proof=clean(body.actorPasswordHash);if(!proof)return null;
        const rows=await sql`select user_id,name,role,position,active,password_hash from public.enl_hq_users where user_id=${actor.id} limit 1`,u=rows[0];
        if(!u||u.active!==true||roleNorm(u.role)!=="safety"||!clean(u.password_hash)||!sameProof(clean(u.password_hash),proof))return null;
        return {id:clean(u.user_id),name:clean(u.name),role:"safety",position:clean(u.position),siteId:""};
      }
      if(actor.role==="field"){
        const proof=clean(body.actorPinHash);if(!proof)return null;
        const rows=await sql`select personnel_id,site_id,name,job_title,access_role,active,pin_hash from public.enl_site_personnel where personnel_id::text=${actor.id} limit 1`,u=rows[0];
        if(!u||u.active!==true||clean(u.access_role)!=="field"||!isFieldTitle(u.job_title)||!clean(u.pin_hash)||!sameProof(clean(u.pin_hash),proof))return null;
        if(actor.siteId&&clean(u.site_id)!==actor.siteId)return null;
        return {id:clean(u.personnel_id),name:clean(u.name),role:"field",position:clean(u.job_title),siteId:clean(u.site_id)};
      }
      return null;
    }
    async function counts(siteId:string){
      const rows=await sql`select
        count(*) filter (where active) as active_total,
        count(*) filter (where active and access_role='worker') as active_workers,
        count(*) filter (where active and access_role='field') as active_field,
        count(*) filter (where not active) as inactive_total
        from public.enl_site_personnel where site_id=${siteId}`;
      const r=rows[0]||{};return {activeTotal:Number(r.active_total||0),activeWorkers:Number(r.active_workers||0),activeField:Number(r.active_field||0),inactiveTotal:Number(r.inactive_total||0)};
    }
    async function audit(saved:any,prev:any,v:any,actionName:string){
      await sql`insert into public.enl_personnel_audit(personnel_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload)
        values(${saved?.personnel_id||prev?.personnel_id||null},${saved?.site_id||prev?.site_id},${actionName},${v.id},${v.name},${v.role},${v.position},${now},${prev?JSON.stringify(prev):null}::jsonb,${saved?JSON.stringify(saved):null}::jsonb)`;
    }
    async function clearMasterIfOwned(prev:any){
      if(!prev||!isFieldTitle(prev.job_title))return;
      const sid=clean(prev.site_id),name=stripTitle(prev.name),title=clean(prev.job_title),rows=await sql`select manager_name,part_name,clerk_name from public.enl_site_master where site_id=${sid} limit 1`,m=rows[0];if(!m)return;
      if(title==="현장소장"&&norm(m.manager_name)===norm(name))await sql`update public.enl_site_master set manager_name='',manager_phone='',updated_at=${now} where site_id=${sid}`;
      if(title==="파트장"&&norm(m.part_name)===norm(name))await sql`update public.enl_site_master set part_name='',part_phone='',updated_at=${now} where site_id=${sid}`;
      if(title==="서무"&&norm(m.clerk_name)===norm(name))await sql`update public.enl_site_master set clerk_name='',clerk_phone='',updated_at=${now} where site_id=${sid}`;
    }
    async function syncMaster(saved:any){
      if(!saved||saved.active===false||clean(saved.access_role)!=="field")return;
      const sid=clean(saved.site_id),name=stripTitle(saved.name),phone=clean(saved.phone),title=clean(saved.job_title);
      if(title==="현장소장")await sql`update public.enl_site_master set manager_name=${name},manager_phone=${phone},updated_at=${now} where site_id=${sid}`;
      else if(title==="파트장")await sql`update public.enl_site_master set part_name=${name},part_phone=${phone},updated_at=${now} where site_id=${sid}`;
      else if(title==="서무")await sql`update public.enl_site_master set clerk_name=${name},clerk_phone=${phone},updated_at=${now} where site_id=${sid}`;
    }
    async function managerPinFromMaster(siteId:string,name:string,title:string){
      const rows=await sql`select manager_name,manager_phone,part_name,part_phone,clerk_name,clerk_phone from public.enl_site_master where site_id=${siteId} limit 1`,m=rows[0];if(!m)return "";
      let masterName="",phone="";if(title==="현장소장"){masterName=clean(m.manager_name);phone=clean(m.manager_phone)}else if(title==="파트장"){masterName=clean(m.part_name);phone=clean(m.part_phone)}else if(title==="서무"){masterName=clean(m.clerk_name);phone=clean(m.clerk_phone)};
      if(!masterName||norm(masterName)!==norm(stripTitle(name)))return "";const digits=phone.replace(/\D/g,"");return digits.length>=4?await sha256(digits.slice(-4)):"";
    }

    if(action==="health")return json({ok:true,version:VERSION});

    if(action==="personnel_pull"){
      const siteId=clean(body.siteId),v=await verifiedActor();if(!siteId)return json({ok:false,message:"site_required"},400);
      if(!(v?.role==="safety"||(v?.role==="field"&&v.siteId===siteId)))return json({ok:false,message:"forbidden"},403);
      const rows=await sql`select personnel_id,site_id,name,job_title,access_role,phone,email,push_enabled,email_enabled,active,created_at,updated_at,updated_by_name,updated_by_role,updated_by_position from public.enl_site_personnel where site_id=${siteId} order by active desc,case when job_title='현장소장' then 0 when job_title='파트장' then 1 when job_title='서무' then 2 else 3 end,name`;
      return json({ok:true,personnel:rows,counts:await counts(siteId)});
    }

    if(action==="personnel_upsert"){
      const p=body.person||{},siteId=clean(p.siteId||body.siteId),name=stripTitle(p.name),targetId=clean(p.personnelId),requestedRole=clean(p.accessRole)==="field"?"field":"worker",requestedTitle=clean(p.jobTitle),phone=clean(p.phone),hasEmail=Object.prototype.hasOwnProperty.call(p,"email"),hasPush=Object.prototype.hasOwnProperty.call(p,"pushEnabled"),hasMail=Object.prototype.hasOwnProperty.call(p,"emailEnabled"),active=p.active!==false,passwordHash=clean(p.passwordHash),v=await verifiedActor();
      if(!siteId||!name)return json({ok:false,message:"invalid_personnel"},400);
      if(!(v?.role==="safety"||(v?.role==="field"&&v.siteId===siteId)))return json({ok:false,message:"forbidden"},403);
      const list=await sql`select * from public.enl_site_personnel where site_id=${siteId}`;
      const prev=targetId?list.find((x:any)=>String(x.personnel_id)===targetId):null;const email=hasEmail?clean(p.email).toLowerCase():clean(prev?.email),pushEnabled=hasPush?p.pushEnabled!==false:prev?.push_enabled!==false,emailEnabled=hasMail?p.emailEnabled!==false:prev?.email_enabled!==false;
      if(targetId&&!prev)return json({ok:false,message:"person_not_found"},404);
      if(v.role==="field"){
        if(prev&&(clean(prev.access_role)!=="worker"||isFieldTitle(prev.job_title)))return json({ok:false,message:"manager_edit_safety_only"},403);
        if(requestedRole!=="worker"||isFieldTitle(requestedTitle))return json({ok:false,message:"role_change_safety_only"},403);
      }
      if(!targetId){
        const same=list.filter((x:any)=>x.active!==false&&norm(stripTitle(x.name))===norm(name));
        if(same.some((x:any)=>clean(x.access_role)==="field"||isFieldTitle(x.job_title)))return json({ok:false,message:"manager_name_conflict"},409);
        if(same.length)return json({ok:false,message:"duplicate_personnel"},409);
      }
      const accessRole=v.role==="field"?"worker":requestedRole;
      const jobTitle=accessRole==="field"?requestedTitle:"일반근로자";
      if(accessRole==="field"&&!isFieldTitle(jobTitle))return json({ok:false,message:"invalid_position"},400);
      if(prev&&norm(name)!==norm(stripTitle(prev.name))){
        const collision=list.find((x:any)=>String(x.personnel_id)!==String(prev.personnel_id)&&x.active!==false&&norm(stripTitle(x.name))===norm(name));
        if(collision)return json({ok:false,message:(clean(collision.access_role)==="field"||isFieldTitle(collision.job_title))?"manager_name_conflict":"duplicate_personnel"},409);
      }
      let pinHash="";
      if(accessRole==="field"){
        if(passwordHash)pinHash=passwordHash;
        else if(prev&&clean(prev.pin_hash))pinHash=clean(prev.pin_hash);
        else{const digits=phone.replace(/\D/g,"");pinHash=digits.length>=4?await sha256(digits.slice(-4)):await managerPinFromMaster(siteId,name,jobTitle)}
        if(!pinHash)return json({ok:false,message:"manager_phone_required"},400);
      }
      if(prev&&isFieldTitle(prev.job_title)&&(accessRole!=="field"||jobTitle!==clean(prev.job_title)||!active))await clearMasterIfOwned(prev);
      if(v.role==="safety"&&accessRole==="field"&&active){
        for(const other of list){
          if(prev&&String(other.personnel_id)===String(prev.personnel_id))continue;
          if(other.active!==false&&clean(other.access_role)==="field"&&clean(other.job_title)===jobTitle){
            const before={...other};const q=await sql`update public.enl_site_personnel set job_title='일반근로자',access_role='worker',pin_hash=null,updated_at=${now},updated_by_id=${v.id},updated_by_name=${v.name},updated_by_role=${v.role},updated_by_position=${v.position} where personnel_id=${other.personnel_id} returning *`;await audit(q[0],before,v,"update");
          }
        }
      }
      let rows:any[];
      if(prev)rows=await sql`update public.enl_site_personnel set name=${name},job_title=${jobTitle},access_role=${accessRole},phone=${phone},email=${email},push_enabled=${pushEnabled},email_enabled=${emailEnabled},active=${active},pin_hash=${accessRole==="field"?pinHash:null},updated_at=${now},updated_by_id=${v.id},updated_by_name=${v.name},updated_by_role=${v.role},updated_by_position=${v.position},source=${prev.source||"app-v434"} where personnel_id=${prev.personnel_id} returning *`;
      else rows=await sql`insert into public.enl_site_personnel(site_id,name,job_title,access_role,phone,email,push_enabled,email_enabled,active,pin_hash,source,created_at,updated_at,updated_by_id,updated_by_name,updated_by_role,updated_by_position) values(${siteId},${name},${jobTitle},${accessRole},${phone},${email},${pushEnabled},${emailEnabled},${active},${accessRole==="field"?pinHash:null},'app-v434',${now},${now},${v.id},${v.name},${v.role},${v.position}) returning *`;
      const saved=rows[0];await audit(saved,prev,v,!prev?"create":prev.active&&!active?"retire":!prev.active&&active?"reactivate":"update");await syncMaster(saved);
      return json({ok:true,person:{...saved,pin_hash:undefined},counts:await counts(siteId)});
    }

    if(action==="personnel_delete"){
      const personnelId=clean(body.personnelId||body.person?.personnelId),v=await verifiedActor();if(!personnelId)return json({ok:false,message:"personnel_id_required"},400);if(!v)return json({ok:false,message:"forbidden"},403);
      const rows=await sql`select * from public.enl_site_personnel where personnel_id::text=${personnelId} limit 1`,prev=rows[0];if(!prev)return json({ok:false,message:"person_not_found"},404);
      const siteId=clean(prev.site_id);
      if(!(v?.role==="safety"||(v?.role==="field"&&v.siteId===siteId)))return json({ok:false,message:"forbidden"},403);
      if(v.role==="field"&&(clean(prev.access_role)!=="worker"||isFieldTitle(prev.job_title)))return json({ok:false,message:"manager_delete_safety_only"},403);
      if(String(v.id)===String(prev.personnel_id))return json({ok:false,message:"cannot_delete_self"},409);
      if(isFieldTitle(prev.job_title)||clean(prev.access_role)==="field")await clearMasterIfOwned(prev);
      await audit(null,prev,v,"delete");
      await sql`delete from public.enl_push_subscriptions where user_id=${String(prev.personnel_id)}`;
      await sql`delete from public.enl_site_personnel where personnel_id=${prev.personnel_id}`;
      return json({ok:true,deletedId:String(prev.personnel_id),siteId,counts:await counts(siteId)});
    }

    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){return json({ok:false,message:"request_failed"},500)}finally{await sql.end({timeout:1}).catch(()=>{})}
});
