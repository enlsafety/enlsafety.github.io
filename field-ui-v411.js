/* E&L Accident Report App v4.1.5 - authoritative field/worker UI */
(function(){
  'use strict';
  const VERSION='4.4.42-field-prevention-attention1';
  const isField=u=>!!u&&['field','worker'].includes(u.role);
  const siteName=u=>{try{return siteById?.(u?.siteId)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(u?.siteId))?.name||'소속 사업장'}catch(e){return '소속 사업장'}};
  const title=u=>u?.position||u?.jobTitle||(u?.role==='worker'?'일반근로자':'현장관리');
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const isManager=u=>String(u?.role||'')==='field'&&MANAGER_POSITIONS.includes(String(u?.position||u?.jobTitle||''));
  const sameSite=(i,u)=>String(i?.siteId||'')===String(u?.siteId||'');
  const historicalClosed=i=>String(i?.recordMode||'')==='historical_transfer'||String(i?.historicalTransfer?.mode||'')==='historical_transfer'||(i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&String(i?.historicalImport?.transferState||'')==='closed');
  const supplementCount=u=>{try{return !isManager(u)?0:(data?.incidents||[]).filter(i=>sameSite(i,u)&&String(i?.status||'')==='supplement').length}catch(e){return 0}};
  const preventionActionCount=u=>{try{return !isManager(u)?0:(data?.incidents||[]).filter(i=>{if(!sameSite(i,u)||historicalClosed(i)||String(i?.status||'')!=='approved')return false;const x=i?.corrective||{},s=String(x.status||''),hasPlan=!!String(x.planDetail||'').trim()||!!x.planAt;return hasPlan&&['planned','in_progress','rejected'].includes(s)}).length}catch(e){return 0}};
  const attentionCounts=u=>{const supplement=supplementCount(u),prevention=preventionActionCount(u);return {supplement,prevention,total:supplement+prevention}};
  let inquiryRetry=0,inquiryTimer=null;

  function home(u=currentUser?.()){
    if(!isField(u))return;
    currentView='home';inquiryRetry=0;clearTimeout(inquiryTimer);try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
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
    if(task==='inquiry'){currentView='field-inquiry';inquiryRetry=0;return renderShell(u)}
  }
  window.enlGoFieldTask=go;

  function ensureHomeAlertCss(){
    if(document.getElementById('fieldSupplementHomeCss'))return;
    const style=document.createElement('style');style.id='fieldSupplementHomeCss';style.textContent=`
      .field-six-btn{position:relative}.field-six-btn.field-six-attention-btn{border-color:#db5a5a!important;box-shadow:0 0 0 2px rgba(214,62,62,.09),0 8px 20px rgba(104,35,35,.08)}
      .field-six-new{position:absolute;right:10px;top:9px;min-width:27px;height:27px;padding:0 7px;border-radius:999px;background:#d83b3b;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:950;line-height:1;box-shadow:0 3px 9px rgba(172,36,36,.28)}
      .field-six-alert{margin:0 0 12px;padding:12px 13px;border:2px solid #dc6767;border-radius:13px;background:#fff4f4;color:#783333;display:flex;align-items:center;gap:10px;flex-wrap:wrap;line-height:1.5}
      .field-six-alert b{color:#a92f2f;flex:1 1 220px}.field-six-alert button{min-height:38px;border:1px solid #caa2a2;border-radius:9px;background:#fff;color:#8b3333;padding:0 11px;font-weight:900}
      @media(max-width:560px){.field-six-alert{align-items:flex-start}.field-six-alert button{width:100%}}
    `;document.head.appendChild(style);
  }
  function renderHome(root,u){
    if(!root||!isField(u))return;
    ensureHomeAlertCss();
    const attention=attentionCounts(u),pending=attention.total,needsPush=pending>0&&((typeof Notification==='undefined')||Notification.permission!=='granted');
    const alertLabel=[attention.supplement?`사고보고 보완요청 ${attention.supplement}건`:'',attention.prevention?`재발방지조치 작성·보완 ${attention.prevention}건`:''].filter(Boolean).join(' · ');
    root.innerHTML=`<section class="field-six-home"><div class="field-six-head"><h2>${esc(siteName(u))}</h2><p>필요한 메뉴를 선택해 주세요.</p><span class="field-six-role">${esc(title(u))} · ${esc(u.name||'')}</span></div>${pending?`<div class="field-six-alert"><b>${esc(alertLabel)}</b>${needsPush?'<button type="button" data-field-notification-setup>휴대폰 알림 켜기</button>':''}</div>`:''}<div class="field-six-grid"><button class="field-six-btn" data-field-task="accident_report"><span class="field-six-no">01</span><strong>사고 보고</strong><small>대인·대물 사고를 보고</small></button><button class="field-six-btn" data-field-task="accident_action"><span class="field-six-no">02</span><strong>재발방지조치</strong><small>재발방지계획 이행내용 등록</small></button><button class="field-six-btn ${pending?'field-six-attention-btn':''}" data-field-task="records">${pending?`<span class="field-six-new" aria-label="확인·작성 필요 ${pending}건">${pending}</span>`:''}<span class="field-six-no">03</span><strong>사고 기록</strong><small>${pending?`확인·작성 필요 ${pending}건`:'우리 현장<br>사고기록 확인'}</small></button><button class="field-six-btn" data-field-task="inquiry"><span class="field-six-no">04</span><strong>기타 문의</strong><small>안전관리자 문의 및 답변 확인</small></button></div></section>`;
    root.querySelectorAll('[data-field-task]').forEach(b=>b.onclick=()=>go(b.dataset.fieldTask,u));
    root.querySelector('[data-field-notification-setup]')?.addEventListener('click',()=>{if(typeof window.enlOpenPwaNotificationSettings==='function')window.enlOpenPwaNotificationSettings();else document.getElementById('enlPwaTop418')?.click()});
  }
  window.enlRenderFieldHome=renderHome;
  window.enlFieldSupplementCount=supplementCount;
  window.enlFieldPreventionActionCount=preventionActionCount;
  window.enlFieldAttentionCount=u=>attentionCounts(u).total;

  function backBar(u){return `<div class="field-task-back"><button type="button" data-field-back>← 현장 홈으로</button><span>${esc(siteName(u))}</span></div>`}
  function bindBack(root,u){root?.querySelector('[data-field-back]')?.addEventListener('click',()=>home(u))}
  window.enlAddFieldBack=function(root,u){if(!root||!isField(u)||root.querySelector('.field-task-back'))return;root.insertAdjacentHTML('afterbegin',backBar(u));bindBack(root,u)};

  function renderInquiry(root,u){
    if(!root||!isField(u))return;
    if(typeof window.enlRenderSafetyInquiry==='function'){inquiryRetry=0;clearTimeout(inquiryTimer);return window.enlRenderSafetyInquiry('')}
    root.innerHTML=`${backBar(u)}<section class="panel"><div class="empty compact">안전관리자 문의함을 연결하고 있습니다.</div></section>`;bindBack(root,u);
    if(inquiryRetry>=20)return;
    inquiryRetry+=1;clearTimeout(inquiryTimer);inquiryTimer=setTimeout(()=>{const current=currentUser?.(),view=document.getElementById('view');if(currentView==='field-inquiry'&&current&&String(current.id||'')===String(u.id||'')&&view)renderInquiry(view,current)},100);
  }
  window.enlRenderFieldInquiry=renderInquiry;
  window.ENL_FIELD_UI_VERSION=VERSION;
})();