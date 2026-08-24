/* E&L Safety v3.7.0 - guided 6W1H accident report for field managers */
(function(){
  function setupOccurredSplit(){
    const hidden=document.getElementById('occurredAt');
    if(!hidden||hidden.dataset.splitReady==='1')return;
    const label=hidden.closest('.lbl');
    if(!label)return;

    const raw=hidden.value||localDT();
    const dateValue=raw.slice(0,10);
    const timeValue=(raw.slice(11,16)||'00:00');

    hidden.dataset.splitReady='1';
    hidden.type='hidden';
    hidden.required=false;
    label.classList.add('occurred-field');

    const wrap=document.createElement('div');
    wrap.className='occurred-split';
    wrap.innerHTML=`<input id="occurredDate" type="date" value="${esc(dateValue)}" required aria-label="발생 날짜"><input id="occurredTime" type="time" value="${esc(timeValue)}" required aria-label="발생 시간">`;
    hidden.insertAdjacentElement('afterend',wrap);

    const date=wrap.querySelector('#occurredDate');
    const time=wrap.querySelector('#occurredTime');
    const sync=()=>{if(date.value&&time.value)hidden.value=`${date.value}T${time.value}`};
    ['change','input'].forEach(ev=>{date.addEventListener(ev,sync);time.addEventListener(ev,sync)});
    sync();
  }

  function finalizeReportRequirements(root){
    if(!root)return;
    const form=root.querySelector('#unifiedReportForm');
    if(!form)return;

    setupOccurredSplit();

    const category=document.getElementById('category')?.value||'';
    const isHazard=category==='hazard';
    const details=form.querySelector('.advanced-box');

    if(details){
      if(isHazard){
        details.classList.add('hide');
      }else{
        const grid=details.querySelector('.advanced-grid');
        const check=details.querySelector('.check-line');
        if(grid)details.insertAdjacentElement('beforebegin',grid);
        if(check)details.insertAdjacentElement('beforebegin',check);
        details.remove();
      }
    }

    const photoBox=form.querySelector('.photo-box');
    if(photoBox){
      photoBox.classList.add('photo-required');
      const title=photoBox.querySelector('.photo-head b');
      if(title&&!title.textContent.includes('*'))title.textContent='현장사진 *';
      let guide=photoBox.querySelector('.photo-required-guide');
      if(!guide){
        guide=document.createElement('div');
        guide.className='photo-required-guide';
        const actions=photoBox.querySelector('.photo-actions');
        if(actions)actions.insertAdjacentElement('beforebegin',guide);else photoBox.appendChild(guide);
      }
      guide.textContent=isHazard
        ? '필수 입력 · 위험장소와 위험상태를 확인할 수 있는 사진을 1장 이상 등록해 주세요.'
        : '필수 입력 · 사고장소와 사고상황을 확인할 수 있는 사진을 1장 이상 등록해 주세요.';
    }
  }

  function setLabelText(el,text){
    const label=el?.closest('.lbl');
    const span=label?.querySelector(':scope > span');
    if(span)span.textContent=text;
  }

  function addGuideField(id,label,placeholder,rows=0){
    const wrap=document.createElement('label');
    wrap.className='guide-question';
    const input=rows
      ? `<textarea id="${id}" rows="${rows}" required placeholder="${placeholder}"></textarea>`
      : `<input id="${id}" required placeholder="${placeholder}">`;
    wrap.innerHTML=`<span>${label}</span>${input}`;
    return wrap;
  }

  function addQuickActionButtons(textarea){
    if(!textarea||textarea.dataset.quickReady==='1')return;
    textarea.dataset.quickReady='1';
    const quick=document.createElement('div');
    quick.className='quick-actions';
    quick.innerHTML=[
      '응급처치 실시','작업 중지','병원 이동','119 신고','현장 통제','특이조치 없음'
    ].map(v=>`<button type="button" data-quick-action="${v}">${v}</button>`).join('');
    textarea.insertAdjacentElement('beforebegin',quick);
    quick.querySelectorAll('[data-quick-action]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const phrase=btn.dataset.quickAction;
        const current=textarea.value.trim();
        if(!current.includes(phrase)){
          textarea.value=current?`${current}, ${phrase}`:phrase;
          textarea.dispatchEvent(new Event('input',{bubbles:true}));
        }
      });
    });
  }

  function enhanceEventTypeButtons(select){
    if(!select||select.dataset.buttonReady==='1')return;
    select.dataset.buttonReady='1';
    const grid=document.createElement('div');
    grid.className='event-type-buttons';
    const render=()=>{
      grid.innerHTML=[...select.options].map(o=>`<button type="button" data-event-value="${esc(o.value)}" class="${o.value===select.value?'on':''}">${esc(o.textContent)}</button>`).join('');
      grid.querySelectorAll('[data-event-value]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          select.value=btn.dataset.eventValue;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          render();
        });
      });
    };
    select.classList.add('sr-select');
    select.insertAdjacentElement('afterend',grid);
    select.addEventListener('change',render);
    render();
  }

  function formatOccurred(){
    const d=document.getElementById('occurredDate')?.value||document.getElementById('occurredAt')?.value?.slice(0,10)||'';
    const t=document.getElementById('occurredTime')?.value||document.getElementById('occurredAt')?.value?.slice(11,16)||'';
    if(!d)return '';
    const parts=d.split('-');
    const dateText=parts.length===3?`${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`:d;
    return t?`${dateText} ${t}경`:dateText;
  }

  function currentSiteName(){
    const id=document.getElementById('reportSite')?.value||'';
    return siteById(id)?.name||document.getElementById('reportSite')?.closest('label')?.querySelector('input[disabled]')?.value||'사업장';
  }

  function cleanEnd(text){
    return (text||'').trim().replace(/[.!?。]+$/,'');
  }

  function buildObjectiveSummary(){
    const category=document.getElementById('category')?.value||'person';
    const when=formatOccurred();
    const site=currentSiteName();
    const place=cleanEnd(document.getElementById('incidentPlace')?.value);
    const work=cleanEnd(document.getElementById('workAction')?.value);
    const how=cleanEnd(document.getElementById('incidentHow')?.value);
    const result=cleanEnd(document.getElementById('incidentResult')?.value);
    const injured=cleanEnd(document.getElementById('injuredName')?.value);

    const where=[site,place].filter(Boolean).join(' ');
    const intro=[when,where?`${where}에서`:'' ].filter(Boolean).join(' ');
    let body='';

    if(category==='person'){
      const actor=injured?`${injured} 근로자가`:'근로자가';
      body=`${actor} ${work||'작업'} 중 ${how||'사고가 발생함'}`;
      if(result)body+=`, 그 결과 ${result}`;
    }else if(category==='property'){
      body=`${work||'작업'} 중 ${how||'대물사고가 발생함'}`;
      if(result)body+=`, 그 결과 ${result}`;
    }else{
      body=`${work||'작업'} 중 ${how||'아차사고 상황이 발생함'}`;
      if(result)body+=`. 피해는 발생하지 않았으며 ${result}`;
    }
    return `${intro} ${body}.`.replace(/\s+/g,' ').trim();
  }

  function updatePreview(){
    const summary=document.getElementById('summary');
    if(!summary)return;
    summary.value=buildObjectiveSummary();
  }

  function refreshCategoryGuide(){
    const category=document.getElementById('category')?.value||'person';
    const resultLabel=document.querySelector('#incidentResult')?.closest('.guide-question')?.querySelector('span');
    const result=document.getElementById('incidentResult');
    const personFields=document.getElementById('personFields');

    if(category==='person'){
      if(resultLabel)resultLabel.textContent='6. 어디를 어떻게 다쳤나요? *';
      if(result)result.placeholder='예: 넘어지면서 오른손으로 바닥을 짚어 오른쪽 손목에 통증이 생김';
      if(personFields)personFields.classList.remove('hide');
    }else if(category==='property'){
      if(resultLabel)resultLabel.textContent='6. 무엇이 어떻게 파손되었나요? *';
      if(result)result.placeholder='예: 카트 우측 범퍼가 파손됨';
      if(personFields)personFields.classList.add('hide');
    }else{
      if(resultLabel)resultLabel.textContent='6. 어떤 피해가 날 뻔했나요? *';
      if(result)result.placeholder='예: 작업자가 즉시 멈춰 인명피해는 발생하지 않음';
      if(personFields)personFields.classList.add('hide');
    }
    updatePreview();
  }

  function enhanceFieldAccidentGuide(root,u){
    if(!root||u?.role!=='field')return;
    const form=root.querySelector('#unifiedReportForm');
    const category=document.getElementById('category');
    if(!form||!category||category.value==='hazard'||form.dataset.guidedReady==='1')return;
    form.dataset.guidedReady='1';
    form.classList.add('guided-accident-form');

    const head=form.querySelector('.section-head');
    const headTitle=head?.querySelector('h2');
    const headText=head?.querySelector('p');
    if(headTitle)headTitle.textContent='사고 보고';
    if(headText)headText.textContent='아래 질문에 순서대로 답하면 사고경위가 자동으로 작성됩니다.';

    const callout=document.createElement('div');
    callout.className='fact-only-callout';
    callout.innerHTML='<b>사실만 적어주세요</b><span>“부주의”, “안전수칙 미준수”처럼 원인을 추측하지 말고, 직접 보거나 확인한 상황만 입력해 주세요. 사고 원인은 안전관리자가 확인합니다.</span>';
    head?.insertAdjacentElement('afterend',callout);

    const topGrid=form.querySelector('.formgrid');
    if(topGrid)topGrid.classList.add('guided-top-grid');

    const reportSite=document.getElementById('reportSite');
    const occurred=document.getElementById('occurredAt');
    const eventType=document.getElementById('eventType');
    setLabelText(reportSite,'1. 어느 현장인가요?');
    setLabelText(occurred,'2. 언제 사고가 났나요?');
    setLabelText(category,'3. 어떤 사고인가요?');
    setLabelText(eventType,'4. 어떻게 발생했나요?');

    enhanceEventTypeButtons(eventType);

    const summary=document.getElementById('summary');
    const immediate=document.getElementById('immediateAction');
    const personFields=document.getElementById('personFields');

    const guide=document.createElement('section');
    guide.className='guide-section';
    const place=addGuideField('incidentPlace','5-1. 정확히 어디에서 났나요? *','예: 3번홀 그린 옆 경사로');
    const work=addGuideField('workAction','5-2. 사고 직전에 무엇을 하고 있었나요? *','예: 예초기를 들고 다음 작업장으로 이동하고 있었음');
    const how=addGuideField('incidentHow','5-3. 어떤 일이 있었나요? *','예: 젖은 잔디에서 오른발이 미끄러져 넘어짐',3);
    guide.append(place,work,how);
    summary?.closest('.lbl')?.insertAdjacentElement('beforebegin',guide);

    if(personFields){
      personFields.classList.add('guided-person');
      const injured=document.getElementById('injuredName');
      const job=document.getElementById('job');
      setLabelText(injured,'다친 사람 이름');
      setLabelText(job,'직종/업무');
      if(injured)injured.placeholder='예: 홍길동';
      if(job)job.placeholder='예: 코스관리';
      guide.insertAdjacentElement('afterend',personFields);
    }

    const resultWrap=addGuideField('incidentResult','6. 어디를 어떻게 다쳤나요? *','예: 넘어지면서 오른손으로 바닥을 짚어 오른쪽 손목에 통증이 생김',3);
    personFields?.insertAdjacentElement('afterend',resultWrap);

    if(summary){
      summary.readOnly=true;
      summary.rows=5;
      setLabelText(summary,'자동 작성된 사고경위');
      summary.placeholder='위 질문에 입력하면 사고경위가 자동으로 작성됩니다.';
      summary.closest('.lbl')?.classList.add('auto-summary-box');
      const note=document.createElement('small');
      note.className='summary-note';
      note.textContent='위 입력내용을 수정하면 이 문장도 자동으로 바뀝니다. 사실관계가 맞는지 확인해 주세요.';
      summary.insertAdjacentElement('afterend',note);
    }

    if(immediate){
      setLabelText(immediate,'7. 사고 후 어떻게 조치했나요? *');
      immediate.placeholder='예: 작업을 중지하고 응급처치 후 병원으로 이동함';
      addQuickActionButtons(immediate);
      immediate.closest('.lbl')?.classList.add('immediate-box');
    }

    const severity=document.getElementById('severity');
    const leave=document.getElementById('leaveEstimate');
    const potential=document.getElementById('potentialMajor');
    setLabelText(severity,'다친 정도');
    setLabelText(leave,'치료/휴업 예상');
    if(potential){
      const line=potential.closest('.check-line');
      if(line){
        line.childNodes.forEach(n=>{if(n.nodeType===3&&n.textContent.trim())n.textContent=' 큰 사고로 이어질 가능성이 있었음';});
      }
    }

    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.textContent='내용 확인 후 사고 보고 보내기';

    ['incidentPlace','workAction','incidentHow','incidentResult','injuredName','job'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input',updatePreview);
    });
    ['occurredDate','occurredTime','reportSite','eventType'].forEach(id=>{
      const el=document.getElementById(id);
      el?.addEventListener('change',updatePreview);
      el?.addEventListener('input',updatePreview);
    });
    category.addEventListener('change',refreshCategoryGuide);

    refreshCategoryGuide();
    updatePreview();
  }

  function collectGuidedDetails(){
    const get=id=>document.getElementById(id)?.value?.trim()||'';
    return {
      method:'guided-6w1h',
      place:get('incidentPlace'),
      workAction:get('workAction'),
      incidentHow:get('incidentHow'),
      result:get('incidentResult'),
      generatedSummary:get('summary')
    };
  }

  if(typeof renderUnifiedReport==='function'){
    const baseRenderUnifiedReport=renderUnifiedReport;
    renderUnifiedReport=function(root,u){
      baseRenderUnifiedReport(root,u);
      finalizeReportRequirements(root);
      enhanceFieldAccidentGuide(root,u);
      setTimeout(()=>{
        finalizeReportRequirements(root);
        enhanceFieldAccidentGuide(root,u);
      },0);
    };
  }

  if(typeof submitUnifiedIncident==='function'){
    const baseSubmitUnifiedIncident=submitUnifiedIncident;
    submitUnifiedIncident=async function(e,u){
      const date=document.getElementById('occurredDate');
      const time=document.getElementById('occurredTime');
      const hidden=document.getElementById('occurredAt');
      if(date&&time&&hidden&&date.value&&time.value)hidden.value=`${date.value}T${time.value}`;

      const category=document.getElementById('category')?.value||'';
      const guided=category!=='hazard'&&u?.role==='field';
      let guidedDetails=null;
      if(guided){
        updatePreview();
        guidedDetails=collectGuidedDetails();
        const required=[
          ['incidentPlace','정확한 사고 장소'],
          ['workAction','사고 직전 작업'],
          ['incidentHow','사고가 발생한 과정'],
          ['incidentResult',category==='person'?'부상 내용':category==='property'?'파손 내용':'피해가 날 뻔한 상황']
        ];
        for(const [id,label] of required){
          const el=document.getElementById(id);
          if(!el?.value.trim()){
            e.preventDefault();
            el?.focus();
            el?.scrollIntoView({behavior:'smooth',block:'center'});
            alert(`${label}을(를) 입력해 주세요.`);
            return;
          }
        }
      }

      if(!Array.isArray(incidentPhotos)||incidentPhotos.length<1){
        e.preventDefault();
        const box=document.querySelector('#unifiedReportForm .photo-box');
        if(box){
          box.classList.add('photo-required-error');
          box.scrollIntoView({behavior:'smooth',block:'center'});
          setTimeout(()=>box.classList.remove('photo-required-error'),1800);
        }
        alert('현장사진은 필수입니다. 사진을 1장 이상 등록해 주세요.');
        return;
      }

      const beforeIds=new Set((data.incidents||[]).map(i=>i.id));
      await baseSubmitUnifiedIncident(e,u);

      if(guided&&guidedDetails){
        const created=(data.incidents||[]).find(i=>!beforeIds.has(i.id));
        if(created){
          created.reportDetails=guidedDetails;
          created.reportDetails.recordedAt=nowISO();
          saveData();
        }
      }
    };
  }
})();
