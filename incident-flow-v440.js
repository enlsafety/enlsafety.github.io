/* E&L Accident Report App v4.4.0 - immediate report, supplement, acknowledgement workflow */
(function(){
  'use strict';

  const VERSION='4.8.13-r23';
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
      .wf440-supplement-note{margin:10px 0;padding:11px 12px;border:1px solid #e4c77d;border-radius:11px;background:#fff9e8;color:#6e551e;font-size:12px;line-height:1.55}.wf440-supplement-submitted{margin-top:9px;padding:10px 11px;border:2px solid #e19a31;border-radius:10px;background:#fff7e8;color:#6d4a12}.wf440-supplement-submitted>b{display:block;margin-bottom:7px;color:#9a5e08;font-size:13px}.wf440-supplement-change-list{display:grid;gap:6px}.wf440-supplement-change{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;padding:7px 8px;border:1px solid #efc77f;border-radius:8px;background:#fff}.wf440-supplement-change b{color:#805512;font-size:11px}.wf440-supplement-change span{color:#3f5364;font-size:12px;white-space:pre-wrap;word-break:break-word}@media(max-width:560px){.wf440-supplement-change{grid-template-columns:1fr;gap:3px}}
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
      .wf440-cause{margin:12px 0;padding:14px;border:1.5px solid #bfd4e3;border-radius:13px;background:#f6faff;display:grid;gap:10px;color:#274d69}
      .wf440-cause h3{font-size:16px;margin:0;color:#174d78}.wf440-cause p{font-size:12px;line-height:1.5;margin:0}
      .wf440-cause .wf440-context{padding:9px 11px;background:#fff;border:1px solid #d8e4ec;border-radius:9px;white-space:pre-wrap;overflow-wrap:anywhere}
      .wf440-cause label{display:grid;gap:5px;color:#244c69;font-size:13px;font-weight:800}
      .wf440-cause textarea{width:100%;box-sizing:border-box;min-height:66px;border:1px solid #b7cad8;border-radius:9px;padding:9px;font-size:14px;font-weight:400;background:#fff;color:#173b66}
      .wf440-cause .wf440-pending{display:flex;gap:9px;align-items:flex-start;background:#fff9e9;border:1px solid #edc77b;padding:11px;border-radius:10px}
      .wf440-cause .wf440-pending input{flex:0 0 20px;width:20px;height:20px;margin:0}
      .wf440-cause button{width:100%;min-height:44px;background:#1e5d91;color:#fff;border:0;border-radius:10px;font-weight:850}
      .wf440-cause [data-wf440-cause-message]{color:#a13939;min-height:17px;font-weight:750}
      .wf440-cause .wf440-auto-note{padding:9px 11px;background:#e9f3fc;border:1px solid #c4dbec;border-radius:9px;color:#285d80;font-weight:650}
      .wf440-cause [data-wf440-cause-generate]{background:#fff;color:#1e5d91;border:1px solid #a8c9df}
      @media(max-width:620px){.wf440-form-grid{grid-template-columns:1fr}.wf440-wide{grid-column:auto}.wf440-safety-actions button{flex:1 1 140px}.wf440-queue-row{grid-template-columns:80px minmax(0,1fr)}.wf440-queue-row strong{grid-column:1/-1}}
    `;document.head.appendChild(s)
  }

  function actor(u=currentUser?.()){
    return u?{id:uid(u),name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  }

  function workflow(i){
    if(!i)return {};
    i.reportWorkflow=i.reportWorkflow&&typeof i.reportWorkflow==='object'?i.reportWorkflow:{};
    if(i?.historicalOrigin?.batchId&&['verified','unverifiable'].includes(i?.externalInitialApproval?.state)){
      const s=String(i.status||''),unverified=i.externalInitialApproval.state==='unverifiable';i.reportWorkflow.initialApprovalSource=unverified?'HISTORICAL_UNVERIFIABLE':'ERP';
      i.reportWorkflow.phase=s==='closed'?'closed':s==='approved'?'report_approved':unverified&&['reported','supplement','supplement_submitted'].includes(s)?'historical_pending_review':s;
      // Historical migration is not a late immediate report; do not fabricate SLA or internal approvals.
      delete i.reportWorkflow.immediateDelayMinutes;delete i.reportWorkflow.internalSla;
      return i.reportWorkflow;
    }
    if(!i.reportWorkflow.immediateReportedAt)i.reportWorkflow.immediateReportedAt=i.registeredAt||i.createdAt||now();
    if(!i.reportWorkflow.internalSla)i.reportWorkflow.internalSla='사고 인지 후 30분 이내 또는 현장 이탈 전 즉시보고';
    const occurred=Date.parse(i.occurredAt||''),created=Date.parse(i.reportWorkflow.immediateReportedAt||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(i.occurredAt))delete i.reportWorkflow.immediateDelayMinutes;
    else if(Number.isFinite(occurred)&&Number.isFinite(created)&&created>=occurred&&!Number.isFinite(Number(i.reportWorkflow.immediateDelayMinutes)))i.reportWorkflow.immediateDelayMinutes=Math.round((created-occurred)/60000);
    const st=String(i.status||'');
    i.reportWorkflow.phase=st==='reported'?'immediate_review':st==='supplement'?'supplement_waiting':st==='supplement_submitted'?'supplement_review':st==='approved'?'report_approved':st==='closed'?'closed':st;
    if(['approved','closed'].includes(st)&&i?.externalInitialApproval?.state!=='verified'&&!i.reportWorkflow.finalApprovedAt){
      i.reportWorkflow.finalApprovedAt=i.approvedAt||now();i.reportWorkflow.finalApprovedBy=i.approvedBy||'안전관리자';
    }
    return i.reportWorkflow;
  }

  // Workflow fields are written only by explicit report actions below.
  // Reading a report or saving an account must never manufacture incident edits.

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
    immediateIds.forEach(id=>{const el=form.querySelector('#'+id);if(el){el.required=el.dataset.allowExistingBlank!=='1';fieldState(el)}});
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
    window.enlLayoutReportTables?.(form);
    if(!form.dataset.wf440Bound){form.dataset.wf440Bound='1';form.addEventListener('input',e=>fieldState(e.target),true);form.addEventListener('change',e=>fieldState(e.target),true)}
  }

  function requestDefinitions(i){
    return i?.category==='person' ? [
      ['diagnosis','진단명'],
      ['doctorOpinion','의사 소견·치료 예상기간'],
      ['medicalCost','병원비·진료비'],
      ['leaveEstimate','휴업기간 또는 사망 여부 확인'],
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
    i=structuredClone(i);
    const current=new Set(i?.supplement?.requestedFields||[]),defs=requestDefinitions(i);
    openModal(`<div class="modal-head"><div><div class="ey">SUPPLEMENT REQUEST</div><h2>${ex(siteName(i.siteId))} · 사고보고 보완요청</h2><p>즉시보고 이후 확인 가능한 자료만 선택합니다.</p></div><button class="x" data-close>×</button></div>
      <form id="wf440RequestForm"><div class="wf440-request-list">${defs.map(([k,label])=>`<label class="wf440-request"><input type="checkbox" value="${ex(k)}" ${current.has(k)?'checked':''}><span><b>${ex(label)}</b></span></label>`).join('')}</div>
      <label class="lbl"><span>보완요청 메모</span><textarea id="wf440RequestNote" rows="3" placeholder="예: 병원 진료 후 진단명과 실제 결제금액을 입력해 주세요.">${ex(i?.supplement?.requestNote||'')}</textarea></label>
      <button class="primary full" type="submit">보완대기로 전환</button></form>`);
    document.getElementById('wf440RequestForm').onsubmit=async e=>{
      e.preventDefault();const fields=[...e.currentTarget.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value),note=text(document.getElementById('wf440RequestNote')?.value);
      if(!fields.length&&!note)return alert('보완이 필요한 항목을 하나 이상 선택하거나 보완요청 메모를 입력해 주세요.');
      const ts=now();i.status='supplement';i.supplement={...(i.supplement||{}),status:'waiting',requestedFields:fields,requestNote:note||defs.filter(([k])=>fields.includes(k)).map(([,label])=>label).join(', ')+' 자료를 보완해 주세요.',requestedBy:u.name,requestedById:uid(u),requestedAt:ts,submittedAt:null};
      const w=workflow(i);w.phase='supplement_waiting';w.supplementRequestedAt=ts;w.supplementRequestedBy=u.name;i.updatedAt=ts;
      const attempt=window.enlStableSaveAttempt?.(e.currentTarget,i,['supplement.requestedAt','reportWorkflow.supplementRequestedAt'])||i;
      if(!await window.enlCommitOrNotify(attempt))return;closeModal();renderShell(u);alert('사고보고를 보완대기로 전환했습니다. 현장관리자에게 보완요청이 전달됩니다.');
    };
  }

  function renderSupplementFiles(root){
    const list=root?.querySelector('#wf440SupplementFiles');if(!list)return;
    if(!supplementFiles.length){list.innerHTML='<span style="font-size:11px;color:#728598">첨부된 보완자료가 없습니다.</span>';return}
    const gallery=typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(supplementFiles):'';
    list.innerHTML=gallery+`<div class="wf440-file-controls">${supplementFiles.map((f,idx)=>`<div class="wf440-file"><span>${ex(f.name||f.fileName||'첨부자료')}</span><button type="button" data-wf440-file-rm="${idx}">삭제</button></div>`).join('')}</div>`;
    try{window.enlBindAttachmentOpen?.(list,supplementFiles)}catch(e){}
    list.querySelectorAll('[data-wf440-file-rm]').forEach(b=>b.onclick=()=>{supplementFiles.splice(Number(b.dataset.wf440FileRm),1);renderSupplementFiles(root);validateSupplementVisual(root)});
  }
  function validateSupplementVisual(root){
    root?.querySelectorAll('[required]').forEach(fieldState);
    const req=new Set(root?.dataset.requested?JSON.parse(root.dataset.requested):[]);
    const needFile=req.has('medicalDocument')||req.has('estimateDocument');
    root?.querySelector('.wf440-filebox')?.classList.toggle('required-empty',needFile&&supplementFiles.length<1);
  }

  function openSupplementForm(i,u){
    i=structuredClone(i);
    if(!isFieldManager(u)||String(i.siteId)!==String(u.siteId))return alert('해당 사업장 현장관리자만 보완자료를 입력할 수 있습니다.');
    if(String(i.status)!=='supplement')return alert('현재 보완자료 입력 상태가 아닙니다.');
    const d=i.reportDetails||{},req=new Set(i?.supplement?.requestedFields||[]);
    supplementFiles=[...(i?.supplement?.attachments||[])];
    const required=k=>req.has(k)?'required':'';
    const star=k=>req.has(k)?' *':'';
    const body=i.category==='person'?`
      <div class="wf440-form-grid">
        <label class="lbl"><span>진단명${star('diagnosis')}</span><input id="wf440Diagnosis" value="${ex(d.diagnosis||'')}" ${required('diagnosis')}></label>
        <label class="lbl"><span>사고로 예상되는 휴업기간 또는 사망 여부 *</span><select id="wf440Leave" required>${window.enlReportLeaveOptions(i.leaveEstimate||d.leaveEstimate)}</select></label>
        <label class="lbl wf440-wide"><span>의사 소견 / 치료 예상기간${star('doctorOpinion')}</span><textarea id="wf440Doctor" rows="3" ${required('doctorOpinion')}>${ex(d.doctorOpinion||'')}</textarea></label>
        <label class="lbl"><span>현재 확인된 진료비${star('medicalCost')}</span><span class="won-entry"><input id="wf440MedicalCost" data-won type="text" inputmode="numeric" value="${ex(d.medicalCost||'')}" ${required('medicalCost')}><small>원</small></span></label>
        <label class="lbl"><span>진료비 상세내역</span><input id="wf440MedicalDetail" value="${ex(d.medicalCostDetail||'')}"></label>
      </div>`:`
      <div class="wf440-form-grid">
        <label class="lbl"><span>수리·복구 견적금액${star('repairCost')}</span><span class="won-entry"><input id="wf440RepairCost" data-won type="text" inputmode="numeric" value="${ex(d.repairCostPending===true?'':(d.repairCost||''))}" ${required('repairCost')} placeholder="예: 350,000"><small>원</small></span></label>
        <label class="lbl wf440-wide"><span>견적·비용 상세내역${star('repairCostDetail')}</span><textarea id="wf440RepairDetail" rows="3" ${required('repairCostDetail')} placeholder="예: 지주 교체비 250,000원 + 도장비 100,000원">${ex(d.repairCostDetail==='사후 보완 예정'?'':(d.repairCostDetail||''))}</textarea></label>
      </div>`;
    openModal(`<div class="modal-head"><div><div class="ey">SUPPLEMENT</div><h2>${ex(siteName(i.siteId))} · 사고보고 보완자료</h2><p>사고 직후에는 알 수 없었던 진단·비용·견적 등의 사후 확인자료를 입력합니다.</p></div><button class="x" data-close>×</button></div>
      <div class="wf440-supplement-note"><b>안전관리자 요청사항</b><ul>${supplementList(i).map(x=>`<li>${ex(x)}</li>`).join('')||'<li>보완요청 메모를 확인해 주세요.</li>'}</ul>${i.supplement?.requestNote?`<div style="margin-top:6px">${ex(i.supplement.requestNote)}</div>`:''}</div>
      <form id="wf440SupplementForm" data-requested='${ex(JSON.stringify([...(i.supplement?.requestedFields||[])]))}'>${body}
        <div class="wf440-filebox" data-attachment-input="wf440SupplementFile"><small class="attachment-drop-hint">파일을 이곳에 끌어다 놓거나 선택하세요.</small><b>진단서·영수증·견적서 등 보완자료</b><div style="margin-top:6px"><input id="wf440SupplementFile" type="file" accept="image/*,application/pdf" multiple></div><div id="wf440SupplementFiles" class="wf440-file-list"></div></div>
        <button class="primary full" type="submit" style="margin-top:11px">보완완료 · 안전관리자 검토요청</button>
      </form>`);
    const form=document.getElementById('wf440SupplementForm');if(!form)return;
    window.enlLayoutReportTables?.(form);
    if(i.category==='person'){const leave=form.querySelector('#wf440Leave');if(leave)leave.value=i.leaveEstimate||d.leaveEstimate||''}
    renderSupplementFiles(form);validateSupplementVisual(form);
    form.addEventListener('input',e=>fieldState(e.target),true);form.addEventListener('change',e=>fieldState(e.target),true);
    form.querySelector('#wf440SupplementFile').onchange=async e=>{
      try{if(typeof addFiles==='function')supplementFiles=await addFiles(supplementFiles,e.target.files,'incident',{preserveOriginal:true,form});else alert('첨부파일 처리기능을 불러오지 못했습니다.');}
      catch(err){alert('보완자료를 추가하지 못했습니다.')}e.target.value='';renderSupplementFiles(form);validateSupplementVisual(form);
    };
    form.onsubmit=async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const needFile=req.has('medicalDocument')||req.has('estimateDocument');if(needFile&&supplementFiles.length<1){validateSupplementVisual(form);return alert('안전관리자가 요청한 증빙자료를 1개 이상 첨부해 주세요.')}
      if(i.category==='person'){
        d.diagnosis=text(form.querySelector('#wf440Diagnosis')?.value);d.doctorOpinion=text(form.querySelector('#wf440Doctor')?.value);d.medicalCost=Number((form.querySelector('#wf440MedicalCost')?.value||'').replace(/,/g,''))||0;d.medicalCostDetail=text(form.querySelector('#wf440MedicalDetail')?.value);i.leaveEstimate=text(form.querySelector('#wf440Leave')?.value)||i.leaveEstimate||'unknown';
      }else{
        const repair=Number((form.querySelector('#wf440RepairCost')?.value||'').replace(/,/g,''))||0,detail=text(form.querySelector('#wf440RepairDetail')?.value);
        d.repairCost=repair;d.repairCostPending=repair<=0;d.repairCostDetail=detail||(repair>0?'':'사후 보완 예정');
      }
      const ts=now();i.reportDetails=d;i.status='supplement_submitted';i.supplement={...(i.supplement||{}),status:'submitted',attachments:persistAttachments(supplementFiles),submittedBy:u.name,submittedById:uid(u),submittedAt:ts};
      const w=workflow(i);w.phase='supplement_review';w.supplementSubmittedAt=ts;w.supplementSubmittedBy=u.name;i.updatedAt=ts;
      const attempt=window.enlStableSaveAttempt?.(form,i,['supplement.submittedAt','reportWorkflow.supplementSubmittedAt'])||i;
      if(!await window.enlCommitOrNotify(attempt))return;supplementFiles=[];closeModal();renderShell(u);alert('보완자료를 안전관리자 검토대기로 제출했습니다.');
    };
  }

  const isOrdinaryCauseReview=i=>!!i&&!['historical_manual','historical_transfer'].includes(text(i.recordMode))&&!i.historicalImport?.enabled&&!i.historicalOrigin?.batchId&&!i.historicalTransfer?.mode;

  // Rule-based suggestions only: no external AI or server write is involved.
  // Every statement is a hypothesis to verify, never a confirmed accident cause.
  const CAUSE_DRAFT_RULES=[
    {types:['붕괴/전도','붕괴','전도'],pattern:/안전망|방풍망|펜스|휀스|구조물.{0,12}(?:붕괴|전도|쓰러)|강풍.{0,12}(?:붕괴|전도)|(?:붕괴|전도).{0,12}(?:구조물|시설물)/,
      environment:'구조물의 고정 상태와 외력을 받은 방향 확인 필요',
      behavior:'작업 전 고정상태 확인 및 위험구역 통제 여부',
      mechanism:'구조물이 지지력을 잃은 경위'},
    {types:['타구','골프공 맞음'],pattern:/골프공|타구|티샷|샷.{0,8}(?:맞|충돌)/,
      environment:'경기구역에서 작업 위치까지의 타구 노출 범위 확인 필요',
      behavior:'경기 진행 중 작업 위치와 대피 시점 확인 필요',
      mechanism:'타구 경로와 작업 위치가 겹친 경위'},
    {types:['차량/중장비','차량사고','차량 충돌'],pattern:/카트|지게차|차량|트럭|화물차|승용차|굴삭기|로더|중장비|후진|주행|운행/,
      environment:'차량과 주변 사람 또는 시설물 사이의 통행 공간 확인 필요',
      behavior:'차량 이동 전 진행 방향과 주변 간격 확인 여부',
      mechanism:'차량 이동 경로가 주변 동선과 겹쳤는지'},
    {types:['추락','떨어짐'],pattern:/추락|사다리|고소작업|작업발판|개구부|안전난간|높은 곳.{0,8}떨어/,
      environment:'작업 위치의 높이 차이와 발판 상태 확인 필요',
      behavior:'추락 직전 작업 자세와 지지점 확인 필요',
      mechanism:'높이 차이가 있는 구간에서 지지를 잃은 경위'},
    {types:['넘어짐','미끄러짐','낙상'],pattern:/넘어짐|넘어졌|미끄러|걸려 넘어|발을 헛딛|단차|낙상/,
      environment:'통행로의 단차와 노면 상태 확인 필요',
      behavior:'이동 당시 발 디딤 위치와 진행 방향 확인 필요',
      mechanism:'보행 중 균형을 잃은 경위'},
    {types:['끼임','협착'],pattern:/끼임|협착|말림|회전체|컨베이어|구동부/,
      environment:'설비 가동부와 신체 사이의 간격 확인 필요',
      behavior:'작업 당시 설비 정지 여부와 손의 위치 확인 필요',
      mechanism:'설비 가동부에 신체가 접근한 경위'},
    {types:['베임/찔림','베임','절단'],pattern:/베임|베였|찔림|절단|낫|예초기|칼날|톱날|절삭/,
      environment:'공구 날 주변의 작업 공간과 방호 상태 확인 필요',
      behavior:'공구 사용 시 날의 방향과 손의 위치 확인 필요',
      mechanism:'공구 날과 신체가 접촉한 경위'},
    {types:['감전'],pattern:/감전|누전|전선|전기설비|활선|콘센트/,
      environment:'전기를 취급한 지점의 절연 상태 확인 필요',
      behavior:'작업 전 전원 차단과 무전압 확인 여부',
      mechanism:'전류가 신체에 흐른 경로'},
    {types:['화재/폭발','화재','폭발'],pattern:/화재|폭발|화상|용접|인화성|발화|점화원/,
      environment:'사고 지점의 열원과 가연물 배치 확인 필요',
      behavior:'당시 작업에서 열이나 불꽃이 발생했는지 확인 필요',
      mechanism:'발화 지점과 작업 과정의 관련성'},
    {types:['질식/중독','질식','중독'],pattern:/질식|중독|산소결핍|밀폐공간|유해가스/,
      environment:'사고 장소의 환기 상태와 유해물질 노출 가능성 확인 필요',
      behavior:'작업 전 공기 상태 확인 및 환기 여부',
      mechanism:'작업 중 노출된 물질 또는 산소 부족 여부'},
    {types:['근골격','근골격계'],pattern:/근골격|중량물|반복작업|허리.{0,8}(?:통증|다침)|무거운 물건/,
      environment:'취급물의 무게와 작업 높이 확인 필요',
      behavior:'작업 자세와 동작 반복 횟수 확인 필요',
      mechanism:'작업 하중과 신체 부담의 관련성'},
    {types:['낙하/맞음','낙하물','맞음'],pattern:/낙하물|비래|떨어진 물체|물체.{0,8}맞|물건.{0,8}떨어/,
      environment:'물체 위치와 낙하 경로의 방호 상태 확인 필요',
      behavior:'물체가 이탈했을 때 작업자의 위치 확인 필요',
      mechanism:'낙하 경로에 작업자가 노출된 경위'},
    {types:['설비/시설 파손'],pattern:/설비.{0,8}파손|시설물.{0,8}파손|기계.{0,8}고장/,
      environment:'파손 부위 주변의 간격과 시설 상태 확인 필요',
      behavior:'파손 직전 설비 조작 또는 이동 경로 확인 필요',
      mechanism:'시설에 힘이 가해진 지점과 파손 경위'}
  ];
  function buildCauseDraft(i){
    const d=i?.reportDetails||{},event=text(i?.eventType);
    const summary=text(i?.summary);
    const narrative=summary.match(/\[사고 경위\]\s*([^[]+)/)?.[1];
    const how=text(d.incidentHow)||text(narrative),work=text(d.workAction);
    // Use firsthand descriptions before a broad classification such as facility damage.
    // A generated summary also contains later prevention measures; those are not evidence.
    const legacy=!how&&!work&&!/^\[사고 개요\]/.test(summary)?summary:'';
    const movement=[how,work,legacy].filter(Boolean).join(' ');
    const scene=[movement,text(d.place)].join(' ');
    const damage=[how,d.damagedItem,d.damageDetail,legacy].map(text).join(' ');
    const vehicle=/차량|자동차|승용차|화물차|트럭|작업차|카트|지게차|트랙터|승용모어|바퀴|타이어/.test(scene+' '+damage);
    const turn=/회전|선회|유턴|방향.{0,3}전환|차를 돌리|차량을 돌리/.test(movement);
    const reverse=/후진/.test(movement);
    const fixture=(scene+' '+text(d.damagedItem)).match(/홀\s*맵\s*지주|안내표지판|안내판|표지판|볼라드|연석|경계석|기둥|펜스/)?.[0];
    const contact=/충돌|접촉|들이받|부딪|부딫|충격을 가|추돌/.test(how||legacy)&&!/충돌.{0,4}(?:없|않)|접촉.{0,4}(?:없|않)/.test(how||legacy);
    if(vehicle&&(turn||reverse||fixture&&contact)&&!/회전체|회전날/.test(movement)){
      const narrow=/좁[은아았고]|좁음|협소|비좁|공간.{0,4}부족/.test(scene);
      const wheelHit=damage.match(/(뒷바퀴|뒤쪽?\s*바퀴|후륜|뒤\s*타이어|앞바퀴|전륜|타이어)[^.!?]{0,14}?(?:파손|손상|펑크|찢어|터짐)/);
      const wheel=wheelHit&&!/파손.{0,4}(?:없|아님|않)/.test(damage)?wheelHit[1]:'';
      const motion=reverse&&turn?'후진 회전':reverse?'후진':turn?'회전':'이동';
      const path=wheel?wheel+' 이동 경로':'차량 이동 경로';
      const environmentCause=narrow?'차량 '+motion+' 공간이 좁아 주변과의 간격 확보에 제약'
        :fixture&&contact?'차량 이동 구간과 '+fixture+' 사이의 여유 공간 확인 필요':'차량 '+motion+' 구간의 통행 폭과 주변 여유 공간 확인 필요';
      const behaviorCause=motion+' 전 '+path+(fixture?'와 '+fixture+' 사이의 간격':'와 주변 간격')+' 확인 여부';
      const outcome=wheel?'차량 '+motion+' 중 '+wheel+' 파손':fixture&&contact?'차량 '+motion+' 중 '+fixture+' 접촉':'차량 '+motion+' 중 사고 발생';
      const mechanism=narrow&&turn&&wheel?'회전 궤적과 주변 간격이 파손에 영향을 주었을 가능성.':path+'와 주변 간격이 사고에 미친 영향 확인 필요.';
      return {environmentCause,behaviorCause,causeAnalysisNote:outcome+'. '+mechanism};
    }
    const fall=/미끄러[져졌짐]|넘어[져졌짐]|헛디[뎌딤]|헛딛/.test(movement);
    const ice=/빙판|결빙|얼어붙|살얼음/.test(scene),wet=/젖은|젖어|물기|빗물/.test(scene);
    if(fall&&(ice||wet)){
      const surface=ice?'결빙된 바닥':'젖은 바닥';
      return {environmentCause:surface+'으로 미끄러질 위험이 있는 통행 구간',
        behaviorCause:'이동 전 노면 상태 확인 및 우회 가능 여부 확인 필요',
        causeAnalysisNote:surface+'에서 이동 중 균형을 잃은 경위와 노면 상태의 관련성 확인 필요.'};
    }
    if(/사다리/.test(scene)&&/추락|떨어[져졌짐]/.test(how)){
      return {environmentCause:'사다리 설치면과 발판의 지지 상태 확인 필요',behaviorCause:'추락 직전 발 디딤 위치와 작업 자세 확인 필요',causeAnalysisNote:'사다리 작업 중 추락. 발판 상태와 작업 자세가 추락에 미친 영향 확인 필요.'};
    }
    const blade=movement.match(/예초기|낫|전정가위|칼날|톱날/)?.[0];
    if(blade&&/베임|베였|베어|찔림|찔렸|절단|날에.{0,12}접촉/.test(how+' '+text(d.injuryDetail))){
      return {environmentCause:blade+' 날 주변의 작업 여유 공간 확인 필요',behaviorCause:'작업 당시 날의 진행 방향과 신체 위치 확인 필요',causeAnalysisNote:blade+' 작업 중 날과 신체가 접촉한 경위 확인 필요.'};
    }
    const categoryRule=CAUSE_DRAFT_RULES.find(x=>x.types.includes(event));
    const rule=(categoryRule&&!['설비/시설 파손','차량/중장비'].includes(event)?categoryRule:null)
      ||CAUSE_DRAFT_RULES.find(x=>x.pattern.test(how||legacy))
      ||categoryRule
      ||CAUSE_DRAFT_RULES.find(x=>x.pattern.test([work,d.damageDetail,d.injuryDetail,event].map(text).join(' ')));
    if(!rule)return {
      environmentCause:'사고 지점의 작업공간과 시설 상태 확인 필요',
      behaviorCause:'사고 직전 수행한 작업과 이동 경로 확인 필요',
      causeAnalysisNote:'현재 경위서만으로는 직접 원인을 특정하기 어려움.'
    };
    return {
      environmentCause:rule.environment,
      behaviorCause:rule.behavior,
      causeAnalysisNote:rule.mechanism+' 확인 필요.'
    };
  }

  function hasSavedCause(d){
    return ['analyzed','investigating'].includes(text(d?.causeAnalysisStatus))
      ||[d?.environmentCause,d?.behaviorCause,d?.causeAnalysisNote].some(v=>!!text(v));
  }

  function causePanel(i){
    const d=i.reportDetails||{},auto=!hasSavedCause(d),draft=auto?buildCauseDraft(i):null;
    const pending=d.causeAnalysisStatus==='investigating'||auto;
    const panel=document.createElement('section');panel.className='wf440-cause';panel.dataset.wf440Cause='1';
    panel.dataset.wf440Draft=auto?'unreviewed':'stored';
    panel.dataset.wf440Dirty='0';
    panel.innerHTML='<h3>안전관리자 사고원인 분석</h3>'
      +'<p>현장에는 원인 입력을 요청하지 않습니다. 사고경위와 확인자료를 검토해 근거가 있는 원인만 작성하세요. 조사 중이면 미확정을 선택할 수 있습니다.</p>'
      +'<div class="wf440-context"><strong>사고경위 참고</strong><p>'+ex(d.incidentHow||i.summary||'입력된 사고경위 없음')+'</p></div>'
      +'<p class="wf440-auto-note" data-wf440-draft-note>'+(auto?'사고보고를 바탕으로 세 항목에 자동 분석 초안을 입력했습니다. 아직 확인된 원인이 아니므로 검토·수정·삭제 후 저장하세요.':'기존에 저장한 분석내용을 유지했습니다. 필요할 때만 아래 버튼으로 초안을 다시 작성할 수 있습니다.')+'</p>'
      +'<label>환경적 요인<textarea id="wf440EnvironmentCause" maxlength="4000" rows="2" placeholder="예: 작업환경·시설물·장비 상태 등 확인된 요인">'+ex(auto?draft.environmentCause:d.environmentCause||'')+'</textarea></label>'
      +'<label>행동적 요인<textarea id="wf440BehaviorCause" maxlength="4000" rows="2" placeholder="예: 확인된 작업방법·행동적 위험요인. 근로자 과실을 추정하지 마세요.">'+ex(auto?draft.behaviorCause:d.behaviorCause||'')+'</textarea></label>'
      +'<label>기타·종합 원인<textarea id="wf440CauseAnalysisNote" maxlength="4000" rows="2" placeholder="기타 확인된 원인이나 분석 근거">'+ex(auto?draft.causeAnalysisNote:d.causeAnalysisNote||'')+'</textarea></label>'
      +'<label class="wf440-pending"><input id="wf440CausePending" type="checkbox" '+(pending?'checked':'')+'><span>조사 중 · 사고원인 미확정<br><small>현시점에 인과관계를 확정할 자료가 부족한 경우 선택해 주세요.</small></span></label>'
      +'<button type="button" data-wf440-cause-generate>사고보고 내용으로 초안 다시 작성</button>'
      +'<p data-wf440-cause-message role="alert" aria-live="polite"></p>'
      +'<button type="button" data-wf440-cause-save>원인분석 별도 저장</button>';
    window.enlLayoutReportTables?.(panel);
    return panel;
  }
  function bindCausePanel(panel,i){
    const fields=['wf440EnvironmentCause','wf440BehaviorCause','wf440CauseAnalysisNote'];
    const markReviewed=()=>{panel.dataset.wf440Dirty='1';if(panel.dataset.wf440Draft==='unreviewed')panel.dataset.wf440Draft='reviewed';};
    fields.forEach(id=>panel.querySelector('#'+id)?.addEventListener('input',markReviewed));
    panel.querySelector('#wf440CausePending')?.addEventListener('change',markReviewed);
    panel.querySelector('[data-wf440-cause-generate]')?.addEventListener('click',()=>{
      const values=fields.map(id=>panel.querySelector('#'+id));
      if((panel.dataset.wf440Draft==='stored'||panel.dataset.wf440Dirty==='1')
         &&values.some(el=>text(el?.value))
         &&!confirm('직접 작성하거나 저장한 원인분석이 자동 초안으로 바뀝니다. 계속할까요?'))return;
      const draft=buildCauseDraft(i);
      values.forEach((el,n)=>{if(el)el.value=[draft.environmentCause,draft.behaviorCause,draft.causeAnalysisNote][n]});
      const pending=panel.querySelector('#wf440CausePending');if(pending)pending.checked=true;
      panel.dataset.wf440Draft='unreviewed';panel.dataset.wf440Dirty='0';
      const note=panel.querySelector('[data-wf440-draft-note]');if(note)note.textContent='사고보고를 바탕으로 초안을 다시 작성했습니다. 조사 중·미확정으로 설정했으니 검토 후 수정·저장하세요.';
      const message=panel.querySelector('[data-wf440-cause-message]');if(message)message.textContent='';
    });
  }
  function collectCause({allowAutoDraft=false,root=null}={}){

    const box=root||document.querySelector('#modalRoot [data-wf440-cause]');if(!box){alert('원인분석 입력화면을 찾지 못했습니다. 사고를 다시 열어 주세요.');return null;}
    const get=id=>text(box.querySelector('#'+id)?.value);
    const environmentCause=get('wf440EnvironmentCause'),behaviorCause=get('wf440BehaviorCause'),causeAnalysisNote=get('wf440CauseAnalysisNote');
    const pending=!!box.querySelector('#wf440CausePending')?.checked,feedback=box.querySelector('[data-wf440-cause-message]');
    if(!pending&&!environmentCause&&!behaviorCause&&!causeAnalysisNote){
      if(feedback)feedback.textContent='원인을 확인한 항목에 작성하거나, 조사 중·미확정을 선택해 주세요.';
      box.querySelector('#wf440EnvironmentCause')?.focus();return null;
    }
    if(box.dataset.wf440Draft==='unreviewed'&&!allowAutoDraft){
      if(feedback)feedback.textContent='자동 입력된 원인을 검토하여 수정하거나 [원인분석 별도 저장]을 눌러 확인해 주세요.';
      return null;
    }
    if(feedback)feedback.textContent='';
    return {environmentCause,behaviorCause,causeAnalysisNote,causeAnalysisStatus:pending?'investigating':'analyzed'};
  }
  async function saveCause(i,u){
    const cause=collectCause({allowAutoDraft:true});if(!cause)return;
    const box=document.querySelector('#modalRoot [data-wf440-cause]'),button=box?.querySelector('[data-wf440-cause-save]');if(button?.disabled)return;
    if(button){button.disabled=true;button.textContent='원인분석 저장 중…';}
    try{
      const next=structuredClone(i);next.reportDetails={...(next.reportDetails||{}),...cause};next.updatedAt=now();
      if(!await window.enlCommitOrNotify(next)){if(box?.querySelector('[data-wf440-cause-message]'))box.querySelector('[data-wf440-cause-message]').textContent='서버 저장을 확인하지 못했습니다. 입력 내용을 유지했으니 다시 시도해 주세요.';return;}
      const modal=box?.closest('.modal'),saved=incident(i.id);
      if(!modal?.isConnected||!saved||uid(currentUser())!==uid(u))return;
      const scroll=modal.scrollTop;
      modal.dispatchEvent(new CustomEvent('enl-cause-saved',{detail:saved}));
      decorateIncidentModal(i.id,saved);
      const message=modal.querySelector('[data-wf440-cause-message]');
      if(message)message.textContent='원인분석을 저장했습니다.';
      modal.scrollTop=scroll;
    }finally{if(button){button.disabled=false;button.textContent='원인분석 별도 저장';}}
  }

  function applySafetyFields(i,u){
    const p=document.getElementById('priorityEdit411')?.value;if(['normal','important','urgent'].includes(p)){i.priority=p;i.prioritySource='manual';i.prioritySetBy=u.name;i.prioritySetAt=now()}
    const note=text(document.getElementById('safetyNoteEdit')?.value);if(note)i.safetyNote=note;
  }

  async function finalApprove(i,u){
    const cause=isOrdinaryCauseReview(i)?collectCause():null;
    if(isOrdinaryCauseReview(i)&&!cause)return;
    i=structuredClone(i);
    if(cause)i.reportDetails={...(i.reportDetails||{}),...cause};
    if(!confirm('이 사고보고 내용을 최종승인할까요?\n이 확인은 전자결재가 아니라 사고보고 내용 확정 단계이며, 이후 재발방지계획을 수립합니다.'))return;
    applySafetyFields(i,u);const ts=now();i.status='approved';i.approvedBy=u.name;i.approvedAt=ts;i.rejectionNote='';
    if(i.supplement)i.supplement={...i.supplement,status:'accepted',approvedBy:u.name,approvedById:uid(u),approvedAt:ts};
    const w=workflow(i);w.phase='report_approved';w.finalApprovedAt=ts;w.finalApprovedBy=u.name;w.finalApprovedById=uid(u);i.updatedAt=ts;
    const attempt=window.enlStableSaveAttempt?.(document.querySelector('#modalRoot .modal'),i,['approvedAt','prioritySetAt','supplement.approvedAt','reportWorkflow.finalApprovedAt'])||i;
    const review=document.querySelector('#modalRoot .modal');
    if(!await window.enlCommitOrNotify(attempt))return;
    if(!review?.isConnected||uid(currentUser())!==uid(u))return;
    closeModal();renderShell(u);
    window.openUnifiedCorrectiveModal?.(i.id,u);
  }

  async function pushApi(action,extra={}){
    const u=currentUser?.();if(!u)return null;
    try{
      const r=await fetch(PUSH_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action,actor:actor(u),...extra}),cache:'no-store'});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||'push_api_error');return j;
    }catch(e){return null}
  }
  function stageBanner(i){
    const s=String(i.status||''),w=i.reportWorkflow||{},delay=w.immediateDelayMinutes==null?NaN:Number(w.immediateDelayMinutes);
    if(s==='approved')return '<section class="wf440-stage approved"><b>사고보고 승인 완료</b></section>';
    const sla=!/^\d{4}-\d{2}-\d{2}$/.test(i.occurredAt)&&Number.isFinite(delay)?` · 발생 후 약 ${delay}분에 최초보고`:'';
    const desc=s==='reported'?'안전관리자가 즉시보고 내용을 검토 중입니다.':s==='supplement'?'진단·병원비·견적 등 사후 확인자료 보완을 기다리고 있습니다.':s==='supplement_submitted'?'현장에서 보완자료를 제출하여 안전관리자 최종검토를 기다리고 있습니다.':s==='closed'?'사고보고와 재발방지조치 확인이 완료되어 종결되었습니다.':'사고 진행상태를 확인합니다.';
    return `<section class="wf440-stage ${s.includes('supplement')?'supplement':['approved','closed'].includes(s)?'approved':''}"><b>${ex(stateLabel(i))}</b>${ex(desc)}<small>${ex(sla)}</small></section>`;
  }

  function supplementSubmittedRows(i){
    const d=i?.reportDetails||{},s=i?.supplement||{},requested=new Set(s.requestedFields||[]),rows=[],leave={none:'휴업 없음',under3:'3일 미만', '3plus':'3일 이상',longterm:'장기치료·중상 가능',unknown:'아직 확인 중',fatal:'사망'},money=v=>{const n=Number(v||0);return Number.isFinite(n)&&n>0?n.toLocaleString('ko-KR')+'원':'미확인'};
    const add=(key,label,value)=>{if(requested.has(key))rows.push([label,text(value)||'미입력'])};
    if(i?.category==='person'){
      add('diagnosis','진단명',d.diagnosis);
      add('doctorOpinion','의사 소견·치료 예상기간',d.doctorOpinion);
      add('medicalCost','병원비·진료비',money(d.medicalCost));
      add('leaveEstimate','휴업기간 또는 사망 여부',leave[String(i.leaveEstimate||d.leaveEstimate||'unknown')]||String(i.leaveEstimate||d.leaveEstimate||'미확인'));
      if(requested.has('medicalDocument'))rows.push(['진단서·병원비 등 증빙',Array.isArray(s.attachments)&&s.attachments.length?s.attachments.length+'개 첨부':'첨부 없음']);
    }else{
      add('repairCost','수리·복구 견적금액',d.repairCostPending===true?'사후 보완 예정':money(d.repairCost));
      add('repairCostDetail','견적·비용 상세내역',d.repairCostDetail);
      if(requested.has('estimateDocument'))rows.push(['견적서·수리 관련 증빙',Array.isArray(s.attachments)&&s.attachments.length?s.attachments.length+'개 첨부':'첨부 없음']);
    }
    return rows;
  }
  function supplementInfo(i){
    if(!i?.supplement||!['supplement','supplement_submitted','approved','closed'].includes(String(i.status||'')))return '';
    const items=supplementList(i),s=i.supplement,rows=s.submittedAt?supplementSubmittedRows(i):[];
    const submitted=rows.length?`<div class="wf440-supplement-submitted"><b>현장 보완 제출내용</b><div class="wf440-supplement-change-list">${rows.map(([label,value])=>`<div class="wf440-supplement-change"><b>${ex(label)}</b><span>${ex(value)}</span></div>`).join('')}</div></div>`:'';
    return `<section class="wf440-supplement-note"><b>사후 보완정보</b>${items.length?`<ul>${items.map(x=>`<li>${ex(x)}</li>`).join('')}</ul>`:''}${s.requestNote?`<div style="margin-top:6px"><b>요청사항</b> ${ex(s.requestNote)}</div>`:''}${s.submittedBy?`<div style="margin-top:5px">보완 제출: ${ex(s.submittedBy)} · ${ex(typeof fmt==='function'?fmt(s.submittedAt):s.submittedAt||'')}</div>`:''}${submitted}</section>`;
  }

  function decorateIncidentModal(id,override=null){
    const i=override||incident(id),u=currentUser?.(),modal=document.querySelector('#modalRoot .modal');if(!i||!u||!modal||modal.querySelector('#wf440RequestForm,#official439DeleteForm,#prev429PlanForm,#prev429FieldForm,#prev429ReviewForm'))return;
    activeId=String(i.id);modal.dataset.wf440Incident=activeId;
    const decorSig=[i._syncVersion||0,i.updatedAt||'',i.status||'',i.supplement?.status||'',i.corrective?.status||'',(i.acknowledgements||[]).length].join('|');
    if(modal.dataset.wf440DecorSig===decorSig)return;
    modal.dataset.wf440DecorSig=decorSig;
    modal.querySelectorAll('.wf440-stage,.wf440-supplement-note[data-wf440-modal]').forEach(x=>x.remove());
    const head=modal.querySelector('.modal-head');if(head){head.insertAdjacentHTML('afterend',stageBanner(i));if(i.supplement&&(!modal.querySelector('[data-executive-summary]')||isSafety(u)||isFieldManager(u))){const holder=document.createElement('div');holder.className='wf440-supplement-note';holder.dataset.wf440Modal='1';holder.innerHTML=supplementInfo(i).replace(/^<section[^>]*>|<\/section>$/g,'');head.nextElementSibling?.insertAdjacentElement('afterend',holder)}}
    if(isReader(u)&&i.category==='person'&&!['approved','closed'].includes(String(i.status||''))){head?.insertAdjacentHTML('afterend','<div class="wf440-sensitive">관리자·경영진 화면에서는 진단명·의사소견·진단서 등 민감한 의료 상세정보를 제한하여 표시합니다.</div>')}
    if(isSafety(u)){
      modal.querySelector('#closeInc')?.remove();
      modal.querySelector('.wf440-safety-actions')?.remove();
      const baseApprove=modal.querySelector('#approveInc');if(baseApprove)baseApprove.remove();
      const reject=modal.querySelector('#rejectInc');if(reject){reject.textContent='보고 반려(오류·중복)';reject.title='보고서 자체에 오류나 중복이 있을 때 사유를 적어 현장에 돌려보냅니다.';reject.classList.add('wf440-invalid-btn')}
      if(['reported','supplement','supplement_submitted'].includes(String(i.status||''))){
        const actions=document.createElement('div');actions.className='wf440-safety-actions';
        if(String(i.status)==='supplement')actions.innerHTML='<button type="button" class="wf440-supp-btn" data-wf440-supp>보완요청 수정</button><button type="button" disabled style="background:#eef2f5;color:#778797">현장 보완자료 대기 중</button>';
        else actions.innerHTML='<button type="button" class="wf440-supp-btn" data-wf440-supp>'+(i.status==='supplement_submitted'?'자료 보완 재요청':'자료 보완요청')+'</button><button type="button" class="wf440-final-btn" data-wf440-final>사고보고 최종승인</button>';
        const target=modal.querySelector('.modal-actions')||modal.lastElementChild;target?.insertAdjacentElement('beforebegin',actions);
        actions.querySelector('[data-wf440-supp]')?.addEventListener('click',()=>openSupplementRequest(i,u));
        actions.querySelector('[data-wf440-final]')?.addEventListener('click',()=>finalApprove(i,u));
        if(isOrdinaryCauseReview(i)){
          const cause=causePanel(i),previous=modal.querySelector('[data-report-stage="B"]');
          cause.dataset.reportStage='B';
          if(previous)previous.replaceWith(cause);else actions.insertAdjacentElement('beforebegin',cause);
          bindCausePanel(cause,i);
          cause.querySelector('[data-wf440-cause-save]')?.addEventListener('click',()=>saveCause(i,u));
        }
      }
    }
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
    const u=currentUser?.();if(!(isSafety(u)||isReader(u)))return;
    const nav=document.querySelector('[data-shell-view="incidents"]');if(nav?.firstChild?.nodeType===Node.TEXT_NODE&&nav.firstChild.nodeValue!=='사고 조회')nav.firstChild.nodeValue='사고 조회';
    const stats=document.querySelector('.stats426');if(!stats)return;
    const arr=[...(data?.incidents||[])].filter(i=>['reported','supplement','supplement_submitted'].includes(String(i.status||''))).sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0)).slice(0,8);
    const sig=arr.map(i=>`${i.id}:${i.status}:${i.updatedAt||''}`).join('|');
    if(stats.dataset.wf440PendingSig===sig)return;stats.dataset.wf440PendingSig=sig;
    stats.querySelector('.wf440-reader-pending')?.remove();
    if(!arr.length)return;
    const box=document.createElement('section');box.className='wf440-reader-pending';
    const work=new Map(isSafety(u)?arr.map(i=>[String(i.id),window.enlSafetyWork?.(i).report]).filter(([,task])=>task):[]);
    box.innerHTML=`<h3>즉시보고 · 보완 진행 중 ${arr.length}건</h3>${work.size?`<span class="task-chip">표시된 사고 중 검토 필요 ${work.size}건</span>`:''}<div class="wf440-reader-pending-list">${arr.map(i=>`<button type="button" class="${work.has(String(i.id))?'task-required':''}" data-wf440-reader-open="${ex(i.id)}"><b>${ex(siteName(i.siteId))} · ${ex(work.get(String(i.id))||stateLabel(i))}</b><small>${ex(String(i.occurredAt||'').slice(0,16).replace('T',' '))} · ${ex(i.eventType||'사고')}</small></button>`).join('')}</div>`;stats.insertBefore(box,stats.children[1]||null);
    box.querySelectorAll('[data-wf440-reader-open]').forEach(b=>b.onclick=()=>window.enlOpenIncidentReview?.(b.dataset.wf440ReaderOpen,isSafety(u),u));
  }

  function wrapOpen(name){
    const base=window[name];if(typeof base!=='function'||base.__wf440)return;
    const wrapped=function(id){activeId=String(id||'');const out=base.apply(this,arguments);setTimeout(()=>decorateIncidentModal(activeId),0);setTimeout(()=>decorateIncidentModal(activeId),90);return out};wrapped.__wf440=true;window[name]=wrapped;
    try{if(name==='openIncidentModal')openIncidentModal=wrapped}catch(e){}
  }
  wrapOpen('enlOpenIncidentReview');wrapOpen('openIncidentModal');

  function patchAll(){
    patchQueued=false;patchImmediateForm();patchReaderPending();
    const u=currentUser?.(),root=document.getElementById('view');
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

  window.enlCreateCauseEditor=i=>{const panel=causePanel(i);bindCausePanel(panel,i);return panel;};
  window.enlCollectCause=collectCause;
  window.enlBuildCauseDraft=buildCauseDraft;
  window.enlOpenIncidentSupplement=openSupplementForm;
  window.enlRequestIncidentSupplement=openSupplementRequest;
  window.ENL_INCIDENT_FLOW_VERSION=VERSION;
})();
