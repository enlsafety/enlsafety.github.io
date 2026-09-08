/* E&L Accident Report App v4.2.7 - site manager pre-approval edit compatibility */
(function(){
  'use strict';

  const VERSION='4.2.7-manager-preapproval1';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const roleOf=u=>String(u?.role||'')==='final'?'manager':String(u?.role||'');
  const positionOf=u=>String(u?.position||u?.jobTitle||'').trim();
  const isSiteRole=u=>['field','worker'].includes(roleOf(u));
  const isSiteManager=u=>!!u&&isSiteRole(u)&&MANAGER_POSITIONS.includes(positionOf(u));
  const sameSite=(i,u)=>!!i&&!!u&&String(i.siteId||'')===String(u.siteId||'');
  const reportEditableState=i=>['reported','rejected'].includes(String(i?.status||''));
  const reportApproved=i=>['approved','closed'].includes(String(i?.status||''));
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();

  // Explicitly preserve the rule that same-site managers may edit a report in
  // pre-approval/rejected state regardless of who originally created it.
  const baseCanEditIncident=window.enlCanEditIncident;
  window.enlCanEditIncident=function(i,u=(typeof currentUser==='function'?currentUser():null)){
    if(isSiteManager(u)&&sameSite(i,u)&&reportEditableState(i))return true;
    return typeof baseCanEditIncident==='function'?baseCanEditIncident(i,u):false;
  };

  const baseOpenCorrective=window.openUnifiedCorrectiveModal;
  function managerCanEditSubmittedAction(i,u){
    return !!i&&isSiteManager(u)&&sameSite(i,u)&&reportApproved(i)&&String(i?.corrective?.status||'')==='submitted';
  }

  function patchSubmittedActionModal(i,u){
    const modal=document.querySelector('#modalRoot .modal');
    if(!modal)return;
    const form=modal.querySelector('#unifiedCorrectiveForm');
    const select=modal.querySelector('#uActionStatus');
    if(select)select.value='submitted';

    modal.querySelectorAll('.pill,.p-review,.field411-badge').forEach(el=>{
      const t=String(el.textContent||'').trim();
      if(/조치중|조치\s*중/.test(t))el.textContent='사고조치 검토대기';
    });

    if(form&&!form.querySelector('[data-preapproval-manager-note]')){
      const note=document.createElement('div');
      note.dataset.preapprovalManagerNote='1';
      note.style.cssText='margin:0 0 12px;padding:10px 11px;border:1px solid #b9d2e4;border-radius:10px;background:#eef7fd;color:#315d7b;font-size:12px;line-height:1.55;font-weight:800';
      note.textContent='안전관리자 승인 전 상태의 조치입니다. 현장소장·파트장·서무는 내용을 수정한 뒤 검토대기로 다시 제출할 수 있습니다.';
      form.insertAdjacentElement('afterbegin',note);

      form.addEventListener('submit',()=>{
        const c=i.corrective||(i.corrective={});
        c.reviewHistory=Array.isArray(c.reviewHistory)?c.reviewHistory:[];
        c.reviewHistory.push({action:'site_manager_preapproval_edit',by:u?.name||'',position:positionOf(u),at:now()});
        c.lastFieldEditedBy=u?.name||'';
        c.lastFieldEditedPosition=positionOf(u);
        c.lastFieldEditedAt=now();
      },true);
    }
  }

  // Reuse the existing corrective-action editor without duplicating its save,
  // attachment or validation logic. The temporary status change exists only
  // during synchronous modal rendering and is restored immediately afterward.
  if(typeof baseOpenCorrective==='function'){
    window.openUnifiedCorrectiveModal=function(id,u=(typeof currentUser==='function'?currentUser():null)){
      const i=(data?.incidents||[]).find(x=>String(x.id)===String(id));
      if(!managerCanEditSubmittedAction(i,u))return baseOpenCorrective.call(this,id,u);
      const c=i.corrective;
      const originalStatus=c.status;
      try{
        c.status='in_progress';
        const out=baseOpenCorrective.call(this,id,u);
        c.status=originalStatus;
        patchSubmittedActionModal(i,u);
        return out;
      }catch(e){
        c.status=originalStatus;
        throw e;
      }
    };
  }

  function patchActionButtons(root,u){
    if(!root||!isSiteManager(u))return;
    root.querySelectorAll('[data-field-action],[data-unified-action]').forEach(btn=>{
      const id=btn.dataset.fieldAction||btn.dataset.unifiedAction;
      const i=(data?.incidents||[]).find(x=>String(x.id)===String(id));
      if(managerCanEditSubmittedAction(i,u)){
        btn.textContent='사고조치 수정 · 재제출';
        btn.title='안전관리자 승인 전 상태이므로 수정할 수 있습니다.';
      }
    });
  }

  const baseFieldActions=window.enlRenderFieldActions;
  if(typeof baseFieldActions==='function')window.enlRenderFieldActions=function(root,u){
    const out=baseFieldActions.apply(this,arguments);patchActionButtons(root,u);return out;
  };

  const baseUnifiedActions=window.renderUnifiedActions;
  if(typeof baseUnifiedActions==='function')window.renderUnifiedActions=function(root,u){
    const out=baseUnifiedActions.apply(this,arguments);patchActionButtons(root,u);return out;
  };

  window.ENL_PREAPPROVAL_EDIT_VERSION=VERSION;
})();
