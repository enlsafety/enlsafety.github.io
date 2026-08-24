/* E&L Accident Report App v4.0.2 - worker 4-menu home + prominent home buttons + HQ profile fields */
(function(){
  const VERSION='4.0.2';
  const baseShell=typeof renderShell==='function'?renderShell:null;

  function ex(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function workerUser(){try{const u=currentUser?.();return u?.role==='worker'?u:null}catch(e){return null}}
  function workerProxy(u){return {...u,role:'field',accessLevel:'worker',position:u.position||u.jobTitle||'일반근로자'} }

  function css(){
    if(document.getElementById('ui402Css'))return;
    const s=document.createElement('style');s.id='ui402Css';s.textContent=`
      .worker-shell .field-six-grid.worker-three-grid,.worker-shell .field-six-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .worker-shell [data-field-task="inquiry"]{display:grid!important}
      .field-task-back{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:0 0 14px!important;padding:8px 10px!important;border:1px solid #b8cee1!important;border-radius:12px!important;background:#eef5fb!important;box-shadow:0 3px 12px rgba(23,59,102,.08)!important}
      .field-task-back button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:42px!important;padding:0 15px!important;border:0!important;border-radius:10px!important;background:#173b66!important;color:#fff!important;font-size:14px!important;font-weight:950!important;box-shadow:0 3px 8px rgba(23,59,102,.18)!important;cursor:pointer!important;white-space:nowrap!important}
      .field-task-back button::first-letter{font-size:17px}.field-task-back span{color:#516b83!important;font-size:12px!important;font-weight:850!important;text-align:right!important}
      @media(max-width:560px){.worker-shell .field-six-grid.worker-three-grid,.worker-shell .field-six-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.worker-shell .field-six-btn{aspect-ratio:1/1!important;min-height:0!important}.field-task-back{position:sticky!important;top:4px!important;z-index:24!important;padding:7px!important}.field-task-back button{min-height:44px!important;font-size:15px!important;padding:0 14px!important}.field-task-back span{max-width:42%;font-size:11px!important;line-height:1.25!important}}
    `;document.head.appendChild(s);
  }

  function openWorkerInquiry(u){
    currentView='field-inquiry';
    try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
    renderShell(workerProxy(u));
  }

  function ensureWorkerFourMenu(){
    const u=workerUser();if(!u)return;
    const shell=document.querySelector('.app-shell');if(shell)shell.classList.add('worker-shell','field-simple-mode');
    const grid=document.querySelector('.field-six-home .field-six-grid');if(!grid)return;
    grid.classList.remove('worker-three-grid');
    const desired=['accident_report','accident_action','records','inquiry'];
    let inquiry=grid.querySelector('[data-field-task="inquiry"]');
    if(!inquiry){
      inquiry=document.createElement('button');
      inquiry.type='button';inquiry.className='field-six-btn';inquiry.dataset.fieldTask='inquiry';
      inquiry.innerHTML='<span class="field-six-no">04</span><strong>기타 문의</strong><small>안전관리자 정보 확인<br>및 문의</small>';
      inquiry.onclick=()=>openWorkerInquiry(u);
      grid.appendChild(inquiry);
    }
    desired.forEach((key,idx)=>{
      const b=grid.querySelector(`[data-field-task="${key}"]`);if(!b)return;
      b.style.display='';
      const no=b.querySelector('.field-six-no');if(no)no.textContent=String(idx+1).padStart(2,'0');
      grid.appendChild(b);
    });
  }

  function normalizeHomeButton(){
    document.querySelectorAll('.field-task-back button').forEach(b=>{
      if(/현장 홈으로|홈으로|돌아가기/.test(b.textContent||''))b.textContent='← 홈으로';
    });
  }
  function patchUi(){css();ensureWorkerFourMenu();normalizeHomeButton()}

  if(baseShell){
    renderShell=function(u){const r=baseShell(u);setTimeout(patchUi,35);return r};
  }

  const previousOpenUserModal=typeof openUserModal==='function'?openUserModal:null;
  openUserModal=function(user,u){
    const isNew=!user;
    const roleDefault=user?.role||'safety';
    openModal(`<div class="modal-head"><div><div class="ey">${isNew?'CREATE ACCOUNT':'EDIT ACCOUNT'}</div><h2>${isNew?'본사 사용자 계정 생성':'본사 사용자 정보 수정'}</h2></div><button class="x" data-close>×</button></div>
      <form id="userForm">
        <div class="formgrid">
          <label class="lbl"><span>이름 *</span><input id="uName" value="${ex(user?.name||'')}" required placeholder="예: 홍길동"></label>
          <label class="lbl"><span>로그인 아이디 *</span><input id="uLogin" value="${ex(user?.username||'')}" required placeholder="로그인할 아이디"></label>
          <label class="lbl"><span>부서</span><input id="uDepartment" value="${ex(user?.department||'')}" placeholder="예: 경영관리부"></label>
          <label class="lbl"><span>직급</span><input id="uPosition" value="${ex(user?.position||'')}" placeholder="예: 과장, 상무"></label>
          <label class="lbl"><span>역할 *</span><select id="uRole"><option value="safety" ${roleDefault==='safety'?'selected':''}>안전관리자</option><option value="final" ${roleDefault==='final'?'selected':''}>관리자</option>${roleDefault==='field'?'<option value="field" selected>현장관리</option>':''}</select></label>
          <label class="lbl"><span>소속 사업장</span><select id="uSite"><option value="">전체/해당없음</option>${(data.sites||[]).map(s=>`<option value="${ex(s.id)}" ${user?.siteId===s.id?'selected':''}>${ex(s.name)}</option>`).join('')}</select></label>
        </div>
        ${isNew?'<label class="lbl"><span>초기 비밀번호 *</span><input id="uPw" type="password" minlength="4" required placeholder="4자 이상"></label>':'<label class="lbl"><span>새 비밀번호 (선택)</span><input id="uPw" type="password" minlength="4" placeholder="변경하지 않으려면 비워두기"></label>'}
        <label class="lbl"><span>계정 상태</span><select id="uActive" ${user?.id===u.id?'disabled':''}><option value="true" ${user?.active!==false?'selected':''}>활성</option><option value="false" ${user?.active===false?'selected':''}>비활성</option></select></label>
        <button class="primary full">${isNew?'계정 생성':'변경사항 저장'}</button>
      </form>`);
    const roleEl=document.getElementById('uRole'),siteEl=document.getElementById('uSite');
    const toggleSite=()=>{const field=roleEl.value==='field';siteEl.closest('label')?.classList.toggle('hide',!field);if(!field)siteEl.value=''};roleEl.onchange=toggleSite;toggleSite();
    document.getElementById('userForm').onsubmit=async ev=>{
      ev.preventDefault();
      const name=document.getElementById('uName').value.trim();
      const username=document.getElementById('uLogin').value.trim();
      const department=document.getElementById('uDepartment').value.trim();
      const position=document.getElementById('uPosition').value.trim();
      const role=roleEl.value;
      const siteId=siteEl.value||null;
      const pw=document.getElementById('uPw').value;
      const active=document.getElementById('uActive').value==='true';
      if(role==='field'&&!siteId)return alert('현장관리 계정은 소속 사업장을 반드시 지정해야 합니다.');
      if((data.users||[]).some(x=>x.username===username&&x.id!==user?.id))return alert('이미 사용하는 로그인 아이디입니다.');
      if(isNew){
        data.users.push({id:uid('u'),username,name,department,position,role,siteId:role==='field'?siteId:null,passwordHash:await sha256(pw),active:true,createdAt:nowISO(),updatedAt:nowISO()});
      }else{
        if(user.id===u.id&&role!=='safety')return alert('현재 로그인한 안전관리자 자신의 역할은 변경할 수 없습니다.');
        user.name=name;user.username=username;user.department=department;user.position=position;user.role=role;user.siteId=role==='field'?siteId:null;user.active=user.id===u.id?true:active;user.updatedAt=nowISO();
        if(pw)user.passwordHash=await sha256(pw);
        if(user.id==='u-safety-demo'){user.role='safety';user.siteId=null;user.active=true;}
      }
      saveData();closeModal();renderShell(currentUser()||u);
    };
  };

  setTimeout(patchUi,120);
  window.ENL_DEPLOY_VERSION=VERSION;
})();
