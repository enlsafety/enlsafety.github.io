(() => {
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,run,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
  const eventNames={save:'저장',submit:'안전관리자 확인 대기',approve:'확인완료',reopen:'수정 중'};
  const when=d=>new Date(d).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  const dateText=d=>d?d.split('-').map((v,i)=>v+['년','월','일'][i]).join('　'):'년　　　 월　　　 일';
  function paper(data,template){
    const box=el('div',null,'org-paper appt-paper'),image=el('img');
    image.src=template;image.alt='첨부 엑셀의 관리감독자 임명장 원본 양식';
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 595.28 841.89');
    svg.setAttribute('aria-label','소속 '+data.department+', 직책 '+data.position+', 성명 '+data.name+', 임명일 '+data.date);
    const rect=document.createElementNS(ns,'rect');
    for(const [k,v] of Object.entries({x:200,y:638,width:190,height:24,fill:'#f6fafd'}))rect.setAttribute(k,v);
    svg.append(rect);
    const ctx=document.createElement('canvas').getContext('2d');
    for(const [value,x,y,width,color] of [[data.department,429,196,180,'#1d2521'],[data.position,429,220,180,'#1d2521'],[data.name,429,244,180,'#1d2521'],[dateText(data.date),290.5,654,185,'#165a8a']]){
      const t=document.createElementNS(ns,'text'),font='"Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
      ctx.font='bold 11px '+font;
      const size=Math.min(11,11*width/Math.max(1,ctx.measureText(value||'').width));
      for(const [k,v] of Object.entries({x,y,'text-anchor':'middle','font-family':font,'font-size':size,'font-weight':700,fill:color}))t.setAttribute(k,v);
      t.textContent=value||'';svg.append(t);
    }
    box.append(image,svg);return box;
  }
  function printPaper(box,title){
    const page=el('div');page.id='org-print-page';page.append(box.cloneNode(true));
    const style=el('style','@page{size:A4 portrait;margin:0}'),old=document.title;
    const cleanup=()=>{page.remove();style.remove();document.title=old;window.removeEventListener('afterprint',cleanup);};
    document.getElementById('org-print-page')?.remove();document.body.append(page);document.head.append(style);document.title=title;
    window.addEventListener('afterprint',cleanup,{once:true});
    try{window.print();}catch(e){cleanup();throw e;}
  }
  window.enlSupervisorAppointment=(root,user,api,site,hooks)=>{
    const writer=['safety','field'].includes(user.role),safety=user.role==='safety';
    let template,model,busy=false,dirty=false;
    const active=()=>hooks.isCurrent()&&root.isConnected;
    const setBusy=v=>{busy=v;if(active())hooks.busy(v);};
    const setDirty=v=>{dirty=v;if(active())hooks.dirty(v);};
    const canChange=()=>!busy&&(!dirty||confirm('저장하지 않은 임명장 변경사항이 있습니다. 이동할까요?'));
    async function load(id,revision){
      setBusy(true);root.replaceChildren(el('p','임명장을 불러오는 중입니다.','org-status'));
      try{
        const result=await api({action:'platform_org_appointment_open',siteId:site.site_id,documentId:id,revision,includeTemplate:!template});
        if(!active())return;
        template=result.template||template;model=result;site=result.site;setDirty(false);setBusy(false);render();
      }catch(e){if(active())root.replaceChildren(el('p','임명장을 불러오지 못했습니다. 다시 시도해 주세요.','org-status'),button('다시 불러오기',()=>load(id,revision)));}
      finally{setBusy(false);}
    }
    function render(fresh=false){
      const doc=fresh?null:model.document,history=fresh?[]:model.history;
      const data={...(doc?.appointment||{department:site.site_name,position:'',name:'',date:''})};
      const historic=!!doc&&doc.revision!==history[0]?.revision;
      const locked=!!doc&&['submit','approve'].includes(doc.event);
      const editable=writer&&!historic&&!locked&&(safety||site.active!==false);
      const id=doc?.document_id||crypto.randomUUID();
      root.replaceChildren();
      const selectors=el('div',null,'appt-selectors');
      const choose=el('select');choose.setAttribute('aria-label','저장된 관리감독자 임명장 선택');
      choose.add(new Option(fresh?'새 임명장 작성 중':'임명장을 선택하세요',''));
      for(const r of model.records)choose.add(new Option(r.appointment.name+' / '+r.appointment.position+' / '+r.appointment.date+' / '+eventNames[r.event],r.document_id,false,r.document_id===doc?.document_id));
      choose.onchange=()=>{const selected=choose.value;choose.value=doc?.document_id||'';if(selected&&canChange())load(selected);};
      const add=button('새 관리감독자 임명장',()=>{if(!canChange())return;setDirty(false);render(true);});add.disabled=!writer||user.role==='field'&&site.active===false;
      selectors.append(choose,add);root.append(selectors);
      if(history.length){
        const label=el('label','저장 이력','org-versions'),pick=el('select');
        for(const r of history)pick.add(new Option(when(r.saved_at)+' / '+r.actor_name+' / '+eventNames[r.event]+' (v'+r.revision+')',r.revision,false,r.revision===doc.revision));
        pick.onchange=()=>{const revision=Number(pick.value);pick.value=doc.revision;if(canChange())load(id,revision);};
        label.append(pick);root.append(label);
      }
      const workflow=el('section',null,'org-flow'),steps=el('div',null,'org-flow-steps'),guidance=el('p',null,'org-flow-guidance');
      workflow.setAttribute('aria-label','관리감독자 임명장 진행 순서');guidance.setAttribute('role','status');workflow.append(steps,guidance);root.append(workflow);
      const note=el('p','','org-status');note.setAttribute('role','status');
      const form=el('form',null,'appt-fields'),preview=el('div',null,'org-preview');
      let currentPaper,loaded=false,photoLoaded=false,review;
      const inputs=[];
      const redraw=()=>{loaded=false;currentPaper=paper(data,template);const img=currentPaper.querySelector('img');img.onload=()=>{loaded=true;update();};img.onerror=()=>{note.textContent='양식을 불러오지 못했습니다. 다시 불러와 주세요.';};preview.replaceChildren(currentPaper);};
      for(const [key,label,max] of [['department','소속',60],['position','직책',32],['name','성명',32],['date','임명일',10]]){
        const wrap=el('label',label),input=el('input');input.name=key;input.setAttribute('aria-label',label);input.value=data[key];input.required=true;input.readOnly=!editable;input.maxLength=max;
        if(key==='date'){input.type='date';input.min='1900-01-01';input.max='2199-12-31';}else input.autocomplete='off';
        input.oninput=()=>{data[key]=input.value;setDirty(true);note.textContent='';redraw();update();};wrap.append(input);form.append(wrap);inputs.push(input);
      }
      form.onsubmit=e=>{e.preventDefault();if(!save.disabled)write('save');};
      const controls=[];
      function step(title,label,role,run){const card=el('div',null,'org-flow-step'),b=button(label,run,'org-primary');card.append(el('strong',title,'org-flow-heading'),b,el('span',role,'org-flow-role'));steps.append(card);controls.push({card,b});return b;}
      const save=step('1. 저장','임명장 저장','현장 / 안전관리자',()=>write('save'));
      const print=step('2. 출력','PDF 출력','전체 사용자',()=>{if(!print.disabled)printPaper(currentPaper,site.site_name+'_'+data.name+'_관리감독자_임명장');});
      const file=el('input');file.type='file';file.accept='image/*';file.hidden=true;
      const submit=step('3. 사진 제출','출력물 사진 제출','현장 담당자',()=>file.click());
      const approve=step('4. 확인','확인완료','안전관리자',()=>write('approve'));
      const reopen=button(safety&&doc?.event==='submit'?'재제출 요청':'임명장 수정',()=>write('reopen'));
      file.onchange=async()=>{
        const selected=file.files[0];file.value='';if(!selected||submit.disabled)return;
        setBusy(true);update();note.textContent='사진을 처리하고 있습니다.';
        try{const result=await window.enlPrepareDocumentPhoto(selected);setBusy(false);update();if(active())await write('submit',result.base64);}
        catch{if(active())note.textContent='사진을 읽지 못했습니다. JPG 또는 PNG 사진을 선택해 주세요.';}
        finally{setBusy(false);if(active())update();}
      };
      if(doc?.photo){
        const evidence=el('section',null,'org-evidence'),image=el('img');image.alt='제출된 관리감독자 임명장 출력물 사진';
        image.onload=()=>{photoLoaded=true;update();};image.src=doc.photo;
        const thumbnail=button('',()=>window.enlOpenDocumentPhoto(doc.photo,image.alt,thumbnail),'enl-proof-thumb');
        thumbnail.setAttribute('aria-label','제출된 임명장 사진 확대 보기');thumbnail.setAttribute('aria-haspopup','dialog');thumbnail.append(image,el('span','사진 클릭하여 확대 보기'));
        const label=el('label');review=el('input');review.type='checkbox';review.checked=doc.event==='approve';review.onchange=update;
        label.append(review,' 임명장 내용과 출력물 사진을 대조했습니다.');evidence.append(el('h3','제출된 출력물 사진'),thumbnail,label);root.append(evidence);
      }
      const zoom=button('양식 확대',()=>{preview.classList.toggle('org-zoomed');zoom.textContent=preview.classList.contains('org-zoomed')?'양식 맞춤':'양식 확대';},'org-zoom');
      root.append(reopen,note,form,zoom,preview,file);redraw();update();
      function update(){
        if(!active())return;
        save.disabled=busy||!editable||!!doc&&!dirty;
        print.disabled=busy||dirty||!doc||!loaded;
        submit.disabled=busy||dirty||!doc||historic||locked||user.role!=='field'||site.active===false;
        approve.disabled=busy||dirty||historic||!safety||doc?.event!=='submit'||!photoLoaded||!review?.checked;
        reopen.disabled=busy||dirty||historic||!writer||!locked||user.role==='field'&&site.active===false;
        if(review)review.disabled=busy||historic||!safety||doc?.event!=='submit';
        choose.disabled=busy;add.disabled=busy||!writer||user.role==='field'&&site.active===false;
        form.inert=busy;inputs.forEach(i=>i.readOnly=!editable);
        controls.forEach(({card,b})=>card.dataset.actionState=b.disabled?'not-needed':b===print?'general':'required');
        guidance.textContent=historic?'이전 저장본입니다.':dirty?'변경사항을 먼저 저장하세요.':!doc?'소속, 직책, 성명, 임명일을 입력한 뒤 저장하세요.':doc.event==='approve'?'임명장 확인완료':doc.event==='submit'?'안전관리자가 내용과 출력물 사진을 대조한 뒤 확인합니다.':'출력한 임명장 사진을 제출하세요.';
      }
      async function write(op,photo){
        const control={save,submit,approve,reopen}[op];if(busy||control.disabled)return;
        if(op==='save'&&!form.reportValidity())return;
        if(op==='reopen'&&!confirm('수정 후 출력물 사진 제출과 안전관리자 확인을 다시 진행합니다. 계속할까요?'))return;
        setBusy(true);update();note.textContent='처리 중입니다.';
        try{
          await api({action:'platform_org_appointment_'+op,siteId:site.site_id,documentId:id,revision:doc?.revision||0,folderRevision:site.folder_revision,
            ...(op==='save'?{appointment:data}:{}),...(photo?{photo}:{}),...(op==='approve'?{reviewedPhotoRevision:doc.photo_revision}:{})});
          if(!active())return;setDirty(false);await load(id);
        }catch(e){if(active())note.replaceChildren(el('span','처리 결과를 확인하지 못했습니다. 최신 저장본을 확인한 뒤 다시 진행해 주세요.'),button('최신본 불러오기',()=>{if(canChange())load(doc?id:undefined);}));}
        finally{setBusy(false);if(active())update();}
      }
    }
    load();
  };
})();
