(() => {
  'use strict';
  const M=window.enlSupervisorTrainingModel;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,run,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
  const when=d=>new Date(d).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  window.enlSupervisorCertificates=(root,user,api,site,hooks)=>{
    let model,selectedId,periodIndex,busy=false,dirty=false,editor;
    const active=()=>hooks.isCurrent()&&root.isConnected;
    const setBusy=v=>{busy=v;if(active())hooks.busy(v);};
    const setDirty=v=>{dirty=v;if(active())hooks.dirty(v);};
    const editable=()=>['field','safety'].includes(user.role)&&(user.role==='safety'||site.active!==false);
    const canChange=()=>!busy&&(!dirty||confirm('저장하지 않은 교육수료증 변경사항이 있습니다. 이동할까요?'));
    const errorText=e=>({appointment_changed:'임명장이 변경되었습니다. 최신 자료를 불러온 뒤 대상자와 임명일을 확인해 주세요.',certificate_changed:'다른 사용자가 수료증을 수정했습니다. 최신 자료를 불러와 주세요.',folder_changed:'사업장 폴더가 변경되었습니다. 최신 자료를 불러와 주세요.',invalid_completion_date:'수료일은 임명일 이후부터 오늘까지의 실제 날짜로 입력해 주세요.',photo_required:'교육수료증 사진을 첨부해 주세요.',photo_review_required:'저장된 수료증 사진과 수료일을 확인한 후 승인해 주세요.',forbidden:'이 자료를 수정할 권한이 없습니다.'}[e.message]||'처리 결과를 확인하지 못했습니다. 최신 자료를 불러와 저장 여부를 확인해 주세요.');
    async function load(id=selectedId,index){
      setBusy(true);root.replaceChildren(el('p','교육수료증과 임명일을 불러오는 중입니다.','org-status'));
      try{
        const result=await api({action:'platform_org_certificate_list',siteId:site.site_id});
        if(!active())return;
        model=result;site=result.site;selectedId=result.appointments.some(a=>a.document_id===id)?id:result.appointments[0]?.document_id;
        periodIndex=index;setDirty(false);setBusy(false);render();
      }catch(e){if(active())root.replaceChildren(el('p','교육수료증을 불러오지 못했습니다.','org-status'),button('다시 불러오기',()=>load(id,index)));}
      finally{setBusy(false);}
    }
    function thumbnail(photo,caption){
      const image=el('img');image.src=photo;image.alt=caption;
      const b=button('',()=>window.enlOpenDocumentPhoto(photo,caption,b),'enl-proof-thumb');
      b.setAttribute('aria-label',caption+' 확대 보기');b.setAttribute('aria-haspopup','dialog');b.append(image,el('span','사진 클릭하여 확대 보기'));return b;
    }
    function render(){
      root.replaceChildren();root.classList.add('cert-content');
      const toolbar=el('div',null,'cert-toolbar'),label=el('label','관리감독자'),pick=el('select');
      pick.setAttribute('aria-label','교육수료증 관리감독자 선택');
      for(const a of model.appointments)pick.add(new Option(a.appointment.name+' / '+a.appointment.position+' / 임명일 '+a.appointment.date,a.document_id,false,a.document_id===selectedId));
      pick.onchange=()=>{const id=pick.value;pick.value=selectedId;if(canChange()){selectedId=id;periodIndex=undefined;setDirty(false);render();}};
      label.append(pick);toolbar.append(label,button('최신 자료 불러오기',()=>{if(canChange())load(selectedId);}));root.append(toolbar);
      if(!model.appointments.length){pick.disabled=true;root.append(el('p','등록된 관리감독자 임명장이 없습니다. 「02. 관리감독자 임명장」에서 성명과 임명일을 먼저 저장해 주세요.','org-status'));return;}
      const a=model.appointments.find(a=>a.document_id===selectedId),data=a.appointment;
      const all=model.records.filter(r=>r.appointment_id===a.document_id),today=model.today,current=M.current(data.date,today);
      if(!current){root.append(el('p','임명일을 확인할 수 없습니다. 임명장을 확인해 주세요.','org-status'));return;}
      if(periodIndex==null||periodIndex>current.index)periodIndex=current.index;
      const p=M.period(data.date,periodIndex),s=M.summary(data,all,p,today);
      const overview=el('section',null,'cert-overview');overview.dataset.state=s.state;
      const heading=el('div',null,'cert-heading');heading.append(el('h3',data.name+' 관리감독자'),el('strong',s.label,'cert-state'));overview.append(heading);
      const facts=el('dl',null,'cert-facts');
      for(const [name,value] of [['임명일 (임명장 연동)',data.date],['선택한 교육 대상기간',p.start+' ~ '+p.end],['교육 마감일',p.end],['남은 기간',today<p.start?'교육기간 시작 전':s.remaining<0?'기한 '+Math.abs(s.remaining)+'일 경과':s.remaining===0?'오늘 마감':s.remaining+'일 남음']]){
        const cell=el('div');cell.append(el('dt',name),el('dd',value));facts.append(cell);
      }
      overview.append(facts,el('p','임명일부터 매 1년의 교육기간 내에 교육을 이수하고, 수료일과 수료증 사진을 등록해 주세요. 다음 교육기간: '+p.next+' ~ '+M.period(data.date,periodIndex+1).end,'cert-guidance'));
      root.append(overview);
      const periodLabel=el('label','교육기간 선택','cert-period'),periodPick=el('select');periodPick.setAttribute('aria-label','교육기간 선택');
      let missing=0;
      for(let i=current.index;i>=0;i--){
        const period=M.period(data.date,i),state=M.summary(data,all,period,today);
        if(state.state==='overdue')missing++;
        periodPick.add(new Option(period.start+' ~ '+period.end+' / '+state.label,i,false,i===periodIndex));
      }
      periodPick.onchange=()=>{const index=Number(periodPick.value);periodPick.value=periodIndex;if(canChange()){periodIndex=index;setDirty(false);render();}};
      periodLabel.append(periodPick);root.append(periodLabel);
      if(missing)root.append(el('p','기한이 지난 교육기간 중 수료증 미등록 '+missing+'건이 있습니다. 실제 이수 여부를 확인하고 해당 수료증을 등록해 주세요.','cert-warning'));
      const list=el('section',null,'cert-records');list.append(el('h3','선택한 기간의 수료증'));
      const records=[...s.certificates].sort((a,b)=>b.completed_on.localeCompare(a.completed_on));
      if(!records.length)list.append(el('p','이 교육기간에 해당하는 수료증이 등록되지 않았습니다.','org-status'));
      for(const record of records)list.append(recordRow(record));
      root.append(list);
      const others=all.filter(r=>!M.matches(r,data));
      if(others.length){
        const old=el('details',null,'cert-previous');old.append(el('summary','임명장 변경 전 수료증 '+others.length+'건 (현재 기간에 자동 반영하지 않음)'));
        for(const record of others)old.append(recordRow(record));root.append(old);
      }
      const add=button('교육수료증 등록',()=>{if(canChange()){setDirty(false);showEditor(a);}},'org-primary');add.disabled=!editable()||data.date>today;root.append(add);
      root.append(el('p','수료증 등록 상태는 교육시간 충족 여부에 대한 최종 판정이 아닙니다. 교육시간과 감면 적용 여부는 수료증 내용으로 확인해 주세요.','cert-footnote'));
      const source=el('a','교육주기 안내 (고용노동부)');source.href='https://1350.moel.go.kr/rtmview.do?id=1000261996';source.target='_blank';source.rel='noopener noreferrer';root.append(source);
      editor=el('section',null,'cert-editor');editor.hidden=true;root.append(editor);
      function recordRow(record){
        const row=el('div',null,'cert-record');row.append(el('strong','수료일 '+record.completed_on),el('span',record.appointment.name+' / '+record.actor_name+(record.event==='approve'?' 승인 / ':' 등록 / ')+when(record.saved_at)));
        row.append(el('span',record.event==='approve'?'안전관리자 승인 완료':'안전관리자 승인 대기',record.event==='approve'?'cert-success':'cert-warning'));
        row.append(button('사진 및 저장 이력',()=>{if(canChange())openRecord(record);}));return row;
      }
    }
    async function openRecord(record,revision){
      setBusy(true);root.inert=true;
      try{
        const result=await api({action:'platform_org_certificate_open',siteId:site.site_id,certificateId:record.certificate_id,revision});
        if(!active())return;setDirty(false);
        const a=model.appointments.find(a=>a.document_id===record.appointment_id);
        showEditor(a,result);
      }catch(e){if(active()){editor.hidden=false;editor.replaceChildren(el('p',errorText(e),'cert-warning'));}}
      finally{setBusy(false);root.inert=false;}
    }
    function showEditor(a,result){
      editor.hidden=false;editor.replaceChildren();
      const doc=result?.document,historic=doc&&doc.revision!==result.history[0]?.revision;
      const writable=editable()&&!historic&&(!doc||M.matches(doc,a.appointment));
      const id=doc?.certificate_id||crypto.randomUUID();let photo;
      editor.append(el('h3',doc?'교육수료증 상세':'교육수료증 등록'));
      if(result){
        const versions=el('label','저장 이력'),select=el('select');select.setAttribute('aria-label','수료증 저장 이력');
        for(const h of result.history)select.add(new Option(when(h.saved_at)+' / '+h.actor_name+' / '+(h.event==='approve'?'승인':'등록')+' / 수료일 '+h.completed_on+' (v'+h.revision+')',h.revision,false,h.revision===doc.revision));
        select.onchange=()=>{const rev=Number(select.value);select.value=doc.revision;if(canChange())openRecord(doc,rev);};versions.append(select);editor.append(versions);
        if(historic||!M.matches(doc,a.appointment))editor.append(el('p','이전 저장본입니다. 당시 임명일: '+doc.appointment.date+' / 성명: '+doc.appointment.name,'org-status'));
      }
      const form=el('form',null,'cert-form'),dateLabel=el('label','교육 수료일'),date=el('input');
      date.type='date';date.name='completedOn';date.required=true;date.min=(doc?.appointment||a.appointment).date;date.max=model.today;date.value=doc?.completed_on||'';date.readOnly=!writable;date.setAttribute('aria-label','교육 수료일');dateLabel.append(date);
      const fileLabel=el('label','교육수료증 사진'),file=el('input');file.type='file';file.accept='image/*';file.disabled=!writable;file.setAttribute('aria-label','교육수료증 사진');fileLabel.append(file);
      const preview=el('div',null,'cert-photo'),note=el('p','','org-status'),periodNote=el('p','','cert-date-note');note.setAttribute('role','status');
      if(doc?.photo)preview.append(thumbnail(doc.photo,'교육수료증 사진'));
      const save=el('button',doc?'수료증 수정 저장':'수료증 저장','org-primary');save.type='submit';save.disabled=!writable;
      const close=button('닫기',()=>{if(canChange()){setDirty(false);editor.hidden=true;editor.replaceChildren();}});
      function dateHint(){
        const valid=M.validDate(date.value)&&date.value>=a.appointment.date&&date.value<=model.today;
        const p=valid?M.current(a.appointment.date,date.value):null;
        periodNote.textContent=p?'등록할 교육기간: '+p.start+' ~ '+p.end:'수료증에 적힌 실제 교육 수료일을 입력하세요.';
      }
      date.oninput=()=>{setDirty(true);dateHint();};dateHint();
      file.onchange=async()=>{
        const selected=file.files[0];file.value='';if(!selected||busy||!writable)return;
        setBusy(true);root.inert=true;note.textContent='사진을 처리하고 있습니다.';
        try{const result=await window.enlPrepareDocumentPhoto(selected);if(!active())return;photo=result.base64;preview.replaceChildren(thumbnail('data:image/jpeg;base64,'+photo,'저장할 교육수료증 사진'));setDirty(true);note.textContent='사진 준비 완료. 수료일을 확인한 후 저장해 주세요.';}
        catch{if(active())note.textContent='사진을 읽지 못했습니다. JPG 또는 PNG 사진을 선택해 주세요.';}
        finally{setBusy(false);root.inert=false;}
      };
      form.onsubmit=async e=>{
        e.preventDefault();if(busy||!writable||!form.reportValidity())return;
        if(!photo&&!doc){note.textContent='교육수료증 사진을 첨부해 주세요.';return;}
        setBusy(true);root.inert=true;note.textContent='저장 중입니다.';
        try{
          await api({action:'platform_org_certificate_save',siteId:site.site_id,appointmentId:a.document_id,appointmentRevision:a.revision,folderRevision:site.folder_revision,certificateId:id,revision:doc?.revision||0,completedOn:date.value,...(photo?{photo}:{})});
          if(!active())return;
          const index=M.current(a.appointment.date,date.value).index;setDirty(false);await load(a.document_id,index);hooks.changed?.();
          if(active())root.prepend(el('p','교육수료증을 저장했습니다.','cert-success'));
        }catch(e){if(active())note.replaceChildren(el('span',errorText(e)),button('최신 자료 불러오기',()=>{if(canChange())load(a.document_id);}));}
        finally{setBusy(false);root.inert=false;}
      };
      form.append(dateLabel,fileLabel,periodNote,preview,note,save,close);editor.append(form);
      if(doc){
        editor.append(el('p',doc.event==='approve'?'안전관리자 승인 완료. 수정 저장하면 다시 승인을 받아야 합니다.':'등록된 수료증은 안전관리자 승인 대기 중입니다.',doc.event==='approve'?'cert-success':'cert-warning'));
      }
      if(doc&&!historic&&M.matches(doc,a.appointment)&&doc.event!=='approve'&&user.role==='safety'){
        let photoLoaded=false;
        const reviewLabel=el('label',null,'cert-review'),review=el('input');review.type='checkbox';review.disabled=true;
        reviewLabel.append(review,document.createTextNode('저장된 수료증 사진의 성명, 교육내용과 수료일을 확인했습니다.'));
        const approve=button('수료증 승인',async()=>{
          if(busy||dirty||!review.checked||!photoLoaded)return;
          setBusy(true);root.inert=true;note.textContent='승인 중입니다.';
          try{
            await api({action:'platform_org_certificate_approve',siteId:site.site_id,appointmentId:a.document_id,appointmentRevision:a.revision,folderRevision:site.folder_revision,certificateId:id,revision:doc.revision,reviewedPhotoRevision:doc.photo_revision});
            if(!active())return;await load(a.document_id,periodIndex);hooks.changed?.();
            if(active())root.prepend(el('p','교육수료증을 승인했습니다.','cert-success'));
          }catch(e){if(active())note.textContent=errorText(e);}
          finally{setBusy(false);root.inert=false;}
        },'org-primary');approve.disabled=true;
        const updateReview=()=>{review.disabled=dirty||!photoLoaded;approve.disabled=dirty||!photoLoaded||!review.checked;};
        const image=preview.querySelector('img');
        if(image){image.onload=()=>{photoLoaded=true;updateReview();};if(image.complete&&image.naturalWidth){photoLoaded=true;}}
        review.onchange=updateReview;form.addEventListener('input',updateReview);form.addEventListener('change',()=>{review.checked=false;approve.disabled=true;});
        updateReview();editor.append(reviewLabel,approve);
      }
      if(!doc)date.focus();
    }
    load();
  };
})();
