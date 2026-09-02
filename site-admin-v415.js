/* E&L Accident Report App v4.1.5 - unified site/personnel admin */
(function(){
  'use strict';

  const VERSION='4.1.5-personnel2';
  const SITE_PAGE_SIZE=8;
  const PERSON_PAGE_SIZE=10;
  const FIELD_TITLES=['현장소장','파트장','서무'];

  let sites=[];
  let sitePage=1;
  let siteQuery='';
  let activeTab='sites';
  const personStates=new Map();

  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const text=v=>String(v??'').trim();
  const number=v=>Math.max(0,Math.trunc(Number(v)||0));
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const actor=(u=currentUser?.())=>u?{
    id:u.id||u.personnelId||u.username||'',
    name:u.name||'',
    role:roleNorm(u.role),
    position:u.position||u.jobTitle||'',
    siteId:u.siteId||''
  }:null;
  const siteApi=(body,timeout=15000)=>{
    if(typeof window.enlIncidentApi!=='function')throw new Error('site_api_not_ready');
    return window.enlIncidentApi(body,timeout);
  };
  const authApi=(body,timeout=12000)=>{
    if(typeof window.enlAuthApi!=='function')throw new Error('auth_api_not_ready');
    return window.enlAuthApi(body,timeout);
  };
  const siteName=s=>text(s?.site_name)||text(s?.site_id)||'-';
  const total=s=>number(s?.regular_count)+number(s?.daily_count);

  function stateFor(siteId){
    const key=String(siteId||'');
    if(!personStates.has(key))personStates.set(key,{page:1,query:'',selectedId:'',list:[]});
    return personStates.get(key);
  }

  function personRank(p){
    if(p?.active===false)return 9;
    if(p?.job_title==='현장소장')return 0;
    if(p?.job_title==='파트장')return 1;
    if(p?.job_title==='서무')return 2;
    return 3;
  }

  function sortedPeople(list){
    return [...(list||[])].sort((a,b)=>personRank(a)-personRank(b)||String(a.name||'').localeCompare(String(b.name||''),'ko'));
  }

  function installCss(){
    if(document.getElementById('siteAdmin415Css'))return;
    const style=document.createElement('style');
    style.id='siteAdmin415Css';
    style.textContent=`
      .sa415{display:grid;gap:12px}.sa415-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.sa415-head h2{margin:3px 0 5px;color:#173b66;font-size:24px}.sa415-head p{margin:0;color:#687c8e;line-height:1.5}
      .sa415-tabs{display:flex;gap:6px;flex-wrap:wrap}.sa415-tabs button{min-height:42px;border:1px solid #c7d5e0;border-radius:10px;background:#fff;color:#385872;padding:0 14px;font-weight:900}.sa415-tabs button.on{background:#173b66;color:#fff;border-color:#173b66}
      .sa415-tools{display:flex;gap:7px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.sa415-search{display:flex;gap:6px;flex:1;max-width:560px}.sa415-search input{width:100%;min-height:44px;border:1.5px solid #c4d1dc;border-radius:10px;padding:0 12px;font-size:15px}.sa415-tools button,.sa415-primary{min-height:44px;border:0;border-radius:10px;background:#173b66;color:#fff;padding:0 14px;font-weight:900}
      .sa415-sites,.sa415-hq{display:grid;gap:8px}.sa415-site,.sa415-hq-row{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.8fr) minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #d8e3eb;border-radius:13px;background:#fff;padding:12px;color:inherit;text-align:left}.sa415-site{width:100%;cursor:pointer}.sa415-site:hover{border-color:#83aac8}.sa415-site h3,.sa415-hq-row b{margin:0;color:#173b66}.sa415-site p,.sa415-hq-row span{margin:4px 0 0;color:#6a7e91;font-size:12px}.sa415-counts{display:flex;gap:10px}.sa415-counts span{font-size:11px;color:#718397}.sa415-counts b{display:block;font-size:16px;color:#2a4862}.sa415-arrow{font-size:22px;color:#6f8aa1}
      .sa415-page{display:flex;justify-content:center;gap:7px;margin-top:11px;flex-wrap:wrap}.sa415-page button{min-width:42px;min-height:38px;border:1px solid #c7d4df;border-radius:8px;background:#fff;font-weight:900}.sa415-page button.on{background:#173b66;color:#fff}.sa415-empty{padding:24px;text-align:center;color:#708398;background:#f8fafc;border:1px dashed #cad7e1;border-radius:12px}
      .sa415-form{display:grid;gap:13px}.sa415-section{padding:12px;border:1px solid #dbe5ed;border-radius:12px;background:#fbfdff}.sa415-section h3{margin:0 0 10px;color:#174d78;font-size:15px}.sa415-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.sa415-grid.cols3{grid-template-columns:repeat(3,minmax(0,1fr))}.sa415-form label,.sa415-person-edit label{display:grid;gap:5px}.sa415-form label span,.sa415-person-edit label span{font-size:12px;font-weight:900;color:#476079}.sa415-form input,.sa415-form select,.sa415-form textarea,.sa415-person-edit input,.sa415-person-edit select{width:100%;box-sizing:border-box;border:1.4px solid #c5d2dd;border-radius:9px;background:#fff;padding:9px;font:inherit}.sa415-form input,.sa415-form select,.sa415-person-edit input,.sa415-person-edit select{min-height:42px}.sa415-form input[readonly]{background:#f2f6f9;color:#5e7182}.sa415-form textarea{min-height:72px;resize:vertical}.sa415-form-actions{display:flex;justify-content:flex-end;gap:7px}.sa415-form-actions button{min-height:43px;border:1px solid #bdcad6;border-radius:9px;background:#fff;padding:0 13px;font-weight:900}.sa415-form-actions .primary{background:#173b66;color:#fff;border-color:#173b66}.sa415-note{margin:7px 0 0;color:#718397;font-size:11px;line-height:1.5}
      .sa415-people{margin-top:14px;padding-top:14px;border-top:2px solid #e2e9ef}.sa415-people-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}.sa415-people-head h3{margin:0;color:#174d78}.sa415-people-head p{margin:4px 0 0;color:#718397;font-size:12px}.sa415-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin:10px 0}.sa415-add textarea{min-height:62px;border:1.4px solid #c5d2dd;border-radius:9px;padding:9px}.sa415-add button{border:0;border-radius:9px;background:#173b66;color:#fff;font-weight:900}.sa415-person-tools{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.sa415-person-tools input{flex:1;min-width:180px;min-height:42px;border:1.4px solid #c5d2dd;border-radius:9px;padding:0 10px}.sa415-person-tools button{min-height:42px;border:1px solid #bdcbd7;border-radius:9px;background:#fff;padding:0 11px;font-weight:900}
      .sa415-person-list{display:grid;gap:6px}.sa415-person{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.7fr) minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid #dce5ec;border-radius:9px;background:#fff}.sa415-person.inactive{opacity:.55}.sa415-person b{color:#254761}.sa415-person small{display:block;margin-top:3px;color:#76899a}.sa415-person .position{font-size:12px;font-weight:900;color:#275a7f}.sa415-person .phone{font-size:12px;color:#566f84}.sa415-person button{min-height:34px;border:1px solid #bdcbd7;border-radius:8px;background:#fff;font-weight:850}
      .sa415-person-edit{margin-top:12px;padding:12px;border:2px solid #bcd5e7;border-radius:12px;background:#f7fbfe}.sa415-person-edit h4{margin:0 0 9px;color:#174d78}.sa415-person-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:10px}.sa415-person-actions button{min-height:42px;border:1px solid #bdcad6;border-radius:9px;background:#fff;padding:0 12px;font-weight:900}.sa415-person-actions .primary{background:#173b66;color:#fff;border-color:#173b66}.sa415-hq-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.sa415-hq-actions button{min-height:34px;border:1px solid #bdcbd7;border-radius:8px;background:#fff;padding:0 9px;font-weight:850}.sa415-role{display:inline-flex;align-items:center;min-height:25px;padding:0 8px;border-radius:999px;background:#eef6fc;color:#21587e;font-size:11px;font-weight:900}
      @media(max-width:760px){.sa415-site,.sa415-hq-row{grid-template-columns:1fr 1fr}.sa415-arrow{display:none}.sa415-grid,.sa415-grid.cols3{grid-template-columns:1fr}.sa415-person{grid-template-columns:1fr 1fr}.sa415-person button{justify-self:start}}
      @media(max-width:480px){.sa415-site,.sa415-hq-row,.sa415-person{grid-template-columns:1fr}.sa415-search{max-width:none;width:100%}.sa415-tools>.sa415-primary{width:100%}.sa415-add{grid-template-columns:1fr}.sa415-add button{min-height:42px}.sa415-person-actions{flex-direction:column}.sa415-person-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function loadSites(u){
    const result=await siteApi({action:'site_list',actor:actor(u)});
    sites=Array.isArray(result?.sites)?result.sites:[];
    return sites;
  }

  function filteredSites(){
    const q=siteQuery.trim().toLocaleLowerCase('ko-KR');
    if(!q)return [...sites];
    return sites.filter(s=>[s.site_name,s.region,s.manager_name,s.part_name,s.clerk_name,s.safety_agency,s.address].some(v=>String(v||'').toLocaleLowerCase('ko-KR').includes(q)));
  }

  function sitePageData(){
    const all=filteredSites();
    const pages=Math.max(1,Math.ceil(all.length/SITE_PAGE_SIZE));
    sitePage=Math.max(1,Math.min(sitePage,pages));
    return {pages,rows:all.slice((sitePage-1)*SITE_PAGE_SIZE,sitePage*SITE_PAGE_SIZE)};
  }

  function tabsHtml(){
    return `<div class="sa415-tabs"><button type="button" data-sa415-tab="sites" class="${activeTab==='sites'?'on':''}">현장정보 관리</button><button type="button" data-sa415-tab="hq" class="${activeTab==='hq'?'on':''}">본사 사용자</button></div>`;
  }

  function bindTabs(root,u){
    root.querySelectorAll('[data-sa415-tab]').forEach(button=>{
      button.onclick=()=>{
        activeTab=button.dataset.sa415Tab;
        if(activeTab==='hq')renderHq(root,u);else renderSites(root,u);
      };
    });
  }

  function renderSites(root,u){
    const pageData=sitePageData();
    root.innerHTML=`<div class="sa415"><section class="panel"><div class="sa415-head"><div><div class="ey">SITE & USER SETTINGS</div><h2>사용자·현장 설정</h2><p>현장 기본정보와 일반근로자·현장소장·파트장·서무를 한 곳에서 관리합니다.</p></div>${tabsHtml()}</div></section><section class="panel"><div class="sa415-tools"><div class="sa415-search"><input id="sa415SiteSearch" value="${escx(siteQuery)}" placeholder="사업장명, 지역, 소장 검색"><button type="button" id="sa415SiteSearchBtn">검색</button></div><button type="button" class="sa415-primary" id="sa415CreateSite">+ 현장 생성</button></div><div class="sa415-sites">${pageData.rows.map(s=>`<button type="button" class="sa415-site" data-sa415-site="${escx(s.site_id)}"><div><h3>${escx(siteName(s))}${s.active===false?' (운영종료)':''}</h3><p>${escx(text(s.region)||'지역 미등록')}${text(s.address)?' · '+escx(s.address):''}</p></div><div class="sa415-counts"><span>상시<b>${number(s.regular_count)}</b></span><span>일용<b>${number(s.daily_count)}</b></span><span>합계<b>${total(s)}</b></span></div><div><b>소장 ${escx(text(s.manager_name)||'미등록')}</b><p>등록 근무자 ${number(s.worker_login_count)}명</p></div><span class="sa415-arrow">›</span></button>`).join('')||'<div class="sa415-empty">조건에 맞는 사업장이 없습니다.</div>'}</div><div class="sa415-page">${Array.from({length:pageData.pages},(_,i)=>i+1).slice(Math.max(0,sitePage-3),Math.max(0,sitePage-3)+5).map(p=>`<button type="button" data-sa415-site-page="${p}" class="${p===sitePage?'on':''}">${p}</button>`).join('')}</div></section></div>`;
    bindTabs(root,u);
    const search=()=>{siteQuery=document.getElementById('sa415SiteSearch').value;sitePage=1;renderSites(root,u);};
    document.getElementById('sa415SiteSearchBtn').onclick=search;
    document.getElementById('sa415SiteSearch').onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();search();}};
    document.getElementById('sa415CreateSite').onclick=()=>openSite(null,u,root);
    root.querySelectorAll('[data-sa415-site]').forEach(button=>button.onclick=()=>openSite(sites.find(s=>String(s.site_id)===String(button.dataset.sa415Site)),u,root));
    root.querySelectorAll('[data-sa415-site-page]').forEach(button=>button.onclick=()=>{sitePage=Number(button.dataset.sa415SitePage);renderSites(root,u);});
  }

  function value(id){return text(document.getElementById(id)?.value);}

  function siteFormHtml(s={}){
    return `<form id="sa415SiteForm" class="sa415-form"><section class="sa415-section"><h3>1. 기본 현황</h3><div class="sa415-grid"><label><span>사업장명 *</span><input id="sa415Name" value="${escx(text(s.site_name))}" required></label><label><span>지역</span><input id="sa415Region" value="${escx(text(s.region))}"></label><label><span>사업시작일</span><input id="sa415Start" type="date" value="${escx(text(s.start_date))}"></label><label><span>주소</span><input id="sa415Address" value="${escx(text(s.address))}"></label><label><span>구분</span><input id="sa415Type" value="${escx(text(s.site_type)||'코스현장')}"></label><label><span>운영상태</span><select id="sa415Active"><option value="1" ${s.active!==false?'selected':''}>운영중</option><option value="0" ${s.active===false?'selected':''}>운영종료</option></select></label></div></section><section class="sa415-section"><h3>2. 인원</h3><div class="sa415-grid cols3"><label><span>상시근로자</span><input id="sa415Regular" type="number" min="0" value="${number(s.regular_count)}"></label><label><span>일용직</span><input id="sa415Daily" type="number" min="0" value="${number(s.daily_count)}"></label><label><span>총인원</span><input value="${total(s)}" disabled></label></div></section><section class="sa415-section"><h3>3. 현장 연락망</h3><div class="sa415-grid"><label><span>현장소장</span><input id="sa415Manager" value="${escx(text(s.manager_name))}" readonly></label><label><span>현장소장 전화</span><input id="sa415ManagerPhone" value="${escx(text(s.manager_phone))}" readonly></label><label><span>파트장</span><input id="sa415Part" value="${escx(text(s.part_name))}" readonly></label><label><span>파트장 전화</span><input id="sa415PartPhone" value="${escx(text(s.part_phone))}" readonly></label><label><span>서무</span><input id="sa415Clerk" value="${escx(text(s.clerk_name))}" readonly></label><label><span>서무 전화</span><input id="sa415ClerkPhone" value="${escx(text(s.clerk_phone))}" readonly></label></div><p class="sa415-note">현장소장·파트장·서무 연락망은 아래 인원목록에서 직책과 전화번호를 수정하면 자동으로 반영됩니다.</p></section><section class="sa415-section"><h3>4. 안전관리 대행</h3><div class="sa415-grid"><label><span>안전대행업체</span><input id="sa415Agency" value="${escx(text(s.safety_agency))}"></label><label><span>담당자</span><input id="sa415AgencyManager" value="${escx(text(s.agency_manager))}"></label><label><span>연락처</span><input id="sa415AgencyPhone" value="${escx(text(s.agency_phone))}"></label><label><span>점검주기</span><input id="sa415Cycle" value="${escx(text(s.inspection_cycle))}"></label></div><label style="margin-top:8px"><span>업무범위/비고</span><textarea id="sa415Scope">${escx(text(s.agency_scope||s.agency_note))}</textarea></label></section><div class="sa415-form-actions"><button type="button" data-close>취소</button><button class="primary" type="submit">현장정보 저장</button></div></form>`;
  }

  async function openSite(site,u,root){
    openModal(`<div class="modal-head"><div><div class="ey">SITE MASTER</div><h2>${site?'현장정보 조회·수정':'신규 현장 생성'}</h2></div><button class="x" data-close>×</button></div>${siteFormHtml(site)}${site?'<div id="sa415People" class="sa415-people"><div class="sa415-empty">근무자 명단을 불러오는 중입니다.</div></div>':''}`);
    document.getElementById('sa415SiteForm').onsubmit=async ev=>{
      ev.preventDefault();
      const payload={
        site_id:site?.site_id||'',site_name:value('sa415Name'),region:value('sa415Region'),start_date:value('sa415Start'),address:value('sa415Address'),site_type:value('sa415Type'),
        regular_count:number(value('sa415Regular')),daily_count:number(value('sa415Daily')),
        manager_name:value('sa415Manager'),manager_phone:value('sa415ManagerPhone'),part_name:value('sa415Part'),part_phone:value('sa415PartPhone'),clerk_name:value('sa415Clerk'),clerk_phone:value('sa415ClerkPhone'),
        safety_agency:value('sa415Agency'),agency_manager:value('sa415AgencyManager'),agency_phone:value('sa415AgencyPhone'),inspection_cycle:value('sa415Cycle'),agency_scope:value('sa415Scope'),
        active:value('sa415Active')!=='0',source:site?.source||'manual'
      };
      try{
        await siteApi({action:'site_upsert',actor:actor(u),site:payload});
        await loadSites(u);
        await window.enlSiteDirectorySync?.();
        closeModal();
        renderSites(root,u);
        alert('현장정보가 저장되었습니다.');
      }catch(err){alert('현장정보를 저장하지 못했습니다.');}
    };
    if(site)await loadPeople(site,u);
  }

  function refreshContactFields(siteId){
    const s=sites.find(x=>String(x.site_id)===String(siteId));
    if(!s)return;
    const pairs=[
      ['sa415Manager','manager_name'],['sa415ManagerPhone','manager_phone'],
      ['sa415Part','part_name'],['sa415PartPhone','part_phone'],
      ['sa415Clerk','clerk_name'],['sa415ClerkPhone','clerk_phone']
    ];
    pairs.forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=text(s[key]);});
  }

  function editorHtml(person){
    if(!person)return '';
    const position=FIELD_TITLES.includes(text(person.job_title))?text(person.job_title):'일반근로자';
    const fieldRole=FIELD_TITLES.includes(position);
    return `<form id="sa415PersonForm" class="sa415-person-edit"><h4>${escx(person.name)} 정보 수정</h4><div class="sa415-grid"><label><span>이름 *</span><input id="sa415PersonName" value="${escx(person.name)}" required></label><label><span>직책 *</span><select id="sa415PersonPosition"><option ${position==='일반근로자'?'selected':''}>일반근로자</option>${FIELD_TITLES.map(x=>`<option ${position===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>전화번호</span><input id="sa415PersonPhone" inputmode="tel" value="${escx(person.phone||'')}" placeholder="010-0000-0000"></label><label><span>근무상태</span><select id="sa415PersonActive"><option value="1" ${person.active!==false?'selected':''}>근무중</option><option value="0" ${person.active===false?'selected':''}>퇴사</option></select></label></div><div id="sa415PasswordBox" style="${fieldRole?'':'display:none'};margin-top:9px"><label><span>새 로그인 비밀번호</span><input id="sa415PersonPassword" type="password" autocomplete="new-password" placeholder="변경할 때만 입력"></label><p class="sa415-note">현장소장·파트장·서무만 비밀번호 로그인을 사용합니다. 기존 담당자는 비워두면 현재 비밀번호가 유지되고, 일반근로자를 처음 승격할 때 비워두면 등록 전화번호 뒷 4자리가 초기 비밀번호가 됩니다.</p></div><div class="sa415-person-actions"><button type="button" id="sa415PersonCancel">수정 취소</button><button type="submit" class="primary">정보 저장</button></div></form>`;
  }

  function renderPeople(site,u){
    const box=document.getElementById('sa415People');
    if(!box)return;
    const state=stateFor(site.site_id);
    const all=sortedPeople(state.list);
    const q=state.query.trim().toLocaleLowerCase('ko-KR');
    const filtered=q?all.filter(p=>[p.name,p.job_title,p.phone,p.active===false?'퇴사':'근무중'].some(v=>String(v||'').toLocaleLowerCase('ko-KR').includes(q))):all;
    const pages=Math.max(1,Math.ceil(filtered.length/PERSON_PAGE_SIZE));
    state.page=Math.max(1,Math.min(state.page,pages));
    const rows=filtered.slice((state.page-1)*PERSON_PAGE_SIZE,state.page*PERSON_PAGE_SIZE);
    const selected=all.find(p=>String(p.personnel_id)===String(state.selectedId));

    box.innerHTML=`<div class="sa415-people-head"><div><h3>5. 현장 근무자·관리자</h3><p>일반근로자, 현장소장, 파트장, 서무를 한 목록에서 관리합니다. 한 페이지에 10명씩 표시합니다.</p></div><b>전체 ${all.length}명</b></div><div class="sa415-add"><textarea id="sa415NewNames" placeholder="신규 일반근로자 이름을 한 줄에 한 명씩 입력"></textarea><button type="button" id="sa415AddWorkers">일반근로자 등록</button></div><div class="sa415-person-tools"><input id="sa415PersonSearch" value="${escx(state.query)}" placeholder="이름, 직책, 전화번호 검색"><button type="button" id="sa415PersonSearchBtn">검색</button></div><div class="sa415-person-list">${rows.map(p=>`<div class="sa415-person ${p.active===false?'inactive':''}"><div><b>${escx(p.name)}</b><small>${p.active===false?'퇴사':'근무중'} · ${p.access_role==='field'?'현장관리':'일반근로자'}</small></div><div class="position">${escx(p.job_title||'일반근로자')}</div><div class="phone">${escx(text(p.phone)||'전화번호 미등록')}</div><button type="button" data-sa415-person="${escx(p.personnel_id)}">정보 수정</button></div>`).join('')||'<div class="sa415-empty">등록된 근무자가 없습니다.</div>'}</div><div class="sa415-page">${Array.from({length:pages},(_,i)=>i+1).slice(Math.max(0,state.page-3),Math.max(0,state.page-3)+5).map(p=>`<button type="button" data-sa415-person-page="${p}" class="${p===state.page?'on':''}">${p}</button>`).join('')}</div>${editorHtml(selected)}`;

    const search=()=>{state.query=document.getElementById('sa415PersonSearch').value;state.page=1;state.selectedId='';renderPeople(site,u);};
    document.getElementById('sa415PersonSearchBtn').onclick=search;
    document.getElementById('sa415PersonSearch').onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();search();}};

    document.getElementById('sa415AddWorkers').onclick=async()=>{
      const names=[...new Set(document.getElementById('sa415NewNames').value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean))].slice(0,50);
      if(!names.length)return alert('이름을 입력해 주세요.');
      const button=document.getElementById('sa415AddWorkers');button.disabled=true;
      try{
        for(const name of names){
          await authApi({action:'personnel_upsert',actor:actor(u),siteId:site.site_id,person:{siteId:site.site_id,name,jobTitle:'일반근로자',accessRole:'worker',phone:'',active:true}});
        }
        await loadPeople(site,u);
      }catch(err){alert('일부 근로자를 등록하지 못했습니다.');}
      finally{if(button)button.disabled=false;}
    };

    box.querySelectorAll('[data-sa415-person]').forEach(button=>{
      button.onclick=()=>{
        state.selectedId=button.dataset.sa415Person;
        renderPeople(site,u);
        setTimeout(()=>document.getElementById('sa415PersonForm')?.scrollIntoView({block:'nearest',behavior:'smooth'}),0);
      };
    });
    box.querySelectorAll('[data-sa415-person-page]').forEach(button=>{
      button.onclick=()=>{state.page=Number(button.dataset.sa415PersonPage);state.selectedId='';renderPeople(site,u);};
    });

    const form=document.getElementById('sa415PersonForm');
    if(!form)return;
    const positionSelect=document.getElementById('sa415PersonPosition');
    const passwordBox=document.getElementById('sa415PasswordBox');
    const syncPasswordBox=()=>{passwordBox.style.display=FIELD_TITLES.includes(positionSelect.value)?'block':'none';};
    positionSelect.onchange=syncPasswordBox;
    syncPasswordBox();
    document.getElementById('sa415PersonCancel').onclick=()=>{state.selectedId='';renderPeople(site,u);};
    form.onsubmit=async ev=>{
      ev.preventDefault();
      const name=value('sa415PersonName');
      const position=value('sa415PersonPosition');
      const phone=value('sa415PersonPhone');
      const active=value('sa415PersonActive')!=='0';
      const accessRole=FIELD_TITLES.includes(position)?'field':'worker';
      const rawPassword=document.getElementById('sa415PersonPassword')?.value||'';
      const passwordHash=rawPassword?await sha256(rawPassword):'';
      const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
      try{
        await authApi({action:'personnel_upsert',actor:actor(u),siteId:site.site_id,person:{personnelId:selected.personnel_id,siteId:site.site_id,name,jobTitle:position,accessRole,phone,active,passwordHash}});
        state.selectedId='';
        await loadSites(u);
        refreshContactFields(site.site_id);
        await loadPeople(site,u);
        alert('근무자 정보가 저장되었습니다.');
      }catch(err){
        submit.disabled=false;
        const message=err?.message;
        if(message==='manager_phone_required')alert('현장관리 직책은 전화번호를 등록하거나 새 비밀번호를 입력해 주세요.');
        else if(message==='invalid_position')alert('현장관리 직책을 다시 선택해 주세요.');
        else alert('근무자 정보를 저장하지 못했습니다.');
      }
    };
  }

  async function loadPeople(site,u){
    const box=document.getElementById('sa415People');
    if(!box)return;
    try{
      const result=await authApi({action:'personnel_pull',actor:actor(u),siteId:site.site_id});
      const state=stateFor(site.site_id);
      state.list=Array.isArray(result?.personnel)?result.personnel:[];
      renderPeople(site,u);
    }catch(err){box.innerHTML='<div class="sa415-empty">근무자 명단을 불러오지 못했습니다.</div>';}
  }

  async function renderHq(root,u){
    root.innerHTML=`<div class="sa415"><section class="panel"><div class="sa415-head"><div><div class="ey">HQ ACCOUNTS</div><h2>본사 사용자</h2><p>안전관리자·관리자·경영진 계정과 비밀번호를 관리합니다.</p></div>${tabsHtml()}</div></section><section class="panel"><div class="sa415-tools"><div></div><button class="sa415-primary" id="sa415AddHq">+ 본사 사용자 생성</button></div><div id="sa415HqList" class="sa415-hq"><div class="sa415-empty">본사 사용자를 불러오는 중입니다.</div></div></section></div>`;
    bindTabs(root,u);
    document.getElementById('sa415AddHq').onclick=()=>window.openUserModal?.(null,u);
    try{
      await window.enlSyncHqUsers?.(u);
      const users=(data.users||[]).filter(x=>['safety','manager','executive','final'].includes(String(x.role||'')));
      const box=document.getElementById('sa415HqList');
      if(!box)return;
      box.innerHTML=users.map(x=>{
        const role=roleNorm(x.role);
        return `<div class="sa415-hq-row"><div><b>${escx(x.name)} ${x.active===false?'(비활성)':''}</b><span>${escx(x.department||'소속 미등록')} · ${escx(x.position||'직급 미등록')}</span></div><div><span class="sa415-role">${escx(roleName(role))}</span></div><div><span>로그인 이름 ${escx(x.username||x.name)}</span></div><div class="sa415-hq-actions"><button type="button" data-sa415-hq-edit="${escx(x.id)}">정보·권한 수정</button><button type="button" data-sa415-hq-pw="${escx(x.id)}">비밀번호</button></div></div>`;
      }).join('')||'<div class="sa415-empty">본사 사용자가 없습니다.</div>';
      box.querySelectorAll('[data-sa415-hq-edit]').forEach(button=>button.onclick=()=>window.openUserModal?.(userById(button.dataset.sa415HqEdit),u));
      box.querySelectorAll('[data-sa415-hq-pw]').forEach(button=>button.onclick=()=>window.openAdminPasswordReset?.(userById(button.dataset.sa415HqPw),u));
    }catch(err){document.getElementById('sa415HqList').innerHTML='<div class="sa415-empty">본사 사용자를 불러오지 못했습니다.</div>';}
  }

  async function renderAdmin(root,u){
    installCss();
    if(roleNorm(u?.role)!=='safety'){
      root.innerHTML='<div class="panel permission-empty"><h2>안전관리자 전용 메뉴입니다.</h2></div>';
      return;
    }
    if(activeTab==='hq')return renderHq(root,u);
    root.innerHTML='<div class="panel"><div class="sa415-empty">현장정보를 불러오는 중입니다.</div></div>';
    try{await loadSites(u);renderSites(root,u);}
    catch(err){root.innerHTML='<div class="panel"><div class="sa415-empty">현장정보를 불러오지 못했습니다.</div></div>';}
  }

  window.renderMore=(root,u)=>renderAdmin(root,u);
  window.enlRenderSiteAdmin411=renderAdmin;
  window.ENL_SITE_ADMIN_VERSION=VERSION;
})();
