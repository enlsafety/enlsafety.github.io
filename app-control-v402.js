/* E&L Accident Report App v4.0.2 - login auto update + manual latest button */
(function(){
  const VERSION='4.0.2';
  const META_URL='version.json';
  const CHECK_INTERVAL=60000;
  const REDIRECT_GUARD_MS=30000;
  window.ENL_DEPLOY_VERSION=VERSION;
  window.ENL_STABLE_MODE=true;
  function currentEntry(){return location.pathname.split('/').pop()||'index.html'}
  async function latestMeta(timeout=3500){
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);
    try{const r=await fetch(`${META_URL}?_=${Date.now()}`,{cache:'no-store',signal:ctl.signal,headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw new Error(`meta_${r.status}`);return await r.json()}finally{clearTimeout(timer)}
  }
  function newest(meta){const entry=String(meta?.stableEntry||'').trim();const ver=String(meta?.currentStableVersion||'latest').trim()||'latest';return entry?{entry,ver}:null}
  function newerTarget(meta){const target=newest(meta);if(!target)return null;if(target.entry===currentEntry()&&target.ver===VERSION)return null;return target}
  function guardedRedirect(target,force=false){
    if(!target?.entry)return false;const key='enl_login_latest_redirect',now=Date.now();
    try{const prev=JSON.parse(sessionStorage.getItem(key)||'null');if(!force&&prev&&prev.entry===target.entry&&prev.ver===target.ver&&now-Number(prev.at||0)<REDIRECT_GUARD_MS)return false;sessionStorage.setItem(key,JSON.stringify({entry:target.entry,ver:target.ver,at:now}))}catch(e){}
    const u=new URL(target.entry,location.href);u.searchParams.set('_latest',target.ver);u.searchParams.set('_ts',String(now));try{location.replace(u.toString())}catch(e){location.href=u.toString()}return true
  }
  async function checkLatest(opts={}){
    const manual=!!opts.manual;if(!manual&&!document.querySelector('.login-card'))return false;const btn=document.getElementById('loginLatestBtn');if(btn&&manual){btn.disabled=true;btn.textContent='최신화 중…'}
    try{const meta=await latestMeta();const target=newerTarget(meta);if(target)return guardedRedirect(target,manual);if(manual){const latest=newest(meta);if(latest)return guardedRedirect(latest,true)}return false}
    catch(e){console.warn('latest version check skipped',e);if(manual){const fallback=new URL(location.href);fallback.searchParams.set('_refresh',String(Date.now()));try{location.replace(fallback.toString())}catch(_){location.reload()}}return false}
    finally{if(btn&&manual&&btn.isConnected){btn.disabled=false;btn.textContent='최신버전'}}
  }
  function refreshNow(){checkLatest({manual:true})}
  window.enlForceLatestRefresh=refreshNow;window.enlCheckLatestVersion=checkLatest;
  function style(){
    if(document.getElementById('enlStableControlStyle'))return;const s=document.createElement('style');s.id='enlStableControlStyle';s.textContent=`
      .header-update-control{display:flex;align-items:center;gap:5px;margin-left:auto;margin-right:6px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#173b66;background:#eef4fb;border:1px solid #d4dfec;border-radius:999px;padding:6px 8px}.header-refresh-btn{border:1px solid #173b66;background:#fff;color:#173b66;border-radius:9px;padding:7px 9px;font-weight:800;cursor:pointer}.site-row400 a{pointer-events:none;color:inherit;text-decoration:none}.login-brand-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.login-brand-title-row h1{margin:0}.login-latest-btn{border:1.5px solid #173b66;background:#fff;color:#173b66;border-radius:9px;min-height:32px;padding:0 10px;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.login-latest-btn:disabled{opacity:.65;cursor:wait}@media(max-width:720px){.header-update-control{gap:3px;margin-right:2px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn{padding:6px 7px;font-size:10px}.login-brand-title-row{gap:6px}.login-latest-btn{min-height:30px;padding:0 8px;font-size:10px}}`;
    document.head.appendChild(s)
  }
  function injectHeader(){style();const top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!top||!user)return;document.getElementById('headerUpdateControl')?.remove();const box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';box.innerHTML=`<span class="header-version">v${VERSION}</span><button type="button" class="header-refresh-btn">최신화</button>`;top.insertBefore(box,user);box.querySelector('button').onclick=refreshNow}
  function injectLoginLatest(){style();const brand=document.querySelector('.login-brand');if(!brand)return;const textWrap=brand.querySelector('.logo + div')||brand.querySelector('div:last-child');if(!textWrap)return;const h=textWrap.querySelector('h1');if(!h)return;let row=textWrap.querySelector('.login-brand-title-row');if(!row){row=document.createElement('div');row.className='login-brand-title-row';h.parentNode.insertBefore(row,h);row.appendChild(h)}let btn=document.getElementById('loginLatestBtn');if(!btn){btn=document.createElement('button');btn.type='button';btn.id='loginLatestBtn';btn.className='login-latest-btn';btn.textContent='최신버전';row.appendChild(btn)}btn.onclick=()=>checkLatest({manual:true})}
  function footer(){const f=document.querySelector('.footer-note');if(f)f.textContent=`이앤엘 사고보고앱 v${VERSION}`}
  function afterLoginRender(){setTimeout(()=>{injectLoginLatest();footer();checkLatest({manual:false})},0)}
  if(typeof renderShell==='function'){const baseShell=renderShell;renderShell=function(u){const r=baseShell(u);setTimeout(()=>{injectHeader();footer()},0);return r}}
  if(typeof renderLogin==='function'){const baseLogin=renderLogin;renderLogin=function(){const r=baseLogin.apply(this,arguments);afterLoginRender();return r}}
  setTimeout(()=>{try{if(currentUser?.())injectHeader();else{injectLoginLatest();checkLatest({manual:false})}footer()}catch(e){}},0);
  setTimeout(()=>{try{const u=currentUser?.();if(u?.role==='safety'&&typeof enlPlatformSection!=='undefined'&&enlPlatformSection==='admin'&&typeof renderShell==='function')renderShell(u)}catch(e){console.warn('v4 admin refresh skipped',e)}},120);
  setInterval(()=>{if(document.visibilityState==='visible'&&document.querySelector('.login-card'))checkLatest({manual:false})},CHECK_INTERVAL);
  window.addEventListener('focus',()=>{if(document.querySelector('.login-card'))checkLatest({manual:false})});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.querySelector('.login-card'))checkLatest({manual:false})});
})();
