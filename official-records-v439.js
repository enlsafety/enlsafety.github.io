/* E&L Accident Report App v4.3.9 - official approval, audit, PDF, backup UI */
(function(){
  'use strict';
  const VERSION='4.4.39-statutory-record1';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-incident-compliance-v439';
  const CLIENT='incident-report-v2';
  let currentIncidentId='',patchQueued=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const current=()=>{try{return window.currentUser?.()||null}catch(e){return null}};
  const isSafety=u=>roleNorm(u?.role)==='safety';
  const actor=u=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  const passwordHash=u=>{
    let h=String(u?.passwordHash||'').trim();if(h)return h;
    try{const x=(data?.users||[]).find(v=>String(v?.id||'')===String(u?.id||''));return String(x?.passwordHash||'').trim()}catch(e){return ''}
  };
  const incident=id=>(data?.incidents||[]).find(x=>String(x.id)===String(id));
  const fmt=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}catch(e){return String(v)}};
  const site=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const historical=i=>!!i&&i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&i?.historicalImport?.workflowExempt===true&&String(i?.historicalImport?.transferState||'')==='closed';
  const actionState=v=>v==='confirmed'?'확인됨':v==='partial'?'일부 확인':v==='not_available'?'확인자료 없음':'미기재';
  const followState=v=>v==='field_check'?'현장 확인 필요':v==='new_improvement'?'신규 개선조치 필요':'추가조치 없음';

  async function api(action,extra={},timeout=30000){
    const u=current(),hash=passwordHash(u);
    if(!u||!isSafety(u)||!hash)throw new Error('login_refresh_required');
    const ctl=typeof AbortController!=='undefined'?new AbortController():null,t=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action,actor:actor(u),actorPasswordHash:hash,...extra}),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw new Error(j?.message||('http_'+r.status));return j;
    }finally{if(t)clearTimeout(t)}
  }

  function css(){
    if(document.getElementById('official439Css'))return;
    const s=document.createElement('style');s.id='official439Css';s.textContent=`
      .official439-box{margin:12px 0;border:1.5px solid #b9cfdf;border-radius:13px;background:#f8fbfd;overflow:hidden}.official439-box h3{margin:0;padding:10px 12px;background:#edf5fa;color:#1d557d;font-size:14px}.official439-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px}.official439-grid>div{padding:9px 10px;border:1px solid #dce8f0;border-radius:9px;background:#fff}.official439-grid b{display:block;font-size:10px;color:#748797;margin-bottom:3px}.official439-grid span{display:block;font-size:12px;color:#284d69;line-height:1.45;word-break:break-word}
      .official439-btn{border:1px solid #a9c5d8!important;background:#f3f9fc!important;color:#1d597f!important}.official439-search{display:flex;gap:7px;align-items:center;margin:0 0 10px}.official439-search input{flex:1;min-width:0;height:42px;border:1px solid #cbdbe6;border-radius:10px;padding:0 12px}.official439-search small{color:#708696;font-size:11px}
      
      .official439-backups{display:grid;gap:8px;max-height:55vh;overflow:auto}.official439-backup{padding:10px;border:1px solid #d9e5ed;border-radius:10px;background:#fff}.official439-backup-actions{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}.official439-backup-actions button{min-height:34px;border:1px solid #b8cad7;border-radius:8px;background:#fff;padding:0 9px;font-weight:850}
      .official439-note{padding:10px;border-radius:10px;background:#fff8e8;color:#74551e;font-size:11px;line-height:1.55;margin-bottom:10px}
      @media(max-width:560px){.official439-grid{grid-template-columns:1fr}.official439-search{align-items:stretch;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function actionLabel(v){
    const m={create:'즉시보고 등록',update:'수정',supplement_request:'보완요청',supplement_submit:'보완자료 제출',supplement_resubmit:'보완자료 재제출',approve:'사고보고 최종승인',reject:'보고 반려',final_approval:'최종 종결승인',post_approval_revision:'승인 후 수정',corrective_submit:'재발방지조치 제출',corrective_reject:'재발방지조치 반려',corrective_approve:'재발방지조치 승인',attachment_add:'첨부 등록',attachment_delete:'첨부 삭제',delete:'삭제',restore:'복원'};
    return m[v]||v||'기록';
  }
  function officialBox(i){
    if(historical(i)){
      const h=i.historicalImport||{};
      return `<section class="official439-box"><h3>과거사고 ERP 이관기록${window.ENLContracts?.badge(i.siteId)||''}</h3>${window.ENLContracts?.incidentDetail(i)||''}<div class="official439-grid">
        <div><b>등록구분</b><span>과거사고 · ERP 기결재 · 이관종결</span></div>
        <div><b>ERP 결재정보</b><span>${esc([h.erpApprovalDate,h.erpApprovalRef].filter(Boolean).join(' · ')||'기결재 완료(상세 미기재)')}</span></div>
        <div><b>기존 ERP 보고자/작성자</b><span>${esc(h.originalReporterName||'미기재')}</span></div>
        <div><b>이관등록자</b><span>${esc(h.transferredByName||i.reporterName||'-')}<br>${esc(fmt(h.transferredAt||i.createdAt))}</span></div>
        <div><b>기존 조치자료</b><span>${esc(actionState(h.existingActionStatus))}${h.existingActionNote?'<br>'+esc(h.existingActionNote):''}</span></div>
        <div><b>현재 추가조치</b><span>${esc(followState(h.additionalAction))}${h.additionalActionNote?'<br>'+esc(h.additionalActionNote):''}</span></div>
        <div><b>이관종결 기록</b><span>${esc(h.closedByName||h.transferredByName||'-')}<br>${esc(fmt(h.closedAt||i.closedAt))}</span></div>
        <div><b>종결 의미</b><span>사고이력 관리용 이관종결이며 과거 재발방지조치 완료를 의미하지 않음</span></div>
      </div></section>`;
    }
    const d=i.reportDetails||{},c=i.corrective||{},person=String(i.category||'')==='person';
    const worker=person?[d.injuredName||i.injuredName||'',d.job||i.job||''].filter(Boolean).join(' · '):[d.workerName||'',d.job||i.job||''].filter(Boolean).join(' · ');
    const cause=[c.rootCause||'',d.environmentCause||'',d.behaviorCause||''].filter(Boolean).join(' / ');
    const process=[d.workAction||'',d.incidentHow||i.summary||''].filter(Boolean).join(' → ');
    const plan=c.planDetail||d.preventionPlan||'-';
    return `<section class="official439-box"><h3>법정 사고기록</h3><div class="official439-grid">
      <div><b>사업장</b><span>${esc(site(i.siteId))}</span></div>
      <div><b>근로자 인적사항</b><span>${esc(worker||'-')}</span></div>
      <div><b>재해 발생 일시</b><span>${esc(fmt(i.occurredAt))}</span></div>
      <div><b>재해 발생 장소</b><span>${esc(d.place||'-')}</span></div>
      <div><b>재해 발생 원인 및 과정</b><span>${esc([cause,process].filter(Boolean).join('\n')||'-')}</span></div>
      <div><b>재해 재발방지 계획</b><span>${esc(plan)}</span></div>
    </div><div class="official439-note" style="margin:0 10px 10px">산업안전보건법상 산업재해 기록·보존 핵심항목만 표시합니다. 산업재해조사표 제출대상은 별도 법정 서식을 기준으로 관리합니다.</div></section>`;
  }

  function attachments(i){
    return [...(Array.isArray(i?.photos)?i.photos:[]),...(Array.isArray(i?.corrective?.afterPhotos)?i.corrective.afterPhotos:[])];
  }
  function printReport(i){
    const d=i.reportDetails||{},c=i.corrective||{},h=i.historicalImport||{},isHist=historical(i),person=String(i.category||'')==='person';
    const worker=person?[d.injuredName||i.injuredName||'',d.job||i.job||''].filter(Boolean).join(' · '):[d.workerName||'',d.job||i.job||''].filter(Boolean).join(' · ');
    const cause=[c.rootCause||'',d.environmentCause||'',d.behaviorCause||''].filter(Boolean).join(' / ');
    const process=[d.workAction||'',d.incidentHow||i.summary||''].filter(Boolean).join(' → ');
    const rows=isHist?[
      ['사업장',site(i.siteId)],['근로자 인적사항',worker||'-'],['재해 발생 일시',fmt(i.occurredAt)],['재해 발생 장소',d.place||'-'],
      ['재해 발생 원인 및 과정',[cause,process].filter(Boolean).join('\n')||'-'],['재해 재발방지 계획',h.existingActionNote||h.additionalActionNote||'과거 ERP 자료 기준 별도 확인']
    ]:[
      ['사업장',site(i.siteId)],['근로자 인적사항',worker||'-'],['재해 발생 일시',fmt(i.occurredAt)],['재해 발생 장소',d.place||'-'],
      ['재해 발생 원인 및 과정',[cause,process].filter(Boolean).join('\n')||'-'],['재해 재발방지 계획',c.planDetail||d.preventionPlan||'-']
    ];
    const w=window.open('','_blank','noopener,noreferrer,width=900,height=900');if(!w)return alert('팝업이 차단되어 PDF 출력창을 열지 못했습니다.');
    const title='사고기록_'+String(i.id||'').replace(/[^a-zA-Z0-9가-힣_-]/g,'_');
    w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4;margin:14mm}body{font-family:"Malgun Gothic",sans-serif;color:#222;font-size:11px}h1{text-align:center;font-size:22px;margin:0 0 16px}.meta{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:7px;margin-bottom:12px}.grid{display:grid;grid-template-columns:145px 1fr;border-top:1px solid #777;border-left:1px solid #777}.grid b,.grid span{padding:8px;border-right:1px solid #777;border-bottom:1px solid #777;white-space:pre-wrap}.grid b{background:#f1f3f5}.foot{margin-top:18px;font-size:9px;color:#555;border-top:1px solid #aaa;padding-top:8px}@media print{button{display:none}}</style></head><body>
      <h1>산업재해 사고기록</h1><div class="meta"><b>이앤엘 사고보고앱 법정 보존용 출력본</b><span>출력 ${esc(fmt(new Date().toISOString()))}</span></div>
      <div class="grid">${rows.map(r=>`<b>${esc(r[0])}</b><span>${esc(r[1])}</span>`).join('')}</div>
      <div class="foot">산업안전보건법 제57조제2항 및 시행규칙 제72조의 산업재해 기록 항목을 중심으로 출력한 자료입니다. 산업재해조사표 제출대상은 별도 법정 서식을 확인해야 합니다.</div>
      <script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  }

  function decorateModal(){
    css();const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
    let i=currentIncidentId?incident(currentIncidentId):null;
    if(!i){const id=modal.querySelector('[data-lifecycle-final]')?.getAttribute('data-lifecycle-final');if(id)i=incident(id)}
    if(!i)return;
    currentIncidentId=i.id;
    if(!modal.querySelector('[data-official439-box]')){
      const wrap=document.createElement('div');wrap.dataset.official439Box='1';wrap.innerHTML=officialBox(i);
      const actions=modal.querySelector('.modal-actions')||modal.lastElementChild;
      if(actions)actions.insertAdjacentElement('beforebegin',wrap);else modal.appendChild(wrap);
    }
    const actions=modal.querySelector('.modal-actions');
    if(actions){
      if(!actions.querySelector('[data-official439-pdf]')){const b=document.createElement('button');b.type='button';b.dataset.official439Pdf='1';b.className='official439-btn';b.textContent='PDF 보고서 출력';b.onclick=()=>printReport(i);actions.appendChild(b)}
    }
  }

  async function officialDelete(i){
    const u=current();if(!isSafety(u))return;
    const reason=prompt('삭제 사유를 입력해 주세요.\n승인·종결 사고 삭제에는 사유 입력이 필요합니다.','오등록 자료 삭제');
    if(reason===null)return;if(String(reason).trim().length<2)return alert('삭제 사유를 2자 이상 입력해 주세요.');
    const stronger=historical(i)?'ERP 기결재 과거사고 이관종결 기록입니다. 삭제 전 자동 백업과 내부 변경기록이 보존됩니다. 계속할까요?':['approved','closed'].includes(String(i.status||''))?'승인 완료된 공식 사고기록입니다. 삭제 전 자동 백업과 내부 변경기록이 보존됩니다. 계속할까요?':'이 사고기록을 삭제할까요?';
    if(!confirm(stronger))return;
    try{
      await api('delete_incident',{incidentId:i.id,reason:String(reason).trim()});
      try{closeModal()}catch(e){}
      await window.enlIncidentPullNow?.();
      renderShell(current()||u);
      alert('삭제 처리했습니다. 삭제 사유와 삭제 전 자동백업이 기록되었습니다.');
    }catch(e){alert(e?.message==='login_refresh_required'||e?.message==='forbidden'?'안전관리자 재로그인이 필요합니다.':'삭제하지 못했습니다. 다시 시도해 주세요.')}
  }

  function injectSearch(){
    const u=current(),root=document.getElementById('view');if(!isSafety(u)||!root||String(currentView||'')!=='incidents')return;
    if(root.querySelector('[data-official439-search]'))return;
    const targets=root.querySelectorAll('[data-inc-id],[data-safety-inc]');if(!targets.length)return;
    const box=document.createElement('div');box.dataset.official439Search='1';box.className='official439-search';
    box.innerHTML='<input type="search" placeholder="사고번호·사업장·신고자·사고유형·내용 검색"><small>현재 사고기록 전체에서 검색</small>';
    const panel=root.querySelector('.panel');if(panel)panel.insertBefore(box,panel.children[1]||panel.firstChild);
    const input=box.querySelector('input');
    input.oninput=()=>{
      const q=String(input.value||'').trim().toLocaleLowerCase('ko-KR');
      root.querySelectorAll('[data-inc-id],[data-safety-inc]').forEach(el=>{
        const id=el.dataset.incId||el.dataset.safetyInc||'',i=incident(id);
        const d=i?.reportDetails||{},hay=[i?.id,site(i?.siteId),i?.reporterName,i?.eventType,i?.summary,d.place,d.workAction,d.incidentHow,d.injuredName,d.damagedItem,i?.occurredAt].join(' ').toLocaleLowerCase('ko-KR');
        el.style.display=!q||hay.includes(q)?'':'none';
      });
    };
  }

  async function openBackup(){
    async function render(){
      let rows=[];try{rows=(await api('backup_list')).backups||[]}catch(e){return alert('백업 목록을 불러오지 못했습니다.')}
      openModal(`<div class="modal-head"><div><div class="ey">OFFICIAL RECORDS</div><h2>사고기록 백업·복원</h2><p>공식 사고기록의 보존·복구 관리</p></div><button class="x" data-close>×</button></div>
        <div class="official439-note">산업재해 발생 원인 등의 기록은 원칙적으로 3년 보존 대상입니다. 복원은 현재 자료를 먼저 자동백업한 뒤 실행되며, 복원 사유와 실행정보는 내부 변경기록으로 보존됩니다.</div>
        <div class="modal-actions"><button type="button" id="official439BackupNow" class="primary">현재 전체 백업 생성</button></div>
        <div class="official439-backups">${rows.map(b=>`<div class="official439-backup"><b>${esc(fmt(b.created_at))}</b><div>${esc(b.reason||'백업')} · ${Number(b.incident_count||0)}건 · ${esc(b.created_by_name||'-')}</div><div class="official439-backup-actions"><button data-official439-export="${esc(b.backup_id)}">JSON 내보내기</button><button data-official439-restore="${esc(b.backup_id)}">이 백업으로 복원</button></div></div>`).join('')||'<div class="empty">백업이 없습니다.</div>'}</div>`);
      document.getElementById('official439BackupNow').onclick=async()=>{const reason=prompt('백업 사유를 입력해 주세요.','정기 수동 백업');if(reason===null)return;try{const r=await api('backup_create',{reason});alert('백업을 생성했습니다. '+r.incidentCount+'건');render()}catch(e){alert('백업 생성에 실패했습니다.')}};
      document.querySelectorAll('[data-official439-export]').forEach(b=>b.onclick=async()=>{try{const r=await api('backup_export',{backupId:b.dataset.official439Export});const blob=new Blob([JSON.stringify(r.backup,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ENL_사고기록백업_'+String(r.backup.created_at||'').slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert('백업 내보내기에 실패했습니다.')}});
      document.querySelectorAll('[data-official439-restore]').forEach(b=>b.onclick=async()=>{const reason=prompt('복원 사유를 입력해 주세요.');if(reason===null||String(reason).trim().length<2)return alert('복원 사유를 2자 이상 입력해 주세요.');if(!confirm('현재 전체 사고기록을 선택한 백업 시점으로 복원합니다.\n현재 상태는 자동백업된 뒤 복원됩니다. 계속할까요?'))return;try{const r=await api('backup_restore',{backupId:b.dataset.official439Restore,reason:String(reason).trim()},60000);await window.enlIncidentPullNow?.();closeModal();renderShell(current());alert('복원 완료: '+r.incidentCount+'건 · 복원 전 자동백업 '+r.preRestoreBackupId)}catch(e){alert('복원에 실패했습니다.')}})
    }
    render();
  }

  function injectBackupButton(){
    const u=current(),menu=document.getElementById('userMenu'),logout=document.getElementById('logoutBtn');if(!isSafety(u)||!menu||!logout||document.getElementById('official439BackupBtn'))return;
    const b=document.createElement('button');b.id='official439BackupBtn';b.type='button';b.textContent='공식기록 · 백업/복원';b.onclick=()=>{menu.classList.add('hide');openBackup()};menu.insertBefore(b,logout);
  }

  function wrapOpen(name){
    const base=window[name];if(typeof base!=='function'||base.__official439Wrapped)return;
    const wrapped=function(id){if(id)currentIncidentId=String(id);const out=base.apply(this,arguments);setTimeout(decorateModal,0);setTimeout(decorateModal,80);return out};
    wrapped.__official439Wrapped=true;window[name]=wrapped;
  }
  wrapOpen('enlOpenIncidentReview');wrapOpen('openIncidentModal');

  document.addEventListener('click',e=>{
    const row=e.target?.closest?.('[data-inc-id],[data-safety-inc]');if(row)currentIncidentId=row.dataset.incId||row.dataset.safetyInc||'';
    const del=e.target?.closest?.('#deleteInc');
    if(del&&isSafety(current())){
      const i=currentIncidentId?incident(currentIncidentId):null;if(!i)return;
      e.preventDefault();e.stopImmediatePropagation();officialDelete(i);
    }
  },true);

  const mo=new MutationObserver(()=>{if(patchQueued)return;patchQueued=true;requestAnimationFrame(()=>{patchQueued=false;injectBackupButton();injectSearch();decorateModal()})});
  mo.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  css();injectBackupButton();injectSearch();decorateModal();

  window.enlOfficialIncidentPrint=printReport;
  window.ENL_OFFICIAL_RECORDS_VERSION=VERSION;
})();