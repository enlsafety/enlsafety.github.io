/* E&L Accident Report App v4.1.2 - authoritative independent corrective action flow */
(function(){
  'use strict';
  const VERSION='4.1.2-r16-action2';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isSite=u=>u&&['field','worker'].includes(u.role);
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const reportApproved=i=>!!i&&['approved','closed'].includes(String(i.status||''));
  const siteName=id=>{try{return siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const actionStatusText=v=>v==='planned'?'조치예정':v==='in_progress'?'조치중':v==='submitted'?'검토대기':v==='rejected'?'반려':v==='approved'?'승인완료':'미작성';
  let actionViewFilter={status:'',siteId:'',title:''};

  try{
    actionStatusName=actionStatusText;
    actionBadge=function(i){const s=i?.corrective?.status;if(!reportApproved(i))return badge('p-normal','조치 보고승인 대기');if(!s)return badge('p-normal','조치 미작성');return badge(s==='approved'?'p-done':s==='rejected'?'p-rejected':'p-review',`조치 ${actionStatusText(s)}`)};
  }catch(e){}

  function actionAccessibleIncidents(u){
    let arr=[...(data.incidents||[])].filter(reportApproved);
    if(isSite(u))arr=arr.filter(i=>String(i.siteId)===String(u.siteId));
    if(isReader(u))arr=arr.filter(i=>i.corrective?.status==='approved');
    return arr.sort(typeof sortIncidents==='function'?sortIncidents:(a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
  }
  function actionCanEdit(i,u){
    if(!i||!u||!reportApproved(i))return false;const role=roleNorm(u.role),status=i.corrective?.status||'';
    if(isReader(u))return false;
    if(isSite(u)&&String(i.siteId)!==String(u.siteId))return false;
    if(status==='approved')return false;
    if(status==='submitted'&&role!=='safety')return false;
    return ['safety','field','worker'].includes(role);
  }
  function summaryHtml(i){
    if(typeof window.enlIncidentOverviewHtml==='function')return window.enlIncidentOverviewHtml(i,{compact:true});
    return `<div class="warn-box">${esc(i.summary||'-')}</div>`;
  }
  function quick(i){return typeof window.enlIncidentQuickSummary==='function'?window.enlIncidentQuickSummary(i):{headline:i.eventType||'사고',circumstance:i.summary||'',when:fmt(i.occurredAt),site:siteName(i.siteId)};}
  function attachmentHtml(arr){return typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(arr||[]):''}
  function bindAttachments(root,arr){if(typeof window.enlBindAttachmentOpen==='function')window.enlBindAttachmentOpen(root,arr||[])}
  function persistList(arr){return (arr||[]).map(a=>typeof window.enlPersistAttachment==='function'?window.enlPersistAttachment(a):a)}

  function actionCard(i,u){
    const c=i.corrective||{},q=quick(i),editable=actionCanEdit(i,u),status=c.status||'',buttonText=status==='submitted'&&roleNorm(u.role)!=='safety'?'안전관리자 검토 중':status==='approved'?'승인된 조치 확인':status==='rejected'?'반려 내용 수정·재제출':!c.rootCause&&!c.actionDetail?'사고 조치 등록':editable?'사고 조치 수정·확인':'사고 조치 확인';
    const review=status==='rejected'&&c.reviewNote?`<div class="law-box"><b>사고조치 반려사유</b><br>${esc(c.reviewNote)}</div>`:'';
    return `<article class="action-card"><div>${typeof categoryBadge==='function'?categoryBadge(i.category):''}${typeof statusBadge==='function'?statusBadge(i.status):''}${typeof actionBadge==='function'?actionBadge(i):''}</div><h3>${esc(q.site||siteName(i.siteId))} · ${esc(q.headline||i.eventType||'사고')}</h3>${summaryHtml(i)}${review}<div class="action-grid"><div><b>원인</b><span>${esc(c.rootCause||'미작성')}</span></div><div><b>조치내용</b><span>${esc(c.actionDetail||'미작성')}</span></div><div><b>담당자</b><span>${esc(c.ownerName||'-')}</span></div><div><b>완료기한</b><span>${c.dueDate?`${esc(c.dueDate)} (${dday(c.dueDate)})`:'-'}</span></div></div><button class="secondary" data-unified-action="${esc(i.id)}">${buttonText}</button></article>`;
  }

  function renderUnifiedActionsFn(root,u){
    const base=actionAccessibleIncidents(u),reader=isReader(u),scopeText=isSite(u)?`${esc(siteName(u.siteId))} 승인 사고`:reader?'안전관리자가 승인한 사고조치':'전체 사업장 승인 사고',preset={...actionViewFilter};
    const heading=preset.title|| (reader?'승인 사고조치':'사고 조치');
    root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>${esc(heading)}</h2><p>${scopeText}의 사고조치를 사고보고와 별도 상태로 관리합니다.${roleNorm(u.role)==='safety'?' 검토대기 조치는 별도로 승인 또는 반려할 수 있습니다.':reader?' 조치까지 안전관리자 승인이 완료된 건만 표시합니다.':''}</p></div></div>${reader?'':`<div class="toolbar"><div class="left">${isSite(u)?'':`<select id="actionSiteFilter"><option value="">전체 사업장</option>${(data.sites||[]).map(s=>`<option value="${esc(s.id)}" ${String(preset.siteId)===String(s.id)?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`}<select id="actionStateFilter"><option value="" ${!preset.status?'selected':''}>전체 조치상태</option><option value="none" ${preset.status==='none'?'selected':''}>미작성</option><option value="planned" ${preset.status==='planned'?'selected':''}>조치예정</option><option value="in_progress" ${preset.status==='in_progress'?'selected':''}>조치중</option><option value="submitted" ${preset.status==='submitted'?'selected':''}>검토대기</option><option value="rejected" ${preset.status==='rejected'?'selected':''}>반려</option><option value="approved" ${preset.status==='approved'?'selected':''}>승인완료</option></select></div></div>`}<div id="unifiedActionList" class="action-list"></div></div>`;
    const refresh=()=>{let arr=[...base];const sf=reader?'':(document.getElementById('actionSiteFilter')?.value||preset.siteId||''),af=reader?'approved':(document.getElementById('actionStateFilter')?.value||preset.status||'');if(sf)arr=arr.filter(i=>String(i.siteId)===String(sf));if(af==='none')arr=arr.filter(i=>!i.corrective||!i.corrective.status);else if(af)arr=arr.filter(i=>i.corrective?.status===af);const list=document.getElementById('unifiedActionList');if(!list)return;list.innerHTML=arr.map(i=>actionCard(i,u)).join('')||'<div class="empty">표시할 사고조치가 없습니다.</div>';list.querySelectorAll('[data-unified-action]').forEach(b=>b.onclick=()=>openCorrectiveModal(b.dataset.unifiedAction,u))};
    ['actionSiteFilter','actionStateFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{actionViewFilter={status:document.getElementById('actionStateFilter')?.value||'',siteId:document.getElementById('actionSiteFilter')?.value||'',title:''};refresh()}));refresh();
  }

  function openCorrectiveModal(id,u){
    const i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return;
    if(isSite(u)&&String(i.siteId)!==String(u.siteId))return alert('소속 사업장의 사고만 조치할 수 있습니다.');
    if(!reportApproved(i))return alert('사고보고가 안전관리자 승인된 후 사고조치를 작성할 수 있습니다.');
    const c=i.corrective||{},role=roleNorm(u.role),reader=isReader(u),editable=actionCanEdit(i,u);actionPhotos=[...(c.afterPhotos||[])];
    if(reader&&c.status!=='approved')return alert('안전관리자가 승인한 사고조치만 조회할 수 있습니다.');
    const existingAttachments=attachmentHtml(c.afterPhotos||[]);
    if(!editable){
      openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE DETAIL</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'사고')}</h2><div style="margin-top:7px">${typeof actionBadge==='function'?actionBadge(i):''}</div></div><button class="x" data-close>×</button></div>${summaryHtml(i)}<section class="inc411-section"><h3>사고 조치 내용</h3><div class="inc411-section-body"><div class="inc411-kv"><b>원인 분석</b><span>${esc(c.rootCause||'-')}</span></div><div class="inc411-kv"><b>후속조치</b><span>${esc(c.actionDetail||'-')}</span></div><div class="inc411-kv"><b>담당/기한</b><span>${esc(c.ownerName||'-')} · ${esc(c.dueDate||'-')}</span></div><div class="inc411-kv"><b>조치상태</b><span>${esc(actionStatusText(c.status))}</span></div><div class="inc411-kv"><b>안전관리자 검토</b><span>${esc(c.reviewNote||'-')}</span></div>${c.reviewedBy?`<div class="inc411-kv"><b>최종 검토자</b><span>${esc(c.reviewedBy)} · ${esc(c.reviewedAt?fmt(c.reviewedAt):'-')}</span></div>`:''}</div></section>${existingAttachments?`<section class="inc411-section"><h3>조치 사진 · PDF</h3><div class="inc411-section-body">${existingAttachments}</div></section>`:''}`);bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[]);return;
    }
    const rejectedInfo=c.status==='rejected'&&c.reviewNote?`<div class="law-box"><b>사고조치 반려사유</b><br>${esc(c.reviewNote)}${c.reviewedBy?`<br><small>${esc(c.reviewedBy)} · ${esc(c.reviewedAt?fmt(c.reviewedAt):'')}</small>`:''}</div>`:'';
    const rejectedOption=c.status==='rejected'?'<option value="rejected" selected disabled>반려됨 - 수정 후 상태를 선택하세요</option>':'';
    const safetyReview=role==='safety'?`<label class="lbl"><span>안전관리자 검토의견${c.status==='submitted'?' / 반려사유':''}</span><textarea id="uReviewNote" rows="3" placeholder="검토의견을 입력하세요">${esc(c.reviewNote||'')}</textarea></label>`:(c.reviewNote?`<div class="law-box"><b>최근 안전관리자 검토의견</b><br>${esc(c.reviewNote)}</div>`:'');
    const reviewButtons=role==='safety'&&c.status==='submitted'?'<div class="modal-actions"><button type="button" class="btn-reject" id="rejectCorrective411">사고조치 반려</button><button type="button" class="btn-green" id="approveCorrective411">사고조치 승인</button></div>':'';
    openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'사고')}</h2><div style="margin-top:7px">${typeof actionBadge==='function'?actionBadge(i):''}</div></div><button class="x" data-close>×</button></div>${summaryHtml(i)}${rejectedInfo}<form id="unifiedCorrectiveForm"><label class="lbl"><span>원인 분석 *</span><textarea id="uRootCause" rows="3" required placeholder="사고 또는 위험요인의 원인을 입력">${esc(c.rootCause||'')}</textarea></label><label class="lbl"><span>후속조치 내용 *</span><textarea id="uActionDetail" rows="4" required placeholder="재발방지 조치, 시설개선, 교육 등 실제 조치내용 입력">${esc(c.actionDetail||'')}</textarea></label><div class="formgrid"><label class="lbl"><span>조치 담당자 *</span><input id="uOwnerName" value="${esc(c.ownerName||u.name||'')}" required></label><label class="lbl"><span>완료 목표일 *</span><input id="uDueDate" type="date" value="${esc(c.dueDate||'')}" required></label></div><label class="lbl"><span>사고조치 상태</span><select id="uActionStatus">${rejectedOption}<option value="planned" ${c.status==='planned'?'selected':''}>조치예정</option><option value="in_progress" ${c.status==='in_progress'?'selected':''}>조치중</option><option value="submitted" ${c.status==='submitted'?'selected':''}>안전관리자 검토요청</option></select></label>${safetyReview}${photoPickerHtml('action')}<button class="primary full" type="submit">사고 조치 저장</button>${reviewButtons}</form>`);
    renderPhotoThumbs('action');bindPhotoButtons();
    const collect=(status)=>{const prev=i.corrective||{},isSafety=role==='safety',now=nowISO(),reviewNote=isSafety?(document.getElementById('uReviewNote')?.value.trim()||''):(prev.reviewNote||''),history=Array.isArray(prev.reviewHistory)?[...prev.reviewHistory]:[];if(isSafety&&['approved','rejected'].includes(status))history.push({action:status,by:u.name,at:now,note:reviewNote});return {...prev,rootCause:document.getElementById('uRootCause').value.trim(),actionDetail:document.getElementById('uActionDetail').value.trim(),ownerName:document.getElementById('uOwnerName').value.trim(),dueDate:document.getElementById('uDueDate').value,status,afterPhotos:persistList(actionPhotos),submittedBy:prev.submittedBy||u.name,submittedById:prev.submittedById||u.id||u.personnelId||'',submittedAt:status==='submitted'?now:(prev.submittedAt||now),reviewNote,reviewedBy:isSafety&&['approved','rejected'].includes(status)?u.name:(prev.reviewedBy||''),reviewedAt:isSafety&&['approved','rejected'].includes(status)?now:(prev.reviewedAt||null),reviewHistory:history};};
    const finish=(status,message)=>{i.corrective=collect(status);i.updatedAt=nowISO();saveData();actionPhotos=[];closeModal();renderShell(u);alert(message)};
    document.getElementById('unifiedCorrectiveForm').onsubmit=e=>{e.preventDefault();const status=document.getElementById('uActionStatus').value;if(status==='rejected')return alert('반려 내용을 수정한 뒤 조치예정, 조치중 또는 검토요청 상태를 선택해 주세요.');finish(status,status==='submitted'?'사고조치를 안전관리자 검토대기로 제출했습니다.':'사고조치가 저장되었습니다.')};
    document.getElementById('approveCorrective411')?.addEventListener('click',()=>{if(!document.getElementById('unifiedCorrectiveForm').reportValidity())return;finish('approved','사고조치가 승인되었습니다. 관리자·경영진이 조회할 수 있습니다.')});
    document.getElementById('rejectCorrective411')?.addEventListener('click',()=>{if(!document.getElementById('unifiedCorrectiveForm').reportValidity())return;const note=document.getElementById('uReviewNote')?.value.trim()||'';if(!note)return alert('사고조치 반려사유를 입력해 주세요.');finish('rejected','사고조치를 반려했습니다. 작성자가 수정 후 다시 검토요청할 수 있습니다.')});
  }

  window.renderUnifiedActions=renderUnifiedActionsFn;
  window.openUnifiedCorrectiveModal=openCorrectiveModal;
  window.enlResetActionFilter=()=>{actionViewFilter={status:'',siteId:'',title:''}};
  window.enlSetActionFilter=filter=>{actionViewFilter={status:filter?.status||'',siteId:filter?.siteId||'',title:filter?.title||''}};
  window.enlOpenActionQueue=(u,filter={})=>{window.enlSetActionFilter(filter);currentView='actions';renderShell(u||currentUser())};
  window.ENL_ACTIONS_VERSION=VERSION;
})();