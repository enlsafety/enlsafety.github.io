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
  function render(root,u,state){
    if(!canRead(u)){root.replaceChildren();return;}
    const userKey=JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);
    state=state||root.querySelector('.incident-analysis')?.analysisState||(rememberedKey===userKey?rememberedState:null)||{year:'',site:''};
    rememberedKey=userKey;rememberedState=state;
    const source=window.enlIncidentAnalysisRecords?.()||[],s=summarize(source,state.year,state.site);
    const years=[...new Set(s.all.map(i=>dateKey(i).slice(0,4)).filter(Boolean))].sort().reverse();
    const sites=[...new Set(s.all.map(i=>text(i.siteId)).filter(Boolean))].sort((a,b)=>siteName(a).localeCompare(siteName(b),'ko'));
    const ready=window.enlIncidentServerReady?.()===true;
    const top=s.types.filter(x=>x.label!=='미입력')[0],topSite=s.sites.filter(x=>x.label!=='미입력')[0];
    const section=document.createElement('section');section.className='incident-analysis';section.analysisState=state;
    section.innerHTML=`<header class="analysis-heading"><div><p class="analysis-eyebrow">최초사고보고 종합분석</p><h2>어디서, 어떤 사고가 반복됐나</h2><p>등록된 최초사고보고의 최신 저장 내용으로 집계합니다. 과거사고 입력도 포함합니다.</p></div><button type="button" data-analysis-refresh>최신 자료 확인</button></header>
      <div class="analysis-filters"><label>발생 연도<select data-analysis-year><option value="">전체 기간</option>${years.map(y=>'<option value="'+y+'"'+(state.year===y?' selected':'')+'>'+y+'년</option>').join('')}</select></label><label>사업장<select data-analysis-site><option value="">전체 사업장</option>${sites.map(id=>'<option value="'+escape(id)+'"'+(state.site===id?' selected':'')+'>'+escape(siteName(id))+'</option>').join('')}</select></label><p>${s.dated.length?escape(s.dated[0]+' ~ '+s.dated.at(-1)):'발생일 정보 없음'}<br>사고 1건을 1회 집계 / 한국시간 기준</p></div>
      <p class="analysis-sync" role="status">${ready?'현재 동기화된 저장 자료 기준입니다.':'최신 서버 자료 확인 전입니다. 연결 상태에 따라 이전 자료가 표시될 수 있습니다.'}</p>
      <div class="analysis-kpis"><article><span>전체 사고</span><strong>${number(s.total)}<small>건</small></strong><p>선택한 기간과 사업장</p></article><article><span>인명사고</span><strong>${number(s.person)}<small>건</small></strong><p>전체의 ${percent(s.person,s.total)}% / 재해자 수와 다름</p></article><article><span>대물사고</span><strong>${number(s.property)}<small>건</small></strong><p>전체의 ${percent(s.property,s.total)}%</p></article><article><span>발생된 피해비용</span><strong class="analysis-money">${s.knownCost?number(s.cost):'미확인'}${s.knownCost?'<small>원</small>':''}</strong>${costBreakdown(s)}<p>${s.knownCost}건 입력 / ${s.total-s.knownCost}건 미확인</p></article></div>
      ${s.total?`<section class="analysis-brief"><h3>먼저 볼 내용</h3><p>${top?'가장 많이 등록된 유형은 <strong>'+escape(top.label)+' '+top.count+'건 ('+percent(top.count,s.total)+'%)</strong>입니다.':'사고유형을 입력하면 주요 유형을 확인할 수 있습니다.'} ${topSite?'사고가 가장 많이 등록된 사업장은 <strong>'+escape(siteName(topSite.label))+' '+topSite.count+'건</strong>입니다.':''}</p><p>비용은 진료비와 복구 예상비용 중 입력된 금액의 합계입니다. 최종 확정 손실액은 아닙니다.</p></section>`:'<p class="analysis-empty">선택한 조건의 사고보고가 없습니다.</p>'}
      ${detailHtml(s)}`;
    root.replaceChildren(section);
    for(const [selector,key] of [['[data-analysis-year]','year'],['[data-analysis-site]','site']])section.querySelector(selector).onchange=ev=>render(root,u,{...state,[key]:ev.target.value});
    section.querySelector('[data-analysis-refresh]').onclick=async ev=>{
      const b=ev.currentTarget;b.disabled=true;const note=section.querySelector('.analysis-sync');note.textContent='최신 자료를 확인하고 있습니다.';
      try{await window.enlIncidentPullNow(false);if(section.isConnected&&canRead(currentUser()))render(root,u,state);}
      catch{if(section.isConnected)note.textContent='최신 자료를 확인하지 못했습니다. 현재 집계는 이전에 확인된 자료입니다.';}
      finally{b.disabled=false;}
    };
  }
  window.ENLIncidentAnalysis={render,summarize,records,dateKey,cost,canRead,detailHtml,costBreakdown,rankMeta,rankBadge,rankAttr};
  window.addEventListener('enl-incidents-pulled',()=>{const root=document.getElementById('view');if(currentView==='analysis'&&root&&canRead(currentUser()))render(root,currentUser());});
})();
