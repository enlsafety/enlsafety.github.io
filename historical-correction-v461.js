/* Safety-only historical corrections: fresh password, signed short-lived grant, append-only revision. */
(function(){
'use strict';
const VERSION='4.6.4-r1-historical-occurrence-date';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isHistorical=i=>!!i&&i.bulkInvalidation?.active!==true&&(
  ['historical_manual','historical_transfer'].includes(String(i.recordMode||''))||
  String(i.historicalTransfer?.mode||'')==='historical_transfer'||
  i.historicalImport?.enabled===true||
  (!!i.historicalOrigin?.batchId&&!!i.historicalOrigin?.candidateId&&['verified','unverifiable'].includes(String(i.externalInitialApproval?.state||'')))
);
const eligible=i=>isHistorical(i)&&['approved','closed'].includes(String(i.status||''));
const isSafety=u=>String(u?.role||'')==='safety';
const user=()=>typeof currentUser==='function'?currentUser():null;
const actor=u=>({id:String(u.id||u.personnelId||''),role:'safety',name:u.name||'',position:u.position||'',siteId:u.siteId||''});
const val=(i,k)=>k.split('.').reduce((v,part)=>v?.[part],i);
const localDate=v=>{if(!v)return '';const x=new Date(v);return Number.isNaN(x.valueOf())?'':new Date(x.valueOf()+9*3600000).toISOString().slice(0,16)};
const unknownTime=i=>i?.occurrenceTimeKnown===false||i?.historicalImport?.occurrenceTimeKnown===false||i?.historicalTransfer?.occurredTimeKnown===false;
const todaySeoul=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
function correctedOccurrence(i,value){
 const entered=String(value||'').trim(),unknown=unknownTime(i),original=localDate(i?.occurredAt||'');
 if(unknown?entered===original.slice(0,10):entered===original)return null;
 if(unknown?!/^\d{4}-\d{2}-\d{2}$/.test(entered):!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(entered))throw Error('invalid_occurrence_date');
 const when=new Date(unknown?entered+'T00:00:00+09:00':entered+':00+09:00');
 if(!Number.isFinite(when.getTime())||when.getTime()>Date.now()+60000||when.getUTCFullYear()<1900)throw Error('invalid_occurrence_date');
 const local=new Date(when.getTime()+9*3600000).toISOString().slice(0,16);
 if(unknown?local.slice(0,10)!==entered:local!==entered)throw Error('invalid_occurrence_date');
 return when.toISOString();
}
const isMoney=k=>/Cost$/.test(k);
const labels={occurredAt:'사고 발생일시 (한국시간)',summary:'사고 요약',eventType:'사고 유형',injuredName:'피해 직원',immediateAction:'사고 당시 즉시조치',
  'reportDetails.place':'사고 장소','reportDetails.workAction':'사고 당시 작업',
  'reportDetails.incidentHow':'사고 경위','reportDetails.environmentCause':'환경적 요인',
  'reportDetails.job':'직종·업무','reportDetails.injuredName':'피해 직원명',
  'reportDetails.injuryDetail':'부상 내용','reportDetails.diagnosis':'진단명',
  'reportDetails.medicalCost':'치료비 (원)','reportDetails.workerName':'당시 작업자',
  'reportDetails.damagedItem':'파손 물품·시설','reportDetails.damageDetail':'파손 내용',
  'reportDetails.repairCost':'수리비 (원)',
  'historicalImport.originalReporterName':'당시 보고자',
  'historicalImport.erpApprovalRef':'기존 ERP 문서번호',
  'historicalImport.erpApprovalDate':'기존 ERP 결재일',
  'historicalImport.existingActionNote':'기존 조치자료 설명',
  'historicalImport.additionalActionNote':'추가조치 관련 메모'};
const common=['occurredAt','summary','eventType','immediateAction','reportDetails.place','reportDetails.workAction','reportDetails.incidentHow','reportDetails.environmentCause','reportDetails.job'];
const damagePerson=['injuredName','reportDetails.injuredName','reportDetails.injuryDetail','reportDetails.diagnosis','reportDetails.medicalCost'];
const damageProperty=['reportDetails.workerName','reportDetails.damagedItem','reportDetails.damageDetail','reportDetails.repairCost'];
const meta=['historicalImport.originalReporterName','historicalImport.erpApprovalRef','historicalImport.erpApprovalDate','historicalImport.existingActionNote','historicalImport.additionalActionNote'];
const reportField=k=>k.includes('incidentHow')||k.includes('injuryDetail')||k.includes('damageDetail')||k.includes('environmentCause')||k.includes('workAction')||k.includes('immediateAction')||k.endsWith('Note')||k==='summary';
function css(){
 if(document.getElementById('historicalCorrectionCss'))return;
 const style=document.createElement('style');style.id='historicalCorrectionCss';
 style.textContent='.historical461-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.historical461-grid .wide{grid-column:1/-1}.historical461-guide{border:1px solid #c2d6e5;border-radius:11px;background:#f3f8fc;color:#274d69;padding:12px;font-size:13px;line-height:1.6;margin:10px 0 14px}.historical461-hint{color:#ae3333;font-weight:750;font-size:13px;min-height:18px}.historical461-form{display:grid;gap:12px}.historical461-form input,.historical461-form textarea{max-width:100%;font-size:15px}.historical461-actions{display:flex;gap:10px;flex-wrap:wrap}.historical461-actions button{flex:1;min-width:125px;min-height:44px}@media(max-width:680px){.historical461-grid{grid-template-columns:1fr}.historical461-grid .wide{grid-column:auto}}';
 document.head.appendChild(style);
}
async function call(i,action,extra={},timeout=20000){
 if(typeof window.enlIncidentApi!=='function')throw Error('server_unavailable');
 return window.enlIncidentApi({action,actor:actor(user()),incidentId:String(i.id),...extra},timeout);
}
function errorText(err){
 const x=String(err?.message||err||'');
 if(x.includes('historical_password_invalid'))return '안전관리자 비밀번호가 일치하지 않습니다.';
 if(x.includes('historical_password_required'))return '안전관리자 비밀번호를 입력해 주세요.';
 if(x.includes('historical_reauth_required'))return '수정 권한이 만료되었거나 유효하지 않습니다. 다시 비밀번호를 확인해 주세요.';
 if(x.includes('enl_sync_conflict_version'))return '다른 사용자가 먼저 수정했습니다. 최신 사고기록을 다시 열어 주세요.';
 if(x.includes('auth_proof_required')||x.includes('session_auth_expired'))return '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.';
 if(x.includes('not_found'))return '서버에 이관 사고기록이 없어 저장할 수 없습니다. 이관등록 및 서버 동기화 상태를 확인해 주세요.';
 if(x.includes('bulk_use_import_editor'))return '승인된 과거사고 정정을 서버의 보호 규칙이 차단했습니다. 앱을 새로고침한 뒤 다시 시도해 주세요.';
 if(x.includes('revision_field_forbidden'))return '수정할 수 없는 원본·결재정보가 포함되어 있습니다. 수정 항목을 확인해 주세요.';
 if(x.includes('approved_or_closed_required'))return '승인 또는 종결된 사고만 이관정보를 정정할 수 있습니다.';
 if(x.includes('invalid_cost'))return '치료비·수리비는 0원 이상의 정수로 입력해 주세요.';
 if(x.includes('no_changes'))return '실제로 변경된 내용이 없습니다.';
 if(x.includes('invalid_occurrence_date')||x.includes('future_occurrence_invalid')||x.includes('report_fields_required'))return '발생일시를 다시 확인해 주세요. 미래 날짜는 저장할 수 없습니다.';
 if(x.includes('contract_period_confirmation_required'))return '변경할 발생일의 계약기간 확인이 필요합니다. 사고자료를 확인한 후 다시 시도해 주세요.';
 return '서버 확인에 실패했습니다. 인터넷 연결 및 입력정보를 확인해 주세요.';
}
function inputs(i,keys=[...common,...(i.category==='person'?damagePerson:damageProperty),...(i.historicalImport?.enabled?meta:[])]){
 return keys.map(k=>{
  const label=labels[k]||k,initial=val(i,k)??'';
  const attr='data-historical461-field="'+e(k)+'"';
  const control=k==='occurredAt'
   ?(unknownTime(i)
      ?'<input '+attr+' type="date" required min="1900-01-01" max="'+todaySeoul()+'" value="'+e(localDate(initial).slice(0,10))+'"><small>이 사고는 발생 시간이 미상으로 기록되어 있어 날짜만 수정해.</small>'
      :'<input '+attr+' type="datetime-local" required min="1900-01-01T00:00" max="'+e(localDate(new Date()))+'" value="'+e(localDate(initial))+'"><small>한국시간 기준 발생 날짜·시간</small>')
   :isMoney(k)?'<input '+attr+' type="number" min="0" max="999999999999" step="1" value="'+e(initial)+'">'
   :k.endsWith('erpApprovalDate')?'<input '+attr+' type="date" value="'+e(initial)+'">'
   :reportField(k)?'<textarea '+attr+' rows="3" maxlength="4000">'+e(initial)+'</textarea>'
   :'<input '+attr+' type="text" maxlength="4000" value="'+e(initial)+'">';
  return '<label class="lbl '+(reportField(k)?'wide':'')+'"><span>'+e(label)+'</span>'+control+'</label>';
 }).join('');
}
function collect(i,form){
 const changes={};
 form.querySelectorAll('[data-historical461-field]').forEach(input=>{
  const k=input.dataset.historical461Field,original=val(i,k);
  let value=input.value.trim();
  if(k==='occurredAt'){value=correctedOccurrence(i,value);if(!value)return;}
  if(isMoney(k)){
    if(value!==''&&(!/^(?:0|[1-9]\d{0,11})$/.test(value)))throw Error('invalid_cost');
    value=value===''?null:Number(value);
  }
  if(String(original??'')===String(value??''))return;
  const dot=k.indexOf('.');
  if(dot<0)changes[k]=value;
  else{
   const top=k.slice(0,dot),field=k.slice(dot+1);
   if(!changes[top])changes[top]={};
   changes[top][field]=value;
  }
 });
 return changes;
}
function edit(i,ticket,expiresAt){
 css();
 const html='<div class="modal-head"><div><h2>과거사고 이관정보 정정</h2><p>최초 승인 상태와 기존 감사기록은 그대로 보존됩니다.</p></div><button class="x" data-close>×</button></div>'
  +'<div class="historical461-guide">안전관리자 비밀번호가 확인되었습니다. 오타 등 확인된 사실만 수정하고, 반드시 수정 사유를 입력해 주세요. 변경 전·후 값과 수정자·시각이 서버에 남습니다. 수정 권한은 인증 후 8분 동안 유효합니다.</div>'
  +'<form id="historical461EditForm" class="historical461-form"><div class="historical461-grid">'+inputs(i)+'</div>'
  +'<label class="lbl"><span>수정 사유 *</span><textarea id="historical461Reason" maxlength="2000" required rows="3" placeholder="예: 과거사고 사고경위 중 장비명 오타 정정"></textarea></label>'
  +'<div class="historical461-hint" id="historical461EditError" role="alert"></div>'
  +'<div class="historical461-actions"><button class="btn-gray" type="button" data-close>취소</button><button type="submit" class="primary">수정내용 저장</button></div></form>';
 openModal(html);
 const form=document.getElementById('historical461EditForm');
 let pendingSignature='',pendingMutationId='';
 form.querySelector('[data-close]')?.addEventListener('click',()=>closeModal());
 form.onsubmit=async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const hint=document.getElementById('historical461EditError'),button=form.querySelector('[type=submit]');
  if(button.disabled)return;hint.textContent='';
  let changes;try{changes=collect(i,form)}catch(err){hint.textContent=errorText(err);return}
  if(!Object.keys(changes).length){hint.textContent='수정된 내용이 없습니다.';return;}
  if(Date.now()>=Number(expiresAt)){hint.textContent='수정 권한 8분이 만료되었습니다. 창을 닫고 비밀번호를 다시 확인해 주세요.';return;}
  const reason=form.querySelector('#historical461Reason').value.trim();
  if(!reason){hint.textContent='수정 사유를 입력해 주세요.';return;}
  let contractConfirmed=false;
  if(changes.occurredAt&&window.ENLContracts?.assess){
    const day=new Date(new Date(changes.occurredAt).getTime()+9*3600000).toISOString().slice(0,10);
    const check=window.ENLContracts.assess(window.ENLContracts.site(i.siteId),day);
    if(check.outsideContractPeriod===true||(check.currentStatus==='closed'&&check.statusAtOccurrence==='unknown')){
      if(!window.confirm((check.warning||'해당 발생일의 사업장 계약기간을 확인해야 합니다.')+'\n실제 자료를 확인했으며 이 날짜로 정정할까요?'))return;
      contractConfirmed=true;
    }
  }
  const signature=JSON.stringify({changes,reason,contractConfirmed});
  if(signature!==pendingSignature){pendingSignature=signature;pendingMutationId=crypto.randomUUID();}
  button.disabled=true;button.textContent='수정내용 저장 중…';
  try{
   const r=await call(i,'correct_closed',{expectedVersion:Number(i._syncVersion||0),mutationId:pendingMutationId,changes,reason,contractConfirmed,reauthTicket:ticket},22000);
   if(!r?.incident)throw Error('server_unavailable');
   window.enlAcceptSavedIncident?.(r.incident);
   closeModal();renderShell(user());alert('과거사고 이관정보의 정정사항이 저장되었습니다. 최초 승인·종결 기록과 변경이력은 보존됩니다.');
  }catch(err){hint.textContent=errorText(err);button.disabled=false;button.textContent='수정내용 저장';}
 };
}
function open(i,viewer=user()){
 if(!isSafety(viewer)){alert('안전관리자만 과거사고 이관정보를 수정할 수 있습니다.');return false;}
 if(!eligible(i)){alert('승인되었거나 종결된 과거사고만 이관정보를 수정할 수 있습니다.');return false;}
 css();
 openModal('<div class="modal-head"><h2>안전관리자 비밀번호 재확인</h2><button class="x" data-close>×</button></div>'
  +'<div class="historical461-guide">승인된 과거사고는 수정 사유와 변경이력을 남기는 방식으로 정정할 수 있습니다. 안전관리자 비밀번호를 다시 입력해 주세요.</div>'
  +'<form id="historical461PasswordForm" class="historical461-form"><label class="lbl"><span>안전관리자 비밀번호 *</span><input id="historical461Password" type="password" autocomplete="off" required maxlength="256" placeholder="현재 비밀번호를 입력해 주세요."></label>'
  +'<div class="historical461-hint" id="historical461PasswordError" role="alert"></div><button class="primary full" type="submit">비밀번호 확인 후 수정</button></form>');
 const form=document.getElementById('historical461PasswordForm');form.querySelector('input')?.focus();
 form.onsubmit=async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('[type=submit]'),input=form.querySelector('#historical461Password'),hint=form.querySelector('#historical461PasswordError');
  if(button.disabled)return;button.disabled=true;hint.textContent='';
  const password=input.value;input.value='';
  try{
   const r=await call(i,'historical_reauth',{reauthPassword:password},18000);
   if(!r?.verified||!r?.reauthTicket||!r?.incident)throw Error('server_unavailable');
   if(window.enlEditIncidentInReportForm&&['person','property'].includes(r.incident.category))window.enlEditIncidentInReportForm(r.incident,viewer,{reauthTicket:r.reauthTicket,expiresAt:r.expiresAt});
   else edit(r.incident,r.reauthTicket,r.expiresAt);
  }catch(err){hint.textContent=errorText(err);button.disabled=false;}
 };
 return true;
}
async function history(i){
 if(!eligible(i))return;
 try{
  const r=await call(i,'revision_list');
  const rows=(r.revisions||[]).map(x=>{
    const details=(x.changes||[]).flatMap(d=>{
      if(d.field!=='reportDetails')return [d];
      const before=d.before||{},after=d.after||{};
      return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])).map(k=>({field:'reportDetails.'+k,before:before[k],after:after[k]}));
    });
    return '<section class="panel"><h3>개정 '+Number(x.revision)+' · '+e(x.editor_name)+'</h3><p>'+e(new Date(x.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' · '+e(x.reason)+'</p>'
      +details.map(d=>'<details><summary>'+e(labels[d.field]||d.field)+'</summary><p>수정 전: '+e(d.field==='occurredAt'?localDate(d.before).replace('T',' ')+' (한국시간)':(d.before??'미입력'))+'</p><p>수정 후: '+e(d.field==='occurredAt'?localDate(d.after).replace('T',' ')+' (한국시간)':(d.after??'미입력'))+'</p></details>').join('')+'</section>';
  }).join('');
  openModal('<div class="modal-head"><h2>과거사고 정정이력</h2><button class="x" data-close>×</button></div>'+(rows||'<div class="historical461-guide">정정이력이 없습니다.</div>'));
 }catch(err){alert(errorText(err))}
}
window.enlIsHistoricalCorrectionSupported=eligible;
window.enlHistoricalMetadataHtml=i=>inputs(i,[...(i.summary!==i.reportDetails?.generatedSummary?['summary']:[]),...(i.historicalImport?.enabled?meta:[])]);
window.enlCollectHistoricalMetadata=collect;
window.enlOpenHistoricalCorrection=open;
window.enlShowHistoricalCorrectionHistory=history;
window.ENL_HISTORICAL_CORRECTION_VERSION=VERSION;
})();
