/* The registered affiliation is read-only. Layout-only rules for the sign-in form. */
(()=>{
 const s=document.createElement('style');
 s.textContent=`
 .login-v411 .login-card{display:grid;gap:10px}
 .login-v411 [hidden]{display:none!important}
 .login-v411 #loginAff411{padding:10px 14px;border-radius:10px;background:#eff5fa;font-weight:700}
 .login-v411 #loginAff411::before{content:'등록 소속　';color:#546e80}
 .company-address{display:flex;align-items:center;gap:8px;border:1px solid #adc8dc;border-radius:10px;padding:0 12px;min-height:48px}
 .company-address input,.login-v411 #loginIdentity411 input{font:inherit;min-width:0;width:100%;padding:6px;border:0}
 .company-address b{font-size:15px;white-space:nowrap}.login-v411 #loginIdentity411 form{display:grid;gap:8px}
 .login-v411 .login-brand p{display:none}.login-v411 .login411-pw{margin-top:0}`;
 document.head.append(s);
})();
