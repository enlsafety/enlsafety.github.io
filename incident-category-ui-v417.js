/* E&L Accident Report App v4.1.7 - incident category badges on summary cards */
(function(){
  'use strict';
  const VERSION='4.1.7-category1';

  function findIncident(id){
    return (data?.incidents||[]).find(i=>String(i?.id||'')===String(id||''));
  }
  function validCategory(i){
    return !!i&&['person','property'].includes(String(i.category||''));
  }
  function addCategoryBadge(target,i){
    if(!target||!validCategory(i)||target.querySelector('.p-person,.p-property'))return;
    if(typeof categoryBadge!=='function')return;
    target.insertAdjacentHTML('afterbegin',categoryBadge(i.category));
  }
  function syncCategoryBadges(root=document){
    root.querySelectorAll?.('[data-safety-inc]').forEach(card=>{
      addCategoryBadge(card.querySelector('.shell411-recent-status'),findIncident(card.dataset.safetyInc));
    });
    root.querySelectorAll?.('[data-lifecycle-open]').forEach(card=>{
      addCategoryBadge(card.firstElementChild,findIncident(card.dataset.lifecycleOpen));
    });
    root.querySelectorAll?.('[data-reader-open]').forEach(card=>{
      addCategoryBadge(card.querySelector('.reader414-state'),findIncident(card.dataset.readerOpen));
    });
    root.querySelectorAll?.('[data-inc-id]').forEach(card=>{
      addCategoryBadge(card.querySelector('.inc411-card-tags'),findIncident(card.dataset.incId));
    });
    root.querySelectorAll?.('[data-unified-action]').forEach(btn=>{
      const card=btn.closest('article');
      addCategoryBadge(card?.firstElementChild,findIncident(btn.dataset.unifiedAction));
    });
    root.querySelectorAll?.('[data-field-action]').forEach(btn=>{
      const card=btn.closest('article');
      addCategoryBadge(card?.firstElementChild,findIncident(btn.dataset.fieldAction));
    });
  }

  let queued=false;
  function queueSync(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;syncCategoryBadges(document)});
  }
  const observer=new MutationObserver(queueSync);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  syncCategoryBadges(document);
  setTimeout(()=>syncCategoryBadges(document),50);
  window.enlSyncIncidentCategoryBadges=syncCategoryBadges;
  window.ENL_INCIDENT_CATEGORY_UI_VERSION=VERSION;
})();
