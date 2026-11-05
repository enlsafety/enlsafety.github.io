/* E&L Accident Report App v4.2.0 - account password controls */
(function(){
  'use strict';
  const VERSION='4.2.0-account1';
  const ACCOUNT_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-account-v420';
  const CLIENT='incident-report-v2';
  const FIELD_TITLES=['현장소장','파트장','서무'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actor=(u=currentUser?.())=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  const eligibleSelf=u=>!!u&&((roleNorm(u.role)==='field'&&FIELD_TITLES.includes(String(u.position||u.jobTitle||'')))||['safety','manager','executive'].includes(roleNorm(u.role)));

  async function hash(v){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(v||'')));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function api(body,timeout=15000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null,timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(ACCOUNT_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}return j;
    }finally{if(timer)clearTimeout(timer)}
  }
  window.enlAccountApi=api;

  function css(){if(document.getElementById('account420Css'))return;const s=document.createElement('style');s.id='account420Css';s.textContent=`
    .enl420-pwform{display:grid;gap:12px}.enl420-pwform label{display:grid;gap:6px}.enl420-pwform label span{font-size:13px;font-weight:900;color:#426078}.enl420-pwform input{width:100%;min-height:48px;border:1.5px solid #bfd0dd;border-radius:10px;padding:0 12px;font:inherit;box-sizing:border-box}.enl420-note{padding:11px 12px;border-radius:10px;background:#f1f8fd;color:#526e82;font-size:12px;line-height:1.5}.enl420-actions{display:flex;justify-content:flex-end;gap:8px}.enl420-actions button{min-height:44px;border:1px solid #bdcad6;border-radius:10px;background:#fff;padding:0 14px;font-weight:900}.enl420-actions .primary{background:#173b66;color:#fff;border-color:#173b66}.enl420-row-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.enl420-row-actions button{min-height:34px;border:1px solid #bdcbd7;border-radius:8px;background:#fff;padding:0 9px;font-weight:850}.enl420-reset{color:#8b4f21!important;border-color:#dfc29f!important;background:#fffaf3!important}@media(max-width:760px){.enl420-row-actions{justify-content:flex-start}}
    .enl420-device-dialog{box-sizing:border-box;width:min(430px,calc(100% - 24px));max-height:88dvh;overflow:auto;border:1px solid #c1d5e4;border-radius:18px;padding:20px;color:#24445c;background:#fff}
    .enl420-device-dialog::backdrop{background:#17354c66}
    .enl420-device-dialog h2{margin:0;font-size:21px}.enl420-device-dialog .modal-head p{font-size:14px;line-height:1.5}
    .enl420-pwform [role=status]:empty{display:none}.enl420-pwform [role=status]{margin:0;color:#a32a37}
  `;document.head.appendChild(s)}

  function syncLocalPassword(newHash){
    try{
      const u=currentUser?.(),isField=roleNorm(u?.role)==='field';if(u){u.passwordHash=newHash;if(isField)u.pinHash=newHash;u.updatedAt=new Date().toISOString()}
      if(session?.manager&&String(session.manager.id||'')===String(u?.id||'')){session.manager.passwordHash=newHash;if(isField)session.manager.pinHash=newHash;}
      if(session?.worker&&String(session.worker.id||'')===String(u?.id||'')){session.worker.passwordHash=newHash;if(isField)session.worker.pinHash=newHash;}
      const local=(data?.users||[]).find(x=>String(x.id)===String(u?.id));
      if(local&&['safety','manager','executive'].includes(roleNorm(u.role)))local.passwordHash=newHash;
      if(typeof saveSession==='function')saveSession();if(typeof saveData==='function')saveData();
    }catch(e){}
  }

  const accountKey=u=>(roleNorm(u.role)==='field'?'site:':'hq:')+(u.id||u.personnelId);
  const acknowledged=new Set();
  function openSelfChange(firstLogin=false){
    const u=currentUser?.();if(!eligibleSelf(u))return;
    const initial=firstLogin===true,key=accountKey(u);
    const title=initial?'이 기기의 첫 로그인':'비밀번호 변경';
    const description=initial?'초기 비밀번호를 변경할 수 있습니다. 이미 변경했다면 현재 비밀번호를 입력하세요.':escx(u.name||'사용자');
    const html=`<div class="modal-head"><div><h2 id="enl420PwTitle" tabindex="-1">${title}</h2><p>${description}</p></div><button type="button" aria-label="닫기" data-close>×</button></div>
    <form id="enl420SelfForm" class="enl420-pwform">
      <label><span>${initial?'초기 비밀번호 (변경한 경우 현재 비밀번호)':'현재 비밀번호'}</span><input name="currentPw" id="enl420Current" type="password" autocomplete="current-password" required></label>
      <label><span>새로 설정할 비밀번호</span><input name="newPw" id="enl420New" type="password" autocomplete="new-password" minlength="4" maxlength="32" required placeholder="4자 이상"></label>
      <label><span>새 비밀번호 확인</span><input name="repeatPw" id="enl420New2" type="password" autocomplete="new-password" minlength="4" maxlength="32" required></label>
      <div class="enl420-note">변경한 비밀번호는 모든 기기에서 사용합니다.</div><p role="status" aria-live="polite"></p>
      <div class="enl420-actions"><button type="button" data-close>${initial?'다음에 변경':'취소'}</button><button type="submit" class="primary">비밀번호 변경</button></div></form>`;
    let dialog=null;
    if(initial){
      dialog=document.createElement('dialog');dialog.className='enl420-device-dialog';dialog.setAttribute('aria-labelledby','enl420PwTitle');dialog.innerHTML=html;
      const acknowledge=()=>{
        acknowledged.add(key);
        try{localStorage.setItem('enl.firstPasswordPrompt.ack.'+key,'1')}catch{}
      };
      document.body.append(dialog);
      dialog.onclose=()=>{if(dialog.returnValue==='confirmed')acknowledge();dialog.remove()};
      dialog.oncancel=event=>{event.preventDefault();dialog.close('confirmed')};
      dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close('confirmed'));
      dialog.showModal();dialog.querySelector('h2').focus();
    }else openModal(html);
    const form=(dialog||document).querySelector('#enl420SelfForm');
    const note=form.querySelector('[role=status]'),submit=form.querySelector('[type=submit]');
    form.onsubmit=async ev=>{
      ev.preventDefault();if(submit.disabled)return;
      const current=form.elements.currentPw.value,newPw=form.elements.newPw.value;
      if(newPw!==form.elements.repeatPw.value){note.textContent='새 비밀번호가 서로 다릅니다.';return;}
      if(current===newPw){note.textContent='현재 비밀번호와 다른 비밀번호를 입력해 주세요.';return;}
      submit.disabled=true;submit.textContent='변경 중…';note.textContent='';
      try{
        const currentPasswordHash=await hash(current),newPasswordHash=await hash(newPw);
        await api({action:'password_change_self',actor:actor(u),currentPasswordHash,newPasswordHash});
        if(!currentUser?.()||accountKey(currentUser())!==key)return;
        syncLocalPassword(newPasswordHash);
        form.reset();
        if(dialog?.open)dialog.close('confirmed');else if(!dialog&&form.isConnected)closeModal();
        await window.enlUpdateRememberedProof?.(key,newPasswordHash);
        alert('비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.');
      }catch(e){
        note.textContent=e.message==='current_password_incorrect'?'현재 비밀번호가 맞지 않습니다.':e.message==='same_password'?'다른 새 비밀번호를 입력해 주세요.':'변경하지 못했습니다. 다시 시도해 주세요.';
      }finally{submit.disabled=false;submit.textContent='비밀번호 변경';}
    };
  }
  window.enlOpenSelfPasswordChange420=openSelfChange;
  window.enlOfferDevicePasswordChange=u=>{
    if(!eligibleSelf(u)||document.querySelector('.enl420-device-dialog[open]'))return;
    const key=accountKey(u);
    if(acknowledged.has(key))return;
    try{if(localStorage.getItem('enl.firstPasswordPrompt.ack.'+key)==='1')return}catch{}
    openSelfChange(true);
  };

  function safetyResetTarget(target){
    const u=currentUser?.();if(roleNorm(u?.role)!=='safety'||!target?.id)return;
    const label=target.kind==='site'?`${target.name||'현장관리자'} · ${target.position||'현장관리'}`:`${target.name||'본사 사용자'} · ${roleName?.(roleNorm(target.role))||'관리자'}`;
    openModal(`<div class="modal-head"><div><div class="ey">SAFETY RESET</div><h2>이용자 비밀번호 변경</h2><p>${escx(label)}</p></div><button class="x" data-close>×</button></div><form id="enl420SafetyReset" class="enl420-pwform"><label><span>안전관리자 본인 비밀번호 *</span><input id="enl420SafetyProof" type="password" autocomplete="current-password" required></label><label><span>새 비밀번호 *</span><input id="enl420TargetNew" type="password" autocomplete="new-password" minlength="4" maxlength="32" required placeholder="4자 이상"></label><label><span>새 비밀번호 확인 *</span><input id="enl420TargetNew2" type="password" autocomplete="new-password" minlength="4" maxlength="32" required></label><div class="enl420-note">비밀번호 내용은 화면이나 기록에 표시하지 않습니다. 안전관리자 본인 확인 후 새 비밀번호로 즉시 교체됩니다.</div><div class="enl420-actions"><button type="button" data-close>취소</button><button type="submit" class="primary">새 비밀번호 저장</button></div></form>`);
    document.getElementById('enl420SafetyReset').onsubmit=async ev=>{
      ev.preventDefault();const proof=document.getElementById('enl420SafetyProof').value,newPw=document.getElementById('enl420TargetNew').value,newPw2=document.getElementById('enl420TargetNew2').value;if(newPw.length<4)return alert('새 비밀번호는 4자 이상 입력해 주세요.');if(newPw!==newPw2)return alert('새 비밀번호가 서로 다릅니다.');
      const submit=ev.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='저장 중…';
      try{await api({action:'password_reset_safety',actor:actor(u),actorPasswordHash:await hash(proof),newPasswordHash:await hash(newPw),target:{kind:target.kind,id:String(target.id)}});if(target.kind==='hq'){const local=typeof userById==='function'?userById(target.id):null;if(local)local.passwordHash=await hash(newPw);if(typeof saveData==='function')saveData()}closeModal();alert(`${target.name||'이용자'}의 비밀번호가 변경되었습니다.`)}
      catch(e){submit.disabled=false;submit.textContent='새 비밀번호 저장';if(e?.message==='safety_password_incorrect')alert('안전관리자 본인 비밀번호가 맞지 않습니다.');else if(e?.message==='invalid_target')alert('비밀번호를 변경할 수 없는 이용자입니다.');else alert('비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.')}
    };
  }
  window.enlOpenSafetyPasswordReset420=safetyResetTarget;

  const previousAdminReset=window.openAdminPasswordReset;
  window.openAdminPasswordReset=function(target,u){
    if(roleNorm((u||currentUser?.())?.role)==='safety'&&target&&['manager','executive','final'].includes(String(target.role||'')))return safetyResetTarget({kind:'hq',id:target.id,name:target.name,role:roleNorm(target.role)});
    if(typeof previousAdminReset==='function')return previousAdminReset(target,u);
  };

  function injectProfile(){
    const u=currentUser?.(),menu=document.getElementById('userMenu'),logout=document.getElementById('logoutBtn');if(!u||!menu||!logout||!eligibleSelf(u))return;
    if(!document.getElementById('enlChangePassword420')){const b=document.createElement('button');b.id='enlChangePassword420';b.type='button';b.textContent='비밀번호 변경';b.onclick=()=>{menu.classList.add('hide');openSelfChange()};menu.insertBefore(b,logout)}
  }

  function injectFieldResetButtons(){
    const u=currentUser?.();if(roleNorm(u?.role)!=='safety')return;
    document.querySelectorAll('.sa415-person').forEach(row=>{
      if(row.dataset.enl420Pw==='1')return;const edit=row.querySelector('[data-sa415-person]');const pos=String(row.querySelector('.position')?.textContent||'').trim();if(!edit||!FIELD_TITLES.includes(pos))return;
      const id=String(edit.dataset.sa415Person||'');const name=String(row.querySelector('b')?.textContent||'').trim();const wrap=document.createElement('div');wrap.className='enl420-row-actions';row.replaceChild(wrap,edit);wrap.appendChild(edit);const reset=document.createElement('button');reset.type='button';reset.className='enl420-reset';reset.textContent='비밀번호 변경';reset.onclick=ev=>{ev.preventDefault();ev.stopPropagation();safetyResetTarget({kind:'site',id,name,position:pos})};wrap.appendChild(reset);row.dataset.enl420Pw='1';
    });
  }

  function patchLoginPassword(){const p=document.getElementById('loginPassword411');if(p){if(p.required)p.placeholder='설정한 비밀번호'}}
  function apply(){css();injectProfile();injectFieldResetButtons();patchLoginPassword()}
  const mo=new MutationObserver(()=>requestAnimationFrame(apply));mo.observe(document.documentElement,{childList:true,subtree:true});apply();
  window.ENL_ACCOUNT_SECURITY_VERSION=VERSION;
})();