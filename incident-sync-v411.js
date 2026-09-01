/* E&L Incident shared sync v4.1.1 - authoritative server sync */
(function(){
  'use strict';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync-v411';
  const CLIENT='incident-report-v2';
  let applyingRemote=false,syncing=false,pending=false,serverReady=false,dirty=false;
  let lastIds=new Set((data.incidents||[]).map(x=>x.id));
  let lastSig=signature(data.incidents||[]);
  const baseSaveData=saveData;

  function signature(arr){return JSON.stringify((arr||[]).map(i=>[i.id,i.updatedAt||'',i.status||'',i.corrective?.status||'',i.reporterId||'']).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))}
  function actor(){const u=currentUser();return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:u.role||'',position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  async function call(body,timeout=9000){const controller=typeof AbortController!=='undefined'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),timeout):null;try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:controller?.signal,cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||`sync_http_${r.status}`);return j}finally{if(timer)clearTimeout(timer)}}

  function persistRemote(next){
    data.incidents=[...(next||[])].sort((x,y)=>new Date(y.occurredAt||0)-new Date(x.occurredAt||0));
    applyingRemote=true;try{baseSaveData()}finally{applyingRemote=false}
    lastIds=new Set(data.incidents.map(x=>x.id));lastSig=signature(data.incidents);dirty=false;
    try{window.enlAuditSnapshotRefresh?.()}catch(e){}
  }

  function scopedRemote(remote,a){
    if(!Array.isArray(remote))return [];
    if(a?.role==='safety'||a?.role==='final')return remote.filter(r=>r?.id);
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
    let incidents=[...(data.incidents||[])];
    if(a.role==='field')incidents=incidents.filter(i=>String(i.siteId||'')===String(a.siteId||''));
    if(a.role==='worker')incidents=incidents.filter(i=>String(i.siteId||'')===String(a.siteId||'')&&!i.workerPublicOnly);
    const deletions=a.role==='safety'?deletedIds:[];
    await call({action:'push',actor:a,role:a.role,siteId:a.siteId,incidents,deletedIds:deletions});
  }

  function canAutoRender(){return !document.querySelector('.modal')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'')}
  async function pull(renderIfChanged=true){
    const a=actor();if(!a)return false;
    const res=await call({action:'pull',actor:a,role:a.role,siteId:a.siteId});
    const changed=replaceFromServer(res?.incidents||[]);serverReady=true;
    if(changed&&renderIfChanged&&canAutoRender())setTimeout(()=>{try{renderShell(currentUser())}catch(e){}},0);
    return changed;
  }

  async function syncNow(deletedIds=[]){
    if(!currentUser())return;
    if(syncing){pending=true;return}
    syncing=true;
    try{
      if(!serverReady){await pull(true);serverReady=true;dirty=false;return}
      if(dirty||deletedIds.length){await push(deletedIds);dirty=false;await pull(true)}
      else await pull(true);
    }catch(e){console.warn('incident sync skipped',e)}
    finally{syncing=false;if(pending){pending=false;setTimeout(()=>syncNow([]),500)}}
  }

  saveData=function(){
    baseSaveData();if(applyingRemote)return;
    const nowIds=new Set((data.incidents||[]).map(x=>x.id)),deleted=[...lastIds].filter(id=>!nowIds.has(id)),sig=signature(data.incidents||[]);
    const changed=sig!==lastSig||deleted.length>0;lastIds=nowIds;lastSig=sig;if(changed)dirty=true;
    if(changed&&currentUser())setTimeout(()=>syncNow(deleted),250);
  };

  window.enlIncidentApi=call;
  window.enlIncidentSyncNow=()=>syncNow([]);
  window.enlIncidentPullNow=()=>pull(true);
  window.enlIncidentServerReady=()=>serverReady;

  if(currentUser())setTimeout(()=>syncNow([]),120);
  setInterval(()=>{if(!currentUser())return;if(dirty)syncNow([]);else pull(true).catch(()=>{})},15000);
  window.addEventListener('online',()=>{if(currentUser())setTimeout(()=>syncNow([]),500)});
  window.ENL_INCIDENT_SYNC_VERSION='4.1.1-r8';
})();