/* E&L Incident shared sync v4.1.1 - authoritative server sync */
(function(){
  'use strict';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync-v411';
  const CLIENT='incident-report-v2';
  let applyingRemote=false,syncing=false,pending=false,serverReady=false,dirty=false;
  let syncTimer=null;
  const deferredDeletedIds=new Set();
  let lastIds=new Set((data.incidents||[]).map(x=>x.id));
  let lastSig=signature(data.incidents||[]);
  const baseSaveData=saveData;
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');

  function signature(arr){return JSON.stringify((arr||[]).map(i=>[i.id,i.updatedAt||'',i.status||'',i.priority||'',i.corrective?.status||'',i.reporterId||'',(i.readReceipts||[]).map(r=>`${r.userId}:${r.readAt}`).sort().join('|')]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))}
  function actor(){const u=currentUser();return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  function authProof(){
    let u=null;try{u=currentUser?.()||null}catch(e){}
    let passwordHash=String(u?.passwordHash||'').trim(),pinHash=String(u?.pinHash||'').trim();
    if(!passwordHash&&u?.id){try{const local=(data?.users||[]).find(x=>String(x?.id||'')===String(u.id));passwordHash=String(local?.passwordHash||'').trim()}catch(e){}}
    return {actorPasswordHash:passwordHash||undefined,actorPinHash:pinHash||undefined};
  }
  async function proofHash(text){const b=new TextEncoder().encode(String(text||'')),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function cacheProof(hash){
    const u=currentUser?.();if(!u||!hash)return;
    const r=roleNorm(u.role);
    if(['safety','manager','executive'].includes(r)){
      u.passwordHash=hash;
      try{const x=(data?.users||[]).find(v=>String(v?.id||'')===String(u.id||''));if(x)x.passwordHash=hash;baseSaveData()}catch(e){}
      try{if(session?.manager)session.manager.passwordHash=hash}catch(e){}
    }else{
      u.pinHash=hash;
      try{if(session?.manager)session.manager.pinHash=hash;if(session?.worker)session.worker.pinHash=hash}catch(e){}
    }
    try{saveSession?.()}catch(e){}
  }
  async function call(body,timeout=9000,retryProof=true){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
    try{
      const payload={...body,...authProof()};
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(payload),signal:controller?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if((!r.ok||j?.ok===false)&&j?.message==='auth_proof_required'&&retryProof){
        const u=currentUser?.(),label=['safety','manager','executive'].includes(roleNorm(u?.role))?'현재 계정 비밀번호':'현재 비밀번호(PIN)';
        const pw=prompt(`공식 사고기록을 서버에 저장하려면 ${label}를 다시 입력해 주세요.`);
        if(!String(pw||'').trim())throw new Error('auth_proof_required');
        cacheProof(await proofHash(pw));
        return await call(body,timeout,false);
      }
      if(!r.ok||j?.ok===false){
        if(j?.message==='auth_proof_required')alert('비밀번호 확인에 실패했습니다. 공식 사고기록은 서버에 반영되지 않았습니다.');
        throw new Error(j?.message||`sync_http_${r.status}`);
      }
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }

  function persistRemote(next){
    data.incidents=[...(next||[])].sort((x,y)=>new Date(y.occurredAt||0)-new Date(x.occurredAt||0));
    applyingRemote=true;try{baseSaveData()}finally{applyingRemote=false}
    lastIds=new Set(data.incidents.map(x=>x.id));lastSig=signature(data.incidents);dirty=false;
    try{window.enlAuditSnapshotRefresh?.()}catch(e){}
  }

  function scopedRemote(remote,a){
    if(!Array.isArray(remote))return [];
    if(['safety','manager','executive'].includes(a?.role))return remote.filter(r=>r?.id);
    if(a?.role==='field'||a?.role==='worker')return remote.filter(r=>r?.id&&String(r.siteId||'')===String(a.siteId||''));
    return [];
  }

  function replaceFromServer(remote){
    const a=actor();if(!a)return false;
    const next=scopedRemote(remote,a);
    const before=signature(data.incidents||[]),after=signature(next);
    if(before!==after){persistRemote(next);return true}
    lastIds=new Set(next.map(x=>x.id));lastSig=after;dirty=false;return false;
  }

  async function push(deletedIds=[]){
    const a=actor();if(!a||!serverReady)return;
    if(['manager','executive'].includes(a.role))return;
    let incidents=[...(data.incidents||[])];
    if(a.role==='field')incidents=incidents.filter(i=>String(i.siteId||'')===String(a.siteId||''));
    if(a.role==='worker')incidents=incidents.filter(i=>String(i.siteId||'')===String(a.siteId||'')&&!i.workerPublicOnly);
    const deletions=a.role==='safety'?deletedIds:[];
    await call({action:'push',actor:a,role:a.role,siteId:a.siteId,incidents,deletedIds:deletions});
  }

  function uiWriteBusy(){
    return !!document.querySelector('#unifiedReportForm,#reportForm,.modal');
  }
  function canAutoRender(){
    try{if(window.enlUiModalBusy?.())return false}catch(e){}
    return !uiWriteBusy()&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'')
  }
  async function pull(renderIfChanged=true){
    const a=actor();if(!a)return false;
    const res=await call({action:'pull',actor:a,role:a.role,siteId:a.siteId});
    // Never apply a remote snapshot over an unsent local edit or an actively
    // edited report form. Applying the pull here can reset filled fields and,
    // for report edits, detach the object the submit handler is editing.
    if(dirty||uiWriteBusy()){serverReady=true;return false}
    const changed=replaceFromServer(res?.incidents||[]);serverReady=true;
    if(changed&&renderIfChanged&&canAutoRender())setTimeout(()=>{try{renderShell(currentUser())}catch(e){}},0);
    return changed;
  }

  async function acknowledge(incidentId,u=currentUser()){
    const a=u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:actor();
    if(!a||!['manager','executive'].includes(a.role))throw new Error('forbidden');
    const res=await call({action:'acknowledge',actor:a,role:a.role,incidentId},10000);
    if(res?.incident){const next=(data.incidents||[]).map(i=>String(i.id)===String(incidentId)?res.incident:i);persistRemote(next)}else await pull(false);
    return res;
  }

  function scheduleSync(delay=250,deletedIds=[]){
    (deletedIds||[]).forEach(id=>{if(id)deferredDeletedIds.add(id)});
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{syncTimer=null;syncNow([])},delay);
  }

  async function syncNow(deletedIds=[]){
    const a=actor();if(!a)return;
    (deletedIds||[]).forEach(id=>{if(id)deferredDeletedIds.add(id)});
    if(syncTimer){clearTimeout(syncTimer);syncTimer=null}
    if(syncing){pending=true;return}
    syncing=true;
    const queuedDeletes=[...deferredDeletedIds];deferredDeletedIds.clear();
    let failed=false;
    try{
      if(!serverReady){
        await pull(true);serverReady=true;
        if(['manager','executive'].includes(a.role)){dirty=false;return}
        // A local save may have happened while the first pull was in flight.
        // Preserve and flush it instead of clearing dirty and losing the edit.
        if(dirty||queuedDeletes.length){await push(queuedDeletes);dirty=false;await pull(true)}
        return;
      }
      if(['manager','executive'].includes(a.role)){dirty=false;await pull(true);return}
      if(dirty||queuedDeletes.length){await push(queuedDeletes);dirty=false;await pull(true)}
      else await pull(true);
    }catch(e){failed=true;queuedDeletes.forEach(id=>deferredDeletedIds.add(id));console.warn('incident sync skipped',e)}
    finally{
      syncing=false;
      if(pending){pending=false;scheduleSync(500)}
      else if(!failed&&deferredDeletedIds.size)scheduleSync(250)
    }
  }

  saveData=function(){
    baseSaveData();if(applyingRemote)return;
    const a=actor(),nowIds=new Set((data.incidents||[]).map(x=>x.id)),deleted=[...lastIds].filter(id=>!nowIds.has(id)),sig=signature(data.incidents||[]);
    const changed=sig!==lastSig||deleted.length>0;lastIds=nowIds;lastSig=sig;
    if(a&&['manager','executive'].includes(a.role)){dirty=false;return}
    if(changed)dirty=true;
    if(changed&&currentUser())scheduleSync(250,deleted);
  };

  window.enlIncidentApi=call;
  window.enlIncidentSyncNow=()=>syncNow([]);
  window.enlIncidentPullNow=()=>pull(true);
  window.enlIncidentAcknowledge=acknowledge;
  window.enlIncidentServerReady=()=>serverReady;

  function syncOnForeground(){if(!currentUser())return;scheduleSync(120)}
  if(currentUser())scheduleSync(120);
  setInterval(()=>{if(!currentUser()||document.visibilityState==='hidden'||syncing||syncTimer)return;if(dirty||deferredDeletedIds.size)syncNow([]);else pull(true).catch(()=>{})},15000);
  window.addEventListener('online',()=>{if(currentUser())scheduleSync(500)});
  window.addEventListener('pageshow',syncOnForeground);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncOnForeground()});
  window.ENL_INCIDENT_SYNC_VERSION='4.1.1-r16-official-auth-reprompt';
})();