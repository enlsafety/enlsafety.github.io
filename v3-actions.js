/* E&L 사고보고 v3.0.5 - 후속조치 공통 권한/작성 기능 */

const ENL_BASE_PERMISSION_FOR = permissionFor;
permissionFor = function(u){
  const p = ENL_BASE_PERMISSION_FOR(u);
  return {
    ...p,
    writeAction:true,
    actionScope:u.role==='field'?(siteById(u.siteId)?.name||'소속 사업장'):'전체 사업장'
  };
};

function actionAccessibleIncidents(u){
  let arr=[...data.incidents];
  if(u.role==='field') arr=arr.filter(i=>i.siteId===u.siteId);
  return arr.sort(sortIncidents);
}

function actionCanEdit(i,u){
  if(!i||!u) return false;
  if(u.role==='field'&&i.siteId!==u.siteId) return false;
  if(i.status==='closed'&&u.role!=='safety') return false;
  if(i.corrective?.status==='approved'&&u.role!=='safety') return false;
  return true;
}

function actionCardUnified(i,u){
  const c=i.corrective||{};
  const editable=actionCanEdit(i,u);
  const buttonText=!c.rootCause&&!c.actionDetail?'후속조치 등록':editable?'후속조치 수정/확인':'후속조치 확인';
  return `<div class="action-card">
    <div>${categoryBadge(i.category)}${statusBadge(i.status)}${actionBadge(i)}</div>
    <h3>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.eventType)}</h3>
    <p>${esc(i.summary)}</p>
    <div class="action-grid">
      <div><b>원인</b><span>${esc(c.rootCause||'-')}</span></div>
      <div><b>조치내용</b><span>${esc(c.actionDetail||'-')}</span></div>
      <div><b>담당자</b><span>${esc(c.ownerName||'-')}</span></div>
      <div><b>완료기한</b><span>${c.dueDate?`${esc(c.dueDate)} (${dday(c.dueDate)})`:'-'}</span></div>
    </div>
    <button class="secondary" data-unified-action="${i.id}">${buttonText}</button>
  </div>`;
}

renderUnifiedActions = function(root,u){
  const base=actionAccessibleIncidents(u);
  const scopeText=u.role==='field'?`${esc(siteById(u.siteId)?.name||'소속 사업장')}만`:'전체 사업장';
  root.innerHTML=`<div class="panel">
    <div class="section-head"><div><div class="ey">FOLLOW-UP</div><h2>후속조치</h2><p>${scopeText} 조회하고 후속조치 내용을 등록할 수 있습니다.${u.role==='safety'?' 안전관리자는 조치 검토와 완료 승인도 할 수 있습니다.':''}</p></div></div>
    <div class="toolbar"><div class="left">
      ${u.role==='field'?'':`<select id="actionSiteFilter"><option value="">전체 사업장</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`}
      <select id="actionStateFilter"><option value="">전체 조치상태</option><option value="none">미등록</option><option value="planned">조치예정</option><option value="in_progress">조치중</option><option value="submitted">검토요청</option><option value="approved">조치완료</option></select>
    </div></div>
    <div id="unifiedActionList" class="action-list"></div>
  </div>`;

  const refresh=()=>{
    let arr=[...base];
    const sf=document.getElementById('actionSiteFilter')?.value||'';
    const af=document.getElementById('actionStateFilter')?.value||'';
    if(sf) arr=arr.filter(i=>i.siteId===sf);
    if(af==='none') arr=arr.filter(i=>!i.corrective);
    else if(af) arr=arr.filter(i=>i.corrective?.status===af);
    const list=document.getElementById('unifiedActionList');
    list.innerHTML=arr.map(i=>actionCardUnified(i,u)).join('')||'<div class="empty">표시할 사고가 없습니다.</div>';
    list.querySelectorAll('[data-unified-action]').forEach(b=>b.onclick=()=>openUnifiedCorrectiveModal(b.dataset.unifiedAction,u));
  };
  ['actionSiteFilter','actionStateFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=refresh});
  refresh();
};

function openUnifiedCorrectiveModal(id,u){
  const i=data.incidents.find(x=>x.id===id);
  if(!i) return;
  if(u.role==='field'&&i.siteId!==u.siteId) return alert('소속 사업장의 사고만 후속조치할 수 있습니다.');
  const c=i.corrective||{};
  const editable=actionCanEdit(i,u);
  actionPhotos=[...(c.afterPhotos||[])];

  if(!editable){
    openModal(`<div class="modal-head"><div><div class="ey">FOLLOW-UP DETAIL</div><h2>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.eventType)}</h2></div><button class="x" data-close>×</button></div>
      <div class="detail">
        <div class="detail-row"><b>사고내용</b><span>${esc(i.summary)}</span></div>
        <div class="detail-row"><b>원인 분석</b><span>${esc(c.rootCause||'-')}</span></div>
        <div class="detail-row"><b>후속조치</b><span>${esc(c.actionDetail||'-')}</span></div>
        <div class="detail-row"><b>담당자</b><span>${esc(c.ownerName||'-')}</span></div>
        <div class="detail-row"><b>완료기한</b><span>${esc(c.dueDate||'-')}</span></div>
        <div class="detail-row"><b>조치상태</b><span>${actionStatusName(c.status)}</span></div>
        <div class="detail-row"><b>검토의견</b><span>${esc(c.reviewNote||'-')}</span></div>
      </div>
      ${c.afterPhotos?.length?`<div class="thumbs" style="margin-top:12px">${c.afterPhotos.map(p=>`<div class="thumb"><img src="${p}"></div>`).join('')}</div>`:''}`);
    return;
  }

  openModal(`<div class="modal-head"><div><div class="ey">FOLLOW-UP ACTION</div><h2>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.eventType)}</h2><p style="margin:4px 0 0;color:#768395;font-size:10px">${u.role==='field'?'소속 사업장 후속조치':'전체 사업장 후속조치'}</p></div><button class="x" data-close>×</button></div>
    <div class="warn-box">사고내용: ${esc(i.summary)}</div>
    <form id="unifiedCorrectiveForm">
      <label class="lbl"><span>원인 분석 *</span><textarea id="uRootCause" rows="3" required placeholder="사고 또는 위험요인의 원인을 간단히 입력">${esc(c.rootCause||'')}</textarea></label>
      <label class="lbl"><span>후속조치 내용 *</span><textarea id="uActionDetail" rows="4" required placeholder="재발방지 조치, 시설개선, 교육 등 실제 조치내용 입력">${esc(c.actionDetail||'')}</textarea></label>
      <div class="formgrid">
        <label class="lbl"><span>조치 담당자 *</span><input id="uOwnerName" value="${esc(c.ownerName||u.name)}" required></label>
        <label class="lbl"><span>완료 목표일 *</span><input id="uDueDate" type="date" value="${esc(c.dueDate||'')}" required></label>
      </div>
      <label class="lbl"><span>현재 상태</span><select id="uActionStatus">
        <option value="planned" ${c.status==='planned'?'selected':''}>조치예정</option>
        <option value="in_progress" ${c.status==='in_progress'?'selected':''}>조치중</option>
        <option value="submitted" ${c.status==='submitted'?'selected':''}>안전관리자 검토요청</option>
        ${u.role==='safety'?`<option value="approved" ${c.status==='approved'?'selected':''}>조치완료 승인</option>`:''}
      </select></label>
      ${u.role==='safety'?`<label class="lbl"><span>안전관리자 검토의견</span><textarea id="uReviewNote" rows="3" placeholder="검토내용 또는 보완요청">${esc(c.reviewNote||'')}</textarea></label>`:(c.reviewNote?`<div class="law-box"><b>안전관리자 검토의견</b><br>${esc(c.reviewNote)}</div>`:'')}
      ${photoPickerHtml('action')}
      <button class="primary full" type="submit">후속조치 저장</button>
    </form>`);
  renderPhotoThumbs('action');bindPhotoButtons();

  document.getElementById('unifiedCorrectiveForm').onsubmit=e=>{
    e.preventDefault();
    const status=document.getElementById('uActionStatus').value;
    const isSafety=u.role==='safety';
    const prev=i.corrective||{};
    i.corrective={
      ...prev,
      rootCause:document.getElementById('uRootCause').value.trim(),
      actionDetail:document.getElementById('uActionDetail').value.trim(),
      ownerName:document.getElementById('uOwnerName').value.trim(),
      dueDate:document.getElementById('uDueDate').value,
      status,
      afterPhotos:[...actionPhotos],
      submittedBy:u.name,
      submittedById:u.id,
      submittedAt:nowISO(),
      reviewNote:isSafety?document.getElementById('uReviewNote').value.trim():(prev.reviewNote||''),
      reviewedBy:isSafety&&status==='approved'?u.name:(prev.reviewedBy||''),
      reviewedAt:isSafety&&status==='approved'?nowISO():(prev.reviewedAt||null)
    };
    i.updatedAt=nowISO();
    saveData();actionPhotos=[];closeModal();renderShell(u);
    alert(status==='approved'?'후속조치가 완료 승인되었습니다.':'후속조치가 저장되었습니다.');
  };
}

/* 공통 상단 권한문구도 후속조치 작성권한을 반영 */
const ENL_ACTION_BASE_RENDER_SHELL = renderShell;
renderShell = function(u){
  ENL_ACTION_BASE_RENDER_SHELL(u);
  const strip=document.querySelector('.permission-strip');
  if(strip&&u.role==='final'){
    const spans=strip.querySelectorAll('span');
    if(spans[0]) spans[0].textContent='조회범위: 사고목록은 승인/완료 · 후속조치는 전체 사업장';
    if(spans[1]) spans[1].textContent='후속조치 작성 가능';
  }
};
