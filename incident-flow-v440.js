/* E&L Accident Report App v4.4.0 - immediate report, supplement, acknowledgement workflow */
(function(){
  'use strict';

  const VERSION='4.4.0-immediate-supplement-ack1';
  const PUSH_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-v418';
  const CLIENT='incident-report-v2';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const uid=u=>String(u?.personnelId||u?.id||u?.username||'');
  const text=v=>String(v??'').trim();
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();
  const isSafety=u=>roleNorm(u?.role)==='safety';
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const isField=u=>['field','worker'].includes(String(u?.role||''));
  const isFieldManager=u=>String(u?.role||'')==='field'&&MANAGER_POSITIONS.includes(String(u?.position||u?.jobTitle||''));
  const canConfirm=u=>isSafety(u)||isReader(u)||isFieldManager(u);
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const incident=id=>(data?.incidents||[]).find(i=>String(i.id)===String(id));
  const persistAttachments=arr=>(arr||[]).map(a=>typeof window.enlPersistAttachment==='function'?window.enlPersistAttachment(a):a);
  let activeId='',supplementFiles=[],patchQueued=false;

  const STATUS={
    reported:'즉시보고 검토대기',
    supplement:'보완대기',
    supplement_submitted:'보완검토대기',
    rejected:'보고 반려',
    approved:'사고보고 최종승인',
    closed:'종결'
  };
  const stateLabel=i=>STATUS[String(i?.status||'')]||String(i?.status||'진행중');

  function ensureCss(){
    if(document.getElementById('wf440Css'))return;
    const s=document.createElement('style');s.id='wf440Css';s.textContent=`
      .wf440-sla{margin:0 0 13px;padding:12px 13px;border:2px solid #d8aa45;border-radius:12px;background:#fff8e9;color:#694d16;font-size:12px;line-height:1.55}
      .wf440-sla b{display:block;color:#784f00;font-size:14px;margin-bottom:3px}.wf440-sla small{display:block;margin-top:4px;color:#81662e}
      .wf440-stage{margin:10px 0 12px;padding:12px 13px;border:1.5px solid #bfd4e3;border-radius:12px;background:#f5faff;color:#315a77;line-height:1.5}
      .wf440-stage b{display:block;color:#174d78;font-size:14px}.wf440-stage.supplement{border-color:#e7be66;background:#fff9e9;color:#735619}.wf440-stage.approved{border-color:#94c5a7;background:#f0f9f3;color:#286044}
      .wf440-supplement-note{margin:10px 0;padding:11px 12px;border:1px solid #e4c77d;border-radius:11px;background:#fff9e8;color:#6e551e;font-size:12px;line-height:1.55}
      .wf440-supplement-note ul{margin:6px 0 0 18px;padding:0}.wf440-supplement-note li{margin:3px 0}
      .wf440-safety-actions{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0}.wf440-safety-actions button{min-height:44px;border:0;border-radius:10px;padding:0 13px;font-weight:950}
      .wf440-supp-btn{background:#d59122;color:#fff}.wf440-final-btn{background:#216b48;color:#fff}.wf440-invalid-btn{background:#fff;color:#973d3d;border:1px solid #dda9a9!important}
      .wf440-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.wf440-wide{grid-column:1/-1}
      .wf440-request-list{display:grid;gap:7px;margin:10px 0}.wf440-request{display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid #d7e3ec;border-radius:10px;background:#fff}.wf440-request input{width:21px;height:21px;flex:0 0 auto}
      .wf440-filebox{margin-top:10px;padding:11px;border:2px solid #d1e0ea;border-radius:11px;background:#f8fbfd}.wf440-filebox.required-empty{border-color:#d84646;background:#fffafa}
      .wf440-file-list{display:grid;gap:5px;margin-top:8px}.wf440-file{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border:1px solid #dbe5ed;border-radius:8px;background:#fff;font-size:11px}.wf440-file button{border:0;background:#fff0f0;color:#9d3838;border-radius:7px;padding:5px 8px;font-weight:850}
      .wf440-queue{margin-bottom:12px;border:2px solid #e3bd69!important;background:#fffbef!important}.wf440-queue-list{display:grid;gap:7px;margin-top:9px}.wf440-queue-row{width:100%;display:grid;grid-template-columns:100px minmax(0,1fr) auto;gap:9px;align-items:center;border:1px solid #e3cf9c;border-radius:10px;background:#fff;padding:10px;text-align:left;color:inherit}.wf440-queue-row b{color:#5f470d}.wf440-queue-row span{font-size:11px;color:#6b7f91}.wf440-queue-row strong{color:#9a6500;font-size:11px}
      .wf440-confirm{margin:12px 0;border:2px solid #b7d5c2;border-radius:13px;background:#f4fbf6;padding:12px}.wf440-confirm h3{margin:0;color:#286044;font-size:15px}.wf440-confirm p{margin:5px 0 9px;color:#537363;font-size:11px;line-height:1.5}
      .wf440-confirm-list{display:grid;gap:5px;margin:8px 0}.wf440-confirm-person{display:flex;justify-content:space-between;gap:8px;padding:7px 8px;border-radius:8px;background:#fff;border:1px solid #d6e8dc;font-size:11px}.wf440-confirm-person b{color:#2c5f43}.wf440-confirm-person span{color:#637b6d}
      .wf440-confirm button{width:100%;min-height:46px;border:0;border-radius:10px;background:#216b48;color:#fff;font-weight:950}.wf440-confirm button.done{background:#fff;border:1px solid #a8cfb6;color:#286044}
      .wf440-viewlog{margin-top:10px;padding-top:9px;border-top:1px dashed #c9dbd0}.wf440-viewlog b{font-size:11px;color:#587166}.wf440-viewlog-list{margin-top:5px;display:flex;gap:5px;flex-wrap:wrap}.wf440-view-chip{display:inline-flex;padding:5px 7px;border-radius:999px;background:#eef6f1;color:#557064;font-size:9px;font-weight:850}
      .wf440-reader-pending{margin:0 0 12px;padding:11px;border:1.5px solid #e3bb62;border-radius:12px;background:#fff9e7}.wf440-reader-pending h3{margin:0 0 7px;color:#795609;font-size:14px}.wf440-reader-pending-list{display:grid;gap:6px}.wf440-reader-pending button{width:100%;border:1px solid #e4d09c;border-radius:9px;background:#fff;padding:9px;text-align:left;color:#35536b}.wf440-reader-pending button b{display:block;color:#6b4d0e}.wf440-reader-pending button small{display:block;margin-top:3px;color:#738595}
      .wf440-sensitive{margin:10px 0;padding:10px;border-radius:10px;background:#f4f6f8;color:#607181;font-size:11px;line-height:1.5}
      @media(max-width:620px){.wf440-form-grid{grid-template-columns:1fr}.wf440-wide{grid-column:auto}.wf440-safety-actions button{flex:1 1 140px}.wf440-queue-row{grid-template-columns:80px minmax(0,1fr)}.wf440-queue-row strong{grid-column:1/-1}}
    `;document.head.appendChild(s)
  }

  function actor(u=currentUser?.()){
    return u?{id:uid(u),name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  }

  function workflow(i){
    if(!i)return {};
    i.reportWorkflow=i.reportWorkflow&&typeof i.reportWorkflow==='object'?i.reportWorkflow:{};
    if(!i.reportWorkflow.immediateReportedAt)i.reportWorkflow.immediateReportedAt=i.registeredAt||i.createdAt||now();
    if(!i.reportWorkflow.internalSla)i.reportWorkflow.internalSla='사고 인지 후 30분 이내 또는 현장 이탈 전 즉시보고';
    const occurred=Date.parse(i.occurredAt||''),created=Date.parse(i.reportWorkflow.immediateReportedAt||'');
    if(Number.isFinite(occurred)&&Number.isFinite(created)&&created>=occurred&&!Number.isFinite(Number(i.reportWorkflow.immediateDelayMinutes)))i.reportWorkflow.immediateDelayMinutes=Math.round((created-occurred)/60000);
    const st=String(i.status||'');
    i.reportWorkflow.phase=st==='reported'?'immediate_review':st==='supplement'?'supplement_waiting':st==='supplement_submitted'?'supplement_review':st==='approved'?'report_approved':st==='closed'?'closed':st;
    if(['approved','closed'].includes(st)&&!i.reportWorkflow.finalApprovedAt){
      i.reportWorkflow.finalApprovedAt=i.approvedAt||now();i.reportWorkflow.finalApprovedBy=i.approvedBy||'안전관리자';
    }
    return i.reportWorkflow;
  }

  function normalizeWorkflows(){
    let changed=false;
    for(const i of data?.incidents||[]){
      if(!i||!['person','property'].includes(String(i.category||'')))continue;
      const before=JSON.stringify(i.reportWorkflow||null);workflow(i);if(before!==JSON.stringify(i.reportWorkflow||null))changed=true;
    }
    return changed;
  }

  const priorSave=typeof saveData==='function'?saveData:null;
  if(priorSave&&!priorSave.__wf440){
    const wrapped=function(){normalizeWorkflows();return priorSave.apply(this,arguments)};wrapped.__wf440=true;
    saveData=wrapped;
  }
  normalizeWorkflows();

  function fieldState(el){
    if(!el||!el.required||el.disabled||el.type==='hidden')return;
    const filled=el.type==='checkbox'?el.checked:text(el.value)!=='';
    el.classList.toggle('enl432-required-empty',!filled);el.classList.toggle('enl432-required-filled',filled);
    el.closest('.lbl')?.classList.toggle('enl432-label-empty',!filled);
  }

  function patchImmediateForm(){
    const form=document.getElementById('unifiedReportForm');if(!form)return;
    const property=form.dataset.reportType==='property';
    const worker=form.querySelector('#propertyWorker410');if(worker){worker.required=false;const sp=worker.closest('label')?.querySelector('span');if(sp)sp.textContent='작업자 성명 (확인된 경우)'}
    const immediateIds=['reportSite','occurredDate410','occurredTime410','incidentPlace410','eventType','workAction410','incidentHow410','immediateAction'];
    if(property)immediateIds.push('damagedItem410','damageDetail410');else immediateIds.push('injuredName','injuryDetail410');
    immediateIds.forEach(id=>{const el=form.querySelector('#'+id);if(el){el.required=true;fieldState(el)}});
    const head=form.querySelector('.section-head');
    if(head&&!form.querySelector('.wf440-sla')){
      const box=document.createElement('div');box.className='wf440-sla';box.innerHTML='<b>즉시보고 원칙</b>사고 인지 후 <strong>30분 이내 또는 현장 이탈 전</strong>에 현재 확인 가능한 사실을 먼저 등록합니다.<small>30분 기준은 이앤엘 내부 보고 목표이며 법정 신고기한을 의미하지 않습니다. 진단·병원비·휴업일수·수리견적·최종 피해금액은 확인 후 보완할 수 있습니다.</small>';
      head.insertAdjacentElement('afterend',box);
    }
    const deferred=property?[
      ['repairCost410','복구 예상 비용 (사후 보완 가능)'],
      ['repairCostDetail410','견적 / 비용 상세내역 (사후 보완 가능)']
    ]:[
      ['diagnosis410','진단명 (사후 보완 가능)'],
      ['doctorOpinion410','의사 소견 / 치료 예상기간 (사후 보완 가능)'],
      ['medicalCost410','진료비 (사후 보완 가능)'],
      ['medicalCostDetail410','진료비 상세내역 (사후 보완 가능)']
    ];
    deferred.forEach(([id,label])=>{const el=form.querySelector('#'+id);if(!el)return;el.required=false;const sp=el.closest('label')?.querySelector('span');if(sp)sp.textContent=label});
    if(!form.dataset.wf440Bound){form.dataset.wf440Bound='1';form.addEventListener('input',e=>fieldState(e.target),true);form.addEventListener('change',e=>fieldState(e.target),true)}
  }

  function requestDefinitions(i){
    return i?.category==='person' ? [
      ['diagnosis','진단명'],
      ['doctorOpinion','의사 소견·치료 예상기간'],
      ['medicalCost','병원비·진료비'],
      ['leaveEstimate','휴업·치료기간 확인'],
      ['medicalDocument','진단서·병원비 등 증빙']
    ] : [
      ['repairCost','수리·복구 견적금액'],
      ['repairCostDetail','견적·비용 상세내역'],
      ['estimateDocument','견적서·수리 관련 증빙']
    ];
  }

  function supplementList(i){
    const requested=new Set(i?.supplement?.requestedFields||[]);
    return requestDefinitions(i).filter(([k])=>requested.has(k)).map(([,label])=>label);
  }

  function openSupplementRequest(i,u){
    const current=new Set(i?.supplement?.requestedFields||[]),defs=requestDefinitions(i);
    openModal(`<div class="modal-head"><div><div class="ey">SUPPLEMENT REQUEST</div><h2>${ex(siteName(i.siteId))} · 사고보고 보완요청</h2><p>즉시보고 이후 확인 가능한 자료만 선택합니다.</p></div><button class="x" data-close>×</button></div>
      <form id="wf440RequestForm"><div class="wf440-request-list">${defs.map(([k,label])=>`<label class="wf440-request"><input type="checkbox" value="${ex(k)}" ${current.has(k)?'checked':''}><span><b>${ex(label)}</b></span></label>`).join('')}</div>
      <label class="lbl"><span>보완요청 메모</span><textarea id="wf440RequestNote" rows="3" placeholder="예: 병원 진료 후 진단명과 실제 결제금액을 입력해 주세요.">${ex(i?.supplement?.requestNote||'')}</textarea></label>
      <button class="primary full" type="submit">보완대기로 전환</button></form>`);
    document.getElementById('wf440RequestForm').onsubmit=e=>{
      e.preventDefault();const fields=[...e.currentTarget.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value),note=text(document.getElementById('wf440RequestNote')?.value);
      if(!fields.length&&!note)return alert('보완이 필요한 항목을 하나 이상 선택하거나 보완요청 메모를 입력해 주세요.');
      const ts=now();i.status='supplement';i.supplement={...(i.supplement||{}),status:'waiting',requestedFields:fields,requestNote:note,requestedBy:u.name,requestedById:uid(u),requestedAt:ts,submittedAt:null};
      const w=workflow(i);w.phase='supplement_waiting';w.supplementRequestedAt=ts;w.supplementRequestedBy=u.name;i.updatedAt=ts;
      saveData();closeModal();renderShell(u);alert('사고보고를 보완대기로 전환했습니다. 현장관리자에게 보완요청이 전달됩니다.');
    };
  }

  function renderSupplementFiles(root){
    const list=root?.querySelector('#wf440SupplementFiles');if(!list)return;
    list.innerHTML=supplementFiles.map((f,idx)=>`<div class="wf440-file"><span>${ex(f.name||f.fileName||'첨부자료')}</span><button type="button" data-wf440-file-rm="${idx}">삭제</button></div>`).join('')||'<span style="font-size:11px;color:#728598">첨부된 보완자료가 없습니다.</span>';
    list.querySelectorAll('[data-wf440-file-rm]').forEach(b=>b.onclick=()=>{supplementFiles.splice(Number(b.dataset.wf440FileRm),1);renderSupplementFiles(root);validateSupplementVisual(root)});
  }
  function validateSupplementVisual(root){
    root?.querySelectorAll('[required]').forEach(fieldState);
    const req=new Set(root?.dataset.requested?JSON.parse(root.dataset.requested):[]);
    const needFile=req.has('medicalDocument')||req.has('estimateDocument');
    root?.querySelector('.wf440-filebox')?.classList.toggle('required-empty',needFile&&supplementFiles.length<1);
  }

  function openSupplementForm(i,u){
    if(!isFieldManager(u)||String(i.siteId)!==String(u.siteId))return alert('해당 사업장 현장관리자만 보완자료를 입력할 수 있습니다.');
    if(String(i.status)!=='supplement')return alert('현재 보완자료 입력 상태가 아닙니다.');
    const d=i.reportDetails||{},req=new Set(i?.supplement?.requestedFields||[]);
    supplementFiles=[...(i?.supplement?.attachments||[])];
    const required=k=>req.has(k)?'required':'';
    const star=k=>req.has(k)?' *':'';
    const body=i.category==='person'?`
      <div class="wf440-form-grid">
        <label class="lbl"><span>진단명${star('diagnosis')}</span><input id="wf440Diagnosis" value="${ex(d.diagnosis||'')}" ${required('diagnosis')}></label>
        <label class="lbl"><span>휴업·치료 예상${star('leaveEstimate')}</span><select id="wf440Leave" ${required('leaveEstimate')}><option value="">선택</option><option value="none">휴업 없음</option><option value="under3">3일 미만</option><option value="3plus">3일 이상</option><option value="longterm">장기치료·중상 가능</option></select></label>
        <label class="lbl wf440-wide"><span>의사 소견 / 치료 예상기간${star('doctorOpinion')}</span><textarea id="wf440Doctor" rows="3" ${required('doctorOpinion')}>${ex(d.doctorOpinion||'')}</textarea></label>
        <label class="lbl"><span>현재 확인된 진료비${star('medicalCost')}</span><input id="wf440MedicalCost" type="number" min="0" inputmode="numeric" value="${ex(d.medicalCost||'')}" ${required('medicalCost')}></label>
        <label class="lbl"><span>진료비 상세내역</span><input id="wf440MedicalDetail" value="${ex(d.medicalCostDetail||'')}"></label>
      </div>`:`
      <div class="wf440-form-grid">
        <label class="lbl"><span>수리·복구 견적금액${star('repairCost')}</span><input id="wf440RepairCost" type="number" min="0" inputmode="numeric" value="${ex(d.repairCost||'')}" ${required('repairCost')}></label>
        <label class="lbl wf440-wide"><span>견적·비용 상세내역${star('repairCostDetail')}</span><textarea id="wf440RepairDetail" rows="3" ${required('repairCostDetail')}>${ex(d.repairCostDetail||'')}</textarea></label>
      </div>`;
    openModal(`<div class="modal-head"><div><div class="ey">SUPPLEMENT</div><h2>${ex(siteName(i.siteId))} · 사고보고 보완자료</h2><p>사고 직후에는 알 수 없었던 진단·비용·견적 등의 사후 확인자료를 입력합니다.</p></div><button class="x" data-close>×</button></div>
      <div class="wf440-supplement-note"><b>안전관리자 요청사항</b><ul>${supplementList(i).map(x=>`<li>${ex(x)}</li>`).join('')||'<li>보완요청 메모를 확인해 주세요.</li>'}</ul>${i.supplement?.requestNote?`<div style="margin-top:6px">${ex(i.supplement.requestNote)}</div>`:''}</div>
      <form id="wf440SupplementForm" data-requested='${ex(JSON.stringify([...(i.supplement?.requestedFields||[])]))}'>${body}
        <div class="wf440-filebox"><b>진단서·영수증·견적서 등 보완자료</b><div style="margin-top:6px"><input id="wf440SupplementFile" type="file" accept="image/*,application/pdf" multiple></div><div id="wf440SupplementFiles" class="wf440-file-list"></div></div>
        <button class="primary full" type="submit" style="margin-top:11px">보완완료 · 안전관리자 검토요청</button>
      </form>`);
    const form=document.getElementById('wf440SupplementForm');if(!form)return;
    if(i.category==='person'){const leave=form.querySelector('#wf440Leave');if(leave)leave.value=i.leaveEstimate||d.leaveEstimate||''}
    renderSupplementFiles(form);validateSupplementVisual(form);
    form.addEventListener('input',e=>fieldState(e.target),true);form.addEventListener('change',e=>fieldState(e.target),true);
    form.querySelector('#wf440SupplementFile').onchange=async e=>{
      try{if(typeof addFiles==='function')supplementFiles=await addFiles(supplementFiles,e.target.files,'incident');else alert('첨부파일 처리기능을 불러오지 못했습니다.');}
      catch(err){alert('보완자료를 추가하지 못했습니다.')}e.target.value='';renderSupplementFiles(form);validateSupplementVisual(form);
    };
    form.onsubmit=e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const needFile=req.has('medicalDocument')||req.has('estimateDocument');if(needFile&&supplementFiles.length<1){validateSupplementVisual(form);return alert('안전관리자가 요청한 증빙자료를 1개 이상 첨부해 주세요.')}
      if(i.category==='person'){
        d.diagnosis=text(form.querySelector('#wf440Diagnosis')?.value);d.doctorOpinion=text(form.querySelector('#wf440Doctor')?.value);d.medicalCost=Number(form.querySelector('#wf440MedicalCost')?.value||0)||0;d.medicalCostDetail=text(form.querySelector('#wf440MedicalDetail')?.value);i.leaveEstimate=text(form.querySelector('#wf440Leave')?.value)||i.leaveEstimate||'unknown';
      }else{
        d.repairCost=Number(form.querySelector('#wf440RepairCost')?.value||0)||0;d.repairCostDetail=text(form.querySelector('#wf440RepairDetail')?.value);
      }
      const ts=now();i.reportDetails=d;i.status='supplement_submitted';i.supplement={...(i.supplement||{}),status:'submitted',attachments:persistAttachments(supplementFiles),submittedBy:u.name,submittedById:uid(u),submittedAt:ts};
      const w=workflow(i);w.phase='supplement_review';w.supplementSubmittedAt=ts;w.supplementSubmittedBy=u.name;i.updatedAt=ts;
      saveData();supplementFiles=[];closeModal();renderShell(u);alert('보완자료를 안전관리자 검토대기로 제출했습니다.');
    };
  }

  function applySafetyFields(i,u){
    const p=document.getElementById('priorityEdit411')?.value;if(['normal','important','urgent'].includes(p)){i.priority=p;i.prioritySource='manual';i.prioritySetBy=u.name;i.prioritySetAt=now()}
    const note=text(document.getElementById('safetyNoteEdit')?.value);if(note)i.safetyNote=note;
  }

  function finalApprove(i,u){
    if(!confirm('이 사고보고 내용을 최종승인할까요?\n이 확인은 전자결재가 아니라 사고보고 내용 확정 단계이며, 이후 재발방지계획을 수립합니다.'))return;
    applySafetyFields(i,u);const ts=now();i.status='approved';i.approvedBy=u.name;i.approvedAt=ts;i.rejectionNote='';i.readReceipts=[];
    if(i.supplement)i.supplement={...i.supplement,status:'accepted',approvedBy:u.name,approvedById:uid(u),approvedAt:ts};
    const w=workflow(i);w.phase='report_approved';w.finalApprovedAt=ts;w.finalApprovedBy=u.name;w.finalApprovedById=uid(u);i.updatedAt=ts;
    saveData();closeModal();renderShell(u);alert('사고보고를 최종승인했습니다. 이제 재발방지계획을 수립할 수 있습니다.');
  }

  async function pushApi(action,extra={}){
    const u=currentUser?.();if(!u)return null;
    try{
      const r=await fetch(PUSH_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action,actor:actor(u),...extra}),cache:'no-store'});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||'push_api_error');return j;
    }catch(e){return null}
  }
  function recordView(id,documentType='incident_report'){const u=currentUser?.();if(!canConfirm(u))return;pushApi('management_view',{incidentId:id,documentType}).then(()=>window.enlPushFlush?.()).catch(()=>{})}
  async function viewHistory(id){return (await pushApi('view_list',{incidentId:id}))?.views||[]}

  function acknowledgements(i,type){return (Array.isArray(i?.acknowledgements)?i.acknowledgements:[]).filter(x=>String(x.documentType||'incident_report')===type)}
  function myAck(i,u,type){return acknowledgements(i,type).find(x=>String(x.userId||'')===uid(u))}

  async function addAckSection(modal,i,u,type){
    if(!canConfirm(u))return;
    const allowed=type==='incident_report'?['approved','closed'].includes(String(i.status||'')):String(i.corrective?.status||'')==='approved';
    if(!allowed)return;
    const existing=modal.querySelector(`[data-wf440-confirm="${type}"]`);if(existing)existing.remove();
    if(type==='incident_report'){modal.querySelector('.reader423-ack-banner')?.remove();modal.querySelector('#ackIncident411')?.remove()}
    const mine=myAck(i,u,type),arr=acknowledgements(i,type),box=document.createElement('section');box.className='wf440-confirm';box.dataset.wf440Confirm=type;
    box.innerHTML=`<h3>${type==='incident_report'?'사고보고 확인 기록':'재발방지조치 확인 기록'} <small style="font-weight:700">(결재 아님)</small></h3><p>내용을 실제로 확인한 사람의 이름·역할·확인시각을 기록합니다. 전자결재 또는 법적 전자서명을 대체하지 않습니다.</p><div class="wf440-confirm-list">${arr.map(x=>`<div class="wf440-confirm-person"><b>${ex(x.name||'-')} · ${ex(x.position||x.role||'-')}</b><span>${ex(typeof fmt==='function'?fmt(x.ackAt||x.readAt):(x.ackAt||x.readAt||''))}</span></div>`).join('')||'<span style="font-size:11px;color:#6b7c70">아직 확인 기록이 없습니다.</span>'}</div><button type="button" class="${mine?'done':''}" ${mine?'disabled':''} data-wf440-ack="${type}">${mine?'✓ 확인 기록 완료':'이 내용을 확인했습니다'}</button><div class="wf440-viewlog"><b>최초 조회기록</b><div class="wf440-viewlog-list" data-wf440-views>불러오는 중…</div></div>`;
    const anchor=modal.querySelector('.modal-actions')||modal.querySelector('[data-lifecycle-final]')||modal.lastElementChild;anchor?.insertAdjacentElement('beforebegin',box);
    box.querySelector('[data-wf440-ack]')?.addEventListener('click',async b=>{
      b.target.disabled=true;b.target.textContent='확인 기록 저장 중…';
      try{await window.enlIncidentAcknowledge?.(i.id,u,type);const fresh=incident(i.id)||i;decorateIncidentModal(i.id,fresh)}catch(e){b.target.disabled=false;b.target.textContent='다시 확인하기';alert(e?.message==='auth_proof_required'?'현재 계정 비밀번호 확인이 필요합니다.':'확인 기록을 저장하지 못했습니다.')}
    });
    const views=await viewHistory(i.id),target=box.querySelector('[data-wf440-views]');if(target&&box.isConnected){const filtered=views.filter(v=>String(v.document_type)===type);target.innerHTML=filtered.map(v=>`<span class="wf440-view-chip">${ex(v.viewer_name||'-')} · ${ex(typeof fmt==='function'?fmt(v.first_viewed_at):v.first_viewed_at||'')}</span>`).join('')||'<span class="wf440-view-chip">조회기록 없음</span>'}
  }

  function stageBanner(i){
    const s=String(i.status||''),w=workflow(i),delay=Number(w.immediateDelayMinutes);
    const sla=Number.isFinite(delay)?` · 발생 후 약 ${delay}분에 최초보고`:'';
    const desc=s==='reported'?'안전관리자가 즉시보고 내용을 검토 중입니다.':s==='supplement'?'진단·병원비·견적 등 사후 확인자료 보완을 기다리고 있습니다.':s==='supplement_submitted'?'현장에서 보완자료를 제출하여 안전관리자 최종검토를 기다리고 있습니다.':s==='approved'?'사고보고 내용이 최종승인되어 재발방지계획 단계로 진행합니다.':s==='closed'?'사고보고와 재발방지조치 확인이 완료되어 종결되었습니다.':'사고 진행상태를 확인합니다.';
    return `<section class="wf440-stage ${s.includes('supplement')?'supplement':['approved','closed'].includes(s)?'approved':''}"><b>${ex(stateLabel(i))}</b>${ex(desc)}<small>${ex(sla)}</small></section>`;
  }

  function supplementInfo(i){
    if(!i?.supplement||!['supplement','supplement_submitted','approved','closed'].includes(String(i.status||'')))return '';
    const items=supplementList(i),s=i.supplement;
    return `<section class="wf440-supplement-note"><b>사후 보완정보</b>${items.length?`<ul>${items.map(x=>`<li>${ex(x)}</li>`).join('')}</ul>`:''}${s.requestNote?`<div style="margin-top:6px"><b>요청사항</b> ${ex(s.requestNote)}</div>`:''}${s.submittedBy?`<div style="margin-top:5px">보완 제출: ${ex(s.submittedBy)} · ${ex(typeof fmt==='function'?fmt(s.submittedAt):s.submittedAt||'')}</div>`:''}</section>`;
  }

  function decorateIncidentModal(id,override=null){
    const i=override||incident(id),u=currentUser?.(),modal=document.querySelector('#modalRoot .modal');if(!i||!u||!modal)return;
    activeId=String(i.id);modal.dataset.wf440Incident=activeId;
    const decorSig=[i.updatedAt||'',i.status||'',i.supplement?.status||'',i.corrective?.status||'',(i.acknowledgements||[]).length].join('|');
    if(modal.dataset.wf440DecorSig===decorSig)return;
    modal.dataset.wf440DecorSig=decorSig;
    modal.querySelectorAll('.wf440-stage,.wf440-supplement-note[data-wf440-modal]').forEach(x=>x.remove());
    const head=modal.querySelector('.modal-head');if(head){head.insertAdjacentHTML('afterend',stageBanner(i));if(i.supplement){const holder=document.createElement('div');holder.className='wf440-supplement-note';holder.dataset.wf440Modal='1';holder.innerHTML=supplementInfo(i).replace(/^<section[^>]*>|<\/section>$/g,'');head.nextElementSibling?.insertAdjacentElement('afterend',holder)}}
    if(isReader(u)&&i.category==='person'&&!['approved','closed'].includes(String(i.status||''))){head?.insertAdjacentHTML('afterend','<div class="wf440-sensitive">관리자·경영진 화면에서는 진단명·의사소견·진단서 등 민감한 의료 상세정보를 제한하여 표시합니다.</div>')}
    recordView(i.id,'incident_report');

    if(isSafety(u)){
      modal.querySelector('#closeInc')?.remove();
      modal.querySelector('.wf440-safety-actions')?.remove();
      const baseApprove=modal.querySelector('#approveInc');if(baseApprove)baseApprove.remove();
      const reject=modal.querySelector('#rejectInc');if(reject){reject.textContent='보고 반려(오류·중복)';reject.classList.add('wf440-invalid-btn')}
      if(['reported','supplement','supplement_submitted'].includes(String(i.status||''))){
        const actions=document.createElement('div');actions.className='wf440-safety-actions';
        if(String(i.status)==='supplement')actions.innerHTML='<button type="button" class="wf440-supp-btn" data-wf440-supp>보완요청 수정</button><button type="button" disabled style="background:#eef2f5;color:#778797">현장 보완자료 대기 중</button>';
        else actions.innerHTML='<button type="button" class="wf440-supp-btn" data-wf440-supp>'+(i.status==='supplement_submitted'?'보완 재요청':'보완요청')+'</button><button type="button" class="wf440-final-btn" data-wf440-final>사고보고 최종승인</button>';
        const target=modal.querySelector('.modal-actions')||modal.lastElementChild;target?.insertAdjacentElement('beforebegin',actions);
        actions.querySelector('[data-wf440-supp]')?.addEventListener('click',()=>openSupplementRequest(i,u));
        actions.querySelector('[data-wf440-final]')?.addEventListener('click',()=>finalApprove(i,u));
      }
    }
    addAckSection(modal,i,u,'incident_report');
    if(String(i.corrective?.status||'')==='approved'){recordView(i.id,'corrective_action');addAckSection(modal,i,u,'corrective_action')}
  }

  function injectSupplementQueue(root,u){
    if(!root||!isFieldManager(u))return;
    const arr=[...(data?.incidents||[])].filter(i=>String(i.siteId)===String(u.siteId)&&['supplement','supplement_submitted'].includes(String(i.status||''))).sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
    const sig=arr.map(i=>`${i.id}:${i.status}:${i.updatedAt||''}`).join('|');
    if(root.dataset.wf440QueueSig===sig)return;root.dataset.wf440QueueSig=sig;
    root.querySelector('.wf440-queue')?.remove();
    if(!arr.length)return;
    const panel=document.createElement('section');panel.className='panel wf440-queue';panel.innerHTML=`<div class="section-head"><div><div class="ey">SUPPLEMENT</div><h2>사고보고 보완대기</h2><p>즉시보고 후 진단·병원비·견적 등 사후 확인자료를 보완합니다.</p></div></div><div class="wf440-queue-list">${arr.map(i=>`<button type="button" class="wf440-queue-row" data-wf440-supp-open="${ex(i.id)}" ${i.status==='supplement_submitted'?'disabled':''}><span>${ex(String(i.occurredAt||'').slice(0,10))}</span><b>${ex(i.eventType||'사고')} · ${ex(i.category==='person'?'대인사고':'대물사고')}</b><strong>${i.status==='supplement'?'보완자료 입력':'안전관리자 검토 중'}</strong></button>`).join('')}</div>`;
    const screen=root.querySelector('.field411-screen');if(screen)screen.insertBefore(panel,screen.children[1]||null);else root.prepend(panel);
    panel.querySelectorAll('[data-wf440-supp-open]').forEach(b=>{if(!b.disabled)b.onclick=()=>openSupplementForm(incident(b.dataset.wf440SuppOpen),u)});
  }

  function patchReaderPending(){
    const u=currentUser?.();if(!isReader(u))return;
    const nav=document.querySelector('[data-shell-view="incidents"]');if(nav&&nav.textContent!=='사고 조회')nav.textContent='사고 조회';
    const stats=document.querySelector('.stats426');if(!stats)return;
    const arr=[...(data?.incidents||[])].filter(i=>['reported','supplement','supplement_submitted'].includes(String(i.status||''))).sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0)).slice(0,8);
    const sig=arr.map(i=>`${i.id}:${i.status}:${i.updatedAt||''}`).join('|');
    if(stats.dataset.wf440PendingSig===sig)return;stats.dataset.wf440PendingSig=sig;
    stats.querySelector('.wf440-reader-pending')?.remove();
    if(!arr.length)return;
    const box=document.createElement('section');box.className='wf440-reader-pending';box.innerHTML=`<h3>즉시보고 · 보완 진행 중 ${arr.length}건</h3><div class="wf440-reader-pending-list">${arr.map(i=>`<button type="button" data-wf440-reader-open="${ex(i.id)}"><b>${ex(siteName(i.siteId))} · ${ex(stateLabel(i))}</b><small>${ex(String(i.occurredAt||'').slice(0,16).replace('T',' '))} · ${ex(i.eventType||'사고')}</small></button>`).join('')}</div>`;stats.insertBefore(box,stats.children[1]||null);
    box.querySelectorAll('[data-wf440-reader-open]').forEach(b=>b.onclick=()=>window.enlOpenIncidentReview?.(b.dataset.wf440ReaderOpen,false,u));
  }

  const baseFieldRecords=window.enlRenderFieldRecords;
  if(typeof baseFieldRecords==='function')window.enlRenderFieldRecords=function(root,u){const out=baseFieldRecords.apply(this,arguments);setTimeout(()=>injectSupplementQueue(root,u),0);return out};

  function wrapOpen(name){
    const base=window[name];if(typeof base!=='function'||base.__wf440)return;
    const wrapped=function(id){activeId=String(id||'');const out=base.apply(this,arguments);setTimeout(()=>decorateIncidentModal(activeId),0);setTimeout(()=>decorateIncidentModal(activeId),90);return out};wrapped.__wf440=true;window[name]=wrapped;
    try{if(name==='openIncidentModal')openIncidentModal=wrapped}catch(e){}
  }
  wrapOpen('enlOpenIncidentReview');wrapOpen('openIncidentModal');

  const baseCorrective=window.openUnifiedCorrectiveModal;
  if(typeof baseCorrective==='function'&&!baseCorrective.__wf440){
    const wrapped=function(id){activeId=String(id||'');const out=baseCorrective.apply(this,arguments);setTimeout(()=>{const i=incident(activeId),u=currentUser?.();if(i&&i.corrective?.status==='approved'){recordView(i.id,'corrective_action');const modal=document.querySelector('#modalRoot .modal');if(modal)addAckSection(modal,i,u,'corrective_action')}},80);return out};wrapped.__wf440=true;window.openUnifiedCorrectiveModal=wrapped;
  }

  function patchAll(){
    patchQueued=false;patchImmediateForm();patchReaderPending();
    const u=currentUser?.(),root=document.getElementById('view');if(root&&isFieldManager(u)&&String(currentView)==='incidents')injectSupplementQueue(root,u);
    const modal=document.querySelector('#modalRoot .modal');if(modal&&activeId)decorateIncidentModal(activeId);
  }
  function queuePatch(){if(patchQueued)return;patchQueued=true;requestAnimationFrame(patchAll)}

  ensureCss();
  document.addEventListener('click',e=>{
    const row=e.target?.closest?.('[data-inc-id],[data-manager-inc],[data-safety-inc],[data-reader-open],[data-lifecycle-open]');
    if(row){activeId=String(row.dataset.incId||row.dataset.managerInc||row.dataset.safetyInc||row.dataset.readerOpen||row.dataset.lifecycleOpen||'');setTimeout(()=>decorateIncidentModal(activeId),80)}
  },true);
  document.addEventListener('input',e=>{if(e.target?.matches?.('#unifiedReportForm [required],#wf440SupplementForm [required]'))fieldState(e.target)},true);
  const mo=new MutationObserver(queuePatch);mo.observe(document.body,{childList:true,subtree:true});
  queuePatch();

  window.enlOpenIncidentSupplement=openSupplementForm;
  window.enlRequestIncidentSupplement=openSupplementRequest;
  window.ENL_INCIDENT_FLOW_VERSION=VERSION;
})();