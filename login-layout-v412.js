/* Keep the original name / registered site row and anchor the password near it on mobile. */
(()=>{
 const s=document.createElement('style');
 s.textContent=`
 .login-v411 .login-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 10px;align-items:end}
 .login-v411 [hidden]{display:none!important}
 .login-v411 .login-brand,.login-v411 #loginStatus411,.login-v411 #loginEmail411,.login-v411 #loginIdentity411,.login-v411 #loginPwWrap411,.login-v411 .login411-note{grid-column:1/-1;min-width:0}
 .login-v411 .login-brand{grid-row:1;margin-bottom:8px}.login-v411 .login-card>label,.aff-field411{grid-row:2;min-width:0}
 .aff-field411{grid-column:2;display:grid;gap:8px}.aff-field411>span,.login-v411 #loginEmail411>label{color:#193f5c;font-weight:800}
 .login-v411 #loginAff411{display:flex;align-items:center;min-height:64px;padding:0 12px;border:2px solid #c6d9e6;border-radius:14px;background:#eff5fa;font-weight:700;overflow-wrap:anywhere;box-sizing:border-box}
 .login-v411 #loginEmail411{grid-row:3}.login-v411 #loginIdentity411{grid-row:4}.login-v411 #loginStatus411{grid-row:5;margin:0;min-height:16px}.login-v411 #loginPwWrap411{grid-row:6}.login-v411 .login411-note{grid-row:7}
 .company-address{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px}
 .company-address input,.login-v411 #loginIdentity411 input{box-sizing:border-box;font:inherit;min-width:0;width:100%;min-height:44px;padding:6px 9px;border:1px solid #adc8dc;border-radius:8px}.company-address b{font-size:14px;white-space:nowrap}.company-address button{min-height:44px;padding:5px 9px;border:1px solid #a9c4d9;background:#eff6fc;border-radius:8px;color:#194f79;font-weight:700}
 .login-v411 #loginIdentity411 form,.email-gate-dialog form,#emailGateSet{display:grid;gap:8px}.login-v411 .login-brand p{display:none}.login-v411 .login411-pw{margin:0;padding:8px 12px}.email-gate-dialog{width:min(365px,calc(100% - 24px));max-height:85dvh;overflow:auto;box-sizing:border-box;border:1px solid #a8c4d9;border-radius:12px}.email-gate-dialog label,#emailGateSet label{display:grid;gap:4px}.email-gate-dialog input,#emailGateSet input{min-width:0;min-height:42px}.email-gate-dialog{padding:clamp(16px,4vw,22px);color:#193f5c;background:#fff;box-shadow:0 12px 36px #193f5c24}
 .email-gate-dialog h2{margin:0;font-size:21px;line-height:1.3}.email-gate-dialog form>p{margin:0 0 6px;color:#496b83;overflow-wrap:anywhere}
 .email-gate-dialog .gate-once{display:inline-block;font-size:12px;font-style:normal;font-weight:700;color:#175b93;background:#eaf4fc;border-radius:6px;padding:2px 6px;white-space:nowrap}
 .email-gate-dialog small{line-height:1.5;color:#4d6578}.email-gate-dialog [role=status]:empty{display:none}
 .email-gate-dialog footer{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;margin-top:6px}
 .email-gate-dialog footer button{appearance:none;min-height:44px;margin:0;padding:9px 12px;font:inherit;font-weight:700;border:1px solid #c9dded;border-radius:10px;color:#175b93;background:#edf6fd;cursor:pointer}
 .email-gate-dialog footer [type=submit]{background:#175b93;color:#fff;border-color:#175b93}
 .email-gate-dialog footer button:focus-visible{outline:3px solid #4b90bf;outline-offset:2px}.email-gate-dialog footer button:disabled{opacity:.6;cursor:wait}
 @media(max-width:600px){.login-v411 .login-card{gap:3px 7px;padding:12px}.login-v411 .login-brand{margin-bottom:3px}.login-v411 #loginName411,.login-v411 #loginAff411{min-height:48px;font-size:16px}.login-v411 #loginPassword411{min-height:48px;font-size:18px;scroll-margin:12px}.login-v411 .login411-pw{padding:5px 9px}.login-v411 .login411-submit{min-height:44px;margin-top:5px}.login-v411 .login-card>label>span,.aff-field411>span{font-size:14px}.login-v411 #loginEmail411>label{font-size:14px}}
 `;document.head.append(s);
 const keepVisible=()=>{const el=document.activeElement,v=window.visualViewport;if(!v||el?.id!=='loginPassword411')return;const r=el.getBoundingClientRect();if(r.bottom>v.offsetTop+v.height-6||r.top<v.offsetTop)el.scrollIntoView({block:'center'})};
 window.visualViewport?.addEventListener('resize',keepVisible);
})();
