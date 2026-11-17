/* Read-only dashboard summary. Uses the existing authorized incident snapshot. */
(()=>{
  'use strict';
  const text=v=>String(v??'').trim();
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Number(n).toLocaleString('ko-KR');
  const siteName=id=>window.ENLContracts?.site(id)?.site_name||(typeof siteById==='function'?siteById(id)?.name:'')||'사업장명 확인 필요';
  function build(items,year,{today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),reviewReasons=window.enlLegalReviewReasons}={}){
    const a=window.ENLIncidentAnalysis,all=a.records(items),y=Number(year),nowYear=Number(today.slice(0,4));
    const end=y===nowYear?today:`${y}-12-31`,month=Number(end.slice(5,7)),day=Number(end.slice(8));
    const previousEnd=`${y-1}-${String(month).padStart(2,'0')}-${String(Math.min(day,new Date(Date.UTC(y-1,month,0)).getUTCDate())).padStart(2,'0')}`;
    const sites=new Map(),groups=new Map();
    const m={year:String(year),end,previousEnd,total:0,previous:0,unresolved:0,legalPending:0,legalUnknown:0,repeated:0,missingDate:0,future:0,missingSite:0,missingType:0,sites:[],change:'확인 필요'};
    for(const i of all){
      const d=a.dateKey(i);if(!d){m.missingDate++;continue;}if(d>today){m.future++;continue;}
      if(d>=`${y-1}-01-01`&&d<=previousEnd)m.previous++;
      if(d<`${y}-01-01`||d>end||y>nowYear)continue;
      m.total++;const unresolved=i.status!=='closed';if(unresolved)m.unresolved++;
      if(i.category==='person'){
        const leave=text(i.leaveEstimate||i.reportDetails?.leaveEstimate),severity=text(i.severity);
        const reasons=typeof reviewReasons==='function'?reviewReasons(i.category,i.severity,leave):null;
        if(reasons?.length){
          const signature=[i.category,severity,leave].join('|');
          if(!(i.legalReviewStatus==='reviewed'&&(!i.legalReviewSignature||i.legalReviewSignature===signature)))m.legalPending++;
        }else if(!reasons||!['none','under3','3plus','longterm','fatal'].includes(leave)||!['minor','moderate','major'].includes(severity))m.legalUnknown++;
      }else if(!['property','near_miss'].includes(i.category))m.legalUnknown++;
      const id=text(i.siteId),type=text(i.eventType),category=text(i.category);
      if(!id){m.missingSite++;continue;}
      if(!sites.has(id))sites.set(id,{id,name:siteName(id),total:0,unresolved:0,repeated:0,missingType:0});
      const site=sites.get(id);site.total++;if(unresolved)site.unresolved++;
      if(!type||['기타','미입력','unknown'].includes(type)||!category){site.missingType++;m.missingType++;continue;}
      const key=JSON.stringify([id,category,type]),count=groups.get(key)||0;
      if(count){site.repeated++;m.repeated++;}groups.set(key,count+1);
    }
    if(m.total>0&&m.previous>0&&y<=nowYear)m.change=a.change(m.total,m.previous);
    const ranked=[...sites.values()].sort((a,b)=>b.unresolved-a.unresolved||b.repeated-a.repeated||b.total-a.total||a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id));
    ranked.forEach((site,index)=>{const before=ranked[index-1];site.rank=before&&site.unresolved===before.unresolved&&site.repeated===before.repeated&&site.total===before.total?before.rank:index+1;});
    const ranks=new Map();for(const site of ranked)ranks.set(site.rank,(ranks.get(site.rank)||0)+1);
    m.sites=ranked.slice(0,3).map(site=>({...site,tied:ranks.get(site.rank)>1}));
    return m;
  }
  function html(m,{ready=true}={}){
    const checked=ready&&m.total>0,legal=checked?`${num(m.legalPending)}건${m.legalUnknown?' + 확인 필요':''}`:'확인 필요';
    return `<aside class="management-points" aria-labelledby="management-points-title"><header><h3 id="management-points-title">핵심 관리 포인트</h3><span>${esc(m.year)}년</span></header><div class="management-points-body" tabindex="0" role="region" aria-label="핵심 관리 포인트 내용"><h4>사고 핵심 요약</h4><dl><div><dt>전년 동기 대비</dt><dd>${esc(ready?m.change:'확인 필요')}</dd></div><div><dt>미종결 사고</dt><dd>${checked?num(m.unresolved)+'건':'확인 필요'}</dd></div><div><dt>산재 검토 필요<small>기존 법정 보고 검토 대기</small></dt><dd>${esc(legal)}</dd></div><div><dt>재발사고</dt><dd>확인 필요</dd></div></dl><p class="management-points-note">${ready?`등록 ${num(m.total)}건 기준${m.legalUnknown?` / 휴업 등 정보 확인 ${num(m.legalUnknown)}건`:''}`:'최신 서버 자료 확인 전'}<br>동일 유형 추가 발생 ${checked?num(m.repeated)+'건':'확인 필요'}<br>재발 확정 건수와 구분합니다.</p><h4>우선 관리 사업장 TOP 3</h4><ol>${ready?m.sites.map(s=>`<li data-analysis-rank="${s.rank}"><span class="management-points-rank">${s.tied?'공동 ':''}${s.rank}위</span><div><strong>${esc(s.name)}</strong><small>미종결 ${num(s.unresolved)}건 / 동일유형 추가 ${num(s.repeated)}건 / 발생 ${num(s.total)}건${s.missingType?' / 유형 확인 필요':''}</small></div></li>`).join(''):''}</ol>${!ready||!m.sites.length?'<p class="management-points-note">선정 자료 확인 필요</p>':''}<details><summary>집계 기준과 확인할 정보</summary><p>발생일 기준 ${esc(m.year)}.01.01 ~ ${esc(m.end.replaceAll('-','.'))}. 전년 비교도 같은 기간입니다. 양쪽 기간에 등록 자료가 있어야 증감을 표시하며 자료가 없는 해를 무사고로 간주하지 않습니다.</p><p>산재 검토는 기존 법정 보고 검토 대기 기준이며 산재 인정 여부를 뜻하지 않습니다. 검토 완료 상태와 입력 정보 변경 여부를 함께 확인합니다.</p><p>재발 여부를 확정하는 입력 항목이 없어 재발사고 건수는 산출하지 않습니다. 동일 사업장, 사고 구분, 사고 유형이 같은 기록의 첫 건을 제외한 추가 발생만 따로 셉니다. 기타 유형은 제외합니다.</p><p>미종결 → 동일유형 추가 발생 → 전체 발생 건수 순으로 정렬합니다. 동률은 공동 순위이며 사업장명 순으로 최대 3곳을 표시합니다. 인원과 작업량 차이는 보정하지 않습니다.</p><p>선택 연도 사업장 미입력 ${num(m.missingSite)}건은 순위에서 제외합니다. 유형 확인 필요 ${num(m.missingType)}건은 반복 집계에서 제외합니다. 전체 자료 중 발생일 미확인 ${num(m.missingDate)}건, 미래 발생일 ${num(m.future)}건은 기간 집계에서 제외합니다. 미종결은 현재 처리 상태입니다. 과거사고 입력은 포함하고 임시저장과 무효 기록은 제외합니다.</p></details></div></aside>`;
  }
  let dispose=()=>{};
  function mount(root){
    dispose();const points=root.querySelector('.management-points'),stats=root.querySelector('.stats426');if(!points||!stats)return;
    let frame=0,ro=null,watching=null,stopped=false;
    const stop=()=>{stopped=true;cancelAnimationFrame(frame);ro?.disconnect();observer.disconnect();window.removeEventListener('resize',schedule)};
    function schedule(){if(stopped)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(place)}
    function place(){
      if(!points.isConnected){stop();return;}
      const overview=stats.querySelector('.incident-overview'),cards=overview?.querySelector('.stats426-cards'),map=overview?.querySelector('[data-sd450-map]');
      if(!overview||!cards||!map)return;
      if(watching!==map&&typeof ResizeObserver==='function'){ro?.disconnect();ro=new ResizeObserver(schedule);for(const node of [overview,cards,map])ro.observe(node);watching=map;}
      const area=overview.getBoundingClientRect(),cardBox=cards.getBoundingClientRect(),mapBox=map.getBoundingClientRect();
      const top=cardBox.bottom-area.top+12,available=Math.floor(mapBox.bottom-cardBox.bottom-12);
      // Fill only existing free space. Small screens keep the card in normal flow.
      const rail=window.innerWidth>900&&available>=180&&cardBox.width>=170;
      if(rail){
        points.classList.add('management-points-rail');points.style.setProperty('--points-top',top+'px');points.style.setProperty('--points-left',(cardBox.left-area.left)+'px');points.style.setProperty('--points-width',cardBox.width+'px');points.style.setProperty('--points-height',available+'px');
        if(points.parentElement!==overview)overview.append(points);
      }else{
        points.classList.remove('management-points-rail');points.removeAttribute('style');
        if(points.parentElement!==stats)stats.insertBefore(points,stats.querySelector('#stats426Drill'));
      }
    }
    const observer=new MutationObserver(()=>{if(!points.isConnected){stop();return;}if(!watching)schedule()});
    observer.observe(root,{childList:true,subtree:true});window.addEventListener('resize',schedule);dispose=stop;schedule();
  }
  window.ENLManagementPoints={build,html,mount};
})();
