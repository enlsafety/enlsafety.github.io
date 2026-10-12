import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const APP="incident-report-v2";
const VERSION="4.5.4-bulk-preservation1";
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
const parsePayload=(v:any)=>{if(v&&typeof v==="object")return v;if(typeof v==="string"){try{return JSON.parse(v)}catch{return null}}return null};

function isBulkImported(i:any){return !!(clean(i?.historicalOrigin?.batchId)&&clean(i?.historicalOrigin?.candidateId)&&i?.externalInitialApproval?.state==="verified")}

function actorFrom(body:any){
  const a=body?.actor||{};
  return {id:clean(a.id),name:clean(a.name),role:roleNorm(a.role),position:clean(a.position),siteId:clean(a.siteId)};
}
async function verifySafety(sql:any,body:any){
  const a=actorFrom(body),hash=clean(body?.actorPasswordHash);
  if(!a.id||a.role!=="safety"||!hash)return null;
  const rows=await sql`select user_id,name,role,position,active,password_hash from public.enl_hq_users where user_id=${a.id} limit 1`;
  const u=rows[0];
  if(!u||u.active===false||roleNorm(u.role)!=="safety"||clean(u.password_hash)!==hash)return null;
  return {id:clean(u.user_id),name:clean(u.name),role:"safety",position:clean(u.position),siteId:""};
}
async function audit(sql:any,incidentId:string,siteId:string,action:string,actor:any,before:any,after:any){
  const at=new Date().toISOString();
  await sql`insert into public.enl_incident_audit
    (incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload)
    values(${incidentId},${siteId},${action},${actor.id},${actor.name},${actor.role},${actor.position},${at},
      ${before?JSON.stringify(before):null}::jsonb,${after?JSON.stringify(after):null}::jsonb)`;
  return at;
}
async function snapshotRows(sql:any){
  const rows=await sql`select incident_id,site_id,payload,created_at,updated_at from public.enl_incident_shared order by created_at asc`;
  return rows.map((r:any)=>({
    incident_id:clean(r.incident_id),site_id:clean(r.site_id),payload:parsePayload(r.payload),
    created_at:r.created_at,updated_at:r.updated_at
  })).filter((r:any)=>r.incident_id&&r.site_id&&r.payload);
}
async function createBackup(sql:any,actor:any,reason:string,sourceVersion=VERSION){
  const snapshot=await snapshotRows(sql),id=crypto.randomUUID(),at=new Date().toISOString();
  await sql`insert into public.enl_incident_backups
    (backup_id,created_at,created_by_id,created_by_name,created_by_role,reason,incident_count,snapshot,source_version)
    values(${id}::uuid,${at},${actor.id},${actor.name},${actor.role},${reason},${snapshot.length},${JSON.stringify(snapshot)}::jsonb,${sourceVersion})`;
  return {backupId:id,createdAt:at,incidentCount:snapshot.length};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";
  if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==APP)return json({ok:false,message:"invalid_client"},403);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action);
  if(action==="health")return json({ok:true,version:VERSION});

  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";
  if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  const sql=postgres(dbUrl,{prepare:false,max:2,connect_timeout:5,idle_timeout:2});
  try{
    const actor=await verifySafety(sql,body);
    if(!actor)return json({ok:false,message:"forbidden"},403);

    if(action==="audit_list"){
      const incidentId=clean(body.incidentId);if(!incidentId)return json({ok:false,message:"incident_required"},400);
      const rows=await sql`select audit_id,incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload
        from public.enl_incident_audit where incident_id=${incidentId} order by changed_at desc limit 500`;
      return json({ok:true,audits:rows});
    }

    if(action==="delete_incident"){
      const incidentId=clean(body.incidentId),reason=clean(body.reason);
      if(!incidentId)return json({ok:false,message:"incident_required"},400);
      if(reason.length<2)return json({ok:false,message:"reason_required"},400);
      const rows=await sql`select incident_id,site_id,payload from public.enl_incident_shared where incident_id=${incidentId} limit 1`;
      const row=rows[0];if(!row)return json({ok:false,message:"not_found"},404);
      const prev=parsePayload(row.payload);
      if(isBulkImported(prev))return json({ok:false,message:"bulk_delete_requires_invalidation"},409);
      const backup=await createBackup(sql,actor,`삭제 전 자동백업: ${incidentId} / ${reason}`);
      const deletedAt=new Date().toISOString();
      await audit(sql,incidentId,clean(row.site_id),"delete",actor,prev,{
        deleted:true,reason,deletedAt,backupId:backup.backupId
      });
      await sql`delete from public.enl_incident_shared where incident_id=${incidentId}`;
      return json({ok:true,deleted:true,backupId:backup.backupId,deletedAt});
    }

    if(action==="backup_create"){
      const reason=clean(body.reason)||"수동 백업";
      const backup=await createBackup(sql,actor,reason);
      return json({ok:true,...backup});
    }

    if(action==="backup_list"){
      const rows=await sql`select backup_id,created_at,created_by_id,created_by_name,created_by_role,reason,incident_count,source_version
        from public.enl_incident_backups order by created_at desc limit 100`;
      return json({ok:true,backups:rows});
    }

    if(action==="backup_export"){
      const id=clean(body.backupId);if(!id)return json({ok:false,message:"backup_required"},400);
      const rows=await sql`select backup_id,created_at,created_by_id,created_by_name,created_by_role,reason,incident_count,snapshot,source_version
        from public.enl_incident_backups where backup_id=${id}::uuid limit 1`;
      if(!rows[0])return json({ok:false,message:"not_found"},404);
      return json({ok:true,backup:rows[0]});
    }

    if(action==="backup_restore"){
      const id=clean(body.backupId),reason=clean(body.reason);
      if(!id)return json({ok:false,message:"backup_required"},400);
      if(reason.length<2)return json({ok:false,message:"reason_required"},400);
      const rows=await sql`select backup_id,snapshot from public.enl_incident_backups where backup_id=${id}::uuid limit 1`;
      const target=rows[0];if(!target)return json({ok:false,message:"not_found"},404);
      const snapshot=parsePayload(target.snapshot);
      if(!Array.isArray(snapshot))return json({ok:false,message:"invalid_backup"},409);
      if(snapshot.some((r:any)=>isBulkImported(parsePayload(r?.payload))))return json({ok:false,message:"bulk_records_prevent_full_restore"},409);
      const existingBulk=await sql`select incident_id from public.enl_incident_shared where coalesce(payload->'historicalOrigin'->>'batchId','')<>'' and coalesce(payload->'historicalOrigin'->>'candidateId','')<>'' and payload->'externalInitialApproval'->>'state'='verified' limit 1`;
      if(existingBulk.length)return json({ok:false,message:"bulk_records_prevent_full_restore"},409);
      const pre=await createBackup(sql,actor,`복원 전 자동백업: ${id} / ${reason}`);
      const beforeRows=await snapshotRows(sql);
      const beforeMap=new Map(beforeRows.map((r:any)=>[r.incident_id,r]));
      const afterMap=new Map(snapshot.map((r:any)=>[clean(r.incident_id),r]).filter((x:any)=>x[0]&&x[1]?.payload));

      await sql.begin(async(tx:any)=>{
        // Recheck under a table lock so a concurrent import cannot be deleted by restore.
        await tx`lock table public.enl_incident_shared in share row exclusive mode`;
        const bulk=await tx`select incident_id from public.enl_incident_shared where coalesce(payload->'historicalOrigin'->>'batchId','')<>'' and coalesce(payload->'historicalOrigin'->>'candidateId','')<>'' and payload->'externalInitialApproval'->>'state'='verified' limit 1`;
        if(bulk.length)throw Error("bulk_records_prevent_full_restore");
        await tx`delete from public.enl_incident_shared`;
        for(const r of snapshot){
          const incidentId=clean(r?.incident_id),siteId=clean(r?.site_id),payload=r?.payload;
          if(!incidentId||!siteId||!payload)continue;
          const createdAt=r?.created_at||new Date().toISOString(),updatedAt=r?.updated_at||createdAt;
          await tx`insert into public.enl_incident_shared(incident_id,site_id,payload,created_at,updated_at)
            values(${incidentId},${siteId},${JSON.stringify(payload)}::jsonb,${createdAt},${updatedAt})`;
        }
        const ids=new Set([...beforeMap.keys(),...afterMap.keys()]);
        for(const incidentId of ids){
          const b:any=beforeMap.get(incidentId),a:any=afterMap.get(incidentId),siteId=clean(a?.site_id||b?.site_id);
          await tx`insert into public.enl_incident_audit
            (incident_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload)
            values(${incidentId},${siteId},'restore',${actor.id},${actor.name},${actor.role},${actor.position},now(),
              ${b?.payload?JSON.stringify(b.payload):null}::jsonb,
              ${a?.payload?JSON.stringify(a.payload):JSON.stringify({restoredDeleted:true,reason,backupId:id})}::jsonb)`;
        }
      });
      return json({ok:true,restored:true,restoredBackupId:id,preRestoreBackupId:pre.backupId,incidentCount:afterMap.size});
    }

    return json({ok:false,message:"invalid_action"},400);
  }catch(e:any){
    if(clean(e?.message)==="bulk_records_prevent_full_restore")return json({ok:false,message:"bulk_records_prevent_full_restore"},409);
    console.error("enl-incident-compliance-v439",{code:clean(e?.code)||"request_failed"});
    return json({ok:false,message:"request_failed"},500);
  }finally{await sql.end({timeout:1}).catch(()=>{})}
});
