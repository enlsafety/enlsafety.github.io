/* Safety-only activity feed. The server owns both the audit trail and each user's read state. */
(()=>{
  'use strict';
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
    badge.textContent=String(count);b.setAttribute('aria-label','히스토리, 미확인 '+count+'건');
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
      if(/^(site|hq|personnel)_/.test(row.kind)){
        await window.enlOpenHistorySetting(row,live);return;
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
      if(live())window.enlOpenIncidentReview(row.incident_id,true,currentUser());
    }catch{if(live())alert('연결된 사고기록을 불러오지 못했습니다. 다시 시도해 주세요.');}
  }
  function render(root){
    const id=owner();if(!id)return;
    const mark=requested;requested=false;
    const host=document.createElement('section');host.className='panel activity-history';root.replaceChildren(host);
    host.innerHTML='<div class="section-head"><h2>히스토리</h2><button type="button" class="secondary" data-refresh>새로고침</button></div><form class="activity-filters"><label>기간<select name="range"><option value="recent">최근 30일</option><option value="month">월별 조회</option><option value="custom">기간 지정</option><option value="all">전체 기간</option></select></label><label hidden data-month>조회 월<input type="month" name="month"></label><label hidden data-custom>시작일<input type="date" name="start"></label><label hidden data-custom>종료일<input type="date" name="end"></label><label>검색어<input type="search" name="q" maxlength="120" placeholder="이름, 사업장, 사고, 처리 내용"></label><button class="secondary" type="submit">검색</button></form><p role="status"></p><ol></ol><button type="button" class="secondary" data-more hidden>이전 기록 더 보기</button>';
    const list=host.querySelector('ol'),status=host.querySelector('[role=status]'),more=host.querySelector('[data-more]');
    const form=host.querySelector('form'),controls=form.elements;
    const today=day.format(new Date()),recent=day.format(new Date(Date.parse(today+'T12:00:00+09:00')-29*86400000));
    controls.month.value=today.slice(0,7);controls.start.value=recent;controls.end.value=today;
    let before='',busy=false,request=0,filters={fromDate:recent,toDate:today,search:''};
    function apply(){
      let fromDate='',toDate='';
      if(controls.range.value==='recent'){fromDate=recent;toDate=today;}
      if(controls.range.value==='custom'){fromDate=controls.start.value;toDate=controls.end.value;}
      if(controls.range.value==='month'){
        const month=controls.month.value;if(!/^\d{4}-\d{2}$/.test(month)){status.textContent='조회할 월을 선택해 주세요.';return;}
        fromDate=month+'-01';const last=new Date(fromDate+'T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);toDate=last.toISOString().slice(0,10);
      }
      if(fromDate&&toDate&&fromDate>toDate){status.textContent='종료일은 시작일 이후로 선택해 주세요.';return;}
      filters={fromDate,toDate,search:controls.q.value.trim()};load(true,false);
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
        const r=await api({action:first?(ack?'activity_open':'activity_list'):'activity_page',before,...filters});
        if(userId()!==id)return;
        if(ack&&token===serial){count=0;checked=Date.now();paint();}
        if(!host.isConnected||seq!==request)return;
        if(first)list.replaceChildren();
        for(const row of r.rows){
          const item=document.createElement('li'),button=document.createElement('button');button.type='button';
          button.innerHTML='<small>'+safe(stamp.format(new Date(row.happened_at)))+'　'+safe(row.role_label)+(row.occurred_text?'　사고일 '+safe(occurred(row.occurred_text)):'')+'</small><strong>'+safe(row.sentence)+'</strong>';
          button.onclick=()=>openDoc(row,host,id);item.append(button);list.append(item);before=row.id;
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
})();
