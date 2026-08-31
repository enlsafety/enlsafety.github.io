/* E&L Incident shared sync v4.1.1 - worker public/private separation */
(function(){
  'use strict';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync-v411';
  const CLIENT='incident-report-v2';
  let applyingRemote=false,syncing=false,pending=false;
  let lastIds=new Set((data.incidents||[]).map(x=>x.id));
  const baseSaveData=saveData;
  function actor(){const u=currentUser();return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:u.role||'',position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  async function call(body,timeout=9000){const controller=typeof AbortController!=='undefined'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),timeout):null;try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:controller?.signal,cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||`sync_http_${r.status}`);return j}finally{if(timer)clearTimeout(timer)}}
  function merge(remote){if(!Array.isArray(remote))return false;const a=actor(),map=new Map((data.incidents||[]).map(i=>[i.id,i]));let changed=false;for(const r of remote){if(!r?.id)continue;if((a?.role==='field'||a?.role==='worker')&&r.siteId!==a.siteId)continue;const local=map.get(r.id);if(!local){map.set(r.id,r);changed=true;continue}const lt=new Date(local.updatedAt||local.createdAt||0).getTime(),rt=new Date(r.updatedAt||r.createdAt||0).getTime();if(rt>lt||JSON.stringify(local.workerPublic||null)!==JSON.stringify(r.workerPublic||null)||!!local.workerPublicOnly!==!!r.workerPublicOnly){map.set(r.id,r);changed=true}}if(changed){let next=[...map.values()];if(a?.role==='field'||a?.role==='worker')next=next.filter(i=>i.siteId===a.siteId);data.incidents=next.sort((x,y)=>new Date(y.occurredAt||0)-new Date(x.occurredAt||0));applyingRemote=true;try{baseSaveData()}finally{applyingRemote=false}lastIds=new Set(data.incidents.map(x=>x.id));try{window.enlAuditSnapshotRefresh?.()}catch(e){}}return changed}
  async function push(deletedIds=[]){const a=actor();if(!a)return;let incidents=[...(data.incidents||[])];if(a.role==='field')incidents=incidents.filter(i=>i.siteId===a.siteId);if(a.role==='worker')incidents=incidents.filter(i=>i.siteId===a.siteId&&!i.workerPublicOnly);const deletions=a.role==='safety'?deletedIds:[];await call({action:'push',actor:a,role:a.role,siteId:a.siteId,incidents,deletedIds:deletions})}
  function mayAutoRender(a){return !!a&&a.role!=='safety'}
  async function pull(renderIfChanged=true){const a=actor();if(!a)return false;const res=await call({action:'pull',actor:a,role:a.role,siteId:a.siteId});const changed=merge(res?.incidents||[]);if(changed&&renderIfChanged&&mayAutoRender(a)&&!document.querySelector('.modal')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'')){setTimeout(()=>{try{renderShell(currentUser())}catch(e){}},0)}return changed}
  async function syncNow(deletedIds=[]){if(!currentUser())return;if(syncing){pending=true;return}syncing=true;try{await push(deletedIds);await pull(true)}catch(e){console.warn('incident sync skipped',e)}finally{syncing=false;if(pending){pending=false;setTimeout(()=>syncNow([]),500)}}}
  saveData=function(){baseSaveData();if(applyingRemote)return;const nowIds=new Set((data.incidents||[]).map(x=>x.id)),deleted=[...lastIds].filter(id=>!nowIds.has(id));lastIds=nowIds;if(currentUser())setTimeout(()=>syncNow(deleted),350)};
  window.enlIncidentApi=call;window.enlIncidentSyncNow=()=>syncNow([]);window.enlIncidentPullNow=()=>pull(true);
  if(currentUser())setTimeout(()=>syncNow([]),800);
  setInterval(()=>{if(currentUser())pull(true).catch(()=>{})},15000);
  window.addEventListener('online',()=>{if(currentUser())setTimeout(()=>syncNow([]),700)});
  window.ENL_INCIDENT_SYNC_VERSION='4.1.1';
})();