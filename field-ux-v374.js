/* E&L Safety v3.7.4 - stable field UX refinements */
(function(){
  const MIN_PHOTOS=3;

  function safetyManagers(){
    try{return (data.users||[]).filter(x=>x&&x.role==='safety'&&x.active!==false)}catch(e){return []}
  }
  function contactText(u){
    const phone=u?.phone||u?.mobile||u?.tel||u?.contact||'';
    const email=u?.email||'';
    return [phone,email].filter(Boolean).join(' · ');
  }

  function patchFieldHome(){
    const home=document.querySelector('.field-six-home .field-six-grid');
    if(!home)return;
    const wanted=['accident_report','accident_action','records','inquiry'];
    const labels={
      accident_report:['01','사고 보고','인사사고, 대물사고, 아차사고를 보고합니다.'],
      accident_action:['02','사고 대책조치','사고 발생 후 원인과 재발방지 조치를 등록합니다.'],
      records:['03','우리 현장 기록','우리 현장의 사고와 조치 기록을 확인합니다.'],
      inquiry:['04','기타 문의','안전관리자 정보 확인 및 안전 관련 문의를 남깁니다.']
    };
    [...home.querySelectorAll('[data-field-task]')].forEach(btn=>{
      if(!wanted.includes(btn.dataset.fieldTask))btn.remove();
    });
    const current=[...home.querySelectorAll('[data-field-task]')].map(x=>x.dataset.fieldTask);
    if(current.join('|')!==wanted.join('|')){
      wanted.forEach(key=>{const btn=home.querySelector(`[data-field-task="${key}"]`);if(btn)home.appendChild(btn)});
    }
    wanted.forEach(key=>{
      const btn=home.querySelector(`[data-field-task="${key}"]`);if(!btn)return;
      const [no,title,desc]=labels[key];
      const n=btn.querySelector('.field-six-no'),strong=btn.querySelector('strong'),small=btn.querySelector('small');
      if(n&&n.textContent!==no)n.textContent=no;
      if(strong&&strong.textContent!==title)strong.textContent=title;
      if(small&&small.textContent!==desc)small.textContent=desc;
    });
  }

  function patchInquirySafetyInfo(){
    const form=document.getElementById('fieldInquiryForm');
    if(!form||document.getElementById('fieldSafetyContact'))return;
    const managers=safetyManagers();
    const box=document.createElement('section');
    box.id='fieldSafetyContact';box.className='field-safety-contact';
    box.innerHTML=`<div class="field-safety-contact-head"><span>안전관리자 정보</span><small>문의 전 담당자를 확인해 주세요.</small></div>
      <div class="field-safety-contact-list">${managers.length?managers.map(m=>{
        const contact=contactText(m);
        return `<div class="field-safety-person"><div><b>${esc(m.name||'안전관리자')}</b><span>${esc(m.position||'안전관리자')}</span></div>${contact?`<strong>${esc(contact)}</strong>`:'<strong class="muted">연락처 정보 미등록</strong>'}</div>`;
      }).join(''):'<div class="field-safety-person"><div><b>안전관리자</b><span>담당자 정보 확인 필요</span></div><strong class="muted">등록된 안전관리자 계정이 없습니다.</strong></div>'}</div>`;
    const head=form.querySelector('.section-head');
    if(head)head.insertAdjacentElement('afterend',box);else form.insertAdjacentElement('afterbegin',box);
  }

  function photoCount(kind){
    try{return kind==='action'?(Array.isArray(actionPhotos)?actionPhotos.length:0):(Array.isArray(incidentPhotos)?incidentPhotos.length:0)}catch(e){return 0}
  }
  function photoForm(kind){
    return kind==='action'?(document.getElementById('unifiedCorrectiveForm')||document.getElementById('correctiveForm')):document.getElementById('unifiedReportForm');
  }
  function ensurePhotoGuide(kind){
    const form=photoForm(kind);if(!form)return;
    const box=form.querySelector('.photo-box');if(!box)return;
    box.classList.add('photo-min-three');
    const title=box.querySelector('.photo-head b');
    const titleText=`${kind==='action'?'조치사진':'현장사진'} *`;
    if(title&&title.textContent!==titleText)title.textContent=titleText;
    let guide=box.querySelector('.photo-min-guide')||box.querySelector('.photo-required-guide');
    if(!guide){
      guide=document.createElement('div');guide.className='photo-min-guide';
      const actions=box.querySelector('.photo-actions');
      if(actions)actions.insertAdjacentElement('beforebegin',guide);else box.appendChild(guide);
    }
    guide.classList.add('photo-min-guide');
    const count=photoCount(kind);
    const text=`필수 · 사진을 최소 ${MIN_PHOTOS}장 이상 등록해 주세요. (현재 ${count}장)`;
    if(guide.textContent!==text)guide.textContent=text;
    guide.classList.toggle('ready',count>=MIN_PHOTOS);
  }
  function photoError(kind){
    const box=photoForm(kind)?.querySelector('.photo-box');
    if(box){box.classList.add('photo-min-error');box.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>box.classList.remove('photo-min-error'),1800)}
    alert(`사진은 최소 ${MIN_PHOTOS}장 이상 등록해야 합니다.`);
  }

  function patchActionModal(){
    const form=photoForm('action');if(!form)return;
    form.closest('.modal')?.classList.add('action-modal-lock');
    ensurePhotoGuide('action');
    if(form.dataset.minThreeSubmit==='1')return;
    form.dataset.minThreeSubmit='1';
    const original=form.onsubmit;
    form.onsubmit=function(e){
      if(photoCount('action')<MIN_PHOTOS){e.preventDefault();e.stopPropagation();photoError('action');return false}
      return original?original.call(this,e):true;
    };
  }

  function patchAll(){patchFieldHome();patchInquirySafetyInfo();ensurePhotoGuide('incident');patchActionModal()}

  if(typeof submitUnifiedIncident==='function'){
    const base=submitUnifiedIncident;
    submitUnifiedIncident=async function(e,u){
      if(photoCount('incident')<MIN_PHOTOS){e.preventDefault();e.stopPropagation();photoError('incident');return}
      return base(e,u);
    };
  }
  if(typeof openUnifiedCorrectiveModal==='function'){
    const base=openUnifiedCorrectiveModal;
    openUnifiedCorrectiveModal=function(id,u){const r=base(id,u);setTimeout(patchActionModal,0);return r};
  }
  if(typeof openCorrectiveModal==='function'){
    const base=openCorrectiveModal;
    openCorrectiveModal=function(id,u){const r=base(id,u);setTimeout(patchActionModal,0);return r};
  }
  if(typeof renderPhotoThumbs==='function'){
    const base=renderPhotoThumbs;
    renderPhotoThumbs=function(kind){const r=base(kind);setTimeout(()=>ensurePhotoGuide(kind==='action'?'action':'incident'),0);return r};
  }
  if(typeof renderShell==='function'){
    const base=renderShell;
    renderShell=function(u){const r=base(u);setTimeout(patchAll,0);return r};
  }

  let observer;
  const observe=()=>observer.observe(document.documentElement,{subtree:true,childList:true});
  observer=new MutationObserver(()=>{
    observer.disconnect();
    try{patchAll()}finally{observe()}
  });
  observe();
  setTimeout(patchAll,0);
})();
