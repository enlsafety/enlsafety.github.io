/* E&L Accident Report App v4.1.5 - authoritative field/worker UI */
(function(){
  'use strict';
  const VERSION='4.1.5-inquiry1';
  const isField=u=>!!u&&['field','worker'].includes(u.role);
  const siteName=u=>{try{return siteById?.(u?.siteId)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(u?.siteId))?.name||'소속 사업장'}catch(e){return '소속 사업장'}};
  const title=u=>u?.position||u?.jobTitle||(u?.role==='worker'?'일반근로자':'현장관리');

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
    root.innerHTML=`<section class="field-six-home"><div class="field-six-head"><h2>${esc(siteName(u))}</h2><p>필요한 메뉴를 선택해 주세요.</p><span class="field-six-role">${esc(title(u))} · ${esc(u.name||'')}</span></div><div class="field-six-grid"><button class="field-six-btn" data-field-task="accident_report"><span class="field-six-no">01</span><strong>사고 보고</strong><small>대인·대물 사고를 보고</small></button><button class="field-six-btn" data-field-task="accident_action"><span class="field-six-no">02</span><strong>사고 조치</strong><small>사고 후 조치내용 등록</small></button><button class="field-six-btn" data-field-task="records"><span class="field-six-no">03</span><strong>사고 기록</strong><small>우리 현장<br>사고기록 확인</small></button><button class="field-six-btn" data-field-task="inquiry"><span class="field-six-no">04</span><strong>기타 문의</strong><small>안전관리자 문의 및 답변 확인</small></button></div></section>`;
    root.querySelectorAll('[data-field-task]').forEach(b=>b.onclick=()=>go(b.dataset.fieldTask,u));
  }
  window.enlRenderFieldHome=renderHome;

  function backBar(u){return `<div class="field-task-back"><button type="button" data-field-back>← 현장 홈으로</button><span>${esc(siteName(u))}</span></div>`}
  function bindBack(root,u){root?.querySelector('[data-field-back]')?.addEventListener('click',()=>home(u))}
  window.enlAddFieldBack=function(root,u){if(!root||!isField(u)||root.querySelector('.field-task-back'))return;root.insertAdjacentHTML('afterbegin',backBar(u));bindBack(root,u)};

  function renderInquiry(root,u){
    if(!root||!isField(u))return;
    if(typeof window.enlRenderSafetyInquiry==='function')return window.enlRenderSafetyInquiry('');
    root.innerHTML=`${backBar(u)}<section class="panel"><div class="empty compact">문의 기능을 불러오는 중입니다. 새로고침해 주세요.</div></section>`;bindBack(root,u);
  }
  window.enlRenderFieldInquiry=renderInquiry;
  window.ENL_FIELD_UI_VERSION=VERSION;
})();