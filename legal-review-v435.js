/* E&L Accident Report App v4.3.5 - simplified statutory report review */
(function(){
  'use strict';

  const VERSION='4.3.5-legal-simplify1';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();
  const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getIncident=id=>(data?.incidents||[]).find(i=>String(i?.id||'')===String(id||''));

  function reviewReasons(category,severity,leaveEstimate){
    if(String(category||'')!=='person')return [];
    const reasons=[];
    if(String(severity||'')==='major')reasons.push('중대 부상 가능성');
    if(String(leaveEstimate||'')==='3plus')reasons.push('휴업 3일 이상 예상');
    if(String(leaveEstimate||'')==='longterm')reasons.push('장기치료·중상 가능');
    return [...new Set(reasons)];
  }

  function signatureOf(i){
    return [String(i?.category||''),String(i?.severity||''),String(i?.leaveEstimate||'')].join('|');
  }

  function normalizeIncident(i){
    if(!i||typeof i!=='object')return false;
    const reasons=reviewReasons(i.category,i.severity,i.leaveEstimate);
    const required=reasons.length>0;
    const signature=signatureOf(i);
    const oldSignature=String(i.legalReviewSignature||'');
    let changed=false;
    const set=(key,value)=>{
      const before=JSON.stringify(i[key]??null),after=JSON.stringify(value??null);
      if(before!==after){i[key]=value;changed=true}
    };

    set('legalReview',required);
    set('legalReviewReasons',reasons);
    set('legalReviewSignature',signature);

    if(!required){
      set('legalReviewStatus','not_required');
      set('legalReviewedBy','');
      set('legalReviewedAt',null);
      return changed;
    }

    const current=String(i.legalReviewStatus||'');
    const relevantChanged=!!oldSignature&&oldSignature!==signature;
    if(relevantChanged||!['pending','reviewed'].includes(current)){
      set('legalReviewStatus','pending');
      set('legalReviewedBy','');
      set('legalReviewedAt',null);
    }
    return changed;
  }

  function normalizeAll(){
    let changed=false;
    for(const i of data?.incidents||[])if(normalizeIncident(i))changed=true;
    return changed;
  }

  function isReviewRequired(i){return reviewReasons(i?.category,i?.severity,i?.leaveEstimate).length>0}
  function isReviewed(i){return isReviewRequired(i)&&String(i?.legalReviewStatus||'')==='reviewed'}

  // Keep one simple automatic flag. It is a screening aid, not a final legal determination.
  window.computeLegalReview=(category,severity,leaveEstimate)=>reviewReasons(category,severity,leaveEstimate).length>0;
  window.enlLegalReviewReasons=reviewReasons;
  window.legalBadge=function(i){
    if(!isReviewRequired(i)||isReviewed(i))return '';
    return typeof badge==='function'?badge('p-review','법정 보고 검토 필요'):'<span class="pill p-review">법정 보고 검토 필요</span>';
  };

  // Ensure new reports and edits persist the same legal-review metadata without adding another user input.
  const baseSave=typeof saveData==='function'?saveData:null;
  if(baseSave){
    saveData=function(){normalizeAll();return baseSave()};
  }
  normalizeAll();

  function ensureCss(){
    if(document.getElementById('legal435Css'))return;
    const s=document.createElement('style');
    s.id='legal435Css';
    s.textContent=`
      .legal435-box{margin-top:12px;border:1.5px solid #e7c77e;border-radius:12px;background:#fffaf0;overflow:hidden}
      .legal435-box.done{border-color:#b9d8c5;background:#f5fbf7}
      .legal435-box>h3{margin:0;padding:10px 12px;background:#fff3d8;color:#77531b;font-size:14px}
      .legal435-box.done>h3{background:#eaf6ee;color:#2f6746}
      .legal435-body{padding:11px 12px;display:grid;gap:8px}
      .legal435-row{display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;line-height:1.5}
      .legal435-row b{font-size:12px;color:#66798a}.legal435-row span{font-size:13px;color:#2a4358;white-space:pre-wrap}
      .legal435-note{font-size:11px;line-height:1.55;color:#7b6a48}
      .legal435-box.done .legal435-note{color:#5f7767}
      .legal435-btn{min-height:42px;border:0;border-radius:9px;background:#2f6f9d;color:#fff;padding:0 14px;font-weight:900;cursor:pointer;justify-self:start}
      .legal435-readonly{margin-top:12px;padding:11px 12px;border:1px solid #dbe5ed;border-radius:11px;background:#f8fbfd;color:#314d65;font-size:13px;line-height:1.55}
      .legal435-readonly b{display:block;margin-bottom:4px;color:#587086;font-size:12px}
      @media(max-width:560px){.legal435-row{grid-template-columns:1fr;gap:3px}.legal435-btn{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function markReviewed(i,viewer,{persist=false}={}){
    if(!i||!isReviewRequired(i))return;
    normalizeIncident(i);
    i.legalReviewStatus='reviewed';
    i.legalReviewedBy=viewer?.name||'안전관리자';
    i.legalReviewedAt=now();
    if(persist){
      i.updatedAt=now();
      saveData();
    }
  }

  function legalSectionHtml(i,safety){
    const reasons=reviewReasons(i?.category,i?.severity,i?.leaveEstimate);
    if(!reasons.length)return '';
    const reviewed=isReviewed(i);
    const reviewer=i?.legalReviewedBy||'안전관리자';
    const reviewedAt=i?.legalReviewedAt&&typeof fmt==='function'?fmt(i.legalReviewedAt):(i?.legalReviewedAt||'-');
    const canComplete=safety&&!reviewed&&['approved','closed'].includes(String(i?.status||''));
    return `<section class="legal435-box ${reviewed?'done':''}" data-legal435>
      <h3>${reviewed?'법정 보고 검토 완료':'법정 보고 검토 필요'}</h3>
      <div class="legal435-body">
        <div class="legal435-row"><b>자동 감지 사유</b><span>${safe(reasons.join(' · '))}</span></div>
        ${reviewed?`<div class="legal435-row"><b>검토 기록</b><span>${safe(reviewer)} · ${safe(reviewedAt)}</span></div>`:''}
        <div class="legal435-note">자동 표시는 법정 보고 대상을 확정하는 판정이 아닙니다. 실제 휴업 필요성 등 사실관계를 안전관리자가 확인해 최종 판단합니다.${!reviewed&&String(i?.status||'')==='reported'?' 사고 승인 시 검토 완료로 기록됩니다.':''}</div>
        ${canComplete?'<button type="button" class="legal435-btn" data-legal435-complete>법정 보고 검토 완료</button>':''}
      </div>
    </section>`;
  }

  function patchReadonlyNote(modal,i){
    const note=modal.querySelector('#safetyNoteEdit');
    if(!note||!['approved','closed'].includes(String(i?.status||'')))return;
    const label=note.closest('label');if(!label)return;
    const value=String(i?.safetyNote||i?.rejectionNote||'').trim();
    if(!value){label.remove();return}
    const box=document.createElement('div');box.className='legal435-readonly';box.innerHTML=`<b>안전관리자 검토의견</b>${safe(value)}`;
    label.replaceWith(box);
  }

  function patchReviewModal(id,viewer){
    ensureCss();
    const i=getIncident(id),modal=document.querySelector('#modalRoot .modal');
    if(!i||!modal)return;
    const safety=roleNorm(viewer?.role||currentUser?.()?.role)==='safety';

    // Management grade remains visible as the incident grade, but duplicate review-time editing/saving is removed.
    modal.querySelector('.inc411-priority-box')?.remove();
    modal.querySelector('#saveNote')?.remove();
    patchReadonlyNote(modal,i);

    modal.querySelector('[data-legal435]')?.remove();
    const actions=modal.querySelector('.modal-actions');
    const html=legalSectionHtml(i,safety);
    if(html){
      if(actions)actions.insertAdjacentHTML('beforebegin',html);
      else modal.insertAdjacentHTML('beforeend',html);
    }

    // For a new/pending report, the existing safety approval is the legal-review acknowledgement too.
    const approve=modal.querySelector('#approveInc');
    if(approve&&safety&&isReviewRequired(i)&&!approve.dataset.legal435Bound){
      approve.dataset.legal435Bound='1';
      approve.addEventListener('click',()=>markReviewed(i,viewer,{persist:false}),true);
    }

    // Legacy records that were already approved before this feature can be acknowledged once without reopening the report.
    const complete=modal.querySelector('[data-legal435-complete]');
    if(complete&&safety){
      complete.addEventListener('click',()=>{
        markReviewed(i,viewer,{persist:true});
        if(typeof closeModal==='function')closeModal();
        if(typeof renderShell==='function')renderShell(currentUser?.()||viewer);
        if(typeof alert==='function')alert('법정 보고 검토 완료로 기록했습니다.');
      });
    }
  }

  function rewriteLegacyLabels(root=document){
    root.querySelectorAll?.('.p-review').forEach(el=>{
      if(String(el.textContent||'').trim()==='법적 검토 필요')el.textContent='법정 보고 검토 필요';
    });
  }

  function wrapOpen(name){
    const base=window[name];if(typeof base!=='function'||base.__legal435Wrapped)return;
    const wrapped=function(id,...args){
      const viewer=args[1]||currentUser?.();
      const r=base.call(this,id,...args);
      patchReviewModal(id,viewer);
      rewriteLegacyLabels(document);
      return r;
    };
    wrapped.__legal435Wrapped=true;
    window[name]=wrapped;
  }
  wrapOpen('openIncidentModal');
  wrapOpen('enlOpenIncidentReview');

  const baseShell=window.renderShell;
  if(typeof baseShell==='function')window.renderShell=function(u){const r=baseShell.call(this,u);rewriteLegacyLabels(document);return r};
  const baseRender=window.render;
  if(typeof baseRender==='function')window.render=function(){const r=baseRender.apply(this,arguments);rewriteLegacyLabels(document);return r};

  ensureCss();
  rewriteLegacyLabels(document);
  window.ENL_LEGAL_REVIEW_VERSION=VERSION;
})();
