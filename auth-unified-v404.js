/* E&L Accident Report App v4.0.4 - unified login/session/UI + HQ account sync */
(function(){
  const VERSION='4.0.4';
  const HQ_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-hq-auth';
  const CLIENT='incident-report-v2';
  const baseShell=typeof renderShell==='function'?renderShell:null;
  const baseOpenIncident=typeof openIncidentModal==='function'?openIncidentModal:null;
  const baseOpenEdit=typeof openEditIncidentModal==='function'?openEditIncidentModal:null;
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const siteLabel=id=>siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>s.id===id)?.name||id||'-';

  function css(){
    if(document.getElementById('auth404Css'))return;
    const s=document.createElement('style');s.id='auth404Css';s.textContent=`
      .login-v404 .rbac-login-tabs{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .login-v404 .login-flow-note{font-size:12px;color:#687b8d;background:#f5f8fb;border-radius:9px;padding:9px 11px;line-height:1.5}
      .login-v404 .login-progress{min-height:20px;font-size:12px;color:#476985;font-weight:800}
      .login-v404 .login-progress.ok{color:#26733d}.login-v404 .login-progress.err{color:#a52c2c}
      .login-v404 .lookup-row button:disabled,.login-v404 .primary:disabled{opacity:.58;cursor:wait}
      .worker-shell .field-six-grid,.worker-shell .field-six-grid.worker-three-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .worker-shell .field-six-btn{display:grid!important}
      .worker-shell .field-task-back.v404-home-back,.worker-shell .field-task-back.v403-home-back,.worker-shell .field-task-back{display:flex!important}
      .v404-home-back{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:0 0 14px!important;padding:8px 10px!important;border:1px solid #9dbbd4!important;border-radius:12px!important;background:#eef6fc!important;box-shadow:0 4px 14px rgba(23,59,102,.11)!important}
      .v404-home-back button{min-height:44px!important;padding:0 17px!important;border:0!important;border-radius:10px!important;background:#173b66!important;color:#fff!important;font-size:15px!important;font-weight:950!important;cursor:pointer!important;box-shadow:0 3px 8px rgba(23,59,102,.2)!important}
      .v404-home-back span{font-size:12px!important;color:#45647f!important;font-weight:850!important;text-align:right!important}
      .v404-editor-banner{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 14px;padding:10px 12px;border:1px solid #c9ddeb;border-radius:11px;background:#eef6fc;color:#173b66}
      .v404-editor-banner span{font-size:12px;font-weight:800}.v404-editor-banner b{font-size:14px;font-weight:950}
      .v404-last-editor{margin-top:8px;padding:9px 10px;border-radius:9px;background:#f4f7fa;color:#4e687f;font-size:12px;font-weight:800}
      .hq-name-login-note{padding:9px 10px;background:#eef5fb;border-radius:9px;color:#365d7e;font-size:12px;line-height:1.5}
      @media(max-width:560px){.login-v404 .rbac-login-tabs{grid-template-columns:1fr!important}.worker-shell .field-six-grid,.worker-shell .field-six-grid.worker-three-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.worker-shell .field-six-btn{aspect-ratio:1/1!important;min-height:0!important}.v404-home-back{position:sticky!important;top:4px!important;z-index:31!important}.v404-editor-banner{align-items:flex-start;flex-direction:column}.v404-editor-banner b{font-size:15px}}
    `;document.head.appendChild(s);
  }

  async function incidentApi(body,timeout=9000){
    if(typeof window.enlIncidentApi==='function')return window.enlIncidentApi(body,timeout);
    throw new Error('incident_api_not_ready');
  }
  async function hqApi(body,timeout=9000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(HQ_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:ctl?.signal});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||`http_${r.status}`);return j;
    }finally{if(timer)clearTimeout(timer)}
  }
  function actor(u=currentUser?.()){return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:u.role||'',position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}

  function renderLoginBase(active='worker'){
    css();
    app.innerHTML=`<div class="login-page login-v404"><div class="login-card"><div class="login-brand"><div class="logo">E&L</div><div><h1>이앤엘 사고보고앱</h1><p>이름을 먼저 입력한 뒤 역할에 맞게 로그인해 주세요.</p></div></div><div class="rbac-login-tabs"><button type="button" data-v404-mode="worker">일반근로자</button><button type="button" data-v404-mode="field">현장소장·파트장·서무</button><button type="button" data-v404-mode="hq">안전관리자·관리자</button></div><div id="v404LoginBody"></div><div class="footer-note">이앤엘 사고보고앱 v${VERSION}</div></div></div>`;
    document.querySelectorAll('[data-v404-mode]').forEach(b=>b.onclick=()=>switchLoginMode(b.dataset.v404Mode));
    switchLoginMode(active);
  }
  function switchLoginMode(mode){
    document.querySelectorAll('[data-v404-mode]').forEach(b=>b.classList.toggle('on',b.dataset.v404Mode===mode));
    const root=document.getElementById('v404LoginBody');if(!root)return;
    if(mode==='worker'){
      root.innerHTML=`<form id="workerLogin391" class="rbac-login-form"><label><span>1. 근무자 이름</span><div class="lookup-row"><input id="v404WorkerName" autocomplete="name" placeholder="등록된 이름 입력" required><button type="button" id="v404WorkerLookup">근무지 확인</button></div></label><label id="v404WorkerSiteWrap" class="worksite-wrap hide"><span>2. 소속 근무지</span><select id="v404WorkerSite" required></select></label><div class="login-flow-note">이름과 일치하는 등록 근무지만 표시됩니다. 비밀번호 없이 로그인합니다.</div><div id="v404LoginProgress" class="login-progress"></div><div id="rbacLoginError" class="rbac-login-error hide"></div><button id="v404Submit" class="primary" type="submit">로그인</button></form>`;
      document.getElementById('v404WorkerLookup').onclick=()=>lookupPerson('worker');
      document.getElementById('workerLogin391').onsubmit=loginWorker;
    }else if(mode==='field'){
      root.innerHTML=`<form id="managerLogin391" class="rbac-login-form"><label><span>1. 이름</span><div class="lookup-row"><input id="v404FieldName" autocomplete="name" placeholder="등록된 이름 입력" required><button type="button" id="v404FieldLookup">근무지 확인</button></div></label><label id="v404FieldSiteWrap" class="worksite-wrap hide"><span>2. 소속 근무지</span><select id="v404FieldSite" required></select></label><label><span>3. PIN 번호</span><input id="v404FieldPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="휴대폰 번호 뒷자리 4자리" required></label><div class="login-flow-note">현장소장·파트장·서무는 이름 → 근무지 → 휴대폰 뒷자리 PIN 순서로 로그인합니다.</div><div id="v404LoginProgress" class="login-progress"></div><div id="rbacLoginError" class="rbac-login-error hide"></div><button id="v404Submit" class="primary" type="submit">현장관리 로그인</button></form>`;
      document.getElementById('v404FieldLookup').onclick=()=>lookupPerson('field');
      document.getElementById('managerLogin391').onsubmit=loginField;
    }else{
      root.innerHTML=`<form id="hqLogin391" class="rbac-login-form"><label><span>이름</span><input id="v404HqName" autocomplete="username" placeholder="등록된 이름 입력" required></label><label><span>비밀번호</span><input id="v404HqPw" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required></label><div class="hq-name-login-note">본사 사용자는 별도 아이디를 사용하지 않고 <b>등록된 이름</b>으로 로그인합니다.</div><div id="v404LoginProgress" class="login-progress"></div><div id="rbacLoginError" class="rbac-login-error hide"></div><button id="v404Submit" class="primary" type="submit">로그인</button></form>`;
      document.getElementById('hqLogin391').onsubmit=loginHq;
    }
  }
  renderLogin=function(){renderLoginBase('worker')};
  function progress(msg,kind=''){const p=document.getElementById('v404LoginProgress');if(p){p.textContent=msg||'';p.className=`login-progress ${kind}`.trim()}}
  function error(msg){const e=document.getElementById('rbacLoginError');if(e){e.textContent=msg;e.classList.remove('hide')}progress('', '')}
  function clearError(){document.getElementById('rbacLoginError')?.classList.add('hide')}
  function busy(on,label='확인 중…'){const b=document.getElementById('v404Submit');if(b)b.disabled=on;document.querySelectorAll('#v404LoginBody .lookup-row button').forEach(x=>x.disabled=on);if(on)progress(label)}
  function fillSites(people,selectId,wrapId){
    const sel=document.getElementById(selectId),wrap=document.getElementById(wrapId);if(!sel||!wrap)return 0;
    const rows=[],seen=new Set();for(const p of people||[]){const id=p.site_id||p.siteId;if(!id||seen.has(id))continue;seen.add(id);rows.push({id,name:p.site_name||siteLabel(id)})}
    rows.sort((a,b)=>a.name.localeCompare(b.name,'ko'));sel.innerHTML=rows.map(x=>`<option value="${ex(x.id)}">${ex(x.name)}</option>`).join('');wrap.classList.toggle('hide',!rows.length);if(rows.length===1)sel.value=rows[0].id;return rows.length;
  }
  async function lookupPerson(mode){
    clearError();const field=mode==='field',input=document.getElementById(field?'v404FieldName':'v404WorkerName');const name=input?.value.trim();if(!name)return error('이름을 먼저 입력해 주세요.');busy(true,'등록된 근무지를 확인하고 있습니다…');
    try{
      const res=await incidentApi({action:'personnel_lookup',name,accessRole:field?'field':'worker'},10000);let people=[...(res.people||[])];
      if(field){for(const u of (data.users||[])){if(u?.role==='field'&&u.active!==false&&u.siteId&&norm(u.name)===norm(name)&&!people.some(p=>(p.site_id||p.siteId)===u.siteId))people.push({site_id:u.siteId,site_name:siteLabel(u.siteId),name:u.name,job_title:u.position,access_role:'field'})}}
      const count=fillSites(people,field?'v404FieldSite':'v404WorkerSite',field?'v404FieldSiteWrap':'v404WorkerSiteWrap');
      if(!count)error(field?'해당 이름으로 등록된 현장관리 계정이 없습니다.':'등록된 일반근로자 이름이 없습니다.');else progress(count===1?'근무지 1곳을 확인했습니다.':'근무지가 여러 곳입니다. 로그인할 근무지를 선택해 주세요.','ok');
    }catch(e){error('근무지 정보를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.')}finally{busy(false)}
  }
  function finishPersonLogin(person,kind){
    const p={id:String(person.personnel_id||person.id),personnelId:String(person.personnel_id||person.id),name:person.name,position:person.job_title||person.position||(kind==='worker'?'일반근로자':'현장관리'),role:kind==='worker'?'worker':'field',siteId:person.site_id||person.siteId,active:true};
    session=kind==='worker'?{userId:null,loggedAt:nowISO(),worker:p}:{userId:null,loggedAt:nowISO(),manager:p};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>window.enlIncidentSyncNow?.(),250);
  }
  async function loginWorker(ev){ev.preventDefault();clearError();const name=document.getElementById('v404WorkerName').value.trim(),siteId=document.getElementById('v404WorkerSite')?.value;if(!siteId){await lookupPerson('worker');return}busy(true,'로그인 중…');try{const res=await incidentApi({action:'worker_login',name,siteId},10000);finishPersonLogin(res.person,'worker')}catch(e){error('이름과 선택한 근무지가 일치하지 않습니다.')}finally{busy(false)}}
  async function loginField(ev){ev.preventDefault();clearError();const name=document.getElementById('v404FieldName').value.trim(),siteId=document.getElementById('v404FieldSite')?.value,pin=document.getElementById('v404FieldPin').value.trim();if(!siteId){await lookupPerson('field');return}if(!/^\d{4}$/.test(pin))return error('PIN은 휴대폰 번호 뒷자리 숫자 4자리입니다.');busy(true,'로그인 중…');const pinHash=await sha256(pin);try{const res=await incidentApi({action:'manager_login',name,siteId,pinHash},10000);finishPersonLogin(res.person,'field')}catch(e){const local=(data.users||[]).find(x=>x.active!==false&&x.role==='field'&&x.siteId===siteId&&norm(x.name)===norm(name)&&x.passwordHash===pinHash);if(local){session={userId:local.id,loggedAt:nowISO()};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>window.enlIncidentSyncNow?.(),250);return}error('이름, 근무지 또는 PIN 번호를 확인해 주세요.')}finally{busy(false)}}

  function mergeHqLocal(user,passwordHash=''){
    if(!user?.id||!user?.name)return null;let x=(data.users||[]).find(v=>v.id===user.id)||(data.users||[]).find(v=>['safety','final'].includes(v.role)&&norm(v.name)===norm(user.name));
    if(!x){x={id:user.id,createdAt:nowISO()};data.users.push(x)}
    Object.assign(x,{username:user.name,name:user.name,role:user.role,department:user.department||'',position:user.position||'',siteId:null,active:user.active!==false,updatedAt:user.updatedAt||nowISO()});if(passwordHash)x.passwordHash=passwordHash;saveData();return x;
  }
  async function loginHq(ev){
    ev.preventDefault();clearError();const name=document.getElementById('v404HqName').value.trim(),pw=document.getElementById('v404HqPw').value;if(!name||!pw)return;busy(true,'로그인 중…');const h=await sha256(pw);let user=null;
    try{const res=await hqApi({action:'login',name,passwordHash:h},9000);user=mergeHqLocal(res.user,h)}catch(serverErr){user=(data.users||[]).find(x=>x.active!==false&&['safety','final'].includes(x.role)&&[x.name,x.username].some(v=>norm(v)===norm(name))&&x.passwordHash===h)||null}
    if(!user){busy(false);return error('이름 또는 비밀번호를 확인해 주세요.')}
    user.username=user.name;saveData();session={userId:user.id,loggedAt:nowISO()};saveSession();currentView='home';renderShell(currentUser());setTimeout(()=>{window.enlIncidentSyncNow?.();if(user.role==='safety')syncHqUsers(user)},250);
  }

  let hqSyncing=false;
  async function syncHqUsers(u=currentUser?.()){
    if(hqSyncing||u?.role!=='safety')return;hqSyncing=true;
    try{
      const local=(data.users||[]).filter(x=>['safety','final'].includes(x.role)&&x.name&&x.passwordHash).map(x=>({id:x.id,name:x.name,role:x.role,department:x.department||'',position:x.position||'',active:x.active!==false,passwordHash:x.passwordHash}));
      if(local.length)await hqApi({action:'seed',actor:actor(u),users:local},12000);
      const res=await hqApi({action:'list',actor:actor(u)},10000);
      for(const sv of res.users||[]){const old=(data.users||[]).find(x=>x.id===sv.id)||(data.users||[]).find(x=>['safety','final'].includes(x.role)&&norm(x.name)===norm(sv.name));const hash=old?.passwordHash||'';mergeHqLocal(sv,hash)}
    }catch(e){console.warn('HQ account sync skipped',e)}finally{hqSyncing=false}
  }
  window.enlSyncHqUsers=syncHqUsers;

  function goFieldHome(){currentView='home';try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}renderShell(currentUser())}
  function ensureHomeBack(){
    const u=currentUser?.();if(!u||!['worker','field'].includes(u.role)||!currentView||currentView==='home')return;const root=document.getElementById('view');if(!root)return;
    let bar=root.querySelector('.field-task-back');if(!bar){bar=document.createElement('div');bar.className='field-task-back v404-home-back';bar.innerHTML=`<button type="button">← 홈으로</button><span>${ex(siteLabel(u.siteId))}</span>`;root.insertAdjacentElement('afterbegin',bar)}else{bar.classList.add('v404-home-back');const b=bar.querySelector('button');if(b)b.textContent='← 홈으로'}
    const btn=bar.querySelector('button');if(btn)btn.onclick=goFieldHome;
  }
  function ensureWorkerMatchesField(){
    const u=currentUser?.();if(u?.role!=='worker')return;const shell=document.querySelector('.app-shell');shell?.classList.add('worker-shell','field-simple-mode');const grid=document.querySelector('.field-six-home .field-six-grid');if(!grid)return;grid.classList.remove('worker-three-grid');const wanted=['accident_report','accident_action','records','inquiry'];wanted.forEach((key,idx)=>{let b=grid.querySelector(`[data-field-task="${key}"]`);if(!b&&key==='inquiry'){b=document.createElement('button');b.type='button';b.className='field-six-btn';b.dataset.fieldTask='inquiry';b.innerHTML='<span class="field-six-no">04</span><strong>기타 문의</strong><small>안전관리자 정보 확인<br>및 문의</small>';grid.appendChild(b);b.onclick=()=>{currentView='field-inquiry';try{enlPlatformSection='hub'}catch(e){}renderShell(currentUser())}}if(b){b.style.display='';const n=b.querySelector('.field-six-no');if(n)n.textContent=String(idx+1).padStart(2,'0');grid.appendChild(b)}});document.getElementById('sitePersonnelBtn')?.remove();document.getElementById('changePwBtn')?.remove();
  }
  function editorName(){const u=currentUser?.();if(!u)return '사용자';return `${u.name||'사용자'}${u.position?' · '+u.position:''}`}
  function ensureEditorBanners(){
    const pairs=[[document.getElementById('unifiedReportForm'),'사고 보고 작성/수정자'],[document.getElementById('correctiveForm')||document.getElementById('unifiedCorrectiveForm'),'사고 조치 작성/수정자'],[document.getElementById('editIncidentForm'),'사고정보 수정자']];
    for(const [form,label] of pairs){if(!form||form.querySelector('.v404-editor-banner'))continue;const b=document.createElement('div');b.className='v404-editor-banner';b.innerHTML=`<span>${label}</span><b>${ex(editorName())}</b>`;const head=form.querySelector('.section-head');if(head)head.insertAdjacentElement('afterend',b);else form.insertAdjacentElement('afterbegin',b)}
  }
  function patchDetailEditors(id){
    const i=(data.incidents||[]).find(x=>x.id===id),modal=document.querySelector('#modalRoot .modal');if(!i||!modal)return;const detail=modal.querySelector('.detail');if(!detail)return;
    const existing=[...detail.querySelectorAll('.detail-row b')].map(b=>b.textContent.trim());
    const rows=[];if(!existing.includes('사고 최종수정자'))rows.push(`<div class="detail-row author-highlight"><b>사고 최종수정자</b><span>${ex(i.lastModifiedBy||i.reporterName||'-')}</span></div>`);if(i.corrective&&!existing.includes('조치 최종수정자'))rows.push(`<div class="detail-row author-highlight"><b>조치 최종수정자</b><span>${ex(i.corrective.lastModifiedBy||i.corrective.submittedBy||'-')}</span></div>`);if(rows.length)detail.insertAdjacentHTML('beforeend',rows.join(''));
  }
  function patchUi(){css();ensureWorkerMatchesField();ensureHomeBack();ensureEditorBanners()}

  if(baseShell){renderShell=function(u){const r=baseShell(u);setTimeout(patchUi,0);setTimeout(patchUi,80);if((u?.role||currentUser?.()?.role)==='safety')setTimeout(()=>syncHqUsers(currentUser?.()),300);return r}}
  if(baseOpenIncident){openIncidentModal=function(id,admin,u){const r=baseOpenIncident(id,admin,u);setTimeout(()=>{patchDetailEditors(id);ensureEditorBanners()},0);return r}}
  if(baseOpenEdit){openEditIncidentModal=function(i,u){const r=baseOpenEdit(i,u);setTimeout(ensureEditorBanners,0);return r}}
  ['renderUnifiedReport','renderUnifiedActions','renderUnifiedIncidents'].forEach(name=>{try{const base=window[name];if(typeof base==='function')window[name]=function(){const r=base.apply(this,arguments);setTimeout(patchUi,0);return r}}catch(e){}});

  openUserModal=function(user,u){
    const isNew=!user,role=user?.role==='safety'?'safety':'final';
    openModal(`<div class="modal-head"><div><div class="ey">${isNew?'CREATE HQ USER':'EDIT HQ USER'}</div><h2>${isNew?'본사 사용자 생성':'본사 사용자 정보 수정'}</h2></div><button class="x" data-close>×</button></div><form id="userForm"><div class="formgrid"><label class="lbl"><span>이름 *</span><input id="uName" value="${ex(user?.name||'')}" required placeholder="예: 홍길동"></label><label class="lbl"><span>부서</span><input id="uDepartment" value="${ex(user?.department||'')}" placeholder="예: 경영관리부"></label><label class="lbl"><span>직급</span><input id="uPosition" value="${ex(user?.position||'')}" placeholder="예: 과장, 상무"></label><label class="lbl"><span>역할 *</span><select id="uRole"><option value="safety" ${role==='safety'?'selected':''}>안전관리자</option><option value="final" ${role==='final'?'selected':''}>관리자</option></select></label></div><div class="hq-name-login-note" style="margin:10px 0">로그인 아이디는 별도로 만들지 않습니다. <b>입력한 이름이 로그인 아이디</b>가 됩니다.</div>${isNew?'<label class="lbl"><span>초기 비밀번호 *</span><input id="uPw" type="password" minlength="4" required placeholder="4자 이상"></label>':'<label class="lbl"><span>새 비밀번호 (선택)</span><input id="uPw" type="password" minlength="4" placeholder="변경하지 않으려면 비워두기"></label>'}<label class="lbl"><span>계정 상태</span><select id="uActive" ${user?.id===u.id?'disabled':''}><option value="true" ${user?.active!==false?'selected':''}>활성</option><option value="false" ${user?.active===false?'selected':''}>비활성</option></select></label><button id="uSave404" class="primary full">${isNew?'계정 생성':'변경사항 저장'}</button></form>`);
    document.getElementById('userForm').onsubmit=async ev=>{ev.preventDefault();const name=document.getElementById('uName').value.trim(),department=document.getElementById('uDepartment').value.trim(),position=document.getElementById('uPosition').value.trim(),newRole=document.getElementById('uRole').value,pw=document.getElementById('uPw').value,active=document.getElementById('uActive').value==='true';if(!name)return alert('이름을 입력해 주세요.');if((data.users||[]).some(x=>['safety','final'].includes(x.role)&&norm(x.name)===norm(name)&&x.id!==user?.id))return alert('같은 이름의 본사 사용자 계정이 이미 있습니다.');if(user?.id===u.id&&newRole!=='safety')return alert('현재 로그인한 안전관리자 자신의 역할은 변경할 수 없습니다.');const hash=pw?await sha256(pw):(user?.passwordHash||'');if(!hash)return alert('비밀번호를 입력해 주세요.');const payload={id:user?.id||uid('u'),name,username:name,department,position,role:newRole,siteId:null,active:user?.id===u.id?true:active,passwordHash:hash};const btn=document.getElementById('uSave404');btn.disabled=true;btn.textContent='저장 중…';try{const res=await hqApi({action:'upsert',actor:actor(u),user:payload},12000);const saved=mergeHqLocal({...res.user,id:payload.id},hash);saved.username=saved.name;saveData();closeModal();alert(`${saved.name} 계정이 저장되었습니다. 로그인 아이디는 이름입니다.`);renderShell(currentUser()||u)}catch(e){console.warn(e);alert('본사 사용자 계정을 공용 서버에 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');btn.disabled=false;btn.textContent=isNew?'계정 생성':'변경사항 저장'}};
  };

  openAdminPasswordReset=function(target,u){
    if(!target)return;openModal(`<div class="modal-head"><div><div class="ey">PASSWORD RESET</div><h2>비밀번호 설정</h2><p>${ex(target.name)} · 로그인 이름 ${ex(target.name)}</p></div><button class="x" data-close>×</button></div><form id="adminPwForm"><label class="lbl"><span>새 비밀번호 *</span><input id="adminNewPw" type="password" minlength="4" required></label><label class="lbl"><span>새 비밀번호 확인 *</span><input id="adminNewPw2" type="password" minlength="4" required></label><button class="primary full">비밀번호 저장</button></form>`);document.getElementById('adminPwForm').onsubmit=async ev=>{ev.preventDefault();const a=document.getElementById('adminNewPw').value,b=document.getElementById('adminNewPw2').value;if(a!==b)return alert('새 비밀번호가 서로 다릅니다.');const hash=await sha256(a);const btn=ev.submitter||document.querySelector('#adminPwForm button');btn.disabled=true;btn.textContent='저장 중…';try{await hqApi({action:'upsert',actor:actor(u),user:{id:target.id,name:target.name,department:target.department||'',position:target.position||'',role:target.role,active:target.active!==false,passwordHash:hash}},12000);target.username=target.name;target.passwordHash=hash;target.updatedAt=nowISO();saveData();closeModal();alert(`${target.name} 계정의 비밀번호가 변경되었습니다.`);renderShell(u)}catch(e){alert('비밀번호를 공용 서버에 저장하지 못했습니다. 다시 시도해 주세요.');btn.disabled=false;btn.textContent='비밀번호 저장'}};
  };

  css();
  setTimeout(()=>{try{const u=currentUser?.();if(!u)renderLogin();else{patchUi();if(u.role==='safety')syncHqUsers(u)}}catch(e){console.warn('v4.0.4 init skipped',e)}},40);
  window.ENL_DEPLOY_VERSION=VERSION;
})();
