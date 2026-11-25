/* Switch only among server-authorized joint-site accounts, using normal login. */
(()=>{
  'use strict';
  const cache=new Map(),keyOf=u=>window.enlDeviceAuth.keyOf(u);
  const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  async function list(user,fresh=false){
    const key=keyOf(user),old=cache.get(key);
    if(!fresh&&old&&Date.now()-old.at<60000)return old.promise;
    const promise=window.enlAuthApi({action:'joint_sites',actor:{id:user.id,role:user.role,siteId:user.siteId}}).then(r=>r.sites||[]);
    const item={at:Date.now(),promise};cache.set(key,item);
    try{return await promise;}catch(e){if(cache.get(key)===item)cache.delete(key);throw e;}
  }
  function open(user,sites){
    if(keyOf(currentUser())!==keyOf(user)||document.querySelector('.joint-site-dialog'))return;
    if(window.ENLProcessing?.active()||window.enlIncidentSaveInProgress?.()||window.enlUiModalBusy?.())return;
    const frame=document.querySelector('.app-shell')?.enlWorkspaceFrame;
    if(frame?.canSwitchAccount&&!frame.canSwitchAccount())return;
    const d=element('dialog');d.className='joint-site-dialog';d.setAttribute('aria-labelledby','jointSiteTitle');
    const title=element('h2','담당 사업장 변경');title.id='jointSiteTitle';
    const form=element('form'),label=element('label','업무 사업장'),select=element('select');select.setAttribute('aria-label','업무 사업장');
    for(const site of sites)select.add(new Option(site.label,site.accountKey,false,site.accountKey===keyOf(user)));
    label.append(select);
    const passwordLabel=element('label','선택한 사업장 비밀번호'),password=element('input');password.type='password';password.autocomplete='current-password';passwordLabel.append(password);passwordLabel.hidden=!!user.pinHash;
    const note=element('p','선택한 사업장의 자료와 업무 화면으로 전환됩니다.');note.setAttribute('role','status');
    const footer=element('footer'),cancel=element('button','취소'),submit=element('button','사업장 변경');cancel.type='button';submit.type='submit';submit.disabled=true;footer.append(cancel,submit);
    form.append(label,passwordLabel,note,footer);d.append(title,form);document.body.append(d);let busy=false;
    const same=()=>d.open&&keyOf(currentUser())===keyOf(user);
    select.onchange=()=>{submit.disabled=select.value===keyOf(user);password.value='';};
    cancel.onclick=()=>{if(!busy)d.close();};d.oncancel=e=>{if(busy)e.preventDefault();};d.onclose=()=>d.remove();
    form.onsubmit=async e=>{
      e.preventDefault();if(busy||submit.disabled||!same())return;
      if(!user.pinHash&&!password.value){passwordLabel.hidden=false;password.focus();note.textContent='선택한 사업장 계정의 비밀번호를 입력해 주세요.';return;}
      busy=true;form.inert=true;note.textContent='담당 사업장과 로그인 정보를 확인하고 있습니다.';
      try{
        const latest=await list(user,true);if(!same())return;
        const target=latest.find(s=>s.accountKey===select.value&&s.accountKey!==keyOf(user));
        if(!target)throw Error('assignment_changed');
        const hash=password.value?await sha256(password.value):user.pinHash;
        await window.enlLoginToJointSite(target,hash,same);
      }catch(error){
        if(!same())return;
        if(error.message==='invalid_login'){passwordLabel.hidden=false;password.value='';note.textContent='선택한 사업장의 비밀번호를 입력해 주세요.';}
        else if(error.message==='assignment_changed')note.textContent='담당 사업장 설정이 변경되었습니다. 창을 닫고 다시 확인해 주세요.';
        else if(error.message==='device_cancelled')note.textContent='이메일 인증을 취소했습니다. 현재 사업장을 유지합니다.';
        else note.textContent='사업장을 변경하지 못했습니다. 현재 사업장을 유지합니다. 연결 상태를 확인하고 다시 시도해 주세요.';
      }finally{busy=false;form.inert=false;}
    };
    d.showModal();select.focus();
  }
  window.enlMountSiteSwitch=(user,menu)=>{
    if(user?.role!=='field'||!menu||menu.querySelector('[data-site-switch]'))return;
    const b=element('button','담당 사업장 변경');b.type='button';b.dataset.siteSwitch='';b.hidden=true;
    menu.insertBefore(b,menu.querySelector('#logoutBtn'));
    const same=()=>b.isConnected&&keyOf(currentUser())===keyOf(user);
    const refresh=async()=>{try{const sites=await list(user);if(!same())return;b.hidden=sites.length<2;b.onclick=()=>open(user,sites);}catch{if(same()){b.hidden=false;b.textContent='담당 사업장 다시 확인';b.onclick=refresh;}}};
    refresh();
  };
})();
