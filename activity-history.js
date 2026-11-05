/* Role-scoped activity feed. The server owns both the audit trail and each user's read state. */
(()=>{
  'use strict';
  const stamp=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'});
  const occurred=raw=>raw&&Number.isFinite(Date.parse(raw))?day.format(new Date(raw)):'';
  const actor=()=>window.enlCurrentActor?.();
  const canView=u=>['safety','manager','final','executive'].includes(u?.role)||(u?.role==='field'&&!!u.siteId&&['현장소장','파트장','서무'].includes(u.position||u.jobTitle));
  window.enlHistoryAvailable=canView;
  const menuSelector='[data-recent-history],[data-platform-history-feed]';
  const userId=()=>{const a=actor();return a?.id&&canView(a)?JSON.stringify([a.role,a.siteId,a.id]):'';};
  const api=body=>window.enlIncidentApi({...body,actor:actor()});
  const safe=v=>esc(String(v??''));
  let account='',counts={common:0,incident:0},checked=0,serial=0,opening=0,requested=false,activeHistory=null;
  function owner(){
    const id=userId();
    if(account!==id){account=id;counts={common:0,incident:0};checked=0;serial++;opening=0;requested=false;activeHistory=null;}
    return id;
  }
  function paint(){
    for(const b of document.querySelectorAll(menuSelector)){
    const count=counts[b.hasAttribute('data-platform-history-feed')?'common':'incident'];
    let badge=b.querySelector('.activity-count');
    if(!count){badge?.remove();if(b.hasAttribute('data-platform-history-feed'))b.setAttribute('aria-label',b.dataset.platformHistoryFeed||'통합 히스토리');else b.removeAttribute('aria-label');continue;}
    if(!badge){badge=document.createElement('span');badge.className='enl424-nav-count activity-count';b.append(badge);}
    badge.textContent=String(count);b.setAttribute('aria-label',(b.hasAttribute('data-platform-history-feed')?(b.dataset.platformHistoryFeed||'통합 히스토리'):'사용자 기록')+', 미확인 '+count+'건');
    }
  }
  async function refresh(force=false){
    const id=owner();if(activeHistory&&!activeHistory.isConnected)activeHistory=null;
    if(!id||!document.querySelector(menuSelector))return;
    paint();if(opening||document.hidden||!window.enlIncidentApi||(!force&&Date.now()-checked<30000))return;
    checked=Date.now();const token=++serial;
    try{
      const feeds=[...new Set([...document.querySelectorAll(menuSelector)].map(b=>b.hasAttribute('data-platform-history-feed')?'common':'incident'))];
      await Promise.all(feeds.map(async feed=>{const r=await api({action:'activity_count',feed});
        if(token===serial&&userId()===id){counts[feed]=r.unread;paint();}
      }));
    }
    catch{if(token===serial)checked=0;}
  }
  async function openDoc(row,host,id){
    const live=()=>host.isConnected&&userId()===id;
    try{
      if(row.module_key&&row.module_key!=='incident'&&!/^(site|hq|personnel)_/.test(row.kind)){
        openModal('<div class="modal-head"><h2>처리 기록</h2><button data-close>닫기</button></div><p>'+safe(row.sentence)+'</p><small>'+safe(stamp.format(new Date(row.happened_at)))+'</small>');return;
      }
      if(/^(site|hq|personnel)_/.test(row.kind)){
        if(actor().role==='safety')await window.enlOpenHistorySetting(row,live);
        else openModal('<div class="modal-head"><h2>설정 변경 기록</h2><button data-close>닫기</button></div><p>'+safe(row.sentence)+'</p><small>'+safe(stamp.format(new Date(row.happened_at)))+'</small>');
        return;
      }
      const r=await api({action:'activity_document',incidentId:row.incident_id});if(!live())return;
      if(r.archived){
        // Use a separate read-only dialog so the ordinary review decorators cannot add edit actions.
        const dialog=document.createElement('dialog');dialog.className='activity-archive';
        dialog.innerHTML='<button type="button" class="secondary">닫기</button><h2>삭제된 사고 보관본</h2><p>'+safe(r.deletedBy||'기록 없음')+' / '+safe(stamp.format(new Date(r.deletedAt)))+'</p><p>삭제 사유: '+safe(r.reason||'기록 없음')+'</p>'+window.enlIncidentSummaryHtml(r.incident,{includeOriginal:true});
        dialog.querySelectorAll('[data-attach-open]').forEach(el=>el.remove());
        dialog.querySelector('button').onclick=()=>dialog.close();
        dialog.onclose=()=>dialog.remove();host.append(dialog);dialog.showModal();refresh(true);return;
      }
      if(!data.incidents.some(i=>String(i.id)===row.incident_id))await window.enlIncidentPullNow(false);
      if(live())window.enlOpenIncidentReview(row.incident_id,actor().role==='safety',currentUser());
    }catch{if(live())alert('연결된 사고기록을 불러오지 못했습니다. 다시 시도해 주세요.');}
  }
  function cleanupProof(host){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='activity-archive platform-proof';
      dialog.innerHTML='<form><h2>안전관리자 확인</h2><label>처리 사유<textarea required minlength="2" maxlength="1000"></textarea></label><label>현재 비밀번호<input type="password" autocomplete="current-password" required maxlength="256"></label><button type="button">취소</button><button type="submit">확인</button></form>';
      let result=null;dialog.onclose=()=>{dialog.remove();resolve(result)};
      dialog.querySelector('[type=button]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=e=>{e.preventDefault();result={reason:dialog.querySelector('textarea').value.trim(),password:dialog.querySelector('input').value};dialog.querySelector('input').value='';dialog.close()};
      host.append(dialog);dialog.showModal();
    });
  }
  function render(root,feed='incident'){
    const id=owner();if(!id)return;
    const mark=requested;requested=false;
    // Background sync may rebuild the shell while the user is editing search or removal dates.
    if(!mark&&activeHistory?.dataset.feed===feed){if(activeHistory.parentElement!==root)root.replaceChildren(activeHistory);return;}
    const host=document.createElement('section');host.className='panel activity-history';host.dataset.feed=feed;root.replaceChildren(host);activeHistory=host;
    host.innerHTML='<div class="section-head"><h2>통합 히스토리</h2><button type="button" class="secondary" data-refresh>새로고침</button></div><form class="activity-filters"><label>기간<select name="range"><option value="recent">최근 30일</option><option value="month">월별 조회</option><option value="custom">기간 지정</option><option value="all">전체 기간</option></select></label><label hidden data-month>조회 월<input type="month" name="month"></label><label hidden data-custom>시작일<input type="date" name="start"></label><label hidden data-custom>종료일<input type="date" name="end"></label><label>검색어<input type="search" name="q" maxlength="120" placeholder="이름, 사업장, 사고, 처리 내용"></label><button class="secondary" type="submit">검색</button></form><p role="status"></p><ol></ol><button type="button" class="secondary" data-more hidden>이전 기록 더 보기</button>';
    host.querySelector('h2').textContent=feed==='common'?'통합 히스토리':'사고보고 사용자 기록';
    if(feed==='common')host.querySelector('.section-head').insertAdjacentHTML('afterend','<p>사용자 계정, 이메일, 사업장 정보의 변경 기록입니다.</p>');
    const list=host.querySelector('ol'),status=host.querySelector('[role=status]'),more=host.querySelector('[data-more]');
    const form=host.querySelector('form'),controls=form.elements;
    const names={incident:'사고보고',common:'공통 시스템',risk:'위험성평가',tbm:'TBM',organization:'안전보건조직',training:'안전보건교육'};
    const kinds={create:'최초 등록',view:'최초 조회',approve:'최초 승인',reject:'반려',supplement_request:'보완 요청',supplement_submit:'보완 제출',plan_create:'계획 수립',plan_edit:'계획 수정',corrective_submit:'조치 제출',corrective_reject:'조치 보완',corrective_approve:'조치 승인',executive_sign:'경영진 결재',executive_reject:'경영진 반려',final_approval:'최종 결재',update:'수정',delete:'삭제',cause_save:'원인분석 저장',cost_added:'비용 추가',post_approval_revision:'승인 후 수정',correct_closed:'종결 정정',resubmit:'재제출',supplement_resubmit:'보완 재제출',site_create:'현장 등록',site_update:'현장 변경',personnel_create:'인원 등록',personnel_update:'인원 변경',personnel_delete:'인원 삭제',personnel_retire:'퇴사',personnel_reactivate:'복직',hq_create:'본사 계정 등록',hq_update:'본사 계정 변경'};
    kinds.email_registered='이메일 등록';
    const feedKinds=Object.fromEntries(Object.entries(kinds).filter(([k])=>/^(hq_|personnel_|site_|email_)/.test(k)===(feed==='common')));
    const options=obj=>'<option value="">전체</option>'+Object.entries(obj).map(([k,v])=>'<option value="'+safe(k)+'">'+safe(v)+'</option>').join('');
    form.querySelector('[type=submit]').insertAdjacentHTML('beforebegin','<label>사업장<input name="site" maxlength="100"></label><label>사용자<input name="person" maxlength="100"></label><label>처리유형<select name="kind">'+options(feedKinds)+'</select></label><label>처리결과<select name="result">'+options(Object.fromEntries(['승인','반려','보완요청','종결','처리완료'].map(v=>[v,v])))+'</select></label>');
    if(feed==='common'){controls.q.placeholder='이름, 사업장, 계정 변경 내용';controls.result.closest('label').remove();}
    const today=day.format(new Date()),recent=day.format(new Date(Date.parse(today+'T12:00:00+09:00')-29*86400000));
    controls.month.value=today.slice(0,7);controls.start.value=recent;controls.end.value=today;
    let before='',busy=false,request=0,filters={fromDate:recent,toDate:today,search:''};
    const canDelete=actor().role==='safety';
    let deleting=false;
    async function removeHistory(payload,label){
      if(deleting||!host.isConnected||userId()!==id||!confirm(label+(payload.mode==='restore'?' 복구할까요?':' 삭제할까요?')+' 모든 사용자의 기록 목록에 적용됩니다. 사고보고서는 유지됩니다.'))return;
      deleting=true;
      try{
        const proof=await cleanupProof(host);if(!proof||!host.isConnected||userId()!==id)return;
        const restoring=payload.mode==='restore';
        const result=await api({action:restoring?'activity_restore':'activity_delete',...payload,...proof,feed,confirmed:true});
        if(host.isConnected&&userId()===id){await load(true,false);await refresh(true);notice.textContent=restoring?result.restored+'건을 복구했습니다.':result.removed+'건을 정리했습니다.';if(audit.open)await loadAudit();}
      }catch(err){if(host.isConnected)notice.textContent=err.message==='password_incorrect'?'비밀번호가 일치하지 않습니다.':err.message==='password_attempts_exceeded'?'확인 횟수를 초과했습니다. 15분 뒤 다시 시도하세요.':'작업 결과를 확인하지 못했습니다. 새로고침 후 확인해 주세요.';}
      finally{deleting=false;}
    }
    const audit=document.createElement('details');audit.className='history-manage';
    async function loadAudit(before=''){
      const log=audit.querySelector('ol'),next=audit.querySelector('[data-next]');next.disabled=true;
      try{const r=await api({action:'activity_cleanup_audit',before,feed});if(!before)log.replaceChildren();
        for(const x of r.rows){const li=document.createElement('li');li.textContent=stamp.format(new Date(x.at))+' / '+x.actor_name+' / '+({one:'개별',range:'기간',all:'전체'}[x.mode])+ ' '+x.count+'건 / '+x.reason+(x.scope?.from?' / '+x.scope.from+' ~ '+x.scope.to:'')+(x.scope?.id?' / 번호 '+x.scope.id:'');
          if(x.restored_at)li.append(' / 복구 '+stamp.format(new Date(x.restored_at))+' '+x.restored_by+' / '+x.restore_reason);
          else if(x.count){const b=document.createElement('button');b.type='button';b.textContent='복구';b.onclick=()=>removeHistory({mode:'restore',id:x.id},'이 작업으로 정리한 기록을');li.append(b);}log.append(li);}
        next.hidden=!r.more;next.onclick=()=>loadAudit(r.rows.at(-1).id);if(!log.children.length)log.textContent='정리 이력이 없습니다.';
      }catch{notice.textContent='감사기록을 불러오지 못했습니다.'}finally{next.disabled=false;}
    }
    const notice=document.createElement('p');notice.setAttribute('role','status');
    if(canDelete){
      const manage=document.createElement('details');manage.className='history-manage';
      manage.innerHTML='<summary>기록 삭제 관리</summary><form><label>삭제 시작일<input type="date" name="start" required></label><label>삭제 종료일<input type="date" name="end" required></label><button type="submit">기간별 삭제</button><button type="button" data-delete-all>전체 삭제</button></form>';
      form.after(manage);manage.after(notice,audit);audit.innerHTML='<summary>정리 감사기록 및 복구</summary><ol></ol><button type="button" data-next hidden>이전 작업 더 보기</button>';audit.ontoggle=()=>{if(audit.open)loadAudit()};
      const range=manage.querySelector('form');
      range.onsubmit=e=>{e.preventDefault();const fromDate=range.elements.start.value,toDate=range.elements.end.value;
        if(fromDate>toDate){notice.textContent='종료일은 시작일 이후로 선택해 주세요.';return;}
        removeHistory({mode:'range',fromDate,toDate},fromDate+'부터 '+toDate+'까지의 사용자 기록을 모두');};
      manage.querySelector('[data-delete-all]').onclick=()=>removeHistory({mode:'all'},'전체 기간의 사용자 기록을 모두');
    }
    function apply(){
      let fromDate='',toDate='';
      if(controls.range.value==='recent'){fromDate=recent;toDate=today;}
      if(controls.range.value==='custom'){fromDate=controls.start.value;toDate=controls.end.value;}
      if(controls.range.value==='month'){
        const month=controls.month.value;if(!/^\d{4}-\d{2}$/.test(month)){status.textContent='조회할 월을 선택해 주세요.';return;}
        fromDate=month+'-01';const last=new Date(fromDate+'T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);toDate=last.toISOString().slice(0,10);
      }
      if(fromDate&&toDate&&fromDate>toDate){status.textContent='종료일은 시작일 이후로 선택해 주세요.';return;}
      filters={fromDate,toDate,search:controls.q.value.trim(),...Object.fromEntries(['site','person','kind','result'].filter(k=>controls[k]).map(k=>[k,controls[k].value.trim()]))};load(true,false);
    }
    controls.range.onchange=()=>{
      form.querySelector('[data-month]').hidden=controls.range.value!=='month';
      form.querySelectorAll('[data-custom]').forEach(el=>el.hidden=controls.range.value!=='custom');
      apply();
    };
    controls.month.onchange=apply;form.onsubmit=e=>{e.preventDefault();apply();};
    async function load(first,ack){
      if(busy&&!first||!id||userId()!==id)return;const seq=++request;busy=true;more.disabled=true;
      const token=ack?++serial:0;if(ack)opening=token;
      if(first){before='';more.hidden=true;list.replaceChildren();}
      status.textContent='기록을 불러오는 중입니다.';
      try{
        const r=await api({action:first?(ack?'activity_open':'activity_list'):'activity_page',before,feed,...filters});
        if(userId()!==id)return;
        if(ack&&token===serial){counts[feed]=0;checked=Date.now();paint();}
        if(!host.isConnected||seq!==request)return;
        if(first)list.replaceChildren();
        for(const row of r.rows){
          const item=document.createElement('li'),button=document.createElement('button');button.type='button';
          button.innerHTML='<small>'+safe(stamp.format(new Date(row.happened_at)))+'　'+safe(row.role_label)+'　'+safe(names[row.module_key]||'사고보고')+'　'+safe(row.result_label||'')+(row.occurred_text?'　사고일 '+safe(occurred(row.occurred_text)):'')+'</small><strong>'+safe(row.sentence)+'</strong>';
          button.onclick=()=>openDoc(row,host,id);item.append(button);
          if(canDelete){
            const remove=document.createElement('button');remove.type='button';remove.className='history-remove';remove.textContent='×';
            remove.setAttribute('aria-label','기록 삭제: '+row.sentence);remove.onclick=()=>removeHistory({mode:'one',id:row.id},'이 기록을');item.append(remove);
          }
          list.append(item);before=row.id;
        }
        more.hidden=!r.more;status.textContent=list.childElementCount?'최신순 / 한국시간':'조건에 맞는 기록이 없습니다.';
      }catch{if(host.isConnected&&seq===request)status.textContent='기록을 불러오지 못했습니다. 다시 시도해 주세요.';}
      finally{if(opening===token)opening=0;if(seq===request){busy=false;more.disabled=false;}}
    }
    host.querySelector('[data-refresh]').onclick=()=>load(true,true);more.onclick=()=>load(false,false);load(true,mark);
  }
  window.enlRequestHistory=()=>{owner();requested=true;};
  window.enlRenderHistory=render;window.enlRefreshHistoryCount=refresh;
  window.addEventListener('focus',()=>refresh(true));
  for(const event of ['enl-activity-changed','enl-incident-saved'])window.addEventListener(event,()=>refresh(true));
  setInterval(()=>refresh(),30000);refresh();
  window.dispatchEvent(new Event('enl-history-ready'));
})();
