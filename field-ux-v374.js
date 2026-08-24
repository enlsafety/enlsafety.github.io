/* E&L Safety field UX - consolidated stable hooks */
(function(){
  const MIN_PHOTOS=3;

  function patchFieldHome(){
    const home=document.querySelector('.field-six-home .field-six-grid');
    if(!home)return;
    const wanted=['accident_report','accident_action','records','inquiry'];
    const labels={
      accident_report:['01','사고 보고','사고 발생 내용을 사진과 함께 보고'],
      accident_action:['02','사고 조치','사고 후 원인과 조치 내용을 등록하고 확인'],
      records:['03','사고 기록','우리 현장의 사고와 조치 기록을 확인'],
      inquiry:['04','기타 문의','안전관리자 정보 확인 및 문의']
    };
    [...home.querySelectorAll('[data-field-task]')].forEach(btn=>{
      if(!wanted.includes(btn.dataset.fieldTask))btn.remove();
    });
    wanted.forEach(key=>{
      const btn=home.querySelector(`[data-field-task="${key}"]`);if(btn)home.appendChild(btn);
    });
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
    if(!form)return;
    let box=document.getElementById('fieldSafetyContact');
    if(!box){
      box=document.createElement('section');
      box.id='fieldSafetyContact';
      const head=form.querySelector('.section-head');
      if(head)head.insertAdjacentElement('afterend',box);else form.insertAdjacentElement('afterbegin',box);
    }
    box.className='field-safety-contact business-card-contact';
    if(box.dataset.contactReady==='1')return;
    box.dataset.contactReady='1';
    box.innerHTML=`
      <div class="business-card-head"><span>안전관리자 정보</span><small>사고·안전 관련 문의는 아래 담당자에게 연락해 주세요.</small></div>
      <div class="business-card-body">
        <div class="business-card-name"><b>박태영</b><span>과장 · 경영관리부</span></div>
        <div class="business-card-line"><span>회사</span><strong>(주)이앤엘</strong></div>
        <div class="business-card-line"><span>전화</span><a href="tel:07086778554">070-8677-8554</a></div>
        <div class="business-card-line"><span>휴대폰</span><a href="tel:01055668580">010-5566-8580</a></div>
        <div class="business-card-line"><span>이메일</span><a href="mailto:hanarin0130@enlife.co.kr">hanarin0130@enlife.co.kr</a></div>
        <div class="business-card-line address"><span>주소</span><strong>경기도 화성시 동탄순환대로823 702호<br>(영천동, 에이팩시티)</strong></div>
        <div class="business-card-line"><span>홈페이지</span><a href="https://enlife.co.kr" target="_blank" rel="noopener">enlife.co.kr</a></div>
      </div>`;
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

  /* No MutationObserver here: repeated DOM observers caused a mobile render loop. */
  setTimeout(patchAll,0);
})();
