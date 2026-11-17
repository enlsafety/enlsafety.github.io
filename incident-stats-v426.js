/* E&L Accident Report App v4.2.8 - interactive incident dashboard */
(function(){
  'use strict';
  const VERSION='4.8.13-management-points-r140';
  let rememberedKey='',rememberedYear;
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const canUseStats=u=>!!u&&['safety','manager','executive'].includes(roleNorm(u.role));

  function css(){
    if(document.getElementById('incidentStats426Css'))return;
    const s=document.createElement('style');s.id='incidentStats426Css';s.textContent=`
      .stats426{display:grid;gap:13px}
      .stats426-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:4px 12px}
      .stats426-head h2{margin:0;color:#173b66;font-size:clamp(17px,2vw,21px);line-height:1.25;overflow-wrap:anywhere}
      .stats426-head select{box-sizing:border-box;width:auto;min-width:0;min-height:44px;margin:0;padding:0 8px;border:1px solid #cbd9e5;border-radius:8px;background:#fff;color:#294b68;font-size:16px;font-weight:700}
      .stats426-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.stats426-card{padding:15px;border:1px solid #d7e3ed;border-radius:14px;background:#fff;box-shadow:0 3px 10px rgba(22,67,104,.04)}.stats426-card span{display:block;color:#72869a;font-size:11px;font-weight:850}.stats426-card b{display:block;margin-top:5px;color:#173b66;font-size:27px}.stats426-card small{display:block;margin-top:4px;color:#7a8d9e;font-size:11px}.stats426-nav{position:relative}
      .stats426-card{appearance:none;width:100%;text-align:left;font:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}.stats426-card:hover,.stats426-card:focus-visible{border-color:#7fa9c9;box-shadow:0 6px 16px rgba(23,59,102,.09);outline:none}.stats426-card:active{transform:translateY(1px)}
      .stats426-drill{display:none;padding:14px;border:1px solid #cbdde9;border-radius:14px;background:#f8fcff;box-shadow:0 5px 16px rgba(27,73,109,.05)}.stats426-drill.show{display:block}.stats426-drill-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}.stats426-drill-head h3{margin:0;color:#173b66;font-size:17px}.stats426-drill-head p{margin:4px 0 0;color:#6d8294;font-size:11px}.stats426-drill-close{min-height:34px;border:1px solid #b8cada;border-radius:9px;background:#fff;color:#46657d;font-weight:900;padding:0 10px;cursor:pointer}.stats426-drill-list{display:grid;gap:7px}@media(max-width:760px){.stats426-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.stats426-card{padding:12px}.stats426-card b{font-size:24px}}
    `;document.head.appendChild(s)
  }

  function allowedIncidents(u){
    const role=roleNorm(u?.role),all=[...(data?.incidents||[])];
    if(role==='safety')return all;
    if(['manager','executive'].includes(role))return all.filter(i=>['reported','supplement','supplement_submitted','approved','closed'].includes(String(i?.status||'')));
    return [];
  }
  function validDate(i){const d=new Date(i?.occurredAt||i?.occurredDate||'');return Number.isFinite(d.getTime())?d:null}
  function recentFirst(arr){return [...arr].sort((a,b)=>(validDate(b)?.getTime()||0)-(validDate(a)?.getTime()||0))}
  function openIncident(id,u){if(typeof window.enlOpenIncidentReview==='function')return window.enlOpenIncidentReview(id,roleNorm(u?.role)==='safety',u);if(typeof window.openIncidentModal==='function')return window.openIncidentModal(id,roleNorm(u?.role)==='safety',u)}
  function showDrill(root,u,s,title,predicate,options={}){
    const box=options.target||root.querySelector('#stats426Drill');if(!box)return;
    const arr=recentFirst(s.rows.filter(predicate||(()=>true)));
    if(options.costs)arr.sort((a,b)=>(window.ENLIncidentAnalysis.cost(b)??-1)-(window.ENLIncidentAnalysis.cost(a)??-1));
    const list=options.costs?costRows(arr):window.enlIncidentTable(arr,roleNorm(u.role)==='safety',u);
    box.classList.add('show');box.innerHTML=`<div class="stats426-drill-head"><div><h3>${escx(title)}</h3><p>${arr.length}건 / ${options.costs?'금액 큰 순서 / 미확인 금액은 마지막':'최근 발생일 순서'}</p></div><button type="button" class="stats426-drill-close" data-stats-close>닫기</button></div><div class="stats426-drill-list">${list}</div>`;
    box.querySelector('[data-stats-close]')?.addEventListener('click',()=>{box.classList.remove('show');box.innerHTML=''});
    box.querySelectorAll('[data-inc-id]').forEach(b=>b.addEventListener('click',()=>openIncident(b.dataset.incId,u)));
    window.enlAttachIncidentSearch?.(box,box.querySelector('.stats426-drill-list'),'현재 목록에서 검색');
    try{box.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(e){}
  }

  function costRows(rows){
    const a=window.ENLIncidentAnalysis,values=rows.map(window.ENLIncidentAnalysis.cost);
    if(!rows.length)return '<p class="analysis-empty">해당 사고가 없습니다.</p>';
    return '<div class="analysis-cost-list">'+rows.map(i=>{
      const amount=a.cost(i),site=window.ENLContracts?.site(i.siteId)?.site_name||(typeof siteById==='function'?siteById(i.siteId)?.name:'')||i.siteId||'사업장 미입력';
      return '<button type="button"'+a.rankAttr(values,amount)+' data-inc-id="'+escx(i.id)+'"><span>'+a.rankBadge(values,amount)+'<small>'+escx(a.dateKey(i)||'발생일 미입력')+' / '+escx(site)+'</small><strong>'+escx(i.eventType||'사고유형 미입력')+'</strong><small>사고보고서 열기</small></span><b>'+ (amount===null?'금액 미확인':amount.toLocaleString('ko-KR')+'원')+'</b></button>';
    }).join('')+'</div>';
  }
  function ratioChart(title,person,property,unit){
    const total=person+property,circ=2*Math.PI*42;
    const percentage=key=>total?(key==='person'?Math.round(person/total*100):100-Math.round(person/total*100)):0;
    const slices=[['person','대인',person,'#c84550'],['property','대물',property,'#287caf']];let offset=0;
    const svg=slices.map(([key,label,value,color])=>{const length=total?value/total*circ:0,start=offset;offset+=length;if(!length)return '';return '<circle class="analysis-donut-segment" cx="60" cy="60" r="42" fill="none" stroke="'+color+'" stroke-width="16" stroke-dasharray="'+length+' '+(circ-length)+'" stroke-dashoffset="'+(-start)+'" transform="rotate(-90 60 60)" data-cost-category="'+key+'" role="button" tabindex="0" aria-label="'+label+' 사고 금액 큰 순서로 보기"><title>'+label+' '+percentage(key)+'%</title></circle>';}).join('');
    return '<section class="analysis-ratio"><h4>'+title+'</h4><div class="analysis-ratio-body"><svg viewBox="0 0 120 120" class="analysis-donut" aria-label="'+title+'"><circle cx="60" cy="60" r="42" fill="none" stroke="#e8eef3" stroke-width="16"/>'+svg+'<text x="60" y="58" text-anchor="middle">'+(total?'대인 / 대물':'자료 없음')+'</text><text x="60" y="75" text-anchor="middle">'+(total?'100%':'—')+'</text></svg><div class="analysis-ratio-legend">'+slices.map(([key,label,value,color])=>'<button type="button" data-cost-category="'+key+'"><span><i style="background:'+color+'"></i>'+label+'</span><strong>'+value.toLocaleString('ko-KR')+unit+'</strong><small>'+(total?percentage(key)+'%':'비율 없음')+'</small></button>').join('')+'</div></div></section>';
  }
  function costPanel(s){
    const n=v=>v.toLocaleString('ko-KR');
    return '<section class="analysis-card analysis-dashboard-cost"><div class="analysis-cost-layout"><div class="analysis-cost-heading"><div><h3>발생된 피해비용</h3><strong class="analysis-cost-total">'+(s.knownCost?n(s.cost)+'원':'미확인')+'</strong><p>'+s.knownCost+'건 금액 확인</p></div><div class="analysis-cost-breakdown">'+[['person','대인',s.personCost,s.knownPersonCost],['property','대물',s.propertyCost,s.knownPropertyCost]].map(([key,label,amount,known])=>'<button type="button" data-cost-category="'+key+'"><span>'+label+'</span><strong>'+(known?n(amount)+'원':'미확인')+'</strong></button>').join('')+'</div><button type="button" class="analysis-cost-followup" data-cost-unknown><span>추가 확인</span><strong>피해비용 미확인 '+(s.total-s.knownCost)+'건 보기</strong><small>해당 사고보고서에서 금액을 확인할 수 있습니다.</small></button></div><div class="analysis-ratios">'+ratioChart('대인 / 대물 사고 비율',s.person,s.property,'건')+ratioChart('대인 / 대물 사고금액 비율',s.personCost,s.propertyCost,'원')+'</div></div><p class="analysis-ratio-note">사고 비율은 대인과 대물 사고 기준입니다. 금액 비율은 확인된 금액만 반영합니다. 대인이나 대물을 누르면 금액이 큰 순서로 볼 수 있습니다.</p><section class="stats426-drill" data-cost-drill aria-live="polite"></section></section>';
  }
  function renderStats(root,u,state={}){
    if(!root)return;
    if(!canUseStats(u)){root.replaceChildren();return;}
    css();
    const a=window.ENLIncidentAnalysis;if(!a){root.textContent='분석 화면을 불러오지 못했습니다. 새로고침해 주세요.';return;}
    const userKey=JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);
    const all=a.records(window.enlIncidentAnalysisRecords?.()||allowedIncidents(u));
    const currentYear=String(new Date().getFullYear());
    const years=[...new Set([currentYear,...all.map(i=>a.dateKey(i).slice(0,4)).filter(Boolean)])].sort().reverse();
    const requested=String(state.year??(rememberedKey===userKey?rememberedYear:currentYear));
    const year=years.includes(requested)?requested:currentYear,s=a.summarize(all,year);
    rememberedKey=userKey;rememberedYear=year;
    const n=v=>Number(v).toLocaleString('ko-KR'),pct=v=>s.total?Math.round(v/s.total*100):0;
    const compactCost=s.cost>=100000000?(s.cost/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억원':s.cost>=10000?(s.cost/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원':n(s.cost)+'원';
    const unresolved=s.rows.filter(i=>i.status!=='closed').length;
    root.innerHTML=`<section class="stats426"><header class="panel stats426-head"><h2>사고 대시보드</h2><select id="stats426Year" aria-label="통계 연도">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}년</option>`).join('')}</select></header>
      <div class="stats426-cards">
        <button type="button" class="stats426-card" data-stats-filter="all"><span>전체 사고</span><b>${n(s.total)}건</b><small>${year}년 / 목록보기</small></button>
        <button type="button" class="stats426-card" data-stats-filter="person"><span>인명사고</span><b>${n(s.person)}건</b><small>전체의 ${pct(s.person)}% / 목록보기</small></button>
        <button type="button" class="stats426-card" data-stats-filter="property"><span>대물사고</span><b>${n(s.property)}건</b><small>전체의 ${pct(s.property)}% / 목록보기</small></button>
        <article class="stats426-card stats426-cost"><span>피해비용</span><b title="${s.knownCost?n(s.cost)+'원':'미확인'}">${s.knownCost?compactCost:'미확인'}</b><small>상세금액은 아래에</small></article>
      </div>
      ${window.ENLManagementPoints?.html(window.ENLManagementPoints.build(all,year),{ready:window.enlIncidentServerReady?.()===true})||''}
      <section id="stats426Drill" class="stats426-drill" aria-live="polite"></section>
      <section class="incident-analysis analysis-dashboard-details" aria-label="사고 종합 현황">
        <div class="analysis-dashboard-context"><div><h3>${year}년 사고 종합 현황</h3><p>전체 사업장의 최초사고보고 기준이며 과거사고 입력을 포함합니다. 지도는 기존 사업장 분포 기준을 유지합니다.</p><p>피해비용은 입력된 대인 진료비와 대물 복구 예상비용의 합계입니다. 미확인 금액은 제외하며 최종 확정 손실액은 아닙니다.</p></div><button type="button" data-stats-filter="unresolved">미종결 ${n(unresolved)}건 보기</button></div>
        ${costPanel(s)}
        <p class="analysis-sync" role="status">${window.enlIncidentServerReady?.()===true?'현재 동기화된 저장 자료 기준입니다.':'최신 서버 자료 확인 전입니다. 연결 상태에 따라 이전 자료가 표시될 수 있습니다.'}</p>
        ${s.total?'':'<p class="analysis-empty">선택한 연도의 사고보고가 없습니다.</p>'}
        ${a.detailHtml(s,true)}
      </section></section>`;
    const y=root.querySelector('#stats426Year');
    y.onchange=()=>renderStats(root,u,{year:y.value});
    root.querySelectorAll('[data-stats-filter]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.statsFilter;
      if(k==='person')return showDrill(root,u,s,`${year}년 인명사고`,i=>i.category==='person');
      if(k==='property')return showDrill(root,u,s,`${year}년 대물사고`,i=>i.category==='property');
      if(k==='unresolved')return showDrill(root,u,s,`${year}년 미종결 사고`,i=>i.status!=='closed');
      showDrill(root,u,s,`${year}년 전체 사고`);
    }));
    const openCost=category=>showDrill(root,u,s,`${year}년 ${category==='person'?'대인':'대물'} 사고`,i=>i.category===category,{target:root.querySelector('[data-cost-drill]'),costs:true});
    root.querySelectorAll('[data-cost-category]').forEach(b=>{b.addEventListener('click',()=>openCost(b.dataset.costCategory));if(b.tagName.toLowerCase()==='circle')b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCost(b.dataset.costCategory)}})});
    root.querySelectorAll('[data-cost-unknown]').forEach(b=>b.addEventListener('click',()=>showDrill(root,u,s,`${year}년 피해비용 미확인 사고`,i=>a.cost(i)===null,{target:b.closest('.analysis-card').querySelector('[data-missing-drill],[data-cost-drill]'),costs:true})));
    window.ENLManagementPoints?.mount(root);
    root.querySelectorAll('[data-stats-month]').forEach(b=>b.addEventListener('click',()=>{const month=b.dataset.statsMonth;showDrill(root,u,s,`${month.replace('-','년 ')}월 사고`,i=>a.dateKey(i).slice(0,7)===month,{target:root.querySelector('[data-month-drill]')})}));
  }
  function enhanceNav(u){
    if(!canUseStats(u))return;
    const nav=document.querySelector('.shell411-nav');if(!nav)return;
    let b=nav.querySelector('[data-stats426-nav]');
    if(!b){b=document.createElement('button');b.type='button';b.className='stats426-nav';b.dataset.stats426Nav='1';b.dataset.shellView='stats';b.textContent='대시보드';nav.prepend(b)}
    nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',currentView==='stats'?x===b:x!==b&&x.classList.contains('on')));
    b.onclick=()=>{currentView='stats';try{enlPlatformSection='incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}window.renderShell?.(u)};
  }

  const baseRenderShell=typeof window.renderShell==='function'?window.renderShell:null;
  const baseRenderCurrentView=typeof window.renderCurrentView==='function'?window.renderCurrentView:null;
  if(baseRenderShell){
    window.renderShell=function(u){
      const root=baseRenderShell(u);enhanceNav(u);return root;
    };
  }
  if(baseRenderCurrentView){
    window.renderCurrentView=function(u){
      if(currentView==='stats'&&canUseStats(u)){const root=document.getElementById('view');enhanceNav(u);renderStats(root,u);return root}
      const root=baseRenderCurrentView(u);enhanceNav(u);return root;
    };
  }
  try{const u=currentUser?.();if(u&&canUseStats(u))enhanceNav(u)}catch(e){}

  window.enlRenderIncidentStats=renderStats;
  window.ENL_INCIDENT_STATS_VERSION=VERSION;
})();
