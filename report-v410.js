/* E&L Accident Report App v4.1.0 - authoritative person/property report flow */
(function(){
  'use strict';

  const VERSION='4.1.0';
  let activeType=null;

  const isSiteUser=u=>!!u&&['field','worker'].includes(u.role);
  const canCreate=u=>!!u&&['field','worker','safety'].includes(u.role);
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const money=v=>{const n=Number(String(v||'').replace(/,/g,''));return Number.isFinite(n)&&n>0?n:0};
  const moneyText=n=>n?`${n.toLocaleString('ko-KR')}원`:'미확인';
  const currentSiteName=id=>siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||'사업장';

  function backHome(u){
    activeType=null;
    if(isSiteUser(u)&&typeof window.enlFieldHome==='function')return window.enlFieldHome(u);
    currentView='home';
    renderShell(u);
  }

  function topBack(u,label='사고 종류 선택'){
    if(isSiteUser(u))return `<div class="field-task-back"><button type="button" data-report-home>← 현장 홈으로</button><span>${esc(currentSiteName(u.siteId))}</span></div>`;
    return `<div class="report410-top-back"><button type="button" data-report-home>← ${esc(label)}</button></div>`;
  }

  function bindPicker(root,u){
    root.querySelector('[data-report-home]')?.addEventListener('click',()=>backHome(u));
    root.querySelectorAll('[data-report-type]').forEach(btn=>btn.addEventListener('click',()=>{
      activeType=btn.dataset.reportType;
      renderTypeForm(root,u,activeType);
    }));
  }

  function renderTypePicker(root,u){
    if(!root)return;
    activeType=null;
    root.innerHTML=`${topBack(u,'홈으로')}
      <section class="panel report-type-picker" data-report-picker="v410">
        <div class="section-head"><div><div class="ey">ACCIDENT REPORT</div><h2>사고 종류를 선택해 주세요</h2><p>발생한 사고에 맞는 경위서를 선택합니다.</p></div></div>
        <div class="report-type-grid">
          <button type="button" class="report-type-card person" data-report-type="person">
            <span class="report-type-no">01</span><strong>대인사고</strong>
            <small>사람이 다치거나 치료가 필요한 사고<br>부상·진단·진료비 중심 작성</small>
          </button>
          <button type="button" class="report-type-card property" data-report-type="property">
            <span class="report-type-no">02</span><strong>대물사고</strong>
            <small>차량·장비·시설물이 파손된 사고<br>파손·복구견적 중심 작성</small>
          </button>
        </div>
        <div class="report-type-note">사고 종류를 선택하면 해당 경위서에 필요한 항목만 표시됩니다.</div>
      </section>`;
    bindPicker(root,u);
  }

  function siteControl(u){
    if(isSiteUser(u))return `<input id="reportSite" type="hidden" value="${esc(u.siteId||'')}"><input value="${esc(currentSiteName(u.siteId))}" disabled>`;
    return `<select id="reportSite" required><option value="">사업장 선택</option>${(data.sites||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`;
  }

  function commonTop(u){
    const dt=localDT();
    return `<div class="report410-grid">
      <label class="lbl"><span>사업장 *</span>${siteControl(u)}</label>
      <label class="lbl"><span>발생 날짜 *</span><input id="occurredDate410" type="date" value="${esc(dt.slice(0,10))}" required></label>
      <label class="lbl"><span>발생 시간 *</span><input id="occurredTime410" type="time" value="${esc(dt.slice(11,16))}" required></label>
      <label class="lbl report410-wide"><span>정확한 사고 장소 *</span><input id="incidentPlace410" required placeholder="예: A코스 3홀 티 우측 법면부"></label>
      <label class="lbl report410-wide"><span>사고 유형 *</span><select id="eventType">${eventTypeOptions()}</select></label>
    </div>`;
  }

  function circumstanceSection(type){
    const how=type==='person'?'예: 칡넝쿨 제거 작업 중 낫에 왼쪽 엄지손가락이 접촉하여 베임':'예: 작업차량 이동 중 홀맵지주 하단부와 접촉하여 찌그러짐';
    const action=type==='person'?'예: 작업 중지 후 응급처치하고 병원으로 이동':'예: 작업 중지 후 파손부위 확인, 주변 통제 및 담당자 보고';
    return `<section class="report410-section"><div class="report410-section-head"><b>2. 사고 경위</b><small>사고 전 → 발생 → 사고 직후 순서로 작성합니다.</small></div>
      <label class="lbl"><span>사고 직전에 무엇을 하고 있었나요? *</span><textarea id="workAction410" rows="2" required placeholder="예: K코스 2번홀 티 예지 작업을 하고 있었음"></textarea></label>
      <label class="lbl"><span>어떻게 사고가 발생했나요? *</span><textarea id="incidentHow410" rows="3" required placeholder="${how}"></textarea></label>
      <label class="lbl"><span>사고 직후 어떻게 조치했나요? *</span><textarea id="immediateAction" rows="3" required placeholder="${action}"></textarea></label>
    </section>`;
  }

  function causeSection(){
    return `<section class="report410-section"><div class="report410-section-head"><b>3. 사고 원인</b><small>추측하지 말고 확인된 내용만 적어주세요. 아직 모르면 비워둘 수 있습니다.</small></div>
      <label class="lbl"><span>환경적 요인</span><textarea id="environmentCause410" rows="2" placeholder="예: 경사로·장애물 위치 확인이 어려웠음"></textarea></label>
      <label class="lbl"><span>행동적 요인</span><textarea id="behaviorCause410" rows="2" placeholder="예: 이동 전 주변 확인이 충분히 이루어지지 않음"></textarea></label>
    </section>`;
  }

  function personDamageSection(){
    return `<section class="report410-section report410-damage person"><div class="report410-section-head"><b>4. 대인 피해 상황</b><small>병원 진단 전이면 확인된 내용까지만 입력하세요.</small></div><div class="report410-grid">
      <label class="lbl"><span>피해 직원 성명 *</span><input id="injuredName" required placeholder="예: 홍길동"></label>
      <label class="lbl"><span>직종 / 업무</span><input id="job" placeholder="예: 코스관리"></label>
      <label class="lbl report410-wide"><span>어디를 어떻게 다쳤나요? *</span><textarea id="injuryDetail410" rows="3" required placeholder="예: 왼쪽 엄지손가락을 베어 출혈 및 절상 발생"></textarea></label>
      <label class="lbl report410-wide"><span>진단명</span><input id="diagnosis410" placeholder="병원 진단 후 입력, 미확인 시 비워두기"></label>
      <label class="lbl report410-wide"><span>의사 소견 / 치료 예상기간</span><textarea id="doctorOpinion410" rows="2" placeholder="예: 봉합술 시행, 약 3주간 안정가료 필요"></textarea></label>
      <label class="lbl"><span>진료비(현재 확인금액)</span><input id="medicalCost410" type="number" min="0" inputmode="numeric" placeholder="예: 631070"></label>
      <label class="lbl"><span>치료 / 휴업 예상</span><select id="leaveEstimate"><option value="unknown">미확인</option><option value="none">휴업 없음</option><option value="under3">3일 미만 예상</option><option value="3plus">3일 이상 예상</option><option value="longterm">장기치료 / 중상 가능</option></select></label>
      <label class="lbl report410-wide"><span>진료비 상세내역</span><textarea id="medicalCostDetail410" rows="2" placeholder="예: 8/17 외래 519,790원 / 8/18 외래 111,280원"></textarea></label>
    </div></section>`;
  }

  function propertyDamageSection(){
    return `<section class="report410-section report410-damage property"><div class="report410-section-head"><b>4. 대물 피해 상황 및 복구 견적</b><small>견적이 아직 없으면 피해내용만 먼저 입력하세요.</small></div><div class="report410-grid">
      <label class="lbl"><span>작업자 성명</span><input id="propertyWorker410" placeholder="예: 홍길동"></label>
      <label class="lbl"><span>직종 / 업무</span><input id="job" placeholder="예: 코스관리"></label>
      <label class="lbl report410-wide"><span>파손된 물품 / 시설 *</span><input id="damagedItem410" required placeholder="예: 홀맵지주 간판"></label>
      <label class="lbl report410-wide"><span>어떻게 파손되었나요? *</span><textarea id="damageDetail410" rows="3" required placeholder="예: 홀맵지주 하단부가 찌그러지고 작업차량에 경미한 흠집 발생"></textarea></label>
      <label class="lbl"><span>복구 예상 비용</span><input id="repairCost410" type="number" min="0" inputmode="numeric" placeholder="예: 1950000"></label>
      <label class="lbl report410-wide"><span>견적 / 비용 상세내역</span><textarea id="repairCostDetail410" rows="3" placeholder="예: 지주프레임 1,624,000원 / 운반비 180,000원 / 조립비 150,000원"></textarea></label>
    </div></section>`;
  }

  function closingSection(type){
    return `<section class="report410-section"><div class="report410-section-head"><b>5. 재발 방지 대책</b><small>현장에서 실시하거나 실시할 구체적인 조치를 적어주세요.</small></div>
      <label class="lbl"><span>재발 방지 대책 *</span><textarea id="preventionPlan410" rows="3" required placeholder="${type==='person'?'예: 절단방지용 보호장갑 착용 및 낫 작업 안전수칙 교육 실시':'예: 작업차량 이동 전 주변 확인 의무화 및 사각지대 사고예방 교육 실시'}"></textarea></label>
      <label class="lbl"><span>특이사항</span><textarea id="specialNote410" rows="2" placeholder="${type==='person'?'예: 추가검사 예정, 산재처리 검토 등':'예: 보험처리 또는 추가 견적 예정 등'}"></textarea></label>
      <div class="report410-grid report410-risk-grid"><label class="lbl"><span>${type==='person'?'부상 정도':'피해 정도'}</span><select id="severity"><option value="minor">경미</option><option value="moderate">보통</option><option value="major">중대</option></select></label>
      <label class="report410-check"><input id="potentialMajor" type="checkbox"><span>현재 피해가 작아도 큰 사고로 이어질 가능성이 있었음</span></label></div>
    </section>`;
  }

  function renderTypeForm(root,u,type){
    if(!root)return;
    if(!['person','property'].includes(type))return renderTypePicker(root,u);
    activeType=type;
    const person=type==='person';
    const title=person?'대인사고 경위서':'대물사고 경위서';
    const desc=person?'부상·진단·진료비 등 인적 피해 중심으로 작성합니다.':'파손내용·복구비용·견적 등 물적 피해 중심으로 작성합니다.';
    root.innerHTML=`${topBack(u)}<form id="unifiedReportForm" class="panel report-simple incident410-form" data-report-type="${type}">
      <div class="section-head"><div><div class="ey">${person?'PERSON INCIDENT':'PROPERTY INCIDENT'}</div><h2>${title}</h2><p>${desc}</p></div><button type="button" class="secondary report410-change" data-change-type>← 사고 종류 변경</button></div>
      <section class="report410-section"><div class="report410-section-head"><b>1. 사고 개요</b><small>언제, 어디서 발생했는지 입력합니다.</small></div>${commonTop(u)}</section>
      ${circumstanceSection(type)}${causeSection()}${person?personDamageSection():propertyDamageSection()}${closingSection(type)}
      <section class="report410-section report410-photo"><div class="report410-section-head"><b>6. 현장사진 *</b><small>사고장소와 피해상태가 확인되도록 1장 이상 등록해 주세요.</small></div>${photoPickerHtml('incident')}</section>
      <button class="primary full report410-submit" type="submit">${title} 제출하기</button>
    </form>`;
    incidentPhotos=[];
    renderPhotoThumbs('incident');
    bindPhotoButtons();
    root.querySelector('[data-report-home]')?.addEventListener('click',()=>backHome(u));
    root.querySelector('[data-change-type]')?.addEventListener('click',()=>renderTypePicker(root,u));
    root.querySelector('#unifiedReportForm')?.addEventListener('submit',e=>submitIncident410(e,u,type));
  }

  function required(id,label){
    const el=document.getElementById(id);
    if(el&&String(el.value||'').trim())return true;
    el?.focus();el?.scrollIntoView({behavior:'smooth',block:'center'});alert(`${label}을(를) 입력해 주세요.`);return false;
  }

  function formatOccurred(date,time){
    if(!date)return '';
    const p=date.split('-');
    return p.length===3?`${Number(p[0])}년 ${Number(p[1])}월 ${Number(p[2])}일 ${time||''}경`.trim():`${date} ${time}`.trim();
  }

  function buildSummary(type,siteId){
    const when=formatOccurred(value('occurredDate410'),value('occurredTime410'));
    const site=currentSiteName(siteId),place=value('incidentPlace410'),work=value('workAction410'),how=value('incidentHow410');
    const env=value('environmentCause410'),behavior=value('behaviorCause410'),prevention=value('preventionPlan410'),special=value('specialNote410');
    const cause=[env&&`환경적 요인: ${env}`,behavior&&`행동적 요인: ${behavior}`].filter(Boolean).join(' / ');
    let damage='';
    if(type==='person'){
      const cost=money(value('medicalCost410'));
      damage=[`${value('injuredName')||'피해 직원'}: ${value('injuryDetail410')}`,value('diagnosis410')&&`진단명: ${value('diagnosis410')}`,value('doctorOpinion410')&&`의사 소견: ${value('doctorOpinion410')}`,cost&&`진료비: ${moneyText(cost)}`,value('medicalCostDetail410')&&`진료비 내역: ${value('medicalCostDetail410')}`].filter(Boolean).join(' / ');
    }else{
      const cost=money(value('repairCost410'));
      damage=[value('propertyWorker410')&&`작업자: ${value('propertyWorker410')}`,`${value('damagedItem410')}: ${value('damageDetail410')}`,cost&&`복구 예상비용: ${moneyText(cost)}`,value('repairCostDetail410')&&`견적 내역: ${value('repairCostDetail410')}`].filter(Boolean).join(' / ');
    }
    return [`[사고 개요] ${when} ${site} ${place}`,`[사고 경위] ${work} 중 ${how}`,cause&&`[사고 원인] ${cause}`,`[피해 상황] ${damage}`,`[재발 방지 대책] ${prevention}`,special&&`[특이사항] ${special}`].filter(Boolean).join('  ');
  }

  async function submitIncident410(e,u,type){
    e.preventDefault();
    if(!canCreate(u))return alert('사고보고 등록 권한이 없습니다.');
    for(const [id,label] of [['reportSite','사업장'],['occurredDate410','발생 날짜'],['occurredTime410','발생 시간'],['incidentPlace410','사고 장소'],['workAction410','사고 직전 작업'],['incidentHow410','사고 발생 과정'],['immediateAction','사고 직후 조치'],['preventionPlan410','재발 방지 대책']])if(!required(id,label))return;
    if(type==='person'){if(!required('injuredName','피해 직원 성명')||!required('injuryDetail410','부상 내용'))return}
    else if(!required('damagedItem410','파손된 물품 또는 시설')||!required('damageDetail410','파손 내용'))return;
    if(!Array.isArray(incidentPhotos)||incidentPhotos.length<1){document.querySelector('.report410-photo')?.scrollIntoView({behavior:'smooth',block:'center'});return alert('현장사진은 필수입니다. 사진을 1장 이상 등록해 주세요.')}

    const siteId=value('reportSite'),date=value('occurredDate410'),time=value('occurredTime410');
    const severity=value('severity')||'minor',leaveEstimate=type==='person'?(value('leaveEstimate')||'unknown'):'none';
    const potentialMajor=!!document.getElementById('potentialMajor')?.checked;
    const summary=buildSummary(type,siteId);
    const details={templateVersion:'v410',reportType:type,place:value('incidentPlace410'),workAction:value('workAction410'),incidentHow:value('incidentHow410'),environmentCause:value('environmentCause410'),behaviorCause:value('behaviorCause410'),preventionPlan:value('preventionPlan410'),specialNote:value('specialNote410'),generatedSummary:summary,recordedAt:nowISO()};
    if(type==='person')Object.assign(details,{injuredName:value('injuredName'),job:value('job'),injuryDetail:value('injuryDetail410'),diagnosis:value('diagnosis410'),doctorOpinion:value('doctorOpinion410'),medicalCost:money(value('medicalCost410')),medicalCostDetail:value('medicalCostDetail410')});
    else Object.assign(details,{workerName:value('propertyWorker410'),job:value('job'),damagedItem:value('damagedItem410'),damageDetail:value('damageDetail410'),repairCost:money(value('repairCost410')),repairCostDetail:value('repairCostDetail410')});

    const incident={id:uid('inc'),siteId,category:type,eventType:value('eventType'),severity,leaveEstimate,potentialMajor,injuredName:type==='person'?value('injuredName'):'',job:value('job'),summary,immediateAction:value('immediateAction'),photos:[...incidentPhotos],reporterName:u.name,reporterId:u.personnelId||u.id||'',occurredAt:new Date(`${date}T${time}`).toISOString(),createdAt:nowISO(),updatedAt:nowISO(),status:'reported',priority:computePriority(type,severity,value('eventType'),potentialMajor,leaveEstimate),legalReview:computeLegalReview(type,severity,leaveEstimate),safetyNote:'',approvedBy:'',approvedAt:null,closedAt:null,corrective:null,reportDetails:details};
    data.incidents.unshift(incident);saveData();incidentPhotos=[];activeType=null;
    alert(`${type==='person'?'대인사고':'대물사고'} 경위서가 접수되었습니다.`);
    currentView='incidents';renderShell(u);
  }

  function renderReport(root,u){
    if(!root)return;
    if(!canCreate(u)){root.innerHTML='<div class="panel permission-empty"><div class="lock-icon">🔒</div><h2>사고보고 등록 권한이 없습니다.</h2><p>승인 사고 조회 권한만 있는 계정입니다.</p></div>';return}
    if(activeType)return renderTypeForm(root,u,activeType);
    return renderTypePicker(root,u);
  }

  renderUnifiedReport=renderReport;
  submitUnifiedIncident=submitIncident410;

  if(typeof renderCurrentView==='function'){
    const baseRenderCurrentView=renderCurrentView;
    renderCurrentView=function(u){
      const root=document.getElementById('view');
      if(currentView==='report')return renderReport(root,u);
      activeType=null;
      return baseRenderCurrentView(u);
    };
  }

  if(typeof categoryName==='function'){
    const baseCategoryName=categoryName;
    categoryName=function(v){return v==='person'?'대인사고':baseCategoryName(v)};
  }

  window.enlResetIncidentReport=()=>{activeType=null};
  window.enlShowIncidentTypePicker=(u=currentUser?.())=>{
    activeType=null;
    try{enlPlatformSection='incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}
    currentView='report';
    const root=document.getElementById('view');
    if(root)return renderTypePicker(root,u);
  };
  window.enlOpenIncidentReport=(type,u=currentUser?.())=>{
    const root=document.getElementById('view');
    if(!root)return;
    activeType=type;
    return renderTypeForm(root,u,type);
  };
  window.ENL_REPORT_VERSION=VERSION;
})();