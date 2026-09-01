/* E&L Accident Report App v4.1.1 - authoritative corrective action flow */
(function(){
  'use strict';
  const VERSION='4.1.1-r11';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isSite=u=>u&&['field','worker'].includes(u.role);
  const siteName=id=>{try{return siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};

  function actionAccessibleIncidents(u){
    let arr=[...(data.incidents||[])];
    if(isSite(u))arr=arr.filter(i=>String(i.siteId)===String(u.siteId));
    if(['manager','executive'].includes(roleNorm(u?.role)))arr=arr.filter(i=>['approved','closed'].includes(i.status));
    return arr.sort(typeof sortIncidents==='function'?sortIncidents:(a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
  }
  function actionCanEdit(i,u){
    if(!i||!u)return false;const role=roleNorm(u.role);
    if(['manager','executive'].includes(role))return false;
    if(isSite(u)&&String(i.siteId)!==String(u.siteId))return false;
    if(i.status==='closed'&&role!=='safety')return false;
    if(i.corrective?.status==='approved'&&role!=='safety')return false;
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
    const c=i.corrective||{},q=quick(i),editable=actionCanEdit(i,u),buttonText=!c.rootCause&&!c.actionDetail?'사고 조치 등록':editable?'사고 조치 수정·확인':'사고 조치 확인';
    return `<article class="action-card"><div>${typeof categoryBadge==='function'?categoryBadge(i.category):''}${typeof statusBadge==='function'?statusBadge(i.status):''}${typeof actionBadge==='function'?actionBadge(i):''}</div><h3>${esc(q.site||siteName(i.siteId))} · ${esc(q.headline||i.eventType||'사고')}</h3>${summaryHtml(i)}<div class="action-grid"><div><b>원인</b><span>${esc(c.rootCause||'미등록')}</span></div><div><b>조치내용</b><span>${esc(c.actionDetail||'미등록')}</span></div><div><b>담당자</b><span>${esc(c.ownerName||'-')}</span></div><div><b>완료기한</b><span>${c.dueDate?`${esc(c.dueDate)} (${dday(c.dueDate)})`:'-'}</span></div></div><button class="secondary" data-unified-action="${esc(i.id)}">${buttonText}</button></article>`;
  }

  function renderUnifiedActionsFn(root,u){
    const base=actionAccessibleIncidents(u),scopeText=isSite(u)?`${esc(siteName(u.siteId))} 사고`:'전체 사업장 사고';
    root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>사고 조치</h2><p>${scopeText}의 사고개요와 후속조치를 한 화면에서 확인합니다.${roleNorm(u.role)==='safety'?' 안전관리자는 조치 검토와 완료 승인도 할 수 있습니다.':''}</p></div></div><div class="toolbar"><div class="left">${isSite(u)?'':`<select id="actionSiteFilter"><option value="">전체 사업장</option>${(data.sites||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`}<select id="actionStateFilter"><option value="">전체 조치상태</option><option value="none">미등록</option><option value="planned">조치예정</option><option value="in_progress">조치중</option><option value="submitted">검토요청</option><option value="approved">조치완료</option></select></div></div><div id="unifiedActionList" class="action-list"></div></div>`;
    const refresh=()=>{let arr=[...base];const sf=document.getElementById('actionSiteFilter')?.value||'',af=document.getElementById('actionStateFilter')?.value||'';if(sf)arr=arr.filter(i=>String(i.siteId)===String(sf));if(af==='none')arr=arr.filter(i=>!i.corrective);else if(af)arr=arr.filter(i=>i.corrective?.status===af);const list=document.getElementById('unifiedActionList');if(!list)return;list.innerHTML=arr.map(i=>actionCard(i,u)).join('')||'<div class="empty">표시할 사고가 없습니다.</div>';list.querySelectorAll('[data-unified-action]').forEach(b=>b.onclick=()=>openCorrectiveModal(b.dataset.unifiedAction,u))};
    ['actionSiteFilter','actionStateFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',refresh));refresh();
  }

  function openCorrectiveModal(id,u){
    const i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return;
    if(isSite(u)&&String(i.siteId)!==String(u.siteId))return alert('소속 사업장의 사고만 조치할 수 있습니다.');
    const c=i.corrective||{},editable=actionCanEdit(i,u);actionPhotos=[...(c.afterPhotos||[])];
    const existingAttachments=attachmentHtml(c.afterPhotos||[]);
    if(!editable){
      openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE DETAIL</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'사고')}</h2></div><button class="x" data-close>×</button></div>${summaryHtml(i)}<section class="inc411-section"><h3>사고 조치 내용</h3><div class="inc411-section-body"><div class="inc411-kv"><b>원인 분석</b><span>${esc(c.rootCause||'-')}</span></div><div class="inc411-kv"><b>후속조치</b><span>${esc(c.actionDetail||'-')}</span></div><div class="inc411-kv"><b>담당/기한</b><span>${esc(c.ownerName||'-')} · ${esc(c.dueDate||'-')}</span></div><div class="inc411-kv"><b>조치상태</b><span>${esc(actionStatusName(c.status))}</span></div><div class="inc411-kv"><b>검토의견</b><span>${esc(c.reviewNote||'-')}</span></div></div></section>${existingAttachments?`<section class="inc411-section"><h3>조치 사진 · PDF</h3><div class="inc411-section-body">${existingAttachments}</div></section>`:''}`);bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[]);return;
    }
    openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'사고')}</h2></div><button class="x" data-close>×</button></div>${summaryHtml(i)}<form id="unifiedCorrectiveForm"><label class="lbl"><span>원인 분석 *</span><textarea id="uRootCause" rows="3" required placeholder="사고 또는 위험요인의 원인을 입력">${esc(c.rootCause||'')}</textarea></label><label class="lbl"><span>후속조치 내용 *</span><textarea id="uActionDetail" rows="4" required placeholder="재발방지 조치, 시설개선, 교육 등 실제 조치내용 입력">${esc(c.actionDetail||'')}</textarea></label><div class="formgrid"><label class="lbl"><span>조치 담당자 *</span><input id="uOwnerName" value="${esc(c.ownerName||u.name||'')}" required></label><label class="lbl"><span>완료 목표일 *</span><input id="uDueDate" type="date" value="${esc(c.dueDate||'')}" required></label></div><label class="lbl"><span>현재 상태</span><select id="uActionStatus"><option value="planned" ${c.status==='planned'?'selected':''}>조치예정</option><option value="in_progress" ${c.status==='in_progress'?'selected':''}>조치중</option><option value="submitted" ${c.status==='submitted'?'selected':''}>안전관리자 검토요청</option>${roleNorm(u.role)==='safety'?`<option value="approved" ${c.status==='approved'?'selected':''}>조치완료 승인</option>`:''}</select></label>${roleNorm(u.role)==='safety'?`<label class="lbl"><span>안전관리자 검토의견</span><textarea id="uReviewNote" rows="3">${esc(c.reviewNote||'')}</textarea></label>`:(c.reviewNote?`<div class="law-box"><b>안전관리자 검토의견</b><br>${esc(c.reviewNote)}</div>`:'')}${photoPickerHtml('action')}<button class="primary full" type="submit">사고 조치 저장</button></form>`);
    renderPhotoThumbs('action');bindPhotoButtons();
    document.getElementById('unifiedCorrectiveForm').onsubmit=e=>{e.preventDefault();const status=document.getElementById('uActionStatus').value,isSafety=roleNorm(u.role)==='safety',prev=i.corrective||{};i.corrective={...prev,rootCause:document.getElementById('uRootCause').value.trim(),actionDetail:document.getElementById('uActionDetail').value.trim(),ownerName:document.getElementById('uOwnerName').value.trim(),dueDate:document.getElementById('uDueDate').value,status,afterPhotos:persistList(actionPhotos),submittedBy:u.name,submittedById:u.id||u.personnelId||'',submittedAt:nowISO(),reviewNote:isSafety?document.getElementById('uReviewNote').value.trim():(prev.reviewNote||''),reviewedBy:isSafety&&status==='approved'?u.name:(prev.reviewedBy||''),reviewedAt:isSafety&&status==='approved'?nowISO():(prev.reviewedAt||null)};i.updatedAt=nowISO();saveData();actionPhotos=[];closeModal();renderShell(u);alert(status==='approved'?'사고 조치가 완료 승인되었습니다.':'사고 조치가 저장되었습니다.')};
  }

  window.renderUnifiedActions=renderUnifiedActionsFn;
  window.openUnifiedCorrectiveModal=openCorrectiveModal;
  window.ENL_ACTIONS_VERSION=VERSION;
})();