/* E&L Incident shared sync v3.9.0 - role aware */
(function(){
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync';
  const CLIENT='incident-report-v2';
  let applyingRemote=false, syncing=false, pending=false;
  let lastIds=new Set((data.incidents||[]).map(x=>x.id));
  const baseSaveData=saveData;

  function actor(){
    const u=currentUser();
    return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:u.role||'',position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  }
  async function call(body,timeout=9000){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:controller?.signal});
      if(!r.ok)throw new Error(`sync_http_${r.status}`);
      return await r.json();
    }finally{if(timer)clearTimeout(timer)}
  }
  function merge(remote){
    if(!Array.isArray(remote))return false;
    const map=new Map((data.incidents||[]).map(i=>[i.id,i]));let changed=false;
    for(const r of remote){
      if(!r?.id)continue;const local=map.get(r.id);
      if(!local){map.set(r.id,r);changed=true;continue}
      const lt=new Date(local.updatedAt||local.createdAt||0).getTime(),rt=new Date(r.updatedAt||r.createdAt||0).getTime();
      if(rt>lt){map.set(r.id,r);changed=true}
    }
    if(changed){
      data.incidents=[...map.values()].sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
      applyingRemote=true;try{baseSaveData()}finally{applyingRemote=false}
      lastIds=new Set(data.incidents.map(x=>x.id));
      try{window.enlAuditSnapshotRefresh?.()}catch(e){}
    }
    return changed;
  }
  async function push(deletedIds=[]){
    const a=actor();if(!a)return;
    let incidents=[...(data.incidents||[])];
    if(a.role==='field')incidents=incidents.filter(i=>i.siteId===a.siteId);
    if(a.role==='worker')incidents=incidents.filter(i=>i.siteId===a.siteId&&(i.reporterId===a.id||i.reporterName===a.name));
    await call({action:'push',actor:a,role:a.role,siteId:a.siteId,incidents,deletedIds});
  }
  async function pull(renderIfChanged=true){
    const a=actor();if(!a||a.role==='worker')return false;
    const res=await call({action:'pull',actor:a,role:a.role,siteId:a.siteId});
    const changed=merge(res?.incidents||[]);
    if(changed&&renderIfChanged&&!document.querySelector('.modal')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'')){
      setTimeout(()=>{try{renderShell(currentUser())}catch(e){}},0);
    }
    return changed;
  }
  async function syncNow(deletedIds=[]){
    if(!currentUser())return;if(syncing){pending=true;return}syncing=true;
    try{await push(deletedIds);await pull(true)}catch(e){console.warn('incident sync skipped',e)}finally{syncing=false;if(pending){pending=false;setTimeout(()=>syncNow([]),500)}}
  }
  saveData=function(){
    baseSaveData();if(applyingRemote)return;
    const nowIds=new Set((data.incidents||[]).map(x=>x.id));const deleted=[...lastIds].filter(id=>!nowIds.has(id));lastIds=nowIds;
    if(currentUser())setTimeout(()=>syncNow(deleted),350);
  };
  window.enlIncidentApi=call;
  window.enlIncidentSyncNow=()=>syncNow([]);
  if(currentUser())setTimeout(()=>syncNow([]),900);
  setInterval(()=>{const u=currentUser();if(u&&['safety','final','field'].includes(u.role))pull(true).catch(()=>{})},15000);
  window.addEventListener('online',()=>{if(currentUser())setTimeout(()=>syncNow([]),700)});
})();
