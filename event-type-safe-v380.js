/* E&L Accident Report App v3.8.0 - accident type buttons without popup/change side effects */
(function(){
  function patch(){
    const select=document.getElementById('eventType');
    const grid=document.querySelector('.event-type-buttons');
    if(!select||!grid||grid.dataset.safeCapture==='1')return;
    grid.dataset.safeCapture='1';
    grid.addEventListener('click',e=>{
      const btn=e.target.closest('[data-event-value]');
      if(!btn||!grid.contains(btn))return;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
      select.value=btn.dataset.eventValue||'';
      grid.querySelectorAll('[data-event-value]').forEach(x=>x.classList.toggle('on',x===btn));
      select.dispatchEvent(new Event('input',{bubbles:true}));
    },true);
  }
  if(typeof renderUnifiedReport==='function'){
    const base=renderUnifiedReport;
    renderUnifiedReport=function(root,u){const r=base(root,u);setTimeout(patch,0);return r};
  }
  setTimeout(patch,0);
})();
