/* E&L Accident Report App v3.9.1 - name-first login + expanded worker permissions */
(function(){
  const VERSION='3.9.1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const baseRenderShell=renderShell;
  const baseRoleName=roleName;
  function norm(v){return String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR')}
  function siteName(id){return siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>s.id===id)?.name||id||'-'}
  function escx(v){return typeof esc==='function'?esc(v):String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  async function api(body,timeout=9000){if(typeof window.enlIncidentApi==='function')return window.enlIncidentApi(body,timeout);throw new Error('api_not_ready')}
  roleName=function(role){if(role==='worker')return '일반근로자';if(role==='field')return '현장관리';if(role==='safety')return '안전관리자';if(role==='final')return '관리자';return baseRoleName?baseRoleName(role):'사용자'};

  function loginStyle(){if(document.getElementById('rbac391Style'))return;const s=document.createElement('style');s.id='rbac391Style';s.textContent=`
    .lookup-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.lookup-row button{min-width:92px;border:1.5px solid #173b66;background:#fff;color:#173b66;border-radius:11px;font-weight:900;padding:0 12px}.worksite-wrap.hide{display:none!important}.worksite-note{font-size:12px;color:#6a7b8d;margin-top:-4px}.worker-three-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.worker-shell [data-field-task="inquiry"],.worker-shell [data-field-task="hazard_report"],.worker-shell [data-field-task="hazard_improve"]{display:none!important}.worker-shell #sitePersonnelBtn,.worker-shell #changePwBtn{display:none!important}
    @media(max-width:560px){.lookup-row{grid-template-columns:1fr}.lookup-row button{min-height:46px}.worker-three-grid{grid-template-columns:1fr!important}.worker-three-grid .field-six-btn{aspect-ratio:auto!important;min-height:116px!important}}
  `;document.head.appendChild(s)}

  async function seedManagers(){
    try{
      const managers=(data.users||[]).filter(x=>x&&x.role==='field'&&x.active!==false&&x.siteId&&x.passwordHash&&MANAGER_POSITIONS.includes(x.position||'현장소장')).map(x=>({id:x.id,siteId:x.siteId,name:x.name,position:x.position||'현장소장',pinHash:x.passwordHash,active:true}));
      if(managers.length)await api({action:'manager_seed',managers},12000);
    }catch(e){console.warn('manager reseed skipped',e)}
  }
  setTimeout(seedManagers,1400);window.addEventListener('enl-directory-ready',()=>setTimeout(seedManagers,500));

  function renderLogin391(active='worker'){
    loginStyle();
    app.innerHTML=`<div class="login-page"><div class="login-card"><div class="login-brand"><div class="logo">E&L</div><div><h1>이앤엘 사고보고앱</h1><p>이름을 먼저 입력한 뒤 근무지를 선택해 주세요.</p></div></div><div class="rbac-login-tabs"><button type="button" data-login-mode="worker" class="${active==='worker'?'on':''}">일반근로자</button><button type="button" data-login-mode="field" class="${active==='field'?'on':''}">현장소장·파트장·서무</button><button type="button" data-login-mode="hq" class="${active==='hq'?'on':''}">안전관리자·관리자</button></div><div id="rbacLoginBody"></div><div class="footer-note">이앤엘 사고보고앱 v${VERSION}</div></div></div>`;
    document.querySelectorAll('[data-login-mode]').forEach(b=>b.onclick=()=>renderLogin391(b.dataset.loginMode));
    const root=document.getElementById('rbacLoginBody');
    if(active==='worker'){
      root.innerHTML=`<form id="workerLogin391" class="rbac-login-form"><label><span>1. 근무자 이름</span><div class="lookup-row"><input id="workerName391" autocomplete="name" placeholder="등록된 이름 입력" required><button type="button" id="workerLookupBtn">근무지 확인</button></div></label><label id="workerSiteWrap" class="worksite-wrap hide"><span>2. 소속 근무지</span><select id="workerSite391" required></select></label><div class="worksite-note">등록된 이름과 일치하는 근무지만 표시됩니다.</div><div id="rbacLoginError" class="rbac-login-error hide"></div><button class="primary" type="submit">로그인</button></form>`;
      document.getElementById('workerLookupBtn').onclick=()=>lookupSites('worker');document.getElementById('workerLogin391').onsubmit=loginWorker391;
    }else if(active==='field'){
      root.innerHTML=`<form id="managerLogin391" class="rbac-login-form"><label><span>1. 이름</span><div class="lookup-row"><input id="managerName391" autocomplete="name" placeholder="등록된 이름 입력" required><button type="button" id="managerLookupBtn">근무지 확인</button></div></label><label id="managerSiteWrap" class="worksite-wrap hide"><span>2. 소속 근무지</span><select id="managerSite391" required></select></label><label><span>3. PIN 번호</span><input id="managerPin391" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="휴대폰 번호 뒷자리 4자리" required></label><div class="worksite-note">같은 이름으로 여러 사업장에 등록되어 있으면 해당 근무지만 선택할 수 있습니다.</div><div id="rbacLoginError" class="rbac-login-error hide"></div><button class="primary" type="submit">현장관리 로그인</button></form>`;
      document.getElementById('managerLookupBtn').onclick=()=>lookupSites('field');document.getElementById('managerLogin391').onsubmit=loginManager391;
    }else{
      root.innerHTML=`<form id="hqLogin391" class="rbac-login-form"><label><span>아이디</span><input id="hqId391" autocomplete="username" required placeholder="아이디 입력"></label><label><span>PIN / 비밀번호</span><input id="hqPw391" type="password" autocomplete="current-password" required placeholder="비밀번호 입력"></label><div id="rbacLoginError" class="rbac-login-error hide"></div><button class="primary" type="submit">로그인</button></form>`;
      document.getElementById('hqLogin391').onsubmit=loginHq391;
    }
  }
  renderLogin=()=>renderLogin391('worker');
  function err(msg){const e=document.getElementById('rbacLoginError');if(e){e.textContent=msg;e.classList.remove('hide')}}
  function fillSites(selectId,wrapId,people){
    const sel=document.getElementById(selectId),wrap=document.getElementById(wrapId);if(!sel||!wrap)return;
    const seen=new Set(),rows=[];for(const p of people||[]){const sid=p.site_id||p.siteId;if(!sid||seen.has(sid))continue;seen.add(sid);rows.push({id:sid,name:siteName(sid)})}
    rows.sort((a,b)=>a.name.localeCompare(b.name,'ko'));sel.innerHTML=rows.map(s=>`<option value="${escx(s.id)}">${escx(s.name)}</option>`).join('');wrap.classList.toggle('hide',rows.length===0);if(rows.length===1)sel.value=rows[0].id;return rows.length;
  }
  async function lookupSites(mode){
    const isWorker=mode==='worker',input=document.getElementById(isWorker?'workerName391':'managerName391'),name=input?.value.trim();if(!name){err('이름을 먼저 입력해 주세요.');return}
    let people=[];
    try{if(!isWorker)await seedManagers();const res=await api({action:'personnel_lookup',name,accessRole:isWorker?'worker':'field'});people=[...(res.people||[])]}catch(e){}
    if(!isWorker){for(const u of (data.users||[])){if(u?.role==='field'&&u.active!==false&&norm(u.name)===norm(name)&&u.siteId&&!people.some(p=>(p.site_id||p.siteId)===u.siteId)){people.push({site_id:u.siteId,name:u.name,job_title:u.position,access_role:'field'})}}}
    const count=fillSites(isWorker?'workerSite391':'managerSite391',isWorker?'workerSiteWrap':'managerSiteWrap',people);
    if(!count)err(isWorker?'등록된 근무자 이름이 없습니다. 현장소장·파트장·서무에게 근무자 등록을 요청해 주세요.':'해당 이름으로 등록된 현장관리 계정을 찾지 못했습니다.');
    else{const e=document.getElementById('rbacLoginError');e?.classList.add('hide')}
  }
  async function loginWorker391(e){e.preventDefault();const name=document.getElementById('workerName391').value.trim(),siteId=document.getElementById('workerSite391')?.value;if(!siteId){await lookupSites('worker');return}try{const res=await api({action:'worker_login',name,siteId});const p=res.person;session={userId:null,loggedAt:nowISO(),worker:{id:String(p.personnel_id),personnelId:String(p.personnel_id),name:p.name,position:p.job_title||'일반근로자',role:'worker',siteId:p.site_id,active:true}};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>window.enlIncidentSyncNow?.(),350)}catch(e2){err('이름과 선택한 근무지를 확인해 주세요.')}}
  async function loginManager391(e){e.preventDefault();const name=document.getElementById('managerName391').value.trim(),siteId=document.getElementById('managerSite391')?.value,pin=document.getElementById('managerPin391').value.trim();if(!siteId){await lookupSites('field');return}if(!/^[0-9]{4}$/.test(pin)){err('PIN은 휴대폰 번호 뒷자리 숫자 4자리입니다.');return}const pinHash=await sha256(pin);try{const res=await api({action:'manager_login',name,siteId,pinHash});const p=res.person;session={userId:null,loggedAt:nowISO(),manager:{id:String(p.personnel_id),personnelId:String(p.personnel_id),name:p.name,position:p.job_title||'현장관리',role:'field',siteId:p.site_id,active:true}};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>window.enlIncidentSyncNow?.(),350)}catch(e2){const local=(data.users||[]).find(x=>x?.role==='field'&&x.active!==false&&x.siteId===siteId&&norm(x.name)===norm(name)&&x.passwordHash===pinHash);if(local){session={userId:local.id,loggedAt:nowISO()};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>window.enlIncidentSyncNow?.(),350);return}err('이름, 근무지 또는 PIN 번호를 확인해 주세요.')}}
  async function loginHq391(e){e.preventDefault();const id=document.getElementById('hqId391').value.trim(),pw=document.getElementById('hqPw391').value,h=await sha256(pw);const u=(data.users||[]).find(x=>x.active!==false&&x.username===id&&['safety','final'].includes(x.role)&&x.passwordHash===h);if(!u){err('아이디 또는 비밀번호를 확인해 주세요.');return}session={userId:u.id,loggedAt:nowISO()};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>window.enlIncidentSyncNow?.(),350)}

  function patchWorker(u){
    document.body.classList.add('role-field');const shell=document.querySelector('.app-shell');shell?.classList.add('worker-shell','field-simple-mode');
    const grid=document.querySelector('.field-six-home .field-six-grid');if(grid){grid.classList.add('worker-three-grid');const wanted=['accident_report','accident_action','records'];grid.querySelectorAll('[data-field-task]').forEach(b=>{if(!wanted.includes(b.dataset.fieldTask))b.remove()});wanted.forEach((key,idx)=>{const b=grid.querySelector(`[data-field-task="${key}"]`);if(b){const n=b.querySelector('.field-six-no');if(n)n.textContent=String(idx+1).padStart(2,'0');grid.appendChild(b)}})}
    document.querySelectorAll('#sitePersonnelBtn,#changePwBtn,#operationsSimpleNav,#platformNav,.common-nav,.permission-strip,#safetySimpleNav').forEach(x=>x.remove?.()||x.classList.add('hide'));
    const chip=document.querySelector('.user-chip small');if(chip)chip.textContent=`일반근로자 · ${siteName(u.siteId)}`;
  }
  renderShell=function(u){
    const real=(u?.role==='worker'||u?.accessLevel==='worker')?(currentUser()?.role==='worker'?currentUser():u):u;
    if(real?.role==='worker'){
      const proxy={...real,role:'field',accessLevel:'worker',position:real.position||'일반근로자'};
      const r=baseRenderShell(proxy);setTimeout(()=>patchWorker(real),0);return r;
    }
    return baseRenderShell(u);
  };

  window.ENL_DEPLOY_VERSION=VERSION;
})();
