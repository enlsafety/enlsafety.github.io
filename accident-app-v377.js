/* E&L Accident Report App v3.7.7 - field labels, larger mobile text, safety contact card */
(function(){
  const TILE_TEXT={
    accident_report:{title:'사고 보고',desc:'사고 발생 내용을\n사진과 함께 보고'},
    accident_action:{title:'사고 조치',desc:'사고 후 원인과 조치 내용을\n등록하고 확인'},
    records:{title:'사고 기록',desc:'우리 현장의 사고와 조치\n기록을 확인'},
    inquiry:{title:'기타 문의',desc:'안전관리자 정보 확인\n및 문의'}
  };

  function patchFieldTiles(){
    const grid=document.querySelector('.field-six-home .field-six-grid');
    if(!grid)return;
    grid.querySelectorAll('[data-field-task]').forEach(btn=>{
      const item=TILE_TEXT[btn.dataset.fieldTask];
      if(!item)return;
      const strong=btn.querySelector('strong');
      const small=btn.querySelector('small');
      if(strong&&strong.textContent!==item.title)strong.textContent=item.title;
      if(small){
        small.textContent=item.desc.replace(/\n/g,' ');
        small.dataset.mobileDesc=item.desc;
      }
      btn.dataset.mobileDesc=item.desc;
    });
  }

  function patchSafetyContact(){
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
    const html=`
      <div class="business-card-head">
        <span>안전관리자 정보</span>
        <small>사고·안전 관련 문의는 아래 담당자에게 연락해 주세요.</small>
      </div>
      <div class="business-card-body">
        <div class="business-card-name"><b>박태영</b><span>과장 · 경영관리부</span></div>
        <div class="business-card-line"><span>회사</span><strong>(주)이앤엘</strong></div>
        <div class="business-card-line"><span>전화</span><a href="tel:07086778554">070-8677-8554</a></div>
        <div class="business-card-line"><span>휴대폰</span><a href="tel:01055668580">010-5566-8580</a></div>
        <div class="business-card-line"><span>이메일</span><a href="mailto:hanarin0130@enlife.co.kr">hanarin0130@enlife.co.kr</a></div>
        <div class="business-card-line address"><span>주소</span><strong>경기도 화성시 동탄순환대로823 702호<br>(영천동, 에이팩시티)</strong></div>
        <div class="business-card-line"><span>홈페이지</span><a href="https://enlife.co.kr" target="_blank" rel="noopener">enlife.co.kr</a></div>
      </div>`;
    if(box.innerHTML!==html)box.innerHTML=html;
  }

  function patchAll(){patchFieldTiles();patchSafetyContact()}

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
