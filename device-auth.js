/* Browser installation identity and the signed-in account session have separate lifetimes. */
(()=>{
 'use strict';
 const base='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/',loginUrl=base+'enl-login-v411',activeKey='enl.verified-session.v1';
 const fetchOriginal=window.fetch.bind(window);
 const keyOf=u=>(['field','worker'].includes(u?.role)?'site:':'hq:')+(u?.id||u?.personnelId||'');
 function active(){try{return JSON.parse(localStorage.getItem(activeKey))}catch{return null}}
 const valid=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
 function deviceKey(key){
   const k='enl.trusted-browser.v1.'+key;
   let t=localStorage.getItem(k);
   if(!valid(t)){t=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(k,t)}
   return t;
 }
 function capture(key,r){
   if(!valid(r.deviceSession)||!Number.isFinite(Date.parse(r.expiresAt))||!r.passwordPolicy)throw Error('device_client_update_required');
   localStorage.setItem(activeKey,JSON.stringify({key,token:r.deviceSession,expires:r.expiresAt,policy:r.passwordPolicy}));
 }
 function validFor(u){const a=active();return !!u&&a?.key===keyOf(u)&&valid(a.token)&&Date.parse(a.expires)>Date.now()}
 function clear(){localStorage.removeItem(activeKey)}
 function expire(token){
   if(!token||active()?.token!==token)return;
   clear();window.enlClearRefreshSession?.('device_login_required');
   if(typeof renderLogin==='function')renderLogin();
 }
 window.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input?.url;
   if(!url?.startsWith(base+'enl-')||typeof init?.body!=='string')return fetchOriginal(input,init);
   const a=active();if(!a)return fetchOriginal(input,init);
   let body;try{body=JSON.parse(init.body)}catch{return fetchOriginal(input,init)}
   if(!body?.actor||a.key!==keyOf(body.actor))return fetchOriginal(input,init);
   const response=await fetchOriginal(input,{...init,redirect:'error',body:JSON.stringify({...body,deviceSession:a.token})});
   if(response.status===403&&(await response.clone().json().catch(()=>({}))).message==='device_session_required')expire(a.token);
   return response;
 };
 function logout(){
   const a=active();if(!a)return;
   const p=a.key.indexOf(':'),role=a.key.startsWith('site:')?'field':'manager';
   clear();
   fetchOriginal(loginUrl,{method:'POST',keepalive:true,redirect:'error',headers:{'Content-Type':'application/json','x-enl-app':'incident-report-v2'},
    body:JSON.stringify({action:'device_logout',actor:{id:a.key.slice(p+1),role},deviceSession:a.token})}).catch(()=>{});
 }
 document.addEventListener('click',e=>{if(e.target.closest?.('#logoutBtn'))logout()},true);
 const messages={incorrect_code:'인증번호가 일치하지 않습니다.',code_expired:'인증번호가 만료됐습니다. 다시 받아 주세요.',code_locked:'입력 횟수를 초과했습니다. 인증번호를 다시 받아 주세요.',wait_resend:'1분 뒤 다시 받을 수 있습니다.',send_limit:'시간당 발송 횟수를 초과했습니다.',mail_unavailable:'인증메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'};
 async function login(account,body,api,isCurrent){
   const key=account.accountKey, request={...body,deviceKey:deviceKey(key)};
   const save=r=>{if(!isCurrent())throw Error('account_changed');capture(key,r);return r;};
   let firstMessage;
   try{return save(await api(request))}catch(e){firstMessage=messages[e.message];if(!['device_code_required','wait_resend','send_limit'].includes(e.message))throw e}
   if(!isCurrent())throw Error('account_changed');
   return new Promise((resolve,reject)=>{
     const d=document.createElement('dialog');d.className='email-gate-dialog';d.setAttribute('aria-labelledby','deviceOtpTitle');
     d.innerHTML='<form><h2 id="deviceOtpTitle">새 기기 이메일 인증</h2><p>등록된 회사 이메일로 받은 인증번호를 입력해 주세요. 이 브라우저에서는 계정별로 한 번만 인증합니다.</p><label>인증번호 6자리<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code" autofocus></label><div role="status" aria-live="polite"></div><button type="button" data-resend>인증번호 다시 받기</button><footer><button type="button" data-cancel>취소</button><button type="submit">인증하고 로그인</button></footer></form>';
     const f=d.querySelector('form'),note=f.querySelector('[role=status]');note.textContent=firstMessage||'인증번호를 보냈습니다. 10분 내 입력해 주세요.';let busy=false;
     async function run(resend){
       if(busy||!isCurrent())return;busy=true;
       f.inert=true;note.textContent=resend?'인증번호를 보내고 있습니다.':'확인 중입니다.';
       try{
         const r=await api({...request,...(resend?{resend:true}:{deviceCode:f.elements.code.value})});
         if(!d.open||!isCurrent())return;
         const saved=save(r);d.close('verified');resolve(saved);
       }catch(e){
         if(d.open)note.textContent=e.message==='device_code_required'?'새 인증번호를 보냈습니다. 10분 내 입력해 주세요.':messages[e.message]||'인증을 완료하지 못했습니다. 연결 상태를 확인해 주세요.';
       }finally{busy=false;f.inert=false;f.elements.code.focus()}
     }
     f.onsubmit=e=>{e.preventDefault();run(false)};f.querySelector('[data-resend]').onclick=()=>run(true);f.querySelector('[data-cancel]').onclick=()=>d.close();
     d.onclose=()=>{d.remove();if(d.returnValue!=='verified')reject(Error('device_cancelled'))};document.body.append(d);d.showModal();
   });
 }
 window.enlDeviceAuth={login,capture,deviceKey,validFor,keyOf,active,expire,clear,
   savePolicy(key,policy){const a=active();if(a?.key===key){a.policy=policy;localStorage.setItem(activeKey,JSON.stringify(a))}}};
})();
