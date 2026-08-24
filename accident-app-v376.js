/* E&L Accident Report App v3.7.6 - mobile field menu + no accident type popup */
(function(){
  const DESCS={
    accident_report:'사고 발생 내용을\n사진과 함께 보고',
    accident_action:'원인·재발방지 조치를\n등록하고 확인',
    records:'우리 현장 사고·조치\n기록 확인',
    inquiry:'안전관리자 정보 확인\n및 문의'
  };
  function patchFieldTiles(){
    const grid=document.querySelector('.field-six-home .field-six-grid');
    if(!grid)return;
    grid.querySelectorAll('[data-field-task]').forEach(btn=>{
      const desc=DESCS[btn.dataset.fieldTask];
      if(!desc)return;
      btn.dataset.mobileDesc=desc;
      const small=btn.querySelector('small');
      if(small)small.dataset.mobileDesc=desc;
    });
  }
  function patchEventTypeButtons(){
    const select=document.getElementById('eventType');
    const grid=document.querySelector('.event-type-buttons');
    if(!select||!grid||grid.dataset.noPopupReady==='1')return;
    grid.dataset.noPopupReady='1';
    [...grid.querySelectorAll('[data-event-value]')].forEach(old=>{
      const btn=old.cloneNode(true);
      old.replaceWith(btn);
      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        select.value=btn.dataset.eventValue||'';
        grid.querySelectorAll('[data-event-value]').forEach(x=>x.classList.toggle('on',x===btn));
        select.dispatchEvent(new Event('input',{bubbles:true}));
      });
    });
  }
  function patchAll(){patchFieldTiles();patchEventTypeButtons()}
  const baseShell=renderShell;
  renderShell=function(u){const r=baseShell(u);setTimeout(patchAll,0);return r};
  const observer=new MutationObserver(()=>patchAll());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(patchAll,0);
})();
