/* E&L 사고보고 - 앱 버전/새로고침 제어 */
const ENL_DEPLOY_VERSION = '3.0.4';
const ENL_VERSION_KEY = 'enl_safety_loaded_version';
const ENL_REMOTE_VERSION_KEY = 'enl_safety_remote_version';
const ENL_GLOBAL_EPOCH_KEY = 'enl_safety_global_epoch';

/* 무료 테스트용 Supabase 전체 최신화 API */
const ENL_GLOBAL_REFRESH_API = 'https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-global-refresh';
const ENL_GLOBAL_REFRESH_ANON_KEY = '';

async function enlDeleteBrowserCaches(){
  if(!('caches' in window)) return;
  try{
    const keys = await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
  }catch(e){ console.warn('cache clear skipped', e); }
}

function enlReloadWithVersion(version=ENL_DEPLOY_VERSION){
  const url = new URL(window.location.href);
  url.searchParams.set('appv', String(version));
  url.searchParams.set('refresh', String(Date.now()));
  window.location.replace(url.toString());
}

/* 공통 새로고침: 이 기기/이 브라우저만 최신화. 로그인 세션은 유지한다. */
async function enlHardRefresh(){
  if(!confirm('이 기기의 앱을 최신 버전으로 새로고침할까요?\n현재 로그인 상태는 유지됩니다.')) return;
  await enlDeleteBrowserCaches();
  try{ localStorage.setItem(ENL_VERSION_KEY, ENL_DEPLOY_VERSION); }catch(e){}
  enlReloadWithVersion(ENL_DEPLOY_VERSION);
}

function enlLogoutThisClient(){
  session = null;
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
  currentView = '';
  accountMenuOpen = false;
}

function enlMarkRemoteVersion(remoteVersion){
  try{ localStorage.setItem(ENL_REMOTE_VERSION_KEY, remoteVersion||''); }catch(e){}
  const info = document.querySelector('#appRefreshBar .app-update-info span');
  const btn = document.getElementById('appRefreshBtn');
  if(remoteVersion && remoteVersion !== ENL_DEPLOY_VERSION){
    if(info) info.textContent = `새 버전 v${remoteVersion} 사용 가능`;
    if(btn) btn.textContent = `↻ v${remoteVersion} 적용`;
    if(btn) btn.classList.add('update-ready');
  }else{
    if(info) info.textContent = '현재 기기에서 최신 버전을 다시 불러옵니다.';
    if(btn) btn.textContent = '↻ 앱 새로고침';
    if(btn) btn.classList.remove('update-ready');
  }
}

async function enlCheckRemoteVersion(){
  try{
    const res = await fetch(`version.json?t=${Date.now()}`, {cache:'no-store'});
    if(!res.ok) return;
    const info = await res.json();
    const remoteVersion = String(info.version||'').trim();
    enlMarkRemoteVersion(remoteVersion);
  }catch(e){ console.warn('version check skipped', e); }
}

/* 전체 사용자 최신화: 안전관리자 전용 */
async function enlAdminGlobalRefresh(u){
  if(!u || u.role!=='safety') return;
  if(!confirm('관리자를 포함한 전체 사용자를 로그아웃하고 앱 세션을 최신화할까요?')) return;
  const adminPassword = prompt('관리자 비밀번호를 입력하세요.');
  if(!adminPassword) return;
  try{
    const headers={'Content-Type':'application/json'};
    if(ENL_GLOBAL_REFRESH_ANON_KEY){
      headers['apikey']=ENL_GLOBAL_REFRESH_ANON_KEY;
      headers['Authorization']=`Bearer ${ENL_GLOBAL_REFRESH_ANON_KEY}`;
    }
    const res = await fetch(ENL_GLOBAL_REFRESH_API,{
      method:'POST',headers,
      body:JSON.stringify({action:'global-refresh',password:adminPassword,version:ENL_DEPLOY_VERSION})
    });
    const body = await res.json().catch(()=>({}));
    if(!res.ok || body.ok===false) throw new Error(body.message||'전체 최신화 요청 실패');
    if(body.epoch!=null) try{localStorage.setItem(ENL_GLOBAL_EPOCH_KEY,String(body.epoch))}catch(e){}
    enlLogoutThisClient();
    await enlDeleteBrowserCaches();
    alert('전체 사용자 최신화를 요청했습니다. 다른 사용자는 최대 약 30초 안에 자동 로그아웃됩니다.');
    enlReloadWithVersion(body.version||ENL_DEPLOY_VERSION);
  }catch(e){
    alert(`전체 사용자 최신화에 실패했습니다.\n${e.message||e}`);
  }
}

/* 각 기기가 서버의 전역 세션 세대를 확인하여 변경 시 강제 로그아웃 */
async function enlCheckGlobalEpoch(){
  try{
    const headers={};
    if(ENL_GLOBAL_REFRESH_ANON_KEY){headers['apikey']=ENL_GLOBAL_REFRESH_ANON_KEY;headers['Authorization']=`Bearer ${ENL_GLOBAL_REFRESH_ANON_KEY}`;}
    const res = await fetch(`${ENL_GLOBAL_REFRESH_API}?t=${Date.now()}`,{cache:'no-store',headers});
    if(!res.ok) return;
    const body = await res.json();
    if(body.epoch==null) return;
    const remoteEpoch=String(body.epoch);
    let seen='';
    try{seen=localStorage.getItem(ENL_GLOBAL_EPOCH_KEY)||''}catch(e){}
    if(!seen){try{localStorage.setItem(ENL_GLOBAL_EPOCH_KEY,remoteEpoch)}catch(e){};return;}
    if(seen!==remoteEpoch){
      try{localStorage.setItem(ENL_GLOBAL_EPOCH_KEY,remoteEpoch)}catch(e){}
      enlLogoutThisClient();
      await enlDeleteBrowserCaches();
      enlReloadWithVersion(body.version||ENL_DEPLOY_VERSION);
    }
  }catch(e){ console.warn('global epoch check skipped',e); }
}

function enlInjectRefreshStyle(){
  if(document.getElementById('enlRefreshStyle')) return;
  const style=document.createElement('style');
  style.id='enlRefreshStyle';
  style.textContent=`
    .app-update-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 12px;padding:10px 12px;border:1px solid #cdd8e6;border-radius:12px;background:#f6f9fd;color:#31445d;font-size:13px}
    .app-update-info{display:flex;align-items:center;gap:8px;min-width:0}.app-update-info b{color:#173b66;white-space:nowrap}.app-update-info span{color:#68788d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .app-refresh-btn{appearance:none;border:1px solid #173b66;background:#fff;color:#173b66;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer;white-space:nowrap}.app-refresh-btn.update-ready{background:#173b66;color:#fff}.app-refresh-btn:active{transform:translateY(1px)}
    .login-update-box{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:#f3f6fa;font-size:12px;color:#5d6d80}.login-update-box .app-refresh-btn{padding:7px 10px;font-size:12px}
    .global-refresh-box{margin-top:14px;padding:14px;border:1px solid #e2b8b8;border-radius:12px;background:#fff8f8}.global-refresh-box h3{margin:0 0 6px;font-size:15px;color:#8a2d2d}.global-refresh-box p{margin:0 0 10px;font-size:12px;line-height:1.5;color:#6c5656}.global-refresh-btn{width:100%;border:1px solid #b13b3b;background:#fff;color:#a12f2f;border-radius:9px;padding:10px 12px;font-weight:800;cursor:pointer}.global-refresh-btn:hover{background:#fff0f0}
    @media(max-width:640px){.app-update-bar{align-items:stretch;flex-direction:column}.app-refresh-btn{width:100%}.app-update-info{justify-content:space-between}.app-update-info span{display:none}}
  `;
  document.head.appendChild(style);
}

function enlInjectRefreshBar(){
  enlInjectRefreshStyle();
  const main=document.querySelector('.main');
  if(!main || document.getElementById('appRefreshBar')) return;
  const permission=main.querySelector('.permission-strip');
  const bar=document.createElement('div');
  bar.id='appRefreshBar';bar.className='app-update-bar';
  bar.innerHTML=`<div class="app-update-info"><b>앱 v${ENL_DEPLOY_VERSION}</b><span>현재 기기에서 최신 버전을 다시 불러옵니다.</span></div><button type="button" class="app-refresh-btn" id="appRefreshBtn">↻ 앱 새로고침</button>`;
  if(permission) permission.insertAdjacentElement('afterend',bar); else main.insertAdjacentElement('afterbegin',bar);
  document.getElementById('appRefreshBtn').onclick=enlHardRefresh;
  const footer=document.querySelector('.footer-note');
  if(footer) footer.textContent=`이앤엘 사고보고 v${ENL_DEPLOY_VERSION} · TEST MODE · 현재 브라우저 저장 방식`;
  enlCheckRemoteVersion();
}

function enlInjectLoginRefresh(){
  enlInjectRefreshStyle();
  const card=document.querySelector('.login-card');
  if(!card || document.getElementById('loginRefreshBox')) return;
  const box=document.createElement('div');
  box.id='loginRefreshBox';box.className='login-update-box';
  box.innerHTML=`<span>현재 앱 버전 <b>v${ENL_DEPLOY_VERSION}</b></span><button type="button" class="app-refresh-btn" id="loginRefreshBtn">↻ 새로고침</button>`;
  card.appendChild(box);
  document.getElementById('loginRefreshBtn').onclick=enlHardRefresh;
}

function enlInjectAdminGlobalControl(root,u){
  if(!u || u.role!=='safety' || !root || document.getElementById('globalRefreshBox')) return;
  enlInjectRefreshStyle();
  const panels=root.querySelectorAll('.panel');
  const target=panels.length?panels[panels.length-1]:root;
  const box=document.createElement('div');
  box.id='globalRefreshBox';box.className='global-refresh-box';
  box.innerHTML=`<h3>관리자 전체 앱 최신화</h3><p>관리자를 포함한 모든 사용자 세션을 종료하고 최신 앱으로 다시 접속시킵니다. 다른 사용자는 최대 약 30초 안에 자동 로그아웃됩니다.</p><button type="button" class="global-refresh-btn" id="globalRefreshBtn">전체 사용자 앱 최신화</button>`;
  target.appendChild(box);
  document.getElementById('globalRefreshBtn').onclick=()=>enlAdminGlobalRefresh(u);
}

const ENL_ORIGINAL_RENDER_SHELL=renderShell;
renderShell=function(u){ENL_ORIGINAL_RENDER_SHELL(u);enlInjectRefreshBar();};

const ENL_ORIGINAL_RENDER_LOGIN=renderLogin;
renderLogin=function(){ENL_ORIGINAL_RENDER_LOGIN();enlInjectLoginRefresh();};

const ENL_ORIGINAL_RENDER_MORE=renderMore;
renderMore=function(root,u){ENL_ORIGINAL_RENDER_MORE(root,u);enlInjectAdminGlobalControl(root,u);};

try{localStorage.setItem(ENL_VERSION_KEY,ENL_DEPLOY_VERSION)}catch(e){}
currentView='';
render();
setTimeout(enlCheckRemoteVersion,2500);
setInterval(enlCheckRemoteVersion,60000);
setTimeout(enlCheckGlobalEpoch,3500);
setInterval(enlCheckGlobalEpoch,30000);
