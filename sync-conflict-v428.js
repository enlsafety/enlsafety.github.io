/* E&L Accident Report App v4.2.8 - optimistic incident edit conflict handling */
(function(){
  'use strict';
  const VERSION='4.2.8-sync-conflict1';
  const SYNC_API_FRAGMENT='/functions/v1/enl-incident-sync-v411';
  const BASE_KEY='_syncBaseVersion';
  const VERSION_KEY='_syncVersion';
  const MUTATION_KEY='_syncMutationId';
  const baseline=new Map();
  const taggedAt=new Map();
  let conflictBusy=false;

  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const actor=()=>{try{return window.enlCurrentActor?.()||(()=>{const u=currentUser?.();return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),siteId:u.siteId||''}:null})()}catch(e){return null}};
  const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.trunc(n):0};
  const newMutationId=(a,id)=>`${String(a?.id||'user')}:${String(id||'incident')}:${Date.now()}:${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;

  function absorb(list){
    if(!Array.isArray(list))return;
    for(const i of list){
      if(!i?.id)continue;
      baseline.set(String(i.id),{updatedAt:String(i.updatedAt||''),version:num(i[VERSION_KEY])});
      taggedAt.delete(String(i.id));
    }
  }
  absorb(data?.incidents||[]);

  const previousSave=window.saveData;
  if(typeof previousSave==='function'){
    window.saveData=function(){
      try{
        const a=actor();
        if(a&&!['manager','executive'].includes(roleNorm(a.role))){
          for(const i of data?.incidents||[]){
            if(!i?.id||i.workerPublicOnly)continue;
            const id=String(i.id),stamp=String(i.updatedAt||''),base=baseline.get(id);
            const changed=!base||stamp!==base.updatedAt;
            if(!changed)continue;
            if(taggedAt.get(id)===stamp&&i[MUTATION_KEY])continue;
            i[BASE_KEY]=base?num(base.version):num(i[VERSION_KEY]);
            i[MUTATION_KEY]=newMutationId(a,id);
            taggedAt.set(id,stamp);
          }
        }
      }catch(e){console.warn('incident sync version tagging skipped',e)}
      return previousSave.apply(this,arguments);
    };
    try{saveData=window.saveData}catch(e){}
  }

  async function resolveConflict(message){
    if(conflictBusy)return;
    conflictBusy=true;
    try{
      alert('같은 사고를 다른 사용자가 먼저 수정했습니다. 최신 저장내용을 다시 불러옵니다. 화면을 확인한 뒤 필요한 내용을 다시 수정해 주세요.');
      await window.enlIncidentPullNow?.();
    }catch(e){console.warn('incident conflict refresh failed',e,message)}
    finally{conflictBusy=false}
  }

  const previousFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:String(input?.url||'');
    let body=null;
    if(url.includes(SYNC_API_FRAGMENT))try{body=JSON.parse(init?.body||'null')}catch(e){}
    const res=await previousFetch(input,init);
    if(!url.includes(SYNC_API_FRAGMENT)||!body?.action)return res;

    if(body.action==='pull'&&res.ok){
      try{const j=await res.clone().json();absorb(j?.incidents||[])}catch(e){}
    }else if(body.action==='push'&&!res.ok){
      try{
        const j=await res.clone().json(),m=String(j?.message||'');
        if(m.includes('enl_sync_conflict'))setTimeout(()=>resolveConflict(m),0);
      }catch(e){}
    }
    return res;
  };

  window.ENL_SYNC_CONFLICT_VERSION=VERSION;
})();
