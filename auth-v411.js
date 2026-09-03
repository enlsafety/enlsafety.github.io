/* E&L Accident Report App v4.1.1 - authoritative authentication */
(function(){
  'use strict';
  const VERSION='4.1.1-r19-pwa-login1';
  const LOGIN_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-login-v411';
  const CLIENT='incident-report-v2';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const siteLabel=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};

  currentUser=function(){
    try{
      if(session?.worker)return session.worker;
      if(session?.manager){if(session.manager.role==='final')session.manager.role='manager';return session.manager}
      if(session?.userId&&typeof userById==='function'){const u=userById(session.userId);if(u?.role==='final')u.role='manager';return u}
    }catch(e){}
    return null;
  };
  roleName=function(role){const r=roleNorm(role);return r==='worker'?'일반근로자':r==='field'?'현장관리':r==='safety'?'안전관리자':r==='executive'?'경영진':r==='manager'?'관리자':'사용자'};
  function actor(u=currentUser?.()){return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  window.enlCurrentActor=actor;

  async function api(body,timeout=18000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(LOGIN_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const err=new Error(j?.message||`http_${r.status}`);err.status=r.status;throw err}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }
  window.enlAuthApi=api;

  function css(){
    if(document.getElementById('auth411Css'))return;
    const s=document.createElement('style');s.id='auth411Css';s.textContent=`
    :root{--enl-blue:#1e5d91;--enl-deep:#174d78;--enl-line:#bfd8ea;--enl-text:#19354b;--enl-muted:#61798b}
    .login-page.login-v411{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:18px 12px;background:linear-gradient(155deg,#f9fdff,#eaf6ff 50%,#dceffc);box-sizing:border-box}.login-v411 .login-card{width:min(620px,100%);background:#fff;border:1px solid #cfe2ef;border-radius:24px;padding:26px;box-shadow:0 18px 48px rgba(32,87,128,.13);box-sizing:border-box}.login-v411 .login-brand{display:flex;align-items:center;gap:14px;margin-bottom:20px}.login-v411 .logo{width:64px;height:64px;min-width:64px;border-radius:18px;background:var(--enl-blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:950}.login-v411 h1{margin:0;color:var(--enl-deep);font-size:27px;line-height:1.2}.login-v411 .login-brand p{margin:6px 0 0;color:var(--enl-muted);font-size:14px}.login-v411 label{display:grid;gap:8px}.login-v411 label>span{font-size:17px;color:#193f5c;font-weight:950}.login-v411 #loginName411,.login-v411 #loginPassword411{width:100%;min-height:64px;border:2px solid #aecde2;border-radius:14px;padding:0 16px;background:#fff;color:#17354c;font-size:22px;font-weight:800;box-sizing:border-box;outline:none}.login-v411 #loginName411:focus,.login-v411 #loginPassword411:focus{border-color:#4b90bf;box-shadow:0 0 0 4px rgba(85,157,205,.14)}.login411-status{min-height:27px;margin-top:8px;color:#5e7688;font-size:14px;font-weight:750}.login411-status.ok{color:#216b48}.login411-status.err{color:#a33a3a}.login411-aff{margin-top:5px;border:2px solid #c3dceb;border-radius:16px;background:#f8fcff;overflow:hidden}.login411-aff summary{min-height:56px;padding:0 15px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;color:#1d557d;font-size:17px;font-weight:950;background:#edf8ff}.login411-list{display:grid;gap:9px;padding:12px}.login411-aff-btn{width:100%;min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1.5px solid #bad5e7;border-radius:14px;background:#fff;padding:12px 14px;text-align:left;color:#1e405a}.login411-aff-btn b{display:block;font-size:19px;color:var(--enl-deep)}.login411-aff-btn small{display:block;margin-top:4px;color:#6a8191;font-size:13px;font-weight:750}.login411-pw{margin-top:12px;padding:14px;border:2px solid #9dc6e2;border-radius:16px;background:#f0f9ff}.login411-selected{margin-bottom:10px;color:#174d78;font-weight:900}.login411-submit{width:100%;min-height:58px;margin-top:12px;border:0;border-radius:14px;background:var(--enl-blue);color:#fff;font-size:19px;font-weight:950}.login411-guide{margin-top:16px;padding:13px 14px;border:1px solid #c8e0f0;border-radius:14px;background:#f3faff;color:#2b5f84;font-size:14px;line-height:1.55;font-weight:750}.login411-note{margin-top:12px;text-align:center;color:#83939f;font-size:11px}@media(max-width:560px){.login-page.login-v411{align-items:flex-start;padding:10px 7px}.login-v411 .login-card{padding:18px 13px;border-radius:18px}.login-v411 .logo{width:56px;height:56px;min-width:56px}.login-v411 h1{font-size:23px}.login-v411 #loginName411,.login-v411 #loginPassword411{min-height:60px;font-size:21px}}
    `;document.head.appendChild(s);
  }

  let lookupTimer=null,lookupSeq=0,lookupOptions=[],selected=null;
  function status(msg,kind=''){const e=document.getElementById('loginStatus411');if(e){e.textContent=msg||'';e.className=`login411-status ${kind}`.trim()}}
  function clearChoice(){selected=null;lookupOptions=[];const a=document.getElementById('loginAff411');if(a){a.hidden=true;a.innerHTML=''}const p=document.getElementById('loginPwWrap411');if(p){p.hidden=true;p.innerHTML=''}}
  function renderOptions(options){
    lookupOptions=Array.isArray(options)?options:[];const wrap=document.getElementById('loginAff411');if(!wrap)return;
    if(!lookupOptions.length){wrap.hidden=true;return}
    wrap.hidden=false;wrap.innerHTML=`<details class="login411-aff" open><summary>소속 선택 <span>⌄</span></summary><div class="login411-list">${lookupOptions.map((o,i)=>`<button type="button" class="login411-aff-btn" data-login411-aff="${i}"><span><b>${ex(o.affiliationLabel||'-')}</b><small>${ex(o.position||o.roleLabel||'')}${o.kind==='hq'?` · ${ex(o.roleLabel||roleName(o.role))}`:o.requiresPassword?' · 비밀번호 필요':''}</small></span><span>›</span></button>`).join('')}</div></details>`;
    wrap.querySelectorAll('[data-login411-aff]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.login411Aff)));
  }
  async function lookup(force=false){
    const name=document.getElementById('loginName411')?.value.trim()||'';const seq=++lookupSeq;clearChoice();
    if(!name){status('이름을 입력하면 소속이 표시됩니다.');return}
    if(!force&&name.length<2){status('이름을 조금 더 입력해 주세요.');return}
    status('등록된 소속을 확인하고 있습니다…');
    try{const r=await api({action:'lookup',name});if(seq!==lookupSeq)return;const opts=r.options||[];if(!opts.length){status('등록된 이름을 찾지 못했습니다.','err');return}renderOptions(opts);status(`소속 ${opts.length}곳을 확인했습니다. 아래 소속을 선택해 주세요.`,'ok')}
    catch(e){if(seq===lookupSeq)status('소속 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.','err')}
  }
  function bindLogin(){const n=document.getElementById('loginName411');if(!n||n.dataset.bound==='1')return;n.dataset.bound='1';n.addEventListener('input',()=>{clearTimeout(lookupTimer);clearChoice();status('이름 확인 중…');lookupTimer=setTimeout(()=>lookup(false),350)});n.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(lookupTimer);lookup(true)}})}
  function renderLogin411(){
    css();if(document.querySelector('.login-v411')){bindLogin();return}
    app.innerHTML=`<div class="login-page login-v411"><div class="login-card"><div class="login-brand"><div class="logo">E&L</div><div><h1>이앤엘 사고보고앱</h1><p>이름과 소속을 확인하고 로그인합니다.</p></div></div><label><span>이름</span><input id="loginName411" autocomplete="name" inputmode="text" enterkeyhint="done" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="예: 김건모"></label><div id="loginStatus411" class="login411-status">이름을 입력하면 소속이 표시됩니다.</div><div id="loginAff411" hidden></div><div id="loginPwWrap411" hidden></div><div class="login411-guide"><b>로그인 순서</b><br>① 이름 입력 → ② 소속 선택<br>일반근로자는 바로 로그인됩니다. 현장소장·파트장·서무와 본사 사용자는 비밀번호를 입력합니다.</div><div class="login411-note">이앤엘 사고보고앱 v4.1.1</div></div></div>`;bindLogin();
  }
  renderLogin=renderLogin411;window.enlRenderLogin=renderLogin411;

  function enterApp(){
    currentView='home';try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
    const u=currentUser();
    try{if(typeof window.enlRenderApp==='function')window.enlRenderApp(u);else if(typeof renderShell==='function')renderShell(u)}
    catch(e){console.error('post-login render failed',e);if(typeof window.enlRenderFatal==='function')window.enlRenderFatal(e);else alert('로그인은 완료됐지만 화면을 불러오지 못했습니다. 최신화 후 다시 시도해 주세요.')}
    setTimeout(()=>window.enlIncidentSyncNow?.(),250);
  }
  function saveSiteSession(person){
    const kind=person.access_role==='field'?'field':'worker';
    const p={id:String(person.personnel_id||person.id||''),personnelId:String(person.personnel_id||person.id||''),name:person.name,position:person.job_title||person.position||(kind==='field'?'현장관리':'일반근로자'),role:kind,siteId:person.site_id||person.siteId,active:person.active!==false};
    session=kind==='worker'?{loggedAt:nowISO(),worker:p}:{loggedAt:nowISO(),manager:p};saveSession();return p;
  }
  async function loginSite(option,passwordHash=''){
    const name=document.getElementById('loginName411')?.value.trim()||'';document.querySelectorAll('.login411-aff-btn').forEach(b=>b.disabled=true);status(`${option.affiliationLabel} 로그인 확인 중…`);
    let person;
    try{const r=await api({action:'login_site',name,siteId:option.siteId,passwordHash});person=r.person;if(!person||norm(person.name)!==norm(name)||String(person.site_id)!==String(option.siteId))throw new Error('mismatch')}
    catch(e){document.querySelectorAll('.login411-aff-btn').forEach(b=>b.disabled=false);const btn=document.getElementById('loginSubmit411');if(btn){btn.disabled=false;btn.textContent='로그인'}status(passwordHash?'이름, 소속과 비밀번호를 다시 확인해 주세요.':'이름과 사업장을 다시 확인해 주세요.','err');alert(passwordHash?'이름, 소속과 비밀번호를 다시 확인하세요.':'이름과 사업장을 다시 선택하세요.');return false}
    saveSiteSession(person);enterApp();return true;
  }
  async function choose(index){const o=lookupOptions[index],name=document.getElementById('loginName411')?.value.trim()||'';if(!o||!name)return;if(o.kind==='hq'||o.requiresPassword){selected=o;renderPassword(o);return}await loginSite(o,'')}
  function renderPassword(o){const box=document.getElementById('loginPwWrap411');if(!box)return;box.hidden=false;box.innerHTML=`<form id="loginPwForm411" class="login411-pw"><div class="login411-selected">${ex(o.affiliationLabel||'-')} · ${ex(o.position||o.roleLabel||'')}</div><label><span>비밀번호</span><input id="loginPassword411" type="password" inputmode="numeric" autocomplete="current-password" enterkeyhint="go" placeholder="${o.kind==='site'?'휴대폰 뒷 4자리':'비밀번호'}" required></label><button id="loginSubmit411" class="login411-submit" type="submit">로그인</button></form>`;document.getElementById('loginPwForm411').onsubmit=loginPassword}
  function mergeHq(user,passwordHash=''){
    if(!user?.id||!user?.name)return null;if(!Array.isArray(data.users))data.users=[];
    const role=roleNorm(user.role);
    let x=data.users.find(v=>String(v.id)===String(user.id))||data.users.find(v=>['safety','manager','executive','final'].includes(v.role)&&norm(v.name)===norm(user.name));
    if(!x){x={id:user.id,createdAt:nowISO()};data.users.push(x)}
    Object.assign(x,{username:user.name,name:user.name,role,department:user.department||'',position:user.position||'',siteId:null,active:user.active!==false,updatedAt:user.updatedAt||nowISO()});if(passwordHash)x.passwordHash=passwordHash;saveData();return x;
  }
  async function loginPassword(ev){
    ev.preventDefault();const o=selected,name=document.getElementById('loginName411')?.value.trim()||'',pw=document.getElementById('loginPassword411')?.value||'',btn=document.getElementById('loginSubmit411');if(!o||!name||!pw)return;
    btn.disabled=true;btn.textContent='확인 중…';status('로그인 정보를 확인하고 있습니다…');const hash=await sha256(pw);
    if(o.kind==='site'){await loginSite(o,hash);return}
    let serverUser;
    try{const r=await api({action:'login_hq',name,affiliationId:o.affiliationId,passwordHash:hash});serverUser=r.user;if(!serverUser)throw new Error('invalid_user')}
    catch(e){btn.disabled=false;btn.textContent='로그인';status('이름, 소속과 비밀번호를 다시 확인해 주세요.','err');alert('이름, 소속과 비밀번호를 다시 확인하세요.');return}
    const user=mergeHq(serverUser,hash);session={loggedAt:nowISO(),manager:{...user}};saveSession();enterApp();setTimeout(()=>{if(user.role==='safety')syncHqUsers(user)},350);
  }

  let hqSyncing=false;
  async function syncHqUsers(u=currentUser?.()){if(hqSyncing||roleNorm(u?.role)!=='safety')return;hqSyncing=true;try{const r=await api({action:'hq_list',actor:actor(u)});for(const x of r.users||[])mergeHq(x,(data.users||[]).find(v=>v.id===x.id)?.passwordHash||'');try{window.dispatchEvent(new Event('enl-hq-users-synced'))}catch(e){}}catch(e){console.warn('HQ sync skipped',e)}finally{hqSyncing=false}}
  window.enlSyncHqUsers=syncHqUsers;

  function normalizePersonnel(list){const arr=Array.isArray(list)?list:[];return arr.filter(p=>{const suffix=` (${p.job_title||''})`;if(!String(p.name||'').endsWith(suffix))return true;const plain=String(p.name).slice(0,-suffix.length);return !arr.some(x=>x!==p&&x.site_id===p.site_id&&norm(x.name)===norm(plain)&&x.job_title===p.job_title)})}
  async function renderPersonnelPage(u,edit=null){
    const root=document.getElementById('view');if(!root)return;currentView='personnel';root.innerHTML=`<section class="panel"><div class="section-head"><div><div class="ey">SITE PERSONNEL</div><h2>사업장 근무자 관리</h2><p>${ex(siteLabel(u.siteId))} 근무자를 관리합니다.</p></div><button type="button" class="secondary" id="personnelBack411">현장 홈</button></div><div id="personnelEditor411"></div><div id="personnelList411"><div class="empty compact">근무자 명단을 불러오는 중입니다.</div></div></section>`;document.getElementById('personnelBack411').onclick=()=>window.enlFieldHome?.(u);
    try{const r=await api({action:'personnel_pull',siteId:u.siteId,actor:actor(u)});const list=normalizePersonnel(r.personnel||[]);renderPersonnelEditor(u,list,edit);renderPersonnelList(u,list)}catch(e){document.getElementById('personnelList411').innerHTML='<div class="rbac-login-error">근무자 명단을 불러오지 못했습니다.</div>'}
  }
  function renderPersonnelEditor(u,list,edit){const box=document.getElementById('personnelEditor411');if(!box)return;const p=edit||{},pos=p.job_title||'일반근로자';box.innerHTML=`<form id="personnelForm411" class="person-editor"><b>${edit?'근무자 정보 수정':'신규 근무자 등록'}</b><div class="formgrid"><label class="lbl"><span>이름 *</span><input id="personName411" value="${ex(p.name||'')}" required></label><label class="lbl"><span>직책 *</span><select id="personPosition411">${['일반근로자','현장소장','파트장','서무'].map(x=>`<option ${pos===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="hint">현장소장·파트장·서무의 초기 비밀번호는 등록 휴대폰 번호 뒷 4자리입니다.</div><button class="primary" type="submit">저장</button></form>`;document.getElementById('personnelForm411').onsubmit=async ev=>{ev.preventDefault();const name=document.getElementById('personName411').value.trim(),position=document.getElementById('personPosition411').value,accessRole=MANAGER_POSITIONS.includes(position)?'field':'worker';try{await api({action:'personnel_upsert',actor:actor(u),siteId:u.siteId,person:{personnelId:edit?.personnel_id||'',siteId:u.siteId,name,jobTitle:position,accessRole,active:edit?.active!==false}});renderPersonnelPage(u)}catch(e){alert(e?.message==='manager_phone_required'?'현장관리자 휴대폰 번호를 먼저 등록해 주세요.':'저장하지 못했습니다.')}}}
  function renderPersonnelList(u,list){const box=document.getElementById('personnelList411');if(!box)return;box.innerHTML=`<div class="personnel-list">${list.map(p=>`<div class="person-row ${p.active?'':'inactive'}"><div><b>${ex(p.name)}</b><span>${ex(p.job_title||'일반근로자')} · ${p.active?'근무중':'퇴사'}</span></div><div class="person-actions"><button type="button" data-pe="${p.personnel_id}">수정</button><button type="button" data-pt="${p.personnel_id}">${p.active?'퇴사':'복직'}</button></div></div>`).join('')||'<div class="empty compact">등록된 근무자가 없습니다.</div>'}</div>`;box.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>renderPersonnelPage(u,list.find(x=>String(x.personnel_id)===String(b.dataset.pe))));box.querySelectorAll('[data-pt]').forEach(b=>b.onclick=async()=>{const p=list.find(x=>String(x.personnel_id)===String(b.dataset.pt));if(!p)return;try{await api({action:'personnel_upsert',actor:actor(u),siteId:u.siteId,person:{personnelId:p.personnel_id,siteId:u.siteId,name:p.name,jobTitle:p.job_title,accessRole:p.access_role,active:!p.active}});renderPersonnelPage(u)}catch(e){alert('처리하지 못했습니다.')}})}
  window.enlRenderPersonnelPage=renderPersonnelPage;

  openUserModal=function(user,u){const isNew=!user,role=roleNorm(user?.role)||'manager';openModal(`<div class="modal-head"><div><h2>${isNew?'본사 사용자 생성':'본사 사용자 수정'}</h2></div><button class="x" data-close>×</button></div><form id="hqUserForm411"><div class="formgrid"><label class="lbl"><span>이름 *</span><input id="hqName411" value="${ex(user?.name||'')}" required></label><label class="lbl"><span>소속사업부</span><input id="hqDept411" value="${ex(user?.department||'')}"></label><label class="lbl"><span>직급</span><input id="hqPos411" value="${ex(user?.position||'')}"></label><label class="lbl"><span>역할군</span><select id="hqRole411"><option value="safety" ${role==='safety'?'selected':''}>안전관리자</option><option value="manager" ${role==='manager'?'selected':''}>관리자</option><option value="executive" ${role==='executive'?'selected':''}>경영진</option></select></label></div><div class="help" style="margin:10px 0">관리자·경영진은 안전관리자가 승인한 사고를 조회하고 ‘열람 확인’을 남길 수 있습니다.</div><label class="lbl"><span>${isNew?'초기 비밀번호 *':'새 비밀번호 (선택)'}</span><input id="hqPw411" type="password" ${isNew?'required':''}></label><button class="primary full">저장</button></form>`);document.getElementById('hqUserForm411').onsubmit=async ev=>{ev.preventDefault();const name=document.getElementById('hqName411').value.trim(),department=document.getElementById('hqDept411').value.trim(),position=document.getElementById('hqPos411').value.trim(),role=document.getElementById('hqRole411').value,pw=document.getElementById('hqPw411').value,hash=pw?await sha256(pw):(user?.passwordHash||'');if(!hash)return alert('비밀번호를 입력해 주세요.');try{const r=await api({action:'hq_upsert',actor:actor(u),user:{id:user?.id||uid('u'),name,department,position,role,active:true,passwordHash:hash}});mergeHq({...r.user,id:r.user?.id||user?.id},hash);await syncHqUsers(currentUser()||u);closeModal();renderShell(currentUser()||u)}catch(e){alert('본사 사용자 계정을 저장하지 못했습니다.')}}}
  openAdminPasswordReset=function(target,u){if(!target)return;openModal(`<div class="modal-head"><h2>비밀번호 설정</h2><button class="x" data-close>×</button></div><form id="hqPwReset411"><label class="lbl"><span>새 비밀번호 *</span><input id="hqNewPw411" type="password" required></label><button class="primary full">저장</button></form>`);document.getElementById('hqPwReset411').onsubmit=async ev=>{ev.preventDefault();const hash=await sha256(document.getElementById('hqNewPw411').value);try{await api({action:'hq_upsert',actor:actor(u),user:{id:target.id,name:target.name,department:target.department||'',position:target.position||'',role:roleNorm(target.role),active:target.active!==false,passwordHash:hash}});target.passwordHash=hash;saveData();closeModal();renderShell(u)}catch(e){alert('비밀번호를 저장하지 못했습니다.')}}}

  css();
  window.ENL_AUTH_VERSION=VERSION;
})();