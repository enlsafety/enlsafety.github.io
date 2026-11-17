/* Management summary of saved initial incident reports; no extra data endpoint. */
(()=>{
  'use strict';
  let rememberedKey='',rememberedState;
  const roles=new Set(['safety','manager','executive']);
  const canRead=u=>roles.has(u?.role==='final'?'manager':u?.role);
  const text=v=>String(v??'').trim();
  const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=n=>Number(n).toLocaleString('ko-KR');
  const percent=(n,total)=>total?Math.round(n/total*100):0;
  function dateKey(i){
    const value=text(i.occurredAt||i.occurredDate);
    if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
      const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:'';
    }
    if(!value)return '';const d=new Date(value);if(!Number.isFinite(+d))return '';
    return new Date(+d+9*3600000).toISOString().slice(0,10);
  }
  function records(items){
    const unique=new Map();
    for(const i of items||[]){
      if(!i?.id||i.bulkInvalidation?.active||!['reported','supplement','supplement_submitted','approved','closed'].includes(i.status))continue;
      const old=unique.get(String(i.id));if(!old||Number(i._syncVersion||0)>=Number(old._syncVersion||0))unique.set(String(i.id),i);
    }
    return [...unique.values()];
  }
  function group(rows,get){
    const values=new Map();for(const i of rows){const key=text(get(i))||'미입력';values.set(key,(values.get(key)||0)+1);}
    return [...values].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ko'));
  }
  function cost(i){
    const d=i.reportDetails||{},key=i.category==='person'?'medicalCost':i.category==='property'?'repairCost':null;
    if(!key||d[key+'Pending']===true||d[key+'Known']===false||d.costKnown===false)return null;
    const raw=d[key];if(raw===undefined||raw===null||text(raw)==='')return null;
    const value=Number(text(raw).replace(/,/g,''));
    if(!Number.isFinite(value)||value<0)return null;
    // A legacy default zero is not evidence that the loss is zero.
    if(value===0&&d[key+'Pending']!==false&&d[key+'Known']!==true&&d.costKnown!==true)return null;
    return value;
  }
  function summarize(items,year='',site=''){
    const all=records(items),rows=all.filter(i=>(!year||dateKey(i).slice(0,4)===year)&&(!site||text(i.siteId)===site));
    const dated=rows.map(i=>dateKey(i)).filter(Boolean).sort(),costs=rows.map(cost).filter(v=>v!==null);
    const months=new Map();
    if(year){for(let m=1;m<=12;m++)months.set(year+'-'+String(m).padStart(2,'0'),0);}
    else if(dated.length){let [y,m]=dated[0].slice(0,7).split('-').map(Number);const end=dated.at(-1).slice(0,7);for(let n=0;n<1200;n++){const key=y+'-'+String(m).padStart(2,'0');months.set(key,0);if(key===end)break;if(++m>12){m=1;y++;}}}
    for(const i of rows){const date=dateKey(i);if(date)months.set(date.slice(0,7),(months.get(date.slice(0,7))||0)+1);}
    return {all,rows,dated,total:rows.length,person:rows.filter(i=>i.category==='person').length,property:rows.filter(i=>i.category==='property').length,
      cost:costs.reduce((a,b)=>a+b,0),knownCost:costs.length,
      personCost:rows.filter(i=>i.category==='person').reduce((sum,i)=>sum+(cost(i)??0),0),
      propertyCost:rows.filter(i=>i.category==='property').reduce((sum,i)=>sum+(cost(i)??0),0),
      knownPersonCost:rows.filter(i=>i.category==='person'&&cost(i)!==null).length,
      knownPropertyCost:rows.filter(i=>i.category==='property'&&cost(i)!==null).length,missingDate:rows.length-dated.length,
      types:group(rows,i=>i.eventType),sites:group(rows,i=>i.siteId),jobs:group(rows,i=>i.reportDetails?.job||i.job),
      months:[...months].map(([label,count])=>({label,count})),
      missingType:rows.filter(i=>!text(i.eventType)).length,
      missingCause:rows.filter(i=>!text(i.reportDetails?.environmentCause)&&!text(i.reportDetails?.behaviorCause)&&!text(i.reportDetails?.causeAnalysisNote)).length};
  }
  const siteName=id=>window.ENLContracts?.site(id)?.site_name||((typeof siteById==='function'?siteById(id):null)?.name)||id||'미입력';
  function rankMeta(values,value){
    if(value===null||!Number.isFinite(value)||value<=0)return {rank:0,tied:false};
    const valid=values.filter(v=>v!==null&&Number.isFinite(v)&&v>0);
    return {rank:1+valid.filter(v=>v>value).length,tied:valid.filter(v=>v===value).length>1};
  }
  function rankBadge(values,value){const r=rankMeta(values,value);return r.rank>0&&r.rank<=3?'<em class="analysis-rank-badge">'+(r.tied?'공동 ':'')+r.rank+'위</em>':'';}
  const rankAttr=(values,value)=>' data-analysis-rank="'+rankMeta(values,value).rank+'"';
  function bars(items,total,resolve=v=>v,population=items){
    const values=population.map(x=>x.count);
    const max=Math.max(1,...items.map(x=>x.count));
    return '<div class="analysis-bars">'+items.map(x=>'<div class="analysis-bar-row"'+rankAttr(values,x.count)+'><div><span>'+rankBadge(values,x.count)+escape(resolve(x.label))+'</span><strong>'+number(x.count)+'건 <small>'+percent(x.count,total)+'%</small></strong></div><div class="analysis-track" aria-hidden="true"><i style="width:'+x.count/max*100+'%"></i></div></div>').join('')+'</div>';
  }
  function priorities(s){
    const recommendations=[
      [/넘어짐|추락/,'이동 구간과 발판','미끄러운 바닥, 단차, 경사면과 승하차 발판을 먼저 확인합니다.'],
      [/설비|파손|훼손|차량|중장비|부딪힘/,'차량 동선과 시설물','작업 전 주변 시설물과 회전 반경을 확인하고 차량과 보행 동선을 점검합니다.'],
      [/맞음|타구|날아옴/,'타구와 비산물 노출','작업 위치와 경기 진행을 확인하고, 장비 작업 구역의 접근 통제를 점검합니다.'],
      [/베임|찔림|끼임/,'공구와 회전체','정비 전 동력 차단과 방호장치 상태, 손이 들어가는 작업을 점검합니다.']
    ];
    const top=s.types.filter(x=>x.label!=='미입력').slice(0,3);
    return top.map(x=>{const guide=recommendations.find(([re])=>re.test(x.label));return '<article'+rankAttr(s.types.map(t=>t.count),x.count)+'>'+rankBadge(s.types.map(t=>t.count),x.count)+'<span>'+escape(x.label)+' '+number(x.count)+'건</span><h3>'+escape(guide?.[1]||'해당 작업의 위험요인')+'</h3><p>'+escape(guide?.[2]||'발생 경위와 현장 상태를 함께 확인해 같은 작업의 예방조치를 정합니다.')+'</p></article>';}).join('');
  }
  function costBreakdown(s){
    const amount=(value,known)=>known?number(value)+'원':'미확인';
    return '<dl class="analysis-cost-breakdown"><div><dt>대인</dt><dd>'+amount(s.personCost,s.knownPersonCost)+'</dd></div><div><dt>대물</dt><dd>'+amount(s.propertyCost,s.knownPropertyCost)+'</dd></div></dl>';
  }
  function missingRows(s,interactive){
    const items=[['cost','피해비용 미확인',s.total-s.knownCost],['date','발생일 미입력',s.missingDate],['type','사고유형 미입력',s.missingType],['cause','원인분석 내용 미입력',s.missingCause]].sort((a,b)=>b[2]-a[2]);
    const values=items.map(x=>x[2]);
    return items.map(([key,label,count])=>'<tr'+rankAttr(values,count)+'><th scope="row">'+rankBadge(values,count)+label+'</th><td>'+(key==='cost'&&interactive?'<button type="button" data-cost-unknown>'+count+'건 보기</button>':count+'건')+'</td></tr>').join('');
  }
  function detailHtml(s,interactive=false){
    const maxMonth=Math.max(1,...s.months.map(x=>x.count));
    return `      <section class="analysis-card" data-analysis-month-card><h3>월별 사고 발생</h3><p>사고 발생일 기준입니다. 미입력 ${s.missingDate}건은 그래프에서 제외합니다.</p><div class="analysis-month-scroll"><div class="analysis-months" style="grid-template-columns:repeat(${Math.max(s.months.length,1)},minmax(58px,1fr))">${s.months.map(x=>'<'+(interactive?'button type="button" data-stats-month="'+x.label+'" aria-label="'+x.label+' 사고 '+x.count+'건 보기"':'div')+' class="analysis-month"'+rankAttr(s.months.map(m=>m.count),x.count)+'><span class="analysis-rank-slot">'+rankBadge(s.months.map(m=>m.count),x.count)+'</span><strong>'+x.count+'건</strong><div><i style="height:'+x.count/maxMonth*140+'px"></i></div><span>'+escape(x.label.replace('-','.'))+'</span></'+(interactive?'button':'div')+'>').join('')}</div></div><p>보고되지 않은 사고와 사업장별 근무 인원은 반영되지 않아, 건수만으로 사고율이나 안전 수준을 판단할 수 없습니다.</p>${interactive?'<section class="stats426-drill" data-month-drill aria-live="polite"></section>':''}</section>
      <div class="analysis-grid"><section class="analysis-card" data-analysis-section="types"><h3>사고유형별 분포</h3><p>최초사고보고에 선택된 유형 그대로 집계합니다.</p>${bars(s.types,s.total)}</section><section class="analysis-card" data-analysis-section="sites"><h3>사업장별 사고 건수</h3><p>상위 5개 사업장 / 전체 ${s.sites.length}개 사업장에서 보고</p>${bars(s.sites.slice(0,5),s.total,siteName,s.sites)}${s.sites.length>5?'<details><summary>나머지 '+(s.sites.length-5)+'개 사업장 보기</summary>'+bars(s.sites.slice(5),s.total,siteName,s.sites)+'</details>':''}</section></div>
      <section class="analysis-card" data-analysis-section="priorities"><h3>우선 확인할 작업</h3><p>발생 건수가 많은 유형에 맞춘 점검 제안입니다. 개별 사고의 확정 원인을 뜻하지 않습니다.</p><div class="analysis-priorities">${priorities(s)}</div></section>
      <div class="analysis-grid"><section class="analysis-card" data-analysis-section="jobs"><h3>업무별 발생 현황</h3><p>사고보고에 입력된 담당 업무 기준</p>${bars(s.jobs,s.total)}</section><section class="analysis-card" data-analysis-section="missing"><h3>추가 확인이 필요한 정보</h3><table><thead><tr><th scope="col">항목</th><th scope="col">건수</th></tr></thead><tbody>${missingRows(s,interactive)}</tbody></table>${interactive?'<section class="stats426-drill" data-missing-drill aria-live="polite"></section>':''}<p>각 항목은 중복될 수 있습니다. 원인분석이 입력됐더라도 조사 결과 확정 여부는 개별 보고서에서 확인해야 합니다.</p></section></div>
      <p class="analysis-footnote">순위 색상은 발생 건수 또는 금액 기준입니다. 같은 값은 공동 순위이며, 0건, 0원과 미확인 금액은 순위에서 제외합니다. 임시저장, 무효 처리와 삭제된 사고는 제외합니다. 종결 및 재발방지 기록은 별도 사고로 더하지 않습니다. 사업장별 건수는 인원과 작업량 차이를 보정하지 않은 수치입니다.</p>`;
  }
  // Compare identical calendar windows. Missing reports never prove a zero-accident year.
  function comparison(items,year,site='',today=new Date(+new Date()+9*3600000).toISOString().slice(0,10)){
    const currentYear=Number(today.slice(0,4)),requested=Number(year);
    const y=Number.isInteger(requested)&&requested>=1900&&requested<=currentYear?requested:currentYear;
    const end=y===currentYear?today:`${y}-12-31`;
    const priorEnd=new Date(Date.UTC(y-1,Number(end.slice(5,7)),0)).getUTCDate();
    const previousEnd=`${y-1}-${end.slice(5,7)}-${String(Math.min(Number(end.slice(8)),priorEnd)).padStart(2,'0')}`;
    const all=records(items).filter(i=>!site||text(i.siteId)===site);
    const windowRows=(start,stop)=>all.filter(i=>{const d=dateKey(i);return d&&d>=start&&d<=stop});
    const now=summarize(windowRows(`${y}-01-01`,end),String(y));
    const previous=summarize(windowRows(`${y-1}-01-01`,previousEnd),String(y-1));
    const annual=summarize(windowRows(`${y-1}-01-01`,`${y-1}-12-31`),String(y-1));
    const siteIds=[...new Set([...now.rows,...previous.rows].map(i=>text(i.siteId)))];
    const sites=siteIds.map(id=>({id,current:summarize(now.rows.filter(i=>text(i.siteId)===id)),previous:summarize(previous.rows.filter(i=>text(i.siteId)===id))})).sort((a,b)=>b.current.total-a.current.total||b.previous.total-a.previous.total||siteName(a.id).localeCompare(siteName(b.id),'ko'));
    const base=now.total?now:annual,groups=new Map();
    for(const i of base.rows){const id=text(i.siteId),type=text(i.eventType)||'사고유형 미입력',key=JSON.stringify([id,type]);if(!groups.has(key))groups.set(key,{id,type,rows:[]});groups.get(key).rows.push(i)}
    const focus=[...groups.values()].map(g=>({...g,count:g.rows.length,person:g.rows.filter(i=>i.category==='person').length,property:g.rows.filter(i=>i.category==='property').length,cost:g.rows.reduce((v,i)=>v+(cost(i)??0),0),prior:annual.rows.filter(i=>text(i.siteId)===g.id&&(text(i.eventType)||'사고유형 미입력')===g.type).length})).sort((a,b)=>b.count-a.count||b.person-a.person||b.cost-a.cost||siteName(a.id).localeCompare(siteName(b.id),'ko')||a.type.localeCompare(b.type,'ko'));
    return {year:y,end,previousEnd,now,previous,annual,sites,focus,focusYear:now.total?y:y-1,missingDate:all.filter(i=>!dateKey(i)).length,future:all.filter(i=>dateKey(i)>today).length,urgent:now.rows.filter(i=>i.potentialMajor===true||i.severity==='major'||i.leaveEstimate==='fatal'),expensive:[...now.rows].filter(i=>cost(i)>0).sort((a,b)=>cost(b)-cost(a)),unknown:now.rows.filter(i=>cost(i)===null)};
  }
  function change(current,previous,available=true){
    if(!available)return '비교자료 없음';
    const d=current-previous;if(!d)return '변동 없음';
    return `${number(Math.abs(d))}건${d>0?' 증가':' 감소'}${previous>0?' ('+(Math.abs(d)/previous*100).toFixed(1)+'%)':' / 기준값 0, 증감률 미산출'}`;
  }
  function prevention(type){
    const guides=[
      [/넘어짐/,'미끄럼과 단차부터 없애기','물기와 이물질을 제거하고 경사면, 배수, 통로 단차를 보수합니다. 우천 작업 동선과 승하차 발판을 다시 확인합니다.','점검한 이동 구간 중 개선 완료 구간 비율과 같은 구간 재발 건수'],
      [/추락/,'높이 작업의 안전한 발판 확보','작업대를 먼저 검토하고 추락 노출 구간의 난간과 접근 차단 상태를 확인합니다. 현장 조건에 맞는 작업 방법을 다시 정합니다.','높이 작업 전 점검 이행률과 추락 노출 구간 개선 완료율'],
      [/타구|맞음|날아옴/,'사람이 맞을 수 있는 구역 분리','경기 진행과 작업 위치를 맞추고 타구 노출 때 작업을 중지할 기준을 정합니다. 비산물 발생 장비의 방호 상태와 출입 통제를 확인합니다.','작업 전 구역 통제 확인률과 타구 또는 비산물 재발 건수'],
      [/설비|시설|파손|훼손|차량|중장비|부딪힘/,'장비 동선과 시설물 접촉 줄이기','작업 반경의 시설물을 먼저 표시하고 회전과 후진 구간을 점검합니다. 보행자와 장비 동선을 분리하고 시야가 가려지는 구간의 작업 방법을 보완합니다.','동선 개선 완료율과 같은 장비 또는 시설물 접촉 재발 건수'],
      [/끼임|베임|찔림/,'회전체와 손 작업 노출 줄이기','정비와 막힘 제거 전 동력을 차단하고 재가동을 방지합니다. 방호장치 상태와 손 대신 사용할 도구를 확인합니다.','동력 차단 점검 이행률과 방호장치 미비 개선 완료율'],
      [/근골격/,'반복 동작과 무거운 작업 줄이기','운반 보조도구와 작업 높이를 검토하고 반복 동작이 집중되는 작업을 나눕니다. 증상 발생 구간을 현장에서 확인합니다.','부담 작업 개선 완료율과 동일 작업의 증상 재발 건수'],
      [/화재|폭발|감전/,'에너지원과 점화원 통제','전원과 연료 차단 상태, 배선 손상, 가연물 보관과 점화원 분리 상태를 확인하고 작업별 통제 방법을 보완합니다.','관련 설비 점검 이행률과 발견 결함의 개선 완료율']
    ];
    const row=guides.find(([re])=>re.test(type));return row?row.slice(1):['발생 작업의 위험요인 다시 확인','사고 경위와 원인분석을 현장에서 확인하고 설비 개선, 작업 방법 변경, 교육 순서로 실행 대책을 정합니다.','확인된 위험요인 개선 완료율과 동일 작업 재발 건수'];
  }
  function reportList(rows){
    return rows.length?'<div class="strategy-report-list">'+rows.map(i=>`<button type="button" data-analysis-incident="${escape(i.id)}"><span><small>${escape(dateKey(i)||'발생일 미입력')} / ${escape(siteName(i.siteId))}</small><strong>${escape(i.eventType||'사고유형 미입력')} / ${i.category==='person'?'대인':i.category==='property'?'대물':'구분 미입력'}</strong><span>${escape(i.summary||i.reportDetails?.incidentHow||'사고보고서에서 발생 경위를 확인하세요.')}</span></span><b>${cost(i)===null?'금액 미확인':number(cost(i))+'원'}<small>사고보고서 열기 →</small></b></button>`).join('')+'</div>':'<p>해당 조건의 등록 사고가 없습니다.</p>';
  }
  function monthlyComparison(m){
    const max=Math.max(1,...m.now.months.map(x=>x.count),...m.previous.months.map(x=>x.count));
    const month=Number(m.end.slice(5,7));
    return `<div class="strategy-legend"><span class="prior">${m.year-1}년</span><span class="present">${m.year}년</span></div><div class="strategy-month-scroll"><div class="strategy-months">${m.now.months.map((x,n)=>{const p=m.previous.months[n].count,future=n>=month;return `<div class="strategy-month${future?' is-future':''}"><div class="strategy-columns"><div><b>${future?'—':p}</b><i class="prior" style="height:${future?0:p/max*76}px"></i></div><div><b>${future?'—':x.count}</b><i class="present" style="height:${future?0:x.count/max*76}px"></i></div></div><strong>${n+1}월</strong><small>${future?'비교기간 밖':n===month-1&&m.end.slice(8)!==String(new Date(Date.UTC(m.year,month,0)).getUTCDate())?Number(m.end.slice(8))+'일까지':'등록 건수'}</small></div>`}).join('')}</div></div>`;
  }
  function render(root,u,state){
    if(!canRead(u)){root.replaceChildren();return;}
    const userKey=JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);
    const today=new Date(+new Date()+9*3600000).toISOString().slice(0,10),thisYear=today.slice(0,4);
    state=state||root.querySelector('.analysis-strategy')?.analysisState||(rememberedKey===userKey?rememberedState:null)||{year:thisYear,site:''};
    const source=window.enlIncidentAnalysisRecords?.()||[],m=comparison(source,state.year,state.site,today),s=m.now,p=m.previous;
    state={...state,year:String(m.year)};rememberedKey=userKey;rememberedState=state;
    const years=[...new Set([thisYear,...records(source).map(i=>dateKey(i).slice(0,4)).filter(y=>y&&y<=thisYear)])].sort().reverse();
    const sites=[...new Set(records(source).map(i=>text(i.siteId)).filter(Boolean))].sort((a,b)=>siteName(a).localeCompare(siteName(b),'ko'));
    const ready=window.enlIncidentServerReady?.()===true,hasComparison=s.total>0&&p.total>0;
    const amount=(value,known,total)=>!total?'등록자료 없음':known?number(value)+'원':'금액 미확인';
    const costDelta=(value,before,known,beforeKnown)=>known&&beforeKnown?(hasComparison?number(Math.abs(value-before))+'원 '+(value>before?'증가':value<before?'감소':'변동 없음'):'비교자료 없음'):'금액 비교자료 부족';
    const next=m.year+1;

    const section=document.createElement('section');section.className='incident-analysis analysis-strategy';section.analysisState=state;
    section.innerHTML=`<header class="analysis-heading strategy-hero"><div><h2>${m.year}년 사고 종합분석</h2><p>전년 비교 → 중점 보완 → ${next}년 예방계획</p></div><button type="button" data-analysis-refresh>새로고침</button></header>
<div class="analysis-filters"><label>기준 연도<select data-analysis-year>${years.map(y=>`<option value="${y}"${state.year===y?' selected':''}>${y}년</option>`).join('')}</select></label><label>사업장<select data-analysis-site><option value="">전체 사업장</option>${sites.map(id=>`<option value="${escape(id)}"${state.site===id?' selected':''}>${escape(siteName(id))}</option>`).join('')}</select></label><p>${m.year-1}년 ↔ ${m.year}년 / 1.1 ~ ${Number(m.end.slice(5,7))}.${Number(m.end.slice(8))} 같은 기간 비교</p></div>
<div class="analysis-kpis"><article><span>전체 사고</span><strong>${number(s.total)}<small>건 등록</small></strong><p>${change(s.total,p.total,hasComparison)}</p></article><article><span>대인 사고</span><strong>${number(s.person)}<small>건 등록</small></strong><p>전년 동기 ${p.total?number(p.person)+'건':'등록자료 없음'}</p></article><article><span>대물 사고</span><strong>${number(s.property)}<small>건 등록</small></strong><p>전년 동기 ${p.total?number(p.property)+'건':'등록자료 없음'}</p></article><article><span>발생된 피해비용</span><strong class="analysis-money">${amount(s.cost,s.knownCost,s.total)}</strong><p>미확인 ${m.unknown.length}건 / 확인된 금액 합계</p></article></div>
${m.urgent.length?`<details class="strategy-alert"><summary>우선 검토 필요 ${m.urgent.length}건 <small>중대 가능성 또는 중대 피해 표시 사고</small></summary>${reportList(m.urgent)}<p>보고서의 표시 기준이며 법적 중대재해 확정 판정은 아닙니다.</p></details>`:''}
<section class="analysis-card strategy-goals" data-analysis-target></section>
<div class="strategy-overview"><section id="strategy-past" class="analysis-card"><div class="strategy-card-head"><h3>전년 대비 사고 변화</h3><span>01 비교</span></div>${monthlyComparison(m)}<div class="strategy-comparison-line"><span>전년 동기 <b>${p.total?number(p.total)+'건':'자료 없음'}</b></span><span>올해 동기 <b>${number(s.total)}건 등록</b></span></div><p class="strategy-takeaway">${hasComparison?`등록 건수 ${change(s.total,p.total)}.`:'전년도 또는 올해 비교자료가 부족합니다.'} 등록자료 없음은 무사고를 뜻하지 않습니다.</p><details class="strategy-cost-detail"><summary>대인 / 대물 피해금액 비교</summary><div class="strategy-table-scroll"><table><thead><tr><th>구분</th><th>${m.year-1}년 동기</th><th>${m.year}년 동기</th></tr></thead><tbody>${[['대인',s.personCost,s.knownPersonCost,s.person,p.personCost,p.knownPersonCost,p.person],['대물',s.propertyCost,s.knownPropertyCost,s.property,p.propertyCost,p.knownPropertyCost,p.property]].map(([label,c,k,t,pc,pk,pt])=>`<tr><th scope="row">${label}</th><td>${amount(pc,pk,pt)}</td><td>${amount(c,k,t)}</td></tr>`).join('')}</tbody></table></div><p>${costDelta(s.cost,p.cost,s.knownCost,p.knownCost)} / 금액 확인 ${p.knownCost}/${p.total}건 → ${s.knownCost}/${s.total}건</p></details></section>
<section id="strategy-focus" class="analysis-card"><div class="strategy-card-head"><h3>중점 보완과 ${next}년 실행계획</h3><span>02 대상 → 03 대책</span></div><p class="strategy-focus-note">${m.focusYear}년 등록 건수 상위 3개 작업 / 검토 제안</p><div id="strategy-plan" class="strategy-focus-list">${m.focus.slice(0,3).map(g=>{const [title,action,metric]=prevention(g.type);return `<details${rankAttr(m.focus.map(x=>x.count),g.count)}><summary>${rankBadge(m.focus.map(x=>x.count),g.count)}<span><strong>${escape(siteName(g.id))} <small>${escape(g.type)} ${g.count}건</small></strong><span class="strategy-action-title">${escape(title)}</span></span></summary><p>${escape(action)}</p><p><b>효과 확인:</b> ${escape(metric)}</p><p>현장 확인 → 안전관리자 대책 검토 → 본사 지원 검토</p>${reportList(g.rows)}</details>`}).join('')||'<p class="strategy-empty">개선 대상을 선정할 사고자료가 없습니다.</p>'}</div><p class="strategy-review-cycle">연초 대책 확정 → 매월 재발 확인 → 분기별 효과 점검</p></section></div>
<div class="strategy-status"><span class="analysis-sync" role="status">${ready?'동기화된 저장 자료 기준':'최신 자료 확인 전 / 이전 자료일 수 있음'}</span><span>사고율 / 재해율: 산출 자료 부족</span></div>
<details class="strategy-support"><summary>상세자료와 집계 기준 <small>사업장별 사고, 고액 사고, 미확인 금액</small></summary><div class="strategy-support-body">
<div class="analysis-grid"><section class="analysis-card"><h3>사업장별 변화</h3><div class="strategy-site-list">${m.sites.map(x=>`<details${rankAttr(m.sites.map(t=>t.current.total),x.current.total)}><summary>${rankBadge(m.sites.map(t=>t.current.total),x.current.total)}<span>${escape(siteName(x.id))}</span><b>전년 ${x.previous.total}건 → 올해 ${x.current.total}건</b></summary><p>올해 대인 ${x.current.person}건 / 대물 ${x.current.property}건. ${hasComparison?change(x.current.total,x.previous.total):'전체 비교자료 부족으로 증감 판단 보류'}</p>${reportList([...x.current.rows,...x.previous.rows])}</details>`).join('')||'<p>등록자료 없음</p>'}</div></section><section class="analysis-card"><h3>${m.year-1}년 연간 참고자료</h3><p>1.1 ~ 12.31 / ${m.annual.total?'전체 '+m.annual.total+'건, 대인 '+m.annual.person+'건, 대물 '+m.annual.property+'건':'등록자료 없음'}</p><p>피해비용 ${amount(m.annual.cost,m.annual.knownCost,m.annual.total)} / 미확인 ${m.annual.total-m.annual.knownCost}건</p><details><summary>전년도 사고목록 ${m.annual.total}건</summary>${reportList(m.annual.rows)}</details></section></div>
<div class="analysis-grid"><section class="analysis-card"><h3>피해비용이 큰 사고 5건</h3>${reportList(m.expensive.slice(0,5))}</section><section class="analysis-card"><h3>추가 확인할 정보</h3><p>금액 미확인 ${m.unknown.length}건 / 사고유형 미입력 ${s.missingType}건 / 원인분석 미입력 ${s.missingCause}건</p><details><summary>피해금액 미확인 사고 ${m.unknown.length}건</summary>${reportList(m.unknown)}</details></section></div>
<section class="analysis-card strategy-rates"><h3>사고율과 재해율 / 산출 자료 부족</h3><p>내부 사고율은 보고 사고 건수 ÷ 같은 기간 평균 근로자 수 × 100, 재해율은 해당 기준의 재해자 수 ÷ 같은 범위의 산재보험 적용 근로자 수 × 100으로 구분합니다.</p><p>기간별 인원과 통계 대상 재해자 수가 확인되지 않아 사고율과 재해율은 산출하지 않습니다. 위의 건수 및 피해금액 감소 목표와는 별도 지표입니다. 대인 사고 건수는 재해자 수와 다릅니다.</p><a href="https://www.index.go.kr/unify/idx-info.do?idxCd=1514" target="_blank" rel="noopener noreferrer">재해율 집계 기준 / e-나라지표</a></section>
<p class="analysis-footnote">최초사고보고를 사고 1건당 1회 집계합니다. 임시저장, 무효 처리와 삭제된 사고는 제외합니다. 발생일 미확인 ${m.missingDate}건${m.future?', 미래 발생일 '+m.future+'건':''}은 기간 비교에서 제외합니다. 미확인 금액은 제외하며 진료비와 복구 예상비용을 합산합니다. 금액 확인 비중이 다르면 손실 감소로 단정할 수 없습니다. 사업장 순위는 등록 건수 기준이며 동률은 공동 순위입니다. 인원과 작업량 차이는 보정하지 않았습니다. 같은 사업장과 유형의 기록이 동일 원인의 재발로 확정된 것은 아닙니다. 예방대책은 검토 제안이며 승인된 계획을 뜻하지 않습니다.</p></div></details>
`;
    root.replaceChildren(section);
    window.ENLAnalysisTargets?.mount(section.querySelector('[data-analysis-target]'),{year:m.year,site:state.site,u});
    for(const [selector,key] of [['[data-analysis-year]','year'],['[data-analysis-site]','site']])section.querySelector(selector).onchange=ev=>render(root,u,{...state,[key]:ev.target.value});
    section.querySelectorAll('[data-analysis-incident]').forEach(b=>b.onclick=()=>{if(!canRead(currentUser()))return;const open=window.enlOpenIncidentReview||window.openIncidentModal;open?.(b.dataset.analysisIncident,u.role==='safety',u)});
    section.querySelector('[data-analysis-refresh]').onclick=async ev=>{
      const b=ev.currentTarget;b.disabled=true;const note=section.querySelector('.analysis-sync');note.textContent='최신 자료를 확인하고 있습니다.';
      try{window.ENLAnalysisTargets?.invalidate();await window.enlIncidentPullNow(false);if(section.isConnected&&canRead(currentUser()))render(root,currentUser(),state);}
      catch{if(section.isConnected)note.textContent='최신 자료를 확인하지 못했습니다. 현재 집계는 이전에 확인된 자료입니다.';}
      finally{b.disabled=false;}
    };
  }
  window.ENLIncidentAnalysis={render,comparison,change,prevention,summarize,records,dateKey,cost,canRead,detailHtml,costBreakdown,rankMeta,rankBadge,rankAttr};
  window.addEventListener('enl-incidents-pulled',()=>{const root=document.getElementById('view');if(currentView==='analysis'&&root&&canRead(currentUser()))render(root,currentUser());});
})();
