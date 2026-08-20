/* E&L 사고보고 v3 공통화면 / 역할기반 권한 */

function roleName(role){
  return role==='field'?'현장소장':role==='safety'?'안전관리자':'경영관리자';
}
function statusName(v){
  return v==='reported'?'접수':v==='approved'?'조치중':'완료';
}
function categoryName(v){
  return v==='person'?'대인사고':v==='property'?'대물사고':v==='near_miss'?'아차사고':v==='hazard'?'위험요인':'기타';
}
function categoryBadge(v){
  const cls=v==='person'?'p-person':v==='property'?'p-property':v==='hazard'?'p-hazard':'p-near';
  return badge(cls,categoryName(v));
}
function statusBadge(v){
  return badge(v==='reported'?'p-reported':v==='approved'?'p-approved':'p-closed',statusName(v));
}

function permissionFor(u){
  return {
    createIncident:u.role==='field'||u.role==='safety',
    manageIncident:u.role==='safety',
    writeAction:u.role==='field'||u.role==='safety',
    reviewAction:u.role==='safety',
    manageMaster:u.role==='safety',
    viewScope:u.role==='field'?(siteById(u.siteId)?.name||'소속 사업장'):u.role==='safety'?'전체 사업장':'승인/완료 사고'
  };
}
function accessibleIncidents(u){
  let arr=[...data.incidents];
  if(u.role==='field')arr=arr.filter(i=>i.siteId===u.siteId);
  if(u.role==='final')arr=arr.filter(i=>['approved','closed'].includes(i.status));
  return arr.sort(sortIncidents);
}
function defaultViewFor(){return 'home'}

function renderShell(u){
  const site=siteById(u.siteId)?.name||'전체 사업장';
  const p=permissionFor(u);
  app.innerHTML=`<div class="app-shell app-v3">
    <header class="topbar">
      <div class="brand"><div class="logo">E&L</div><div><h1>사고보고</h1><p>사고 접수 · 후속조치 · 사고목록</p></div></div>
      <div class="user-wrap">
        <button id="userChip" class="user-chip"><div class="avatar">${esc(u.name.slice(0,2))}</div><div><b>${esc(u.name)}</b><small>${roleName(u.role)} · ${esc(site)}</small></div><span class="chev">⌄</span></button>
        <div id="userMenu" class="user-menu ${accountMenuOpen?'':'hide'}">
          <div class="who"><b>${esc(u.name)}</b><span>${roleName(u.role)} · ${esc(site)}</span></div>
          <button id="changePwBtn">비밀번호 변경</button>
          <button id="logoutBtn" class="danger">로그아웃</button>
        </div>
      </div>
    </header>
    <main class="main">
      <div class="permission-strip"><b>${roleName(u.role)}</b><span>조회범위: ${esc(p.viewScope)}</span><span>${p.manageIncident?'사고 승인·수정 가능':p.createIncident?'사고 등록·후속조치 가능':'열람 전용'}</span></div>
      ${renderNav(u)}
      <div id="view"></div>
      <div class="footer-note">이앤엘 사고보고 v3.0 · TEST MODE · 현재 브라우저 저장 방식</div>
    </main>
    <div id="modalRoot"></div>
  </div>`;
  document.getElementById('userChip').onclick=()=>{accountMenuOpen=!accountMenuOpen;document.getElementById('userMenu').classList.toggle('hide',!accountMenuOpen)};
  document.getElementById('logoutBtn').onclick=()=>{session=null;saveSession();currentView='';accountMenuOpen=false;render()};
  document.getElementById('changePwBtn').onclick=openPasswordModal;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;renderShell(currentUser())});
  renderCurrentView(u);
}

function renderNav(){
  const items=[['home','홈'],['report','사고보고'],['incidents','사고목록'],['actions','후속조치'],['more','더보기']];
  const active=(currentView==='sites'||currentView==='users')?'more':currentView;
  return `<nav class="navtabs common-nav">${items.map(([v,t])=>`<button data-view="${v}" class="${active===v?'on':''}">${t}</button>`).join('')}</nav>`;
}

function renderCurrentView(u){
  const root=document.getElementById('view');
  if(currentView==='home')return renderUnifiedHome(root,u);
  if(currentView==='report')return renderUnifiedReport(root,u);
  if(currentView==='incidents')return renderUnifiedIncidents(root,u);
  if(currentView==='actions')return renderUnifiedActions(root,u);
  if(currentView==='sites'&&u.role==='safety')return renderSites(root,u);
  if(currentView==='users'&&u.role==='safety')return renderUsers(root,u);
  return renderMore(root,u);
}

function renderUnifiedHome(root,u){
  const arr=accessibleIncidents(u);
  const open=arr.filter(i=>i.status!=='closed').length;
  const actionNeeded=arr.filter(i=>i.status!=='closed'&&i.corrective?.status!=='approved').length;
  const done=arr.filter(i=>i.status==='closed').length;
  const urgent=arr.filter(i=>i.priority==='urgent'&&i.status!=='closed').length;
  root.innerHTML=`
    <div class="home-hero panel">
      <div><div class="ey">TODAY</div><h2>안전업무 한눈에 보기</h2><p>${esc(permissionFor(u).viewScope)} 기준으로 표시됩니다.</p></div>
      ${permissionFor(u).createIncident?'<button class="primary" data-home-go="report">사고 바로 보고</button>':''}
    </div>
    <div class="cards v3-cards">
      <div class="card"><span>조회 사고</span><b>${arr.length}</b></div>
      <div class="card important"><span>진행 중</span><b>${open}</b></div>
      <div class="card action"><span>후속조치 필요</span><b>${actionNeeded}</b></div>
      <div class="card urgent"><span>긴급 관리</span><b>${urgent}</b></div>
    </div>
    <div class="grid2">
      <div class="panel"><div class="section-head"><div><div class="ey">RECENT</div><h2>최근 사고</h2><p>최근 등록된 사고를 우선 표시합니다.</p></div><button class="secondary" data-home-go="incidents">전체보기</button></div>${incidentTable(arr.slice(0,8),u.role==='safety')}</div>
      <aside class="panel"><div class="section-head"><div><div class="ey">WORKFLOW</div><h2>처리 흐름</h2></div></div>
        <div class="flow-list"><div><b>1</b><span><strong>사고보고</strong><small>현장 기본정보·즉시조치·사진</small></span></div><div><b>2</b><span><strong>후속조치</strong><small>원인·개선내용·담당자·완료기한</small></span></div><div><b>3</b><span><strong>검토·완료</strong><small>안전관리자 확인 후 종결</small></span></div></div>
        <div class="mini-summary"><span>완료 ${done}건</span><span>미완료 ${open}건</span></div>
      </aside>
    </div>`;
  root.querySelectorAll('[data-home-go]').forEach(b=>b.onclick=()=>{currentView=b.dataset.homeGo;renderShell(u)});
  bindIncidentRows(u.role==='safety',u);
}

function renderUnifiedReport(root,u){
  const p=permissionFor(u);
  if(!p.createIncident){
    root.innerHTML=`<div class="panel permission-empty"><div class="lock-icon">🔒</div><h2>사고보고는 등록 권한이 없습니다.</h2><p>경영관리자 계정은 승인된 사고를 열람하는 권한만 제공합니다.</p><button class="secondary" data-go-incidents>사고목록 보기</button></div>`;
    root.querySelector('[data-go-incidents]').onclick=()=>{currentView='incidents';renderShell(u)};
    return;
  }
  const fixedSite=u.role==='field';
  const site=siteById(u.siteId);
  const siteControl=fixedSite
    ? `<input id="reportSite" value="${esc(site?.id||'')}" type="hidden"><input value="${esc(site?.name||'-')}" disabled>`
    : `<select id="reportSite" required><option value="">사업장 선택</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`;

  root.innerHTML=`<form id="unifiedReportForm" class="panel report-simple">
    <div class="section-head"><div><div class="ey">QUICK REPORT</div><h2>사고보고</h2><p>처음 보고할 때는 꼭 필요한 정보만 입력합니다.</p></div></div>
    <div class="formgrid">
      <label class="lbl"><span>사업장 *</span>${siteControl}</label>
      <label class="lbl"><span>발생 일시 *</span><input id="occurredAt" type="datetime-local" value="${localDT()}" required></label>
      <label class="lbl"><span>보고 구분 *</span><select id="category"><option value="person">대인사고</option><option value="property">대물사고</option><option value="near_miss">아차사고</option><option value="hazard">위험요인</option></select></label>
      <label class="lbl"><span>사고 유형 *</span><select id="eventType">${eventTypeOptions()}</select></label>
    </div>
    <label class="lbl"><span>사고 내용 *</span><textarea id="summary" rows="4" required placeholder="어디서 무엇을 하다가 어떻게 발생했는지 간단하게 입력"></textarea></label>
    <label class="lbl"><span>즉시조치 *</span><textarea id="immediateAction" rows="3" required placeholder="응급조치, 작업중지, 접근통제, 병원이송 등"></textarea></label>
    <div id="personFields" class="formgrid compact-person">
      <label class="lbl"><span>사고자 성명</span><input id="injuredName" placeholder="확인되는 경우 입력"></label>
      <label class="lbl"><span>직종/업무</span><input id="job" placeholder="예: 코스관리"></label>
    </div>
    <details class="advanced-box"><summary>추가 정보 입력 <small>선택사항</small></summary>
      <div class="formgrid advanced-grid">
        <label class="lbl"><span>사고 정도</span><select id="severity"><option value="minor">경미</option><option value="moderate">보통</option><option value="major">중대</option></select></label>
        <label class="lbl"><span>치료/휴업 예상</span><select id="leaveEstimate"><option value="unknown">미확인</option><option value="none">휴업 없음</option><option value="under3">3일 미만 예상</option><option value="3plus">3일 이상 예상</option><option value="longterm">장기치료/중상 가능</option></select></label>
      </div>
      <label class="check-line"><input id="potentialMajor" type="checkbox"> 피해가 작아도 중대사고로 이어질 가능성이 큼</label>
    </details>
    ${photoPickerHtml('incident')}
    <button class="primary full" type="submit">사고보고 등록</button>
  </form>`;
  incidentPhotos=[];renderPhotoThumbs('incident');bindPhotoButtons();
  const cat=document.getElementById('category');
  const togglePerson=()=>document.getElementById('personFields').classList.toggle('hide',cat.value!=='person');
  cat.onchange=togglePerson;togglePerson();
  document.getElementById('unifiedReportForm').onsubmit=e=>submitUnifiedIncident(e,u);
}

async function submitUnifiedIncident(e,u){
  e.preventDefault();
  const siteId=document.getElementById('reportSite').value;
  if(!siteId){alert('사업장을 선택해 주세요.');return}
  const category=document.getElementById('category').value;
  const severity=document.getElementById('severity').value;
  const eventType=document.getElementById('eventType').value;
  const leaveEstimate=document.getElementById('leaveEstimate').value;
  const potentialMajor=document.getElementById('potentialMajor').checked;
  const i={
    id:uid('inc'),siteId,category,eventType,severity,leaveEstimate,potentialMajor,
    injuredName:category==='person'?document.getElementById('injuredName').value.trim():'',
    job:category==='person'?document.getElementById('job').value.trim():'',
    summary:document.getElementById('summary').value.trim(),
    immediateAction:document.getElementById('immediateAction').value.trim(),
    photos:[...incidentPhotos],reporterName:u.name,reporterId:u.id,
    occurredAt:new Date(document.getElementById('occurredAt').value).toISOString(),
    createdAt:nowISO(),updatedAt:nowISO(),status:'reported',
    priority:computePriority(category,severity,eventType,potentialMajor,leaveEstimate),
    legalReview:computeLegalReview(category,severity,leaveEstimate),
    safetyNote:'',approvedBy:'',approvedAt:null,closedAt:null,corrective:null
  };
  data.incidents.unshift(i);saveData();incidentPhotos=[];
  alert(`사고가 접수되었습니다. 관리등급: ${priorityName(i.priority)}`);
  currentView='incidents';renderShell(u);
}

function renderUnifiedIncidents(root,u){
  const base=accessibleIncidents(u);
  root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">INCIDENTS</div><h2>사고 목록</h2><p>${esc(permissionFor(u).viewScope)} 범위에서 조회됩니다.</p></div></div>
    <div class="toolbar"><div class="left">
      ${u.role!=='field'?`<select id="siteFilter"><option value="">전체 사업장</option>${data.sites.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`:''}
      <select id="categoryFilter"><option value="">전체 구분</option><option value="person">대인사고</option><option value="property">대물사고</option><option value="near_miss">아차사고</option><option value="hazard">위험요인</option></select>
      <select id="statusFilter"><option value="">전체 상태</option><option value="reported">접수</option><option value="approved">조치중</option><option value="closed">완료</option></select>
    </div></div><div id="unifiedIncidentTable"></div></div>`;
  const refresh=()=>{
    let arr=[...base];
    const sf=document.getElementById('siteFilter')?.value||'';
    const cf=document.getElementById('categoryFilter').value;
    const st=document.getElementById('statusFilter').value;
    if(sf)arr=arr.filter(i=>i.siteId===sf);
    if(cf)arr=arr.filter(i=>i.category===cf);
    if(st)arr=arr.filter(i=>i.status===st);
    document.getElementById('unifiedIncidentTable').innerHTML=incidentTable(arr,u.role==='safety');
    bindIncidentRows(u.role==='safety',u);
  };
  ['siteFilter','categoryFilter','statusFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=refresh});
  refresh();
}

function renderUnifiedActions(root,u){
  if(u.role==='field')return renderFieldActions(root,u);
  if(u.role==='safety')return renderSafetyActions(root,u);
  const arr=accessibleIncidents(u).filter(i=>i.corrective);
  root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">FOLLOW-UP</div><h2>후속조치</h2><p>경영관리자는 안전관리자가 승인한 후속조치를 열람할 수 있습니다.</p></div></div>
    <div class="action-list">${arr.map(i=>`<div class="action-card"><div>${categoryBadge(i.category)}${statusBadge(i.status)}${actionBadge(i)}</div><h3>${esc(siteById(i.siteId)?.name||'-')} · ${esc(i.eventType)}</h3><p>${esc(i.summary)}</p><div class="action-grid"><div><b>조치내용</b><span>${esc(i.corrective?.actionDetail||'-')}</span></div><div><b>담당자</b><span>${esc(i.corrective?.ownerName||'-')}</span></div><div><b>완료기한</b><span>${esc(i.corrective?.dueDate||'-')}</span></div><div><b>검토의견</b><span>${esc(i.corrective?.reviewNote||'-')}</span></div></div></div>`).join('')||'<div class="empty">표시할 후속조치가 없습니다.</div>'}</div>
  </div>`;
}

function renderMore(root,u){
  const p=permissionFor(u);
  root.innerHTML=`<div class="grid2">
    <div class="panel"><div class="section-head"><div><div class="ey">MY ACCESS</div><h2>내 권한</h2><p>같은 앱을 사용하되 역할에 따라 가능한 기능만 달라집니다.</p></div></div>
      <div class="permission-list">
        <div><span>사고보고 등록</span><b>${p.createIncident?'가능':'불가'}</b></div>
        <div><span>사고 승인·수정·삭제</span><b>${p.manageIncident?'가능':'불가'}</b></div>
        <div><span>후속조치 작성</span><b>${p.writeAction?'가능':'열람만'}</b></div>
        <div><span>후속조치 검토</span><b>${p.reviewAction?'가능':'불가'}</b></div>
        <div><span>현장·사용자 관리</span><b>${p.manageMaster?'가능':'불가'}</b></div>
      </div>
    </div>
    <div class="panel"><div class="section-head"><div><div class="ey">TOOLS</div><h2>관리 메뉴</h2></div></div>
      ${u.role==='safety'?`<div class="tool-buttons"><button class="secondary" data-admin-view="sites">현장관리</button><button class="secondary" data-admin-view="users">사용자관리</button></div>`:'<div class="empty compact">추가 관리 메뉴는 안전관리자에게만 표시됩니다.</div>'}
      <div class="test-note" style="margin-top:12px">현재 데이터는 브라우저에 저장되는 테스트 버전입니다. 다음 단계에서 Supabase 인증·DB·실시간 저장으로 전환합니다.</div>
    </div>
  </div>`;
  root.querySelectorAll('[data-admin-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.adminView;renderShell(u)});
}
