/* E&L Accident Report App v4.2.8 - interactive incident dashboard */
(function(){
  'use strict';
  const VERSION='4.2.8-dashboard-drilldown1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const canUseStats=u=>!!u&&['safety','manager','executive'].includes(roleNorm(u.role));

  function css(){
    if(document.getElementById('incidentStats426Css'))return;
    const s=document.createElement('style');s.id='incidentStats426Css';s.textContent=`
      .stats426{display:grid;gap:13px}.stats426-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.stats426-head h2{margin:0;color:#173b66;font-size:24px}.stats426-head p{margin:5px 0 0;color:#6b7f92}.stats426-filter{display:flex;gap:7px;flex-wrap:wrap}.stats426-filter select{min-height:42px;border:1.5px solid #cbd9e5;border-radius:10px;background:#fff;color:#294b68;padding:0 34px 0 10px;font-weight:850}.stats426-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.stats426-card{padding:15px;border:1px solid #d7e3ed;border-radius:14px;background:#fff;box-shadow:0 3px 10px rgba(22,67,104,.04)}.stats426-card span{display:block;color:#72869a;font-size:11px;font-weight:850}.stats426-card b{display:block;margin-top:5px;color:#173b66;font-size:27px}.stats426-card small{display:block;margin-top:4px;color:#7a8d9e;font-size:11px}.stats426-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.75fr);gap:12px}.stats426-chart{padding:15px;border:1px solid #d7e3ed;border-radius:14px;background:#fff}.stats426-chart h3{margin:0;color:#244d70;font-size:16px}.stats426-chart p{margin:4px 0 0;color:#788b9b;font-size:11px}.stats426-months{height:190px;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));align-items:end;gap:5px;margin-top:17px;border-bottom:1px solid #d8e2eb;padding:0 2px 1px}.stats426-month{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px;min-width:0}.stats426-month b{font-size:10px;color:#49667e}.stats426-bar{width:min(28px,75%);min-height:3px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#4f91c2,#1e5d91)}.stats426-month span{font-size:9px;color:#7a8c9d;white-space:nowrap}.stats426-donut-wrap{display:flex;align-items:center;justify-content:center;gap:18px;min-height:190px;margin-top:8px}.stats426-donut{width:132px;height:132px;border-radius:50%;position:relative;flex:0 0 auto}.stats426-donut:after{content:'';position:absolute;inset:25px;border-radius:50%;background:#fff}.stats426-donut-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center;z-index:1;color:#688097;font-size:10px;font-weight:800}.stats426-donut-center b{display:block;color:#173b66;font-size:24px;line-height:1.1}.stats426-legend{display:grid;gap:9px;min-width:115px}.stats426-legend div{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:7px;font-size:11px;color:#566f84}.stats426-dot{width:9px;height:9px;border-radius:50%}.stats426-person{background:#d65b65}.stats426-property{background:#457fae}.stats426-other{background:#bdc9d3}.stats426-legend b{color:#294b68}.stats426-sites{display:grid;gap:7px;margin-top:11px}.stats426-site{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 11px;border:1px solid #dce6ee;border-radius:10px;background:#fff}.stats426-rank{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#edf6fc;color:#245b86;font-size:11px;font-weight:950}.stats426-site b{color:#294b68;font-size:13px}.stats426-site strong{color:#173b66;font-size:14px}.stats426-empty{padding:28px 10px;text-align:center;color:#8191a0}.stats426-note{margin:0;color:#8090a0;font-size:10px;line-height:1.5}.stats426-nav{position:relative}
      .stats426-card{appearance:none;width:100%;text-align:left;font:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}.stats426-card:hover,.stats426-card:focus-visible{border-color:#7fa9c9;box-shadow:0 6px 16px rgba(23,59,102,.09);outline:none}.stats426-card:active{transform:translateY(1px)}
      .stats426-month{appearance:none;border:0;background:transparent;padding:0;font:inherit;cursor:pointer;border-radius:8px}.stats426-month:hover,.stats426-month:focus-visible{background:#f3f9fd;outline:2px solid #b8d4e8;outline-offset:2px}.stats426-month:active{transform:translateY(1px)}
      .stats426-drill{display:none;padding:14px;border:1px solid #cbdde9;border-radius:14px;background:#f8fcff;box-shadow:0 5px 16px rgba(27,73,109,.05)}.stats426-drill.show{display:block}.stats426-drill-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}.stats426-drill-head h3{margin:0;color:#173b66;font-size:17px}.stats426-drill-head p{margin:4px 0 0;color:#6d8294;font-size:11px}.stats426-drill-close{min-height:34px;border:1px solid #b8cada;border-radius:9px;background:#fff;color:#46657d;font-weight:900;padding:0 10px;cursor:pointer}.stats426-drill-list{display:grid;gap:7px}.stats426-drill-row{display:grid;grid-template-columns:105px minmax(110px,.85fr) minmax(115px,.8fr) minmax(0,2fr) auto;gap:8px;align-items:center;width:100%;border:1px solid #d9e5ee;border-radius:11px;background:#fff;padding:10px;text-align:left;font:inherit;color:inherit;cursor:pointer}.stats426-drill-row:hover,.stats426-drill-row:focus-visible{border-color:#82a9c7;box-shadow:0 4px 10px rgba(23,59,102,.06);outline:none}.stats426-drill-row .date{color:#31566f;font-size:11px;font-weight:900}.stats426-drill-row .site{color:#173b66;font-size:12px;font-weight:900}.stats426-drill-row .type{color:#60798c;font-size:11px}.stats426-drill-row .summary{min-width:0;color:#314e65;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stats426-drill-row .state{font-size:10px;font-weight:900;color:#5f7385;background:#eef4f8;border-radius:999px;padding:5px 8px;white-space:nowrap}.stats426-site{transition:border-color .15s,background .15s,box-shadow .15s}.stats426-site-attention{border-color:#efc36c;background:#fff9e9;box-shadow:inset 3px 0 0 #e4a72b}.stats426-site-manage{border-color:#e49b9f;background:#fff1f2;box-shadow:inset 3px 0 0 #cf3f48}.stats426-site-flag{display:inline-flex;align-items:center;min-height:22px;margin-left:7px;padding:0 7px;border-radius:999px;font-size:9px;font-weight:950;vertical-align:middle}.stats426-site-flag.attention{background:#fff0bd;color:#8b5b00;border:1px solid #efc45e}.stats426-site-flag.manage{background:#ffdfe2;color:#9e252e;border:1px solid #e8a0a5}@media(max-width:760px){.stats426-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.stats426-grid{grid-template-columns:1fr}.stats426-months{height:165px;gap:3px}.stats426-donut-wrap{min-height:160px}}@media(max-width:480px){.stats426-filter{width:100%}.stats426-filter select{flex:1 1 130px;min-width:0}.stats426-card{padding:12px}.stats426-card b{font-size:24px}.stats426-chart{padding:12px}.stats426-month span{font-size:8px}.stats426-donut{width:118px;height:118px}.stats426-donut:after{inset:23px}}
    `;document.head.appendChild(s)
  }

  function allowedIncidents(u){
    const role=roleNorm(u?.role),all=[...(data?.incidents||[])];
    if(role==='safety')return all;
    if(['manager','executive'].includes(role))return all.filter(i=>['approved','closed'].includes(String(i?.status||'')));
    return [];
  }
  function validDate(i){const d=new Date(i?.occurredAt||'');return Number.isFinite(d.getTime())?d:null}
  function availableYears(arr){
    const set=new Set([new Date().getFullYear()]);
    arr.forEach(i=>{const d=validDate(i);if(d)set.add(d.getFullYear())});
    return [...set].sort((a,b)=>b-a)
  }
  function sitesForFilter(){
    const map=new Map();
    [...(data?.sites||[]),...(window.ENL_SITE_DIRECTORY||[])].forEach(s=>{if(s?.id&&s.id!=='site-hq')map.set(String(s.id),{id:String(s.id),name:s.name||String(s.id)})});
    return [...map.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'))
  }
  function pct(n,total){return total?Math.round((n/total)*1000)/10:0}
  function summarize(arr,year,siteId){
    const filtered=arr.filter(i=>{const d=validDate(i);return d&&d.getFullYear()===Number(year)&&(!siteId||String(i.siteId||'')===String(siteId))});
    const person=filtered.filter(i=>String(i.category||'')==='person').length;
    const property=filtered.filter(i=>String(i.category||'')==='property').length;
    const other=Math.max(0,filtered.length-person-property);
    const unresolved=filtered.filter(i=>String(i.status||'')!=='closed').length;
    const months=Array.from({length:12},(_,idx)=>({month:idx+1,count:0}));
    filtered.forEach(i=>{const d=validDate(i);if(d)months[d.getMonth()].count++});
    const siteMap=new Map();filtered.forEach(i=>{const id=String(i.siteId||'');if(!id)return;siteMap.set(id,(siteMap.get(id)||0)+1)});
    const siteRows=[...siteMap.entries()].map(([id,count])=>({id,name:siteName(id),count})).sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),'ko')).slice(0,10);
    return {filtered,total:filtered.length,person,property,other,unresolved,months,siteRows}
  }
  function monthChart(months){
    const max=Math.max(1,...months.map(x=>x.count));
    return `<div class="stats426-months">${months.map(x=>{const h=x.count?Math.max(8,Math.round((x.count/max)*142)):3;return `<button type="button" class="stats426-month" data-stats-month="${x.month}" aria-label="${x.month}월 사고 ${x.count}건 보기"><b>${x.count||''}</b><div class="stats426-bar" style="height:${h}px" title="${x.month}월 ${x.count}건"></div><span>${x.month}월</span></button>`}).join('')}</div>`
  }
  function donut(s){
    const pp=pct(s.person,s.total),dp=pct(s.property,s.total),op=Math.max(0,Math.round((100-pp-dp)*10)/10),pEnd=pp,dEnd=Math.min(100,pp+dp);
    const bg=s.total?`conic-gradient(#d65b65 0 ${pEnd}%,#457fae ${pEnd}% ${dEnd}%,#bdc9d3 ${dEnd}% 100%)`:'conic-gradient(#e7edf2 0 100%)';
    return `<div class="stats426-donut-wrap"><div class="stats426-donut" style="background:${bg}"><div class="stats426-donut-center"><b>${s.total}</b>전체 사고</div></div><div class="stats426-legend"><div><i class="stats426-dot stats426-person"></i><span>인명사고</span><b>${s.person}건 · ${pp}%</b></div><div><i class="stats426-dot stats426-property"></i><span>대물사고</span><b>${s.property}건 · ${dp}%</b></div><div><i class="stats426-dot stats426-other"></i><span>기타</span><b>${s.other}건 · ${op}%</b></div></div></div>`
  }
  function siteRanking(rows){return rows.length?`<div class="stats426-sites">${rows.map((x,idx)=>{const level=x.count>=5?'manage':x.count>=3?'attention':'';const cls=level?\` stats426-site-${level}\`:'';const flag=level==='manage'?'<span class="stats426-site-flag manage">관리필요</span>':level==='attention'?'<span class="stats426-site-flag attention">관심요망</span>':'';return `<div class="stats426-site${cls}"><span class="stats426-rank">${idx+1}</span><b>${escx(x.name)}${flag}</b><strong>${x.count}건</strong></div>`}).join('')}</div>`:'<div class="stats426-empty">해당 기간의 사고기록이 없습니다.</div>'}

  function whenText(i){const d=validDate(i);if(!d)return '-';try{return new Intl.DateTimeFormat('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}catch(e){return String(i?.occurredAt||'-')}}
  function statusText(i){const s=String(i?.status||'');return s==='closed'?'종결':s==='approved'?'승인':s==='rejected'?'반려':s==='reported'?'검토대기':'진행중'}
  function recentFirst(arr){return [...arr].sort((a,b)=>(validDate(b)?.getTime()||0)-(validDate(a)?.getTime()||0))}
  function incidentLabel(i){if(String(i?.category||'')==='person')return '인명사고';if(String(i?.category||'')==='property')return '대물사고';return i?.eventType||'기타사고'}
  function openIncident(id,u){if(typeof window.enlOpenIncidentReview==='function')return window.enlOpenIncidentReview(id,roleNorm(u?.role)==='safety',u);if(typeof window.openIncidentModal==='function')return window.openIncidentModal(id,roleNorm(u?.role)==='safety',u)}
  function drillRows(arr){
    return arr.length?arr.map(i=>`<button type="button" class="stats426-drill-row" data-stats-inc="${escx(i.id)}"><span class="date">${escx(whenText(i))}</span><span class="site">${escx(siteName(i.siteId))}</span><span class="type">${escx(incidentLabel(i))}</span><span class="summary">${escx(i.summary||i.reportDetails?.incidentHow||i.eventType||'사고 상세내용 확인')}</span><span class="state">${escx(statusText(i))}</span></button>`).join(''):'<div class="stats426-empty">해당 조건의 사고가 없습니다.</div>'
  }
  function showDrill(root,u,s,title,predicate){
    const box=root.querySelector('#stats426Drill');if(!box)return;
    const arr=recentFirst((s.filtered||[]).filter(predicate||(()=>true)));
    box.classList.add('show');box.innerHTML=`<div class="stats426-drill-head"><div><h3>${escx(title)}</h3><p>${arr.length}건 · 최근 발생일 순</p></div><button type="button" class="stats426-drill-close" data-stats-close>닫기</button></div><div class="stats426-drill-list">${drillRows(arr)}</div>`;
    box.querySelector('[data-stats-close]')?.addEventListener('click',()=>{box.classList.remove('show');box.innerHTML=''});
    box.querySelectorAll('[data-stats-inc]').forEach(b=>b.addEventListener('click',()=>openIncident(b.dataset.statsInc,u)));
    try{box.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(e){}
  }

  function renderStats(root,u,state={}){
    if(!root||!u)return;
    css();
    const all=allowedIncidents(u),years=availableYears(all),year=Number(state.year)||years[0]||new Date().getFullYear(),siteId=String(state.siteId||''),sites=sitesForFilter(),s=summarize(all,year,siteId),role=roleNorm(u.role);
    root.innerHTML=`<section class="stats426"><section class="panel"><div class="stats426-head"><div><div class="ey">SIMPLE STATISTICS</div><h2>사고 간단 통계</h2><p>${role==='safety'?'전체 사고보고 자료':'승인·종결 사고'}를 기준으로 간단히 보여줍니다.</p></div><div class="stats426-filter"><select id="stats426Year" aria-label="통계 연도">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}년</option>`).join('')}</select><select id="stats426Site" aria-label="통계 사업장"><option value="">전체 사업장</option>${sites.map(x=>`<option value="${escx(x.id)}" ${x.id===siteId?'selected':''}>${escx(x.name)}</option>`).join('')}</select></div></div></section><div class="stats426-cards"><button type="button" class="stats426-card" data-stats-filter="all"><span>${year}년 전체 사고</span><b>${s.total}건</b><small>${siteId?escx(siteName(siteId)):'전체 사업장'} · 목록보기</small></button><button type="button" class="stats426-card" data-stats-filter="person"><span>인명사고</span><b>${s.person}건</b><small>전체의 ${pct(s.person,s.total)}% · 목록보기</small></button><button type="button" class="stats426-card" data-stats-filter="property"><span>대물사고</span><b>${s.property}건</b><small>전체의 ${pct(s.property,s.total)}% · 목록보기</small></button><button type="button" class="stats426-card" data-stats-filter="unresolved"><span>미종결 사고</span><b>${s.unresolved}건</b><small>현재 종결 전 상태 · 목록보기</small></button></div><section id="stats426Drill" class="stats426-drill" aria-live="polite"></section><div class="stats426-grid"><section class="stats426-chart"><h3>월별 사고 발생</h3><p>${year}년 월별 사고건수 · 막대를 누르면 해당 월 사고목록을 확인할 수 있습니다.</p>${monthChart(s.months)}</section><section class="stats426-chart"><h3>사고 유형 비율</h3><p>인명 · 대물 · 기타</p>${donut(s)}</section></div><section class="stats426-chart"><h3>사업장별 사고건수</h3><p>사고가 많은 사업장부터 최대 10개까지 표시합니다. 3건 이상은 관심요망, 5건 이상은 관리필요로 강조합니다.</p>${siteRanking(s.siteRows)}</section><p class="stats426-note">※ 이 화면은 법정 재해율이 아닌 사고보고앱 등록자료의 단순 통계입니다. 재해율·도수율 등 공식 지표는 별도 기준 확정 후 추가합니다.</p></section>`;
    const y=document.getElementById('stats426Year'),site=document.getElementById('stats426Site');
    if(y)y.onchange=()=>renderStats(root,u,{year:Number(y.value),siteId:site?.value||''});
    if(site)site.onchange=()=>renderStats(root,u,{year:Number(y?.value)||year,siteId:site.value});
    root.querySelectorAll('[data-stats-filter]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.statsFilter;
      if(k==='person')return showDrill(root,u,s,`${year}년 인명사고`,i=>String(i.category||'')==='person');
      if(k==='property')return showDrill(root,u,s,`${year}년 대물사고`,i=>String(i.category||'')==='property');
      if(k==='unresolved')return showDrill(root,u,s,`${year}년 미종결 사고`,i=>String(i.status||'')!=='closed');
      return showDrill(root,u,s,`${year}년 전체 사고`);
    }));
    root.querySelectorAll('[data-stats-month]').forEach(b=>b.addEventListener('click',()=>{const month=Number(b.dataset.statsMonth);showDrill(root,u,s,`${year}년 ${month}월 사고`,i=>validDate(i)?.getMonth()+1===month)}));
  }
  function enhanceNav(u){
    if(!canUseStats(u))return;
    const nav=document.querySelector('.shell411-nav');if(!nav)return;
    let b=nav.querySelector('[data-stats426-nav]');
    if(!b){b=document.createElement('button');b.type='button';b.className='stats426-nav';b.dataset.stats426Nav='1';b.dataset.shellView='stats';b.textContent='간단 통계';nav.appendChild(b)}
    nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',currentView==='stats'?x===b:x!==b&&x.classList.contains('on')));
    b.onclick=()=>{currentView='stats';try{enlPlatformSection='incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}window.renderShell?.(u)};
  }

  const baseRenderShell=typeof window.renderShell==='function'?window.renderShell:null;
  const baseRenderCurrentView=typeof window.renderCurrentView==='function'?window.renderCurrentView:null;
  if(baseRenderShell){
    window.renderShell=function(u){
      if(currentView==='stats'&&canUseStats(u)){
        currentView='home';const root=baseRenderShell(u);currentView='stats';enhanceNav(u);renderStats(root,u);return root;
      }
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
