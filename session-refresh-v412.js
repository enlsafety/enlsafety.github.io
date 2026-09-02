/* E&L Accident Report App v4.1.2 - mobile background-safe login session */
(function(){
  'use strict';
  const VERSION='4.1.2-r16-session3';
  const BACKUP_KEY='enl_safety_session_refresh_v412';
  const COOKIE_KEY='enl_safety_session_refresh_v412';
  const VIEW_KEY='enl_safety_view_refresh_v412';
  const DRAFT_KEY='enl_safety_report_draft_v412';
  const SESSION_TTL_MS=12*60*60*1000;
  const COOKIE_MAX_AGE=Math.floor(SESSION_TTL_MS/1000);
  const DRAFT_MAX_AGE=12*60*60*1000;
  const VALID_VIEWS=new Set(['home','dashboard','report','incidents','actions','more','field-inquiry','personnel']);
  let explicitClearArmed=false;
  let lastActiveAt=Date.now();

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
      const strip=o=>{if(!o||typeof o!=='object')return;delete o.passwordHash;delete o.pinHash;delete o.password_hash;delete o.pin_hash;delete o.password;delete o.pin};
      strip(copy);strip(copy.worker);strip(copy.manager);
      return copy;
    }catch(e){return null}
  }
  function envelope(v,savedAt=Date.now()){
    const safe=safeSession(v);return safe?{savedAt:Number(savedAt)||Date.now(),session:safe}:null;
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
  function isExpired(row){return !!row&&row.savedAt>0&&Date.now()-row.savedAt>SESSION_TTL_MS}
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
    const rows=[local,cookie].filter(Boolean).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
    if(!rows.length)return {session:null,expired:false,savedAt:0};
    const row=rows[0];
    if(isExpired(row))return {session:null,expired:true,savedAt:row.savedAt};
    return {session:row.session,expired:false,savedAt:row.savedAt};
  }
  function persistBackup(v,touch=true){
    const at=touch?Date.now():lastActiveAt;
    const row=envelope(v,at);if(!row)return false;
    lastActiveAt=row.savedAt;
    const serialized=JSON.stringify(row);
    try{localStorage.setItem(BACKUP_KEY,serialized)}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`}catch(e){}
    return true;
  }
  function clearBackup({draft=true}={}){
    try{localStorage.removeItem(BACKUP_KEY)}catch(e){}
    try{localStorage.removeItem(VIEW_KEY)}catch(e){}
    if(draft)try{localStorage.removeItem(DRAFT_KEY)}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax; Secure`}catch(e){}
  }
  function sessionLoggedAtExpired(v){
    const t=Date.parse(v?.loggedAt||'');
    return Number.isFinite(t)&&t>0&&Date.now()-t>SESSION_TTL_MS;
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
  function expireSession(){
    explicitClearArmed=true;
    session=null;currentView='';
    writePrimary();clearBackup({draft:true});
    explicitClearArmed=false;
  }
  function clearSessionExplicit(reason='logout'){
    explicitClearArmed=true;
    session=null;currentView='';
    writePrimary();clearBackup({draft:true});
    try{sessionStorage.setItem('enl_last_session_clear_reason',String(reason))}catch(e){}
    explicitClearArmed=false;
    return true;
  }

  // Restore before authentication and app-shell modules boot. A 12-hour inactivity window is local-only;
  // returning from the phone home screen does not call the server just to keep the login alive.
  const bootStored=readBackup();
  if(session){
    const ageBase=bootStored.savedAt||Date.parse(session.loggedAt||'')||Date.now();
    if((bootStored.expired&&!bootStored.session)||(Date.now()-ageBase>SESSION_TTL_MS&&sessionLoggedAtExpired(session)))expireSession();
    else {lastActiveAt=Math.max(ageBase,Date.now());persistBackup(session,true);restoreView()}
  }else if(bootStored.session){
    session=bootStored.session;lastActiveAt=bootStored.savedAt||Date.now();writePrimary();restoreView();persistBackup(session,true);
  }else if(bootStored.expired){clearBackup({draft:true})}

  if(originalSave){
    saveSession=function(){
      if(session){
        writePrimary();persistBackup(session,true);return;
      }
      if(explicitClearArmed){writePrimary();clearBackup({draft:true});explicitClearArmed=false;return}
      // A mobile WebView can transiently lose the in-memory session while backgrounding/recreating a page.
      // Do not treat that transient null as a user logout; recover the durable local session instead.
      const stored=readBackup();
      if(stored.session){session=stored.session;lastActiveAt=stored.savedAt||Date.now();writePrimary();restoreView();return}
      writePrimary();
      if(stored.expired)clearBackup({draft:true});
    };
  }

  // The visible logout button is an explicit user action, so clear the durable session before its normal handler runs.
  document.addEventListener('click',e=>{if(e.target?.closest?.('#logoutBtn'))clearSessionExplicit('logout')},true);

  let draftTimer=null;
  function keepCurrent(){
    if(!session||explicitClearArmed)return;
    lastActiveAt=Date.now();persistBackup(session,true);persistView();saveDraft();
  }
  function restoreForeground(){
    if(explicitClearArmed)return;
    const stored=readBackup();
    const freshest=Math.max(Number(stored.savedAt||0),Number(lastActiveAt||0));
    if((stored.expired&&!session)||(session&&freshest&&Date.now()-freshest>SESSION_TTL_MS)){
      expireSession();
      setTimeout(()=>{try{window.render?.()}catch(e){}},0);
      return;
    }
    if(!session&&stored.session){
      session=stored.session;lastActiveAt=stored.savedAt||Date.now();writePrimary();restoreView();
      setTimeout(()=>{try{window.render?.()}catch(e){}},0);
    }
    if(session){lastActiveAt=Date.now();persistBackup(session,true);persistView()}
  }

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
  window.ENL_SESSION_IDLE_TTL_MS=SESSION_TTL_MS;
  window.ENL_SESSION_REFRESH_VERSION=VERSION;
})();