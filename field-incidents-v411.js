/* E&L Accident Report App v4.1.1 - authoritative field action/record screens */
(function(){
  'use strict';
  const VERSION='4.1.1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const userId=u=>String(u?.personnelId||u?.id||'');
  const sameSite=(i,u)=>String(i?.siteId||'')===String(u?.siteId||'');
  const isManager=u=>MANAGER_POSITIONS.includes(String(u?.position||u?.jobTitle||''));
  const isAuthor=(i,u)=>{const rid=String(i?.reporterId||'');if(rid&&userId(u))return rid===userId(u);return !rid&&norm(i?.reporterName)===norm(u?.name)};
  const dateText=v=>{try{return typeof fmt==='function'?fmt(v):String(v||'').replace('T',' ').slice(0,16)}catch(e){return String(v||'').slice(0,16)}};
  const dateOnly=v=>String(v||'').slice(0,10)||'-';
  const statusText=v=>v==='reported'?'검토대기':v==='rejected'?'반려':v==='approved'?'승인':v==='closed'?'종결':String(v||'진행중');
  const actionText=v=>v==='planned'?'조치예정':v==='in_progress'?'조치중':v==='submitted'?'검토요청':v==='approved'?'조치완료':'미등록';
  const categoryText=v=>v==='person'?'대인사고':v==='property'?'대물사고':v==='near_miss'?'아차사고':v==='hazard'?'위험요인':'사고';

  function css(){if(document.getElementById('fieldInc411Css'))return;const s=document.createElement('style');s.id='fieldInc411Css';s.textContent=`
    .field411-screen{display:grid;gap:12px}.field411-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.field411-head h2{margin:0;color:#173b66;font-size:23px}.field411-head p{margin:5px 0 0;color:#697d90;line-height:1.5}.field411-list{display:grid;gap:10px}.field411-card{border:2px solid #d8e3ed;border-radius:15px;background:#fff;padding:14px}.field411-card.rejected{border-color:#e1b3b3;background:#fffafa}.field411-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.field411-top .date{font-size:12px;color:#6d8092;font-weight:800}.field411-badge{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border-radius:999px;background:#eaf3fb;color:#24577d;border:1px solid #bfd5e6;font-size:11px;font-weight:950}.field411-badge.rejected{background:#fff0f0;color:#9a3737;border-color:#e8bbbb}.field411-card h3{margin:10px 0 5px;color:#173b66;font-size:18px}.field411-card .summary{margin:0;color:#344d65;font-size:14px;line-height:1.55;word-break:keep-all}.field411-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;color:#718396;font-size:12px;font-weight:750}.field411-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:11px}.field411-action-grid>div{padding:10px;border-radius:10px;background:#f6f9fc;border:1px solid #e0e7ee}.field411-action-grid b{display:block;margin-bottom:4px;color:#5c7185;font-size:10px}.field411-action-grid span{display:block;color:#29465e;font-size:13px;font-weight:800;line-height:1.45}.field411-reject{margin-top:9px;padding:10px 11px;border-radius:10px;background:#fff0f0;color:#873838;font-size:13px;line-height:1.5}.field411-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.field411-actions button{min-height:42px;border:1px solid #b9cad8;border-radius:9px;background:#fff;color:#254c6d;padding:0 13px;font-weight:900}.field411-actions .primary{border-color:#1e5d91;background:#1e5d91;color:#fff}.field411-empty{padding:28px 16px;text-align:center;border:2px dashed #cfdce7;border-radius:14px;background:#f9fbfd;color:#6c8092;font-size:14px;line-height:1.55}.field411-section{display:grid;gap:10px}.field411-section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;flex-wrap:wrap}.field411-section-head h3{margin:0;color:#173b66;font-size:19px}.field411-section-head p{margin:3px 0 0;color:#718396;font-size:12px;line-height:1.45}.field411-public-card{display:grid;grid-template-columns:95px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #dce5ed;border-radius:12px;background:#fff}.field411-public-card .public-date{font-size:12px;color:#6d8092;font-weight:850}.field411-public-main{min-width:0}.field411-public-main b{display:block;color:#173b66;font-size:15px}.field411-public-main span{display:block;margin-top:4px;color:#4f667b;font-size:12px;line-height:1.45;font-weight:750}.field411-public-state{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.field411-manager-note{padding:10px 11px;border-radius:10px;background:#eef6fb;color:#315c7d;font-size:12px;line-height:1.5}
    @media(max-width:700px){.field411-public-card{grid-template-columns:78px minmax(0,1fr);gap:8px}.field411-public-state{grid-column:1/-1;justify-content:flex-start}.field411-action-grid{grid-template-columns:1fr}}
    @media(max-width:560px){.field411-card{padding:12px}.field411-head h2{font-size:21px}.field411-actions button{flex:1;min-width:130px}.field411-public-card{padding:10px}.field411-section-head h3{font-size:18px}}
  `;document.head.appendChild(s)}

  function siteIncidents(u){return [...(data?.incidents||[])].filter(i=>sameSite(i,u)).sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0))}
  function myIncidents(u){return siteIncidents(u).filter(i=>isAuthor(i,u))}
  function actionVisible(u){return isManager(u)?siteIncidents(u):myIncidents(u)}
  function statusBadgeHtml(i){return `<span class="field411-badge ${i.status==='rejected'?'rejected':''}">${escx(statusText(i.status))}</span>`}
  function back(root,u){window.enlAddFieldBack?.(root,u)}

  function personInjuryClass(i){
    const d=i?.reportDetails||{},text=`${i?.eventType||''} ${d.injuryDetail||''}`;
    const rules=[['골절',/골절/],['베임·절상',/베임|절상|열상/],['찔림',/찔림|자상/],['타박상',/타박/],['찰과상',/찰과/],['염좌',/염좌|삠/],['화상',/화상/],['탈구',/탈구/],['압궤',/압궤|끼임/],['절단',/절단/],['낙상',/낙상|넘어짐/]];
    const found=rules.filter(([,r])=>r.test(text)).map(([n])=>n);return [...new Set(found)].slice(0,2).join('·')||'부상 발생';
  }
  function publicSummary(i){return `${categoryText(i.category)} · ${i.eventType||'사고 발생'}`}
  function publicDetail(i){
    if(i.category==='person')return `부상 형태: ${personInjuryClass(i)}`;
    if(i.category==='property'){const cost=Number(i?.reportDetails?.repairCost||0);return cost>0?`피해금액 약 ${cost.toLocaleString('ko-KR')}원`:'피해금액 미확인'}
    return `사고유형: ${i.eventType||'확인 중'}`;
  }

  function workerPublicCards(arr){
    return arr.map(i=>`<div class="field411-public-card"><span class="public-date">${escx(dateOnly(i.occurredAt))}</span><div class="field411-public-main"><b>${escx(publicSummary(i))}</b><span>${escx(publicDetail(i))}</span></div><div class="field411-public-state">${statusBadgeHtml(i)}<span class="field411-badge">조치 ${escx(actionText(i.corrective?.status))}</span></div></div>`).join('')||'<div class="field411-empty">현재 표시할 사업장 사고가 없습니다.</div>';
  }
  function myReportCards(arr,u){
    return arr.map(i=>{const editable=typeof window.enlCanEditIncident==='function'&&window.enlCanEditIncident(i,u);return `<article class="field411-card ${i.status==='rejected'?'rejected':''}"><div class="field411-top"><div>${statusBadgeHtml(i)}</div><span class="date">${escx(dateText(i.occurredAt))}</span></div><h3>${escx(i.eventType||'사고 보고')}</h3><p class="summary">${escx(i.summary||'-')}</p><div class="field411-meta"><span>내가 작성한 사고보고</span><span>조치 ${escx(actionText(i.corrective?.status))}</span></div>${i.status==='rejected'&&(i.rejectionNote||i.safetyNote)?`<div class="field411-reject"><b>반려사유</b><br>${escx(i.rejectionNote||i.safetyNote)}</div>`:''}${editable?`<div class="field411-actions"><button type="button" class="primary" data-field-edit="${escx(i.id)}">${i.status==='reported'?'보고 회수 후 수정':'반려 내용 수정 후 재제출'}</button></div>`:''}</article>`}).join('')||'<div class="field411-empty">내가 작성한 사고보고가 없습니다.</div>';
  }
  function managerCards(arr,u){
    return arr.map(i=>{const editable=typeof window.enlCanEditIncident==='function'&&window.enlCanEditIncident(i,u);return `<article class="field411-card ${i.status==='rejected'?'rejected':''}"><div class="field411-top"><div>${statusBadgeHtml(i)} <span class="field411-badge">${escx(categoryText(i.category))}</span></div><span class="date">${escx(dateText(i.occurredAt))}</span></div><h3>${escx(i.eventType||'사고 보고')}</h3><p class="summary">${escx(i.summary||'-')}</p><div class="field411-meta"><span>보고자 ${escx(i.reporterName||'-')}</span><span>조치 ${escx(actionText(i.corrective?.status))}</span><span>${escx(siteName(i.siteId))}</span></div>${i.status==='rejected'&&(i.rejectionNote||i.safetyNote)?`<div class="field411-reject"><b>반려사유</b><br>${escx(i.rejectionNote||i.safetyNote)}</div>`:''}<div class="field411-actions"><button type="button" class="primary" data-field-open="${escx(i.id)}">사고보고서 보기</button>${editable?`<button type="button" data-field-edit="${escx(i.id)}">사고보고 수정</button>`:''}</div></article>`}).join('')||'<div class="field411-empty">표시할 사고기록이 없습니다.</div>';
  }

  function bindRecordActions(root,u){
    root.querySelectorAll('[data-field-open]').forEach(b=>b.onclick=()=>{try{openIncidentModal(b.dataset.fieldOpen,false,u)}catch(e){console.error(e);alert('사고기록을 불러오지 못했습니다.')}});
    root.querySelectorAll('[data-field-edit]').forEach(b=>b.onclick=()=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(b.dataset.fieldEdit));if(!i)return;try{if(typeof window.enlEditIncidentInReportForm==='function')return window.enlEditIncidentInReportForm(i,u);openEditIncidentModal(i,u)}catch(e){console.error(e);alert('수정 화면을 불러오지 못했습니다.')}});
  }

  function renderRecords(root,u){
    css();
    if(isManager(u)){
      const arr=siteIncidents(u);
      root.innerHTML=`<section class="field411-screen"><section class="panel"><div class="field411-head"><div><div class="ey">SITE RECORDS</div><h2>사고 기록</h2><p>${escx(siteName(u.siteId))}에서 등록된 전체 사고보고 기록을 확인합니다.</p></div></div><div class="field411-manager-note">현장소장·파트장·서무는 소속 사업장 사고보고 원본을 조회할 수 있고, 검토대기·반려 상태의 보고서는 작성자와 관계없이 수정할 수 있습니다. 승인·종결 기록은 이력 보호를 위해 수정하지 않습니다.</div></section><div class="field411-list">${managerCards(arr,u)}</div></section>`;
    }else{
      const all=siteIncidents(u),mine=myIncidents(u);
      root.innerHTML=`<section class="field411-screen"><section class="panel"><div class="field411-head"><div><div class="ey">SITE RECORDS</div><h2>사고 기록</h2><p>우리 사업장 사고현황과 내가 작성한 사고보고를 확인합니다.</p></div></div></section><section class="panel field411-section"><div class="field411-section-head"><div><h3>우리 사업장 사고 요약</h3><p>개인정보는 제외하고 사고유형과 필요한 피해정보만 표시합니다.</p></div></div><div class="field411-list">${workerPublicCards(all)}</div></section><section class="panel field411-section"><div class="field411-section-head"><div><h3>내가 보고한 사고</h3><p>내 보고는 처리상태와 반려사유를 확인하고 필요 시 수정할 수 있습니다.</p></div></div><div class="field411-list">${myReportCards(mine,u)}</div></section></section>`;
    }
    back(root,u);bindRecordActions(root,u);
  }
  window.enlRenderFieldRecords=renderRecords;

  function renderActions(root,u){
    css();const arr=actionVisible(u),scope=isManager(u)?`${siteName(u.siteId)} 사고 후속조치`:'내 사고보고의 후속조치';
    root.innerHTML=`<section class="field411-screen"><section class="panel"><div class="field411-head"><div><div class="ey">FOLLOW-UP ACTION</div><h2>사고 조치</h2><p>${escx(scope)}를 등록하고 진행상태를 확인합니다.</p></div></div></section><div class="field411-list">${arr.map(i=>{const c=i.corrective||{},locked=i.status==='closed'||c.status==='approved';return `<article class="field411-card ${i.status==='rejected'?'rejected':''}"><div class="field411-top"><div>${statusBadgeHtml(i)} <span class="field411-badge">${escx(actionText(c.status))}</span></div><span class="date">${escx(dateText(i.occurredAt))}</span></div><h3>${escx(i.eventType||'사고 보고')}</h3><p class="summary">${escx(i.summary||'-')}</p><div class="field411-action-grid"><div><b>원인</b><span>${escx(c.rootCause||'미등록')}</span></div><div><b>조치내용</b><span>${escx(c.actionDetail||'미등록')}</span></div><div><b>담당자</b><span>${escx(c.ownerName||'미지정')}</span></div><div><b>완료기한</b><span>${escx(c.dueDate||'미지정')}</span></div></div><div class="field411-actions"><button type="button" class="primary" data-field-action="${escx(i.id)}">${locked?'조치 내용 확인':c.rootCause||c.actionDetail?'조치 수정·확인':'사고 조치 등록'}</button></div></article>`}).join('')||'<div class="field411-empty">조치할 사고가 없습니다.<br>사고보고가 등록되면 이 화면에서 후속조치를 작성할 수 있습니다.</div>'}</div></section>`;
    back(root,u);
    root.querySelectorAll('[data-field-action]').forEach(b=>b.onclick=()=>{try{if(typeof openUnifiedCorrectiveModal!=='function')throw new Error('corrective_renderer_missing');openUnifiedCorrectiveModal(b.dataset.fieldAction,u)}catch(e){console.error(e);alert('사고 조치 화면을 불러오지 못했습니다. 최신화 후 다시 시도해 주세요.')}});
  }
  window.enlRenderFieldActions=renderActions;
  window.ENL_FIELD_INCIDENTS_VERSION=VERSION;
})();