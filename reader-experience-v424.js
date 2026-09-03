/* E&L Accident Report App v4.2.4 - reader nav alerts + own comment deletion */
(function(){
  'use strict';
  const VERSION='4.2.4-reader-experience1';
  const DELETE_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-comment-delete-v424';
  const CLIENT='incident-report-v2';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const uid=u=>String(u?.id||u?.personnelId||u?.username||'');
  const actor=u=>{try{return window.enlCurrentActor?.()||{id:uid(u),name:u?.name||'',role:roleNorm(u?.role),position:u?.position||u?.jobTitle||'',siteId:u?.siteId||''}}catch(e){return null}};
  const finalized=i=>!!i&&String(i.status||'')==='closed'&&String(i.corrective?.status||'')==='approved';
  const receiptFor=(i,u)=>(Array.isArray(i?.readReceipts)?i.readReceipts:[]).find(r=>String(r?.userId||'')===uid(u));
  const INQUIRY_SEEN_PREFIX='enl_reader_inquiry_seen_v424_';
  let inquiryBusy=false,inquiryLastAt=0,inquiryUnread=false;
  let commentBusy=false,commentTimer=null,navQueued=false;

  function css(){
    if(document.getElementById('reader424Css'))return;
    const s=document.createElement('style');s.id='reader424Css';s.textContent=`
      .shell411-nav button{position:relative}
      .enl424-nav-dot{position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:50%;background:#d93636;border:2px solid #fff;box-shadow:0 0 0 1px rgba(173,36,36,.12);pointer-events:none}
      .wf412-own-delete{background:#fff0f0!important;color:#9d3737!important;border:1px solid #e7b5b5!important}
      .wf412-own-delete:disabled{opacity:.55}
      @media(max-width:560px){.enl424-nav-dot{top:4px;right:4px;width:9px;height:9px}.wf412-own-delete{width:auto!important}}
    `;document.head.appendChild(s)
  }

  function dot(btn,on,label='새로운 확인 사항이 있습니다'){
    if(!btn)return;
    let d=btn.querySelector(':scope > .enl424-nav-dot');
    if(on&&!d){d=document.createElement('span');d.className='enl424-nav-dot';d.setAttribute('aria-label',label);d.title=label;btn.appendChild(d)}
    else if(!on&&d)d.remove();
  }

  function activeButton(){
    const nav=document.querySelector('.shell411-nav');if(!nav)return null;
    if(document.querySelector('.wf412-page'))return nav.querySelector('[data-wf-inquiry-nav]');
    if(document.querySelector('.lifecycle413-closed-list'))return nav.querySelector('[data-lifecycle-closed]');
    return nav.querySelector(`[data-shell-view="${CSS.escape(String(currentView||'home'))}"]`)||nav.querySelector('[data-shell-view="home"]');
  }
  function normalizeNavActive(){
    const nav=document.querySelector('.shell411-nav');if(!nav)return;
    const active=activeButton();nav.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===active));
  }

  function readerIncidentDots(u){
    const arr=[...(data?.incidents||[])];
    const unreadApproved=arr.filter(i=>String(i.status||'')==='approved'&&!receiptFor(i,u));
    const unreadClosed=arr.filter(i=>finalized(i)&&!receiptFor(i,u));
    dot(document.querySelector('[data-shell-view="home"]'),unreadApproved.length+unreadClosed.length>0,'아직 열람 확인하지 않은 사고가 있습니다');
    dot(document.querySelector('[data-shell-view="incidents"]'),unreadApproved.length>0,'열람 확인이 필요한 승인사고가 있습니다');
    dot(document.querySelector('[data-lifecycle-closed]'),unreadClosed.length>0,'열람 확인이 필요한 종결사고가 있습니다');
  }
  function safetyWorkDots(u){
    const arr=[...(data?.incidents||[])],reported=arr.some(i=>String(i.status||'')==='reported'),actions=arr.some(i=>String(i.corrective?.status||'')==='submitted');
    dot(document.querySelector('[data-shell-view="home"]'),reported||actions,'검토가 필요한 새 업무가 있습니다');
    dot(document.querySelector('[data-shell-view="incidents"]'),reported,'검토대기 사고가 있습니다');
    dot(document.querySelector('[data-shell-view="actions"]'),actions,'검토대기 사고조치가 있습니다');
  }

  function inquirySeenKey(u){return INQUIRY_SEEN_PREFIX+uid(u)}
  function inquirySeen(u){try{return Number(localStorage.getItem(inquirySeenKey(u))||0)||0}catch(e){return 0}}
  function markInquirySeen(u){if(!u)return;try{localStorage.setItem(inquirySeenKey(u),String(Date.now()))}catch(e){}inquiryUnread=false;dot(document.querySelector('[data-wf-inquiry-nav]'),false)}
  async function refreshReaderInquiry(u,force=false){
    if(!isReader(u)||typeof window.enlWorkflowApi!=='function')return;
    const now=Date.now();if(inquiryBusy||(!force&&now-inquiryLastAt<30000)){dot(document.querySelector('[data-wf-inquiry-nav]'),inquiryUnread,'안전관리자 문의에 새 답변이 있습니다');return}
    inquiryBusy=true;inquiryLastAt=now;
    try{
      const r=await window.enlWorkflowApi({action:'inquiry_my_list',actor:actor(u)}),seen=inquirySeen(u);
      inquiryUnread=(r?.inquiries||[]).some(x=>{
        if(!x?.answer_body&&!['answered','closed'].includes(String(x?.status||'')))return false;
        const t=Date.parse(x.answered_at||x.updated_at||x.created_at||'');return Number.isFinite(t)&&t>seen;
      });
    }catch(e){}finally{inquiryBusy=false;dot(document.querySelector('[data-wf-inquiry-nav]'),inquiryUnread,'안전관리자 문의에 새 답변이 있습니다')}
  }

  async function deleteComment(commentId,u){
    const r=await fetch(DELETE_API,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},body:JSON.stringify({action:'delete',actor:actor(u),commentId}),cache:'no-store'});
    const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false){const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;throw e}return j;
  }
  async function decorateOwnComments(){
    const u=currentUser?.();if(!isReader(u)||commentBusy)return;
    const modal=document.querySelector('#modalRoot .modal'),final=modal?.querySelector('[data-lifecycle-final]'),box=modal?.querySelector('[data-wf-comments]'),list=box?.querySelector('.wf412-comments-list');
    if(!modal||!final||!box||!list)return;
    const cards=[...list.querySelectorAll('.wf412-comment')];if(!cards.length||cards.every(c=>c.dataset.enl424OwnerChecked==='1'))return;
    const incidentId=String(final.getAttribute('data-lifecycle-final')||'');if(!incidentId||typeof window.enlWorkflowApi!=='function')return;
    commentBusy=true;
    try{
      const r=await window.enlWorkflowApi({action:'comment_list',actor:actor(u),incidentId}),map=new Map((r?.comments||[]).map(c=>[String(c.comment_id||''),c]));
      cards.forEach(card=>{
        card.dataset.enl424OwnerChecked='1';const id=String(card.dataset.wfComment||''),c=map.get(id);if(!c||String(c.author_id||'')!==uid(u))return;
        let actions=card.querySelector('.wf412-comment-actions');if(!actions){actions=document.createElement('div');actions.className='wf412-comment-actions';card.appendChild(actions)}
        if(actions.querySelector('[data-enl424-comment-delete]'))return;
        const b=document.createElement('button');b.type='button';b.className='wf412-own-delete';b.dataset.enl424CommentDelete=id;b.textContent='내 의견 삭제';
        b.onclick=async ev=>{ev.preventDefault();ev.stopPropagation();if(!confirm('내가 작성한 이 의견을 삭제할까요?'))return;b.disabled=true;b.textContent='삭제 중…';try{await deleteComment(id,u);card.remove();if(!list.querySelector('.wf412-comment'))list.innerHTML='<div class="wf412-empty">등록된 관리자·경영진 의견이 없습니다.</div>'}catch(e){b.disabled=false;b.textContent='내 의견 삭제';alert(e?.message==='not_owner'?'본인이 작성한 의견만 삭제할 수 있습니다.':'의견을 삭제하지 못했습니다. 다시 시도해 주세요.')}};
        actions.appendChild(b);
      });
    }catch(e){}finally{commentBusy=false}
  }

  function refreshNav(){
    const u=currentUser?.();if(!u)return;normalizeNavActive();
    if(isReader(u)){readerIncidentDots(u);refreshReaderInquiry(u,false)}
    else if(roleNorm(u.role)==='safety')safetyWorkDots(u);
  }
  function schedule(){if(navQueued)return;navQueued=true;requestAnimationFrame(()=>{navQueued=false;refreshNav();clearTimeout(commentTimer);commentTimer=setTimeout(decorateOwnComments,80)})}

  css();
  document.addEventListener('click',e=>{
    const u=currentUser?.(),b=e.target?.closest?.('.shell411-nav button');if(!b)return;
    if(b.matches('[data-wf-inquiry-nav]')&&isReader(u))markInquirySeen(u);
    setTimeout(schedule,0);
  },true);
  const root=document.getElementById('app')||document.body,mo=new MutationObserver(schedule);mo.observe(root,{childList:true,subtree:true});
  setInterval(()=>{const u=currentUser?.();if(u&&document.visibilityState!=='hidden'){refreshNav();decorateOwnComments()}},30000);
  window.addEventListener('pageshow',()=>setTimeout(schedule,80));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(schedule,80)});
  schedule();
  window.ENL_READER_EXPERIENCE_VERSION=VERSION;
})();