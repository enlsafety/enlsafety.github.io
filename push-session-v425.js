/* E&L Accident Report App v4.2.5 - push ownership + post-login deep links */
(function(){
  'use strict';
  const VERSION='4.2.5-push-session2';
  const CLAIM_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-claim-v425';
  const CLIENT='incident-report-v2';
  const SW_URL='/sw-v418.js?v=4.2.5-pwa3';
  const PREF_PREFIX='enl_push_preferences_v1_';
  const PENDING_KEY='enl_pending_push_incident_v425';
  const PENDING_TTL=30*60*1000;
  let claimBusy=false,lastClaimKey='',openBusy=false,lastUserId='';

  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const actor=()=>{try{return window.enlCurrentActor?.()||window.currentUser?.()||null}catch(e){try{return window.currentUser?.()||null}catch(_){return null}}};
  const userId=u=>String(u?.id||u?.personnelId||u?.username||'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function defaultPrefs(u){
    const r=roleNorm(u?.role);
    if(r==='safety')return {incident_progress:true,action_progress:true,inquiry:true,management_views:true,urgent:true};
    if(r==='manager'||r==='executive')return {incident_progress:true,action_progress:true,inquiry:true,management_views:false,urgent:true};
    return {incident_progress:true,action_progress:true,inquiry:true,management_views:false,urgent:false};
  }
  function prefs(u){try{const x=JSON.parse(localStorage.getItem(PREF_PREFIX+userId(u))||'{}');return {...defaultPrefs(u),...(x&&typeof x==='object'?x:{})}}catch(e){return defaultPrefs(u)}}

  async function registerSw(){
    if(!('serviceWorker' in navigator))return null;
    try{await navigator.serviceWorker.register(SW_URL,{scope:'/'});return await navigator.serviceWorker.ready}catch(e){console.warn('push session SW update skipped',e);return null}
  }
  async function currentSubscription(){
    const reg=await registerSw();if(!reg||!('pushManager' in reg))return null;
    try{return await reg.pushManager.getSubscription()}catch(e){return null}
  }
  async function claimForCurrentUser(force=false){
    const u=actor();if(!u||claimBusy||!('Notification' in window)||Notification.permission!=='granted')return false;
    const sub=await currentSubscription();if(!sub)return false;
    const key=userId(u)+'|'+String(sub.endpoint||'');if(!force&&key===lastClaimKey)return true;
    claimBusy=true;
    try{
      const r=await fetch(CLAIM_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action:'claim',actor:u,subscription:sub.toJSON(),preferences:prefs(u),userAgent:navigator.userAgent}),cache:'no-store'});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||`http_${r.status}`);
      lastClaimKey=key;return true;
    }catch(e){console.warn('push device ownership refresh skipped',e?.message||e);return false}
    finally{claimBusy=false}
  }
  window.enlPushClaimCurrentDevice=()=>claimForCurrentUser(true);

  function savePendingFromUrl(){
    let url;try{url=new URL(location.href)}catch(e){return}
    const id=String(url.searchParams.get('incident')||'').trim();if(!id)return;
    const item={incidentId:id,kind:String(url.searchParams.get('kind')||''),at:Date.now()};
    try{localStorage.setItem(PENDING_KEY,JSON.stringify(item))}catch(e){}
    url.searchParams.delete('incident');url.searchParams.delete('kind');url.searchParams.delete('push');
    try{history.replaceState(history.state,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():'')+url.hash)}catch(e){}
  }
  function pending(){
    try{const p=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');if(!p?.incidentId)return null;if(Date.now()-Number(p.at||0)>PENDING_TTL){localStorage.removeItem(PENDING_KEY);return null}return p}catch(e){return null}
  }
  function clearPending(){try{localStorage.removeItem(PENDING_KEY)}catch(e){}}
  function incidents(){try{return typeof data!=='undefined'&&Array.isArray(data?.incidents)?data.incidents:(Array.isArray(window.data?.incidents)?window.data.incidents:[])}catch(e){return []}}
  function incidentById(id){return incidents().find(x=>String(x?.id||'')===String(id))||null}
  function siteName(id){try{return typeof siteById==='function'?siteById(id)?.name||id||'-':window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}}
  function fmtx(v){try{return typeof fmt==='function'?fmt(v):(v?new Date(v).toLocaleString('ko-KR'):'-')}catch(e){return v||'-'}}
  function primeWorkflowIncident(id){
    try{const b=document.createElement('button');b.type='button';b.hidden=true;b.dataset.incId=String(id);document.body.appendChild(b);b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:false}));b.remove()}catch(e){}
  }

  function showPendingReviewNotice(i){
    const title='긴급 사고가 접수되었습니다';
    const detail=`${siteName(i?.siteId)} · ${i?.eventType||i?.category||'사고'} · ${fmtx(i?.occurredAt)}`;
    const message='현재 안전관리자 검토대기 단계입니다. 안전관리자 승인 후 관리자·경영진 상세 열람 및 열람확인이 가능합니다.';
    if(typeof openModal==='function'){
      openModal(`<div class="modal-head"><div><div class="ey">URGENT INCIDENT</div><h2>${esc(title)}</h2><p>${esc(detail)}</p></div><button class="x" data-close>×</button></div><div style="padding:14px"><div style="padding:14px;border:2px solid #e2ad4f;border-radius:12px;background:#fff8e8;color:#624818;font-weight:850;line-height:1.6">${esc(message)}</div></div>`);
    }else alert(`${title}\n${detail}\n\n${message}`);
  }

  async function openPendingIncident(){
    if(openBusy)return;const p=pending(),u=actor();if(!p||!u)return;
    openBusy=true;
    try{
      try{await claimForCurrentUser(false)}catch(e){}
      try{await window.enlIncidentPullNow?.()}catch(e){}
      const i=incidentById(p.incidentId);if(!i)return;
      const r=roleNorm(u.role),status=String(i.status||'');
      if(['manager','executive'].includes(r)&&!['approved','closed'].includes(status)){
        clearPending();setTimeout(()=>showPendingReviewNotice(i),80);return;
      }
      clearPending();primeWorkflowIncident(i.id);
      setTimeout(()=>{
        try{
          if(typeof window.enlOpenIncidentReview==='function')window.enlOpenIncidentReview(i.id,r==='safety',window.currentUser?.()||u);
          else if(typeof window.openIncidentModal==='function')window.openIncidentModal(i.id,r==='safety',window.currentUser?.()||u);
        }catch(e){console.warn('push incident open failed',e)}
      },80);
    }finally{openBusy=false}
  }

  function onUserReady(){
    const u=actor();const id=userId(u);
    if(!u){lastUserId='';return}
    if(id!==lastUserId){lastUserId=id;lastClaimKey='';setTimeout(()=>claimForCurrentUser(true),120)}
    setTimeout(openPendingIncident,220);
  }

  savePendingFromUrl();registerSw();
  const baseShell=window.renderShell;
  if(typeof baseShell==='function')window.renderShell=function(u){const out=baseShell.apply(this,arguments);setTimeout(onUserReady,60);return out};
  window.addEventListener('pageshow',()=>setTimeout(onUserReady,120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(onUserReady,120)});
  setTimeout(onUserReady,150);
  window.ENL_PUSH_SESSION_VERSION=VERSION;
})();
