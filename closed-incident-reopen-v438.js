/* E&L Accident Report App v4.3.8 - closed incident edit/reopen controls */
(function(){
  'use strict';
  const VERSION='4.3.8-closed-reopen1';
  let currentIncidentId='';

  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const current=()=>{try{return window.currentUser?.()||null}catch(e){return null}};
  const incident=id=>(data?.incidents||[]).find(x=>String(x.id)===String(id));
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();
  const isSafety=u=>roleNorm(u?.role)==='safety';

  function remember(id){
    if(id)currentIncidentId=String(id);
    return currentIncidentId;
  }

  function inferIncident(){
    const final=document.querySelector('#modalRoot [data-lifecycle-final]');
    const id=final?.getAttribute('data-lifecycle-final')||currentIncidentId;
    return id?incident(id):null;
  }

  function css(){
    if(document.getElementById('enl438Css'))return;
    const s=document.createElement('style');s.id='enl438Css';s.textContent=`
      .enl438-reopen{background:#fff8e7!important;color:#805719!important;border:1px solid #dfbf7d!important}
      .enl438-note{margin:10px 0 0;padding:10px 11px;border:1px solid #ead6ab;border-radius:10px;background:#fffaf0;color:#70531f;font-size:12px;line-height:1.55}
    `;document.head.appendChild(s);
  }

  async function syncNow(){
    try{if(typeof window.enlIncidentSyncNow==='function')await window.enlIncidentSyncNow()}catch(e){console.warn('[closed-reopen] sync deferred',e)}
  }

  async function reopenToApproved(i,u){
    if(!i||!isSafety(u)||String(i.status)!=='closed')return;
    const ok=confirm('이 종결 사고를 “사고보고 승인” 단계로 되돌릴까요?\n\n재발방지계획·현장 조치내용·조치 증빙(종결사진/PDF)·조치 승인정보는 제거됩니다.\n사고보고 내용과 기존 사고보고 승인자/승인시간은 유지됩니다.');
    if(!ok)return;
    const reason=prompt('되돌리기 사유를 입력해 주세요.','재발방지조치·종결자료 오입력 정정');
    if(reason===null)return;
    const ts=now(),previousClosedAt=i.closedAt||null,previousCorrectiveStatus=String(i.corrective?.status||'');
    i.lifecycleHistory=Array.isArray(i.lifecycleHistory)?i.lifecycleHistory:[];
    i.lifecycleHistory.push({
      action:'closed_rollback_to_report_approved',
      by:u.name||'안전관리자',
      byId:u.id||u.personnelId||'',
      at:ts,
      note:String(reason||'종결 취소'),
      previousClosedAt,
      previousCorrectiveStatus
    });
    i.status='approved';
    i.closedAt=null;
    i.corrective=null;
    i.updatedAt=ts;
    i.reopenedBy=u.name||'안전관리자';
    i.reopenedAt=ts;
    i.reopenReason=String(reason||'종결 취소');
    try{actionPhotos=[]}catch(e){}
    saveData();
    try{closeModal()}catch(e){}
    try{renderShell(u)}catch(e){}
    await syncNow();
    alert('종결을 취소하고 사고보고 승인 단계로 되돌렸습니다.\n재발방지계획부터 다시 진행할 수 있습니다.');
  }

  function decorate(){
    css();
    const u=current();if(!isSafety(u))return;
    const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
    const i=inferIncident();if(!i)return;
    if(String(i.status)==='closed'){
      const actions=modal.querySelector('.modal-actions');
      if(actions&&!actions.querySelector('[data-enl438-reopen]')){
        const b=document.createElement('button');
        b.type='button';b.dataset.enl438Reopen='1';b.className='btn-gray enl438-reopen';
        b.textContent='종결 취소 · 사고승인 단계로';
        b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();reopenToApproved(i,u)};
        const edit=actions.querySelector('#editInc');actions.insertBefore(b,edit||actions.firstChild);
        if(!modal.querySelector('[data-enl438-note]')){
          const n=document.createElement('div');n.dataset.enl438Note='1';n.className='enl438-note';
          n.textContent='재발방지조치나 종결 증빙을 잘못 입력한 경우, 사고보고 승인정보는 유지한 채 후속조치만 초기화할 수 있습니다.';
          actions.insertAdjacentElement('beforebegin',n);
        }
      }
    }
  }

  function wrapOpen(name){
    const base=window[name];if(typeof base!=='function'||base.__enl438Wrapped)return;
    const wrapped=function(id){
      remember(id);const out=base.apply(this,arguments);
      setTimeout(decorate,0);setTimeout(decorate,80);
      return out;
    };
    wrapped.__enl438Wrapped=true;window[name]=wrapped;
  }

  wrapOpen('enlOpenIncidentReview');
  wrapOpen('openIncidentModal');

  document.addEventListener('click',e=>{
    const edit=e.target?.closest?.('#editInc');
    if(edit){
      const u=current();if(!isSafety(u))return;
      const i=inferIncident();if(!i)return;
      e.preventDefault();e.stopImmediatePropagation();
      try{closeModal()}catch(_){}
      setTimeout(()=>{
        if(typeof window.enlEditIncidentInReportForm==='function')window.enlEditIncidentInReportForm(i,u);
        else alert('사고정보 수정 화면을 불러오지 못했습니다.');
      },0);
      return;
    }
    const reopen=e.target?.closest?.('[data-enl438-reopen]');
    if(reopen){e.preventDefault();e.stopPropagation();}
  },true);

  const mo=new MutationObserver(()=>{if(document.querySelector('#modalRoot .modal'))decorate()});
  mo.observe(document.getElementById('modalRoot')||document.body,{childList:true,subtree:true});

  window.enlReopenClosedIncidentToApproved=(id,u=current())=>reopenToApproved(incident(id),u);
  window.ENL_CLOSED_INCIDENT_REOPEN_VERSION=VERSION;
})();