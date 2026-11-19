(() => {
  'use strict';
  const model=window.ENLSafetyCardModel;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,run,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
  const when=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  window.enlSafetyCards=(host,user,api,sameUser,onHome)=>{
    let panel,main,status,sites=[],site=null,record=null,content=null,allowed=false,linked=null,headerTools;
    let sequence=0,busy=false,dirty=false,activeCell='',noteButton,saveButton,backButton,heading,closeNote=null;
    let searchQuery='';
    const current=token=>sameUser()&&token===sequence;
    function canLeave(){return !busy&&(!dirty||confirm('저장하지 않은 안전관리카드 내용이 있습니다. 이동할까요?'));}
    const beforeUnload=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};
    function leave(){closeNote=null;sequence++;dirty=false;busy=false;record=null;site=null;content=null;panel?.remove();panel=null;window.removeEventListener('beforeunload',beforeUnload);}
    function navigation(){
      backButton.textContent='뒤로가기';
      backButton.setAttribute('aria-label',site?'사업장 목록으로 뒤로가기':'통합 홈으로 뒤로가기');
      backButton.title=site?'사업장 목록으로':'통합 홈으로';
      heading.textContent=site?site.site_name+' 안전관리카드':'안전관리카드';
      headerTools.replaceChildren(backButton);
    }
    function back(){
      if(closeNote){closeNote();return;}
      if(!canLeave())return;
      if(site)showList();else onHome?.();
    }
    function markDirty(){dirty=true;status.textContent='저장하지 않은 변경사항이 있습니다.';saveButton.disabled=!allowed||busy;paintCalculated();}
    function message(error){
      if(error?.message==='card_source_changed')return '안전관리카드가 원본 기준으로 변경됐습니다. 입력 내용을 보관한 뒤 앱을 새로고침해 주세요.';
      if(error?.message==='card_changed')return '다른 사용자가 먼저 저장했습니다. 입력 내용은 유지됩니다. 필요한 내용을 복사한 뒤 최신 내용 불러오기를 눌러 다시 작성해 주세요.';
      if(error?.message==='forbidden')return '이 사업장의 카드를 수정할 권한이 없습니다.';
      return '처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.';
    }
    function paintCalculated(){
      const title=main.querySelector('[data-cell="B2"]');if(title)title.textContent=(model.effectiveValues(content,linked).D6||site.site_name)+'  안전관리카드';
      for(const [key,value] of Object.entries(model.cardResults(content,linked))){
        const node=main.querySelector('[data-card-result="'+key+'"]');if(node)node.textContent=value;
      }
    }
    const linkInfo='안전관리카드가 사업장 정보의 기준 원본입니다. 저장하면 시스템관리의 기본정보, 인원, 연락망, 안전관리위탁 정보에 반영됩니다.';
    function paintLinked(key,refreshInput=false){
      const td=main.querySelector('[data-cell="'+key+'"]');if(!td)return;
      const custom=Object.hasOwn(content.overrides||{},key),primary=model.masterKeys.includes(key),input=td.querySelector('[data-card-field]');
      td.classList.toggle('safety-card-overridden',custom);
      const badge=td.querySelector('.safety-card-source-badge');if(badge)badge.textContent=primary?'원본':custom?'원본 입력':'자료 연동';
      const reset=td.querySelector('[data-card-reset]');if(reset)reset.hidden=!custom;
      td.title=(linked.sources[key]||'통합앱 연동')+' / 원본: '+(linked.values[key]||'빈칸');
      const sourceOption=input?.querySelector('[data-linked-option]');if(sourceOption&&!primary)sourceOption.textContent='연동: '+(linked.values[key]||'빈칸');
      if(refreshInput&&input&&!custom&&!primary){input.value=input.tagName==='SELECT'?'__linked__':linked.values[key]??'';if(input.tagName==='TEXTAREA'){input.style.height='auto';input.style.height=Math.max(30,input.scrollHeight)+'px';}}
    }
    function note(key){
      if(!content||busy)return;
      activeCell=key;
      const definition=model.template.fields[key]||model.linkedFields[key],cell=model.template.cells.find(c=>c.key===key);
      const caption=definition?.label||cell?.text||'자동 계산';
      const dialog=el('dialog',null,'safety-card-note');
      const heading=el('h3',caption+' 메모');
      const input=el('textarea');input.value=content.notes[key]||'';input.maxLength=16000;
      input.setAttribute('aria-label',caption+' 메모');input.readOnly=!allowed;
      const close=(applied=false)=>{
        if(!applied&&allowed&&input.value!==(content.notes[key]||'')&&!confirm('반영하지 않은 메모가 있습니다. 닫을까요?'))return;
        dialog.close();dialog.remove();closeNote=null;
        main.querySelector('[data-card-field="'+key+'"]')?.focus({preventScroll:true});
      };
      closeNote=()=>close();
      const actions=el('div',null,'safety-card-tools');
      if(allowed)actions.append(button('메모 반영',()=>{content.notes[key]=input.value;markDirty();renderPaper();close(true);},'primary'));
      const noteBack=button('뒤로가기',()=>close());noteBack.setAttribute('aria-label','안전관리카드로 뒤로가기');noteBack.dataset.close='';actions.prepend(noteBack);
      dialog.append(heading,input,actions);panel.append(dialog);
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      dialog.showModal();input.focus();
    }
    function renderPaper(){
      const old=main.querySelector('.safety-card-scroll');
      const left=old?.scrollLeft||0,top=old?.scrollTop||0;
      const scroll=el('div',null,'safety-card-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label',site.site_name+' 안전관리카드 양식');
      const table=el('table',null,'safety-card-paper');table.setAttribute('aria-label',site.site_name+' 안전관리카드');
      const cols=el('colgroup');for(const width of model.template.columns){const col=el('col');col.style.width=(width/model.template.columns.reduce((a,b)=>a+b,0)*100)+'%';cols.append(col)}table.append(cols);
      const body=el('tbody');table.append(body);
      const calculated=model.cardResults(content,linked),values=model.effectiveValues(content,linked);
      for(let r=1;r<=model.layout.heights.length;r++){
        const row=el('tr');row.style.height=model.layout.heights[r-1]+'px';row.style.setProperty('--card-print-height',model.layout.heights[r-1]*.4375+'pt');body.append(row);if(model.layout.cells.some(c=>c.row===r&&c.style==='100'))row.classList.add('safety-card-section-row');
        for(const cell of model.layout.cells.filter(c=>c.row===r)){
          const td=el('td');td.colSpan=cell.cols;td.rowSpan=cell.rows;td.dataset.cell=cell.key;
          const style=model.template.styles[cell.style];
          Object.assign(td.style,{fontWeight:style.bold?'700':'400',textAlign:style.align,fontSize:'calc('+Math.max(12,style.size)+'px + 2pt)'});
          const field=model.template.fields[cell.key]||model.linkedFields[cell.key],isLinked=Object.hasOwn(linked?.values||{},cell.key),custom=Object.hasOwn(content.overrides||{},cell.key),primary=model.masterKeys.includes(cell.key);
          if(cell.key==='B2'){td.textContent=(values.D6||site.site_name)+'  안전관리카드';td.classList.add('safety-card-title');}
          else if(cell.key==='B3')td.textContent='';
          else if(linked?.labels?.[cell.key]){td.textContent=cell.key==='J33'?'관리상태 입력과 실제 서류의 승인 기록은 구분하여 관리합니다.':linked.labels[cell.key];td.classList.add('safety-card-help');}
          else if(Object.hasOwn(calculated,cell.key)){
            const value=el('output',calculated[cell.key]);value.dataset.cardResult=cell.key;td.classList.add('safety-card-calculated');td.title='자동 계산 결과';td.append(value);
          }else if(field){
            let input;
            if(field.choices){
              input=el('select');if(isLinked){const option=new Option((primary?'저장값: ':'연동: ')+(primary?values[cell.key]||'빈칸':linked.values[cell.key]||'빈칸'),'__linked__');option.dataset.linkedOption='';input.append(option);}input.append(new Option('선택 안 함', ''));
              for(const value of field.choices)input.append(new Option(value,value));
              input.disabled=!allowed;
            }else{
              input=el('textarea');input.rows=1;input.maxLength=field.limit;input.readOnly=!allowed;
              if(field.number)input.inputMode='numeric';
            }
            input.name=cell.key;input.value=isLinked&&field.choices&&!custom?'__linked__':values[cell.key]??'';
            td.classList.add(allowed?(field.choices?'safety-card-select-cell':'safety-card-input-cell'):'safety-card-readonly');
            input.dataset.cardField=cell.key;input.setAttribute('aria-label',field.label);
            const grow=()=>{if(input.tagName==='TEXTAREA'){input.style.height='auto';input.style.height=Math.max(30,input.scrollHeight)+'px';}};
            input.oninput=()=>{
              if(!allowed||busy)return;
              if(isLinked){content.overrides??={};if(field.choices&&input.value==='__linked__')delete content.overrides[cell.key];else content.overrides[cell.key]=input.value;paintLinked(cell.key);}
              else content.values[cell.key]=input.value;
              grow();markDirty();
            };
            input.onchange=input.oninput;
            input.onfocus=()=>{activeCell=cell.key;noteButton.disabled=busy;noteButton.title=field.label+' 메모';noteButton.setAttribute('aria-label',field.label+' 메모');};
            td.append(input);
            if(isLinked&&!primary){
              td.classList.add('safety-card-linked');td.classList.toggle('safety-card-overridden',custom);
              const meta=el('div',null,'safety-card-source');meta.append(el('span',custom?'원본 입력':'자료 연동','safety-card-source-badge'));
              if(allowed){const reset=button('연동자료 적용',()=>{if(busy)return;delete content.overrides[cell.key];paintLinked(cell.key,true);markDirty();});reset.dataset.cardReset=cell.key;reset.setAttribute('aria-label',field.label+' 연동자료 적용');reset.hidden=!custom;meta.append(reset);}
              td.title=(linked.sources[cell.key]||'통합앱 연동')+' / 원본: '+(linked.values[cell.key]||'빈칸');td.append(meta);
            }
          }else {td.append(el('span',content.provenance?.[cell.key]??cell.text??''));if(cell.text)td.classList.add(cell.style==='100'?'safety-card-section':'safety-card-label');}
          if(content.notes[cell.key]){
            const b=button('메모',()=>note(cell.key),'safety-card-note-link');
            b.setAttribute('aria-label',(field?.label||cell.text||'자동 계산')+' 셀 메모 보기');td.append(b);
          }
          row.append(td);
        }
      }
      scroll.append(table);
      if(old)old.replaceWith(scroll);else main.append(scroll);
      scroll.scrollLeft=left;scroll.scrollTop=top;
      requestAnimationFrame(()=>{if(!scroll.isConnected)return;for(const input of scroll.querySelectorAll('textarea')){input.style.height='auto';input.style.height=Math.max(30,input.scrollHeight)+'px';}});
    }
    function print(){
      if(busy||!record)return;
      const paper=main.querySelector('.safety-card-paper').cloneNode(true);
      for(const node of paper.querySelectorAll('textarea,select')){
        const value=el('span',model.effectiveValues(content,linked)[node.name]??'');value.className='safety-card-print-value';node.replaceWith(value);
      }
      paper.querySelectorAll('button').forEach(node=>node.remove());
      const page=el('div');page.id='safety-card-print';page.append(paper);
      const rules=el('style','@page{size:A4 portrait;margin:6mm}');
      const oldTitle=document.title;
      const cleanup=()=>{page.remove();rules.remove();document.title=oldTitle;window.removeEventListener('afterprint',cleanup);};
      document.getElementById('safety-card-print')?.remove();document.body.append(page);document.head.append(rules);
      document.title=site.site_name+' 안전관리카드'+(dirty?' (저장 전)':'');
      window.addEventListener('afterprint',cleanup,{once:true});
      try{window.print()}catch(error){cleanup();status.textContent='인쇄 화면을 열지 못했습니다.';}
    }
    async function save(){
      if(busy||!allowed||!dirty)return;
      const problem=model.validate(content);if(problem){status.textContent=problem;return;}
      busy=true;saveButton.disabled=true;headerTools.disabled=true;
      const token=sequence;main.querySelector('.safety-card-editor').disabled=true;status.textContent='저장 중입니다.';
      try{
        const result=await api({action:'platform_safety_card_save',siteId:site.site_id,expectedRevision:record.revision,templateVersion:record.template_version,content});
        if(!current(token))return;
        record=result.document;site={...site,...result.site};heading.textContent=site.site_name+' 안전관리카드';const titlePicker=headerTools.querySelector('select');if(titlePicker){const option=[...titlePicker.options].find(o=>o.value===site.site_id);if(option)option.textContent=site.site_name;}content=structuredClone(record.content);content.overrides??={};linked=result.linked;dirty=false;renderPaper();
        status.textContent='저장했습니다. '+when(record.saved_at)+' / '+record.actor_name;
        const summary=sites.find(s=>s.site_id===site.site_id);if(summary)Object.assign(summary,{site_name:site.site_name,revision:record.revision,source:record.source,saved_at:record.saved_at});
      }catch(error){if(current(token))status.textContent=message(error);}
      finally{if(current(token)){busy=false;headerTools.disabled=false;main.querySelector('.safety-card-editor').disabled=false;saveButton.disabled=!dirty||!allowed;}}
    }
    async function refreshLinked(){
      if(!record||!site||busy)return;
      const token=sequence;
      try{
        const result=await api({action:'platform_safety_card_links',siteId:site.site_id});
        if(!current(token)||busy||!result.linked)return;
        linked=result.linked;
        for(const key of Object.keys(linked.values))paintLinked(key,true);
        const info=main.querySelector('.safety-card-link-status');if(info)info.textContent=allowed?linkInfo:'조회 전용입니다. 사업장 정보는 안전관리카드에 저장된 원본을 표시합니다.';
        paintCalculated();
      }catch(error){if(current(token)){const info=main.querySelector('.safety-card-link-status');if(info)info.textContent='연동값을 갱신하지 못했습니다. 마지막 조회값입니다. 새로고침해 주세요.';}}
    }
    async function choose(id,force=false){
      if(!force&&!canLeave())return;
      const token=++sequence;busy=false;site=sites.find(s=>s.site_id===id);dirty=false;record=null;
      if(!site)return showList();
      navigation();
      main.replaceChildren(el('p','안전관리카드를 불러오는 중입니다.'));
      try{
        const result=await api({action:'platform_safety_card_open',siteId:id});
        if(!current(token))return;
        if(result.document.template_version!==model.template.version)throw Error('invalid_card_version');
        record=result.document;site={...site,...result.site};heading.textContent=site.site_name+' 안전관리카드';const titlePicker=headerTools.querySelector('select');if(titlePicker){const option=[...titlePicker.options].find(o=>o.value===site.site_id);if(option)option.textContent=site.site_name;}content=structuredClone(record.content);content.overrides??={};linked=result.linked;allowed=result.canEdit===true&&['safety','field'].includes(user.role);activeCell='';
        const tools=headerTools;tools.disabled=false;
        const picker=el('select');picker.setAttribute('aria-label','안전관리카드 사업장 선택');
        for(const item of sites)picker.append(new Option(item.site_name,item.site_id));picker.value=id;
        picker.onchange=()=>{const next=picker.value;picker.value=site.site_id;choose(next);};
        saveButton=button('저장',save,'primary');saveButton.disabled=true;saveButton.dataset.cardSave='';
        noteButton=button('셀 메모',()=>note(activeCell));noteButton.disabled=true;
        const reload=button('새로고침',()=>choose(id));reload.title='최신 내용 불러오기';reload.setAttribute('aria-label','최신 내용 불러오기');
        tools.append(picker,saveButton,noteButton,button('인쇄 / PDF',print),reload);
        status=el('p',record.source==='import'?'':'마지막 저장 '+when(record.saved_at)+' / '+record.actor_name,'safety-card-status');status.setAttribute('role','status');
        if(!allowed)status.textContent+=(status.textContent?' / ':'')+'조회 전용';
        const fieldset=el('fieldset',null,'safety-card-editor');
        if(!linked)throw Error('linked_data_unavailable');
        const info=el('p',allowed?linkInfo:'조회 전용입니다. 사업장 정보는 안전관리카드에 저장된 원본을 표시합니다.','safety-card-link-status');
        const legend=el('div',null,'safety-card-legend');legend.setAttribute('aria-label','안전관리카드 색상 안내');
        for(const [cls,label] of [['label','항목 구분'],['input-cell','직접 입력'],['select-cell','드롭다운 선택'],['calculated','자동 계산']])legend.append(el('span',label,'safety-card-'+cls));
        main.replaceChildren(status,legend,info,fieldset);renderPaper();
        fieldset.append(main.querySelector('.safety-card-scroll'));
      }catch(error){if(current(token))main.replaceChildren(el('p','카드를 불러오지 못했습니다.'),button('다시 시도',()=>choose(id,true)),button('사업장 목록',showList));}
    }
    function showList(){
      sequence++;dirty=false;site=null;record=null;content=null;linked=null;navigation();
      const search=el('input');search.type='search';search.value=searchQuery;search.placeholder='사업장 검색';search.setAttribute('aria-label','안전관리카드 사업장 검색');
      const grid=el('div',null,'safety-card-sites');
      const paint=()=>{
        grid.replaceChildren();
        for(const item of sites.filter(s=>s.site_name.includes(search.value.trim()))){
          const b=button('',()=>choose(item.site_id));b.dataset.cardSite=item.site_id;
          b.append(el('strong',item.site_name));if(item.source!=='import')b.append(el('span','저장 '+when(item.saved_at)));grid.append(b);
        }
        if(!grid.childElementCount)grid.append(el('p','표시할 사업장 카드가 없습니다.'));
      };
      search.oninput=()=>{searchQuery=search.value;paint();};main.replaceChildren(search,grid);paint();
    }
    async function open(){
      if(!panel){panel=el('section',null,'hub-tool-panel safety-card-panel');panel.dataset.listWorkspace='safetyCard';host.append(panel);window.addEventListener('beforeunload',beforeUnload);}
      panel.hidden=false;main=el('div');
      const header=el('header',null,'safety-card-header');
      backButton=button('뒤로가기',back,'safety-card-back');backButton.dataset.cardBack='';
      heading=el('h2','안전관리카드');headerTools=el('fieldset',null,'safety-card-tools safety-card-header-tools');header.append(heading,headerTools);panel.replaceChildren(header,main);navigation();
      const token=++sequence;main.append(el('p','사업장 목록을 불러오는 중입니다.'));
      try{const result=await api({action:'platform_safety_card_list'});if(!current(token))return;sites=result.sites;showList();}
      catch(error){if(current(token))main.replaceChildren(el('p','사업장 목록을 불러오지 못했습니다.'),button('다시 시도',open));}
    }
    return {open,leave,back,refreshLinked,hasDetail:()=>!!site,canLeave,canSuspend:()=>!busy};
  };
})();
