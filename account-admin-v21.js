// ENL Safety v2.1 - safety manager account & user administration patch
const ENL_PRIMARY_SAFETY_PASSWORD_HASH='9c9efdf3f10d01ab10507fbb55277f1ac99f2b3a469e043de745dd166e8990ee';
const ENL_PRIMARY_SAFETY_MIGRATION_KEY='enl_safety_primary_account_v21_done';

function ensurePrimarySafetyAccount(){
  let primary=data.users.find(x=>x.id==='u-safety-demo');
  if(!primary) primary=data.users.find(x=>x.role==='safety'&&x.username==='safety');
  if(!primary) primary=data.users.find(x=>x.role==='safety'&&x.username==='박태영');
  const migrated=localStorage.getItem(ENL_PRIMARY_SAFETY_MIGRATION_KEY)==='1';
  if(!primary){
    primary={id:'u-safety-demo',username:'박태영',name:'박태영',role:'safety',siteId:null,passwordHash:ENL_PRIMARY_SAFETY_PASSWORD_HASH,active:true,createdAt:nowISO()};
    data.users.push(primary);
    localStorage.setItem(ENL_PRIMARY_SAFETY_MIGRATION_KEY,'1');
  }else if(!migrated){
    primary.username='박태영';
    primary.name='박태영';
    primary.role='safety';
    primary.siteId=null;
    primary.passwordHash=ENL_PRIMARY_SAFETY_PASSWORD_HASH;
    primary.active=true;
    localStorage.setItem(ENL_PRIMARY_SAFETY_MIGRATION_KEY,'1');
  }
  // 기본 안전관리자 계정은 관리자 권한을 유지한다. 비밀번호는 최초 전환 후 사용자가 변경할 수 있다.
  if(primary.id==='u-safety-demo'){
    primary.role='safety';primary.siteId=null;primary.active=true;
  }
  data.users.filter(x=>x.id!==primary.id&&x.username==='박태영').forEach(x=>x.active=false);
  saveData();
}

renderLogin=function(){
  app.innerHTML=`<div class="login-page"><div class="login-card">
    <div class="login-brand"><div class="logo">E&L</div><div><h1>이앤엘 사고보고</h1><p>현장 사고 · 개선조치 · 승인 관리</p></div></div>
    <form id="loginForm">
      <label><span>아이디</span><input id="loginId" autocomplete="username" placeholder="아이디 입력" required></label>
      <label><span>비밀번호</span><input id="loginPw" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required></label>
      <div id="loginError" class="login-error hide"></div>
      <button class="primary" type="submit">로그인</button>
    </form>
    <div class="demo-box"><b>테스트 계정</b>
      <div class="demo-row"><span>현장소장</span><span>field01 / 1111</span></div>
      <div class="demo-row"><span>안전관리자</span><span>박태영 / 890130</span></div>
      <div class="demo-row"><span>최종관리자</span><span>manager / 3333</span></div>
    </div>
    <div class="test-note">현재 버전은 화면·업무흐름 테스트용입니다. 계정과 사고 데이터는 이 브라우저에 저장되며, 실제 운영 전 Supabase 인증·실시간 저장으로 전환합니다.</div>
  </div></div>`;
  document.getElementById('loginForm').onsubmit=doLogin;
};

renderUsers=function(root,u){
  const activeCount=data.users.filter(x=>x.active).length;
  const fieldCount=data.users.filter(x=>x.active&&x.role==='field').length;
  const safetyCount=data.users.filter(x=>x.active&&x.role==='safety').length;
  const finalCount=data.users.filter(x=>x.active&&x.role==='final').length;
  root.innerHTML=`<div class="panel">
    <div class="section-head"><div><div class="ey">ACCOUNT & ROLE MANAGEMENT</div><h2>사용자·권한 관리</h2><p>안전관리자가 계정을 생성하고 로그인 정보, 역할, 소속 사업장, 비밀번호와 사용상태를 관리합니다.</p></div><button class="primary" id="addUserBtn">+ 계정 생성</button></div>
    <div class="cards" style="grid-template-columns:repeat(4,1fr)">
      <div class="card"><span>활성 계정</span><b>${activeCount}</b></div>
      <div class="card"><span>현장소장</span><b>${fieldCount}</b></div>
      <div class="card"><span>안전관리자</span><b>${safetyCount}</b></div>
      <div class="card"><span>최종관리자</span><b>${finalCount}</b></div>
    </div>
    <div class="law-box" style="margin:12px 0">안전관리자는 모든 계정의 <b>아이디·이름·역할·소속·비밀번호</b>를 수정할 수 있습니다. 본인 계정은 실수 방지를 위해 안전관리자 역할 및 활성 상태를 해제할 수 없습니다.</div>
    <div class="user-list">${data.users.map(x=>`<div class="row-card"><div><b>${esc(x.name)} ${x.active?'':'<span style="color:#b33">(비활성)</span>'}</b><br><span>아이디 ${esc(x.username)} · ${roleName(x.role)} · ${esc(siteById(x.siteId)?.name||'전체/해당없음')}</span></div><div class="row-actions"><button class="small-btn" data-edit-user="${x.id}">정보수정</button><button class="small-btn" data-reset-user="${x.id}">비밀번호 설정</button>${x.id!==u.id?`<button class="small-btn ${x.active?'red':'green'}" data-toggle-user="${x.id}">${x.active?'비활성':'활성화'}</button>`:''}</div></div>`).join('')}</div>
  </div>`;
  document.getElementById('addUserBtn').onclick=()=>openUserModal(null,u);
  root.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openUserModal(userById(b.dataset.editUser),u));
  root.querySelectorAll('[data-reset-user]').forEach(b=>b.onclick=()=>openAdminPasswordReset(userById(b.dataset.resetUser),u));
  root.querySelectorAll('[data-toggle-user]').forEach(b=>b.onclick=()=>{
    const x=userById(b.dataset.toggleUser);
    if(!x)return;
    x.active=!x.active;saveData();renderShell(u);
  });
};

openUserModal=function(user,u){
  const isNew=!user;
  openModal(`<div class="modal-head"><div><div class="ey">${isNew?'CREATE ACCOUNT':'EDIT ACCOUNT'}</div><h2>${isNew?'계정 생성':'계정 정보 수정'}</h2></div><button class="x" data-close>×</button></div>
    <form id="userForm">
      <div class="formgrid">
        <label class="lbl"><span>이름 *</span><input id="uName" value="${esc(user?.name||'')}" required placeholder="예: 홍길동"></label>
        <label class="lbl"><span>로그인 아이디 *</span><input id="uLogin" value="${esc(user?.username||'')}" required placeholder="로그인할 아이디"></label>
        <label class="lbl"><span>역할 *</span><select id="uRole"><option value="field" ${user?.role==='field'?'selected':''}>현장소장</option><option value="safety" ${user?.role==='safety'?'selected':''}>안전관리자</option><option value="final" ${user?.role==='final'?'selected':''}>최종관리자</option></select></label>
        <label class="lbl"><span>소속 사업장</span><select id="uSite"><option value="">전체/해당없음</option>${data.sites.map(s=>`<option value="${s.id}" ${user?.siteId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
      </div>
      ${isNew?'<label class="lbl"><span>초기 비밀번호 *</span><input id="uPw" type="password" minlength="4" required placeholder="4자 이상"></label>':'<label class="lbl"><span>새 비밀번호 (선택)</span><input id="uPw" type="password" minlength="4" placeholder="변경하지 않으려면 비워두기"></label>'}
      <label class="lbl"><span>계정 상태</span><select id="uActive" ${user?.id===u.id?'disabled':''}><option value="true" ${user?.active!==false?'selected':''}>활성</option><option value="false" ${user?.active===false?'selected':''}>비활성</option></select></label>
      <button class="primary full">${isNew?'계정 생성':'변경사항 저장'}</button>
    </form>`);
  document.getElementById('userForm').onsubmit=async e=>{
    e.preventDefault();
    const name=document.getElementById('uName').value.trim();
    const username=document.getElementById('uLogin').value.trim();
    const role=document.getElementById('uRole').value;
    const siteId=document.getElementById('uSite').value||null;
    const pw=document.getElementById('uPw').value;
    const active=document.getElementById('uActive').value==='true';
    if(role==='field'&&!siteId)return alert('현장소장은 소속 사업장을 반드시 지정해야 합니다.');
    if(data.users.some(x=>x.username===username&&x.id!==user?.id))return alert('이미 사용하는 로그인 아이디입니다.');
    if(isNew){
      data.users.push({id:uid('u'),username,name,role,siteId:role==='field'?siteId:null,passwordHash:await sha256(pw),active:true,createdAt:nowISO(),updatedAt:nowISO()});
    }else{
      if(user.id===u.id&&role!=='safety')return alert('현재 로그인한 안전관리자 자신의 역할은 변경할 수 없습니다.');
      user.name=name;user.username=username;user.role=role;user.siteId=role==='field'?siteId:null;user.active=user.id===u.id?true:active;user.updatedAt=nowISO();
      if(pw)user.passwordHash=await sha256(pw);
      if(user.id==='u-safety-demo'){
        user.role='safety';user.siteId=null;user.active=true;
      }
    }
    saveData();closeModal();renderShell(currentUser()||u);
  };
};

function openAdminPasswordReset(target,u){
  if(!target)return;
  openModal(`<div class="modal-head"><div><div class="ey">PASSWORD RESET</div><h2>비밀번호 설정</h2><p>${esc(target.name)} · ${esc(target.username)}</p></div><button class="x" data-close>×</button></div>
    <form id="adminPwForm"><label class="lbl"><span>새 비밀번호 *</span><input id="adminNewPw" type="password" minlength="4" required placeholder="4자 이상"></label><label class="lbl"><span>새 비밀번호 확인 *</span><input id="adminNewPw2" type="password" minlength="4" required></label><button class="primary full">비밀번호 저장</button></form>`);
  document.getElementById('adminPwForm').onsubmit=async e=>{
    e.preventDefault();const a=document.getElementById('adminNewPw').value,b=document.getElementById('adminNewPw2').value;
    if(a!==b)return alert('새 비밀번호가 서로 다릅니다.');
    target.passwordHash=await sha256(a);target.updatedAt=nowISO();saveData();closeModal();alert(`${target.name} 계정의 비밀번호가 변경되었습니다.`);renderShell(u);
  };
}

ensurePrimarySafetyAccount();
currentView='';
render();
