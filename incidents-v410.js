/* E&L Accident Report App v4.1.1 - authoritative incident list/review runtime */
(function(){
  'use strict';
  const VERSION='4.1.1-r9';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const position=u=>String(u?.position||u?.jobTitle||'').trim();
  const isSiteUser=u=>!!u&&['field','worker'].includes(u.role);
  const isManager=u=>isSiteUser(u)&&MANAGER_POSITIONS.includes(position(u));
  const sameSite=(i,u)=>!!i&&!!u&&String(i.siteId||'')===String(u.siteId||'');
  const userId=u=>String(u?.personnelId||u?.id||'');
  const isAuthor=(i,u)=>{const rid=String(i?.reporterId||'');if(rid&&userId(u))return rid===userId(u);return !!i&&!rid&&norm(i.reporterName)===norm(u?.name)};
  const siteName=id=>{try{return siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const statusLabel=v=>v==='reported'?'검토대기':v==='rejected'?'반려':v==='approved'?'승인':v==='closed'?'종결':String(v||'진행중');
  const statusBadgeHtml=v=>typeof badge==='function'?badge(v==='reported'?'p-reported':v==='rejected'?'p-rejected':v==='approved'?'p-approved':v==='closed'?'p-closed':'p-normal',statusLabel(v)):`<span>${statusLabel(v)}</span>`;
  const sortIncidentList=(a,b)=>{const p={urgent:3,important:2,normal:1};return (p[b?.priority]||0)-(p[a?.priority]||0)||(new Date(b?.occurredAt||0)-new Date(a?.occurredAt||0))};

  function canEditIncident(i,u){if(!i||!u)return false;if(u.role==='safety')return true;if(!sameSite(i,u)||!['reported','rejected'].includes(i.status))return false;if(isManager(u))return true;return u.role==='worker'&&isAuthor(i,u)}
  function canViewOriginal(i,u){if(!i||!u)return false;if(u.role==='safety')return true;if(u.role==='final')return ['approved','closed'].includes(i.status);return sameSite(i,u)&&isManager(u)}

  function ensureCss(){
    if(document.getElementById('incident410Css'))return;
    const s=document.createElement('style');s.id='incident410Css';s.textContent=`.p-rejected{background:#fff0f0!important;color:#a02f2f!important;border:1px solid #efb7b7!important}.incident-private-list{display:grid;gap:10px}.incident-private-card{border:2px solid #d7e2ec;border-radius:14px;background:#fff;padding:14px}.incident-private-card.rejected{border-color:#e2abab;background:#fffafa}.incident-private-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.incident-private-card h3{margin:9px 0 5px;color:#173b66;font-size:17px}.incident-private-meta{display:flex;gap:8px;flex-wrap:wrap;color:#66798b;font-size:12px;font-weight:750}.incident-private-note,.reject-note{margin-top:9px;padding:10px 11px;border:1px solid #e9bcbc;border-radius:10px;background:#fff1f1;color:#893737;font-size:13px;line-height:1.5}.incident-private-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.incident-private-actions button{min-height:42px;border:0;border-radius:9px;background:#1e5d91;color:#fff;padding:0 14px;font-weight:900}.incident-private-lock{margin-top:9px;color:#788a99;font-size:12px}.btn-reject{background:#b13c3c!important;color:#fff!important}@media(max-width:620px){.incident-private-card{padding:12px}.incident-private-actions button{width:100%}}`;
    document.head.appendChild(s);
  }
  ensureCss();

  function originalTable(arr,u){
    if(!Array.isArray(arr)||!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';
    return `<div class="table-wrap"><table class="tbl"><thead><tr><th>발생일</th><th>사업장</th><th>구분</th><th>사고유형</th><th>관리등급</th><th>상태</th><th>개선조치</th><th>내용</th></tr></thead><tbody>${arr.map(i=>`<tr data-inc-id="${esc(i.id)}" style="cursor:pointer"><td>${fmt(i.occurredAt)}</td><td><b>${esc(siteName(i.siteId))}</b></td><td>${typeof categoryBadge==='function'?categoryBadge(i.category):esc(i.category||'-')}</td><td>${esc(i.eventType||'-')}</td><td>${typeof priorityBadge==='function'?priorityBadge(i.priority):esc(i.priority||'-')}${typeof legalBadge==='function'?legalBadge(i):''}</td><td>${statusBadgeHtml(i.status)}</td><td>${typeof actionBadge==='function'?actionBadge(i):'-'}</td><td>${esc(i.summary||'').slice(0,50)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function incidentTableFn(arr,admin,u){return originalTable(arr,u||currentUser())}
  function bindIncidentRowsFn(admin,u){const viewer=u||currentUser();document.querySelectorAll('[data-inc-id]').forEach(r=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(r.dataset.incId));if(i&&canViewOriginal(i,viewer)){r.onclick=()=>openIncidentModalFn(i.id,admin,viewer);r.style.cursor='pointer'}else{r.onclick=null;r.style.cursor='default'}})}

  function siteRecords(u){return [...(data.incidents||[])].filter(i=>sameSite(i,u)).sort(sortIncidentList)}
  function visibleFieldRecords(u){const arr=siteRecords(u);return isManager(u)?arr:arr.filter(i=>isAuthor(i,u))}
  function privateCards(arr,u){if(!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';return `<div class="incident-private-list">${arr.map(i=>{const editable=canEditIncident(i,u),rejected=i.status==='rejected';return `<article class="incident-private-card ${rejected?'rejected':''}"><div class="incident-private-top"><div>${typeof categoryBadge==='function'?categoryBadge(i.category):''}${statusBadgeHtml(i.status)}</div><b>${fmt(i.occurredAt)}</b></div><h3>${esc(i.eventType||'사고 보고')}</h3><div class="incident-private-meta"><span>보고자 ${esc(i.reporterName||'-')}</span><span>${esc(siteName(i.siteId))}</span></div>${rejected&&i.rejectionNote?`<div class="incident-private-note"><b>반려사유</b><br>${esc(i.rejectionNote)}</div>`:''}${editable?`<div class="incident-private-actions"><button type="button" data-rejected-edit="${esc(i.id)}">${i.status==='reported'?'보고 회수 후 수정':'반려 내용 수정 후 재제출'}</button></div>`:''}</article>`}).join('')}</div>`}
  function bindRejectedEdits(root,u){root.querySelectorAll('[data-rejected-edit]').forEach(b=>b.onclick=()=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(b.dataset.rejectedEdit));if(i&&canEditIncident(i,u))openEditIncidentModalFn(i,u)})}

  function renderUnifiedIncidentsFn(root,u){
    const viewer=u||currentUser();if(!root||!viewer)return;
    if(isSiteUser(viewer)){
      const arr=visibleFieldRecords(viewer);
      if(isManager(viewer)){root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE RECORDS</div><h2>사고 기록</h2><p>${esc(siteName(viewer.siteId))}의 전체 사고보고서를 조회합니다.</p></div></div>${originalTable(arr,viewer)}</div>`;bindIncidentRowsFn(false,viewer);return}
      root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE RECORDS</div><h2>내 사고 보고 기록</h2><p>내가 작성한 보고의 처리상태를 확인합니다.</p></div></div>${privateCards(arr,viewer)}</div>`;bindRejectedEdits(root,viewer);return;
    }
    if(viewer.role==='final'){
      const arr=[...(data.incidents||[])].filter(i=>['approved','closed'].includes(i.status)).sort(sortIncidentList);root.innerHTML=`<div class="panel"><div class="section-head"><div><h2>승인 사고 조회</h2><p>안전관리자가 승인한 사고만 표시됩니다.</p></div></div>${originalTable(arr,viewer)}</div>`;bindIncidentRowsFn(false,viewer);return;
    }
    const base=[...(data.incidents||[])].sort(sortIncidentList);
    root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">ALL INCIDENTS</div><h2>전체 사고관리</h2><p>안전관리자는 모든 사고를 검토·승인·반려할 수 있습니다.</p></div></div><div class="toolbar"><div class="left"><select id="siteFilter"><option value="">전체 사업장</option>${(data.sites||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><select id="statusFilter"><option value="">전체 상태</option><option value="reported">검토대기</option><option value="rejected">반려</option><option value="approved">승인</option><option value="closed">종결</option></select><select id="categoryFilter"><option value="">전체 구분</option><option value="person">대인사고</option><option value="property">대물사고</option></select></div></div><div id="unifiedIncidentTable"></div></div>`;
    const refresh=()=>{let arr=[...base];const sf=document.getElementById('siteFilter')?.value||'',st=document.getElementById('statusFilter')?.value||'',cf=document.getElementById('categoryFilter')?.value||'';if(sf)arr=arr.filter(i=>String(i.siteId)===String(sf));if(st)arr=arr.filter(i=>i.status===st);if(cf)arr=arr.filter(i=>i.category===cf);const box=document.getElementById('unifiedIncidentTable');if(box)box.innerHTML=originalTable(arr,viewer);bindIncidentRowsFn(true,viewer)};
    ['siteFilter','statusFilter','categoryFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',refresh));refresh();
  }

  function openIncidentModalFn(id,admin,u){
    const viewer=u||currentUser(),i=(data.incidents||[]).find(x=>String(x.id)===String(id));
    if(!i)return alert('해당 사고자료를 찾지 못했습니다. 최신 사고현황을 다시 불러와 주세요.');
    if(!canViewOriginal(i,viewer))return alert('사고보고서 원본 조회 권한이 없습니다.');
    if(typeof openModal!=='function')return alert('사고 검토 화면을 불러오지 못했습니다.');
    const safety=viewer?.role==='safety',d=i.reportDetails||{};
    const detailBlock=i.category==='person'?`<div class="detail-row"><b>부상내용</b><span>${esc(d.injuryDetail||'-')}</span></div><div class="detail-row"><b>진단명</b><span>${esc(d.diagnosis||'-')}</span></div>`:`<div class="detail-row"><b>파손내용</b><span>${esc(d.damageDetail||'-')}</span></div><div class="detail-row"><b>피해금액</b><span>${Number(d.repairCost||0)>0?Number(d.repairCost).toLocaleString('ko-KR')+'원':'미확인'}</span></div>`;
    openModal(`<div class="modal-head"><div><div class="ey">INCIDENT REVIEW</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'-')}</h2><div style="margin-top:7px">${typeof priorityBadge==='function'?priorityBadge(i.priority):''}${typeof categoryBadge==='function'?categoryBadge(i.category):''}${statusBadgeHtml(i.status)}${typeof legalBadge==='function'?legalBadge(i):''}</div></div><button class="x" data-close>×</button></div>${i.status==='rejected'&&i.rejectionNote?`<div class="reject-note"><b>반려사유</b><br>${esc(i.rejectionNote)}</div>`:''}${i.photos?.length?`<div class="thumbs" style="margin:14px 0">${i.photos.map(p=>`<div class="thumb"><img src="${p}"></div>`).join('')}</div>`:''}<div class="detail"><div class="detail-row"><b>발생일시</b><span>${fmt(i.occurredAt)}</span></div><div class="detail-row"><b>사업장</b><span>${esc(siteName(i.siteId))}</span></div><div class="detail-row"><b>보고자</b><span>${esc(i.reporterName||'-')}</span></div>${detailBlock}<div class="detail-row"><b>사고내용</b><span>${esc(i.summary||'-')}</span></div><div class="detail-row"><b>즉시조치</b><span>${esc(i.immediateAction||'-')}</span></div></div>${safety?`<label class="lbl"><span>안전관리자 검토의견 / 반려사유</span><textarea id="safetyNoteEdit" rows="3">${esc(i.safetyNote||i.rejectionNote||'')}</textarea></label><div class="modal-actions"><button class="btn-gray" id="saveNote">검토의견 저장</button>${i.status==='reported'?'<button class="btn-reject" id="rejectInc">반려</button><button class="btn-blue" id="approveInc">사고 승인</button>':''}${i.status!=='closed'?'<button class="btn-green" id="closeInc">종결</button>':''}<button class="btn-red" id="editInc">사고정보 수정</button><button class="btn-red" id="deleteInc">삭제</button></div>`:''}`);
    if(!safety)return;
    const note=()=>document.getElementById('safetyNoteEdit')?.value.trim()||'';
    const saveAndRefresh=()=>{i.updatedAt=nowISO();saveData();closeModal();renderShell(viewer)};
    document.getElementById('saveNote')?.addEventListener('click',()=>{i.safetyNote=note();saveAndRefresh()});
    document.getElementById('rejectInc')?.addEventListener('click',()=>{const reason=note();if(!reason)return alert('반려사유를 입력해 주세요.');i.safetyNote=reason;i.rejectionNote=reason;i.status='rejected';i.rejectedBy=viewer.name;i.rejectedAt=nowISO();i.approvedBy='';i.approvedAt=null;i.reviewHistory=Array.isArray(i.reviewHistory)?i.reviewHistory:[];i.reviewHistory.push({action:'rejected',by:viewer.name,at:i.rejectedAt,note:reason});saveAndRefresh()});
    document.getElementById('approveInc')?.addEventListener('click',()=>{i.safetyNote=note();i.status='approved';i.approvedBy=viewer.name;i.approvedAt=nowISO();i.rejectionNote='';saveAndRefresh()});
    document.getElementById('closeInc')?.addEventListener('click',()=>{i.status='closed';i.closedAt=nowISO();saveAndRefresh()});
    document.getElementById('editInc')?.addEventListener('click',()=>openEditIncidentModalFn(i,viewer));
    document.getElementById('deleteInc')?.addEventListener('click',()=>{if(confirm('이 사고 기록을 삭제할까요?')){data.incidents=data.incidents.filter(x=>String(x.id)!==String(i.id));saveData();closeModal();renderShell(viewer)}});
  }

  function openEditIncidentModalFn(i,u){
    const viewer=u||currentUser();if(!i||!viewer)return;
    if(viewer.role!=='safety'&&typeof window.enlEditIncidentInReportForm==='function')return window.enlEditIncidentInReportForm(i,viewer);
    if(!canEditIncident(i,viewer))return alert('수정 권한이 없습니다.');
    if(typeof openModal!=='function')return alert('수정 화면을 불러오지 못했습니다.');
    openModal(`<div class="modal-head"><div><h2>사고정보 수정</h2></div><button class="x" data-close>×</button></div><form id="editIncidentForm"><label class="lbl"><span>사고 유형</span><select id="eType">${eventTypeOptions(i.eventType)}</select></label><label class="lbl"><span>사고내용</span><textarea id="eSummary" rows="5" required>${esc(i.summary||'')}</textarea></label><label class="lbl"><span>즉시조치</span><textarea id="eImmediate" rows="3" required>${esc(i.immediateAction||'')}</textarea></label><button class="primary full">수정 저장</button></form>`);
    document.getElementById('editIncidentForm').onsubmit=e=>{e.preventDefault();i.eventType=document.getElementById('eType').value;i.summary=document.getElementById('eSummary').value.trim();i.immediateAction=document.getElementById('eImmediate').value.trim();i.updatedAt=nowISO();saveData();closeModal();renderShell(viewer)};
  }

  window.statusName=statusLabel;
  window.statusBadge=statusBadgeHtml;
  window.sortIncidents=sortIncidentList;
  window.incidentTable=incidentTableFn;
  window.bindIncidentRows=bindIncidentRowsFn;
  window.renderUnifiedIncidents=renderUnifiedIncidentsFn;
  window.renderFieldHistory=renderUnifiedIncidentsFn;
  window.renderAllIncidents=renderUnifiedIncidentsFn;
  window.renderDashboard=renderUnifiedIncidentsFn;
  window.openIncidentModal=openIncidentModalFn;
  window.openEditIncidentModal=openEditIncidentModalFn;
  window.enlIncidentTable=incidentTableFn;
  window.enlBindIncidentRows=bindIncidentRowsFn;
  window.enlOpenIncidentReview=openIncidentModalFn;
  window.enlCanEditIncident=canEditIncident;
  window.enlCanViewIncidentOriginal=canViewOriginal;
  window.ENL_INCIDENT_ACCESS_VERSION=VERSION;
})();