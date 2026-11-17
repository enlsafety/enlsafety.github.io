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
    const checked=ready&&m.total>0,site=ready?m.sites[0]:null;
    const legal=checked?`${num(m.legalPending)}건${m.legalUnknown?' / 확인 '+num(m.legalUnknown):''}`:'확인 필요';
    const reason=site?(site.unresolved?`미종결 ${num(site.unresolved)}건`:site.repeated?`동일유형 추가 ${num(site.repeated)}건`:`등록 사고 ${num(site.total)}건`):'선정 자료 확인 필요';
    return `<aside class="management-points" aria-labelledby="management-points-title"><header><h3 id="management-points-title">핵심 관리 포인트</h3><span>${esc(m.year)}년</span></header><div class="management-points-body"><dl><div><dt>전년 동기 대비</dt><dd>${esc(ready?m.change:'확인 필요')}</dd></div><div><dt>미종결 사고</dt><dd>${checked?num(m.unresolved)+'건':'확인 필요'}</dd></div><div><dt title="기존 법정 보고 검토 대기이며 산재 인정 건수가 아닙니다.">법정 보고 검토</dt><dd>${esc(legal)}</dd></div></dl><div class="management-points-focus" data-analysis-rank="${site?.rank||0}" title="미종결 → 동일유형 추가 발생 → 전체 발생 건수 순. 같은 원인의 재발로 확정한 수치가 아닙니다."><span>우선 관리 사업장${site?.tied?' / 공동 1위':''}</span><strong>${site?esc(site.name):'확인 필요'}</strong><small>${esc(reason)}</small></div>${ready?'':'<small class="management-points-note">최신 서버 자료 확인 전</small>'}</div></aside>`;
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
      if(watching!==map&&typeof ResizeObserver==='function'){ro?.disconnect();ro=new ResizeObserver(schedule);for(const node of [overview,cards,map,points])ro.observe(node);watching=map;}
      const area=overview.getBoundingClientRect(),cardBox=cards.getBoundingClientRect(),mapBox=map.getBoundingClientRect();
      const top=cardBox.bottom-area.top+12,available=Math.floor(mapBox.bottom-cardBox.bottom-12);
      // Fill only existing free space. Small screens keep the card in normal flow.
      points.classList.add('management-points-rail');
      points.style.setProperty('--points-top',top+'px');points.style.setProperty('--points-left',(cardBox.left-area.left)+'px');points.style.setProperty('--points-width',cardBox.width+'px');
      const required=Math.max(180,Math.ceil(points.getBoundingClientRect().height));
      const rail=window.innerWidth>900&&available>=required&&cardBox.width>=170;
      if(rail){
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
