/* E&L Accident Report App v4.1.3 - authoritative report/action lifecycle */
(function(){
  'use strict';
  const VERSION='4.1.3-lifecycle1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const isSite=u=>['field','worker'].includes(String(u?.role||''));
  const isHistorical=i=>!!i&&(String(i.recordMode||'')==='historical_transfer'||String(i?.historicalTransfer?.mode||'')==='historical_transfer'||(i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&i?.historicalImport?.workflowExempt===true&&String(i?.historicalImport?.transferState||'')==='closed'));
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const escx=v=>typeof esc==='function'?esc(v):String(v??'');
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();
  const historicalClosed=i=>!!i&&i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&i?.historicalImport?.workflowExempt===true&&String(i?.historicalImport?.transferState||'')==='closed'&&String(i?.status||'')==='closed';
  const normalFinalized=i=>!!i&&String(i.status)==='closed'&&String(i.corrective?.status)==='approved';
  const finalized=i=>historicalClosed(i)||normalFinalized(i);
  const reportApproved=i=>!!i&&!historicalClosed(i)&&String(i.status)==='approved';
  const actionStatus=v=>v==='planned'?'조치예정':v==='in_progress'?'조치중':v==='submitted'?'사고조치 검토대기':v==='rejected'?'사고조치 반려':v==='approved'?'사고조치 승인완료':'사고조치 미작성';
  const snapshots=new Map();


  function snapshot(){
    snapshots.clear();
    for(const i of data?.incidents||[])snapshots.set(String(i.id),{status:String(i.status||''),correctiveStatus:String(i.corrective?.status||''),approvedAt:i.approvedAt||null,closedAt:i.closedAt||null});
  }
  snapshot();

  function pushHistory(i,entry){i.lifecycleHistory=Array.isArray(i.lifecycleHistory)?i.lifecycleHistory:[];i.lifecycleHistory.push(entry)}
  function normalizeLifecycle(){
    const ts=now();
    for(const i of data?.incidents||[]){
      if(!i?.id)continue;
      if(isHistorical(i))continue;
      const prev=snapshots.get(String(i.id));
      const c=i.corrective&&typeof i.corrective==='object'?i.corrective:null;
      if(historicalClosed(i))continue;

      // A finalized report was edited and resubmitted: both approvals must be obtained again.
      if(prev?.status==='closed'&&String(i.status)==='reported'){
        i.closedAt=null;i.approvedBy='';i.approvedAt=null;i.rejectionNote='';i.readReceipts=[];
        if(c&&prev.correctiveStatus==='approved'){
          const hist=Array.isArray(c.reviewHistory)?[...c.reviewHistory]:[];
          hist.push({action:'recheck_required',by:i.resubmittedBy||'수정자',at:ts,note:'종결된 사고보고 수정으로 사고조치 재검토 필요'});
          i.corrective={...c,status:'submitted',submittedAt:ts,reviewNote:'',reviewedBy:'',reviewedAt:null,reReviewReason:'종결된 사고보고 수정으로 재검토 필요',reviewHistory:hist};
        }
        pushHistory(i,{action:'finalized_report_reopened',at:ts,by:i.resubmittedBy||'수정자'});
      }

      // A closed state is valid only when both the report and corrective action are approved.
      if(String(i.status)==='closed'&&String(i.corrective?.status)!=='approved'){
        const wasLegacyInvalid=prev?.status==='closed'&&prev?.correctiveStatus!=='approved';
        if(!wasLegacyInvalid){i.status=i.approvedAt?'approved':'reported';i.closedAt=null}
      }

      // Final closure is exclusively returned by the authenticated executive endpoint.

    }
  }

  const baseSave=typeof saveData==='function'?saveData:null;
  if(baseSave){
    saveData=function(){normalizeLifecycle();const r=baseSave();snapshot();return r};
  }

  // The old manual close control is intentionally disabled. Executive approval closes the incident.
  const style=document.createElement('style');style.id='lifecycle413Css';style.textContent=`
    #closeInc{display:none!important}.lifecycle413-final{margin-top:12px;border:2px solid #b9d6c8;border-radius:13px;background:#f7fcf9;overflow:hidden}.lifecycle413-final>h3{margin:0;padding:11px 13px;background:#eaf6ef;color:#245d43;font-size:15px}.lifecycle413-final-body{padding:12px;display:grid;gap:9px}.lifecycle413-final-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.lifecycle413-final-grid>div{padding:10px;border:1px solid #d7e8df;border-radius:10px;background:#fff}.lifecycle413-final-grid b{display:block;font-size:11px;color:#658071;margin-bottom:4px}.lifecycle413-final-grid span{display:block;font-size:13px;color:#294b3a;white-space:pre-wrap;line-height:1.5}.lifecycle413-closed-list{display:grid;gap:10px}.lifecycle413-closed-card{width:100%;border:1.5px solid #cddfd5;border-radius:14px;background:#fff;padding:13px;text-align:left;color:inherit}.lifecycle413-closed-card h3{margin:7px 0;color:#174d78;font-size:16px}.lifecycle413-closed-action{margin-top:9px;padding:10px;border-radius:10px;background:#f4faf6;border:1px solid #d9e8df;color:#395d49;font-size:12px;line-height:1.5}@media(max-width:560px){.lifecycle413-final-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
  document.addEventListener('click',e=>{const b=e.target?.closest?.('#closeInc');if(!b)return;e.preventDefault();e.stopImmediatePropagation();alert('안전관리자 확인 후 경영진 결재가 모두 완료되면 종결됩니다. 별도 수동 종결은 하지 않습니다.')},true);

  function finalActionSection(i){
    if(historicalClosed(i))return '';
    if(!normalFinalized(i))return '';
    const c=i.corrective||{},attachments=typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(c.afterPhotos||[]):'';
    return `<section class="lifecycle413-final" data-lifecycle-final="${escx(i.id)}"><h3>종결 사고조치</h3><div class="lifecycle413-final-body"><div class="lifecycle413-final-grid"><div><b>원인 분석</b><span>${escx(c.rootCause||'-')}</span></div><div><b>조치 내용</b><span>${escx(c.actionDetail||'-')}</span></div><div><b>조치 담당자</b><span>${escx(c.ownerName||'-')}</span></div><div><b>완료기한</b><span>${escx(c.dueDate||'-')}</span></div><div><b>사고보고 승인</b><span>${escx(i.approvedBy||'-')} · ${escx(i.approvedAt?fmt(i.approvedAt):'-')}</span></div><div><b>사고조치 승인</b><span>${escx(c.reviewedBy||'-')} · ${escx(c.reviewedAt?fmt(c.reviewedAt):'-')}</span></div></div>${c.reviewNote?`<div class="inc411-kv"><b>최종 검토의견</b><span>${escx(c.reviewNote)}</span></div>`:''}${attachments?`<div><b style="display:block;margin-bottom:7px;color:#658071">조치 사진 · PDF</b>${attachments}</div>`:''}</div></section>`;
  }
  function appendFinalAction(id){
    const i=(data?.incidents||[]).find(x=>String(x.id)===String(id));if(!finalized(i))return;
    const modal=document.querySelector('#modalRoot .modal');if(!modal||modal.dataset.cumulativeIncident||modal.querySelector(`[data-lifecycle-final="${CSS.escape(String(id))}"]`))return;
    const html=finalActionSection(i),anchor=modal.querySelector('#ackIncident411')||modal.querySelector('.modal-actions');
    if(anchor)anchor.insertAdjacentHTML('beforebegin',html);else modal.insertAdjacentHTML('beforeend',html);
    try{window.enlBindAttachmentOpen?.(modal,i.corrective?.afterPhotos||[])}catch(e){}
  }
  function wrapIncidentOpen(name){const base=window[name];if(typeof base!=='function')return;window[name]=function(id,...args){const r=base.call(this,id,...args);setTimeout(()=>{appendFinalAction(id);rewriteLabels(document)},0);return r}}
  wrapIncidentOpen('enlOpenIncidentReview');wrapIncidentOpen('openIncidentModal');

  // Only currently report-approved incidents belong in the corrective-action work screen.
  function trimActionWork(root,u){
    if(!root||isReader(u))return;
    root.querySelectorAll('[data-unified-action],[data-field-action]').forEach(btn=>{const id=btn.dataset.unifiedAction||btn.dataset.fieldAction,i=(data?.incidents||[]).find(x=>String(x.id)===String(id));if(i&&!reportApproved(i))btn.closest('article')?.remove()});
    const list=root.querySelector('#unifiedActionList,.field411-list');if(list&&!list.querySelector('article')&&!list.querySelector('.empty,.field411-empty'))list.insertAdjacentHTML('beforeend','<div class="empty">사고보고가 승인된 사고만 사고조치를 작성할 수 있습니다.</div>');
  }
  const baseActions=window.renderUnifiedActions;if(typeof baseActions==='function')window.renderUnifiedActions=function(root,u){const r=baseActions(root,u);trimActionWork(root,u);rewriteLabels(root);return r};
  const baseFieldActions=window.enlRenderFieldActions;if(typeof baseFieldActions==='function')window.enlRenderFieldActions=function(root,u){const r=baseFieldActions(root,u);trimActionWork(root,u);rewriteLabels(root);return r};

  try{
    actionStatusName=actionStatus;
    actionBadge=function(i){if(i.executiveApproval?.state==='pending')return badge('p-review','경영진 결재대기');if(historicalClosed(i))return badge('p-done','이관종결');const report=String(i?.status||''),s=String(i?.corrective?.status||'');if(!['approved','closed'].includes(report))return badge('p-normal','사고조치 보고승인 대기');if(!s)return badge('p-normal','사고조치 미작성');return badge(s==='approved'?'p-done':s==='rejected'?'p-rejected':'p-review',actionStatus(s))};
  }catch(e){}

  function rewriteLabels(root=document){
    root.querySelectorAll?.('.field411-badge,.pill,.shell411-stat span,.shell411-site span').forEach(el=>{
      const t=String(el.textContent||'').trim();
      if(t==='검토대기')el.textContent='사고보고 검토대기';
      else if(t==='보고 검토대기')el.textContent='사고보고 검토대기';
      else if(t==='조치 검토대기')el.textContent='사고조치 검토대기';
      else if(t==='사고 조치')el.textContent='사고조치 검토대기';
    });
  }

  function closedIncidents(u){
    let arr=[...(data?.incidents||[])].filter(finalized);
    if(isSite(u))arr=arr.filter(i=>String(i.siteId)===String(u.siteId));
    return arr.sort((a,b)=>new Date(b.closedAt||b.updatedAt||0)-new Date(a.closedAt||a.updatedAt||0));
  }
  function renderClosedView(u=currentUser?.()){
    const root=document.getElementById('view');if(!root||!u)return;
    const arr=closedIncidents(u);
    const previous=root.querySelector('[data-closed-site]')?.value||'';
    const expanded=!!root.querySelector('[data-fold="closed"][open]');
    function card(i){const q=typeof window.enlIncidentQuickSummary==='function'?window.enlIncidentQuickSummary(i):{headline:i.eventType||'사고',site:siteName(i.siteId),when:fmt(i.occurredAt)},c=i.corrective||{},h=historicalClosed(i),hi=i.historicalImport||{};return `<div class="closed-entry"><button type="button" class="lifecycle413-closed-card" data-lifecycle-open="${escx(i.id)}"><div>${h?(typeof badge==='function'?badge('p-done','과거사고 · ERP 기결재 · 이관종결'):''):`${typeof priorityBadge==='function'?priorityBadge(i.priority):''}${typeof statusBadge==='function'?statusBadge(i.status):''}${typeof actionBadge==='function'?actionBadge(i):''}`}</div><h3>${escx(q.site||siteName(i.siteId))} · ${escx(q.headline||i.eventType||'사고')}</h3>${typeof window.enlIncidentOverviewHtml==='function'?window.enlIncidentOverviewHtml(i,{compact:true}):''}${h?`<div class="lifecycle413-closed-action"><b>과거사고 이관종결</b><br>ERP 기결재 자료를 사고이력 관리를 위해 이관한 건입니다.<br><small>${escx(hi.transferredByName||i.reporterName||'-')} 이관등록 · ${escx(hi.transferredAt?fmt(hi.transferredAt):'-')}</small></div>`:`<div class="lifecycle413-closed-action"><b>최종 조치</b><br>${escx(c.actionDetail||'-')}<br><small>${escx(c.reviewedBy||'안전관리자')} 승인 · ${escx(c.reviewedAt?fmt(c.reviewedAt):'-')}</small></div>`}</button><div class="closed-tools"><button type="button" data-closed-xlsx="${escx(i.id)}">최종 사고보고서 Excel 출력</button><button type="button" data-closed-pdf="${escx(i.id)}">종결보고서 PDF 출력</button></div></div>`}
    const groups=new Map();
    for(const i of arr){const key=String(i.siteId||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)}
    root.innerHTML=`<section class="panel"><div class="section-head"><div><div class="ey">FINALIZED INCIDENTS</div><h2>최근 종결사고</h2><p>최근 종결 순서로 표시합니다. 전체 ${arr.length}건</p></div></div>
      ${arr.length?window.enlFoldedList(arr,'lifecycle413-closed-list','closed',card):'<p>종결된 사고가 없습니다.</p>'}</section>
      <section class="panel closed-sites"><h2>사업장별 종결사고 기록</h2><label>사업장 선택 <select data-closed-site><option value="">사업장을 선택하세요</option>${[...groups].sort(([a],[b])=>siteName(a).localeCompare(siteName(b),'ko')).map(([id,list])=>`<option value="${escx(id)}">${escx(siteName(id))} (${list.length}건)</option>`).join('')}</select></label><div class="lifecycle413-closed-list" data-site-closed-records></div></section>`;
    const select=root.querySelector('[data-closed-site]'),records=root.querySelector('[data-site-closed-records]');
    const bind=container=>{
      container.querySelectorAll('[data-lifecycle-open]').forEach(b=>b.onclick=()=>window.enlOpenIncidentReview?.(b.dataset.lifecycleOpen,false,u));
      container.querySelectorAll('[data-closed-xlsx]').forEach(b=>b.onclick=()=>window.enlOfficialIncidentPrint?.(arr.find(i=>i.id===b.dataset.closedXlsx),b));
      container.querySelectorAll('[data-closed-pdf]').forEach(b=>b.onclick=()=>window.enlPrintFinalDocument?.(arr.find(i=>i.id===b.dataset.closedPdf)));
    };
    select.onchange=()=>{records.innerHTML=(groups.get(select.value)||[]).map(card).join('');bind(records)};
    bind(root);
    if(previous&&groups.has(previous)){select.value=previous;select.onchange()}
    const fold=root.querySelector('[data-fold="closed"]');if(fold)fold.open=expanded;
    document.querySelectorAll('.shell411-nav button').forEach(b=>b.classList.remove('on'));document.querySelector('[data-lifecycle-closed]')?.classList.add('on');
  }
  function injectClosedNav(u){
    if(!u||isSite(u))return;const nav=document.querySelector('.shell411-nav');if(!nav||nav.querySelector('[data-lifecycle-closed]'))return;
    const b=document.createElement('button');b.type='button';b.className='lifecycle413-nav';b.dataset.lifecycleClosed='1';b.textContent='종결';b.onclick=()=>{currentView='closed';renderShell(u)};nav.appendChild(b);
  }
  window.enlRenderClosedView=renderClosedView;
  const baseShell=window.renderShell;if(typeof baseShell==='function')window.renderShell=function(u){const r=baseShell(u);injectClosedNav(u);rewriteLabels(document);snapshot();return r};
  const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){const r=baseRender();const u=currentUser?.();injectClosedNav(u);rewriteLabels(document);snapshot();return r};

  // Existing screen is already rendered before this module loads.
  const initial=currentUser?.();injectClosedNav(initial);rewriteLabels(document);snapshot();
  window.enlIncidentFinalized=finalized;
  window.enlRenderClosedIncidents=renderClosedView;
  window.ENL_LIFECYCLE_VERSION=VERSION;
})();