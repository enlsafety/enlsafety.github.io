import { validPrintPhoto } from './organization.ts';
const validId=(s:any)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function appointmentData(input:any){
  if(!input||typeof input!=='object')return null;
  const result:any={};
  for(const [key,max] of [['department',60],['position',32],['name',32]] as const){
    const v=input[key];
    if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))return null;
    result[key]=v.trim();
  }
  const date=input.date;
  if(typeof date!=='string'||!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(date))return null;
  const d=new Date(date+'T00:00:00Z');
  if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date)return null;
  return {...result,date};
}
export async function appointmentRequest(sql:any,actor:any,body:any,reply:any){
  const field=actor.role==='field',safety=actor.role==='safety',scoped=field||actor.role==='worker';
  if(!['field','worker','safety','manager','executive'].includes(actor.role))return reply({ok:false,message:'forbidden'},403);
  const siteId=body.siteId;
  if(typeof siteId!=='string'||!siteId||siteId.length>128||(scoped&&siteId!==actor.siteId))return reply({ok:false,message:'forbidden'},403);
  const [site]=await sql`select s.site_id,s.site_name,s.active,f.revision as folder_revision
    from public.enl_site_master s join private.enl_org_folders f using(site_id)
    where s.site_id=${siteId} and s.site_id<>'site-hq' and not f.deleted`;
  if(!site)return reply({ok:false,message:'site_unavailable'},404);
  const op=body.action.slice('platform_org_appointment_'.length),id=body.documentId;
  if(id!=null&&!validId(id))return reply({ok:false,message:'invalid_document'},400);
  if(op==='open'){
    if(body.revision!=null&&(!id||!Number.isInteger(body.revision)||body.revision<1))return reply({ok:false,message:'invalid_revision'},400);
    const result=await sql.begin(async(tx:any)=>{
      await tx`select pg_advisory_xact_lock(hashtextextended(${siteId},2911))`;
      const records=await tx`select distinct on(document_id) document_id,revision,appointment,event,saved_at,actor_name
        from private.enl_supervisor_appointments where site_id=${siteId} order by document_id,revision desc`;
      records.sort((a:any,b:any)=>new Date(b.saved_at).getTime()-new Date(a.saved_at).getTime());
      const selected=id??records[0]?.document_id;
      const history=selected?await tx`select revision,event,saved_at,actor_name,appointment
        from private.enl_supervisor_appointments where site_id=${siteId} and document_id=${selected} order by revision desc`:[];
      const rev=body.revision??history[0]?.revision;
      const [document]=selected&&rev?await tx`select document_id,revision,site_name,appointment,event,saved_at,actor_name,photo_revision
        from private.enl_supervisor_appointments where site_id=${siteId} and document_id=${selected} and revision=${rev}`:[];
      if(document?.photo_revision){
        const [photo]=await tx`select encode(print_jpeg,'base64') as jpeg from private.enl_supervisor_appointments
          where site_id=${siteId} and document_id=${selected} and revision=${document.photo_revision}`;
        if(photo?.jpeg)document.photo='data:image/jpeg;base64,'+photo.jpeg.replace(/\s/g,'');
      }
      return {records,history,document:document??null};
    });
    if(id&&!result.document)return reply({ok:false,message:'unavailable'},404);
    let template;
    if(body.includeTemplate===true){
      const [row]=await sql`select encode(image_webp,'base64') as image from private.enl_org_templates where template_key='supervisor-appointment-v1'`;
      if(!row)return reply({ok:false,message:'template_unavailable'},503);
      template='data:image/webp;base64,'+row.image.replace(/\s/g,'');
    }
    return reply({ok:true,site,...result,template});
  }
  if(!['save','submit','approve','reopen'].includes(op))return reply({ok:false,message:'unknown_action'},400);
  if((!field&&!safety)||(op==='submit'&&!field)||(op==='approve'&&!safety))return reply({ok:false,message:'forbidden'},403);
  const data=op==='save'?appointmentData(body.appointment):null;
  if(!validId(id)||!Number.isInteger(body.revision)||body.revision<0||!Number.isInteger(body.folderRevision)||(op==='save'&&!data))return reply({ok:false,message:'invalid_appointment'},400);
  if(op==='submit'&&!validPrintPhoto(body.photo))return reply({ok:false,message:'photo_required'},400);
  return sql.begin(async(tx:any)=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${siteId},2911))`;
    const [current]=await tx`select s.site_name,s.active,f.revision from public.enl_site_master s join private.enl_org_folders f using(site_id)
      where s.site_id=${siteId} and not f.deleted for share`;
    if(!current||current.revision!==body.folderRevision)return reply({ok:false,message:'folder_changed'},409);
    if(field&&current.active===false)return reply({ok:false,message:'forbidden'},403);
    const [last]=await tx`select revision,appointment,event,photo_revision from private.enl_supervisor_appointments
      where site_id=${siteId} and document_id=${id} order by revision desc limit 1`;
    if((last?.revision??0)!==body.revision)return reply({ok:false,message:'appointment_changed'},409);
    const locked=last&&['submit','approve'].includes(last.event);
    if(op!=='save'&&!last)return reply({ok:false,message:'appointment_required'},400);
    if((op==='save'||op==='submit')&&locked||op==='approve'&&last.event!=='submit'||op==='reopen'&&!locked)
      return reply({ok:false,message:'review_state_changed'},409);
    if(op==='approve'&&(!last.photo_revision||last.photo_revision!==body.reviewedPhotoRevision))return reply({ok:false,message:'review_photo_required'},409);
    const revision=body.revision+1,photo=op==='submit'?body.photo:null;
    await tx`insert into private.enl_supervisor_appointments(site_id,document_id,revision,site_name,appointment,event,photo_revision,print_jpeg,actor_id,actor_name)
      values(${siteId},${id},${revision},${current.site_name},${tx.json(data??last.appointment)},${op},
      ${photo?revision:op==='approve'?last.photo_revision:null},decode(${photo},'base64'),${actor.id},${actor.name})`;
    return reply({ok:true,documentId:id,revision});
  });
}
