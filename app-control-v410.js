/* E&L Accident Report App v4.1.2 - role-aware refresh and global update controller */
(function(){
  'use strict';
  const META_URL='version.json';
  const GLOBAL_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-global-refresh';
  const CLIENT='incident-report-v2';
  const BUILD_KEY='enl_last_loaded_build_v412';
  const CONTROL_KEY='enl_global_update_epoch_v415';
  const CURRENT_BUILD=document.querySelector('meta[name="enl-build"]')?.content||'4.1.2-r16';
  const VERSION=String(CURRENT_BUILD).replace(/-r\d+$/,'');
  const UPDATE_LABEL='최신버전으로 업데이트';
  const REFRESH_LABEL='새로고침';
  const CONTROL_POLL_MS=60000;
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  window.ENL_DEPLOY_VERSION=VERSION;window.ENL_STABLE_MODE=true;

  function actor(u=currentUser?.()){
    return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  }
  async function sha256(text){
    const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||'')));
    return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function latestMeta(timeout=3500){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(`${META_URL}?_=${Date.now()}`,{cache:'no-store',signal:ctl?.signal,headers:{'Cache-Control':'no-cache'}});
      if(!r.ok)throw new Error(`meta_${r.status}`);
      return await r.json();
    }finally{if(timer)clearTimeout(timer)}
  }
  function newest(meta){
    const entry=String(meta?.stableEntry||'stable412.html').trim()||'stable412.html';
    const build=String(meta?.build||CURRENT_BUILD).trim()||CURRENT_BUILD;
    const ver=String(meta?.currentStableVersion||VERSION).trim()||VERSION;
    return {entry,build,ver};
  }
  function clearLoginForUpdate(reason='manual_update'){
    let clearedBySessionModule=false;
    try{
      if(typeof window.enlClearRefreshSession==='function'){
        window.enlClearRefreshSession(reason);
        clearedBySessionModule=true;
      }
    }catch(e){}
    if(!clearedBySessionModule){
      try{session=null;if(typeof saveSession==='function')saveSession()}catch(e){try{localStorage.removeItem('enl_safety_session_v3')}catch(_){} }
      try{localStorage.removeItem('enl_safety_session_refresh_v412')}catch(e){}
      try{localStorage.removeItem('enl_safety_view_refresh_v412')}catch(e){}
      try{localStorage.removeItem('enl_safety_report_draft_v412')}catch(e){}
      try{document.cookie='enl_safety_session_refresh_v412=; Path=/; Max-Age=0; SameSite=Lax; Secure'}catch(e){}
    }
    try{currentView='';accountMenuOpen=false}catch(e){}
  }
  function rememberCurrentBuild(){try{localStorage.setItem(BUILD_KEY,CURRENT_BUILD)}catch(e){}}
  function readEpoch(){try{return Number(localStorage.getItem(CONTROL_KEY)||0)||0}catch(e){return 0}}
  function saveEpoch(v){try{localStorage.setItem(CONTROL_KEY,String(Number(v)||0))}catch(e){}}
  rememberCurrentBuild();

  function goLatest(t){
    const now=Date.now(),u=new URL(t.entry,location.href);
    u.searchParams.set('_latest',t.build||t.ver||CURRENT_BUILD);
    u.searchParams.set('_ts',String(now));
    try{location.replace(u.toString())}catch(e){location.href=u.toString()}
  }
  async function globalCall(method='GET',body=null,timeout=7000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(`${GLOBAL_API}${method==='GET'?`?_=${Date.now()}`:''}`,{method,headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:ctl?.signal});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`global_http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }
  let applyingGlobal=false,checkingGlobal=false;
  async function applyGlobalUpdate(control){
    if(applyingGlobal)return;applyingGlobal=true;
    saveEpoch(control?.epoch);
    clearLoginForUpdate('global_update');
    let target={entry:'stable412.html',build:String(control?.version||CURRENT_BUILD),ver:VERSION};
    try{target=newest(await latestMeta())}catch(e){}
    goLatest(target);
  }
  async function checkGlobalControl(){
    if(checkingGlobal||applyingGlobal||!currentUser?.()||document.visibilityState==='hidden')return false;
    checkingGlobal=true;
    try{
      const r=await globalCall('GET');const epoch=Number(r.epoch||0)||0,seen=readEpoch();
      if(!seen){saveEpoch(epoch);return false}
      if(epoch>seen){await applyGlobalUpdate(r);return true}
      if(epoch<seen)saveEpoch(epoch);
      return false;
    }catch(e){return false}finally{checkingGlobal=false}
  }

  async function refreshWorkflowNow(){
    const u=currentUser?.(),a=actor(u);if(!u||!a)return;
    const inquiryOpen=!!document.getElementById('wf412InquiryList');
    if(inquiryOpen&&typeof window.enlRenderSafetyInquiry==='function'){
      try{await window.enlRenderSafetyInquiry('');return}catch(e){}
    }
    if(a.role==='safety'&&typeof window.enlWorkflowApi==='function'){
      try{
        const r=await window.enlWorkflowApi({action:'inquiry_count',actor:a}),n=Number(r?.count||0),b=document.querySelector('[data-wf-inquiry-nav]');
        if(b)b.innerHTML=`문의함${n>0?` <span class="wf412-nav-badge">${n>99?'99+':n}</span>`:''}`;
      }catch(e){}
    }
  }
  let refreshing=false;
  async function refreshData(){
    if(refreshing||!currentUser?.())return false;refreshing=true;
    const buttons=[...document.querySelectorAll('[data-enl-refresh]')];buttons.forEach(b=>{b.disabled=true;b.textContent='갱신 중…'});
    try{
      if(typeof window.enlIncidentSyncNow==='function')await window.enlIncidentSyncNow();
      await refreshWorkflowNow();
      try{window.renderShell?.(currentUser?.())}catch(e){}
      return true;
    }catch(e){console.warn('data refresh skipped',e);return false}
    finally{refreshing=false;buttons.forEach(b=>{if(b.isConnected){b.disabled=false;b.textContent=REFRESH_LABEL}})}
  }

  async function safetyGlobalUpdate(){
    const u=currentUser?.(),a=actor(u);if(!u||a?.role!=='safety'){alert('최신버전 전체 업데이트는 안전관리자만 실행할 수 있습니다.');return false}
    if(!confirm('전체 사용자를 로그아웃하고 최신 버전으로 업데이트할까요?\n현재 접속 중인 사용자는 자동으로 새 버전을 적용한 뒤 로그인 화면으로 이동합니다.'))return false;
    const pw=prompt('전체 업데이트 권한 확인을 위해 안전관리자 로그인 비밀번호를 입력해 주세요.');if(!pw)return false;
    const btn=document.querySelector('[data-enl-global-update]');if(btn){btn.disabled=true;btn.textContent='전체 업데이트 중…'}
    try{
      let target={entry:'stable412.html',build:CURRENT_BUILD,ver:VERSION};try{target=newest(await latestMeta())}catch(e){}
      const r=await globalCall('POST',{action:'global-refresh',actor:a,passwordHash:await sha256(pw),version:target.build});
      saveEpoch(r.epoch);clearLoginForUpdate('manual_global_update');goLatest(target);return true;
    }catch(e){
      alert(e?.message==='invalid_password'?'안전관리자 비밀번호가 맞지 않습니다.':'전체 업데이트를 시작하지 못했습니다. 네트워크 상태를 확인해 주세요.');return false;
    }finally{if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=UPDATE_LABEL}}
  }
  window.enlForceLatestRefresh=safetyGlobalUpdate;
  window.enlRefreshDataNow=refreshData;
  window.enlCheckGlobalUpdate=checkGlobalControl;
  window.enlCheckLatestVersion=()=>Promise.resolve(false);

  function style(){if(document.getElementById('enlStableControlStyle410'))return;const s=document.createElement('style');s.id='enlStableControlStyle410';s.textContent=`
    html,body{overscroll-behavior-y:none}.header-update-control{display:flex;align-items:center;gap:5px;margin-left:auto;margin-right:6px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#174d78;background:#eef8ff;border:1px solid #c9dfed;border-radius:999px;padding:6px 8px}.header-refresh-btn,.header-global-update-btn{border:1px solid #1e5d91;background:#fff;color:#174d78;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}.header-global-update-btn{background:#1e5d91;color:#fff}.header-refresh-btn:disabled,.header-global-update-btn:disabled{opacity:.65;cursor:wait}@media(max-width:720px){.header-update-control{gap:3px;margin-right:2px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn,.header-global-update-btn{padding:6px 7px;font-size:9px}}`;
    document.head.appendChild(s)
  }
  function injectHeader(){
    style();
    const u=currentUser?.(),top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!u||!top||!user)return;
    const safety=roleNorm(u.role)==='safety';let box=document.getElementById('headerUpdateControl');
    if(!box){box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';top.insertBefore(box,user)}
    const wanted=`<span class="header-version">v${VERSION}</span><button type="button" class="header-refresh-btn" data-enl-refresh>${REFRESH_LABEL}</button>${safety?`<button type="button" class="header-global-update-btn" data-enl-global-update>${UPDATE_LABEL}</button>`:''}`;
    if(box.dataset.mode!==(safety?'safety':'user')){box.innerHTML=wanted;box.dataset.mode=safety?'safety':'user'}
    const refresh=box.querySelector('[data-enl-refresh]');if(refresh)refresh.onclick=refreshData;
    const update=box.querySelector('[data-enl-global-update]');if(update)update.onclick=safetyGlobalUpdate;
  }
  function removeLoginUpdate(){document.getElementById('loginLatestBtn')?.remove()}
  function footer(){const f=document.querySelector('.footer-note');const text=`이앤엘 사고보고앱 v${VERSION}`;if(f&&f.textContent!==text)f.textContent=text}
  function refreshControls(){try{removeLoginUpdate();if(currentUser?.())injectHeader();else document.getElementById('headerUpdateControl')?.remove();footer()}catch(e){console.warn('update control render skipped',e)}}
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refreshControls()})});
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

  let foregroundControlTimer=null;
  function scheduleForegroundControl(delay=100){
    if(foregroundControlTimer)clearTimeout(foregroundControlTimer);
    foregroundControlTimer=setTimeout(()=>{foregroundControlTimer=null;refreshControls();checkGlobalControl()},delay);
  }
  scheduleForegroundControl(500);
  setInterval(checkGlobalControl,CONTROL_POLL_MS);
  window.addEventListener('pageshow',()=>scheduleForegroundControl(100));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleForegroundControl(100)});
  window.ENL_UPDATE_CONTROL_VERSION=`${CURRENT_BUILD}-update6`;
})();