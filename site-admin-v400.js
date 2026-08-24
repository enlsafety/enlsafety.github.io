/* E&L Accident Report App v4.0.0 - safety site/user settings */
(function(){
  const VERSION='4.0.0';
  const PAGE_SIZE=5;
  let siteRows=[];
  let sitePage=1;
  let siteSearch='';
  let adminTab='sites';
  const previousPlaceholder=typeof enlRenderPlatformPlaceholder==='function'?enlRenderPlatformPlaceholder:null;
  const previousMore=typeof renderMore==='function'?renderMore:null;

  function e(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function txt(v){const s=String(v??'').trim();return s==='-'?'':s}
  function num(v){return Math.max(0,Math.trunc(Number(v)||0))}
  function actor(u=currentUser()){return u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:u.role||'',position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null}
  async function api(body,timeout=12000){if(typeof window.enlIncidentApi==='function')return window.enlIncidentApi(body,timeout);throw new Error('site_api_not_ready')}
  function siteLocal(id){return (data.sites||[]).find(s=>String(s.id)===String(id))}
  function siteTitle(s){return txt(s?.site_name)||txt(siteLocal(s?.site_id)?.name)||s?.site_id||'-'}
  function phoneLink(v){const s=txt(v);return s?`<a href="tel:${e(s.replace(/[^0-9+]/g,''))}">${e(s)}</a>`:'<span class="muted">미등록</span>'}
  function verBadge(s){return s?.needs_verification?'<span class="site-verify-badge">확인필요</span>':'<span class="site-ok-badge">기본확인</span>'}
  function total(s){return num(s?.regular_count)+num(s?.daily_count)}

  function css(){
    if(document.getElementById('siteAdmin400Css'))return;
    const st=document.createElement('style');st.id='siteAdmin400Css';st.textContent=`
      .site-admin400{display:grid;gap:14px}.site-admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.site-admin-head h2{margin:3px 0 5px;font-size:24px;color:#173b66}.site-admin-head p{margin:0;color:#65788b;line-height:1.5}.site-admin-tabs{display:flex;gap:7px;flex-wrap:wrap}.site-admin-tabs button{border:1px solid #cbd7e2;background:#fff;color:#36536f;border-radius:10px;min-height:42px;padding:0 15px;font-weight:900}.site-admin-tabs button.on{background:#173b66;color:#fff;border-color:#173b66}
      .site-admin-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.site-admin-summary>div{padding:13px;border:1px solid #dbe4ed;border-radius:13px;background:#fff}.site-admin-summary span{display:block;font-size:12px;color:#718295;font-weight:800}.site-admin-summary b{display:block;margin-top:5px;font-size:23px;color:#173b66}.site-admin-summary small{display:block;margin-top:3px;font-size:10px;color:#8493a3}
      .site-admin-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.site-search-box{display:flex;gap:7px;flex:1;min-width:240px;max-width:520px}.site-search-box input{width:100%;min-height:44px;border:1.5px solid #c5d1dd;border-radius:10px;padding:0 12px;font-size:15px}.site-admin-tools button,.site-create-btn{min-height:44px;border:0;border-radius:10px;padding:0 14px;font-weight:900;cursor:pointer}.site-create-btn{background:#173b66;color:#fff}
      .site-list400{display:grid;gap:9px}.site-row400{width:100%;text-align:left;border:1px solid #d7e1eb;background:#fff;border-radius:14px;padding:14px;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.9fr) auto;gap:12px;align-items:center;cursor:pointer;color:inherit}.site-row400:hover{border-color:#8eb0ce;box-shadow:0 3px 12px rgba(23,59,102,.08)}.site-row400 .site-name-line{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.site-row400 h3{margin:0;font-size:17px;color:#173b66}.site-row400 p{margin:5px 0 0;font-size:12px;color:#6d7e8f;line-height:1.4}.site-row400 .site-counts{display:flex;gap:10px;flex-wrap:wrap}.site-row400 .site-counts span{font-size:11px;color:#718295}.site-row400 .site-counts b{display:block;color:#263f59;font-size:15px}.site-row400 .site-contact{font-size:12px;line-height:1.65;color:#53697f}.site-row400 .site-contact b{color:#294660}.site-row400 .site-agency{font-size:12px;line-height:1.5;color:#53697f}.site-row400 .site-arrow{font-size:22px;color:#6f89a1;font-weight:900}.site-verify-badge,.site-ok-badge{display:inline-flex;align-items:center;min-height:23px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:900}.site-verify-badge{background:#fff0dc;color:#a35b00;border:1px solid #f1c27c}.site-ok-badge{background:#edf7ef;color:#27703b;border:1px solid #bcdcc5}
      .site-pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px}.site-pagination button{min-width:42px;min-height:38px;border:1px solid #c9d6e1;background:#fff;border-radius:9px;font-weight:900;color:#3f5b74}.site-pagination button.on{background:#173b66;color:#fff}.site-pagination button:disabled{opacity:.35}.site-page-status{font-size:12px;color:#6d8092;margin-left:5px}
      .site-source-note{padding:11px 13px;border-radius:11px;background:#f5f8fb;color:#607488;font-size:12px;line-height:1.55}.site-source-note b{color:#173b66}.site-empty{padding:32px;text-align:center;color:#718296;background:#f8fafc;border:1px dashed #cbd7e2;border-radius:13px}
      .site-form400{display:grid;gap:15px}.site-form-section{border:1px solid #dce5ee;border-radius:13px;padding:13px;background:#fbfdff}.site-form-section h3{margin:0 0 11px;font-size:16px;color:#173b66}.site-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.site-form-grid.cols3{grid-template-columns:repeat(3,minmax(0,1fr))}.site-form400 label{display:grid;gap:6px}.site-form400 label>span{font-size:12px;font-weight:900;color:#3c5872}.site-form400 input,.site-form400 select,.site-form400 textarea{width:100%;box-sizing:border-box;border:1.4px solid #c8d4df;border-radius:9px;background:#fff;padding:10px;font:inherit}.site-form400 input,.site-form400 select{min-height:43px}.site-form400 textarea{resize:vertical;min-height:70px}.site-total-input{background:#eef3f7!important;font-weight:900;color:#173b66}.site-count-warning{margin-top:9px;padding:9px 10px;border-radius:9px;background:#fff8e9;color:#795610;font-size:11px;line-height:1.5}.site-role-help{margin-top:9px;padding:9px 10px;border-radius:9px;background:#eef5fb;color:#365d7e;font-size:11px;line-height:1.5}.site-form-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.site-form-actions button{min-height:44px;padding:0 16px;border-radius:9px;font-weight:900;border:1px solid #b9c9d8;background:#fff}.site-form-actions .primary{background:#173b66;color:#fff;border-color:#173b66}
      .site-worker-section{border-top:2px solid #e2eaf1;margin-top:15px;padding-top:14px}.site-worker-toolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.site-worker-toolbar h3{margin:0;color:#173b66}.worker-bulk-box{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin:10px 0}.worker-bulk-box textarea{min-height:86px;border:1.4px solid #c8d4df;border-radius:9px;padding:10px;resize:vertical}.worker-bulk-box button{border:0;border-radius:9px;background:#173b66;color:#fff;font-weight:900;padding:0 14px}.worker-login-list{display:grid;gap:6px;max-height:260px;overflow-y:auto}.worker-login-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid #dde5ed;border-radius:9px;background:#fff}.worker-login-row.inactive{opacity:.55;background:#f4f5f6}.worker-login-row b{font-size:14px}.worker-login-row small{display:block;margin-top:3px;color:#768696}.worker-login-row button{border:1px solid #bdcbd8;background:#fff;border-radius:8px;min-height:32px;padding:0 9px;font-weight:800}.site-role-preview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}.site-role-preview>div{padding:9px;border-radius:9px;background:#f5f8fb;font-size:11px;color:#61758a}.site-role-preview b{display:block;color:#173b66;font-size:12px;margin-bottom:3px}.site-last-edit{font-size:11px;color:#75879a;margin-top:8px}.site-admin-users{display:grid;gap:8px}.hq-user-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid #dae4ed;border-radius:12px;background:#fff}.hq-user-row b{display:block;color:#173b66}.hq-user-row span{display:block;margin-top:4px;font-size:12px;color:#6b7e90}.hq-user-row .row-actions{display:flex;gap:6px;flex-wrap:wrap}.hq-user-row button{min-height:34px;border:1px solid #bdcad7;background:#fff;border-radius:8px;font-weight:800;padding:0 9px}
      @media(max-width:820px){.site-admin-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.site-row400{grid-template-columns:1fr 1fr}.site-row400 .site-arrow{display:none}}
      @media(max-width:560px){.site-admin-head h2{font-size:21px}.site-row400{grid-template-columns:1fr;padding:13px}.site-row400 .site-counts{display:grid;grid-template-columns:repeat(3,1fr)}.site-row400 .site-contact,.site-row400 .site-agency{border-top:1px dashed #d9e2ea;padding-top:8px}.site-form-grid,.site-form-grid.cols3{grid-template-columns:1fr}.site-role-preview{grid-template-columns:1fr}.worker-bulk-box{grid-template-columns:1fr}.worker-bulk-box button{min-height:42px}.site-admin-tabs{width:100%}.site-admin-tabs button{flex:1}.site-search-box{min-width:100%;max-width:none}.site-admin-tools{align-items:stretch}.site-create-btn{width:100%}}
    `;document.head.appendChild(st);
  }

  async function ensureSeed(u){
    if(u?.role!=='safety'||window.__enlSiteMasterSeedDone)return;
    const seed=Array.isArray(window.ENL_SITE_MASTER_SEED)?window.ENL_SITE_MASTER_SEED:[];if(!seed.length)return;
    try{await api({action:'site_seed',actor:actor(u),sites:seed},18000);window.__enlSiteMasterSeedDone=true;await window.enlSiteDirectorySync?.();}
    catch(err){console.warn('site master seed skipped',err)}
  }
  async function loadSites(u){
    await ensureSeed(u);
    const res=await api({action:'site_list',actor:actor(u)},15000);
    siteRows=Array.isArray(res?.sites)?res.sites:[];
    return siteRows;
  }
  function mergeLocalSite(s){
    if(!s?.site_id)return;
    if(!Array.isArray(data.sites))data.sites=[];
    let local=siteLocal(s.site_id);
    if(!local){local={id:s.site_id,name:s.site_name,workerCount:total(s),createdAt:s.created_at||nowISO(),updatedAt:s.updated_at||nowISO()};data.sites.push(local);}
    local.name=s.site_name;local.workerCount=total(s);local.region=s.region||'';local.updatedAt=s.updated_at||nowISO();
    try{saveData()}catch(err){}
    window.enlSiteDirectorySync?.();
  }

  function renderAdminLoading(root,u){
    css();root.innerHTML=`<div class="site-admin400"><section class="panel"><div class="site-admin-head"><div><div class="ey">SITE & USER SETTINGS</div><h2>사용자·현장 설정</h2><p>현장 기본정보, 연락망, 안전관리 대행정보와 로그인 근무자를 통합 관리합니다.</p></div></div><div class="site-empty">현장 정보를 불러오는 중입니다.</div></section></div>`;
    loadSites(u).then(()=>renderAdmin(root,u)).catch(err=>{root.innerHTML=`<section class="panel"><h2>사용자·현장 설정</h2><div class="rbac-login-error">현장 정보를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.</div><button class="primary" id="siteAdminRetry" style="margin-top:10px">다시 시도</button></section>`;document.getElementById('siteAdminRetry').onclick=()=>renderAdminLoading(root,u)});
  }

  function filteredSites(){
    const q=siteSearch.trim().toLocaleLowerCase('ko-KR');
    if(!q)return [...siteRows];
    return siteRows.filter(s=>[s.site_name,s.region,s.manager_name,s.part_name,s.clerk_name,s.safety_agency,s.address].some(v=>String(v||'').toLocaleLowerCase('ko-KR').includes(q)));
  }
  function pageSites(){const arr=filteredSites();const pages=Math.max(1,Math.ceil(arr.length/PAGE_SIZE));sitePage=Math.min(Math.max(1,sitePage),pages);return {arr,pages,rows:arr.slice((sitePage-1)*PAGE_SIZE,sitePage*PAGE_SIZE)}}

  function siteRowHtml(s){
    return `<button type="button" class="site-row400" data-site-open="${e(s.site_id)}">
      <div><div class="site-name-line"><h3>${e(siteTitle(s))}</h3>${verBadge(s)}</div><p>${e(txt(s.region)||'지역 미등록')}${txt(s.start_date)?` · 시작 ${e(s.start_date)}`:''}${txt(s.address)?`<br>${e(s.address)}`:''}</p></div>
      <div class="site-counts"><span>상시근로자<b>${num(s.regular_count)}명</b></span><span>일용직<b>${num(s.daily_count)}명</b></span><span>총인원<b>${total(s)}명</b></span></div>
      <div class="site-contact"><b>소장</b> ${e(txt(s.manager_name)||'미등록')} · ${phoneLink(s.manager_phone)}<br><b>로그인 근로자</b> ${num(s.worker_login_count)}명</div>
      <div class="site-agency"><b>${e(txt(s.safety_agency)||'안전대행 미등록')}</b><br>${e(txt(s.inspection_cycle)||'점검주기 미등록')}</div>
      <div class="site-arrow">›</div>
    </button>`;
  }
  function paginationHtml(pages){
    let btns='';const from=Math.max(1,sitePage-2),to=Math.min(pages,from+4);for(let p=from;p<=to;p++)btns+=`<button type="button" data-site-page="${p}" class="${p===sitePage?'on':''}">${p}</button>`;
    return `<div class="site-pagination"><button type="button" data-site-page="${sitePage-1}" ${sitePage<=1?'disabled':''}>‹</button>${btns}<button type="button" data-site-page="${sitePage+1}" ${sitePage>=pages?'disabled':''}>›</button><span class="site-page-status">${sitePage} / ${pages}</span></div>`;
  }
  function summaryHtml(rows){
    const active=rows.filter(s=>s.active!==false),reg=active.reduce((n,s)=>n+num(s.regular_count),0),daily=active.reduce((n,s)=>n+num(s.daily_count),0),worker=active.reduce((n,s)=>n+num(s.worker_login_count),0);
    return `<div class="site-admin-summary"><div><span>등록 현장</span><b>${active.length}</b><small>운영중 기준</small></div><div><span>상시근로자수</span><b>${reg}</b><small>엑셀 운영값 포함</small></div><div><span>일용직 근로자</span><b>${daily}</b><small>등록 현황 합계</small></div><div><span>로그인 일반근로자</span><b>${worker}</b><small>실명 등록계정</small></div></div>`;
  }

  function renderSitesTab(root,u){
    const p=pageSites();
    root.innerHTML=`<div class="site-admin400">
      <section class="panel"><div class="site-admin-head"><div><div class="ey">SITE & USER SETTINGS</div><h2>사용자·현장 설정</h2><p>현장정보를 5개씩 확인하고 클릭하여 수정할 수 있습니다.</p></div><div class="site-admin-tabs"><button data-admin400-tab="sites" class="on">현장정보 관리</button><button data-admin400-tab="hq">본사 사용자</button></div></div></section>
      ${summaryHtml(siteRows)}
      <section class="panel"><div class="site-admin-tools"><div class="site-search-box"><input id="siteAdminSearch" placeholder="사업장명, 지역, 소장, 대행업체 검색" value="${e(siteSearch)}"><button type="button" id="siteAdminSearchBtn">검색</button></div><button type="button" class="site-create-btn" id="siteCreate400">+ 현장 생성</button></div>
        <div class="site-source-note" style="margin:12px 0"><b>초기자료 자동반영</b> · 2026.08.11 통합 사업장 현황의 지역, 인원, 소장·파트장·서무 연락망, 안전관리 대행정보를 반영했습니다. 사업시작일·주소는 확인 가능한 원본 값이 없어 직접 입력하도록 두었습니다.</div>
        <div class="site-list400">${p.rows.map(siteRowHtml).join('')||'<div class="site-empty">조건에 맞는 현장이 없습니다.</div>'}</div>${paginationHtml(p.pages)}</section>
    </div>`;
    bindTabs(root,u);document.getElementById('siteCreate400').onclick=()=>openSiteModal(null,u);
    const search=()=>{siteSearch=document.getElementById('siteAdminSearch').value;sitePage=1;renderSitesTab(root,u)};document.getElementById('siteAdminSearchBtn').onclick=search;document.getElementById('siteAdminSearch').onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();search()}};
    root.querySelectorAll('[data-site-open]').forEach(b=>b.onclick=()=>openSiteModal(siteRows.find(s=>s.site_id===b.dataset.siteOpen),u));
    root.querySelectorAll('[data-site-page]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.sitePage);if(next>=1&&next<=p.pages){sitePage=next;renderSitesTab(root,u)}});
  }
  function bindTabs(root,u){root.querySelectorAll('[data-admin400-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.admin400Tab;if(adminTab==='hq')renderHqTab(root,u);else renderSitesTab(root,u)})}

  function renderHqTab(root,u){
    const users=(data.users||[]).filter(x=>['safety','final'].includes(x.role));
    root.innerHTML=`<div class="site-admin400"><section class="panel"><div class="site-admin-head"><div><div class="ey">HQ ACCOUNTS</div><h2>본사 사용자 계정</h2><p>안전관리자와 관리자 계정을 관리합니다. 현장소장·파트장·서무 계정은 각 현장 연락망에서 자동 연결됩니다.</p></div><div class="site-admin-tabs"><button data-admin400-tab="sites">현장정보 관리</button><button data-admin400-tab="hq" class="on">본사 사용자</button></div></div><div style="margin-top:12px"><button type="button" class="site-create-btn" id="hqUserAdd400">+ 본사 사용자 생성</button></div></section><section class="panel"><div class="site-admin-users">${users.map(x=>`<div class="hq-user-row ${x.active===false?'is-disabled':''}"><div><b>${e(x.name)} ${x.active===false?'(비활성)':''}</b><span>아이디 ${e(x.username)} · ${e(roleName(x.role))}</span></div><div class="row-actions"><button data-hq-edit="${e(x.id)}">정보·권한 수정</button><button data-hq-pw="${e(x.id)}">비밀번호 부여</button>${x.id!==u.id?`<button data-hq-toggle="${e(x.id)}">${x.active===false?'활성화':'비활성'}</button>`:''}</div></div>`).join('')||'<div class="site-empty">본사 사용자가 없습니다.</div>'}</div></section></div>`;
    bindTabs(root,u);const add=document.getElementById('hqUserAdd400');if(add)add.onclick=()=>typeof openUserModal==='function'&&openUserModal(null,u);
    root.querySelectorAll('[data-hq-edit]').forEach(b=>b.onclick=()=>{const x=userById(b.dataset.hqEdit);if(x&&typeof openUserModal==='function')openUserModal(x,u)});
    root.querySelectorAll('[data-hq-pw]').forEach(b=>b.onclick=()=>{const x=userById(b.dataset.hqPw);if(x&&typeof openAdminPasswordReset==='function')openAdminPasswordReset(x,u)});
    root.querySelectorAll('[data-hq-toggle]').forEach(b=>b.onclick=()=>{const x=userById(b.dataset.hqToggle);if(!x)return;x.active=!x.active;x.updatedAt=nowISO();saveData();renderHqTab(root,u)});
  }
  function renderAdmin(root,u){css();if(u?.role!=='safety'){root.innerHTML='<div class="panel permission-empty"><h2>안전관리자 전용 메뉴입니다.</h2></div>';return}if(adminTab==='hq')renderHqTab(root,u);else renderSitesTab(root,u)}

  function value(id){return txt(document.getElementById(id)?.value)}
  function formSite(site){
    const s=site||{};
    return `<form id="siteMasterForm400" class="site-form400">
      <section class="site-form-section"><h3>1. 기본 현황</h3><div class="site-form-grid"><label><span>지역</span><input id="smRegion" value="${e(txt(s.region))}" placeholder="예: 경기 이천"></label><label><span>사업장명 *</span><input id="smName" value="${e(txt(s.site_name))}" required></label><label><span>사업시작일</span><input id="smStart" type="date" value="${e(txt(s.start_date))}"></label><label><span>주소</span><input id="smAddress" value="${e(txt(s.address))}" placeholder="도로명 주소"></label><label><span>구분</span><input id="smType" value="${e(txt(s.site_type)||'코스현장')}"></label><label><span>코스/홀</span><input id="smCourse" value="${e(txt(s.course_holes))}"></label><label><span>근무형태</span><input id="smPattern" value="${e(txt(s.work_pattern))}"></label><label><span>운영상태</span><select id="smActive"><option value="1" ${s.active!==false?'selected':''}>운영중</option><option value="0" ${s.active===false?'selected':''}>운영종료</option></select></label></div></section>
      <section class="site-form-section"><h3>2. 인원 현황</h3><div class="site-form-grid cols3"><label><span>상시근로자수</span><input id="smRegular" type="number" min="0" value="${num(s.regular_count)}"></label><label><span>일용직 근로자수</span><input id="smDaily" type="number" min="0" value="${num(s.daily_count)}"></label><label><span>총인원</span><input id="smTotal" class="site-total-input" readonly value="${total(s)}"></label></div><div class="site-count-warning"><b>확인 기준</b> · 엑셀에서 자동 입력한 상시근로자수 초기값은 원본의 ‘직원 현재원’입니다. 산업안전보건법 적용을 위한 법적 상시근로자수는 근로형태·산정기간 등을 별도로 확인한 뒤 수정하세요.</div></section>
      <section class="site-form-section"><h3>3. 현장 연락망</h3><div class="site-form-grid"><label><span>현장소장</span><input id="smManager" value="${e(txt(s.manager_name))}"></label><label><span>현장소장 전화번호</span><input id="smManagerPhone" inputmode="tel" value="${e(txt(s.manager_phone))}"></label><label><span>파트장</span><input id="smPart" value="${e(txt(s.part_name))}"></label><label><span>파트장 전화번호</span><input id="smPartPhone" inputmode="tel" value="${e(txt(s.part_phone))}"></label><label><span>서무</span><input id="smClerk" value="${e(txt(s.clerk_name))}"></label><label><span>서무 전화번호</span><input id="smClerkPhone" inputmode="tel" value="${e(txt(s.clerk_phone))}"></label></div><div class="site-role-help">현장소장·파트장·서무의 이름과 전화번호를 저장하면 해당 사업장 현장관리 로그인 계정이 자동 연결됩니다. PIN은 등록 전화번호의 뒷자리 4자리입니다.</div><div class="site-role-preview"><div><b>현장소장</b>${e(txt(s.manager_name)||'미등록')}<br>${e(txt(s.manager_phone)||'전화 미등록')}</div><div><b>파트장</b>${e(txt(s.part_name)||'미등록')}<br>${e(txt(s.part_phone)||'전화 미등록')}</div><div><b>서무</b>${e(txt(s.clerk_name)||'미등록')}<br>${e(txt(s.clerk_phone)||'전화 미등록')}</div></div></section>
      <section class="site-form-section"><h3>4. 안전관리 대행정보</h3><div class="site-form-grid"><label><span>대행/위탁 현황</span><select id="smOutStatus"><option value="" ${!txt(s.safety_outsource_status)?'selected':''}>미확인</option><option value="있음" ${txt(s.safety_outsource_status)==='있음'?'selected':''}>있음</option><option value="없음" ${txt(s.safety_outsource_status)==='없음'?'selected':''}>없음</option><option value="미확인" ${txt(s.safety_outsource_status)==='미확인'?'selected':''}>미확인</option></select></label><label><span>안전대행업체</span><input id="smAgency" value="${e(txt(s.safety_agency))}"></label><label><span>업체 담당자</span><input id="smAgencyManager" value="${e(txt(s.agency_manager))}"></label><label><span>업체 연락처</span><input id="smAgencyPhone" inputmode="tel" value="${e(txt(s.agency_phone))}"></label><label><span>계약기간</span><input id="smContract" value="${e(txt(s.contract_period))}" placeholder="예: 2026-01-01~2026-12-31"></label><label><span>점검주기</span><input id="smCycle" value="${e(txt(s.inspection_cycle))}" placeholder="예: 월 1회"></label></div><label style="margin-top:10px"><span>대행업무 / 범위</span><textarea id="smScope">${e(txt(s.agency_scope))}</textarea></label><label style="margin-top:10px"><span>업체 비고</span><textarea id="smAgencyNote">${e(txt(s.agency_note))}</textarea></label></section>
      <section class="site-form-section"><h3>5. 확인 메모</h3><label><span>확인 필요사항</span><textarea id="smVerifyNote">${e(txt(s.verification_note))}</textarea></label><label style="display:flex;grid-template-columns:auto 1fr;align-items:center;margin-top:9px"><input id="smNeedVerify" type="checkbox" style="width:20px;height:20px" ${s.needs_verification?'checked':''}><span>확인 필요 현장으로 표시</span></label>${s.updated_by_name?`<div class="site-last-edit">최근 수정: ${e(s.updated_by_name)} ${txt(s.updated_by_position)?'('+e(s.updated_by_position)+')':''} · ${e(typeof fmt==='function'?fmt(s.updated_at):s.updated_at||'')}</div>`:''}</section>
      <div class="site-form-actions"><button type="button" data-close>취소</button><button type="submit" class="primary">현장정보 저장</button></div>
    </form>`;
  }

  function formPayload(site){return {
    site_id:site?.site_id||'',site_name:value('smName'),site_type:value('smType'),region:value('smRegion'),start_date:value('smStart'),address:value('smAddress'),regular_count:num(value('smRegular')),daily_count:num(value('smDaily')),manager_name:value('smManager'),manager_phone:value('smManagerPhone'),part_name:value('smPart'),part_phone:value('smPartPhone'),clerk_name:value('smClerk'),clerk_phone:value('smClerkPhone'),safety_outsource_status:value('smOutStatus'),safety_agency:value('smAgency'),agency_manager:value('smAgencyManager'),agency_phone:value('smAgencyPhone'),contract_period:value('smContract'),inspection_cycle:value('smCycle'),course_holes:value('smCourse'),work_pattern:value('smPattern'),agency_scope:value('smScope'),agency_note:value('smAgencyNote'),verification_note:value('smVerifyNote'),needs_verification:!!document.getElementById('smNeedVerify')?.checked,active:value('smActive')!=='0',source:site?.source||'manual'
  }}
  function bindTotal(){const r=document.getElementById('smRegular'),d=document.getElementById('smDaily'),t=document.getElementById('smTotal');const run=()=>{if(t)t.value=String(num(r?.value)+num(d?.value))};r?.addEventListener('input',run);d?.addEventListener('input',run);run()}

  async function openSiteModal(site,u){
    openModal(`<div class="modal-head"><div><div class="ey">SITE MASTER</div><h2>${site?'현장정보 조회·수정':'신규 현장 생성'}</h2><p style="margin:5px 0 0;color:#6f8192;font-size:12px">${site?e(siteTitle(site)):'필수 현장정보를 입력해 주세요.'}</p></div><button class="x" data-close>×</button></div>${formSite(site)}${site?`<section class="site-worker-section"><div id="siteWorker400"><div class="site-empty">일반근로자 로그인 명단을 불러오는 중입니다.</div></div></section>`:''}`);
    bindTotal();
    const form=document.getElementById('siteMasterForm400');
    form.onsubmit=async ev=>{ev.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='저장 중…';try{const res=await api({action:'site_upsert',actor:actor(u),site:formPayload(site)},15000);mergeLocalSite(res.site);await loadSites(u);closeModal();const root=document.getElementById('view');if(root)renderSitesTab(root,u);alert('현장정보가 저장되었습니다.')}catch(err){console.warn(err);alert('현장정보를 저장하지 못했습니다. 입력값과 네트워크를 확인해 주세요.');submit.disabled=false;submit.textContent='현장정보 저장'}};
    if(site)loadWorkerPanel(site,u);
  }

  async function loadWorkerPanel(site,u){
    const box=document.getElementById('siteWorker400');if(!box)return;
    try{const res=await api({action:'personnel_pull',actor:actor(u),siteId:site.site_id},12000);renderWorkerPanel(box,site,u,res.personnel||[])}catch(err){box.innerHTML='<div class="rbac-login-error">근무자 로그인 명단을 불러오지 못했습니다.</div>'}
  }
  function renderWorkerPanel(box,site,u,list){
    const workers=list.filter(p=>p.access_role==='worker');
    box.innerHTML=`<div class="site-worker-toolbar"><div><h3>6. 일반근로자 로그인 관리</h3><p style="margin:4px 0 0;font-size:12px;color:#718396">실명으로 등록된 근로자만 이름 → 근무지 선택 방식으로 로그인할 수 있습니다.</p></div><b>근무중 ${workers.filter(x=>x.active).length}명</b></div><div class="worker-bulk-box"><textarea id="workerBulk400" placeholder="일반근로자 이름을 한 줄에 한 명씩 입력\n예) 홍길동\n김이앤"></textarea><button type="button" id="workerBulkAdd400">근로자 등록</button></div><div class="worker-login-list">${workers.map(p=>`<div class="worker-login-row ${p.active?'':'inactive'}"><div><b>${e(p.name)}</b><small>${p.active?'로그인 가능':'퇴사/비활성'}${p.updated_by_name?' · 최근수정 '+e(p.updated_by_name):''}</small></div><button type="button" data-worker-toggle400="${e(p.personnel_id)}">${p.active?'퇴사처리':'복직'}</button></div>`).join('')||'<div class="site-empty">등록된 일반근로자가 없습니다.</div>'}</div><div class="site-source-note" style="margin-top:9px">이전 자료에서 실명 근무자 명단을 확인할 수 없는 현장은 이름을 임의 생성하지 않았습니다. 실제 재직자 이름을 등록하면 즉시 로그인할 수 있습니다.</div>`;
    document.getElementById('workerBulkAdd400').onclick=async()=>{const names=[...new Set(document.getElementById('workerBulk400').value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean))];if(!names.length)return alert('등록할 근로자 이름을 입력해 주세요.');const btn=document.getElementById('workerBulkAdd400');btn.disabled=true;btn.textContent='등록 중…';try{for(const name of names){await api({action:'personnel_upsert',actor:actor(u),siteId:site.site_id,person:{siteId:site.site_id,name,jobTitle:'일반근로자',accessRole:'worker',active:true,pinHash:''}},12000)}alert(`${names.length}명의 일반근로자를 등록했습니다.`);await loadSites(u);loadWorkerPanel(site,u)}catch(err){alert('일부 근로자를 등록하지 못했습니다. 다시 확인해 주세요.');loadWorkerPanel(site,u)}};
    box.querySelectorAll('[data-worker-toggle400]').forEach(b=>b.onclick=async()=>{const p=workers.find(x=>String(x.personnel_id)===b.dataset.workerToggle400);if(!p)return;const active=!p.active;if(!confirm(`${p.name}님을 ${active?'복직':'퇴사'} 처리할까요?`))return;try{await api({action:'personnel_upsert',actor:actor(u),siteId:site.site_id,person:{personnelId:p.personnel_id,siteId:site.site_id,name:p.name,jobTitle:p.job_title||'일반근로자',accessRole:'worker',active,pinHash:''}},12000);await loadSites(u);loadWorkerPanel(site,u)}catch(err){alert('처리하지 못했습니다.')}});
  }

  enlRenderPlatformPlaceholder=function(root,u,section){if(section==='admin'){renderAdminLoading(root,u);return}if(previousPlaceholder)return previousPlaceholder(root,u,section)};
  renderMore=function(root,u){if(u?.role==='safety'){enlPlatformSection='admin';try{localStorage.setItem(ENL_PLATFORM_SECTION_KEY,'admin')}catch(err){}renderAdminLoading(root,u);return}if(previousMore)return previousMore(root,u)};
  css();
  window.ENL_DEPLOY_VERSION=VERSION;
})();
