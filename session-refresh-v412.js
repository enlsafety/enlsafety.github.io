/* E&L Accident Report App v4.1.2 - refresh/background-safe login session */
(function(){
  'use strict';
  const VERSION='4.1.2-r16-session2';
  const BACKUP_KEY='enl_safety_session_refresh_v412';
  const COOKIE_KEY='enl_safety_session_refresh_v412';
  const VIEW_KEY='enl_safety_view_refresh_v412';
  const DRAFT_KEY='enl_safety_report_draft_v412';
  const MAX_AGE=60*60*24*30;
  const DRAFT_MAX_AGE=12*60*60*1000;
  const VALID_VIEWS=new Set(['home','dashboard','report','incidents','actions','more','field-inquiry','personnel']);

  function validSession(v){
    if(!v||typeof v!=='object')return false;
    if(v.userId)return true;
    const u=v.worker||v.manager;
    return !!(u&&typeof u==='object'&&(u.id||u.personnelId)&&u.name&&u.role);
  }
  function safeSession(v){
    if(!validSession(v))return null;
    try{
      const copy=JSON.parse(JSON.stringify(v));
      const strip=o=>{if(!o||typeof o!=='object')return;delete o.passwordHash;delete o.pinHash;delete o.password_hash;delete o.pin_hash};
      strip(copy);strip(copy.worker);strip(copy.manager);
      return copy;
    }catch(e){return v}
  }
  function readCookie(){
    try{
      const row=document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE_KEY+'='));
      if(!row)return null;
      const v=JSON.parse(decodeURIComponent(row.slice(COOKIE_KEY.length+1)));
      return validSession(v)?v:null;
    }catch(e){return null}
  }
  function readBackup(){
    try{
      const v=JSON.parse(localStorage.getItem(BACKUP_KEY)||'null');
      if(validSession(v))return v;
    }catch(e){}
    return readCookie();
  }
  function persistBackup(v){
    const safe=safeSession(v);if(!safe)return;
    try{localStorage.setItem(BACKUP_KEY,JSON.stringify(safe))}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(safe))}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`}catch(e){}
  }
  function clearBackup(){
    try{localStorage.removeItem(BACKUP_KEY)}catch(e){}
    try{localStorage.removeItem(VIEW_KEY)}catch(e){}
    try{localStorage.removeItem(DRAFT_KEY)}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax; Secure`}catch(e){}
  }
  function actorId(){
    try{const u=currentUser?.();return String(u?.id||u?.personnelId||u?.username||'')}catch(e){const u=session?.worker||session?.manager;return String(u?.id||u?.personnelId||'')}
  }
  function persistView(){
    if(!session)return;
    try{if(VALID_VIEWS.has(String(currentView||'')))localStorage.setItem(VIEW_KEY,String(currentView))}catch(e){}
  }
  function restoreView(){
    if(!session)return;
    try{const v=localStorage.getItem(VIEW_KEY)||'';if(VALID_VIEWS.has(v))currentView=v}catch(e){}
  }

  function readDraft(){
    try{
      const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
      if(!d||Date.now()-Number(d.savedAt||0)>DRAFT_MAX_AGE)return null;
      const uid=actorId();if(d.userId&&uid&&String(d.userId)!==uid)return null;
      return d;
    }catch(e){return null}
  }
  function saveDraft(){
    if(!session)return;
    const form=document.getElementById('unifiedReportForm');if(!form)return;
    const fields={};
    form.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>{
      if(el.type==='file'||el.type==='password')return;
      fields[el.id]=el.type==='checkbox'?{checked:!!el.checked}:{value:el.value};
    });
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify({savedAt:Date.now(),userId:actorId(),type:form.dataset.reportType||'',fields}))}catch(e){}
  }
  function clearDraft(){try{localStorage.removeItem(DRAFT_KEY)}catch(e){}}
  function applyDraft(form,d){
    if(!form||!d?.fields)return false;
    for(const [id,state] of Object.entries(d.fields)){
      const el=document.getElementById(id);if(!el)continue;
      if('checked' in state)el.checked=!!state.checked;else if('value' in state)el.value=state.value??'';
      try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}
    }
    return true;
  }

  const originalSave=typeof saveSession==='function'?saveSession:null;
  if(!session){
    const restored=readBackup();
    if(restored){session=restored;try{originalSave?.()}catch(e){}}
  }
  if(session){persistBackup(session);restoreView()}

  if(originalSave){
    saveSession=function(){
      try{originalSave()}catch(e){console.warn('primary session save skipped',e)}
      if(session)persistBackup(session);else clearBackup();
    };
  }

  let draftTimer=null;
  function keepCurrent(){if(session){persistBackup(session);persistView();saveDraft()}}
  document.addEventListener('input',e=>{if(!e.target?.closest?.('#unifiedReportForm'))return;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,250)},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('#unifiedReportForm'))saveDraft()},true);
  document.addEventListener('submit',e=>{if(e.target?.id==='unifiedReportForm')setTimeout(clearDraft,0)},true);
  window.addEventListener('pagehide',keepCurrent,{capture:true});
  window.addEventListener('beforeunload',keepCurrent,{capture:true});
  window.addEventListener('pageshow',()=>{
    if(!session){const restored=readBackup();if(restored){session=restored;try{originalSave?.()}catch(e){}restoreView();setTimeout(()=>{try{window.render?.()}catch(e){}},0)}}
    else keepCurrent();
  },{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')keepCurrent()});
  try{document.addEventListener('freeze',keepCurrent,{capture:true})}catch(e){}

  const bootDraft=session&&String(currentView||'')==='report'?readDraft():null;
  if(bootDraft){
    let typeClicked=false;
    const restore=()=>{
      if(String(currentView||'')!=='report')return false;
      const form=document.getElementById('unifiedReportForm');
      if(form){applyDraft(form,bootDraft);return true}
      if(!typeClicked&&bootDraft.type){const btn=document.querySelector(`[data-report-type="${CSS.escape(String(bootDraft.type))}"]`);if(btn){typeClicked=true;btn.click()}}
      return false;
    };
    const obs=new MutationObserver(()=>{if(restore())obs.disconnect()});
    obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    setTimeout(()=>{if(restore())obs.disconnect()},0);
    setTimeout(()=>obs.disconnect(),5000);
  }

  if(!document.getElementById('enlRefreshSafeCss412')){
    const s=document.createElement('style');s.id='enlRefreshSafeCss412';
    s.textContent='html,body{min-height:100%;height:auto!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch}';
    document.head.appendChild(s);
  }

  window.enlClearRefreshSession=function(){session=null;clearDraft();try{saveSession()}catch(e){clearBackup()}};
  window.enlSaveBackgroundState=keepCurrent;
  window.ENL_SESSION_REFRESH_VERSION=VERSION;
})();