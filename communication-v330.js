/* E&L Safety Communication v3.3.0 - 현장 ↔ 본사 빠른 안전 피드백 */
const ENL_COMM_SECTIONS = [
  {id:'hub',label:'안전현황',title:'안전현황',desc:'지금 확인하고 답해야 할 안전사항을 한눈에 봅니다.',ready:true},
  {id:'incident',label:'안전보고',title:'사고·아차·위험제보',desc:'현장에서 사고, 아차사고, 위험요인을 빠르게 본사에 알립니다.',ready:true},
  {id:'inspection',label:'안전점검',title:'안전점검·개선',desc:'현장 점검 결과를 공유하고 개선조치까지 이어갑니다.',ready:true},
  {id:'risk',label:'위험성평가/TBM',title:'위험성평가·TBM',desc:'현장의 위험요인과 작업 전 안전사항을 함께 공유합니다.',ready:false},
  {id:'training',label:'일용직관리',title:'일용직 안전관리',desc:'신규·일용근로자 투입 시 필요한 안전정보를 간단히 확인합니다.',ready:false}
];

function enlPlatformNav(){
  return `<nav class="platform-nav communication-nav" aria-label="이앤엘 안전소통 메뉴">${ENL_COMM_SECTIONS.map(m=>`<button type="button" data-platform-section="${m.id}" class="${enlPlatformSection===m.id?'on':''}">${m.label}</button>`).join('')}</nav>`;
}

function enlRenderPlatformHub(root,u){
  const s=enlPlatformIncidentStats(u);
  const ins=typeof enlInspectionStats==='function'?enlInspectionStats(u):{pending:0,overdue:0};
  const canReport=u.role==='field'||u.role==='safety';
  const newly=s.arr.filter(i=>i.status==='reported').length;
  const completed=s.arr.filter(i=>i.status==='closed').length;
  root.innerHTML=`
    <section class="platform-hero panel communication-hero">
      <div><div class="ey">E&L SAFETY CONNECT</div><h2>현장과 본사가 바로 주고받는 안전소통</h2><p>복잡한 입력보다 빠른 보고와 피드백에 집중합니다. ${esc(enlPlatformScope(u))} 기준입니다.</p></div>
      ${canReport?'<button class="primary" data-comm-report>안전내용 바로 알리기</button>':''}
    </section>
    <div class="communication-principle"><b>운영 원칙</b><span>현장 1~2분 입력 → 본사 확인·피드백 → 현장 조치 → 완료 확인</span></div>
    <div class="cards platform-summary-cards communication-summary">
      <div class="card"><span>새로 접수</span><b>${newly}</b><small>본사 확인 전</small></div>
      <div class="card action"><span>조치·피드백 필요</span><b>${s.action}</b><small>진행 중 안전보고</small></div>
      <div class="card important"><span>점검 미완료</span><b>${ins.pending}</b><small>개선 확인 필요</small></div>
      <div class="card"><span>완료</span><b>${completed}</b><small>조치 완료 보고</small></div>
    </div>
    <section class="panel platform-module-panel communication-module-panel">
      <div class="section-head"><div><div class="ey">QUICK ACCESS</div><h2>필요한 기능만 빠르게</h2><p>각 기능은 같은 계정과 사업장 정보를 사용하고, 현장 입력은 최대한 짧게 유지합니다.</p></div></div>
      <div class="platform-module-grid communication-module-grid">${ENL_COMM_SECTIONS.filter(m=>m.id!=='hub').map(m=>`<button type="button" class="platform-module-card ${m.ready?'ready':''}" data-platform-section="${m.id}"><span class="module-state">${m.ready?'사용 가능':'개발 예정'}</span><strong>${m.title}</strong><small>${m.desc}</small><em>${m.ready?'열기 →':'예정'}</em></button>`).join('')}</div>
    </section>
    <div class="grid2 platform-home-grid">
      <section class="panel"><div class="section-head"><div><div class="ey">RECENT</div><h2>최근 안전보고</h2><p>현장에서 최근 올라온 사고·아차·위험제보입니다.</p></div><button class="secondary" data-comm-open-report>안전보고 열기</button></div><div class="platform-recent-list">${s.recent.map(i=>`<button type="button" class="platform-recent-row" data-platform-incident="${i.id}"><span><b>${esc(siteById(i.siteId)?.name||'-')}</b><small>${fmt(i.occurredAt)} · ${categoryName(i.category)}</small></span><span class="recent-summary">${esc(i.summary)}</span><span>${statusBadge(i.status)}</span></button>`).join('')||'<div class="empty compact">등록된 안전보고가 없습니다.</div>'}</div></section>
      <aside class="panel communication-flow-panel"><div class="section-head"><div><div class="ey">FEEDBACK</div><h2>소통 흐름</h2></div></div><div class="flow-list"><div><b>1</b><span><strong>현장 보고</strong><small>사진·유형·간단한 내용만 전송</small></span></div><div><b>2</b><span><strong>본사 피드백</strong><small>확인·조치방향·담당내용 공유</small></span></div><div><b>3</b><span><strong>조치 완료</strong><small>완료 사진과 결과를 서로 확인</small></span></div></div><div class="platform-scope-box"><b>${roleName(u.role)}</b><span>${esc(enlPlatformScope(u))}</span></div></aside>
    </div>`;
  root.querySelectorAll('[data-platform-section]').forEach(b=>b.onclick=()=>enlSetPlatformSection(b.dataset.platformSection,u));
  const reportBtn=root.querySelector('[data-comm-report]');if(reportBtn)reportBtn.onclick=()=>{enlPlatformSection='incident';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}currentView='report';renderShell(u)};
  const openBtn=root.querySelector('[data-comm-open-report]');if(openBtn)openBtn.onclick=()=>{enlPlatformSection='incident';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}currentView='home';renderShell(u)};
  root.querySelectorAll('[data-platform-incident]').forEach(b=>b.onclick=()=>{enlPlatformSection='incident';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}currentView='incidents';renderShell(u);setTimeout(()=>openIncidentModal(b.dataset.platformIncident,u.role==='safety',u),0)});
}

const ENL_COMM_PLACEHOLDER = {
  risk:{ey:'RISK / TBM',title:'위험성평가·TBM',desc:'점검과 안전보고에서 확인된 위험요인을 위험성평가와 TBM으로 이어주는 기능입니다.',items:['현장 위험요인 간단 등록','위험성평가 결과 공유','TBM 핵심사항 확인·기록']},
  training:{ey:'DAILY WORKER',title:'일용직 안전관리',desc:'일용·신규근로자 투입 시 본사와 현장이 필요한 안전정보만 빠르게 확인하는 기능입니다.',items:['근로자 기본정보·투입현장','교육·자격 확인','현장 투입여부 간단 확인']}
};
function enlRenderPlatformPlaceholder(root,u,section){
  const m=ENL_COMM_PLACEHOLDER[section];
  if(!m){enlPlatformSection='hub';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}return enlRenderPlatformHub(root,u)}
  root.innerHTML=`<section class="panel platform-placeholder"><div class="section-head"><div><div class="ey">${m.ey}</div><h2>${m.title}</h2><p>${m.desc}</p></div><span class="platform-skeleton-badge">개발 예정</span></div><div class="platform-placeholder-grid">${m.items.map((x,n)=>`<div><b>0${n+1}</b><strong>${x}</strong><small>현장 입력은 짧게, 본사 확인은 빠르게 설계합니다.</small></div>`).join('')}</div><div class="platform-next-note"><b>개발 원칙</b><span>이 기능도 별도 거대 시스템으로 만들지 않고, 현장과 본사가 안전정보를 바로 주고받는 데 필요한 항목만 넣습니다.</span></div><button type="button" class="secondary" data-platform-back>안전현황으로</button></section>`;
  root.querySelector('[data-platform-back]').onclick=()=>enlSetPlatformSection('hub',u);
}

function enlApplyPlatformFrame(u){
  document.title='이앤엘 안전소통';
  const brand=document.querySelector('.topbar .brand');if(brand){const h=brand.querySelector('h1');if(h)h.textContent='안전소통';const p=brand.querySelector('p');if(p)p.textContent='현장 ↔ 본사 빠른 안전 피드백'}
  const main=document.querySelector('.main');if(!main)return;
  const existing=document.getElementById('platformNav');if(existing)existing.remove();
  const holder=document.createElement('div');holder.id='platformNav';holder.innerHTML=enlPlatformNav();
  const permission=main.querySelector('.permission-strip');if(permission)permission.insertAdjacentElement('beforebegin',holder);else main.insertAdjacentElement('afterbegin',holder);
  holder.querySelectorAll('[data-platform-section]').forEach(b=>b.onclick=()=>enlSetPlatformSection(b.dataset.platformSection,u));
  const strip=main.querySelector('.permission-strip');if(strip){const label=enlPlatformSection==='incident'?'안전보고':enlPlatformSection==='inspection'?'안전점검':enlPlatformSection==='hub'?'안전현황':enlPlatformSection==='risk'?'위험성평가/TBM':'일용직 안전관리';strip.innerHTML=`<b>${roleName(u.role)}</b><span>소통 범위: ${esc(enlPlatformScope(u))}</span><span>${label}</span>`}
  const accidentNav=main.querySelector('.common-nav');if(accidentNav)accidentNav.classList.toggle('platform-hidden',enlPlatformSection!=='incident');
  const root=document.getElementById('view');
  if(root&&enlPlatformSection==='hub')enlRenderPlatformHub(root,u);
  else if(root&&enlPlatformSection==='inspection'&&typeof enlRenderInspectionModule==='function')enlRenderInspectionModule(root,u);
  else if(root&&enlPlatformSection!=='incident')enlRenderPlatformPlaceholder(root,u,enlPlatformSection);
  const footer=document.querySelector('.footer-note');if(footer){const v=typeof ENL_DEPLOY_VERSION!=='undefined'?ENL_DEPLOY_VERSION:'3.3.0';footer.textContent=`이앤엘 안전소통 v${v} · TEST MODE · 현재 브라우저 저장 방식`}
}

renderNav=function(){
  const items=[['home','현황'],['report','현장보고'],['incidents','접수목록'],['actions','조치·피드백'],['more','설정']];
  const active=(currentView==='sites'||currentView==='users')?'more':currentView;
  return `<nav class="navtabs common-nav">${items.map(([v,t])=>`<button data-view="${v}" class="${active===v?'on':''}">${t}</button>`).join('')}</nav>`;
};

const ENL_COMM_BASE_HOME=renderUnifiedHome;
renderUnifiedHome=function(root,u){
  ENL_COMM_BASE_HOME(root,u);
  const hero=root.querySelector('.home-hero');if(hero){const h=hero.querySelector('h2');if(h)h.textContent='현장-본사 안전소통';const p=hero.querySelector('p');if(p)p.textContent=`${permissionFor(u).viewScope}에서 올라온 안전보고와 처리상태입니다.`;const btn=hero.querySelector('.primary');if(btn)btn.textContent='안전내용 바로 알리기'}
  const labels=root.querySelectorAll('.v3-cards .card span');['전체 보고','처리 중','조치·피드백 필요','긴급 확인'].forEach((t,i)=>{if(labels[i])labels[i].textContent=t});
  const recent=root.querySelector('.grid2 .panel .section-head');if(recent){const h=recent.querySelector('h2');if(h)h.textContent='최근 안전보고';const p=recent.querySelector('p');if(p)p.textContent='최근 현장에서 전달된 내용을 우선 표시합니다.'}
  const flow=root.querySelector('.grid2 aside');if(flow){const h=flow.querySelector('h2');if(h)h.textContent='소통 흐름';const strongs=flow.querySelectorAll('.flow-list strong');const smalls=flow.querySelectorAll('.flow-list small');['현장 보고','본사 피드백','조치 완료'].forEach((t,i)=>{if(strongs[i])strongs[i].textContent=t});['사고·아차·위험요인을 사진과 함께 전송','확인·조치방향·담당내용 공유','완료 결과를 확인하고 이력 보관'].forEach((t,i)=>{if(smalls[i])smalls[i].textContent=t})}
};

const ENL_COMM_BASE_REPORT=renderUnifiedReport;
renderUnifiedReport=function(root,u){
  ENL_COMM_BASE_REPORT(root,u);
  const h=root.querySelector('.section-head h2');if(h)h.textContent='현장 안전보고';
  const p=root.querySelector('.section-head p');if(p)p.textContent='사고·아차사고·위험요인을 1~2분 안에 본사로 전달합니다.';
  const labels=root.querySelectorAll('.lbl > span');labels.forEach(el=>{if(el.textContent.trim()==='보고 구분 *')el.textContent='보고 유형 *';if(el.textContent.trim()==='사고 유형 *')el.textContent='세부 유형 *';if(el.textContent.trim()==='사고 내용 *')el.textContent='내용 *';if(el.textContent.trim()==='즉시조치 *')el.textContent='현재 조치 *'});
  const summary=root.querySelector('#summary');if(summary)summary.placeholder='어디에서 무엇이 있었는지 간단하게 입력';
  const action=root.querySelector('#immediateAction');if(action)action.placeholder='응급조치, 작업중지, 접근통제 또는 현재 상태 입력';
  const submit=root.querySelector('button[type="submit"]');if(submit)submit.textContent='본사에 안전보고 전송';
  const lock=root.querySelector('.permission-empty h2');if(lock)lock.textContent='안전보고 등록 권한이 없습니다.';
};

const ENL_COMM_BASE_INCIDENTS=renderUnifiedIncidents;
renderUnifiedIncidents=function(root,u){ENL_COMM_BASE_INCIDENTS(root,u);const h=root.querySelector('.section-head h2');if(h)h.textContent='안전보고 목록';const p=root.querySelector('.section-head p');if(p)p.textContent=`${permissionFor(u).viewScope} 범위에서 현장 안전보고를 조회합니다.`};

const ENL_COMM_BASE_LOGIN=renderLogin;
renderLogin=function(){ENL_COMM_BASE_LOGIN();document.title='이앤엘 안전소통';const card=document.querySelector('.login-card');if(card){const h=card.querySelector('.login-brand h1');if(h)h.textContent='이앤엘 안전소통';const p=card.querySelector('.login-brand p');if(p)p.textContent='현장 보고 → 본사 피드백 → 조치 완료'}};

if(!ENL_COMM_SECTIONS.some(m=>m.id===enlPlatformSection)||enlPlatformSection==='legal'){enlPlatformSection='hub';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}}
currentView=currentView||'home';render();
