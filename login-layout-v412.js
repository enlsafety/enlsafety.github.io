/* E&L Accident Report App v4.1.2 - compact login name/affiliation layout */
(function(){
  'use strict';
  const VERSION='4.1.2-r16-login3';
  const GUIDE_HTML='<b>로그인 순서</b><br><span>현장근로자: 이름입력 → 소속선택</span><br><span>현장관리자 및 본사관리자: 이름입력 → 소속선택 → 비밀번호입력</span>';
  function css(){
    if(document.getElementById('loginLayout412Css'))return;
    const s=document.createElement('style');s.id='loginLayout412Css';s.textContent=`
      .login-v411 .login-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:10px;align-items:start}
      .login-v411 .login-brand{grid-column:1/-1;grid-row:1;display:flex;align-items:center;gap:14px;margin-bottom:18px}
      .login-v411 .login-brand>div:last-child{display:flex;align-items:center;min-height:64px}
      .login-v411 .login-brand p{display:none!important}
      .login-v411 h1{font-size:30px;line-height:1.15;letter-spacing:-.4px}
      .login-v411 .login-card>label{grid-column:1;grid-row:2;min-width:0}
      .login-v411 #loginAff411{display:block!important;grid-column:2;grid-row:2;min-width:0;align-self:end;margin:0;position:relative}
      .login-v411 #loginAff411::before{content:'소속사업장';display:block;margin:0 0 8px;font-size:17px;color:#193f5c;font-weight:950}
      .login-v411 #loginStatus411{grid-column:1;grid-row:3;margin:5px 0 0;padding:0 2px;min-height:22px;align-self:start}
      .login-v411 .login411-guide{grid-column:1/-1;grid-row:4;margin-top:10px}
      .login-v411 #loginPwWrap411{grid-column:1/-1;grid-row:5}
      .login-v411 .login411-note{grid-column:1/-1;grid-row:6}
      .login-v411 #loginName411{min-width:0}
      .login-v411 .login411-aff{margin:0;border-radius:14px;position:relative;overflow:visible!important}
      .login-v411 .login411-aff summary{min-height:64px;box-sizing:border-box;padding:0 12px;font-size:16px;border-radius:12px}
      .login-v411 .login411-aff[open] summary{border-bottom-left-radius:8px;border-bottom-right-radius:8px}
      .login-v411 .login411-list{position:absolute;z-index:50;left:0;right:0;top:calc(100% + 5px);max-height:220px;overflow:auto;border:1.5px solid #bfd7e7;border-radius:13px;background:#fff;box-shadow:0 12px 28px rgba(34,78,111,.18);padding:8px;box-sizing:border-box}
      .login-v411 .login412-aff-disabled{min-height:64px;display:flex;align-items:center;border:2px solid #d7e2e9;background:#f1f5f8;color:#96a4af;box-sizing:border-box;cursor:not-allowed;overflow:hidden!important}
      .login-v411 .login412-aff-placeholder{width:100%;padding:0 12px;font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .login-v411 .login411-aff-btn{min-height:58px;padding:9px 11px}
      .login-v411 .login411-aff-btn b{font-size:16px}
      .login-v411 .login411-aff-btn small{font-size:11px}
      @media(max-width:560px){
        .login-v411 .login-card{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:7px}
        .login-v411 .login-brand{gap:11px;margin-bottom:16px}
        .login-v411 .login-brand>div:last-child{min-height:56px}
        .login-v411 h1{font-size:26px;line-height:1.12}
        .login-v411 #loginAff411::before,.login-v411 .login-card>label>span{font-size:14px;margin-bottom:6px}
        .login-v411 #loginName411,.login-v411 .login411-aff summary,.login-v411 .login412-aff-disabled{min-height:56px;font-size:16px}
        .login-v411 #loginName411,.login-v411 .login411-aff summary,.login-v411 .login412-aff-placeholder{padding-left:10px;padding-right:10px}
        .login-v411 .login411-aff summary{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .login-v411 .login411-list{max-height:210px}
        .login-v411 #loginStatus411{font-size:12px;min-height:20px;margin-top:4px;line-height:1.35}
        .login-v411 .login411-guide{margin-top:7px;font-size:13px;line-height:1.6}
      }
    `;document.head.appendChild(s);
  }
  function placeholderText(name,status){
    if(!name)return '이름 입력 후 선택';
    if(status.includes('찾지 못했습니다'))return '조회된 소속 없음';
    if(status.includes('불러오지 못했습니다'))return '소속 확인 실패';
    if(status.includes('조금 더 입력'))return '이름을 더 입력해 주세요';
    return '소속 확인 중…';
  }
  function syncHeaderAndGuide(){
    const page=document.querySelector('.login-v411');if(!page)return;
    const brand=page.querySelector('.login-brand');
    if(brand){const p=brand.querySelector('p');if(p)p.remove()}
    const guide=page.querySelector('.login411-guide');
    if(guide&&guide.innerHTML!==GUIDE_HTML)guide.innerHTML=GUIDE_HTML;
  }
  function syncAffiliation(){
    const page=document.querySelector('.login-v411');if(!page)return;
    const aff=document.getElementById('loginAff411'),nameInput=document.getElementById('loginName411'),status=document.getElementById('loginStatus411');if(!aff||!nameInput)return;
    const name=nameInput.value.trim(),details=aff.querySelector('details.login411-aff');
    if(details){
      aff.hidden=false;delete aff.dataset.placeholder412;
      const summary=details.querySelector('summary');
      if(summary&&summary.firstChild&&summary.firstChild.textContent!=='소속 선택 ')summary.firstChild.textContent='소속 선택 ';
      if(name&&details.dataset.autoOpened412!=='1'){details.dataset.autoOpened412='1';details.open=true}
      return;
    }
    const label=placeholderText(name,status?.textContent||'');
    if(aff.dataset.placeholder412===label&&!aff.hidden)return;
    aff.hidden=false;aff.dataset.placeholder412=label;
    aff.innerHTML=`<div class="login411-aff login412-aff-disabled" aria-disabled="true"><div class="login412-aff-placeholder">${label}</div></div>`;
  }
  function syncAll(){syncHeaderAndGuide();syncAffiliation()}
  document.addEventListener('input',e=>{if(e.target?.id==='loginName411')setTimeout(syncAll,0)},true);
  const obs=new MutationObserver(()=>syncAll());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  css();syncAll();
  window.ENL_LOGIN_LAYOUT_VERSION=VERSION;
})();