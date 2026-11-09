/* E&L Accident Report App v4.1.1 - authoritative person/property report flow */
(function(){
  'use strict';

  const VERSION='4.7.0-cumulative-report';
  function hasSceneEvidence(files){
    return Array.isArray(files)&&files.some(file=>{
      const ref=typeof file==='string'?file:file?.path||file?.dataUrl||file?.url||file?.storageUrl;
      return typeof ref==='string'&&ref.trim().length>0;
    });
  }
  window.enlHasSceneEvidence=hasSceneEvidence;
  let activeType=null;
  let activeEditId=null;
  let editSnapshot=null,editOptions={};

  const isSiteUser=u=>!!u&&['field','worker'].includes(u.role);
  const canCreate=u=>!!u&&['field','worker','safety'].includes(u.role);
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const money=v=>{const n=Number(String(v||'').replace(/,/g,''));return Number.isFinite(n)&&n>0?n:0};
  const moneyText=n=>n?`${n.toLocaleString('ko-KR')}원`:'미확인';
  const PENDING_COST='사후 보완 예정';
  const currentSiteName=id=>siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||'사업장';
  const activeEdit=()=>activeEditId?editSnapshot:null;
  const persistAttachment=a=>typeof window.enlPersistAttachment==='function'?window.enlPersistAttachment(a):a;
  const pad=n=>String(n).padStart(2,'0');
  const accepted=i=>['approved','closed'].includes(String(i?.status||''));
  const dateOnlyValue=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  const unknownTime=i=>dateOnlyValue(i?.occurredAt)||i?.occurrenceTimeKnown===false||i?.historicalImport?.occurrenceTimeKnown===false||i?.historicalTransfer?.occurredTimeKnown===false;
  const occurredParts=i=>{if(dateOnlyValue(i?.occurredAt))return {date:i.occurredAt,time:''};if(i?.occurredAt){const d=new Date(new Date(i.occurredAt).getTime()+9*3600000);if(!Number.isNaN(d.getTime()))return {date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16)}}return {date:'',time:''}};

  function backHome(u){activeType=null;activeEditId=null;if(isSiteUser(u)&&typeof window.enlFieldHome==='function')return window.enlFieldHome(u);currentView='home';renderShell(u)}
  function backRecords(u){activeType=null;activeEditId=null;currentView='incidents';renderShell(u)}
  function topBack(u,label='사고 종류 선택'){if(isSiteUser(u))return `<div class="field-task-back"><button type="button" data-report-home>← 현장 홈으로</button><span>${esc(currentSiteName(u.siteId))}</span></div>`;return `<div class="report410-top-back"><button type="button" data-report-home>← ${esc(label)}</button></div>`}
  function bindPicker(root,u){root.querySelector('[data-report-home]')?.addEventListener('click',()=>backHome(u));root.querySelectorAll('[data-report-type]').forEach(btn=>btn.addEventListener('click',()=>{activeEditId=null;activeType=btn.dataset.reportType;renderTypeForm(root,u,activeType,null)}))}
  function renderTypePicker(root,u){if(!root)return;activeType=null;activeEditId=null;root.innerHTML=`${topBack(u,'홈으로')}<section class="panel report-type-picker" data-report-picker="v410"><div class="section-head"><div><div class="ey">ACCIDENT REPORT</div><h2>사고 종류를 선택해 주세요</h2><p>발생한 사고에 맞는 경위서를 선택합니다.</p></div></div><div class="report-type-grid"><button type="button" class="report-type-card person" data-report-type="person"><span class="report-type-no">01</span><strong>대인사고</strong><small>사람이 다치거나 치료가 필요한 사고<br>부상·진단·진료비 중심 작성</small></button><button type="button" class="report-type-card property" data-report-type="property"><span class="report-type-no">02</span><strong>대물사고</strong><small>차량·장비·시설물이 파손된 사고<br>파손·복구견적 중심 작성</small></button></div><div class="report-type-note">사고 종류를 선택하면 해당 경위서에 필요한 항목만 표시됩니다.</div></section>`;bindPicker(root,u)}

  function siteControl(u,siteId){const selected=siteId||u?.siteId||'';if(isSiteUser(u))return `<input id="reportSite" type="hidden" value="${esc(selected)}"><input class="report410-overview-control" value="${esc(currentSiteName(selected))}" disabled>`;return `<select id="reportSite" class="report410-overview-control" required><option value="">사업장 선택</option>${(data.sites||[]).filter(s=>s.id!=='site-hq').map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(selected)?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`}
  function pickerControl(id,type,value){return `<span class="report410-picker-wrap ${value?'has-value':''}" data-report410-picker><input class="report410-overview-control" id="${id}" type="${type}" value="${esc(value||'')}" required><span class="report410-picker-placeholder" aria-hidden="true">선택하세요</span></span>`}
  function commonTop(u,i){const dt=occurredParts(i),d=i?.reportDetails||{};return `<div class="report410-grid report410-overview-grid"><label class="lbl report410-overview-cell"><span>사업장 *</span>${siteControl(u,i?.siteId)}</label><label class="lbl report410-overview-cell"><span>발생 날짜 *</span>${pickerControl('occurredDate410','date',dt.date)}</label><label class="lbl report410-overview-cell"><span>발생 시간 *</span>${pickerControl('occurredTime410','time',dt.time)}</label><label class="lbl report410-wide"><span>정확한 사고 장소 *</span><input id="incidentPlace410" value="${esc(d.place||'')}" required placeholder="예: A코스 3홀 티 우측 법면부"></label><label class="lbl report410-wide"><span>사고 유형 *</span><select id="eventType">${eventTypeOptions(i?.eventType||'')}</select></label></div>`}
  function circumstanceSection(type,i){const d=i?.reportDetails||{},how=type==='person'?'예: 칡넝쿨 제거 작업 중 낫에 왼쪽 엄지손가락이 접촉하여 베임':'예: 작업차량 이동 중 홀맵지주 하단부와 접촉하여 찌그러짐',action=type==='person'?'예: 작업 중지 후 응급처치하고 병원으로 이동':'예: 작업 중지 후 파손부위 확인, 주변 통제 및 담당자 보고';return `<section class="report410-section"><div class="report410-section-head"><b>2. 사고 경위</b><small>사고 전 → 발생 → 사고 직후 순서로 작성합니다. 원인은 안전관리자가 별도로 분석합니다.</small></div><label class="lbl"><span>사고 직전에 무엇을 하고 있었나요? *</span><textarea id="workAction410" rows="2" required placeholder="예: K코스 2번홀 티 예지 작업을 하고 있었음">${esc(d.workAction||'')}</textarea></label><label class="lbl"><span>어떻게 사고가 발생했나요? *</span><textarea id="incidentHow410" rows="3" required placeholder="${how}">${esc(d.incidentHow||'')}</textarea></label><label class="lbl"><span>사고 직후 어떻게 조치했나요? *</span><textarea id="immediateAction" rows="3" required placeholder="${action}">${esc(i?.immediateAction||'')}</textarea></label></section>`}
  const leaveChoices={unknown:'아직 확인 중',none:'휴업 없음',under3:'1~2일 휴업 예상','3plus':'3일 이상 휴업 예상',fatal:'사망'};
  function leaveOptions(previous){
    const choices=Object.entries(leaveChoices);
    if(previous==='longterm')choices.push(['longterm','장기치료 / 중상 가능 (기존 선택)']);
    return '<option value="" disabled>선택하세요</option>'+choices.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
  }
  window.enlReportLeaveOptions=leaveOptions;
  function personDamageSection(i){const d=i?.reportDetails||{};return `<section class="report410-section report410-damage person"><div class="report410-section-head"><b>3. 대인 피해 상황</b><small>병원 진단 전이면 확인된 내용까지만 입력하세요.</small></div><div class="report410-grid"><label class="lbl"><span>피해 직원 성명 *</span><input id="injuredName" value="${esc(d.injuredName||i?.injuredName||'')}" required></label><label class="lbl"><span>직종 / 업무</span><input id="job" value="${esc(d.job||i?.job||'')}" placeholder="예: 코스관리 · 예지 작업"></label><label class="lbl report410-wide"><span>어디를 어떻게 다쳤나요? *</span><textarea id="injuryDetail410" rows="3" required placeholder="예: 왼쪽 엄지손가락 약 2cm 베임, 출혈 확인">${esc(d.injuryDetail||'')}</textarea></label><label class="lbl report410-wide"><span>진단명</span><input id="diagnosis410" value="${esc(d.diagnosis||'')}" placeholder="예: 좌측 엄지 열상 · 병원 진단 전이면 미확인"></label><label class="lbl report410-wide"><span>의사 소견 / 치료 예상기간</span><textarea id="doctorOpinion410" rows="2" placeholder="예: 봉합 처치 후 약 1주일간 경과 관찰 예정">${esc(d.doctorOpinion||'')}</textarea></label><label class="lbl"><span>진료비(현재 확인금액)</span><span class="won-entry"><input id="medicalCost410" data-won type="text" inputmode="numeric" value="${esc(d.medicalCost||'')}" placeholder="예: 50,000"><small>원</small></span></label><label class="lbl"><span>사고로 예상되는 휴업기간 또는 사망 여부 *</span><select id="leaveEstimate" required>${leaveOptions(i?.leaveEstimate||d.leaveEstimate)}</select></label><label class="lbl report410-wide"><span>진료비 상세내역</span><textarea id="medicalCostDetail410" rows="2" placeholder="예: 응급실 진료비 및 약제비 확인 중, 영수증은 사후 보완 예정">${esc(d.medicalCostDetail||'')}</textarea></label></div></section>`}
  function propertyDamageSection(i){const d=i?.reportDetails||{},cost=d.repairCostPending===true||!Number(d.repairCost||0)?PENDING_COST:String(d.repairCost),detail=d.repairCostDetail||PENDING_COST;return `<section class="report410-section report410-damage property"><div class="report410-section-head"><b>3. 대물 피해 상황 및 복구 견적</b><small>견적이 아직 없으면 ‘사후 보완 예정’ 상태로 먼저 제출할 수 있습니다.</small></div><div class="report410-grid"><label class="lbl"><span>작업자 성명</span><input id="propertyWorker410" value="${esc(d.workerName||'')}" placeholder="예: 홍길동"></label><label class="lbl"><span>직종 / 업무</span><input id="job" value="${esc(d.job||i?.job||'')}" placeholder="예: 코스관리 · 작업차량 운행"></label><label class="lbl report410-wide"><span>파손된 물품 / 시설 *</span><input id="damagedItem410" value="${esc(d.damagedItem||'')}" required placeholder="예: 3번홀 홀맵 지주"></label><label class="lbl report410-wide"><span>어떻게 파손되었나요? *</span><textarea id="damageDetail410" rows="3" required placeholder="예: 작업차량 회전 중 우측 후미가 홀맵 지주 하단부와 접촉하여 지주가 찌그러짐">${esc(d.damageDetail||'')}</textarea></label><label class="lbl"><span>복구 예상 비용</span><span class="won-entry"><input id="repairCost410" data-won type="text" inputmode="numeric" value="${esc(cost)}" data-auto-pending="${PENDING_COST}" placeholder="예: 350,000"><small>원</small></span></label><label class="lbl report410-wide"><span>견적 / 비용 상세내역</span><textarea id="repairCostDetail410" rows="3" data-auto-pending="${PENDING_COST}" placeholder="예: 지주 교체비 250,000원 + 도장비 100,000원">${esc(detail)}</textarea></label></div></section>`}
  function closingSection(type,i,u){const d=i?.reportDetails||{},manual=String(i?.prioritySource||'')==='manual'?i?.priority:'auto',prevent=type==='person'?'예: 칼날 작업 전 작업방향과 손 위치를 확인하고, 넝쿨 제거 시 절단방향 반대편에 손을 두도록 작업방법 교육 실시':'예: 작업차량 이동 전 시설물과 회전반경을 확인하고, 좁은 구간에서는 유도자를 배치하여 이동',special=type==='person'?'예: 응급처치 후 병원 진료 예정이며 추가 진단 결과는 사후 보완 예정':'예: 고객 피해 없음. 파손구역 통제 후 현장소장 및 시설 담당자에게 즉시 보고함';return `<section class="report410-section"><div class="report410-section-head"><b>4. 재발 방지 및 관리</b><small>구체적인 예방조치를 입력합니다.</small></div><label class="lbl"><span>재발 방지 대책 *</span><textarea id="preventionPlan410" rows="3" required placeholder="${prevent}">${esc(d.preventionPlan||'')}</textarea></label><label class="lbl"><span>특이사항</span><textarea id="specialNote410" rows="2" placeholder="${special}">${esc(d.specialNote||'')}</textarea></label><div class="report410-grid report410-risk-grid"><label class="lbl"><span>${type==='person'?'부상 정도':'피해 정도'}</span><select id="severity"><option value="minor">경미</option><option value="moderate">보통</option><option value="major">중대</option></select></label><label class="report410-check"><input id="potentialMajor" type="checkbox"><span>현재 피해가 작아도 큰 사고로 이어질 가능성이 있었음</span></label>${u?.role==='safety'?`<label class="lbl report410-wide"><span>관리등급</span><select id="priorityManual411"><option value="auto" ${manual==='auto'?'selected':''}>자동 추천</option><option value="normal" ${manual==='normal'?'selected':''}>일반</option><option value="important" ${manual==='important'?'selected':''}>중요</option><option value="urgent" ${manual==='urgent'?'selected':''}>긴급</option></select><small style="margin-top:5px;color:#6b7e90">자동 추천값을 참고하되 안전관리자가 최종 등급을 직접 지정할 수 있습니다.</small></label>`:''}</div></section>`}

  // One A renderer is shared by editable forms and every cumulative document.
  function reportSectionsHtml(u,type,i){
    return `<section class="report410-section"><div class="report410-section-head"><b>1. 사고 개요</b><small>언제, 어디서 발생했는지 입력합니다.</small></div>${commonTop(u,i)}</section>${circumstanceSection(type,i)}${type==='person'?personDamageSection(i):propertyDamageSection(i)}${closingSection(type,i,u)}`;
  }
  function prepareReportLayout(root,i){
    const event=root.querySelector('#eventType');
    if(event&&i?.eventType){if(![...event.options].some(o=>o.value===i.eventType)){const option=document.createElement('option');option.value=i.eventType;option.textContent=i.eventType;event.append(option);}event.value=i.eventType;for(const option of event.options)option.toggleAttribute('selected',option.value===i.eventType);}
    const prevention=root.querySelector('#preventionPlan410'),target=prevention?.closest('.report410-section');
    const immediate=root.querySelector('#immediateAction')?.closest('label');
    if(target){
      target.querySelector('.report410-section-head b').textContent='5. 사고조치 내용';
      target.querySelector('.report410-section-head small').textContent='사고 직후 실제로 실시한 응급처치·작업중지·현장통제·병원이송·보고 등의 조치를 입력합니다.';
      if(immediate){immediate.querySelector('span').textContent='사고조치 내용 *';target.insertBefore(immediate,prevention.closest('label'));}
      prevention.closest('label').remove();
    }
    const leave=root.querySelector('#leaveEstimate');if(leave)leave.value=i?.leaveEstimate||i?.reportDetails?.leaveEstimate||(i?'unknown':'');
    const severity=root.querySelector('#severity');if(severity)severity.value=i?.severity||'minor';
    const potential=root.querySelector('#potentialMajor');if(potential)potential.checked=!!i?.potentialMajor;

  }
  function bindOccurrenceTime(form,i){
    const input=form.querySelector('#occurredTime410'),label=input.closest('label');
    const group=document.createElement('div');group.className='report410-time-choice';
    label.before(group);group.append(label);
    const choice=document.createElement('label');choice.className='report410-unknown-choice';
    choice.innerHTML='<input id="unknownTime410" type="checkbox"><span>시간 미상</span>';
    group.append(choice);
    const toggle=choice.querySelector('input');
    toggle.checked=unknownTime(i);
    // Migrated records keep their original source metadata in the historical correction flow.
    toggle.disabled=!!(i?.historicalTransfer||i?.historicalImport?.enabled);
    function sync(){
      input.disabled=toggle.checked;
      input.required=!toggle.checked;
      if(toggle.checked){input.value='';input.dataset.allowExistingBlank='1';}
      else delete input.dataset.allowExistingBlank;
      const wrap=input.closest('.report410-picker-wrap');
      wrap.classList.toggle('has-value',!!input.value);
      wrap.querySelector('.report410-picker-placeholder').textContent=toggle.checked?'—':'선택하세요';
      window.enlRefreshRequiredFields453?.();
    }
    toggle.addEventListener('change',sync);sync();
  }
  const reportValue=v=>esc(v===0?'0':v||'미입력');
  const reportRow=(label,v)=>`<div class="report410-record-row"><b>${esc(label)}</b><div>${reportValue(v)}</div></div>`;
  const reportStage=(stage,title,html,highlight='')=>`<section class="report410-stage ${highlight?`report410-active-${highlight}`:''}" data-report-stage="${stage}"><h3>${stage}. ${title}</h3>${html}</section>`;
  const reportFiles=(scope,files)=>(files||[]).length?`<div class="report410-files" data-report-files="${esc(scope)}">${window.enlAttachmentGalleryHtml?.(files)||files.map(f=>reportValue(f.name||'첨부자료')).join('<br>')}</div>`:'';
  function briefReportText(value,isCause){
    const raw=String(value||'').trim();
    if(!raw)return '';
    if(!isCause){
      const standard=window.enlSavedPlanBrief?.(raw);
      if(standard)return standard;
    }
    const unnumbered=raw.replace(/(^|\n)\s*\d+[.)]\s+/g,'\n');
    const lines=unnumbered.replace(/([가-힣][.!?])\s+/g,'$1\n').split(/\n+/)
      .map(s=>s.replace(/^\s*[-•]\s+/, '').trim()).filter(Boolean);
    if(isCause){
      const factors=lines.filter(s=>/^(환경적|행동적)\s*요인\s*[:：]/.test(s));
      if(factors.length){
        return [...new Set(factors.map(s=>s.replace(/^(환경적|행동적)\s*요인\s*[:：]\s*/,'')
          .replace(/작업로에 쌓인 눈으로 인해/g,'작업로 적설로')
          .replace(/의 위치가 가려져 식별이 어려웠으며,\s*[^.!?]*(?:위험한 환경이 형성됨|위험이 발생함)[.]?$/,' 위치 식별이 어려웠음')
          .replace(/^.*?상황에서 (?:작업로 내 )?(.+?)의 위치와 충돌 위험을 충분히 확인하지 못한 채 (.+?)(?:을|를) 진행함[.]?$/, '$2 시 $1 위치와 충돌 위험 확인 부족')
          .replace(/위치와 충돌 위험을 충분히 확인하지 못한 채 (.+?)을 진행함[.]?$/,'위치와 충돌 위험 확인이 부족한 상태로 $1을 진행함')))].join('\n');
      }
      const analysis=lines.filter(s=>!/^발생 메커니즘\s*[:：]/.test(s));
      if(analysis.length&&analysis.length<lines.length)return analysis.slice(0,2).join('\n');
    }
    if(raw.length<=95)return raw;
    // Extract complete statements. Keep an exception or restriction with the lead action.
    const content=lines.filter(s=>s!=='조치 완료 후 현장소장이 이행 여부를 확인하고 사진 등 증빙을 남겨 안전관리자에게 제출한다.');
    const distinct=[...new Set(content.length?content:lines)];
    const chosen=distinct.slice(0,2);
    for(const s of distinct.slice(2))if(/^(단[,\s]|다만|예외)|금지|전까지.{0,16}(중지|제한)/.test(s))chosen.push(s);
    return chosen.map(s=>s.replace(/하기 위한 조치를 실시한다[.]?$/,'하도록 조치한다')
      .replace(/([가-힣]+)을 실시하도록 한다[.]?$/,'$1을 실시한다')
      .replace(/여부에 대한 확인을 실시한다[.]?$/,'여부를 확인한다')).join('\n');
  }
  function executiveSummaryHtml(i,{initialOnly=false,includeOriginal=false}={}){
    const d=i.reportDetails||{},c=includeOriginal||i.corrective?.status==='approved'?(i.corrective||{}):{};
    const person=i.category==='person',rows=[];
    const clean=v=>{const text=String(v??'').trim();return ['-','미입력','미기재'].includes(text)?'':text};
    const join=(values,separator=' / ')=>[...new Set(values.map(clean).filter(Boolean))].join(separator);
    function row(label,value,emphasis=false,original=''){
      const detail=clean(original)&&clean(original)!==clean(value)?'<details class="inc411-brief-original"><summary>원문 보기</summary><div>'+esc(clean(original))+'</div></details>':'';
      if(clean(value))rows.push(`<tr${/비용|예상비|진료비|견적/.test(label)?' class="inc411-cost-fact"':emphasis?' class="inc411-key-fact"':''}><th scope="row">${esc(label)}</th><td>${esc(clean(value))}${detail}</td></tr>`);
    }
    const parts=occurredParts(i),dateOnly=unknownTime(i)||/^\d{4}-\d{2}-\d{2}$/.test(i.occurredAt||'')||!parts.time;
    const date=clean(i.occurredDate||i.historicalTransfer?.occurredDate||parts.date);
    const when=date?(dateOnly?date+' (시간 미상)':date+' '+parts.time):'';
    row('발생 일시 / 장소',join([when,d.place]));
    if(i.pastReport){row('담당 기안자',i.pastReport.drafterName);row('담당 안전관리자',i.pastReport.safetyManagerName);}
    row('보고자',i.historicalImport?.originalReporterName||i.historicalTransfer?.originalReporterName||i.reporterName);
    row(person?'부상자':'작업자',join([person?d.injuredName||i.injuredName:d.workerName,d.job||i.job]));
    row('사고 전 작업',d.workAction);
    row('발생 경위',clean(d.incidentHow)||i.summary,true);
    row(person?'부상 내용':'파손 피해',person?d.injuryDetail:join([d.damagedItem,d.damageDetail]));
    if(person){
      const raw=clean(d.medicalCost).replace(/,/g,''),amount=Number(raw);
      row('진료비',d.medicalCostPending===true?'확인 중':raw&&Number.isFinite(amount)&&amount>=0?amount.toLocaleString('ko-KR')+'원':'',true);
    }
    if(!person){
      const raw=clean(d.repairCost).replace(/,/g,''),amount=Number(raw);
      row('복구 예상비',d.repairCostPending===true?'확인 중':raw&&Number.isFinite(amount)&&amount>=0?amount.toLocaleString('ko-KR')+'원':'',true);
      row('견적 / 비용 상세',d.repairCostDetail,true);
    }
    row('즉시 조치',i.immediateAction);
    if(!initialOnly){
      if(c.status&&c.status!=='approved')row('재발방지 진행상태',({planned:'계획 수립 완료 / 현장 조치 작성 대기',draft:'현장 조치 작성 중',submitted:'안전관리자 검토 대기',rejected:'보완 요청 / 현장 조치 수정 중'})[c.status]||'작성 중');
      const cause=clean(d.causeAnalysisNote)||clean(c.rootCause)||join([d.environmentCause,d.behaviorCause],'\n');
      row(d.causeAnalysisStatus==='investigating'&&cause?'원인 (조사 중)':'사고 원인',briefReportText(cause,true)||(d.causeAnalysisStatus==='investigating'?'조사 중':''),false,cause);
      const plan=c.planDetail||(d.preventionPlan!=='후속 단계에서 안전관리자가 별도 수립'?d.preventionPlan:'');
      row('재발방지 계획',briefReportText(plan,false),false,plan);
      row('현장 조치 결과',c.actionDetail,true);
      row('조치 담당 / 완료일',join([c.actionOwner,c.actionCompletedDate||c.completedDate]));
      if(clean(i.safetyNote)!==clean(c.reviewNote))row('보고 검토의견',i.safetyNote);
      row('조치 확인',join([c.reviewNote,join([c.reviewedBy,occurredParts({occurredAt:c.reviewedAt}).date])],'\n'));
    }
    const erp=i.externalInitialApproval;
    if(erp?.state==='verified')row('기존 ERP 결재',join(['기결재 확인',erp.documentNo,erp.approvalDate]));
    if(erp?.state==='unverifiable')row('기존 ERP 결재',join(['확인 불가',erp.reason]));
    if(i.officialRecord?.actionRecheckRequired)row('추가 확인','정정에 따른 조치 재검토 필요');
    // Reader views of personal injuries must never expose supplemental medical documents.
    const groups=[['photos','현장 자료',i.photos],['supplement','보완 자료',person&&!includeOriginal?[]:i.supplement?.attachments],['action','조치 증빙',initialOnly?[]:c.afterPhotos]].filter(([, ,files])=>Array.isArray(files)&&files.length);
    const count=groups.reduce((n,[, ,files])=>n+files.length,0);
    return '<section data-incident-summary'+(initialOnly?'':' data-executive-summary')+'><table class="inc411-summary-table"><caption>사고 경위서</caption><tbody>'+rows.join('')+'</tbody></table>'+
      (count?'<details class="inc411-summary-files"><summary>첨부자료 '+count+'건 보기</summary>'+groups.map(([scope,label,files])=>'<h4>'+label+'</h4>'+reportFiles(scope,files)).join('')+'</details>':'')+
      (includeOriginal?'<details class="inc411-summary-original"><summary>입력 원문 상세 보기</summary>'+reportReadOnlyHtml(i,{includeFiles:false})+'</details>':'')+'</section>';
  }
  function reportReadOnlyHtml(i,{includeFiles=true}={}){
    const root=document.createElement('div');root.className='incident410-form report410-readonly';
    root.innerHTML=reportSectionsHtml({role:'field',siteId:i.siteId},i.category,i);
    prepareReportLayout(root,i);
    root.querySelectorAll('.report410-picker-placeholder').forEach(x=>x.remove());
    root.querySelectorAll('input,select,textarea').forEach(el=>{
      if(el.type==='hidden'){el.remove();return;}
      const box=document.createElement('div');box.className='report410-read-value';
      if(['medicalCost410','medicalCostDetail410','repairCost410','repairCostDetail410'].includes(el.id))box.classList.add('report410-cost-value');
      box.textContent=el.id==='occurredTime410'&&unknownTime(i)?'시간 미상':el.id==='severity'&&!i.severity?'미입력':el.id==='potentialMajor'&&i.potentialMajor==null?'미확인':el.type==='checkbox'?(el.checked?'해당':'해당 없음'):el.tagName==='SELECT'?(el.selectedOptions[0]?.textContent||'미입력'):(el.value||'미입력');
      el.replaceWith(box);
    });
    root.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
    root.querySelectorAll('.report410-section-head small').forEach(x=>x.remove());
    const d=i.reportDetails||{};
    if(i.summary&&i.summary!==d.generatedSummary&&i.summary!==d.incidentHow)root.innerHTML+=reportRow('기존 사고 요약',i.summary);
    if(d.preventionPlan&&d.preventionPlan!=='후속 단계에서 안전관리자가 별도 수립')root.innerHTML+=reportRow('최초 보고 당시 예방대책',d.preventionPlan);
    if(i.pastReport)root.innerHTML+=reportRow('담당 기안자',i.pastReport.drafterName)+reportRow('담당 안전관리자',i.pastReport.safetyManagerName);
    root.innerHTML+=reportRow('보고자 / 보고일시',[i.reporterName,i.createdAt&&fmt(i.createdAt)].filter(Boolean).join(' · '));
    if(includeFiles)root.innerHTML+=`<section class="report410-section"><div class="report410-section-head"><b>현장 첨부자료</b></div>${reportFiles('photos',i.photos)||'첨부 없음'}${reportFiles('supplement',i.supplement?.attachments)}</section>`;
    return root.outerHTML;
  }
  function cumulativeReportHtml(i,{through='E',from='A',highlight='',presentation='document',includeOriginal=false}={}){
    const d=i.reportDetails||{},c=i.corrective||{},parts=[];
    const add=(s,title,html)=>{if(s>=from&&s<=through)parts.push(reportStage(s,title,html,highlight===s?'orange':''));};
    add('A','현장 최초 사고보고',presentation==='screen'?executiveSummaryHtml(i,{initialOnly:true,includeOriginal}):reportReadOnlyHtml(i));
    add('B','안전관리자 원인분석 및 검토',
      reportRow('원인분석 상태',d.causeAnalysisStatus==='analyzed'?'분석 완료':d.causeAnalysisStatus==='investigating'?'조사 중 · 미확정':'분석 대기')+
      reportRow('환경적 요인',d.environmentCause)+reportRow('행동적 요인',d.behaviorCause)+reportRow('기타·종합 원인',d.causeAnalysisNote)+
      reportRow('분석 담당 / 일시',[d.causeAnalyzedBy,d.causeAnalyzedAt&&fmt(d.causeAnalyzedAt)].filter(Boolean).join(' · '))+
      reportRow('검토의견',i.safetyNote)+reportRow('사고보고 승인',[i.approvedBy,i.approvedAt&&fmt(i.approvedAt)].filter(Boolean).join(' · ')));
    if(c.planDetail||c.planAt)add('C','안전관리자 재발방지계획',reportRow('원인 분석',c.rootCause)+reportRow('재발방지계획',c.planDetail)+reportRow('조치 담당자 / 완료예정일',[c.ownerName,c.dueDate].filter(Boolean).join(' · '))+reportRow('계획 수립',[c.planBy,c.planAt&&fmt(c.planAt)].filter(Boolean).join(' · ')));
    if(c.actionDetail||c.submittedAt)add('D','현장 재발방지조치 및 증빙',reportRow('실제 조치내용',c.actionDetail)+reportRow('시행일 / 완료일',[c.actionDate,c.actionCompletedDate||c.completedDate].filter(Boolean).join(' / '))+reportRow('조치 담당자',c.actionOwner)+reportRow('추가 확인사항',c.additionalNotes)+reportRow('제출자 / 일시',[c.submittedBy,c.submittedAt&&fmt(c.submittedAt)].filter(Boolean).join(' · '))+reportFiles('action',c.afterPhotos));
    if(c.reviewNote||c.reviewedAt||i.closedAt)add('E','안전관리자 조치 확인',reportRow('처리 상태',i.status==='closed'?'종결':i.executiveApproval?.state==='pending'?'경영진 결재대기':c.status==='rejected'?'보완요청':'검토 중')+reportRow('확인 / 보완요청 의견',c.reviewNote)+reportRow('확인자 / 일시',[c.reviewedBy,c.reviewedAt&&fmt(c.reviewedAt)].filter(Boolean).join(' · '))+reportRow('종결 일시',i.closedAt&&fmt(i.closedAt)));
    return `<article class="report410-cumulative" data-report-id="${esc(i.id)}">${parts.join('')}</article>`;
  }
  // Arrange existing controls in the same two-column table as the approval report.
  // Move nodes so labels, draft listeners, upload controls and validation keep their identity.
  function layoutReportTables(root){
    if(!root)return;
    const groups='.report410-cumulative,.report410-section,.report410-stage,.report410-readonly,.report410-grid,.formgrid,.wf440-form-grid,.wf440-cause,.inc411-priority-box,.report410-history,#wf440SupplementForm';
    function arrange(container){
      let table=null,body=null;
      for(const child of [...container.children]){
        if(child.matches('table,[data-incident-summary]')){table=null;continue;}
        if(child.matches(groups)){arrange(child);table=null;continue;}
        const label=child.matches('label')&&child.querySelector('input,select,textarea,.report410-read-value');
        const record=child.matches('.report410-record-row');
        if(!label&&!record){table=null;continue;}
        if(!table){
          table=document.createElement('table');table.className='inc411-summary-table report410-work-table';
          body=table.createTBody();child.before(table);
          container.classList.add('report410-table-group');
        }
        const row=body.insertRow(),heading=document.createElement('th'),cell=document.createElement('td');
        heading.scope='row';row.append(heading,cell);
        if(record){
          heading.append(...child.querySelector('b').childNodes);
          cell.append(...child.querySelector('div').childNodes);
          child.remove();continue;
        }
        let name=child.querySelector(':scope > span:not(.won-entry):not(.report410-picker-wrap)');
        if(!name){
          name=document.createElement('span');
          for(const node of [...child.childNodes])if(node.nodeType===Node.TEXT_NODE)name.append(node);
          child.prepend(name);
        }
        const check=child.querySelector('input[type="checkbox"]');
        heading.textContent=check?'추가 확인':name.textContent;
        if(!check)name.classList.add('report410-field-name');
        cell.append(child);
      }
    }
    root.querySelectorAll('.inc411-overview:not(.report410-table-group)').forEach(overview=>{
      const table=document.createElement('table');table.className='inc411-summary-table report410-work-table';const body=table.createTBody();
      for(const item of [...overview.children]){
        const name=item.querySelector(':scope > span');if(!name)continue;
        const row=body.insertRow(),heading=document.createElement('th'),cell=document.createElement('td');heading.scope='row';heading.append(...name.childNodes);name.remove();cell.append(...item.childNodes);Object.assign(row.dataset,item.dataset);row.append(heading,cell);
      }
      overview.replaceChildren(table);overview.classList.add('report410-table-group');
    });
    arrange(root);
    root.querySelectorAll('.report410-work-table td>label>.report410-field-name').forEach(name=>{
      const heading=name.closest('td').previousElementSibling;
      const control=name.closest('label').querySelector('input[id],select[id],textarea[id]');
      const shortNames={incidentPlace410:'사고 장소',workAction410:'사고 전 작업',incidentHow410:'발생 경위',immediateAction:'즉시 조치',injuredName:'부상자',injuryDetail410:'부상 내용',propertyWorker410:'작업자',damagedItem410:'파손 물품',damageDetail410:'파손 내용',repairCost410:'복구 예상비',repairCostDetail410:'비용 상세',doctorOpinion410:'의사 소견',medicalCost410:'진료비',medicalCostDetail410:'진료비 상세'};
      const short=name.closest('#unifiedReportForm')&&shortNames[control?.id];
      const label=short?short+(name.textContent.includes('*')?' *':'')+(name.textContent.includes('사후 보완 가능')?'\n(사후 보완 가능)':''):name.textContent;
      if(heading.textContent!==label)heading.textContent=label;
    });
  }
  window.enlLayoutReportTables=layoutReportTables;

  function bindCumulativeReport(root,i){
    layoutReportTables(root);
    const groups={photos:i.photos||[],supplement:i.supplement?.attachments||[],action:i.corrective?.afterPhotos||[]};
    root.querySelectorAll('[data-report-files]').forEach(el=>window.enlBindAttachmentOpen?.(el,groups[el.dataset.reportFiles]||[]));
  }
  // One layout pass, no keyboard focus and no delayed retries that drag the reader back.
  function scrollReportStage(root,selector){
    const target=root?.querySelector(selector),modal=root?.closest('.modal')||root?.querySelector('.modal');if(!target||!modal)return;
    const frame=requestAnimationFrame(()=>{if(!target.isConnected||modal.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select'))return;
      let scroller=target.parentElement;while(scroller&&scroller!==document.body){if(/auto|scroll/.test(getComputedStyle(scroller).overflowY)&&scroller.scrollHeight>scroller.clientHeight)break;scroller=scroller.parentElement;}
      if(scroller&&scroller!==document.body)scroller.scrollTop+=target.getBoundingClientRect().top-scroller.getBoundingClientRect().top-12;
      else target.scrollIntoView({block:'start',behavior:'instant'});
    });return()=>cancelAnimationFrame(frame);
  }
  window.enlExecutiveSummaryHtml=executiveSummaryHtml;
  window.enlIncidentSummaryHtml=executiveSummaryHtml;
  window.enlReportReadOnlyHtml=reportReadOnlyHtml;
  window.enlCumulativeReportHtml=cumulativeReportHtml;
  window.enlBindCumulativeReport=bindCumulativeReport;
  window.enlScrollReportStage=scrollReportStage;

  function addPastReportFields(form,incident){
    const section=document.createElement('section');
    section.className='report410-section';
    section.innerHTML='<label class="report410-check"><input type="checkbox" id="pastReportMode"><span>과거사고 입력모드</span></label><div id="pastReportPeople" hidden><p>재발방지조치를 담당하는 현재 현장소장과 안전관리자의 이름을 입력하세요.</p><div class="report410-grid"><label class="lbl"><span>담당 기안자</span><input id="pastReportDrafter" maxlength="80" disabled></label><label class="lbl"><span>담당 안전관리자</span><input id="pastReportSafety" maxlength="80" disabled></label></div></div>';
    form.querySelector('.section-head').after(section);
    const toggle=section.querySelector('#pastReportMode'),people=section.querySelector('#pastReportPeople');
    const syncPeople=()=>{
      people.hidden=!toggle.checked;
      for(const input of people.querySelectorAll('input')){
        input.disabled=!toggle.checked;
        input.required=toggle.checked;
      }
    };
    toggle.addEventListener('change',syncPeople);
    if(incident?.pastReport){
      toggle.checked=true;toggle.disabled=true;
      people.querySelector('p').textContent='재발방지조치를 담당하는 현재 현장소장과 안전관리자의 이름을 확인하고, 담당자가 다르면 수정하세요. 변경 전후 정보와 수정 사유가 기록되며 기존 승인 상태는 유지됩니다.';
      section.querySelector('#pastReportDrafter').value=incident.pastReport.drafterName||'';
      section.querySelector('#pastReportSafety').value=incident.pastReport.safetyManagerName||'';
      syncPeople();
    }
  }

  function renderTypeForm(root,u,type,i=activeEdit()){
    if(!root)return;if(!['person','property'].includes(type))return renderTypePicker(root,u);activeType=type;
    const person=type==='person',editing=!!i,title=person?'대인사고 경위서':'대물사고 경위서',desc=person?'부상·진단·진료비 등 인적 피해 중심으로 작성합니다.':'파손내용·복구비용·견적 등 물적 피해 중심으로 작성합니다.';
    root.innerHTML=`${isSiteUser(u)?topBack(u):''}<form id="unifiedReportForm" class="panel report-simple incident410-form report410-entry-table" data-report-type="${type}" data-editing="${editing?'true':'false'}"><div class="section-head"><div><div class="ey">${person?'PERSON INCIDENT':'PROPERTY INCIDENT'}</div><h2>${title}${editing?' 수정':''}</h2><p>${editing?'기존에 입력한 내용을 불러왔습니다. 필요한 부분을 수정한 뒤 다시 제출해 주세요.':desc}</p></div>${editing?'<button type="button" class="secondary report410-change" data-cancel-edit>← 사고 기록으로</button>':'<button type="button" class="secondary report410-change" data-change-type>← 사고 종류 변경</button>'}</div>${reportSectionsHtml(u,type,i)}<section class="report410-section report410-photo" data-photo-required="${!editing||hasSceneEvidence(i?.photos)}"><div class="report410-section-head"><b>5. 현장 첨부자료${editing&&!hasSceneEvidence(i?.photos)?'':' *'}</b></div>${photoPickerHtml('incident')}</section>${editing&&u?.role==='safety'?'<section class="report410-section"><label class="lbl"><span>안전관리자 수정 사유 *</span><textarea id="safetyFactEditReason" required minlength="2" maxlength="2000" rows="2" placeholder="예: 원자료 재확인 후 사고발생일 오류 수정"></textarea></label><small>안전관리자 수정 시 기존 검토 상태는 그대로 유지되며 변경 사항은 서버 감사기록에 남습니다.</small></section>':''}<button class="primary full report410-submit" type="submit">${editing?(u?.role==='safety'?'수정사항 저장':'수정 후 다시 제출'):title+' 제출하기'}</button></form>`;
    prepareReportLayout(root,i);
    const actionHeading=root.querySelector('#immediateAction')?.closest('.report410-section')?.querySelector('.report410-section-head b');
    if(actionHeading)actionHeading.textContent='4. 사고조치 내용';
    if(editing&&u?.role==='safety'){
      const form=root.querySelector('#unifiedReportForm'),submit=form.querySelector('.report410-submit');
      if(accepted(i)){const review=document.createElement('section');review.className='report410-section';review.innerHTML='<label class="lbl"><span>안전관리자 검토의견</span><textarea id="safetyReviewNote410" maxlength="4000" rows="4">'+esc(i.safetyNote||'')+'</textarea></label>';submit.before(review);}
      if(window.enlHistoricalMetadataHtml&&window.enlIsHistoricalCorrectionSupported?.(i)){const meta=document.createElement('section');meta.className='report410-section';meta.innerHTML='<h3>과거사고 원자료 정보</h3>'+window.enlHistoricalMetadataHtml(i);submit.before(meta);}
      if(window.enlCreateCauseEditor){const cause=window.enlCreateCauseEditor(i);cause.dataset.reportStage='B';cause.querySelector('[data-wf440-cause-save]')?.remove();submit.before(cause);}
      if(i.corrective){const past=document.createElement('div');past.innerHTML=cumulativeReportHtml(i,{from:'C'});submit.before(past);bindCumulativeReport(past,i);}
      if(accepted(i)){form.dataset.reportCorrection='1';for(const el of form.querySelectorAll('[required]'))if(!el.value&&el.id!=='safetyFactEditReason'){el.required=false;el.dataset.allowExistingBlank='1';}const priority=form.querySelector('#priorityManual411');if(priority)priority.disabled=true;}
    }
    layoutReportTables(root.querySelector('#unifiedReportForm'));
    bindOccurrenceTime(root.querySelector('#unifiedReportForm'),i);
    if(u.role==='safety'&&(!editing||i.pastReport))addPastReportFields(root.querySelector('#unifiedReportForm'),i);
    incidentPhotos=editing&&Array.isArray(i.photos)?[...i.photos]:[];renderPhotoThumbs('incident');bindPhotoButtons();
    if(editing){const site=document.getElementById('reportSite');if(site){site.disabled=true;site.title='이미 등록된 사고의 사업장은 수정할 수 없습니다.';}}
    if(person){const leave=document.getElementById('leaveEstimate');if(leave)leave.value=i?.leaveEstimate||i?.reportDetails?.leaveEstimate||(i?'unknown':'')}
    const severity=document.getElementById('severity');if(severity)severity.value=i?.severity||'minor';const potential=document.getElementById('potentialMajor');if(potential)potential.checked=!!i?.potentialMajor;
    window.enlRefreshRequiredFields453?.();
    if(editing){const form=root.querySelector('#unifiedReportForm');form._initialValues=Object.fromEntries([...form.querySelectorAll('input[id],textarea[id],select[id]')].map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));}
    root.querySelectorAll('[data-report410-picker]').forEach(w=>{const input=w.querySelector('input'),ph=w.querySelector('.report410-picker-placeholder');if(!input)return;const sync=()=>w.classList.toggle('has-value',!!String(input.value||'').trim());const focus=()=>w.classList.add('is-focus'),blur=()=>{w.classList.remove('is-focus');sync()};input.addEventListener('input',sync);input.addEventListener('change',sync);input.addEventListener('focus',focus);input.addEventListener('blur',blur);ph?.addEventListener('click',()=>{try{input.focus();input.showPicker?.()}catch(e){input.focus()}});sync()});
    root.querySelectorAll('[data-auto-pending]').forEach(el=>{const base=String(el.dataset.autoPending||PENDING_COST);el.addEventListener('focus',()=>{if(String(el.value||'').trim()===base)el.value=''});el.addEventListener('blur',()=>{if(!String(el.value||'').trim())el.value=base})});
    window.ENLFormDrafts?.bind(root.querySelector('#unifiedReportForm'),u,type,i);
    root.querySelector('[data-report-home]')?.addEventListener('click',()=>backHome(u));root.querySelector('[data-change-type]')?.addEventListener('click',()=>renderTypePicker(root,u));root.querySelector('[data-cancel-edit]')?.addEventListener('click',()=>backRecords(u));root.querySelector('#unifiedReportForm')?.addEventListener('submit',async e=>submitIncident410(e,u,type,i));
  }

  function required(id,label){const el=document.getElementById(id);if(el?.dataset.allowExistingBlank==='1')return true;if(el&&String(el.value||'').trim())return true;el?.focus();el?.scrollIntoView({behavior:'smooth',block:'center'});alert(`${label}을(를) 입력해 주세요.`);return false}
  function formatOccurred(date,time){if(!date)return '';const p=date.split('-');return p.length===3?`${Number(p[0])}년 ${Number(p[1])}월 ${Number(p[2])}일 ${time?time+'경':'(시간 미상)'}`.trim():`${date} ${time}`.trim()}
  function buildSummary(type,siteId){const when=formatOccurred(value('occurredDate410'),value('occurredTime410')),site=currentSiteName(siteId),place=value('incidentPlace410'),work=value('workAction410'),how=value('incidentHow410'),prevention=value('preventionPlan410'),special=value('specialNote410');let damage='';if(type==='person'){const cost=money(value('medicalCost410'));damage=[`${value('injuredName')||'피해 직원'}: ${value('injuryDetail410')}`,value('diagnosis410')&&`진단명: ${value('diagnosis410')}`,value('doctorOpinion410')&&`의사 소견: ${value('doctorOpinion410')}`,cost&&`진료비: ${moneyText(cost)}`].filter(Boolean).join(' / ')}else{const raw=value('repairCost410'),cost=money(raw),costText=raw===PENDING_COST||!cost?PENDING_COST:moneyText(cost);damage=[value('propertyWorker410')&&`작업자: ${value('propertyWorker410')}`,`${value('damagedItem410')}: ${value('damageDetail410')}`,`복구 예상비용: ${costText}`,value('repairCostDetail410')&&`견적 상세: ${value('repairCostDetail410')}`].filter(Boolean).join(' / ')}return [`[사고 개요] ${when} ${site} ${place}`,`[사고 경위] ${work} 중 ${how}`,`[피해 상황] ${damage}`,prevention&&`[재발 방지 대책] ${prevention}`,special&&`[특이사항] ${special}`].filter(Boolean).join('  ')}

  async function submitIncident410(e,u,type,existing=null){
    const draftStore=window.ENLFormDrafts?.forForm(e.currentTarget);
    if(existing)existing=structuredClone(existing);
    e.preventDefault();
    if(window.enlValidateOccurrenceInputs&&!window.enlValidateOccurrenceInputs())return;
    if(existing&&accepted(existing)&&u?.role!=='safety')return alert('승인된 사고는 안전관리자만 정정할 수 있습니다.');if(!canCreate(u))return alert('사고보고 등록 권한이 없습니다.');
    for(const [id,label] of [['reportSite','사업장'],['occurredDate410','발생 날짜'],['occurredTime410','발생 시간'],['incidentPlace410','사고 장소'],['workAction410','사고 직전 작업'],['incidentHow410','사고 발생 과정'],['immediateAction','사고 직후 조치']])if(!required(id,label))return;
    if(type==='person'){if(!required('injuredName','피해 직원 성명')||!required('injuryDetail410','부상 내용')||!required('leaveEstimate','휴업기간 또는 사망 여부'))return}else if(!required('damagedItem410','파손된 물품 또는 시설')||!required('damageDetail410','파손 내용'))return;
    if(existing&&!accepted(existing)&&typeof window.enlCanEditIncident==='function'&&!window.enlCanEditIncident(existing,u))return alert('현재 상태에서는 이 사고보고를 수정할 수 없습니다.');

    if((!existing||hasSceneEvidence(existing.photos))&&!hasSceneEvidence(incidentPhotos)){
      document.getElementById('incidentPhotoBtn')?.focus();
      return alert('현장 첨부자료를 1개 이상 등록해 주세요. 사진, PDF 또는 문서를 첨부할 수 있습니다.');
    }
    const safetyReason=existing&&u?.role==='safety'?value('safetyFactEditReason'):'';
    if(existing&&u?.role==='safety'&&safetyReason.length<2)return alert('수정 사유를 2자 이상 입력해 주세요.');

    const siteId=value('reportSite'),date=value('occurredDate410'),time=value('occurredTime410'),severity=value('severity')||'minor',leaveEstimate=type==='person'?value('leaveEstimate'):'none',potentialMajor=!!document.getElementById('potentialMajor')?.checked,summary=buildSummary(type,siteId),eventType=value('eventType'),autoPriority=computePriority(type,severity,eventType,potentialMajor,leaveEstimate),priorityChoice=u?.role==='safety'?(value('priorityManual411')||'auto'):'auto',priority=priorityChoice==='auto'?autoPriority:priorityChoice,prioritySource=priorityChoice==='auto'?'auto':'manual',details={...(existing?.reportDetails||{}),templateVersion:'v411',reportType:type,place:value('incidentPlace410'),workAction:value('workAction410'),incidentHow:value('incidentHow410'),preventionPlan:existing?.reportDetails?.preventionPlan||'',specialNote:value('specialNote410'),generatedSummary:summary,recordedAt:existing?.reportDetails?.recordedAt||nowISO()};
    if(type==='person')Object.assign(details,{injuredName:value('injuredName'),job:value('job'),injuryDetail:value('injuryDetail410'),diagnosis:value('diagnosis410'),doctorOpinion:value('doctorOpinion410'),medicalCost:money(value('medicalCost410')),medicalCostPending:!value('medicalCost410'),medicalCostDetail:value('medicalCostDetail410')});else{const repairRaw=value('repairCost410'),repairValue=money(repairRaw),repairPending=!repairRaw||repairRaw===PENDING_COST||repairValue<=0,repairDetail=value('repairCostDetail410')||PENDING_COST;Object.assign(details,{workerName:value('propertyWorker410'),job:value('job'),damagedItem:value('damagedItem410'),damageDetail:value('damageDetail410'),repairCost:repairPending?0:repairValue,repairCostPending:repairPending,repairCostDetail:repairDetail})}
    const common={siteId,category:type,eventType,severity,leaveEstimate,potentialMajor,injuredName:type==='person'?value('injuredName'):'',job:value('job'),summary,immediateAction:value('immediateAction'),photos:[...incidentPhotos].map(persistAttachment),occurredAt:time?new Date(`${date}T${time}:00+09:00`).toISOString():date,updatedAt:nowISO(),priority,prioritySource,prioritySetBy:prioritySource==='manual'?u.name:'',prioritySetAt:prioritySource==='manual'?nowISO():null,legalReview:computeLegalReview(type,severity,leaveEstimate),reportDetails:details};
    if(u.role==='safety'&&(!existing||existing.pastReport)&&e.currentTarget.querySelector('#pastReportMode:checked')){
      if(!required('pastReportDrafter','담당 기안자')||!required('pastReportSafety','담당 안전관리자'))return;
      common.pastReport={drafterName:value('pastReportDrafter'),safetyManagerName:value('pastReportSafety')};
    }
    if(existing){const original=occurredParts(existing);if(date===original.date&&(unknownTime(existing)?!time:time===original.time))common.occurredAt=existing.occurredAt;}
    if(window.ENLContracts&&(!existing||existing.siteId!==siteId||String(existing.occurredAt||'')!==common.occurredAt)){
      const snap=window.ENLContracts.capture(siteId,date,u,false);
      const needsConfirmation=common.pastReport&&(snap.outsideContractPeriod===true||(snap.currentStatus==='closed'&&snap.statusAtOccurrence==='unknown'));
      if(needsConfirmation&&!confirm('사고일이 계약기간 밖이거나 계약기간을 확인할 수 없습니다. 원자료의 사업장과 날짜를 확인했습니까?'))return;
      common.siteContractSnapshot=needsConfirmation?window.ENLContracts.capture(siteId,date,u,true):snap;
    }
    if(existing){
      // Defaults help first-time entry; opening an existing report must never persist them as new facts.
      const initial=e.currentTarget._initialValues||{},unchanged=id=>{const el=e.currentTarget.querySelector('#'+id);return !el||(el.type==='checkbox'?el.checked:el.value)===initial[id];};
      const preserve=(object,previous,key)=>{if(Object.hasOwn(previous||{},key))object[key]=previous[key];else delete object[key];};
      const fields={place:'incidentPlace410',workAction:'workAction410',incidentHow:'incidentHow410',specialNote:'specialNote410',job:'job',injuredName:'injuredName',injuryDetail:'injuryDetail410',diagnosis:'diagnosis410',doctorOpinion:'doctorOpinion410',medicalCost:'medicalCost410',medicalCostPending:'medicalCost410',medicalCostDetail:'medicalCostDetail410',workerName:'propertyWorker410',damagedItem:'damagedItem410',damageDetail:'damageDetail410',repairCost:'repairCost410',repairCostPending:'repairCost410',repairCostDetail:'repairCostDetail410'};
      for(const [key,id] of Object.entries(fields))if(unchanged(id))preserve(details,existing.reportDetails,key);
      for(const [key,id] of Object.entries({eventType:'eventType',severity:'severity',leaveEstimate:'leaveEstimate',potentialMajor:'potentialMajor',injuredName:'injuredName',job:'job',immediateAction:'immediateAction'}))if(unchanged(id))preserve(common,existing,key);
      if(unchanged('unknownTime410')&&unchanged('occurredDate410')&&unchanged('occurredTime410'))common.occurredAt=existing.occurredAt;
      const panel=document.querySelector('#unifiedReportForm [data-wf440-cause]');
      if(u?.role==='safety'&&panel?.dataset.wf440Dirty==='1'){
        const cause=window.enlCollectCause?.({root:panel,allowAutoDraft:true});if(!cause)return;Object.assign(details,cause);
      }
      const factChanged=['occurredAt','eventType','immediateAction','injuredName','job'].some(k=>JSON.stringify(existing[k]??'')!==JSON.stringify(common[k]??''))||Object.keys(details).filter(k=>!['generatedSummary','recordedAt','templateVersion','reportType',...['environmentCause','behaviorCause','causeAnalysisNote','causeAnalysisStatus']].includes(k)).some(k=>JSON.stringify(details[k]??'')!==JSON.stringify(existing.reportDetails?.[k]??''));
      if(!factChanged||existing.summary!==existing.reportDetails?.generatedSummary){common.summary=existing.summary;details.generatedSummary=existing.reportDetails?.generatedSummary;}

      if(accepted(existing)){
        const changes={};
        const review=e.currentTarget.querySelector('#safetyReviewNote410');
        if(review&&review.value!==initial.safetyReviewNote410&&review.value.trim()!==String(existing.safetyNote||''))changes.safetyNote=review.value.trim();
        const top=[...(common.pastReport?['pastReport']:[]),'occurredAt','eventType','summary','injuredName','job','severity','potentialMajor','leaveEstimate','immediateAction','photos'];
        for(const k of top)if(JSON.stringify(existing[k]??null)!==JSON.stringify(common[k]??null))changes[k]=common[k];
        const allowed=['place','workAction','incidentHow','preventionPlan','specialNote','job','injuredName','injuryDetail','diagnosis','doctorOpinion','medicalCost','medicalCostPending','medicalCostDetail','workerName','damagedItem','damageDetail','repairCost','repairCostPending','repairCostDetail','environmentCause','behaviorCause','causeAnalysisNote','causeAnalysisStatus'];
        for(const k of allowed)if(JSON.stringify(details[k]??'')!==JSON.stringify(existing.reportDetails?.[k]??'')){(changes.reportDetails||(changes.reportDetails={}))[k]=details[k];}
        if(window.enlIsHistoricalCorrectionSupported?.(existing))Object.assign(changes,window.enlCollectHistoricalMetadata?.(existing,e.currentTarget)||{});
        if(!Object.keys(changes).length)return alert('변경된 내용이 없습니다.');
        const form=e.currentTarget,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
        try{await window.enlSaveReportCorrection(existing,changes,safetyReason,{...editOptions,requestState:form});draftStore?.clear();incidentPhotos=[];activeType=null;activeEditId=null;editSnapshot=null;currentView='incidents';renderShell(u);alert('정정사항이 저장되었습니다. 승인·종결 정보와 변경 전후 이력은 보존됩니다.');}catch(err){alert(window.enlCorrectionError?.(err)||err.message);}finally{button.disabled=false;}
        return;
      }
      const previousStatus=existing.status,bySafety=u?.role==='safety';
      Object.assign(existing,common);
      existing.reviewHistory=Array.isArray(existing.reviewHistory)?existing.reviewHistory:[];
      if(bySafety){
        existing.status=previousStatus;
        existing.reviewHistory.push({action:'safety_facts_corrected',by:u.name,byId:u.personnelId||u.id||'',at:nowISO(),note:safetyReason});
      }else{
        existing.status='reported';
        existing.resubmittedBy=u.name;existing.resubmittedById=u.personnelId||u.id||'';existing.resubmittedAt=nowISO();
        existing.reviewHistory.push({action:previousStatus==='reported'?'withdrawn_and_resubmitted':'resubmitted',by:u.name,at:existing.resubmittedAt});
      }
      const attempt=window.enlStableSaveAttempt?.(e.currentTarget,existing,['prioritySetAt','resubmittedAt','reviewHistory.'+(existing.reviewHistory.length-1)+'.at'])||existing;
      if(!await window.enlCommitOrNotify(attempt))return;
      draftStore?.clear();
      incidentPhotos=[];activeType=null;activeEditId=null;
      alert(bySafety?'안전관리자 수정사항이 저장되었습니다. 기존 검토상태는 유지됩니다.':'수정된 사고보고서가 다시 제출되었습니다.');
      currentView='incidents';return renderShell(u);
    }
    const form=e.currentTarget,submissionKey=JSON.stringify({...common,updatedAt:undefined,reportDetails:{...details,recordedAt:undefined}});form._draftIncidentId=form._draftIncidentId||uid('inc');const incident=form._pendingIncident&&form._submissionKey===submissionKey?form._pendingIncident:{id:form._draftIncidentId,...common,reporterName:u.name,reporterId:u.personnelId||u.id||'',createdAt:nowISO(),status:'reported',safetyNote:'',approvedBy:'',approvedAt:null,closedAt:null,corrective:null,readReceipts:[]};form._pendingIncident=incident;form._submissionKey=submissionKey;draftStore?.capture();if(!await window.enlCommitOrNotify(incident))return;draftStore?.clear();incidentPhotos=[];activeType=null;activeEditId=null;alert(`${type==='person'?'대인사고':'대물사고'} 경위서가 접수되었습니다.`);currentView='incidents';renderShell(u)
  }

  function renderReport(root,u){if(!root)return;if(!canCreate(u)){root.innerHTML='<div class="panel permission-empty"><div class="lock-icon">🔒</div><h2>사고보고 등록 권한이 없습니다.</h2></div>';return}const edit=activeEdit();if(edit){activeType=edit.category;return renderTypeForm(root,u,activeType,edit)}if(activeType)return renderTypeForm(root,u,activeType,null);return renderTypePicker(root,u)}
  window.renderUnifiedReport=renderReport;window.submitUnifiedIncident=submitIncident410;
  window.enlResetIncidentReport=()=>{activeType=null;activeEditId=null};
  window.enlShowIncidentTypePicker=(u=currentUser?.())=>{activeType=null;activeEditId=null;currentView='report';const root=document.getElementById('view');if(root)return renderTypePicker(root,u)};
  window.enlOpenIncidentReport=(type,u=currentUser?.())=>{const root=document.getElementById('view');if(!root)return;activeEditId=null;activeType=type;return renderTypeForm(root,u,type,null)};
  window.enlEditIncidentInReportForm=(incidentOrId,u=currentUser?.(),options={})=>{
    const i=typeof incidentOrId==='object'?incidentOrId:(data.incidents||[]).find(x=>String(x.id)===String(incidentOrId));
    if(!i)return alert('사고기록을 찾지 못했습니다.');
    if(!['person','property'].includes(i.category))return alert('대인·대물 사고보고만 원래 입력화면에서 수정할 수 있습니다.');
    if(accepted(i)){
      if(u?.role!=='safety')return alert('수정 권한이 없습니다.');
      if(window.enlIsHistoricalCorrectionSupported?.(i)&&!options.reauthTicket)return window.enlOpenHistoricalCorrection(i,u);
    }else if(typeof window.enlCanEditIncident==='function'&&!window.enlCanEditIncident(i,u))return alert('현재 상태에서는 이 사고보고를 수정할 수 없습니다.');
    editSnapshot=structuredClone(i);editOptions=options;activeEditId=i.id;activeType=i.category;
    closeModal();currentView='report';return renderShell(u);
  };
  window.ENL_REPORT_VERSION=VERSION;
})();
