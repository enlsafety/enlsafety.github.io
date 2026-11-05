/* E&L Accident Report App v4.1.1 - authoritative authentication */
(function(){
  'use strict';
  const VERSION='4.7.3-r2-demo-suspended';
  // Reopen only after restoring the two entry pages; see docs/disabled-demo/README.md.
  const DEMO_ENABLED=false;
  const LOGIN_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-login-v411';
  const CLIENT='incident-report-v2';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const siteLabel=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const deployedVersion=()=>document.querySelector('meta[name="enl-build"]')?.content||VERSION;

  currentUser=function(){
    try{
      if(session?.worker)return session.worker;
      if(session?.manager){if(session.manager.role==='final')session.manager.role='manager';return session.manager}
      if(session?.userId&&typeof userById==='function'){const u=userById(session.userId);if(u?.role==='final')u.role='manager';return u}
    }catch(e){}
    return null;
  };
  roleName=function(role){const r=roleNorm(role);return r==='worker'?'일반근로자':r==='field'?'현장관리':r==='safety'?'안전관리자':r==='executive'?'경영진':r==='manager'?'본사실무자':'사용자'};
  function actor(u=currentUser?.()){return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  window.enlCurrentActor=actor;

  function withActorProof(body){
    if(!['email_gate_manage','email_gate_set','hq_list','hq_upsert','personnel_pull','personnel_upsert','personnel_delete'].includes(body?.action))return body;
    const u=currentUser?.(),id=String(body?.actor?.id||'');
    if(!id||String(u?.id||u?.personnelId||'')!==id)return body;
    let stored=null,local=null;
    try{const candidate=session?.manager||session?.worker;if(String(candidate?.id||candidate?.personnelId||'')===id)stored=candidate}catch(e){}
    try{local=(data?.users||[]).find(x=>String(x?.id||'')===id)}catch(e){}
    const passwordHash=String(u?.passwordHash||stored?.passwordHash||local?.passwordHash||'').trim();
    const pinHash=String(u?.pinHash||stored?.pinHash||local?.pinHash||(roleNorm(u?.role)==='field'?passwordHash:'')).trim();
    return {...body,actorPasswordHash:body.actorPasswordHash||passwordHash||undefined,actorPinHash:body.actorPinHash||pinHash||undefined};
  }

  window.enlAuthWithActorProof=withActorProof;

  async function api(body,timeout=18000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(LOGIN_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(withActorProof(body)),signal:ctl?.signal,cache:'no-store'});
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
    .login-page.login-v411{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:18px 12px;background:linear-gradient(155deg,#f9fdff,#eaf6ff 50%,#dceffc);box-sizing:border-box}.login-v411 .login-card{width:min(620px,100%);background:#fff;border:1px solid #cfe2ef;border-radius:24px;padding:26px;box-shadow:0 18px 48px rgba(32,87,128,.13);box-sizing:border-box}.login-v411 .login-brand{display:flex;align-items:center;gap:14px;margin-bottom:20px}.login-v411 .logo{width:64px;height:64px;min-width:64px;border-radius:18px;background:var(--enl-blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:950}.login-v411 h1{margin:0;color:var(--enl-deep);font-size:27px;line-height:1.2}.login-v411 .login-brand p{margin:6px 0 0;color:var(--enl-muted);font-size:14px}.login-v411 label{display:grid;gap:8px}.login-v411 label>span{font-size:17px;color:#193f5c;font-weight:950}.login-v411 #loginName411,.login-v411 #loginPassword411{width:100%;min-height:64px;border:2px solid #aecde2;border-radius:14px;padding:0 16px;background:#fff;color:#17354c;font-size:22px;font-weight:800;box-sizing:border-box;outline:none}.login-v411 #loginName411:focus,.login-v411 #loginPassword411:focus{border-color:#4b90bf;box-shadow:0 0 0 4px rgba(85,157,205,.14)}.login411-status{min-height:27px;margin-top:8px;color:#5e7688;font-size:14px;font-weight:750}.login411-status.ok{color:#216b48}.login411-status.warn{color:#b3262e}.login411-status.err{color:#a33a3a}.login411-aff{margin-top:5px;border:2px solid #c3dceb;border-radius:16px;background:#f8fcff;overflow:hidden}.login411-aff.login411-aff-duplicate{border-color:#d9363e;background:#fffafa;box-shadow:0 0 0 3px rgba(217,54,62,.10)}.login411-aff.login411-aff-duplicate summary{background:#fff0f1;color:#a92028}.login411-duplicate-warning{padding:10px 12px 0;color:#b3262e;font-size:13px;line-height:1.45;font-weight:900}.login411-aff.login411-aff-duplicate .login411-aff-btn{border-color:#e6a7ab}.login411-aff.login411-aff-selected:not(.login411-aff-duplicate){border-color:#1e5d91;background:#f6fbff;box-shadow:0 0 0 3px rgba(30,93,145,.08)}.login411-aff.login411-aff-selected:not(.login411-aff-duplicate) summary{background:#eaf6ff;color:#174d78}.login411-summary-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.login411-summary-arrow{flex:0 0 auto;margin-left:8px}.login411-aff summary{min-height:56px;padding:0 15px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;color:#1d557d;font-size:17px;font-weight:950;background:#edf8ff}.login411-list{display:grid;gap:9px;padding:12px}.login411-aff-btn{width:100%;min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1.5px solid #bad5e7;border-radius:14px;background:#fff;padding:12px 14px;text-align:left;color:#1e405a}.login411-aff-btn b{display:block;font-size:19px;color:var(--enl-deep)}.login411-aff-btn small{display:block;margin-top:4px;color:#6a8191;font-size:13px;font-weight:750}.login411-pw{margin-top:12px;padding:14px;border:2px solid #9dc6e2;border-radius:16px;background:#f0f9ff}.login411-selected{margin-bottom:10px;color:#174d78;font-weight:900}.login411-submit{width:100%;min-height:58px;margin-top:12px;border:0;border-radius:14px;background:var(--enl-blue);color:#fff;font-size:19px;font-weight:950}.login411-note{margin-top:12px;text-align:center;color:#83939f;font-size:11px}.login411-demo-entry{grid-column:1/-1;grid-row:6;margin-top:8px;min-height:55px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f3f9fd;border:1.5px dashed #95bfdc;color:#1e5d91;border-radius:13px;padding:11px 14px;text-decoration:none;font-size:13px;font-weight:900}.login411-demo-entry small{font-size:10px;font-weight:600;color:#678596;display:block;margin-top:3px}.login411-demo-entry:hover{background:#e8f5ff;border-color:#2f82b7}@media(max-width:560px){.login-page.login-v411{align-items:flex-start;padding:10px 7px}.login-v411 .login-card{padding:18px 13px;border-radius:18px}.login-v411 .logo{width:56px;height:56px;min-width:56px}.login-v411 h1{font-size:23px}.login-v411 #loginName411,.login-v411 #loginPassword411{min-height:60px;font-size:21px}}
    `;document.head.appendChild(s);
  }

  let lookupTimer=null,lookupSeq=0,selected=null;
  function status(msg,kind=''){const e=document.getElementById('loginStatus411');if(e){e.textContent=msg||'';e.className=`login411-status ${kind}`.trim()}}
  function clearChoice(){
    selected=null;
    const remember=document.getElementById('rememberPw411');if(remember){remember.disabled=true;remember.checked=false;}
    for(const id of ['loginEmail411','loginAff411','loginPwWrap411','loginIdentity411']){
      const el=document.getElementById(id);if(el){el.hidden=id!=='loginAff411';el.replaceChildren();if(id==='loginAff411')el.textContent='이름 입력 후 자동 표시';}
    }
  }
  async function lookup(force=false,identity=''){
    const nameField=document.getElementById('loginName411');
    if(!nameField)return;
    const name=nameField.value.trim(),seq=++lookupSeq;
    clearChoice();
    if(!name||(!force&&name.length<2)){status('등록된 이름을 입력해 주세요.');return;}
    status('등록된 계정을 확인하고 있습니다.');
    try{
      const r=await api({action:'lookup',name,fixedAccount:true,accountKey:identity,knownEmail:identity.includes('@')?identity:identity+'@enlife.co.kr'});
      if(seq!==lookupSeq||!nameField.isConnected||nameField.value.trim()!==name)return;
      if(r.ambiguous||r.options?.length>1){
        status('동명이인이 있습니다. 등록된 회사 이메일 또는 공통 사용자 ID로 본인을 구분해 주세요.');
        const panel=document.getElementById('loginIdentity411');panel.hidden=false;
        panel.innerHTML='<form><label>회사 이메일 또는 공통 사용자 ID<input required autocomplete="off"></label><button type="submit">본인 계정 확인</button></form>';
        panel.querySelector('form').onsubmit=ev=>{ev.preventDefault();lookup(true,panel.querySelector('input').value.trim())};return;
      }
      const o=r.options?.[0];if(!o){status('등록된 이름을 찾지 못했습니다.','err');return;}
      selected=o;const aff=document.getElementById('loginAff411');aff.hidden=false;aff.textContent=o.affiliationLabel;
      const email=document.getElementById('loginEmail411');email.hidden=false;
      email.innerHTML='<label for="companyLocal411">회사 이메일</label><div class="company-address"><input id="companyLocal411" placeholder="이메일 아이디" aria-label="회사 이메일 아이디" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="64"><b>@enlife.co.kr</b><button type="button" data-enroll>인증</button></div>';
      const local=email.querySelector('input'),enroll=email.querySelector('[data-enroll]');local.value=o.companyLocal||'';local.readOnly=!!o.hasEmail;enroll.hidden=!!o.hasEmail;
      enroll.onclick=()=>registerEmail(o,local,enroll);
      status(o.hasEmail&&!o.companyLocal?'기존 이메일 변경은 시스템 관리에서 가능합니다.':'등록된 소속을 확인했습니다.');
      if(!o.hasEmail)status('처음 로그인하려면 회사 이메일을 입력하고 인증해 주세요.');
      renderPassword(o);
      // An identity form is removed on submission, leaving focus on the document.
      if(document.activeElement===nameField||(identity&&document.activeElement===document.body)){
        (o.hasEmail?document.getElementById('loginPassword411'):local)?.focus();
      }
    }catch{if(seq===lookupSeq)status('계정 정보를 불러오지 못했습니다. 다시 시도해 주세요.','err');}
  }
  function registerEmail(o,local,button){
    const value=local.value.trim().toLowerCase();
    if(value.length>64||!/^[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*$/.test(value)){status('등록할 회사 이메일 아이디를 입력해 주세요.','err');local.focus();return;}
    const pw=document.getElementById('loginPassword411'), needsPassword=o.kind==='hq'||o.requiresPassword;
    const d=document.createElement('dialog');d.className='email-gate-dialog';d.setAttribute('aria-labelledby','emailGateTitle411');
    d.innerHTML='<form><h2 id="emailGateTitle411" tabindex="-1" autofocus>회사 이메일 인증</h2><p></p><label data-proof><span></span><input name="proof" type="password" maxlength="128" required></label><label data-otp hidden>인증번호 6자리<input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" autocomplete="one-time-code"></label><div role="status" aria-live="polite"></div><button type="button" data-resend hidden>인증번호 다시 받기</button><footer><button type="button" data-cancel>취소</button><button type="submit">인증번호 받기</button></footer></form>';
    const form=d.querySelector('form'), otp=form.querySelector('[data-otp]'), proof=form.querySelector('[data-proof]'), submit=form.querySelector('[type=submit]'), resend=form.querySelector('[data-resend]'), note=form.querySelector('[role=status]');
    d.querySelector('p').textContent=value+'@enlife.co.kr';
    proof.firstChild.textContent=needsPassword?'본인 로그인 비밀번호':'일반근로자 최초 등록 비밀번호';
    if(needsPassword)form.elements.proof.placeholder='초기 비밀번호: 본인 휴대폰 뒷번호 4자리';
    form.elements.proof.autocomplete=needsPassword?'current-password':'off';
    if(needsPassword&&pw?.value)form.elements.proof.value=pw.value;
    const messages={email_in_use:'이미 다른 사용자에게 등록된 이메일입니다. 본인 회사 이메일로 다시 시도해 주세요.',incorrect_code:'인증번호가 일치하지 않습니다.',code_expired:'인증번호가 만료됐습니다. 다시 받아 주세요.',code_locked:'5회 틀렸습니다. 새 인증번호를 받아 주세요.',invalid_login:'본인 확인 비밀번호를 확인해 주세요.',attempts_exceeded:'확인 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.',wait_resend:'마지막 발송 1분 후에 다시 받을 수 있습니다.',send_limit:'시간당 발송 한도에 도달했습니다. 1시간 후 다시 시도해 주세요.',email_already_registered:'이미 등록된 계정입니다. 이름을 다시 조회해 주세요.',gate_not_configured:'안전관리자에게 최초 등록 비밀번호를 문의해 주세요.',mail_unavailable:'메일 발송을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'};
    let busy=false;
    async function run(verify){
      if(busy||selected!==o||!d.open)return;
      busy=true;submit.disabled=resend.disabled=true;note.textContent=verify?'확인 중…':'인증번호를 보내고 있습니다…';
      try{
        const secret=form.elements.proof.value;
        const credentials=needsPassword?{passwordHash:await sha256(secret)}:{registrationPassword:secret};
        await api({action:verify?'email_code_verify':'email_code_send',accountKey:o.accountKey,name:o.name||document.getElementById('loginName411').value.trim(),affiliationId:o.affiliationId,companyLocal:value,code:verify?form.elements.code.value:undefined,...credentials});
        if(selected!==o||!d.open)return;
        if(verify){
          o.hasEmail=true;o.companyLocal=value;local.value=value;local.readOnly=true;button.hidden=true;
          if(needsPassword&&pw&&!pw.value)pw.value=secret;
          status('회사 이메일이 등록됐습니다. 로그인해 주세요.','ok');d.close();document.getElementById('loginSubmit411')?.focus();
        }else{
          proof.hidden=true;otp.hidden=resend.hidden=false;form.elements.code.required=true;form.elements.code.value='';
          submit.textContent='인증 완료';note.textContent='메일로 보낸 6자리 인증번호를 10분 내에 입력해 주세요.';form.elements.code.focus();
        }
      }catch(err){note.textContent=messages[err.message]||'연결 상태를 확인하고 다시 시도해 주세요.';}
      finally{busy=false;submit.disabled=resend.disabled=false;}
    }
    form.onsubmit=e=>{e.preventDefault();run(!otp.hidden)};resend.onclick=()=>run(false);
    form.querySelector('[data-cancel]').onclick=()=>d.close();d.onclose=()=>{form.reset();d.remove()};
    document.body.append(d);d.showModal();if(form.elements.proof.value)run(false);else d.querySelector('h2').focus();
  }
  // A remembered login is separate from the signed-in session and still requires server verification.
  const rememberName='enl.login.rememberName',rememberAccount='enl.login.rememberPasswordFor';
  function pref(key,value){
    try{if(value===undefined)return localStorage.getItem(key)||'';
      if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);
    }catch{}return '';
  }
  const ticketKey='enl.login.deviceCredential';
  function deviceStore(mode,operation){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open('enl-device-login',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('credentials');
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction('credentials',mode);
        let result;
        tx.oncomplete=()=>{db.close();resolve(result?.result)};
        tx.onabort=()=>{db.close();reject(tx.error||new Error('storage_aborted'))};
        try{result=operation(tx.objectStore('credentials'))}catch(error){tx.abort();reject(error)}
      };
    });
  }
  function forgetPassword(){
    const ticket=pref(ticketKey);
    pref(rememberAccount,'');pref(ticketKey,'');
    if(ticket)deviceStore('readwrite',store=>store.delete(ticket)).catch(()=>{});
  }
  function resetPasswordField(input){
    if(input.dataset.restored==='native')input.value='';
    delete input.dataset.restored;
    input.required=true;input.placeholder='비밀번호를 입력하세요';
    const hint=document.getElementById('rememberStatus411');if(hint)hint.textContent='';
  }
  function bindRemember(field){
    const id=document.querySelector('#rememberId411'),password=document.querySelector('#rememberPw411');
    const name=pref(rememberName);id.checked=!!name;
    for(const box of [id,password])box.onchange=()=>{
      if(box.checked&&!confirm('본인만 사용하는 잠금 설정된 PC인가요? 공용 PC에서는 기억하기를 사용하지 마세요.'))box.checked=false;
      if(box===id){
        if(!id.checked){pref(rememberName,'');pref(rememberName+'.key','')}
        return;
      }
      const input=document.querySelector('#loginPassword411');
      if(input)input.autocomplete=box.checked?'current-password':'off';
      if(!box.checked){
        if(selected?.accountKey===pref(rememberAccount))forgetPassword();
        if(input)resetPasswordField(input);
      }
    };
    if(name){field.value=name;lookup(true,pref(rememberName+'.key'));}
  }
  async function saveDeviceProof(accountKey,proof){
    const oldTicket=pref(ticketKey);
    let ticket='';
    try{
      ticket=crypto.randomUUID();pref(rememberAccount,accountKey);pref(ticketKey,ticket);
      if(pref(ticketKey)!==ticket)throw new Error('preferences_unavailable');
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(accountKey)},key,new TextEncoder().encode(proof));
      await deviceStore('readwrite',store=>{
        if(pref(ticketKey)!==ticket||pref(rememberAccount)!==accountKey)return;
        store.clear();return store.put({accountKey,key,iv,sealed},ticket);
      });
    }catch{
      if(pref(ticketKey)===ticket)forgetPassword();
      if(oldTicket)await deviceStore('readwrite',store=>store.delete(oldTicket)).catch(()=>{});
      alert('로그인은 가능하지만 이 브라우저에 비밀번호 기억 설정을 저장할 수 없습니다. 사이트 데이터 저장 설정을 확인해 주세요.');
    }
  }
  async function rememberLogin(o,proof,usingSaved){
    if(document.querySelector('#rememberId411')?.checked){pref(rememberName,document.getElementById('loginName411').value.trim());pref(rememberName+'.key',o.accountKey);}
    if(proof&&!usingSaved&&document.querySelector('#rememberPw411')?.checked)await saveDeviceProof(o.accountKey,proof);
  }
  window.enlUpdateRememberedProof=async(accountKey,proof)=>{
    if(pref(rememberAccount)===accountKey)await saveDeviceProof(accountKey,proof);
  };
  // Older releases could remember consent without writing a device credential.
  let migration;
  window.addEventListener('pageshow',()=>{
    const user=typeof session!=='undefined'&&(session?.manager||session?.worker);
    if(!user||pref(ticketKey))return;
    const field=user.role==='field'||user.role==='worker';
    const account=(field?'site:':'hq:')+(user.id||user.personnelId);
    const proof=field?user.pinHash:user.passwordHash;
    if(pref(rememberAccount)===account&&/^[0-9a-f]{64}$/i.test(proof||''))migration=saveDeviceProof(account,proof);
  });
  async function restorePassword(o){
    const input=document.querySelector('#loginPassword411'),box=document.querySelector('#rememberPw411');
    box.disabled=!input;box.checked=!!input&&pref(rememberAccount)===o.accountKey;
    if(!input)return;
    input.autocomplete=box.checked?'current-password':'off';
    const hint=document.getElementById('rememberStatus411');
    let edited=false;
    input.addEventListener('input',()=>{
      if(!input.value&&!edited&&input.dataset.restored)return;
      edited=true;
      delete input.dataset.restored;
      input.required=true;input.placeholder='비밀번호를 입력하세요';hint.textContent='';
    });
    const eligible=()=>input.isConnected&&selected===o&&box.checked&&pref(rememberAccount)===o.accountKey&&!input.value&&!edited;
    if(!box.checked)return;
    const ticket=pref(ticketKey);
    if(ticket){
      input.dataset.restored=ticket;input.required=false;input.placeholder='●●●●●●●●';
      await migration;
      const record=await deviceStore('readonly',store=>store.get(ticket)).catch(()=>null);
      if(record?.accountKey!==o.accountKey&&eligible()&&pref(ticketKey)===ticket){
        resetPasswordField(input);
        pref(ticketKey,'');
        hint.textContent='이 기기에서 저장 정보를 찾을 수 없습니다. 비밀번호를 한 번 입력해 로그인해 주세요.';
      }
      return;
    }
    hint.textContent='기억하기는 켜져 있습니다. 비밀번호를 한 번 입력해 로그인하면 이 기기에 저장됩니다.';
    try{
      if(window.PasswordCredential&&navigator.credentials?.get){
        const c=await navigator.credentials.get({password:true,mediation:'silent'});
        if(eligible()&&c?.id===o.accountKey&&c.password){input.value=c.password;input.dataset.restored='native';hint.textContent='브라우저에 기억된 비밀번호로 로그인할 수 있습니다.'}
      }
    }catch{/* Leave the one-time entry instruction visible. */}
  }
  async function readDeviceProof(accountKey,ticket){
    await migration;
    const record=await deviceStore('readonly',store=>store.get(ticket));
    if(record?.accountKey!==accountKey||pref(ticketKey)!==ticket||pref(rememberAccount)!==accountKey)throw new Error('credential_unavailable');
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(accountKey)},record.key,record.sealed);
    return new TextDecoder().decode(bytes);
  }
  function discardRejectedProof(error,ticket){
    if(error.message!=='invalid_login'||!ticket||pref(ticketKey)!==ticket)return;
    forgetPassword();
    const input=document.getElementById('loginPassword411');
    if(input){resetPasswordField(input);input.focus()}
  }
  function bindLogin(){
    const field=document.getElementById('loginName411');
    if(!field||field.dataset.bound==='1')return;
    field.dataset.bound='1';
    bindRemember(field);
    let previousValue;
    field.addEventListener('input',event=>{
      // Moving focus can commit the last Korean syllable and send the same input again.
      if(field.value===previousValue)return;
      previousValue=field.value;
      clearTimeout(lookupTimer);
      ++lookupSeq;clearChoice();status('이름 확인 중…');
      lookupTimer=setTimeout(()=>{if(field.isConnected)lookup(false)},event.isComposing?650:350);
    });
    field.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing||event.keyCode===229)return;
      event.preventDefault();clearTimeout(lookupTimer);lookup(true);
    });
  }
  function renderLogin411(){
    css();if(document.querySelector('.login-v411')){bindLogin();return}
    app.innerHTML=`<div class="login-page login-v411"><img class="login-scene" src="assets/login-golf-r46.png" alt="" aria-hidden="true"><section class="login-intro" aria-label="이앤엘 안전보건관리 통합시스템 소개"><img src="assets/enl-wordmark.svg" width="176" height="86" alt="이앤엘 E&amp;L"><h2>이앤엘 안전보건관리<br>통합시스템</h2><p>안전한 코스관리, 건강한 일터가<br>최고의 코스 품질을 만듭니다.</p></section><div class="login-card"><div class="login-brand"><div class="login-shield"><img class="enl-system-mark" src="pwa-icon-512.png?v=4813-r53" width="512" height="512" alt="" aria-hidden="true"></div><div><h1>이앤엘 안전보건관리<br>통합시스템</h1><p>이름과 소속을 확인하고 로그인합니다.</p></div></div><label><span>이름</span><input id="loginName411" autocomplete="off" inputmode="text" enterkeyhint="next" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="이름을 입력하세요"></label><div id="loginEmail411" hidden></div><div class="login-preview-email"><div class="company-address"><input disabled aria-label="회사 이메일 아이디, 이름 입력 후 사용 가능" placeholder="이메일 아이디"><b>@enlife.co.kr</b><button disabled type="button">인증</button></div></div><div id="loginIdentity411" hidden></div><div id="loginStatus411" class="login411-status" role="status" aria-live="polite">이름 입력 후 소속과 계정 정보가 자동 확인됩니다.</div><div class="aff-field411"><span>소속사업장</span><div id="loginAff411" aria-label="소속사업장" aria-live="polite">이름 입력 후 자동 표시</div></div><div id="loginPwWrap411" hidden></div><div class="login-preview-password"><label><span>비밀번호</span><input type="password" disabled aria-label="비밀번호, 이름 입력 후 사용 가능" placeholder="비밀번호를 입력하세요"></label><button class="login411-submit" type="button" disabled>로그인</button></div><section class="login-remember"><div><label><input type="checkbox" id="rememberId411">아이디 기억하기</label><label><input type="checkbox" id="rememberPw411" disabled>비밀번호 기억하기</label></div><small>잠금 설정된 개인 PC에서만 사용하세요. 기억하기를 해제하면 이 기기의 저장된 로그인 정보를 지울 수 있습니다.</small></section><div class="login411-note">이앤엘 안전보건관리 통합시스템 v${ex(deployedVersion())}</div>${DEMO_ENABLED?`<a id="zerowizDemoEntry" class="login411-demo-entry" href="zerowiz-demo.html?v=2.0.0" target="_blank" rel="noopener noreferrer"><span>제로위즈 ERP 기술검토 데모<small>운영 사고·계정에 연결되지 않는 가상 업무 체험</small></span><span aria-hidden="true">→</span></a>`:''}</div></div>`;bindLogin();
  }
  renderLogin=renderLogin411;window.enlRenderLogin=renderLogin411;

  function enterApp(){
    currentView='platform';try{enlPlatformSection='hub';localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'hub')}catch(e){}
    const u=currentUser();
    try{if(typeof window.enlRenderApp==='function')window.enlRenderApp(u);else if(typeof renderShell==='function')renderShell(u)}
    catch(e){console.error('post-login render failed',e);if(typeof window.enlRenderFatal==='function')window.enlRenderFatal(e);else alert('로그인은 완료됐지만 화면을 불러오지 못했습니다. 최신화 후 다시 시도해 주세요.')}
    window.enlOfferDevicePasswordChange?.(u);
    setTimeout(()=>window.enlIncidentSyncNow?.(),250);
  }
  function saveSiteSession(person,passwordHash=''){
    const kind=person.access_role==='field'?'field':'worker';
    const p={id:String(person.personnel_id||person.id||''),personnelId:String(person.personnel_id||person.id||''),name:person.name,position:person.job_title||person.position||(kind==='field'?'현장관리':'일반근로자'),role:kind,siteId:person.site_id||person.siteId,active:person.active!==false};if(passwordHash)p.pinHash=passwordHash;
    session=kind==='worker'?{loggedAt:nowISO(),worker:p}:{loggedAt:nowISO(),manager:p};saveSession();return p;
  }
  async function loginSite(option,passwordHash='',ticket=''){
    const name=document.getElementById('loginName411')?.value.trim()||'';document.querySelectorAll('.login411-aff-btn').forEach(b=>b.disabled=true);status(`${option.affiliationLabel} 로그인 확인 중…`);
    let person;
    try{const r=await api({action:'login_site',name,siteId:option.siteId,passwordHash,accountKey:option.accountKey});person=r.person;if(!person||norm(person.name)!==norm(name)||String(person.site_id)!==String(option.siteId))throw new Error('mismatch')}
    catch(e){if(selected!==option)return false;discardRejectedProof(e,ticket);document.querySelectorAll('.login411-aff-btn').forEach(b=>b.disabled=false);const btn=document.getElementById('loginSubmit411');if(btn){btn.disabled=false;btn.textContent='로그인'}const msg=e.message==='registration_code_required'?'등록코드를 확인해 주세요. 코드는 발급 후 30분간 유효합니다.':e.message==='account_changed'?'계정 정보가 변경됐습니다. 이름을 다시 입력해 주세요.':'로그인 정보를 다시 확인해 주세요.';status(msg,'err');return false}
    if(selected!==option)return false;await rememberLogin(option,passwordHash,!!ticket);if(selected!==option)return false;saveSiteSession(person,passwordHash);enterApp();return true;
  }
  function renderPassword(o){
    const box=document.getElementById('loginPwWrap411'),needsPassword=o.kind==='hq'||o.requiresPassword;box.hidden=false;
    box.innerHTML='<form id="loginPwForm411" class="login411-pw">'+(needsPassword?'<label><span>비밀번호</span><input id="loginPassword411" placeholder="비밀번호를 입력하세요" type="password" autocomplete="current-password" required></label>':'')+'<small id="rememberStatus411" role="status"></small><button id="loginSubmit411" class="login411-submit" type="submit">로그인</button></form>';
    box.querySelector('form').onsubmit=loginPassword;
    if(needsPassword){const id=document.createElement('input');id.name='username';id.type='text';id.autocomplete='username';id.hidden=true;id.value=o.accountKey;box.querySelector('form').prepend(id);box.querySelector('[type=password]').name='password';}
    restorePassword(o);
  }
  function mergeHq(user,passwordHash=''){
    if(!user?.id||!user?.name)return null;if(!Array.isArray(data.users))data.users=[];
    const role=roleNorm(user.role);
    let x=data.users.find(v=>String(v.id)===String(user.id));
    if(!x){x={id:user.id,createdAt:nowISO()};data.users.push(x)}
    Object.assign(x,{username:user.name,name:user.name,role,department:user.department||'',position:user.position||'',email:user.email||'',pushEnabled:user.pushEnabled!==false,emailEnabled:user.emailEnabled!==false,siteId:null,active:user.active!==false,updatedAt:user.updatedAt||nowISO()});if(passwordHash)x.passwordHash=passwordHash;(window.enlPersistAppData||saveData)();return x;
  }
  async function loginPassword(ev){
    ev.preventDefault();const o=selected,name=document.getElementById('loginName411')?.value.trim()||'',pw=document.getElementById('loginPassword411')?.value||'',btn=document.getElementById('loginSubmit411');if(!o||!name)return;
    if(!o.hasEmail){status('회사 이메일 인증을 먼저 완료해 주세요.','err');document.getElementById('companyLocal411')?.focus();return;}
    const input=document.getElementById('loginPassword411');
    const ticket=!pw&&document.querySelector('#rememberPw411')?.checked&&input?.dataset.restored;
    if((o.kind==='hq'||o.requiresPassword)&&!pw&&!ticket)return;
    btn.disabled=true;btn.textContent='확인 중…';status('로그인 정보를 확인하고 있습니다…');
    let hash;
    try{hash=ticket?await readDeviceProof(o.accountKey,ticket):pw?await sha256(pw):''}
    catch{
      if(selected!==o)return;
      if(ticket&&pref(ticketKey)===ticket)pref(ticketKey,'');
      if(input)resetPasswordField(input);
      btn.disabled=false;btn.textContent='로그인';status('저장된 정보를 사용할 수 없습니다. 비밀번호를 다시 입력해 주세요.','err');input?.focus();return;
    }
    if(selected!==o)return;
    if(ticket&&(input.dataset.restored!==ticket||pref(ticketKey)!==ticket)){btn.disabled=false;btn.textContent='로그인';return}
    if(o.kind==='site'){await loginSite(o,hash,ticket);return}
    let serverUser;
    try{const r=await api({action:'login_hq',name,affiliationId:o.affiliationId,passwordHash:hash,accountKey:o.accountKey});serverUser=r.user;if(!serverUser)throw new Error('invalid_user')}
    catch(e){if(selected!==o)return;discardRejectedProof(e,ticket);btn.disabled=false;btn.textContent='로그인';status('이름, 소속과 비밀번호를 다시 확인해 주세요.','err');alert('이름, 소속과 비밀번호를 다시 확인하세요.');return}
    if(selected!==o)return;await rememberLogin(o,hash,!!ticket);if(selected!==o)return;const user=mergeHq(serverUser,hash);session={loggedAt:nowISO(),manager:{...user}};saveSession();enterApp();setTimeout(()=>{if(user.role==='safety')syncHqUsers(user)},350);
  }

  let hqSyncing=false;
  async function syncHqUsers(u=currentUser?.()){if(hqSyncing||roleNorm(u?.role)!=='safety')return;hqSyncing=true;try{const r=await api({action:'hq_list',actor:actor(u)}),remote=Array.isArray(r.users)?r.users:[],ids=new Set(remote.map(x=>String(x.id||'')));for(const x of remote)mergeHq(x,(data.users||[]).find(v=>v.id===x.id)?.passwordHash||'');if(Array.isArray(data.users)){const before=data.users.length;data.users=data.users.filter(v=>!['safety','manager','executive','final'].includes(roleNorm(v.role))||ids.has(String(v.id||''))||String(v.id||'')===String(u?.id||''));if(data.users.length!==before)(window.enlPersistAppData||saveData)()}try{window.dispatchEvent(new Event('enl-hq-users-synced'))}catch(e){}}catch(e){console.warn('HQ sync skipped',e)}finally{hqSyncing=false}}
  window.enlSyncHqUsers=syncHqUsers;

  function normalizePersonnel(list){const arr=Array.isArray(list)?list:[];return arr.filter(p=>{const suffix=` (${p.job_title||''})`;if(!String(p.name||'').endsWith(suffix))return true;const plain=String(p.name).slice(0,-suffix.length);return !arr.some(x=>x!==p&&x.site_id===p.site_id&&norm(x.name)===norm(plain)&&x.job_title===p.job_title)})}
  async function renderPersonnelPage(u,edit=null){
    const root=document.getElementById('view');if(!root)return;currentView='personnel';root.innerHTML=`<section class="panel"><div class="section-head"><div><div class="ey">SITE PERSONNEL</div><h2>사업장 근무자 관리</h2><p>${ex(siteLabel(u.siteId))} 근무자를 관리합니다.</p></div><button type="button" class="secondary" id="personnelBack411">현장 홈</button></div><div id="personnelEditor411"></div><div id="personnelList411"><div class="empty compact">근무자 명단을 불러오는 중입니다.</div></div></section>`;document.getElementById('personnelBack411').onclick=()=>window.enlFieldHome?.(u);
    try{const r=await api({action:'personnel_pull',siteId:u.siteId,actor:actor(u)});const list=normalizePersonnel(r.personnel||[]);renderPersonnelEditor(u,list,edit);renderPersonnelList(u,list)}catch(e){document.getElementById('personnelList411').innerHTML='<div class="rbac-login-error">근무자 명단을 불러오지 못했습니다.</div>'}
  }
  function renderPersonnelEditor(u,list,edit){const box=document.getElementById('personnelEditor411');if(!box)return;const p=edit||{},pos=edit?(p.job_title||'일반근로자'):'';box.innerHTML=`<form id="personnelForm411" class="person-editor"><b>${edit?'근무자 정보 수정':'신규 근무자 등록'}</b><div class="formgrid"><label class="lbl"><span>이름 *</span><input id="personName411" value="${ex(p.name||'')}" required></label><label class="lbl"><span>직책 *</span><select id="personPosition411" required><option value="">선택</option>${['일반근로자','현장소장','파트장','서무'].map(x=>`<option ${pos===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="hint">현장소장·파트장·서무의 초기 비밀번호는 등록 휴대폰 번호 뒷 4자리입니다.</div><button class="primary" type="submit">저장</button></form>`;document.getElementById('personnelForm411').onsubmit=async ev=>{ev.preventDefault();const name=document.getElementById('personName411').value.trim(),position=document.getElementById('personPosition411').value,accessRole=MANAGER_POSITIONS.includes(position)?'field':'worker';try{await api({action:'personnel_upsert',actor:actor(u),siteId:u.siteId,person:{personnelId:edit?.personnel_id||'',siteId:u.siteId,name,jobTitle:position,accessRole,active:edit?.active!==false}});renderPersonnelPage(u)}catch(e){alert(e?.message==='manager_phone_required'?'현장관리자 휴대폰 번호를 먼저 등록해 주세요.':'저장하지 못했습니다.')}}}
  function renderPersonnelList(u,list){const box=document.getElementById('personnelList411');if(!box)return;box.innerHTML=`<div class="personnel-list">${list.map(p=>`<div class="person-row ${p.active?'':'inactive'}"><div><b>${ex(p.name)}</b><span>${ex(p.job_title||'일반근로자')} · ${p.active?'근무중':'퇴사'}</span></div><div class="person-actions"><button type="button" data-pe="${p.personnel_id}">수정</button><button type="button" data-pt="${p.personnel_id}">${p.active?'퇴사':'복직'}</button></div></div>`).join('')||'<div class="empty compact">등록된 근무자가 없습니다.</div>'}</div>`;box.querySelectorAll('[data-pe]').forEach(b=>b.onclick=()=>renderPersonnelPage(u,list.find(x=>String(x.personnel_id)===String(b.dataset.pe))));box.querySelectorAll('[data-pt]').forEach(b=>b.onclick=async()=>{const p=list.find(x=>String(x.personnel_id)===String(b.dataset.pt));if(!p)return;try{await api({action:'personnel_upsert',actor:actor(u),siteId:u.siteId,person:{personnelId:p.personnel_id,siteId:u.siteId,name:p.name,jobTitle:p.job_title,accessRole:p.access_role,active:!p.active}});renderPersonnelPage(u)}catch(e){alert('처리하지 못했습니다.')}})}
  window.enlRenderPersonnelPage=renderPersonnelPage;

  openUserModal=function(user,u){const isNew=!user,role=roleNorm(user?.role)||'manager';openModal(`<div class="modal-head"><div><h2>${isNew?'본사 사용자 생성':'본사 사용자 수정'}</h2></div><button class="x" data-close>×</button></div><form id="hqUserForm411"><div class="formgrid"><label class="lbl"><span>이름 *</span><input id="hqName411" value="${ex(user?.name||'')}" required></label><label class="lbl"><span>소속사업부</span><input id="hqDept411" value="${ex(user?.department||'')}"></label><label class="lbl"><span>직급</span><input id="hqPos411" value="${ex(user?.position||'')}"></label><label class="lbl"><span>역할군</span><select id="hqRole411"><option value="safety" ${role==='safety'?'selected':''}>안전관리자</option><option value="manager" ${role==='manager'?'selected':''}>본사실무자</option><option value="executive" ${role==='executive'?'selected':''}>경영진</option></select></label><label class="lbl"><span>자동메일 수신 이메일</span><input id="hqEmail411" type="email" value="${ex(user?.email||'')}" placeholder="name@company.com" autocomplete="email"></label><label class="lbl"><span>앱 푸시 알림</span><select id="hqPush411"><option value="1" ${user?.pushEnabled!==false?'selected':''}>ON</option><option value="0" ${user?.pushEnabled===false?'selected':''}>OFF</option></select></label><label class="lbl"><span>이메일 알림</span><select id="hqMail411"><option value="1" ${user?.emailEnabled!==false?'selected':''}>ON</option><option value="0" ${user?.emailEnabled===false?'selected':''}>OFF</option></select></label></div><div class="help" style="margin:10px 0"><b>자동메일 수신 이메일</b>에 등록한 주소는 사고 단계별 메일 발송 대상이 될 때 자동으로 사용됩니다. 앱 푸시와 이메일 알림은 기본 ON이며, 본사실무자와 경영진의 긴급사고 알림은 OFF 설정과 관계없이 강제 수신됩니다.</div><label class="lbl"><span>${isNew?'초기 비밀번호 *':'새 비밀번호 (선택)'}</span><input id="hqPw411" type="password" ${isNew?'required':''}></label><button class="primary full">저장</button></form>`);document.getElementById('hqUserForm411').onsubmit=async ev=>{ev.preventDefault();const name=document.getElementById('hqName411').value.trim(),department=document.getElementById('hqDept411').value.trim(),position=document.getElementById('hqPos411').value.trim(),role=document.getElementById('hqRole411').value,email=document.getElementById('hqEmail411').value.trim(),pushEnabled=document.getElementById('hqPush411').value!=='0',emailEnabled=document.getElementById('hqMail411').value!=='0',pw=document.getElementById('hqPw411').value,hash=pw?await sha256(pw):'';if(isNew&&!hash)return alert('비밀번호를 입력해 주세요.');try{const r=await api({action:'hq_upsert',actor:actor(u),user:{id:user?.id||uid('u'),name,department,position,role,email,pushEnabled,emailEnabled,active:true,passwordHash:hash}});mergeHq({...r.user,id:r.user?.id||user?.id},hash);await syncHqUsers(currentUser()||u);closeModal();renderShell(currentUser()||u);setTimeout(()=>window.enlRenderHqNotificationStatus?.(true),80)}catch(e){alert(e?.message==='invalid_email'?'이메일 형식을 확인해 주세요.':'본사 사용자 계정을 저장하지 못했습니다.')}}}
  window.openAdminPasswordReset=function(target,u){if(!target)return;openModal(`<div class="modal-head"><h2>비밀번호 설정</h2><button class="x" data-close>×</button></div><form id="hqPwReset411"><label class="lbl"><span>새 비밀번호 *</span><input id="hqNewPw411" type="password" required></label><button class="primary full">저장</button></form>`);document.getElementById('hqPwReset411').onsubmit=async ev=>{ev.preventDefault();const hash=await sha256(document.getElementById('hqNewPw411').value);try{await api({action:'hq_upsert',actor:actor(u),user:{id:target.id,name:target.name,department:target.department||'',position:target.position||'',role:roleNorm(target.role),active:target.active!==false,passwordHash:hash}});target.passwordHash=hash;(window.enlPersistAppData||saveData)();closeModal();renderShell(u)}catch(e){alert('비밀번호를 저장하지 못했습니다.')}}}

  css();
  window.ENL_AUTH_VERSION=VERSION;
})();