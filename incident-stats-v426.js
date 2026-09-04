/* E&L Accident Report App v4.2.6 - lightweight incident statistics */
(function(){
  'use strict';
  const VERSION='4.2.6-simple-stats1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};

  function css(){
    if(document.getElementById('incidentStats426Css'))return;
    const s=document.createElement('style');s.id='incidentStats426Css';s.textContent=`
      .stats426{display:grid;gap:13px}.stats426-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.stats426-head h2{margin:0;color:#173b66;font-size:24px}.stats426-head p{margin:5px 0 0;color:#6b7f92}.stats426-filter{display:flex;gap:7px;flex-wrap:wrap}.stats426-filter select{min-height:42px;border:1.5px solid #cbd9e5;border-radius:10px;background:#fff;color:#294b68;padding:0 34px 0 10px;font-weight:850}.stats426-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.stats426-card{padding:15px;border:1px solid #d7e3ed;border-radius:14px;background:#fff;box-shadow:0 3px 10px rgba(22,67,104,.04)}.stats426-card span{display:block;color:#72869a;font-size:11px;font-weight:850}.stats426-card b{display:block;margin-top:5px;color:#173b66;font-size:27px}.stats426-card small{display:block;margin-top:4px;color:#7a8d9e;font-size:11px}.stats426-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.75fr);gap:12px}.stats426-chart{padding:15px;border:1px solid #d7e3ed;border-radius:14px;background:#fff}.stats426-chart h3{margin:0;color:#244d70;font-size:16px}.stats426-chart p{margin:4px 0 0;color:#788b9b;font-size:11px}.stats426-months{height:190px;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));align-items:end;gap:5px;margin-top:17px;border-bottom:1px solid #d8e2eb;padding:0 2px 1px}.stats426-month{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px;min-width:0}.stats426-month b{font-size:10px;color:#49667e}.stats426-bar{width:min(28px,75%);min-height:3px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#4f91c2,#1e5d91)}.stats426-month span{font-size:9px;color:#7a8c9d;white-space:nowrap}.stats426-donut-wrap{display:flex;align-items:center;justify-content:center;gap:18px;min-height:190px;margin-top:8px}.stats426-donut{width:132px;height:132px;border-radius:50%;position:relative;flex:0 0 auto}.stats426-donut:after{content:'';position:absolute;inset:25px;border-radius:50%;background:#fff}.stats426-donut-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center;z-index:1;color:#688097;font-size:10px;font-weight:800}.stats426-donut-center b{display:block;color:#173b66;font-size:24px;line-height:1.1}.stats426-legend{display:grid;gap:9px;min-width:115px}.stats426-legend div{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:7px;font-size:11px;color:#566f84}.stats426-dot{width:9px;height:9px;border-radius:50%}.stats426-person{background:#d65b65}.stats426-property{background:#457fae}.stats426-other{background:#bdc9d3}.stats426-legend b{color:#294b68}.stats426-sites{display:grid;gap:7px;margin-top:11px}.stats426-site{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 11px;border:1px solid #dce6ee;border-radius:10px;background:#fff}.stats426-rank{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#edf6fc;color:#245b86;font-size:11px;font-weight:950}.stats426-site b{color:#294b68;font-size:13px}.stats426-site strong{color:#173b66;font-size:14px}.stats426-empty{padding:28px 10px;text-align:center;color:#8191a0}.stats426-note{margin:0;color:#8090a0;font-size:10px;line-height:1.5}@media(max-width:760px){.stats426-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.stats426-grid{grid-template-columns:1fr}.stats426-months{height:165px;gap:3px}.stats426-donut-wrap{min-height:160px}}@media(max-width:480px){.stats426-filter{width:100%}.stats426-filter select{flex:1 1 130px;min-width:0}.stats426-card{padding:12px}.stats426-card b{font-size:24px}.stats426-chart{padding:12px}.stats426-month span{font-size:8px}.stats426-donut{width:118px;height:118px}.stats426-donut:after{inset:23px}}
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
    return `<div class="stats426-months">${months.map(x=>{const h=x.count?Math.max(8,Math.round((x.count/max)*142)):3;return `<div class="stats426-month"><b>${x.count||''}</b><div class="stats426-bar" style="height:${h}px" title="${x.month}월 ${x.count}건"></div><span>${x.month}월</span></div>`}).join('')}</div>`
  }
  function donut(s){
    const pp=pct(s.person,s.total),dp=pct(s.property,s.total),op=Math.max(0,Math.round((100-pp-dp)*10)/10),pEnd=pp,dEnd=Math.min(100,pp+dp);
    const bg=s.total?`conic-gradient(#d65b65 0 ${pEnd}%,#457fae ${pEnd}% ${dEnd}%,#bdc9d3 ${dEnd}% 100%)`:'conic-gradient(#e7edf2 0 100%)';
    return `<div class="stats426-donut-wrap"><div class="stats426-donut" style="background:${bg}"><div class="stats426-donut-center"><b>${s.total}</b>전체 사고</div></div><div class="stats426-legend"><div><i class="stats426-dot stats426-person"></i><span>인명사고</span><b>${s.person}건 · ${pp}%</b></div><div><i class="stats426-dot stats426-property"></i><span>대물사고</span><b>${s.property}건 · ${dp}%</b></div><div><i class="stats426-dot stats426-other"></i><span>기타</span><b>${s.other}건 · ${op}%</b></div></div></div>`
  }
  function siteRanking(rows){return rows.length?`<div class="stats426-sites">${rows.map((x,idx)=>`<div class="stats426-site"><span class="stats426-rank">${idx+1}</span><b>${escx(x.name)}</b><strong>${x.count}건</strong></div>`).join('')}</div>`:'<div class="stats426-empty">해당 기간의 사고기록이 없습니다.</div>'}

  function renderStats(root,u,state={}){
    if(!root||!u)return;
    css();
    const all=allowedIncidents(u),years=availableYears(all),year=Number(state.year)||years[0]||new Date().getFullYear(),siteId=String(state.siteId||''),sites=sitesForFilter(),s=summarize(all,year,siteId),role=roleNorm(u.role);
    root.innerHTML=`<section class="stats426"><section class="panel"><div class="stats426-head"><div><div class="ey">SIMPLE STATISTICS</div><h2>사고 간단 통계</h2><p>${role==='safety'?'전체 사고보고 자료':'승인·종결 사고'}를 기준으로 간단히 보여줍니다.</p></div><div class="stats426-filter"><select id="stats426Year" aria-label="통계 연도">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}년</option>`).join('')}</select><select id="stats426Site" aria-label="통계 사업장"><option value="">전체 사업장</option>${sites.map(x=>`<option value="${escx(x.id)}" ${x.id===siteId?'selected':''}>${escx(x.name)}</option>`).join('')}</select></div></div></section><div class="stats426-cards"><div class="stats426-card"><span>${year}년 전체 사고</span><b>${s.total}건</b><small>${siteId?escx(siteName(siteId)):'전체 사업장'}</small></div><div class="stats426-card"><span>인명사고</span><b>${s.person}건</b><small>전체의 ${pct(s.person,s.total)}%</small></div><div class="stats426-card"><span>대물사고</span><b>${s.property}건</b><small>전체의 ${pct(s.property,s.total)}%</small></div><div class="stats426-card"><span>미종결 사고</span><b>${s.unresolved}건</b><small>현재 종결 전 상태</small></div></div><div class="stats426-grid"><section class="stats426-chart"><h3>월별 사고 발생</h3><p>${year}년 월별 사고건수</p>${monthChart(s.months)}</section><section class="stats426-chart"><h3>사고 유형 비율</h3><p>인명 · 대물 · 기타</p>${donut(s)}</section></div><section class="stats426-chart"><h3>사업장별 사고건수</h3><p>사고가 많은 사업장부터 최대 10개까지 표시합니다.</p>${siteRanking(s.siteRows)}</section><p class="stats426-note">※ 이 화면은 법정 재해율이 아닌 사고보고앱 등록자료의 단순 통계입니다. 재해율·도수율 등 공식 지표는 별도 기준 확정 후 추가합니다.</p></section>`;
    const y=document.getElementById('stats426Year'),site=document.getElementById('stats426Site');
    if(y)y.onchange=()=>renderStats(root,u,{year:Number(y.value),siteId:site?.value||''});
    if(site)site.onchange=()=>renderStats(root,u,{year:Number(y?.value)||year,siteId:site.value});
  }

  window.enlRenderIncidentStats=renderStats;
  window.ENL_INCIDENT_STATS_VERSION=VERSION;
})();
