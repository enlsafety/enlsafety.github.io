/* E&L Accident Report App v4.1.2 - compact login name/affiliation layout */
(function(){
  'use strict';
  const VERSION='4.1.2-r15';
  function css(){
    if(document.getElementById('loginLayout412Css'))return;
    const s=document.createElement('style');s.id='loginLayout412Css';s.textContent=`
      .login-v411 .login-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:10px;align-items:start}
      .login-v411 .login-brand{grid-column:1/-1;grid-row:1}
      .login-v411 .login-card>label{grid-column:1;grid-row:2;min-width:0}
      .login-v411 #loginAff411{grid-column:2;grid-row:2;min-width:0;align-self:end;margin:0}
      .login-v411 #loginAff411:not([hidden])::before{content:'소속사업장';display:block;margin:0 0 8px;font-size:17px;color:#193f5c;font-weight:950}
      .login-v411 #loginStatus411{grid-column:1/-1;grid-row:3;margin-top:7px}
      .login-v411 #loginPwWrap411{grid-column:1/-1;grid-row:4}
      .login-v411 .login-guide{grid-column:1/-1;grid-row:5}
      .login-v411 .login-note{grid-column:1/-1;grid-row:6}
      .login-v411 #loginName411{min-width:0}
      .login-v411 .login411-aff{margin:0;border-radius:14px}
      .login-v411 .login411-aff summary{min-height:64px;box-sizing:border-box;padding:0 12px;font-size:16px;border-radius:12px}
      .login-v411 .login411-list{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 5px);max-height:220px;overflow:auto;border:1.5px solid #bfd7e7;border-radius:13px;background:#fff;box-shadow:0 12px 28px rgba(34,78,111,.18);padding:8px}
      .login-v411 #loginAff411{position:relative}
      .login-v411 .login411-aff-btn{min-height:58px;padding:9px 11px}
      .login-v411 .login411-aff-btn b{font-size:16px}
      .login-v411 .login411-aff-btn small{font-size:11px}
      @media(max-width:560px){
        .login-v411 .login-card{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:7px}
        .login-v411 #loginAff411:not([hidden])::before,.login-v411 .login-card>label>span{font-size:14px;margin-bottom:6px}
        .login-v411 #loginName411,.login-v411 .login411-aff summary{min-height:56px;font-size:16px;padding-left:10px;padding-right:10px}
        .login-v411 .login411-aff summary{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .login-v411 .login411-list{max-height:190px}
        .login-v411 #loginStatus411{font-size:12px;min-height:22px;margin-top:5px}
      }
    `;document.head.appendChild(s);
  }
  function compactAffiliation(){
    document.querySelectorAll('.login-v411 .login411-aff').forEach(d=>{
      if(d.dataset.compact412==='1')return;
      d.dataset.compact412='1';
      d.removeAttribute('open');
      const summary=d.querySelector('summary');if(summary)summary.firstChild.textContent='소속 선택 ';
    });
  }
  const obs=new MutationObserver(compactAffiliation);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  css();compactAffiliation();
  window.ENL_LOGIN_LAYOUT_VERSION=VERSION;
})();