/* E&L Accident Report App v4.1.1 - authoritative incident list/review runtime */
(function(){
  'use strict';
  const VERSION='4.1.1-r11';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const position=u=>String(u?.position||u?.jobTitle||'').trim();
  const roleOf=u=>String(u?.role||'')==='final'?'manager':String(u?.role||'');
  const isHqReader=u=>['manager','executive'].includes(roleOf(u));
  const isSiteUser=u=>!!u&&['field','worker'].includes(u.role);
  const isSiteManager=u=>isSiteUser(u)&&MANAGER_POSITIONS.includes(position(u));
  const sameSite=(i,u)=>!!i&&!!u&&String(i.siteId||'')===String(u.siteId||'');
  const userId=u=>String(u?.personnelId||u?.id||'');
  const isAuthor=(i,u)=>{const rid=String(i?.reporterId||'');if(rid&&userId(u))return rid===userId(u);return !!i&&!rid&&norm(i.reporterName)===norm(u?.name)};
  const siteName=id=>{try{return siteById(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const statusLabel=v=>v==='reported'?'검토대기':v==='rejected'?'반려':v==='approved'?'승인':v==='closed'?'종결':String(v||'진행중');
  const statusBadgeHtml=v=>typeof badge==='function'?badge(v==='reported'?'p-reported':v==='rejected'?'p-rejected':v==='approved'?'p-approved':v==='closed'?'p-closed':'p-normal',statusLabel(v)):`<span>${statusLabel(v)}</span>`;
  const sortIncidentList=(a,b)=>{const p={urgent:3,important:2,normal:1};return (p[b?.priority]||0)-(p[a?.priority]||0)||(new Date(b?.occurredAt||0)-new Date(a?.occurredAt||0))};
  const cut=(v,n=76)=>{const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
  const won=v=>{const n=Number(v||0);return Number.isFinite(n)&&n>0?`${n.toLocaleString('ko-KR')}원`:''};

  function canEditIncident(i,u){if(!i||!u)return false;if(roleOf(u)==='safety')return true;if(!sameSite(i,u)||!['reported','rejected'].includes(i.status))return false;if(isSiteManager(u))return true;return u.role==='worker'&&isAuthor(i,u)}
  function canViewOriginal(i,u){if(!i||!u)return false;const r=roleOf(u);if(r==='safety')return true;if(['manager','executive'].includes(r))return ['approved','closed'].includes(i.status);return sameSite(i,u)&&isSiteManager(u)}

  function quickSummary(i){
    const d=i?.reportDetails||{},person=i?.category==='person',place=d.place||'',when=i?.occurredAt?fmt(i.occurredAt):'-';
    let impact='',headline='';
    if(person){impact=cut(d.injuryDetail||i?.injuredName||'부상내용 미입력',54);headline=`${i?.eventType||'대인사고'} · ${impact}`}
    else{const item=d.damagedItem||'파손 물품',cost=won(d.repairCost);impact=cut(d.damageDetail||item,54);headline=`${i?.eventType||'대물사고'} · ${item}${cost?' · '+cost:''}`}
    const circumstance=cut(d.incidentHow||d.workAction||i?.summary||'',88);
    return {when,site:siteName(i?.siteId),place:place||'장소 미입력',headline,impact,circumstance,person};
  }

  function overviewHtml(i,{compact=false}={}){
    const q=quickSummary(i),d=i?.reportDetails||{},person=i?.category==='person';
    const impact=person
      ? `<div><span>부상</span><b>${esc(cut(d.injuryDetail||'-',80))}</b>${d.diagnosis?`<small>진단 ${esc(cut(d.diagnosis,45))}</small>`:''}</div>`
      : `<div><span>피해</span><b>${esc(cut(d.damagedItem||d.damageDetail||'-',80))}</b>${won(d.repairCost)?`<small>예상 ${esc(won(d.repairCost))}</small>`:''}</div>`;
    return `<div class="inc411-overview ${compact?'compact':''}"><div><span>언제</span><b>${esc(q.when)}</b></div><div><span>어디서</span><b>${esc(cut(q.place,60))}</b></div>${impact}<div class="wide"><span>어떻게</span><b>${esc(q.circumstance||'-')}</b></div></div>`;
  }

  function expectedReaders(){
    return (data.users||[]).filter(x=>x?.active!==false&&['manager','executive','final'].includes(String(x.role||''))).map(x=>({...x,role:roleOf(x)}));
  }
  function receipts(i){return Array.isArray(i?.readReceipts)?i.readReceipts:[]}
  function readerStatusHtml(i){
    if(!['approved','closed'].includes(i?.status))return '';
    const targets=expectedReaders(),reads=receipts(i),readIds=new Set(reads.map(r=>String(r.userId||'')));
    return `<section class="inc411-readbox"><div class="inc411-readhead"><b>승인 사고 열람 확인</b><span>${reads.filter(r=>targets.some(t=>String(t.id)===String(r.userId))).length} / ${targets.length}명 확인</span></div><div class="inc411-reader-list">${targets.map(t=>{const r=reads.find(x=>String(x.userId)===String(t.id));return `<div class="inc411-reader ${r?'done':''}"><span>${esc(t.name||'-')} · ${esc(roleName(t.role))}${t.position?' · '+esc(t.position):''}</span><b>${r?'열람 '+esc(fmt(r.readAt)):'미열람'}</b></div>`}).join('')||'<div class="muted">열람 확인 대상 관리자·경영진이 없습니다.</div>'}</div></section>`;
  }

  function ensureCss(){
    if(document.getElementById('incident411Css'))return;
    const s=document.createElement('style');s.id='incident411Css';s.textContent=`
      .p-rejected{background:#fff0f0!important;color:#a02f2f!important;border:1px solid #efb7b7!important}
      .inc411-list{display:grid;gap:10px}.inc411-card{display:grid;grid-template-columns:145px minmax(0,1fr) auto;gap:13px;align-items:center;width:100%;box-sizing:border-box;border:1.5px solid #d6e1ea;border-radius:15px;background:#fff;padding:14px;text-align:left;color:inherit;cursor:pointer}.inc411-card:hover,.inc411-card:focus-visible{border-color:#4b87b2;box-shadow:0 5px 16px rgba(28,79,119,.09);outline:none}.inc411-card-date{display:grid;gap:4px}.inc411-card-date b{font-size:14px;color:#173b66}.inc411-card-date span{font-size:12px;color:#6d8092}.inc411-card-main{min-width:0}.inc411-card-main h3{margin:0 0 6px;color:#183e62;font-size:17px;line-height:1.35}.inc411-card-main p{margin:0;color:#516a80;font-size:13px;line-height:1.48}.inc411-card-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.inc411-card-side{min-width:110px;text-align:right}.inc411-card-side small{display:block;margin-top:6px;color:#708396;font-weight:800}
      .inc411-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.inc411-overview>div{padding:11px 12px;border:1px solid #dce7ef;border-radius:11px;background:#f8fbfe;min-width:0}.inc411-overview>div.wide{grid-column:1/-1}.inc411-overview span{display:block;font-size:10px;font-weight:900;color:#71869a;letter-spacing:.04em}.inc411-overview b{display:block;margin-top:5px;color:#203f5c;font-size:14px;line-height:1.45;word-break:keep-all}.inc411-overview small{display:block;margin-top:4px;color:#64798c;font-size:11px}.inc411-overview.compact{margin:0}.inc411-overview.compact>div{padding:8px 9px}
      .inc411-section{margin-top:12px;border:1px solid #dbe5ed;border-radius:13px;background:#fff;overflow:hidden}.inc411-section>h3{margin:0;padding:10px 12px;background:#eef6fc;color:#174d78;font-size:14px}.inc411-section-body{padding:12px;display:grid;gap:9px}.inc411-kv{display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;line-height:1.5}.inc411-kv>b{color:#526a7e;font-size:12px}.inc411-kv>span{color:#263f56;font-size:13px;white-space:pre-wrap}
      .inc411-priority-box{margin-top:12px;padding:12px;border:2px solid #bfd5e6;border-radius:12px;background:#f7fbff}.inc411-priority-box label{display:grid;grid-template-columns:140px minmax(0,260px);gap:10px;align-items:center;font-weight:900;color:#214a6b}.inc411-priority-box select{min-height:43px;border:1.5px solid #9ebbd1;border-radius:9px;padding:0 10px;background:#fff;font-weight:900}.inc411-priority-box small{display:block;margin-top:7px;color:#688093;line-height:1.45}
      .inc411-readbox{margin-top:12px;border:1px solid #c9dce9;border-radius:12px;background:#f7fbfe;padding:12px}.inc411-readhead{display:flex;align-items:center;justify-content:space-between;gap:8px}.inc411-readhead b{color:#174d78}.inc411-readhead span{font-size:12px;font-weight:900;color:#52718b}.inc411-reader-list{display:grid;gap:6px;margin-top:9px}.inc411-reader{display:flex;justify-content:space-between;gap:10px;padding:8px 9px;border-radius:8px;background:#fff;color:#64798a;font-size:12px}.inc411-reader.done{background:#edf8f1;color:#276443}.inc411-reader b{white-space:nowrap}.inc411-ack{width:100%;min-height:50px;margin-top:13px;border:0;border-radius:11px;background:#1e5d91;color:#fff;font-size:16px;font-weight:950}.inc411-ack.done{background:#e9f3ed;color:#2d6847;border:1px solid #b8d6c3}
      .incident-private-list{display:grid;gap:10px}.incident-private-card{border:2px solid #d7e2ec;border-radius:14px;background:#fff;padding:14px}.incident-private-card.rejected{border-color:#e2abab;background:#fffafa}.incident-private-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.incident-private-card h3{margin:9px 0 5px;color:#173b66;font-size:17px}.incident-private-meta{display:flex;gap:8px;flex-wrap:wrap;color:#66798b;font-size:12px;font-weight:750}.incident-private-note,.reject-note{margin-top:9px;padding:10px 11px;border:1px solid #e9bcbc;border-radius:10px;background:#fff1f1;color:#893737;font-size:13px;line-height:1.5}.incident-private-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.incident-private-actions button{min-height:42px;border:0;border-radius:9px;background:#1e5d91;color:#fff;padding:0 14px;font-weight:900}.btn-reject{background:#b13c3c!important;color:#fff!important}
      @media(max-width:720px){.inc411-card{grid-template-columns:1fr;padding:12px}.inc411-card-date{display:flex;justify-content:space-between}.inc411-card-side{text-align:left;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.inc411-card-side small{margin:0}.inc411-overview{grid-template-columns:1fr 1fr}.inc411-overview>div.wide{grid-column:1/-1}.inc411-priority-box label{grid-template-columns:1fr}.inc411-kv{grid-template-columns:1fr;gap:3px}}
      @media(max-width:440px){.inc411-overview{grid-template-columns:1fr}.inc411-overview>div.wide{grid-column:auto}.inc411-readhead,.inc411-reader{align-items:flex-start;flex-direction:column}.inc411-reader b{white-space:normal}}
    `;document.head.appendChild(s);
  }
  ensureCss();

  function originalTable(arr,u){
    if(!Array.isArray(arr)||!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';
    return `<div class="inc411-list">${arr.map(i=>{const q=quickSummary(i),rc=receipts(i).length;return `<button type="button" class="inc411-card" data-inc-id="${esc(i.id)}"><div class="inc411-card-date"><b>${esc(q.when)}</b><span>${esc(q.site)}</span></div><div class="inc411-card-main"><h3>${esc(q.headline)}</h3><p>${esc(q.circumstance||q.place)}</p><div class="inc411-card-tags">${typeof categoryBadge==='function'?categoryBadge(i.category):''}${typeof priorityBadge==='function'?priorityBadge(i.priority):''}${statusBadgeHtml(i.status)}${typeof actionBadge==='function'?actionBadge(i):''}</div></div><div class="inc411-card-side">${typeof legalBadge==='function'?legalBadge(i):''}${['approved','closed'].includes(i.status)?`<small>열람확인 ${rc}명</small>`:''}</div></button>`}).join('')}</div>`;
  }
  function incidentTableFn(arr,admin,u){return originalTable(arr,u||currentUser())}
  function bindIncidentRowsFn(admin,u){const viewer=u||currentUser();document.querySelectorAll('[data-inc-id]').forEach(r=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(r.dataset.incId));if(i&&canViewOriginal(i,viewer)){r.onclick=()=>openIncidentModalFn(i.id,admin,viewer);r.style.cursor='pointer'}else{r.onclick=null;r.style.cursor='default'}})}

  function siteRecords(u){return [...(data.incidents||[])].filter(i=>sameSite(i,u)).sort(sortIncidentList)}
  function visibleFieldRecords(u){const arr=siteRecords(u);return isSiteManager(u)?arr:arr.filter(i=>isAuthor(i,u))}
  function privateCards(arr,u){if(!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';return `<div class="incident-private-list">${arr.map(i=>{const editable=canEditIncident(i,u),q=quickSummary(i),rejected=i.status==='rejected';return `<article class="incident-private-card ${rejected?'rejected':''}"><div class="incident-private-top"><div>${typeof categoryBadge==='function'?categoryBadge(i.category):''}${statusBadgeHtml(i.status)}</div><b>${esc(q.when)}</b></div><h3>${esc(q.headline)}</h3>${overviewHtml(i,{compact:true})}${rejected&&i.rejectionNote?`<div class="incident-private-note"><b>반려사유</b><br>${esc(i.rejectionNote)}</div>`:''}${editable?`<div class="incident-private-actions"><button type="button" data-rejected-edit="${esc(i.id)}">${i.status==='reported'?'보고 회수 후 수정':'반려 내용 수정 후 재제출'}</button></div>`:''}</article>`}).join('')}</div>`}
  function bindRejectedEdits(root,u){root.querySelectorAll('[data-rejected-edit]').forEach(b=>b.onclick=()=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(b.dataset.rejectedEdit));if(i&&canEditIncident(i,u))openEditIncidentModalFn(i,u)})}

  function renderUnifiedIncidentsFn(root,u){
    const viewer=u||currentUser();if(!root||!viewer)return;
    if(isSiteUser(viewer)){
      const arr=visibleFieldRecords(viewer);
      if(isSiteManager(viewer)){root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE RECORDS</div><h2>사고 기록</h2><p>${esc(siteName(viewer.siteId))}의 전체 사고보고서를 조회합니다.</p></div></div>${originalTable(arr,viewer)}</div>`;bindIncidentRowsFn(false,viewer);return}
      root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">SITE RECORDS</div><h2>내 사고 보고 기록</h2><p>내가 작성한 보고의 처리상태를 확인합니다.</p></div></div>${privateCards(arr,viewer)}</div>`;bindRejectedEdits(root,viewer);return;
    }
    if(isHqReader(viewer)){
      const arr=[...(data.incidents||[])].filter(i=>['approved','closed'].includes(i.status)).sort(sortIncidentList);root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">APPROVED INCIDENTS</div><h2>승인 사고 조회</h2><p>안전관리자가 승인한 사고를 확인하고 열람 확인을 남길 수 있습니다.</p></div></div>${originalTable(arr,viewer)}</div>`;bindIncidentRowsFn(false,viewer);return;
    }
    const base=[...(data.incidents||[])].sort(sortIncidentList);
    root.innerHTML=`<div class="panel"><div class="section-head"><div><div class="ey">ALL INCIDENTS</div><h2>전체 사고관리</h2><p>사고를 한눈에 확인하고 검토·승인·반려할 수 있습니다.</p></div></div><div class="toolbar"><div class="left"><select id="siteFilter"><option value="">전체 사업장</option>${(data.sites||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><select id="statusFilter"><option value="">전체 상태</option><option value="reported">검토대기</option><option value="rejected">반려</option><option value="approved">승인</option><option value="closed">종결</option></select><select id="categoryFilter"><option value="">전체 구분</option><option value="person">대인사고</option><option value="property">대물사고</option></select></div></div><div id="unifiedIncidentTable"></div></div>`;
    const refresh=()=>{let arr=[...base];const sf=document.getElementById('siteFilter')?.value||'',st=document.getElementById('statusFilter')?.value||'',cf=document.getElementById('categoryFilter')?.value||'';if(sf)arr=arr.filter(i=>String(i.siteId)===String(sf));if(st)arr=arr.filter(i=>i.status===st);if(cf)arr=arr.filter(i=>i.category===cf);const box=document.getElementById('unifiedIncidentTable');if(box)box.innerHTML=originalTable(arr,viewer);bindIncidentRowsFn(true,viewer)};
    ['siteFilter','statusFilter','categoryFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',refresh));refresh();
  }

  function bindModalAttachments(i){const root=document.getElementById('modalRoot');if(root&&typeof window.enlBindAttachmentOpen==='function')window.enlBindAttachmentOpen(root,i.photos||[])}
  function openIncidentModalFn(id,admin,u){
    const viewer=u||currentUser(),i=(data.incidents||[]).find(x=>String(x.id)===String(id));
    if(!i)return alert('해당 사고자료를 찾지 못했습니다. 최신 사고현황을 다시 불러와 주세요.');
    if(!canViewOriginal(i,viewer))return alert('사고보고서 원본 조회 권한이 없습니다.');
    if(typeof openModal!=='function')return alert('사고 검토 화면을 불러오지 못했습니다.');
    const safety=roleOf(viewer)==='safety',hqReader=isHqReader(viewer),d=i.reportDetails||{},person=i.category==='person';
    const attachments=typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(i.photos||[]):'';
    const damageRows=person
      ? `<div class="inc411-kv"><b>부상 내용</b><span>${esc(d.injuryDetail||'-')}</span></div><div class="inc411-kv"><b>진단명</b><span>${esc(d.diagnosis||'-')}</span></div><div class="inc411-kv"><b>치료/의사소견</b><span>${esc(d.doctorOpinion||'-')}</span></div>${Number(d.medicalCost||0)>0?`<div class="inc411-kv"><b>진료비</b><span>${esc(won(d.medicalCost))}</span></div>`:''}`
      : `<div class="inc411-kv"><b>파손 물품</b><span>${esc(d.damagedItem||'-')}</span></div><div class="inc411-kv"><b>파손 내용</b><span>${esc(d.damageDetail||'-')}</span></div><div class="inc411-kv"><b>피해금액</b><span>${esc(won(d.repairCost)||'미확인')}</span></div>`;
    const ack=receipts(i).find(r=>String(r.userId)===String(userId(viewer)));
    openModal(`<div class="modal-head"><div><div class="ey">INCIDENT REVIEW</div><h2>${esc(siteName(i.siteId))} · ${esc(i.eventType||'-')}</h2><div style="margin-top:7px">${typeof priorityBadge==='function'?priorityBadge(i.priority):''}${typeof categoryBadge==='function'?categoryBadge(i.category):''}${statusBadgeHtml(i.status)}${typeof legalBadge==='function'?legalBadge(i):''}</div></div><button class="x" data-close>×</button></div>
      ${overviewHtml(i)}
      ${i.status==='rejected'&&i.rejectionNote?`<div class="reject-note"><b>반려사유</b><br>${esc(i.rejectionNote)}</div>`:''}
      <section class="inc411-section"><h3>피해 상황</h3><div class="inc411-section-body">${damageRows}</div></section>
      <section class="inc411-section"><h3>사고 경위</h3><div class="inc411-section-body"><div class="inc411-kv"><b>사고 직전 작업</b><span>${esc(d.workAction||'-')}</span></div><div class="inc411-kv"><b>발생 과정</b><span>${esc(d.incidentHow||i.summary||'-')}</span></div><div class="inc411-kv"><b>즉시 조치</b><span>${esc(i.immediateAction||'-')}</span></div><div class="inc411-kv"><b>재발방지대책</b><span>${esc(d.preventionPlan||'-')}</span></div></div></section>
      ${attachments?`<section class="inc411-section"><h3>첨부 사진 · PDF</h3><div class="inc411-section-body">${attachments}</div></section>`:''}
      ${safety?`<div class="inc411-priority-box"><label><span>관리등급 최종 설정</span><select id="priorityEdit411"><option value="normal" ${i.priority==='normal'?'selected':''}>일반</option><option value="important" ${i.priority==='important'?'selected':''}>중요</option><option value="urgent" ${i.priority==='urgent'?'selected':''}>긴급</option></select></label><small>최초 등록 시 자동 추천되며, 안전관리자가 사고의 실제 중요도를 검토해 최종 등급을 직접 변경할 수 있습니다.</small></div><label class="lbl"><span>안전관리자 검토의견 / 반려사유</span><textarea id="safetyNoteEdit" rows="3">${esc(i.safetyNote||i.rejectionNote||'')}</textarea></label>${readerStatusHtml(i)}<div class="modal-actions"><button class="btn-gray" id="saveNote">검토·등급 저장</button>${i.status==='reported'?'<button class="btn-reject" id="rejectInc">반려</button><button class="btn-blue" id="approveInc">사고 승인</button>':''}${i.status!=='closed'?'<button class="btn-green" id="closeInc">종결</button>':''}<button class="btn-red" id="editInc">사고정보 수정</button><button class="btn-red" id="deleteInc">삭제</button></div>`:''}
      ${hqReader&&['approved','closed'].includes(i.status)?`<button type="button" id="ackIncident411" class="inc411-ack ${ack?'done':''}" ${ack?'disabled':''}>${ack?'✓ '+esc(fmt(ack.readAt))+' 열람 확인 완료':'열람 확인'}</button>`:''}`);
    bindModalAttachments(i);
    if(hqReader){const btn=document.getElementById('ackIncident411');if(btn&&!ack)btn.onclick=async()=>{btn.disabled=true;btn.textContent='열람 확인 저장 중…';try{if(typeof window.enlIncidentAcknowledge!=='function')throw new Error('ack_not_ready');await window.enlIncidentAcknowledge(i.id,viewer);closeModal();renderShell(currentUser()||viewer);alert('열람 확인이 기록되었습니다.')}catch(e){btn.disabled=false;btn.textContent='열람 확인';alert('열람 확인을 저장하지 못했습니다. 다시 시도해 주세요.')}};return}
    if(!safety)return;
    const note=()=>document.getElementById('safetyNoteEdit')?.value.trim()||'';
    const applyPriority=()=>{const p=document.getElementById('priorityEdit411')?.value;if(['normal','important','urgent'].includes(p)){i.priority=p;i.prioritySource='manual';i.prioritySetBy=viewer.name;i.prioritySetAt=nowISO()}};
    const saveAndRefresh=()=>{applyPriority();i.updatedAt=nowISO();saveData();closeModal();renderShell(viewer)};
    document.getElementById('saveNote')?.addEventListener('click',()=>{i.safetyNote=note();saveAndRefresh()});
    document.getElementById('rejectInc')?.addEventListener('click',()=>{const reason=note();if(!reason)return alert('반려사유를 입력해 주세요.');applyPriority();i.safetyNote=reason;i.rejectionNote=reason;i.status='rejected';i.rejectedBy=viewer.name;i.rejectedAt=nowISO();i.approvedBy='';i.approvedAt=null;i.reviewHistory=Array.isArray(i.reviewHistory)?i.reviewHistory:[];i.reviewHistory.push({action:'rejected',by:viewer.name,at:i.rejectedAt,note:reason});saveAndRefresh()});
    document.getElementById('approveInc')?.addEventListener('click',()=>{applyPriority();i.safetyNote=note();i.status='approved';i.approvedBy=viewer.name;i.approvedAt=nowISO();i.rejectionNote='';saveAndRefresh()});
    document.getElementById('closeInc')?.addEventListener('click',()=>{applyPriority();i.status='closed';i.closedAt=nowISO();saveAndRefresh()});
    document.getElementById('editInc')?.addEventListener('click',()=>openEditIncidentModalFn(i,viewer));
    document.getElementById('deleteInc')?.addEventListener('click',()=>{if(confirm('이 사고 기록을 삭제할까요?')){data.incidents=data.incidents.filter(x=>String(x.id)!==String(i.id));saveData();closeModal();renderShell(viewer)}});
  }

  function openEditIncidentModalFn(i,u){
    const viewer=u||currentUser();if(!i||!viewer)return;
    if(roleOf(viewer)!=='safety'&&typeof window.enlEditIncidentInReportForm==='function')return window.enlEditIncidentInReportForm(i,viewer);
    if(!canEditIncident(i,viewer))return alert('수정 권한이 없습니다.');
    if(typeof window.enlEditIncidentInReportForm==='function'&&['person','property'].includes(i.category))return window.enlEditIncidentInReportForm(i,viewer);
    alert('대인·대물 사고는 원래 입력화면에서 수정할 수 있습니다.');
  }

  window.statusName=statusLabel;
  window.statusBadge=statusBadgeHtml;
  window.sortIncidents=sortIncidentList;
  window.incidentTable=incidentTableFn;
  window.bindIncidentRows=bindIncidentRowsFn;
  window.renderUnifiedIncidents=renderUnifiedIncidentsFn;
  window.renderFieldHistory=renderUnifiedIncidentsFn;
  window.renderAllIncidents=renderUnifiedIncidentsFn;
  window.renderDashboard=renderUnifiedIncidentsFn;
  window.openIncidentModal=openIncidentModalFn;
  window.openEditIncidentModal=openEditIncidentModalFn;
  window.enlIncidentTable=incidentTableFn;
  window.enlBindIncidentRows=bindIncidentRowsFn;
  window.enlOpenIncidentReview=openIncidentModalFn;
  window.enlIncidentQuickSummary=quickSummary;
  window.enlIncidentOverviewHtml=overviewHtml;
  window.enlCanEditIncident=canEditIncident;
  window.enlCanViewIncidentOriginal=canViewOriginal;
  window.ENL_INCIDENT_ACCESS_VERSION=VERSION;
})();