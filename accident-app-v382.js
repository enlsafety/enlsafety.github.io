/* E&L Accident Report App v3.8.2 - contact-only inquiry, record UX, photo viewer */
(function(){
  const VERSION='3.8.2';

  function contactOnlyHtml(u){
    return `<div class="field-task-back"><button type="button" id="contactBackBtn">← 현장 홈으로</button><span>${esc(siteById(u.siteId)?.name||'소속 사업장')}</span></div>
      <section class="panel contact-only-panel">
        <div class="section-head"><div><div class="ey">SAFETY MANAGER</div><h2>안전관리자 정보</h2><p>사고·안전 관련 문의는 아래 담당자에게 연락해 주세요.</p></div></div>
        <section class="business-card-contact contact-only-card">
          <div class="business-card-body">
            <div class="business-card-name"><b>박태영</b><span>과장 · 경영관리부</span></div>
            <div class="business-card-line"><span>회사</span><strong>(주)이앤엘</strong></div>
            <div class="business-card-line"><span>전화</span><a href="tel:07086778554">070-8677-8554</a></div>
            <div class="business-card-line"><span>휴대폰</span><a href="tel:01055668580">010-5566-8580</a></div>
            <div class="business-card-line"><span>이메일</span><a href="mailto:hanarin0130@enlife.co.kr">hanarin0130@enlife.co.kr</a></div>
            <div class="business-card-line address"><span>주소</span><strong>경기도 화성시 동탄순환대로823 702호<br>(영천동, 에이팩시티)</strong></div>
            <div class="business-card-line"><span>홈페이지</span><a href="https://enlife.co.kr" target="_blank" rel="noopener">enlife.co.kr</a></div>
          </div>
        </section>
      </section>`;
  }

  function patchContactOnly(u){
    if(!u||u.role!=='field'||currentView!=='field-inquiry')return;
    const root=document.getElementById('view');if(!root)return;
    root.innerHTML=contactOnlyHtml(u);
    const back=document.getElementById('contactBackBtn');
    if(back)back.onclick=()=>document.querySelector('.topbar .brand')?.click();
  }

  function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
  function recordSummary(i){
    const d=i?.reportDetails||{};
    const who=clean(i?.injuredName)?`${clean(i.injuredName)} 근로자`:'';
    const work=clean(d.workAction);
    const how=clean(d.incidentHow);
    const result=clean(d.result);
    const place=clean(d.place);
    let parts=[];
    if(who)parts.push(who);
    if(place)parts.push(`${place}에서`);
    if(work)parts.push(`${work} 중`);
    if(how)parts.push(how);
    if(result)parts.push(`→ ${result}`);
    let text=parts.join(' ');
    if(!text)text=clean(d.generatedSummary)||clean(i?.summary)||'-';
    return text.length>90?text.slice(0,87)+'…':text;
  }

  function patchRecordTable(){
    document.querySelectorAll('tr[data-inc-id]').forEach(row=>{
      const i=(data.incidents||[]).find(x=>x.id===row.dataset.incId);if(!i)return;
      const cells=row.querySelectorAll('td');if(cells.length<8)return;
      cells[2].classList.add('nowrap-cell');
      cells[4].classList.add('nowrap-cell');
      cells[5].classList.add('nowrap-cell');
      cells[6].classList.add('nowrap-cell');
      cells[7].textContent=recordSummary(i);
      cells[7].classList.add('record-summary-cell');
      row.classList.add('record-row');
    });
  }

  function ensurePhotoViewer(){
    if(document.getElementById('incidentPhotoViewer'))return;
    const v=document.createElement('div');
    v.id='incidentPhotoViewer';v.className='incident-photo-viewer hide';
    v.innerHTML='<button type="button" class="photo-view-close" aria-label="닫기">×</button><img alt="사고 사진 확대"><div class="photo-view-hint">사진을 다시 누르거나 × 버튼을 누르면 닫힙니다.</div>';
    document.body.appendChild(v);
    const close=()=>v.classList.add('hide');
    v.querySelector('.photo-view-close').onclick=close;
    v.addEventListener('click',e=>{if(e.target===v||e.target.tagName==='IMG')close()});
  }
  function bindDetailPhotos(){
    ensurePhotoViewer();
    const viewer=document.getElementById('incidentPhotoViewer');
    document.querySelectorAll('.modal .thumb img').forEach(img=>{
      if(img.dataset.viewerReady==='1')return;
      img.dataset.viewerReady='1';img.classList.add('zoomable-incident-photo');
      img.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        viewer.querySelector('img').src=img.src;
        viewer.classList.remove('hide');
      });
    });
  }

  function patchOccurredCenter(){
    const split=document.querySelector('.occurred-split');if(!split)return;
    split.classList.add('occurred-perfect-center');
  }

  function patchAll(u=currentUser?.()){
    patchContactOnly(u);
    patchRecordTable();
    patchOccurredCenter();
    bindDetailPhotos();
  }

  if(typeof renderShell==='function'){
    const base=renderShell;
    renderShell=function(u){const r=base(u);setTimeout(()=>patchAll(u),0);return r};
  }
  if(typeof openIncidentModal==='function'){
    const base=openIncidentModal;
    openIncidentModal=function(id,admin,u){const r=base(id,admin,u);setTimeout(()=>{bindDetailPhotos();patchRecordTable()},0);return r};
  }
  if(typeof renderUnifiedReport==='function'){
    const base=renderUnifiedReport;
    renderUnifiedReport=function(root,u){const r=base(root,u);setTimeout(patchOccurredCenter,0);return r};
  }

  setTimeout(()=>patchAll(),0);
  window.ENL_DEPLOY_VERSION=VERSION;
})();
