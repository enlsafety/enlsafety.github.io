/* E&L Accident Report App v4.3.2 - workflow controls, dashboard landing and live UX */
(function(){
  'use strict';

  const VERSION='4.3.2-workflow-enhancements1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const txt=v=>String(v??'').trim();
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const isField=u=>!!u&&['field','worker'].includes(String(u.role||''));
  const position=u=>txt(u?.position||u?.jobTitle);
  const isActionManager=u=>isField(u)&&MANAGER_POSITIONS.includes(position(u));
  const canDashboard=u=>!!u&&['safety','manager','executive'].includes(roleNorm(u.role));
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const getIncident=id=>(data?.incidents||[]).find(i=>String(i.id)===String(id));
  const fmtDate=v=>{if(!v)return '-';try{const d=new Date(String(v).length===10?`${v}T00:00:00`:v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch(e){return String(v)}};
  const todayLocal=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};

  let activeIncidentId='';
  let syncBusy=false;
  let lastSmartPull=0;
  let patchQueued=false;
  let dashboardBooted=false;

  function subjectOf(i){
    if(!i)return '미입력';
    const d=i.reportDetails||{};
    if(String(i.category||'')==='property')return txt(d.workerName||d.propertyWorker||i.workerName)||'미입력';
    return txt(d.injuredName||i.injuredName)||'미입력';
  }
  function subjectWithJob(i){
    const name=subjectOf(i),job=txt(i?.reportDetails?.job||i?.job);
    return job&&name!=='미입력'?`${name} · ${job}`:name;
  }
  function rememberIncident(id){if(id){activeIncidentId=String(id);window.ENL_ACTIVE_INCIDENT_ID432=activeIncidentId}}

  function attachments(){
    try{if(typeof actionPhotos!=='undefined'&&Array.isArray(actionPhotos))return actionPhotos}catch(e){}
    return getIncident(activeIncidentId)?.corrective?.afterPhotos||[];
  }
  function incidentAttachments(){
    try{if(typeof incidentPhotos!=='undefined'&&Array.isArray(incidentPhotos))return incidentPhotos}catch(e){}
    return [];
  }

  function setRequiredState(control){
    if(!control||control.disabled||control.type==='hidden')return;
    const required=!!control.required;
    if(!required){control.classList.remove('enl432-required-empty','enl432-required-filled');return}
    const filled=control.type==='checkbox'?control.checked:txt(control.value)!=='';
    control.classList.toggle('enl432-required-empty',!filled);
    control.classList.toggle('enl432-required-filled',filled);
    control.closest('.lbl')?.classList.toggle('enl432-label-empty',!filled);
  }
  function bindRequiredForm(form){
    if(!form)return;
    form.querySelectorAll('input,textarea,select').forEach(setRequiredState);
    if(form.dataset.enl432RequiredBound==='1')return;
    form.dataset.enl432RequiredBound='1';
    const update=e=>setRequiredState(e.target);
    form.addEventListener('input',update,true);
    form.addEventListener('change',update,true);
  }

  function updateEvidenceState(){
    const fieldForm=document.getElementById('prev429FieldForm');
    if(fieldForm){
      const n=attachments().length;
      const box=fieldForm.querySelector('#prev432EvidenceRequired');
      if(box){box.classList.toggle('is-empty',n<1);box.classList.toggle('is-filled',n>0);const c=box.querySelector('[data-prev432-count]');if(c)c.textContent=`현재 ${n}개 첨부`}
      fieldForm.querySelector('.photo-box')?.classList.toggle('enl432-evidence-empty',n<1);
    }
    const report=document.getElementById('unifiedReportForm');
    if(report){
      const n=incidentAttachments().length;
      report.querySelector('.report410-photo')?.classList.toggle('enl432-evidence-empty',n<1);
    }
  }

  function patchReportRequired(){
    const form=document.getElementById('unifiedReportForm');
    if(!form)return;
    if(form.dataset.reportType==='property'){
      const worker=form.querySelector('#propertyWorker410');
      if(worker){
        worker.required=true;
        const span=worker.closest('label')?.querySelector('span');
        if(span&& !span.textContent.includes('*'))span.textContent='작업자 성명 *';
      }
    }
    bindRequiredForm(form);
    updateEvidenceState();
  }

  function actionIncident(){return getIncident(activeIncidentId)}
  function saveCompletionDateFromForm(){
    const form=document.getElementById('prev429FieldForm'),input=form?.querySelector('#prev432CompletedDate'),i=actionIncident();
    if(!form||!input||!i?.corrective||!txt(input.value))return;
    i.corrective.actionCompletedDate=txt(input.value);
    i.corrective.completedDate=txt(input.value);
    i.corrective.actionCompletedBy=currentUser?.()?.name||'';
  }
  function validateActionSubmit(form){
    const input=form?.querySelector('#prev432CompletedDate');
    if(!input||!txt(input.value)){
      input?.classList.add('enl432-required-empty');input?.focus();
      alert('재발방지조치를 실제로 완료한 날짜를 입력해 주세요.');return false;
    }
    if(input.value>todayLocal()){
      input.classList.add('enl432-required-empty');input.focus();
      alert('실제 완료일은 오늘 이후 날짜로 입력할 수 없습니다.');return false;
    }
    if(attachments().length<1){
      updateEvidenceState();
      form.querySelector('#prev432EvidenceRequired')?.scrollIntoView({behavior:'smooth',block:'center'});
      alert('개선조치 사진 또는 PDF를 1개 이상 첨부해 주세요.');return false;
    }
    saveCompletionDateFromForm();
    return true;
  }

  function patchFieldActionForm(){
    const form=document.getElementById('prev429FieldForm');
    if(!form)return;
    const u=currentUser?.();
    if(!isActionManager(u)){
      const modal=form.closest('.modal');
      if(modal&&!modal.querySelector('.prev432-no-permission')){
        form.outerHTML='<div class="prev432-no-permission"><b>재발방지조치 결과 작성 권한이 없습니다.</b><p>현장소장·파트장·서무만 실제 조치결과를 작성하고 제출할 수 있습니다. 일반근로자는 재발방지계획과 진행상태만 확인할 수 있습니다.</p></div>';
      }
      return;
    }
    if(form.dataset.enl432Action==='1'){bindRequiredForm(form);updateEvidenceState();return}
    form.dataset.enl432Action='1';
    const i=actionIncident(),c=i?.corrective||{};
    const detail=form.querySelector('#prev429ActionDetail');
    if(detail){
      const label=detail.closest('label');
      const date=document.createElement('label');date.className='lbl prev432-completed-label';
      date.innerHTML=`<span>실제 조치 완료일 *</span><input id="prev432CompletedDate" type="date" required max="${todayLocal()}" value="${ex(c.actionCompletedDate||c.completedDate||'')}">`;
      label?.insertAdjacentElement('afterend',date);
    }
    const actions=form.querySelector('.modal-actions');
    if(actions){
      const evidence=document.createElement('div');evidence.id='prev432EvidenceRequired';evidence.className='prev432-evidence-required';
      evidence.innerHTML='<b>개선조치 증빙 *</b><span>사진 또는 PDF 1개 이상 필수 · <em data-prev432-count>현재 0개 첨부</em></span>';
      actions.insertAdjacentElement('beforebegin',evidence);
    }
    bindRequiredForm(form);updateEvidenceState();
    form.addEventListener('submit',e=>{
      if(!validateActionSubmit(form)){e.preventDefault();e.stopImmediatePropagation()}
    },true);
    form.querySelector('#prev429Draft')?.addEventListener('click',()=>{saveCompletionDateFromForm();setTimeout(updateEvidenceState,0)},true);
  }

  function openWorkerReadOnly(id,u){
    const i=getIncident(id);if(!i)return alert('사고기록을 찾지 못했습니다.');
    if(String(i.siteId||'')!==String(u?.siteId||''))return alert('소속 사업장의 사고만 확인할 수 있습니다.');
    const c=i.corrective||{},photos=c.afterPhotos||[],status=window.enlPreventionFlowV429?.statusText?.(i)||'재발방지 진행상태 확인';
    const files=typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(photos):'';
    openModal(`<div class="modal-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>${ex(siteName(i.siteId))} · 재발방지계획 확인</h2><div class="prev432-read-status">${ex(status)}</div></div><button class="x" data-close>×</button></div><div class="prev432-worker-summary"><div><b>누가</b><span>${ex(subjectWithJob(i))}</span></div><div><b>사고내용</b><span>${ex(i.summary||i.reportDetails?.incidentHow||'-')}</span></div></div><section class="prev429-modal-section"><h3>안전관리자 재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'미등록')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'미등록')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'미지정')} · ${ex(c.dueDate||'미지정')}</span></div></div></section>${c.actionDetail?`<section class="prev429-modal-section"><h3>현장 재발방지조치 결과</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>실시 내용</b><span>${ex(c.actionDetail)}</span></div><div class="prev429-kv"><b>실제 완료일</b><span>${ex(fmtDate(c.actionCompletedDate||c.completedDate))}</span></div>${files?`<div>${files}</div>`:''}</div></section>`:''}<div class="prev432-no-permission compact"><b>작성 권한 안내</b><p>재발방지조치 결과 작성·제출은 현장소장·파트장·서무만 할 수 있습니다.</p></div>`);
    try{window.enlBindAttachmentOpen?.(document.getElementById('modalRoot'),photos)}catch(e){}
  }

  function patchPreventionButtons(){
    const u=currentUser?.();if(!isField(u)||isActionManager(u))return;
    document.querySelectorAll('[data-prev-open]').forEach(b=>{
      if(b.disabled)return;
      const i=getIncident(b.dataset.prevOpen),s=String(i?.corrective?.status||'');
      b.textContent=s==='approved'?'확인완료 내용 보기':'재발방지계획 확인';
      b.title='일반근로자는 조회만 가능합니다.';
    });
  }

  function patchCompletionDisplay(){
    const i=actionIncident();if(!i)return;const c=i.corrective||{},date=c.actionCompletedDate||c.completedDate;if(!date)return;
    document.querySelectorAll(`[data-prev-card="${CSS.escape(String(i.id))}"] .prev429-grid`).forEach(grid=>{
      if(grid.querySelector('[data-prev432-completed]'))return;
      const box=document.createElement('div');box.dataset.prev432Completed='1';box.className='prev432-completed';box.innerHTML=`<b>실제 조치 완료일</b><span>${ex(fmtDate(date))}</span>`;grid.appendChild(box);
    });
    const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
    modal.querySelectorAll('.prev429-modal-section').forEach(section=>{
      const h=txt(section.querySelector('h3')?.textContent);if(!h.includes('재발방지조치'))return;
      const body=section.querySelector('.prev429-modal-body');if(!body||body.querySelector('[data-prev432-completed]'))return;
      const row=document.createElement('div');row.className='prev429-kv';row.dataset.prev432Completed='1';row.innerHTML=`<b>실제 완료일</b><span>${ex(fmtDate(date))}</span>`;body.appendChild(row);
    });
  }

  function patchWho(){
    const i=actionIncident();if(!i)return;const who=subjectWithJob(i),modal=document.querySelector('#modalRoot .modal');if(!modal)return;
    const overview=modal.querySelector('.inc411-overview');
    if(overview&&!overview.querySelector('[data-prev432-who]')){
      const box=document.createElement('div');box.dataset.prev432Who='1';box.innerHTML=`<span>누가</span><b>${ex(who)}</b>`;
      const children=overview.children;children.length>1?children[1].insertAdjacentElement('afterend',box):overview.prepend(box);
    }
    const detail=modal.querySelector('.detail');
    if(detail){
      let row=[...detail.querySelectorAll('.detail-row')].find(r=>txt(r.querySelector('b')?.textContent)==='사고자/관련자'||txt(r.querySelector('b')?.textContent)==='누가');
      if(row){row.querySelector('b').textContent='누가';const s=row.querySelector('span');if(s)s.textContent=who}
      else{row=document.createElement('div');row.className='detail-row';row.dataset.prev432Who='1';row.innerHTML=`<b>누가</b><span>${ex(who)}</span>`;detail.insertBefore(row,detail.children[1]||null)}
    }
  }

  function patchDashboard(){
    const u=currentUser?.();if(!canDashboard(u))return;
    const nav=document.querySelector('.shell411-nav'),btn=nav?.querySelector('[data-stats426-nav]');
    if(btn){btn.textContent='대시보드';if(nav.firstElementChild!==btn)nav.insertBefore(btn,nav.firstElementChild)}
    const stats=document.querySelector('.stats426');if(stats){
      const h=stats.querySelector('.stats426-head h2');if(h)h.textContent='사고 대시보드';
      const ey=stats.querySelector('.stats426-head .ey');if(ey)ey.textContent='DASHBOARD';
      const p=stats.querySelector('.stats426-head p');if(p)p.textContent=roleNorm(u.role)==='safety'?'전체 사고보고 자료를 기준으로 주요 현황을 보여줍니다.':'승인·종결 사고를 기준으로 주요 현황을 보여줍니다.';
    }
  }

  async function smartPull(){
    const u=currentUser?.();if(!u||syncBusy||document.visibilityState==='hidden')return;
    if(document.querySelector('#unifiedReportForm,#prev429FieldForm'))return;
    const now=Date.now();if(now-lastSmartPull<8000)return;lastSmartPull=now;
    const fn=window.enlIncidentPullNow;if(typeof fn!=='function')return;
    syncBusy=true;try{await fn()}catch(e){}finally{syncBusy=false}
  }

  function patchAll(){
    patchQueued=false;
    patchDashboard();patchReportRequired();patchFieldActionForm();patchPreventionButtons();patchCompletionDisplay();patchWho();updateEvidenceState();
  }
  function queuePatch(){if(patchQueued)return;patchQueued=true;requestAnimationFrame(patchAll)}

  /* Confirmation gate before the authoritative accident receipt/approval action. */
  document.addEventListener('click',e=>{
    const approve=e.target.closest?.('#approveInc');
    if(approve){
      if(!window.confirm('수신완료 처리 하시겠습니까?')){e.preventDefault();e.stopImmediatePropagation();return}
    }
    const p=e.target.closest?.('[data-prev-open]');
    if(p){
      rememberIncident(p.dataset.prevOpen);
      const u=currentUser?.();
      if(isField(u)&&!isActionManager(u)&&!p.disabled){e.preventDefault();e.stopImmediatePropagation();openWorkerReadOnly(p.dataset.prevOpen,u);return}
    }
    const inc=e.target.closest?.('[data-inc-id],[data-manager-inc],[data-safety-inc]');
    if(inc)rememberIncident(inc.dataset.incId||inc.dataset.managerInc||inc.dataset.safetyInc);
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.id==='incidentPhotoInput'||e.target?.id==='actionPhotoInput')setTimeout(()=>{updateEvidenceState();patchAll()},60)
  },true);
  document.addEventListener('input',e=>{if(e.target?.matches?.('input[required],textarea[required],select[required]'))setRequiredState(e.target)},true);

  /* Keep the current incident id when routes open details programmatically. */
  const baseOpenReview=window.enlOpenIncidentReview;
  if(typeof baseOpenReview==='function')window.enlOpenIncidentReview=function(id){rememberIncident(id);const out=baseOpenReview.apply(this,arguments);queuePatch();return out};
  const baseOpenUnified=window.openUnifiedCorrectiveModal;
  if(typeof baseOpenUnified==='function')window.openUnifiedCorrectiveModal=function(id){rememberIncident(id);const out=baseOpenUnified.apply(this,arguments);queuePatch();return out};
  if(window.enlPreventionFlowV429?.open){const old=window.enlPreventionFlowV429.open;window.enlPreventionFlowV429.open=function(id){rememberIncident(id);const out=old.apply(this,arguments);queuePatch();return out}}

  /* Lightweight sync assist: no new timer. Pull only on focus and after modal close, throttled. */
  window.addEventListener('focus',()=>setTimeout(smartPull,80));
  const baseClose=window.closeModal;
  if(typeof baseClose==='function'){
    const wrapped=function(){const out=baseClose.apply(this,arguments);setTimeout(smartPull,120);return out};
    window.closeModal=wrapped;try{closeModal=wrapped}catch(e){}
  }

  /* Dashboard is the initial landing only for HQ/admin readers; field users keep the field home. */
  const baseRenderApp=window.enlRenderApp;
  if(typeof baseRenderApp==='function'){
    window.enlRenderApp=function(u){if(canDashboard(u))currentView='stats';dashboardBooted=true;const out=baseRenderApp.apply(this,arguments);queuePatch();return out};
  }
  const initial=currentUser?.();
  if(initial&&canDashboard(initial)&&!dashboardBooted){
    dashboardBooted=true;
    setTimeout(()=>{try{currentView='stats';window.renderShell?.(initial);queuePatch()}catch(e){}},0);
  }

  const observer=new MutationObserver(queuePatch);observer.observe(document.body,{childList:true,subtree:true});
  queuePatch();
  window.ENL_WORKFLOW_ENHANCEMENTS_VERSION=VERSION;
})();
