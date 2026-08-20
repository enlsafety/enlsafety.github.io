/* E&L 사고보고 - 앱 버전/강제 새로고침 제어 */
const ENL_DEPLOY_VERSION = '3.0.2';
const ENL_VERSION_KEY = 'enl_safety_loaded_version';
const ENL_FORCE_LOGOUT_KEY = 'enl_safety_force_logout_event';
const ENL_REFRESH_CHANNEL = 'enl_safety_app_refresh';

function enlClearLocalSession(){
  session = null;
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
  currentView = '';
  accountMenuOpen = false;
}

function enlBroadcastLogout(){
  const payload = JSON.stringify({version:ENL_DEPLOY_VERSION, at:Date.now()});
  try{ localStorage.setItem(ENL_FORCE_LOGOUT_KEY, payload); }catch(e){}
  try{
    const ch = new BroadcastChannel(ENL_REFRESH_CHANNEL);
    ch.postMessage({type:'logout-refresh', version:ENL_DEPLOY_VERSION, at:Date.now()});
    ch.close();
  }catch(e){}
}

async function enlDeleteBrowserCaches(){
  if(!('caches' in window)) return;
  try{
    const keys = await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
  }catch(e){ console.warn('cache clear skipped', e); }
}

async function enlHardRefresh(){
  if(!confirm(`앱을 v${ENL_DEPLOY_VERSION} 최신 버전으로 새로고침할까요?\n현재 로그인은 종료되고 다시 로그인해야 합니다.`)) return;
  enlBroadcastLogout();
  enlClearLocalSession();
  try{ localStorage.setItem(ENL_VERSION_KEY, ENL_DEPLOY_VERSION); }catch(e){}
  await enlDeleteBrowserCaches();
  const url = new URL(window.location.href);
  url.searchParams.set('appv', ENL_DEPLOY_VERSION);
  url.searchParams.set('refresh', String(Date.now()));
  window.location.replace(url.toString());
}

function enlHandleRemoteLogout(){
  enlClearLocalSession();
  try{ localStorage.setItem(ENL_VERSION_KEY, ENL_DEPLOY_VERSION); }catch(e){}
  const url = new URL(window.location.href);
  url.searchParams.set('appv', ENL_DEPLOY_VERSION);
  url.searchParams.set('refresh', String(Date.now()));
  window.location.replace(url.toString());
}

function enlCheckVersionOnLoad(){
  let seen = null;
  try{ seen = localStorage.getItem(ENL_VERSION_KEY); }catch(e){}
  if(seen !== ENL_DEPLOY_VERSION){
    enlClearLocalSession();
    try{ localStorage.setItem(ENL_VERSION_KEY, ENL_DEPLOY_VERSION); }catch(e){}
  }
}

function enlInjectRefreshStyle(){
  if(document.getElementById('enlRefreshStyle')) return;
  const style = document.createElement('style');
  style.id = 'enlRefreshStyle';
  style.textContent = `
    .app-update-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 12px;padding:10px 12px;border:1px solid #cdd8e6;border-radius:12px;background:#f6f9fd;color:#31445d;font-size:13px}
    .app-update-info{display:flex;align-items:center;gap:8px;min-width:0}.app-update-info b{color:#173b66;white-space:nowrap}.app-update-info span{color:#68788d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .app-refresh-btn{appearance:none;border:1px solid #173b66;background:#fff;color:#173b66;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer;white-space:nowrap}.app-refresh-btn:hover{background:#edf4fb}.app-refresh-btn:active{transform:translateY(1px)}
    .login-update-box{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:#f3f6fa;font-size:12px;color:#5d6d80}.login-update-box .app-refresh-btn{padding:7px 10px;font-size:12px}
    @media(max-width:640px){.app-update-bar{align-items:stretch;flex-direction:column}.app-refresh-btn{width:100%}.app-update-info{justify-content:space-between}.app-update-info span{display:none}}
  `;
  document.head.appendChild(style);
}

function enlInjectRefreshBar(){
  enlInjectRefreshStyle();
  const main = document.querySelector('.main');
  if(!main || document.getElementById('appRefreshBar')) return;
  const permission = main.querySelector('.permission-strip');
  const bar = document.createElement('div');
  bar.id = 'appRefreshBar';
  bar.className = 'app-update-bar';
  bar.innerHTML = `<div class="app-update-info"><b>앱 v${ENL_DEPLOY_VERSION}</b><span>새 버전 반영이 필요하면 새로고침하세요.</span></div><button type="button" class="app-refresh-btn" id="appRefreshBtn">↻ 앱 새로고침</button>`;
  if(permission) permission.insertAdjacentElement('afterend', bar);
  else main.insertAdjacentElement('afterbegin', bar);
  document.getElementById('appRefreshBtn').onclick = enlHardRefresh;

  const footer = document.querySelector('.footer-note');
  if(footer) footer.textContent = `이앤엘 사고보고 v${ENL_DEPLOY_VERSION} · TEST MODE · 현재 브라우저 저장 방식`;
}

function enlInjectLoginRefresh(){
  enlInjectRefreshStyle();
  const card = document.querySelector('.login-card');
  if(!card || document.getElementById('loginRefreshBox')) return;
  const box = document.createElement('div');
  box.id = 'loginRefreshBox';
  box.className = 'login-update-box';
  box.innerHTML = `<span>현재 앱 버전 <b>v${ENL_DEPLOY_VERSION}</b></span><button type="button" class="app-refresh-btn" id="loginRefreshBtn">↻ 새로고침</button>`;
  card.appendChild(box);
  document.getElementById('loginRefreshBtn').onclick = enlHardRefresh;
}

const ENL_ORIGINAL_RENDER_SHELL = renderShell;
renderShell = function(u){
  ENL_ORIGINAL_RENDER_SHELL(u);
  enlInjectRefreshBar();
};

const ENL_ORIGINAL_RENDER_LOGIN = renderLogin;
renderLogin = function(){
  ENL_ORIGINAL_RENDER_LOGIN();
  enlInjectLoginRefresh();
};

window.addEventListener('storage', e=>{
  if(e.key===ENL_FORCE_LOGOUT_KEY && e.newValue) enlHandleRemoteLogout();
});
try{
  const enlRefreshChannel = new BroadcastChannel(ENL_REFRESH_CHANNEL);
  enlRefreshChannel.onmessage = e=>{
    if(e.data?.type==='logout-refresh') enlHandleRemoteLogout();
  };
}catch(e){}

enlCheckVersionOnLoad();
currentView = '';
render();
