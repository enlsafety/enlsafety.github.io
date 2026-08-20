/* E&L Safety Communication v3.3.2 - 안전관리자 전용 관리자 설정 */
(function(){
  // 기존 현장 데이터에 인원값이 없으면 0으로 보정
  (data.sites||[]).forEach(s=>{if(!Number.isFinite(Number(s.workerCount)))s.workerCount=0;else s.workerCount=Math.max(0,Number(s.workerCount)||0)});
  saveData();

  // 기존 플랫폼 섹션 검사에서 관리자 설정을 허용하도록 등록
  try{
    if(typeof ENL_PLATFORM_MODULES!=='undefined'&&!ENL_PLATFORM_MODULES.some(m=>m.id==='admin')){
      ENL_PLATFORM_MODULES.push({id:'admin',label:'관리자 설정',title:'관리자 설정',desc:'현장, 인원, 사용자 계정과 권한을 관리합니다.',ready:true});
    }
  }catch(e){}

  function roleDesc(role){
    if(role==='field')return '소속 현장 안전보고·후속조치';
    if(role==='safety')return '전체 현장 조회·승인·수정·관리';
    if(role==='final')return '승인/완료된 안전보고 열람';
    return '지정된 범위 사용';
  }
  function siteHeadcount(s){return Math.max(0,Number(s?.workerCount)||0)}

  // 안전관리자에게만 상단 관리자 설정 탭 노출
  enlPlatformNav=function(){
    const u=currentUser();
    const items=[...ENL_COMM_SECTIONS];
    if(u?.role==='safety')items.push({id:'admin',label:'관리자 설정'});
    return `<nav class="platform-nav communication-nav" aria-label="이앤엘 안전소통 메뉴">${items.map(m=>`<button type="button" data-platform-section="${m.id}" class="${enlPlatformSection===m.id?'on':''}">${m.label}</button>`).join('')}</nav>`;
  };

  function openSiteEditModal(site,u){
    if(!site)return;
    openModal(`<div class="modal-head"><div><div class="ey">SITE SETTING</div><h2>현장 정보 수정</h2></div><button class="x" data-close>×</button></div>
      <form id="siteEditForm">
        <label class="lbl"><span>현장명 *</span><input id="editSiteName" value="${esc(site.name)}" required></label>
        <label class="lbl"><span>현재 근무인원 *</span><input id="editSiteWorkers" type="number" min="0" step="1" value="${siteHeadcount(site)}" required></label>
        <div class="help">현장별 현재 관리대상 인원을 입력합니다. 인원은 이후 현장현황·법정기준 검토용 기초값으로 활용할 수 있습니다.</div>
        <button class="primary full" type="submit">현장 정보 저장</button>
      </form>`);
    document.getElementById('siteEditForm').onsubmit=e=>{
      e.preventDefault();
      const name=document.getElementById('editSiteName').value.trim();
      const workerCount=Math.max(0,parseInt(document.getElementById('editSiteWorkers').value||'0',10)||0);
      if(data.sites.some(s=>s.id!==site.id&&s.name===name))return alert('같은 이름의 현장이 있습니다.');
      site.name=name;site.workerCount=workerCount;site.updatedAt=nowISO();saveData();closeModal();renderShell(u);
    };
  }

  function deleteSiteFromAdmin(site,u){
    if(!site)return;
    if(data.incidents.some(i=>i.siteId===site.id)||data.users.some(x=>x.siteId===site.id&&x.active))return alert('사고기록 또는 활성 사용자에 연결된 현장은 삭제할 수 없습니다.');
    if(!confirm(`${site.name} 현장을 삭제할까요?`))return;
    data.sites=data.sites.filter(s=>s.id!==site.id);saveData();renderShell(u);
  }

  function renderAdminConsole(root,u){
    if(u.role!=='safety'){
      root.innerHTML='<div class="panel permission-empty"><div class="lock-icon">🔒</div><h2>안전관리자 전용 메뉴입니다.</h2><p>현장·계정·권한 설정은 안전관리자만 사용할 수 있습니다.</p></div>';
      return;
    }
    const sites=[...data.sites];
    const activeUsers=data.users.filter(x=>x.active);
    root.innerHTML=`
      <section class="panel admin-console-head">
        <div class="section-head"><div><div class="ey">ADMIN SETTINGS</div><h2>관리자 설정</h2><p>현장 생성, 현장별 인원, 사용자 아이디·비밀번호·권한을 한 화면에서 관리합니다.</p></div></div>
        <div class="admin-summary-row"><div><span>등록 현장</span><b>${sites.length}</b></div><div><span>총 설정 인원</span><b>${sites.reduce((n,s)=>n+siteHeadcount(s),0)}</b></div><div><span>활성 사용자</span><b>${activeUsers.length}</b></div></div>
      </section>

      <section class="panel admin-console-section">
        <div class="section-head"><div><div class="ey">SITE & HEADCOUNT</div><h2>현장 생성 · 인원 설정</h2><p>현장을 추가하고 각 현장의 현재 관리대상 인원을 설정합니다.</p></div></div>
        <form id="adminSiteAdd" class="admin-inline-form">
          <label class="lbl"><span>현장명 *</span><input id="adminNewSiteName" placeholder="예: ○○ 골프장" required></label>
          <label class="lbl"><span>현재 근무인원 *</span><input id="adminNewSiteWorkers" type="number" min="0" step="1" value="0" required></label>
          <button class="primary" type="submit">+ 현장 생성</button>
        </form>
        <div class="admin-site-table">
          ${sites.map(s=>`<div class="admin-site-row"><div class="admin-site-main"><b>${esc(s.name)}</b><span>현재 근무인원 <strong>${siteHeadcount(s)}명</strong> · 연결 계정 ${data.users.filter(x=>x.siteId===s.id&&x.active).length}명</span></div><div class="row-actions"><button class="small-btn" data-edit-admin-site="${s.id}">수정</button><button class="small-btn red" data-delete-admin-site="${s.id}">삭제</button></div></div>`).join('')||'<div class="empty compact">등록된 현장이 없습니다.</div>'}
        </div>
      </section>

      <section class="panel admin-console-section">
        <div class="section-head"><div><div class="ey">ACCOUNT & PERMISSION</div><h2>사용자 계정 · 권한 설정</h2><p>각 사용자에게 로그인 아이디, 초기/재설정 비밀번호, 역할과 소속 현장을 부여합니다.</p></div><button class="primary" id="adminAddUserBtn">+ 사용자 계정 생성</button></div>
        <div class="admin-role-guide">
          <div><b>현장소장</b><span>소속 현장 안전보고·후속조치</span></div>
          <div><b>안전관리자</b><span>전체 현장 조회·승인·수정·관리</span></div>
          <div><b>최종관리자</b><span>승인·완료 안전보고 열람</span></div>
        </div>
        <div class="admin-user-table">
          ${data.users.map(x=>`<div class="admin-user-row ${x.active?'':'is-disabled'}"><div class="admin-user-main"><b>${esc(x.name)} ${x.active?'':'(비활성)'}</b><span><strong>아이디</strong> ${esc(x.username)} · <strong>권한</strong> ${roleName(x.role)} · <strong>소속</strong> ${esc(siteById(x.siteId)?.name||'전체/해당없음')}</span><small>${roleDesc(x.role)}</small></div><div class="row-actions"><button class="small-btn" data-admin-user-edit="${x.id}">정보·권한 수정</button><button class="small-btn" data-admin-user-pw="${x.id}">비밀번호 부여</button>${x.id!==u.id?`<button class="small-btn ${x.active?'red':'green'}" data-admin-user-toggle="${x.id}">${x.active?'비활성':'활성화'}</button>`:''}</div></div>`).join('')}
        </div>
        <div class="admin-security-note"><b>비밀번호 보안</b><span>저장된 비밀번호 원문은 표시하지 않습니다. 관리자는 새 비밀번호를 부여하거나 재설정할 수 있습니다.</span></div>
      </section>`;

    document.getElementById('adminSiteAdd').onsubmit=e=>{
      e.preventDefault();
      const name=document.getElementById('adminNewSiteName').value.trim();
      const workerCount=Math.max(0,parseInt(document.getElementById('adminNewSiteWorkers').value||'0',10)||0);
      if(!name)return;
      if(data.sites.some(s=>s.name===name))return alert('같은 이름의 현장이 있습니다.');
      data.sites.push({id:uid('site'),name,workerCount,createdAt:nowISO(),updatedAt:nowISO()});saveData();renderShell(u);
    };
    root.querySelectorAll('[data-edit-admin-site]').forEach(b=>b.onclick=()=>openSiteEditModal(siteById(b.dataset.editAdminSite),u));
    root.querySelectorAll('[data-delete-admin-site]').forEach(b=>b.onclick=()=>deleteSiteFromAdmin(siteById(b.dataset.deleteAdminSite),u));
    document.getElementById('adminAddUserBtn').onclick=()=>openUserModal(null,u);
    root.querySelectorAll('[data-admin-user-edit]').forEach(b=>b.onclick=()=>openUserModal(userById(b.dataset.adminUserEdit),u));
    root.querySelectorAll('[data-admin-user-pw]').forEach(b=>b.onclick=()=>openAdminPasswordReset(userById(b.dataset.adminUserPw),u));
    root.querySelectorAll('[data-admin-user-toggle]').forEach(b=>b.onclick=()=>{const x=userById(b.dataset.adminUserToggle);if(!x)return;x.active=!x.active;x.updatedAt=nowISO();saveData();renderShell(u)});
  }

  // 관리자 설정 섹션 렌더링 연결
  const basePlaceholder=enlRenderPlatformPlaceholder;
  enlRenderPlatformPlaceholder=function(root,u,section){
    if(section==='admin')return renderAdminConsole(root,u);
    return basePlaceholder(root,u,section);
  };

  // 프레임 라벨도 관리자 설정으로 표시
  const baseFrame=enlApplyPlatformFrame;
  enlApplyPlatformFrame=function(u){
    baseFrame(u);
    if(enlPlatformSection==='admin'){
      const strip=document.querySelector('.permission-strip');
      if(strip)strip.innerHTML=`<b>${roleName(u.role)}</b><span>관리 범위: 전체 사업장</span><span>관리자 설정</span>`;
    }
  };

  // 기존 '설정' 메뉴에서도 안전관리자가 바로 관리자 설정으로 이동할 수 있게 함
  const baseMore=renderMore;
  renderMore=function(root,u){
    if(u.role==='safety'){
      root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">ADMIN</div><h2>관리자 설정</h2><p>현장·인원·사용자 계정과 권한을 관리합니다.</p></div></div><button class="primary full" id="goAdminConsole">관리자 설정 열기</button></div>`;
      document.getElementById('goAdminConsole').onclick=()=>{enlPlatformSection='admin';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'admin')}catch(e){}renderShell(u)};
      return;
    }
    baseMore(root,u);
  };

  try{render()}catch(e){console.warn('admin console refresh skipped',e)}
})();
