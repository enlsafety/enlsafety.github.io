const moduleKeys=['incident','risk','tbm','organization','training','msds'];
const systemRoles=['worker','field','manager','executive','safety'];
const safetyArt=['policy','law','voice','emergency','ppe','ergonomics','rules'];
const serviceKeys=['history','approvals','notices','documents','dashboard','system'];
function canEnter(item:any,actor:any){
  if(!item||item.enabled===false||item.state==='hidden')return false;
  const admin=actor.role==='safety';
  if(item.key==='system'&&!admin)return false;
  if(item.key==='history'&&!admin&&!['manager','executive'].includes(actor.role)&&!(actor.role==='field'&&actor.siteId&&['현장소장','파트장','서무'].includes(actor.position)))return false;
  const principal=(['field','worker'].includes(actor.role)?'site:':'hq:')+actor.id;
  return (admin||item.roles.includes(actor.role))&&(item.state==='live'||(item.preview&&(admin||item.pilots.includes(principal))));
}
export async function serviceAllowed(sql:any,actor:any,key:string){
  const [row]=await sql`select item from private.enl_platform_catalog cross join lateral jsonb_array_elements(services) item where singleton and item->>'key'=${key}`;
  return canEnter(row?.item,actor);
}
const bannerKeys=['welcome','report','opening','fire','health','tbm','ppe','prevention'];
function bannerImage(bytes:Uint8Array,mime:string){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0;
 const ascii=(at:number,n:number)=>String.fromCharCode(...bytes.slice(at,at+n));
 if(mime==='image/png'&&bytes.length>=24&&ascii(1,3)==='PNG'&&bytes[0]===137&&ascii(12,4)==='IHDR'){width=v.getUint32(16);height=v.getUint32(20)}
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){
  let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;const size=v.getUint16(i);if(size<2||i+size>bytes.length)break;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){height=v.getUint16(i+3);width=v.getUint16(i+5);break}i+=size;
  }
 }
 if(mime==='image/webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
  const kind=ascii(12,4),u24=(i:number)=>bytes[i]+bytes[i+1]*256+bytes[i+2]*65536;
  if(kind==='VP8X'){width=1+u24(24);height=1+u24(27)}
  if(kind==='VP8 '&&ascii(23,3)==='\x9d\x01\x2a'){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383}
  if(kind==='VP8L'&&bytes[20]===47){const n=v.getUint32(21,true);width=(n&16383)+1;height=((n>>>14)&16383)+1}
 }
 return width>=320&&height>=80&&width>=height&&width<=8192&&height<=8192&&width*height<=30000000?{width,height}:null;
}
async function bannerStorage(path:string,init:any){
 const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(base+'/storage/v1/'+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,...init.headers}});
 if(!r.ok)throw new Error('banner_storage_failed');return r;
}
async function bannerAssets(sql:any,items:any[]){
 const ids=items.filter(i=>i.type==='image').map(i=>i.assetId);if(!ids.length)return [];
 const rows=await sql`select id,path,name,mime,bytes,width,height from private.enl_home_banner_assets where id::text in (select jsonb_array_elements_text(${sql.json(ids)}::jsonb))`;
 return await Promise.all(rows.map(async(a:any)=>{
  const r=await bannerStorage('object/sign/enl-incident-files/'+a.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:7200})});const data=await r.json();
  if(typeof data.signedURL!=='string'||!data.signedURL.startsWith('/object/sign/enl-incident-files/home-banners/'))throw new Error('banner_storage_failed');
  const {path,...meta}=a;return {...meta,url:Deno.env.get('SUPABASE_URL')+'/storage/v1'+data.signedURL};
 }));
}
async function bannerRequest(sql:any,actor:any,body:any,reply:any){
 const action=body.action;
 if(action!=='platform_banners'&&(actor.role!=='safety'||!await serviceAllowed(sql,actor,'system')))return reply({ok:false,message:'forbidden'},403);
 if(action==='platform_banners'){
  const [config]=await sql`select revision,items,updated_at from private.enl_home_banner_config where singleton`;
  return reply({ok:true,...config,assets:await bannerAssets(sql,config.items)});
 }
 if(action==='platform_banner_upload'){
  const f=body.file||{},ext:any={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!Object.hasOwn(ext,f.mime)||!Number.isInteger(f.size)||f.size<1||f.size>5242880||typeof f.base64!=='string'||f.base64.length>6990510||! /^[A-Za-z0-9+/]*={0,2}$/.test(f.base64))return reply({ok:false,message:'invalid_banner_file'},400);
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))}catch{return reply({ok:false,message:'invalid_banner_file'},400)}
  const dimensions=bytes.length===f.size?bannerImage(bytes,f.mime):null;if(!dimensions)return reply({ok:false,message:'invalid_banner_dimensions'},400);
  const id=crypto.randomUUID(),path='home-banners/'+id+'.'+ext[f.mime],name=String(f.name||'banner').slice(0,180);
  await bannerStorage('object/enl-incident-files/'+path,{method:'POST',headers:{'Content-Type':f.mime,'x-upsert':'false','Cache-Control':'max-age=7200'},body:bytes});
  try{await sql`insert into private.enl_home_banner_assets(id,path,name,mime,bytes,width,height,uploaded_by) values(${id},${path},${name},${f.mime},${bytes.length},${dimensions.width},${dimensions.height},${actor.id})`}
  catch(e){try{await bannerStorage('object/enl-incident-files',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})})}catch{}throw e}
  return reply({ok:true,asset:(await bannerAssets(sql,[{type:'image',assetId:id}]))[0]});
 }
 if(action==='platform_banners_save'){
  if(!Number.isInteger(body.revision)||!Array.isArray(body.items)||body.items.length>12)return reply({ok:false,message:'invalid_banners'},400);
  const items:any[]=[];
  for(const item of body.items){
   if(item?.type==='builtin'&&bannerKeys.includes(item.key))items.push({type:'builtin',key:item.key});
   else if(item?.type==='image'&&/^[0-9a-f-]{36}$/i.test(item.assetId)&&['contain','cover'].includes(item.fit)&&typeof item.title==='string'&&item.title.length<=100)items.push({type:'image',assetId:item.assetId,fit:item.fit,title:item.title.trim()});
   else return reply({ok:false,message:'invalid_banners'},400);
  }
  const ids=items.filter(i=>i.type==='image').map(i=>i.assetId);
  const assets=await sql`select id::text from private.enl_home_banner_assets where id::text in(select jsonb_array_elements_text(${sql.json(ids)}::jsonb))`;
  if(ids.some(id=>!assets.some((a:any)=>a.id===id)))return reply({ok:false,message:'unknown_banner_asset'},400);
  const saved=await sql.begin(async(tx:any)=>{
   const [old]=await tx`select revision,items from private.enl_home_banner_config where singleton for update`;
   if(old.revision!==body.revision)return null;
   const [row]=await tx`update private.enl_home_banner_config set items=${sql.json(items)}::jsonb,revision=revision+1,updated_by=${actor.id},updated_at=now() where singleton returning revision,items`;
   await tx`insert into private.enl_home_banner_audit(revision,actor_id,actor_name,before_items,after_items) values(${row.revision},${actor.id},${actor.name||actor.id},${sql.json(old.items)}::jsonb,${sql.json(items)}::jsonb)`;
   return row;
  });
  return saved?reply({ok:true,...saved}):reply({ok:false,message:'banner_changed'},409);
 }
 return reply({ok:false,message:'unknown_action'},400);
}

const boardKinds=['notice','alert','news','resource'];
const boardFileName=/^[^\x00-\x1f\x7f/\\]{1,175}\.(pdf|xlsx?|docx?|pptx?|hwpx?|zip|jpe?g|png)$/i;
// A small typed document, not arbitrary HTML: no event handlers, CSS or remote images.
function boardDocument(input:any,assetIds:Set<string>){
 let count=0,chars=0;
 function visit(n:any,depth:number):any{
  if(++count>1200||depth>12||!n||typeof n!=='object')throw Error('invalid_document');
  if(typeof n.text==='string'){chars+=n.text.length;if(chars>10000)throw Error('invalid_document');return {text:n.text};}
  if(!['p','div','br','strong','b','em','i','u','s','h1','h2','h3','hr','ul','ol','li','a','img','table','tbody','tr','td','th','span'].includes(n.tag))throw Error('invalid_document');
  const out:any={tag:n.tag};
  if(n.tag==='img'){if(!assetIds.has(n.assetId))throw Error('invalid_document');return {tag:'img',assetId:n.assetId};}
  if(n.tag==='a'){try{const u=new URL(n.href);if(!['https:','http:'].includes(u.protocol))throw Error();out.href=u.href;}catch{throw Error('invalid_document');}}
  if(n.align!==undefined){if(!['left','center','right'].includes(n.align))throw Error('invalid_document');out.align=n.align;}
  if(n.size!==undefined){if(![12,14,16,18,24,32].includes(n.size))throw Error('invalid_document');out.size=n.size;}
  if(n.lineHeight!==undefined){if(![1.2,1.5,1.8,2].includes(n.lineHeight))throw Error('invalid_document');out.lineHeight=n.lineHeight;}
  if(n.highlight!==undefined){if(!/^#[0-9a-f]{6}$/i.test(n.highlight))throw Error('invalid_document');out.highlight=n.highlight;}
  if(n.color!==undefined){if(!/^#[0-9a-f]{6}$/i.test(n.color))throw Error('invalid_document');out.color=n.color;}
  if(!Array.isArray(n.children))throw Error('invalid_document');out.children=n.children.map((v:any)=>visit(v,depth+1));return out;
 }
 if(!Array.isArray(input))throw Error('invalid_document');return input.map(n=>visit(n,0));
}
function boardAttachment(f:any){
 if(!f||!/^[-0-9a-f]{36}$/i.test(f.id)||typeof f.name!=='string'||f.name.length>180||!boardFileName.test(f.name)||!Number.isInteger(f.size)||f.size<1||f.size>5242880||typeof f.base64!=='string'||f.base64.length!==4*Math.ceil(f.size/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(f.base64))throw Error('invalid_board_file');
 const b=Uint8Array.from(atob(f.base64),(c:string)=>c.charCodeAt(0));if(b.length!==f.size)throw Error('invalid_board_file');
 let mime='application/octet-stream';
 if(/\.png$/i.test(f.name)){if(b.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))throw Error('invalid_board_file');mime='image/png';}
 if(/\.jpe?g$/i.test(f.name)){if(b.length<4||b[0]!==255||b[1]!==216||b[2]!==255)throw Error('invalid_board_file');mime='image/jpeg';}
 return {...f,mime};
}
export async function platformRequest(sql:any,actor:any,body:any,reply:any){
  const admin=actor.role==='safety',action=body.action;
  if(['platform_banners','platform_banner_upload','platform_banners_save'].includes(action))return bannerRequest(sql,actor,body,reply);
  if(['platform_board_list','platform_board_file','platform_board_detail'].includes(action)){
    const hq=['safety','manager','executive'].includes(actor.role);
    const visible=sql`(${admin} or c.expires_at is null or c.expires_at>now()) and
      (${hq} or c.site_id is null or c.site_id=${actor.siteId} or c.shared_sites ? ${actor.siteId||''})`;
    if(action==='platform_board_detail'){
      const [item]=await sql`select c.*,s.site_name,f.name as file_name,coalesce((select a.actor_name from private.enl_hub_content_audit a where a.content_id=c.id and a.action='create' order by a.id limit 1),u.name) as author_name from private.enl_hub_content c left join public.enl_hq_users u on u.user_id=c.created_by left join public.enl_site_master s on s.site_id=c.site_id left join private.enl_board_files f on f.content_id=c.id where c.id::text=${String(body.id||'')} and c.kind in ('notice','alert','news','resource') and c.archived_at is null and ${visible}`;
      if(!item)return reply({ok:false,message:'content_unavailable'},404);
      const files=await sql`select id,name,mime,octet_length(bytes) as size from private.enl_board_assets where content_id=${item.id}::uuid and active order by created_at,id`;
      return reply({ok:true,item,files});
    }
    if(action==='platform_board_file'){
      const id=String(body.id||''),assetId=String(body.assetId||'');
      const files=assetId?await sql`select f.name,f.mime,encode(f.bytes,'base64') as base64 from private.enl_board_assets f join private.enl_hub_content c on c.id=f.content_id where c.id::text=${id} and f.id::text=${assetId} and f.active and c.archived_at is null and ${visible}`:await sql`select f.name,encode(f.bytes,'base64') as base64 from private.enl_board_files f join private.enl_hub_content c on c.id=f.content_id where c.id::text=${id} and c.kind='resource' and c.archived_at is null and ${visible}`;
      return files[0]?reply({ok:true,file:files[0]}):reply({ok:false,message:'file_unavailable'},404);
    }
    const offset=body.offset??0,pageSize=body.pageSize??50;
    if((body.kind!=='all'&&!boardKinds.includes(body.kind))||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(pageSize)||pageSize<1||pageSize>50)return reply({ok:false,message:'invalid_board'},400);
    const query=String(body.query||'').trim(),from=String(body.from||''),to=String(body.to||'');
    const validDate=(v:string)=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    if(query.length>100||!validDate(from)||!validDate(to)||from&&to&&from>to)return reply({ok:false,message:'invalid_filter'},400);
    const rows=await sql`select c.*,s.site_name,f.name as file_name,count(*) over()::int as total_count,
      coalesce((select a.actor_name from private.enl_hub_content_audit a where a.content_id=c.id and a.action='create' order by a.id limit 1),u.name) as author_name from private.enl_hub_content c
      left join public.enl_hq_users u on u.user_id=c.created_by
      left join public.enl_site_master s on s.site_id=c.site_id left join private.enl_board_files f on f.content_id=c.id
      where c.kind in ('notice','alert','news','resource') and (${body.kind}='all' or c.kind=${body.kind}) and c.archived_at is null and ${visible}
      and (${query}='' or strpos(lower(c.title||' '||c.body),lower(${query}))>0)
      and (${from}='' or c.created_at>=(nullif(${from},'')::date::timestamp at time zone 'Asia/Seoul'))
      and (${to}='' or c.created_at<((nullif(${to},'')::date+1)::timestamp at time zone 'Asia/Seoul'))
      order by coalesce(c.pinned,c.label='important') desc,c.created_at desc,c.id desc limit ${pageSize+1} offset ${offset}`;
    return reply({ok:true,items:rows.slice(0,pageSize),more:rows.length>pageSize,total:rows[0]?.total_count||0});
  }
  if(action==='platform_hub'||action==='platform_hub_favorites'||action==='platform_hub_save'||action==='platform_hub_archive'||action==='platform_board_delete'){
    const actorKey=(['field','worker'].includes(actor.role)?'site:':'hq:')+actor.id;
    if(action==='platform_hub_favorites'){
      const [catalog]=await sql`select modules from private.enl_platform_catalog where singleton`;
      const favorites=body.favorites,keys=[...catalog.modules.map((m:any)=>m.key),...serviceKeys,'bulletins','schedule'];
      if(!Array.isArray(favorites)||favorites.length>15||favorites.some((k:any)=>!keys.includes(k)||k==='system'&&!admin))return reply({ok:false,message:'invalid_favorites'},400);
      await sql`insert into private.enl_hub_preferences(actor_key,favorites) values(${actorKey},${sql.json([...new Set(favorites)])}::jsonb)
        on conflict(actor_key) do update set favorites=excluded.favorites,updated_at=now()`;
      return reply({ok:true});
    }
    if(action==='platform_hub'){
      const selected=String(body.date||new Date(Date.now()+9*3600000).toISOString().slice(0,10));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)||!Number.isFinite(Date.parse(selected))||new Date(selected).toISOString().slice(0,10)!==selected)return reply({ok:false,message:'invalid_date'},400);
      const hq=['safety','manager','executive'].includes(actor.role);
      const audience=sql`(${hq} or c.site_id is null or c.site_id=${actor.siteId})`;
      const notices=await sql`select c.*,s.site_name from private.enl_hub_content c left join public.enl_site_master s on s.site_id=c.site_id
        where c.kind='notice' and c.archived_at is null and (c.expires_at is null or c.expires_at>now())
        and (${audience} or c.shared_sites ? ${actor.siteId||''})
        order by coalesce(c.pinned,c.label='important') desc,c.created_at desc,c.id desc limit 250`;
      const events=await sql`select c.*,s.site_name from private.enl_hub_content c left join public.enl_site_master s on s.site_id=c.site_id
        where c.kind='event' and c.archived_at is null and ${audience}
        and c.starts_at<((${selected}::date+1)::timestamp at time zone 'Asia/Seoul') and c.ends_at>=(${selected}::date::timestamp at time zone 'Asia/Seoul')
        order by case when c.label='important' then 0 else 1 end,c.starts_at,c.created_at desc,c.id desc limit 250`;
      const [pref]=await sql`select favorites from private.enl_hub_preferences where actor_key=${actorKey}`;
      const publicationSites=admin&&body.includePublicationSites===true
        ?await sql`select site_id,site_name from public.enl_site_master where active order by site_name,site_id`:undefined;
      return reply({ok:true,notices,events,favorites:pref?.favorites||[],publicationSites});
    }
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const id=body.id==null?'':String(body.id),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(id&&!uuid.test(id)||id&&(!Number.isSafeInteger(body.revision)||body.revision<1))return reply({ok:false,message:'invalid_content'},400);
    if(action==='platform_hub_archive'||action==='platform_board_delete'){
      if(!id)return reply({ok:false,message:'invalid_content'},400);
      return await sql.begin(async(tx:any)=>{
        const [before]=await tx`select * from private.enl_hub_content where id=${id}::uuid and archived_at is null for update`;
        if(!before||before.revision!==body.revision)return reply({ok:false,message:'content_changed'},409);
        if(action==='platform_board_delete'){
          if(!boardKinds.includes(before.kind))return reply({ok:false,message:'invalid_board'},400);
          await tx`delete from private.enl_board_assets where content_id=${id}::uuid`;
          await tx`delete from private.enl_board_files where content_id=${id}::uuid`;
          // The pre-editor snapshot has no foreign keys back to the live post.
          await tx`delete from private.enl_board_r93_backup_audit where content_id=${id}::uuid`;
          await tx`delete from private.enl_board_r93_backup_files where content_id=${id}::uuid`;
          await tx`delete from private.enl_board_r93_backup_content where id=${id}::uuid`;
          await tx`update private.enl_hub_content_audit set before_record=null,after_record=null where content_id=${id}::uuid`;
          await tx`delete from private.enl_hub_content where id=${id}::uuid`;
          await tx`insert into private.enl_hub_content_audit(content_id,action,actor_id,actor_name) values(${id}::uuid,'delete',${actor.id},${actor.name})`;
          return reply({ok:true});
        }
        // Older clients promised to preserve the original. Require the new delete confirmation.
        if(before.kind!=='event')return reply({ok:false,message:'update_required'},409);
        const [after]=await tx`update private.enl_hub_content set archived_at=now(),updated_at=now(),updated_by=${actor.id},revision=revision+1 where id=${id}::uuid returning *`;
        await tx`insert into private.enl_hub_content_audit(content_id,action,actor_id,actor_name,before_record,after_record) values(${id}::uuid,'archive',${actor.id},${actor.name},${tx.json(before)}::jsonb,${tx.json(after)}::jsonb)`;
        return reply({ok:true});
      });
    }
    const kind=String(body.kind||''),title=String(body.title||'').trim(),text=String(body.body||''),label=String(body.label||'info'),site=String(body.siteId||''),start=body.startsAt||null,end=body.endsAt||null;
    if(!(kind==='event'||boardKinds.includes(kind))||!title||title.length>150||text.length>10000||!['important','info','general'].includes(label)||site.length>150)return reply({ok:false,message:'invalid_content'},400);
    const publication=body.publication;
    if(publication!==undefined){
      if(!boardKinds.includes(kind)||!publication||typeof publication.pinned!=='boolean'||!Array.isArray(publication.sites)||
        publication.sites.length>200||publication.sites.some((v:any)=>typeof v!=='string'||!v||v.length>150)||
        new Set(publication.sites).size!==publication.sites.length||(publication.sites[0]||'')!==site||
        (publication.expiresAt!==null&&(typeof publication.expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(publication.expiresAt)||!Number.isFinite(Date.parse(publication.expiresAt)))))return reply({ok:false,message:'invalid_publication'},400);
      if(publication.sites.length){
        const [valid]=await sql`select count(*)::int as n from public.enl_site_master where active and site_id in (select jsonb_array_elements_text(${sql.json(publication.sites)}::jsonb))`;
        if(valid.n!==publication.sites.length)return reply({ok:false,message:'invalid_site'},400);
      }
    }
    let assets:any[]=[],document:any=undefined;
    try{
      if(body.attachments!==undefined){if(!boardKinds.includes(kind)||!Array.isArray(body.attachments)||body.attachments.length>5)throw Error();assets=body.attachments.map(boardAttachment);if(assets.reduce((n,f)=>n+f.size,0)>10485760||new Set(assets.map(f=>f.id)).size!==assets.length)throw Error();}
      if(body.document!=null){if(!boardKinds.includes(kind)||body.attachments===undefined)throw Error();document=boardDocument(body.document,new Set(assets.filter(f=>f.mime.startsWith('image/')).map(f=>f.id)));}
    }catch{return reply({ok:false,message:'invalid_board_document'},400);}
    const file=body.file;
    if(file!=null&&(kind!=='resource'||typeof file.name!=='string'||file.name.length>180||!boardFileName.test(file.name)||
      typeof file.base64!=='string'||!Number.isInteger(file.size)||file.size<1||file.size>5242880||
      file.base64.length!==4*Math.ceil(file.size/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)||
      file.size!==file.base64.length/4*3-(file.base64.endsWith('==')?2:file.base64.endsWith('=')?1:0)))return reply({ok:false,message:'invalid_board_file'},400);
    if(kind==='event'&&(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<Date.parse(start)))return reply({ok:false,message:'invalid_event_time'},400);
    if(site){const [exists]=await sql`select site_id from public.enl_site_master where site_id=${site} and active`;if(!exists)return reply({ok:false,message:'invalid_site'},400);}
    return await sql.begin(async(tx:any)=>{
      let before=null,after;
      if(id){[before]=await tx`select * from private.enl_hub_content where id=${id}::uuid and archived_at is null for update`;
        if(!before||before.revision!==body.revision||before.kind!==kind)return reply({ok:false,message:'content_changed'},409);
        if(publication===undefined&&before.shared_sites!=null&&site!==(before.site_id||''))return reply({ok:false,message:'update_required'},409);
        if(before.document&&document===undefined)return reply({ok:false,message:'rich_document_required'},400);
        for(const f of assets){const [old]=await tx`select name,mime,replace(encode(bytes,'base64'),E'\\n','') as base64 from private.enl_board_assets where content_id=${id}::uuid and id=${f.id}::uuid`;if(old&&(old.name!==f.name||old.mime!==f.mime||old.base64!==f.base64))return reply({ok:false,message:'immutable_asset'},400);}
        [after]=await tx`update private.enl_hub_content set title=${title},body=${text},label=${label},site_id=${site||null},starts_at=${kind==='event'?start:null}::timestamptz,ends_at=${kind==='event'?end:null}::timestamptz,revision=revision+1,updated_at=now(),updated_by=${actor.id} where id=${id}::uuid returning *`;
      }else [after]=await tx`insert into private.enl_hub_content(kind,title,body,label,site_id,starts_at,ends_at,created_by,updated_by) values(${kind},${title},${text},${label},${site||null},${kind==='event'?start:null}::timestamptz,${kind==='event'?end:null}::timestamptz,${actor.id},${actor.id}) returning *`;
      if(publication!==undefined){
        [after]=await tx`update private.enl_hub_content set pinned=${publication.pinned},expires_at=${publication.expiresAt}::timestamptz,shared_sites=${tx.json(publication.sites)}::jsonb where id=${after.id} returning *`;
      }
      if(document!==undefined){
        [after]=await tx`update private.enl_hub_content set document=${tx.json(document)}::jsonb where id=${after.id} returning *`;
      }
      if(body.attachments!==undefined){
        // Replacing this version's attachments is atomic with the revision check.
        await tx`update private.enl_board_assets set active=false where content_id=${after.id}`;
        for(const f of assets)await tx`insert into private.enl_board_assets(id,content_id,name,mime,bytes) values(${f.id}::uuid,${after.id},${f.name},${f.mime},decode(${f.base64},'base64')) on conflict(content_id,id) do update set active=true`;
      }
      if(file)await tx`insert into private.enl_board_files(content_id,name,bytes) values(${after.id},${file.name},decode(${file.base64},'base64'))
        on conflict(content_id) do update set name=excluded.name,bytes=excluded.bytes`;
      await tx`insert into private.enl_hub_content_audit(content_id,action,actor_id,actor_name,before_record,after_record) values(${after.id}::uuid,${id?'update':'create'},${actor.id},${actor.name},${before?tx.json(before):null}::jsonb,${tx.json(after)}::jsonb)`;
      return reply({ok:true,item:after});
    });
  }
  if(action==='platform_notices'||action==='platform_notice_set'){
    if(!await serviceAllowed(sql,actor,'notices'))return reply({ok:false,message:'service_unavailable'},403);
    const hq=['safety','manager','executive'].includes(actor.role),source=hq?'hq':'site';
    if(action==='platform_notice_set'){
      const {key,channel,enabled}=body;
      if(!moduleKeys.includes(key)||!['push','email'].includes(channel)||typeof enabled!=='boolean')return reply({ok:false,message:'invalid_preference'},400);
      const push=channel==='push'?enabled:null,email=channel==='email'?enabled:null;
      if(key==='incident'){
        if(hq)await sql`update public.enl_hq_users set push_enabled=coalesce(${push}::boolean,push_enabled),email_enabled=coalesce(${email}::boolean,email_enabled) where user_id=${actor.id} and active`;
        else await sql`update public.enl_site_personnel set push_enabled=coalesce(${push}::boolean,push_enabled),email_enabled=coalesce(${email}::boolean,email_enabled) where personnel_id::text=${actor.id} and site_id=${actor.siteId} and active`;
      }else await sql`insert into private.enl_module_notice_preferences as p(source,account_id,module_key,push_enabled,email_enabled)
        values(${source},${actor.id},${key},coalesce(${push}::boolean,true),coalesce(${email}::boolean,true)) on conflict(source,account_id,module_key) do update
        set push_enabled=coalesce(${push}::boolean,p.push_enabled),email_enabled=coalesce(${email}::boolean,p.email_enabled)`;
      return reply({ok:true});
    }
    const [incident]=hq?await sql`select push_enabled,email_enabled from public.enl_hq_users where user_id=${actor.id}`:
      await sql`select push_enabled,email_enabled from public.enl_site_personnel where personnel_id::text=${actor.id} and site_id=${actor.siteId}`;
    const others=await sql`select module_key,push_enabled,email_enabled from private.enl_module_notice_preferences where source=${source} and account_id=${actor.id}`;
    return reply({ok:true,rows:moduleKeys.map(key=>{const p=key==='incident'?incident:others.find((r:any)=>r.module_key===key);return {key,push:p?.push_enabled!==false,email:p?.email_enabled!==false}})});
  }
  if(action==='platform_directory'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const query=String(body.query||'').trim().slice(0,100),duty=String(body.duty||''),offset=Number(body.offset||0);
    if(!Number.isSafeInteger(offset)||offset<0)return reply({ok:false,message:'invalid_page'},400);
    const rows=await sql`select a.*,coalesce(s.site_name,'본사') as site_name,d.codes from private.enl_master_accounts a
      left join public.enl_site_master s on s.site_id=a.site_id cross join lateral
        (select coalesce(array_agg(duty order by duty),'{}'::text[]) codes from private.enl_duty_assignments
         where source=a.source and account_id=a.id and ended_at is null) d
      where (${duty}='' or ${duty}=any(d.codes)) and strpos(lower(concat_ws(' ',a.id,a.name,s.site_name,a.department,a.position)),lower(${query}))>0
      order by a.active desc,a.name,a.source,a.id offset ${offset} limit 51`;
    return reply({ok:true,rows:rows.slice(0,50),more:rows.length>50});
  }
  if(action==='platform_duties'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const rows=await sql`select duty from private.enl_duty_assignments where source=${body.source} and account_id=${body.accountId} and ended_at is null`;
    return reply({ok:true,duties:rows.map((r:any)=>r.duty)});
  }
  const [config]=await sql`select * from private.enl_platform_catalog where singleton`;
  const publicItems=(items:any[])=>admin?items:items.filter(m=>m.state!=='hidden'&&m.key!=='system').map(m=>({key:m.key,displayName:m.displayName,iconKey:m.iconKey,state:m.state,enabled:m.enabled!==false,preview:m.preview,canEnter:canEnter(m,actor)}));
  const moduleIds=config.modules.map((m:any)=>m.key);
  const extras=['support','system'];
  const order=[...moduleIds];
  for(const key of [...extras].sort((a,b)=>(config.home_extras?.[a]??Infinity)-(config.home_extras?.[b]??Infinity))){
    order.splice(config.home_extras?.[key]??order.length,0,key);
  }
  const savedOrder=(config.sidebar_order||[]).filter((k:string)=>order.includes(k));
  const sidebarOrder=[...savedOrder,...order.filter(k=>!savedOrder.includes(k))];
  if(action==='platform_sidebar_order'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const next=body.order;
    if(!Array.isArray(next)||next.length!==order.length||!order.every(k=>next.includes(k)))return reply({ok:false,message:'invalid_catalog'},400);
    const rows=await sql`update private.enl_platform_catalog set sidebar_order=${sql.json(next)}::jsonb,revision=revision+1,
      updated_at=now(),updated_by=${actor.id} where singleton and revision=${body.revision} returning revision`;
    return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
  }
  if(action==='platform_catalog'){
    const modules=publicItems(config.modules),services=publicItems(config.services);
    const visible=new Set([...modules,...services].map(m=>m.key).concat('support'));
    return reply({ok:true,revision:config.revision,modules,services,omitted:(config.home_omitted||[]).filter((k:string)=>visible.has(k)),sidebarOrder:sidebarOrder.filter(k=>visible.has(k)&&(admin||!(config.home_omitted||[]).includes(k))),homeOrder:order.filter(k=>visible.has(k))});
  }
  if(action==='platform_home_cards'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const removed=body.omitted;
    if(!Array.isArray(removed)||removed.some(k=>!order.includes(k))||new Set(removed).size!==removed.length)return reply({ok:false,message:'invalid_catalog'},400);
    const modules=[...config.modules];
    if(body.newCard){
      const {name,icon}=body.newCard;
      if(typeof name!=='string'||!name.trim()||name.trim().length>30||/[\u0000-\u001f\u007f]/.test(name)||!safetyArt.includes(icon)||modules.length>=100)return reply({ok:false,message:'invalid_card'},400);
      modules.push({key:'custom-'+crypto.randomUUID(),displayName:name.trim(),iconKey:icon,state:'building',enabled:false,preview:false,roles:systemRoles,pilots:[]});
    }
    const rows=await sql`update private.enl_platform_catalog set modules=${sql.json(modules)}::jsonb,home_omitted=${sql.json(removed)}::jsonb,
      revision=revision+1,updated_by=${actor.id},updated_at=now() where singleton and revision=${body.revision} and revision=${config.revision} returning revision`;
    return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
  }
  if(action==='platform_home_order'){
    if(!admin)return reply({ok:false,message:'forbidden'},403);
    const next=body.order;
    if(!Array.isArray(next)||next.length!==order.length||!order.every(k=>next.includes(k)))return reply({ok:false,message:'invalid_catalog'},400);
    const modules=next.filter(k=>moduleIds.includes(k)).map(k=>config.modules.find((m:any)=>m.key===k));
    const positions=Object.fromEntries(extras.map(k=>[k,next.indexOf(k)]));
    const rows=await sql`update private.enl_platform_catalog set modules=${sql.json(modules)}::jsonb,home_extras=${sql.json(positions)}::jsonb,
      revision=revision+1,updated_at=now(),updated_by=${actor.id} where singleton and revision=${body.revision} and revision=${config.revision} returning revision`;
    return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
  }
  if(action==='platform_enter'){
    const m=[...config.modules,...config.services].find(m=>m.key===body.key);
    return canEnter(m,actor)?reply({ok:true,key:m.key,state:m.state}):reply({ok:false,message:'module_unavailable'},403);
  }
  if(action!=='platform_save'||!admin)return reply({ok:false,message:'forbidden'},403);
  if(body.group!==undefined&&!['modules','services'].includes(body.group))return reply({ok:false,message:'invalid_catalog'},400);
  const services=body.group==='services',keys=services?serviceKeys:config.modules.map((m:any)=>m.key),modules=services?config.services:config.modules;
  let next=body.modules;
  // Older cached clients can save the original five modules without dropping MSDS.
  if(!services&&Array.isArray(next)&&next.length===5&&!next.some((m:any)=>m?.key==='msds')){
    const msds=config.modules.find((m:any)=>m.key==='msds');if(msds)next=[...next,msds];
  }
  if(!Array.isArray(next)||next.length!==keys.length||!keys.every(k=>next.some(m=>m?.key===k)))return reply({ok:false,message:'invalid_catalog'},400);
  for(const m of next){
    if(!m||!['live','building','hidden'].includes(m.state)||typeof m.preview!=='boolean'||(m.enabled!==undefined&&typeof m.enabled!=='boolean')||
       !Array.isArray(m.roles)||m.roles.some((r:any)=>!systemRoles.includes(r))||
       !Array.isArray(m.pilots)||m.pilots.length>100||m.pilots.some((p:any)=>typeof p!=='string'||!/^(hq|site):.{1,150}$/.test(p)))return reply({ok:false,message:'invalid_catalog'},400);
    if(m.displayName!==undefined&&(typeof m.displayName!=='string'||!m.displayName.trim()||m.displayName.trim().length>30||/[\u0000-\u001f\u007f]/.test(m.displayName)))return reply({ok:false,message:'invalid_display_name'},400);
    if(m.key==='system'&&m.roles.some((r:any)=>r!=='safety'))return reply({ok:false,message:'forbidden'},403);
    if(m.key==='incident'&&(m.state==='building'||(m.state==='hidden'&&modules.find((x:any)=>x.key==='incident').state!=='hidden'&&body.confirmHideIncident!==true)||(m.enabled===false&&modules.find((x:any)=>x.key==='incident').enabled!==false&&body.confirmDisableIncident!==true)))return reply({ok:false,message:'incident_protected'},409);
  }
  const clean=next.map(({key,state,enabled,preview,roles,pilots,displayName}:any)=>{
    const previous=modules.find((m:any)=>m.key===key);
    const label=displayName?.trim()??previous.displayName;
    return {...(previous.iconKey?{iconKey:previous.iconKey}:{}),...(label?{displayName:label}:{}),key,state,enabled:enabled??(previous.enabled!==false),preview,roles:[...new Set(roles)],pilots:[...new Set(pilots)]};
  });
  const pilots=Array.from(new Set(clean.flatMap(m=>m.pilots))) as string[];
  if(pilots.length){
    const valid=await sql`select source||':'||id as key from private.enl_master_accounts where active and (source||':'||id) in(select jsonb_array_elements_text(${sql.json(pilots)}::jsonb))`;
    if(valid.length!==pilots.length)return reply({ok:false,message:'unknown_pilot'},400);
  }
  const column=services?sql`services`:sql`modules`;
  const rows=await sql`update private.enl_platform_catalog set ${column}=${sql.json(clean)}::jsonb,revision=revision+1,updated_at=now(),updated_by=${actor.id}
    where singleton and revision=${body.revision} returning revision`;
  return rows.length?reply({ok:true,revision:rows[0].revision}):reply({ok:false,message:'catalog_changed'},409);
}
