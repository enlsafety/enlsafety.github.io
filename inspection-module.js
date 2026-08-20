/* E&L Safety Platform v3.2.0 - 점검관리 모듈 */
const ENL_INSPECTION_KEY='enl_safety_inspections_v1';
const ENL_INSPECTION_MAX_PHOTOS=6;
let enlInspectionData=enlLoadInspectionData();
let enlInspectionPhotos=[];
let enlInspectionActionPhotos=[];
let enlInspectionTab='dashboard';

function enlLoadInspectionData(){
  try{
    const v=JSON.parse(localStorage.getItem(ENL_INSPECTION_KEY)||'null');
    if(v&&Array.isArray(v.inspections)) return v;
  }catch(e){}
  const d={version:1,inspections:[]};
  try{localStorage.setItem(ENL_INSPECTION_KEY,JSON.stringify(d))}catch(e){}
  return d;
}
function enlSaveInspectionData(){
  try{localStorage.setItem(ENL_INSPECTION_KEY,JSON.stringify(enlInspectionData))}catch(e){alert('점검 데이터 저장에 실패했습니다. 브라우저 저장공간을 확인해 주세요.');return false}
  try{new BroadcastChannel('enl_safety_inspections').postMessage('update')}catch(e){}
  return true;
}
function enlInspectionScope(u){return u.role==='field'?'site':'all'}
function enlInspectionCanCreate(u){return u.role==='field'||u.role==='safety'}
function enlInspectionCanManageAll(u){return u.role==='safety'}
function enlInspectionCanEditFinding(u,inspection,finding){
  if(!u||!inspection||!finding)return false;
  if(u.role==='final')return false;
  if(u.role==='field'&&inspection.siteId!==u.siteId)return false;
  if(finding.status==='closed'&&u.role!=='safety')return false;
  return true;
}
function enlInspectionAccessible(u){
  let arr=[...enlInspectionData.inspections];
  if(u.role==='field')arr=arr.filter(x=>x.siteId===u.siteId);
  return arr.sort((a,b)=>new Date(b.inspectedAt)-new Date(a.inspectedAt));
}
function enlInspectionTypeName(v){return ({regular:'정기점검',spot:'수시점검',joint:'합동점검',self:'자체점검'})[v]||'점검'}
function enlFindingRiskName(v){return ({low:'낮음',medium:'보통',high:'높음'})[v]||'보통'}
function enlFindingStatusName(v){return ({open:'조치필요',in_progress:'조치중',submitted:'검토요청',closed:'완료'})[v]||'조치필요'}
function enlFindingBadge(v){const cls=v==='closed'?'p-done':v==='submitted'?'p-review':v==='in_progress'?'p-approved':'p-important';return badge(cls,enlFindingStatusName(v))}
function enlInspectionStatus(i){
  const fs=i.findings||[];
  if(!fs.length)return 'closed';
  if(fs.every(f=>f.status==='closed'))return 'closed';
  if(fs.every(f=>f.status==='submitted'||f.status==='closed'))return 'review';
  if(fs.some(f=>f.status==='in_progress'||f.status==='submitted'||f.status==='closed'))return 'action';
  return 'open';
}
function enlInspectionStatusName(v){return ({open:'조치필요',action:'조치중',review:'검토대기',closed:'완료'})[v]||'점검완료'}
function enlInspectionStatusBadge(i){const s=enlInspectionStatus(i);return badge(s==='closed'?'p-done':s==='review'?'p-review':s==='action'?'p-approved':'p-important',enlInspectionStatusName(s))}
function enlInspectionFindingCount(u){return enlInspectionAccessible(u).flatMap(i=>(i.findings||[]).map(f=>({inspection:i,finding:f}))) }
function enlInspectionStats(u){
  const arr=enlInspectionAccessible(u);
  const findings=enlInspectionFindingCount(u);
  const pending=findings.filter(x=>x.finding.status!=='closed').length;
  const overdue=findings.filter(x=>x.finding.status!=='closed'&&x.finding.dueDate&&new Date(x.finding.dueDate+'T23:59:59')<new Date()).length;
  const review=findings.filter(x=>x.finding.status==='submitted').length;
  const closed=findings.filter(x=>x.finding.status==='closed').length;
  return {arr,findings,pending,overdue,review,closed};
}
function enlInspectionTabNav(){
  const items=[['dashboard','점검현황'],['new','점검등록'],['actions','개선조치']];
  return `<nav class="inspection-tabs">${items.map(([id,label])=>`<button type="button" data-inspection-tab="${id}" class="${enlInspectionTab===id?'on':''}">${label}</button>`).join('')}</nav>`;
}
function enlRenderInspectionModule(root,u){
  if(!root)return;
  root.innerHTML=`<div class="inspection-shell">${enlInspectionTabNav()}<div id="inspectionView"></div></div>`;
  root.querySelectorAll('[data-inspection-tab]').forEach(b=>b.onclick=()=>{enlInspectionTab=b.dataset.inspectionTab;enlRenderInspectionModule(root,u)});
  const view=document.getElementById('inspectionView');
  if(enlInspectionTab==='new')return enlRenderInspectionCreate(view,u);
  if(enlInspectionTab==='actions')return enlRenderInspectionActions(view,u);
  return enlRenderInspectionDashboard(view,u);
}
function enlRenderInspectionDashboard(root,u){
  const s=enlInspectionStats(u);
  const scope=u.role==='field'?`${esc(siteById(u.siteId)?.name||'소속 사업장')} 점검`:'전체 사업장 점검';
  root.innerHTML=`
    <section class="panel inspection-hero"><div><div class="ey">INSPECTION</div><h2>점검·개선조치</h2><p>${scope}을 기준으로 점검과 지적사항을 관리합니다.</p></div>${enlInspectionCanCreate(u)?'<button class="primary" id="quickInspectionCreate">+ 점검 등록</button>':''}</section>
    <div class="cards inspection-cards"><div class="card"><span>점검 누적</span><b>${s.arr.length}</b></div><div class="card important"><span>미완료 지적</span><b>${s.pending}</b></div><div class="card urgent"><span>기한초과</span><b>${s.overdue}</b></div><div class="card action"><span>검토요청</span><b>${s.review}</b></div></div>
    <section class="panel"><div class="section-head"><div><div class="ey">HISTORY</div><h2>점검 이력</h2><p>점검기록을 선택하면 지적사항과 개선조치를 확인할 수 있습니다.</p></div></div>
      <div class="toolbar"><div class="left">${u.role==='field'?'':`<select id="inspectionSiteFilter"><option value="">전체 사업장</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`}<select id="inspectionTypeFilter"><option value="">전체 점검</option><option value="regular">정기점검</option><option value="spot">수시점검</option><option value="joint">합동점검</option><option value="self">자체점검</option></select><select id="inspectionStatusFilter"><option value="">전체 상태</option><option value="open">조치필요</option><option value="action">조치중</option><option value="review">검토대기</option><option value="closed">완료</option></select></div></div>
      <div id="inspectionHistoryList" class="inspection-list"></div>
    </section>`;
  const refresh=()=>{
    let arr=[...s.arr];const sf=document.getElementById('inspectionSiteFilter')?.value||'',tf=document.getElementById('inspectionTypeFilter')?.value||'',st=document.getElementById('inspectionStatusFilter')?.value||'';
    if(sf)arr=arr.filter(x=>x.siteId===sf);if(tf)arr=arr.filter(x=>x.type===tf);if(st)arr=arr.filter(x=>enlInspectionStatus(x)===st);
    const list=document.getElementById('inspectionHistoryList');
    list.innerHTML=arr.map(i=>enlInspectionHistoryCard(i)).join('')||'<div class="empty">등록된 점검이 없습니다.</div>';
    list.querySelectorAll('[data-inspection-id]').forEach(b=>b.onclick=()=>enlOpenInspectionDetail(b.dataset.inspectionId,u));
  };
  ['inspectionSiteFilter','inspectionTypeFilter','inspectionStatusFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=refresh});refresh();
  const q=document.getElementById('quickInspectionCreate');if(q)q.onclick=()=>{enlInspectionTab='new';enlRenderInspectionModule(document.getElementById('view'),u)};
}
function enlInspectionHistoryCard(i){
  const findings=i.findings||[],open=findings.filter(f=>f.status!=='closed').length;
  return `<button type="button" class="inspection-row" data-inspection-id="${i.id}"><span class="inspection-row-main"><b>${esc(siteById(i.siteId)?.name||'-')} · ${enlInspectionTypeName(i.type)}</b><small>${fmt(i.inspectedAt)} · ${esc(i.area||'전체')} · 점검자 ${esc(i.inspectorName||'-')}</small></span><span class="inspection-row-summary">${esc(i.summary||'점검기록')}</span><span class="inspection-row-meta">${enlInspectionStatusBadge(i)}<small>지적 ${findings.length}건 / 미완료 ${open}건</small></span></button>`;
}
function enlRenderInspectionCreate(root,u){
  if(!enlInspectionCanCreate(u)){
    root.innerHTML=`<div class="panel permission-empty"><div class="lock-icon">🔒</div><h2>점검 등록 권한이 없습니다.</h2><p>관리자 계정은 전체 사업장 점검을 조회할 수 있습니다.</p></div>`;return;
  }
  const fixed=u.role==='field',site=siteById(u.siteId);
  const siteControl=fixed?`<input id="inspectionSite" type="hidden" value="${esc(site?.id||'')}"><input value="${esc(site?.name||'-')}" disabled>`:`<select id="inspectionSite" required><option value="">사업장 선택</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`;
  root.innerHTML=`<form id="inspectionCreateForm" class="panel inspection-form"><div class="section-head"><div><div class="ey">NEW INSPECTION</div><h2>점검 등록</h2><p>점검 기본내용을 먼저 저장하고 지적사항은 필요할 때 여러 건 추가할 수 있습니다.</p></div></div>
    <div class="formgrid"><label class="lbl"><span>사업장 *</span>${siteControl}</label><label class="lbl"><span>점검 일시 *</span><input id="inspectionAt" type="datetime-local" value="${localDT()}" required></label><label class="lbl"><span>점검 구분 *</span><select id="inspectionType"><option value="regular">정기점검</option><option value="spot">수시점검</option><option value="joint">합동점검</option><option value="self">자체점검</option></select></label><label class="lbl"><span>점검 장소/구역 *</span><input id="inspectionArea" placeholder="예: 장비창고, 코스관리동" required></label></div>
    <label class="lbl"><span>점검 요약 *</span><textarea id="inspectionSummary" rows="4" required placeholder="점검한 내용과 전반적인 상태를 간단히 기록"></textarea></label>
    <div class="inspection-photo-box"><div class="photo-head"><b>점검 사진</b><small id="inspectionPhotoCount">0 / ${ENL_INSPECTION_MAX_PHOTOS}장</small></div><button type="button" class="secondary" id="inspectionPhotoBtn">사진 선택 / 촬영</button><div id="inspectionPhotoThumbs" class="thumbs"></div></div>
    <details class="advanced-box" open><summary>첫 지적사항 입력 <small>없으면 비워두세요</small></summary><label class="lbl"><span>지적사항</span><textarea id="firstFindingIssue" rows="3" placeholder="예: 장비창고 통로 적치물로 이동 방해"></textarea></label><div class="formgrid"><label class="lbl"><span>위험도</span><select id="firstFindingRisk"><option value="low">낮음</option><option value="medium" selected>보통</option><option value="high">높음</option></select></label><label class="lbl"><span>조치 담당자</span><input id="firstFindingOwner" value="${esc(u.name)}"></label><label class="lbl"><span>완료 목표일</span><input id="firstFindingDue" type="date"></label><label class="lbl"><span>분류</span><select id="firstFindingCategory"><option>시설</option><option>작업방법</option><option>보호구</option><option>화학물질</option><option>차량/장비</option><option>전기</option><option>소방</option><option>기타</option></select></label></div></details>
    <button class="primary full" type="submit">점검 저장</button></form>`;
  enlInspectionPhotos=[];enlBindInspectionPhotoPicker('inspection');
  document.getElementById('inspectionCreateForm').onsubmit=e=>enlSubmitInspection(e,u);
}
function enlBindInspectionPhotoPicker(kind){
  const input=document.getElementById(kind==='inspection'?'inspectionPhotoInput':'inspectionActionPhotoInput');
  const btn=document.getElementById(kind==='inspection'?'inspectionPhotoBtn':'inspectionActionPhotoBtn');
  if(!input||!btn)return;
  btn.onclick=()=>input.click();
  input.onchange=async e=>{
    const source=kind==='inspection'?enlInspectionPhotos:enlInspectionActionPhotos;
    const next=[...source];const left=ENL_INSPECTION_MAX_PHOTOS-next.length;
    if(left<=0){alert(`사진은 최대 ${ENL_INSPECTION_MAX_PHOTOS}장까지 등록할 수 있습니다.`);return}
    for(const f of [...e.target.files].slice(0,left)){try{next.push(await compressImage(f))}catch(err){console.warn(err)}}
    if(kind==='inspection')enlInspectionPhotos=next;else enlInspectionActionPhotos=next;
    e.target.value='';enlRenderInspectionPhotoThumbs(kind);
  };
  enlRenderInspectionPhotoThumbs(kind);
}
function enlRenderInspectionPhotoThumbs(kind){
  const arr=kind==='inspection'?enlInspectionPhotos:enlInspectionActionPhotos;
  const root=document.getElementById(kind==='inspection'?'inspectionPhotoThumbs':'inspectionActionPhotoThumbs');
  const count=document.getElementById(kind==='inspection'?'inspectionPhotoCount':'inspectionActionPhotoCount');
  if(!root)return;root.innerHTML=arr.map((p,i)=>`<div class="thumb"><img src="${p}"><button type="button" data-inspection-photo-rm="${i}">×</button></div>`).join('');if(count)count.textContent=`${arr.length} / ${ENL_INSPECTION_MAX_PHOTOS}장`;
  root.querySelectorAll('[data-inspection-photo-rm]').forEach(b=>b.onclick=()=>{arr.splice(Number(b.dataset.inspectionPhotoRm),1);if(kind==='inspection')enlInspectionPhotos=arr;else enlInspectionActionPhotos=arr;enlRenderInspectionPhotoThumbs(kind)});
}
function enlSubmitInspection(e,u){
  e.preventDefault();const siteId=document.getElementById('inspectionSite').value;if(!siteId)return alert('사업장을 선택해 주세요.');
  const issue=document.getElementById('firstFindingIssue').value.trim();
  const findings=[];
  if(issue)findings.push({id:uid('finding'),category:document.getElementById('firstFindingCategory').value,issue,risk:document.getElementById('firstFindingRisk').value,ownerName:document.getElementById('firstFindingOwner').value.trim()||u.name,dueDate:document.getElementById('firstFindingDue').value,status:'open',actionDetail:'',afterPhotos:[],reviewNote:'',createdAt:nowISO(),updatedAt:nowISO(),createdBy:u.name,createdById:u.id});
  const i={id:uid('insp'),siteId,type:document.getElementById('inspectionType').value,inspectedAt:new Date(document.getElementById('inspectionAt').value).toISOString(),area:document.getElementById('inspectionArea').value.trim(),summary:document.getElementById('inspectionSummary').value.trim(),inspectorName:u.name,inspectorId:u.id,photos:[...enlInspectionPhotos],findings,createdAt:nowISO(),updatedAt:nowISO()};
  enlInspectionData.inspections.unshift(i);if(!enlSaveInspectionData())return;enlInspectionPhotos=[];alert('점검이 저장되었습니다.');enlInspectionTab='dashboard';enlRenderInspectionModule(document.getElementById('view'),u);
}
function enlOpenInspectionDetail(id,u){
  const i=enlInspectionData.inspections.find(x=>x.id===id);if(!i)return;if(u.role==='field'&&i.siteId!==u.siteId)return;
  const canAdd=u.role==='safety'||(u.role==='field'&&i.siteId===u.siteId);
  openModal(`<div class="modal-head"><div><div class="ey">INSPECTION DETAIL</div><h2>${esc(siteById(i.siteId)?.name||'-')} · ${enlInspectionTypeName(i.type)}</h2><div style="margin-top:6px">${enlInspectionStatusBadge(i)}</div></div><button class="x" data-close>×</button></div>
    ${i.photos?.length?`<div class="thumbs" style="margin:12px 0">${i.photos.map(p=>`<div class="thumb"><img src="${p}"></div>`).join('')}</div>`:''}
    <div class="detail"><div class="detail-row"><b>점검일시</b><span>${fmt(i.inspectedAt)}</span></div><div class="detail-row"><b>장소/구역</b><span>${esc(i.area||'-')}</span></div><div class="detail-row"><b>점검자</b><span>${esc(i.inspectorName||'-')}</span></div><div class="detail-row"><b>점검요약</b><span>${esc(i.summary||'-')}</span></div></div>
    <div class="inspection-detail-head"><h3>지적사항 ${(i.findings||[]).length}건</h3>${canAdd?'<button class="secondary" id="addFindingBtn">+ 지적사항 추가</button>':''}</div>
    <div class="inspection-finding-list">${(i.findings||[]).map(f=>enlFindingDetailCard(i,f,u)).join('')||'<div class="empty compact">지적사항이 없습니다.</div>'}</div>
    ${u.role==='safety'?'<div class="modal-actions"><button class="btn-red" id="deleteInspectionBtn">점검기록 삭제</button></div>':''}`);
  document.querySelectorAll('[data-finding-id]').forEach(b=>b.onclick=()=>enlOpenFindingModal(i.id,b.dataset.findingId,u));
  const add=document.getElementById('addFindingBtn');if(add)add.onclick=()=>enlOpenFindingCreate(i,u);
  const del=document.getElementById('deleteInspectionBtn');if(del)del.onclick=()=>{if(confirm('이 점검기록과 지적사항을 모두 삭제할까요?')){enlInspectionData.inspections=enlInspectionData.inspections.filter(x=>x.id!==i.id);enlSaveInspectionData();closeModal();enlRenderInspectionModule(document.getElementById('view'),u)}};
}
function enlFindingDetailCard(i,f,u){
  return `<button type="button" class="finding-detail-card" data-finding-id="${f.id}"><div><span>${enlFindingBadge(f.status)}</span><span class="risk risk-${f.risk}">${enlFindingRiskName(f.risk)}</span></div><b>${esc(f.category||'기타')} · ${esc(f.issue)}</b><small>담당 ${esc(f.ownerName||'-')} · 기한 ${esc(f.dueDate||'-')}${f.dueDate?' '+dday(f.dueDate):''}</small>${f.actionDetail?`<p>${esc(f.actionDetail)}</p>`:''}</button>`;
}
function enlOpenFindingCreate(i,u){
  openModal(`<div class="modal-head"><div><div class="ey">NEW FINDING</div><h2>지적사항 추가</h2><p>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.area||'-')}</p></div><button class="x" data-close>×</button></div><form id="findingCreateForm"><label class="lbl"><span>지적사항 *</span><textarea id="findingIssue" rows="4" required></textarea></label><div class="formgrid"><label class="lbl"><span>분류</span><select id="findingCategory"><option>시설</option><option>작업방법</option><option>보호구</option><option>화학물질</option><option>차량/장비</option><option>전기</option><option>소방</option><option>기타</option></select></label><label class="lbl"><span>위험도</span><select id="findingRisk"><option value="low">낮음</option><option value="medium" selected>보통</option><option value="high">높음</option></select></label><label class="lbl"><span>조치 담당자 *</span><input id="findingOwner" value="${esc(u.name)}" required></label><label class="lbl"><span>완료 목표일 *</span><input id="findingDue" type="date" required></label></div><button class="primary full">지적사항 저장</button></form>`);
  document.getElementById('findingCreateForm').onsubmit=e=>{e.preventDefault();i.findings=i.findings||[];i.findings.push({id:uid('finding'),category:document.getElementById('findingCategory').value,issue:document.getElementById('findingIssue').value.trim(),risk:document.getElementById('findingRisk').value,ownerName:document.getElementById('findingOwner').value.trim(),dueDate:document.getElementById('findingDue').value,status:'open',actionDetail:'',afterPhotos:[],reviewNote:'',createdAt:nowISO(),updatedAt:nowISO(),createdBy:u.name,createdById:u.id});i.updatedAt=nowISO();enlSaveInspectionData();closeModal();enlOpenInspectionDetail(i.id,u)};
}
function enlOpenFindingModal(inspectionId,findingId,u){
  const i=enlInspectionData.inspections.find(x=>x.id===inspectionId),f=i?.findings?.find(x=>x.id===findingId);if(!i||!f)return;if(u.role==='field'&&i.siteId!==u.siteId)return;
  const editable=enlInspectionCanEditFinding(u,i,f);enlInspectionActionPhotos=[...(f.afterPhotos||[])];
  if(!editable){openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>${esc(f.issue)}</h2></div><button class="x" data-close>×</button></div><div class="detail"><div class="detail-row"><b>사업장</b><span>${esc(siteById(i.siteId)?.name||'-')}</span></div><div class="detail-row"><b>위험도</b><span>${enlFindingRiskName(f.risk)}</span></div><div class="detail-row"><b>담당자</b><span>${esc(f.ownerName||'-')}</span></div><div class="detail-row"><b>완료기한</b><span>${esc(f.dueDate||'-')}</span></div><div class="detail-row"><b>조치내용</b><span>${esc(f.actionDetail||'-')}</span></div><div class="detail-row"><b>상태</b><span>${enlFindingStatusName(f.status)}</span></div><div class="detail-row"><b>검토의견</b><span>${esc(f.reviewNote||'-')}</span></div></div>${f.afterPhotos?.length?`<div class="thumbs">${f.afterPhotos.map(p=>`<div class="thumb"><img src="${p}"></div>`).join('')}</div>`:''}`);return;}
  openModal(`<div class="modal-head"><div><div class="ey">CORRECTIVE ACTION</div><h2>개선조치</h2><p>${esc(siteById(i.siteId)?.name||'-')} · ${esc(f.issue)}</p></div><button class="x" data-close>×</button></div><form id="findingActionForm"><div class="warn-box"><b>지적사항</b><br>${esc(f.issue)}</div><div class="formgrid"><label class="lbl"><span>조치 담당자 *</span><input id="findingActionOwner" value="${esc(f.ownerName||u.name)}" required></label><label class="lbl"><span>완료 목표일 *</span><input id="findingActionDue" type="date" value="${esc(f.dueDate||'')}" required></label></div><label class="lbl"><span>개선조치 내용 *</span><textarea id="findingActionDetail" rows="4" required placeholder="실제 조치한 내용을 입력">${esc(f.actionDetail||'')}</textarea></label><label class="lbl"><span>현재 상태</span><select id="findingActionStatus"><option value="open" ${f.status==='open'?'selected':''}>조치필요</option><option value="in_progress" ${f.status==='in_progress'?'selected':''}>조치중</option><option value="submitted" ${f.status==='submitted'?'selected':''}>안전관리자 검토요청</option>${u.role==='safety'?`<option value="closed" ${f.status==='closed'?'selected':''}>완료 승인</option>`:''}</select></label>${u.role==='safety'?`<label class="lbl"><span>안전관리자 검토의견</span><textarea id="findingReviewNote" rows="3">${esc(f.reviewNote||'')}</textarea></label>`:(f.reviewNote?`<div class="law-box"><b>검토의견</b><br>${esc(f.reviewNote)}</div>`:'')}<div class="inspection-photo-box"><div class="photo-head"><b>조치 완료 사진</b><small id="inspectionActionPhotoCount">0 / ${ENL_INSPECTION_MAX_PHOTOS}장</small></div><button type="button" class="secondary" id="inspectionActionPhotoBtn">사진 선택 / 촬영</button><div id="inspectionActionPhotoThumbs" class="thumbs"></div></div><button class="primary full">개선조치 저장</button></form>`);
  enlBindInspectionPhotoPicker('action');
  document.getElementById('findingActionForm').onsubmit=e=>{e.preventDefault();const status=document.getElementById('findingActionStatus').value;f.ownerName=document.getElementById('findingActionOwner').value.trim();f.dueDate=document.getElementById('findingActionDue').value;f.actionDetail=document.getElementById('findingActionDetail').value.trim();f.status=status;f.afterPhotos=[...enlInspectionActionPhotos];f.updatedAt=nowISO();f.updatedBy=u.name;f.reviewNote=u.role==='safety'?document.getElementById('findingReviewNote').value.trim():(f.reviewNote||'');if(u.role==='safety'&&status==='closed'){f.reviewedBy=u.name;f.reviewedAt=nowISO()}i.updatedAt=nowISO();enlSaveInspectionData();enlInspectionActionPhotos=[];closeModal();enlInspectionTab='actions';enlRenderInspectionModule(document.getElementById('view'),u);alert(status==='closed'?'개선조치가 완료 승인되었습니다.':'개선조치가 저장되었습니다.')};
}
function enlRenderInspectionActions(root,u){
  const rows=enlInspectionFindingCount(u);
  root.innerHTML=`<section class="panel"><div class="section-head"><div><div class="ey">CORRECTIVE ACTIONS</div><h2>개선조치</h2><p>${u.role==='field'?`${esc(siteById(u.siteId)?.name||'소속 사업장')} 지적사항만 표시됩니다.`:'전체 사업장 지적사항을 표시합니다.'}</p></div></div><div class="toolbar"><div class="left">${u.role==='field'?'':`<select id="findingSiteFilter"><option value="">전체 사업장</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`}<select id="findingStatusFilter"><option value="">전체 상태</option><option value="open">조치필요</option><option value="in_progress">조치중</option><option value="submitted">검토요청</option><option value="closed">완료</option></select><select id="findingRiskFilter"><option value="">전체 위험도</option><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></div></div><div id="findingActionList" class="action-list"></div></section>`;
  const refresh=()=>{let arr=[...rows];const sf=document.getElementById('findingSiteFilter')?.value||'',st=document.getElementById('findingStatusFilter')?.value||'',rf=document.getElementById('findingRiskFilter')?.value||'';if(sf)arr=arr.filter(x=>x.inspection.siteId===sf);if(st)arr=arr.filter(x=>x.finding.status===st);if(rf)arr=arr.filter(x=>x.finding.risk===rf);const list=document.getElementById('findingActionList');list.innerHTML=arr.map(({inspection:i,finding:f})=>`<div class="action-card"><div>${enlFindingBadge(f.status)}<span class="risk risk-${f.risk}">${enlFindingRiskName(f.risk)}</span></div><h3>${esc(siteById(i.siteId)?.name||'-')} · ${esc(f.category||'기타')}</h3><p>${esc(f.issue)}</p><div class="action-grid"><div><b>점검일</b><span>${fmt(i.inspectedAt)}</span></div><div><b>담당자</b><span>${esc(f.ownerName||'-')}</span></div><div><b>완료기한</b><span>${esc(f.dueDate||'-')} ${f.dueDate?dday(f.dueDate):''}</span></div><div><b>조치내용</b><span>${esc(f.actionDetail||'-')}</span></div></div><button class="secondary" data-finding-action="${i.id}|${f.id}">${u.role==='final'||f.status==='closed'&&u.role!=='safety'?'내용 확인':'조치 등록/수정'}</button></div>`).join('')||'<div class="empty">표시할 지적사항이 없습니다.</div>';list.querySelectorAll('[data-finding-action]').forEach(b=>b.onclick=()=>{const [iid,fid]=b.dataset.findingAction.split('|');enlOpenFindingModal(iid,fid,u)})};['findingSiteFilter','findingStatusFilter','findingRiskFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=refresh});refresh();
}

window.addEventListener('storage',e=>{if(e.key===ENL_INSPECTION_KEY){enlInspectionData=enlLoadInspectionData();if(typeof enlPlatformSection!=='undefined'&&enlPlatformSection==='inspection'&&currentUser())enlRenderInspectionModule(document.getElementById('view'),currentUser())}});
try{const ch=new BroadcastChannel('enl_safety_inspections');ch.onmessage=()=>{enlInspectionData=enlLoadInspectionData();if(typeof enlPlatformSection!=='undefined'&&enlPlatformSection==='inspection'&&currentUser())enlRenderInspectionModule(document.getElementById('view'),currentUser())}}catch(e){}
