/* Closed corrections never erase approval, closure or ERP evidence. */
(function(){
 'use strict';let queued=false;
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const actor=()=>{const u=currentUser();return {id:u.id||u.personnelId,role:u.role,siteId:u.siteId||''}};
 const fields=[['summary','사고 요약'],['occurredAt','발생일시'],['eventType','사고유형'],['injuredName','피해 직원명'],['immediateAction','사고 직후 조치'],
  ['reportDetails.place','발생 장소'],['reportDetails.workAction','사고 당시 작업'],['reportDetails.incidentHow','사고경위'],['reportDetails.environmentCause','환경적 요인'],['reportDetails.behaviorCause','작업자 행동요인'],['reportDetails.preventionPlan','최초 예방대책'],['reportDetails.specialNote','특이사항'],['reportDetails.job','직종·업무'],
  ['reportDetails.injuryDetail','부상 내용'],['reportDetails.diagnosis','진단명'],['reportDetails.doctorOpinion','의사 소견'],['reportDetails.medicalCost','치료비 (원)'],['reportDetails.medicalCostDetail','치료비 상세'],
  ['reportDetails.workerName','사고 당시 작업자'],['reportDetails.damagedItem','파손 물품'],['reportDetails.damageDetail','파손 내용'],['reportDetails.repairCost','수리비 (원)'],['reportDetails.repairCostDetail','수리비 상세'],
  ['corrective.rootCause','원인 · 미확정 사항은 추정이라고 표시해 주세요'],['corrective.planDetail','재발방지계획'],['corrective.ownerName','계획 담당자'],['corrective.dueDate','완료 목표일'],['corrective.actionDetail','현장 조치결과'],['corrective.actionDate','조치 시행일'],['corrective.actionOwner','조치 담당자'],['corrective.additionalNotes','추가 확인사항']];
 const personOnly=new Set(['injuredName','reportDetails.injuryDetail','reportDetails.diagnosis','reportDetails.doctorOpinion','reportDetails.medicalCost','reportDetails.medicalCostDetail']);
 const propertyOnly=new Set(['reportDetails.workerName','reportDetails.damagedItem','reportDetails.damageDetail','reportDetails.repairCost','reportDetails.repairCostDetail']);
 const val=(i,k)=>k.split('.').reduce((a,b)=>a?.[b],i);
 function failure(err){
  const msg=String(err?.message||err||'');
  if(msg.includes('enl_sync_conflict_version'))return '다른 사용자가 먼저 수정했습니다. 최신 사고기록을 다시 열고 변경해 주세요.';
  if(msg.includes('auth_proof_required')||msg.includes('session_auth_expired'))return '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.';
  if(msg.includes('revision_field_forbidden'))return '서버가 허용하지 않는 수정 항목이 포함되어 있습니다. 변경 항목을 다시 확인해 주세요.';
  if(msg.includes('revision_reason_required'))return '수정 사유를 입력해 주세요.';
  if(msg.includes('report_fields_required'))return '사고 요약 및 발생일시를 확인해 주세요.';
  if(msg.includes('invalid_cost'))return '치료비·수리비는 0원 이상의 정수여야 합니다.';
  if(msg.includes('historical_reauth_required'))return '과거사고 수정 권한이 만료되었습니다. 안전관리자 비밀번호를 다시 확인해 주세요.';
  if(msg.includes('mutation_id_conflict'))return '이전 저장 요청과 다른 내용입니다. 사고기록을 다시 열어 주세요.';
  if(msg.includes('approved_or_closed_required'))return '승인·종결된 사고만 이 메뉴에서 수정할 수 있습니다.';
  return '서버 저장을 확인하지 못했습니다. 저장 오류: '+(msg&&/^[a-z0-9_ -]{1,100}$/i.test(msg)?msg:'연결·서버 처리 실패');
 }
 async function operation(i,action,extra){const r=await window.enlIncidentApi({action,incidentId:i.id,expectedVersion:Number(i._syncVersion||0),actor:actor(),...extra},22000);if(!r?.incident)throw Error('save_not_confirmed');window.enlAcceptSavedIncident?.(r.incident);return r;}
 const labels=Object.fromEntries(fields.concat([['category','사고 구분'],['reportDetails.diagnosis','진단명'],['reportDetails.doctorOpinion','의사 소견'],['reportDetails.medicalCostDetail','진료비 상세'],['reportDetails.repairCostDetail','견적 상세'],['reportDetails.damageDetail','파손 내용'],['reportDetails.damagedItem','파손 물품'],['reportDetails.preventionPlan','예방대책'],['reportDetails.specialNote','특이사항'],['photos','사고 첨부자료'],['corrective.afterPhotos','조치 첨부자료']]));
 const koreaLocal=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?new Date(d.getTime()+9*3600000).toISOString().slice(0,16):''};
 const display=(key,v)=>{if(v===null||v===undefined||v==='')return '미입력';if(key==='category')return v==='person'?'대인사고':v==='property'?'대물사고':'사고';if(key==='occurredAt')return koreaLocal(v).replace('T',' ')+' (한국시간)';if(key.endsWith('Cost'))return Number(v).toLocaleString('ko-KR')+'원';if(Array.isArray(v))return v.map(x=>typeof x==='string'?x:x.name||'첨부자료').join(' · ')||'첨부 없음';if(typeof v==='object')return '기록 내용 변경';return String(v)};
 const historyRows=d=>{if(d.field==='reportDetails')return [...new Set([...Object.keys(d.before||{}),...Object.keys(d.after||{})])].filter(k=>JSON.stringify(d.before?.[k])!==JSON.stringify(d.after?.[k])).map(k=>({field:'reportDetails.'+k,before:d.before?.[k],after:d.after?.[k]}));return [d]};
 const control=(i,key)=>{const value=val(i,key)??'',attr=' data-correction-key="'+e(key)+'"';if(key==='occurredAt')return '<input type="datetime-local" required'+attr+' value="'+e(koreaLocal(value))+'">';if(key.endsWith('Cost'))return '<input type="number" min="0" max="999999999999" step="1"'+attr+' value="'+e(value)+'">';if(key.endsWith('Date'))return '<input type="date"'+attr+' value="'+e(value)+'">';return '<textarea'+attr+' rows="2">'+e(value)+'</textarea>'};
 function correction(i){
  if(currentUser()?.role!=='safety')return alert('안전관리자만 승인 후 정정할 수 있습니다.');
  if(!['approved','closed'].includes(String(i?.status||'')))return alert('승인·종결된 사고만 정정할 수 있습니다.');
  if(window.enlIsHistoricalCorrectionSupported?.(i)===true)return window.enlOpenHistoricalCorrection?.(i,currentUser());
  const done=i.status==='closed',keys=fields.filter(([k])=>(!k.startsWith('corrective.')||i.corrective)&&(i.category==='person'||!personOnly.has(k))&&(i.category!=='person'||!propertyOnly.has(k)));
  openModal('<div class="modal-head"><h2>'+(done?'종결사고 정정':'승인 후 사고정보 정정')+'</h2><button class="x" data-close>×</button></div>'
    +'<p>안전관리자 전용 정정입니다. 최초 승인·종결 상태는 변경하지 않으며, 변경 전후 내용과 수정 사유를 별도의 서버 이력에 보존합니다.</p>'
    +'<form id="closedCorrectionForm">'+keys.map(([key,label])=>'<label class="lbl"><span>'+e(label)+'</span>'+control(i,key)+'</label>').join('')
    +'<label class="lbl"><span>정정 사유 *</span><textarea id="correctionReason" required maxlength="2000" rows="3" placeholder="정정한 근거와 이유를 입력해 주세요."></textarea></label>'
    +'<div id="closedCorrectionError" role="alert" style="color:#ad3434;font-size:13px;font-weight:700" aria-live="polite"></div>'
    +'<button class="primary full" type="submit">정정 내용 서버에 저장</button></form>');
  const form=document.getElementById('closedCorrectionForm');let lastPayload='',mutationId='';
  form.onsubmit=async ev=>{
    ev.preventDefault();if(!form.reportValidity())return;
    const button=form.querySelector('button[type=submit]'),hint=form.querySelector('#closedCorrectionError');if(button.disabled)return;hint.textContent='';
    const changes={};
    try{
      form.querySelectorAll('[data-correction-key]').forEach(input=>{
        const key=input.dataset.correctionKey,[top,sub]=key.split('.');let value=input.value.trim();
        if(key==='occurredAt'){
          if(value===koreaLocal(val(i,key)))return;
          const parsed=new Date(value+':00+09:00');if(!Number.isFinite(parsed.getTime()))throw Error('report_fields_required');
          value=parsed.toISOString();
        }else if(key.endsWith('Cost')){
          if(value!==''&&!/^(0|[1-9]\d{0,11})$/.test(value))throw Error('invalid_cost');
          value=value===''?null:Number(value);
        }
        if(String(val(i,key)??'')===String(value??''))return;
        if(sub){changes[top]||={};changes[top][sub]=value;}else changes[top]=value;
      });
      const reason=form.querySelector('#correctionReason').value.trim();
      if(reason.length<2){hint.textContent='수정 사유를 2자 이상 입력해 주세요.';return;}
      if(!Object.keys(changes).length){hint.textContent='실제로 변경된 내용이 없습니다.';return;}
      // Retain an idempotent mutation ID for retrying identical payload after a lost response.
      const payload=JSON.stringify({changes,reason});
      if(payload!==lastPayload){lastPayload=payload;mutationId=crypto.randomUUID();}
      button.disabled=true;button.textContent='서버 저장 중…';
      await operation(i,'correct_closed',{changes,reason,mutationId});
      closeModal();renderShell(currentUser());alert('정정내용이 서버에 저장되었습니다. 기존 승인·종결기록과 개정이력은 보존됩니다.');
    }catch(err){
      hint.textContent=failure(err);button.disabled=false;button.textContent='정정 내용 서버에 저장';
    }
  };
 }
 function erp(i){
  const r=i.officialRecord?.erpManual||{};
  openModal('<div class="modal-head"><h2>ERP 수동 기안 기록</h2><button class="x" data-close>×</button></div><p>ERP에서 직접 기안하신 뒤 기록해 주세요. 이 기록은 ERP 승인이나 문서 자동수정을 의미하지 않습니다.</p><form id="erpManualForm"><label class="lbl"><span>ERP 문서번호 (선택)</span><input id="erpNumber" maxlength="120" value="'+e(r.documentNumber||'')+'"></label><label class="lbl"><span>기안일 *</span><input id="erpDate" type="date" required value="'+e(r.draftedAt||'')+'"></label><label class="lbl"><span>기록 사유 *</span><input id="erpReason" required maxlength="2000"></label><label><input id="erpDone" type="checkbox" required> ERP에서 수동 기안을 완료했습니다.</label><button type="submit" class="primary full">수동 기안정보 저장</button></form>');
  const form=document.getElementById('erpManualForm'),mutationId=crypto.randomUUID();form.onsubmit=async ev=>{ev.preventDefault();if(!form.reportValidity())return;const b=form.querySelector('button[type=submit]');if(b.disabled)return;b.disabled=true;try{await operation(i,'erp_record',{record:{submitted:true,documentNumber:form.querySelector('#erpNumber').value,draftedAt:form.querySelector('#erpDate').value},reason:form.querySelector('#erpReason').value,mutationId});closeModal();renderShell(currentUser());alert('ERP 수동 기안정보를 기록했습니다.')}catch(err){failure(err);b.disabled=false;}};
 }
 async function history(i){try{const r=await window.enlIncidentApi({action:'revision_list',incidentId:i.id,actor:actor()});openModal('<div class="modal-head"><h2>사고 정정이력</h2><button class="x" data-close>×</button></div>'+(r.revisions||[]).map(x=>'<section class="panel"><h3>개정 '+x.revision+' · '+e(x.editor_name)+'</h3><p>'+e(koreaLocal(x.created_at).replace('T',' '))+' (한국시간) · '+e(x.reason)+'</p>'+x.changes.flatMap(historyRows).map(d=>'<details open><summary>'+e(labels[d.field]||'추가 기록')+'</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">변경 전: '+e(display(d.field,d.before))+'<br>변경 후: '+e(display(d.field,d.after))+'</p></details>').join('')+'</section>').join('')+'<p>승인 및 종결 당시 기록은 보존됩니다.</p>')}catch(err){failure(err)}}
 function decorate(){
  queued=false;const m=document.querySelector('#modalRoot .modal');if(!m)return;
  const id=m.dataset.wf440Incident||m.querySelector('[data-lifecycle-final]')?.dataset.lifecycleFinal;
  const i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!['approved','closed'].includes(String(i?.status||'')))return;
  const historic=window.enlIsHistoricalCorrectionSupported?.(i)===true;
  if(historic&&i.status==='approved')return; // The existing historical password-gated editor already owns this state.
  if(m.querySelector('[data-closed-record]'))return;
  const u=currentUser();if(!['safety','manager','executive','final'].includes(u?.role))return;
  if(!historic){
    // Legacy generic re-submission cannot save an approved/closed report. Hide those unsafe controls.
    m.querySelector('#editInc')?.remove();m.querySelector('#saveNote')?.remove();
    m.querySelector('#closeInc')?.remove();m.querySelector('#deleteInc')?.remove();
    m.querySelector('#priorityEdit411')?.closest('.inc411-priority-box')?.remove();
    m.querySelector('#safetyNoteEdit')?.closest('label')?.remove();
  }
  const done=i.status==='closed',s=document.createElement('section');s.className='panel';s.dataset.closedRecord='1';
  s.innerHTML='<h3>'+(done?'종결사고':'승인된 사고')+' · 개정 '+Number(i.officialRecord?.revisionNumber||0)+'</h3>'
    +(i.officialRecord?.erpCorrectionRequired?'<p><strong>기존 ERP 수동 기안 내용과의 정합성 검토 필요</strong></p>':'')
    +(i.officialRecord?.actionRecheckRequired?'<p><strong>재발방지계획·조치완료 사실의 재검토가 필요합니다.</strong></p>':'')
    +'<div class="modal-actions">'
    +(u.role==='safety'?'<button class="btn-blue" data-closed-correct>'+(historic?'과거사고 이관정보 수정':done?'사유를 남기고 정정':'승인 후 사고정보 정정')+'</button>'
    +(done?'<button class="btn-gray" data-closed-erp>ERP 수동 기안 기록</button>':''):'')
    +'<button class="btn-gray" data-closed-history>정정이력 조회</button></div>';
  m.appendChild(s);
  s.querySelector('[data-closed-correct]')?.addEventListener('click',()=>historic?window.enlOpenHistoricalCorrection?.(i,u):correction(i));
  s.querySelector('[data-closed-erp]')?.addEventListener('click',()=>erp(i));
  s.querySelector('[data-closed-history]').onclick=()=>history(i);
 }
 const queue=()=>{if(!queued){queued=true;requestAnimationFrame(decorate)}};new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});window.enlOpenApprovedCorrection=correction;window.ENL_CLOSED_INCIDENT_REOPEN_VERSION='4.6.1-r1-audited-correction';
})();
