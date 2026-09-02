/* E&L Accident Report App v4.1.6 - approval comments, audit display and unified safety inquiries */
(function(){
  'use strict';
  const VERSION='4.1.6-inquiry2';
  const API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-workflow-v412';
  const CLIENT='incident-report-v2';
  const INQUIRY_CATEGORIES=['앱 사용법','안전 관련 문의','기타'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const text=v=>String(v??'').trim();
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actor=(u=currentUser?.())=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
  const roleLabel=r=>r==='safety'?'안전관리자':r==='executive'?'경영진':r==='manager'?'관리자':r==='field'?'현장관리':r==='worker'?'일반근로자':'사용자';
  const fmtx=v=>typeof fmt==='function'?fmt(v):(v?new Date(v).toLocaleString('ko-KR'):'-');
  const siteLabel=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const isFieldUser=u=>['field','worker'].includes(roleNorm(u?.role));
  let activeIncidentId='';
  let inquiryBusy=false;
  let inquiryNavActive=false;

  async function api(body,timeout=12000){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),timeout):null;
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify(body),signal:ctl?.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}
      return j;
    }finally{if(timer)clearTimeout(timer)}
  }
  window.enlWorkflowApi=api;

  function css(){
    if(document.getElementById('workflow412Css'))return;
    const s=document.createElement('style');s.id='workflow412Css';s.textContent=`
      .wf412-mod{margin:10px 0;padding:9px 11px;border:1px solid #cfdfeb;border-radius:10px;background:#f7fbfe;color:#526d83;font-size:12px;line-height:1.5}.wf412-mod b{color:#244e70}
      .wf412-comments{margin-top:12px;border:1px solid #cbdde9;border-radius:13px;background:#f8fbfe;padding:12px}.wf412-comments h3{margin:0;color:#174d78;font-size:15px}.wf412-comments-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.wf412-comments-list{display:grid;gap:8px;margin-top:10px}.wf412-comment{border:1px solid #d9e5ed;border-radius:10px;background:#fff;padding:10px}.wf412-comment-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#62788b;font-size:11px}.wf412-comment-body{margin-top:7px;color:#213f58;white-space:pre-wrap;line-height:1.5}.wf412-comment-state{display:inline-flex;padding:3px 7px;border-radius:999px;background:#eef4f8;color:#587087;font-weight:900}.wf412-comment-state.answered{background:#edf8f1;color:#286743}.wf412-comment-state.read{background:#edf4ff;color:#2c5e91}.wf412-reply{margin-top:8px;padding:9px;border-left:3px solid #5d93bb;background:#f2f8fc;color:#294d68;white-space:pre-wrap;line-height:1.5}.wf412-comment-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.wf412-comment-actions button,.wf412-comment-form button{min-height:38px;border:0;border-radius:8px;padding:0 11px;font-weight:900}.wf412-read{background:#e9f1f7;color:#315a79}.wf412-answer{background:#1e5d91;color:#fff}.wf412-comment-form{display:grid;gap:7px;margin-top:10px}.wf412-comment-form textarea{width:100%;box-sizing:border-box;min-height:76px;border:1.5px solid #b9cedd;border-radius:9px;padding:9px;font:inherit;resize:vertical}.wf412-comment-form button{justify-self:end;background:#1e5d91;color:#fff}.wf412-empty{padding:13px;border:1px dashed #cbd9e3;border-radius:9px;color:#718598;text-align:center;background:#fff}
      .wf412-nav-badge{display:inline-flex;min-width:19px;height:19px;align-items:center;justify-content:center;margin-left:5px;padding:0 5px;border-radius:999px;background:#c63d3d;color:#fff;font-size:10px;font-weight:950}.wf412-menu-btn{width:100%;text-align:left}
      .wf412-page{display:grid;gap:12px}.wf412-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.wf412-head h2{margin:2px 0 5px;color:#173b66}.wf412-head p{margin:0;color:#6c8092}.wf412-new{border:1px solid #d4e2ec;border-radius:13px;background:#fff;padding:13px}.wf412-new form{display:grid;gap:8px}.wf412-new input,.wf412-new textarea,.wf412-new select{width:100%;box-sizing:border-box;border:1.5px solid #bdcfdd;border-radius:9px;padding:9px;font:inherit}.wf412-new textarea{min-height:92px;resize:vertical}.wf412-new button{min-height:44px;border:0;border-radius:9px;background:#1e5d91;color:#fff;font-weight:900}.wf412-formgrid{display:grid;grid-template-columns:minmax(130px,.45fr) minmax(0,1fr);gap:8px}.wf412-formlabel{display:grid;gap:5px}.wf412-formlabel span{font-size:12px;font-weight:900;color:#476079}.wf412-filter{display:flex;gap:6px;flex-wrap:wrap}.wf412-filter button{min-height:36px;border:1px solid #c6d5e0;border-radius:8px;background:#fff;color:#49657b;padding:0 10px;font-weight:850}.wf412-filter button.on{background:#173b66;color:#fff;border-color:#173b66}.wf412-inquiries{display:grid;gap:8px}.wf412-inq{border:1px solid #d7e3eb;border-radius:12px;background:#fff;padding:12px}.wf412-inq.new{border-left:4px solid #cb4a4a}.wf412-inq.deleted{opacity:.72;background:#f7f8fa}.wf412-inq-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.wf412-inq h3{margin:7px 0 5px;color:#193f5f;font-size:16px}.wf412-inq-meta{color:#708497;font-size:11px}.wf412-inq-body{margin-top:8px;color:#314f67;line-height:1.55;white-space:pre-wrap}.wf412-inq-answer{margin-top:9px;padding:10px;border-left:3px solid #4e8ab4;background:#f1f8fc;white-space:pre-wrap;color:#2b506c}.wf412-inq-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.wf412-inq-actions button{min-height:38px;border:0;border-radius:8px;padding:0 11px;font-weight:900}.wf412-inq-actions .read{background:#eaf1f6;color:#315a78}.wf412-inq-actions .reply{background:#1e5d91;color:#fff}.wf412-inq-actions .close{background:#eaf5ed;color:#2e6b47}.wf412-inq-actions .delete{background:#fff0f0;color:#9b3535}.wf412-inq-actions .restore{background:#edf6ff;color:#285d87}.wf412-inq-actions .purge{background:#8f2f2f;color:#fff}.wf412-status{display:inline-flex;padding:3px 7px;border-radius:999px;background:#eef3f6;color:#5a7184;font-size:11px;font-weight:900}.wf412-status.new{background:#fff0f0;color:#9b3535}.wf412-status.answered{background:#edf8f1;color:#286743}.wf412-status.closed{background:#edf0f3;color:#566674}.wf412-category{display:inline-flex;padding:3px 7px;border-radius:999px;background:#edf6ff;color:#285d87;font-size:11px;font-weight:900;margin-right:5px}
      @media(max-width:560px){.wf412-comments,.wf412-new,.wf412-inq{padding:10px}.wf412-comment-form button{width:100%}.wf412-formgrid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  const previousSave=window.saveData;
  let seenUpdated=new Map((data.incidents||[]).map(i=>[String(i.id),String(i.updatedAt||'')]));
  if(typeof previousSave==='function'){
    window.saveData=function(){
      try{
        const u=currentUser?.(),a=actor(u);
        if(a){for(const i of data.incidents||[]){if(!i||i.workerPublicOnly)continue;const id=String(i.id||''),stamp=String(i.updatedAt||'');if(id&&stamp&&seenUpdated.get(id)!==stamp){i.lastModifiedBy=a.name;i.lastModifiedRole=a.role;i.lastModifiedPosition=a.position||(a.role==='worker'?'일반근로자':'');i.lastModifiedAt=stamp}}}
      }catch(e){}
      const out=previousSave.apply(this,arguments);
      seenUpdated=new Map((data.incidents||[]).map(i=>[String(i.id),String(i.updatedAt||'')]));
      return out;
    };
    try{saveData=window.saveData}catch(e){}
  }

  function activeIncident(){return (data.incidents||[]).find(i=>String(i.id)===String(activeIncidentId))}
  function modifierHtml(i){
    if(!i)return '';
    const who=text(i.lastModifiedBy),at=i.lastModifiedAt||i.updatedAt,role=roleNorm(i.lastModifiedRole),pos=text(i.lastModifiedPosition);
    if(!who)return `<div class="wf412-mod"><b>최종수정자</b> · 기존 기록에는 수정자 정보가 없습니다.${at?` · 최종 저장 ${ex(fmtx(at))}`:''}</div>`;
    return `<div class="wf412-mod"><b>최종수정자</b> · ${ex(who)}${pos?' · '+ex(pos):role?' · '+ex(roleLabel(role)):''}${at?' · '+ex(fmtx(at)):''}</div>`;
  }
  const stateLabel=s=>s==='answered'?'답변완료':s==='read'?'안전관리자 열람':'확인대기';
  function commentHtml(c,safety){
    const st=text(c.safety_status)||'new';
    return `<article class="wf412-comment" data-wf-comment="${ex(c.comment_id)}"><div class="wf412-comment-top"><span><b>${ex(c.author_name||'-')}</b> · ${ex(roleLabel(roleNorm(c.author_role)))}${c.author_position?' · '+ex(c.author_position):''}</span><span>${ex(fmtx(c.created_at))} <em class="wf412-comment-state ${ex(st)}">${stateLabel(st)}</em></span></div><div class="wf412-comment-body">${ex(c.body||'')}</div>${c.reply_body?`<div class="wf412-reply"><b>안전관리자 답변</b> · ${ex(fmtx(c.replied_at))}<br>${ex(c.reply_body)}</div>`:''}${safety&&st!=='answered'?`<div class="wf412-comment-actions">${st==='new'?`<button type="button" class="wf412-read" data-wf-comment-read="${ex(c.comment_id)}">확인만</button>`:''}<button type="button" class="wf412-answer" data-wf-comment-reply="${ex(c.comment_id)}">답변</button></div>`:''}</article>`;
  }
  async function loadComments(box,i,u){
    if(!box||!i)return;box.querySelector('.wf412-comments-list').innerHTML='<div class="wf412-empty">의견을 불러오는 중입니다.</div>';
    try{
      const r=await api({action:'comment_list',actor:actor(u),incidentId:i.id});const list=r.comments||[],safety=roleNorm(u.role)==='safety',target=box.querySelector('.wf412-comments-list');
      target.innerHTML=list.length?list.map(c=>commentHtml(c,safety)).join(''):'<div class="wf412-empty">등록된 관리자·경영진 의견이 없습니다.</div>';
      target.querySelectorAll('[data-wf-comment-read]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api({action:'comment_read',actor:actor(u),commentId:b.dataset.wfCommentRead});await loadComments(box,i,u)}catch(e){b.disabled=false;alert('열람 처리를 저장하지 못했습니다.')}});
      target.querySelectorAll('[data-wf-comment-reply]').forEach(b=>b.onclick=()=>{const id=b.dataset.wfCommentReply,card=b.closest('.wf412-comment');if(!card)return;let form=card.querySelector('.wf412-comment-form');if(form){form.remove();return}card.insertAdjacentHTML('beforeend',`<form class="wf412-comment-form" data-wf-reply-form="${ex(id)}"><textarea maxlength="2000" required placeholder="관리자·경영진 의견에 대한 답변을 입력해 주세요."></textarea><button type="submit">답변 등록</button></form>`);form=card.querySelector('.wf412-comment-form');form.onsubmit=async ev=>{ev.preventDefault();const body=text(form.querySelector('textarea')?.value);if(!body)return;const btn=form.querySelector('button');btn.disabled=true;try{await api({action:'comment_reply',actor:actor(u),commentId:id,body});await loadComments(box,i,u)}catch(e){btn.disabled=false;alert('답변을 저장하지 못했습니다.')}}});
    }catch(e){box.querySelector('.wf412-comments-list').innerHTML='<div class="wf412-empty">의견을 불러오지 못했습니다.</div>'}
  }
  function mountIncidentExtras(){
    const root=document.getElementById('modalRoot');if(!root||!root.querySelector('.modal')||!root.textContent.includes('INCIDENT REVIEW'))return;
    const i=activeIncident();if(!i)return;const u=currentUser?.();if(!u)return;const modal=root.querySelector('.modal');
    if(!modal.querySelector('.wf412-mod')){const head=modal.querySelector('.modal-head');head?.insertAdjacentHTML('afterend',modifierHtml(i))}
    const r=roleNorm(u.role);if(!['safety','manager','executive'].includes(r)||!['approved','closed'].includes(i.status))return;
    if(modal.querySelector('[data-wf-comments]'))return;
    const hq=['manager','executive'].includes(r);
    const html=`<section class="wf412-comments" data-wf-comments><div class="wf412-comments-head"><h3>관리자·경영진 의견</h3><span class="wf412-status">승인 사고 전용</span></div><div class="wf412-comments-list"></div>${hq?`<form class="wf412-comment-form" id="wf412CommentForm"><textarea id="wf412CommentBody" maxlength="2000" required placeholder="사고 내용 또는 조치사항에 대한 의견을 입력해 주세요."></textarea><button type="submit">의견 등록</button></form>`:''}</section>`;
    modal.insertAdjacentHTML('beforeend',html);const box=modal.querySelector('[data-wf-comments]');
    if(hq){const form=box.querySelector('#wf412CommentForm');form.onsubmit=async ev=>{ev.preventDefault();const body=text(box.querySelector('#wf412CommentBody')?.value);if(!body)return;const btn=form.querySelector('button');btn.disabled=true;try{await api({action:'comment_add',actor:actor(u),incidentId:i.id,body});box.querySelector('#wf412CommentBody').value='';await loadComments(box,i,u)}catch(e){btn.disabled=false;alert(e?.message==='not_approved'?'안전관리자 승인 후 의견을 등록할 수 있습니다.':'의견을 저장하지 못했습니다.')}}}
    loadComments(box,i,u);
  }

  function captureIncidentId(ev){const el=ev.target?.closest?.('[data-inc-id],[data-safety-inc],[data-manager-inc],[data-rejected-edit]');if(el)activeIncidentId=String(el.dataset.incId||el.dataset.safetyInc||el.dataset.managerInc||el.dataset.rejectedEdit||'')}
  document.addEventListener('click',captureIncidentId,true);
  ['enlOpenIncidentReview','openIncidentModal'].forEach(k=>{const f=window[k];if(typeof f==='function'){window[k]=function(id){activeIncidentId=String(id||'');const out=f.apply(this,arguments);setTimeout(mountIncidentExtras,0);return out}}});
  function mountEditModifier(){const form=document.querySelector('#unifiedReportForm[data-editing="true"]');if(!form||form.querySelector('.wf412-mod'))return;const i=activeIncident();if(!i)return;const head=form.querySelector('.section-head');head?.insertAdjacentHTML('afterend',modifierHtml(i))}

  function setInquiryNavActive(active){
    inquiryNavActive=!!active;
    const nav=document.querySelector('.shell411-nav');if(!nav)return;
    nav.querySelectorAll('button').forEach(b=>{if(b.matches('[data-wf-inquiry-nav]'))b.classList.toggle('on',inquiryNavActive);else if(inquiryNavActive)b.classList.remove('on')});
  }
  document.addEventListener('click',ev=>{if(ev.target?.closest?.('[data-shell-view]'))setInquiryNavActive(false)},true);

  const inquiryLabel=s=>s==='new'?'새 문의':s==='read'?'열람':s==='answered'?'답변완료':s==='closed'?'처리완료':s;
  function inquiryCard(x,safety,deletedView){
    const status=text(x.status)||'new',deleted=!!x.deleted_at;
    return `<article class="wf412-inq ${deleted?'deleted':ex(status)}" data-wf-inq="${ex(x.inquiry_id)}"><div class="wf412-inq-top"><div><span class="wf412-category">${ex(x.category||'기타')}</span><span class="wf412-status ${ex(status)}">${deleted?'임시삭제':ex(inquiryLabel(status))}</span> <b>${ex(x.sender_name||'-')}</b>${x.sender_position?' · '+ex(x.sender_position):''}${x.site_id?' · '+ex(siteLabel(x.site_id)):''}</div><span class="wf412-inq-meta">${ex(fmtx(x.created_at))}</span></div><h3>${ex(x.subject||'문의')}</h3><div class="wf412-inq-body">${ex(x.body||'')}</div>${x.answer_body?`<div class="wf412-inq-answer"><b>안전관리자 답변</b> · ${ex(fmtx(x.answered_at))}<br>${ex(x.answer_body)}</div>`:''}${safety?deletedView?`<div class="wf412-inq-actions"><button type="button" class="restore" data-wf-inq-restore="${ex(x.inquiry_id)}">복원</button><button type="button" class="purge" data-wf-inq-purge="${ex(x.inquiry_id)}">완전삭제</button></div>`:status!=='closed'?`<div class="wf412-inq-actions">${status==='new'?`<button type="button" class="read" data-wf-inq-read="${ex(x.inquiry_id)}">열람 처리</button>`:''}<button type="button" class="reply" data-wf-inq-reply="${ex(x.inquiry_id)}">답변</button><button type="button" class="close" data-wf-inq-close="${ex(x.inquiry_id)}">처리완료</button><button type="button" class="delete" data-wf-inq-delete="${ex(x.inquiry_id)}">임시삭제</button></div>`:`<div class="wf412-inq-actions"><button type="button" class="delete" data-wf-inq-delete="${ex(x.inquiry_id)}">임시삭제</button></div>`:''}</article>`;
  }
  async function renderInquiryCenter(filter=''){
    const u=currentUser?.(),a=actor(u),root=document.getElementById('view');if(!u||!a||!root)return;const safety=a.role==='safety',fieldUser=isFieldUser(u),deletedView=filter==='deleted';
    setInquiryNavActive(true);
    root.innerHTML=`<section class="wf412-page"><section class="panel"><div class="wf412-head"><div><div class="ey">SAFETY CONTACT</div><h2>${safety?'안전관리자 문의함':'안전관리자 문의'}</h2><p>${safety?'현장 및 본사에서 등록한 모든 문의를 확인하고 답변·처리합니다.':'문의 구분, 제목, 내용을 입력해 안전관리자에게 전달합니다.'}</p></div></div></section>${safety?`<section class="panel"><div class="wf412-filter">${[['','전체'],['new','새 문의'],['read','열람'],['answered','답변완료'],['closed','처리완료'],['deleted','임시삭제']].map(([v,t])=>`<button type="button" data-wf-filter="${v}" class="${filter===v?'on':''}">${t}</button>`).join('')}</div><div id="wf412InquiryList" class="wf412-inquiries" style="margin-top:10px"><div class="wf412-empty">문의사항을 불러오는 중입니다.</div></div></section>`:`<section class="wf412-new"><form id="wf412InquiryForm"><div class="wf412-formgrid"><label class="wf412-formlabel"><span>문의 구분 *</span><select id="wf412InquiryCategory">${INQUIRY_CATEGORIES.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="wf412-formlabel"><span>제목 *</span><input id="wf412InquirySubject" maxlength="120" required placeholder="문의 제목"></label></div><label class="wf412-formlabel"><span>문의 내용 *</span><textarea id="wf412InquiryBody" maxlength="3000" required placeholder="문의 내용을 구체적으로 입력해 주세요."></textarea></label><button type="submit">안전관리자에게 문의 등록</button></form></section><section class="panel"><h3 style="margin-top:0;color:#174d78">내 문의 내역</h3><div id="wf412InquiryList" class="wf412-inquiries"><div class="wf412-empty">문의사항을 불러오는 중입니다.</div></div></section>`}</section>`;
    if(fieldUser)window.enlAddFieldBack?.(root,u);
    if(safety)root.querySelectorAll('[data-wf-filter]').forEach(b=>b.onclick=()=>renderInquiryCenter(b.dataset.wfFilter||''));
    else document.getElementById('wf412InquiryForm').onsubmit=async ev=>{ev.preventDefault();if(inquiryBusy)return;const category=text(document.getElementById('wf412InquiryCategory').value),subject=text(document.getElementById('wf412InquirySubject').value),body=text(document.getElementById('wf412InquiryBody').value);if(!subject||!body)return;inquiryBusy=true;const btn=ev.currentTarget.querySelector('button');btn.disabled=true;try{await api({action:'inquiry_create',actor:a,category,subject,body});document.getElementById('wf412InquirySubject').value='';document.getElementById('wf412InquiryBody').value='';await loadInquiries(u,filter);alert('안전관리자에게 문의가 등록되었습니다.')}catch(e){alert('문의 등록에 실패했습니다.')}finally{inquiryBusy=false;btn.disabled=false}};
    await loadInquiries(u,filter);markInquiryButton();
  }
  window.enlRenderSafetyInquiry=renderInquiryCenter;

  async function loadInquiries(u,filter=''){
    const a=actor(u),safety=a?.role==='safety',deletedView=filter==='deleted',box=document.getElementById('wf412InquiryList');if(!a||!box)return;
    try{
      const r=await api(safety?{action:'inquiry_safety_list',actor:a,status:deletedView?'':filter,deleted:deletedView}:{action:'inquiry_my_list',actor:a});const list=r.inquiries||[];box.innerHTML=list.length?list.map(x=>inquiryCard(x,safety,deletedView)).join(''):'<div class="wf412-empty">등록된 문의사항이 없습니다.</div>';
      if(!safety)return;
      box.querySelectorAll('[data-wf-inq-read]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api({action:'inquiry_read',actor:a,inquiryId:b.dataset.wfInqRead});await loadInquiries(u,filter);markInquiryButton()}catch(e){b.disabled=false;alert('열람 처리를 저장하지 못했습니다.')}});
      box.querySelectorAll('[data-wf-inq-close]').forEach(b=>b.onclick=async()=>{if(!confirm('이 문의를 처리완료로 표시할까요?'))return;b.disabled=true;try{await api({action:'inquiry_close',actor:a,inquiryId:b.dataset.wfInqClose});await loadInquiries(u,filter);markInquiryButton()}catch(e){b.disabled=false;alert('처리완료 상태를 저장하지 못했습니다.')}});
      box.querySelectorAll('[data-wf-inq-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('이 문의를 임시삭제할까요? 임시삭제 목록에서 다시 복원할 수 있습니다.'))return;b.disabled=true;try{await api({action:'inquiry_delete',actor:a,inquiryId:b.dataset.wfInqDelete});await loadInquiries(u,filter);markInquiryButton()}catch(e){b.disabled=false;alert('문의 임시삭제에 실패했습니다.')}});
      box.querySelectorAll('[data-wf-inq-restore]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api({action:'inquiry_restore',actor:a,inquiryId:b.dataset.wfInqRestore});await loadInquiries(u,filter);markInquiryButton()}catch(e){b.disabled=false;alert('문의를 복원하지 못했습니다.')}});
      box.querySelectorAll('[data-wf-inq-purge]').forEach(b=>b.onclick=async()=>{if(!confirm('이 문의를 완전히 삭제할까요?\n완전삭제 후에는 복원할 수 없습니다.'))return;b.disabled=true;try{await api({action:'inquiry_purge',actor:a,inquiryId:b.dataset.wfInqPurge});await loadInquiries(u,filter);markInquiryButton()}catch(e){b.disabled=false;alert(e?.message==='not_deleted_inquiry'?'임시삭제된 문의만 완전삭제할 수 있습니다.':'문의 완전삭제에 실패했습니다.')}});
      box.querySelectorAll('[data-wf-inq-reply]').forEach(b=>b.onclick=()=>{const card=b.closest('.wf412-inq'),id=b.dataset.wfInqReply;if(!card)return;let form=card.querySelector('.wf412-comment-form');if(form){form.remove();return}card.insertAdjacentHTML('beforeend',`<form class="wf412-comment-form"><textarea maxlength="3000" required placeholder="문의에 대한 답변을 입력해 주세요."></textarea><button type="submit">답변 등록</button></form>`);form=card.querySelector('.wf412-comment-form');form.onsubmit=async ev=>{ev.preventDefault();const body=text(form.querySelector('textarea')?.value);if(!body)return;const btn=form.querySelector('button');btn.disabled=true;try{await api({action:'inquiry_reply',actor:a,inquiryId:id,body});await loadInquiries(u,filter);markInquiryButton()}catch(e){btn.disabled=false;alert('답변을 저장하지 못했습니다.')}}});
    }catch(e){box.innerHTML='<div class="wf412-empty">문의사항을 불러오지 못했습니다.</div>'}
  }

  function canInquiry(u){return ['safety','manager','executive','field','worker'].includes(roleNorm(u?.role))}
  function injectInquiryEntry(){
    const u=currentUser?.();if(!u||!canInquiry(u))return;const r=roleNorm(u.role),nav=document.querySelector('.shell411-nav');
    if(nav&&!nav.querySelector('[data-wf-inquiry-nav]')){const b=document.createElement('button');b.type='button';b.dataset.wfInquiryNav='1';b.innerHTML=r==='safety'?'문의함':'안전관리자 문의';b.onclick=()=>{setInquiryNavActive(true);renderInquiryCenter('')};nav.appendChild(b)}
    const menu=document.getElementById('userMenu');if(menu&&['field','worker'].includes(r)&&!menu.querySelector('[data-wf-inquiry-menu]')){const b=document.createElement('button');b.type='button';b.className='wf412-menu-btn';b.dataset.wfInquiryMenu='1';b.textContent='안전관리자 문의';b.onclick=()=>{menu.classList.add('hide');renderInquiryCenter('')};const logout=menu.querySelector('#logoutBtn');menu.insertBefore(b,logout||null)}
    if(inquiryNavActive)setInquiryNavActive(true);
    if(r==='safety')markInquiryButton();
  }
  async function markInquiryButton(){
    const u=currentUser?.();if(roleNorm(u?.role)!=='safety')return;const b=document.querySelector('[data-wf-inquiry-nav]');if(!b)return;try{const r=await api({action:'inquiry_count',actor:actor(u)}),n=Number(r.count||0);b.innerHTML=`문의함${n>0?` <span class="wf412-nav-badge">${n>99?'99+':n}</span>`:''}`}catch(e){}
  }

  const observer=new MutationObserver(()=>{injectInquiryEntry();mountIncidentExtras();mountEditModifier()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  css();injectInquiryEntry();setTimeout(()=>{injectInquiryEntry();mountIncidentExtras();mountEditModifier()},50);
  window.ENL_WORKFLOW_VERSION=VERSION;
})();