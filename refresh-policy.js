/* E&L Safety v3.6.6 - manual refresh always loads the newest deployed build */
(function(){
  const VERSION_URL='version.json';

  async function fetchLatestVersion(){
    try{
      const r=await fetch(`${VERSION_URL}?ts=${Date.now()}`,{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}
      });
      if(!r.ok)return '';
      const j=await r.json();
      return String(j.version||j.build||'').trim();
    }catch(e){
      console.warn('latest version check skipped',e);
      return '';
    }
  }

  async function clearAllBrowserCaches(){
    try{
      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
    }catch(e){console.warn('cache clear skipped',e)}
    try{
      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister()));
      }
    }catch(e){console.warn('service worker clear skipped',e)}
  }

  async function forceLatestRefresh(){
    const buttons=[...document.querySelectorAll('#appRefreshBtn,#loginRefreshBtn')];
    buttons.forEach(b=>{b.disabled=true;b.textContent='최신버전 불러오는 중…'});
    const latest=await fetchLatestVersion();
    await clearAllBrowserCaches();
    const url=new URL(window.location.href);
    if(latest)url.searchParams.set('appv',latest);
    url.searchParams.set('_reload',String(Date.now()));
    url.searchParams.set('_fresh','1');
    window.location.replace(url.toString());
  }

  function bindButtons(){
    const buttons=[...document.querySelectorAll('#appRefreshBtn,#loginRefreshBtn')];
    buttons.forEach(btn=>{
      if(btn.dataset.latestRefreshBound==='1')return;
      btn.dataset.latestRefreshBound='1';
      btn.onclick=forceLatestRefresh;
      btn.disabled=false;
      btn.textContent='새로고침';
      btn.title='캐시를 지우고 최신 배포본을 다시 불러옵니다.';
    });
  }

  async function updateVersionLabels(){
    const latest=await fetchLatestVersion();
    if(!latest)return;
    const labels=[...document.querySelectorAll('#appVersionLabel,#loginVersionLabel')];
    labels.forEach(label=>{const text=`v${latest}`;if(label.textContent!==text)label.textContent=text});
  }

  const observer=new MutationObserver(bindButtons);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',()=>{bindButtons();updateVersionLabels()});
  setTimeout(()=>{bindButtons();updateVersionLabels()},0);
  setInterval(bindButtons,1500);
  setInterval(updateVersionLabels,30000);
})();
