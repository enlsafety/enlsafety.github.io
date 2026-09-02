/* E&L Accident Report App v4.1.2 - stable update controller */
(function(){
  'use strict';
  const META_URL='version.json';
  const BUILD_KEY='enl_last_loaded_build_v412';
  const CURRENT_BUILD=document.querySelector('meta[name="enl-build"]')?.content||'4.1.2-r16';
  const VERSION=String(CURRENT_BUILD).replace(/-r\d+$/,'');
  window.ENL_DEPLOY_VERSION=VERSION;window.ENL_STABLE_MODE=true;

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
  function clearLoginForUpdate(){
    try{session=null;if(typeof saveSession==='function')saveSession()}catch(e){try{localStorage.removeItem('enl_safety_session_v3')}catch(_){} }
    try{localStorage.removeItem('enl_safety_session_refresh_v412')}catch(e){}
    try{document.cookie='enl_safety_session_refresh_v412=; Path=/; Max-Age=0; SameSite=Lax; Secure'}catch(e){}
    try{currentView='';accountMenuOpen=false}catch(e){}
  }
  function markBuildAndClearOnlyOnRealBuildChange(){
    try{
      const prev=localStorage.getItem(BUILD_KEY)||'';
      if(prev&&prev!==CURRENT_BUILD)clearLoginForUpdate();
      localStorage.setItem(BUILD_KEY,CURRENT_BUILD);
    }catch(e){}
  }
  markBuildAndClearOnlyOnRealBuildChange();

  function goLatest(t){
    const now=Date.now(),u=new URL(t.entry,location.href);
    u.searchParams.set('_latest',t.build||t.ver||CURRENT_BUILD);
    u.searchParams.set('_ts',String(now));
    try{location.replace(u.toString())}catch(e){location.href=u.toString()}
  }
  async function manualUpdate(){
    const btn=document.getElementById('loginLatestBtn')||document.querySelector('.header-refresh-btn');
    if(btn){btn.disabled=true;btn.textContent='업데이트 중…'}
    clearLoginForUpdate();
    try{
      const meta=await latestMeta();
      goLatest(newest(meta));
      return true;
    }catch(e){
      console.warn('manual latest version update fallback',e);
      const u=new URL(location.href);u.searchParams.set('_refresh',String(Date.now()));
      try{location.replace(u.toString())}catch(_){location.reload()}
      return true;
    }finally{
      if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='최신버전으로 업데이트'}
    }
  }
  window.enlForceLatestRefresh=manualUpdate;
  window.enlCheckLatestVersion=()=>Promise.resolve(false);

  function style(){if(document.getElementById('enlStableControlStyle410'))return;const s=document.createElement('style');s.id='enlStableControlStyle410';s.textContent=`
    html,body{overscroll-behavior-y:none}.header-update-control{display:flex;align-items:center;gap:5px;margin-left:auto;margin-right:6px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#174d78;background:#eef8ff;border:1px solid #c9dfed;border-radius:999px;padding:6px 8px}.header-refresh-btn{border:1px solid #1e5d91;background:#fff;color:#174d78;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}.login-brand-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.login-brand-title-row h1{margin:0}.login-latest-btn{border:1.5px solid #1e5d91;background:#fff;color:#174d78;border-radius:9px;min-height:34px;padding:0 10px;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.login-latest-btn:disabled,.header-refresh-btn:disabled{opacity:.65;cursor:wait}@media(max-width:720px){.header-update-control{gap:3px;margin-right:2px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn{padding:6px 7px;font-size:9px}.login-brand-title-row{gap:6px}.login-latest-btn{min-height:32px;padding:0 8px;font-size:9px}}`;
    document.head.appendChild(s)
  }
  function injectHeader(){style();const top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!top||!user)return;let box=document.getElementById('headerUpdateControl');if(!box){box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';box.innerHTML=`<span class="header-version">v${VERSION}</span><button type="button" class="header-refresh-btn">최신버전으로 업데이트</button>`;top.insertBefore(box,user)}const version=box.querySelector('.header-version');if(version&&version.textContent!==`v${VERSION}`)version.textContent=`v${VERSION}`;const btn=box.querySelector('button');if(btn){btn.textContent='최신버전으로 업데이트';btn.onclick=manualUpdate}}
  function injectLoginLatest(){style();const brand=document.querySelector('.login-brand');if(!brand)return;const wrap=brand.querySelector('.logo + div')||brand.querySelector('div:last-child'),h=wrap?.querySelector('h1');if(!wrap||!h)return;let row=wrap.querySelector('.login-brand-title-row');if(!row){row=document.createElement('div');row.className='login-brand-title-row';h.parentNode.insertBefore(row,h);row.appendChild(h)}let btn=document.getElementById('loginLatestBtn');if(!btn){btn=document.createElement('button');btn.type='button';btn.id='loginLatestBtn';btn.className='login-latest-btn';row.appendChild(btn)}btn.textContent='최신버전으로 업데이트';btn.onclick=manualUpdate}
  function footer(){const f=document.querySelector('.footer-note');const text=`이앤엘 사고보고앱 v${VERSION}`;if(f&&f.textContent!==text)f.textContent=text}
  function refreshControls(){try{if(currentUser?.())injectHeader();else injectLoginLatest();footer()}catch(e){}}
  let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refreshControls()})});observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(refreshControls,0);
  window.ENL_UPDATE_CONTROL_VERSION=CURRENT_BUILD;
})();