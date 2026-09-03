/* E&L Accident Report App v4.1.8 - PWA install + web push */
(function(){
  'use strict';
  const VERSION='4.1.8-pwa-push2';
  const PUSH_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-v418';
  const CLIENT='incident-report-v2';
  const SW_URL='/sw-v418.js?v=4.1.8-pwa2';
  const PREF_PREFIX='enl_push_preferences_v1_';
  const rawFetch=window.fetch.bind(window);
  let deferredInstall=null;
  let healthCache=null;
  let swReg=null;
  let renderQueued=false;
  let lastReaderIncidentId='';
  const flushedUsers=new Set();
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actor=()=>{try{return window.enlCurrentActor?.()||null}catch(e){return null}};
  const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||window.navigator.standalone===true;
  const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const isAndroid=()=>/Android/i.test(navigator.userAgent);
  const isKakao=()=>/KAKAOTALK/i.test(navigator.userAgent);
  const supportsPush=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const keyFor=u=>PREF_PREFIX+String(u?.id||'guest');

  function defaultPrefs(u){
    const r=roleNorm(u?.role);
    if(r==='safety')return {incident_progress:true,action_progress:true,inquiry:true,management_views:true,urgent:true};
    if(r==='manager'||r==='executive')return {incident_progress:true,action_progress:true,inquiry:true,management_views:false,urgent:true};
    if(r==='field')return {incident_progress:true,action_progress:true,inquiry:true,management_views:false,urgent:false};
    return {incident_progress:true,action_progress:true,inquiry:true,management_views:false,urgent:false};
  }
  function loadPrefs(u){
    const base=defaultPrefs(u);try{const saved=JSON.parse(localStorage.getItem(keyFor(u))||'{}');return {...base,...(saved&&typeof saved==='object'?saved:{})}}catch(e){return base}
  }
  function savePrefs(u,p){try{localStorage.setItem(keyFor(u),JSON.stringify(p))}catch(e){}}
  function prefRows(u,p){
    const r=roleNorm(u?.role),rows=[];
    if(r==='worker')rows.push(['incident_progress','내 사고 진행 알림','내 사고보고 승인·반려·종결'],['action_progress','내 사고조치 알림','내가 제출한 조치 승인·반려'],['inquiry','문의 답변 알림','안전관리자 답변 등록']);
    else if(r==='field')rows.push(['incident_progress','사업장 사고보고 알림','신규·재제출·승인·반려·종결'],['action_progress','사업장 사고조치 알림','제출·재제출·승인·반려'],['inquiry','문의 답변 알림','내 문의 답변 등록']);
    else if(r==='safety')rows.push(['incident_progress','신규 사고보고 알림','최초 제출·반려 후 재제출'],['action_progress','사고조치 제출 알림','최초 제출·반려 후 재제출'],['inquiry','안전문의 알림','새 문의 등록'],['management_views','관리자·경영진 조회 알림','사고경위서·사고조치 최초 조회']);
    else rows.push(['incident_progress','승인 사고 알림','승인 및 최종 종결'],['action_progress','승인 사고조치 알림','승인된 사고조치'],['inquiry','문의 답변 알림','내 문의 답변 등록'],['urgent','긴급 사고 알림','긴급·중대 가능 사고는 검토단계부터']);
    return rows.map(([k,t,d])=>`<label class="enl418-pref"><span><b>${esc(t)}</b><small>${esc(d)}</small></span><input type="checkbox" data-enl-pref="${k}" ${p[k]!==false?'checked':''} ${(k==='urgent'&&(r==='manager'||r==='executive'))?'disabled':''}></label>`).join('');
  }

  async function api(action,extra={},timeout=12000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null,timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const res=await rawFetch(PUSH_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action,...extra}),signal:ctl?.signal,cache:'no-store'});
      const data=await res.json().catch(()=>({}));if(!res.ok||data?.ok===false){const e=new Error(data?.message||`http_${res.status}`);e.status=res.status;throw e}return data;
    }finally{if(timer)clearTimeout(timer)}
  }
  async function health(){if(healthCache)return healthCache;healthCache=await api('health',{});return healthCache}
  async function ensureSw(){if(swReg)return swReg;if(!('serviceWorker' in navigator))throw new Error('service_worker_unsupported');swReg=await navigator.serviceWorker.register(SW_URL,{scope:'/'});await navigator.serviceWorker.ready;return swReg}
  function b64ToBytes(v){const pad='='.repeat((4-v.length%4)%4),base=(v+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base),arr=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);return arr}
  async function currentSub(){try{const reg=await ensureSw();return await reg.pushManager.getSubscription()}catch(e){return null}}
  async function flush(){const u=actor();if(!u)return;try{await api('flush',{actor:u},15000)}catch(e){console.warn('push flush skipped',e?.message||e)}}
  window.enlPushFlush=flush;

  function ensureCss(){if(document.getElementById('enlPwa418Css'))return;const s=document.createElement('style');s.id='enlPwa418Css';s.textContent=`
    .enl-pwa-top418{min-height:44px;border:2px solid #8db9d8;border-radius:12px;background:#f2f9fe;color:#174d78;padding:0 13px;font-weight:950;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;justify-content:center}.enl-pwa-top418.on{background:#e8f7ef;border-color:#8bc6a6;color:#216647}.enl-pwa-top418.warn{background:#fff7ea;border-color:#e5bd78;color:#80591f}.enl418-dot{width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block}.enl418-overlay{position:fixed;inset:0;z-index:100000;background:rgba(16,43,66,.54);display:flex;align-items:flex-start;justify-content:center;padding:calc(env(safe-area-inset-top) + 18px) 10px 18px;overflow:auto}.enl418-modal{width:min(620px,100%);margin:auto;background:#fff;border-radius:22px;border:1px solid #bfd8ea;box-shadow:0 22px 60px rgba(15,52,79,.24);overflow:hidden}.enl418-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 18px 14px;background:#eef8ff;border-bottom:1px solid #cfe2ef}.enl418-head h2{margin:0;color:#173b66;font-size:22px}.enl418-head p{margin:5px 0 0;color:#647c8e;font-size:13px;line-height:1.45}.enl418-close{width:44px;height:44px;border:1px solid #bfd4e3;border-radius:11px;background:#fff;color:#315873;font-size:24px}.enl418-body{padding:16px;display:grid;gap:12px}.enl418-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.enl418-step{padding:11px;border:1px solid #d6e3ec;border-radius:12px;background:#f9fcfe}.enl418-step small{display:block;color:#778b9b;font-weight:800;font-size:10px}.enl418-step b{display:block;margin-top:4px;color:#274e6b;font-size:13px}.enl418-guide{padding:12px 13px;border-radius:12px;background:#f1f8fd;color:#315d7c;line-height:1.55;font-size:13px}.enl418-guide strong{color:#174d78}.enl418-message{min-height:20px;color:#526d81;font-size:13px;font-weight:800}.enl418-message.ok{color:#226b49}.enl418-message.err{color:#a43c3c}.enl418-pref-list{display:grid;gap:7px}.enl418-pref{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #d6e3ec;border-radius:12px;background:#fff}.enl418-pref b{display:block;color:#264e6c;font-size:14px}.enl418-pref small{display:block;margin-top:3px;color:#748797;font-size:11px;line-height:1.35}.enl418-pref input{width:23px;height:23px;accent-color:#1e5d91;flex:0 0 auto}.enl418-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.enl418-actions button{min-height:50px;border:1px solid #a9c6da;border-radius:12px;background:#fff;color:#24516f;font-weight:950;font-size:14px}.enl418-actions .primary{grid-column:1/-1;border-color:#1e5d91;background:#1e5d91;color:#fff;font-size:16px}.enl418-actions .danger{color:#9a3c3c;border-color:#dfb1b1}.enl418-ios-steps{margin:8px 0 0;padding-left:20px}.enl418-ios-steps li{margin:6px 0}.topbar .enl-pwa-top418{flex:0 0 auto}@media(max-width:700px){.topbar{flex-wrap:wrap}.topbar .enl-pwa-top418{order:3;width:100%;margin-top:5px}.enl418-status{grid-template-columns:1fr}.enl418-actions{grid-template-columns:1fr}.enl418-actions .primary{grid-column:auto}.enl418-modal{border-radius:18px}.enl418-body{padding:13px}}
  `;document.head.appendChild(s)}
  function setMessage(text,kind=''){const el=document.getElementById('enl418Message');if(el){el.textContent=text||'';el.className=`enl418-message ${kind}`.trim()}}
  function permissionLabel(){if(!supportsPush())return '지원 안 됨';if(Notification.permission==='granted')return '허용됨';if(Notification.permission==='denied')return '차단됨';return '확인 필요'}
  async function installationLabel(){if(isStandalone())return '설치됨';if(isIOS())return '홈 화면 추가 필요';if(deferredInstall)return '설치 가능';return '브라우저 사용 중'}
  async function subscriptionLabel(){const s=await currentSub();return s?'연결됨':'연결 필요'}

  async function updateTopButton(){
    const btn=document.getElementById('enlPwaTop418');if(!btn)return;let on=false;try{on=Notification.permission==='granted'&&!!(await currentSub())}catch(e){}btn.classList.toggle('on',on);btn.classList.toggle('warn',!on&&('Notification' in window)&&window.Notification.permission==='denied');btn.innerHTML=on?'<span class="enl418-dot"></span> 알림 켜짐':'🔔 알림 설정';btn.title=on?'알림 설정 및 테스트':'PWA 설치와 알림을 설정합니다.';
  }
  async function renderStatus(){
    const install=document.getElementById('enl418InstallState'),perm=document.getElementById('enl418PermissionState'),sub=document.getElementById('enl418SubState');if(install)install.textContent=await installationLabel();if(perm)perm.textContent=permissionLabel();if(sub)sub.textContent=await subscriptionLabel();await updateTopButton();
  }
  function platformGuide(){
    if(isIOS()&&!isStandalone())return `<div class="enl418-guide"><strong>아이폰 설치 방법</strong><ol class="enl418-ios-steps"><li>${isKakao()?'카카오톡 안의 브라우저가 아니라 Safari에서 이 주소를 열어주세요.':'Safari 하단의 공유 버튼을 누르세요.'}</li><li><b>홈 화면에 추가</b>를 선택해 사고보고앱을 설치하세요.</li><li>홈 화면의 <b>사고보고앱</b>으로 다시 연 뒤 상단 <b>알림 설정</b>을 누르면 푸시 권한이 이어집니다.</li></ol><small>iPhone은 보안정책상 웹사이트가 사용자를 대신해 앱을 자동 설치할 수 없습니다.</small></div>`;
    if(isKakao()&&!isStandalone())return `<div class="enl418-guide"><strong>기본 브라우저에서 설치해 주세요.</strong><br>카카오톡 내부 브라우저에서는 설치 버튼이 제한될 수 있습니다. Android는 Chrome 또는 기본 브라우저로 이 주소를 연 뒤 다시 <b>알림 설정</b>을 눌러주세요.</div>`;
    if(!supportsPush())return `<div class="enl418-guide"><strong>이 브라우저에서는 푸시 알림을 사용할 수 없습니다.</strong><br>최신 Safari 또는 Chrome 계열 브라우저로 접속해 주세요.</div>`;
    return `<div class="enl418-guide"><strong>한 번만 설정하면 됩니다.</strong><br>${isStandalone()?'앱 설치가 확인되었습니다. 아래 버튼을 눌러 휴대폰 알림 권한을 허용해 주세요.':'아래 버튼을 누르면 앱 설치와 알림 권한 설정을 순서대로 진행합니다.'}</div>`;
  }
  async function openModal(){
    const u=actor();if(!u)return alert('로그인 후 알림을 설정할 수 있습니다.');ensureCss();document.getElementById('enl418Overlay')?.remove();const p=loadPrefs(u),wrap=document.createElement('div');wrap.id='enl418Overlay';wrap.className='enl418-overlay';wrap.innerHTML=`<section class="enl418-modal" role="dialog" aria-modal="true" aria-labelledby="enl418Title"><div class="enl418-head"><div><h2 id="enl418Title">알림 설정</h2><p>PWA 설치 · 푸시 권한 · 역할별 알림을 한 곳에서 관리합니다.</p></div><button type="button" class="enl418-close" data-enl-close aria-label="닫기">×</button></div><div class="enl418-body"><div class="enl418-status"><div class="enl418-step"><small>앱 설치</small><b id="enl418InstallState">확인 중</b></div><div class="enl418-step"><small>휴대폰 알림 권한</small><b id="enl418PermissionState">확인 중</b></div><div class="enl418-step"><small>푸시 연결</small><b id="enl418SubState">확인 중</b></div></div>${platformGuide()}<div><div class="ey">받을 알림</div><div class="enl418-pref-list">${prefRows(u,p)}</div></div><div id="enl418Message" class="enl418-message"></div><div class="enl418-actions"><button type="button" class="primary" id="enl418Setup">${isStandalone()?'알림 켜기':'설치 및 알림 켜기'}</button><button type="button" id="enl418Test">테스트 알림 보내기</button><button type="button" class="danger" id="enl418Off">이 기기 알림 끄기</button></div></div></section>`;document.body.appendChild(wrap);
    const close=()=>wrap.remove();wrap.querySelector('[data-enl-close]').onclick=close;wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
    wrap.querySelectorAll('[data-enl-pref]').forEach(input=>input.addEventListener('change',async()=>{const next=loadPrefs(u);wrap.querySelectorAll('[data-enl-pref]').forEach(x=>next[x.dataset.enlPref]=x.checked);if((roleNorm(u.role)==='manager'||roleNorm(u.role)==='executive'))next.urgent=true;savePrefs(u,next);try{const sub=await currentSub();if(sub)await api('preferences',{actor:u,endpoint:sub.endpoint,preferences:next});setMessage('알림 종류 설정을 저장했습니다.','ok')}catch(e){setMessage('알림 종류 저장에 실패했습니다. 다시 시도해 주세요.','err')}}));
    document.getElementById('enl418Setup').onclick=setupAll;
    document.getElementById('enl418Test').onclick=sendTest;
    document.getElementById('enl418Off').onclick=disablePush;
    await renderStatus();
  }

  async function setupPushOnly(){
    const u=actor();if(!u)throw new Error('login_required');if(!supportsPush())throw new Error('push_unsupported');if(isIOS()&&!isStandalone())throw new Error('ios_install_required');
    setMessage('휴대폰 알림 권한을 확인하고 있습니다…');
    let perm=Notification.permission;if(perm==='default')perm=await Notification.requestPermission();if(perm!=='granted')throw new Error(perm==='denied'?'permission_denied':'permission_not_granted');
    const reg=await ensureSw(),h=await health();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(h.vapidPublicKey)});
    const prefs=loadPrefs(u);await api('subscribe',{actor:u,subscription:sub.toJSON(),preferences:prefs,userAgent:navigator.userAgent});
    setMessage('푸시 연결이 완료되었습니다. 테스트 알림을 보내고 있습니다…','ok');await api('test',{actor:u,endpoint:sub.endpoint});setMessage('설정 완료. 잠금화면에 테스트 알림이 도착하는지 확인해 주세요.','ok');await renderStatus();return sub;
  }
  async function setupAll(){
    const btn=document.getElementById('enl418Setup');if(btn){btn.disabled=true;btn.textContent='설정 중…'};
    try{
      if(isIOS()&&!isStandalone()){setMessage('아이폰은 먼저 홈 화면에 앱을 추가한 뒤, 설치된 앱에서 다시 알림 설정을 눌러주세요.','err');return}
      if(!isStandalone()&&deferredInstall){setMessage('앱 설치 창을 열고 있습니다…');deferredInstall.prompt();const choice=await deferredInstall.userChoice;if(choice?.outcome!=='accepted'){setMessage('앱 설치가 취소되었습니다. 설치 후 다시 알림 설정을 진행해 주세요.','err');return}deferredInstall=null;}
      else if(!isStandalone()&&isKakao()){setMessage('카카오톡 내부 브라우저에서는 설치가 제한될 수 있습니다. Safari 또는 Chrome에서 다시 열어주세요.','err');return}
      await setupPushOnly();
    }catch(e){const m=String(e?.message||e);if(m==='permission_denied')setMessage('휴대폰에서 알림 권한이 차단되어 있습니다. 브라우저 또는 설치 앱의 알림 권한을 허용한 뒤 다시 시도해 주세요.','err');else if(m==='push_unsupported')setMessage('이 브라우저에서는 푸시 알림을 지원하지 않습니다. 최신 Safari 또는 Chrome으로 접속해 주세요.','err');else setMessage('알림 설정을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.','err');console.error('PWA push setup failed',e)}finally{if(btn){btn.disabled=false;btn.textContent=isStandalone()?'알림 켜기':'설치 및 알림 켜기'}await renderStatus()}
  }
  async function sendTest(){const u=actor();if(!u)return;try{const sub=await currentSub();if(!sub){setMessage('먼저 알림을 켜주세요.','err');return}setMessage('테스트 알림을 보내고 있습니다…');await api('test',{actor:u,endpoint:sub.endpoint});setMessage('테스트 알림을 보냈습니다.','ok')}catch(e){setMessage('테스트 알림 전송에 실패했습니다. 알림을 다시 켜주세요.','err')}}
  async function disablePush(){const u=actor();if(!u)return;try{const sub=await currentSub();if(sub){try{await api('unsubscribe',{actor:u,endpoint:sub.endpoint})}catch(e){}await sub.unsubscribe()}setMessage('이 기기의 사고보고앱 알림을 껐습니다.','ok');await renderStatus()}catch(e){setMessage('알림 해제 중 오류가 발생했습니다.','err')}}

  function injectTopButton(){
    const u=actor(),top=document.querySelector('.topbar');if(!u||!top)return;let btn=document.getElementById('enlPwaTop418');if(!btn){btn=document.createElement('button');btn.type='button';btn.id='enlPwaTop418';btn.className='enl-pwa-top418';btn.innerHTML='🔔 알림 설정';btn.addEventListener('click',openModal);const user=top.querySelector('.user-wrap');if(user)top.insertBefore(btn,user);else top.appendChild(btn)}updateTopButton();if(!flushedUsers.has(String(u.id||''))){flushedUsers.add(String(u.id||''));setTimeout(flush,500)}
  }
  function scheduleInject(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;injectTopButton()})}

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;scheduleInject()});
  window.addEventListener('appinstalled',()=>{deferredInstall=null;setTimeout(()=>{renderStatus();updateTopButton()},250)});
  navigator.serviceWorker?.addEventListener?.('controllerchange',()=>updateTopButton());
  const observer=new MutationObserver(scheduleInject);observer.observe(document.documentElement,{childList:true,subtree:true});ensureCss();scheduleInject();

  const mutatingWorkflow=new Set(['inquiry_create','inquiry_reply','inquiry_close','comment_add','comment_reply']);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:String(input?.url||'');let body=null;try{body=JSON.parse(init?.body||'null')}catch(e){}
    const res=await rawFetch(input,init);
    try{
      const action=String(body?.action||''),u=actor();
      if(res.ok&&u&&((url.includes('/functions/v1/enl-incident-sync-v411')&&action==='push')||(url.includes('/functions/v1/enl-workflow-v412')&&mutatingWorkflow.has(action))))setTimeout(flush,140);
      if(res.ok&&u&&['manager','executive'].includes(roleNorm(u.role))&&url.includes('/functions/v1/enl-incident-sync-v411')&&action==='acknowledge'){
        const incidentId=String(body?.incidentId||'');if(incidentId){lastReaderIncidentId=incidentId;setTimeout(()=>api('management_view',{actor:u,incidentId,documentType:'incident_report'}).then(flush).catch(()=>{}),120)}
      }
    }catch(e){}
    return res;
  };

  document.addEventListener('click',e=>{
    const u=actor();if(!u||!['manager','executive'].includes(roleNorm(u.role)))return;const t=e.target?.closest?.('button,a,summary');if(!t)return;
    const open=t.closest?.('[data-reader-open],[data-inc-id]');if(open){const id=String(open.dataset.readerOpen||open.dataset.incId||'');if(id){lastReaderIncidentId=id;setTimeout(()=>api('management_view',{actor:u,incidentId:id,documentType:'incident_report'}).then(flush).catch(()=>{}),80)}return}
    if(lastReaderIncidentId&&document.getElementById('modalRoot')?.contains(t)&&/사고\s*조치|조치\s*보고|개선\s*조치/.test(String(t.textContent||''))){setTimeout(()=>api('management_view',{actor:u,incidentId:lastReaderIncidentId,documentType:'corrective_action'}).then(flush).catch(()=>{}),80)}
  },true);

  window.ENL_PWA_PUSH_VERSION=VERSION;
})();
