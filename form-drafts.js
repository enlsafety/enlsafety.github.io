/* Account-owned server drafts; local storage is only a recoverable unsent outbox. */
(()=>{
 'use strict';
 const legacy='enl-form-draft-v1/',backup='enl-draft-outbox-v2/',tab=crypto.randomUUID();
 const labels={person:'대인사고 보고',property:'대물사고 보고',plan:'재발방지계획',action:'재발방지조치'};
 const controllers=new WeakMap(),active=new Set();let selected=null,cache=[],account='',refreshing=null,lastRefresh=0,queued=false,menuStamp='';
 const copy=v=>JSON.parse(JSON.stringify(v));
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const owner=u=>u&&['field','worker','safety'].includes(u.role)?[u.role,u.personnelId||u.id,u.siteId||''].map(encodeURIComponent).join('/'):'/';
 const current=()=>owner(currentUser());
 const record=id=>(data.incidents||[]).find(i=>String(i.id)===String(id));
 const version=i=>String(i?._syncVersion??i?.updatedAt??'');
 const storage={get(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}},remove(k){try{localStorage.removeItem(k)}catch{}},keys(p){try{return Object.keys(localStorage).filter(k=>k.startsWith(p))}catch{return []}}};
 const actor=u=>({id:u.personnelId||u.id,role:u.role,siteId:u.siteId||''});
 async function api(action,body={},who=current()){
  const u=currentUser();if(!u||who!==current())throw Error('session_changed');
  if(!window.enlIncidentApi)throw Error('draft_api_loading');
  const result=await window.enlIncidentApi({action,actor:actor(u),...body},20000);
  if(who!==current())throw Error('session_changed');return result;
 }
 function merge(base,local,remote){
  const content=copy(remote),conflicts=[];content.values={...remote.values};
  for(const k of new Set([...Object.keys(base.values||{}),...Object.keys(local.values||{}),...Object.keys(remote.values||{})])){
   const b=base.values?.[k],l=local.values?.[k],r=remote.values?.[k];
   if(equal(l,b))continue;
   if(equal(r,b)||equal(l,r))content.values[k]=l;
   else conflicts.push({key:k,label:local.captions?.[k]||remote.captions?.[k]||k,local:l,remote:r});
  }
  if(!equal(local.files,base.files)){
   if(equal(remote.files,base.files)||equal(local.files,remote.files))content.files=copy(local.files);
   else conflicts.push({key:'$files',label:'첨부자료',local:local.files,remote:remote.files});
  }
  content.confirmed=[...new Set([...(local.confirmed||[]),...(remote.confirmed||[])])];
  content.captions={...remote.captions,...local.captions};return {content,conflicts};
 }
 function text(v){if(Array.isArray(v))return v.map((x,i)=>x.name||'첨부자료 '+(i+1)).join('\n')||'없음';return typeof v==='boolean'?(v?'선택':'선택 안 함'):String(v??'');}
 function resolveDialog(conflicts,onApply){
  const overlay=document.createElement('div');overlay.className='draft-resume-backdrop';
  const dialog=document.createElement('dialog');dialog.className='draft-resume-dialog draft-conflict-dialog';dialog.setAttribute('aria-label','다른 기기 수정내용 비교');
  const title=document.createElement('strong');title.textContent='같은 항목이 다른 기기에서도 수정됐습니다.';
  const hint=document.createElement('p');hint.textContent='자동으로 덮어쓰지 않았습니다. 항목별로 보존할 내용을 선택하세요.';dialog.append(title,hint);
  const choices=[];
  for(const c of conflicts){
   const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=c.label;field.append(legend);
   const radios=[];
   for(const [index,label,value] of [[0,'서버의 최신 내용',c.remote],[1,'이 기기의 작성 내용',c.local]]){
    const wrap=document.createElement('label'),input=document.createElement('input'),name=document.createElement('b'),pre=document.createElement('pre');input.type='radio';input.name='conflict-'+choices.length;input.checked=index===0;name.textContent=label;pre.textContent=text(value);wrap.append(input,name,pre);field.append(wrap);radios.push(input);
   }
   choices.push({c,radios});dialog.append(field);
  }
  const actions=document.createElement('div'),later=document.createElement('button'),apply=document.createElement('button');later.type=apply.type='button';later.className='secondary';apply.className='primary';later.textContent='나중에 확인';apply.textContent='선택한 내용으로 저장';
  const close=()=>{dialog.close();overlay.remove()};later.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  apply.onclick=()=>{close();onApply(choices.map(({c,radios})=>({...c,value:radios[1].checked?c.local:c.remote})))};
  actions.append(later,apply);dialog.append(actions);overlay.append(dialog);document.body.append(overlay);dialog.showModal();
 }
 function upsert(row){cache=cache.filter(d=>d.id!==row.id);if(row.state==='active')cache.push(row);menuStamp='';schedule();}
 function explain(e){
  const m=String(e?.message||'');
  if(m==='draft_incident_changed')return '사고기록이 변경됐습니다. 작성 내용은 보관됩니다. 최신 사고기록을 확인해 주세요.';
  if(m==='draft_finished'||m==='draft_already_submitted')return '다른 기기에서 제출 또는 삭제한 초안입니다. 이 기기의 작성 내용은 복구용으로 보관했습니다.';
  if(/auth|session|forbidden/.test(m))return '계정 인증 또는 접근 권한을 확인해 주세요. 미저장 내용은 이 기기에 보관됩니다.';
  if(/draft_invalid|too_large|attachment/.test(m))return '입력 또는 첨부자료를 서버에 저장하지 못했습니다. 이 기기의 내용은 보관됩니다.';
  return '서버 저장을 확인하지 못했습니다. 이 기기에 임시 보관 중입니다. 연결되면 다시 저장합니다.';
 }
 function bind(form,u,kind,i){
  if(!form||owner(u)!==current()||current()==='/')return;
  const who=current(),type=kind==='action'?'action':['person','property'].includes(kind)?'incident':'',initialPhotos=type==='action'?[...actionPhotos]:type==='incident'?[...incidentPhotos]:[];
  const freshId=crypto.randomUUID();
  let row={id:freshId,kind,incidentId:i?.id||'',reportId:i?'':uid('inc'),siteId:i?.siteId||u.siteId||'',incidentVersion:version(i),revision:0,state:'active'};
  let base=null,ready=false,finished=false,dirty=false,pending=null,timer=null,inflight=null,conflict=null,changed=0,restoring=false;
  const key=()=>backup+who+'/'+row.id+'/'+tab;
  const status=document.createElement('small');status.className='draft-save-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='서버 임시저장 확인 중…';
  const actions=document.createElement('div');actions.className='draft-save-actions';
  const save=document.createElement('button');save.type='button';save.className='secondary';save.textContent='지금 저장';
  const compare=document.createElement('button');compare.type='button';compare.className='secondary';compare.textContent='변경 내용 비교';compare.hidden=true;
  actions.append(status,save,compare);form.append(actions);
  const fields=()=>[...form.querySelectorAll('input[id],textarea[id],select[id]')].filter(el=>!el.readOnly&&!['file','password','hidden','button','submit'].includes(el.type));
  let lastPhotos=initialPhotos;const photos=()=>{if(form.isConnected)lastPhotos=type==='action'?actionPhotos:type==='incident'?incidentPhotos:[];return lastPhotos;};
  const snapshot=()=>({values:Object.fromEntries(fields().map(el=>[el.id,['checkbox','radio'].includes(el.type)?el.checked:el.value])),confirmed:fields().filter(el=>el.dataset.enlConfirmed==='1').map(el=>el.id),files:photos().map(a=>{const n=initialPhotos.indexOf(a);return n>=0?{original:n}:window.enlPersistAttachment(a)}),captions:Object.fromEntries(fields().map(el=>[el.id,(el.closest('label')?.querySelector('span')?.textContent||el.closest('td')?.previousElementSibling?.textContent||el.id).trim().slice(0,120)]))});
  function preserve(){
   const ok=storage.set(key(),{...row,content:snapshot(),base,updatedAt:new Date().toISOString(),pending});
   if(!ok)status.textContent='기기 복구용 저장도 실패했습니다. 서버 저장 완료 전에는 화면을 닫지 마세요.';return ok;
  }
  function restore(content){
   restoring=true;
   for(const id of ['pastReportMode','unknownTime410']){const el=form.querySelector('#'+id);if(el&&Object.hasOwn(content.values,id)){el.checked=!!content.values[id];el.dispatchEvent(new Event('change',{bubbles:true}));}}
   for(const el of fields())if(Object.hasOwn(content.values,el.id)){
    if(['checkbox','radio'].includes(el.type))el.checked=!!content.values[el.id];else el.value=content.values[el.id];
    if(content.confirmed?.includes(el.id))el.dataset.enlConfirmed='1';
    el.closest('[data-report410-picker]')?.classList.toggle('has-value',!!el.value);
   }
   if(type){const restored=(content.files||[]).map(a=>Object.hasOwn(a,'original')?initialPhotos[a.original]:a).filter(Boolean);if(type==='action')actionPhotos=restored;else incidentPhotos=restored;renderPhotoThumbs(type);}
   form._draftIncidentId=row.reportId;window.enlRefreshRequiredFields453?.();changed++;restoring=false;
  }
  function capture(files){
   if(Array.isArray(files))lastPhotos=files;
   if(!ready||finished||restoring||current()!==who)return;
   dirty=!equal(snapshot(),base);if(!dirty)return;
   preserve();if(!conflict)status.textContent='저장 중…';clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),650);
  }
  async function acceptRemote(remote){
   if(remote.state!=='active'){finished=true;status.textContent=explain({message:'draft_finished'});return false;}
   if(remote.revision===row.revision)return true;
   const local=snapshot(),result=merge(base||local,local,remote.content);
   pending=null;upsert(remote);
   if(result.conflicts.length){conflict={...result,remote};compare.hidden=false;status.textContent='다른 기기와 수정 내용이 겹칩니다. 비교 후 저장해 주세요.';preserve();return false;}
   row={...remote};base=copy(remote.content);restore(result.content);dirty=!equal(snapshot(),base);if(dirty)preserve();else storage.remove(key());return true;
  }
  compare.onclick=()=>{if(!conflict)return;const remote=conflict.remote,captured=merge(base,snapshot(),remote.content);resolveDialog(captured.conflicts,choices=>{
   if(current()!==who||!form.isConnected||finished)return;
   // Merge decisions affect only the captured fields; keep edits made while the dialog was open.
   const next=copy(captured.content);for(const c of choices)if(c.key==='$files')next.files=c.value;else next.values[c.key]=c.value;
   row={...remote};base=copy(remote.content);restore(next);conflict=null;compare.hidden=true;dirty=true;preserve();flush().catch(()=>{});
  });};
  async function flush(){
   clearTimeout(timer);
   if(inflight)return inflight;
   if(!ready||finished||conflict||current()!==who)return false;
   inflight=(async()=>{
    for(let attempt=0;attempt<4;attempt++){
     if(!dirty&&!pending)return true;
     if(!pending){const content=snapshot();row.siteId=content.values.reportSite||i?.siteId||u.siteId||'';pending={action:'draft_save',id:row.id,revision:row.revision,kind,incidentId:row.incidentId,reportId:row.reportId,siteId:row.siteId,incidentVersion:row.incidentVersion,content,mutationId:crypto.randomUUID()};preserve();}
     const sent=pending;
     try{
      const result=await api('draft_save',sent,who);if(finished)return false;
      row=result.draft;base=copy(row.content);pending=null;upsert(row);dirty=!equal(snapshot(),base);
      if(dirty){preserve();continue;}
      storage.remove(key());status.textContent='서버 저장 완료 — 다른 기기에서 이어서 작성할 수 있습니다.';return true;
     }catch(e){
      if(e.message==='draft_conflict'){
       const result=await api('draft_get',{id:row.id},who);
       if(!await acceptRemote(result.draft))return false;
       continue;
      }
      if(e.status>=400&&e.status<500)pending=null;
      preserve();status.textContent=explain(e);return false;
     }
    }
    status.textContent='입력 내용을 추가 저장 중입니다.';timer=setTimeout(()=>flush().catch(()=>{}),650);return false;
   })().finally(()=>{inflight=null;});return inflight;
  }
  async function prepare(){
   await initialized;if(finished||conflict||current()!==who)return false;
   capture();if(!row.revision&&!dirty){dirty=true;preserve();}
   const before=changed;
   if(!await flush())return false;
   try{const latest=(await api('draft_get',{id:row.id},who)).draft;if(!await acceptRemote(latest))return false;}catch(e){status.textContent=explain(e);return false;}
   if(dirty&&!await flush())return false;
   if(before!==changed){status.textContent='다른 기기의 최신 내용을 반영했습니다. 내용을 확인한 뒤 다시 제출해 주세요.';return false;}
   return {id:row.id,revision:row.revision};
  }
  function clear(){finished=true;clearTimeout(timer);storage.remove(key());cache=cache.filter(d=>d.id!==row.id);menuStamp='';schedule();}
  async function check(){if(!ready||finished||current()!==who||conflict)return;if(dirty||pending)return flush();if(!row.revision)return;try{await acceptRemote((await api('draft_get',{id:row.id},who)).draft);if(dirty)await flush();}catch(e){status.textContent=explain(e)}}
  const ctl={capture,clear,prepare,check,flush,form};controllers.set(form,ctl);active.add(ctl);
  save.onclick=()=>{capture();dirty=true;flush().catch(e=>status.textContent=explain(e))};
  const locked=[...form.querySelectorAll('input,textarea,select,button')].map(el=>({el,disabled:el.disabled}));locked.forEach(({el})=>el.disabled=true);
  const initialized=(async()=>{
   try{
    try{await refresh()}catch{}if(current()!==who||!form.isConnected)return;
    let candidate=selected;selected=null;
    if(!candidate){const recoveries=storage.keys(backup+who+'/').map(k=>({...storage.get(k),recoveryKey:k})).filter(d=>d.id);candidate=[...cache,...recoveries].filter(d=>d.kind===kind&&d.incidentId===(i?.id||'')&&d.incidentVersion===version(i)).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];if(candidate&&!await resumePrompt(form))candidate=null;}
    if(candidate){
     if(candidate.incidentVersion!==version(i)){status.textContent=explain({message:'draft_incident_changed'});return;}
     const recoveryKey=candidate.recoveryKey;
     if(recoveryKey){row={...candidate};base=copy(candidate.base||candidate.content);pending=candidate.pending||null;restore(candidate.content);dirty=true;}
     else{const result=await api('draft_get',{id:candidate.id},who);row=result.draft;if(row.state!=='active'){status.textContent=explain({message:'draft_finished'});return;}base=copy(row.content);restore(row.content);}
     if(recoveryKey){preserve();if(recoveryKey!==key())storage.remove(recoveryKey);}
    }else{form._draftIncidentId=row.reportId;base=snapshot();}
    ready=true;status.textContent=row.revision?'서버 초안을 불러왔습니다.':'작성 내용은 계정에 자동 임시저장됩니다.';
   }catch(e){form._draftIncidentId=row.reportId;base=snapshot();ready=true;status.textContent=explain(e);}
   finally{locked.forEach(({el,disabled})=>el.disabled=disabled);}
   if(dirty)flush().catch(()=>{});
  })();
  for(const event of ['input','change'])form.addEventListener(event,e=>{if(e.target.matches('input,textarea,select'))capture()});
  const thumbs=type&&form.querySelector('#'+type+'Thumbs');if(thumbs)new MutationObserver(()=>{if(form.isConnected&&!restoring)capture()}).observe(thumbs,{childList:true});
  return ctl;
 }
 function resumePrompt(form){return new Promise(resolve=>{
  const overlay=document.createElement('div');overlay.className='draft-resume-backdrop';const d=document.createElement('dialog');d.className='draft-resume-dialog';d.innerHTML='<strong>서버에 작성 중인 자료가 있습니다.</strong><p>이어서 작성하시겠습니까?</p><div><button type="button" class="secondary">새로 작성</button><button type="button" class="primary">이어서 작성</button></div>';
  let done=false;const finish=yes=>{if(done)return;done=true;watch.disconnect();d.close();overlay.remove();resolve(yes)};const watch=new MutationObserver(()=>{if(!form.isConnected)finish(false)});watch.observe(document.body,{childList:true,subtree:true});d.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>finish(!!i));d.addEventListener('cancel',e=>{e.preventDefault();finish(false)});overlay.append(d);document.body.append(overlay);d.showModal();
 });}
 async function legacyId(key){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));const h=[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
 async function migrate(who){
  for(const key of storage.keys(legacy+who+'/')){
   const d=storage.get(key);if(!d||!labels[d.kind]||current()!==who)continue;
   const signature=JSON.stringify(d),id=await legacyId(key+'/'+(d.revision||d.time)),i=d.id&&record(d.id),siteId=d.values?.reportSite||i?.siteId||currentUser()?.siteId||'';
   const row={id,kind:d.kind,incidentId:d.id||'',reportId:d.id?'':d.reportId||'inc-'+id,siteId,incidentVersion:d.version||'',revision:0,state:'active',updatedAt:new Date(d.time||Date.now()).toISOString(),content:{values:d.values||{},files:d.files||[],confirmed:d.confirmed||[],captions:d.captions||{}}};
   try{
    // Deterministic import ID makes migration safe across tabs and lost responses.
    let existing;try{existing=(await api('draft_get',{id},who)).draft}catch(e){if(e.status!==404)throw e;}
    if(existing){upsert(existing)}else upsert((await api('draft_save',{...row,mutationId:id},who)).draft);
    if(JSON.stringify(storage.get(key))===signature)storage.remove(key);storage.remove(backup+who+'/'+id+'/legacy');
   }catch{storage.set(backup+who+'/'+id+'/legacy',{...row,base:row.content});}
  }
 }
 async function refresh(force=false){
  const who=current();if(who==='/'){cache=[];account=who;return;}
  if(account!==who){account=who;cache=[];lastRefresh=0;menuStamp='';}
  if(refreshing)return refreshing;
  if(!force&&Date.now()-lastRefresh<15000)return;
  refreshing=(async()=>{const result=await api('draft_list',{},who);cache=result.drafts;lastRefresh=Date.now();await migrate(who);menuStamp='';schedule()})().finally(()=>refreshing=null);
  return refreshing;
 }
 function open(row){
  const u=currentUser(),i=row.incidentId&&record(row.incidentId);
  if((row.incidentId&&(!i||version(i)!==row.incidentVersion))||(!row.incidentId&&record(row.reportId))){
   const d=document.createElement('dialog');d.className='draft-resume-dialog draft-conflict-dialog';const title=document.createElement('strong');title.textContent='사고기록이 변경되어 자동으로 이어 쓸 수 없습니다.';d.append(title);for(const [k,v] of Object.entries(row.content.values||{})){const p=document.createElement('p');p.textContent=(row.content.captions?.[k]||k)+': '+text(v);d.append(p)}const b=document.createElement('button');b.textContent='닫기';b.onclick=()=>d.remove();d.append(b);document.body.append(d);d.showModal();return;
  }
  selected=row;
  if(['plan','action'].includes(row.kind))window.enlPreventionFlowV429.open(i.id,u);
  else if(i)window.enlEditIncidentInReportForm(i,u);
  else window.enlOpenIncidentReport(row.kind,u);
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;menu()})}
 function menu(){
  const who=current(),view=document.getElementById('view'),editor=document.querySelector('#unifiedReportForm,#prev429PlanForm,#prev429FieldForm');
  if(who!==account){cache=[];account=who;lastRefresh=0;menuStamp='';}
  if(who!=='/'&&Date.now()-lastRefresh>15000&&!refreshing){lastRefresh=Date.now();refresh(true).catch(()=>{});}
  const previous=document.getElementById('localDraftList');if(!view||who==='/'||editor){previous?.remove();menuStamp='';return;}
  const recoveries=storage.keys(backup+who+'/').map(k=>({...storage.get(k),recoveryKey:k})).filter(d=>d.id&&labels[d.kind]);
  const rows=[...cache,...recoveries].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const stamp=JSON.stringify(rows.map(d=>[d.id,d.revision,d.updatedAt,d.recoveryKey]));if(previous&&menuStamp===stamp)return;menuStamp=stamp;previous?.remove();if(!rows.length)return;
  const panel=document.createElement('section');panel.id='localDraftList';panel.className='panel';const title=document.createElement('strong');title.textContent='작성 중인 자료';panel.append(title);
  for(const d of rows){const r=document.createElement('div');r.className='draft-list-row';const name=document.createElement('span');name.textContent=[labels[d.kind],siteById(d.siteId)?.name,d.content?.values?.incidentPlace410,d.recoveryKey?'이 기기 복구본':'서버 저장',new Date(d.updatedAt).toLocaleString('ko-KR')].filter(Boolean).join(' / ');const resume=document.createElement('button'),remove=document.createElement('button');resume.type=remove.type='button';resume.className=remove.className='secondary';resume.textContent='이어서 작성';resume.onclick=()=>open(d);remove.textContent='삭제';remove.onclick=async()=>{
   if(!confirm(d.recoveryKey?'이 기기의 복구본을 삭제할까요?':'서버 초안을 삭제할까요? 다른 기기에서도 목록에서 사라집니다.'))return;
   try{if(d.recoveryKey)storage.remove(d.recoveryKey);else upsert((await api('draft_delete',{id:d.id,revision:d.revision},who)).draft);menuStamp='';schedule()}catch{alert('다른 기기에서 변경됐거나 삭제하지 못했습니다. 최신 목록을 다시 확인해 주세요.');refresh(true).catch(()=>{})}
  };r.append(name,resume,remove);panel.append(r)}view.prepend(panel);
 }
 async function tick(){for(const c of active){if(!c.form.isConnected){active.delete(c);c.flush().catch(()=>{});continue;}await c.check().catch(()=>{})}if(!document.hidden)refresh(true).catch(()=>{});}
 window.ENLFormDrafts={bind,forForm:form=>controllers.get(form),merge};
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('online',tick);window.addEventListener('focus',tick);window.addEventListener('storage',schedule);
 document.addEventListener('visibilitychange',()=>{for(const c of active)c.capture();if(!document.hidden)tick()});
 window.addEventListener('pagehide',()=>{for(const c of active)c.capture()});
 window.addEventListener('beforeunload',e=>{if(storage.keys(backup+current()+'/').length){e.preventDefault();e.returnValue='';}});
 setInterval(()=>{if(!document.hidden)tick()},20000);schedule();
})();
