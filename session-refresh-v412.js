/* E&L Accident Report App v4.1.2 - refresh-safe login session */
(function(){
  'use strict';
  const VERSION='4.1.2-r17';
  const BACKUP_KEY='enl_safety_session_refresh_v412';
  const COOKIE_KEY='enl_safety_session_refresh_v412';
  const MAX_AGE=60*60*24*30;

  function validSession(v){
    if(!v||typeof v!=='object')return false;
    if(v.userId)return true;
    const u=v.worker||v.manager;
    return !!(u&&typeof u==='object'&&u.id&&u.name&&u.role);
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
    if(!validSession(v))return;
    try{localStorage.setItem(BACKUP_KEY,JSON.stringify(v))}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(v))}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`}catch(e){}
  }
  function clearBackup(){
    try{localStorage.removeItem(BACKUP_KEY)}catch(e){}
    try{document.cookie=`${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax; Secure`}catch(e){}
  }

  const originalSave=typeof saveSession==='function'?saveSession:null;
  if(!session){
    const restored=readBackup();
    if(restored){
      session=restored;
      try{originalSave?.()}catch(e){}
    }
  }
  if(session)persistBackup(session);

  if(originalSave){
    saveSession=function(){
      try{originalSave()}catch(e){console.warn('primary session save skipped',e)}
      if(session)persistBackup(session);else clearBackup();
    };
  }

  function keepCurrent(){if(session)persistBackup(session)}
  window.addEventListener('pagehide',keepCurrent,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')keepCurrent()});

  if(!document.getElementById('enlRefreshSafeCss412')){
    const s=document.createElement('style');s.id='enlRefreshSafeCss412';
    s.textContent='html,body{overscroll-behavior-y:none}body{overscroll-behavior-y:contain}';
    document.head.appendChild(s);
  }

  window.enlClearRefreshSession=function(){session=null;try{saveSession()}catch(e){clearBackup()}};
  window.ENL_SESSION_REFRESH_VERSION=VERSION;
})();