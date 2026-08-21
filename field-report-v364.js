/* E&L Safety v3.6.6 - field report form requirements + mobile-safe occurred time */
(function(){
  function setupOccurredSplit(form){
    const hidden=document.getElementById('occurredAt');
    if(!hidden||hidden.dataset.splitReady==='1')return;
    const label=hidden.closest('.lbl');
    if(!label)return;

    const raw=hidden.value||localDT();
    const dateValue=raw.slice(0,10);
    const timeValue=(raw.slice(11,16)||'00:00');

    hidden.dataset.splitReady='1';
    hidden.type='hidden';
    hidden.required=false;
    label.classList.add('occurred-field');

    const wrap=document.createElement('div');
    wrap.className='occurred-split';
    wrap.innerHTML=`<input id="occurredDate" type="date" value="${esc(dateValue)}" required aria-label="발생 날짜"><input id="occurredTime" type="time" value="${esc(timeValue)}" required aria-label="발생 시간">`;
    hidden.insertAdjacentElement('afterend',wrap);

    const date=wrap.querySelector('#occurredDate');
    const time=wrap.querySelector('#occurredTime');
    const sync=()=>{if(date.value&&time.value)hidden.value=`${date.value}T${time.value}`};
    date.addEventListener('change',sync);
    time.addEventListener('change',sync);
    date.addEventListener('input',sync);
    time.addEventListener('input',sync);
    sync();
  }

  function finalizeReportRequirements(root){
    if(!root)return;
    const form=root.querySelector('#unifiedReportForm');
    if(!form)return;

    setupOccurredSplit(form);

    const category=document.getElementById('category')?.value||'';
    const isHazard=category==='hazard';
    const details=form.querySelector('.advanced-box');

    if(details){
      if(isHazard){
        details.classList.add('hide');
      }else{
        const grid=details.querySelector('.advanced-grid');
        const check=details.querySelector('.check-line');
        if(grid)details.insertAdjacentElement('beforebegin',grid);
        if(check)details.insertAdjacentElement('beforebegin',check);
        details.remove();
      }
    }

    const photoBox=form.querySelector('.photo-box');
    if(photoBox){
      photoBox.classList.add('photo-required');
      const title=photoBox.querySelector('.photo-head b');
      if(title&&!title.textContent.includes('*'))title.textContent='현장사진 *';
      let guide=photoBox.querySelector('.photo-required-guide');
      if(!guide){
        guide=document.createElement('div');
        guide.className='photo-required-guide';
        const actions=photoBox.querySelector('.photo-actions');
        if(actions)actions.insertAdjacentElement('beforebegin',guide);else photoBox.appendChild(guide);
      }
      guide.textContent=isHazard
        ? '필수 입력 · 위험장소와 위험상태를 확인할 수 있는 사진을 1장 이상 등록해 주세요.'
        : '필수 입력 · 사고자, 사고상황, 사고장소를 확인할 수 있는 사진을 1장 이상 등록해 주세요.';
    }
  }

  if(typeof renderUnifiedReport==='function'){
    const baseRenderUnifiedReport=renderUnifiedReport;
    renderUnifiedReport=function(root,u){
      baseRenderUnifiedReport(root,u);
      finalizeReportRequirements(root);
      setTimeout(()=>finalizeReportRequirements(root),0);
    };
  }

  if(typeof submitUnifiedIncident==='function'){
    const baseSubmitUnifiedIncident=submitUnifiedIncident;
    submitUnifiedIncident=async function(e,u){
      const date=document.getElementById('occurredDate');
      const time=document.getElementById('occurredTime');
      const hidden=document.getElementById('occurredAt');
      if(date&&time&&hidden&&date.value&&time.value)hidden.value=`${date.value}T${time.value}`;

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
