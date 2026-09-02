/* E&L Accident Report App v4.1.2 - privileged action security */
(function(){
  'use strict';
  const VERSION='4.1.2-r14';
  const CLIENT='incident-report-v2';
  const SITE_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-site-upsert-v412';
  const WORKFLOW_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-workflow-v412';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const txt=v=>String(v??'').trim();
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const actor=(u=currentUser?.())=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  let editingPersonnelId='';

  async function post(url,body,timeout=12000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }

  const baseIncidentApi=window.enlIncidentApi;
  if(typeof baseIncidentApi==='function'){
    window.enlIncidentApi=async function(body,timeout){
      const a=actor();
      if(body?.action!=='site_upsert'||a?.role!=='safety')return baseIncidentApi.apply(this,arguments);
      const pw=txt(document.getElementById('wf412SiteAdminPassword')?.value);
      const passwordHash=pw?await sha256(pw):'';
      try{return await post(SITE_API,{...body,actor:a,passwordHash},timeout||15000)}
      catch(e){
        if(e?.message==='password_required')alert('현장소장·파트장·서무를 지정하거나 변경하려면 안전관리자 본인 비밀번호를 입력해 주세요.');
        else if(e?.message==='invalid_password')alert('안전관리자 비밀번호가 맞지 않습니다.');
        throw e;
      }
    };
  }

  function secureSiteField(){
    const form=document.getElementById('admin411SiteForm');if(!form||form.querySelector('#wf412SiteAdminPassword'))return;
    const section=form.querySelectorAll('.admin411-section')[2]||form.querySelector('.admin411-section');if(!section)return;
    section.insertAdjacentHTML('beforeend','<label style="margin-top:9px"><span>관리자 지정·변경 확인 비밀번호</span><input id="wf412SiteAdminPassword" type="password" autocomplete="current-password" placeholder="소장·파트장·서무 지정 또는 변경 시 입력"><small style="display:block;margin-top:5px;color:#76899a;line-height:1.4">일반 현장정보만 수정할 때는 비워두셔도 됩니다. 현장관리자 지정·변경이 포함되면 서버에서 비밀번호를 확인합니다.</small></label>');
  }

  function securePersonnelField(){
    const form=document.getElementById('personnelForm411');if(!form)return;
    const select=document.getElementById('personPosition411');if(!select)return;
    if(!form.querySelector('#wf412FieldPwWrap')){
      const btn=form.querySelector('button[type="submit"]');
      const html='<label id="wf412FieldPwWrap" class="lbl" style="display:none;margin-top:9px"><span>관리자 지정 확인 비밀번호 *</span><input id="wf412FieldDesignationPw" type="password" inputmode="numeric" autocomplete="current-password" placeholder="현재 로그인 비밀번호"><small style="color:#76899a">현장소장·파트장·서무 권한 지정 시 현재 로그인한 현장관리자의 비밀번호를 다시 확인합니다.</small></label>';
      btn?.insertAdjacentHTML('beforebegin',html);
    }
    const sync=()=>{const wrap=document.getElementById('wf412FieldPwWrap'),needed=MANAGER_POSITIONS.includes(txt(select.value));if(wrap)wrap.style.display=needed?'grid':'none';if(!needed){const input=document.getElementById('wf412FieldDesignationPw');if(input)input.value=''}};
    if(select.dataset.wfSecurityBound!=='1'){select.dataset.wfSecurityBound='1';select.addEventListener('change',sync)}sync();
  }

  document.addEventListener('click',ev=>{const b=ev.target?.closest?.('[data-pe]');if(b)editingPersonnelId=txt(b.dataset.pe);if(ev.target?.closest?.('#personnelBtn411'))editingPersonnelId=''},true);

  document.addEventListener('submit',async ev=>{
    const form=ev.target;if(!(form instanceof HTMLFormElement)||form.id!=='personnelForm411')return;
    const position=txt(document.getElementById('personPosition411')?.value);if(!MANAGER_POSITIONS.includes(position))return;
    ev.preventDefault();ev.stopImmediatePropagation();
    const u=currentUser?.(),a=actor(u),name=txt(document.getElementById('personName411')?.value),pw=txt(document.getElementById('wf412FieldDesignationPw')?.value);
    if(!u||!a)return;if(!name)return alert('이름을 입력해 주세요.');if(!pw){document.getElementById('wf412FieldDesignationPw')?.focus();return alert('현장관리자 지정 확인을 위해 현재 로그인 비밀번호를 입력해 주세요.')}
    const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='비밀번호 확인 중…'}
    try{
      const passwordHash=await sha256(pw);
      await post(WORKFLOW_API,{action:'designate_manager',actor:a,passwordHash,siteId:u.siteId,person:{personnelId:editingPersonnelId||'',siteId:u.siteId,name,jobTitle:position,active:true}});
      editingPersonnelId='';alert('비밀번호 확인 후 현장관리자 지정이 완료되었습니다.');window.enlRenderPersonnelPage?.(u);
    }catch(e){
      alert(e?.message==='invalid_password'?'비밀번호가 맞지 않습니다.':e?.message==='manager_phone_required'?'해당 직책의 이름과 휴대폰 번호를 현장정보에 먼저 등록해 주세요.':'현장관리자 지정에 실패했습니다.');
    }finally{if(btn){btn.disabled=false;btn.textContent='저장'}}
  },true);

  const observer=new MutationObserver(()=>{secureSiteField();securePersonnelField()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  secureSiteField();securePersonnelField();
  window.ENL_SECURITY_VERSION=VERSION;
})();