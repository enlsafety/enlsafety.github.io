/* One source for approved cause analysis; legacy plan notes remain historical evidence. */
(function(root){
  'use strict';
  const clean=v=>String(v??'').trim();
  const fields=[['environmentCause','환경적 요인'],['behaviorCause','행동적 요인'],['causeAnalysisNote','기타 종합원인']];
  const normalized=v=>clean(v).replace(/\s+/g,' ');
  function current(i){return fields.filter(([key])=>clean(i?.reportDetails?.[key])).map(([key,label])=>label+': '+clean(i.reportDetails[key])).join('\n');}
  function status(i){const s=i?.reportDetails?.causeAnalysisStatus;return s==='investigating'?'조사 중 / 원인 미확정':s==='analyzed'?'분석 완료':'원인분석 상태 미기록';}
  function legacy(i){
    const old=clean(i?.corrective?.rootCause);if(!old)return '';
    const same=[current(i),...fields.map(([key])=>i?.reportDetails?.[key])].some(v=>normalized(v)===normalized(old));
    return same?'':old;
  }
  function text(i){
    const value=current(i),s=i?.reportDetails?.causeAnalysisStatus;
    if(value)return (s==='investigating'?status(i)+'\n':'')+value;
    if(s==='investigating')return status(i);
    if(s==='analyzed')return '저장된 원인분석 내용을 확인해 주세요.';
    return legacy(i)?'기존 계획의 원인 기록 (전환 전): '+legacy(i):'원인분석 미등록';
  }
  root.ENLIncidentCause={current,status,legacy,text};
})(typeof window==='object'?window:globalThis);
