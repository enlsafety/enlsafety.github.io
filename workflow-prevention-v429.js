/* E&L Accident Report App v4.2.9 - recurrence prevention workflow */
(function(){
  'use strict';

  const VERSION='4.2.9-prevention-flow2';
  const LEGACY_SENTINEL='후속 단계에서 안전관리자가 별도 수립';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isSafety=u=>roleNorm(u?.role)==='safety';
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const isField=u=>['field','worker'].includes(String(u?.role||''));
  const isSiteManager=u=>isField(u)&&MANAGER_POSITIONS.includes(String(u?.position||u?.jobTitle||''));
  const text=v=>String(v??'').trim();
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const userId=u=>String(u?.personnelId||u?.id||'');
  const sameSite=(i,u)=>String(i?.siteId||'')===String(u?.siteId||'');
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const isAuthor=(i,u)=>{const rid=String(i?.reporterId||'');if(rid&&userId(u))return rid===userId(u);return !rid&&norm(i?.reporterName)===norm(u?.name)};
  const reportAccepted=i=>!!i&&['approved','closed'].includes(String(i.status||''));
  const isFinalized=i=>!!i&&String(i.status)==='closed'&&String(i.corrective?.status)==='approved';
  const hasPlan=c=>!!c&&(!!text(c.planDetail)||!!c.planAt);
  const attachmentsHtml=arr=>typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(arr||[]):'';
  const bindAttachments=(root,arr)=>{try{window.enlBindAttachmentOpen?.(root,arr||[])}catch(e){}};
  const persistAttachments=arr=>(arr||[]).map(a=>typeof window.enlPersistAttachment==='function'?window.enlPersistAttachment(a):a);
  const quick=i=>typeof window.enlIncidentQuickSummary==='function'?window.enlIncidentQuickSummary(i):{headline:i?.eventType||'사고',site:siteName(i?.siteId),when:i?.occurredAt?(typeof fmt==='function'?fmt(i.occurredAt):i.occurredAt):'-'};
  const overview=i=>typeof window.enlIncidentOverviewHtml==='function'?window.enlIncidentOverviewHtml(i,{compact:true}):`<p class="summary">${ex(i?.summary||'-')}</p>`;

  let actionFilter={status:'',siteId:'',title:''};

  function statusText(i){
    const c=i?.corrective||{},s=String(c.status||'');
    if(isFinalized(i)||s==='approved')return '재발방지조치 확인완료';
    if(!hasPlan(c))return '재발방지계획 수립대기';
    if(s==='planned')return '현장 재발방지조치 대기';
    if(s==='in_progress')return '재발방지조치 작성중';
    if(s==='submitted')return '안전관리자 확인대기';
    if(s==='rejected')return '재발방지조치 보완요청';
    return '현장 재발방지조치 대기';
  }
  function preventionBadge(i){
    const c=i?.corrective||{},s=String(c.status||''),label=statusText(i);
    if(typeof badge!=='function')return `<span class="field411-badge">${ex(label)}</span>`;
    return badge(s==='approved'?'p-done':s==='rejected'?'p-rejected':s==='submitted'?'p-review':'p-normal',label);
  }

  function installGlobalLabels(){
    try{
      window.actionStatusName=v=>v==='planned'?'현장 재발방지조치 대기':v==='in_progress'?'재발방지조치 작성중':v==='submitted'?'안전관리자 확인대기':v==='rejected'?'재발방지조치 보완요청':v==='approved'?'재발방지조치 확인완료':'재발방지계획 수립대기';
      actionStatusName=window.actionStatusName;
    }catch(e){}
    try{window.actionBadge=i=>preventionBadge(i);actionBadge=window.actionBadge}catch(e){}
  }

  function ensureCss(){
    if(document.getElementById('prevention429Css'))return;
    const s=document.createElement('style');s.id='prevention429Css';s.textContent=`
      .prev429-list{display:grid;gap:10px}.prev429-card{border:1.5px solid #d7e3ec;border-radius:14px;background:#fff;padding:14px}.prev429-card.rejected{border-color:#e2b2b2;background:#fffafa}.prev429-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.prev429-card h3{margin:9px 0 6px;color:#173b66;font-size:17px}.prev429-meta{display:flex;gap:6px;flex-wrap:wrap}.prev429-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.prev429-grid>div{padding:10px;border:1px solid #dfe8ef;border-radius:10px;background:#f7fafc;min-width:0}.prev429-grid b{display:block;font-size:10px;color:#667c8f;margin-bottom:4px}.prev429-grid span{display:block;color:#29475f;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:keep-all}.prev429-plan{grid-column:1/-1;border-color:#c7ddec!important;background:#f3f9fd!important}.prev429-action{grid-column:1/-1;border-color:#cfe2d7!important;background:#f5faf7!important}.prev429-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.prev429-actions button{min-height:42px;border:1px solid #b9cbd8;border-radius:9px;background:#fff;color:#264f6e;padding:0 13px;font-weight:900}.prev429-actions button.primary{border-color:#1e5d91;background:#1e5d91;color:#fff}.prev429-actions button:disabled{opacity:.55;cursor:not-allowed}.prev429-wait{margin-top:9px;padding:10px 11px;border-radius:10px;background:#fff8e9;border:1px solid #ead8a9;color:#71551d;font-size:12px;line-height:1.5}.prev429-reject{margin-top:9px;padding:10px 11px;border-radius:10px;background:#fff0f0;border:1px solid #e8bcbc;color:#8b3737;font-size:12px;line-height:1.5}.prev429-note{padding:10px 11px;border:1px solid #d4e3ed;border-radius:10px;background:#f5fafd;color:#3b607c;font-size:12px;line-height:1.55}.prev429-modal-section{margin-top:12px;border:1px solid #d9e5ed;border-radius:12px;background:#fff;overflow:hidden}.prev429-modal-section>h3{margin:0;padding:10px 12px;background:#eef6fb;color:#174d78;font-size:14px}.prev429-modal-body{padding:12px;display:grid;gap:9px}.prev429-kv{display:grid;grid-template-columns:115px minmax(0,1fr);gap:10px;line-height:1.5}.prev429-kv>b{font-size:12px;color:#577084}.prev429-kv>span{font-size:13px;color:#29465d;white-space:pre-wrap}.prev429-confirm{border:2px solid #b9d8c5;background:#f6fbf8}.prev429-confirm>h3{background:#eaf6ef;color:#286044}.prev429-hidden-legacy{display:none!important}.prev429-flow{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.prev429-flow span{display:inline-flex;align-items:center;min-height:27px;padding:0 8px;border-radius:999px;background:#eef4f8;color:#526d82;border:1px solid #d2e0ea;font-size:10px;font-weight:900}.prev429-flow span.on{background:#1e5d91;color:#fff;border-color:#1e5d91}.prev429-flow span.done{background:#eaf6ef;color:#2e6949;border-color:#bdd9c7}@media(max-width:620px){.prev429-grid{grid-template-columns:1fr}.prev429-plan,.prev429-action{grid-column:auto}.prev429-kv{grid-template-columns:1fr;gap:3px}.prev429-actions button{flex:1 1 145px}}
    `;document.head.appendChild(s);
  }

  function flowHtml(i){
    const c=i?.corrective||{},accepted=reportAccepted(i),plan=hasPlan(c),fieldDone=['submitted','rejected','approved'].includes(String(c.status||'')),closed=isFinalized(i);
    const steps=[['접수완료',accepted],['재발방지계획',plan],['현장 조치등록',fieldDone],['안전관리자 확인',String(c.status||'')==='approved'],['종결',closed]];
    let currentFound=false;
    return `<div class="prev429-flow">${steps.map(([label,done])=>{let cls=done?'done':'';if(!done&&!currentFound){cls='on';currentFound=true}return `<span class="${cls}">${ex(label)}</span>`}).join('')}</div>`;
  }

  function stripSentinelSummary(s){
    return String(s||'').replace(new RegExp(`\\s*\\[재발 방지 대책\\]\\s*${LEGACY_SENTINEL.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,'g'),'').replace(/\s{2,}/g,' ').trim();
  }
  function cleanupSentinel(){
    let dirty=false;
    for(const i of data?.incidents||[]){
      const d=i?.reportDetails;if(!d||text(d.preventionPlan)!==LEGACY_SENTINEL)continue;
      d.preventionPlan='';if(d.generatedSummary)d.generatedSummary=stripSentinelSummary(d.generatedSummary);if(i.summary)i.summary=stripSentinelSummary(i.summary);dirty=true;
    }
    if(dirty){try{saveData()}catch(e){}}
  }

  function patchReportForm(root=document){
    const form=root.querySelector?.('#unifiedReportForm');if(!form||form.dataset.prevention429==='1')return;form.dataset.prevention429='1';
    const prevention=form.querySelector('#preventionPlan410'),preventionLabel=prevention?.closest('label'),targetSection=prevention?.closest('.report410-section');
    const immediate=form.querySelector('#immediateAction'),immediateLabel=immediate?.closest('label'),originSection=immediate?.closest('.report410-section');
    if(targetSection){
      const head=targetSection.querySelector('.report410-section-head b');if(head)head.textContent='5. 사고조치 내용';
      const small=targetSection.querySelector('.report410-section-head small');if(small)small.textContent='사고 직후 실제로 실시한 응급처치·작업중지·현장통제·병원이송·보고 등의 조치를 입력합니다.';
      if(immediateLabel){const span=immediateLabel.querySelector('span');if(span)span.textContent='사고조치 내용 *';targetSection.insertBefore(immediateLabel,preventionLabel||targetSection.querySelector('.report410-grid')||targetSection.firstChild)}
    }
    if(originSection&&originSection!==targetSection){const small=originSection.querySelector('.report410-section-head small');if(small)small.textContent='사고 직전 작업과 발생 과정을 확인된 사실대로 입력합니다.'}
    if(prevention){if(!text(prevention.value))prevention.value=LEGACY_SENTINEL;prevention.required=false;preventionLabel?.classList.add('prev429-hidden-legacy');preventionLabel?.setAttribute('aria-hidden','true')}
    form.addEventListener('submit',()=>setTimeout(cleanupSentinel,0),true);
  }

  function reportUiRewrite(root=document){
    patchReportForm(root);
    root.querySelectorAll?.('.inc411-kv').forEach(row=>{const key=row.querySelector('b'),val=row.querySelector('span');if(!key)return;const k=text(key.textContent);if(k==='즉시 조치')key.textContent='사고조치 내용';if(k==='재발방지대책'){if(!val||['','-',LEGACY_SENTINEL].includes(text(val.textContent)))row.remove();else key.textContent='기존 재발방지대책(전환 전)'}});
    const approve=root.querySelector?.('#approveInc');if(approve&&text(approve.textContent)!=='사고 접수완료')approve.textContent='사고 접수완료';
    root.querySelectorAll?.('option[value="approved"]').forEach(o=>{if(text(o.textContent)==='승인')o.textContent='접수완료'});
    root.querySelectorAll?.('.field411-badge,.pill,.shell411-recent-status span,.inc411-card-tags span,.shell411-stat span,.shell411-site span').forEach(el=>{const t=text(el.textContent);if(t==='승인')el.textContent='접수완료';else if(t==='사고조치 검토대기')el.textContent='재발방지조치 확인대기';else if(t==='조치 미작성')el.textContent='계획 수립대기'});
    root.querySelectorAll?.('.field411-meta span,.field411-public-state .field411-badge,.field411-manager-note,.shell411-head p,.section-head p').forEach(el=>{
      const t=text(el.textContent),map={'조치 보고승인 대기':'재발방지 접수대기','조치 미작성':'재발방지계획 수립대기','조치 조치예정':'현장 재발방지조치 대기','조치 조치중':'재발방지조치 작성중','조치 검토대기':'재발방지조치 확인대기','조치 반려':'재발방지조치 보완요청','조치 승인완료':'재발방지조치 확인완료','사고보고와 사고조치의 검토상태를 각각 확인합니다.':'사고 접수부터 재발방지계획·현장조치·확인완료까지 진행상태를 확인합니다.','사고보고 상태와 사고조치 상태를 함께 표시합니다.':'사고 접수상태와 재발방지 진행상태를 함께 표시합니다.','조치 미작성은 사고보고가 승인·종결된 건 중 아직 사고조치가 작성되지 않은 건입니다.':'계획 수립대기는 사고 접수완료 후 아직 안전관리자가 재발방지계획을 등록하지 않은 건입니다.','사고보고와 사고조치는 각각 별도 상태로 관리됩니다. 사고보고 승인 후 사고조치를 작성하고, 제출된 조치는 안전관리자가 별도로 검토·승인합니다.':'사고 접수완료 후 안전관리자가 재발방지계획을 수립하고, 현장에서 조치결과를 등록하면 안전관리자가 확인 후 종결합니다.'};if(map[t])el.textContent=map[t];
    });
    root.querySelectorAll?.('h2,h3,p,small,button').forEach(el=>{const t=text(el.textContent);if(t==='승인 사고')el.textContent='접수완료 사고';else if(t==='승인 사고 조회')el.textContent='접수완료 사고 조회';else if(t==='승인 사고 현황')el.textContent='접수완료 사고 현황';else if(t==='승인 사고조치')el.textContent='확인완료 재발방지조치';else if(t==='사고조치 검토대기')el.textContent='재발방지조치 확인대기';else if(t==='조치 미작성')el.textContent='계획 수립대기';else if(t==='사고 조치')el.textContent='재발방지 관리';else if(t==='종결 사고조치')el.textContent='종결 재발방지조치';else if(t==='사고보고 승인')el.textContent='사고 접수완료';else if(t==='사고조치 승인')el.textContent='재발방지조치 확인완료';else if(t==='최종 조치')el.textContent='최종 재발방지조치'});
    root.querySelectorAll?.('[data-lifecycle-final]').forEach(section=>{const id=section.getAttribute('data-lifecycle-final'),i=(data?.incidents||[]).find(x=>String(x.id)===String(id)),c=i?.corrective||{},grid=section.querySelector('.lifecycle413-final-grid');if(grid&&text(c.planDetail)&&!grid.querySelector('[data-prevention-plan]')){const first=grid.children[0],div=document.createElement('div');div.dataset.preventionPlan='1';div.innerHTML=`<b>재발방지계획</b><span>${ex(c.planDetail)}</span>`;if(first?.nextSibling)grid.insertBefore(div,first.nextSibling);else grid.appendChild(div)}});
  }

  function eligibleForAction(u){
    let arr=[...(data?.incidents||[])].filter(reportAccepted);if(isField(u)){arr=arr.filter(i=>sameSite(i,u));if(!isSiteManager(u))arr=arr.filter(i=>isAuthor(i,u))}if(isReader(u))arr=arr.filter(i=>String(i.corrective?.status||'')==='approved');return arr.sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
  }

  function cardHtml(i,u){
    const c=i?.corrective||{},q=quick(i),rejected=String(c.status||'')==='rejected',plan=hasPlan(c),action=text(c.actionDetail),safety=isSafety(u),field=isField(u),reader=isReader(u);let button='상세 확인',disabled=false;
    if(safety){if(isFinalized(i))button='종결 내용 확인';else if(!plan)button='재발방지계획 등록';else if(c.status==='submitted')button='재발방지조치 확인';else if(c.status==='rejected')button='보완조치 대기';else button='재발방지계획 확인·수정'}
    else if(field){if(!plan){button='안전관리자 계획 수립대기';disabled=true}else if(c.status==='submitted'){button='안전관리자 확인 중';disabled=true}else if(c.status==='approved')button='확인완료 내용 보기';else if(c.status==='rejected')button='보완 후 다시 제출';else if(action)button='재발방지조치 수정·제출';else button='재발방지조치 등록'}else if(reader)button='재발방지조치 확인';
    return `<article class="prev429-card ${rejected?'rejected':''}" data-prev-card="${ex(i.id)}"><div class="prev429-top"><div class="prev429-meta">${typeof categoryBadge==='function'?categoryBadge(i.category):''}${typeof statusBadge==='function'?statusBadge(i.status):''}${preventionBadge(i)}</div><span>${ex(q.when||'')}</span></div><h3>${ex(q.site||siteName(i.siteId))} · ${ex(q.headline||i.eventType||'사고')}</h3>${overview(i)}${flowHtml(i)}${rejected&&c.reviewNote?`<div class="prev429-reject"><b>안전관리자 보완요청</b><br>${ex(c.reviewNote)}</div>`:''}${!plan&&field?'<div class="prev429-wait">안전관리자가 사고 접수 후 재발방지계획을 수립하면 현장에서 조치내용을 등록할 수 있습니다.</div>':''}<div class="prev429-grid"><div><b>원인 분석</b><span>${ex(c.rootCause||'미등록')}</span></div><div><b>담당 / 완료목표</b><span>${ex(c.ownerName||'미지정')} · ${ex(c.dueDate||'미지정')}</span></div><div class="prev429-plan"><b>안전관리자 재발방지계획</b><span>${ex(c.planDetail||'미등록')}</span></div><div class="prev429-action"><b>현장 재발방지조치</b><span>${ex(c.actionDetail||'미등록')}</span></div></div><div class="prev429-actions"><button type="button" class="primary" data-prev-open="${ex(i.id)}" ${disabled?'disabled':''}>${ex(button)}</button></div></article>`;
  }

  function filterMatches(i,status){const c=i?.corrective||{},s=String(c.status||'');if(!status)return true;if(status==='plan_missing')return !hasPlan(c);if(status==='planned')return hasPlan(c)&&(!s||s==='planned');return s===status}

  function renderUnifiedActions429(root,u){
    ensureCss();const reader=isReader(u),safety=isSafety(u),base=eligibleForAction(u),preset={...actionFilter};const heading=preset.title||(reader?'확인완료 재발방지조치':safety?'재발방지 관리':'재발방지조치'),description=reader?'안전관리자가 최종 확인한 재발방지조치만 조회합니다.':safety?'접수완료된 사고의 재발방지계획을 수립하고, 현장이 등록한 조치를 확인해 종결합니다.':'안전관리자가 수립한 재발방지계획에 따라 조치하고 결과를 등록합니다.';
    root.innerHTML=`<section class="panel"><div class="section-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>${ex(heading)}</h2><p>${ex(description)}</p></div></div>${reader?'':`<div class="toolbar"><div class="left">${isField(u)?'':`<select id="prev429Site"><option value="">전체 사업장</option>${(data?.sites||[]).map(s=>`<option value="${ex(s.id)}" ${String(preset.siteId)===String(s.id)?'selected':''}>${ex(s.name)}</option>`).join('')}</select>`}<select id="prev429Status"><option value="" ${!preset.status?'selected':''}>전체 진행상태</option><option value="plan_missing" ${preset.status==='plan_missing'?'selected':''}>계획 수립대기</option><option value="planned" ${preset.status==='planned'?'selected':''}>현장 조치대기</option><option value="in_progress" ${preset.status==='in_progress'?'selected':''}>현장 작성중</option><option value="submitted" ${preset.status==='submitted'?'selected':''}>안전관리자 확인대기</option><option value="rejected" ${preset.status==='rejected'?'selected':''}>보완요청</option><option value="approved" ${preset.status==='approved'?'selected':''}>확인완료</option></select></div></div>`}<div id="prev429List" class="prev429-list"></div></section>`;
    const refresh=()=>{let arr=[...base];const site=isField(u)?'':(document.getElementById('prev429Site')?.value||preset.siteId||''),st=reader?'approved':(document.getElementById('prev429Status')?.value||preset.status||'');if(site)arr=arr.filter(i=>String(i.siteId)===String(site));if(st)arr=arr.filter(i=>filterMatches(i,st));const list=document.getElementById('prev429List');if(!list)return;list.innerHTML=arr.map(i=>cardHtml(i,u)).join('')||'<div class="empty">표시할 재발방지 관리 건이 없습니다.</div>';list.querySelectorAll('[data-prev-open]').forEach(b=>{if(!b.disabled)b.onclick=()=>openCorrectiveModal429(b.dataset.prevOpen,u)})};
    ['prev429Site','prev429Status'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{actionFilter={status:document.getElementById('prev429Status')?.value||'',siteId:document.getElementById('prev429Site')?.value||'',title:''};refresh()}));refresh();reportUiRewrite(root);
  }

  function renderFieldActions429(root,u){
    ensureCss();const arr=eligibleForAction(u);root.innerHTML=`<section class="field411-screen"><section class="panel"><div class="field411-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>재발방지조치</h2><p>안전관리자가 수립한 재발방지계획을 확인하고 실제 실시한 조치와 증빙을 등록합니다.</p></div></div><div class="prev429-note">사고 최초보고 단계에서는 사고 직후 조치까지만 작성합니다. 재발방지계획은 사고 접수완료 후 안전관리자가 별도로 수립합니다.</div></section><div class="prev429-list">${arr.map(i=>cardHtml(i,u)).join('')||'<div class="field411-empty">사고가 접수완료된 뒤 안전관리자가 재발방지계획을 등록하면 이 화면에 표시됩니다.</div>'}</div></section>`;window.enlAddFieldBack?.(root,u);root.querySelectorAll('[data-prev-open]').forEach(b=>{if(!b.disabled)b.onclick=()=>openCorrectiveModal429(b.dataset.prevOpen,u)});reportUiRewrite(root);
  }

  function historyPush(c,entry){c.reviewHistory=Array.isArray(c.reviewHistory)?c.reviewHistory:[];c.reviewHistory.push(entry)}
  function openReadOnly(i,u){
    const c=i.corrective||{},files=attachmentsHtml(c.afterPhotos||[]);openModal(`<div class="modal-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>${ex(siteName(i.siteId))} · ${ex(i.eventType||'사고')}</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}<section class="prev429-modal-section"><h3>재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'-')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'기존 사고조치 기록(전환 전)')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'-')} · ${ex(c.dueDate||'-')}</span></div><div class="prev429-kv"><b>계획 수립</b><span>${ex(c.planBy||'-')} · ${ex(c.planAt&&typeof fmt==='function'?fmt(c.planAt):(c.planAt||'-'))}</span></div></div></section><section class="prev429-modal-section prev429-confirm"><h3>현장 재발방지조치 및 확인</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>현장 조치내용</b><span>${ex(c.actionDetail||'-')}</span></div><div class="prev429-kv"><b>현장 제출</b><span>${ex(c.submittedBy||'-')} · ${ex(c.submittedAt&&typeof fmt==='function'?fmt(c.submittedAt):(c.submittedAt||'-'))}</span></div><div class="prev429-kv"><b>안전관리자 확인</b><span>${ex(c.reviewedBy||'-')} · ${ex(c.reviewedAt&&typeof fmt==='function'?fmt(c.reviewedAt):(c.reviewedAt||'-'))}</span></div>${c.reviewNote?`<div class="prev429-kv"><b>확인의견</b><span>${ex(c.reviewNote)}</span></div>`:''}</div></section>${files?`<section class="prev429-modal-section"><h3>조치 증빙 사진 · PDF</h3><div class="prev429-modal-body">${files}</div></section>`:''}`);bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[]);
  }

  function openSafetyPlanModal(i,u){
    const c=i.corrective||{},plan=hasPlan(c),locked=(plan&&['submitted','approved'].includes(String(c.status||'')))||isFinalized(i),files=attachmentsHtml(c.afterPhotos||[]);
    if(locked){
      if(c.status==='submitted'){
        openModal(`<div class="modal-head"><div><div class="ey">SAFETY CONFIRMATION</div><h2>${ex(siteName(i.siteId))} · 재발방지조치 확인</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}<section class="prev429-modal-section"><h3>안전관리자 재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'-')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'-')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'-')} · ${ex(c.dueDate||'-')}</span></div></div></section><section class="prev429-modal-section prev429-confirm"><h3>현장 재발방지조치</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>조치내용</b><span>${ex(c.actionDetail||'-')}</span></div><div class="prev429-kv"><b>제출자</b><span>${ex(c.submittedBy||'-')} · ${ex(c.submittedAt&&typeof fmt==='function'?fmt(c.submittedAt):(c.submittedAt||'-'))}</span></div>${files?`<div>${files}</div>`:''}</div></section><label class="lbl"><span>확인의견 / 보완요청 사유</span><textarea id="prev429Review" rows="3" placeholder="확인 의견은 선택사항이며, 보완요청 시 사유는 필수입니다.">${ex(c.reviewNote||'')}</textarea></label><div class="modal-actions"><button type="button" class="btn-reject" id="prev429Reject">보완요청</button><button type="button" class="btn-green" id="prev429Approve">재발방지조치 확인완료</button></div>`);
        bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[]);
        document.getElementById('prev429Approve')?.addEventListener('click',()=>{const ts=now(),note=text(document.getElementById('prev429Review')?.value);c.status='approved';c.reviewNote=note;c.reviewedBy=u.name;c.reviewedById=userId(u);c.reviewedAt=ts;historyPush(c,{action:'prevention_action_confirmed',by:u.name,at:ts,note});i.corrective=c;i.updatedAt=ts;saveData();closeModal();renderShell(u);alert('재발방지조치 확인이 완료되어 사고가 종결되었습니다.')});
        document.getElementById('prev429Reject')?.addEventListener('click',()=>{const note=text(document.getElementById('prev429Review')?.value);if(!note)return alert('보완요청 사유를 입력해 주세요.');const ts=now();c.status='rejected';c.reviewNote=note;c.reviewedBy=u.name;c.reviewedById=userId(u);c.reviewedAt=ts;historyPush(c,{action:'prevention_action_rejected',by:u.name,at:ts,note});i.corrective=c;i.updatedAt=ts;saveData();closeModal();renderShell(u);alert('현장에 재발방지조치 보완을 요청했습니다.')});return;
      }
      return openReadOnly(i,u);
    }
    openModal(`<div class="modal-head"><div><div class="ey">PREVENTION PLAN</div><h2>${ex(siteName(i.siteId))} · 재발방지계획 ${plan?'확인·수정':'등록'}</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}${c.status==='rejected'&&c.reviewNote?`<div class="prev429-reject"><b>현장 조치 보완요청 중</b><br>${ex(c.reviewNote)}</div>`:''}<form id="prev429PlanForm"><label class="lbl"><span>원인 분석 *</span><textarea id="prev429RootCause" rows="3" required placeholder="사고 발생의 직접·간접 원인을 사실에 근거해 정리합니다.">${ex(c.rootCause||'')}</textarea></label><label class="lbl"><span>재발방지계획 *</span><textarea id="prev429PlanDetail" rows="4" required placeholder="설비개선, 작업방법 변경, 보호구, 교육 등 재발방지를 위해 실시해야 할 계획을 구체적으로 입력합니다.">${ex(c.planDetail||'')}</textarea></label><div class="formgrid"><label class="lbl"><span>조치 담당자 *</span><input id="prev429Owner" value="${ex(c.ownerName||'')}" required placeholder="예: 현장소장 홍길동"></label><label class="lbl"><span>완료 목표일 *</span><input id="prev429Due" type="date" value="${ex(c.dueDate||'')}" required></label></div><button class="primary full" type="submit">${plan?'재발방지계획 수정 저장':'재발방지계획 등록'}</button></form>`);
    document.getElementById('prev429PlanForm').onsubmit=e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;const ts=now(),prevStatus=String(c.status||'');c.rootCause=text(document.getElementById('prev429RootCause')?.value);c.planDetail=text(document.getElementById('prev429PlanDetail')?.value);c.ownerName=text(document.getElementById('prev429Owner')?.value);c.dueDate=text(document.getElementById('prev429Due')?.value);c.planBy=c.planBy||u.name;c.planById=c.planById||userId(u);c.planAt=c.planAt||ts;c.planUpdatedBy=u.name;c.planUpdatedAt=ts;if(!plan)c.status=text(c.actionDetail)?'in_progress':'planned';else if(!prevStatus||prevStatus==='none')c.status='planned';historyPush(c,{action:plan?'prevention_plan_updated':'prevention_plan_registered',by:u.name,at:ts,note:c.planDetail});i.corrective=c;i.updatedAt=ts;saveData();closeModal();renderShell(u);alert(plan?'재발방지계획을 수정했습니다.':'재발방지계획을 등록했습니다. 현장에서 재발방지조치를 등록할 수 있습니다.')};
  }

  function openFieldActionModal(i,u){
    const c=i.corrective||{};if(!hasPlan(c))return alert('안전관리자가 재발방지계획을 등록한 뒤 조치할 수 있습니다.');if(c.status==='submitted')return alert('재발방지조치가 안전관리자 확인대기 중입니다.');if(c.status==='approved'||isFinalized(i))return openReadOnly(i,u);
    actionPhotos=[...(c.afterPhotos||[])];const rejected=String(c.status||'')==='rejected';
    openModal(`<div class="modal-head"><div><div class="ey">FIELD PREVENTION ACTION</div><h2>${ex(siteName(i.siteId))} · 재발방지조치 등록</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}<section class="prev429-modal-section"><h3>안전관리자 재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'-')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'-')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'-')} · ${ex(c.dueDate||'-')}</span></div></div></section>${rejected&&c.reviewNote?`<div class="prev429-reject"><b>안전관리자 보완요청</b><br>${ex(c.reviewNote)}</div>`:''}<form id="prev429FieldForm"><label class="lbl"><span>실제 실시한 재발방지조치 *</span><textarea id="prev429ActionDetail" rows="5" required placeholder="재발방지계획에 따라 현장에서 실제 실시한 조치 결과를 입력합니다.">${ex(c.actionDetail||'')}</textarea></label>${typeof photoPickerHtml==='function'?photoPickerHtml('action'):''}<div class="modal-actions"><button type="button" class="btn-gray" id="prev429Draft">임시저장</button><button type="submit" class="btn-blue">안전관리자 확인요청</button></div></form>`);
    try{renderPhotoThumbs('action');bindPhotoButtons()}catch(e){bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[])}
    const save=status=>{const detail=text(document.getElementById('prev429ActionDetail')?.value);if(!detail)return alert('실제로 실시한 재발방지조치 내용을 입력해 주세요.');const ts=now();c.actionDetail=detail;c.afterPhotos=persistAttachments(actionPhotos);c.status=status;c.actionBy=c.actionBy||u.name;c.actionById=c.actionById||userId(u);c.actionStartedAt=c.actionStartedAt||ts;c.actionUpdatedAt=ts;if(status==='submitted'){c.submittedBy=u.name;c.submittedById=userId(u);c.submittedAt=ts}historyPush(c,{action:status==='submitted'?'prevention_action_submitted':'prevention_action_draft',by:u.name,at:ts,note:detail});i.corrective=c;i.updatedAt=ts;saveData();actionPhotos=[];closeModal();renderShell(u);alert(status==='submitted'?'재발방지조치를 안전관리자 확인대기로 제출했습니다.':'재발방지조치를 임시저장했습니다.')};
    document.getElementById('prev429Draft')?.addEventListener('click',()=>save('in_progress'));document.getElementById('prev429FieldForm').onsubmit=e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;save('submitted')};
  }

  function openCorrectiveModal429(id,u=currentUser?.()){
    const i=(data?.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return alert('사고기록을 찾지 못했습니다.');if(!reportAccepted(i))return alert('안전관리자가 사고 접수완료 처리한 뒤 재발방지 절차를 진행할 수 있습니다.');if(isField(u)&&!sameSite(i,u))return alert('소속 사업장의 사고만 확인할 수 있습니다.');if(isSafety(u))return openSafetyPlanModal(i,u);if(isField(u))return openFieldActionModal(i,u);return openReadOnly(i,u);
  }

  function installRoutes(){
    window.renderUnifiedActions=renderUnifiedActions429;window.enlRenderFieldActions=renderFieldActions429;window.openUnifiedCorrectiveModal=openCorrectiveModal429;window.enlResetActionFilter=()=>{actionFilter={status:'',siteId:'',title:''}};window.enlSetActionFilter=filter=>{actionFilter={status:filter?.status||'',siteId:filter?.siteId||'',title:filter?.title||''}};window.enlOpenActionQueue=(u,filter={})=>{const mapped=filter?.status==='submitted'?'submitted':filter?.status||'';window.enlSetActionFilter({...filter,status:mapped,title:filter?.title==='사고조치 검토대기'?'재발방지조치 확인대기':filter?.title||''});currentView='actions';renderShell(u||currentUser())};
  }
  function wrapShell(){const base=window.renderShell;if(typeof base!=='function'||base.__prevention429)return;const wrapped=function(u){const out=base.call(this,u);installRoutes();setTimeout(()=>reportUiRewrite(document),0);return out};wrapped.__prevention429=true;window.renderShell=wrapped;try{renderShell=wrapped}catch(e){}}

  ensureCss();installGlobalLabels();installRoutes();wrapShell();cleanupSentinel();const observer=new MutationObserver(()=>reportUiRewrite(document));observer.observe(document.body,{childList:true,subtree:true});reportUiRewrite(document);window.enlPreventionFlowV429={version:VERSION,hasPlan,statusText,open:openCorrectiveModal429,patchReportForm,cleanupSentinel};window.ENL_PREVENTION_FLOW_VERSION=VERSION;
})();
