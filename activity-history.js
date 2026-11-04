/* Safety-only activity feed. The server owns both the audit trail and each user's read state. */
(()=>{
  'use strict';
  const verbs={
    create:'사고를 등록했습니다',update:'사고보고를 수정했습니다',delete:'사고보고를 삭제했습니다',restore:'사고기록 복구를 처리했습니다',
    view:'사고를 조회했습니다',archive_view:'삭제된 사고 보관본을 조회했습니다',action_view:'재발방지조치를 조회했습니다',final_view:'종결 결재본을 조회했습니다',
    approve:'최초 사고보고를 승인했습니다',reject:'사고보고를 반려했습니다',resubmit:'사고보고를 수정해 다시 제출했습니다',
    supplement_request:'자료 보완을 요청했습니다',supplement_submit:'보완자료를 제출했습니다',supplement_resubmit:'보완자료를 다시 제출했습니다',
    plan_create:'재발방지계획을 작성했습니다',plan_edit:'재발방지계획을 수정했습니다',action_save:'재발방지조치 내용을 저장했습니다',
    corrective_submit:'재발방지조치를 작성해 제출했습니다',corrective_reject:'재발방지조치 보완을 요청했습니다',corrective_approve:'재발방지조치를 승인했습니다',
    executive_sign:'경영진 결재를 완료했습니다',executive_reject:'경영진 결재를 반려했습니다',final_approval:'최종 결재를 완료하여 사고가 종결됐습니다',
    acknowledge:'문서 확인을 기록했습니다',correct_closed:'사고보고를 정정했습니다',post_approval_revision:'승인된 사고보고를 수정했습니다',
    attachment_add:'첨부자료를 등록했습니다',attachment_delete:'첨부자료를 삭제했습니다',cost_added:'사고 비용을 추가했습니다',
    cause_save:'원인분석을 저장했습니다',erp_record:'ERP 기안 기록을 저장했습니다'
  };
  const roles={safety:'안전관리자',executive:'경영진',manager:'본사실무자',final:'본사실무자',field:'현장관리자',worker:'근로자'};
  const stamp=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'});
  const occurred=raw=>raw&&Number.isFinite(Date.parse(raw))?day.format(new Date(raw)):'';
  const actor=()=>window.enlCurrentActor?.();
  const userId=()=>{const a=actor();return a?.role==='safety'?String(a.id):'';};
  const api=body=>window.enlIncidentApi({...body,actor:actor()});
  const safe=v=>esc(String(v??''));
  let account='',count=0,checked=0,serial=0,opening=0,requested=false;
  function owner(){
    const id=userId();
    if(account!==id){account=id;count=0;checked=0;serial++;opening=0;requested=false;}
    return id;
  }
  function paint(){
    const b=document.querySelector('[data-shell-view="history"]');
    if(!b)return;
    let badge=b.querySelector('.activity-count');
    if(!count){badge?.remove();b.removeAttribute('aria-label');return;}
    if(!badge){badge=document.createElement('span');badge.className='activity-count';b.append(badge);}
    badge.textContent=count>99?'99+':String(count);b.setAttribute('aria-label','히스토리, 미확인 '+count+'건');
  }
  async function refresh(force=false){
    const id=owner();if(!id||!document.querySelector('[data-shell-view="history"]'))return;
    paint();if(opening||document.hidden||!window.enlIncidentApi||(!force&&Date.now()-checked<30000))return;
    checked=Date.now();const token=++serial;
    try{const r=await api({action:'activity_count'});if(token===serial&&userId()===id){count=r.unread;paint();}}
    catch{if(token===serial)checked=0;}
  }
  async function openDoc(row,host,id){
    const live=()=>host.isConnected&&userId()===id;
    try{
      const r=await api({action:'activity_document',incidentId:row.incident_id,visitId:crypto.randomUUID()});if(!live())return;
      if(r.archived){
        // Use a separate read-only dialog so the ordinary review decorators cannot add edit actions.
        const dialog=document.createElement('dialog');dialog.className='activity-archive';
        dialog.innerHTML='<button type="button" class="secondary">닫기</button><h2>삭제된 사고 보관본</h2><p>'+safe(r.deletedBy||'기록 없음')+' / '+safe(stamp.format(new Date(r.deletedAt)))+'</p><p>삭제 사유: '+safe(r.reason||'기록 없음')+'</p>'+window.enlIncidentSummaryHtml(r.incident,{includeOriginal:true});
        dialog.querySelectorAll('[data-attach-open]').forEach(el=>el.remove());
        dialog.querySelector('button').onclick=()=>dialog.close();
        dialog.onclose=()=>dialog.remove();host.append(dialog);dialog.showModal();refresh(true);return;
      }
      if(!data.incidents.some(i=>String(i.id)===row.incident_id))await window.enlIncidentPullNow(false);
      if(live())window.enlOpenIncidentReview(row.incident_id,true,currentUser());
    }catch{if(live())alert('연결된 사고기록을 불러오지 못했습니다. 다시 시도해 주세요.');}
  }
  function render(root){
    const id=owner();if(!id)return;
    const mark=requested;requested=false;
    const host=document.createElement('section');host.className='panel activity-history';root.replaceChildren(host);
    host.innerHTML='<div class="section-head"><h2>히스토리</h2><button type="button" class="secondary" data-refresh>새로고침</button></div><p role="status"></p><ol></ol><button type="button" class="secondary" data-more hidden>이전 기록 더 보기</button>';
    const list=host.querySelector('ol'),status=host.querySelector('[role=status]'),more=host.querySelector('[data-more]');
    let before='',busy=false;
    async function load(first,ack){
      if(busy||!id||userId()!==id)return;busy=true;more.disabled=true;
      const token=ack?++serial:0;if(ack)opening=token;
      status.textContent='기록을 불러오는 중입니다.';
      try{
        const r=await api({action:first?(ack?'activity_open':'activity_list'):'activity_page',before});
        if(userId()!==id)return;
        if(ack&&token===serial){count=0;checked=Date.now();paint();}
        if(!host.isConnected)return;
        if(first)list.replaceChildren();
        for(const row of r.rows){
          const item=document.createElement('li'),button=document.createElement('button');button.type='button';
          button.innerHTML='<small>'+safe(stamp.format(new Date(row.happened_at)))+'　'+safe(roles[row.actor_role]||row.actor_role||'역할 미기록')+'</small><strong>'+safe(row.actor_name||'작성자 미기록')+'　'+safe(verbs[row.kind]||'사고 업무를 처리했습니다')+'</strong><span>'+safe(row.site_name||row.site_id||'현장 미기록')+' / '+safe([occurred(row.occurred_text),row.incident_title||row.incident_id].filter(Boolean).join(' / '))+'</span>';
          button.onclick=()=>openDoc(row,host,id);item.append(button);list.append(item);before=row.id;
        }
        more.hidden=!r.more;status.textContent=list.childElementCount?'최신순 / 한국시간':'기록된 활동이 없습니다.';
      }catch{if(host.isConnected)status.textContent='기록을 불러오지 못했습니다. 다시 시도해 주세요.';}
      finally{if(opening===token)opening=0;busy=false;more.disabled=false;}
    }
    host.querySelector('[data-refresh]').onclick=()=>load(true,true);more.onclick=()=>load(false,false);load(true,mark);
  }
  window.enlRequestHistory=()=>{owner();requested=true;};
  window.enlRenderHistory=render;window.enlRefreshHistoryCount=refresh;
  window.addEventListener('focus',()=>refresh(true));
  for(const event of ['enl-activity-changed','enl-incident-saved'])window.addEventListener(event,()=>refresh(true));
  setInterval(()=>refresh(),30000);refresh();
})();
