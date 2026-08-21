/* E&L Safety Communication v3.6.1 - robust app version/refresh control */
const ENL_DEPLOY_VERSION='3.6.1';
const ENL_VERSION_KEY='enl_safety_loaded_version';
const ENL_REMOTE_VERSION_KEY='enl_safety_remote_version';
const ENL_GLOBAL_EPOCH_KEY='enl_safety_global_epoch';
const ENL_GLOBAL_REFRESH_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-global-refresh';

async function enlDeleteBrowserCaches(){
  try{if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){console.warn('cache clear skipped',e)}
  try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}}catch(e){console.warn('service worker clear skipped',e)}
}
async function enlFetchRemoteVersion(){
  try{
    const r=await fetch(`version.json?ts=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
    if(!r.ok)return '';
    const j=await r.json();return String(j.version||'').trim();
  }catch(e){console.warn('version check skipped',e);return ''}
}
function enlReloadWithVersion(version=ENL_DEPLOY_VERSION){
  const url=new URL(window.location.href);
  url.searchParams.set('appv',String(version||ENL_DEPLOY_VERSION));
  url.searchParams.set('_reload',String(Date.now()));
  window.location.assign(url.toString());
}
function enlLogoutThisClient(){session=null;try{localStorage.removeItem(SESSION_KEY)}catch(e){}currentView='';accountMenuOpen=false}
async function enlHardRefresh(){
  const buttons=[...document.querySelectorAll('#appRefreshBtn,#loginRefreshBtn')];
  buttons.forEach(b=>{b.disabled=true;b.textContent='최신버전 확인 중…'});
  const remote=await enlFetchRemoteVersion();
  const target=remote||ENL_DEPLOY_VERSION;
  await enlDeleteBrowserCaches();
  try{localStorage.setItem(ENL_VERSION_KEY,target);localStorage.setItem(ENL_REMOTE_VERSION_KEY,target)}catch(e){}
  enlReloadWithVersion(target);
}
function enlMarkRemoteVersion(v){
  try{localStorage.setItem(ENL_REMOTE_VERSION_KEY,v||'')}catch(e){}
  const label=document.getElementById('appVersionLabel');
  const btn=document.getElementById('appRefreshBtn');
  const loginLabel=document.getElementById('loginVersionLabel');
  const loginBtn=document.getElementById('loginRefreshBtn');
  const hasNew=!!v&&v!==ENL_DEPLOY_VERSION;
  if(label)label.textContent=hasNew?`v${ENL_DEPLOY_VERSION} → v${v}`:`v${ENL_DEPLOY_VERSION}`;
  if(loginLabel)loginLabel.textContent=hasNew?`v${ENL_DEPLOY_VERSION} → v${v}`:`v${ENL_DEPLOY_VERSION}`;
  if(btn){btn.textContent=hasNew?'새 버전 적용':'새로고침';btn.classList.toggle('update-ready',hasNew);btn.disabled=false}
  if(loginBtn){loginBtn.textContent=hasNew?'새 버전 적용':'새로고침';loginBtn.classList.toggle('update-ready',hasNew);loginBtn.disabled=false}
}
async function enlCheckRemoteVersion(){const v=await enlFetchRemoteVersion();enlMarkRemoteVersion(v);return v}
async function enlAdminGlobalRefresh(u){
  if(!u||u.role!=='safety')return;
  if(!confirm('관리자를 포함한 전체 사용자를 로그아웃하고 앱 세션을 최신화할까요?'))return;
  const adminPassword=prompt('관리자 비밀번호를 입력하세요.');if(!adminPassword)return;
  try{
    const remote=await enlFetchRemoteVersion();const version=remote||ENL_DEPLOY_VERSION;
    const r=await fetch(ENL_GLOBAL_REFRESH_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'global-refresh',password:adminPassword,version})});
    const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.message||'전체 최신화 요청 실패');
    if(j.epoch!=null)try{localStorage.setItem(ENL_GLOBAL_EPOCH_KEY,String(j.epoch))}catch(e){}
    enlLogoutThisClient();await enlDeleteBrowserCaches();alert('전체 사용자 최신화를 요청했습니다.');enlReloadWithVersion(j.version||version);
  }catch(e){alert(`전체 사용자 최신화에 실패했습니다.\n${e.message||e}`)}
}
async function enlCheckGlobalEpoch(){
  try{
    const r=await fetch(`${ENL_GLOBAL_REFRESH_API}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;
    const j=await r.json();if(j.epoch==null)return;const remote=String(j.epoch);let seen='';try{seen=localStorage.getItem(ENL_GLOBAL_EPOCH_KEY)||''}catch(e){}
    if(!seen){try{localStorage.setItem(ENL_GLOBAL_EPOCH_KEY,remote)}catch(e){}return}
    if(seen!==remote){try{localStorage.setItem(ENL_GLOBAL_EPOCH_KEY,remote)}catch(e){}enlLogoutThisClient();await enlDeleteBrowserCaches();enlReloadWithVersion(j.version||await enlFetchRemoteVersion()||ENL_DEPLOY_VERSION)}
  }catch(e){console.warn('global epoch check skipped',e)}
}
function enlInjectRefreshStyle(){
  if(document.getElementById('enlRefreshStyle'))return;
  const s=document.createElement('style');s.id='enlRefreshStyle';s.textContent=`
  .header-update-control{display:flex;align-items:center;gap:7px;margin-left:auto;margin-right:10px;white-space:nowrap}.header-version{font-size:11px;font-weight:900;color:#173b66;background:#eef4fb;border:1px solid #d4dfec;border-radius:999px;padding:7px 9px}.header-refresh-btn,.app-refresh-btn{appearance:none;border:1px solid #173b66;background:#fff;color:#173b66;border-radius:9px;padding:8px 10px;font-weight:800;cursor:pointer;white-space:nowrap}.header-refresh-btn.update-ready,.app-refresh-btn.update-ready{background:#173b66;color:#fff}.header-refresh-btn:disabled,.app-refresh-btn:disabled{opacity:.6;cursor:wait}.login-update-box{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:#f3f6fa;font-size:12px;color:#5d6d80}.global-refresh-box{margin-top:14px;padding:14px;border:1px solid #e2b8b8;border-radius:12px;background:#fff8f8}.global-refresh-box h3{margin:0 0 6px;font-size:15px;color:#8a2d2d}.global-refresh-box p{margin:0 0 10px;font-size:12px;line-height:1.5;color:#6c5656}.global-refresh-btn{width:100%;border:1px solid #b13b3b;background:#fff;color:#a12f2f;border-radius:9px;padding:10px 12px;font-weight:800;cursor:pointer}@media(max-width:720px){.topbar{gap:6px}.header-update-control{order:2;margin-left:auto;margin-right:4px;gap:5px}.header-version{padding:6px 7px;font-size:10px}.header-refresh-btn{padding:7px 8px;font-size:11px}.user-wrap{order:3}.brand{min-width:0}.brand p{display:none}}`;
  document.head.appendChild(s);
}
function enlInjectHeaderRefresh(){
  enlInjectRefreshStyle();
  document.getElementById('appRefreshBar')?.remove();
  const top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!top||!user)return;
  document.getElementById('headerUpdateControl')?.remove();
  const box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';box.innerHTML=`<span class="header-version" id="appVersionLabel">v${ENL_DEPLOY_VERSION}</span><button type="button" class="header-refresh-btn" id="appRefreshBtn">새로고침</button>`;
  top.insertBefore(box,user);document.getElementById('appRefreshBtn').onclick=enlHardRefresh;enlCheckRemoteVersion();
}
function enlInjectLoginRefresh(){
  enlInjectRefreshStyle();const card=document.querySelector('.login-card');if(!card)return;document.getElementById('loginRefreshBox')?.remove();
  const box=document.createElement('div');box.id='loginRefreshBox';box.className='login-update-box';box.innerHTML=`<span>앱 버전 <b id="loginVersionLabel">v${ENL_DEPLOY_VERSION}</b></span><button type="button" class="app-refresh-btn" id="loginRefreshBtn">새로고침</button>`;card.appendChild(box);document.getElementById('loginRefreshBtn').onclick=enlHardRefresh;enlCheckRemoteVersion();
}
function enlInjectAdminGlobalControl(root,u){if(!u||u.role!=='safety'||!root||document.getElementById('globalRefreshBox'))return;enlInjectRefreshStyle();const panels=root.querySelectorAll('.panel'),target=panels.length?panels[panels.length-1]:root,box=document.createElement('div');box.id='globalRefreshBox';box.className='global-refresh-box';box.innerHTML='<h3>관리자 전체 앱 최신화</h3><p>관리자를 포함한 모든 사용자 세션을 종료하고 최신 앱으로 다시 접속시킵니다.</p><button type="button" class="global-refresh-btn" id="globalRefreshBtn">전체 사용자 앱 최신화</button>';target.appendChild(box);document.getElementById('globalRefreshBtn').onclick=()=>enlAdminGlobalRefresh(u)}
const ENL_CONTROL_BASE_RENDER_SHELL=renderShell;renderShell=function(u){ENL_CONTROL_BASE_RENDER_SHELL(u);enlInjectHeaderRefresh()};
const ENL_CONTROL_BASE_RENDER_LOGIN=renderLogin;renderLogin=function(){ENL_CONTROL_BASE_RENDER_LOGIN();enlInjectLoginRefresh()};
const ENL_CONTROL_BASE_RENDER_MORE=renderMore;renderMore=function(root,u){ENL_CONTROL_BASE_RENDER_MORE(root,u);enlInjectAdminGlobalControl(root,u)};
try{localStorage.setItem(ENL_VERSION_KEY,ENL_DEPLOY_VERSION)}catch(e){}
currentView='';render();setTimeout(enlCheckRemoteVersion,1200);setInterval(enlCheckRemoteVersion,60000);setTimeout(enlCheckGlobalEpoch,3500);setInterval(enlCheckGlobalEpoch,30000);