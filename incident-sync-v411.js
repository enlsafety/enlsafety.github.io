/* E&L incident sync: per-record serialization and in-memory draft preservation. */
(function(){
  'use strict';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-sync-v411';
  const CLIENT='incident-report-v2';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');

  function actor(){const u=currentUser();return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  function authProof(){
    let u=null;try{u=currentUser?.()||null}catch(e){}
    const sessionUser=session?.manager||session?.worker||null;
    let passwordHash=String(u?.passwordHash||'').trim(),pinHash=String(u?.pinHash||'').trim();
    if(sessionUser&&String(sessionUser.id||sessionUser.personnelId||'')===String(u?.id||u?.personnelId||'')){
      if(!passwordHash)passwordHash=String(sessionUser.passwordHash||'').trim();
      if(!pinHash)pinHash=String(sessionUser.pinHash||'').trim();
    }
    if(!passwordHash&&u?.id){try{const local=(data?.users||[]).find(x=>String(x?.id||'')===String(u.id));passwordHash=String(local?.passwordHash||'').trim()}catch(e){}}
    return {actorPasswordHash:passwordHash||undefined,actorPinHash:pinHash||undefined};
  }
  // One queue per incident. Pulls may observe versions, but never advance the
  // base of a draft silently; only this tab's confirmed writes can be rebased.
  const authoritative=new Map(),history=new Map(),ownWrites=new Map();
  const queues=new Map(),inflight=new Map(),retryWrites=new Map(),failures=new Map(),drafts=new Map();
  const notices=new Map();
  let applyingRemote=false,syncing=false,pending=false,serverReady=false,dirty=false,syncTimer=null,pullSequence=0;
  let sessionKey='',lastPersisted='';
  const baseSaveData=saveData;
  const version=i=>Number(i?._syncVersion||0);
  const clone=v=>structuredClone(v);
  const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,stable(v[k])])):v;
  const metadata=['_pendingCommitId','_syncBaseVersion','_syncVersion','_syncMutationId','updatedAt','lastModifiedAt','lastModifiedBy','lastModifiedRole','lastModifiedPosition'];
  function comparable(i){const x=clone(i||{});for(const k of metadata)delete x[k];if(x.corrective)for(const k of metadata.filter(k=>k.startsWith('lastModified')))delete x.corrective[k];return x;}
  const signature=v=>JSON.stringify(stable(v));
  const contentSignature=i=>signature(comparable(i));
  const same=(a,b)=>contentSignature(a)===contentSignature(b);
  const find=id=>(data.incidents||[]).find(i=>String(i.id)===String(id));
  const key=a=>a?[a.id,a.role,a.siteId].join('|'):'';
  function scope(){const k=key(actor());if(k!==sessionKey){sessionKey=k;authoritative.clear();history.clear();ownWrites.clear();retryWrites.clear();failures.clear();drafts.clear();notices.clear();serverReady=false;for(const i of data.incidents||[])remember(i);}return k;}
  function remember(i){
    if(!i?.id)return false;const id=String(i.id),old=authoritative.get(id);
    if(old&&version(old)>version(i))return false;
    if(!history.has(id))history.set(id,new Map());const h=history.get(id);h.set(version(i),clone(i));
    while(h.size>16)h.delete(h.keys().next().value);
    authoritative.set(id,clone(i));return true;
  }
  function locallyChanged(i){return !!i&&!same(i,history.get(String(i.id))?.get(version(i))||authoritative.get(String(i.id)));}
  function hasDraft(id){return drafts.has(id)||failures.has(id)||!!queues.get(id)||locallyChanged(find(id));}
  function refreshDirty(){dirty=(data.incidents||[]).some(i=>!i.workerPublicOnly&&locallyChanged(i));return dirty;}
  function persistConfirmed(){
    // Keep unsent medical/incident drafts only in memory. Other app data still
    // uses its existing persistence implementation.
    const visible=data.incidents;data.incidents=[...authoritative.values()].map(clone);applyingRemote=true;
    try{const next=signature(data);if(next!==lastPersisted){baseSaveData();lastPersisted=next;}}catch(e){console.warn('confirmed incident cache unavailable',e.name);}finally{data.incidents=visible;applyingRemote=false;}
  }
  function uiWriteBusy(){return !!document.querySelector('#unifiedReportForm,#reportForm,.modal');}
  function canAutoRender(){try{if(window.enlUiModalBusy?.())return false}catch(e){}return !uiWriteBusy()&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'');}
  function errorOf(message,status=0){const e=new Error(message);e.status=status;return e;}
  const isConflict=e=>String(e?.message||'').includes('enl_sync_conflict');
  function errorMessage(e){
    const m=String(e?.message||'');
    if(isConflict(e))return '서버 자료 버전이 변경되어 저장하지 못했습니다. 작성 내용은 유지했습니다. 변경사항을 비교한 뒤 다시 검토해 주세요.';
    if(m==='session_auth_expired'||m==='session_changed')return '로그인 인증을 다시 확인해야 합니다. 작성 내용은 현재 화면에 유지했습니다. 다시 로그인한 뒤 저장을 재시도해 주세요.';
    if(e?.status===403||/forbidden|permission|read_only/.test(m))return '이 내용을 저장할 권한이 없습니다. 작성 내용은 유지했습니다. 계정과 사업장 권한을 확인해 주세요.';
    if(m==='save_in_progress')return '이 사고의 저장을 처리 중입니다. 완료될 때까지 잠시 기다려 주세요.';
    return '서버 저장을 확인하지 못했습니다. 작성 내용은 현재 화면에 유지했습니다. 연결 상태를 확인한 뒤 저장을 다시 시도해 주세요.';
  }
  function notifyFailure(e,id='',candidate){
    const noticeKey=[sessionKey,id,e.message].join('|');if(Date.now()-(notices.get(noticeKey)||0)<10000)return;
    notices.set(noticeKey,Date.now());const detail={id,error:e.message,status:e.status,message:errorMessage(e),draft:clone(candidate||drafts.get(id)||find(id)||{}),latest:clone(authoritative.get(id)||null)};
    const event=new CustomEvent('enl-incident-write-error',{detail,cancelable:true});window.dispatchEvent(event);
    if(!event.defaultPrevented)alert(detail.message);
  }
  async function call(body,timeout=9000){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({...body,...authProof()}),signal:controller?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false)throw errorOf(j?.message==='auth_proof_required'||r.status===401?'session_auth_expired':j?.message||`sync_http_${r.status}`,r.status);
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }
  function scopedRemote(items,a){return (Array.isArray(items)?items:[]).filter(i=>i?.id&&(['safety','manager','executive'].includes(a?.role)||['field','worker'].includes(a?.role)&&String(i.siteId)===String(a.siteId)));}
  async function pull(renderIfChanged=true){
    const a=actor();if(!a)return false;const owner=scope(),sequence=++pullSequence,started=new Map([...authoritative].map(([id,i])=>[id,version(i)]));
    const res=await call({action:'pull',actor:a,role:a.role,siteId:a.siteId});
    if(owner!==key(actor())||owner!==sessionKey)return false;
    const remote=scopedRemote(res.incidents,a),busy=uiWriteBusy();let changed=false;
    for(const saved of remote){
      const id=String(saved.id),protectedDraft=hasDraft(id),local=find(id);
      if(!remember(saved))continue;
      if(busy||protectedDraft)continue;
      if(!local||signature(local)!==signature(saved)){const idx=data.incidents.indexOf(local);if(idx<0)data.incidents.push(clone(saved));else data.incidents[idx]=clone(saved);changed=true;}
    }
    // Only the newest complete snapshot may remove records from the visible list.
    if(!busy&&!refreshDirty()&&sequence===pullSequence){const ids=new Set(remote.map(i=>String(i.id)));data.incidents=(data.incidents||[]).filter(i=>{const id=String(i.id);if(ids.has(id)||hasDraft(id)||started.get(id)!==version(authoritative.get(id)))return true;authoritative.delete(id);history.delete(id);changed=true;return false;});}
    serverReady=true;refreshDirty();persistConfirmed();
    if(changed&&renderIfChanged&&canAutoRender())setTimeout(()=>{if(canAutoRender())try{renderShell(currentUser())}catch(e){}},0);
    return changed;
  }
  function acceptSaved(saved,sent,visibleBefore){
    const id=String(saved.id),local=find(id),before=authoritative.get(id),unedited=!locallyChanged(local);
    if(!remember(saved))return authoritative.get(id);
    if(!local||unedited||visibleBefore&&same(local,visibleBefore)||same(local,sent||before)||same(local,saved)){
      const idx=data.incidents.indexOf(local);if(idx<0)data.incidents.unshift(clone(saved));else data.incidents[idx]=clone(saved);
    }
    refreshDirty();persistConfirmed();window.dispatchEvent(new CustomEvent('enl-incident-saved',{detail:clone(saved)}));return saved;
  }
  function enqueue(id,fn){
    const previous=queues.get(id)||Promise.resolve();
    const result=previous.catch(()=>{}).then(fn),tail=result.catch(()=>{});queues.set(id,tail);
    tail.then(()=>{if(queues.get(id)===tail)queues.delete(id);});return result;
  }
  function ownChain(id,from,to){let v=from;for(const step of ownWrites.get(id)||[])if(step.from===v&&step.to>v)v=step.to;return v===to;}
  function rebase(id,wanted,base,current){
    if(!base||!current||!ownChain(id,version(base),version(current)))throw errorOf('enl_sync_conflict_version',409);
    // Only ordinary factual text changes before approval may follow this tab's
    // earlier write. Workflow, evidence, approval and final records never merge.
    if(!['reported','rejected','supplement','supplement_submitted'].includes(current.status)||current.status!==base.status)throw errorOf('enl_sync_conflict_version',409);
    const old=comparable(base),draft=comparable(wanted),next=clone(current);
    const allowed=new Set(['summary','immediateAction','eventType','injuredName','job','occurredAt','safetyNote']);
    for(const field of new Set([...Object.keys(old),...Object.keys(draft)])){
      if(signature(old[field])===signature(draft[field]))continue;
      if(field==='reportDetails'){
        for(const k of new Set([...Object.keys(old[field]||{}),...Object.keys(draft[field]||{})])){
          if(signature(old[field]?.[k])===signature(draft[field]?.[k]))continue;
          if(draft[field]?.[k]&&typeof draft[field][k]==='object')throw errorOf('enl_sync_conflict_version',409);
          next.reportDetails={...(next.reportDetails||{})};if(draft[field]?.[k]===undefined)delete next.reportDetails[k];else next.reportDetails[k]=draft[field][k];
        }
      }else if(allowed.has(field)){if(draft[field]===undefined)delete next[field];else next[field]=clone(draft[field]);}
      else throw errorOf('enl_sync_conflict_version',409);
    }
    return next;
  }
  function confirmWrite(id,sent,saved){
    if(version(saved)<version(sent))throw errorOf('save_not_confirmed');
    const steps=ownWrites.get(id)||[];steps.push({from:Number(sent._syncBaseVersion||0),to:version(saved)});ownWrites.set(id,steps.slice(-16));
    retryWrites.delete(id);failures.delete(id);drafts.delete(id);notices.delete([sessionKey,id,'enl_sync_conflict_version'].join('|'));
    return acceptSaved(saved,sent);
  }
  async function send(id,sent,a,owner){
    const result=await call({action:'push',actor:a,incidents:[sent],deletedIds:[]},20000);
    if(owner!==key(actor())||owner!==sessionKey)throw errorOf('session_changed');
    const saved=result.incidents?.find(i=>String(i.id)===id);if(!saved)throw errorOf('save_not_confirmed');
    return confirmWrite(id,sent,saved);
  }
  function commitIncident(input,{background=false}={}){
    const owner=scope(),a=actor(),id=String(input.id),wanted=clone(input),visibleBefore=clone(find(id)||null),sig=contentSignature(wanted),dedupe=owner+'|'+id+'|'+sig;
    if(inflight.has(dedupe))return inflight.get(dedupe);
    const base=clone(history.get(id)?.get(version(wanted))||authoritative.get(id)&&version(authoritative.get(id))===version(wanted)&&authoritative.get(id)||null);
    drafts.set(id,clone(wanted));
    const task=enqueue(id,async()=>{
      try{
        if(!a||owner!==key(actor())||owner!==sessionKey)throw errorOf('session_changed');
        if(!serverReady)await pull(false);
        const uncertain=retryWrites.get(id);
        if(uncertain){
          // Replay exactly the uncertain operation first, even when the user has
          // edited again. A reused ID must never describe a different payload.
          const saved=await send(id,uncertain.sent,a,owner);
          if(same(wanted,uncertain.sent)){acceptSaved(saved,wanted,visibleBefore);return saved;}
        }
        let candidate=clone(wanted);const latest=authoritative.get(id);
        if(latest&&same(candidate,latest)){failures.delete(id);drafts.delete(id);return acceptSaved(latest,wanted,visibleBefore);}
        if(latest&&version(candidate)!==version(latest))candidate=rebase(id,candidate,base||history.get(id)?.get(version(candidate)),latest);
        if(latest&&same(candidate,latest)){failures.delete(id);drafts.delete(id);return acceptSaved(latest,wanted,visibleBefore);}
        candidate._syncBaseVersion=version(candidate);candidate._syncMutationId=crypto.randomUUID();delete candidate._pendingCommitId;
        if(!history.has(id))history.set(id,new Map());if(!history.get(id).has(version(wanted)))history.get(id).set(version(wanted),clone(wanted));
        retryWrites.set(id,{sent:clone(candidate)});
        const saved=await send(id,candidate,a,owner);acceptSaved(saved,wanted,visibleBefore);return saved;
      }catch(error){
        if(owner!==sessionKey)throw error;
        // A definitive rejection cannot have committed this request. Uncertain
        // network/5xx results retain their exact mutation ID for replay.
        if(error.status>=400&&error.status<500)retryWrites.delete(id);
        drafts.set(id,clone(wanted));failures.set(id,{error,signature:sig});refreshDirty();
        if(isConflict(error))try{await pull(false)}catch(e){}
        if(background)notifyFailure(error,id,wanted);throw error;
      }
    });
    inflight.set(dedupe,task);task.then(()=>{if(inflight.get(dedupe)===task)inflight.delete(dedupe)},()=>{if(inflight.get(dedupe)===task)inflight.delete(dedupe)});return task;
  }
  const controlLocks=new WeakMap();
  function lockEditor(){
    const root=document.querySelector('#unifiedReportForm,#reportForm,#modalRoot .modal');
    const controls=[...(root?.querySelectorAll?.('input,textarea,select,button')||[])];
    controls.forEach(el=>{const state=controlLocks.get(el)||{count:0,disabled:el.disabled};state.count++;controlLocks.set(el,state);el.disabled=true;});
    return ()=>controls.forEach(el=>{const state=controlLocks.get(el);if(state&&!--state.count){el.disabled=state.disabled;controlLocks.delete(el);}});
  }
  window.enlCommitIncident=commitIncident;window.enlAcceptSavedIncident=acceptSaved;
  window.enlIncidentSaveErrorMessage=errorMessage;
  // Retry the same user action with its original generated timestamps. This
  // reuses a request snapshot; it never merges approval or evidence records.
  const formAttempts=new WeakMap();
  window.enlStableSaveAttempt=(form,candidate,volatilePaths=[])=>{if(!form)return candidate;const intent=comparable(candidate);for(const path of volatilePaths){const parts=path.split('.'),last=parts.pop(),parent=parts.reduce((x,k)=>x?.[k],intent);if(parent)delete parent[last];}const sig=signature(intent),prior=formAttempts.get(form);if(prior?.sig===sig)return clone(prior.candidate);formAttempts.set(form,{sig,candidate:clone(candidate)});return candidate;};
  window.enlOpenLatestIncident=async id=>{id=String(id);await pull(false);const latest=authoritative.get(id);if(!latest)throw errorOf('incident_not_found');drafts.delete(id);failures.delete(id);retryWrites.delete(id);const local=find(id),idx=data.incidents.indexOf(local);if(idx<0)data.incidents.unshift(clone(latest));else data.incidents[idx]=clone(latest);refreshDirty();persistConfirmed();window.closeModal?.();currentView='incidents';renderShell(currentUser());};
  window.enlCommitOrNotify=async i=>{const unlock=lockEditor();try{await commitIncident(i);return true}catch(e){notifyFailure(e,String(i.id),i);return false}finally{unlock()}};
  async function push(){
    const a=actor();if(!a||!serverReady||uiWriteBusy()||['manager','executive'].includes(a.role))return;
    const tasks=[];for(const local of data.incidents||[]){
      const id=String(local.id);if(local.workerPublicOnly||['field','worker'].includes(a.role)&&String(local.siteId)!==String(a.siteId)||!locallyChanged(local)||same(local,authoritative.get(id))||failures.has(id)||drafts.has(id))continue;
      tasks.push(commitIncident(local,{background:true}));
    }
    await Promise.allSettled(tasks);refreshDirty();
  }
  function scheduleSync(delay=250){if(syncTimer)clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncTimer=null;syncNow()},delay);}
  async function syncNow(){
    if(!actor())return;scope();if(syncing){pending=true;return;}if(syncTimer){clearTimeout(syncTimer);syncTimer=null;}syncing=true;
    try{if(!serverReady)await pull(false);if(dirty)await push();await pull(true);}catch(e){console.warn('incident sync deferred',e.message);}finally{syncing=false;if(pending){pending=false;scheduleSync(500);}}
  }
  saveData=function(){if(applyingRemote)return baseSaveData();scope();refreshDirty();persistConfirmed();if(dirty&&currentUser())scheduleSync();};
  // Account API responses are already saved. Cache them without running legacy
  // incident normalizers or scheduling unrelated incident writes.
  window.enlPersistAppData=()=>{scope();persistConfirmed();};
  // Explicit correction/export operations share the queue but retain their
  // original expectedVersion: protected records cannot be silently rebased.
  async function api(body,timeout){
    if(!body?.incidentId||!['correct_closed','erp_record','export_snapshot','export_completed'].includes(body.action))return call(body,timeout);
    const owner=scope(),id=String(body.incidentId),request=clone(body),visibleBefore=clone(find(id)||null),unlock=lockEditor();
    try{return await enqueue(id,async()=>{if(owner!==key(actor()))throw errorOf('session_changed');const result=await call(request,timeout);if(owner!==key(actor()))throw errorOf('session_changed');if(result.incident)acceptSaved(result.incident,undefined,visibleBefore);return result;});}
    catch(e){if(isConflict(e)){try{await pull(false)}catch(_){}const candidate=clone(find(id)||{});for(const [k,v]of Object.entries(request.changes||{}))candidate[k]=v&&typeof v==='object'&&!Array.isArray(v)?{...(candidate[k]||{}),...v}:v;notifyFailure(e,id,candidate);}throw e;}finally{unlock();}
  }
  window.enlIncidentApi=api;window.enlIncidentAuthProof=authProof;
  window.enlIncidentSyncNow=()=>syncNow();window.enlIncidentPullNow=pull;
  window.enlIncidentAcknowledge=async(incidentId,u=currentUser(),documentType='incident_report')=>call({action:'acknowledge',actor:actor(),incidentId,documentType});
  window.enlIncidentServerReady=()=>serverReady;
  window.enlIncidentPendingWrites=()=>queues.size;
  window.enlRefreshSharedData=(sessionChanged=false)=>{
    // A local-cache notification is not an authoritative incident response.
    // Keep this tab's records/drafts and fetch through the version-aware path.
    const incidents=data.incidents;data={...loadData(),incidents};
    if(sessionChanged&&key(actor())!==sessionKey){data.incidents=[];scope();render();}
    else if(canAutoRender())render();
    if(actor())scheduleSync(120);
  };
  scope();
  let firstForegroundSync=true;
  function syncOnForeground(){if(!currentUser())return;scope();const delay=firstForegroundSync?700:120;firstForegroundSync=false;scheduleSync(delay);}
  if(currentUser())scheduleSync(700);
  setInterval(()=>{if(!currentUser()||document.visibilityState==='hidden'||syncing||syncTimer)return;syncNow();},15000);
  window.addEventListener('online',()=>{for(const [id,f]of failures)if(!f.error.status||f.error.status>=500){failures.delete(id);drafts.delete(id);}if(currentUser())scheduleSync(500);});
  window.addEventListener('pageshow',syncOnForeground);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncOnForeground();});
  window.ENL_INCIDENT_SYNC_VERSION='4.7.3-serialized-writes';
})();
