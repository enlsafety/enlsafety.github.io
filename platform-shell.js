/* E&L Safety Platform v3.1.0 - 공통 플랫폼 골격 */
const ENL_PLATFORM_SECTION_KEY = 'enl_safety_platform_section';
let enlPlatformSection = localStorage.getItem(ENL_PLATFORM_SECTION_KEY) || 'hub';

const ENL_PLATFORM_MODULES = [
  {id:'hub',label:'통합홈',title:'통합홈',desc:'오늘 필요한 안전업무와 현황을 한눈에 확인합니다.'},
  {id:'incident',label:'사고관리',title:'사고·아차사고',desc:'사고보고, 사고목록, 후속조치와 종결을 관리합니다.'},
  {id:'inspection',label:'점검관리',title:'점검·개선조치',desc:'정기·수시점검과 개선조치를 사업장별로 관리합니다.'},
  {id:'risk',label:'위험성평가',title:'위험성평가',desc:'사업장별 위험요인, 위험도와 개선대책을 관리합니다.'},
  {id:'training',label:'교육관리',title:'안전교육',desc:'정기교육, 특별교육과 이수현황을 관리합니다.'},
  {id:'legal',label:'법정관리',title:'법정·문서관리',desc:'선임, 교육, 검사, 보고와 주요 문서 기한을 관리합니다.'}
];

function enlPlatformScope(u){
  if(u.role==='field') return `${siteById(u.siteId)?.name||'소속 사업장'} 범위`;
  if(u.role==='safety') return '전체 사업장 관리';
  return '전체 사업장 조회';
}

function enlSetPlatformSection(section,u){
  if(!ENL_PLATFORM_MODULES.some(m=>m.id===section)) section='hub';
  enlPlatformSection=section;
  try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,section)}catch(e){}
  if(section==='incident') currentView='home';
  renderShell(u||currentUser());
}

function enlPlatformNav(){
  return `<nav class="platform-nav" aria-label="안전보건 플랫폼 메뉴">${ENL_PLATFORM_MODULES.map(m=>`<button type="button" data-platform-section="${m.id}" class="${enlPlatformSection===m.id?'on':''}">${m.label}</button>`).join('')}</nav>`;
}

function enlPlatformIncidentStats(u){
  let arr=[...data.incidents];
  if(u.role==='field') arr=arr.filter(i=>i.siteId===u.siteId);
  if(u.role==='final') arr=arr.filter(i=>['approved','closed'].includes(i.status));
  const open=arr.filter(i=>i.status!=='closed').length;
  const action=arr.filter(i=>i.status!=='closed'&&i.corrective?.status!=='approved').length;
  const urgent=arr.filter(i=>i.priority==='urgent'&&i.status!=='closed').length;
  const recent=arr.sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)).slice(0,4);
  return {arr,open,action,urgent,recent};
}

function enlRenderPlatformHub(root,u){
  const s=enlPlatformIncidentStats(u);
  const canReport=u.role==='field'||u.role==='safety';
  root.innerHTML=`
    <section class="platform-hero panel">
      <div><div class="ey">E&L SAFETY HUB</div><h2>이앤엘 안전보건 통합 플랫폼</h2><p>${esc(enlPlatformScope(u))}에서 필요한 업무를 하나의 플랫폼에서 관리합니다.</p></div>
      ${canReport?'<button class="primary" data-platform-quick="incident">사고 바로 보고</button>':''}
    </section>

    <div class="cards platform-summary-cards">
      <div class="card"><span>진행 중 사고</span><b>${s.open}</b></div>
      <div class="card action"><span>후속조치 필요</span><b>${s.action}</b></div>
      <div class="card urgent"><span>긴급 관리</span><b>${s.urgent}</b></div>
      <div class="card"><span>운영 모듈</span><b>1</b><small>5개 골격 준비</small></div>
    </div>

    <section class="panel platform-module-panel">
      <div class="section-head"><div><div class="ey">MODULES</div><h2>업무 모듈</h2><p>사고관리는 바로 사용하고, 나머지 모듈은 같은 골격에서 차례대로 확장합니다.</p></div></div>
      <div class="platform-module-grid">
        ${ENL_PLATFORM_MODULES.filter(m=>m.id!=='hub').map(m=>`<button type="button" class="platform-module-card ${m.id==='incident'?'ready':''}" data-platform-section="${m.id}"><span class="module-state">${m.id==='incident'?'사용중':'골격 준비'}</span><strong>${m.title}</strong><small>${m.desc}</small><em>열기 →</em></button>`).join('')}
      </div>
    </section>

    <div class="grid2 platform-home-grid">
      <section class="panel"><div class="section-head"><div><div class="ey">RECENT</div><h2>최근 사고</h2><p>최근 등록된 사고 4건을 간단히 표시합니다.</p></div><button class="secondary" data-platform-quick="incident">사고관리 열기</button></div>
        <div class="platform-recent-list">${s.recent.map(i=>`<button type="button" class="platform-recent-row" data-platform-incident="${i.id}"><span><b>${esc(siteById(i.siteId)?.name||'-')}</b><small>${fmt(i.occurredAt)} · ${esc(i.eventType)}</small></span><span class="recent-summary">${esc(i.summary)}</span><span>${statusBadge(i.status)}</span></button>`).join('')||'<div class="empty compact">등록된 사고가 없습니다.</div>'}</div>
      </section>
      <aside class="panel"><div class="section-head"><div><div class="ey">ACCESS</div><h2>내 업무 범위</h2></div></div>
        <div class="platform-scope-box"><b>${roleName(u.role)}</b><span>${esc(enlPlatformScope(u))}</span></div>
        <div class="platform-rule-list">
          <div><span>사고관리</span><b>${u.role==='field'?'소속현장':u.role==='safety'?'전체관리':'전체조회'}</b></div>
          <div><span>점검·위험성평가</span><b>${u.role==='field'?'소속현장':u.role==='safety'?'전체관리':'전체조회'}</b></div>
          <div><span>교육·법정관리</span><b>${u.role==='safety'?'전체관리':u.role==='field'?'소속현장':'전체조회'}</b></div>
        </div>
      </aside>
    </div>`;

  root.querySelectorAll('[data-platform-section]').forEach(b=>b.onclick=()=>enlSetPlatformSection(b.dataset.platformSection,u));
  root.querySelectorAll('[data-platform-quick]').forEach(b=>b.onclick=()=>{
    enlPlatformSection='incident';
    try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}
    currentView=canReport&&b.textContent.includes('바로')?'report':'home';
    renderShell(u);
  });
  root.querySelectorAll('[data-platform-incident]').forEach(b=>b.onclick=()=>{
    enlPlatformSection='incident';
    try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}
    currentView='incidents';
    renderShell(u);
    setTimeout(()=>openIncidentModal(b.dataset.platformIncident,u.role==='safety',u),0);
  });
}

const ENL_PLATFORM_PLACEHOLDER = {
  inspection:{ey:'INSPECTION',title:'점검·개선조치',desc:'현장점검과 개선조치를 사고 후속조치와 같은 방식으로 연결하는 모듈입니다.',items:['정기·수시점검 등록','지적사항 담당자·완료기한 지정','조치 전후 사진과 완료 확인']},
  risk:{ey:'RISK ASSESSMENT',title:'위험성평가',desc:'사업장별 위험요인을 등록하고 개선대책과 이행상태를 관리하는 모듈입니다.',items:['사업장별 위험요인 목록','위험도 및 개선대책 기록','조치 진행상태와 이력관리']},
  training:{ey:'TRAINING',title:'안전교육',desc:'교육 대상, 실시내역과 이수현황을 관리하는 모듈입니다.',items:['정기·특별·관리감독자 교육','교육대상자 및 이수현황','교육자료·사진·서명 기록']},
  legal:{ey:'COMPLIANCE',title:'법정·문서관리',desc:'안전보건 관련 선임, 교육, 검사, 보고와 주요 문서를 일정 중심으로 관리하는 모듈입니다.',items:['법정 선임·교육·검사 일정','기한 임박·미완료 알림','사업장별 법정문서 보관·조회']}
};

function enlRenderPlatformPlaceholder(root,u,section){
  const m=ENL_PLATFORM_PLACEHOLDER[section];
  if(!m){enlPlatformSection='hub';return enlRenderPlatformHub(root,u)}
  root.innerHTML=`<section class="panel platform-placeholder">
    <div class="section-head"><div><div class="ey">${m.ey}</div><h2>${m.title}</h2><p>${m.desc}</p></div><span class="platform-skeleton-badge">골격 준비</span></div>
    <div class="platform-placeholder-grid">${m.items.map((x,n)=>`<div><b>0${n+1}</b><strong>${x}</strong><small>${u.role==='field'?'소속 사업장 기준':u.role==='safety'?'전체 사업장 관리 기준':'전체 사업장 조회 기준'}</small></div>`).join('')}</div>
    <div class="platform-next-note"><b>현재 단계</b><span>화면과 권한 골격만 먼저 만들었습니다. 실제 저장·조회 기능은 사고관리 구조를 재사용해 순서대로 붙이면 됩니다.</span></div>
    <button type="button" class="secondary" data-platform-back>통합홈으로</button>
  </section>`;
  root.querySelector('[data-platform-back]').onclick=()=>enlSetPlatformSection('hub',u);
}

function enlApplyPlatformFrame(u){
  document.title='이앤엘 안전보건 플랫폼';
  const brand=document.querySelector('.topbar .brand');
  if(brand){
    const h=brand.querySelector('h1'); if(h) h.textContent='안전보건 플랫폼';
    const p=brand.querySelector('p'); if(p) p.textContent='통합 안전보건 업무';
  }
  const main=document.querySelector('.main');
  if(!main) return;
  const existing=document.getElementById('platformNav');
  if(existing) existing.remove();
  const holder=document.createElement('div');
  holder.id='platformNav';holder.innerHTML=enlPlatformNav();
  const permission=main.querySelector('.permission-strip');
  if(permission) permission.insertAdjacentElement('beforebegin',holder); else main.insertAdjacentElement('afterbegin',holder);
  holder.querySelectorAll('[data-platform-section]').forEach(b=>b.onclick=()=>enlSetPlatformSection(b.dataset.platformSection,u));

  const strip=main.querySelector('.permission-strip');
  if(strip){
    strip.innerHTML=`<b>${roleName(u.role)}</b><span>플랫폼 범위: ${esc(enlPlatformScope(u))}</span><span>${enlPlatformSection==='incident'?'사고관리 모듈':enlPlatformSection==='hub'?'통합현황':'모듈 골격'}</span>`;
  }
  const accidentNav=main.querySelector('.common-nav');
  if(accidentNav) accidentNav.classList.toggle('platform-hidden',enlPlatformSection!=='incident');
  const root=document.getElementById('view');
  if(root&&enlPlatformSection==='hub') enlRenderPlatformHub(root,u);
  else if(root&&enlPlatformSection!=='incident') enlRenderPlatformPlaceholder(root,u,enlPlatformSection);

  const footer=document.querySelector('.footer-note');
  if(footer){
    const v=typeof ENL_DEPLOY_VERSION!=='undefined'?ENL_DEPLOY_VERSION:'3.1.0';
    footer.textContent=`이앤엘 안전보건 플랫폼 v${v} · TEST MODE`;
  }
}

const ENL_PLATFORM_BASE_RENDER_SHELL = renderShell;
renderShell = function(u){
  ENL_PLATFORM_BASE_RENDER_SHELL(u);
  enlApplyPlatformFrame(u);
};

const ENL_PLATFORM_BASE_RENDER_LOGIN = renderLogin;
renderLogin = function(){
  ENL_PLATFORM_BASE_RENDER_LOGIN();
  document.title='이앤엘 안전보건 플랫폼';
  const card=document.querySelector('.login-card');
  if(card){
    const h=card.querySelector('.login-brand h1'); if(h) h.textContent='이앤엘 안전보건 플랫폼';
    const p=card.querySelector('.login-brand p'); if(p) p.textContent='사고 · 점검 · 위험성평가 · 교육 · 법정관리';
  }
};

currentView = currentView || 'home';
render();
