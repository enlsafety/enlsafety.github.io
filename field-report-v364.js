/* E&L Safety v3.6.4 - field report form requirements */
(function(){
  function showAdvancedFieldsOpen(root){
    if(!root)return;
    const form=root.querySelector('#unifiedReportForm');
    if(!form)return;
    const details=form.querySelector('.advanced-box');
    if(details){
      const grid=details.querySelector('.advanced-grid');
      const check=details.querySelector('.check-line');
      if(grid)details.insertAdjacentElement('beforebegin',grid);
      if(check)details.insertAdjacentElement('beforebegin',check);
      details.remove();
    }

    const photoBox=form.querySelector('.photo-box');
    if(photoBox){
      photoBox.classList.add('photo-required');
      const title=photoBox.querySelector('.photo-head b');
      if(title&&!title.textContent.includes('*'))title.textContent='현장사진 *';
      if(!photoBox.querySelector('.photo-required-guide')){
        const guide=document.createElement('div');
        guide.className='photo-required-guide';
        guide.textContent='필수 입력 · 사고자, 사고상황, 사고장소를 확인할 수 있는 사진을 1장 이상 등록해 주세요.';
        const actions=photoBox.querySelector('.photo-actions');
        if(actions)actions.insertAdjacentElement('beforebegin',guide);else photoBox.appendChild(guide);
      }
    }
  }

  if(typeof renderUnifiedReport==='function'){
    const baseRenderUnifiedReport=renderUnifiedReport;
    renderUnifiedReport=function(root,u){
      baseRenderUnifiedReport(root,u);
      showAdvancedFieldsOpen(root);
    };
  }

  if(typeof submitUnifiedIncident==='function'){
    const baseSubmitUnifiedIncident=submitUnifiedIncident;
    submitUnifiedIncident=async function(e,u){
      if(!Array.isArray(incidentPhotos)||incidentPhotos.length<1){
        e.preventDefault();
        const box=document.querySelector('#unifiedReportForm .photo-box');
        if(box){
          box.classList.add('photo-required-error');
          box.scrollIntoView({behavior:'smooth',block:'center'});
          setTimeout(()=>box.classList.remove('photo-required-error'),1800);
        }
        alert('현장사진은 필수입니다. 사진을 1장 이상 등록해 주세요.');
        return;
      }
      return baseSubmitUnifiedIncident(e,u);
    };
  }
})();
