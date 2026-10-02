/* E&L Accident Report App v4.2.4 - reader nav alerts + instant own comment deletion */
(function(){
  'use strict';
  const VERSION='4.4.45-two-stage-approval1';
  const DELETE_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-comment-delete-v424';
  const WORKFLOW_API_FRAGMENT='/functions/v1/enl-workflow-v412';
  const CLIENT='incident-report-v2';
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const uid=u=>String(u?.id||u?.personnelId||u?.username||'');
  const actor=u=>{try{return window.enlCurrentActor?.()||{id:uid(u),name:u?.name||'',role:roleNorm(u?.role),position:u?.position||u?.jobTitle||'',siteId:u?.siteId||''}}catch(e){return null}};
  const historicalClosed=i=>!!i&&i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&i?.historicalImport?.workflowExempt===true&&String(i?.historicalImport?.transferState||'')==='closed'&&String(i?.status||'')==='closed';
  const finalized=i=>historicalClosed(i)||!!i&&String(i.status||'')==='closed'&&String(i.corrective?.status||'')==='approved';
  const INQUIRY_SEEN_PREFIX='enl_reader_inquiry_seen_v424_';
  const commentOwners=new Map();
  let inquiryBusy=false,inquiryLastAt=0,inquiryUnread=false;
  let navQueued=false;

  function css(){
    if(document.getElementById('reader424Css'))return;
    const s=document.createElement('style');s.id='reader424Css';s.textContent=`
      .shell411-nav button{position:relative}
      .enl424-nav-dot{position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:50%;background:#d93636;border:2px solid #fff;box-shadow:0 0 0 1px rgba(173,36,36,.12);pointer-events:none}
      .enl424-nav-count{position:absolute;top:-8px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#c93434;color:#fff!important;border:2px solid #fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:950;line-height:1;box-shadow:0 3px 9px rgba(172,36,36,.28);pointer-events:none;z-index:2}
      .wf412-own-delete{background:#fff0f0!important;color:#9d3737!important;border:1px solid #e7b5b5!important}
      .wf412-own-delete:disabled{opacity:.55}
      @media(max-width:560px){.enl424-nav-dot{top:4px;right:4px;width:9px;height:9px}.enl424-nav-count{top:-7px;right:-5px;min-width:21px;height:21px;font-size:9.5px}.wf412-own-delete{width:auto!important}}
    `;document.head.appendChild(s)
  }

  function dot(btn,on,label='새로운 확인 사항이 있습니다'){
    if(!btn)return;
    let d=btn.querySelector(':scope > .enl424-nav-dot');
    if(on&&!d){d=document.createElement('span');d.className='enl424-nav-dot';d.setAttribute('aria-label',label);d.title=label;btn.appendChild(d)}
    else if(!on&&d)d.remove();
  }
  function navCount(btn,n,label='처리가 필요한 업무가 있습니다'){
    if(!btn)return;
    const value=Math.max(0,Number(n)||0);
    let b=btn.querySelector(':scope > .enl424-nav-count');
    if(value>0){
      if(!b){b=document.createElement('span');b.className='enl424-nav-count';btn.appendChild(b)}
      const shown=value>99?'99+':String(value);if(b.textContent!==shown)b.textContent=shown;
      const aria=`${label} ${value}건`;b.setAttribute('aria-label',aria);b.title=aria;
    }else if(b)b.remove();
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
    const pending=arr.filter(i=>!historicalClosed(i)&&['reported','supplement','supplement_submitted'].includes(String(i.status||'')));
    dot(document.querySelector('[data-shell-view="home"]'),pending.length>0,'새 사고보고 또는 보완 진행 건이 있습니다');
    dot(document.querySelector('[data-shell-view="incidents"]'),pending.length>0,'즉시보고·보완 진행 건이 있습니다');
    dot(document.querySelector('[data-lifecycle-closed]'),false);
  }
  function safetyHasOwnApproval(i,u,type='incident_report'){
    const id=uid(u);if(!id)return false;
    return (Array.isArray(i?.acknowledgements)?i.acknowledgements:[]).some(a=>String(a?.documentType||'incident_report')===type&&String(a?.userId||'')===id);
  }
  function safetyOwnApprovalPending(i,u){
    const status=String(i?.status||''),action=String(i?.corrective?.status||'');
    if(status==='approved')return safetyHasOwnApproval(i,u,'incident_report')?0:1;
    if(status==='closed'&&action==='approved'){
      if(!safetyHasOwnApproval(i,u,'incident_report'))return 1;
      if(!safetyHasOwnApproval(i,u,'closure_approval'))return 1;
    }
    return 0;
  }
  function safetyHasPlan(i){
    const c=i?.corrective||{};return !!String(c.planDetail||'').trim()||!!c.planAt;
  }
  function safetyActionCounts(u){
    const arr=[...(data?.incidents||[])].filter(i=>!historicalClosed(i));
    const incidentApproval=arr.filter(i=>['reported','supplement_submitted'].includes(String(i.status||''))).length;
    const ownApproval=arr.reduce((n,i)=>n+safetyOwnApprovalPending(i,u),0);
    const plan=arr.filter(i=>String(i.status||'')==='approved'&&!safetyHasPlan(i)&&String(i?.corrective?.status||'')!=='approved').length;
    const prevention=arr.filter(i=>String(i?.corrective?.status||'')==='submitted').length;
    return {incidentApproval,ownApproval,incident:incidentApproval+ownApproval,plan,prevention,actions:plan+prevention,total:incidentApproval+ownApproval+plan+prevention};
  }
  function safetyActionBadges(u){
    const counts=safetyActionCounts(u);
    const home=document.querySelector('[data-shell-view="home"]'),incidents=document.querySelector('[data-shell-view="incidents"]'),actions=document.querySelector('[data-shell-view="actions"]');
    // Old safety work indicators were dots. Action-required work is numeric now;
    // opening a tab never clears these because counts are derived from workflow state.
    dot(home,false);dot(incidents,false);dot(actions,false);
    navCount(home,counts.total,'안전관리자 처리 필요');
    navCount(incidents,counts.incident,'사고승인·보완승인·결재 처리 필요');
    navCount(actions,counts.actions,'재발방지계획·재발방지조치 처리 필요');
    return counts;
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

  function addDeleteButton(card,id,u,list){
    let actions=card.querySelector('.wf412-comment-actions');if(!actions){actions=document.createElement('div');actions.className='wf412-comment-actions';card.appendChild(actions)}
    if(actions.querySelector('[data-enl424-comment-delete]'))return;
    const b=document.createElement('button');b.type='button';b.className='wf412-own-delete';b.dataset.enl424CommentDelete=id;b.textContent='내 의견 삭제';
    b.onclick=async ev=>{ev.preventDefault();ev.stopPropagation();if(!confirm('내가 작성한 이 의견을 삭제할까요?'))return;b.disabled=true;b.textContent='삭제 중…';try{await deleteComment(id,u);commentOwners.delete(id);card.remove();if(!list.querySelector('.wf412-comment'))list.innerHTML='<div class="wf412-empty">등록된 관리자·경영진 의견이 없습니다.</div>'}catch(e){b.disabled=false;b.textContent='내 의견 삭제';alert(e?.message==='not_owner'?'본인이 작성한 의견만 삭제할 수 있습니다.':'의견을 삭제하지 못했습니다. 다시 시도해 주세요.')}};
    actions.appendChild(b);
  }

  function decorateOwnComments(){
    const u=currentUser?.();if(!isReader(u))return;
    const list=document.querySelector('#modalRoot .modal [data-wf-comments] .wf412-comments-list');if(!list)return;
    [...list.querySelectorAll('.wf412-comment')].forEach(card=>{
      const id=String(card.dataset.wfComment||'');if(!id)return;
      const owner=commentOwners.get(id);if(!owner)return;
      card.dataset.enl424OwnerChecked='1';
      if(String(owner)!==uid(u))return;
      addDeleteButton(card,id,u,list);
    });
  }

  function refreshNav(){
    const u=currentUser?.();if(!u)return;normalizeNavActive();
    if(isReader(u)){readerIncidentDots(u);refreshReaderInquiry(u,false)}
    else if(roleNorm(u.role)==='safety')safetyActionBadges(u);
  }
  function schedule(){if(navQueued)return;navQueued=true;requestAnimationFrame(()=>{navQueued=false;refreshNav();decorateOwnComments()})}

  // Capture the ownership data from the same comment_list response that paints the comments.
  // This removes the old second network request that made the delete button appear late.
  const priorFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:String(input?.url||'');let body=null;
    try{body=JSON.parse(init?.body||'null')}catch(e){}
    const res=await priorFetch(input,init);
    if(url.includes(WORKFLOW_API_FRAGMENT)&&body?.action==='comment_list'&&res?.ok){
      try{
        const j=await res.clone().json();
        (j?.comments||[]).forEach(c=>{const id=String(c?.comment_id||'');if(id)commentOwners.set(id,String(c?.author_id||''))});
      }catch(e){}
    }
    return res;
  };

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
  window.enlSafetyActionCounts=u=>safetyActionCounts(u||currentUser?.());
  window.enlRefreshSafetyActionBadges=()=>{const u=currentUser?.();if(roleNorm(u?.role)==='safety')return safetyActionBadges(u);return null};
  // Paint current badges immediately as well as on the queued observer cycle.
  // This avoids a first-frame gap on WebKit/PWA where requestAnimationFrame can be deferred.
  try{refreshNav()}catch(e){}
  schedule();
  window.ENL_READER_EXPERIENCE_VERSION=VERSION;
})();
