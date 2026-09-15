/* E&L staging API router - feature branch only */
(function(){
  'use strict';
  const host=location.hostname||'';
  if(!/^enlsafety-ai-staging(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host))return;
  const raw=window.fetch.bind(window);
  const LOGIN_PROD='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-login-v411';
  const LOGIN_STAGING='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-login-staging-v1';
  const AI_DIRECT='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-ai-safety-v440';
  const AI_PROXY='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-ai-safety-proxy-v1';
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    let next=url;
    if(url.startsWith(LOGIN_PROD))next=LOGIN_STAGING+url.slice(LOGIN_PROD.length);
    else if(url.startsWith(AI_DIRECT))next=AI_PROXY+url.slice(AI_DIRECT.length);
    if(next===url)return raw(input,init);
    if(typeof input==='string')return raw(next,init);
    try{return raw(new Request(next,input),init)}catch(e){return raw(next,init)}
  };
  window.ENL_STAGING_BRIDGE=true;
  console.info('[E&L] staging API bridge enabled');
})();
