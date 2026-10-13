/* Prior approvals are evidence, never a current approval queue. */
(function(){
 'use strict';const seen=new Set();let queued=false;
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function decorate(){
  queued=false;const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
  const id=modal.dataset.wf440Incident||modal.querySelector('[data-lifecycle-final]')?.dataset.lifecycleFinal;
  const i=(data.incidents||[]).find(x=>String(x.id)===String(id)),u=currentUser?.();if(!i||!u)return;
  const sig=i.id+':'+i.updatedAt;if(modal.dataset.readonlyApproval===sig)return;modal.dataset.readonlyApproval=sig;
  modal.querySelector('[data-prior-approvals]')?.remove();const records=i.acknowledgements||[];
  if(records.length){const box=document.createElement('details');box.dataset.priorApprovals='1';box.innerHTML='<summary>과거 결재기록 · 읽기 전용 ('+records.length+')</summary>'+records.map(a=>'<p>'+e(a.name)+' · '+e(a.label||a.documentType||'기존 기록')+' · '+e(a.ackAt||a.readAt||'')+'</p>').join('');modal.appendChild(box);}
  const key=(u.id||u.personnelId)+':'+i.id;
  if(!seen.has(key)&&window.enlIncidentApi&&['safety','manager','executive','final','field'].includes(u.role)){seen.add(key);window.enlIncidentApi({action:'view',incidentId:i.id,actor:{id:u.id||u.personnelId,role:u.role,siteId:u.siteId||''}}).catch(()=>seen.delete(key));}
 }
 const queue=()=>{if(!queued){queued=true;requestAnimationFrame(decorate)}};new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});window.ENL_PARALLEL_APPROVAL_VERSION='4.6.0-readonly';queue();
})();
