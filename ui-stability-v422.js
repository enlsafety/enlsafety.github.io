/* E&L Accident Report App v4.2.2 - stable shell + HQ editor */
(function(){
  'use strict';
  const VERSION='4.2.2-ui-stability2';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actorOf=u=>{try{return window.enlCurrentActor?.()||{id:u?.id||u?.personnelId||u?.username||'',name:u?.name||'',role:roleNorm(u?.role),position:u?.position||u?.jobTitle||'',siteId:u?.siteId||''}}catch(e){return null}};
  const userKey=u=>String(u?.id||u?.personnelId||u?.username||'');

  function installCss(){
    if(document.getElementById('uiStability422Css'))return;
    const s=document.createElement('style');s.id='uiStability422Css';s.textContent=`
      @media(min-width:761px){
        #enlPwaTop418{width:116px;min-width:116px;max-width:116px;font-size:0!important;transition:none!important;contain:layout paint;overflow:hidden}
        #enlPwaTop418>*{display:none!important}
        #enlPwaTop418::after{content:'🔔 알림 설정';font-size:12px;font-weight:950;line-height:1;white-space:nowrap}
        #enlPwaTop418.on::after{content:'● 알림 켜짐'}
      }
    `;document.head.appendChild(s);
  }

  function modalBusy(){
    const root=document.getElementById('modalRoot');
    if(root&&root.children.length>0)return true;
    if(document.getElementById('enl418Overlay'))return true;
    if(document.querySelector('.modal-overlay,.modal-backdrop,[role="dialog"]'))return true;
    return false;
  }
  function transientViewBusy(){
    const inquiry=document.querySelector('[data-wf-inquiry-nav]');
    return !!(inquiry?.classList.contains('on')&&document.querySelector('.wf412-page'));
  }
  window.enlUiModalBusy=modalBusy;

  const baseRenderShell=window.renderShell;
  let mountedUserId='';

  function syncNavState(){
    const inquiry=document.querySelector('[data-wf-inquiry-nav]');
    if(inquiry?.classList.contains('on'))return;
    document.querySelectorAll('[data-shell-view]').forEach(b=>b.classList.toggle('on',String(b.dataset.shellView||'')===String(currentView||'')));
  }

  if(typeof baseRenderShell==='function'){
    window.renderShell=function(u){
      if(!u||u.active===false)return baseRenderShell(u);
      const id=userKey(u),shell=document.querySelector('.app-shell.shell-v411'),root=document.getElementById('view');
      if(shell&&root&&mountedUserId===id){
        if(modalBusy()||transientViewBusy())return root;
        syncNavState();
        try{
          if(typeof window.renderCurrentView==='function')return window.renderCurrentView(u)||root;
        }catch(e){console.warn('stable view render fallback',e)}
      }
      const out=baseRenderShell(u);
      mountedUserId=id;
      return out;
    };
    try{const u=currentUser?.();if(u&&document.querySelector('.app-shell.shell-v411'))mountedUserId=userKey(u)}catch(e){}
  }

  function localMerge(serverUser,passwordHash=''){
    if(!serverUser?.id)return null;
    if(!Array.isArray(data.users))data.users=[];
    let x=typeof userById==='function'?userById(serverUser.id):null;
    if(!x){x={id:serverUser.id,createdAt:serverUser.createdAt||nowISO()};data.users.push(x)}
    Object.assign(x,{
      username:serverUser.name,
      name:serverUser.name,
      role:roleNorm(serverUser.role),
      department:serverUser.department||'',
      position:serverUser.position||'',
      siteId:null,
      active:serverUser.active!==false,
      updatedAt:serverUser.updatedAt||nowISO()
    });
    if(passwordHash)x.passwordHash=passwordHash;
    try{saveData()}catch(e){}
    return x;
  }

  const previousOpenUserModal=window.openUserModal;
  window.openUserModal=function(user,u){
    const operator=u||currentUser?.();
    if(roleNorm(operator?.role)!=='safety')return typeof previousOpenUserModal==='function'?previousOpenUserModal(user,u):undefined;
    const isNew=!user,role=roleNorm(user?.role)||'manager',self=user&&String(user.id||'')===String(operator?.id||'');
    openModal(`<div class="modal-head"><div><div class="ey">HQ ACCOUNT</div><h2>${isNew?'본사 사용자 생성':'본사 사용자 정보·권한 수정'}</h2><p>${isNew?'본사 로그인 계정을 생성합니다.':'비밀번호를 바꾸지 않고 이름·소속·직급·권한만 수정할 수 있습니다.'}</p></div><button class="x" data-close>×</button></div><form id="hqUserForm422"><div class="formgrid"><label class="lbl"><span>이름 *</span><input id="hqName422" value="${escx(user?.name||'')}" required></label><label class="lbl"><span>소속사업부</span><input id="hqDept422" value="${escx(user?.department||'')}"></label><label class="lbl"><span>직급</span><input id="hqPos422" value="${escx(user?.position||'')}"></label><label class="lbl"><span>역할군 *</span><select id="hqRole422" ${self?'disabled':''}><option value="safety" ${role==='safety'?'selected':''}>안전관리자</option><option value="manager" ${role==='manager'?'selected':''}>관리자</option><option value="executive" ${role==='executive'?'selected':''}>경영진</option></select></label><label class="lbl"><span>계정 상태</span><select id="hqActive422" ${self?'disabled':''}><option value="1" ${user?.active!==false?'selected':''}>활성</option><option value="0" ${user?.active===false?'selected':''}>비활성</option></select></label>${isNew?'<label class="lbl"><span>초기 비밀번호 *</span><input id="hqPw422" type="password" minlength="4" autocomplete="new-password" required placeholder="4자 이상"></label>':''}</div><div class="help" style="margin:10px 0">${isNew?'생성 후 이용자가 우측 상단 프로필에서 직접 비밀번호를 변경할 수 있습니다.':'비밀번호 변경은 목록의 별도 ‘비밀번호’ 버튼을 사용합니다. 정보·권한 저장 시 기존 비밀번호는 그대로 유지됩니다.'}</div><button id="hqSave422" class="primary full" type="submit">${isNew?'계정 생성':'변경사항 저장'}</button></form>`);
    const form=document.getElementById('hqUserForm422');if(!form)return;
    form.onsubmit=async ev=>{
      ev.preventDefault();
      const name=document.getElementById('hqName422').value.trim(),department=document.getElementById('hqDept422').value.trim(),position=document.getElementById('hqPos422').value.trim();
      const selectedRole=self?role:document.getElementById('hqRole422').value,active=self?true:document.getElementById('hqActive422').value==='1';
      const pw=isNew?(document.getElementById('hqPw422')?.value||''):'';
      if(!name)return alert('이름을 입력해 주세요.');
      if(isNew&&pw.length<4)return alert('초기 비밀번호는 4자 이상 입력해 주세요.');
      const button=document.getElementById('hqSave422');button.disabled=true;button.textContent='저장 중…';
      try{
        const passwordHash=isNew?await sha256(pw):'';
        const payload={id:user?.id||uid('hq'),name,department,position,role:selectedRole,active};
        if(passwordHash)payload.passwordHash=passwordHash;
        const r=await window.enlAuthApi({action:'hq_upsert',actor:actorOf(operator),user:payload},18000);
        localMerge({...r.user,id:r.user?.id||payload.id},passwordHash);
        try{await window.enlSyncHqUsers?.(currentUser?.()||operator)}catch(e){}
        closeModal();
        try{window.renderShell?.(currentUser?.()||operator)}catch(e){}
        alert(isNew?'본사 사용자 계정이 생성되었습니다.':'사용자 정보와 권한이 저장되었습니다.');
      }catch(e){
        if(button?.isConnected){button.disabled=false;button.textContent=isNew?'계정 생성':'변경사항 저장'}
        const m=String(e?.message||'');
        if(m==='password_required')alert('초기 비밀번호를 입력해 주세요.');
        else if(m==='forbidden')alert('안전관리자 권한을 확인하지 못했습니다. 다시 로그인해 주세요.');
        else alert('본사 사용자 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    };
  };

  installCss();
  window.ENL_UI_STABILITY_VERSION=VERSION;
})();
