/* E&L Accident Report App v4.1.2 - stable update controller */
(function(){
  'use strict';
  const META_URL='version.json',REDIRECT_GUARD_MS=30000;
  const CURRENT_BUILD=document.querySelector('meta[name="enl-build"]')?.content||'4.1.2-r17';
  const VERSION=String(CURRENT_BUILD).replace(/-r\d+$/,'');
  window.ENL_DEPLOY_VERSION=VERSION;window.ENL_STABLE_MODE=true;

  const currentEntry=()=>location.pathname.split('/').pop()||'index.html';
  const parts=v=>String(v||'0').split('.').map(x=>Number(x)||0);
  function compareVersion(a,b){const A=parts(a),B=parts(b),n=Math.max(A.length,B.length);for(let i=0;i<n;i++){const d=(A[i]||0)-(B[i]||0);if(d)return d>0?1:-1}return 0}
  function canonicalBuild(v){const m=String(v||'').match(/^(\d+)\.(\d+)\.(\d+)-r(\d+)$/);return m?`stable-${m[1]}${m[2]}${m[3]}-r${m[4]}`:String(v||'')}
  async function latestMeta(timeout=3500){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(`${META_URL}?_=${Date.now()}`,{cache:'no-store',signal:ctl.signal,headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw new Error(`meta_${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
  function newest(meta){const entry=String(meta?.stableEntry||'').trim(),ver=String(meta?.currentStableVersion||'latest').trim()||'latest',build=String(meta?.build||'').trim();return entry?{entry,ver,build}:null}
  function isNewerTarget(t){if(!t?.entry)return false;if(t.entry!==currentEntry())return true;if(t.build&&t.build!==canonicalBuild(CURRENT_BUILD))return true;return compareVersion(t.ver,VERSION)>0}

  function clearLoginForUpdate(){
    try{if(typeof window.enlClearRefreshSession==='function')window.enlClearRefreshSession();else{session=null;saveSession()}}catch(e){try{localStorage.removeItem('enl_safety_session_v3')}catch(_){} }
    try{currentView='';accountMenuOpen=false}catch(e){}
  }
  function redirect(t,force=false){
    if(!t?.entry)return false;const key='enl_login_latest_redirect',now=Date.now();
    try{const prev=JSON.parse(sessionStorage.getItem(key)||'null');if(!force&&prev&&prev.entry===t.entry&&prev.build===t.build&&now-Number(prev.at||0)<REDIRECT_GUARD_MS)return false;sessionStorage.setItem(key,JSON.stringify({entry:t.entry,ver:t.ver,build:t.build,at:now}))}catch(e){}
    const u=new URL(t.entry,location.href);u.searchParams.set('_latest',t.build||t.ver);u.searchParams.set('_ts',String(now));
    try{location.replace(u.toString())}catch(e){location.href=u.toString()}return true;
  }
  async function checkLatest(opts={}){
    const manual=!!opts.manual;
    const btn=document.getElementById('loginLatestBtn')||document.querySelector('.header-refresh-btn');
    if(manual){clearLoginForUpdate();if(btn){btn.disabled=true;btn.textContent='업데이트 중…'}}
    try{
      const meta=await latestMeta(),latest=newest(meta);if(!latest)return false;
      if(manual)return redirect(latest,true);
      if(isNewerTarget(latest)){clearLoginForUpdate();return redirect(latest,true)}
      return false;
    }catch(e){
      console.warn(manual?'manual latest version update fallback':'automatic version check skipped',e);
      if(manual){const u=new URL(location.href);u.searchParams.set('_refresh',String(Date.now()));try{location.replace(u.toString())}catch(_){location.reload()}return true}
      return false;
    }finally{
      if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='최신버전으로 업데이트'}
    }
  }
  window.enlForceLatestRefresh=()=>checkLatest({manual:true});window.enlCheckLatestVersion=checkLatest;

  function style(){if(document.getElementById('enlStableControlStyle410'))return;const s=document.createElement('style');s.id='enlStableControlStyle410';s.textContent=`
    .header-update-control{display:flex;align-items:center;gap:5px;margin-left:auto;margin-right:6px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#174d78;background:#eef8ff;border:1px solid #c9dfed;border-radius:999px;padding:6px 8px}.header-refresh-btn{border:1px solid #1e5d91;background:#fff;color:#174d78;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}.login-brand-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.login-brand-title-row h1{margin:0}.login-latest-btn{border:1.5px solid #1e5d91;background:#fff;color:#174d78;border-radius:9px;min-height:34px;padding:0 10px;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.login-latest-btn:disabled,.header-refresh-btn:disabled{opacity:.65;cursor:wait}@media(max-width:720px){.header-update-control{gap:3px;margin-right:2px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn{padding:6px 7px;font-size:9px}.login-brand-title-row{gap:6px}.login-latest-btn{min-height:32px;padding:0 8px;font-size:9px}}`;
    document.head.appendChild(s)
  }
  function injectHeader(){style();const top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!top||!user)return;let box=document.getElementById('headerUpdateControl');if(!box){box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';box.innerHTML=`<span class="header-version">v${VERSION}</span><button type="button" class="header-refresh-btn">최신버전으로 업데이트</button>`;top.insertBefore(box,user)}const version=box.querySelector('.header-version');if(version&&version.textContent!==`v${VERSION}`)version.textContent=`v${VERSION}`;const btn=box.querySelector('button');if(btn){btn.textContent='최신버전으로 업데이트';btn.onclick=window.enlForceLatestRefresh}}
  function injectLoginLatest(){style();const brand=document.querySelector('.login-brand');if(!brand)return;const wrap=brand.querySelector('.logo + div')||brand.querySelector('div:last-child'),h=wrap?.querySelector('h1');if(!wrap||!h)return;let row=wrap.querySelector('.login-brand-title-row');if(!row){row=document.createElement('div');row.className='login-brand-title-row';h.parentNode.insertBefore(row,h);row.appendChild(h)}let btn=document.getElementById('loginLatestBtn');if(!btn){btn=document.createElement('button');btn.type='button';btn.id='loginLatestBtn';btn.className='login-latest-btn';row.appendChild(btn)}btn.textContent='최신버전으로 업데이트';btn.onclick=window.enlForceLatestRefresh}
  function footer(){const f=document.querySelector('.footer-note');const text=`이앤엘 사고보고앱 v${VERSION}`;if(f&&f.textContent!==text)f.textContent=text}
  function refreshControls(){try{if(currentUser?.())injectHeader();else injectLoginLatest();footer()}catch(e){}}
  let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refreshControls()})});observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(refreshControls,0);
  setTimeout(()=>checkLatest({manual:false}),1200);
  window.ENL_UPDATE_CONTROL_VERSION=CURRENT_BUILD;
})();