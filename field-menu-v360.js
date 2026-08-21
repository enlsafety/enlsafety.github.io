/* E&L Safety v3.6.0 - six field workflows */
(function(){
  const INQUIRY_KEY='enl_safety_field_inquiries_v1';
  let enlFieldTask='home';
  function isField(u){return !!u&&u.role==='field'}
  function fieldTitle(u){return u?.position||'현장담당자'}
  function loadInquiries(){try{const v=JSON.parse(localStorage.getItem(INQUIRY_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
  function saveInquiries(v){try{localStorage.setItem(INQUIRY_KEY,JSON.stringify(v));return true}catch(e){alert('문의 저장에 실패했습니다.');return false}}
  function fieldHome(u){
    enlFieldTask='home';currentView='home';
    try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
    renderShell(u||currentUser());
  }
  function goTask(task,u){
    enlFieldTask=task;
    if(task==='inquiry'){currentView='field-inquiry';try{enlPlatformSection='hub'}catch(e){}return renderShell(u)}
    try{enlPlatformSection='incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'incident')}catch(e){}
    currentView=(task==='accident_report'||task==='hazard_report')?'report':(task==='accident_action'||task==='hazard_improve')?'actions':'incidents';
    renderShell(u);
  }
  function renderSixHome(root,u){
    const site=siteById(u.siteId)?.name||'소속 사업장';
    root.innerHTML=`<section class="field-six-home">
      <div class="field-six-head"><h2>${esc(site)}</h2><p>필요한 메뉴를 선택해 주세요.</p><span class="field-six-role">${esc(fieldTitle(u))} · ${esc(u.name)}</span></div>
      <div class="field-six-grid">
        <button class="field-six-btn" data-field-task="accident_report"><span class="field-six-no">01</span><strong>사고 보고</strong><small>인사사고, 대물사고, 아차사고 알려주세요</small></button>
        <button class="field-six-btn" data-field-task="accident_action"><span class="field-six-no">02</span><strong>사고 대책조치</strong><small>사고 발생 후 어떻게 조치 했는지 알려주세요</small></button>
        <button class="field-six-btn" data-field-task="hazard_report"><span class="field-six-no">03</span><strong>위험요인 보고</strong><small>다칠만한 위험이 있는 곳 알려주세요</small></button>
        <button class="field-six-btn" data-field-task="hazard_improve"><span class="field-six-no">04</span><strong>위험요인 개선</strong><small>다치지 않게 조치 한 것을 알려주세요</small></button>
        <button class="field-six-btn" data-field-task="records"><span class="field-six-no">05</span><strong>우리 현장 기록</strong><small>우리현장의 사고기록을 한눈에 볼 수 있어요</small></button>
        <button class="field-six-btn" data-field-task="inquiry"><span class="field-six-no">06</span><strong>기타 문의</strong><small>앱 사용법이나 기타 안전 관련 사항을 문의할 수 있어요</small></button>
      </div>
    </section>`;
    root.querySelectorAll('[data-field-task]').forEach(b=>b.onclick=()=>goTask(b.dataset.fieldTask,u));
  }
  function addBack(root,u,label='현장 홈으로'){
    if(!root||root.querySelector('.field-task-back'))return;
    const bar=document.createElement('div');bar.className='field-task-back';bar.innerHTML=`<button type="button">← ${label}</button><span>${esc(siteById(u.siteId)?.name||'소속 사업장')}</span>`;
    root.insertAdjacentElement('afterbegin',bar);bar.querySelector('button').onclick=()=>fieldHome(u);
  }
  function renderInquiry(root,u){
    const all=loadInquiries();const mine=all.filter(x=>x.userId===u.id||(!x.userId&&x.userName===u.name)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    root.innerHTML=`<div class="field-task-back"><button type="button" id="inqBack">← 현장 홈으로</button><span>${esc(siteById(u.siteId)?.name||'소속 사업장')}</span></div>
      <form id="fieldInquiryForm" class="panel report-simple"><div class="section-head"><div><div class="ey">QUESTION</div><h2>기타 문의</h2><p>앱 사용법이나 안전 관련 궁금한 내용을 간단히 남겨주세요.</p></div></div>
      <div class="formgrid"><label class="lbl"><span>문의 구분 *</span><select id="inqType"><option>앱 사용법</option><option>안전 관련 문의</option><option>기타</option></select></label><label class="lbl"><span>제목 *</span><input id="inqTitle" required placeholder="문의 제목"></label></div>
      <label class="lbl"><span>문의 내용 *</span><textarea id="inqBody" rows="5" required placeholder="궁금한 내용을 적어주세요"></textarea></label><button class="primary full" type="submit">문의 보내기</button></form>
      <section class="panel" style="margin-top:12px"><div class="section-head"><div><div class="ey">MY QUESTIONS</div><h2>내 문의 기록</h2><p>이 기기에서 등록한 문의를 확인합니다.</p></div></div><div class="field-inquiry-list">${mine.map(q=>`<div class="field-inquiry-card"><b>${esc(q.title)}</b><span>${esc(q.type)} · ${q.status==='answered'?'답변완료':'접수'}</span><p>${esc(q.body)}</p>${q.answer?`<div class="field-inquiry-answer"><b>본사 답변</b>${esc(q.answer)}</div>`:''}<small>${fmt(q.createdAt)}</small></div>`).join('')||'<div class="empty compact">등록한 문의가 없습니다.</div>'}</div></section>`;
    document.getElementById('inqBack').onclick=()=>fieldHome(u);
    document.getElementById('fieldInquiryForm').onsubmit=e=>{e.preventDefault();const v=loadInquiries();v.unshift({id:uid('inq'),siteId:u.siteId,userId:u.id,userName:u.name,position:fieldTitle(u),type:document.getElementById('inqType').value,title:document.getElementById('inqTitle').value.trim(),body:document.getElementById('inqBody').value.trim(),status:'open',answer:'',createdAt:nowISO(),updatedAt:nowISO()});if(saveInquiries(v)){alert('문의가 등록되었습니다.');renderInquiry(root,u)}};
  }

  try{const baseCategoryName=categoryName;categoryName=function(v){return v==='person'?'인사사고':baseCategoryName(v)}}catch(e){}

  if(typeof renderUnifiedReport==='function'){
    const baseReport=renderUnifiedReport;
    renderUnifiedReport=function(root,u){
      baseReport(root,u);if(!isField(u))return;
      const accident=enlFieldTask==='accident_report',hazard=enlFieldTask==='hazard_report';if(!accident&&!hazard)return addBack(root,u);
      const h=root.querySelector('.section-head h2'),p=root.querySelector('.section-head p'),cat=document.getElementById('category'),submit=root.querySelector('button[type="submit"]');
      if(accident){if(h)h.textContent='사고 보고';if(p)p.textContent='인사사고, 대물사고, 아차사고를 간단히 알려주세요.';if(cat){cat.innerHTML='<option value="person">인사사고</option><option value="property">대물사고</option><option value="near_miss">아차사고</option>';cat.value='person';cat.onchange?.()}if(submit)submit.textContent='사고 보고 보내기'}
      if(hazard){if(h)h.textContent='위험요인 보고';if(p)p.textContent='다칠 가능성이 있는 장소나 상태를 사진과 함께 알려주세요.';if(cat){cat.innerHTML='<option value="hazard">위험요인</option>';cat.value='hazard';cat.closest('label')?.classList.add('hide');cat.onchange?.()}const sum=document.getElementById('summary');if(sum)sum.placeholder='어디에 어떤 위험이 있는지 간단히 입력';const ia=document.getElementById('immediateAction');if(ia){ia.value='미조치';ia.required=false;ia.closest('label')?.classList.add('hide')}const person=document.getElementById('personFields');if(person)person.classList.add('hide');if(submit)submit.textContent='위험요인 보내기'}
      addBack(root,u);
    };
  }

  if(typeof submitUnifiedIncident==='function'){
    const baseSubmit=submitUnifiedIncident;
    submitUnifiedIncident=async function(e,u){const wasField=isField(u);await baseSubmit(e,u);if(wasField){enlFieldTask='records';currentView='incidents';try{enlPlatformSection='incident'}catch(err){}renderShell(u)}};
  }

  if(typeof renderUnifiedActions==='function'){
    const baseActions=renderUnifiedActions;
    renderUnifiedActions=function(root,u){
      if(!isField(u)||!['accident_action','hazard_improve'].includes(enlFieldTask)){baseActions(root,u);if(isField(u))addBack(root,u);return}
      const original=actionAccessibleIncidents;
      actionAccessibleIncidents=function(x){const arr=original(x);return enlFieldTask==='hazard_improve'?arr.filter(i=>i.category==='hazard'):arr.filter(i=>['person','property','near_miss'].includes(i.category))};
      try{baseActions(root,u)}finally{actionAccessibleIncidents=original}
      const h=root.querySelector('.section-head h2'),p=root.querySelector('.section-head p');
      if(enlFieldTask==='hazard_improve'){if(h)h.textContent='위험요인 개선';if(p)p.textContent='보고했던 위험요인을 다치지 않도록 어떻게 개선했는지 등록해 주세요.';root.querySelectorAll('[data-unified-action]').forEach(b=>{if(b.textContent.includes('후속조치'))b.textContent=b.textContent.replaceAll('후속조치','개선조치')})}
      else{if(h)h.textContent='사고 대책조치';if(p)p.textContent='발생한 사고를 선택하고 원인과 재발방지 조치 내용을 등록해 주세요.'}
      addBack(root,u);
    };
  }

  if(typeof renderUnifiedIncidents==='function'){
    const baseIncidents=renderUnifiedIncidents;
    renderUnifiedIncidents=function(root,u){baseIncidents(root,u);if(isField(u)){const h=root.querySelector('.section-head h2'),p=root.querySelector('.section-head p');if(h)h.textContent='우리 현장 기록';if(p)p.textContent='우리 현장의 사고·아차사고·위험요인 기록을 한눈에 확인합니다.';addBack(root,u)}};
  }

  const baseCurrent=renderCurrentView;
  renderCurrentView=function(u){if(isField(u)&&currentView==='field-inquiry')return renderInquiry(document.getElementById('view'),u);return baseCurrent(u)};

  const baseMore=renderMore;
  renderMore=function(root,u){
    baseMore(root,u);if(u.role!=='safety')return;
    const qs=loadInquiries();const open=qs.filter(q=>q.status!=='answered').length;const box=document.createElement('section');box.className='panel hq-inquiry-panel';box.innerHTML=`<div class="section-head"><div><div class="ey">FIELD QUESTIONS</div><h2>현장 기타 문의</h2><p>현장에서 등록한 앱 사용법·안전 관련 문의입니다. 미답변 ${open}건</p></div></div><div>${qs.map(q=>`<div class="hq-inquiry-row"><div class="hq-inquiry-main"><b>${esc(q.title)}</b><span>${esc(siteById(q.siteId)?.name||'-')} · ${esc(q.userName||'-')} · ${esc(q.type||'기타')}</span><small>${esc(q.body)} · ${fmt(q.createdAt)}</small>${q.answer?`<div class="field-inquiry-answer">답변: ${esc(q.answer)}</div>`:''}</div><div class="hq-inquiry-actions"><button class="small-btn" data-inq-answer="${q.id}">${q.status==='answered'?'답변수정':'답변'}</button></div></div>`).join('')||'<div class="empty compact">등록된 문의가 없습니다.</div>'}</div>`;root.appendChild(box);box.querySelectorAll('[data-inq-answer]').forEach(b=>b.onclick=()=>{const all=loadInquiries(),q=all.find(x=>x.id===b.dataset.inqAnswer);if(!q)return;const ans=prompt('현장에 전달할 답변을 입력하세요.',q.answer||'');if(ans===null)return;q.answer=ans.trim();q.status=q.answer?'answered':'open';q.answeredBy=u.name;q.updatedAt=nowISO();saveInquiries(all);renderShell(u)})};

  const baseShell=renderShell;
  renderShell=function(u){
    baseShell(u);const shell=document.querySelector('.app-shell');if(shell)shell.classList.toggle('field-simple-mode',isField(u));
    if(isField(u)){
      const chip=document.querySelector('.user-chip small');if(chip)chip.textContent=`${fieldTitle(u)} · ${siteById(u.siteId)?.name||'소속 사업장'}`;
      const root=document.getElementById('view');if(enlFieldTask==='home')renderSixHome(root,u);
      const brand=document.querySelector('.topbar .brand');if(brand){brand.style.cursor='pointer';brand.onclick=()=>fieldHome(u)}
    }
  };

  const baseLogin=doLogin;
  doLogin=async function(e){enlFieldTask='home';await baseLogin(e);const u=currentUser();if(isField(u))fieldHome(u)};

  try{const u=currentUser();if(isField(u)){enlFieldTask='home';fieldHome(u)}}catch(e){console.warn('six field menu init skipped',e)}
})();