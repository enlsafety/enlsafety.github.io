/* E&L Accident Report App v4.3.1 - production legacy cleanup */
(function(){
  'use strict';
  const VERSION='4.3.1-cleanup1';
  const DEMO_USER_IDS=new Set(['u-field-demo','u-safety-demo','u-final-demo']);
  const DEMO_SITES=new Map([
    ['site-dongtan','동탄 현장'],
    ['site-yongin','용인 현장'],
    ['site-pyeongtaek','평택 물류'],
    ['site-a','A 골프장'],
    ['site-b','B 골프장']
  ]);

  function cleanLegacyLocalData(){
    let changed=false;
    try{
      if(Array.isArray(data?.users)){
        const next=data.users.filter(u=>!DEMO_USER_IDS.has(String(u?.id||'')));
        if(next.length!==data.users.length){data.users=next;changed=true;}
      }
      if(Array.isArray(data?.sites)){
        const next=data.sites.filter(s=>{
          const id=String(s?.id||'');
          const legacyName=DEMO_SITES.get(id);
          return !(legacyName&&String(s?.name||'')===legacyName);
        });
        if(next.length!==data.sites.length){data.sites=next;changed=true;}
      }
      localStorage.removeItem('enl_accident_demo_v1');
      if(changed&&typeof saveData==='function')saveData();
    }catch(err){console.warn('[production-cleanup-v431] local legacy cleanup skipped',err)}
  }

  function removeLegacyDemoUi(){
    try{
      document.querySelectorAll('.demo-box,.secure-note.demo').forEach(el=>el.remove());
    }catch(e){}
  }

  cleanLegacyLocalData();
  removeLegacyDemoUi();
  const observer=new MutationObserver(removeLegacyDemoUi);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.ENL_PRODUCTION_CLEANUP_VERSION=VERSION;
})();
