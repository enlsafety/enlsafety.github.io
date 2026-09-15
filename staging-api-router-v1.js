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
  const sessionToken=()=>{
    try{
      if(typeof session!=='undefined'&&session?.serverToken)return String(session.serverToken);
      const saved=JSON.parse(localStorage.getItem('enl_safety_session_v3')||'null');
      return String(saved?.serverToken||'');
    }catch{return ''}
  };
  const withAiSession=init=>{
    const next={...(init||{})};
    const headers=new Headers(next.headers||{});
    const token=sessionToken();
    if(token&&!headers.has('X-ENL-Session'))headers.set('X-ENL-Session',token);
    next.headers=headers;
    return next;
  };
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    let next=url,isAi=false;
    if(url.startsWith(LOGIN_PROD))next=LOGIN_STAGING+url.slice(LOGIN_PROD.length);
    else if(url.startsWith(AI_DIRECT)){next=AI_PROXY+url.slice(AI_DIRECT.length);isAi=true;}
    if(next===url)return raw(input,init);
    const routedInit=isAi?withAiSession(init):init;
    if(typeof input==='string')return raw(next,routedInit);
    try{
      const req=new Request(input,routedInit);
      const headers=new Headers(req.headers);
      if(isAi){const token=sessionToken();if(token&&!headers.has('X-ENL-Session'))headers.set('X-ENL-Session',token);}
      return raw(new Request(next,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body,mode:req.mode,credentials:req.credentials,cache:req.cache,redirect:req.redirect,referrer:req.referrer,referrerPolicy:req.referrerPolicy,integrity:req.integrity,keepalive:req.keepalive,signal:req.signal,...(!['GET','HEAD'].includes(req.method)&&req.body?{duplex:'half'}:{})}));
    }catch(e){return raw(next,routedInit)}
  };
  window.ENL_STAGING_BRIDGE=true;
  console.info('[E&L] staging API bridge enabled');
})();
