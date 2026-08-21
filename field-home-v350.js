/* E&L Safety v3.5.0 - field staff landing */
(function(){
  function isField(u){return !!u&&u.role==='field'}
  function fieldTitle(u){return u?.position||'현장담당자'}
  function go(section,view,u){
    try{enlPlatformSection=section;localStorage.setItem(ENL_PLATFORM_SECTION_KEY,section)}catch(e){}
    if(section==='inspection'&&typeof enlInspectionTab!=='undefined')enlInspectionTab=view||'dashboard';
    if(section==='incident')currentView=view||'home';
    renderShell(u||currentUser());
  }
  function renderFieldLanding(root,u){
    const site=siteById(u.siteId)?.name||'소속 사업장';
    root.innerHTML=`<section class="field-simple-home">
      <div class="field-simple-head"><h2>${esc(site)}</h2><p>필요한 업무를 선택하세요.</p><span class="field-home-role">${esc(fieldTitle(u))} · ${esc(u.name)}</span></div>
      <div class="field-quick-grid">
        <button type="button" class="field-quick-btn" data-field-go="report"><span class="field-quick-num">01</span><strong>안전보고</strong><small>사고·아차·위험요인 보고</small></button>
        <button type="button" class="field-quick-btn" data-field-go="inspection"><span class="field-quick-num">02</span><strong>안전점검</strong><small>현장 점검 등록 및 확인</small></button>
        <button type="button" class="field-quick-btn" data-field-go="actions"><span class="field-quick-num">03</span><strong>조치·피드백</strong><small>본사 요청사항과 조치내용 확인</small></button>
        <button type="button" class="field-quick-btn" data-field-go="records"><span class="field-quick-num">04</span><strong>우리 현장 기록</strong><small>지금까지 등록한 안전기록 조회</small></button>
      </div>
    </section>`;
    root.querySelector('[data-field-go="report"]').onclick=()=>go('incident','report',u);
    root.querySelector('[data-field-go="inspection"]').onclick=()=>go('inspection','dashboard',u);
    root.querySelector('[data-field-go="actions"]').onclick=()=>go('incident','actions',u);
    root.querySelector('[data-field-go="records"]').onclick=()=>go('incident','incidents',u);
  }

  if(typeof enlRenderPlatformHub==='function'){
    const baseHub=enlRenderPlatformHub;
    enlRenderPlatformHub=function(root,u){if(isField(u))return renderFieldLanding(root,u);return baseHub(root,u)};
  }

  if(typeof renderUnifiedHome==='function'){
    const baseUnifiedHome=renderUnifiedHome;
    renderUnifiedHome=function(root,u){if(isField(u))return renderFieldLanding(root,u);return baseUnifiedHome(root,u)};
  }

  const baseShell=renderShell;
  renderShell=function(u){
    baseShell(u);
    const shell=document.querySelector('.app-shell');
    const isHome=isField(u)&&((typeof enlPlatformSection!=='undefined'&&enlPlatformSection==='hub')||currentView==='home');
    if(shell)shell.classList.toggle('field-home-mode',!!isHome);
    if(isField(u)){
      const chip=document.querySelector('.user-chip small');
      if(chip)chip.textContent=`${fieldTitle(u)} · ${siteById(u.siteId)?.name||'소속 사업장'}`;
    }
  };

  try{
    const u=currentUser();
    if(isField(u)){
      enlPlatformSection='hub';
      try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
      currentView='home';
      render();
    }
  }catch(e){console.warn('field landing init skipped',e)}
})();