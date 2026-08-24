/* E&L Accident Report App v3.8.0 - Kakao-safe controller: no automatic reload loop */
(function(){
  const VERSION='3.8.0';
  window.ENL_DEPLOY_VERSION=VERSION;
  window.ENL_STABLE_MODE=true;

  function stableUrl(){
    const u=new URL('stable.html',location.href);
    u.searchParams.set('_ts',String(Date.now()));
    u.searchParams.set('v',VERSION);
    return u.toString();
  }
  function refreshNow(){
    try{location.replace(stableUrl())}catch(e){location.href='stable.html? v='+encodeURIComponent(VERSION)}
  }
  window.enlForceLatestRefresh=refreshNow;

  function style(){
    if(document.getElementById('enlStableControlStyle'))return;
    const s=document.createElement('style');
    s.id='enlStableControlStyle';
    s.textContent=`.header-update-control{display:flex;align-items:center;gap:5px;margin-left:auto;margin-right:6px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#173b66;background:#eef4fb;border:1px solid #d4dfec;border-radius:999px;padding:6px 8px}.header-refresh-btn,.app-refresh-btn{border:1px solid #173b66;background:#fff;color:#173b66;border-radius:9px;padding:7px 9px;font-weight:800;cursor:pointer}.login-update-box{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:#f3f6fa;font-size:12px;color:#5d6d80}@media(max-width:720px){.header-update-control{gap:3px;margin-right:2px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn{padding:6px 7px;font-size:10px}}`;
    document.head.appendChild(s);
  }
  function injectHeader(){
    style();
    const top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');
    if(!top||!user)return;
    document.getElementById('headerUpdateControl')?.remove();
    const box=document.createElement('div');
    box.id='headerUpdateControl';box.className='header-update-control';
    box.innerHTML=`<span class="header-version">v${VERSION}</span><button type="button" class="header-refresh-btn">새로고침</button>`;
    top.insertBefore(box,user);
    box.querySelector('button').onclick=refreshNow;
  }
  function injectLogin(){
    style();
    const card=document.querySelector('.login-card');if(!card)return;
    document.getElementById('loginRefreshBox')?.remove();
    const box=document.createElement('div');box.id='loginRefreshBox';box.className='login-update-box';
    box.innerHTML=`<span>앱 버전 <b>v${VERSION}</b></span><button type="button" class="app-refresh-btn">새로고침</button>`;
    card.appendChild(box);box.querySelector('button').onclick=refreshNow;
  }
  function updateFooter(){
    const f=document.querySelector('.footer-note');if(f)f.textContent=`이앤엘 사고보고앱 v${VERSION} · TEST MODE`;
  }

  if(typeof renderShell==='function'){
    const base=renderShell;
    renderShell=function(u){const r=base(u);injectHeader();updateFooter();return r};
  }
  if(typeof renderLogin==='function'){
    const base=renderLogin;
    renderLogin=function(){const r=base();injectLogin();return r};
  }

  // No version.json polling, no automatic location.replace, no cache deletion on startup.
  setTimeout(()=>{try{const u=currentUser();if(u)injectHeader();else injectLogin();updateFooter()}catch(e){}},0);
})();
