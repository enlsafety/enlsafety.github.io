/* E&L Accident Report App v3.8.2 - field contact / record UI fixes */
(function(){
  const VERSION='3.8.2';

  function contactOnlyHtml(u){
    const site=siteById(u?.siteId)?.name||'소속 사업장';
    return `<div class="field-task-back"><button type="button" id="contactBackBtn">← 현장 홈으로</button><span>${esc(site)}</span></div>
      <section class="panel contact-only-page">
        <div class="business-card-contact contact-only-card">
          <div class="business-card-head"><span>안전관리자 정보</span><small>사고 및 안전 관련 문의는 아래 담당자에게 연락해 주세요.</small></div>
          <div class="business-card-body">
            <div class="business-card-name"><b>박태영</b><span>과장 · 경영관리부</span></div>
            <div class="business-card-line"><span>회사</span><strong>(주)이앤엘</strong></div>
            <div class="business-card-line"><span>전화</span><a href="tel:07086778554">070-8677-8554</a></div>
            <div class="business-card-line"><span>휴대폰</span><a href="tel:01055668580">010-5566-8580</a></div>
            <div class="business-card-line"><span>이메일</span><a href="mailto:hanarin0130@enlife.co.kr">hanarin0130@enlife.co.kr</a></div>
            <div class="business-card-line address"><span>주소</span><strong>경기도 화성시 동탄순환대로823 702호<br>(영천동, 에이팩시티)</strong></div>
            <div class="business-card-line"><span>홈페이지</span><a href="https://enlife.co.kr" target="_blank" rel="noopener">enlife.co.kr</a></div>
          </div>
        </div>
      </section>`;
  }

  function renderFieldContactOnly(u){
    const root=document.getElementById('view');
    if(!root)return;
    root.innerHTML=contactOnlyHtml(u);
    const back=document.getElementById('contactBackBtn');
    if(back)back.onclick=()=>{
      const brand=document.querySelector('.topbar .brand');
      if(brand&&typeof brand.onclick==='function')brand.click();
      else {currentView='home';renderShell(u)}
    };
  }

  if(typeof renderCurrentView==='function'){
    const baseRenderCurrentView=renderCurrentView;
    renderCurrentView=function(u){
      if(u?.role==='field'&&currentView==='field-inquiry')return renderFieldContactOnly(u);
      return baseRenderCurrentView(u);
    };
  }

  function compactWhen(v){
    if(!v)return '';
    try{
      const d=new Date(v);
      const mm=String(d.getMonth()+1).padStart(2,'0');
      const dd=String(d.getDate()).padStart(2,'0');
      const hh=String(d.getHours()).padStart(2,'0');
      const mi=String(d.getMinutes()).padStart(2,'0');
      return `${mm}.${dd} ${hh}:${mi}`;
    }catch(e){return ''}
  }

  function incidentCompactSummary(i){
    const d=i?.reportDetails||{};
    const hasDetail=!!(d.place||d.workAction||d.incidentHow||d.result);
    if(hasDetail){
      const head=[compactWhen(i.occurredAt),d.place].filter(Boolean).join(' ');
      const actor=i.injuredName?`${i.injuredName} 근로자`:(i.category==='person'?'근로자':'');
      const scene=[actor,d.workAction?`${d.workAction} 중`:'',d.incidentHow||''].filter(Boolean).join(' ');
      const result=d.result?` → ${d.result}`:'';
      const text=[head,`${scene}${result}`.trim()].filter(Boolean).join(' · ').replace(/\s+/g,' ').trim();
      if(text)return text.length>110?`${text.slice(0,109)}…`:text;
    }
    const fallback=(d.generatedSummary||i?.summary||'').replace(/\s+/g,' ').trim();
    return fallback.length>110?`${fallback.slice(0,109)}…`:fallback;
  }
  window.enlIncidentCompactSummary=incidentCompactSummary;

  if(typeof incidentTable==='function'){
    incidentTable=function(arr,admin){
      if(!arr.length)return '<div class="empty">표시할 사고가 없습니다.</div>';
      return `<div class="table-wrap record-table-wrap"><table class="tbl record-table"><thead><tr><th class="col-date">발생일</th><th class="col-site">사업장</th><th class="col-category">구분</th><th class="col-type">사고유형</th><th class="col-priority">관리등급</th><th class="col-status">상태</th><th class="col-action">개선조치</th><th class="col-summary">내용</th></tr></thead><tbody>${arr.map(i=>`<tr data-inc-id="${i.id}"><td class="col-date">${fmt(i.occurredAt)}</td><td class="col-site"><b>${esc(siteById(i.siteId)?.name||'-')}</b></td><td class="col-category">${categoryBadge(i.category)}</td><td class="col-type">${esc(i.eventType)}</td><td class="col-priority">${priorityBadge(i.priority)}${legalBadge(i)}</td><td class="col-status">${statusBadge(i.status)}</td><td class="col-action">${actionBadge(i)}</td><td class="col-summary">${esc(incidentCompactSummary(i))}</td></tr>`).join('')}</tbody></table></div>`;
    };
  }

  function ensureLightbox(){
    let box=document.getElementById('enlPhotoLightbox');
    if(box)return box;
    box=document.createElement('div');
    box.id='enlPhotoLightbox';
    box.className='photo-lightbox hide';
    box.innerHTML='<button type="button" class="photo-lightbox-close" aria-label="사진 닫기">×</button><div class="photo-lightbox-stage"><img alt="확대 사진"></div>';
    document.body.appendChild(box);
    const close=()=>{box.classList.add('hide');box.querySelector('img').removeAttribute('src');document.body.classList.remove('photo-lightbox-open')};
    box.querySelector('.photo-lightbox-close').onclick=close;
    box.onclick=e=>{if(e.target===box||e.target.classList.contains('photo-lightbox-stage'))close()};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.classList.contains('hide'))close()});
    return box;
  }

  function openPhoto(src){
    if(!src)return;
    const box=ensureLightbox();
    const img=box.querySelector('img');
    img.src=src;
    box.classList.remove('hide');
    document.body.classList.add('photo-lightbox-open');
  }

  function bindModalPhotos(){
    const modal=document.querySelector('#modalRoot .modal');
    if(!modal)return;
    modal.querySelectorAll('.thumb img').forEach(img=>{
      if(img.dataset.zoomReady==='1')return;
      img.dataset.zoomReady='1';
      img.setAttribute('role','button');
      img.setAttribute('tabindex','0');
      img.title='눌러서 크게 보기';
      const open=()=>openPhoto(img.currentSrc||img.src);
      img.onclick=e=>{e.preventDefault();e.stopPropagation();open()};
      img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
    });
  }

  if(typeof openIncidentModal==='function'){
    const baseOpenIncidentModal=openIncidentModal;
    openIncidentModal=function(id,admin,u){
      const r=baseOpenIncidentModal(id,admin,u);
      setTimeout(bindModalPhotos,0);
      return r;
    };
  }

  // Also allow already-open detail modals to receive the same photo behavior.
  window.enlBindRecordPhotos=bindModalPhotos;

  setTimeout(()=>{
    try{
      const u=currentUser();
      if(u?.role==='field'&&currentView==='field-inquiry')renderFieldContactOnly(u);
      bindModalPhotos();
    }catch(e){console.warn('record UI init skipped',e)}
  },0);
})();
