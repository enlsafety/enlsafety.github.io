(() => {
  'use strict';
  const model=window.ENLSafetyCardModel;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,run,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
  const when=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  window.enlSafetyCards=(host,user,api,sameUser)=>{
    let panel,main,status,sites=[],site=null,record=null,content=null,allowed=false;
    let sequence=0,busy=false,dirty=false,activeCell='',noteButton,saveButton;
    const current=token=>sameUser()&&token===sequence;
    function canLeave(){return !busy&&(!dirty||confirm('저장하지 않은 안전관리카드 내용이 있습니다. 이동할까요?'));}
    const beforeUnload=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};
    function leave(){sequence++;dirty=false;busy=false;record=null;site=null;content=null;panel?.remove();panel=null;window.removeEventListener('beforeunload',beforeUnload);}
    function markDirty(){dirty=true;status.textContent='저장하지 않은 변경사항이 있습니다.';saveButton.disabled=!allowed||busy;paintCalculated();}
    function message(error){
      if(error?.message==='card_changed')return '다른 사용자가 먼저 저장했습니다. 입력 내용은 유지됩니다. 필요한 내용을 복사한 뒤 최신 내용 불러오기를 눌러 다시 작성해 주세요.';
      if(error?.message==='forbidden')return '이 사업장의 카드를 수정할 권한이 없습니다.';
      return '처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.';
    }
    function paintCalculated(){
      for(const [key,value] of Object.entries(model.calculate(content.values))){
        const node=main.querySelector('[data-card-result="'+key+'"]');if(node)node.textContent=value;
      }
    }
    function note(key){
      if(!content||busy)return;
      activeCell=key;
      const definition=model.template.fields[key],cell=model.template.cells.find(c=>c.key===key);
      const caption=definition?.label||cell?.text||'자동 계산';
      const dialog=el('dialog',null,'safety-card-note');
      const heading=el('h3',caption+' 메모');
      const input=el('textarea');input.value=content.notes[key]||'';input.maxLength=16000;
      input.setAttribute('aria-label',caption+' 메모');input.readOnly=!allowed;
      const close=()=>{dialog.close();dialog.remove();};
      const actions=el('div',null,'safety-card-tools');
      if(allowed)actions.append(button('메모 반영',()=>{content.notes[key]=input.value;markDirty();renderPaper();close();},'primary'));
      actions.append(button('닫기',close));
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
      const calculated=model.calculate(content.values);
      for(let r=1;r<=model.template.heights.length;r++){
        const row=el('tr');row.style.height=model.template.heights[r-1]+'px';row.style.setProperty('--card-print-height',model.template.heights[r-1]*.4375+'pt');body.append(row);
        for(const cell of model.template.cells.filter(c=>c.row===r)){
          const td=el('td');td.colSpan=cell.cols;td.rowSpan=cell.rows;td.dataset.cell=cell.key;
          const style=model.template.styles[cell.style];
          Object.assign(td.style,{background:style.background,color:style.color,fontWeight:style.bold?'700':'400',textAlign:style.align,fontSize:Math.max(12,style.size)+'px'});
          const field=model.template.fields[cell.key];
          if(cell.key==='B2'){td.textContent=(content.values.D6||site.site_name)+'  안전관리카드';td.classList.add('safety-card-title');}
          else if(cell.key==='B3')td.append(button('사업장 목록으로',()=>{if(canLeave())showList();},'safety-card-back'));
          else if(Object.hasOwn(calculated,cell.key)){
            const value=el('output',calculated[cell.key]);value.dataset.cardResult=cell.key;td.append(value);
          }else if(field){
            let input;
            if(field.choices){
              input=el('select');input.append(new Option('', ''));
              for(const value of field.choices)input.append(new Option(value,value));
              input.disabled=!allowed;
            }else{
              input=el('textarea');input.rows=1;input.maxLength=field.limit;input.readOnly=!allowed||cell.key==='D6';
              if(field.number)input.inputMode='numeric';
            }
            input.name=cell.key;input.value=content.values[cell.key]||'';
            input.dataset.cardField=cell.key;input.setAttribute('aria-label',field.label);
            const grow=()=>{if(input.tagName==='TEXTAREA'){input.style.height='auto';input.style.height=Math.max(30,input.scrollHeight)+'px';}};
            input.oninput=()=>{content.values[cell.key]=input.value;grow();markDirty();};
            input.onchange=input.oninput;
            input.onfocus=()=>{activeCell=cell.key;noteButton.disabled=busy;noteButton.textContent=field.label+' 메모';};
            td.append(input);
          }else td.append(el('span',content.provenance?.[cell.key]??cell.text??''));
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
        const value=el('span',content.values[node.dataset.cardField]||'');value.className='safety-card-print-value';node.replaceWith(value);
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
      busy=true;saveButton.disabled=true;
      const token=sequence;main.querySelector('.safety-card-editor').disabled=true;status.textContent='저장 중입니다.';
      try{
        const result=await api({action:'platform_safety_card_save',siteId:site.site_id,expectedRevision:record.revision,templateVersion:record.template_version,content});
        if(!current(token))return;
        record=result.document;content=structuredClone(record.content);dirty=false;
        status.textContent='저장했습니다. '+when(record.saved_at)+' / '+record.actor_name;
        const summary=sites.find(s=>s.site_id===site.site_id);if(summary)Object.assign(summary,{revision:record.revision,source:record.source,saved_at:record.saved_at});
      }catch(error){if(current(token))status.textContent=message(error);}
      finally{if(current(token)){busy=false;main.querySelector('.safety-card-editor').disabled=false;saveButton.disabled=!dirty||!allowed;}}
    }
    async function choose(id,force=false){
      if(!force&&!canLeave())return;
      const token=++sequence;busy=false;site=sites.find(s=>s.site_id===id);dirty=false;record=null;
      if(!site)return showList();
      main.replaceChildren(el('p','안전관리카드를 불러오는 중입니다.'));
      try{
        const result=await api({action:'platform_safety_card_open',siteId:id});
        if(!current(token))return;
        if(result.document.template_version!==model.template.version)throw Error('invalid_card_version');
        record=result.document;content=structuredClone(record.content);allowed=result.canEdit===true&&['safety','field'].includes(user.role);activeCell='';
        const tools=el('div',null,'safety-card-tools');
        const picker=el('select');picker.setAttribute('aria-label','안전관리카드 사업장 선택');
        for(const item of sites)picker.append(new Option(item.site_name,item.site_id));picker.value=id;
        picker.onchange=()=>{const next=picker.value;picker.value=site.site_id;choose(next);};
        saveButton=button('저장',save,'primary');saveButton.disabled=true;saveButton.dataset.cardSave='';
        noteButton=button('선택한 셀 메모',()=>note(activeCell));noteButton.disabled=true;
        tools.append(button('사업장 목록',()=>{if(canLeave())showList();}),picker,saveButton,noteButton,button('인쇄 / PDF',print),button('최신 내용 불러오기',()=>choose(id)));
        status=el('p',record.source==='import'?'엑셀 원본을 반영한 카드입니다.':'마지막 저장 '+when(record.saved_at)+' / '+record.actor_name,'safety-card-status');status.setAttribute('role','status');
        if(!allowed)status.textContent+=' 조회 전용';
        const fieldset=el('fieldset',null,'safety-card-editor');fieldset.append(tools);
        main.replaceChildren(status,fieldset);renderPaper();
        fieldset.append(main.querySelector('.safety-card-scroll'));
      }catch(error){if(current(token))main.replaceChildren(el('p','카드를 불러오지 못했습니다.'),button('다시 시도',()=>choose(id,true)),button('사업장 목록',showList));}
    }
    function showList(){
      sequence++;dirty=false;site=null;record=null;content=null;
      const search=el('input');search.type='search';search.placeholder='사업장 검색';search.setAttribute('aria-label','안전관리카드 사업장 검색');
      const grid=el('div',null,'safety-card-sites');
      const paint=()=>{
        grid.replaceChildren();
        for(const item of sites.filter(s=>s.site_name.includes(search.value.trim()))){
          const b=button('',()=>choose(item.site_id));b.dataset.cardSite=item.site_id;
          b.append(el('strong',item.site_name),el('span',item.source==='import'?'엑셀 원본 반영':'저장 '+when(item.saved_at)));grid.append(b);
        }
        if(!grid.childElementCount)grid.append(el('p','표시할 사업장 카드가 없습니다.'));
      };
      search.oninput=paint;main.replaceChildren(search,grid);paint();
    }
    async function open(){
      if(!panel){panel=el('section',null,'hub-tool-panel safety-card-panel');panel.dataset.listWorkspace='safetyCard';host.append(panel);window.addEventListener('beforeunload',beforeUnload);}
      panel.hidden=false;main=el('div');panel.replaceChildren(el('h2','안전관리카드'),main);
      const token=++sequence;main.append(el('p','사업장 목록을 불러오는 중입니다.'));
      try{const result=await api({action:'platform_safety_card_list'});if(!current(token))return;sites=result.sites;showList();}
      catch(error){if(current(token))main.replaceChildren(el('p','사업장 목록을 불러오지 못했습니다.'),button('다시 시도',open));}
    }
    return {open,leave,canLeave,canSuspend:()=>!busy};
  };
})();
