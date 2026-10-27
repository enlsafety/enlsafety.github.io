/* Save feedback only. The incident sync engine owns versions and requests. */
(function(){
  'use strict';
  const labels={summary:'사고 요약',immediateAction:'사고 직후 조치',status:'처리 상태',eventType:'사고유형',injuredName:'피해 직원명',occurredAt:'사고 발생일시',safetyNote:'검토 의견',reportDetails:'사고 상세',corrective:'재발방지·조치',photos:'첨부자료',supplement:'보완자료',officialRecord:'승인·종결기록',reviewHistory:'검토이력',place:'발생 장소',workAction:'당시 작업',incidentHow:'사고경위',preventionPlan:'최초 예방대책',specialNote:'특이사항',diagnosis:'진단명',injuryDetail:'부상 내용',doctorOpinion:'의사 소견',medicalCost:'치료비',repairCost:'수리비',causeAnalysisNote:'원인분석',environmentCause:'환경적 요인',behaviorCause:'행동적 요인'};
  Object.assign(labels,{damagedItem:'파손 물품',damageDetail:'파손 내용',workerName:'작업자 성명',job:'직종·업무',medicalCostDetail:'치료비 상세',repairCostDetail:'수리비 상세',rootCause:'원인',planDetail:'재발방지계획',ownerName:'담당자',dueDate:'완료예정일',actionDetail:'조치결과',actionDate:'조치일',actionOwner:'조치 담당자',priority:'관리등급',prioritySource:'등급 지정 방식',prioritySetBy:'등급 지정자',prioritySetAt:'등급 지정일시',legalReview:'법정 검토 대상',causeAnalysisStatus:'원인분석 상태'});
  const omit=k=>k.startsWith('_')||['updatedAt','lastModifiedAt','lastModifiedBy','lastModifiedRole','lastModifiedPosition','recordedAt'].includes(k);
  const canonical=v=>JSON.stringify(v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().filter(k=>!omit(k)).map(k=>[k,canonical(v[k])])):v);
  function rows(a,b,path=[]){
    const out=[];for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
      if(omit(k)||canonical(a?.[k])===canonical(b?.[k]))continue;
      const av=a?.[k],bv=b?.[k],p=[...path,k];
      if(av&&bv&&typeof av==='object'&&typeof bv==='object'&&!Array.isArray(av)&&!Array.isArray(bv))out.push(...rows(av,bv,p));
      else out.push({label:p.map(x=>labels[x]||'추가 기록').join(' · '),server:av,draft:bv});
    }return out;
  }
  function display(v){if(v==null||v==='')return '(없음)';if(Array.isArray(v))return v.map(x=>typeof x==='object'?(x.name||x.note||x.action||'첨부·이력 항목'):x).join('\n')||'(없음)';return typeof v==='object'?JSON.stringify(v,null,2):String(v);}
  function element(tag,text,parent){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(parent)parent.appendChild(el);return el;}
  window.addEventListener('enl-incident-write-error',event=>{
    const d=event.detail,root=document.querySelector('#unifiedReportForm,#reportForm,#modalRoot .modal')||document.getElementById('app');if(!root)return;
    let panel=root.querySelector('[data-enl-save-feedback]');if(!panel){panel=element('section',undefined,root);panel.dataset.enlSaveFeedback='';panel.style.cssText='margin:14px 0;padding:14px;border:1px solid #b76129;border-radius:10px;background:#fff8ee;color:#422b1b;overflow-wrap:anywhere';}
    panel.replaceChildren();panel.dataset.incidentId=d.id;panel.setAttribute('role','alert');
    element('strong','저장되지 않았습니다',panel);element('p',d.message,panel);
    if(String(d.error).includes('enl_sync_conflict')&&d.latest){
      const details=element('details',undefined,panel);details.open=true;element('summary','최신 서버 내용과 작성 내용 비교',details);
      for(const row of rows(d.latest,d.draft).slice(0,40)){
        const item=element('div',undefined,details);item.style.cssText='padding:10px 0;border-top:1px solid #dfd1bd';element('strong',row.label,item);
        element('p','서버: '+display(row.server),item).style.whiteSpace='pre-wrap';element('p','작성: '+display(row.draft),item).style.whiteSpace='pre-wrap';
      }
      element('p','자동으로 덮어쓰지 않았습니다. 필요한 작성 내용을 복사해 두고 최신 저장본을 열어 다시 수정해 주세요.',panel);
      const button=element('button','최신 저장본 열기',panel);button.type='button';button.onclick=async()=>{
        if(!confirm('작성 내용을 복사해 두셨나요? 현재 편집을 닫고 서버의 최신 저장본을 표시합니다.'))return;
        button.disabled=true;try{await window.enlOpenLatestIncident?.(d.id);}catch(e){element('p','최신 자료를 불러오지 못했습니다. 현재 작성 내용은 유지했습니다.',panel);button.disabled=false;}
      };
    }
    event.preventDefault();panel.scrollIntoView?.({block:'nearest'});
  });
  window.addEventListener('enl-incident-saved',event=>{for(const el of document.querySelectorAll('[data-enl-save-feedback]'))if(el.dataset.incidentId===String(event.detail?.id))el.remove();});
  window.ENL_SYNC_CONFLICT_VERSION='4.7.3-preserved-draft-feedback';
})();
