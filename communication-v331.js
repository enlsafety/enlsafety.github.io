/* E&L Safety Communication v3.3.1 - 문구/가독성 보정 */
(function(){
  const isFieldUser=u=>!!u&&(u.role==='field'||u.role==='worker');

  if(typeof enlRenderPlatformHub==='function'){
    const baseHub=enlRenderPlatformHub;
    enlRenderPlatformHub=function(root,u){
      baseHub(root,u);
      const hero=root.querySelector('.communication-hero');
      if(hero){
        const ey=hero.querySelector('.ey');
        const h2=hero.querySelector('h2');
        const p=hero.querySelector('p');
        if(ey)ey.textContent='E.S.C (E&L Safety Connect)';
        if(h2)h2.textContent='근로자와 관리자가 즉시 주고받는 안전소통';
        if(p)p.textContent='사고·아차사고·위험요인을 바로 알리고, 본사의 확인·조치 결과를 현장에서 바로 확인합니다.';
      }
    };
  }

  if(typeof enlApplyPlatformFrame==='function'){
    const baseFrame=enlApplyPlatformFrame;
    enlApplyPlatformFrame=function(u){
      baseFrame(u);
      const shell=document.querySelector('.app-shell');
      if(shell)shell.classList.toggle('field-readable',isFieldUser(u));
    };
  }

  if(typeof renderUnifiedReport==='function'){
    const baseReport=renderUnifiedReport;
    renderUnifiedReport=function(root,u){
      baseReport(root,u);
      if(!isFieldUser(u))return;
      const required=root.querySelectorAll('[required]');
      required.forEach(el=>el.setAttribute('aria-required','true'));
    };
  }

  if(typeof renderLogin==='function'){
    const baseLogin=renderLogin;
    renderLogin=function(){
      baseLogin();
      const card=document.querySelector('.login-card');
      if(card)card.classList.add('readable-login');
    };
  }

  try{render()}catch(e){console.warn('v3.3.1 readability refresh skipped',e)}
})();
