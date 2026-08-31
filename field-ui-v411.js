/* E&L Accident Report App v4.1.1 - authoritative field/worker UI */
(function(){
  'use strict';
  const VERSION='4.1.1',INQUIRY_KEY='enl_safety_field_inquiries_v1';
  const isField=u=>!!u&&['field','worker'].includes(u.role);
  const siteName=u=>{try{return siteById?.(u?.siteId)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(u?.siteId))?.name||'소속 사업장'}catch(e){return '소속 사업장'}};
  const title=u=>u?.position||u?.jobTitle||(u?.role==='worker'?'일반근로자':'현장관리');
  const load=()=>{try{const v=JSON.parse(localStorage.getItem(INQUIRY_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
  const save=v=>{try{localStorage.setItem(INQUIRY_KEY,JSON.stringify(v));return true}catch(e){return false}};

  function home(u=currentUser?.()){
    if(!isField(u))return;
    currentView='home';try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
    try{window.enlResetIncidentReport?.()}catch(e){}
    renderShell(u);
  }
  window.enlFieldHome=home;

  function go(task,u){
    if(!isField(u))return;
    try{enlPlatformSection=task==='inquiry'?'hub':'incident';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,enlPlatformSection)}catch(e){}
    if(task==='accident_report'){try{window.enlResetIncidentReport?.()}catch(e){}currentView='report';return renderShell(u)}
    if(task==='accident_action'){currentView='actions';return renderShell(u)}
    if(task==='records'){currentView='incidents';return renderShell(u)}
    if(task==='inquiry'){currentView='field-inquiry';return renderShell(u)}
  }
  window.enlGoFieldTask=go;

  function renderHome(root,u){
    if(!root||!isField(u))return;
    root.innerHTML=`<section class="field-six-home"><div class="field-six-head"><h2>${esc(siteName(u))}</h2><p>필요한 메뉴를 선택해 주세요.</p><span class="field-six-role">${esc(title(u))} · ${esc(u.name||'')}</span></div><div class="field-six-grid"><button class="field-six-btn" data-field-task="accident_report"><span class="field-six-no">01</span><strong>사고 보고</strong><small>대인·대물 사고를 보고</small></button><button class="field-six-btn" data-field-task="accident_action"><span class="field-six-no">02</span><strong>사고 조치</strong><small>사고 후 조치내용 등록</small></button><button class="field-six-btn" data-field-task="records"><span class="field-six-no">03</span><strong>사고 기록</strong><small>우리 현장<br>사고기록 확인</small></button><button class="field-six-btn" data-field-task="inquiry"><span class="field-six-no">04</span><strong>기타 문의</strong><small>안전관리자 문의 및 연락</small></button></div></section>`;
    root.querySelectorAll('[data-field-task]').forEach(b=>b.onclick=()=>go(b.dataset.fieldTask,u));
  }
  window.enlRenderFieldHome=renderHome;

  function backBar(u){return `<div class="field-task-back"><button type="button" data-field-back>← 현장 홈으로</button><span>${esc(siteName(u))}</span></div>`}
  function bindBack(root,u){root?.querySelector('[data-field-back]')?.addEventListener('click',()=>home(u))}
  window.enlAddFieldBack=function(root,u){if(!root||!isField(u)||root.querySelector('.field-task-back'))return;root.insertAdjacentHTML('afterbegin',backBar(u));bindBack(root,u)};

  function contact(){return `<section class="field-safety-contact business-card-contact"><div class="business-card-head"><span>안전관리자 정보</span><small>사고·안전 관련 문의는 아래 담당자에게 연락해 주세요.</small></div><div class="business-card-body"><div class="business-card-name"><b>박태영</b><span>과장 · 경영관리부</span></div><div class="business-card-line"><span>회사</span><strong>(주)이앤엘</strong></div><div class="business-card-line"><span>전화</span><a href="tel:07086778554">070-8677-8554</a></div><div class="business-card-line"><span>휴대폰</span><a href="tel:01055668580">010-5566-8580</a></div><div class="business-card-line"><span>이메일</span><a href="mailto:hanarin0130@enlife.co.kr">hanarin0130@enlife.co.kr</a></div><div class="business-card-line address"><span>주소</span><strong>경기도 화성시 동탄순환대로823 702호<br>(영천동, 에이팩시티)</strong></div></div></section>`}
  function renderInquiry(root,u){
    if(!root||!isField(u))return;const mine=load().filter(x=>x.userId===u.id||x.userName===u.name).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    root.innerHTML=`${backBar(u)}<form id="fieldInquiryForm411" class="panel report-simple"><div class="section-head"><div><div class="ey">QUESTION</div><h2>기타 문의</h2><p>안전관리자 연락처를 확인하거나 문의를 남길 수 있습니다.</p></div></div>${contact()}<div class="formgrid"><label class="lbl"><span>문의 구분 *</span><select id="inqType411"><option>앱 사용법</option><option>안전 관련 문의</option><option>기타</option></select></label><label class="lbl"><span>제목 *</span><input id="inqTitle411" required></label></div><label class="lbl"><span>문의 내용 *</span><textarea id="inqBody411" rows="5" required></textarea></label><button class="primary full">문의 보내기</button></form><section class="panel" style="margin-top:12px"><div class="section-head"><div><h2>내 문의 기록</h2></div></div><div class="field-inquiry-list">${mine.map(q=>`<div class="field-inquiry-card"><b>${esc(q.title)}</b><span>${esc(q.type)} · ${q.status==='answered'?'답변완료':'접수'}</span><p>${esc(q.body)}</p>${q.answer?`<div class="field-inquiry-answer"><b>본사 답변</b>${esc(q.answer)}</div>`:''}<small>${fmt(q.createdAt)}</small></div>`).join('')||'<div class="empty compact">등록한 문의가 없습니다.</div>'}</div></section>`;
    bindBack(root,u);document.getElementById('fieldInquiryForm411').onsubmit=e=>{e.preventDefault();const all=load();all.unshift({id:uid('inq'),siteId:u.siteId,userId:u.id,userName:u.name,position:title(u),type:document.getElementById('inqType411').value,title:document.getElementById('inqTitle411').value.trim(),body:document.getElementById('inqBody411').value.trim(),status:'open',answer:'',createdAt:nowISO(),updatedAt:nowISO()});if(save(all))renderInquiry(root,u)};
  }
  window.enlRenderFieldInquiry=renderInquiry;
  window.ENL_FIELD_UI_VERSION=VERSION;
})();