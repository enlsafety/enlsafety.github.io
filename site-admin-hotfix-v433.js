/* E&L Accident Report App v4.3.3 - site admin API routing hotfix */
(function(){
  'use strict';

  const VERSION='4.3.3-site-admin-api1';
  const LEGACY_SITE_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync';
  const SITE_UPSERT_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-site-upsert-v412';
  const CLIENT='incident-report-v2';
  const baseIncidentApi=window.enlIncidentApi;

  async function call(url,body,timeout=15000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body||{}),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }

  window.enlIncidentApi=function(body,timeout){
    const action=String(body?.action||'').trim();
    if(action==='site_list'||action==='site_directory'||action==='site_audit_pull')return call(LEGACY_SITE_API,body,timeout||15000);
    if(action==='site_upsert')return call(SITE_UPSERT_API,body,timeout||15000);
    if(typeof baseIncidentApi==='function')return baseIncidentApi(body,timeout);
    throw new Error('incident_api_not_ready');
  };

  /* If the broken settings page is already open, re-render it immediately. */
  try{
    const u=window.currentUser?.();
    if(u&&String(u.role||'')==='safety'&&String(window.currentView||'')==='more'){
      const root=document.getElementById('view');
      if(root&&typeof window.renderMore==='function')setTimeout(()=>window.renderMore(root,u),0);
    }
  }catch(e){}

  window.ENL_SITE_ADMIN_HOTFIX_VERSION=VERSION;
})();
