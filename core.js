const APP_VERSION = '2.0.0';
const DB_KEY = 'enl_safety_v3';
const SESSION_KEY = 'enl_safety_session_v3';
const OLD_KEY = 'enl_accident_demo_v1';
const MAX_PHOTOS = 8;
const ATTACHMENT_API = 'https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-attachment-v411';
const ATTACHMENT_CLIENT = 'incident-report-v2';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const DEMO_HASHES = {
  '1111':'0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c',
  '2222':'edee29f882543b956620b26d0ee0e7e950399b1c4222f5de05e06425b4c995e9',
  '3333':'318aee3fed8c9d040d35a7fc1fa776fb31303833aa2de885354ddf3d44d8fb69'
};
let data = loadData();
let session = loadSession();
let incidentPhotos = [];
let actionPhotos = [];
let currentView = '';
let accountMenuOpen = false;

const app = document.getElementById('app');
const incidentPhotoInput = document.getElementById('incidentPhotoInput');
const actionPhotoInput = document.getElementById('actionPhotoInput');

function uid(prefix='id'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
function nowISO(){return new Date().toISOString()}
function localDT(d=new Date()){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function fmt(v){if(!v)return '-';try{return new Intl.DateTimeFormat('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v))}catch{return v}}
function dday(v){if(!v)return '-';const a=new Date(v);a.setHours(0,0,0,0);const b=new Date();b.setHours(0,0,0,0);const n=Math.ceil((a-b)/86400000);return n===0?'오늘':n>0?`D-${n}`:`D+${Math.abs(n)}`}
function siteById(id){return data.sites.find(s=>s.id===id)}
function userById(id){return data.users.find(u=>u.id===id)}
function currentUser(){return session?userById(session.userId):null}
function roleName(role){return role==='worker'?'일반근로자':role==='field'?'현장관리':role==='safety'?'안전관리자':role==='executive'?'경영진':role==='manager'||role==='final'?'관리자':'사용자'}
function categoryName(v){return v==='person'?'대인사고':v==='property'?'대물사고':'아차사고'}
function statusName(v){return v==='reported'?'검토대기':v==='approved'?'승인':'종결'}
function priorityName(v){return v==='urgent'?'긴급':v==='important'?'중요':'일반'}
function actionStatusName(v){return v==='planned'?'조치예정':v==='in_progress'?'조치중':v==='submitted'?'검토요청':v==='approved'?'조치완료':'미등록'}
function badge(cls,text){return `<span class="pill ${cls}">${esc(text)}</span>`}
function statusBadge(v){return badge(v==='reported'?'p-reported':v==='approved'?'p-approved':'p-closed',statusName(v))}
function priorityBadge(v){return badge(v==='urgent'?'p-urgent':v==='important'?'p-important':'p-normal',priorityName(v))}
function categoryBadge(v){return badge(v==='person'?'p-person':v==='property'?'p-property':'p-near',categoryName(v))}
function legalBadge(i){return i.legalReview?badge('p-review','법적 검토 필요'):''}
function actionBadge(i){const s=i.corrective?.status;return s?badge(s==='approved'?'p-done':'p-review',actionStatusName(s)):badge('p-normal','조치 미등록')}

function defaultData(){
  return {
    version:3,
    sites:[
      {id:'site-hq',name:'본사'},
      {id:'site-dongtan',name:'동탄 현장'},
      {id:'site-yongin',name:'용인 현장'},
      {id:'site-pyeongtaek',name:'평택 물류'},
      {id:'site-a',name:'A 골프장'},
      {id:'site-b',name:'B 골프장'}
    ],
    users:[
      {id:'u-field-demo',username:'field01',name:'동탄 현장소장',role:'field',siteId:'site-dongtan',passwordHash:DEMO_HASHES['1111'],active:true,createdAt:nowISO()},
      {id:'u-safety-demo',username:'safety',name:'안전관리자',role:'safety',siteId:null,passwordHash:DEMO_HASHES['2222'],active:true,createdAt:nowISO()},
      {id:'u-final-demo',username:'manager',name:'최종관리자',role:'manager',siteId:null,passwordHash:DEMO_HASHES['3333'],active:true,createdAt:nowISO()}
    ],
    incidents:[]
  };
}

function migrateOld(base){
  try{
    const old=JSON.parse(localStorage.getItem(OLD_KEY)||'null');
    if(!old)return base;
    const siteMap={};
    for(const name of old.sites||[]){
      let s=base.sites.find(x=>x.name===name);
      if(!s){s={id:uid('site'),name};base.sites.push(s)}
      siteMap[name]=s.id;
    }
    for(const o of old.incidents||[]){
      const category=(o.injuredName||'').trim()?'person':'near_miss';
      const sev=o.severity==='중대'?'major':o.severity==='보통'?'moderate':'minor';
      const leaveEstimate=category==='person'?'unknown':'none';
      const priority=computePriority(category,sev,o.type||'기타',false,leaveEstimate);
      base.incidents.push({
        id:o.id||uid('inc'),siteId:siteMap[o.site]||base.sites[0].id,category,eventType:o.type||'기타',severity:sev,
        leaveEstimate,potentialMajor:false,injuredName:o.injuredName||'',job:o.job||'',summary:o.summary||'',
        immediateAction:o.immediateAction||'',photos:o.photos||[],reporterName:o.reporter||'현장소장',reporterId:null,
        occurredAt:o.occurredAt||nowISO(),createdAt:o.createdAt||nowISO(),updatedAt:o.updatedAt||nowISO(),
        status:o.status||'reported',priority,legalReview:false,safetyNote:o.safetyNote||'',approvedBy:o.approvedBy||'',
        approvedAt:o.approvedAt||null,closedAt:o.closedAt||null,corrective:null
      });
    }
  }catch(e){console.warn('old data migration skipped',e)}
  return base;
}
function loadData(){
  try{
    const v=JSON.parse(localStorage.getItem(DB_KEY)||'null');
    if(v?.version===3)return v;
  }catch(e){}
  const d=migrateOld(defaultData());
  localStorage.setItem(DB_KEY,JSON.stringify(d));
  return d;
}
function saveData(){localStorage.setItem(DB_KEY,JSON.stringify(data));try{new BroadcastChannel('enl_safety_v3').postMessage('update')}catch(e){}}
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(){if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY)}
async function sha256(text){const b=new TextEncoder().encode(text);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

function computePriority(category,severity,eventType,potentialMajor,leaveEstimate){
  const highRisk=['화재/폭발','붕괴/전도','감전','질식/중독','차량/중장비','추락'];
  if(severity==='major'||potentialMajor||leaveEstimate==='longterm'||highRisk.includes(eventType))return 'urgent';
  if(category==='person'||severity==='moderate'||leaveEstimate==='3plus')return 'important';
  return 'normal';
}
function computeLegalReview(category,severity,leaveEstimate){
  return category==='person'&&(severity==='major'||leaveEstimate==='3plus'||leaveEstimate==='longterm');
}

function defaultViewFor(user){return user.role==='field'?'report':user.role==='safety'?'dashboard':'approved'}
function render(){
  const u=currentUser();
  if(!u||!u.active){session=null;saveSession();renderLogin();return}
  if(!currentView)currentView=defaultViewFor(u);
  renderShell(u);
}

function renderLogin(){
  app.innerHTML=`<div class="login-page"><div class="login-card">
    <div class="login-brand"><div class="logo">E&L</div><div><h1>이앤엘 사고보고</h1><p>현장 사고 · 개선조치 · 승인 관리</p></div></div>
    <form id="loginForm">
      <label><span>아이디</span><input id="loginId" autocomplete="username" placeholder="아이디 입력" required></label>
      <label><span>비밀번호</span><input id="loginPw" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required></label>
      <div id="loginError" class="login-error hide"></div>
      <button class="primary" type="submit">로그인</button>
    </form>
    <div class="demo-box"><b>테스트 계정</b>
      <div class="demo-row"><span>현장소장</span><span>field01 / 1111</span></div>
      <div class="demo-row"><span>안전관리자</span><span>safety / 2222</span></div>
      <div class="demo-row"><span>관리자</span><span>manager / 3333</span></div>
    </div>
    <div class="test-note">현재 버전은 화면·업무흐름 테스트용입니다.</div>
  </div></div>`;
  document.getElementById('loginForm').onsubmit=doLogin;
}
async function doLogin(e){
  e.preventDefault();const id=document.getElementById('loginId').value.trim();const pw=document.getElementById('loginPw').value;
  const h=await sha256(pw);const u=data.users.find(x=>x.username===id&&x.active);
  if(!u||u.passwordHash!==h){const er=document.getElementById('loginError');er.textContent='아이디 또는 비밀번호를 확인해 주세요.';er.classList.remove('hide');return}
  session={userId:u.id,loggedAt:nowISO()};saveSession();currentView=defaultViewFor(u);render();
}

function renderShell(u){
  const site=siteById(u.siteId)?.name||'전체 사업장';
  app.innerHTML=`<div class="app-shell">
    <header class="topbar">
      <div class="brand"><div class="logo">E&L</div><div><h1>사고보고</h1><p>현장 사고 접수 · 개선조치 · 승인 관리</p></div></div>
      <div class="user-wrap">
        <button id="userChip" class="user-chip"><div class="avatar">${esc(u.name.slice(0,2))}</div><div><b>${esc(u.name)}</b><small>${roleName(u.role)} · ${esc(site)}</small></div><span class="chev">⌄</span></button>
        <div id="userMenu" class="user-menu ${accountMenuOpen?'':'hide'}">
          <div class="who"><b>${esc(u.name)}</b><span>${roleName(u.role)} · ${esc(site)}</span></div>
          <button id="changePwBtn">비밀번호 변경</button>
          <button id="logoutBtn" class="danger">로그아웃</button>
        </div>
      </div>
    </header>
    <main class="main">
      <div class="role-banner">● ${roleBanner(u)}</div>
      ${renderNav(u)}
      <div id="view"></div>
      <div class="footer-note">이앤엘 사고보고 ${APP_VERSION}</div>
    </main>
    <div id="modalRoot"></div>
  </div>`;
  document.getElementById('userChip').onclick=()=>{accountMenuOpen=!accountMenuOpen;document.getElementById('userMenu').classList.toggle('hide',!accountMenuOpen)};
  document.getElementById('logoutBtn').onclick=()=>{session=null;saveSession();currentView='';accountMenuOpen=false;render()};
  document.getElementById('changePwBtn').onclick=openPasswordModal;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;renderShell(currentUser())});
  renderCurrentView(u);
}
function roleBanner(u){
  if(u.role==='field')return `${siteById(u.siteId)?.name||'소속 사업장'} 사고 등록·누적기록·개선조치만 볼 수 있습니다.`;
  if(u.role==='safety')return '전체 사업장을 조회하고 사고 승인·수정·삭제·조치검토·현장/사용자 관리를 할 수 있습니다.';
  return '안전관리자가 승인한 사고만 조회할 수 있습니다.';
}
function renderNav(u){
  const items=u.role==='field'?[['report','사고 보고하기'],['action','사고 조치하기'],['history','우리 사업장 기록']]:u.role==='safety'?[['dashboard','대시보드'],['incidents','전체 사고'],['actions','개선조치'],['sites','현장관리'],['users','사용자관리']]:[['approved','승인 사고 조회']];
  return `<nav class="navtabs">${items.map(([v,t])=>`<button data-view="${v}" class="${currentView===v?'on':''}">${t}</button>`).join('')}</nav>`;
}
function renderCurrentView(u){
  const root=document.getElementById('view');
  if(u.role==='field'){
    if(currentView==='report')return renderReport(root,u);
    if(currentView==='action')return renderFieldActions(root,u);
    return renderFieldHistory(root,u);
  }
  if(u.role==='safety'){
    if(currentView==='dashboard')return renderDashboard(root,u);
    if(currentView==='incidents')return renderAllIncidents(root,u);
    if(currentView==='actions')return renderSafetyActions(root,u);
    if(currentView==='sites')return renderSites(root,u);
    return renderUsers(root,u);
  }
  renderFinalApproved(root,u);
}

function renderReport(root,u){
  const site=siteById(u.siteId);
  root.innerHTML=`<div class="grid2"><form id="reportForm" class="panel">
    <div class="section-head"><div><div class="ey">현장 즉시보고</div><h2>사고 보고하기</h2><p>현장소장은 본인 소속 사업장 사고만 등록합니다.</p></div></div>
    <div class="formgrid">
      <label class="lbl"><span>사업장</span><input value="${esc(site?.name||'-')}" disabled></label>
      <label class="lbl"><span>발생 일시 *</span><input id="occurredAt" type="datetime-local" value="${localDT()}" required></label>
      <label class="lbl"><span>사고 구분 *</span><select id="category"><option value="person">대인사고</option><option value="property">대물사고</option><option value="near_miss">아차사고</option></select></label>
      <label class="lbl"><span>사고 유형 *</span><select id="eventType">${eventTypeOptions()}</select></label>
      <label class="lbl"><span>사고 정도 *</span><select id="severity"><option value="minor">경미</option><option value="moderate">보통</option><option value="major">중대</option></select></label>
      <label class="lbl"><span>치료/휴업 예상</span><select id="leaveEstimate"><option value="unknown">미확인</option><option value="none">휴업 없음</option><option value="under3">3일 미만 예상</option><option value="3plus">3일 이상 예상</option><option value="longterm">장기치료/중상 가능</option></select></label>
      <label class="lbl"><span>사고자 성명</span><input id="injuredName" placeholder="대인사고일 때 입력"></label>
      <label class="lbl"><span>직종/업무</span><input id="job" placeholder="예: 코스관리"></label>
    </div>
    <label class="lbl"><span>사고 내용 *</span><textarea id="summary" rows="4" required placeholder="어디서 무엇을 하다가 어떻게 발생했는지"></textarea></label>
    <label class="lbl"><span>현장 즉시조치 *</span><textarea id="immediateAction" rows="3" required placeholder="응급조치, 작업중지, 접근통제, 병원이송 등"></textarea></label>
    <label class="lbl"><span><input id="potentialMajor" type="checkbox" style="width:auto;margin-right:6px">인명피해는 작아도 중대사고로 이어질 잠재위험이 큼</span></label>
    <div class="law-box">관리등급은 <b>법적 등급이 아니라 내부 우선순위</b>입니다.</div>
    ${photoPickerHtml('incident')}
    <button class="primary full" type="submit">사고보고 등록</button>
  </form>
  <aside class="panel"><h2 style="font-size:17px">우리 사업장 현황</h2><p class="sub">${esc(site?.name||'-')} 누적 사고</p><div id="fieldStats" class="cards" style="grid-template-columns:repeat(2,1fr);margin-top:12px"></div><div id="fieldRecent"></div></aside></div>`;
  incidentPhotos=[];renderPhotoThumbs('incident');bindPhotoButtons();
  document.getElementById('reportForm').onsubmit=e=>submitIncident(e,u);
  renderFieldMini(u);
}
function eventTypeOptions(selected=''){const arr=['넘어짐','부딪힘','베임/찔림','끼임','추락','차량/중장비','감전','화재/폭발','붕괴/전도','질식/중독','근골격','설비/시설 파손','기타'];return arr.map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}

function attachmentActor(){const u=currentUser?.();return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:u.role||'',position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
function ensureAttachmentStyle(){if(document.getElementById('enlAttachmentStyle411'))return;const s=document.createElement('style');s.id='enlAttachmentStyle411';s.textContent=`.attach-grid411{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:9px}.attach-card411{position:relative;min-height:104px;border:1px solid #ccd9e4;border-radius:12px;background:#f8fbfd;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center;padding:9px;box-sizing:border-box}.attach-card411 img{width:100%;height:100%;min-height:86px;object-fit:cover;border-radius:8px}.attach-card411 .attach-file411{display:grid;gap:5px;justify-items:center;color:#36536f;font-size:12px;font-weight:800;word-break:break-all}.attach-card411 .attach-icon411{font-size:30px}.attach-card411 .attach-open411{position:absolute;inset:0;border:0;background:transparent;cursor:pointer}.attach-card411 .attach-remove411{position:absolute;right:5px;top:5px;z-index:2;width:27px;height:27px;border:0;border-radius:999px;background:rgba(25,50,72,.78);color:#fff;font-weight:900}.attach-gallery411{margin-top:12px}.attach-gallery411 .attach-card411{min-height:110px}.attach-meta411{font-size:11px;color:#75879a}.photo-head small{white-space:nowrap}.photo-actions .secondary{font-weight:900}`;document.head.appendChild(s)}
function attachmentKind(a){if(typeof a==='string')return 'image';return a?.kind||(String(a?.mime||'').includes('pdf')?'pdf':'image')}
function attachmentName(a,i=0){if(typeof a==='string')return `사진 ${i+1}`;return a?.name||`${attachmentKind(a)==='pdf'?'PDF':'사진'} ${i+1}`}
function persistAttachment(a){if(typeof a==='string')return a;if(!a||typeof a!=='object')return a;const {previewUrl,...rest}=a;return rest}
function fileToBase64(file){return file.arrayBuffer().then(buf=>{const bytes=new Uint8Array(buf);let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)})}
async function uploadAttachment(file,scope){const actor=attachmentActor();if(!actor)throw new Error('로그인 정보를 확인하지 못했습니다.');if(file.size>MAX_ATTACHMENT_BYTES)throw new Error('파일은 8MB 이하만 등록할 수 있습니다.');const mime=file.type||'';if(!(mime.startsWith('image/')||mime==='application/pdf'))throw new Error('사진 또는 PDF 파일만 등록할 수 있습니다.');const base64=await fileToBase64(file);const r=await fetch(ATTACHMENT_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':ATTACHMENT_CLIENT},body:JSON.stringify({action:'upload',actor,scope,file:{name:file.name||'file',mime,size:file.size,base64}}),cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message==='file_too_large'?'파일은 8MB 이하만 등록할 수 있습니다.':'파일 업로드에 실패했습니다.');return j.attachment}
async function signAttachments(paths){const actor=attachmentActor();if(!actor||!paths.length)return{};const r=await fetch(ATTACHMENT_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':ATTACHMENT_CLIENT},body:JSON.stringify({action:'sign',actor,paths}),cache:'no-store'});const j=await r.json().catch(()=>({}));return r.ok&&j?.ok!==false?(j.urls||{}):{}}
async function openAttachment(a){if(!a)return;if(typeof a==='string'){const w=window.open('','_blank');if(w){w.document.write(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#111;height:100%;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style><img src="${a}">`);w.document.close()}return}const path=a.path;if(!path)return alert('첨부파일 경로를 확인할 수 없습니다.');const urls=await signAttachments([path]),url=urls[path];if(!url)return alert('첨부파일을 열지 못했습니다. 다시 시도해 주세요.');window.open(url,'_blank','noopener')}
function attachmentCardHtml(a,i,{removable=false}={}){const kind=attachmentKind(a),name=attachmentName(a,i),preview=typeof a==='object'?a?.previewUrl:'';return `<div class="attach-card411" data-attach-card="${i}">${kind==='image'&&(typeof a==='string'||preview)?`<img src="${typeof a==='string'?a:preview}" alt="${esc(name)}">`:`<div class="attach-file411"><span class="attach-icon411">${kind==='pdf'?'📄':'🖼️'}</span><b>${esc(name)}</b>${typeof a==='object'&&a?.size?`<span class="attach-meta411">${Math.max(1,Math.round(a.size/1024))}KB</span>`:''}</div>`}<button type="button" class="attach-open411" data-attach-open="${i}" aria-label="${esc(name)} 원본 열기"></button>${removable?`<button type="button" class="attach-remove411" data-rm="${i}" aria-label="첨부 삭제">×</button>`:''}</div>`}
function attachmentGalleryHtml(arr){const list=Array.isArray(arr)?arr:[];if(!list.length)return '';ensureAttachmentStyle();return `<div class="attach-grid411 attach-gallery411">${list.map((a,i)=>attachmentCardHtml(a,i)).join('')}</div>`}
function bindAttachmentOpen(root,arr){const list=Array.isArray(arr)?arr:[];root?.querySelectorAll('[data-attach-open]').forEach(b=>b.onclick=()=>openAttachment(list[Number(b.dataset.attachOpen)]))}
function photoPickerHtml(kind){ensureAttachmentStyle();return `<div class="photo-box"><div class="photo-head"><b>${kind==='incident'?'현장사진 / PDF':'개선조치 사진 / PDF'}</b><small id="${kind}PhotoCount">0 / ${MAX_PHOTOS}개</small></div><div class="photo-actions"><button type="button" class="secondary" id="${kind}PhotoBtn">사진·PDF 선택 / 촬영</button></div><div id="${kind}Thumbs" class="attach-grid411"></div></div>`}
function bindPhotoButtons(){const a=document.getElementById('incidentPhotoBtn');if(a)a.onclick=()=>incidentPhotoInput.click();const b=document.getElementById('actionPhotoBtn');if(b)b.onclick=()=>actionPhotoInput.click()}
incidentPhotoInput.onchange=async e=>{incidentPhotos=await addFiles(incidentPhotos,e.target.files,'incident');e.target.value='';renderPhotoThumbs('incident')};
actionPhotoInput.onchange=async e=>{actionPhotos=await addFiles(actionPhotos,e.target.files,'action');e.target.value='';renderPhotoThumbs('action')};
async function addFiles(list,fileList,kind='incident'){const left=MAX_PHOTOS-list.length;if(left<=0){alert('첨부파일은 최대 8개까지 등록할 수 있습니다.');return list}const next=[...list];for(const f of [...fileList].slice(0,left)){try{next.push(await uploadAttachment(f,kind==='action'?'action':'incident'))}catch(e){console.warn(e);alert(e?.message||'파일을 등록하지 못했습니다.')}}return next}
function compressImage(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const max=1400,r=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=url})}
function renderPhotoThumbs(kind){ensureAttachmentStyle();const arr=kind==='incident'?incidentPhotos:actionPhotos,root=document.getElementById(`${kind}Thumbs`),cnt=document.getElementById(`${kind}PhotoCount`);if(!root)return;root.innerHTML=arr.map((a,i)=>attachmentCardHtml(a,i,{removable:true})).join('');if(cnt)cnt.textContent=`${arr.length} / ${MAX_PHOTOS}개`;bindAttachmentOpen(root,arr);root.querySelectorAll('[data-rm]').forEach(b=>b.onclick=e=>{e.stopPropagation();arr.splice(Number(b.dataset.rm),1);if(kind==='incident')incidentPhotos=arr;else actionPhotos=arr;renderPhotoThumbs(kind)})}

window.enlPersistAttachment=persistAttachment;
window.enlAttachmentGalleryHtml=attachmentGalleryHtml;
window.enlBindAttachmentOpen=bindAttachmentOpen;
window.enlOpenAttachment=openAttachment;
window.enlAttachmentKind=attachmentKind;

function fieldIncidents(u){return data.incidents.filter(i=>i.siteId===u.siteId).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt))}
function renderFieldMini(u){const arr=fieldIncidents(u);const el=document.getElementById('fieldStats');if(el)el.innerHTML=`<div class="card"><span>누적 사고</span><b>${arr.length}</b></div><div class="card important"><span>조치 필요</span><b>${arr.filter(i=>i.status!=='closed'&&i.corrective?.status!=='approved').length}</b></div>`;const r=document.getElementById('fieldRecent');if(r)r.innerHTML=arr.slice(0,5).map(i=>`<div class="summary-card"><div class="summary-top"><b>${fmt(i.occurredAt)}</b><span>${priorityBadge(i.priority)}</span></div><p>${esc(i.summary)}</p>${categoryBadge(i.category)}${statusBadge(i.status)}${actionBadge(i)}</div>`).join('')||'<div class="empty">등록된 사고가 없습니다.</div>'}
async function submitIncident(e,u){
  e.preventDefault();const category=document.getElementById('category').value,severity=document.getElementById('severity').value,eventType=document.getElementById('eventType').value,leaveEstimate=document.getElementById('leaveEstimate').value,potentialMajor=document.getElementById('potentialMajor').checked;
  const i={id:uid('inc'),siteId:u.siteId,category,eventType,severity,leaveEstimate,potentialMajor,injuredName:document.getElementById('injuredName').value.trim(),job:document.getElementById('job').value.trim(),summary:document.getElementById('summary').value.trim(),immediateAction:document.getElementById('immediateAction').value.trim(),photos:[...incidentPhotos].map(persistAttachment),reporterName:u.name,reporterId:u.id,occurredAt:new Date(document.getElementById('occurredAt').value).toISOString(),createdAt:nowISO(),updatedAt:nowISO(),status:'reported',priority:computePriority(category,severity,eventType,potentialMajor,leaveEstimate),prioritySource:'auto',legalReview:computeLegalReview(category,severity,leaveEstimate),safetyNote:'',approvedBy:'',approvedAt:null,closedAt:null,corrective:null};
  data.incidents.unshift(i);saveData();incidentPhotos=[];alert(`사고가 접수되었습니다. 관리등급: ${priorityName(i.priority)}${i.legalReview?' / 법적 검토 필요':''}`);renderShell(u);
}

