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
  function versionParts(v){return String(v||'0').split('.').map(x=>parseInt(x,10)||0)}
  function versionOlder(a,b){
    const aa=versionParts(a),bb=versionParts(b),n=Math.max(aa.length,bb.length);
    for(let i=0;i<n;i++){const av=aa[i]||0,bv=bb[i]||0;if(av<bv)return true;if(av>bv)return false}
    return false;
  }
  function newest(meta){
    const ver=String(meta?.currentStableVersion||''),build=String(meta?.build||'');
    if(!/^\d+\.\d+\.\d+$/.test(ver)||!/^stable-\d+-r\d+$/.test(build)||build.split('-')[1]!==ver.replace(/\./g,'')||meta.stableEntry!=='stable412.html')throw new Error('invalid_version_metadata');
    return {entry:'stable412.html',build,ver};
  }
  function isNewer(target){
    if(target.ver!==VERSION)return versionOlder(VERSION,target.ver);
    return Number(target.build.split('-r').pop())>Number(CURRENT_BUILD.split('-r').pop());
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
  let checkingGlobal=false,checkedEpoch=null,pendingUpdate=null,deferredBuild='';
  function updateBusy(){
    return document.visibilityState==='hidden'||!!document.querySelector('#unifiedReportForm,#reportForm,.modal,dialog[open]')||
      !!window.enlUiModalBusy?.()||!!window.enlIncidentHasUnsavedChanges?.();
  }
  function refreshUpdateNotice(){
    const existing=document.getElementById('enlUpdateNotice');
    if(!pendingUpdate||!currentUser?.()||updateBusy()||deferredBuild===pendingUpdate.build){existing?.remove();return}
    if(existing)return;
    const panel=document.createElement('aside');panel.id='enlUpdateNotice';panel.setAttribute('aria-label','앱 업데이트');
    panel.innerHTML='<strong role="status">새 버전이 있습니다</strong><p>로그인은 유지됩니다. 지금 업데이트하면 현재 화면을 다시 엽니다.</p><div><button type="button" data-update-later>나중에</button><button type="button" data-update-now>지금 업데이트</button></div>';
    panel.querySelector('[data-update-later]').onclick=()=>{deferredBuild=pendingUpdate.build;panel.remove();refreshControls()};
    panel.querySelector('[data-update-now]').onclick=()=>{
      if(!currentUser?.()||updateBusy()){refreshUpdateNotice();return}
      window.enlSaveBackgroundState?.();goLatest(pendingUpdate);
    };
    document.body.appendChild(panel);
  }
  async function checkGlobalControl(){
    if(checkingGlobal||!currentUser?.()||document.visibilityState==='hidden')return false;
    checkingGlobal=true;
    try{
      const r=await globalCall('GET'),epoch=Number(r.epoch);
      if(!Number.isSafeInteger(epoch)||epoch<=0||epoch<readEpoch())return false;
      if(epoch!==checkedEpoch){
        const target=newest(await latestMeta());
        if(!currentUser?.()||epoch<readEpoch())return false;
        // Recheck metadata on the next poll if publication and its signal differ.
        if(target.build===r.version)checkedEpoch=epoch;
        pendingUpdate=isNewer(target)?target:null;saveEpoch(epoch);
      }
      refreshUpdateNotice();return !!pendingUpdate;
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
    if(!confirm('전체 사용자에게 최신 버전 업데이트를 요청할까요?'))return false;
    const pw=prompt('전체 업데이트 권한 확인을 위해 안전관리자 로그인 비밀번호를 입력해 주세요.');if(!pw)return false;
    const btn=document.querySelector('[data-enl-global-update]');if(btn){btn.disabled=true;btn.textContent='전체 업데이트 중…'}
    try{
      const target=newest(await latestMeta());
      const r=await globalCall('POST',{action:'global-refresh',actor:a,passwordHash:await sha256(pw),version:target.build});
      saveEpoch(r.epoch);pendingUpdate=isNewer(target)?target:null;deferredBuild='';refreshUpdateNotice();
      if(!pendingUpdate)alert('업데이트를 요청했습니다. 이 기기는 이미 최신 버전입니다.');return true;
    }catch(e){
      const m=String(e?.message||'');
      alert(m==='invalid_password'
        ?'안전관리자 비밀번호가 맞지 않습니다.'
        :(m==='server_error'||m.startsWith('global_http_5'))
          ?'전체 업데이트 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
          :'전체 업데이트 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
      return false;
    }finally{if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=UPDATE_LABEL}}
  }
  window.enlForceLatestRefresh=safetyGlobalUpdate;
  window.enlRefreshDataNow=refreshData;
  window.enlCheckGlobalUpdate=checkGlobalControl;
  window.enlCheckLatestVersion=()=>Promise.resolve(false);

  function style(){if(document.getElementById('enlStableControlStyle410'))return;const s=document.createElement('style');s.id='enlStableControlStyle410';s.textContent=`
    #enlUpdateNotice{position:fixed;z-index:1000;right:12px;bottom:max(12px,env(safe-area-inset-bottom));width:min(340px,calc(100% - 24px));box-sizing:border-box;padding:16px;border:1px solid #adc2d0;border-radius:12px;background:white;color:#142f45;box-shadow:0 4px 24px #18324c33}#enlUpdateNotice p{margin:6px 0 12px;line-height:1.45}#enlUpdateNotice div{display:flex;justify-content:flex-end;gap:8px}#enlUpdateNotice button{padding:9px 12px;border:1px solid #9fb5c7;border-radius:8px;background:white;color:#173e60}#enlUpdateNotice [data-update-now]{background:#174d78;color:white}
    html,body{overscroll-behavior-y:none}.header-update-control{display:flex;align-items:center;gap:5px;margin-left:auto;margin-right:6px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#174d78;background:#eef8ff;border:1px solid #c9dfed;border-radius:999px;padding:6px 8px}.header-refresh-btn,.header-global-update-btn{border:1px solid #1e5d91;background:#fff;color:#174d78;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}.header-global-update-btn{background:#1e5d91;color:#fff}.header-refresh-btn:disabled,.header-global-update-btn:disabled{opacity:.65;cursor:wait}@media(max-width:720px){.header-update-control{gap:3px;margin-right:2px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn,.header-global-update-btn{padding:6px 7px;font-size:9px}}`;
    document.head.appendChild(s)
  }
  function injectHeader(){
    style();
    const u=currentUser?.(),top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!u||!top||!user)return;
    const safety=roleNorm(u.role)==='safety';let box=document.getElementById('headerUpdateControl');
    if(!box){box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';top.insertBefore(box,user)}
    const postponed=pendingUpdate&&deferredBuild===pendingUpdate.build;
    const versionLabel=postponed?'<button type="button" class="header-refresh-btn" data-resume-update>새 버전</button>':`<span class="header-version">v${VERSION}</span>`;
    const wanted=`${versionLabel}<button type="button" class="header-refresh-btn" data-enl-refresh>${REFRESH_LABEL}</button>${safety?`<button type="button" class="header-global-update-btn" data-enl-global-update>${UPDATE_LABEL}</button>`:''}`;
    const mode=[safety,!!postponed].join('/');
    if(box.dataset.mode!==mode){box.innerHTML=wanted;box.dataset.mode=mode}
    const resume=box.querySelector('[data-resume-update]');if(resume)resume.onclick=()=>{deferredBuild='';refreshControls()};
    const refresh=box.querySelector('[data-enl-refresh]');if(refresh)refresh.onclick=refreshData;
    const update=box.querySelector('[data-enl-global-update]');if(update)update.onclick=safetyGlobalUpdate;
  }
  function removeLoginUpdate(){document.getElementById('loginLatestBtn')?.remove()}
  function footer(){const f=document.querySelector('.footer-note');const text=`이앤엘 사고보고앱 v${VERSION}`;if(f&&f.textContent!==text)f.textContent=text}
  function refreshControls(){try{removeLoginUpdate();if(currentUser?.())injectHeader();else document.getElementById('headerUpdateControl')?.remove();footer();refreshUpdateNotice()}catch(e){console.warn('update control render skipped',e)}}
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refreshControls()})});
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

  let foregroundControlTimer=null;
  function scheduleForegroundControl(delay=100){
    if(foregroundControlTimer)clearTimeout(foregroundControlTimer);
    foregroundControlTimer=setTimeout(()=>{foregroundControlTimer=null;refreshControls();checkGlobalControl()},delay);
  }
  scheduleForegroundControl(2600);
  setInterval(checkGlobalControl,CONTROL_POLL_MS);
  window.addEventListener('pageshow',()=>scheduleForegroundControl(100));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleForegroundControl(100)});
  window.ENL_UPDATE_CONTROL_VERSION=`${CURRENT_BUILD}-session-continuity`;
})();