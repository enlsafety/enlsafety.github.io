/* E&L Incident shared sync v3.8.0 - non-blocking stable sync */
(function(){
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync';
  const CLIENT='incident-report-v1';
  let applyingRemote=false;
  let syncing=false;
  let pending=false;
  let lastIds=new Set((data.incidents||[]).map(x=>x.id));
  const baseSaveData=saveData;

  function scope(){const u=currentUser();return {u,role:u?.role||'',siteId:u?.siteId||''}}
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
    const map=new Map((data.incidents||[]).map(i=>[i.id,i]));
    let changed=false;
    for(const r of remote){
      if(!r?.id)continue;
      const local=map.get(r.id);
      if(!local){map.set(r.id,r);changed=true;continue}
      const lt=new Date(local.updatedAt||local.createdAt||0).getTime();
      const rt=new Date(r.updatedAt||r.createdAt||0).getTime();
      if(rt>lt){map.set(r.id,r);changed=true}
    }
    if(changed){
      data.incidents=[...map.values()].sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
      applyingRemote=true;try{baseSaveData()}finally{applyingRemote=false}
      lastIds=new Set(data.incidents.map(x=>x.id));
    }
    return changed;
  }
  async function push(deletedIds=[]){
    const s=scope();if(!s.u)return;
    const incidents=(data.incidents||[]).filter(i=>s.role!=='field'||i.siteId===s.siteId);
    await call({action:'push',role:s.role,siteId:s.siteId,incidents,deletedIds});
  }
  async function pull(renderIfChanged=true){
    const s=scope();if(!s.u)return false;
    const res=await call({action:'pull',role:s.role,siteId:s.siteId});
    const changed=merge(res?.incidents||[]);
    if(changed&&renderIfChanged&&!document.querySelector('.modal')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'')){
      setTimeout(()=>{try{renderShell(currentUser())}catch(e){}},0);
    }
    return changed;
  }
  async function syncNow(deletedIds=[]){
    if(!currentUser())return;
    if(syncing){pending=true;return}
    syncing=true;
    try{await push(deletedIds);await pull(true)}catch(e){console.warn('incident sync skipped',e)}finally{
      syncing=false;if(pending){pending=false;setTimeout(()=>syncNow([]),500)}
    }
  }

  saveData=function(){
    baseSaveData();
    if(applyingRemote)return;
    const nowIds=new Set((data.incidents||[]).map(x=>x.id));
    const deleted=[...lastIds].filter(id=>!nowIds.has(id));
    lastIds=nowIds;
    if(currentUser())setTimeout(()=>syncNow(deleted),400);
  };

  try{
    const baseDoLogin=doLogin;
    doLogin=async function(e){
      const r=await baseDoLogin(e);
      setTimeout(()=>syncNow([]),700);
      return r;
    };
  }catch(e){console.warn('sync login hook skipped',e)}

  window.enlIncidentSyncNow=()=>syncNow([]);
  if(currentUser())setTimeout(()=>syncNow([]),900);
  setInterval(()=>{const u=currentUser();if(u&&u.role!=='field')pull(true).catch(()=>{})},15000);
  window.addEventListener('online',()=>{if(currentUser())setTimeout(()=>syncNow([]),800)});
})();
