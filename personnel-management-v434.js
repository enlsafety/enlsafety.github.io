/* E&L Accident Report App v4.3.4 - personnel integrity, permissions and stable HQ UI */
(function(){
  'use strict';

  const VERSION='4.3.4-personnel-integrity1';
  const PERSONNEL_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-personnel-v434';
  const CLIENT='incident-report-v2';
  const FIELD_TITLES=['현장소장','파트장','서무'];
  const HQ_ROLES=['safety','manager','executive','final'];
  const baseAuthApi=window.enlAuthApi;
  const baseIncidentApi=window.enlIncidentApi;
  const baseRenderShell=window.renderShell;
  const text=v=>String(v??'').trim();
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actor=u=>{try{return window.enlCurrentActor?.()||{id:u?.id||u?.personnelId||u?.username||'',name:u?.name||'',role:roleNorm(u?.role),position:u?.position||u?.jobTitle||'',siteId:u?.siteId||''}}catch(e){return null}};
  const isFieldManager=u=>!!u&&u.role==='field'&&FIELD_TITLES.includes(text(u.position||u.jobTitle));
  let hqSyncing=false;
  let allowSettingsRender=false;

  async function callPersonnel(body,timeout=15000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(PERSONNEL_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body||{}),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }

  function updateSiteCardCount(siteId,counts){
    if(!siteId||!counts)return;
    document.querySelectorAll('.sa415-site[data-sa415-site]').forEach(card=>{
      if(String(card.dataset.sa415Site)!==String(siteId))return;
      const p=[...card.querySelectorAll('p')].find(x=>text(x.textContent).startsWith('등록 근무자'));
      if(p)p.textContent=`등록 근무자 ${Number(counts.activeTotal||0)}명`;
    });
  }
  function personnelChanged(body,res){
    const siteId=String(res?.siteId||res?.person?.site_id||body?.siteId||body?.person?.siteId||'');
    updateSiteCardCount(siteId,res?.counts);
    try{window.dispatchEvent(new CustomEvent('enl-personnel-changed',{detail:{siteId,counts:res?.counts||null,action:body?.action||''}}))}catch(e){}
  }

  window.enlAuthApi=async function(body,timeout){
    const action=text(body?.action);
    if(['personnel_pull','personnel_upsert','personnel_delete'].includes(action)){
      const res=await callPersonnel(body,timeout||15000);
      if(action!=='personnel_pull')personnelChanged(body,res);
      return res;
    }
    if(typeof baseAuthApi==='function')return baseAuthApi(body,timeout);
    throw new Error('auth_api_not_ready');
  };

  window.enlIncidentApi=async function(body,timeout){
    if(typeof baseIncidentApi!=='function')throw new Error('incident_api_not_ready');
    const res=await baseIncidentApi(body,timeout);
    if(text(body?.action)==='site_list'&&Array.isArray(res?.sites)){
      res.sites=res.sites.map(s=>{const general=Number(s.worker_login_count||0),field=Number(s.field_login_count||0);return {...s,general_worker_count:general,registered_count:general+field,worker_login_count:general+field}});
    }
    return res;
  };

  function ensureCss(){
    if(document.getElementById('personnel434Css'))return;
    const s=document.createElement('style');s.id='personnel434Css';s.textContent=`
      .pm434{display:grid;gap:12px}.pm434-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.pm434-head h2{margin:2px 0 5px;color:#173b66}.pm434-head p{margin:0;color:#6d8192}.pm434-back{min-height:42px;border:1px solid #bfd0dc;border-radius:9px;background:#fff;color:#315873;padding:0 12px;font-weight:900}
      .pm434-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pm434-counts>div{padding:11px;border:1px solid #d8e4ec;border-radius:11px;background:#fff}.pm434-counts span{display:block;font-size:10px;color:#74889a}.pm434-counts b{display:block;margin-top:4px;color:#214a69;font-size:20px}
      .pm434-form{display:grid;gap:9px;padding:13px;border:1px solid #d7e4ed;border-radius:12px;background:#f9fcfe}.pm434-form h3{margin:0;color:#174d78}.pm434-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pm434-form label{display:grid;gap:5px}.pm434-form label span{font-size:12px;font-weight:900;color:#48647b}.pm434-form input,.pm434-form select{width:100%;min-height:44px;border:1.4px solid #c4d4df;border-radius:9px;padding:0 10px;background:#fff;font:inherit}.pm434-actions{display:flex;gap:7px;flex-wrap:wrap}.pm434-actions button{min-height:42px;border:1px solid #bdcbd7;border-radius:9px;background:#fff;padding:0 13px;font-weight:900}.pm434-actions .primary{background:#173b66;color:#fff;border-color:#173b66}.pm434-actions .danger,.pm434-delete{background:#fff0f0!important;color:#9b3636!important;border-color:#dfb6b6!important}.pm434-note{font-size:11px;line-height:1.5;color:#6f8394}
      .pm434-list{display:grid;gap:7px}.pm434-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.7fr) minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px;border:1px solid #dce6ed;border-radius:10px;background:#fff}.pm434-row.inactive{opacity:.62}.pm434-row b{color:#254761}.pm434-row small{display:block;margin-top:3px;color:#75899a}.pm434-row .role{font-size:12px;font-weight:900;color:#275a7f}.pm434-row .phone{font-size:12px;color:#566f84}.pm434-row button,.pm434-delete{min-height:36px;border:1px solid #bdcbd7;border-radius:8px;background:#fff;padding:0 10px;font-weight:850}.pm434-readonly{font-size:11px;color:#8393a0;font-weight:800}.sa415-person .pm434-delete{margin-left:5px}
      @media(max-width:680px){.pm434-grid{grid-template-columns:1fr}.pm434-row{grid-template-columns:1fr 1fr}.pm434-row .pm434-controls{grid-column:1/-1}.pm434-counts{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:430px){.pm434-row{grid-template-columns:1fr}.pm434-counts{grid-template-columns:1fr 1fr 1fr}.pm434-counts b{font-size:17px}}
    `;document.head.appendChild(s);
  }

  function siteLabel(id){try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'소속 사업장'}catch(e){return id||'소속 사업장'}}
  function countsFrom(list){return {activeWorkers:list.filter(p=>p.active!==false&&p.access_role==='worker').length,activeField:list.filter(p=>p.active!==false&&p.access_role==='field').length,inactiveTotal:list.filter(p=>p.active===false).length}}

  async function renderFieldPersonnel(u,selectedId=''){
    if(!isFieldManager(u))return;
    ensureCss();currentView='personnel';
    const root=document.getElementById('view');if(!root)return;
    root.innerHTML=`<section class="pm434"><section class="panel"><div class="pm434-head"><div><div class="ey">SITE PERSONNEL</div><h2>사업장 근무자 관리</h2><p>${ex(siteLabel(u.siteId))}의 일반근로자를 등록·수정·퇴사·삭제할 수 있습니다.</p></div><button type="button" class="pm434-back" id="pm434Back">← 현장 홈</button></div></section><div id="pm434Body"><section class="panel"><div class="empty compact">근무자 명단을 불러오는 중입니다.</div></section></div></section>`;
    document.getElementById('pm434Back').onclick=()=>window.enlFieldHome?.(u);
    try{
      const r=await window.enlAuthApi({action:'personnel_pull',actor:actor(u),siteId:u.siteId});
      const list=Array.isArray(r.personnel)?r.personnel:[],c=r.counts||countsFrom(list),selected=list.find(p=>String(p.personnel_id)===String(selectedId)&&p.access_role==='worker')||null;
      const body=document.getElementById('pm434Body');if(!body)return;
      body.innerHTML=`<div class="pm434-counts"><div><span>근무중 일반근로자</span><b>${Number(c.activeWorkers||0)}명</b></div><div><span>현장관리자</span><b>${Number(c.activeField||0)}명</b></div><div><span>퇴사자</span><b>${Number(c.inactiveTotal||0)}명</b></div></div><section class="panel"><form id="pm434Form" class="pm434-form"><h3>${selected?'일반근로자 정보 수정':'일반근로자 등록'}</h3><div class="pm434-grid"><label><span>이름 *</span><input id="pm434Name" value="${ex(selected?.name||'')}" required></label><label><span>전화번호</span><input id="pm434Phone" inputmode="tel" value="${ex(selected?.phone||'')}" placeholder="010-0000-0000"></label>${selected?`<label><span>근무상태</span><select id="pm434Active"><option value="1" ${selected.active!==false?'selected':''}>근무중</option><option value="0" ${selected.active===false?'selected':''}>퇴사</option></select></label>`:''}</div><div class="pm434-note">현장소장·파트장·서무 계정은 이 화면에서 변경할 수 없습니다. 관리자 직책 변경은 안전관리자가 본사 설정에서 처리합니다.</div><div class="pm434-actions">${selected?'<button type="button" id="pm434Cancel">수정 취소</button><button type="button" class="danger" id="pm434Delete">잘못 등록한 근무자 삭제</button>':''}<button type="submit" class="primary">${selected?'정보 저장':'일반근로자 등록'}</button></div></form></section><section class="panel"><div class="section-head"><div><h2>근무자 목록</h2><p>현장관리자는 조회만 가능하고 일반근로자만 수정·삭제할 수 있습니다.</p></div></div><div class="pm434-list">${list.map(p=>`<div class="pm434-row ${p.active===false?'inactive':''}"><div><b>${ex(p.name)}</b><small>${p.active===false?'퇴사':'근무중'}</small></div><div class="role">${ex(p.job_title||'일반근로자')}</div><div class="phone">${ex(p.phone||'전화번호 미등록')}</div><div class="pm434-controls">${p.access_role==='worker'?`<button type="button" data-pm434-edit="${ex(p.personnel_id)}">정보 수정</button>`:'<span class="pm434-readonly">관리자 계정</span>'}</div></div>`).join('')||'<div class="empty compact">등록된 근무자가 없습니다.</div>'}</div></section>`;
      document.getElementById('pm434Cancel')?.addEventListener('click',()=>renderFieldPersonnel(u,''));
      body.querySelectorAll('[data-pm434-edit]').forEach(b=>b.onclick=()=>renderFieldPersonnel(u,b.dataset.pm434Edit));
      document.getElementById('pm434Form').onsubmit=async ev=>{
        ev.preventDefault();const name=text(document.getElementById('pm434Name')?.value),phone=text(document.getElementById('pm434Phone')?.value),active=selected?(document.getElementById('pm434Active')?.value!=='0'):true;if(!name)return;
        try{await window.enlAuthApi({action:'personnel_upsert',actor:actor(u),siteId:u.siteId,person:{personnelId:selected?.personnel_id||'',siteId:u.siteId,name,jobTitle:'일반근로자',accessRole:'worker',phone,active}});await renderFieldPersonnel(u,'');alert(selected?'근무자 정보가 저장되었습니다.':'일반근로자가 등록되었습니다.')}
        catch(e){const m=String(e?.message||'');if(m==='manager_name_conflict')alert('같은 이름의 현장소장·파트장·서무가 등록되어 있어 일반근로자로 추가할 수 없습니다.');else if(m==='duplicate_personnel')alert('같은 이름의 근무자가 이미 등록되어 있습니다. 기존 근무자 정보를 수정해 주세요.');else alert('근무자 정보를 저장하지 못했습니다.')}
      };
      document.getElementById('pm434Delete')?.addEventListener('click',async()=>{if(!selected||!confirm(`${selected.name} 근무자 정보를 완전히 삭제할까요?\n잘못 등록한 정보일 때만 삭제해 주세요.`))return;try{await window.enlAuthApi({action:'personnel_delete',actor:actor(u),personnelId:selected.personnel_id});await renderFieldPersonnel(u,'');alert('근무자 정보가 삭제되었습니다.')}catch(e){alert('근무자 정보를 삭제하지 못했습니다.')}});
    }catch(e){const body=document.getElementById('pm434Body');if(body)body.innerHTML='<section class="panel"><div class="empty">근무자 명단을 불러오지 못했습니다.</div></section>'}
  }
  window.enlRenderPersonnelPage=renderFieldPersonnel;

  function mergeHqBatch(serverUsers){
    if(!Array.isArray(data?.users))data.users=[];
    const old=new Map(data.users.filter(x=>HQ_ROLES.includes(String(x?.role||''))).map(x=>[String(x.id),x]));
    const keep=data.users.filter(x=>!HQ_ROLES.includes(String(x?.role||'')));
    const fresh=(serverUsers||[]).map(x=>{const prior=old.get(String(x.id))||{};return {...prior,id:x.id,username:x.name,name:x.name,role:roleNorm(x.role),department:x.department||'',position:x.position||'',siteId:null,active:x.active!==false,createdAt:x.createdAt||prior.createdAt||'',updatedAt:x.updatedAt||prior.updatedAt||''}});
    const before=JSON.stringify(data.users.map(x=>[x.id,x.name,x.role,x.department,x.position,x.active]));
    const next=[...keep,...fresh];const after=JSON.stringify(next.map(x=>[x.id,x.name,x.role,x.department,x.position,x.active]));
    if(before!==after){data.users=next;try{saveData()}catch(e){}}
  }
  function renderHqListDom(serverUsers){
    const box=document.getElementById('sa415HqList');if(!box)return;
    const users=(serverUsers||[]).filter(x=>HQ_ROLES.includes(String(x.role||'')));
    box.innerHTML=users.map(x=>`<div class="sa415-hq-row"><div><b>${ex(x.name)} ${x.active===false?'(비활성)':''}</b><span>${ex(x.department||'소속 미등록')} · ${ex(x.position||'직급 미등록')}</span></div><div><span class="sa415-role">${ex(typeof roleName==='function'?roleName(roleNorm(x.role)):roleNorm(x.role))}</span></div><div><span>로그인 이름 ${ex(x.name)}</span></div><div class="sa415-hq-actions"><button type="button" data-pm434-hq-edit="${ex(x.id)}">정보·권한 수정</button><button type="button" data-pm434-hq-pw="${ex(x.id)}">비밀번호</button></div></div>`).join('')||'<div class="sa415-empty">본사 사용자가 없습니다.</div>';
    box.querySelectorAll('[data-pm434-hq-edit]').forEach(b=>b.onclick=()=>window.openUserModal?.((data.users||[]).find(x=>String(x.id)===String(b.dataset.pm434HqEdit)),currentUser?.()));
    box.querySelectorAll('[data-pm434-hq-pw]').forEach(b=>b.onclick=()=>window.openAdminPasswordReset?.((data.users||[]).find(x=>String(x.id)===String(b.dataset.pm434HqPw)),currentUser?.()));
  }
  window.enlSyncHqUsers=async function(u=currentUser?.()){
    if(hqSyncing||roleNorm(u?.role)!=='safety')return null;hqSyncing=true;
    try{const r=await baseAuthApi({action:'hq_list',actor:actor(u)},15000);const users=Array.isArray(r?.users)?r.users:[];mergeHqBatch(users);renderHqListDom(users);return users}
    catch(e){console.warn('[personnel-v434] HQ sync skipped',e);return null}
    finally{hqSyncing=false}
  };

  function augmentSafetyDelete(){
    const u=currentUser?.();if(roleNorm(u?.role)!=='safety')return;
    document.querySelectorAll('.sa415-person').forEach(row=>{
      if(row.querySelector('.pm434-delete'))return;const edit=row.querySelector('[data-sa415-person]');if(!edit)return;
      const b=document.createElement('button');b.type='button';b.className='pm434-delete';b.textContent='삭제';b.onclick=async ev=>{ev.preventDefault();ev.stopPropagation();const id=edit.dataset.sa415Person,name=text(row.querySelector('b')?.textContent);if(!confirm(`${name||'이 근무자'} 정보를 완전히 삭제할까요?\n잘못 등록한 정보일 때만 삭제해 주세요.`))return;try{const r=await window.enlAuthApi({action:'personnel_delete',actor:actor(u),personnelId:id});closeModal?.();allowSettingsRender=true;window.renderShell?.(u);alert('근무자 정보가 삭제되었습니다.')}catch(e){alert('근무자 정보를 삭제하지 못했습니다.')}};edit.insertAdjacentElement('afterend',b);
    });
  }

  if(typeof baseRenderShell==='function'){
    window.renderShell=function(u){
      if(String(currentView||'')==='more'&&document.querySelector('.sa415')&&!allowSettingsRender){return document.getElementById('view')}
      allowSettingsRender=false;return baseRenderShell.apply(this,arguments);
    };
    try{renderShell=window.renderShell}catch(e){}
  }

  const observer=new MutationObserver(()=>{augmentSafetyDelete()});observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('enl-personnel-changed',e=>updateSiteCardCount(e.detail?.siteId,e.detail?.counts));
  ensureCss();augmentSafetyDelete();
  window.ENL_PERSONNEL_MANAGEMENT_VERSION=VERSION;
})();
