import { finishLogin, schedule, loginPolicy, confirmEmail } from "./device-login.ts";
import { login as Deno } from "../_shared/device-runtime.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN="https://enlsafety.github.io";
const CLIENT="incident-report-v2";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type, x-enl-app","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v:any)=>String(v??"").trim();
const sameProof=(a:string,b:string)=>{let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0;};
const norm=(v:any)=>clean(v).replace(/\s+/g,"").toLocaleLowerCase("ko-KR");
const fieldTitles=["현장소장","파트장","서무"];
const isFieldTitle=(v:any)=>fieldTitles.includes(clean(v));
const hqRole=(v:any)=>{const r=clean(v);return r==="final"?"manager":r};
const hqAllowed=(v:any)=>["safety","manager","executive"].includes(hqRole(v));
const roleLabel=(v:any)=>hqRole(v)==="safety"?"안전관리자":hqRole(v)==="executive"?"경영진":"본사실무자";
const sha256=async(v:string)=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};

async function sendEnrollmentCode(email:string,code:string){
  const key=Deno.env.get('BREVO_API_KEY');
  if(!key)throw Error('provider');
  const headers={'api-key':key,'content-type':'application/json','accept':'application/json'};
  const list=await fetch('https://api.brevo.com/v3/senders',{headers,signal:AbortSignal.timeout(5000)});
  if(!list.ok)throw Error('sender');
  const senders=(await list.json()).senders||[];
  const sender=senders.find((s:any)=>s.active&&s.name==='이앤엘 사고보고')||senders.find((s:any)=>s.active);
  if(!sender?.email)throw Error('sender');
  const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers,signal:AbortSignal.timeout(7000),
    body:JSON.stringify({sender:{email:sender.email,name:'이앤엘 사고보고'},to:[{email}],subject:'[이앤엘] 회사 이메일 인증번호',
      textContent:'이앤엘 안전보건관리 통합시스템의 이메일 인증번호는 '+code+'입니다. 10분 안에 입력해 주세요.'})});
  if(!response.ok||!(await response.json()).messageId)throw Error('delivery');
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return json({ok:false,message:"method_not_allowed"},405);
  const origin=req.headers.get("origin")||"";if(origin&&origin!==ORIGIN)return json({ok:false,message:"origin_not_allowed"},403);
  if(req.headers.get("x-enl-app")!==CLIENT)return json({ok:false,message:"invalid_client"},403);
  const dbUrl=Deno.env.get("SUPABASE_DB_URL")||"";if(!dbUrl)return json({ok:false,message:"server_not_configured"},500);
  let body:any={};try{body=await req.json()}catch{return json({ok:false,message:"invalid_json"},400)}
  const action=clean(body.action),actor=body.actor||{},actorRole=hqRole(actor.role),actorSiteId=clean(actor.siteId),now=new Date().toISOString();
  const sql=postgres(dbUrl,{prepare:false,max:3,connect_timeout:5,idle_timeout:2});
  try{
    async function siteMap(){const rows=await sql`select site_id,site_name from public.enl_site_master where active=true`;return new Map(rows.map((s:any)=>[clean(s.site_id),clean(s.site_name)]));}
    async function findHqByName(name:string){const rows=await sql`select * from public.enl_hq_users where normalized_name=${norm(name)} limit 1`;return rows[0]||null;}
    function affiliation(u:any){const d=clean(u?.department);return d?{id:`dept:${norm(d)}`,label:d}:{id:"site:s33",label:"동탄 사무실"};}
    function publicHq(u:any){const a=affiliation(u),role=hqRole(u.role);return {id:u.user_id,name:u.name,username:u.name,role,roleLabel:roleLabel(role),department:u.department||"",position:u.position||"",email:u.email||"",pushEnabled:u.push_enabled!==false,emailEnabled:u.email_enabled!==false,siteId:null,affiliationId:a.id,affiliationLabel:a.label,active:u.active!==false,createdAt:u.created_at,updatedAt:u.updated_at,updatedByName:u.updated_by_name||""};}
    async function verifiedActor(){
      const id=clean(actor.id);if(!id)return null;
      if(actorRole==="safety"){
        const proof=clean(body.actorPasswordHash);if(!proof)return null;
        const rows=await sql`select user_id,name,role,position,active,password_hash from public.enl_hq_users where user_id=${id} limit 1`;
        const data=rows[0];
        if(!data||data.active!==true||hqRole(data.role)!=="safety"||!clean(data.password_hash)||!sameProof(clean(data.password_hash),proof))return null;
        return {id:clean(data.user_id),name:clean(data.name),role:"safety",position:clean(data.position),siteId:""};
      }
      if(clean(actor.role)==="field"){
        const proof=clean(body.actorPinHash);if(!proof)return null;
        const rows=await sql`select personnel_id,site_id,name,job_title,access_role,active,pin_hash from public.enl_site_personnel where personnel_id::text=${id} limit 1`;
        const data=rows[0];
        if(!data||data.active!==true||clean(data.access_role)!=="field"||!isFieldTitle(data.job_title)||!clean(data.pin_hash)||!sameProof(clean(data.pin_hash),proof))return null;
        if(actorSiteId&&clean(data.site_id)!==actorSiteId)return null;
        return {id:clean(data.personnel_id),name:clean(data.name),role:"field",position:clean(data.job_title),siteId:clean(data.site_id)};
      }
      return null;
    }
    async function managerPhoneHash(siteId:string,name:string,jobTitle:string){if(!isFieldTitle(jobTitle))return "";const rows=await sql`select manager_name,manager_phone,part_name,part_phone,clerk_name,clerk_phone from public.enl_site_master where site_id=${siteId} limit 1`;const data=rows[0];if(!data)return "";let masterName="",phone="";if(jobTitle==="현장소장"){masterName=clean(data.manager_name);phone=clean(data.manager_phone)}else if(jobTitle==="파트장"){masterName=clean(data.part_name);phone=clean(data.part_phone)}else{masterName=clean(data.clerk_name);phone=clean(data.clerk_phone)}const plain=clean(name).replace(/ \((현장소장|파트장|서무)\)$/,"");if(!masterName||norm(masterName)!==norm(plain))return "";const digits=phone.replace(/\D/g,"");return digits.length>=4?sha256(digits.slice(-4)):"";}
    async function auditPersonnel(saved:any,prev:any,v:any,actionName:string){await sql`insert into public.enl_personnel_audit(personnel_id,site_id,action,editor_id,editor_name,editor_role,editor_position,changed_at,before_payload,after_payload) values(${saved.personnel_id},${saved.site_id},${actionName},${v.id},${v.name},${v.role},${v.position},${now},${prev?JSON.stringify(prev):null}::jsonb,${JSON.stringify(saved)}::jsonb)`;}
    async function clearOldMasterIfOwned(prev:any,newTitle:string,newActive:boolean){if(!prev)return;const oldTitle=clean(prev.job_title);if(!isFieldTitle(oldTitle)||(newActive&&oldTitle===newTitle))return;const rows=await sql`select manager_name,part_name,clerk_name from public.enl_site_master where site_id=${prev.site_id} limit 1`;const m=rows[0];if(!m)return;if(oldTitle==="현장소장"&&norm(m.manager_name)===norm(prev.name))await sql`update public.enl_site_master set manager_name='',manager_phone='',updated_at=${now} where site_id=${prev.site_id}`;if(oldTitle==="파트장"&&norm(m.part_name)===norm(prev.name))await sql`update public.enl_site_master set part_name='',part_phone='',updated_at=${now} where site_id=${prev.site_id}`;if(oldTitle==="서무"&&norm(m.clerk_name)===norm(prev.name))await sql`update public.enl_site_master set clerk_name='',clerk_phone='',updated_at=${now} where site_id=${prev.site_id}`;}
    async function syncMasterForField(saved:any){if(saved.active===false||clean(saved.access_role)!=="field")return;const t=clean(saved.job_title);if(t==="현장소장")await sql`update public.enl_site_master set manager_name=${clean(saved.name)},manager_phone=${clean(saved.phone)},updated_at=${now} where site_id=${saved.site_id}`;else if(t==="파트장")await sql`update public.enl_site_master set part_name=${clean(saved.name)},part_phone=${clean(saved.phone)},updated_at=${now} where site_id=${saved.site_id}`;else if(t==="서무")await sql`update public.enl_site_master set clerk_name=${clean(saved.name)},clerk_phone=${clean(saved.phone)},updated_at=${now} where site_id=${saved.site_id}`;}

    const companyDomain="@enlife.co.kr";
    const localPart=(email:any)=>{const v=clean(email).toLowerCase();return v.endsWith(companyDomain)?v.slice(0,-companyDomain.length):""};
    async function verifier(password:string,salt:string){
      const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
      const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:210000,salt:enc.encode(salt)},key,256);
      return Array.from(new Uint8Array(bits),n=>n.toString(16).padStart(2,'0')).join('');
    }
    if(action==="email_gate_manage"||action==="email_gate_set"){
      const v=await verifiedActor();if(v?.role!=="safety")return json({ok:false,message:"forbidden"},403);
      const [gate]=await sql`select owner_id,salt from private.enl_email_enrollment_gate where singleton`;
      if(v.id!==gate.owner_id)return json({ok:false,message:'forbidden'},403);
      if(action==="email_gate_manage")return json({ok:true,configured:!!gate.salt});
      const password=body.newRegistrationPassword;
      if(typeof password!=='string'||password.trim().length<8||password.length>128||await sha256(password)===body.actorPasswordHash)return json({ok:false,message:"invalid_gate_password"},400);
      const salt=crypto.randomUUID(),hash=await verifier(password,salt);
      await sql`update private.enl_email_enrollment_gate set salt=${salt},verifier=${hash},updated_at=now() where singleton and owner_id=${v.id}`;
      return json({ok:true});
    }
    if(action==='register_company_email')return json({ok:false,message:'update_required'},410);
    if(action==='email_code_send'||action==='email_code_verify'){
      const key=clean(body.accountKey), name=clean(body.name), site=clean(body.affiliationId);
      const local=clean(body.companyLocal).toLowerCase(), email=local+companyDomain;
      const verify=action==='email_code_verify', code=clean(body.code);
      if(!/^(hq|site):.{1,140}$/.test(key)||!name||!site||local.length>64||
         !/^[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*$/.test(local)||(verify&&!/^\d{6}$/.test(code)))
        return json({ok:false,message:'invalid_registration'},400);
      const hq=key.startsWith('hq:'), id=key.slice(key.indexOf(':')+1);
      return await sql.begin(async(tx:any)=>{
        const [account]=hq?await tx`select * from public.enl_hq_users where user_id=${id} and active for update`:
          await tx`select * from public.enl_site_personnel where personnel_id::text=${id} and active for update`;
        if(!account||norm(account.name)!==norm(name)||(hq?affiliation(account).id:'site:'+account.site_id)!==site)
          return json({ok:false,message:'invalid_account'},403);
        if(clean(account.email))return json({ok:false,message:'email_already_registered'},409);
        await tx`insert into private.enl_email_enrollment_attempts(account_key) values(${key}) on conflict do nothing`;
        const [attempt]=await tx`select failures,started_at from private.enl_email_enrollment_attempts where account_key=${key} for update`;
        const fresh=Date.now()-new Date(attempt.started_at).getTime()<900000;
        if(fresh&&attempt.failures>=5)return json({ok:false,message:'attempts_exceeded'},429);
        const protectedAccount=hq||account.access_role==='field'||isFieldTitle(account.job_title)||!!clean(account.pin_hash);
        let authorized=false;
        if(protectedAccount){
          const proof=clean(hq?account.password_hash:account.pin_hash);
          authorized=!!proof&&sameProof(proof,clean(body.passwordHash));
        }else{
          const gatePassword=clean(body.registrationPassword);
          const [gate]=await tx`select salt,verifier from private.enl_email_enrollment_gate where singleton`;
          if(!gate?.verifier)return json({ok:false,message:'gate_not_configured'},409);
          authorized=!!gatePassword&&gatePassword.length<=128&&sameProof(await verifier(gatePassword,gate.salt),gate.verifier);
        }
        if(!authorized){
          await tx`update private.enl_email_enrollment_attempts set failures=${fresh?attempt.failures+1:1},started_at=case when ${fresh} then started_at else now() end where account_key=${key}`;
          return json({ok:false,message:'invalid_login'},403);
        }
        // The same address lock is taken by both master-table triggers.
        await tx`select pg_advisory_xact_lock(hashtextextended(${email},6601))`;
        const [owner]=await tx`select account_key from private.enl_account_email_owners where address=${email}`;
        if(owner&&owner.account_key!==key)return json({ok:false,message:'email_in_use'},409);
        const [challenge]=await tx`select * from private.enl_email_challenges where account_key=${key} for update`;
        if(verify){
          if(!challenge||challenge.address!==email||new Date(challenge.expires_at).getTime()<=Date.now())return json({ok:false,message:'code_expired'},409);
          if(challenge.failures>=5)return json({ok:false,message:'code_locked'},429);
          if(!sameProof(await verifier(code,challenge.salt),challenge.digest)){
            await tx`update private.enl_email_challenges set failures=failures+1 where account_key=${key}`;
            return json({ok:false,message:'incorrect_code'},403);
          }
          const firstProof=clean(body.newPasswordHash);
          if(!protectedAccount&&!/^[0-9a-f]{64}$/.test(firstProof))return json({ok:false,message:'new_password_required'},400);
          if(hq)await tx`update public.enl_hq_users set email=${email},updated_at=now(),updated_by_id=${id},updated_by_name=${account.name},updated_by_role=${account.role} where user_id=${id}`;
          else await tx`update public.enl_site_personnel set email=${email},pin_hash=${protectedAccount?account.pin_hash:firstProof},updated_at=now(),updated_by_id=${id},updated_by_name=${account.name},updated_by_role=${account.access_role} where personnel_id::text=${id}`;
          await tx`delete from private.enl_email_challenges where account_key=${key}`;
          await confirmEmail(tx,key,email);
          return json({ok:true,email});
        }
        const recent=challenge&&Date.now()-new Date(challenge.window_start).getTime()<3600000;
        if(challenge&&Date.now()-new Date(challenge.sent_at).getTime()<60000)return json({ok:false,message:'wait_resend'},429);
        if(recent&&challenge.sends>=5)return json({ok:false,message:'send_limit'},429);
        const salt=crypto.randomUUID(), digits=new Uint32Array(1);
        do{crypto.getRandomValues(digits)}while(digits[0]>=4294000000);
        const nextCode=String(digits[0]%1000000).padStart(6,'0'),digest=await verifier(nextCode,salt);
        try{await sendEnrollmentCode(email,nextCode)}catch{return json({ok:false,message:'mail_unavailable'},502)}
        await tx`insert into private.enl_email_challenges(account_key,address,salt,digest,expires_at,sends)
          values(${key},${email},${salt},${digest},now()+interval '10 minutes',1)
          on conflict(account_key) do update set address=excluded.address,salt=excluded.salt,digest=excluded.digest,
          expires_at=excluded.expires_at,sent_at=now(),failures=0,sends=${recent?challenge.sends+1:1},
          window_start=case when ${!!recent} then enl_email_challenges.window_start else now() end`;
        return json({ok:true});
      });
    }
    // Legacy clients may still send the address during login. Never enroll through login.
    if(["login_site","login_hq"].includes(action)&&clean(body.companyLocal)&&!body.accountKey)return json({ok:false,message:"update_required"},409);
    if(action==='device_status'){
      const key=clean(body.accountKey),token=clean(body.deviceKey);
      if(!/^(hq|site):.{1,160}$/.test(key)||!/^[a-f0-9]{64}$/.test(token))return json({ok:true,verified:false});
      const [known]=await sql`select 1 from private.enl_login_devices where account_key=${key} and device_hash=${await sha256(token)}`;
      return json({ok:true,verified:!!known});
    }
    if(action==="lookup"){
      const name=clean(body.name);if(!name)return json({ok:false,message:"name_required"},400);
      const sites=await siteMap(),people=await sql`select personnel_id,site_id,name,email,job_title,access_role,(nullif(pin_hash,'') is not null) as has_password from public.enl_site_personnel where active=true and regexp_replace(lower(name),'[[:space:]]','','g')=${norm(name)}`;
      const options:any[]=people.map((p:any)=>({accountKey:'site:'+p.personnel_id,kind:'site',siteId:p.site_id,affiliationId:'site:'+p.site_id,affiliationLabel:sites.get(p.site_id)||p.site_id,
        name:p.name,position:p.job_title,accessRole:p.access_role,requiresPassword:p.has_password||p.access_role==='field'||isFieldTitle(p.job_title),companyLocal:localPart(p.email),hasEmail:!!clean(p.email)}));
      const hq=await findHqByName(name);
      if(hq?.active&&hqAllowed(hq.role)){const a=affiliation(hq);options.push({accountKey:'hq:'+hq.user_id,kind:'hq',affiliationId:a.id,affiliationLabel:a.label,name:hq.name,role:hqRole(hq.role),position:hq.position,requiresPassword:true,companyLocal:localPart(hq.email),hasEmail:!!clean(hq.email)});}
      async function selectedOptions(list:any[]){
        const o=list[0];
        if(list.length===1)Object.assign(o,await loginPolicy(sql,o.accountKey,o.companyLocal?o.companyLocal+companyDomain:""));
        return list;
      }
      if(body.fixedAccount&&options.length>1){
        const key=clean(body.accountKey),email=clean(body.knownEmail).toLowerCase();
        const matched=options.filter(o=>(key&&o.accountKey===key)||(email&&o.companyLocal&&o.companyLocal+companyDomain===email));
        const candidates=matched.length?matched:options;
        if((!key&&!email||matched.length>1)&&candidates.length>1&&candidates.every(o=>o.kind==='site'&&o.accessRole==='field'&&o.companyLocal&&o.companyLocal===candidates[0].companyLocal)){
          // Shared addresses can only be assigned to explicitly linked accounts by the database.
          return json({ok:true,name,ambiguous:true,options:[],jointSites:candidates.map(o=>({accountKey:o.accountKey,label:o.affiliationLabel}))});
        }
        return json({ok:true,name,ambiguous:matched.length!==1,options:matched.length===1?await selectedOptions(matched):[]});
      }
      // Older clients only need affiliation choices, not identifiers or addresses.
      if(!body.fixedAccount)return json({ok:true,name,options:options.map(({accountKey,companyLocal,hasEmail,...choice})=>choice)});
      return json({ok:true,name,options:await selectedOptions(options)});
    }
    if(action==="login_site"){
      const name=clean(body.name),siteId=clean(body.siteId),passwordHash=clean(body.passwordHash),key=clean(body.accountKey);
      if(!name||!siteId)return json({ok:false,message:"input_required"},400);
      const rows=await sql`select personnel_id,site_id,name,email,job_title,access_role,pin_hash,updated_at::text as key_version from public.enl_site_personnel where site_id=${siteId} and active=true`;
      const matches=rows.filter((p:any)=>norm(p.name)===norm(name)&&(!key||key==='site:'+p.personnel_id));
      if(matches.length!==1)return json({ok:false,message:"account_not_unique"},403);
      const p=matches[0],manager=p.access_role==='field'||isFieldTitle(p.job_title);
      if((manager||clean(p.pin_hash))&&(!passwordHash||!p.pin_hash||!sameProof(p.pin_hash,passwordHash)))return json({ok:false,message:"invalid_login"},401);
      if(clean(p.email)&&clean(body.companyLocal)&&clean(body.companyLocal).toLowerCase()!==localPart(p.email))return json({ok:false,message:'use_email_registration'},409);
      const names=await siteMap();return await finishLogin(sql,'site:'+p.personnel_id,body,{ok:true,person:{personnel_id:p.personnel_id,site_id:p.site_id,site_name:names.get(p.site_id)||p.site_id,name:p.name,job_title:p.job_title,access_role:manager?'field':'worker',active:true,email:p.email||''}},sendEnrollmentCode,verifier,json);
    }
    if(action==="login_hq"){
      const name=clean(body.name),affiliationId=clean(body.affiliationId),passwordHash=clean(body.passwordHash);
      if(!name||!affiliationId||!passwordHash)return json({ok:false,message:"input_required"},400);
      const hq=await findHqByName(name);
      if(!hq?.active||!hqAllowed(hq.role)||affiliation(hq).id!==affiliationId||(body.accountKey&&body.accountKey!=='hq:'+hq.user_id)||!sameProof(clean(hq.password_hash),passwordHash))return json({ok:false,message:"invalid_login"},401);
      if(clean(hq.email)&&clean(body.companyLocal)&&clean(body.companyLocal).toLowerCase()!==localPart(hq.email))return json({ok:false,message:'use_email_registration'},409);
      return await finishLogin(sql,'hq:'+hq.user_id,body,{ok:true,user:publicHq(hq)},sendEnrollmentCode,verifier,json);
    }
    if(['password_schedule','claim_password_reminder','defer_password_year','device_logout'].includes(action)){
      const key=(['field','worker'].includes(actor.role)?'site:':'hq:')+actor.id;
      if(action==='device_logout'){
        await sql`delete from private.enl_device_sessions where account_key=${key} and token_hash=${await sha256(body.deviceSession)}`;
        return json({ok:true});
      }
      if(action==='claim_password_reminder'){
        const [claimed]=await sql`update private.enl_password_schedule
          set reminder_after=now()+interval '1 month'
          where account_key=${key} and (initial or next_prompt<=now())
            and (reminder_after is null or reminder_after<=now())
          returning initial,reminder_after`;
        if(claimed)return json({ok:true,reminder:claimed.initial?'initial':'annual',retryAt:claimed.reminder_after});
        const [pending]=await sql`select greatest(reminder_after,case when not initial then next_prompt end) as retry_at
          from private.enl_password_schedule where account_key=${key}`;
        return json({ok:true,reminder:null,retryAt:pending?.retry_at});
      }
      if(action==='defer_password_year')await sql`update private.enl_password_schedule set next_prompt=now()+interval '1 year'
        where account_key=${key} and not initial and next_prompt<=now()`;
      return json({ok:true,passwordPolicy:await schedule(sql,key)});
    }
    if(action==="hq_list"){
      const v=await verifiedActor();if(v?.role!=="safety")return json({ok:false,message:"forbidden"},403);const rows=await sql`select * from public.enl_hq_users order by active desc,name`;return json({ok:true,users:rows.map(publicHq)});
    }
    if(action==="hq_upsert"){
      const v=await verifiedActor();if(v?.role!=="safety")return json({ok:false,message:"forbidden"},403);const u=body.user||{},name=clean(u.name),requestedId=clean(u.id),role=hqAllowed(u.role)?hqRole(u.role):"manager",passwordHash=clean(u.passwordHash),hasEmail=Object.prototype.hasOwnProperty.call(u,"email"),hasPush=Object.prototype.hasOwnProperty.call(u,"pushEnabled"),hasMail=Object.prototype.hasOwnProperty.call(u,"emailEnabled");if(!name)return json({ok:false,message:"name_required"},400);let prev:any=null;if(requestedId){const r=await sql`select * from public.enl_hq_users where user_id=${requestedId} limit 1`;prev=r[0]||null;}if(!prev)prev=await findHqByName(name);const email=hasEmail?clean(u.email).toLowerCase():clean(prev?.email),pushEnabled=hasPush?u.pushEnabled!==false:prev?.push_enabled!==false,emailEnabled=hasMail?u.emailEnabled!==false:prev?.email_enabled!==false;if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({ok:false,message:"invalid_email"},400);const userId=prev?.user_id||requestedId||`hq-${crypto.randomUUID()}`,hash=passwordHash||clean(prev?.password_hash);if(!hash)return json({ok:false,message:"password_required"},400);const rows=await sql`insert into public.enl_hq_users(user_id,name,normalized_name,password_hash,role,department,position,email,push_enabled,email_enabled,active,source,created_at,updated_at,updated_by_id,updated_by_name,updated_by_role) values(${userId},${name},${norm(name)},${hash},${role},${clean(u.department)},${clean(u.position)},${email},${pushEnabled},${emailEnabled},${u.active!==false},${clean(u.source)||prev?.source||"app-v411"},${prev?.created_at||now},${now},${v.id},${v.name},${v.role}) on conflict(user_id) do update set name=excluded.name,normalized_name=excluded.normalized_name,password_hash=excluded.password_hash,role=excluded.role,department=excluded.department,position=excluded.position,email=excluded.email,push_enabled=excluded.push_enabled,email_enabled=excluded.email_enabled,active=excluded.active,source=excluded.source,updated_at=excluded.updated_at,updated_by_id=excluded.updated_by_id,updated_by_name=excluded.updated_by_name,updated_by_role=excluded.updated_by_role returning *,private.enl_assign_duties('hq',user_id,null,${u.duties===undefined?null:sql.json(u.duties)}::jsonb,${v.id}) as duty_saved`;return json({ok:true,user:publicHq(rows[0])});
    }
    if(action==="personnel_pull"){
      const siteId=clean(body.siteId);if(!siteId)return json({ok:false,message:"site_required"},400);const v=await verifiedActor();if(!(v?.role==="safety"||(v?.role==="field"&&v.siteId===siteId)))return json({ok:false,message:"forbidden"},403);const rows=await sql`select personnel_id,site_id,name,job_title,access_role,phone,active,created_at,updated_at,updated_by_name,updated_by_role,updated_by_position from public.enl_site_personnel where site_id=${siteId} order by active desc,name`;return json({ok:true,personnel:rows});
    }
    if(action==="personnel_upsert"){
      const p=body.person||{},siteId=clean(p.siteId||body.siteId),name=clean(p.name),requestedTitle=clean(p.jobTitle),requestedRole=clean(p.accessRole)==="field"?"field":"worker",active=p.active!==false,phone=clean(p.phone),passwordHash=clean(p.passwordHash);if(!siteId||!name)return json({ok:false,message:"invalid_personnel"},400);const v=await verifiedActor();if(!(v?.role==="safety"||(v?.role==="field"&&v.siteId===siteId)))return json({ok:false,message:"forbidden"},403);const list=await sql`select * from public.enl_site_personnel where site_id=${siteId}`;const targetId=clean(p.personnelId),prev=list.find((x:any)=>targetId?String(x.personnel_id)===targetId:norm(x.name)===norm(name));if(v.role==="field"&&(requestedRole==="field"||isFieldTitle(requestedTitle)||clean(prev?.access_role)==="field"||isFieldTitle(prev?.job_title)))return json({ok:false,message:"role_change_safety_only"},403);const accessRole=requestedRole==="field"?"field":"worker",jobTitle=accessRole==="field"?requestedTitle:"일반근로자";if(accessRole==="field"&&!isFieldTitle(jobTitle))return json({ok:false,message:"invalid_position"},400);let pinHash="";if(accessRole==="field"){if(v.role==="safety"&&passwordHash)pinHash=passwordHash;else if(clean(prev?.access_role)==="field"&&clean(prev?.pin_hash))pinHash=clean(prev.pin_hash);else{const digits=phone.replace(/\D/g,"");if(digits.length>=4)pinHash=await sha256(digits.slice(-4));else pinHash=await managerPhoneHash(siteId,name,jobTitle);}if(!pinHash)return json({ok:false,message:"manager_phone_required"},400);}if(v.role==="safety"&&accessRole==="field"){for(const other of list){if(prev&&String(other.personnel_id)===String(prev.personnel_id))continue;if(other.active!==false&&clean(other.access_role)==="field"&&clean(other.job_title)===jobTitle){const before={...other};const q=await sql`update public.enl_site_personnel set job_title='일반근로자',access_role='worker',pin_hash=null,updated_at=${now},updated_by_id=${v.id},updated_by_name=${v.name},updated_by_role=${v.role},updated_by_position=${v.position} where personnel_id=${other.personnel_id} returning *`;await auditPersonnel(q[0],before,v,"update");}}}await clearOldMasterIfOwned(prev,jobTitle,active&&accessRole==="field");let rows:any[];if(prev){rows=await sql`update public.enl_site_personnel set site_id=${siteId},name=${name},job_title=${jobTitle},access_role=${accessRole},phone=${phone},active=${active},pin_hash=${accessRole==="field"?pinHash:null},updated_at=${now},updated_by_id=${v.id},updated_by_name=${v.name},updated_by_role=${v.role},updated_by_position=${v.position},source=${prev.source||"app-v415"} where personnel_id=${prev.personnel_id} returning *`;}else{rows=await sql`insert into public.enl_site_personnel(site_id,name,job_title,access_role,phone,active,pin_hash,source,created_at,updated_at,updated_by_id,updated_by_name,updated_by_role,updated_by_position) values(${siteId},${name},${jobTitle},${accessRole},${phone},${active},${accessRole==="field"?pinHash:null},${"app-v415"},${now},${now},${v.id},${v.name},${v.role},${v.position}) returning *`;}const saved=rows[0];await auditPersonnel(saved,prev,v,!prev?"create":prev.active&&!active?"retire":!prev.active&&active?"reactivate":"update");await syncMasterForField(saved);return json({ok:true,person:{...saved,pin_hash:undefined}});
    }
    return json({ok:false,message:"invalid_action"},400);
   }catch(e:any){
    if(e?.code==='23505'&&e.constraint_name==='enl_account_email_owners_pkey')return json({ok:false,message:'email_in_use'},409);
    return json({ok:false,message:"request_failed"},500);
  }finally{await sql.end({timeout:1}).catch(()=>{})}
});
