/* E&L Safety v3.7.1 - version refresh fallback / automatic update */
(function(){
  const VERSION_URL='version.json';
  const AUTO_TARGET_KEY='enl_safety_auto_refresh_target';
  const AUTO_AT_KEY='enl_safety_auto_refresh_at';
  let latestVersion='';

  function currentVersion(){
    try{if(typeof ENL_DEPLOY_VERSION!=='undefined'&&ENL_DEPLOY_VERSION)return String(ENL_DEPLOY_VERSION)}catch(e){}
    return String(window.ENL_PAGE_BUILD||'');
  }
  function parts(v){return String(v||'0').split('.').map(x=>parseInt(x,10)||0)}
  function newer(a,b){
    const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);
    for(let i=0;i<n;i++){const av=aa[i]||0,bv=bb[i]||0;if(av>bv)return true;if(av<bv)return false}
    return false;
  }

  async function fetchLatestVersion(){
    try{
      const r=await fetch(`${VERSION_URL}?ts=${Date.now()}&rnd=${Math.random().toString(36).slice(2)}`,{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}
      });
      if(!r.ok)return '';
      const j=await r.json();
      latestVersion=String(j.version||j.build||'').trim();
      return latestVersion;
    }catch(e){
      console.warn('latest version check skipped',e);
      return latestVersion;
    }
  }

  async function clearAllBrowserCaches(){
    try{if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){console.warn('cache clear skipped',e)}
    try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}}catch(e){console.warn('service worker clear skipped',e)}
  }

  async function fallbackForceLatestRefresh(silent=false){
    const buttons=[...document.querySelectorAll('#appRefreshBtn,#loginRefreshBtn')];
    buttons.forEach(b=>{b.disabled=true;b.textContent=silent?'업데이트 중…':'최신버전 불러오는 중…'});
    const latest=await fetchLatestVersion();
    await clearAllBrowserCaches();
    const url=new URL(window.location.href);
    const target=latest||currentVersion();
    if(target)url.searchParams.set('appv',target);
    url.searchParams.set('_reload',String(Date.now()));
    url.searchParams.set('_fresh','1');
    url.searchParams.set('_cb',Math.random().toString(36).slice(2));
    window.location.replace(url.toString());
  }

  async function forceLatestRefresh(silent=false){
    try{
      if(typeof enlForceLatestRefresh==='function')return enlForceLatestRefresh({silent});
    }catch(e){console.warn('primary refresh failed; fallback used',e)}
    return fallbackForceLatestRefresh(silent);
  }

  function applyLatestUI(){
    const current=currentVersion();
    const hasNew=!!latestVersion&&newer(latestVersion,current);
    const buttons=[...document.querySelectorAll('#appRefreshBtn,#loginRefreshBtn')];
    buttons.forEach(btn=>{
      if(btn.dataset.latestRefreshBound!=='1'){
        btn.dataset.latestRefreshBound='1';
        btn.onclick=()=>forceLatestRefresh(false);
        btn.title='브라우저 캐시를 지우고 최신 배포본을 다시 불러옵니다.';
      }
      if(!btn.disabled)btn.textContent=hasNew?'새 버전 자동 적용':'새로고침';
      btn.classList.toggle('update-ready',hasNew);
    });
    const labels=[...document.querySelectorAll('#appVersionLabel,#loginVersionLabel')];
    labels.forEach(label=>{
      if(hasNew)label.textContent=`v${current} → v${latestVersion}`;
      else if(current)label.textContent=`v${current}`;
    });
  }

  async function maybeAutoApply(){
    const current=currentVersion();
    if(!latestVersion||!current||!newer(latestVersion,current))return;
    let lastTarget='',lastAt=0;
    try{lastTarget=localStorage.getItem(AUTO_TARGET_KEY)||'';lastAt=Number(localStorage.getItem(AUTO_AT_KEY)||0)}catch(e){}
    if(lastTarget===latestVersion&&Date.now()-lastAt<90000)return;
    try{localStorage.setItem(AUTO_TARGET_KEY,latestVersion);localStorage.setItem(AUTO_AT_KEY,String(Date.now()))}catch(e){}
    await forceLatestRefresh(true);
  }

  async function updateLatest(){
    await fetchLatestVersion();
    applyLatestUI();
    await maybeAutoApply();
  }

  const observer=new MutationObserver(applyLatestUI);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',()=>{applyLatestUI();updateLatest()});
  window.addEventListener('focus',updateLatest);
  window.addEventListener('online',updateLatest);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateLatest()});
  setTimeout(()=>{applyLatestUI();updateLatest()},0);
  setInterval(applyLatestUI,1500);
  setInterval(updateLatest,30000);
})();
