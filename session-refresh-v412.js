/* E&L Accident Report App v4.1.2 - mobile background-safe login session */
(function(){
  'use strict';
  const VERSION='4.8.9-session-continuity';
  const BACKUP_KEY='enl_safety_session_refresh_v412';
  const COOKIE_KEY='enl_safety_session_refresh_v412';
  const VIEW_KEY='enl_safety_view_refresh_v412';
  const DRAFT_KEY='enl_safety_report_draft_v412';
  const COOKIE_MAX_AGE=12*60*60;
  const LOGOUT_KEY='enl_explicit_logout_v489';
  const DRAFT_MAX_AGE=12*60*60*1000;
  const VALID_VIEWS=new Set(['home','dashboard','report','incidents','actions','more','field-inquiry','inquiry','closed','personnel']);
  let explicitClearArmed=false;
  function logoutGeneration(){try{return localStorage.getItem(LOGOUT_KEY)||''}catch(e){return ''}}
  let observedLogout=logoutGeneration(),wasSignedIn=!!session;

  function validSession(v){
    if(!v||typeof v!=='object')return false;
    if(v.userId)return true;
    const u=v.worker||v.manager;
    return !!(u&&typeof u==='object'&&(u.id||u.personnelId)&&u.name&&u.role);
  }
  function safeSession(v,keepProof=false){
    if(!validSession(v))return null;
    try{
      const copy=JSON.parse(JSON.stringify(v));
      if(!keepProof){
        const strip=o=>{if(!o||typeof o!=='object')return;delete o.passwordHash;delete o.pinHash;delete o.password_hash;delete o.pin_hash;delete o.password;delete o.pin};
        strip(copy);strip(copy.worker);strip(copy.manager);
      }
      return copy;
    }catch(e){return null}
  }
  function envelope(v,savedAt=Date.now(),keepProof=false){
    const safe=safeSession(v,keepProof);return safe?{savedAt:Number(savedAt)||Date.now(),session:safe}:null;
  }
  function sameActor(a,b){
    const x=a?.worker||a?.manager||{},y=b?.worker||b?.manager||{};
    return !!((x.id||x.personnelId)&&(y.id||y.personnelId)&&String(x.id||x.personnelId)===String(y.id||y.personnelId)&&String(x.role||'')===String(y.role||''));
  }
  function mergeLocalProof(base,local){
    if(!validSession(base)||!validSession(local)||!sameActor(base,local))return base;
    const copy=JSON.parse(JSON.stringify(base)),dst=copy.worker||copy.manager,src=local.worker||local.manager;
    if(src?.passwordHash)dst.passwordHash=src.passwordHash;
    if(src?.pinHash)dst.pinHash=src.pinHash;
    return copy;
  }
  function normalizeStored(raw){
    if(!raw||typeof raw!=='object')return null;
    if(validSession(raw.session))return {savedAt:Number(raw.savedAt)||0,session:raw.session};
    if(validSession(raw)){
      const logged=Date.parse(raw.loggedAt||'');
      return {savedAt:Number.isFinite(logged)&&logged>0?logged:Date.now(),session:raw,legacy:true};
    }
    return null;
  }
  function parseStored(text){try{return normalizeStored(JSON.parse(text||'null'))}catch(e){return null}}
  function readCookieRow(){
    try{
      const item=document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE_KEY+'='));
      if(!item)return null;
      return parseStored(decodeURIComponent(item.slice(COOKIE_KEY.length+1)));
    }catch(e){return null}
  }
  function readLocalRow(){
    try{return parseStored(localStorage.getItem(BACKUP_KEY)||'')}catch(e){return null}
  }
  function readBackup(){
    const local=readLocalRow(),cookie=readCookieRow();
    // The verified local copy survives app suspension and upgrades. A cookie is
    // only a short-lived fallback and never contains a password or PIN proof.
    if(local)return local.session;
    return cookie&&cookie.savedAt>Date.now()-COOKIE_MAX_AGE*1000?cookie.session:null;
  }
  function persistBackup(v){
    const at=Date.now(),localRow=envelope(v,at,true),cookieRow=envelope(v,at,false);
    if(!localRow||!cookieRow)return false;
    try{localStorage.setItem(BACKUP_KEY,JSON.stringify(localRow))}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(cookieRow))}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`}catch(e){}
    return true;
  }
  function clearBackup({draft=true}={}){
    try{localStorage.removeItem(BACKUP_KEY)}catch(e){}
    try{localStorage.removeItem(VIEW_KEY)}catch(e){}
    if(draft)try{localStorage.removeItem(DRAFT_KEY)}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax; Secure`}catch(e){}
  }
  function actorId(){
    try{const u=currentUser?.();if(u)return String(u.id||u.personnelId||u.username||'')}catch(e){}
    const u=session?.worker||session?.manager;return String(u?.id||u?.personnelId||session?.userId||'');
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
  function writePrimary(){try{originalSave?.()}catch(e){console.warn('primary session save skipped',e)}}
  function clearSessionExplicit(reason='logout'){
    explicitClearArmed=true;
    session=null;currentView='';
    wasSignedIn=false;clearBackup({draft:true});writePrimary();
    try{localStorage.setItem(LOGOUT_KEY,String(Date.now())+'-'+Math.random());observedLogout=logoutGeneration()}catch(e){}
    try{sessionStorage.setItem('enl_last_session_clear_reason',String(reason))}catch(e){}
    explicitClearArmed=false;
    return true;
  }

  // Restore before the shell boots. A cached login still has to pass the
  // server's actor/proof checks for reads, writes and approvals.
  const bootStored=readBackup();
  if(session){
    // Only supplement a missing proof, never replace one from a newer login.
    const u=session.worker||session.manager;
    if(u&&!u.passwordHash&&!u.pinHash)session=mergeLocalProof(session,bootStored);
    persistBackup(session);restoreView();
  }else if(bootStored){
    session=bootStored;writePrimary();restoreView();persistBackup(session);
  }

  wasSignedIn=!!session;
  function adoptPeerLogout(){
    const generation=logoutGeneration();
    if(generation===observedLogout)return false;
    observedLogout=generation;
    session=loadSession();currentView='';
    if(wasSignedIn&&!session)showReason('다른 탭에서 로그아웃하여 이 탭의 로그인도 종료됐습니다.');
    wasSignedIn=!!session;
    if(document.readyState!=='loading'){
      if(typeof window.enlRefreshSharedData==='function')window.enlRefreshSharedData(true);
      else window.render?.();
    }
    return true;
  }
  function showReason(message){
    const show=()=>{if(document.visibilityState==='hidden')return;document.removeEventListener('visibilitychange',show);if(!session)window.alert(message)};
    if(document.visibilityState==='hidden')document.addEventListener('visibilitychange',show);
    else setTimeout(show,0);
  }
  try{
    const reason=sessionStorage.getItem('enl_last_session_clear_reason');
    sessionStorage.removeItem('enl_last_session_clear_reason');
    if(!session&&['global_update','manual_global_update'].includes(reason)){
      showReason('이전 버전이 업데이트되면서 로그인이 종료됐습니다. 한 번 다시 로그인해 주세요.');
    }
  }catch(e){}

  if(originalSave){
    saveSession=function(){
      if(session){
        wasSignedIn=true;observedLogout=logoutGeneration();writePrimary();persistBackup(session);return;
      }
      if(!explicitClearArmed){
        const stored=readBackup();
        if(stored){session=stored;writePrimary();restoreView();return}
      }
      writePrimary();
    };
  }

  // The visible logout button is an explicit user action, so clear the durable session before its normal handler runs.
  document.addEventListener('click',e=>{if(e.target?.closest?.('#logoutBtn'))clearSessionExplicit('logout')},true);

  let draftTimer=null;
  function keepCurrent(){
    if(explicitClearArmed||adoptPeerLogout()||!session)return;
    persistView();saveDraft();
  }
  function restoreForeground(){
    if(explicitClearArmed||adoptPeerLogout())return;
    if(!session){
      const stored=(typeof loadSession==='function'&&loadSession())||readBackup();
      if(!stored)return;
      session=stored;writePrimary();restoreView();
      setTimeout(()=>{try{window.render?.()}catch(e){}},0);
    }
    persistView();
  }
  window.addEventListener('storage',e=>{if(e.key===LOGOUT_KEY)adoptPeerLogout()});

  document.addEventListener('input',e=>{if(!e.target?.closest?.('#unifiedReportForm'))return;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,250)},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('#unifiedReportForm'))saveDraft()},true);
  document.addEventListener('submit',e=>{if(e.target?.id==='unifiedReportForm')setTimeout(clearDraft,0)},true);
  window.addEventListener('pagehide',keepCurrent,{capture:true});
  window.addEventListener('beforeunload',keepCurrent,{capture:true});
  window.addEventListener('pageshow',restoreForeground,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')keepCurrent();else if(document.visibilityState==='visible')restoreForeground()});
  try{document.addEventListener('freeze',keepCurrent,{capture:true})}catch(e){}
  try{document.addEventListener('resume',restoreForeground,{capture:true})}catch(e){}

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

  window.enlClearRefreshSession=clearSessionExplicit;
  window.enlSaveBackgroundState=keepCurrent;
  window.enlRestoreForegroundSession=restoreForeground;
  window.ENL_SESSION_REFRESH_VERSION=VERSION;
})();