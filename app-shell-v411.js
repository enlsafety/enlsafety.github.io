/* E&L Accident Report App v4.1.1 - single authoritative shell/router */
(function(){
  'use strict';
  const VERSION='4.1.1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const isField=u=>!!u&&['field','worker'].includes(u.role);
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  let safetyListFilter={status:'',siteId:'',title:'전체 사고목록'};

  function css(){if(document.getElementById('shell411Css'))return;const s=document.createElement('style');s.id='shell411Css';s.textContent=`
    .app-shell.shell-v411 .main{max-width:1180px;margin:0 auto;padding:16px}.shell411-nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 14px}.shell411-nav button{min-height:44px;border:1px solid #c7d6e3;border-radius:11px;background:#fff;color:#36536f;padding:0 14px;font-weight:900}.shell411-nav button.on{background:#173b66;border-color:#173b66;color:#fff}.shell411-safety-home{display:grid;gap:13px}.shell411-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.shell411-head h2{margin:0;color:#173b66;font-size:25px}.shell411-head p{margin:5px 0 0;color:#6a7e90}.shell411-stat{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.shell411-stat button{appearance:none;width:100%;padding:14px;border:2px solid #d8e3ed;border-radius:13px;background:#fff;text-align:left;cursor:pointer}.shell411-stat button:hover,.shell411-stat button:focus-visible{border-color:#1e5d91;outline:none;box-shadow:0 6px 16px rgba(30,93,145,.10)}.shell411-stat span{display:block;color:#718294;font-size:11px;font-weight:850}.shell411-stat b{display:block;margin-top:5px;color:#173b66;font-size:25px}.shell411-site-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.shell411-site{border:1px solid #d8e3ed;border-radius:13px;background:#fff;padding:13px;text-align:left;color:inherit;cursor:pointer}.shell411-site:hover,.shell411-site:focus-visible{border-color:#1e5d91;outline:none;box-shadow:0 5px 14px rgba(30,93,145,.09)}.shell411-site h3{margin:0;color:#173b66;font-size:15px}.shell411-site div{display:flex;gap:10px;margin-top:10px}.shell411-site span{font-size:10px;color:#748698}.shell411-site b{display:block;margin-top:2px;color:#304c65;font-size:17px}.shell411-site small{display:block;margin-top:8px;color:#8090a0}.shell411-recent{display:grid;gap:7px}.shell411-recent button{display:grid;grid-template-columns:110px 130px minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;padding:11px;border:1px solid #dce5ed;border-radius:11px;background:#fff;text-align:left;color:inherit;cursor:pointer}.shell411-recent button:hover,.shell411-recent button:focus-visible{border-color:#1e5d91;outline:none}.shell411-recent b{color:#173b66}.shell411-recent span,.shell411-recent small{font-size:11px;color:#65798c}.shell411-filter-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}.shell411-filter-head h2{margin:0;color:#173b66}.shell411-filter-head p{margin:5px 0 0;color:#6b7e90}.shell411-filter-head button{min-height:42px;border:2px solid #173b66;border-radius:10px;background:#fff;color:#173b66;padding:0 13px;font-weight:900}.shell411-fatal{max-width:680px;margin:40px auto;padding:24px;border:2px solid #e1b5b5;border-radius:18px;background:#fff7f7}.shell411-fatal h2{color:#8d3333}.shell411-fatal button{min-height:48px;border:0;border-radius:10px;background:#1e5d91;color:#fff;padding:0 16px;font-weight:900}@media(max-width:900px){.shell411-stat{grid-template-columns:repeat(3,minmax(0,1fr))}.shell411-site-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:800px){.shell411-recent button{grid-template-columns:85px minmax(0,1fr) auto}.shell411-recent .site{display:none}}@media(max-width:560px){.app-shell.shell-v411 .main{padding:10px 8px}.shell411-nav{overflow-x:auto;flex-wrap:nowrap;padding-bottom:3px}.shell411-nav button{white-space:nowrap;min-height:42px}.shell411-head h2{font-size:22px}.shell411-stat{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.shell411-stat button{padding:11px}.shell411-stat b{font-size:22px}.shell411-site-grid{gap:7px}.shell411-site{padding:11px}.shell411-recent button{grid-template-columns:78px minmax(0,1fr) auto;padding:9px}.shell411-recent .summary{font-size:11px}}
  `;document.head.appendChild(s)}

  function logout(){session=null;saveSession();currentView='';try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}renderLogin()}
  function navItems(u){if(isField(u))return [];if(u.role==='safety')return [['home','사고현황'],['incidents','전체 사고'],['actions','사고 조치'],['more','사용자·현장 설정']];return [['home','사고현황'],['incidents','승인 사고']]}
  function navHtml(u){const items=navItems(u);return items.length?`<nav class="shell411-nav">${items.map(([v,t])=>`<button type="button" data-shell-view="${v}" class="${currentView===v?'on':''}">${t}</button>`).join('')}</nav>`:''}

  function buildShell(u){
    const site=isField(u)?siteName(u.siteId):'전체 사업장';
    app.innerHTML=`<div class="app-shell shell-v411 ${isField(u)?'field-simple-mode':''}"><header class="topbar"><div class="brand"><div class="logo">E&L</div><div><h1>사고보고앱</h1><p>${u.role==='safety'?'전체 사업장 사고관리':isField(u)?'현장 사고 보고 · 조치 · 기록':'승인 사고 조회'}</p></div></div><div class="user-wrap"><button id="userChip" class="user-chip"><div class="avatar">${escx((u.name||'사용자').slice(0,2))}</div><div><b>${escx(u.name||'사용자')}</b><small>${roleName(u.role)} · ${escx(site)}</small></div><span class="chev">⌄</span></button><div id="userMenu" class="user-menu hide"><div class="who"><b>${escx(u.name||'사용자')}</b><span>${roleName(u.role)} · ${escx(site)}</span></div>${u.role==='field'&&MANAGER_POSITIONS.includes(String(u.position||''))?'<button id="personnelBtn411">사업장 근무자 관리</button>':''}${u.role==='safety'?'<button id="settingsBtn411">사용자·현장 설정</button>':''}<button id="logoutBtn" class="danger">로그아웃</button></div></div></header><main class="main">${navHtml(u)}<div id="view"></div><div class="footer-note">이앤엘 사고보고앱 v${VERSION}</div></main><div id="modalRoot"></div></div>`;
    const chip=document.getElementById('userChip'),menu=document.getElementById('userMenu');if(chip&&menu)chip.onclick=()=>menu.classList.toggle('hide');document.getElementById('logoutBtn').onclick=logout;
    document.getElementById('personnelBtn411')?.addEventListener('click',()=>window.enlRenderPersonnelPage?.(u));document.getElementById('settingsBtn411')?.addEventListener('click',()=>{currentView='more';renderShell(u)});
    document.querySelectorAll('[data-shell-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.shellView;if(u.role==='safety'&&currentView==='incidents')safetyListFilter={status:'',siteId:'',title:'전체 사고목록'};try{enlPlatformSection=currentView==='home'?'hub':'incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}renderShell(u)});
    const brand=document.querySelector('.topbar .brand');if(brand&&isField(u)){brand.style.cursor='pointer';brand.onclick=()=>window.enlFieldHome?.(u)}
  }

  function safetyStats(){const all=[...(data.incidents||[])];return {all,reported:all.filter(i=>i.status==='reported').length,rejected:all.filter(i=>i.status==='rejected').length,approved:all.filter(i=>i.status==='approved').length,closed:all.filter(i=>i.status==='closed').length}}
  function statusTitle(v){return v==='reported'?'검토대기 사고':v==='rejected'?'반려 사고':v==='approved'?'승인 사고':v==='closed'?'종결 사고':'전체 사고목록'}
  function openSafetyList(u,filter={}){safetyListFilter={status:filter.status||'',siteId:filter.siteId||'',title:filter.title||statusTitle(filter.status||'')};currentView='incidents';renderShell(u)}
  function filteredSafetyIncidents(filter){let arr=[...(data.incidents||[])];if(filter.siteId)arr=arr.filter(i=>String(i.siteId)===String(filter.siteId));if(filter.status)arr=arr.filter(i=>i.status===filter.status);return arr.sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0))}

  function renderSafetyList(root,u,filter=safetyListFilter){
    const arr=filteredSafetyIncidents(filter),title=filter.title||'전체 사고목록',sub=filter.siteId?`${siteName(filter.siteId)}에서 등록된 사고입니다.`:filter.status?`${title} 상태의 사고만 표시합니다.`:'전체 사업장의 사고를 최근 발생순으로 표시합니다.';
    root.innerHTML=`<section class="panel"><div class="shell411-filter-head"><div><div class="ey">INCIDENT LIST</div><h2>${escx(title)}</h2><p>${escx(sub)} · ${arr.length}건</p></div><button type="button" id="backSafetyHome411">← 사고현황</button></div>${typeof incidentTable==='function'?incidentTable(arr,true,u):'<div class="empty">사고목록을 불러오지 못했습니다.</div>'}</section>`;
    document.getElementById('backSafetyHome411').onclick=()=>{currentView='home';renderShell(u)};if(typeof bindIncidentRows==='function')bindIncidentRows(true,u)
  }

  function renderSafetyHome(root,u){
    const s=safetyStats(),sites=[...(data.sites||[])].filter(x=>x.id!=='site-hq').sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')),recent=[...s.all].sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0)).slice(0,3);
    root.innerHTML=`<section class="shell411-safety-home"><section class="panel"><div class="shell411-head"><div><div class="ey">ALL SITES</div><h2>전체 사업장 사고현황</h2><p>사고 상태나 사업장을 누르면 해당 사고목록으로 바로 이동합니다.</p></div><button type="button" class="primary" id="safetyAll411">전체 사고 보기</button></div></section><div class="shell411-stat"><button type="button" data-safety-status="all"><span>전체 사고</span><b>${s.all.length}</b></button><button type="button" data-safety-status="reported"><span>검토대기</span><b>${s.reported}</b></button><button type="button" data-safety-status="rejected"><span>반려</span><b>${s.rejected}</b></button><button type="button" data-safety-status="approved"><span>승인</span><b>${s.approved}</b></button><button type="button" data-safety-status="closed"><span>종결</span><b>${s.closed}</b></button></div><section class="panel"><div class="section-head"><div><h2>최근 사고보고</h2><p>최근 접수된 사고 3건입니다.</p></div></div><div class="shell411-recent">${recent.map(i=>`<button type="button" data-safety-inc="${escx(i.id)}"><span>${escx(String(i.occurredAt||'').slice(0,10))}</span><b class="site">${escx(siteName(i.siteId))}</b><span class="summary">${escx(String(i.summary||i.eventType||'사고보고').slice(0,80))}</span><span>${statusBadge(i.status)}</span></button>`).join('')||'<div class="empty compact">등록된 사고가 없습니다.</div>'}</div></section><section class="panel"><div class="section-head"><div><h2>사업장별 사고</h2><p>사업장을 누르면 해당 현장의 사고목록을 확인합니다.</p></div></div><div class="shell411-site-grid">${sites.map(site=>{const arr=s.all.filter(i=>String(i.siteId)===String(site.id)),review=arr.filter(i=>i.status==='reported').length,latest=[...arr].sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0))[0];return `<button type="button" class="shell411-site" data-safety-site="${escx(site.id)}"><h3>${escx(site.name)}</h3><div><span>전체<b>${arr.length}</b></span><span>검토대기<b>${review}</b></span></div><small>${latest?'최근 '+String(latest.occurredAt||'').slice(0,10):'사고기록 없음'}</small></button>`}).join('')}</div></section></section>`;
    document.getElementById('safetyAll411').onclick=()=>openSafetyList(u,{title:'전체 사고목록'});
    root.querySelectorAll('[data-safety-status]').forEach(b=>b.onclick=()=>{const st=b.dataset.safetyStatus;openSafetyList(u,st==='all'?{title:'전체 사고목록'}:{status:st,title:statusTitle(st)})});
    root.querySelectorAll('[data-safety-inc]').forEach(b=>b.onclick=()=>openIncidentModal(b.dataset.safetyInc,true,u));
    root.querySelectorAll('[data-safety-site]').forEach(b=>b.onclick=()=>openSafetyList(u,{siteId:b.dataset.safetySite,title:`${siteName(b.dataset.safetySite)} 사고목록`}));
  }

  function renderFinalHome(root,u){const arr=[...(data.incidents||[])].filter(i=>['approved','closed'].includes(i.status)).sort(sortIncidents);root.innerHTML=`<section class="panel"><div class="section-head"><div><h2>승인 사고 현황</h2><p>안전관리자가 승인한 사고만 확인할 수 있습니다.</p></div></div>${typeof incidentTable==='function'?incidentTable(arr,false,u):''}</section>`;if(typeof bindIncidentRows==='function')bindIncidentRows(false,u)}

  function route(root,u){
    if(isField(u)){
      if(currentView==='home'||!currentView)return window.enlRenderFieldHome?.(root,u);
      if(currentView==='report'){const r=renderUnifiedReport(root,u);window.enlAddFieldBack?.(root,u);return r}
      if(currentView==='incidents')return window.enlRenderFieldRecords?window.enlRenderFieldRecords(root,u):renderUnifiedIncidents(root,u);
      if(currentView==='actions')return window.enlRenderFieldActions?window.enlRenderFieldActions(root,u):renderUnifiedActions(root,u);
      if(currentView==='field-inquiry')return window.enlRenderFieldInquiry?.(root,u);
      if(currentView==='personnel')return window.enlRenderPersonnelPage?.(u);
      currentView='home';return window.enlRenderFieldHome?.(root,u);
    }
    if(u.role==='safety'){
      if(currentView==='home'||currentView==='dashboard'||!currentView)return renderSafetyHome(root,u);
      if(currentView==='incidents')return renderSafetyList(root,u,safetyListFilter);
      if(currentView==='actions')return renderUnifiedActions(root,u);
      if(currentView==='more')return typeof renderMore==='function'?renderMore(root,u):renderUsers(root,u);
      currentView='home';return renderSafetyHome(root,u);
    }
    if(currentView==='incidents')return renderUnifiedIncidents(root,u);return renderFinalHome(root,u);
  }

  renderShell=function(u){if(!u||u.active===false)return renderLogin();css();buildShell(u);const root=document.getElementById('view');route(root,u);return root};
  renderCurrentView=function(u){const root=document.getElementById('view');return route(root,u)};
  defaultViewFor=function(){return 'home'};
  render=function(){const u=currentUser?.();if(!u)return renderLogin();if(!currentView)currentView='home';return renderShell(u)};
  window.enlRenderApp=u=>{if(!u)return renderLogin();currentView=currentView||'home';return renderShell(u)};
  window.enlRenderFatal=e=>{app.innerHTML=`<section class="shell411-fatal"><h2>화면을 불러오지 못했습니다.</h2><p>로그인 정보는 유지됩니다. 아래 버튼으로 화면만 다시 불러와 주세요.</p><button type="button" id="fatalRetry411">화면 다시 불러오기</button></section>`;document.getElementById('fatalRetry411').onclick=()=>{currentView='home';renderShell(currentUser())}};
  window.ENL_SHELL_VERSION=VERSION;

  const u=currentUser?.();if(u){currentView='home';renderShell(u);if(u.role==='safety')setTimeout(()=>window.enlSyncHqUsers?.(u),250)}else renderLogin();
})();