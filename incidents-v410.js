/* E&L Accident Report App v4.1.1 - authoritative incident access/review */
(function(){
  'use strict';
  const VERSION='4.1.1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const position=u=>String(u?.position||u?.jobTitle||'').trim();
  const isSiteUser=u=>!!u&&['field','worker'].includes(u.role);
  const isManager=u=>isSiteUser(u)&&MANAGER_POSITIONS.includes(position(u));
  const sameSite=(i,u)=>!!i&&!!u&&String(i.siteId||'')===String(u.siteId||'');
  const userId=u=>String(u?.personnelId||u?.id||'');
  const isAuthor=(i,u)=>{
    if(!i||!u)return false;
    const rid=String(i.reporterId||'');
    if(rid&&userId(u))return rid===userId(u);
    return !rid&&norm(i.reporterName)===norm(u.name);
  };
  function canEditIncident(i,u){
    if(!i||!u)return false;
    if(u.role==='safety')return true;
    if(!sameSite(i,u))return false;
    if(!['reported','rejected'].includes(i.status))return false;
    if(isManager(u))return true;
    return u.role==='worker'&&isAuthor(i,u);
  }
  function canViewOriginal(i,u){
    if(!i||!u)return false;
    if(u.role==='safety')return true;
    if(u.role==='final')return ['approved','closed'].includes(i.status);
    return sameSite(i,u)&&isManager(u);
  }
  window.enlCanEditIncident=canEditIncident;
  window.enlCanViewIncidentOriginal=canViewOriginal;

  const baseStatusName=typeof statusName==='function'?statusName:null;
  statusName=function(v){if(v==='rejected')return '반려';return baseStatusName?baseStatusName(v):(v==='reported'?'검토대기':v==='approved'?'승인':v==='closed'?'종결':v)};
  statusBadge=function(v){if(v==='rejected')return badge('p-rejected','반려');return badge(v==='reported'?'p-reported':v==='approved'?'p-approved':v==='closed'?'p-closed':'p-normal',statusName(v));};
  function css(){if(document.getElementById('incident410Css'))return;const s=document.createElement('style');s.id='incident410Css';s.textContent=`
    .p-rejected{background:#fff0f0!important;color:#a02f2f!important;border:1px solid #efb7b7!important}.incident-private-list{display:grid;gap:10px}.incident-private-card{border:2px solid #d7e2ec;border-radius:14px;background:#fff;padding:14px}.incident-private-card.rejected{border-color:#e2abab;background:#fffafa}.incident-private-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.incident-private-card h3{margin:9px 0 5px;color:#173b66;font-size:17px}.incident-private-meta{display:flex;gap:8px;flex-wrap:wrap;color:#66798b;font-size:12px;font-weight:750}.incident-private-note{margin-top:9px;padding:10px 11px;border-radius:10px;background:#fff1f1;color:#893737;font-size:13px;line-height:1.5}.incident-private-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.incident-private-actions button{min-height:42px;border:0;border-radius:9px;background:#1e5d91;color:#fff;padding:0 14px;font-weight:900}.incident-private-lock{margin-top:9px;color:#788a99;font-size:12px}.reject-note{margin:10px 0;padding:11px 12px;border:1px solid #e9bcbc;border-radius:10px;background:#fff5f5;color:#803636;line-height:1.55}.btn-reject{background:#b13c3c!important;color:#fff!important}.edit-resubmit-note{margin:0 0 12px;padding:11px;border:1px solid #e7b4b4;border-radius:10px;background:#fff3f3;color:#7f3535;font-weight:800;line-height:1.5}@media(max-width:620px){.incident-private-card{padding:12px}.incident-private-actions button{width:100%}}
  `;document.head.appendChild(s)}
  css();

  sortIncidents=function(a,b){const p={urgent:3,important:2,normal:1};return (p[b.priority]||0)-(p[a.priority]||0)||(new Date(b.occurredAt||0)-new Date(a.occurredAt||0));};
  function siteName(id){return siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||'-'}
  function siteRecords(u){return [...(data.incidents||[])].filter(i=>sameSite(i,u)).sort(sortIncidents)}
  function visibleFieldRecords(u){const arr=siteRecords(u);return isManager(u)?arr:arr.filter(i=>isAuthor(i,u));}
  function originalTable(arr,u,admin=false){
    if(!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';
    return `<div class="table-wrap"><table class="tbl"><thead><tr><th>발생일</th><th>사업장</th><th>구분</th><th>사고유형</th><th>관리등급</th><th>상태</th><th>개선조치</th><th>내용</th></tr></thead><tbody>${arr.map(i=>`<tr data-inc-id="${esc(i.id)}"><td>${fmt(i.occurredAt)}</td><td><b>${esc(siteName(i.siteId))}</b></td><td>${categoryBadge(i.category)}</td><td>${esc(i.eventType||'-')}</td><td>${priorityBadge(i.priority)}${legalBadge(i)}</td><td>${statusBadge(i.status)}</td><td>${actionBadge(i)}</td><td>${esc(i.summary||'').slice(0,50)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  incidentTable=function(arr,admin,u){const viewer=u||currentUser?.();return originalTable(arr,viewer,admin)};
  bindIncidentRows=function(admin,u){const viewer=u||currentUser?.();document.querySelectorAll('[data-inc-id]').forEach(r=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(r.dataset.incId));if(i&&canViewOriginal(i,viewer))r.onclick=()=>openIncidentModal(i.id,admin,viewer);else{r.onclick=null;r.style.cursor='default'}})};

  function privateCards(arr,u){
    if(!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';
    return `<div class="incident-private-list">${arr.map(i=>{const editable=canEditIncident(i,u),rejected=i.status==='rejected';return `<article class="incident-private-card ${rejected?'rejected':''}"><div class="incident-private-top"><div>${categoryBadge(i.category)}${statusBadge(i.status)}</div><b>${fmt(i.occurredAt)}</b></div><h3>${esc(i.eventType||'사고 보고')}</h3><div class="incident-private-meta"><span>보고자 ${esc(i.reporterName||'-')}</span><span>${esc(siteName(i.siteId))}</span></div>${rejected&&i.rejectionNote?`<div class="incident-private-note"><b>반려사유</b><br>${esc(i.rejectionNote)}</div>`:''}<div class="incident-private-lock">사고보고서 원본은 현장소장·파트장·서무가 조회할 수 있습니다.</div>${editable?`<div class="incident-private-actions"><button type="button" data-rejected-edit="${esc(i.id)}">${i.status==='reported'?'보고 회수 후 수정':'반려 내용 수정 후 재제출'}</button></div>`:''}</article>`}).join('')}</div>`;
  }
  function bindRejectedEdits(root,u){root.querySelectorAll('[data-rejected-edit]').forEach(b=>b.onclick=()=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(b.dataset.rejectedEdit));if(i&&canEditIncident(i,u))openEditIncidentModal(i,u)})}

  renderUnifiedIncidents=function(root,u){
    const actual=(currentUser?.()&&String(currentUser()?.id||'')===String(u?.id||''))?currentUser():u;
    if(isSiteUser(actual)||u?.role==='field'){
      const viewer=actual||u,arr=visibleFieldRecords(viewer);
      if(isManager(viewer)){
        root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE RECORDS</div><h2>사고 기록</h2><p>${esc(siteName(viewer.siteId))}의 전체 사고보고서를 조회합니다.</p></div></div>${originalTable(arr,viewer,false)}</div>`;bindIncidentRows(false,viewer);return;
      }
      root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE RECORDS</div><h2>내 사고 보고 기록</h2><p>내가 작성한 보고의 처리상태를 확인합니다.</p></div></div>${privateCards(arr,viewer)}</div>`;bindRejectedEdits(root,viewer);return;
    }
    if(u?.role==='final'){
      const arr=[...(data.incidents||[])].filter(i=>['approved','closed'].includes(i.status)).sort(sortIncidents);root.innerHTML=`<div class="panel"><div class="section-head"><div><h2>승인 사고 조회</h2><p>안전관리자가 승인한 사고만 표시됩니다.</p></div></div>${originalTable(arr,u,false)}</div>`;bindIncidentRows(false,u);return;
    }
    let arr=[...(data.incidents||[])].sort(sortIncidents);
    root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">ALL INCIDENTS</div><h2>전체 사고관리</h2><p>안전관리자는 모든 사고를 검토·승인·반려·수정할 수 있습니다.</p></div></div><div class="toolbar"><div class="left"><select id="siteFilter"><option value="">전체 사업장</option>${(data.sites||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><select id="statusFilter"><option value="">전체 상태</option><option value="reported">검토대기</option><option value="rejected">반려</option><option value="approved">승인</option><option value="closed">종결</option></select><select id="categoryFilter"><option value="">전체 구분</option><option value="person">인사사고</option><option value="property">대물사고</option><option value="near_miss">아차사고</option><option value="hazard">위험요인</option></select></div></div><div id="unifiedIncidentTable"></div></div>`;
    const refresh=()=>{let x=[...arr];const sf=document.getElementById('siteFilter')?.value||'',st=document.getElementById('statusFilter')?.value||'',cf=document.getElementById('categoryFilter')?.value||'';if(sf)x=x.filter(i=>String(i.siteId)===String(sf));if(st)x=x.filter(i=>i.status===st);if(cf)x=x.filter(i=>i.category===cf);const box=document.getElementById('unifiedIncidentTable');if(box)box.innerHTML=originalTable(x,u,true);bindIncidentRows(true,u)};['siteFilter','statusFilter','categoryFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.onchange=refresh});refresh();
  };
  renderFieldHistory=function(root,u){return renderUnifiedIncidents(root,u)};
  renderAllIncidents=function(root,u){return renderUnifiedIncidents(root,u)};
  renderDashboard=function(root,u){return renderUnifiedIncidents(root,u)};

  openIncidentModal=function(id,admin,u){
    const viewer=u||currentUser?.(),i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return;
    if(!canViewOriginal(i,viewer)){alert('사고보고서 원본은 안전관리자 또는 소속 현장관리자가 조회할 수 있습니다.');return}
    const safety=viewer?.role==='safety';
    openModal(`<div class="modal-head"><div><div class="ey">INCIDENT DETAIL</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'-')}</h2><div style="margin-top:7px">${priorityBadge(i.priority)}${categoryBadge(i.category)}${statusBadge(i.status)}${legalBadge(i)}</div></div><button class="x" data-close>×</button></div>${i.status==='rejected'&&i.rejectionNote?`<div class="reject-note"><b>반려사유</b><br>${esc(i.rejectionNote)}</div>`:''}${i.photos?.length?`<div class="thumbs" style="margin:14px 0">${i.photos.map(p=>`<div class="thumb"><img src="${p}"></div>`).join('')}</div>`:''}<div class="detail"><div class="detail-row"><b>발생일시</b><span>${fmt(i.occurredAt)}</span></div><div class="detail-row"><b>사고자</b><span>${esc(i.injuredName||'-')} ${i.job?'· '+esc(i.job):''}</span></div><div class="detail-row"><b>사고내용</b><span>${esc(i.summary||'-')}</span></div><div class="detail-row"><b>즉시조치</b><span>${esc(i.immediateAction||'-')}</span></div><div class="detail-row"><b>보고자</b><span>${esc(i.reporterName||'-')}</span></div><div class="detail-row"><b>안전관리자 의견</b><span>${esc(i.safetyNote||'-')}</span></div><div class="detail-row"><b>개선조치</b><div>${i.corrective?`${actionBadge(i)}<br><b style="font-size:9px">원인:</b> ${esc(i.corrective.rootCause||'-')}<br><b style="font-size:9px">조치:</b> ${esc(i.corrective.actionDetail||'-')}<br><b style="font-size:9px">담당:</b> ${esc(i.corrective.ownerName||'-')} / ${esc(i.corrective.dueDate||'-')}`:'미등록'}</div></div></div>${i.legalReview?`<div class="law-box"><b>법적 확인 알림</b><br>입력정보상 법정 보고 여부 검토가 필요한 건입니다. 자동판정은 법적 확정이 아닙니다.</div>`:''}${safety?`<label class="lbl"><span>안전관리자 검토의견 / 반려사유</span><textarea id="safetyNoteEdit" rows="3">${esc(i.safetyNote||i.rejectionNote||'')}</textarea></label><div class="modal-actions"><button class="btn-gray" id="saveNote">검토의견 저장</button>${i.status==='reported'?'<button class="btn-reject" id="rejectInc">반려</button><button class="btn-blue" id="approveInc">사고 승인</button>':''}${i.status!=='closed'?'<button class="btn-green" id="closeInc">종결</button>':''}<button class="btn-red" id="editInc">사고정보 수정</button><button class="btn-red" id="deleteInc">삭제</button></div>`:''}`);
    if(!safety)return;
    const note=()=>document.getElementById('safetyNoteEdit')?.value.trim()||'';
    const saveAndRefresh=()=>{i.updatedAt=nowISO();saveData();closeModal();renderShell(viewer)};
    document.getElementById('saveNote').onclick=()=>{i.safetyNote=note();saveAndRefresh()};
    const rej=document.getElementById('rejectInc');if(rej)rej.onclick=()=>{const reason=note();if(!reason)return alert('반려사유를 입력해 주세요.');i.safetyNote=reason;i.rejectionNote=reason;i.status='rejected';i.rejectedBy=viewer.name;i.rejectedAt=nowISO();i.approvedBy='';i.approvedAt=null;i.reviewHistory=Array.isArray(i.reviewHistory)?i.reviewHistory:[];i.reviewHistory.push({action:'rejected',by:viewer.name,at:i.rejectedAt,note:reason});saveAndRefresh()};
    const ap=document.getElementById('approveInc');if(ap)ap.onclick=()=>{i.safetyNote=note();i.status='approved';i.approvedBy=viewer.name;i.approvedAt=nowISO();saveAndRefresh()};
    const cl=document.getElementById('closeInc');if(cl)cl.onclick=()=>{if(i.corrective&&i.corrective.status!=='approved'&&!confirm('개선조치가 아직 안전관리자 승인 완료가 아닙니다. 그래도 종결할까요?'))return;i.status='closed';i.closedAt=nowISO();saveAndRefresh()};
    document.getElementById('editInc').onclick=()=>openEditIncidentModal(i,viewer);
    document.getElementById('deleteInc').onclick=()=>{if(confirm('이 사고 기록을 삭제할까요? 삭제 후 되돌리기 어렵습니다.')){data.incidents=data.incidents.filter(x=>x.id!==i.id);saveData();closeModal();renderShell(viewer)}};
  };

  openEditIncidentModal=function(i,u){
    const viewer=u||currentUser?.(),safety=viewer?.role==='safety',manager=isManager(viewer),previousStatus=i?.status;
    if(!safety&&!canEditIncident(i,viewer)){alert('검토대기 또는 반려 상태의 사고보고 중 수정 권한이 있는 건만 수정할 수 있습니다.');return}
    const fixedSite=!safety,reason=i.status==='rejected'?(i.rejectionNote||i.safetyNote||''):'';
    const heading=safety?'사고정보 수정':manager?'사고보고 수정':i.status==='reported'?'내 사고보고 회수·수정':'반려 보고서 수정';
    const guide=safety?'':manager?'소속 사업장의 검토대기·반려 보고서를 수정하면 안전관리자에게 다시 제출됩니다.':i.status==='reported'?'검토대기 중인 내 보고를 회수해 수정한 뒤 다시 제출합니다.':'수정 후 안전관리자에게 다시 제출됩니다.';
    openModal(`<div class="modal-head"><div><h2>${heading}</h2>${guide?`<p style="margin:4px 0 0;color:#6b7c8c">${guide}</p>`:''}</div><button class="x" data-close>×</button></div>${reason?`<div class="edit-resubmit-note">반려사유: ${esc(reason)}</div>`:''}<form id="editIncidentForm"><div class="formgrid"><label class="lbl"><span>사업장</span>${fixedSite?`<input value="${esc(siteName(i.siteId))}" disabled><input id="eSite" type="hidden" value="${esc(i.siteId)}">`:`<select id="eSite">${(data.sites||[]).map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(i.siteId)?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`}</label><label class="lbl"><span>사고 구분</span><select id="eCategory"><option value="person" ${i.category==='person'?'selected':''}>대인사고</option><option value="property" ${i.category==='property'?'selected':''}>대물사고</option><option value="near_miss" ${i.category==='near_miss'?'selected':''}>아차사고</option><option value="hazard" ${i.category==='hazard'?'selected':''}>위험요인</option></select></label><label class="lbl"><span>사고 유형</span><select id="eType">${eventTypeOptions(i.eventType)}</select></label><label class="lbl"><span>사고 정도</span><select id="eSeverity"><option value="minor" ${i.severity==='minor'?'selected':''}>경미</option><option value="moderate" ${i.severity==='moderate'?'selected':''}>보통</option><option value="major" ${i.severity==='major'?'selected':''}>중대</option></select></label><label class="lbl"><span>치료/휴업 예상</span><select id="eLeave"><option value="unknown" ${i.leaveEstimate==='unknown'?'selected':''}>미확인</option><option value="none" ${i.leaveEstimate==='none'?'selected':''}>휴업 없음</option><option value="under3" ${i.leaveEstimate==='under3'?'selected':''}>3일 미만 예상</option><option value="3plus" ${i.leaveEstimate==='3plus'?'selected':''}>3일 이상 예상</option><option value="longterm" ${i.leaveEstimate==='longterm'?'selected':''}>장기치료/중상 가능</option></select></label><label class="lbl"><span>사고자</span><input id="eInj" value="${esc(i.injuredName||'')}"></label></div><label class="lbl"><span>사고내용</span><textarea id="eSummary" rows="4" required>${esc(i.summary||'')}</textarea></label><label class="lbl"><span>즉시조치</span><textarea id="eImmediate" rows="3" required>${esc(i.immediateAction||'')}</textarea></label><label class="lbl"><span><input id="ePotential" type="checkbox" style="width:auto" ${i.potentialMajor?'checked':''}> 잠재 중대위험</span></label><button class="primary full">${safety?'수정 저장':'수정 후 다시 제출'}</button></form>`);
    document.getElementById('editIncidentForm').onsubmit=e=>{e.preventDefault();i.siteId=document.getElementById('eSite').value;i.category=document.getElementById('eCategory').value;i.eventType=document.getElementById('eType').value;i.severity=document.getElementById('eSeverity').value;i.leaveEstimate=document.getElementById('eLeave').value;i.injuredName=document.getElementById('eInj').value.trim();i.summary=document.getElementById('eSummary').value.trim();i.immediateAction=document.getElementById('eImmediate').value.trim();i.potentialMajor=document.getElementById('ePotential').checked;i.priority=computePriority(i.category,i.severity,i.eventType,i.potentialMajor,i.leaveEstimate);i.legalReview=computeLegalReview(i.category,i.severity,i.leaveEstimate);if(!safety){i.status='reported';i.resubmittedBy=viewer.name;i.resubmittedById=userId(viewer);i.resubmittedAt=nowISO();i.reviewHistory=Array.isArray(i.reviewHistory)?i.reviewHistory:[];i.reviewHistory.push({action:previousStatus==='reported'?'withdrawn_and_resubmitted':'resubmitted',by:viewer.name,at:i.resubmittedAt})}i.updatedAt=nowISO();saveData();closeModal();renderShell(viewer);if(!safety)alert('수정된 사고보고서가 안전관리자에게 다시 제출되었습니다.')};
  };

  window.ENL_INCIDENT_ACCESS_VERSION=VERSION;
})();