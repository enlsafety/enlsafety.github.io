/* E&L Accident Report App v4.4.7 - user notification profile */
(function(){
  'use strict';
  const VERSION='4.4.7-notification-profile2';
  const PUSH_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-v418';
  const CLIENT='incident-report-v2';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const actor=()=>{
    const u=typeof currentUser==='function'?currentUser():null;
    if(!u)return null;
    return {id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''};
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function call(url,action,extra={}){
    const a=actor();if(!a)throw new Error('login_required');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action,actor:a,...extra}),cache:'no-store'});
    const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||'request_failed');return j;
  }
  function ensureCss(){
    if(document.getElementById('enl441ProfileCss'))return;
    const s=document.createElement('style');s.id='enl441ProfileCss';s.textContent=`
      .enl441-profile{border:1px solid #d6e3ec;border-radius:13px;background:#f9fcfe;padding:12px;display:grid;gap:10px}
      .enl441-profile h3{margin:0;color:#174d78;font-size:15px}.enl441-grid{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:8px}
      .enl441-field{display:grid;gap:5px}.enl441-field span{font-size:11px;font-weight:900;color:#536d80}.enl441-field input,.enl441-field select{width:100%;min-height:42px;border:1.4px solid #c5d5e1;border-radius:9px;background:#fff;padding:0 10px;font:inherit}
      .enl441-save{min-height:43px;border:0;border-radius:9px;background:#1e5d91;color:#fff;font-weight:900}.enl441-note{font-size:11px;color:#6f8291;line-height:1.45}.enl441-note.force{color:#9a4b20;font-weight:850}
      @media(max-width:620px){.enl441-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  async function inject(){
    const overlay=document.getElementById('enl418Overlay');if(!overlay||overlay.querySelector('.enl441-profile'))return;
    ensureCss();
    const anchor=overlay.querySelector('#enl418Message');if(!anchor)return;
    const box=document.createElement('section');box.className='enl441-profile';
    box.innerHTML=`<h3>사용자 알림 정보</h3><div class="enl441-grid"><label class="enl441-field"><span>이메일</span><input id="enl441Email" type="email" placeholder="name@company.com"></label><label class="enl441-field"><span>앱 푸시</span><select id="enl441Push"><option value="1">ON</option><option value="0">OFF</option></select></label><label class="enl441-field"><span>이메일 알림</span><select id="enl441Mail"><option value="1">ON</option><option value="0">OFF</option></select></label></div><div id="enl441Force" class="enl441-note"></div><button type="button" id="enl441Save" class="enl441-save">이메일·알림 설정 저장</button><div id="enl441Msg" class="enl441-note">기본값은 앱 푸시 ON · 이메일 알림 ON입니다.</div>`;
    anchor.parentElement.insertBefore(box,anchor);
    const msg=t=>{const x=document.getElementById('enl441Msg');if(x)x.textContent=t};
    try{
      const r=await call(PUSH_API,'profile_get'),p=r.profile||{};
      document.getElementById('enl441Email').value=p.email||'';
      document.getElementById('enl441Push').value=p.pushEnabled===false?'0':'1';
      document.getElementById('enl441Mail').value=p.emailEnabled===false?'0':'1';
      const force=document.getElementById('enl441Force');
      if(force&&p.urgentForced){force.classList.add('force');force.textContent='긴급사고는 앱 푸시·이메일 OFF 설정과 관계없이 강제 수신됩니다.'}
    }catch(e){msg('사용자 알림정보를 불러오지 못했습니다.')}
    document.getElementById('enl441Save').onclick=async()=>{
      const btn=document.getElementById('enl441Save'),email=document.getElementById('enl441Email').value.trim(),pushEnabled=document.getElementById('enl441Push').value!=='0',emailEnabled=document.getElementById('enl441Mail').value!=='0';
      btn.disabled=true;msg('저장 중…');
      try{await call(PUSH_API,'profile_update',{email,pushEnabled,emailEnabled});msg('이메일과 알림 설정을 저장했습니다.')}
      catch(e){msg(String(e?.message||'')==='invalid_email'?'이메일 주소 형식을 확인해 주세요.':'설정을 저장하지 못했습니다.')}
      finally{btn.disabled=false}
    };
  }
  const mo=new MutationObserver(()=>inject());mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(inject,400);

  window.ENL_NOTIFICATION_PROFILE_VERSION=VERSION;
})();