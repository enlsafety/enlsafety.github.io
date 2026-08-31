/* E&L Accident Report App v4.1.1 - approved worker public incident records */
(function(){
  'use strict';
  const VERSION='4.1.1';

  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
  const worker=()=>{try{const u=currentUser?.();return u?.role==='worker'?u:null}catch(e){return null}};
  const siteName=u=>{try{return siteById?.(u?.siteId)?.name||u?.siteName||u?.site_name||'소속 사업장'}catch(e){return u?.siteName||u?.site_name||'소속 사업장'}};
  const mine=(i,u)=>!!i&&!!u&&((clean(i.reporterId)&&clean(i.reporterId)===clean(u.id||u.personnelId||u.username))||(clean(i.reporterName)&&clean(i.reporterName)===clean(u.name)));
  const categoryLabel=v=>v==='person'?'인사사고':v==='property'?'대물사고':v==='near_miss'?'아차사고':'안전사고';

  function redact(v,names=[]){
    let s=clean(v);names.forEach(n0=>{const n=clean(n0);if(n&&n.length>=2)s=s.split(n).join('근로자')});
    s=s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 비공개]')
      .replace(/(?:01[016789]|02|0[3-6][1-5])-?\d{3,4}-?\d{4}/g,'[연락처 비공개]')
      .replace(/\b\d{6}-?[1-4]\d{6}\b/g,'[개인정보 비공개]')
      .replace(/[가-힣A-Za-z0-9·\- ]{1,24}(?:병원|의원|정형외과|한의원)/g,'의료기관');
    return s;
  }
  function localPublic(i){
    if(i?.workerPublic||i?.publicSummary)return i.workerPublic||i.publicSummary;
    const d=i?.reportDetails||{},c=i?.corrective||{};
    const names=[i?.injuredName,i?.reporterName,i?.approvedBy,c?.ownerName,c?.submittedBy,c?.reviewedBy];
    const place=redact(d.place||i?.place||'',names),work=redact(d.workAction||'',names),how=redact(d.incidentHow||'',names),type=redact(i?.eventType||'사고',names);
    let overview=[place?`${place}에서`:'',work?`${work} 중`:'',how].filter(Boolean).join(' ');
    if(!overview)overview=`${type} 관련 사고가 발생하여 안전관리자가 검토·승인하였습니다.`;
    return {occurredDate:clean(i?.occurredAt).slice(0,10),eventType:type||'안전사고',category:clean(i?.category),place,overview,cause:redact(c.rootCause||'',names)||'사고 원인과 관련 위험요인을 확인하여 관리하고 있습니다.',preventiveAction:redact(c.actionDetail||'',names)||'동일·유사 사고 예방을 위한 안전조치를 실시합니다.',actionStatus:c.status==='approved'?'개선조치 완료':c.status==='submitted'||c.status==='in_progress'?'개선조치 진행 중':'개선조치 관리 중',approvedAt:clean(i?.approvedAt),publishedAt:clean(i?.updatedAt||i?.approvedAt)};
  }

  function css(){
    if(document.getElementById('workerPublic411Css'))return;
    const s=document.createElement('style');s.id='workerPublic411Css';s.textContent=`
      .worker-public-head{margin-bottom:14px}.worker-public-head h2{margin:0 0 6px;font-size:22px;color:#173b66}.worker-public-head p{margin:0;color:#65798c;font-size:13px;line-height:1.55}.worker-public-info{margin:0 0 12px;padding:11px 12px;border:1px solid #bdd9eb;border-radius:12px;background:#eef8ff;color:#285e83;font-size:12px;font-weight:800;line-height:1.55}
      .worker-public-list{display:grid;gap:12px}.worker-public-card{border:1px solid #d7e2eb;border-radius:16px;background:#fff;padding:15px;box-shadow:0 4px 14px rgba(23,59,102,.06)}.worker-public-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}.worker-public-top h3{margin:3px 0 0;color:#183e5b;font-size:17px;line-height:1.35}.worker-public-date{font-size:12px;color:#6c7f8f;font-weight:850}.worker-public-type{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:#edf5fb;color:#285f86;font-size:11px;font-weight:950;white-space:nowrap}.worker-public-grid{display:grid;gap:9px}.worker-public-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:9px;padding-top:9px;border-top:1px solid #edf1f4}.worker-public-row:first-child{padding-top:0;border-top:0}.worker-public-row b{font-size:12px;color:#516779}.worker-public-row span{font-size:13px;line-height:1.55;color:#263b4b;word-break:keep-all}.worker-public-status{margin-top:11px;display:inline-flex;align-items:center;min-height:29px;padding:0 10px;border-radius:9px;background:#eaf7ef;color:#28704a;font-size:11px;font-weight:950}.worker-public-empty{padding:28px 14px;text-align:center;border:1px dashed #cbd9e4;border-radius:14px;background:#fbfdff;color:#758797;font-size:13px;line-height:1.6}
      .worker-public-preview{margin:13px 0;padding:13px;border:1px solid #b9d8ea;border-radius:13px;background:#f3faff}.worker-public-preview h3{margin:0 0 5px;color:#174d78;font-size:15px}.worker-public-preview>p{margin:0 0 10px;color:#60788a;font-size:11px;line-height:1.5}.worker-public-preview-grid{display:grid;gap:7px}.worker-public-preview-grid div{font-size:12px;line-height:1.5;color:#314b5e}.worker-public-preview-grid b{display:inline-block;min-width:78px;color:#174d78}.worker-public-approve-note{margin:10px 0;padding:10px 11px;border:1px solid #c9dfed;border-radius:10px;background:#eef8ff;color:#2b648a;font-size:11px;font-weight:800;line-height:1.5}
      @media(max-width:560px){.worker-public-card{padding:13px}.worker-public-top h3{font-size:16px}.worker-public-row{grid-template-columns:78px minmax(0,1fr);gap:7px}.worker-public-row span{font-size:13px}.worker-public-head h2{font-size:20px}}
    `;document.head.appendChild(s);
  }

  function renderWorkerRecords(root,u){
    css();if(!root)return;
    const arr=(data.incidents||[]).filter(i=>i.siteId===u.siteId&&['approved','closed'].includes(i.status)&&!!i.approvedAt).sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
    root.innerHTML=`<div class="field-task-back"><button type="button" id="workerRecordsBack411">← 홈으로</button><span>${ex(siteName(u))}</span></div>
      <section class="panel">
        <div class="worker-public-head"><h2>우리 현장 사고기록</h2><p>안전관리자가 검토·승인한 사고사례와 재발방지 조치만 확인할 수 있습니다.</p></div>
        <div class="worker-public-info">개인 이름, 연락처, 치료·진단정보, 병원정보, 사고 원본사진 등 개인정보는 근로자 화면에 표시하지 않습니다.</div>
        <div class="worker-public-list">${arr.length?arr.map(i=>{const p=localPublic(i);return `<article class="worker-public-card"><div class="worker-public-top"><div><div class="worker-public-date">${ex(p.occurredDate||clean(i.occurredAt).slice(0,10)||'-')}</div><h3>${ex(p.eventType||i.eventType||'안전사고')}</h3></div><span class="worker-public-type">${ex(categoryLabel(p.category||i.category))}</span></div><div class="worker-public-grid">${p.place?`<div class="worker-public-row"><b>발생 장소</b><span>${ex(p.place)}</span></div>`:''}<div class="worker-public-row"><b>사고 개요</b><span>${ex(p.overview||'-')}</span></div><div class="worker-public-row"><b>주요 원인</b><span>${ex(p.cause||'-')}</span></div><div class="worker-public-row"><b>재발방지</b><span>${ex(p.preventiveAction||'-')}</span></div></div><span class="worker-public-status">✓ ${ex(p.actionStatus||'개선조치 관리 중')}</span></article>`}).join(''):'<div class="worker-public-empty">현재 공개된 사고기록이 없습니다.<br>안전관리자 검토·승인이 완료된 사고만 이곳에 표시됩니다.</div>'}</div>
      </section>`;
    const back=document.getElementById('workerRecordsBack411');if(back)back.onclick=()=>{if(typeof window.enlFieldHome==='function')window.enlFieldHome(u);else document.querySelector('.topbar .brand')?.click()};
  }

  function patchWorkerMenu(){
    const u=worker();if(!u)return;
    const b=document.querySelector('[data-field-task="records"]');if(!b)return;
    const strong=b.querySelector('strong'),small=b.querySelector('small');if(strong)strong.textContent='우리 현장 사고기록';if(small)small.innerHTML='승인된 사고사례와<br>재발방지 조치 확인';
  }

  function previewHtml(i){
    const p=localPublic(i);return `<section class="worker-public-preview"><h3>근로자 공개용 요약</h3><p>해당 사업장 근로자에게는 아래 내용만 공개됩니다. 개인정보·치료정보·원본사진은 공개되지 않습니다.</p><div class="worker-public-preview-grid">${p.place?`<div><b>발생 장소</b>${ex(p.place)}</div>`:''}<div><b>사고 개요</b>${ex(p.overview||'-')}</div><div><b>주요 원인</b>${ex(p.cause||'-')}</div><div><b>재발방지</b>${ex(p.preventiveAction||'-')}</div><div><b>조치상태</b>${ex(p.actionStatus||'-')}</div></div></section>`}
  function patchSafetyModal(id){
    const u=currentUser?.();if(!u||u.role!=='safety')return;
    const i=(data.incidents||[]).find(x=>x.id===id);if(!i)return;
    const modal=document.querySelector('.modal');if(!modal)return;
    const approve=document.getElementById('approveInc');
    if(approve){approve.textContent='사고 승인 · 근로자 공개';const actions=approve.closest('.modal-actions');if(actions&&!modal.querySelector('.worker-public-approve-note'))actions.insertAdjacentHTML('beforebegin','<div class="worker-public-approve-note">승인하면 개인정보를 제외한 사고 개요·원인·재발방지 조치가 자동 요약되어 해당 사업장 근로자의 「우리 현장 사고기록」에 공개됩니다.</div>')}
    if(['approved','closed'].includes(i.status)&&i.approvedAt&&!modal.querySelector('.worker-public-preview')){const detail=modal.querySelector('.detail');if(detail)detail.insertAdjacentHTML('afterend',previewHtml(i))}
  }

  css();
  if(typeof renderUnifiedIncidents==='function'){
    const base=renderUnifiedIncidents;
    renderUnifiedIncidents=function(root,u){const w=worker();if(w)return renderWorkerRecords(root,w);return base(root,u)};
  }
  if(typeof renderUnifiedActions==='function'){
    const base=renderUnifiedActions;
    renderUnifiedActions=function(root,u){
      const w=worker();if(!w)return base(root,u);
      let original=null;try{original=typeof actionAccessibleIncidents==='function'?actionAccessibleIncidents:null}catch(e){}
      if(original)actionAccessibleIncidents=x=>original(x).filter(i=>!i.workerPublicOnly&&mine(i,w));
      try{return base(root,u)}finally{if(original)actionAccessibleIncidents=original}
    };
  }
  if(typeof openIncidentModal==='function'){
    const base=openIncidentModal;
    openIncidentModal=function(id,admin,u){const r=base(id,admin,u);setTimeout(()=>patchSafetyModal(id),0);return r};
  }
  if(typeof renderShell==='function'){
    const base=renderShell;
    renderShell=function(u){const r=base(u);setTimeout(patchWorkerMenu,40);return r};
  }
  setTimeout(patchWorkerMenu,160);
  window.ENL_WORKER_PUBLIC_VERSION=VERSION;
})();