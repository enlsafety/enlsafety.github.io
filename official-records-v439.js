/* E&L Accident Report App v4.3.9 - official approval, audit, PDF, backup UI */
(function(){
  'use strict';
  const VERSION='4.3.9-official-records1';
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
      .official439-box{margin:12px 0;border:1.5px solid #b9cfdf;border-radius:13px;background:#f8fbfd;overflow:hidden}.official439-box h3{margin:0;padding:10px 12px;background:#edf5fa;color:#1d557d;font-size:14px}.official439-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px}.official439-grid>div{padding:9px 10px;border:1px solid #dce8f0;border-radius:9px;background:#fff}.official439-grid b{display:block;font-size:10px;color:#748797;margin-bottom:3px}.official439-grid span{display:block;font-size:12px;color:#284d69;line-height:1.45;word-break:break-word}.official439-hash{font-family:monospace;font-size:10px!important}
      .official439-btn{border:1px solid #a9c5d8!important;background:#f3f9fc!important;color:#1d597f!important}.official439-search{display:flex;gap:7px;align-items:center;margin:0 0 10px}.official439-search input{flex:1;min-width:0;height:42px;border:1px solid #cbdbe6;border-radius:10px;padding:0 12px}.official439-search small{color:#708696;font-size:11px}
      .official439-audit{display:grid;gap:7px;max-height:62vh;overflow:auto}.official439-audit-row{padding:10px;border:1px solid #dce6ed;border-radius:10px;background:#fff}.official439-audit-row b{color:#244f6e}.official439-audit-row span,.official439-audit-row small{display:block;margin-top:3px;color:#6a8090;font-size:11px;line-height:1.45}
      .official439-backups{display:grid;gap:8px;max-height:55vh;overflow:auto}.official439-backup{padding:10px;border:1px solid #d9e5ed;border-radius:10px;background:#fff}.official439-backup-actions{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}.official439-backup-actions button{min-height:34px;border:1px solid #b8cad7;border-radius:8px;background:#fff;padding:0 9px;font-weight:850}
      .official439-note{padding:10px;border-radius:10px;background:#fff8e8;color:#74551e;font-size:11px;line-height:1.55;margin-bottom:10px}
      @media(max-width:560px){.official439-grid{grid-template-columns:1fr}.official439-search{align-items:stretch;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function actionLabel(v){
    const m={create:'등록',update:'수정',approve:'사고보고 승인',reject:'반려',final_approval:'최종 종결승인',post_approval_revision:'승인 후 수정',corrective_submit:'재발방지조치 제출',corrective_reject:'재발방지조치 반려',attachment_add:'첨부 등록',attachment_delete:'첨부 삭제',delete:'삭제',restore:'복원',acknowledge:'경영진 열람확인'};
    return m[v]||v||'기록';
  }
  function officialBox(i){
    const o=i?.officialRecord||{},reporter=o.reporter||{},review=o.review||{},approval=o.approval||{},final=o.finalApproval||{};
    const reporterText=reporter.name?reporter.name+(reporter.position?' · '+reporter.position:''):(i.reporterName||'-');
    const reviewText=review.name?review.name+(review.position?' · '+review.position:''):(i.approvedBy||'-');
    const approvalText=approval.name?approval.name+(approval.position?' · '+approval.position:''):(i.approvedBy||'-');
    const finalText=final.name?final.name+(final.position?' · '+final.position:''):(i.status==='closed'?(i.corrective?.reviewedBy||'-'):'-');
    return `<section class="official439-box"><h3>공식 전자결재 기록</h3><div class="official439-grid">
      <div><b>신고자</b><span>${esc(reporterText)}<br>${esc(fmt(reporter.at||i.createdAt))}</span></div>
      <div><b>검토자</b><span>${esc(reviewText)}<br>${esc(fmt(review.at||i.approvedAt))}</span></div>
      <div><b>승인자</b><span>${esc(approvalText)}<br>${esc(fmt(approval.at||i.approvedAt))}</span></div>
      <div><b>최종 종결승인</b><span>${esc(finalText)}<br>${esc(fmt(final.at||i.closedAt))}</span></div>
      <div><b>사고보고 무결성 해시</b><span class="official439-hash">${esc(o.reportHash||'승인 전/구버전 기록')}</span></div>
      <div><b>최종 기록 해시</b><span class="official439-hash">${esc(o.finalHash||'종결 전/구버전 기록')}</span></div>
    </div></section>`;
  }

  function attachments(i){
    return [...(Array.isArray(i?.photos)?i.photos:[]),...(Array.isArray(i?.corrective?.afterPhotos)?i.corrective.afterPhotos:[])];
  }
  function printReport(i){
    const d=i.reportDetails||{},c=i.corrective||{},o=i.officialRecord||{},files=attachments(i);
    const rows=[
      ['사업장',site(i.siteId)],['사고번호',i.id],['발생일시',fmt(i.occurredAt)],['사고유형',i.eventType||'-'],['신고자',i.reporterName||'-'],
      ['발생장소',d.place||'-'],['작업내용',d.workAction||'-'],['사고경위',d.incidentHow||i.summary||'-'],['사고 직후 조치',i.immediateAction||'-'],
      ['원인 분석',c.rootCause||'-'],['재발방지계획',c.planDetail||d.preventionPlan||'-'],['재발방지조치',c.actionDetail||'-']
    ];
    const approval=[
      ['신고',o.reporter?.name||i.reporterName||'-',o.reporter?.at||i.createdAt],
      ['검토',o.review?.name||i.approvedBy||'-',o.review?.at||i.approvedAt],
      ['승인',o.approval?.name||i.approvedBy||'-',o.approval?.at||i.approvedAt],
      ['종결승인',o.finalApproval?.name||c.reviewedBy||'-',o.finalApproval?.at||i.closedAt]
    ];
    const w=window.open('','_blank','noopener,noreferrer,width=900,height=900');if(!w)return alert('팝업이 차단되어 PDF 출력창을 열지 못했습니다.');
    const title='사고보고서_'+String(i.id||'').replace(/[^a-zA-Z0-9가-힣_-]/g,'_');
    w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4;margin:14mm}body{font-family:"Malgun Gothic",sans-serif;color:#222;font-size:11px}h1{text-align:center;font-size:22px;margin:0 0 16px}.meta{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:7px;margin-bottom:12px}.grid{display:grid;grid-template-columns:120px 1fr;border-top:1px solid #777;border-left:1px solid #777}.grid b,.grid span{padding:7px;border-right:1px solid #777;border-bottom:1px solid #777;white-space:pre-wrap}.grid b{background:#f1f3f5}.approval{width:100%;border-collapse:collapse;margin-top:14px}.approval th,.approval td{border:1px solid #777;padding:7px;text-align:left}.approval th{background:#f1f3f5}.hash{font-family:monospace;font-size:9px;word-break:break-all}.files{margin-top:12px}.files li{margin:3px 0}.foot{margin-top:18px;font-size:9px;color:#555;border-top:1px solid #aaa;padding-top:8px}@media print{button{display:none}}</style></head><body>
      <h1>사고보고서</h1><div class="meta"><b>이앤엘 사고보고앱 전자결재 문서</b><span>출력 ${esc(fmt(new Date().toISOString()))}</span></div>
      <div class="grid">${rows.map(r=>`<b>${esc(r[0])}</b><span>${esc(r[1])}</span>`).join('')}</div>
      <table class="approval"><thead><tr><th>구분</th><th>처리자</th><th>처리일시</th></tr></thead><tbody>${approval.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(fmt(r[2]))}</td></tr>`).join('')}</tbody></table>
      <div class="files"><b>첨부파일</b><ul>${files.map(f=>`<li>${esc(f?.name||f?.fileName||f?.kind||'첨부파일')}</li>`).join('')||'<li>없음</li>'}</ul></div>
      <p class="hash"><b>사고보고 무결성 해시</b><br>${esc(o.reportHash||'-')}<br><b>최종 기록 해시</b><br>${esc(o.finalHash||'-')}</p>
      <div class="foot">본 문서는 이앤엘 사고보고앱에 저장된 전자결재 기록을 출력한 것입니다. 산업재해조사표 등 법정 대외보고가 필요한 경우 해당 법정 절차는 별도로 수행해야 합니다.</div>
      <script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  }

  async function openAudit(i){
    try{
      const r=await api('audit_list',{incidentId:i.id});
      const rows=r.audits||[];
      openModal(`<div class="modal-head"><div><div class="ey">AUDIT LOG</div><h2>사고 변경·결재 감사로그</h2><p>${esc(site(i.siteId))} · ${esc(i.id)}</p></div><button class="x" data-close>×</button></div><div class="official439-audit">${rows.map(a=>{
        const reason=a?.after_payload?.reason||a?.after_payload?.reopenReason||a?.after_payload?.note||'';
        return `<div class="official439-audit-row"><b>${esc(actionLabel(a.action))}</b><span>${esc(a.editor_name||'-')} · ${esc(a.editor_position||a.editor_role||'-')}</span><small>${esc(fmt(a.changed_at))}${reason?' · 사유: '+esc(reason):''}</small></div>`;
      }).join('')||'<div class="empty">감사로그가 없습니다.</div>'}</div>`);
    }catch(e){alert(e?.message==='login_refresh_required'?'안전관리자 계정으로 다시 로그인한 뒤 확인해 주세요.':'감사로그를 불러오지 못했습니다.')}
  }

  function decorateModal(){
    css();const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
    let i=currentIncidentId?incident(currentIncidentId):null;
    if(!i){const id=modal.querySelector('[data-lifecycle-final]')?.getAttribute('data-lifecycle-final');if(id)i=incident(id)}
    if(!i)return;
    currentIncidentId=i.id;
    if(!modal.querySelector('[data-official439-box]')){
      const wrap=document.createElement('div');wrap.dataset.official439Box='1';wrap.innerHTML=officialBox(i);
      const actions=modal.querySelector('.modal-actions')||modal.querySelector('#ackIncident411');
      if(actions)actions.insertAdjacentElement('beforebegin',wrap);else modal.appendChild(wrap);
    }
    const actions=modal.querySelector('.modal-actions');
    if(actions){
      if(!actions.querySelector('[data-official439-pdf]')){const b=document.createElement('button');b.type='button';b.dataset.official439Pdf='1';b.className='official439-btn';b.textContent='PDF 보고서 출력';b.onclick=()=>printReport(i);actions.appendChild(b)}
      if(isSafety(current())&&!actions.querySelector('[data-official439-audit]')){const b=document.createElement('button');b.type='button';b.dataset.official439Audit='1';b.className='official439-btn';b.textContent='감사로그';b.onclick=()=>openAudit(i);actions.appendChild(b)}
    }
  }

  async function officialDelete(i){
    const u=current();if(!isSafety(u))return;
    const reason=prompt('삭제 사유를 입력해 주세요.\n승인·종결 사고도 사유와 감사로그 없이 삭제할 수 없습니다.','오등록 자료 삭제');
    if(reason===null)return;if(String(reason).trim().length<2)return alert('삭제 사유를 2자 이상 입력해 주세요.');
    const stronger=['approved','closed'].includes(String(i.status||''))?'승인 완료된 공식 사고기록입니다. 삭제하면 자동 백업과 감사로그가 남습니다. 계속할까요?':'이 사고기록을 삭제할까요?';
    if(!confirm(stronger))return;
    try{
      await api('delete_incident',{incidentId:i.id,reason:String(reason).trim()});
      try{closeModal()}catch(e){}
      await window.enlIncidentPullNow?.();
      renderShell(current()||u);
      alert('삭제 처리했습니다. 삭제 사유·실행자·시각과 삭제 전 자동백업이 기록되었습니다.');
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
      openModal(`<div class="modal-head"><div><div class="ey">OFFICIAL RECORDS</div><h2>사고기록 백업·복원</h2><p>공식 결재기록의 보존·복구 관리</p></div><button class="x" data-close>×</button></div>
        <div class="official439-note">산업재해 발생 원인 등의 기록은 원칙적으로 3년 보존 대상입니다. 복원은 현재 자료를 먼저 자동백업한 뒤 실행되며, 실행자·사유가 감사로그에 남습니다.</div>
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
  window.enlOfficialAuditOpen=id=>{const i=incident(id);if(i)openAudit(i)};
  window.ENL_OFFICIAL_RECORDS_VERSION=VERSION;
})();