/* E&L Accident Report App v3.7.5 - simplify field/safety/operations UI */
(function(){
  const originalRoleName=typeof roleName==='function'?roleName:null;
  roleName=function(role){
    if(role==='field')return '현장소장';
    if(role==='safety')return '안전관리자';
    if(role==='final')return '운영관리';
    return originalRoleName?originalRoleName(role):'사용자';
  };

  function setAppName(){
    document.title='이앤엘 사고보고앱';
    const brand=document.querySelector('.topbar .brand');
    if(brand){
      const h=brand.querySelector('h1');if(h)h.textContent='사고보고앱';
      const p=brand.querySelector('p');if(p)p.textContent='사고 보고 · 대책조치 · 기록관리';
    }
    const login=document.querySelector('.login-brand');
    if(login){
      const h=login.querySelector('h1');if(h)h.textContent='이앤엘 사고보고앱';
      const p=login.querySelector('p');if(p)p.textContent='현장 사고 보고 · 대책조치 · 기록관리';
    }
    const footer=document.querySelector('.footer-note');
    if(footer)footer.textContent=`이앤엘 사고보고앱 v${typeof ENL_DEPLOY_VERSION!=='undefined'?ENL_DEPLOY_VERSION:'3.7.5'} · TEST MODE`;
  }

  function replaceLegacyRoleText(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let n;
    while((n=walker.nextNode())){
      const p=n.parentElement;if(!p||['SCRIPT','STYLE'].includes(p.tagName))continue;
      if(n.nodeValue&&(/최종관리자|경영관리자/.test(n.nodeValue)))nodes.push(n);
    }
    nodes.forEach(x=>{x.nodeValue=x.nodeValue.replaceAll('최종관리자','운영관리').replaceAll('경영관리자','운영관리')});
  }

  function closeUserMenu(){
    accountMenuOpen=false;
    document.getElementById('userMenu')?.classList.add('hide');
  }
  if(!window.__enlUserOutsideBound){
    window.__enlUserOutsideBound=true;
    document.addEventListener('click',e=>{
      const wrap=document.querySelector('.user-wrap');
      if(wrap&&!wrap.contains(e.target))closeUserMenu();
    },true);
  }

  function simplifyUserControl(u){
    if(u?.role==='field')document.querySelector('.user-chip .avatar')?.remove();
    const chip=document.getElementById('userChip');
    if(chip){
      chip.setAttribute('aria-expanded',String(!document.getElementById('userMenu')?.classList.contains('hide')));
      chip.title='사용자 설정';
    }
  }

  function compactFieldHome(){
    const home=document.querySelector('.field-six-home');if(!home)return;
    home.classList.add('field-home-compact');
    const head=home.querySelector('.field-six-head');
    if(head){
      const p=head.querySelector('p');if(p)p.remove();
      const role=head.querySelector('.field-six-role');if(role)role.textContent=role.textContent.replace('현장담당자','현장소장');
    }
  }

  function safetyStats(){
    const arr=[...(data.incidents||[])].sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt));
    return {
      arr,
      reported:arr.filter(i=>i.status==='reported').length,
      action:arr.filter(i=>i.status!=='closed'&&i.corrective?.status!=='approved').length,
      done:arr.filter(i=>i.status==='closed').length
    };
  }

  function simpleIncidentRows(arr,u){
    if(!arr.length)return '<div class="empty compact">등록된 사고가 없습니다.</div>';
    return `<div class="simple-incident-list">${arr.slice(0,6).map(i=>`<button type="button" class="simple-incident-row" data-simple-inc="${i.id}"><span><b>${esc(siteById(i.siteId)?.name||'-')}</b><small>${fmt(i.occurredAt)} · ${esc(i.eventType||categoryName(i.category))}</small></span><strong>${esc(i.summary||'').slice(0,48)}</strong><em>${statusName(i.status)}</em></button>`).join('')}</div>`;
  }

  function renderSafetySimpleHome(root,u){
    const s=safetyStats();
    root.innerHTML=`<section class="safety-simple-home">
      <div class="simple-home-head"><div><h2>사고현황</h2><p>현장에서 접수된 사고와 대책조치 상태만 확인합니다.</p></div><button type="button" class="primary" data-safety-go="incidents">사고목록 보기</button></div>
      <div class="simple-stat-grid">
        <button type="button" data-safety-go="incidents"><span>전체 사고</span><b>${s.arr.length}</b></button>
        <button type="button" data-safety-go="incidents"><span>검토 대기</span><b>${s.reported}</b></button>
        <button type="button" data-safety-go="actions"><span>대책조치 필요</span><b>${s.action}</b></button>
        <button type="button" data-safety-go="incidents"><span>완료</span><b>${s.done}</b></button>
      </div>
      <section class="panel simple-recent-panel"><div class="section-head"><div><h2>최근 사고보고</h2><p>최근 등록 순으로 6건만 표시합니다.</p></div></div>${simpleIncidentRows(s.arr,u)}</section>
    </section>`;
    root.querySelectorAll('[data-safety-go]').forEach(b=>b.onclick=()=>goSafety(b.dataset.safetyGo,u));
    root.querySelectorAll('[data-simple-inc]').forEach(b=>b.onclick=()=>openIncidentModal(b.dataset.simpleInc,true,u));
  }

  function goSafety(target,u){
    if(target==='home'){
      enlPlatformSection='hub';currentView='home';
    }else if(target==='admin'){
      enlPlatformSection='admin';currentView='more';
    }else{
      enlPlatformSection='incident';currentView=target;
    }
    try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}
    renderShell(u);
  }

  function insertSafetyNav(u){
    document.getElementById('platformNav')?.classList.add('app-hidden-nav');
    document.querySelector('.permission-strip')?.classList.add('app-hidden-nav');
    document.querySelector('.common-nav')?.classList.add('app-hidden-nav');
    const main=document.querySelector('.main'),view=document.getElementById('view');
    if(!main||!view)return;
    document.getElementById('safetySimpleNav')?.remove();
    const nav=document.createElement('nav');
    nav.id='safetySimpleNav';nav.className='simple-app-nav';
    const active=enlPlatformSection==='admin'?'admin':(enlPlatformSection==='incident'&&['incidents','actions'].includes(currentView)?currentView:'home');
    const items=[['home','사고현황'],['incidents','사고목록'],['actions','사고 대책조치'],['admin','사용자·현장 설정']];
    nav.innerHTML=items.map(([k,t])=>`<button type="button" data-safety-tab="${k}" class="${active===k?'on':''}">${t}</button>`).join('');
    view.insertAdjacentElement('beforebegin',nav);
    nav.querySelectorAll('[data-safety-tab]').forEach(b=>b.onclick=()=>goSafety(b.dataset.safetyTab,u));
    if(active==='home')renderSafetySimpleHome(view,u);
  }

  function goOperations(target,u){
    enlPlatformSection='incident';
    currentView=target==='home'?'home':'incidents';
    try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}
    renderShell(u);
  }
  function insertOperationsNav(u){
    document.getElementById('platformNav')?.classList.add('app-hidden-nav');
    document.querySelector('.permission-strip')?.classList.add('app-hidden-nav');
    document.querySelector('.common-nav')?.classList.add('app-hidden-nav');
    const view=document.getElementById('view');if(!view)return;
    document.getElementById('operationsSimpleNav')?.remove();
    const nav=document.createElement('nav');nav.id='operationsSimpleNav';nav.className='simple-app-nav operations-nav';
    const active=currentView==='incidents'?'incidents':'home';
    nav.innerHTML=`<button type="button" data-op-tab="home" class="${active==='home'?'on':''}">사고현황</button><button type="button" data-op-tab="incidents" class="${active==='incidents'?'on':''}">사고목록</button>`;
    view.insertAdjacentElement('beforebegin',nav);
    nav.querySelectorAll('[data-op-tab]').forEach(b=>b.onclick=()=>goOperations(b.dataset.opTab,u));
  }

  function applyAll(u){
    setAppName();replaceLegacyRoleText();simplifyUserControl(u);
    document.body.classList.toggle('role-field',u?.role==='field');
    document.body.classList.toggle('role-safety',u?.role==='safety');
    document.body.classList.toggle('role-operations',u?.role==='final');
    if(u?.role==='field')compactFieldHome();
    if(u?.role==='safety')insertSafetyNav(u);
    if(u?.role==='final')insertOperationsNav(u);
  }

  const baseShell=renderShell;
  renderShell=function(u){const r=baseShell(u);applyAll(u);return r};
  const baseLogin=renderLogin;
  renderLogin=function(){const r=baseLogin();setAppName();replaceLegacyRoleText();return r};

  setTimeout(()=>{
    const u=currentUser();
    if(u)renderShell(u);else renderLogin();
  },0);
})();
