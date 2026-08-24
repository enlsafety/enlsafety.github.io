/* E&L Accident Report App v3.7.6 - stable version / refresh controller */
const ENL_DEPLOY_VERSION='3.7.6';
const ENL_VERSION_KEY='enl_safety_loaded_version';
const ENL_AUTO_REFRESH_TARGET_KEY='enl_safety_auto_refresh_target';
const ENL_AUTO_REFRESH_AT_KEY='enl_safety_auto_refresh_at';

function enlVersionParts(v){return String(v||'0').split('.').map(x=>parseInt(x,10)||0)}
function enlCompareVersions(a,b){const aa=enlVersionParts(a),bb=enlVersionParts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const av=aa[i]||0,bv=bb[i]||0;if(av>bv)return 1;if(av<bv)return -1}return 0}
function enlIsNewer(a,b=ENL_DEPLOY_VERSION){return !!a&&enlCompareVersions(a,b)>0}
async function enlFetchRemoteVersion(timeoutMs=2500){
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const r=await fetch(`version.json?ts=${Date.now()}&rnd=${Math.random().toString(36).slice(2)}`,{cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'},signal:controller?.signal});
    if(!r.ok)return '';
    const j=await r.json();return String(j.version||j.build||'').trim();
  }catch(e){return ''}finally{if(timer)clearTimeout(timer)}
}
async function enlDeleteBrowserCachesBestEffort(){
  try{if('caches' in window){const keys=await caches.keys();Promise.all(keys.map(k=>caches.delete(k))).catch(()=>{})}}catch(e){}
  try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{})}}catch(e){}
}
function enlReloadNow(version=ENL_DEPLOY_VERSION){
  const u=new URL(location.href);u.searchParams.set('appv',String(version));u.searchParams.set('_reload',String(Date.now()));u.searchParams.set('_fresh','1');u.searchParams.set('_cb',Math.random().toString(36).slice(2));location.replace(u.toString());
}
function enlHardRefresh(){
  document.querySelectorAll('#appRefreshBtn,#loginRefreshBtn').forEach(b=>{b.disabled=true;b.textContent='새로고침 중…'});
  enlDeleteBrowserCachesBestEffort();
  setTimeout(()=>enlReloadNow(ENL_DEPLOY_VERSION),60);
  setTimeout(()=>{try{location.href=`${location.pathname}?appv=${ENL_DEPLOY_VERSION}&_reload=${Date.now()}&_fresh=1&_cb=${Math.random().toString(36).slice(2)}`}catch(e){}},1600);
}
window.enlForceLatestRefresh=enlHardRefresh;
function enlRefreshStyle(){
  if(document.getElementById('enlRefreshStyle'))return;
  const s=document.createElement('style');s.id='enlRefreshStyle';s.textContent=`.header-update-control{display:flex;align-items:center;gap:6px;margin-left:auto;margin-right:8px;white-space:nowrap}.header-version{font-size:10px;font-weight:900;color:#173b66;background:#eef4fb;border:1px solid #d4dfec;border-radius:999px;padding:6px 8px}.header-refresh-btn,.app-refresh-btn{border:1px solid #173b66;background:#fff;color:#173b66;border-radius:9px;padding:7px 9px;font-weight:800;cursor:pointer}.header-refresh-btn:disabled,.app-refresh-btn:disabled{opacity:.65}.login-update-box{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:#f3f6fa;font-size:12px;color:#5d6d80}@media(max-width:720px){.header-update-control{gap:3px;margin-right:3px}.header-version{padding:5px 6px;font-size:9px}.header-refresh-btn{padding:6px 7px;font-size:10px}}`;
  document.head.appendChild(s);
}
function enlInjectHeaderRefresh(){
  enlRefreshStyle();const top=document.querySelector('.topbar'),user=document.querySelector('.topbar .user-wrap');if(!top||!user)return;
  document.getElementById('headerUpdateControl')?.remove();
  const box=document.createElement('div');box.id='headerUpdateControl';box.className='header-update-control';box.innerHTML=`<span class="header-version" id="appVersionLabel">v${ENL_DEPLOY_VERSION}</span><button type="button" class="header-refresh-btn" id="appRefreshBtn">새로고침</button>`;top.insertBefore(box,user);document.getElementById('appRefreshBtn').onclick=enlHardRefresh;
}
function enlInjectLoginRefresh(){
  enlRefreshStyle();const card=document.querySelector('.login-card');if(!card)return;document.getElementById('loginRefreshBox')?.remove();
  const box=document.createElement('div');box.id='loginRefreshBox';box.className='login-update-box';box.innerHTML=`<span>앱 버전 <b id="loginVersionLabel">v${ENL_DEPLOY_VERSION}</b></span><button type="button" class="app-refresh-btn" id="loginRefreshBtn">새로고침</button>`;card.appendChild(box);document.getElementById('loginRefreshBtn').onclick=enlHardRefresh;
}
async function enlCheckRemoteVersion(){
  const v=await enlFetchRemoteVersion();
  if(!v)return;
  document.querySelectorAll('#appVersionLabel,#loginVersionLabel').forEach(x=>x.textContent=enlIsNewer(v)?`v${ENL_DEPLOY_VERSION} → v${v}`:`v${ENL_DEPLOY_VERSION}`);
  if(!enlIsNewer(v))return;
  let target='',at=0;try{target=localStorage.getItem(ENL_AUTO_REFRESH_TARGET_KEY)||'';at=Number(localStorage.getItem(ENL_AUTO_REFRESH_AT_KEY)||0)}catch(e){}
  if(target===v&&Date.now()-at<90000)return;
  try{localStorage.setItem(ENL_AUTO_REFRESH_TARGET_KEY,v);localStorage.setItem(ENL_AUTO_REFRESH_AT_KEY,String(Date.now()))}catch(e){}
  enlDeleteBrowserCachesBestEffort();enlReloadNow(v);
}
const ENL_CONTROL_BASE_RENDER_SHELL=renderShell;renderShell=function(u){const r=ENL_CONTROL_BASE_RENDER_SHELL(u);enlInjectHeaderRefresh();return r};
const ENL_CONTROL_BASE_RENDER_LOGIN=renderLogin;renderLogin=function(){const r=ENL_CONTROL_BASE_RENDER_LOGIN();enlInjectLoginRefresh();return r};
try{localStorage.setItem(ENL_VERSION_KEY,ENL_DEPLOY_VERSION)}catch(e){}
currentView='';render();setTimeout(enlCheckRemoteVersion,1000);setInterval(enlCheckRemoteVersion,30000);window.addEventListener('focus',enlCheckRemoteVersion);window.addEventListener('online',enlCheckRemoteVersion);
