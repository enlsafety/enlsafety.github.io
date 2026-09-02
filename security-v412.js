/* E&L Accident Report App v4.1.5 - privileged site master security */
(function(){
  'use strict';
  const VERSION='4.1.5-site-security1';
  const CLIENT='incident-report-v2';
  const SITE_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-site-upsert-v412';
  const txt=v=>String(v??'').trim();
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const actor=(u=currentUser?.())=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;

  async function post(body,timeout=15000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(SITE_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }

  const baseIncidentApi=window.enlIncidentApi;
  if(typeof baseIncidentApi==='function'){
    window.enlIncidentApi=async function(body,timeout){
      const a=actor();
      if(body?.action!=='site_upsert'||a?.role!=='safety')return baseIncidentApi.apply(this,arguments);
      try{return await post({...body,actor:a},timeout||15000)}
      catch(e){
        if(e?.message!=='password_required'){if(e?.message==='invalid_password')alert('안전관리자 비밀번호가 맞지 않습니다.');throw e}
        const pw=prompt('현장소장·파트장·서무 연락망 변경 확인을 위해 안전관리자 비밀번호를 입력해 주세요.');
        if(!txt(pw))throw e;
        const passwordHash=await sha256(pw);
        try{return await post({...body,actor:a,passwordHash},timeout||15000)}
        catch(retryErr){if(retryErr?.message==='invalid_password')alert('안전관리자 비밀번호가 맞지 않습니다.');throw retryErr}
      }
    };
  }

  window.ENL_SECURITY_VERSION=VERSION;
})();