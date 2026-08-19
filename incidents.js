function renderFieldActions(root,u){
  const arr=fieldIncidents(u).filter(i=>i.status!=='closed'||i.corrective?.status!=='approved');
  root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">개선조치</div><h2>사고 조치하기</h2><p>보고된 사고의 원인과 재발방지 조치를 현장에서 등록하고 안전관리자 검토를 받습니다.</p></div></div><div class="action-list">${arr.map(fieldActionCard).join('')||'<div class="empty">현재 조치할 사고가 없습니다.</div>'}</div></div>`;
  root.querySelectorAll('[data-action-id]').forEach(b=>b.onclick=()=>openCorrectiveModal(b.dataset.actionId,u));
}
function fieldActionCard(i){const s=siteById(i.siteId);return `<div class="action-card"><div>${priorityBadge(i.priority)}${categoryBadge(i.category)}${statusBadge(i.status)}</div><h3>${esc(s?.name||'-')} · ${esc(i.eventType)}</h3><p>${esc(i.summary)}</p><div class="action-grid"><div><b>발생일</b><span>${fmt(i.occurredAt)}</span></div><div><b>조치상태</b><span>${actionStatusName(i.corrective?.status)}</span></div><div><b>담당자</b><span>${esc(i.corrective?.ownerName||'-')}</span></div><div><b>완료기한</b><span>${i.corrective?.dueDate?`${esc(i.corrective.dueDate)} (${dday(i.corrective.dueDate)})`:'-'}</span></div></div><button class="secondary" data-action-id="${i.id}">${i.corrective?'조치내용 수정/확인':'개선조치 등록'}</button></div>`}
function openCorrectiveModal(id,u){
  const i=data.incidents.find(x=>x.id===id);if(!i||i.siteId!==u.siteId)return;const c=i.corrective||{};actionPhotos=[...(c.afterPhotos||[])];
  openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.eventType)}</h2></div><button class="x" data-close>×</button></div>
    <div class="warn-box">사고내용: ${esc(i.summary)}</div>
    <form id="correctiveForm">
      <label class="lbl"><span>원인 분석 *</span><textarea id="rootCause" rows="3" required>${esc(c.rootCause||'')}</textarea></label>
      <label class="lbl"><span>개선조치 내용 *</span><textarea id="actionDetail" rows="4" required>${esc(c.actionDetail||'')}</textarea></label>
      <div class="formgrid"><label class="lbl"><span>조치 담당자 *</span><input id="ownerName" value="${esc(c.ownerName||u.name)}" required></label><label class="lbl"><span>완료 목표일 *</span><input id="dueDate" type="date" value="${esc(c.dueDate||'')}" required></label></div>
      <label class="lbl"><span>현재 상태</span><select id="actionStatus"><option value="planned" ${c.status==='planned'?'selected':''}>조치예정</option><option value="in_progress" ${c.status==='in_progress'?'selected':''}>조치중</option><option value="submitted" ${c.status==='submitted'?'selected':''}>안전관리자 검토요청</option></select></label>
      ${photoPickerHtml('action')}
      ${c.reviewNote?`<div class="law-box"><b>안전관리자 검토의견</b><br>${esc(c.reviewNote)}</div>`:''}
      <button class="primary full" type="submit">개선조치 저장</button>
    </form>`);
  renderPhotoThumbs('action');bindPhotoButtons();
  document.getElementById('correctiveForm').onsubmit=e=>{e.preventDefault();i.corrective={...(i.corrective||{}),rootCause:document.getElementById('rootCause').value.trim(),actionDetail:document.getElementById('actionDetail').value.trim(),ownerName:document.getElementById('ownerName').value.trim(),dueDate:document.getElementById('dueDate').value,status:document.getElementById('actionStatus').value,afterPhotos:[...actionPhotos],submittedBy:u.name,submittedAt:nowISO(),reviewNote:i.corrective?.reviewNote||'',reviewedBy:i.corrective?.reviewedBy||'',reviewedAt:i.corrective?.reviewedAt||null};i.updatedAt=nowISO();saveData();closeModal();renderShell(u);alert('개선조치가 저장되었습니다.')};
}

function renderFieldHistory(root,u){
  const arr=fieldIncidents(u);
  root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE HISTORY</div><h2>우리 사업장 누적기록</h2><p>${esc(siteById(u.siteId)?.name||'-')}의 사고만 표시됩니다.</p></div></div>${incidentTable(arr,false)}</div>`;
  bindIncidentRows(false,u);
}

function renderDashboard(root,u){
  const arr=[...data.incidents];const urgent=arr.filter(i=>i.priority==='urgent').length,wait=arr.filter(i=>i.status==='reported').length,actionWait=arr.filter(i=>i.corrective?.status==='submitted').length,legal=arr.filter(i=>i.legalReview&&i.status!=='closed').length;
  root.innerHTML=`<div class="cards"><div class="card"><span>전체 사고</span><b>${arr.length}</b></div><div class="card urgent"><span>긴급 관리</span><b>${urgent}</b></div><div class="card important"><span>승인 대기</span><b>${wait}</b></div><div class="card action"><span>조치 검토요청</span><b>${actionWait}</b></div></div>
    ${legal?`<div class="warn-box" style="margin-bottom:12px"><b>법적 검토 알림 ${legal}건</b><br>3일 이상 휴업 예상 또는 중상 가능 등으로 입력된 건입니다. 실제 법정 보고대상 여부는 안전관리자가 사실관계를 확인해 판단하세요.</div>`:''}
    <div class="grid2"><div class="panel"><div class="section-head"><div><div class="ey">PRIORITY</div><h2>우선 검토 사고</h2><p>긴급 → 중요 → 최신순으로 표시합니다.</p></div></div>${incidentTable(arr.sort(sortIncidents).slice(0,10),true)}</div>
    <aside class="panel"><h2 style="font-size:17px">사고 구분</h2><div class="summary-card"><div class="summary-top"><b>대인사고</b><span>${arr.filter(i=>i.category==='person').length}건</span></div></div><div class="summary-card"><div class="summary-top"><b>대물사고</b><span>${arr.filter(i=>i.category==='property').length}건</span></div></div><div class="summary-card"><div class="summary-top"><b>아차사고</b><span>${arr.filter(i=>i.category==='near_miss').length}건</span></div></div></aside></div>`;
  bindIncidentRows(true,u);
}
function sortIncidents(a,b){const p={urgent:3,important:2,normal:1};return (p[b.priority]-p[a.priority])||(new Date(b.occurredAt)-new Date(a.occurredAt))}

function renderAllIncidents(root,u){
  root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">ALL INCIDENTS</div><h2>전체 사고관리</h2><p>안전관리자는 모든 사고를 조회·수정·승인·삭제할 수 있습니다.</p></div></div><div class="toolbar"><div class="left"><select id="siteFilter"><option value="">전체 사업장</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="statusFilter"><option value="">전체 상태</option><option value="reported">검토대기</option><option value="approved">승인</option><option value="closed">종결</option></select><select id="priorityFilter"><option value="">전체 등급</option><option value="urgent">긴급</option><option value="important">중요</option><option value="normal">일반</option></select></div></div><div id="allTable"></div></div>`;
  const refresh=()=>{let arr=[...data.incidents];const sf=document.getElementById('siteFilter').value,st=document.getElementById('statusFilter').value,pf=document.getElementById('priorityFilter').value;if(sf)arr=arr.filter(i=>i.siteId===sf);if(st)arr=arr.filter(i=>i.status===st);if(pf)arr=arr.filter(i=>i.priority===pf);document.getElementById('allTable').innerHTML=incidentTable(arr.sort(sortIncidents),true);bindIncidentRows(true,u)};
  ['siteFilter','statusFilter','priorityFilter'].forEach(id=>document.getElementById(id).onchange=refresh);refresh();
}
function incidentTable(arr,admin){
  if(!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>발생일</th><th>사업장</th><th>구분</th><th>사고유형</th><th>관리등급</th><th>상태</th><th>개선조치</th><th>내용</th></tr></thead><tbody>${arr.map(i=>`<tr data-inc-id="${i.id}"><td>${fmt(i.occurredAt)}</td><td><b>${esc(siteById(i.siteId)?.name||'-')}</b></td><td>${categoryBadge(i.category)}</td><td>${esc(i.eventType)}</td><td>${priorityBadge(i.priority)}${legalBadge(i)}</td><td>${statusBadge(i.status)}</td><td>${actionBadge(i)}</td><td>${esc(i.summary).slice(0,50)}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindIncidentRows(admin,u){document.querySelectorAll('[data-inc-id]').forEach(r=>r.onclick=()=>openIncidentModal(r.dataset.incId,admin,u))}

function openIncidentModal(id,admin,u){
  const i=data.incidents.find(x=>x.id===id);if(!i)return;if(u.role==='field'&&i.siteId!==u.siteId)return;if(u.role==='final'&&!['approved','closed'].includes(i.status))return;
  const editable=admin&&u.role==='safety';
  openModal(`<div class="modal-head"><div><div class="ey">INCIDENT DETAIL</div><h2>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.eventType)}</h2><div style="margin-top:7px">${priorityBadge(i.priority)}${categoryBadge(i.category)}${statusBadge(i.status)}${legalBadge(i)}</div></div><button class="x" data-close>×</button></div>
    ${i.photos?.length?`<div class="thumbs" style="margin:14px 0">${i.photos.map(p=>`<div class="thumb"><img src="${p}"></div>`).join('')}</div>`:''}
    <div class="detail">
      <div class="detail-row"><b>발생일시</b><span>${fmt(i.occurredAt)}</span></div>
      <div class="detail-row"><b>사고자</b><span>${esc(i.injuredName||'-')} ${i.job?'· '+esc(i.job):''}</span></div>
      <div class="detail-row"><b>사고내용</b><span>${esc(i.summary)}</span></div>
      <div class="detail-row"><b>즉시조치</b><span>${esc(i.immediateAction)}</span></div>
      <div class="detail-row"><b>보고자</b><span>${esc(i.reporterName||'-')}</span></div>
      <div class="detail-row"><b>안전관리자 의견</b><span>${esc(i.safetyNote||'-')}</span></div>
      <div class="detail-row"><b>개선조치</b><div>${i.corrective?`${actionBadge(i)}<br><b style="font-size:9px">원인:</b> ${esc(i.corrective.rootCause||'-')}<br><b style="font-size:9px">조치:</b> ${esc(i.corrective.actionDetail||'-')}<br><b style="font-size:9px">담당:</b> ${esc(i.corrective.ownerName||'-')} / ${esc(i.corrective.dueDate||'-')}`:'미등록'}</div></div>
    </div>
    ${i.legalReview?`<div class="law-box"><b>법적 확인 알림</b><br>입력정보상 산업재해조사표 등 법정 보고 여부 검토가 필요한 건으로 표시되었습니다. 자동판정은 법적 확정이 아닙니다.</div>`:''}
    ${editable?`<label class="lbl"><span>안전관리자 검토의견</span><textarea id="safetyNoteEdit" rows="3">${esc(i.safetyNote||'')}</textarea></label><div class="modal-actions"><button class="btn-gray" id="saveNote">검토의견 저장</button>${i.status==='reported'?'<button class="btn-blue" id="approveInc">사고 승인</button>':''}${i.status!=='closed'?'<button class="btn-green" id="closeInc">종결</button>':''}<button class="btn-red" id="editInc">사고정보 수정</button><button class="btn-red" id="deleteInc">삭제</button></div>`:''}`);
  if(editable){document.getElementById('saveNote').onclick=()=>{i.safetyNote=document.getElementById('safetyNoteEdit').value.trim();i.updatedAt=nowISO();saveData();closeModal();renderShell(u)};const ap=document.getElementById('approveInc');if(ap)ap.onclick=()=>{i.safetyNote=document.getElementById('safetyNoteEdit').value.trim();i.status='approved';i.approvedBy=u.name;i.approvedAt=nowISO();i.updatedAt=nowISO();saveData();closeModal();renderShell(u)};const cl=document.getElementById('closeInc');if(cl)cl.onclick=()=>{if(i.corrective&&i.corrective.status!=='approved'&&!confirm('개선조치가 아직 안전관리자 승인 완료가 아닙니다. 그래도 종결할까요?'))return;i.status='closed';i.closedAt=nowISO();i.updatedAt=nowISO();saveData();closeModal();renderShell(u)};document.getElementById('deleteInc').onclick=()=>{if(confirm('이 사고 기록을 삭제할까요? 삭제 후 되돌리기 어렵습니다.')){data.incidents=data.incidents.filter(x=>x.id!==i.id);saveData();closeModal();renderShell(u)}};document.getElementById('editInc').onclick=()=>openEditIncidentModal(i,u)}
}
function openEditIncidentModal(i,u){
  openModal(`<div class="modal-head"><h2>사고정보 수정</h2><button class="x" data-close>×</button></div><form id="editIncidentForm"><div class="formgrid"><label class="lbl"><span>사업장</span><select id="eSite">${data.sites.map(s=>`<option value="${s.id}" ${s.id===i.siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label class="lbl"><span>사고 구분</span><select id="eCategory"><option value="person" ${i.category==='person'?'selected':''}>대인사고</option><option value="property" ${i.category==='property'?'selected':''}>대물사고</option><option value="near_miss" ${i.category==='near_miss'?'selected':''}>아차사고</option></select></label><label class="lbl"><span>사고 유형</span><select id="eType">${eventTypeOptions(i.eventType)}</select></label><label class="lbl"><span>사고 정도</span><select id="eSeverity"><option value="minor" ${i.severity==='minor'?'selected':''}>경미</option><option value="moderate" ${i.severity==='moderate'?'selected':''}>보통</option><option value="major" ${i.severity==='major'?'selected':''}>중대</option></select></label><label class="lbl"><span>치료/휴업 예상</span><select id="eLeave"><option value="unknown" ${i.leaveEstimate==='unknown'?'selected':''}>미확인</option><option value="none" ${i.leaveEstimate==='none'?'selected':''}>휴업 없음</option><option value="under3" ${i.leaveEstimate==='under3'?'selected':''}>3일 미만 예상</option><option value="3plus" ${i.leaveEstimate==='3plus'?'selected':''}>3일 이상 예상</option><option value="longterm" ${i.leaveEstimate==='longterm'?'selected':''}>장기치료/중상 가능</option></select></label><label class="lbl"><span>사고자</span><input id="eInj" value="${esc(i.injuredName||'')}"></label></div><label class="lbl"><span>사고내용</span><textarea id="eSummary" rows="4">${esc(i.summary)}</textarea></label><label class="lbl"><span>즉시조치</span><textarea id="eImmediate" rows="3">${esc(i.immediateAction)}</textarea></label><label class="lbl"><span><input id="ePotential" type="checkbox" style="width:auto" ${i.potentialMajor?'checked':''}> 잠재 중대위험</span></label><button class="primary full">수정 저장</button></form>`);
  document.getElementById('editIncidentForm').onsubmit=e=>{e.preventDefault();i.siteId=document.getElementById('eSite').value;i.category=document.getElementById('eCategory').value;i.eventType=document.getElementById('eType').value;i.severity=document.getElementById('eSeverity').value;i.leaveEstimate=document.getElementById('eLeave').value;i.injuredName=document.getElementById('eInj').value.trim();i.summary=document.getElementById('eSummary').value.trim();i.immediateAction=document.getElementById('eImmediate').value.trim();i.potentialMajor=document.getElementById('ePotential').checked;i.priority=computePriority(i.category,i.severity,i.eventType,i.potentialMajor,i.leaveEstimate);i.legalReview=computeLegalReview(i.category,i.severity,i.leaveEstimate);i.updatedAt=nowISO();saveData();closeModal();renderShell(u)};
}

