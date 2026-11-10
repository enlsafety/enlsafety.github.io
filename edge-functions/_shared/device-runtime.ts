// The business handlers retain their separate role/proof checks. Each entry imports
// the adapter with exactly the public, non-user actions its own handler implements.
import postgres from 'npm:postgres@3.4.5';
const native=globalThis.Deno;
const origin='https://enlsafety.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Content-Type':'application/json','Cache-Control':'no-store'};
const reject=(status:number,message:string)=>new Response(JSON.stringify({ok:false,message}),{status,headers});
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export const hashToken=async (value:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export const newToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
export const validToken=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export async function issueSession(tx:any,key:string,device:string){
 const token=newToken();
 await tx`delete from private.enl_device_sessions where account_key=${key} and expires_at<=now()`;
 const [row]=await tx`insert into private.enl_device_sessions(token_hash,account_key,device_hash,expires_at)
   values(${await hashToken(token)},${key},${device},now()+interval '24 hours') returning expires_at`;
 return {deviceSession:token,expiresAt:row.expires_at};
}
let pool:ReturnType<typeof postgres>;
function runtime(publicActions:string[]){
 return {env:native.env,serve(handler:(req:Request)=>Promise<Response>){
  return native.serve(async(req:Request)=>{
   if(req.method!=='POST')return handler(req);
   if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reject(403,'origin_not_allowed');
   let b;try{b=await req.clone().json()}catch{return reject(400,'invalid_json')}
   if(!b||typeof b!=='object')return reject(400,'invalid_json');
   if(publicActions.includes(b.action))return handler(req);
   const a=b.actor;
   if(!a?.id||!['worker','field','manager','final','executive','safety'].includes(a.role)||!validToken(b.deviceSession))
     return reject(403,'device_session_required');
   const key=(a.role==='worker'||a.role==='field'?'site:':'hq:')+a.id;
   try{
    pool??=postgres(native.env.get('SUPABASE_DB_URL')||'',{prepare:false,max:1,idle_timeout:5,connect_timeout:5});
    const [row]=await pool`select 1 from private.enl_device_sessions where token_hash=${await hashToken(b.deviceSession)}
       and account_key=${key} and expires_at>now()`;
    if(!row)return reject(403,'device_session_required');
   }catch{return reject(503,'device_session_unavailable')}
   return handler(req);
  });
 }};
}
export const restricted=runtime([]);
export const hasHealth=runtime(['health']);
export const directory=runtime(['site_directory']);
export const push=runtime(['health','dispatch']);
export const mail=runtime(['health','dispatch','keepalive']);
export const pushAdmin=runtime(['health','ack_test_token']);
export const login=runtime(['lookup','login_hq','login_site','email_code_send','email_code_verify','register_company_email']);
