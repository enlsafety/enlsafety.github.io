/* Local working copies. The normal role-checked forms remain the only submission path. */
(()=>{
  'use strict';
  const prefix='enl-form-draft-v1/', ttl=30*86400000;
  const labels={person:'대인사고 보고',property:'대물사고 보고',plan:'재발방지계획',action:'재발방지조치'};
  const controllers=new WeakMap();
  let dirtyMenu=true, lastView, lastContent, lastOwner, lastEditor, queued=false;
  function owner(u){
    const id=u?.personnelId||u?.id;
    return id&&['field','worker','safety'].includes(u.role)
      ? prefix+[u.role,id,u.siteId||''].map(encodeURIComponent).join('/')+'/' : '';
  }
  const current=()=>owner(currentUser());
  const record=id=>(data.incidents||[]).find(i=>String(i.id)===String(id));
  const version=i=>String(i?._syncVersion??i?.updatedAt??'');
  function read(key){
    try{const d=JSON.parse(localStorage.getItem(key));if(!d)return null;
      if(Date.now()-d.time>ttl){localStorage.removeItem(key);return null;}return d;
    }catch{return null;}
  }
  function schedule(){
    if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;menu();});
  }
  function invalidate(){dirtyMenu=true;schedule();}
  function ownKeys(account){
    try{return Object.keys(localStorage).filter(k=>k.startsWith(account));}catch{return [];}
  }
  function askToResume(form,caption,choose){
    const dialog=document.createElement('dialog');
    dialog.className='draft-resume-dialog';
    dialog.setAttribute('aria-label','임시저장한 내용 이어쓰기');
    dialog.innerHTML='<strong>이전에 작성하시던 내용이 있습니다.</strong><p>이어서 작성하시겠습니까?</p><small></small><div><button type="button" class="secondary" data-draft-no>아니오</button><button type="button" class="primary" data-draft-yes autofocus>예</button></div>';
    dialog.querySelector('small').textContent=caption;
    const finish=yes=>{dialog.close();dialog.remove();choose(yes);};
    dialog.querySelector('[data-draft-yes]').onclick=()=>finish(true);
    dialog.querySelector('[data-draft-no]').onclick=()=>finish(false);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    form.append(dialog);dialog.showModal();
  }
  function bind(form,u,kind,i){
    const account=owner(u);
    if(!account||current()!==account)return;
    const slot=account+[kind,i?.id||'new',version(i)].map(encodeURIComponent).join('/')+'/';
    const copies=ownKeys(slot).map(key=>({key,d:read(key)})).filter(({key,d})=>{
      if(!d)return false;
      if(!i&&d.reportId&&record(d.reportId)){localStorage.removeItem(key);return false;}
      return true;
    });
    const explicit=copies.find(x=>x.key===selectedKey);
    const candidate=explicit||copies.sort((a,b)=>b.d.time-a.d.time)[0];
    selectedKey=null;
    let key=slot+crypto.randomUUID(),finished=false,ready=false;
    if(!i)form._draftIncidentId=uid('inc');
    const type=kind==='action'?'action':['person','property'].includes(kind)?'incident':'';
    const photos=()=>type==='action'?actionPhotos:type==='incident'?incidentPhotos:[];
    const basePhotos=[...photos()];
    // Old embedded attachments already exist on the server record. Store just their indices.
    const refs=list=>list.map(a=>{
      const n=basePhotos.indexOf(a);
      return n>=0?{original:n}:window.enlPersistAttachment(a);
    });
    const fields=()=>[...form.querySelectorAll('input[id],textarea[id],select[id]')]
      .filter(el=>!el.disabled&&!el.readOnly&&!['file','password','hidden','button','submit'].includes(el.type));
    const status=document.createElement('small');
    status.className='draft-save-status';status.textContent='작성 내용은 이 기기에 자동 임시저장됩니다.';
    form.querySelector('button[type=submit]')?.parentElement===form
      ?form.querySelector('button[type=submit]').before(status):form.append(status);
    let revision='', lastPayload='';
    function capture(files=photos()){
      if(!ready||finished||current()!==account)return;
      const values=Object.fromEntries(fields().map(el=>[el.id,el.type==='checkbox'||el.type==='radio'?el.checked:el.value]));
      const confirmed=fields().filter(el=>el.dataset.enlConfirmed==='1').map(el=>el.id);
      const payload={values,confirmed,files:refs(files),reportId:form._draftIncidentId};
      const serialized=JSON.stringify(payload);
      if(lastPayload===serialized)return;
      try{
        // If another tab edited/discarded this copy, keep its work and branch ours.
        if((read(key)?.revision||'')!==revision){key=slot+crypto.randomUUID();}
        const next=crypto.randomUUID();
        const captions=Object.fromEntries(fields().map(el=>[el.id,(el.closest('label')?.querySelector('span')?.textContent||el.closest('td')?.previousElementSibling?.textContent||el.id).trim().slice(0,100)]));
        const row={...payload,captions,revision:next,time:Date.now(),kind,id:i?.id||'',version:version(i)};
        localStorage.setItem(key,JSON.stringify(row));revision=next;lastPayload=serialized;
        if(status.textContent!=='이 기기에 임시저장됨')status.textContent='이 기기에 임시저장됨';
        invalidate();
      }catch{status.textContent='기기에 임시저장하지 못했습니다. 이 화면에서 제출해 주세요.';}
    }
    function clear(){
      finished=true;
      if(read(key)?.revision===revision)localStorage.removeItem(key);
      invalidate();
    }
    const legacyKey=i&&['action','plan'].includes(kind)?['enl-report-draft',u.personnelId||u.id,i.id,kind,Number(i._syncVersion||0)].join(':'):'';
    function legacy(){
      if(!legacyKey)return null;
      try{
        const old=JSON.parse(sessionStorage.getItem(legacyKey));
        return old?.values?{values:old.values,files:old.photos||[]}:null;
      }catch{return null;}
    }
    function restore(saved){
      if(!i&&saved.reportId)form._draftIncidentId=saved.reportId;
      const toggle=form.querySelector('#pastReportMode');
      if(toggle&&saved.values.pastReportMode){toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));}
      const timeMode=form.querySelector('#unknownTime410');
      if(timeMode&&!timeMode.disabled&&Object.hasOwn(saved.values,timeMode.id)){
        timeMode.checked=!!saved.values[timeMode.id];
        timeMode.dispatchEvent(new Event('change',{bubbles:true}));
      }
      for(const el of fields()){
        if(!Object.hasOwn(saved.values,el.id))continue;
        if(el.type==='checkbox'||el.type==='radio')el.checked=!!saved.values[el.id];
        else el.value=saved.values[el.id];
        if(saved.confirmed?.includes(el.id))el.dataset.enlConfirmed='1';
        el.closest('[data-report410-picker]')?.classList.toggle('has-value',!!el.value);
      }
      if(type){
        const restored=saved.files.map(a=>a!=null&&Object.hasOwn(a,'original')?basePhotos[a.original]:a).filter(Boolean);
        if(type==='action')actionPhotos=restored;else incidentPhotos=restored;
        renderPhotoThumbs(type);
      }
      window.enlRefreshRequiredFields453?.();
      status.textContent='임시저장한 내용을 불러왔습니다.';
    }
    function begin(yes){
      if(!form.isConnected||current()!==account||finished)return;
      const saved=yes&&(candidate?read(candidate.key):legacy());
      if(saved&&(!i||version(record(i.id))===version(i))&&!(saved.reportId&&record(saved.reportId))){
        if(candidate){key=candidate.key;revision=saved.revision;}
        restore(saved);
      }else if(yes){
        status.textContent='임시본 또는 사고기록이 변경됐습니다. 작성 중인 자료에서 다시 확인해 주세요.';
      }
      ready=true;
      if(!candidate&&saved){capture();if(revision)sessionStorage.removeItem(legacyKey);}
      const thumbs=type&&form.querySelector('#'+type+'Thumbs');
      if(thumbs)new MutationObserver(()=>{if(form.isConnected)capture();}).observe(thumbs,{childList:true});
    }
    if(explicit)begin(true);
    else if(candidate||legacy()){
      const d=candidate?.d,site=d?.values?.reportSite||i?.siteId;
      const caption=[labels[kind],site&&siteById(site)?.name,d?.values?.incidentPlace410||i?.eventType,
        d&&new Date(d.time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})].filter(Boolean).join(' / ');
      askToResume(form,caption,begin);
    }else begin(false);
    controllers.set(form,{capture,clear});
    for(const event of ['input','change'])form.addEventListener(event,e=>{if(e.target.matches('input,textarea,select'))capture();});
    return controllers.get(form);
  }
  let selectedKey=null;
  function resume(key,d,account,row){
    if(current()!==account||!read(key))return invalidate();
    const u=currentUser(),i=d.id&&record(d.id);
    if(d.id&&!i){alert('사고기록을 불러온 뒤 다시 시도해 주세요.');return;}
    if(i&&version(i)!==d.version){
      if(row.querySelector('details'))return;
      const details=document.createElement('details'),heading=document.createElement('summary');
      heading.textContent='사고기록이 변경됐습니다. 이전 입력내용 확인';details.append(heading);
      for(const [id,value] of Object.entries(d.values)){
        if(typeof value!=='string'||!value.trim())continue;
        const line=document.createElement('p');line.textContent=(d.captions?.[id]||id)+' — '+value;details.append(line);
      }
      details.open=true;row.append(details);return;
    }
    if(!d.id&&d.reportId&&record(d.reportId)){
      localStorage.removeItem(key);invalidate();alert('이미 등록된 사고입니다. 사고기록에서 확인해 주세요.');return;
    }
    selectedKey=key;
    if(d.kind==='plan'||d.kind==='action')window.enlPreventionFlowV429.open(i.id,u);
    else if(d.id)window.enlEditIncidentInReportForm(i,u);
    else{currentView='report';window.enlOpenIncidentReport(d.kind,u);}
  }
  function menu(){
    const account=current(),view=document.getElementById('view'),previous=document.getElementById('localDraftList');
    const content=view?.firstElementChild===previous?previous?.nextElementSibling:view?.firstElementChild;
    const editor=document.querySelector('#unifiedReportForm,#prev429PlanForm,#prev429FieldForm');
    if(!dirtyMenu&&view===lastView&&content===lastContent&&account===lastOwner&&editor===lastEditor)return;
    lastEditor=editor;
    dirtyMenu=false;lastView=view;lastContent=content;lastOwner=account;previous?.remove();
    if(!account||!view||editor)return;
    const rows=ownKeys(account).map(key=>({key,d:read(key)})).filter(row=>row.d&&Object.hasOwn(labels,row.d.kind)).sort((a,b)=>b.d.time-a.d.time);
    if(!rows.length)return;
    const panel=document.createElement('section');panel.id='localDraftList';panel.className='panel';
    const title=document.createElement('strong');title.textContent='작성 중인 자료';panel.append(title);
    for(const {key,d} of rows){
      const row=document.createElement('div');row.className='draft-list-row';
      const name=document.createElement('span'),i=d.id&&record(d.id);
      const site=i?.siteId||d.values.reportSite;
      name.textContent=[labels[d.kind],site&&siteById(site)?.name,d.values.incidentPlace410||i?.eventType,new Date(d.time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})].filter(Boolean).join(' / ');
      const open=document.createElement('button');open.type='button';open.className='secondary';open.textContent='이어서 작성';open.onclick=()=>resume(key,d,account,row);
      const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='삭제';remove.onclick=()=>{
        if(current()===account&&confirm('이 기기의 임시저장본을 삭제할까요?')){localStorage.removeItem(key);invalidate();}
      };
      row.append(name,open,remove);panel.append(row);
    }
    view.prepend(panel);
  }
  window.ENLFormDrafts={bind,forForm:form=>controllers.get(form)};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('storage',e=>{if(!e.key||e.key.startsWith(prefix))invalidate();});
  // Expire old working copies even if their owner no longer uses this browser.
  ownKeys(prefix).forEach(read);
  schedule();
})();
