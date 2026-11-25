import {validDocumentEvidence,documentEvidenceUrl} from './document-evidence.ts';
import './supervisor-training-model.js';
const model=(globalThis as any).enlSupervisorTrainingModel;
const validId=(s:any)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export async function certificateRequest(sql:any,actor:any,body:any,reply:any){
  const field=actor.role==='field',scoped=field||actor.role==='worker';
  if(!['field','worker','safety','manager','executive'].includes(actor.role))return reply({ok:false,message:'forbidden'},403);
  const siteId=body.siteId,op=body.action.slice('platform_org_certificate_'.length);
  if(typeof siteId!=='string'||!siteId||siteId.length>128||(scoped&&siteId!==actor.siteId))return reply({ok:false,message:'forbidden'},403);
  if(!['list','open','save','approve'].includes(op))return reply({ok:false,message:'unknown_action'},400);
  if(op==='save'&&!field&&actor.role!=='safety')return reply({ok:false,message:'forbidden'},403);
  if(op==='approve'&&actor.role!=='safety')return reply({ok:false,message:'forbidden'},403);
  return sql.begin(async(tx:any)=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${siteId},2911))`;
    const [site]=await tx`select s.site_id,s.site_name,s.active,f.revision as folder_revision
      from public.enl_site_master s join private.enl_org_folders f using(site_id)
      where s.site_id=${siteId} and s.site_id<>'site-hq' and not f.deleted for share`;
    if(!site)return reply({ok:false,message:'site_unavailable'},404);
    if(op==='list'){
      const appointments=await tx`select distinct on(document_id) document_id,revision,appointment,event
        from private.enl_supervisor_appointments where site_id=${siteId} order by document_id,revision desc`;
      appointments.sort((a:any,b:any)=>a.appointment.name.localeCompare(b.appointment.name,'ko'));
      const records=await tx`select distinct on(certificate_id) certificate_id,appointment_id,appointment,revision,event,completed_on::text,actor_name,saved_at,timing_warning
        from private.enl_supervisor_certificates where site_id=${siteId} order by certificate_id,revision desc`;
      return reply({ok:true,site,today:model.today(),appointments,records:records.map((r:any)=>({...r,timing_warning:r.event==='approve'?null:r.timing_warning}))});
    }
    const id=body.certificateId;
    if(!validId(id))return reply({ok:false,message:'invalid_certificate'},400);
    if(op==='open'){
      if(body.revision!=null&&(!Number.isInteger(body.revision)||body.revision<1))return reply({ok:false,message:'invalid_revision'},400);
      const history=await tx`select revision,event,completed_on::text,saved_at,actor_name,appointment from private.enl_supervisor_certificates
        where site_id=${siteId} and certificate_id=${id} order by revision desc`;
      const revision=body.revision??history[0]?.revision;
      if(!revision)return reply({ok:false,message:'unavailable'},404);
      const [document]=await tx`select c.certificate_id,c.appointment_id,c.appointment,c.appointment_revision,c.revision,c.event,c.photo_revision,c.completed_on::text,c.saved_at,c.actor_name,
        c.timing_warning,p.extra_photos,encode(p.photo_jpeg,'base64') as photo from private.enl_supervisor_certificates c
        join private.enl_supervisor_certificates p on p.site_id=c.site_id and p.certificate_id=c.certificate_id and p.revision=c.photo_revision
        where c.site_id=${siteId} and c.certificate_id=${id} and c.revision=${revision}`;
      if(!document)return reply({ok:false,message:'unavailable'},404);
      document.photos=[document.photo,...(document.extra_photos||[])].map(documentEvidenceUrl);document.photo=document.photos[0];delete document.extra_photos;
      if(document.event==='approve')document.timing_warning=null;
      return reply({ok:true,site,document,history});
    }
    if(field&&site.active===false)return reply({ok:false,message:'forbidden'},403);
    if(!validId(body.appointmentId)||!Number.isInteger(body.revision)||body.revision<0||!Number.isInteger(body.appointmentRevision)||!Number.isInteger(body.folderRevision))return reply({ok:false,message:'invalid_certificate'},400);
    if(site.folder_revision!==body.folderRevision)return reply({ok:false,message:'folder_changed'},409);
    const [appointment]=await tx`select revision,appointment from private.enl_supervisor_appointments
      where site_id=${siteId} and document_id=${body.appointmentId} order by revision desc limit 1`;
    if(!appointment)return reply({ok:false,message:'appointment_required'},400);
    if(appointment.revision!==body.appointmentRevision)return reply({ok:false,message:'appointment_changed'},409);
    const [last]=await tx`select revision,event,appointment_id,appointment,photo_revision,completed_on::text,timing_warning from private.enl_supervisor_certificates
      where site_id=${siteId} and certificate_id=${id} order by revision desc limit 1`;
    if((last?.revision??0)!==body.revision)return reply({ok:false,message:'certificate_changed'},409);
    if(last&&(last.appointment_id!==body.appointmentId||last.appointment.name!==appointment.appointment.name||last.appointment.date!==appointment.appointment.date))return reply({ok:false,message:'appointment_changed'},409);
    if(op==='approve'){
      if(!last||last.event==='approve')return reply({ok:false,message:'certificate_changed'},409);
      if(body.reviewedPhotoRevision!==last.photo_revision)return reply({ok:false,message:'photo_review_required'},400);
      const revision=last.revision+1;
      await tx`insert into private.enl_supervisor_certificates(site_id,certificate_id,revision,appointment_id,appointment_revision,appointment,completed_on,photo_revision,actor_id,actor_name,event,timing_warning)
        values(${siteId},${id},${revision},${body.appointmentId},${appointment.revision},${tx.json(appointment.appointment)},${last.completed_on}::date,${last.photo_revision},${actor.id},${actor.name},'approve',${last.timing_warning?tx.json(last.timing_warning):null})`;
      return reply({ok:true,certificateId:id,revision});
    }
    if(!model.validDate(body.completedOn)||body.completedOn>model.today()||body.completedOn<appointment.appointment.date)return reply({ok:false,message:'invalid_completion_date'},400);
    if(body.photos!==undefined&&body.photo!==undefined)return reply({ok:false,message:'photo_required'},400);
    const supplied=body.photos!==undefined||body.photo!==undefined;
    const photos=body.photos??(body.photo!==undefined?[body.photo]:[]);
    if(supplied&&(!Array.isArray(photos)||!photos.length||photos.length>20||!photos.every(validDocumentEvidence))||!supplied&&!last)return reply({ok:false,message:'photo_required'},400);
    const previous=await tx`select distinct on(certificate_id) certificate_id,appointment,completed_on::text
      from private.enl_supervisor_certificates where site_id=${siteId} and appointment_id=${body.appointmentId} order by certificate_id,revision desc`;
    const warning=model.timingWarning(appointment.appointment,previous,body.completedOn,id);
    const revision=body.revision+1;
    await tx`insert into private.enl_supervisor_certificates(site_id,certificate_id,revision,appointment_id,appointment_revision,appointment,completed_on,photo_revision,photo_jpeg,extra_photos,timing_warning,actor_id,actor_name)
      values(${siteId},${id},${revision},${body.appointmentId},${appointment.revision},${tx.json(appointment.appointment)},${body.completedOn}::date,
        ${supplied?revision:last.photo_revision},decode(${supplied?photos[0]:null},'base64'),${tx.json(supplied?photos.slice(1):[])},${warning?tx.json(warning):null},${actor.id},${actor.name})`;
    return reply({ok:true,certificateId:id,revision});
  });
}
