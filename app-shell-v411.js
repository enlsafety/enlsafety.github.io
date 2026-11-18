/* E&L Accident Report App v4.1.2 - single authoritative shell/router */
(function(){
  'use strict';
  const VERSION='4.4.38-hq-attention1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isField=u=>!!u&&['field','worker'].includes(u.role);
  const siteName=id=>{try{return window.ENLContracts?.site(id)?.site_name||siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const qsum=i=>typeof window.enlIncidentQuickSummary==='function'?window.enlIncidentQuickSummary(i):{when:fmt(i.occurredAt),site:siteName(i.siteId),headline:i.eventType||'사고',circumstance:String(i.summary||'').slice(0,90)};
  const userId=u=>String(u?.id||u?.personnelId||u?.username||'');
  const stageNames={
    all:'전체 사고',reported:'미검토 사고',supplement_any:'보고 보완 및 재검토',
    plan_missing:'재발방지계획 수립 대기',action_progress:'조치 진행 중',action_review:'재발방지조치 확인 대기',
    approval:'결재 진행 중',closed:'종결',unknown:'단계 확인 필요'
  };
  const categoryNames={all:'전체',person:'대인',property:'대물',other:'기타'};
  let categoryOwner='',category='all',safetyListFilter={title:'전체 사고목록'};
  function categoryOf(i){return ['person','property'].includes(i.category)?i.category:'other';}
  function stageOf(i){
    if(i.status==='closed')return 'closed';
    if(i.status==='reported')return 'reported';
    if(['supplement','supplement_submitted','rejected'].includes(i.status))return 'supplement_any';
    if(i.status!=='approved')return 'unknown';
    if(i.executiveApproval?.state==='pending')return 'approval';
    const action=i.corrective;
    if(action?.status==='submitted')return 'action_review';
    if(['planned','in_progress','rejected'].includes(action?.status))return 'action_progress';
    if(!action?.status)return (action?.planAt||String(action?.planDetail||'').trim())?'action_progress':'plan_missing';
    return 'unknown';
  }
  function stageCards(rows,u){
    const counts={},tasks={};
    let previousClosures=0;
    for(const i of rows){
      const stage=stageOf(i);
      counts[stage]=(counts[stage]||0)+1;
      if(stage==='closed'&&i.executiveApproval?.state!=='approved')previousClosures++;
      const work=u.role==='safety'?window.enlSafetyWork?.(i):null;
      const mine=(stage==='reported'||stage==='supplement_any')&&work?.report||stage==='plan_missing'&&work?.plan||
        stage==='action_review'&&work?.review||stage==='approval'&&u.role==='executive'&&window.ENLExecutiveApproval?.canDecide(i.executiveApproval,u.id);
      if(mine)tasks[stage]=(tasks[stage]||0)+1;
    }
    counts.all=rows.length;
    return Object.entries(stageNames).filter(([key])=>key!=='unknown'||counts.unknown).map(([key,label])=>{
      const count=counts[key]||0,task=tasks[key]||0;
      const title=key==='closed'&&!previousClosures?'종결 (결재완료)':label;
      const detail=key==='closed'&&previousClosures?`<small>기존 종결 ${previousClosures}건 포함</small>`:'';
      return `<button type="button" data-safety-status="${key}" class="${task?'task-required':''}"><span>${title}</span><b>${count}</b>${detail}${task?`<small class="task-chip">처리 필요 ${task}건</small>`:''}</button>`;
    }).join('');
  }

  function css(){if(document.getElementById('shell411Css'))return;const s=document.createElement('style');s.id='shell411Css';s.textContent=`
    html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:auto!important;-webkit-overflow-scrolling:touch}#app,.app-shell.shell-v411{height:auto!important;min-height:100dvh!important;overflow:visible!important}.app-shell.shell-v411 .main{max-width:1180px;margin:0 auto;padding:16px;overflow:visible!important;touch-action:auto}.shell411-nav:empty{display:none}.shell411-nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 14px}.shell411-nav button{min-height:44px;border:1px solid #c7d6e3;border-radius:11px;background:#fff;color:#36536f;padding:0 14px;font-weight:900}.shell411-nav button.on{background:#173b66;border-color:#173b66;color:#fff}.shell411-safety-home{display:grid;gap:13px;overflow:visible!important;touch-action:auto}.shell411-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.shell411-head h2{margin:0;color:#173b66;font-size:25px}.shell411-head p{margin:5px 0 0;color:#6a7e90}.shell411-head-actions{display:flex;gap:8px;flex-wrap:wrap}.shell411-sync{margin-top:8px;color:#668096;font-size:12px;font-weight:800}.shell411-stat{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.shell411-stat button{appearance:none;width:100%;padding:14px;border:2px solid #d8e3ed;border-radius:13px;background:#fff;text-align:left;cursor:pointer}.shell411-stat button:hover,.shell411-stat button:focus-visible{border-color:#1e5d91;outline:none;box-shadow:0 6px 16px rgba(30,93,145,.10)}.shell411-stat span{display:block;color:#718294;font-size:11px;font-weight:850}.shell411-stat b{display:block;margin-top:5px;color:#173b66;font-size:25px}.shell411-site-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.shell411-site{border:1px solid #d8e3ed;border-radius:13px;background:#fff;padding:13px;text-align:left;color:inherit;cursor:pointer}.shell411-site:hover,.shell411-site:focus-visible{border-color:#1e5d91;outline:none;box-shadow:0 5px 14px rgba(30,93,145,.09)}.shell411-site h3{margin:0;color:#173b66;font-size:15px}.shell411-site div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 10px;margin-top:10px}.shell411-site span{font-size:10px;color:#748698}.shell411-site b{display:block;margin-top:2px;color:#304c65;font-size:17px}.shell411-site small{display:block;margin-top:8px;color:#8090a0}
    .shell411-recent{display:grid;gap:8px}.shell411-recent button{display:grid;grid-template-columns:115px minmax(0,1fr) auto;grid-template-areas:'meta main status';gap:11px;align-items:center;width:100%;padding:12px;border:1.5px solid #d8e4ec;border-radius:13px;background:#fff;text-align:left;color:inherit;cursor:pointer}.shell411-recent button:hover,.shell411-recent button:focus-visible{border-color:#4f8bb5;outline:none;box-shadow:0 4px 13px rgba(30,93,145,.08)}.shell411-recent-meta{grid-area:meta}.shell411-recent-meta b{display:block;color:#173b66;font-size:13px}.shell411-recent-meta span{display:block;margin-top:4px;color:#718397;font-size:11px}.shell411-recent-main{grid-area:main;min-width:0}.shell411-recent-main strong{display:block;color:#203f5b;font-size:15px;line-height:1.35}.shell411-recent-main small{display:block;margin-top:5px;color:#5e7386;font-size:12px;line-height:1.45}.shell411-recent-status{grid-area:status;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
    .shell411-filter-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}.shell411-filter-head h2{margin:0;color:#173b66}.shell411-filter-head p{margin:5px 0 0;color:#6b7e90}.shell411-filter-head button{min-height:42px;border:2px solid #173b66;border-radius:10px;background:#fff;color:#173b66;padding:0 13px;font-weight:900}.shell411-approval-alert{border:2px solid #d84a4a;border-radius:16px;background:#fff4f4;padding:14px;box-shadow:0 7px 20px rgba(174,48,48,.12)}.shell411-approval-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.shell411-approval-count{min-width:34px;height:34px;padding:0 9px;border-radius:999px;background:#c93434;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:950;box-shadow:0 3px 10px rgba(174,48,48,.28)}.shell411-approval-head strong{color:#9a2929;font-size:18px}.shell411-approval-head span:last-child{color:#6d4848;font-size:12px;font-weight:800}.shell411-approval-list{display:grid;gap:7px;margin-top:11px}.shell411-approval-item{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid #e8abab;border-radius:11px;background:#fff;text-align:left;color:inherit;cursor:pointer}.shell411-approval-item:hover,.shell411-approval-item:focus-visible{outline:3px solid rgba(201,52,52,.15);border-color:#c93434}.shell411-approval-item b{display:block;color:#762929;font-size:14px}.shell411-approval-item small{display:block;margin-top:4px;color:#786060;font-size:11px}.shell411-approval-go{display:inline-flex;align-items:center;min-height:36px;padding:0 11px;border-radius:9px;background:#c93434;color:#fff;font-size:12px;font-weight:950;white-space:nowrap}.shell411-stat button.shell411-attention{border-color:#d84a4a;background:#fff5f5;box-shadow:0 0 0 2px rgba(216,74,74,.08)}.shell411-stat button.shell411-attention span,.shell411-stat button.shell411-attention b{color:#a52f2f}.shell411-fatal{max-width:680px;margin:40px auto;padding:24px;border:2px solid #e1b5b5;border-radius:18px;background:#fff7f7}.shell411-fatal h2{color:#8d3333}.shell411-fatal button{min-height:48px;border:0;border-radius:10px;background:#1e5d91;color:#fff;padding:0 16px;font-weight:900}@media(max-width:900px){.shell411-stat{grid-template-columns:repeat(3,minmax(0,1fr))}.shell411-site-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.shell411-recent button{grid-template-columns:1fr auto;grid-template-areas:'meta status' 'main main'}.shell411-recent-status{justify-content:flex-start}}@media(max-width:560px){.app-shell.shell-v411 .main{padding:10px 8px}.shell411-nav{overflow-x:auto;flex-wrap:nowrap;padding-bottom:3px}.shell411-nav button{white-space:nowrap;min-height:42px}.shell411-head h2{font-size:22px}.shell411-head-actions{width:100%}.shell411-head-actions button{flex:1 1 145px}.shell411-stat{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.shell411-stat button{padding:11px}.shell411-stat b{font-size:22px}.shell411-site-grid{gap:7px}.shell411-site{padding:11px}.shell411-recent button{padding:10px}}
  `;document.head.appendChild(s)}

  function logout(){session=null;saveSession();currentView='';try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}renderLogin()}
  function navItems(u){if(isField(u))return [];if(roleNorm(u.role)==='safety')return [['home','사고현황'],['analysis','종합분석'],['report','사고 등록'],['incidents','전체 사고'],['actions','재발방지 관리']];return [['home','사고현황'],...(['manager','executive'].includes(roleNorm(u.role))?[['analysis','종합분석']]:[]),['incidents','사고 조회'],['actions','확인완료 재발방지조치']]}
  function navHtml(u){const items=navItems(u);
    if(!items.length)return '';
    return `<nav class="shell411-nav">${items.map(([v,t])=>`<button type="button" data-shell-view="${v}" class="${currentView===v?'on':''}">${t}</button>`).join('')}</nav>`}
  function openSafetyReport(u){window.enlResetIncidentReport?.();currentView='report';try{enlPlatformSection='incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}renderShell(u)}

  function toggleAccountMenu(open){
    document.getElementById('userMenu')?.classList.toggle('hide',!open);
    document.getElementById('userChip')?.setAttribute('aria-expanded',String(open));
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('.user-wrap'))toggleAccountMenu(false);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.querySelector('#userMenu:not(.hide)')){
      toggleAccountMenu(false);document.getElementById('userChip')?.focus();
    }
  });
  function buildShell(u){
    const system=currentView==='system-admin';
    const frame=app.querySelector('.app-shell')?.enlWorkspaceFrame;
    const role=roleNorm(u.role),site=isField(u)?siteName(u.siteId):'전체 사업장';
    app.innerHTML=`<div ${system?'data-system-shell':''} class="app-shell shell-v411 ${isField(u)?'field-simple-mode':''}"><header class="topbar"><div class="brand"><div class="logo system-brand-logo"><img class="enl-system-mark" src="pwa-icon-512.png?v=4813-r53" width="512" height="512" alt="" aria-hidden="true"></div><div><h1>이앤엘 <span class="system-title-line">안전보건관리 통합시스템</span></h1><p>${system?'공통 업무지원 서비스':role==='safety'?'전체 사업장 사고관리':isField(u)?'현장 사고 보고 · 조치 · 기록':'최초 사고인지 · 진행상태 열람'}</p></div><span class="hub-header-welcome">${escx(u.name||'사용자')}님, 환영합니다.</span></div><div class="topbar-tools" aria-label="앱 안내와 상태"><button type="button" class="platform-return" data-platform-home>← 통합 메인</button></div><div class="user-wrap"><button id="userChip" class="user-chip" aria-controls="userMenu" aria-expanded="false"><div class="avatar">${escx((u.name||'사용자').slice(0,2))}</div><div><b>${escx(u.name||'사용자')}</b><small>${roleName(role)} · ${escx(site)}</small></div><span class="chev">⌄</span></button><div id="userMenu" class="user-menu hide"><div class="who"><b>${escx(u.name||'사용자')}</b><span>${roleName(role)} · ${escx(site)}</span></div>${u.role==='field'&&MANAGER_POSITIONS.includes(String(u.position||''))?'<button id="personnelBtn411">사업장 근무자 관리</button>':''}${role==='safety'?'<button id="settingsBtn411">시스템 관리</button>':''}<button type="button" data-wf-inquiry-menu>문의함</button><button id="logoutBtn" class="danger">로그아웃</button></div></div></header><main class="main">${system?'':navHtml(u)}<div id="view"></div><div class="footer-note">${system?'이앤엘 안전보건관리 통합시스템':'이앤엘 사고보고앱'} v${escx(String(window.ENL_DEPLOY_VERSION||"4.4.0"))}</div></main><div id="modalRoot"></div></div>`;
    if(frame)frame.restoreIncidentFrame(document.getElementById('view'),u);
    const chip=document.getElementById('userChip'),menu=document.getElementById('userMenu');if(chip&&menu)chip.onclick=()=>toggleAccountMenu(menu.classList.contains('hide'));
    menu.querySelector('[data-wf-inquiry-menu]').onclick=()=>{toggleAccountMenu(false);const frame=app.querySelector('.app-shell')?.enlWorkspaceFrame;if(frame)frame.activateWorkTab('inquiry');else window.enlRenderSafetyInquiry?.()};
    document.getElementById('logoutBtn').onclick=logout;
    document.getElementById('personnelBtn411')?.addEventListener('click',()=>window.enlRenderPersonnelPage?.(u));document.getElementById('settingsBtn411')?.addEventListener('click',()=>window.enlOpenSystemAdmin(u));
    document.querySelectorAll('[data-shell-view]').forEach(b=>b.onclick=()=>{listReturn=null;const next=b.dataset.shellView;if(next==='history')window.enlRequestHistory?.();if(role==='safety'&&next==='report')return openSafetyReport(u);if(next==='actions')window.enlResetActionFilter?.();currentView=next;if(['safety','manager','executive'].includes(role)&&currentView==='incidents')safetyListFilter={title:'전체 사고목록'};try{enlPlatformSection=currentView==='home'?'hub':'incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}renderShell(u)});
    document.querySelector('[data-platform-home]').onclick=()=>window.enlReturnToPlatform(u);
    const brand=document.querySelector('.topbar .brand');if(brand&&isField(u)){brand.style.cursor='pointer';brand.onclick=()=>window.enlFieldHome?.(u)}
  }

  function dashboardIncidents(u){let all=(data.incidents||[]).filter(i=>i?.id&&!i.bulkInvalidation?.active);if(roleNorm(u?.role)!=='safety')all=all.filter(i=>['reported','supplement','supplement_submitted','approved','closed'].includes(String(i.status||'')));return all}
  function openSafetyList(u,filter){listReturn=homeState(u);safetyListFilter=filter;currentView='incidents';renderShell(u)}
  function openSafetySiteIncidents(siteId,u=currentUser?.()){const id=String(siteId||'');if(!id||!u||!['safety','manager','executive'].includes(roleNorm(u.role)))return;openSafetyList(u,{siteId:id,title:`${siteName(id)} 사고목록`})}
  function filteredSafetyIncidents(filter,u){
    return dashboardIncidents(u).filter(i=>(!filter.siteId||String(i.siteId)===String(filter.siteId))&&
      (!filter.category||filter.category==='all'||categoryOf(i)===filter.category)&&
      (!filter.stage||filter.stage==='all'||stageOf(i)===filter.stage))
      .sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
  }
  async function openSafetyReview(id,u){let i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i&&typeof window.enlIncidentPullNow==='function'){try{await window.enlIncidentPullNow()}catch(e){}i=(data.incidents||[]).find(x=>String(x.id)===String(id))}if(!i)return alert('해당 사고자료를 서버에서 찾지 못했습니다.');if(typeof window.enlOpenIncidentReview==='function')return window.enlOpenIncidentReview(i.id,roleNorm(u.role)==='safety',u);if(typeof openIncidentModal==='function')return openIncidentModal(i.id,roleNorm(u.role)==='safety',u);alert('사고 검토 화면을 불러오지 못했습니다.')}
  function renderSafetyList(root,u,filter=safetyListFilter){const arr=filteredSafetyIncidents(filter,u),title=filter.title||'전체 사고목록',sub=filter.siteId?`${siteName(filter.siteId)}에서 등록된 사고입니다.`:'';const need=u.role==='safety'?arr.filter(i=>window.enlSafetyWork?.(i).report).length:0;root.innerHTML=`<section class="panel"><div class="shell411-filter-head"><div><div class="ey">INCIDENT LIST</div><h2>${escx(title)}</h2><p>${sub?escx(sub)+' · ':''}${arr.length}건</p>${need?`<strong class="task-chip">이 목록에서 검토할 사고 ${need}건</strong>`:''}</div><button type="button" id="backSafetyHome411"${listReturn?' data-list-origin':''}>← 사고현황</button></div>${typeof window.enlIncidentTable==='function'?window.enlIncidentTable(arr,roleNorm(u.role)==='safety',u):'<div class="empty">사고목록을 불러오지 못했습니다.</div>'}</section>`;document.getElementById('backSafetyHome411').onclick=()=>restoreSiteOrigin(u);root.querySelectorAll('[data-inc-id]').forEach(r=>r.onclick=()=>{
      if(u.role==='safety'&&['plan_missing','action_progress','action_review'].includes(filter.stage)&&typeof window.openUnifiedCorrectiveModal==='function')return window.openUnifiedCorrectiveModal(r.dataset.incId,u);
      return openSafetyReview(r.dataset.incId,u);
    })}

  function foldedList(items,grid,key,render){
    const list=part=>`<div class="${grid}">${part.map(render).join('')}</div>`;
    const first=list(items.slice(0,5));
    if(items.length<=5)return first;
    return first+`<details class="list-fold" data-fold="${key}"><summary><span class="fold-more">나머지 ${items.length-5}개 펼치기</span><span class="fold-less">접기</span></summary>${list(items.slice(5))}</details>`;
  }
  window.enlFoldedList=foldedList;
  let listReturn=null;
  function homeState(u){
    return {user:u.id,view:currentView,top:window.scrollY,open:[...document.querySelectorAll('#view details[data-fold][open]')].map(el=>el.dataset.fold)};
  }
  function applyHomeState(saved){
    document.querySelectorAll('#view [data-fold]').forEach(el=>{el.open=saved.open.includes(el.dataset.fold)});
    window.scrollTo({top:saved.top,behavior:'instant'});
  }
  function restoreSiteOrigin(u){
    const saved=listReturn;listReturn=null;
    currentView=saved?.user===u.id?saved.view:'home';renderShell(u);
    if(saved?.user!==u.id)return;
    applyHomeState(saved);
    requestAnimationFrame(()=>{if(currentView===saved.view)applyHomeState(saved)});
  }
  function recentHtml(recent){if(!recent.length)return '<div class="empty compact">등록된 사고가 없습니다.</div>';return foldedList(recent,'shell411-recent','recent',i=>{const q=qsum(i),task=currentUser()?.role==='safety'&&window.enlSafetyWork?.(i).report;return `<button type="button" class="${task?'task-required':''}" data-safety-inc="${escx(i.id)}"><div class="shell411-recent-meta"><b>${escx(q.when||fmt(i.occurredAt))}</b><span>${escx(q.site||siteName(i.siteId))}${window.ENLContracts?.badge(i.siteId)||''}</span></div><div class="shell411-recent-main"><strong>${escx(q.headline||i.eventType||'사고보고')}</strong>${task?`<span class="task-chip">${escx(task)} 필요</span>`:''}<small>${escx(q.circumstance||q.place||'사고 상세 확인')}</small></div><div class="shell411-recent-status">${typeof priorityBadge==='function'?priorityBadge(i.priority):''}${statusBadge(i.status)}${typeof actionBadge==='function'?actionBadge(i):''}</div></button>`})}
  function siteOverviewHtml(sites,incidents,ready){
    const rows=sites.map(site=>{
      const records=incidents.filter(i=>String(i.siteId)===String(site.id));
      const missing=records.filter(i=>stageOf(i)==='plan_missing').length;
      const review=records.filter(i=>stageOf(i)==='action_review').length;
      const pending=records.filter(i=>['reported','supplement_any'].includes(stageOf(i))).length;
      const latest=[...records].sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0))[0];
      return {site,total:records.length,person:records.filter(i=>i.category==='person').length,
        property:records.filter(i=>i.category==='property').length,pending,missing,review,
        stamp:Date.parse(latest?.occurredAt)||0,date:String(latest?.occurredAt||'').slice(0,10)};
    });
    const active=rows.filter(r=>r.total).sort((a,b)=>b.stamp-a.stamp),quiet=rows.filter(r=>!r.total).sort((a,b)=>String(a.site.name).localeCompare(String(b.site.name),'ko'));
    const summary=(icon,title,value,unit,note,tone)=>`<div class="overview-metric tone-${tone}">
      <span class="overview-label">${title}</span><i class="ui-icon" data-icon="${icon}" aria-hidden="true"></i>
      <strong>${value}<small>${unit}</small></strong><span class="overview-note">${note}</span></div>`;
    const title=r=>`<strong class="site-title">${escx(r.site.name)}${window.ENLContracts?.badge(r.site.id)||''}</strong>${window.ENLContracts?.detail(r.site.id)||''}`;
    const activeCard=r=>`<button type="button" class="site-report-card ${r.missing||r.review||r.pending?'needs-action':''}" data-safety-site="${escx(r.site.id)}">
      <span class="site-line">${title(r)}<span class="site-state">${r.missing||r.review||r.pending?'조치 확인 필요':'사고 등록'}</span></span>
      <span class="site-volume"><b>${r.total}</b>전체 사고<span>인명 <strong>${r.person}</strong> / 대물 <strong>${r.property}</strong></span></span>
      <span class="site-progress"><span>즉시보고 및 보완 <b>${r.pending}</b></span><span class="${r.missing?'pending':''}">조치 미작성 <b>${r.missing}</b></span><span class="${r.review?'pending':''}">조치 검토대기 <b>${r.review}</b></span></span>
      <span class="site-foot"><span>최근 사고일 <b>${escx(r.date)||'미등록'}</b></span><span>상세 보기 →</span></span></button>`;
    const quietCard=r=>`<button type="button" class="site-quiet-card" data-safety-site="${escx(r.site.id)}">${title(r)}<span><i aria-hidden="true"></i>${ready?'사고 0건':'집계 중'}</span></button>`;
    return `<section class="site-overview" aria-label="사업장별 사고 현황">
      <header class="site-heading"><div class="ey">INCIDENT OVERVIEW</div><h2>사업장별 사고 현황</h2><p>${ready?'사고가 발생한 사업장과 후속조치 현황을 확인하세요.':'최신 사고 자료를 확인하고 있습니다.'}</p></header>
      <div class="overview-metrics">
        ${summary('site','표시된 사업장',rows.length,'곳','현재 조회 범위','slate')}
        ${summary('report','전체 사고',ready?active.reduce((n,r)=>n+r.total,0):'—','건','표시된 사업장 기준','blue')}
        ${summary('alert','조치 미작성',ready?active.reduce((n,r)=>n+r.missing,0):'—','건','재발방지조치 작성 대기','amber')}
        ${summary('closed','사고 기록 없는 사업장',ready?quiet.length:'—','곳','현재 조회 범위','mint')}
      </div>
      ${active.length?`<h3 class="site-group-title">사고 발생 사업장 <small>${active.length}곳</small></h3>${foldedList(active,'site-report-grid','active',activeCard)}`:''}
      ${quiet.length?`<h3 class="site-group-title">${ready?'사고 기록 없는 사업장':'사업장 목록'} <small>${quiet.length}곳</small></h3>${foldedList(quiet,'site-quiet-grid','quiet',quietCard)}`:''}
      ${rows.length?'':'<div class="empty compact">표시할 사업장이 없습니다.</div>'}</section>`;
  }

  function renderSafetyHome(root,u){
    const previous=root.querySelector('.shell411-safety-home')?homeState(u):null;
    const owner=JSON.stringify([userId(u),u.role,u.siteId]);
    if(categoryOwner!==owner){categoryOwner=owner;category='all';}
    const all=dashboardIncidents(u);
    const categories=Object.keys(categoryNames).filter(k=>k!=='other'||all.some(i=>categoryOf(i)==='other'));
    if(!categories.includes(category))category='all';
    const rows=category==='all'?all:all.filter(i=>categoryOf(i)===category);
    const prefix=category==='all'?'':categoryNames[category]+' ';
    const buttons=categories.map(key=>`<button type="button" data-overview-category="${key}" aria-pressed="${category===key}">${categoryNames[key]}</button>`).join('');
    const executive=roleNorm(u.role)==='executive',sites=[...(window.ENLContracts?window.ENLContracts.list().map(x=>({...x,id:x.site_id,name:x.site_name||x.name})):data.sites||[])].filter(x=>x.id!=='site-hq').sort((a,b)=>Number(!!window.ENLContracts?.closed(a.id))-Number(!!window.ENLContracts?.closed(b.id))||String(a.name).localeCompare(String(b.name),'ko')),recent=[...rows].sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0)),ready=typeof window.enlIncidentServerReady==='function'?window.enlIncidentServerReady():true;
    root.innerHTML=`<section class="shell411-safety-home"><section class="panel"><div class="shell411-head"><div><div class="ey">ALL SITES</div><h2>전체 사업장 사고현황</h2>${executive?'':'<p>사고보고와 사고조치의 진행상태를 함께 확인합니다.</p>'}${ready?'':'<div class="shell411-sync">서버의 최신 사고자료를 확인하고 있습니다…</div>'}</div><div class="shell411-head-actions"><button type="button" class="primary" id="safetyAll411">${prefix||'전체 '}사고 보기</button></div></div></section><div class="overview-categories" role="group" aria-label="사고 유형">${buttons}</div><div class="shell411-stat">${stageCards(rows,u)}</div><section class="panel"><div class="section-head"><div><h2>최근 사고보고</h2>${executive?'':'<p>사고보고 상태와 사고조치 상태를 함께 표시합니다.</p>'}</div></div>${recentHtml(recent)}</section>${siteOverviewHtml(sites,rows,ready)}</section>`;
    if(previous)applyHomeState(previous);window.enlRefreshHistoryCount?.();
    root.querySelectorAll('[data-overview-category]').forEach(button=>button.onclick=()=>{
      category=button.dataset.overviewCategory;
      renderSafetyHome(root,u);
      root.querySelector('[data-overview-category="'+category+'"]')?.focus({preventScroll:true});
    });
    const openStage=stage=>openSafetyList(u,{category,stage,title:prefix+stageNames[stage]+' 목록'});
    root.querySelector('#safetyAll411').onclick=()=>openStage('all');
    root.querySelectorAll('[data-safety-status]').forEach(button=>button.onclick=()=>openStage(button.dataset.safetyStatus));
    root.querySelectorAll('[data-safety-inc]').forEach(b=>b.onclick=()=>openSafetyReview(b.dataset.safetyInc,u));
    root.querySelectorAll('[data-safety-site]').forEach(b=>b.onclick=()=>openSafetyList(u,{category,siteId:b.dataset.safetySite,title:`${siteName(b.dataset.safetySite)} ${prefix}사고목록`}))
  }

  function renderReaderHome(root,u){return renderSafetyHome(root,u)}

  function route(root,u){
    const retained=root.closest('.app-shell')?.enlWorkspaceFrame?.restoreTabView?.(root);
    if(retained)return retained;
    if(currentView==='platform-tool'&&!root.closest('.app-shell').enlWorkspaceFrame)currentView='platform';
    window.enlEnsureWorkspace?.(root,u)?.syncWorkView(root,u);
    if(currentView==='platform-tool'){root.replaceChildren();return root;}
    if(currentView==='analysis'&&['safety','manager','executive'].includes(roleNorm(u.role))&&window.ENLIncidentAnalysis){window.ENLIncidentAnalysis.render(root,u);return root;}
    if(currentView==='stats'&&['safety','manager','executive'].includes(roleNorm(u.role))&&window.enlRenderIncidentStats){
      window.enlRenderIncidentStats(root,u);return root;
    }
    const role=roleNorm(u.role);if(currentView==='system-admin'||currentView==='more'){if(role==='safety'){currentView='system-admin';window.enlRenderSystemAdmin?.(root,u)}else{currentView='platform';window.enlPlatformHome?.(root,u)}return root}if(currentView==='platform'&&window.enlPlatformHome){window.enlPlatformHome(root,u);return root}if(currentView==='notice-center'&&window.enlNoticeCenter){window.enlNoticeCenter(root);return root}if(['history','common-history'].includes(currentView)&&window.enlHistoryAvailable?.(u)){window.enlRenderHistory(root,currentView==='common-history'?'common':'incident');return}if(currentView==='closed'&&!isField(u)&&window.enlRenderClosedView)return window.enlRenderClosedView(u);if(currentView==='inquiry'&&!isField(u)&&window.enlRenderSafetyInquiry)return window.enlRenderSafetyInquiry('');if(currentView==='followups'&&window.enlFollowupPermitted?.(u))return window.enlRenderHistoricalFollowups(root,u);if(isField(u)){if(currentView==='home'||!currentView)return window.enlRenderFieldHome?.(root,u);if(currentView==='report'){const r=window.renderUnifiedReport?.(root,u);window.enlAddFieldBack?.(root,u);return r}if(currentView==='incidents')return window.enlRenderFieldRecords?window.enlRenderFieldRecords(root,u):window.renderUnifiedIncidents?.(root,u);if(currentView==='actions')return window.enlRenderFieldActions?window.enlRenderFieldActions(root,u):window.renderUnifiedActions?.(root,u);if(currentView==='field-inquiry')return window.enlRenderFieldInquiry?.(root,u);if(currentView==='personnel')return window.enlRenderPersonnelPage?.(u);currentView='home';return window.enlRenderFieldHome?.(root,u)}if(role==='safety'){if(currentView==='home'||currentView==='dashboard'||!currentView)return renderSafetyHome(root,u);if(currentView==='report')return window.renderUnifiedReport?.(root,u);if(currentView==='incidents')return renderSafetyList(root,u,safetyListFilter);if(currentView==='actions')return window.renderUnifiedActions?.(root,u);currentView='home';return renderSafetyHome(root,u)}if(currentView==='incidents')return renderSafetyList(root,u,safetyListFilter);if(currentView==='actions')return window.renderUnifiedActions?.(root,u);return renderReaderHome(root,u)}

  window.enlOpenSafetySiteIncidents=openSafetySiteIncidents;
  window.enlRenderHqHome=renderSafetyHome;
  window.enlSafetySiteFilter=()=>String(safetyListFilter.siteId||'');
  window.renderShell=function(u){if(!u||u.active===false)return renderLogin();if(currentView==='more'||currentView==='system-admin')currentView=roleNorm(u.role)==='safety'?'system-admin':'platform';const previous=currentView==='home'&&document.querySelector('#view .shell411-safety-home')?homeState(u):null;
    css();buildShell(u);const root=document.getElementById('view');route(root,u);
    if(previous)applyHomeState(previous);window.enlRefreshHistoryCount?.();
    return root};
  window.renderCurrentView=function(u){const root=document.getElementById('view');return route(root,u)};
  window.defaultViewFor=function(){return 'home'};
  window.render=function(){const u=currentUser?.();if(!u)return renderLogin();if(!currentView)currentView='home';return renderShell(u)};
  window.enlRenderApp=u=>{if(!u)return renderLogin();currentView=currentView||'home';return renderShell(u)};
  window.enlRenderFatal=e=>{app.innerHTML=`<section class="shell411-fatal"><h2>화면을 불러오지 못했습니다.</h2><p>로그인 정보는 유지됩니다. 아래 버튼으로 화면만 다시 불러와 주세요.</p><button type="button" id="fatalRetry411">화면 다시 불러오기</button></section>`;document.getElementById('fatalRetry411').onclick=()=>{currentView='home';renderShell(currentUser())}};
  window.ENL_SHELL_VERSION=VERSION;
  window.addEventListener('enl-contracts-ready',()=>{const u=currentUser?.(),root=document.getElementById('view');if(currentView==='home'&&['safety','manager','executive'].includes(roleNorm(u?.role))&&root)renderSafetyHome(root,u)});

  function mountInitialView(){
    const u=currentUser?.();
    if(!u)return renderLogin();
    const hq=['safety','manager','executive'].includes(roleNorm(u.role));
    if(!currentView||currentView==='dashboard')currentView=hq&&window.enlRenderIncidentStats?'stats':'home';
    window.renderShell(u);
    if(roleNorm(u.role)==='safety')setTimeout(()=>window.enlSyncHqUsers?.(u),250);
  }
  // A restored route may depend on a renderer registered later in this document.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountInitialView,{once:true});
  else mountInitialView();
})();
