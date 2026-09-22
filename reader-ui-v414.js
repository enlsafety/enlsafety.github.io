/* E&L Accident Report App v4.1.4 - manager/executive read-only navigation */
(function(){
  'use strict';
  const VERSION='4.4.0-reader-immediate1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const finalized=i=>typeof window.enlIncidentFinalized==='function'?window.enlIncidentFinalized(i):!!i&&String(i.status)==='closed'&&String(i.corrective?.status)==='approved';
  const actionText=i=>{const s=String(i?.corrective?.status||'');if(!s)return '사고조치 미작성';if(s==='planned')return '조치예정';if(s==='in_progress')return '조치중';if(s==='submitted')return '사고조치 검토대기';if(s==='rejected')return '사고조치 반려';if(s==='approved')return '사고조치 승인완료';return '조치상태 확인'};

  function ensureCss(){
    if(document.getElementById('reader414Css'))return;
    const s=document.createElement('style');s.id='reader414Css';s.textContent=`
      .reader414-home{display:grid;gap:12px}.reader414-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.reader414-stat{border:1.5px solid #d8e3ed;border-radius:13px;background:#fff;padding:14px;text-align:left;color:inherit}.reader414-stat span{display:block;color:#718294;font-size:11px;font-weight:850}.reader414-stat b{display:block;margin-top:5px;color:#173b66;font-size:25px}.reader414-stat.button{cursor:pointer}.reader414-stat.button:hover,.reader414-stat.button:focus-visible{border-color:#1e5d91;outline:none;box-shadow:0 5px 14px rgba(30,93,145,.09)}.reader414-list{display:grid;gap:8px}.reader414-row{width:100%;display:grid;grid-template-columns:115px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1.5px solid #dbe5ed;border-radius:12px;background:#fff;text-align:left;color:inherit;cursor:pointer}.reader414-row:hover,.reader414-row:focus-visible{border-color:#4f8bb5;outline:none}.reader414-row small{display:block;color:#718396;font-size:11px}.reader414-row strong{display:block;color:#173b66;font-size:15px;margin-bottom:4px}.reader414-row p{margin:0;color:#526b80;font-size:12px;line-height:1.45}.reader414-state{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.reader414-pill{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border-radius:999px;background:#eef5fa;border:1px solid #ccdae5;color:#365a76;font-size:11px;font-weight:900}.reader414-note{padding:10px 12px;border-radius:10px;background:#f3f8fc;color:#42627b;font-size:12px;line-height:1.5}@media(max-width:760px){.reader414-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.reader414-row{grid-template-columns:1fr}.reader414-state{justify-content:flex-start}}`;
    document.head.appendChild(s);
  }

  function readerData(){
    const all=[...(data?.incidents||[])].filter(i=>['reported','supplement','supplement_submitted','approved','closed'].includes(String(i.status||'')));
    const immediate=all.filter(i=>String(i.status)==='reported');
    const supplement=all.filter(i=>['supplement','supplement_submitted'].includes(String(i.status||'')));
    const approved=all.filter(i=>String(i.status)==='approved');
    const closed=all.filter(finalized);
    return {all,immediate,supplement,approved,closed};
  }

  function openIncident(id,u){
    if(typeof window.enlOpenIncidentReview==='function')return window.enlOpenIncidentReview(id,false,u);
    if(typeof window.openIncidentModal==='function')return window.openIncidentModal(id,false,u);
  }

  function stateLabel(i){const s=String(i?.status||'');return s==='reported'?'즉시보고 검토대기':s==='supplement'?'보완대기':s==='supplement_submitted'?'보완검토대기':s==='approved'?'사고보고 최종승인':s==='closed'?'종결':'진행중'}
  function renderReaderHome(u){
    const root=document.getElementById('view');if(!root||!isReader(u))return;
    const d=readerData(),recent=[...d.all].sort((a,b)=>new Date(b.updatedAt||b.occurredAt||0)-new Date(a.updatedAt||a.occurredAt||0)).slice(0,7);
    root.innerHTML=`<section class="reader414-home"><section class="panel"><div class="section-head"><div><div class="ey">ACCIDENT STATUS</div><h2>사고현황</h2><p>즉시보고부터 보완·최종승인·종결까지 사고 진행상태를 조회합니다. 진단명·의사소견 등 민감한 의료 상세정보는 관리자·경영진 화면에서 제한됩니다.</p></div></div></section><div class="reader414-stats"><button type="button" class="reader414-stat button" data-reader-all><span>전체 사고</span><b>${d.all.length}</b></button><button type="button" class="reader414-stat button" data-reader-pending><span>즉시보고·보완중</span><b>${d.immediate.length+d.supplement.length}</b></button><div class="reader414-stat"><span>최종승인</span><b>${d.approved.length}</b></div><button type="button" class="reader414-stat button" data-reader-closed><span>종결</span><b>${d.closed.length}</b></button></div><section class="panel"><div class="section-head"><div><h2>최근 사고보고</h2><p>최근 발생·갱신된 사고를 확인합니다.</p></div></div><div class="reader414-list">${recent.map(i=>{const q=typeof window.enlIncidentQuickSummary==='function'?window.enlIncidentQuickSummary(i):{when:fmt(i.occurredAt),headline:i.eventType||'사고',circumstance:i.summary||''};return `<button type="button" class="reader414-row" data-reader-open="${escx(i.id)}"><div><strong>${escx(q.when||fmt(i.occurredAt))}</strong><small>${escx(siteName(i.siteId))}</small></div><div><strong>${escx(q.headline||i.eventType||'사고')}</strong><p>${escx(q.circumstance||'사고 상세내용 확인')}</p></div><div class="reader414-state"><span class="reader414-pill">${escx(stateLabel(i))}</span></div></button>`}).join('')||'<div class="empty">조회 가능한 사고가 없습니다.</div>'}</div></section><div class="reader414-note">이 화면의 확인기록은 전자결재나 법적 전자서명이 아니라 사내 사고정보 확인 이력입니다.</div></section>`;
    root.querySelector('[data-reader-all]')?.addEventListener('click',()=>{currentView='incidents';window.renderShell?.(u)});
    root.querySelector('[data-reader-pending]')?.addEventListener('click',()=>{currentView='incidents';window.renderShell?.(u)});
    root.querySelector('[data-reader-closed]')?.addEventListener('click',()=>document.querySelector('[data-lifecycle-closed]')?.click());
    root.querySelectorAll('[data-reader-open]').forEach(b=>b.onclick=()=>openIncident(b.dataset.readerOpen,u));
  }

  function trimApprovedList(u){
    if(!isReader(u)||String(currentView)!=='incidents')return;
    const root=document.getElementById('view');if(!root)return;
    const h2=root.querySelector('.section-head h2');if(h2)h2.textContent='사고 조회';
    const p=root.querySelector('.section-head p');if(p)p.textContent='즉시보고부터 보완·최종승인·종결까지 조회합니다. 확인 서명은 최종승인 이후 남길 수 있습니다.';
  }

  function normalizeReaderUi(u){
    if(!isReader(u))return;
    document.querySelector('[data-shell-view="actions"]')?.remove();
    const brandSub=document.querySelector('.topbar .brand p');if(brandSub)brandSub.textContent='즉시 사고보고 · 보완 · 최종승인 · 종결 열람';
    if(String(currentView)==='home'||String(currentView)==='dashboard'||!currentView)renderReaderHome(u);
    else if(String(currentView)==='incidents')trimApprovedList(u);
  }

  ensureCss();
  const baseShell=window.renderShell;
  if(typeof baseShell==='function')window.renderShell=function(u){if(isReader(u)&&String(currentView)==='actions')currentView='home';const r=baseShell(u);normalizeReaderUi(u);return r};
  const baseRender=window.render;
  if(typeof baseRender==='function')window.render=function(){const u=currentUser?.();if(isReader(u)&&String(currentView)==='actions')currentView='home';const r=baseRender();normalizeReaderUi(u);return r};

  const initial=currentUser?.();if(isReader(initial)){if(String(currentView)==='actions')currentView='home';normalizeReaderUi(initial)}
  window.ENL_READER_UI_VERSION=VERSION;
})();
