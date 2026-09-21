/* E&L Accident Report App v4.3.7 - HQ push readiness dashboard */
(function(){
  'use strict';
  const VERSION='4.3.7-hq-notify4';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-admin-v437';
  const CLIENT='incident-report-v2';
  const PENDING_KEY='enl_pending_pushcheck_v437';
  let cache=null,cacheAt=0,loading=null,timer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const current=()=>{try{return window.currentUser?.()||null}catch(e){return null}};
  const actor=u=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  const isSafety=u=>roleNorm(u?.role)==='safety';
  const credentials=u=>{
    const direct=String(u?.passwordHash||'').trim();if(direct)return direct;
    try{
      const local=(data?.users||[]).find(x=>String(x?.id||'')===String(u?.id||''));
      return String(local?.passwordHash||'').trim();
    }catch(e){return ''}
  };
  const fmtDate=v=>{if(!v)return '없음';try{return new Date(v).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}};

  async function api(action,extra={},timeout=15000){
    const u=current(),hash=credentials(u);
    if(!u||!hash)throw new Error('login_refresh_required');
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const t=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action,actor:actor(u),actorPasswordHash:hash,...extra}),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(t)clearTimeout(t)}
  }

  function css(){
    if(document.getElementById('enl437Css'))return;
    const s=document.createElement('style');s.id='enl437Css';s.textContent=`
      #enl437Host{margin:0 0 14px}.enl437-host-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.enl437-host-title h3{margin:0;color:#174d78;font-size:15px}.enl437-refresh{min-height:36px;border:1px solid #a9c6da;border-radius:9px;background:#fff;color:#24516f;padding:0 10px;font-weight:900}.enl437-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}
      .enl437-card{padding:11px 12px;border:1px solid #d8e4ec;border-radius:12px;background:#f9fcfe}.enl437-card small{display:block;color:#748797;font-weight:850;font-size:11px}.enl437-card b{display:block;margin-top:4px;color:#244f6e;font-size:20px}.enl437-card.ready{background:#eef8f2;border-color:#b8ddc8}.enl437-card.warn{background:#fff8eb;border-color:#ead0a0}.enl437-card.off{background:#fff3f3;border-color:#ecc7c7}
      .enl437-summary-note{grid-column:1/-1;color:#718397;font-size:11px;line-height:1.5;padding:0 2px}
      .sa415-hq-row.enl437-row{grid-template-columns:minmax(0,1.25fr) minmax(90px,.55fr) minmax(150px,.78fr) minmax(190px,1fr) auto}
      .enl437-statuscell{display:grid;gap:5px;min-width:0}.enl437-badge{display:inline-flex;width:max-content;max-width:100%;align-items:center;gap:5px;min-height:28px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:950}
      .enl437-badge.ready{background:#e8f6ee;color:#216747}.enl437-badge.warn{background:#fff3db;color:#815b20}.enl437-badge.off{background:#f2f4f6;color:#697783}.enl437-badge.fail{background:#fff0f0;color:#9b3e3e}
      .enl437-meta{font-size:11px;color:#657b8d;line-height:1.5;white-space:normal}.enl437-test{min-height:34px!important;border-color:#91b8d2!important;color:#1d5d89!important;background:#f3f9fd!important}
      .enl437-test[disabled]{opacity:.55;cursor:wait}.enl437-testresult{font-size:10px;color:#708394;line-height:1.35}
      @media(max-width:920px){.sa415-hq-row.enl437-row{grid-template-columns:1fr 1fr}.enl437-statuscell{grid-column:1/-1}.enl437-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:480px){.sa415-hq-row.enl437-row{grid-template-columns:1fr}.enl437-summary{grid-template-columns:1fr 1fr}.enl437-summary-note{grid-column:1/-1}.sa415-hq-row .sa415-hq-actions{justify-content:flex-start}}
    `;document.head.appendChild(s);
  }

  async function status(force=false){
    const u=current();if(!isSafety(u))return null;
    if(!credentials(u))throw new Error('login_refresh_required');
    if(!force&&cache&&Date.now()-cacheAt<30000)return cache;
    if(loading)return loading;
    loading=api('status_list').then(x=>{cache=x;cacheAt=Date.now();return x}).finally(()=>{loading=null});
    return loading;
  }

  function stateInfo(x){
    if(!x||x.state==='not_configured')return {label:'미설정',cls:'off'};
    if(x.state==='ready')return {label:'정상',cls:'ready'};
    if(x.state==='inactive')return {label:'비활성',cls:'off'};
    if(x.lastTest?.status==='failed')return {label:'테스트 실패',cls:'fail'};
    return {label:'확인 필요',cls:'warn'};
  }
  function deviceText(x){
    if(!x?.deviceCount)return '푸시 연결 없음';
    const d=x.latestDevice||{};
    const install=d.displayMode==='standalone'?'앱 실행 확인':d.displayMode==='browser'?'브라우저 실행':'설치형 실행 미확인';
    const perm=d.notificationPermission==='granted'?'알림 허용':d.notificationPermission==='denied'?'알림 차단':'권한 미확인';
    return `${install} · ${perm} · 등록 ${x.deviceCount}대`;
  }
  function testText(x){
    const t=x?.lastTest;if(!t)return '수신 테스트 미실시';
    if(t.status==='confirmed')return `수신 확인 ${fmtDate(t.confirmedAt)}`;
    if(t.status==='sent')return `발송 성공 ${fmtDate(t.at)} · 확인 대기`;
    if(t.status==='failed')return `발송 실패 ${fmtDate(t.at)}`;
    return `테스트 처리 중 ${fmtDate(t.at)}`;
  }

  function host(){
    const list=document.getElementById('sa415HqList');if(!list)return null;
    let h=document.getElementById('enl437Host');
    if(!h){h=document.createElement('div');h.id='enl437Host';list.parentNode.insertBefore(h,list)}
    return h;
  }
  function renderSummary(data){
    const h=host();if(!h)return;
    const s=data?.summary||{};
    const html=`<div class="enl437-host-title"><h3>경영진 앱·알림 상태</h3><button type="button" class="enl437-refresh" id="enl437Refresh">상태 새로고침</button></div><div id="enl437Summary" class="enl437-summary"><div class="enl437-card"><small>경영진·관리자</small><b>${Number(s.total||0)}</b></div><div class="enl437-card ready"><small>알림 정상</small><b>${Number(s.ready||0)}</b></div><div class="enl437-card warn"><small>확인 필요</small><b>${Number(s.needsCheck||0)}</b></div><div class="enl437-card off"><small>미설정</small><b>${Number(s.notConfigured||0)}</b></div><div class="enl437-summary-note">정상은 설치형 앱 실행·알림 권한·푸시 연결이 확인되었거나, 최근 30일 안에 테스트 알림의 ‘확인’을 눌러 실제 수신이 검증된 상태입니다.</div></div>`;
    if(h.innerHTML!==html)h.innerHTML=html;
    const refresh=document.getElementById('enl437Refresh');if(refresh)refresh.onclick=()=>decorate(true);
  }
  function renderHostError(message){
    const h=host();if(!h)return;
    h.innerHTML=`<div class="enl437-host-title"><h3>경영진 앱·알림 상태</h3><button type="button" class="enl437-refresh" id="enl437Refresh">다시 확인</button></div><div class="sa415-empty">${esc(message)}</div>`;
    const refresh=document.getElementById('enl437Refresh');if(refresh)refresh.onclick=()=>decorate(true);
  }

  let confirmWatchTimer=null,confirmWatchCount=0;
  function stopConfirmWatch(){if(confirmWatchTimer){clearInterval(confirmWatchTimer);confirmWatchTimer=null}confirmWatchCount=0}
  function startConfirmWatch(userId){
    stopConfirmWatch();confirmWatchCount=0;
    confirmWatchTimer=setInterval(async()=>{
      if(!document.getElementById('enl437Host')||document.visibilityState==='hidden'){stopConfirmWatch();return}
      confirmWatchCount++;
      try{
        const data=await status(true),row=(data?.users||[]).find(x=>String(x.userId)===String(userId));
        renderSummary(data);renderRows(data);
        if(row?.lastTest?.status==='confirmed'||row?.lastTest?.status==='failed'||confirmWatchCount>=30)stopConfirmWatch();
      }catch(e){if(confirmWatchCount>=30)stopConfirmWatch()}
    },4000);
  }
  function bindTest(button,userId,name){
    button.onclick=async ev=>{
      ev.preventDefault();ev.stopPropagation();
      if(!confirm(`${name||'대상 사용자'}에게 테스트 알림을 보낼까요?`))return;
      button.disabled=true;const old=button.textContent;button.textContent='발송 중…';
      try{
        const r=await api('test_send',{targetUserId:userId},20000);
        alert(r.sent>0?`테스트 알림을 ${r.sent}대 기기로 보냈습니다. 대상자가 알림의 ‘확인’을 누르면 자동으로 수신 확인·정상 상태로 바뀝니다.`:'테스트 알림을 보내지 못했습니다.');
        cache=null;await decorate(true);if(r.sent>0)startConfirmWatch(userId);
      }catch(e){
        const m=String(e?.message||'');
        if(m==='not_configured')alert('등록된 푸시 기기가 없습니다. 대상자가 앱에서 알림 설정을 먼저 완료해야 합니다.');
        else if(m==='login_refresh_required'||m==='forbidden')alert('보안 확인을 위해 안전관리자 계정에서 다시 로그인한 뒤 이용해 주세요.');
        else alert('테스트 알림을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }finally{button.disabled=false;button.textContent=old}
    };
  }

  function rowUserId(row){
    const el=row.querySelector('[data-sa415-hq-edit],[data-sa415-hq-pw],[data-pm434-hq-edit],[data-pm434-hq-pw]');
    if(!el)return '';
    return String(el.dataset.sa415HqEdit||el.dataset.sa415HqPw||el.dataset.pm434HqEdit||el.dataset.pm434HqPw||'');
  }
  function renderRows(data){
    const map=new Map((data?.users||[]).map(x=>[String(x.userId),x]));
    document.querySelectorAll('#sa415HqList .sa415-hq-row').forEach(row=>{
      const key=rowUserId(row);
      if(!key)return;
      const x=map.get(String(key));if(!x)return;
      row.classList.add('enl437-row');
      let cell=row.querySelector('.enl437-statuscell');
      if(!cell){cell=document.createElement('div');cell.className='enl437-statuscell';const actions=row.querySelector('.sa415-hq-actions');row.insertBefore(cell,actions||null)}
      const st=stateInfo(x);
      const html=`<span class="enl437-badge ${st.cls}">${esc(st.label)}</span><div class="enl437-meta">${esc(deviceText(x))}<br>최근 확인 ${esc(fmtDate(x.lastSeenAt))}</div><div class="enl437-testresult">${esc(testText(x))}</div>`;
      if(cell.innerHTML!==html)cell.innerHTML=html;
      const actions=row.querySelector('.sa415-hq-actions');
      if(actions&&['manager','executive'].includes(roleNorm(x.role))){
        let test=actions.querySelector('.enl437-test');
        if(!test){test=document.createElement('button');test.type='button';test.className='enl437-test';test.textContent='수신 테스트';actions.appendChild(test)}
        bindTest(test,String(x.userId),x.name);
      }
    });
  }

  async function decorate(force=false){
    const u=current();if(!isSafety(u)||!document.getElementById('sa415HqList'))return;
    css();
    try{
      const data=await status(force);if(!data)return;renderSummary(data);renderRows(data);
    }catch(e){
      const m=String(e?.message||'');
      const text=(m==='login_refresh_required'||m==='forbidden')?'알림 상태 확인을 위해 안전관리자 계정에서 다시 로그인해 주세요.':'알림 상태를 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 확인해 주세요.';
      renderHostError(text);
    }
  }
  function schedule(force=false){clearTimeout(timer);timer=setTimeout(()=>decorate(force),90)}

  function captureCheck(){
    let u;try{u=new URL(location.href)}catch(e){return}
    const id=String(u.searchParams.get('pushcheck')||'').trim();if(!id)return;
    try{localStorage.setItem(PENDING_KEY,JSON.stringify({id,at:Date.now()}))}catch(e){}
    u.searchParams.delete('pushcheck');try{history.replaceState(history.state,'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')+u.hash)}catch(e){}
  }
  async function ackPending(){
    let p=null;try{p=JSON.parse(localStorage.getItem(PENDING_KEY)||'null')}catch(e){}
    if(!p?.id)return;if(Date.now()-Number(p.at||0)>24*60*60*1000){try{localStorage.removeItem(PENDING_KEY)}catch(e){}return}
    const u=current();if(!u||!credentials(u)||!['safety','manager','executive'].includes(roleNorm(u.role)))return;
    try{await api('ack_test',{checkId:String(p.id)});localStorage.removeItem(PENDING_KEY);cache=null;schedule(true)}catch(e){}
  }

  captureCheck();css();
  const mo=new MutationObserver(()=>{if(document.getElementById('sa415HqList'))schedule(false);ackPending()});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',()=>{ackPending();schedule(false)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){ackPending();schedule(false)}});
  setTimeout(()=>{ackPending();schedule(false)},180);
  window.enlRefreshHqPushStatus=()=>decorate(true);
  window.enlRenderHqNotificationStatus=force=>decorate(force!==false);
  window.ENL_HQ_NOTIFICATION_STATUS_VERSION=VERSION;
})();