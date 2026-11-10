import { hashToken, issueSession, validToken } from '../_shared/device-runtime.ts';
export async function schedule(sql:any,key:string){
 const [p]=await sql`select initial,next_prompt,now() as server_now from private.enl_password_schedule where account_key=${key}`;
 return p?{initial:p.initial,nextPrompt:p.next_prompt,serverNow:p.server_now}:{initial:true,nextPrompt:null};
}
export async function emailVerified(sql:any,key:string,email:string){
 const [match]=await sql`select 1 from private.enl_password_schedule where account_key=${key} and verified_email=${email}`;
 return !!match;
}
export async function confirmEmail(tx:any,key:string,email:string){
 await tx`update private.enl_password_schedule set verified_email=${email} where account_key=${key}`;
}
export async function finishLogin(sql:any,key:string,body:any,result:any,send:any,verifier:any,reply:any){
 if(!validToken(body.deviceKey))return reply({ok:false,message:'device_client_update_required'},409);
 const device=await hashToken(body.deviceKey),hq=key.startsWith('hq:'),id=key.slice(key.indexOf(':')+1);
 return sql.begin(async(tx:any)=>{
  // Lock the actual account first, in the same order as password/email updates.
  const [u]=hq?await tx`select email,password_hash as proof from public.enl_hq_users where user_id=${id} and active for update`:
    await tx`select email,pin_hash as proof from public.enl_site_personnel where personnel_id::text=${id} and active for update`;
  const email=String(u?.email||'').trim().toLowerCase();
  if(!u||!u.proof||u.proof!==body.passwordHash||!email.endsWith('@enlife.co.kr'))return reply({ok:false,message:'invalid_login'},403);
  if(!await emailVerified(tx,key,email)){
   const [c]=await tx`select * from private.enl_device_challenge where account_key=${key} for update`;
   const now=Date.now(),same=c&&c.device_hash===device&&c.email===email,live=same&&new Date(c.expires_at).getTime()>now;
   const code=String(body.deviceCode||'');
   if(code){
    if(!live)return reply({ok:false,message:'code_expired'},409);
    if(c.failures>=5)return reply({ok:false,message:'code_locked'},429);
    if(!/^\d{6}$/.test(code)||await verifier(code,c.salt)!==c.digest){
     await tx`update private.enl_device_challenge set failures=failures+1 where account_key=${key}`;return reply({ok:false,message:'incorrect_code'},403);
    }
    await confirmEmail(tx,key,email);
    // Consume the challenge, retaining resend quotas for the rest of the hour.
    await tx`update private.enl_device_challenge set expires_at=now(),digest='' where account_key=${key}`;
   }else{
    if(live&&!body.resend&&c.failures<5)return reply({ok:false,message:'device_code_required'},428);
    if(c&&now-new Date(c.sent_at).getTime()<60000)return reply({ok:false,message:'wait_resend'},429);
    const fresh=c&&now-new Date(c.window_start).getTime()<3600000;
    if(fresh&&c.sends>=5)return reply({ok:false,message:'send_limit'},429);
    const a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=4294000000);
    const otp=String(a[0]%1000000).padStart(6,'0'),salt=crypto.randomUUID(),digest=await verifier(otp,salt);
    try{await send(email,otp)}catch{return reply({ok:false,message:'mail_unavailable'},502)}
    await tx`insert into private.enl_device_challenge(account_key,device_hash,email,digest,salt,sent_at,expires_at,window_start,sends,failures)
     values(${key},${device},${email},${digest},${salt},now(),now()+interval '10 minutes',now(),1,0)
     on conflict(account_key) do update set device_hash=excluded.device_hash,email=excluded.email,digest=excluded.digest,salt=excluded.salt,
     sent_at=now(),expires_at=excluded.expires_at,window_start=case when ${!!fresh} then enl_device_challenge.window_start else now() end,
     sends=case when ${!!fresh} then enl_device_challenge.sends+1 else 1 end,failures=0`;
    return reply({ok:false,message:'device_code_required'},428);
   }
  }
  // Each password login still receives its own revocable session.
  await tx`insert into private.enl_login_devices(account_key,device_hash,email) values(${key},${device},${email})
    on conflict(account_key,device_hash) do nothing`;
  return reply({...result,...await issueSession(tx,key,device),passwordPolicy:await schedule(tx,key)});
 });
}
