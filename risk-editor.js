/* Evaluation editor: server-authorized records, explicit saves and immutable revisions. */
(()=>{
 'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const btn=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const caption={initial:'최초 위험성평가',regular:'정기 위험성평가'};
 const errorText={record_changed:'다른 사용자가 먼저 저장했습니다. 입력 내용은 남아 있습니다. 최신 저장본을 확인한 뒤 다시 작성해 주세요.',folder_changed:'사업장 폴더가 변경됐습니다. 입력 내용을 확인하고 목록에서 다시 열어 주세요.',invalid_record:'평가일, 평가자, 위험성 등급과 제외 사유를 확인해 주세요. 상 또는 중 항목은 개선대책, 담당자와 조치기한이 필요합니다.',invalid_photo:'사진을 처리하지 못했습니다. 사진을 다시 선택해 주세요.'};
  async function preparePhoto(file){
   if(file.size>25000000)throw Error('too_large');
   const url=URL.createObjectURL(file);let img;
   try{img=await new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(Error('timeout')),20000);image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(Error('decode'));};image.src=url;});}
   finally{URL.revokeObjectURL(url);}
   const canvas=el('canvas'),scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   let blob;for(const quality of [.85,.7,.55,.4]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=350000)break;}
   if(!blob||blob.size>350000)throw Error('too_large');const buffer=await blob.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',buffer);
   const id=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
   const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
   return {id,mime:'image/jpeg',base64:data.split(',')[1]};
  }
 window.enlPrepareDocumentPhoto=preparePhoto;
 let templateFlight;
 function loadTemplates(){
  if(window.ENLRiskPaperTemplates)return Promise.resolve();
  if(!templateFlight)templateFlight=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='risk-paper-templates.js?v=4813-r144';
    script.onload=()=>resolve();script.onerror=()=>{script.remove();templateFlight=null;reject(Error('template_unavailable'));};
    document.head.append(script);
  });
  return templateFlight;
 }
 function mount(host,config,api){
  const {site,kind,period,templateId,user,onBack,isCurrent}=config;
  let dirty=false,busy=false,alive=true,token=0,documentData,content,revision=0,latest=0,photos=new Map(),history=[],template;
  let editor,note,summary,sectionSelect,rowsHost,tab='';
  const writable=()=>['field','safety'].includes(user.role)&&revision===latest;
  const changed=()=>{dirty=true;note.textContent='저장하지 않은 변경사항이 있습니다.';updateSummary();};
  const canLeave=()=>!busy&&(!dirty||confirm('저장하지 않은 위험성평가 변경사항이 있습니다. 화면을 이동할까요?'));
  const beforeUnload=e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  const destroy=()=>{alive=false;token++;window.removeEventListener('beforeunload',beforeUnload);document.getElementById('risk-print-page')?.remove();};
  const current=()=>alive&&isCurrent();
  function field(label,obj,key,type='text',max=2000){
   const box=el('label',label),control=el(type==='textarea'?'textarea':'input');
   if(type!=='textarea')control.type=type;else control.rows=3;
   control.value=obj[key]??'';control.disabled=!writable();control.dataset.riskField=key;
   if(type!=='date')control.maxLength=max;
   control.oninput=()=>{obj[key]=control.value;changed();};box.append(control);return box;
  }
  function updateSummary(){
   if(!summary||!content)return;
   const applicable=content.rows.filter(r=>!r.excluded),rated=applicable.filter(r=>r.level);
   summary.textContent='전체 '+content.rows.length+'개 / 평가 '+rated.length+'개 / 미평가 '+(applicable.length-rated.length)+'개 / 제외 '+(content.rows.length-applicable.length)+'개';
  }
  function missing(){
   if(!content.assessmentDate||!content.evaluator.trim())return '평가일과 평가자를 입력해 주세요.';
   if(kind==='regular'&&!content.assessmentDate.startsWith(period+'-'))return period+'년 평가일을 입력해 주세요.';
   if(!content.rows.some(r=>!r.excluded))return '평가 대상 작업을 한 개 이상 선택해 주세요.';
   for(const r of content.rows){
    if(r.excluded){if(!r.excludeReason.trim())return r.number+'번 작업의 제외 사유를 입력해 주세요.';continue;}
    if(!r.level||!r.task.trim()||!r.hazard.trim())return r.number+'번 작업의 작업명, 위험요인과 위험성 등급을 확인해 주세요.';
    if(['상','중'].includes(r.level)&&(!r.measure.trim()||!r.owner.trim()||!r.dueDate))return r.number+'번 작업의 개선대책, 담당자와 조치기한을 입력해 주세요.';
   }
   return '';
  }
  async function save(state){
   if(busy||!writable())return;
   if(state==='completed'){
    const issue=missing();if(issue){note.textContent=issue;note.scrollIntoView({block:'nearest'});return;}
    if(!confirm('현장에서 확인한 평가 내용으로 완료 표시할까요? 개선조치 완료 여부는 각 항목의 완료일로 별도 관리됩니다.'))return;
   }
   busy=true;editor.inert=true;const end=window.ENLProcessing?.begin();
   try{
    const used=new Set(content.improvements.flatMap(r=>[r.beforePhoto,r.afterPhoto]).filter(Boolean));
    const result=await api({action:'platform_risk_save',siteId:site.site_id,kind,period,templateId,revision,folderRevision:documentData.site.folder_revision,state,content,photos:[...photos.values()].filter(p=>p.fresh&&used.has(p.id)).map(({id,mime,base64})=>({id,mime,base64}))},60000);
    config.onSaved?.();dirty=false;revision=latest=result.revision;for(const p of photos.values())p.fresh=false;
    if(current())await load(undefined,'저장했습니다.');
   }catch(e){if(current())note.textContent=errorText[e.message]||'저장하지 못했습니다. 입력 내용은 남아 있습니다. 연결을 확인하고 다시 저장해 주세요.';}
   finally{busy=false;if(editor)editor.inert=false;end?.();}
  }
  async function load(selectedRevision,success=''){
   const seq=++token;
   const loading=el('p','평가서를 불러오는 중입니다.','org-status');host.replaceChildren(loading);
   try{
    const [result]=await Promise.all([api({action:'platform_risk_open',siteId:site.site_id,kind,period,templateId,...(selectedRevision===undefined?{}:{revision:selectedRevision})}),loadTemplates()]);
    if(!current()||seq!==token)return;
    documentData=result;content=structuredClone(result.document.content);revision=result.document.revision;latest=result.latestRevision;history=result.history;template=result.template;photos=new Map((result.photos||[]).map(p=>[p.id,p]));dirty=false;draw();if(success)note.textContent=success;
   }catch(e){if(current()&&seq===token)host.replaceChildren(el('p','평가서를 불러오지 못했습니다.','org-status'),btn('다시 불러오기',()=>load(selectedRevision)),btn('평가서 목록',()=>{if(canLeave())onBack();}));}
  }
  function paper(sheet,printing=false){return window.enlRiskPaper(sheet,{content,site,kind,writable:writable(),changed,photoControl,print:printing});}
  function drawRows(){
   tab=sectionSelect.value;rowsHost.replaceChildren();
   const sheet=window.ENLRiskPaperTemplates[templateId].sheets.find(s=>s.name===tab);
   if(sheet)rowsHost.append(paper(sheet));
   drawAdditionalRows();
  }
  function drawAdditionalRows(){

   for(const row of content.rows.filter(r=>r.section===tab&&r.id.startsWith('custom-'))){
    const card=el('article',null,'risk-row');card.dataset.riskRow=row.id;card.dataset.level=row.level;card.classList.toggle('risk-excluded',row.excluded);
    const head=el('div',null,'risk-row-head');head.append(el('strong',row.number+'. '+(row.task||'추가 작업')));
    const excluded=el('label',null,'risk-exclude'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=row.excluded;checkbox.disabled=!writable();checkbox.setAttribute('aria-label',row.number+'번 평가 제외');
    checkbox.onchange=()=>{row.excluded=checkbox.checked;changed();drawRows();};excluded.append(checkbox,document.createTextNode('해당 작업 없음'));head.append(excluded);card.append(head);
    const grid=el('div',null,'risk-fields');grid.append(field('공정',row,'process'),field('세부 작업',row,'task'),field('유해위험요인',row,'hazard','textarea'));
    if(row.excluded)grid.append(field('제외 사유',row,'excludeReason','textarea'));
    else{
     const levelLabel=el('label','위험성 수준'),level=el('select');level.dataset.riskField='level';
     for(const [v,t] of [['','선택해 주세요'],['상','상 — 즉시 개선'],['중','중 — 개선 필요'],['하','하 — 현행 유지']])level.add(new Option(t,v));
     level.value=row.level;level.disabled=!writable();level.onchange=()=>{row.level=level.value;card.dataset.level=row.level;changed();};levelLabel.append(level);
     grid.append(levelLabel,field('개선대책',row,'measure','textarea'),field('담당자',row,'owner'),field('조치기한',row,'dueDate','date'),field('완료일',row,'doneDate','date'));
    }
    card.append(grid);
    if(writable()&&row.id.startsWith('custom-'))card.append(btn('추가 작업 삭제',()=>{if(confirm('이 추가 작업을 삭제할까요?')){content.rows=content.rows.filter(r=>r!==row);changed();drawRows();}},'risk-remove'));
    rowsHost.append(card);
   }
  }
  function draw(){
   editor=el('section',null,'risk-editor');note=el('p','','risk-message');note.setAttribute('role','status');note.setAttribute('aria-live','polite');
   const head=el('div',null,'org-head'),title=el('div');title.append(el('h3',site.site_name+' / '+caption[kind]),el('p',(kind==='regular'?period+'년 / ':'')+template.name+' 위험성평가','org-status'));
   const tools=el('div',null,'org-actions');tools.append(btn('평가서 목록',()=>{if(canLeave())onBack();},'org-back'),btn('인쇄 / PDF',print));head.append(title,tools);editor.append(head);
   const state=el('p',revision?'저장본 '+revision+' / '+(documentData.document.state==='completed'?'평가완료':'작성중')+' / '+(documentData.document.actor_name||''):'기본 양식 — 아직 저장하지 않았습니다.','risk-state');editor.append(state);
   if(history.length){
    const historyLabel=el('label','저장 이력'),select=el('select');select.dataset.riskHistory='';
    for(const h of history)select.add(new Option(h.revision+'차 / '+(h.state==='completed'?'평가완료':'작성중')+' / '+new Date(h.saved_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' / '+h.actor_name,String(h.revision)));
    select.value=String(revision);select.onchange=()=>{if(canLeave()){dirty=false;load(Number(select.value));}else select.value=String(revision);};historyLabel.append(select);editor.append(historyLabel);
   }
   if(revision!==latest)editor.append(el('p','이전 저장본은 조회만 가능합니다. 최신 저장본을 선택하면 수정할 수 있습니다.','risk-message'));
   else if(!writable())editor.append(el('p','조회 전용입니다. 해당 사업장 현장 계정과 안전관리자가 수정할 수 있습니다.','org-status'));
   if(kind==='initial')editor.append(field('사업장 오픈 예정일',content,'openingDate','date'));
   editor.append(el('p','제공된 엑셀 양식입니다. 사업장명과 평가구분은 자동 표시되며, 빨간 테두리 안에 평가일자, 평가대상, 평가자와 평가결과를 입력하세요. 표는 좌우로 이동할 수 있습니다.','risk-guide'));
   summary=el('p','','risk-summary');editor.append(summary);updateSummary();
   const nav=el('div',null,'risk-section-nav'),sectionLabel=el('label','작업 구분');sectionSelect=el('select');sectionSelect.dataset.riskSection='';
   for(const s of [...new Set(content.rows.map(r=>r.section))])sectionSelect.add(new Option(s,s));if([...sectionSelect.options].some(o=>o.value===tab))sectionSelect.value=tab;
   sectionSelect.onchange=drawRows;sectionLabel.append(sectionSelect);nav.append(sectionLabel);
   if(writable())nav.append(btn('작업 추가',()=>{if(content.rows.length>=300)return;content.rows.push({id:'custom-'+crypto.randomUUID(),number:Math.max(...content.rows.map(r=>r.number))+1,section:sectionSelect.value,process:'',task:'',hazard:'',level:'',measure:'',dueDate:'',doneDate:'',owner:'',excluded:false,excludeReason:''});changed();drawRows();rowsHost.lastElementChild.scrollIntoView({block:'center'});}));
   editor.append(nav);rowsHost=el('div',null,'risk-rows');editor.append(rowsHost);drawRows();
   editor.append(field('평가 메모',content,'notes','textarea'));
   const improvements=el('details',null,'risk-improvements');improvements.append(el('summary','개선 전후 기록 (3건)'),el('p','사진은 문서 표시용으로 크기를 조정해 저장합니다. 원본 사진은 별도로 보관해 주세요.','org-status'));
   for(const sheet of window.ENLRiskPaperTemplates[templateId].sheets.filter(s=>s.improvement))improvements.append(paper(sheet));
   editor.append(improvements,note);
   if(writable()){const actions=el('div',null,'risk-save-actions');actions.append(btn('저장',()=>save('draft'),'org-primary'),btn('평가완료로 저장',()=>save('completed')));editor.append(actions);}
   host.replaceChildren(editor);
  }
  function photoControl(row,key,label,printing=false){
   const box=el('div',null,'risk-photo');box.append(el('strong',label));const preview=el('div');box.append(preview);
   const paint=()=>{preview.replaceChildren();const p=photos.get(row[key]);if(p){const img=el('img');img.alt=label;img.src='data:'+p.mime+';base64,'+p.base64;preview.append(img);}else preview.append(el('p','등록된 사진 없음','org-status'));};paint();
   if(writable()&&!printing){
    const input=el('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/heic,image/heif';input.setAttribute('aria-label',label+' 선택');
    input.onchange=async()=>{
     if(busy||!input.files[0])return;busy=true;const end=window.ENLProcessing?.begin();
     try{const p=await preparePhoto(input.files[0]);if(current()){photos.set(p.id,{...p,fresh:true});row[key]=p.id;changed();paint();}}
     catch(e){note.textContent='사진을 읽지 못했습니다. JPG 또는 PNG 사진을 선택해 주세요.';}
     finally{input.value='';busy=false;end?.();}
    };box.append(input,btn('사진 제거',()=>{if(!busy){row[key]='';changed();paint();}},'risk-remove'));
   }return box;
  }
  function print(){
   const root=el('div');root.id='risk-print-page';root.className='risk-fixed-print';
   for(const sheet of window.ENLRiskPaperTemplates[templateId].sheets){
    const page=el('section',null,'risk-print-sheet');
    if(dirty||!revision)page.append(el('small','저장 전 작성본'));
    page.append(paper(sheet,true));root.append(page);
   }
   const extra=content.rows.filter(r=>r.id.startsWith('custom-'));
   if(extra.length||content.notes||content.openingDate){
    const page=el('section',null,'risk-print-sheet');page.append(el('h2','추가 기록'));
    if(content.openingDate)page.append(el('p','사업장 오픈 예정일: '+content.openingDate));
    for(const r of extra)page.append(el('p',[r.number,r.section,r.process,r.task,r.hazard,r.excluded?'제외: '+r.excludeReason:r.level,r.measure,r.dueDate,r.doneDate,r.owner].join(' / ')));
    if(content.notes)page.append(el('p','평가 메모: '+content.notes));root.append(page);
   }
   document.getElementById('risk-print-page')?.remove();document.body.append(root);
   const rules=el('style','@page {size:A4 portrait;margin:7mm}');document.head.append(rules);
   const cleanup=()=>{root.remove();rules.remove();};window.addEventListener('afterprint',cleanup,{once:true});
   try{window.print();}catch(e){cleanup();throw e;}
  }
  load();return {canLeave,canSuspend:()=>!busy,destroy};
 }
 window.enlRiskEditor=mount;
})();
