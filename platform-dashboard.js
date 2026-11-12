/* Integrated home: transparent illustration atlas, vector pictograms and existing scoped routes. */
(()=>{
 'use strict';
 const safe=v=>esc(String(v??''));
 const api=(body,timeout)=>window.enlIncidentApi({...body,actor:window.enlCurrentActor()},timeout);

 // Board rich text is serialized to an allowlisted document, never stored as raw HTML.
 const boardTags=new Set('p div br strong b em i u s h1 h2 h3 hr ul ol li a img table tbody tr td th span'.split(' '));
 const boardPinned=x=>x.pinned??(x.label==='important');
 function boardColor(value){
  if(/^#[0-9a-f]{6}$/i.test(value))return value.toLowerCase();
  const rgb=(value||'').match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  return rgb?'#'+rgb.slice(1).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):null;
 }
 function boardNodes(root){return [...root.childNodes].flatMap(n=>{
  if(n.nodeType===3)return [{text:n.textContent}];if(n.nodeType!==1)return [];
  const raw=n.tagName.toLowerCase();if(['script','style','iframe','object','embed','svg','template'].includes(raw))return [];
  const tag=({font:'span',strike:'s',mark:'span'})[raw]||raw;if(tag==='img')return n.dataset.assetId?[{tag,assetId:n.dataset.assetId}]:[];
  const children=boardNodes(n);if(!boardTags.has(tag))return children;
  const out={tag,children};if(tag==='a'){try{const u=new URL(n.getAttribute('href'));if(!['https:','http:'].includes(u.protocol))return children;out.href=u.href}catch{return children}}
  if(['left','center','right'].includes(n.style.textAlign))out.align=n.style.textAlign;
  const size=parseInt(n.style.fontSize)||[0,12,14,16,18,24,32][Number(n.getAttribute('size'))];if([12,14,16,18,24,32].includes(size))out.size=size;
  const color=boardColor(n.style.color||n.getAttribute('color'));if(color)out.color=color;
  const highlight=boardColor(n.style.backgroundColor)||(raw==='mark'?'#ffe471':null);if(highlight)out.highlight=highlight;
  if([1.2,1.5,1.8,2].includes(Number(n.style.lineHeight)))out.lineHeight=Number(n.style.lineHeight);
  return [out];
 });}
 function boardRender(nodes,root,images={}){for(const n of nodes||[]){
  if(typeof n.text==='string'){root.append(document.createTextNode(n.text));continue}if(!boardTags.has(n.tag))continue;
  const e=document.createElement(n.tag);if(n.tag==='img'){e.dataset.assetId=n.assetId;e.alt='본문 이미지';if(images[n.assetId])e.src=images[n.assetId];}
  if(n.tag==='a'){try{const u=new URL(n.href);if(['https:','http:'].includes(u.protocol)){e.href=u.href;e.target='_blank';e.rel='noopener noreferrer'}}catch{}}
  if(['left','center','right'].includes(n.align))e.style.textAlign=n.align;
  if([12,14,16,18,24,32].includes(n.size))e.style.fontSize=n.size+'px';if(/^#[0-9a-f]{6}$/i.test(n.color))e.style.color=n.color;
  if(/^#[0-9a-f]{6}$/i.test(n.highlight))e.style.backgroundColor=n.highlight;
  if([1.2,1.5,1.8,2].includes(n.lineHeight))e.style.lineHeight=n.lineHeight;
  boardRender(n.children,e,images);root.append(e);
 }}
 function boardBlob(file){return URL.createObjectURL(new Blob([Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0))],{type:file.mime||'application/octet-stream'}));}
 function boardEditor(form,item,assets,urls){
  const text=form.elements.body;const wrapper=document.createElement('div');wrapper.className='hub-rich-editor';
  wrapper.innerHTML='<span class="board-field-caption">내용</span><div class="hub-editor-toolbar" role="toolbar" aria-label="본문 서식"></div><div class="hub-editor-content" contenteditable="true" role="textbox" aria-label="게시글 내용" aria-multiline="true"></div><label class="hub-file-drop">파일을 끌어다 놓거나 선택하세요 (본문 사진 포함 최대 5개, 각 5MB, 합계 10MB)<input type="file" multiple data-board-files accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.hwp,.hwpx,.zip,.jpg,.jpeg,.png"></label><div data-board-assets></div>';
  text.parentElement.after(wrapper);text.parentElement.hidden=true;
  const editor=wrapper.querySelector('[contenteditable]'),toolbar=wrapper.querySelector('[role=toolbar]'),list=wrapper.querySelector('[data-board-assets]'),note=form.querySelector('[role=status]');
  if(item.document)boardRender(item.document,editor,urls);else editor.textContent=item.body||'';
  function bodyImageIds(){return new Set(Array.from(editor.querySelectorAll('img[data-asset-id]'),img=>img.dataset.assetId))}
  const inlineIds=bodyImageIds();
  function filesForSave(){
   const used=bodyImageIds();
   return assets.filter(file=>!inlineIds.has(file.id)||used.has(file.id));
  }
  let selection=null;
  function remember(){
   const sel=window.getSelection();
   if(sel?.rangeCount&&editor.contains(sel.anchorNode)&&editor.contains(sel.focusNode))selection=sel.getRangeAt(0).cloneRange();
  }
  function restore(){
   editor.focus();
   const sel=window.getSelection();
   if(selection&&editor.contains(selection.commonAncestorContainer)){sel.removeAllRanges();sel.addRange(selection)}
   else if(!editor.contains(sel.anchorNode)){const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);sel.removeAllRanges();sel.addRange(range)}
  }
  for(const event of ['keyup','mouseup','touchend','input','focusout'])editor.addEventListener(event,remember);
  function command(cmd,value){restore();document.execCommand(cmd,false,value);remember()}
  const group=()=>{const g=document.createElement('span');g.className='board-tool-group';toolbar.append(g);return g};
  function button(parent,label,icon,run){
   const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.textContent=icon;
   b.onmousedown=e=>e.preventDefault();b.onclick=run;parent.append(b);return b;
  }
  function select(parent,label,options,onchange,initial){
   const el=document.createElement('select');el.title=label;el.setAttribute('aria-label',label);
   for(const [value,caption] of options)el.add(new Option(caption,value));
   el.value=initial;el.onchange=()=>onchange(el.value);parent.append(el);return el;
  }
  for(const controls of [
   [['실행 취소','↶','undo'],['다시 실행','↷','redo']],
   [['제목 1','H₁','formatBlock','h1'],['제목 2','H₂','formatBlock','h2'],['제목 3','H₃','formatBlock','h3'],['일반 문단','¶','formatBlock','p']],
   [['굵게','B','bold'],['기울임','Ⅰ','italic'],['밑줄','U','underline'],['취소선','S','strikeThrough']],
   [['왼쪽 정렬','≡','justifyLeft'],['가운데 정렬','≡','justifyCenter'],['오른쪽 정렬','≡','justifyRight']],
   [['글머리 목록','• ☰','insertUnorderedList'],['번호 목록','1. ☰','insertOrderedList'],['구분선','―','insertHorizontalRule']]
  ]){
   const g=group();for(const [label,icon,cmd,value] of controls){const b=button(g,label,icon,()=>command(cmd,value));b.dataset.command=cmd;
    if(cmd.startsWith('justify'))b.innerHTML='<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 3h14M'+({justifyLeft:1,justifyCenter:4,justifyRight:7}[cmd])+' 6h8M1 9h14M'+({justifyLeft:1,justifyCenter:4,justifyRight:7}[cmd])+' 12h8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
   }
  }
  const colors=group();
  for(const [name,cmd,def,icon] of [['글자색','foreColor','#183651','A'],['형광펜','hiliteColor','#ffe471','▰']]){
   const label=document.createElement('label');label.className='board-color';label.title=name;label.textContent=icon;
   const input=document.createElement('input');input.type='color';input.value=def;input.setAttribute('aria-label',name);
   input.onchange=()=>command(cmd,input.value);
   const apply=button(colors,name+' 적용',icon,()=>command(cmd,input.value));apply.style.borderBottomColor=def;
   input.addEventListener('change',()=>{apply.style.borderBottomColor=input.value});label.textContent='▾';label.append(input);colors.append(label);
  }
  const fonts=group(),sizes=[12,14,16,18,24,32];
  select(fonts,'글자 크기',sizes.map(n=>[String(n),n+'px']),v=>command('fontSize',String(sizes.indexOf(Number(v))+1)),'14');
  select(fonts,'줄 간격',[['1.2','1.2줄'],['1.5','1.5줄'],['1.8','1.8줄'],['2','2줄']],v=>{
   restore();let range=window.getSelection().getRangeAt(0);
   let blocks=[...editor.querySelectorAll('p,div,h1,h2,h3,li,td,th')].filter(b=>range.intersectsNode(b));
   if(!blocks.length){command('formatBlock','p');range=window.getSelection().getRangeAt(0);blocks=[...editor.querySelectorAll('p')].filter(b=>range.intersectsNode(b))}
   for(const block of blocks)block.style.lineHeight=v;remember();
  },'1.8');
  const inserts=group();
  const table=select(inserts,'표 삽입',[['','▦ 표'],['2x2','2 × 2'],['3x3','3 × 3'],['4x3','4 × 3']],v=>{
   if(!v)return;const [rows,cols]=v.split('x').map(Number);
   command('insertHTML','<table><tbody>'+('<tr>'+'<td><br></td>'.repeat(cols)+'</tr>').repeat(rows)+'</tbody></table><p><br></p>');table.value='';
  },'');
  const imagePicker=document.createElement('input');imagePicker.type='file';imagePicker.accept='image/jpeg,image/png';imagePicker.hidden=true;wrapper.append(imagePicker);
  button(inserts,'본문 이미지 삽입','사진 삽입',()=>imagePicker.click());
  imagePicker.onchange=async()=>{
   if([...imagePicker.files].some(f=>!/[.](jpe?g|png)$/i.test(f.name))){note.textContent='본문 사진은 JPG 또는 PNG 파일을 선택하세요.';imagePicker.value='';return}
   const added=await addFiles([...imagePicker.files],true);imagePicker.value='';if(added?.length){const a=added[0];command('insertHTML','<img data-asset-id="'+a.id+'" src="'+urls[a.id]+'" alt="본문 이미지">');paint()}};
  const source=document.createElement('textarea');source.className='board-source';source.hidden=true;source.setAttribute('aria-label','본문 HTML 소스');editor.after(source);
  function applySource(){
   if(source.hidden)return;
   const template=document.createElement('template');template.innerHTML=source.value;
   const nodes=boardNodes(template.content);editor.replaceChildren();boardRender(nodes,editor,urls);
   source.hidden=true;editor.hidden=false;selection=null;
   for(const id of bodyImageIds())inlineIds.add(id);
   paint();
   for(const el of toolbar.querySelectorAll('button,select,input'))el.disabled=false;
   toggle.setAttribute('aria-pressed','false');
  }
  const toggle=button(inserts,'HTML 소스 편집','</>',()=>{
   if(!source.hidden){applySource();editor.focus();return}
   const clean=document.createElement('div');boardRender(boardNodes(editor),clean);source.value=clean.innerHTML;
   editor.hidden=true;source.hidden=false;
   for(const el of toolbar.querySelectorAll('button,select,input'))el.disabled=el!==toggle;
   toggle.setAttribute('aria-pressed','true');source.focus();
  });
  editor.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
  editor.addEventListener('drop',e=>e.preventDefault());
  const dialog=form.closest('dialog');
  const attachmentCount=document.createElement('span');
  attachmentCount.className='board-attachment-count';attachmentCount.setAttribute('role','status');
  dialog.querySelector('header button').before(attachmentCount);
  function paint(){
   const downloads=assets.filter(file=>!inlineIds.has(file.id));
   attachmentCount.textContent=downloads.length?'첨부 '+downloads.length+'개':'';
   list.replaceChildren();for(const f of downloads){const line=document.createElement('div');line.className='hub-asset-row';const name=document.createElement('span');name.textContent=f.name;line.append(name);
   if(f.mime?.startsWith('image/')){const b=document.createElement('button');b.type='button';b.textContent='본문에 넣기';b.onclick=()=>{applySource();const p=document.createElement('p');p.style.textAlign='center';boardRender([{tag:'img',assetId:f.id}],p,urls);editor.append(p);inlineIds.add(f.id);paint()};line.append(b)}
   const remove=document.createElement('button');remove.type='button';remove.textContent='제외';remove.onclick=()=>{applySource();assets.splice(assets.indexOf(f),1);editor.querySelectorAll('img').forEach(n=>{if(n.dataset.assetId===f.id)n.remove()});paint()};line.append(remove);list.append(line);
  }}paint();
  const picker=wrapper.querySelector('[data-board-files]'),drop=picker.closest('label');
  async function addFiles(selected,inline=false){
   if(!selected.length||picker.disabled)return;
   picker.disabled=true;form.dataset.filesPending='true';form.querySelector('[type=submit]').disabled=true;
   try{const current=filesForSave();if(current.length+selected.length>5||current.reduce((n,f)=>n+f.size,0)+selected.reduce((n,f)=>n+f.size,0)>10485760)throw Error();
    const added=[];for(const f of selected){if(!f.size||f.size>5242880||f.name.length>180||!/[.](pdf|xlsx?|docx?|pptx?|hwpx?|zip|jpe?g|png)$/i.test(f.name))throw Error();
     const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(f)});
     const a={id:crypto.randomUUID(),name:f.name,size:f.size,base64,mime:/\.png$/i.test(f.name)?'image/png':/\.jpe?g$/i.test(f.name)?'image/jpeg':'application/octet-stream'};added.push(a);
    }
    if(!form.closest('dialog')?.open)return;for(const a of added){assets.push(a);if(inline)inlineIds.add(a.id);urls[a.id]=boardBlob(a)}paint();note.textContent='';return added;
   }catch{note.textContent='파일은 최대 5개, 각 5MB, 합계 10MB이며 지원 형식이어야 합니다.'}finally{delete form.dataset.filesPending;form.querySelector('[type=submit]').disabled=false;picker.disabled=false;picker.value=''}
  }
  picker.onchange=()=>addFiles([...picker.files]);
  picker.id='board-files-'+crypto.randomUUID();
  dialog.dataset.attachmentInput=picker.id;
  const files=form.querySelector('[data-file-section]');files.append(drop,list);
  return {editor,applySource,filesForSave};
 }
 const paths={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',calendar:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2"/>',notice:'<path d="M3 10h5l11-6v16L8 14H3zM7 14l2 7h3l-2-6M22 9v6"/>',clock:'<circle cx="12" cy="13" r="9"/><path d="M9 1h6m-3 3v9l4 2"/>',file:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',grid:'<rect x="2" y="2" width="8" height="8" rx="2"/><rect x="14" y="2" width="8" height="8" rx="2"/><rect x="2" y="14" width="8" height="8" rx="2"/><rect x="14" y="14" width="8" height="8" rx="2"/>'};
 Object.assign(paths,{
  approvals:'<path d="M11 4H4v17h17v-9M9 16l1-5L19 2l3 3-9 9zM17 4l3 3"/>',
  bell:'<path d="M18.5 9a6.5 6.5 0 0 0-13 0c0 4.7-.7 6.3-2.1 8.2a.8.8 0 0 0 .7 1.3h15.8a.8.8 0 0 0 .7-1.3c-1.4-1.9-2.1-3.5-2.1-8.2Z"/><path d="M10 21a2.3 2.3 0 0 0 4 0M12 2.5v-1"/>',
  person:'<circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><path d="M3 21c.6-4.7 4.1-7.2 9-7.2s8.4 2.5 9 7.2" fill="currentColor" stroke="none"/>',
  grid:'<rect x="2" y="2" width="8" height="8" rx="1.5" fill="#244479" stroke="none"/><rect x="14" y="2" width="8" height="8" rx="1.5" fill="#31598e" stroke="none"/><rect x="2" y="14" width="8" height="8" rx="1.5" fill="#2373ff" stroke="none"/><rect x="14" y="14" width="8" height="8" rx="1.5" fill="#1555ed" stroke="none"/>'
 });
 const svg=(key,extra={})=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[key]||extra[key]||paths.file)+'</svg>';
 // A compact vector vocabulary for navigation, separate from the large card illustrations.
 const sidebarKeys=new Set('home incident risk tbm organization training msds support system policy law voice emergency ppe ergonomics rules favorites history approvals notices documents dashboard bulletins schedule'.split(' '));
 function sidebarIcon(key,custom){
  const id=sidebarKeys.has(key)?key:'module';
  const use='<use href="assets/sidebar-pictograms-r58.svg#'+id+'"/>';
  const glyph=custom?'<g transform="translate(0 1) scale(.74)">'+use+'</g><text x="23" y="22" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" font-weight="800" fill="currentColor" stroke="none">'+custom+'</text>':use;
  return '<svg class="hub-nav-picto" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</svg>';
 }
 const descriptions={incident:'사고 발생 시<br>신속한 보고 및 관리',risk:'작업 공정별 위험요인<br>발굴 및 개선관리',tbm:'작업 전 안전회의<br><span>(Tool Box Meeting) 관리</span>',organization:'안전보건 조직 및<br>역할 책임 관리',training:'법정 직무 특별교육의<br>계획, 운영, 이력관리',msds:'화학물질정보<br>(MSDS) 등록 관리',support:'전자결재, 문서관리,<br>기준정보 등 공통업무 지원',system:'사용자, 권한, 코드,<br>환경설정 등 시스템 운영'};
 const safetyIcons={policy:'방침과 목표',law:'법령 요지',voice:'의견 청취',emergency:'비상 대응',ppe:'보호구',ergonomics:'근골격계 조사',rules:'관리규정'};
 Object.assign(descriptions,{policy:'방침 및 추진 목표',law:'주요 법령 확인',voice:'의견 접수 및 조치',emergency:'비상계획 및 훈련',ppe:'지급 내역 및 점검',ergonomics:'부담작업 조사',rules:'규정 및 개정 이력'});
 const seoulDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'});
 const seoulTime=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const day=d=>seoulDay.format(d||new Date());
 const time=v=>v?seoulTime.format(new Date(v)):'';
 const date=v=>v?day(new Date(v)).replaceAll('-','.'):'';
 function relative(v){const t=Date.parse(v);if(!Number.isFinite(t))return '';const m=Math.max(0,Math.floor((Date.now()-t)/60000));return m<1?'방금 전':m<60?m+'분 전':m<1440?Math.floor(m/60)+'시간 전':date(v)}
 function dialog(host,title){const d=document.createElement('dialog');d.className='hub-dialog';d.innerHTML='<header><h2>'+safe(title)+'</h2><button type="button" aria-label="닫기">×</button></header><div class="hub-dialog-body"></div>';host.append(d);d.querySelector('header button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();return d;}
 const artworkCells={incident:0,risk:1,tbm:2,organization:3,training:4,msds:5,support:6,system:7};
 let artworkImage,stopArtwork=()=>{};
 function loadArtwork(){
  if(!artworkImage)artworkImage=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{artworkImage=null;reject(new Error('artwork_load_failed'))};im.src='assets/hub-icons-r43.png'});
  return artworkImage;
 }
 function renderArtwork(host){
  stopArtwork();let stopped=false,frame=0,observer,ratioQuery;
  const nodes=Array.from(host.querySelectorAll('.hub-art'));
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint)};
  function watchRatio(){ratioQuery?.removeEventListener('change',onRatio);ratioQuery=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');ratioQuery.addEventListener('change',onRatio)}
  function onRatio(){watchRatio();schedule()}
  async function paint(){
   let im;try{im=await loadArtwork()}catch{return}
   if(stopped||!host.isConnected)return;
   const dpr=window.devicePixelRatio||1,cell=im.naturalWidth/3;
   // Keep both hover steps on physical pixels at fractional screen scales.
   host.style.setProperty('--hub-hover-lift',(-2*Math.max(1,Math.round(dpr))/dpr)+'px');
   for(const node of nodes){
    if(!node.isConnected)continue;
    const key=Object.keys(artworkCells).find(k=>node.classList.contains('hub-art-'+k));if(key===undefined)continue;
    const width=node.getBoundingClientRect().width;if(!width)continue;
    const physical=Math.max(1,Math.round(width*dpr)),size=physical/dpr;
    const pixels=Math.max(physical,Math.round(size*2)); // At least 2x sampling, including ordinary desktop displays.
    let canvas=node.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');node.append(canvas)}
    canvas.width=pixels;canvas.height=pixels;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const n=artworkCells[key];ctx.drawImage(im,(n%3)*cell,Math.floor(n/3)*cell,cell,cell,0,0,pixels,pixels);
    // Align the finished bitmap to physical pixels; avoid a transformed raster layer.
    node.classList.add('hub-art-ready');const rect=node.getBoundingClientRect();
    canvas.style.width=size+'px';canvas.style.height=size+'px';
    canvas.style.left=(Math.round(rect.left*dpr)/dpr-rect.left)+'px';
    canvas.style.top=(Math.round((rect.top-size/2)*dpr)/dpr-rect.top)+'px';
   }
  }
  observer=new ResizeObserver(schedule);nodes.forEach(n=>{observer.observe(n);if(n.parentElement)observer.observe(n.parentElement)});
  window.addEventListener('resize',schedule);watchRatio();schedule();
  stopArtwork=()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);ratioQuery?.removeEventListener('change',onRatio)};
 }
 function decorateCard(row,m,support){if(support&&m.key!=='system')return;
  const b=row.querySelector('.platform-card'),icon=b.querySelector('.platform-icon');icon.className='hub-art hub-art-'+m.key;icon.replaceChildren();
  const art=m.iconKey||m.key;
  if(Object.hasOwn(safetyIcons,art)){
   row.classList.add('hub-safety-card');
   icon.className='hub-art hub-safety-art';
   const img=document.createElement('img');img.src='assets/safety-cards/'+art+'.webp';img.alt='';img.width=320;img.height=320;icon.append(img);
  }
  if(row.dataset.state==='live' && row.dataset.on==='true')b.querySelector('small').textContent='운영중';
  b.querySelector('strong').classList.add('hub-card-title');
  b.insertAdjacentHTML('beforeend','<span class="hub-card-description">'+(descriptions[m.key]||'')+'</span><span class="hub-card-arrow" aria-hidden="true">'+svg('arrow')+'</span>');
 }
 let stopBanner=()=>{};
 const bannerNotices={
  welcome:['286f859b-4f6d-497a-b086-c2286a266f01','통합홈 이용 안내'],
  opening:['286f859b-4f6d-497a-b086-c2286a266f02','시스템 오픈 및 이용 문의'],
  health:['286f859b-4f6d-497a-b086-c2286a266f03','건강검진 대상 확인 및 예약'],
  fire:['286f859b-4f6d-497a-b086-c2286a266f04','골프장 화재예방 점검'],
  report:['286f859b-4f6d-497a-b086-c2286a266f05','사고 발생 즉시 보고']
 };
 function syncBannerNoticeLinks(host){
  for(const button of host.querySelectorAll('.hub-banner-notice')){
   button.hidden=Boolean(host.availableNoticeIds&&!host.availableNoticeIds.has(button.dataset.noticeId));
  }
 }
 function startBanner(host,openNotice){
  stopBanner();const hero=host.querySelector('.hub-hero'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,position=1,moving=false,timer=0,settleTimer=0,frame=0,stopped=false,touch=null;
  if(!hero.enlOriginalBanner)hero.enlOriginalBanner=Array.from(hero.children).map(n=>n.cloneNode(true));
  const slides=window.ENLBanners?.resolve(host.bannerConfig)||[null];
  hero.dataset.slideCount=String(slides.length);hero.hidden=!slides.length||!!host.dataset.workspace&&host.dataset.workspace!=='home';if(!slides.length)return;
  hero.classList.add('hub-carousel');hero.setAttribute('aria-label','안전보건 안내 배너');hero.setAttribute('aria-roledescription','슬라이드');hero.tabIndex=0;
  const track=document.createElement('div');track.className='hub-banner-track no-motion';
  for(const s of slides){
   const slide=document.createElement('section');slide.className='hub-banner-slide';
   if(!s){slide.classList.add('hub-slide-original');slide.append(...hero.enlOriginalBanner.map(n=>n.cloneNode(true)))}
   else if(s.url){slide.classList.add('hub-slide-upload');const img=document.createElement('img');img.className='hub-uploaded-banner';img.src=s.url;img.alt=s.title;img.style.objectFit=s.fit;slide.append(img)}
   else if(window.ENLBanners?.markup(s.key)){slide.classList.add('hub-slide-designed','hub-design-'+s.key);slide.dataset.campaign=s.key;slide.innerHTML=window.ENLBanners.markup(s.key)}
   else {slide.classList.add('hub-slide-campaign');if(s.image)slide.classList.add('hub-slide-scene');slide.dataset.campaign=s.key;
    slide.innerHTML=(s.image?'<img class="hub-campaign-background" src="assets/banners/'+s.image+'" alt="" width="2172" height="724" decoding="async">':'')+
     '<div class="hub-campaign-copy"><small>'+safe(s.eyebrow||'SAFE WORKPLACE')+'</small><h2>'+safe(s.title)+'</h2><p>'+safe(s.body)+'</p></div>'+
     (s.art?'<img class="hub-campaign-art" src="assets/safety-cards/'+s.art+'.webp" width="320" height="320" alt="">':'');
   }
   const notice=bannerNotices[s?s.key:'welcome'];
   if(notice){
    const link=document.createElement('button');link.type='button';link.className='hub-banner-notice';
    link.dataset.noticeId=notice[0];link.setAttribute('aria-label',notice[1]+' 공지 읽기');
    const caption=document.createElement('span');caption.textContent='자세히 보기 ›';link.append(caption);slide.append(link);
   }
   track.append(slide);
  }
  const first=track.firstElementChild.cloneNode(true);track.prepend(track.lastElementChild.cloneNode(true));track.append(first);
  const controls=document.createElement('div');controls.className='hub-banner-controls';controls.hidden=slides.length<2;
  controls.innerHTML='<button type="button" data-prev aria-label="이전 배너"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div data-dots aria-label="배너 선택"></div><button type="button" data-next aria-label="다음 배너"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>';
  hero.replaceChildren(track,controls);syncBannerNoticeLinks(host);
  const nodes=Array.from(track.children);
  slides.forEach((_,n)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(n+1)+' / '+slides.length+'번 배너 보기');b.onclick=()=>move(n,n-index);controls.querySelector('[data-dots]').append(b)});
  function paint(){
   hero.dataset.slide=String(index);hero.dataset.slideCount=String(slides.length);
   track.style.transform='translate3d('+(-position*100)+'%,0,0)';
   nodes.forEach((node,n)=>{node.inert=n!==index+1;node.setAttribute('aria-hidden',String(n!==index+1));if(n>0&&n<=slides.length)node.setAttribute('aria-label',n+' / '+slides.length)});
   controls.querySelectorAll('[data-dots] button').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===index)));
  }
  function finish(){
   clearTimeout(settleTimer);if(stopped)return;
   if(position===0||position===slides.length+1){position=index+1;track.classList.add('no-motion');paint();void track.offsetWidth;}
   moving=false;track.classList.toggle('no-motion',motion.matches);
   scheduleNext();
  }
  function move(next,direction){
   if(stopped||moving)return;
   const target=(next+slides.length)%slides.length;if(target===index)return;
   clearTimeout(timer);
   position=direction>0&&index===slides.length-1&&target===0?slides.length+1:direction<0&&index===0&&target===slides.length-1?0:target+1;
   index=target;moving=!motion.matches;track.classList.toggle('no-motion',motion.matches);paint();
   if(moving)settleTimer=setTimeout(finish,850);else finish();
  }
  track.addEventListener('transitionend',e=>{if(e.target===track&&e.propertyName==='transform')finish()});
  function scheduleNext(){
   clearTimeout(timer);
   if(!stopped&&slides.length>1)timer=setTimeout(tick,10000);
  }
  function tick(){
   if(!host.isConnected){stop();return}
   if(!document.hidden&&(!host.dataset.workspace||host.dataset.workspace==='home')){
    move(index+1,1);
   }else scheduleNext();
  }
  controls.querySelector('[data-prev]').onclick=()=>move(index-1,-1);controls.querySelector('[data-next]').onclick=()=>move(index+1,1);
  hero.onpointerenter=null;hero.onpointerleave=null;
  hero.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(index+(e.key==='ArrowLeft'?-1:1),e.key==='ArrowLeft'?-1:1)}};
  let suppressTapUntil=0;
  track.onclick=e=>{
   const link=e.target.closest('.hub-banner-notice');
   if(link&&!moving&&!stopped&&(e.detail===0||Date.now()>=suppressTapUntil))openNotice(link.dataset.noticeId);
  };
  hero.onpointerdown=e=>{touch=e.pointerType==='touch'&&!e.target.closest('.hub-banner-controls')?{x:e.clientX,y:e.clientY}:null};
  hero.onpointerup=e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3){suppressTapUntil=Date.now()+600;move(index+(dx<0?1:-1),dx<0?1:-1)}};
  hero.onpointercancel=()=>{touch=null};
  const reduce=()=>{finish();track.classList.toggle('no-motion',motion.matches)};motion.addEventListener('change',reduce);
  function stop(){stopped=true;clearTimeout(timer);clearTimeout(settleTimer);cancelAnimationFrame(frame);motion.removeEventListener('change',reduce)}
  stopBanner=stop;paint();frame=requestAnimationFrame(()=>{if(!stopped)track.classList.toggle('no-motion',motion.matches)});scheduleNext();
 }
 function mount(host,u,{go,icons,names,featureName,manageCards}){
  const admin=u.role==='safety',userKey=JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);let catalog=null,content={notices:[],events:[],favorites:[]},loaded=false,contentError='',recent=[],recentError='',busy=false;
  const sameUser=()=>{const a=currentUser?.();return a&&JSON.stringify([a.id||a.personnelId,a.role,a.siteId||''])===userKey&&host.isConnected};
  const action=(key,label,cls='')=>'<button type="button" class="'+cls+'" data-hub="'+key+'"'+(key==='notifications'?' aria-label="알림센터"':key==='menu'?' aria-label="메뉴 열기"':key==='search'?' aria-label="통합검색"':'')+'>'+label+'</button>';
  const panel=(key,title,icon,more)=>'<section class="hub-panel hub-'+key+'"><header><h2>'+svg(icon,icons)+title+'</h2>'+action(key,more||'더보기 ›')+'</header><div data-list="'+key+'"><p class="hub-empty">불러오는 중입니다.</p></div></section>';
  host.innerHTML='<aside class="hub-sidebar"><div class="hub-logo"><img src="assets/enl-wordmark.svg" width="102" height="52" alt="이앤엘 E&amp;L"></div><nav aria-label="통합시스템 메뉴"></nav><section class="hub-favorites"><header><h2>'+sidebarIcon('favorites')+'즐겨찾기</h2>'+action('favorites','＋')+'</header><div></div></section><div class="hub-sidebar-wave" aria-hidden="true"></div></aside><button class="hub-sidebar-backdrop" type="button" data-hub="close-menu" aria-label="메뉴 닫기"></button><section class="hub-hero"><div class="hub-hero-image" role="img" aria-label="골프장 풍경과 이앤엘 문구: 안전이 일상이 되는 안전보건관리 통합시스템"></div><div class="hub-original-slogan"><b>E&amp;L</b><div><span>안전이 일상이 되는</span><strong>안전보건관리 통합시스템</strong></div></div></section><div class="hub-middle"><section class="hub-features"><header class="hub-section-heading"><h2>'+svg('grid')+'주요 업무기능</h2><p>안전보건 업무를 한 곳에서 통합 관리하세요.</p>'+action('guide','ⓘ 모듈 안내')+(admin?action('manage-cards','카드 관리','hub-card-manager')+action('edit','편집','hub-edit-toggle'):'')+'</header><div class="platform-modules feature-list"></div></section><div class="hub-right">'+panel('recent','최근 업무 기록','clock')+panel('approvals','통합결재 대기 <span data-approval-count></span>','approvals')+'</div></div><div class="hub-bottom">'+panel('bulletins','공지사항','notice')+panel('schedule','오늘의 일정 <small>'+safe(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date()))+'</small>','calendar','전체 일정 ›')+'</div><p class="hub-status" role="status" aria-live="polite"></p><section class="hub-support hub-tool-panel" hidden><h2>공통업무지원서비스</h2><section class="platform-services feature-list"><div class="platform-grid"></div></section></section><section class="hub-module-preview hub-tool-panel" hidden><h2></h2><p>이 업무의 세부 기능은 구현 중입니다.</p></section>';
  const area=host.querySelector('.platform-modules'),services=host.querySelector('.platform-services .platform-grid'),status=host.querySelector('.hub-status');
  const recentLink=host.querySelector('[data-hub=recent]');
  recentLink.hidden=!window.enlHistoryAvailable?.(u);
  recentLink.dataset.recentHistory='';recentLink.dataset.historyScope='all';
  function bindHeader(){
   const topbar=host.closest('.app-shell')?.querySelector('.topbar');
   if(!topbar)return;
   cleanup();
   const avatar=topbar.querySelector('.user-chip .avatar');
   if(avatar)avatar.innerHTML=svg('person');
   topbar.querySelector('.user-chip')?.setAttribute('aria-label',(u.name||'사용자')+' 계정 메뉴');
   topbar.querySelector('.topbar-tools').insertAdjacentHTML('beforeend',action('search',svg('search')+'<span>업무, 문서, 교육, 사고 등 통합검색</span><kbd>Ctrl + K</kbd>','hub-search')+action('notifications',svg('bell'),'hub-bell'));
   topbar.querySelector('.brand').insertAdjacentHTML('beforebegin',action('menu','☰','hub-mobile-menu'));
   topbar.querySelectorAll('[data-hub]').forEach(b=>b.onclick=()=>dispatch(b.dataset.hub));
  }
  bindHeader();
  function items(){return catalog?[...catalog.modules,...catalog.services]:[];}
  const entry=key=>items().find(x=>x.key===key);
  const canBrowseDocuments=['field','safety','manager','executive'].includes(u.role);
  function documentInfo(key){
    if(!canBrowseDocuments||!key.startsWith('document:'))return null;
    return catalog?.documentMenus?.find(item=>item.key===key.slice('document:'.length));
  }
  const moduleAvailable=m=>!!m&&m.enabled!==false&&m.canEnter!==false&&m.state!=='hidden'&&(m.state==='live'||m.preview);
  async function allowed(key){const m=entry(key);if(!moduleAvailable(m)){status.textContent='현재 접근할 수 없는 업무입니다.';return false}try{await api({action:'platform_enter',key});return sameUser()}catch{status.textContent='접근 권한 또는 연결 상태를 확인해 주세요.';return false}}
  function clickFeature(key){return selectTab(key);}
  function support(){return selectTab('support');}
  function addSupportCard(grid){const r=document.createElement('article');r.className='hub-support-card feature-card-wrap';r.dataset.key='support';r.dataset.state='live';r.dataset.on='true';r.innerHTML=action('support','<span class="hub-art hub-art-support" aria-hidden="true"></span><strong class="hub-card-title">공통업무지원<wbr>서비스</strong><span class="hub-card-description">'+descriptions.support+'</span><small>운영중</small><span class="hub-card-arrow" aria-hidden="true">'+svg('arrow')+'</span>','platform-card');r.firstElementChild.onclick=support;grid.append(r);return r}
  // Tab membership belongs to this signed-in dashboard and disappears with it on logout.
  const opened=['home'];
  const boards={
    boardAll:{kind:'all',title:'전체 게시글',icon:'bulletins'},
    bulletins:{kind:'notice',title:'공지사항',icon:'bulletins'},
    incidentAlerts:{kind:'alert',title:'사고알리미',icon:'incident'},
    safetyNews:{kind:'news',title:'안전뉴스',icon:'notices'},
    resources:{kind:'resource',title:'자료실',icon:'documents'}
  };
  const boardKey=kind=>Object.keys(boards).find(key=>boards[key].kind===kind);
  const builtins={...Object.fromEntries(Object.entries(boards).map(([key,b])=>[key,b.title])),home:'통합 홈',support:'공통업무지원서비스',schedule:'전체 일정',recent:'최근 업무 기록',inquiry:admin?'문의함':'안전관리자 문의'};
  let stripSignature='';
  let active='home',request=0,incidentView='',inquiryOrigin='home';
  const strip=document.createElement('nav');
  strip.className='hub-worktabs';strip.setAttribute('aria-label','열린 업무');
  function tabTitle(key){
    if(Object.hasOwn(builtins,key))return builtins[key];
    const info=documentInfo(key);if(info)return info.displayName;
    const m=entry(key);return m?featureName(m):(names[key]||key);
  }
  function paintTabs(){
    const header=host.closest('.app-shell')?.querySelector('.topbar');
    if(!header)return;
    if(header.nextElementSibling!==strip)header.after(strip);
    const selectedFeature=documentInfo(active)?.key||active;
    const selectedMenu=boards[active]?'boards':['home','support'].includes(active)?active:'feature:'+selectedFeature;
    host.querySelectorAll('.hub-sidebar nav [data-hub]').forEach(b=>{
      b.classList.toggle('on',b.dataset.hub===selectedMenu);
    });
    const signature=JSON.stringify([active,opened.map(k=>[k,tabTitle(k)])]);
    if(signature===stripSignature)return;
    stripSignature=signature;
    const hadFocus=strip.contains(document.activeElement);
    strip.replaceChildren();
    for(const key of opened){
      const item=document.createElement('div'),pick=document.createElement('button');
      item.className='hub-worktab';pick.type='button';pick.dataset.worktab=key;
      pick.innerHTML=sidebarIcon(boards[key]?.icon||(sidebarKeys.has(key)?key:entry(key)?.iconKey))+'<span>'+safe(tabTitle(key))+'</span>';
      if(active===key){item.classList.add('selected');pick.setAttribute('aria-current','page');}
      pick.onclick=()=>selectTab(key);item.append(pick);
      if(key!=='home'){
        const close=document.createElement('button');close.type='button';close.className='hub-tab-close';
        close.setAttribute('aria-label',tabTitle(key)+' 탭 닫기');close.textContent='×';
        close.onclick=()=>closeTab(key);item.append(close);
      }
      strip.append(item);
    }
    const picked=strip.querySelector('[aria-current="page"]');
    if(hadFocus)picked?.focus({preventScroll:true});
    if(picked){const a=picked.parentElement.getBoundingClientRect(),b=strip.getBoundingClientRect();if(a.right>b.right)strip.scrollLeft+=a.right-b.right+8;else if(a.left<b.left)strip.scrollLeft+=a.left-b.left-8;}
  }
  const org=window.enlOrganization?.(host,u,api,sameUser);
  function canLeave(){
    if(active==='organization'&&org&&!org.canLeave())return false;
    const changed=document.querySelector('#view [data-worktab-edited],#view [data-wf440-dirty="1"]');
    if(window.enlIncidentSaveInProgress?.()){
      alert('저장 중입니다. 저장이 끝나면 탭을 이동해 주세요.');return false;
    }
    return !changed||confirm('작성 중인 내용이 있어요. 현재 화면을 벗어날까요?');
  }
  function placeFrame(view){
    const atHome=active==='home';
    if(atHome&&host.dataset.workspace&&host.dataset.workspace!=='home')host.reloadCatalog?.();
    host.classList.toggle('hub-incident-workspace',!atHome);
    host.dataset.workspace=active;
    const hero=host.querySelector('.hub-hero');hero.hidden=!atHome||Number(hero.dataset.slideCount)===0;
    if(atHome){if(host.parentElement!==view)view.replaceChildren(host);}
    else if(host.nextElementSibling!==view)view.before(host);
    host.querySelector('.hub-support').hidden=active!=='support';
    const preview=host.querySelector('.hub-module-preview');
    preview.hidden=Object.hasOwn(builtins,active)||['incident','system','history','notices','approvals','organization'].includes(active);
    for(const panel of host.querySelectorAll('[data-list-workspace]'))panel.hidden=panel.dataset.listWorkspace!==active;
    if(!preview.hidden)preview.querySelector('h2').textContent=tabTitle(active);
    paintTabs();
  }
  function showTab(key,historyScope='all'){
    const view=host.closest('.app-shell').querySelector('#view');
    if(active==='organization'&&key!==active)org?.leave();
    if(active==='incident')incidentView=currentView;
    if(key==='inquiry')inquiryOrigin=active;
    if(!opened.includes(key))opened.push(key);
    active=key;host.classList.remove('hub-menu-open','hub-editing');
    host.querySelector('.hub-edit-toggle')?.replaceChildren('편집');
    status.textContent='';
    placeFrame(view);
    const native={home:'platform',system:'system-admin',history:'common-history',recent:'history',inquiry:['field','worker'].includes(u.role)?'field-inquiry':'inquiry',notices:'notice-center',incident:incidentView||(['field','worker'].includes(u.role)?'home':'stats')};
    if(key==='history'||key==='recent')window.enlRequestHistory?.(historyScope);
    go(native[key]||'platform-tool');
    if(key==='organization')org.open();
    if(key==='approvals')approvalWorkspace();
    if(boards[key])listBoard(key);
    if(key==='schedule')listSchedule();
    if(key==='home'){renderArtwork(host);loadContent();loadRecent();loadBanners();}
    window.scrollTo(0,0);
  }
  async function selectTab(key,closing=false,historyScope='all'){
    if(key==='organization'&&!org){status.textContent='조직도 화면을 불러오지 못했습니다. 새로고침해 주세요.';return false;}
    if(key==='recent'&&!window.enlHistoryAvailable?.(u))return false;
    const token=++request;
    if(key===active){host.classList.remove('hub-menu-open');return true;}
    if(!Object.hasOwn(builtins,key)&&!documentInfo(key)&&!(await allowed(key))){
      if(!closing)return false;
      key='home';
    }
    if(token!==request||!sameUser()||!canLeave())return false;
    showTab(key,historyScope);return true;
  }
  async function closeTab(key){
    if(key==='home')return;
    const index=opened.indexOf(key);if(index<0)return;
    if(key===active){
      const next=key==='inquiry'&&opened.includes(inquiryOrigin)?inquiryOrigin:key==='recent'?'home':opened[index-1];
      if(!await selectTab(next,true))return;
    }else ++request;
    const remove=opened.indexOf(key);if(remove<0||active===key)return;
    opened.splice(remove,1);
    if(key==='incident')incidentView='';
    paintTabs();strip.querySelector('[aria-current]')?.focus({preventScroll:true});
  }
  host.activateWorkTab=selectTab;
  host.leaveInquiry=()=>selectTab(opened.includes(inquiryOrigin)?inquiryOrigin:'home');
  host.syncWorkView=(view,actor)=>{
    if(JSON.stringify([actor.id||actor.personnelId,actor.role,actor.siteId||''])!==userKey)return;
    const fixed={platform:'home',history:'recent',inquiry:'inquiry','field-inquiry':'inquiry','common-history':'history','notice-center':'notices','system-admin':'system',more:'system'};
    const next=fixed[currentView]||(currentView==='platform-tool'?active:'incident');
    if(!opened.includes(next))opened.push(next);
    active=next;placeFrame(view);
  };
  host.restoreIncidentFrame=(view,actor)=>{
    if(JSON.stringify([actor.id||actor.personnelId,actor.role,actor.siteId||''])!==userKey)return;
    view.closest('.app-shell').enlWorkspaceFrame=host;
    view.before(host);host.syncWorkView(view,actor);bindHeader();
  };
  paintTabs();
  function menuPictogram(key){
    if(sidebarKeys.has(key))return sidebarIcon(key);
    const customModules=catalog.modules.filter(m=>!sidebarKeys.has(m.key)).sort((a,b)=>a.key.localeCompare(b.key));
    return sidebarIcon(entry(key)?.iconKey,customModules.findIndex(m=>m.key===key)+1);
  }
  let sidebarDraft=null, sidebarRevision=0, moving='', savingSidebar=false;
  const sidebar=host.querySelector('.hub-sidebar');
  const editPanel=document.createElement('div');
  if(admin){
    editPanel.className='hub-sidebar-editor';
    editPanel.innerHTML='<button type="button" data-edit>편집모드</button><button type="button" data-cancel hidden>취소</button><small role="status"></small>';
    sidebar.querySelector('.hub-favorites').after(editPanel);
    editPanel.querySelector('[data-edit]').onclick=async()=>{
      if(!catalog||savingSidebar)return;
      if(!sidebarDraft){
        sidebarRevision=catalog.revision;sidebarDraft=[...(catalog.sidebarOrder||catalog.homeOrder)];
        navigation();return;
      }
      savingSidebar=true;navigation();
      try{
        const next=[...sidebarDraft];
        const r=await api({action:'platform_sidebar_order',order:next,revision:sidebarRevision});
        if(!sameUser())return;
        catalog.sidebarOrder=next;catalog.revision=r.revision;sidebarDraft=null;
        editPanel.querySelector('small').textContent='순서를 저장했습니다.';
        await host.reloadCatalog();
      }catch(err){
        if(err.message==='catalog_changed'){
          sidebarDraft=null;await host.reloadCatalog();
          editPanel.querySelector('small').textContent='다른 변경을 불러왔습니다. 다시 편집해 주세요.';
        }else editPanel.querySelector('small').textContent='저장에 실패했습니다. 다시 시도해 주세요.';
      }finally{savingSidebar=false;navigation();}
    };
    editPanel.querySelector('[data-cancel]').onclick=()=>{sidebarDraft=null;editPanel.querySelector('small').textContent='';navigation();};
  }
  const inquiry=document.createElement('button');
  inquiry.type='button';inquiry.className='hub-inquiry';inquiry.dataset.wfInquirySidebar='';
  inquiry.textContent=builtins.inquiry;inquiry.onclick=()=>selectTab('inquiry');sidebar.append(inquiry);
  function moveSidebar(key,target){
    if(!sidebarDraft||savingSidebar)return;
    const from=sidebarDraft.indexOf(key),to=sidebarDraft.indexOf(target);
    if(from<0||to<0||from===to)return;
    sidebarDraft.splice(to,0,sidebarDraft.splice(from,1)[0]);navigation();
  }
  function navigation(){
    const nav=sidebar.querySelector('nav');
    nav.innerHTML=action('home',sidebarIcon('home')+'<span>홈</span>',active==='home'?'on':'');
    nav.firstElementChild.onclick=()=>dispatch('home');
    nav.insertAdjacentHTML('beforeend',action('boards',sidebarIcon('bulletins')+'<span>게시판</span>',boards[active]?'on':''));
    nav.lastElementChild.onclick=()=>selectTab(boards[active]?active:'boardAll');
    if(admin){
      const edit=editPanel.querySelector('[data-edit]'),cancel=editPanel.querySelector('[data-cancel]');
      edit.textContent=sidebarDraft?'순서 저장':'편집모드';edit.disabled=!catalog||savingSidebar;
      edit.setAttribute('aria-pressed',String(!!sidebarDraft));cancel.hidden=!sidebarDraft;cancel.disabled=savingSidebar;
    }
    const labels=new Map((catalog?.documentMenus||[]).map(m=>[m.key,m.displayName]));
    for(const m of catalog?.modules||[])labels.set(m.key,featureName(m));
    const numbered=Array.from(labels,([key,displayName])=>({key,displayName}))
      .filter(m=>/^\d{2}\. /.test(m.displayName||'')&&!catalog.omitted?.includes(m.key))
      .sort((a,b)=>a.displayName.localeCompare(b.displayName,'ko'));
    const grouped=new Set(numbered.map(m=>m.key));
    const order=(sidebarDraft||catalog?.sidebarOrder||catalog?.homeOrder||[]).filter(k=>!grouped.has(k));
    for(const [i,key] of order.entries()){
      const m=entry(key),support=key==='support';
      const hidden=catalog.omitted?.includes(key)||m?.state==='hidden';
      if((!m&&!support)||(!admin&&hidden))continue;
      const label=menuPictogram(key)+'<span>'+safe(support?'공통업무지원서비스':featureName(m))+'</span>';
      const row=document.createElement('div');row.className='hub-sidebar-row';
      row.innerHTML=action(support?key:'feature:'+key,label,active===key?'on':'');
      const button=row.firstElementChild;
      if(hidden){row.classList.add('is-hidden');button.insertAdjacentHTML('beforeend','<small>숨김</small>');}
      if(hidden||sidebarDraft){button.setAttribute('aria-disabled','true');}
      else button.onclick=()=>dispatch(button.dataset.hub);
      if(sidebarDraft){
        row.classList.add('is-editing');row.draggable=!savingSidebar;
        row.ondragstart=e=>{moving=key;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',key);};
        row.ondragover=e=>{if(moving){e.preventDefault();e.dataTransfer.dropEffect='move';}};
        row.ondrop=e=>{e.preventDefault();moveSidebar(moving,key);moving='';};row.ondragend=()=>moving='';
        for(const [offset,symbol,name] of [[-1,'↑','위로'],[1,'↓','아래로']]){
          const step=document.createElement('button');step.type='button';step.textContent=symbol;step.className='hub-order-step';
          step.disabled=savingSidebar||!order[i+offset];step.setAttribute('aria-label',button.textContent+' '+name);
          step.onclick=()=>moveSidebar(key,order[i+offset]);row.append(step);
        }
      }
      nav.append(row);
    }
    if(numbered.length){
      const group=document.createElement('section'),heading=document.createElement('h3');
      group.className='hub-document-menus';group.setAttribute('aria-label','안전보건 서류관리');
      heading.textContent='안전보건 서류관리';group.append(heading);
      for(const item of numbered){
        const module=entry(item.key),row=document.createElement('div');
        row.className='hub-sidebar-row';
        row.innerHTML=action('feature:'+item.key,menuPictogram(item.key)+'<span>'+safe(item.displayName)+'</span>',active===item.key?'on':'');
        const b=row.firstElementChild;
        // The catalog publishes these section titles even before their modules launch.
        // Their information tabs only render the published title and readiness message.
        const available=moduleAvailable(module);
        const destination=available?item.key:'document:'+item.key;
        b.disabled=!!sidebarDraft||(!available&&!documentInfo(destination));
        if(!b.disabled)b.onclick=()=>selectTab(destination);
        group.append(row);
      }
      nav.append(group);
    }
    paintFavorites();org?.badges();
  }
  function favoriteChoices(){return [...items().filter(m=>m.state!=='hidden'&&!catalog?.omitted?.includes(m.key)&&(m.key!=='system'||admin)).map(m=>({key:m.key,title:featureName(m)})),{key:'bulletins',title:'공지사항'},{key:'schedule',title:'전체 일정'}]}
  function paintFavorites(){const box=host.querySelector('.hub-favorites>div'),choices=favoriteChoices();box.replaceChildren();for(const key of content.favorites){const x=choices.find(v=>v.key===key);if(!x)continue;const b=document.createElement('button');b.type='button';b.innerHTML=menuPictogram(key)+'<span>'+safe(x.title)+'</span>';b.onclick=()=>dispatch(['bulletins','schedule'].includes(key)?key:'feature:'+key);box.append(b)}if(!box.children.length)box.innerHTML='<p>자주 쓰는 메뉴를 추가하세요.</p>'}
  function favorites(){const d=dialog(host,'즐겨찾기 설정'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<form class="hub-form">'+favoriteChoices().map(x=>'<label class="hub-check"><input type="checkbox" name="favorite" value="'+x.key+'" '+(content.favorites.includes(x.key)?'checked':'')+'>'+safe(x.title)+'</label>').join('')+'<button type="submit">저장</button><p role="status"></p></form>';box.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,b=form.querySelector('button');b.disabled=true;try{const favorites=Array.from(form.querySelectorAll(':checked'),x=>x.value);await api({action:'platform_hub_favorites',favorites});if(!sameUser())return;content.favorites=favorites;paintFavorites();d.close()}catch{form.querySelector('[role=status]').textContent='저장하지 못했습니다. 다시 시도해 주세요.'}finally{b.disabled=false}}}
  function scopedIncidents(){return (data.incidents||[]).filter(i=>!i.bulkInvalidation?.active&&(!['field','worker'].includes(u.role)||String(i.siteId)===String(u.siteId)))}
  function approvals(){const m=entry('incident');if(!m||m.enabled===false||m.state!=='live'||m.canEnter===false)return [];return scopedIncidents().filter(i=>i.status!=='closed'&&(u.role==='safety'?!!window.enlSafetyWork?.(i)?.report||i.corrective?.status==='submitted':u.role==='executive'?window.ENLExecutiveApproval?.canDecide(i.executiveApproval,u.id):false)).sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))}
  async function openIncident(id){if(!await allowed('incident'))return;const i=scopedIncidents().find(x=>x.id===id);if(!i){status.textContent='현재 조회할 수 없는 사고입니다.';return}host.querySelectorAll('dialog[open]').forEach(d=>d.close());if(window.enlOpenIncidentReview)window.enlOpenIncidentReview(id,u.role==='safety',u);else if(typeof openIncidentModal==='function')openIncidentModal(id,u.role==='safety',u);else go('incidents');}
  function rowButton(box,title,detail,callback,icon='file'){const b=document.createElement('button');b.type='button';b.className='hub-data-row';b.innerHTML=svg(icon)+'<strong>'+safe(title)+'</strong><time>'+safe(detail)+'</time>';b.onclick=callback;box.append(b);return b}
  const approvalCategories={all:'전체',incident:'사고보고',risk:'위험성평가',tbm:'TBM',organization:'안전보건조직',training:'안전보건교육'};
  function approvalBody(box,compact=false,pending=approvals()){
    const selected=compact?'all':box.dataset.category||'all';box.replaceChildren();
    if(!compact){
      const tabs=document.createElement('nav');tabs.className='hub-category-tabs';tabs.setAttribute('aria-label','결재 업무 분류');
      for(const [key,label] of Object.entries(approvalCategories)){
        const b=document.createElement('button');b.type='button';b.dataset.approvalCategory=key;
        b.textContent=label+(['all','incident'].includes(key)?' '+pending.length:' / 준비 중');b.setAttribute('aria-pressed',String(key===selected));
        b.onclick=()=>{box.dataset.category=key;approvalBody(box,compact)};tabs.append(b);
      }
      box.append(tabs);
    }
    const rows=document.createElement('div');box.append(rows);
    if(!['all','incident'].includes(selected)){rows.innerHTML='<p class="hub-empty">'+safe(approvalCategories[selected])+' 결재 기능은 준비 중입니다.</p>';return;}
    for(const i of (compact?pending.slice(0,5):pending)){
      const documentName=(siteById(i.siteId)?.name||'')+' '+(i.eventType||'사고')+' '+(i.corrective?.status==='submitted'?'재발방지조치 보고서':'사고보고서');
      const row=rowButton(rows,documentName.trim(),relative(i.updatedAt),()=>openIncident(i.id));row.classList.add('hub-approval-row');row.title=documentName.trim();
      row.querySelector('svg').outerHTML='<span class="hub-approval-badge">사고보고</span>';
    }
    if(!pending.length)rows.innerHTML='<p class="hub-empty">본인에게 배정된 결재 대기 업무가 없습니다.</p>';
  }
  function paintApprovals(){
    const pending=approvals();
    host.querySelector('[data-approval-count]').textContent=pending.length+'건';
    approvalBody(host.querySelector('[data-list=approvals]'),true,pending);
    const box=host.querySelector('[data-list-workspace=approvals] [data-approval-list]');
    if(box)approvalBody(box,false,pending);
  }
  function approvalWorkspace(){let panel=host.querySelector('[data-list-workspace=approvals]');if(!panel){panel=document.createElement('section');panel.className='hub-tool-panel';panel.dataset.listWorkspace='approvals';panel.innerHTML='<div class="section-head"><h2>통합결재 대기</h2><button type="button">새로고침</button></div><p>본인에게 배정된 결재를 업무별로 확인합니다.</p><div data-approval-list></div>';host.append(panel);panel.querySelector('button').onclick=async()=>{const b=panel.querySelector('button');b.disabled=true;try{await window.enlIncidentPullNow?.(false);if(sameUser())paintApprovals()}finally{b.disabled=false}}}panel.hidden=false;approvalBody(panel.querySelector('[data-approval-list]'))}
  function openApprovalList(){return selectTab('approvals')}
  function paintRecent(){const box=host.querySelector('[data-list=recent]');box.replaceChildren();for(const r of recent.slice(0,5))rowButton(box,r.sentence||r.incident_title,relative(r.happened_at),()=>openActivity(r));if(!recent.length)box.innerHTML='<p class="hub-empty">'+safe(recentError||'최근 업무 기록이 없습니다.')+'</p>'}
  function openActivity(r){const d=dialog(host,'작업 기록'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<p>'+safe(r.sentence)+'</p><p>'+safe(r.actor_name||'')+' / '+safe(date(r.happened_at))+' '+safe(time(r.happened_at))+'</p>';if(r.module_key==='incident'&&scopedIncidents().some(i=>i.id===r.incident_id)){const b=document.createElement('button');b.textContent='사고 내용 보기';b.onclick=()=>openIncident(r.incident_id);box.append(b)}}
  async function loadRecent(){recentLink.hidden=!window.enlHistoryAvailable?.(u);if(recentLink.hidden){recentError='조회 가능한 작업 기록이 없습니다.';paintRecent();return}try{const r=await api({action:'activity_list',feed:'all',recentOnly:true});if(!sameUser())return;recent=r.rows||[];recentError=''}catch{recentError='작업 기록을 불러오지 못했습니다.'}if(sameUser())paintRecent()}
  function paintContent(){for(const [kind,rows] of [['bulletins',content.notices],['schedule',content.events.filter(x=>day(new Date(x.starts_at))<=day()&&day(new Date(x.ends_at||x.starts_at))>=day())]]){const box=host.querySelector('[data-list='+kind+']');box.replaceChildren();for(const x of rows.slice(0,kind==='bulletins'?5:4)){const b=rowButton(box,x.title,kind==='bulletins'?date(x.created_at):time(x.starts_at)+' ~ '+time(x.ends_at),()=>readContent(x),kind==='bulletins'?'notice':'calendar');if(kind==='bulletins'){b.classList.add('hub-notice-row');b.querySelector('svg').outerHTML='<span class="hub-tag '+safe(x.label)+'">'+({important:'중요',info:'안내',general:'일반'}[x.label]||'안내')+'</span>'}else b.classList.add('hub-event-row')}
   if(!rows.length)box.innerHTML='<p class="hub-empty">'+safe(contentError||(loaded?(kind==='bulletins'?'등록된 공지사항이 없습니다.':'오늘 등록된 일정이 없습니다.'):'불러오는 중입니다.'))+'</p>';
  }paintFavorites()}
  async function loadContent(){try{const r=await api({action:'platform_hub',includePublicationSites:admin});if(!sameUser())return;content={publicationSites:r.publicationSites,notices:r.notices||[],events:r.events||[],favorites:r.favorites||[]};loaded=true;contentError='';
   host.availableNoticeIds=content.notices.length<250?new Set(content.notices.map(n=>n.id)):null;syncBannerNoticeLinks(host);
  }catch{contentError='자료를 불러오지 못했습니다. 더보기에서 다시 시도하세요.'}if(sameUser())paintContent()}
  function renderPostBody(x,body){
    if(x.document){
     const campaign=Object.entries(bannerNotices).find(([,notice])=>notice[0]===x.id);
     if(campaign){body.classList.add('hub-campaign-article');body.dataset.campaign=campaign[0]}
     body.classList.add('hub-rich-body');boardRender(x.document,body);return;
    }
    for(const part of String(x.body||'').split(/(https?:\/\/[^\s<>"']+)/gi)){
      if(/^https?:\/\//i.test(part)){const a=document.createElement('a');a.href=part;a.textContent=part;a.target='_blank';a.rel='noopener noreferrer';body.append(a)}
      else body.append(part);
    }
  }
  function backToBoardList(panel){
    const detail=panel.querySelector('.hub-board-post');
    if(!detail)return;
    detail.remove();panel.querySelector('.hub-board-list').hidden=false;
    const origin=[...panel.querySelectorAll('[data-post-id]')].find(b=>b.dataset.postId===detail.dataset.id);
    (origin||panel.querySelector('input[type=search]'))?.focus({preventScroll:true});
    window.scrollTo(0,Number(detail.dataset.listScroll)||0);
  }
  host.boardHistory=state=>{
    if(active==='organization'&&state?.enlHub===userKey&&org&&!org.canLeave()){history.pushState({enlModuleEntry:userKey},'');return true;}
    if(!boards[active]||!sameUser())return false;
    const entry=state?.enlBoardPost;
    if(entry&&entry.owner===userKey&&entry.key===active){
      readContent({id:entry.id,kind:entry.kind},active,false);return true;
    }
    const panel=host.querySelector('[data-list-workspace="'+active+'"]');
    if(state?.enlModuleEntry===userKey&&panel?.querySelector('.hub-board-post')){backToBoardList(panel);return true}
    return false;
  };
  async function readContent(x,originKey,push=true){
    const key=boardKey(x.kind);
    if(!key){
      const d=dialog(host,'일정 상세'),box=d.querySelector('.hub-dialog-body');
      box.innerHTML='<h3>'+safe(x.title)+'</h3><p class="hub-detail-meta">'+safe(x.site_name||'전체 사업장')+' / '+safe(date(x.starts_at)+' '+time(x.starts_at)+' ~ '+time(x.ends_at))+'</p><div class="hub-detail-body"></div>';
      renderPostBody(x,box.lastElementChild);
      if(admin){box.insertAdjacentHTML('beforeend',action('edit-content','수정'));box.lastElementChild.onclick=()=>{d.close();editContent(x)}}
      return;
    }
    const view=originKey||key;
    if(active!==view&&!await selectTab(view))return;
    const panel=host.querySelector('[data-list-workspace="'+view+'"]');
    if(!panel||active!==view)return;
    const list=panel.querySelector('.hub-board-list'),old=panel.querySelector('.hub-board-post');
    const post=document.createElement('article');post.className='hub-board-post';post.dataset.id=x.id;
    post.dataset.listScroll=old?.dataset.listScroll||String(window.scrollY);
    if(old)old.replaceWith(post);else list.after(post);
    list.hidden=true;
    post.innerHTML='<header><button type="button" data-board-back aria-label="목록으로 돌아가기">← 목록</button><h3 tabindex="-1">게시글</h3></header><p role="status">불러오는 중입니다.</p>';
    const back=post.querySelector('[data-board-back]');back.onclick=()=>{
      if(history.state?.enlBoardPost?.id===x.id&&history.state.enlBoardPost.owner===userKey)history.back();else backToBoardList(panel);
    };
    if(push){
      const state={enlBoardPost:{owner:userKey,key:view,id:x.id,kind:x.kind}};
      if(history.state?.enlBoardPost)history.replaceState(state,'');else history.pushState(state,'');
    }
    const current=()=>post.isConnected&&active===view&&!panel.hidden&&sameUser();
    window.scrollTo(0,0);
    let files;try{const r=await api({action:'platform_board_detail',id:x.id});if(!current())return;x=r.item;files=r.files||[]}
    catch{if(current())post.querySelector('[role=status]').textContent='게시글을 불러오지 못했습니다. 목록에서 다시 열어 주세요.';return}
    post.querySelector('[role=status]').remove();
    const title=post.querySelector('h3');title.textContent=x.title;title.focus({preventScroll:true});
    const meta=document.createElement('div');meta.className='hub-post-meta';
    meta.innerHTML='<span class="hub-board-badge">'+safe(boards[key].title)+'</span><span>작성자 '+safe(x.author_name||'미상')+'</span><time>'+safe(date(x.created_at)+' '+time(x.created_at))+'</time><span>'+safe(x.shared_sites?.length>1?(x.site_name||'선택 사업장')+' 외 '+(x.shared_sites.length-1)+'곳':x.site_name||'전체 사업장')+'</span>'+(boardPinned(x)?'<span class="hub-board-pin">상단 고정</span>':'')+(x.label==='important'?'<span class="board-important">중요</span>':'')+(x.expires_at?'<span>만료 '+safe(date(x.expires_at)+' '+time(x.expires_at))+'</span>':'');
    if(admin){
     meta.insertAdjacentHTML('beforeend',action('edit-content','수정')+action('delete-content','삭제'));
     meta.querySelector('[data-hub=edit-content]').onclick=()=>editContent({...x,_files:files});
     meta.querySelector('[data-hub=delete-content]').onclick=()=>deleteBoardPost(x);
    }
    const body=document.createElement('div');body.className='hub-detail-body';post.append(meta,body);renderPostBody(x,body);
    const attachments=document.createElement('section');attachments.className='hub-post-files';
    for(const file of [...files,...(x.file_name?[{name:x.file_name}]:[])]){
      const get=async()=>{const r=await api({action:'platform_board_file',id:x.id,assetId:file.id},60000);return current()?r.file:null};
      const imgs=file.id?[...body.querySelectorAll('img[data-asset-id]')].filter(img=>img.dataset.assetId===file.id):[];
      if(imgs.length){
        get().then(f=>{if(!f)return;for(const img of imgs){const url=boardBlob(f);img.onload=img.onerror=()=>URL.revokeObjectURL(url);img.src=url}})
        .catch(()=>{for(const img of imgs)img.alt='이미지를 불러오지 못했습니다.'});
        continue;
      }
      if(!attachments.isConnected){attachments.innerHTML='<h4>첨부파일</h4>';post.append(attachments)}
      const b=document.createElement('button');b.type='button';b.dataset.hub='download';b.textContent=file.name;b.setAttribute('aria-label','첨부 다운로드 '+file.name);attachments.append(b);
      b.onclick=async()=>{b.disabled=true;try{const f=await get();if(!f)return;const url=boardBlob(f);const a=document.createElement('a');a.href=url;a.download=f.name;post.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch{b.textContent='다시 다운로드: '+file.name}finally{b.disabled=false}};
    }
  }
  async function editContent(item){const kind=item.kind,board=boards[boardKey(kind)],d=dialog(host,(board?.title||'일정')+(item.id?' 수정':' 등록')),box=d.querySelector('.hub-dialog-body');
   if(board)d.classList.add('hub-board-edit');
   if(board&&!loaded)await loadContent();
   if(!sameUser()||!d.open)return;
   const siteOptions=((board&&content.publicationSites)||data.sites||[]).filter(s=>s.id||s.site_id);
   const formats='<label>내용<textarea name="body" rows="5" maxlength="10000"></textarea></label>';
   const checks='<div class="board-publish-flags"><label><input name="pinned" type="checkbox"> 상단 고정 공지</label><label><input name="important" type="checkbox"> 중요 공지</label></div>';
   const noticeType=kind==='notice'?'<label>공지 분류<select name="noticeType"><option value="info">안내</option><option value="general">일반</option></select></label>':'';
   const settings=checks+noticeType+'<label>만료일시 (선택, 한국시간)<input name="expires" type="datetime-local"></label><fieldset class="board-sharing"><legend>공유 설정 (미선택 시 전체 사업장)</legend><details><summary>공유 대상 선택</summary><div data-sites></div></details><small data-scope></small></fieldset><section data-file-section><span class="board-field-caption">첨부파일</span></section>';
   const legacyFile=kind==='resource'&&item.file_name?'<label>기존 첨부 교체 (선택, 최대 5MB)<input name="file" type="file"></label><small>현재 파일 '+safe(item.file_name)+'</small>':'';
   box.innerHTML='<form class="hub-form">'+(board?'<label>게시판<input name="boardTitle" readonly></label>':'')+'<label>제목<input name="title" required maxlength="150"></label>'+(board?formats+settings+legacyFile:'<label>대상 사업장<select name="site"><option value="">전체 사업장</option></select></label><label>시작<input name="start" type="datetime-local" required></label><label>종료<input name="end" type="datetime-local" required></label>'+formats)+'<p role="status"></p><div class="hub-form-actions">'+(item.id?(board?'<button type="button" data-delete-post>삭제</button>':'<button type="button" data-archive>보관 처리</button>'):'')+(board?'<button type="button" data-cancel>취소</button>':'')+'<button type="submit">'+(item.id?'수정 저장':'저장')+'</button></div></form>';
   const f=box.querySelector('form'),note=f.querySelector('[role=status]');
   f.elements.title.value=item.title||'';f.elements.body.value=item.body||'';
   if(board){
    f.elements.boardTitle.value=board.title;f.elements.pinned.checked=boardPinned(item);f.elements.important.checked=item.label==='important';
    if(item.expires_at)f.elements.expires.value=new Date(Date.parse(item.expires_at)+9*3600000).toISOString().slice(0,16);
    if(f.elements.noticeType){
     const syncType=()=>{f.elements.noticeType.closest('label').hidden=f.elements.important.checked};
     f.elements.noticeType.value=item.label==='general'?'general':'info';f.elements.important.onchange=syncType;syncType();
    }
    const selected=item.shared_sites??(item.site_id?[item.site_id]:[]);
    const names=new Map(siteOptions.map(s=>[s.id||s.site_id,s.name||s.site_name]));
    for(const id of selected)if(!names.has(id))names.set(id,id===item.site_id&&item.site_name?item.site_name:id);
    const choices=f.querySelector('[data-sites]');
    for(const [id,name] of names){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.name='shareSite';check.value=id;check.checked=selected.includes(id);label.append(check,' '+name);choices.append(label)}
    const scope=()=>{const picked=[...choices.querySelectorAll(':checked')];f.querySelector('[data-scope]').textContent=picked.length?picked.map(el=>names.get(el.value)).join(', '):'전체 사업장'};
    choices.onchange=scope;scope();f.querySelector('[data-cancel]').onclick=()=>d.close();
   }else{
    for(const s of siteOptions)f.elements.site.add(new Option(s.name||s.site_name,s.id||s.site_id));
    f.elements.site.value=item.site_id||'';
   }
   const assets=[],urls={};let editor=null;
   d.addEventListener('close',()=>Object.values(urls).forEach(URL.revokeObjectURL),{once:true});
   if(board){f.inert=true;try{for(const meta of item._files||[]){const {file}=await api({action:'platform_board_file',id:item.id,assetId:meta.id},60000);if(!sameUser()||!d.open)return;const a={...meta,base64:file.base64.replace(/\s/g,'')};assets.push(a);urls[a.id]=boardBlob(a)}editor=boardEditor(f,item,assets,urls)}catch{note.textContent='첨부파일을 불러오지 못했습니다. 닫은 뒤 다시 시도하세요.';return}finally{if(editor)f.inert=false}}
   if(kind==='event'){const local=v=>v?day(new Date(v))+'T'+time(v):day()+'T09:00';f.elements.start.value=local(item.starts_at);f.elements.end.value=item.ends_at?local(item.ends_at):day()+'T10:00'}
   f.onsubmit=async ev=>{ev.preventDefault();if(busy||f.dataset.filesPending)return;const b={action:'platform_hub_save',id:item.id||null,revision:item.revision,kind,title:f.elements.title.value,body:f.elements.body.value,siteId:f.elements.site?.value||'',label:board&&f.elements.important.checked?'important':f.elements.noticeType?.value||'info',startsAt:kind==='event'?new Date(f.elements.start.value+':00+09:00').toISOString():null,endsAt:kind==='event'?new Date(f.elements.end.value+':00+09:00').toISOString():null};if(editor){editor.applySource();b.document=boardNodes(editor.editor);b.body=editor.editor.innerText;b.attachments=editor.filesForSave();
    if(b.attachments.length>5||b.attachments.reduce((n,f)=>n+f.size,0)>10485760){note.textContent='본문 사진과 첨부파일은 합계 5개, 10MB까지 저장할 수 있습니다.';return}
    const sites=[...f.querySelectorAll('[name=shareSite]:checked')].map(el=>el.value);
    b.siteId=sites[0]||'';b.publication={sites,pinned:f.elements.pinned.checked,expiresAt:f.elements.expires.value?new Date(f.elements.expires.value+':00+09:00').toISOString():null};if(b.body.length>10000){note.textContent='본문은 10,000자 이하로 작성하세요.';return}}if(kind==='event'&&b.endsAt<b.startsAt){note.textContent='종료 시각은 시작 시각 이후여야 합니다.';return}busy=true;f.inert=true;f.setAttribute('aria-busy','true');try{
    const file=f.elements.file?.files[0];
    if(file){
     if(file.size>5242880||!file.size||file.name.length>180||!/[.](pdf|xlsx?|docx?|pptx?|hwpx?|zip|jpe?g|png)$/i.test(file.name)){note.textContent='지원 형식의 5MB 이하 파일을 선택하세요.';return}
     const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
     b.file={name:file.name,size:file.size,base64};
    }
    await api(b,b.file||b.attachments?.length?60000:undefined);if(!sameUser())return;d.close();await refreshContentList(kind);status.textContent='저장했습니다.'}catch(err){note.textContent=err.message==='content_changed'?'다른 변경이 있습니다. 닫은 뒤 다시 조회해 주세요.':'저장하지 못했습니다. 입력과 연결 상태를 확인하세요.'}finally{busy=false;f.inert=false;f.removeAttribute('aria-busy')}};
   f.querySelector('[data-delete-post]')?.addEventListener('click',()=>deleteBoardPost(item,d));
   f.querySelector('[data-archive]')?.addEventListener('click',async()=>{if(busy||!confirm('이 항목을 보관 처리할까요? 원본은 서버에 남습니다.'))return;busy=true;f.inert=true;try{await api({action:'platform_hub_archive',id:item.id,revision:item.revision});d.close();await refreshContentList(kind)}catch{note.textContent='처리하지 못했습니다. 다시 조회해 주세요.'}finally{busy=false;f.inert=false}});
  }
  async function deleteBoardPost(item,dialog){
   if(busy||!sameUser()||!confirm('「'+item.title+'」 게시물을 삭제할까요? 본문과 첨부파일은 삭제 후 복구할 수 없습니다.'))return;
   busy=true;
   try{
    await api({action:'platform_board_delete',id:item.id,revision:item.revision});
    if(!sameUser())return;
    dialog?.close();
    await refreshContentList(item.kind);
    status.textContent='게시물을 삭제했습니다.';
   }catch(err){
    if(sameUser())alert(err.message==='content_changed'?'다른 변경이 있습니다. 목록을 새로고침한 뒤 다시 확인하세요.':'삭제 결과를 확인하지 못했습니다. 목록을 새로고침해 주세요.');
   }finally{busy=false}
  }
  async function refreshContentList(kind){
    if(kind==='notice'||kind==='event')await loadContent();
    if(!sameUser())return;
    if(boards[active]?.kind===kind||active==='boardAll')await listBoard(active);
    if(active==='schedule'&&kind==='event')await listSchedule();
  }
  const boardPages=new Map();
  async function listBoard(key){
    const board=boards[key],size=20;
    if(!boardPages.has(key))boardPages.set(key,{offset:0,query:'',from:'',to:''});
    const state=boardPages.get(key);
    let panel=host.querySelector('[data-list-workspace="'+key+'"]');
    if(!panel){panel=document.createElement('section');panel.className='hub-tool-panel hub-board';panel.dataset.listWorkspace=key;host.append(panel)}
    panel.hidden=false;
    panel.innerHTML='<header class="hub-board-title">'+sidebarIcon('bulletins')+'<div><h2>게시판</h2><span>'+safe(board.title)+'</span></div></header><div class="hub-board-layout"><aside class="hub-board-rail"><h3>게시판 목록</h3><nav class="hub-board-categories" aria-label="게시판 분류"></nav></aside><div class="hub-board-main"><section class="hub-board-list"><form class="hub-board-filter"><label>시작일<input name="from" type="date"></label><label>종료일<input name="to" type="date"></label><input name="query" type="search" maxlength="100" placeholder="제목, 내용 검색" aria-label="게시글 검색"><button type="submit">검색</button><button type="reset">초기화</button></form><div class="hub-board-heading"><h3>'+safe(board.title)+'</h3><div class="hub-list-tools">'+action('reload','새로고침')+(admin?action('new',key==='boardAll'?'＋ 새 공지':'＋ 글쓰기'):'')+'</div></div><table class="hub-board-table"><thead><tr><th>번호</th><th>게시판</th><th>제목</th><th>작성자</th><th>작성일</th></tr></thead><tbody data-content-list></tbody></table><p role="status"></p><footer><span data-total></span><div><button type="button" data-prev aria-label="이전 페이지">‹</button><span data-page></span><button type="button" data-next aria-label="다음 페이지">›</button></div></footer></section></div></div>';
    const nav=panel.querySelector('nav'),list=panel.querySelector('tbody'),note=panel.querySelector('[role=status]'),form=panel.querySelector('form');
    for(const [category,b] of Object.entries(boards)){
      const btn=document.createElement('button');btn.type='button';btn.textContent=b.title;
      if(category===key)btn.setAttribute('aria-current','page');
      btn.onclick=()=>category===active?listBoard(active):selectTab(category);nav.append(btn);
    }
    panel.querySelector('[data-hub=new]')?.addEventListener('click',()=>editContent({kind:key==='boardAll'?'notice':board.kind}));
    for(const name of ['query','from','to'])form.elements[name].value=state[name];
    form.onsubmit=e=>{e.preventDefault();if(form.elements.from.value&&form.elements.to.value&&form.elements.from.value>form.elements.to.value){note.textContent='종료일을 시작일 이후로 선택해 주세요.';return}
      for(const name of ['query','from','to'])state[name]=form.elements[name].value;
      state.offset=0;load()};
    form.onreset=e=>{e.preventDefault();for(const name of ['query','from','to'])state[name]=form.elements[name].value='';state.offset=0;load()};
    const prev=panel.querySelector('[data-prev]'),next=panel.querySelector('[data-next]');
    prev.onclick=()=>{state.offset=Math.max(0,state.offset-size);load()};next.onclick=()=>{state.offset+=size;load()};
    panel.querySelector('[data-hub=reload]').onclick=()=>load();
    let sequence=0;
    async function load(){
      const token=++sequence;prev.disabled=next.disabled=true;note.textContent='불러오는 중입니다.';
      try{
        const r=await api({action:'platform_board_list',kind:board.kind,pageSize:size,...state});
        if(!list.isConnected||!sameUser()||token!==sequence)return;
        if(state.offset&&!r.items.length){state.offset=0;return load()}
        const total=r.total??state.offset+r.items.length;
        list.replaceChildren();
        for(const [index,x] of r.items.entries()){
          const row=list.insertRow(),pinned=boardPinned(x);
          row.innerHTML='<td>'+(pinned?'<span class="hub-board-pin">고정</span>':String(total-state.offset-index))+'</td><td><span class="hub-board-badge">'+safe(boards[boardKey(x.kind)]?.title||board.title)+'</span></td><td><button type="button" data-post-id="'+safe(x.id)+'">'+(x.label==='important'?'<span class="board-important">중요</span> ':'')+safe(x.title)+'</button></td><td>'+safe(x.author_name||'미상')+'</td><td>'+safe(date(x.created_at))+'</td>';
          const open=()=>readContent(x,key);row.querySelector('button').onclick=open;row.onclick=e=>{if(!e.target.closest('button'))open()};
        }
        note.textContent=total?'':'등록된 게시글이 없습니다.';
        panel.querySelector('[data-total]').textContent='총 '+total+'건';
        panel.querySelector('[data-page]').textContent=(Math.floor(state.offset/size)+1)+' / '+Math.max(1,Math.ceil(total/size));
        prev.disabled=state.offset===0;next.disabled=!r.more;
      }catch{if(list.isConnected&&token===sequence){list.replaceChildren();note.textContent='게시글을 불러오지 못했습니다. 새로고침을 눌러 주세요.';panel.querySelector('[data-total]').textContent='';panel.querySelector('[data-page]').textContent=''}}
    }
    await load();
  }
  function listSchedule(){
    let panel=host.querySelector('[data-list-workspace="schedule"]');
    if(!panel){panel=document.createElement('section');panel.className='hub-tool-panel';panel.dataset.listWorkspace='schedule';host.append(panel)}
    panel.hidden=false;
    panel.innerHTML='<h2>'+tabTitle('schedule')+'</h2><div class="hub-list-tools">'+(admin?action('new','＋ 일정 등록'):'')+action('reload','새로고침')+'</div><label class="hub-date-filter">조회 날짜 <input type="date" value="'+day()+'"></label><div data-content-list></div>';
    const input=panel.querySelector('input'),target=panel.querySelector('[data-content-list]');
    panel.querySelector('[data-hub=new]')?.addEventListener('click',()=>editContent({kind:'event'}));
    function paint(events){
      const selected=input.value||day();
      target.replaceChildren();
      for(const x of events.filter(x=>day(new Date(x.starts_at))<=selected&&day(new Date(x.ends_at))>=selected)){
        rowButton(target,x.title,time(x.starts_at)+' ~ '+time(x.ends_at),()=>readContent(x));
      }
      if(!target.children.length)target.innerHTML='<p class="hub-empty">등록된 항목이 없습니다.</p>';
    }
    async function reload(){
      const selected=input.value||day();
      try{const r=await api({action:'platform_hub',date:selected});if(target.isConnected&&sameUser()&&selected===(input.value||day()))paint(r.events||[])}
      catch{if(target.isConnected)target.textContent='일정을 불러오지 못했습니다.'}
    }
    panel.querySelector('[data-hub=reload]').onclick=reload;input.onchange=reload;paint(content.events);
  }
  function search(){const d=dialog(host,'통합검색'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<label class="hub-search-label">검색어<input type="search" placeholder="메뉴, 사고, 공지사항, 일정 검색" maxlength="100"></label><p>조회 권한이 있는 현재 자료에서 검색합니다.</p><div data-results></div>';const input=box.querySelector('input'),out=box.querySelector('[data-results]');const paint=()=>{out.replaceChildren();const q=input.value.trim().toLocaleLowerCase();if(!q)return;let count=0;for(const m of items().filter(m=>m.state!=='hidden'&&featureName(m).toLocaleLowerCase().includes(q))){rowButton(out,featureName(m),'업무 메뉴',()=>{d.close();clickFeature(m.key)});count++}if(entry('incident')?.state==='live'&&entry('incident')?.enabled!==false&&entry('incident')?.canEnter!==false)for(const i of scopedIncidents().filter(i=>[i.eventType,i.summary,siteById(i.siteId)?.name].join(' ').toLocaleLowerCase().includes(q)).slice(0,30)){rowButton(out,i.eventType||'사고보고',siteById(i.siteId)?.name||'',()=>openIncident(i.id));count++}for(const x of [...content.notices,...content.events].filter(x=>[x.title,x.body].join(' ').toLocaleLowerCase().includes(q))){rowButton(out,x.title,x.kind==='notice'?'공지사항':'일정',()=>{d.close();readContent(x)});count++}if(!count)out.innerHTML='<p class="hub-empty">검색 결과가 없습니다.</p>'};input.oninput=paint;input.focus()}
  function guide(){const d=dialog(host,'모듈 안내');d.querySelector('.hub-dialog-body').innerHTML='<p>운영 중인 업무는 카드를 눌러 바로 이용할 수 있습니다. 구현 중인 업무는 관리자가 허용한 시험 사용자만 진입합니다.</p><p>공지사항과 일정은 안전관리자가 등록하고 대상 사업장의 사용자에게 공유합니다.</p>'+(admin?'<p>편집을 누르면 이름 수정, 접근 설정, 순서 이동 도구가 나타납니다. 손잡이를 끌거나 접근 설정의 앞으로/뒤로 버튼으로 순서를 변경하세요.</p>':'')}
  function dispatch(key){if(key.startsWith('feature:'))return clickFeature(key.slice(8));if(key==='home'){if(host.classList.contains('hub-incident-workspace'))return window.enlReturnToPlatform(u);host.classList.remove('hub-menu-open');window.scrollTo({top:0,behavior:'smooth'})}else if(key==='menu'||key==='close-menu')host.classList.toggle('hub-menu-open',key==='menu');else if(key==='support')support();else if(key==='search')search();else if(key==='notifications')clickFeature('notices');else if(key==='manage-cards'&&admin)manageCards();else if(key==='edit'){host.classList.toggle('hub-editing');host.querySelector('.hub-edit-toggle').textContent=host.classList.contains('hub-editing')?'편집 완료':'편집'}else if(key==='guide')guide();else if(key==='favorites')favorites();else if(key==='bulletins'||key==='schedule')selectTab(key);else if(key==='approvals')openApprovalList();else if(key==='recent')selectTab('recent');}
  host.querySelectorAll('[data-hub]').forEach(b=>b.onclick=()=>dispatch(b.dataset.hub));
  function afterCards(c){catalog=c;historyShortcuts();navigation();paintTabs();paintApprovals();renderArtwork(host);org?.catalog(entry('organization'));}
  function historyShortcuts(){
    let nav=host.querySelector('.hub-history-shortcuts');if(!nav){nav=document.createElement('nav');nav.className='hub-history-shortcuts hub-category-tabs';nav.setAttribute('aria-label','업무 기록 바로가기');host.querySelector('.hub-support>h2').after(nav)}
    const m=entry('history');nav.hidden=!window.enlHistoryAvailable?.(u)||!m||m.canEnter===false||m.enabled===false||m.state!=='live';nav.replaceChildren();
    for(const [key,label] of Object.entries({all:'통합기록',incident:'사고보고기록',organization:'안전보건조직기록',tbm:'TBM기록',risk:'위험성평가기록',training:'교육기록',common:'공통업무기록'})){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{const already=active==='history';if(!await selectTab('history',false,key))return;if(already){window.enlRequestHistory?.(key);window.enlRenderHistory?.(host.closest('.app-shell').querySelector('#view'),key)}};nav.append(b);
    }
  }
  const refresh=()=>{if(sameUser())paintApprovals();else window.removeEventListener('enl-incidents-pulled',refresh)};window.addEventListener('enl-incidents-pulled',refresh);
  if(!window.enlHistoryAvailable)window.addEventListener('enl-history-ready',()=>{if(sameUser())loadRecent()},{once:true});
  const openBannerNotice=id=>{if(sameUser()&&active==='home')readContent({id,kind:'notice'})};
  async function loadBanners(){try{const config=await api({action:'platform_banners'});if(!sameUser())return;
   const previous=host.bannerConfig;if(previous&&previous.revision>config.revision)return;host.bannerConfig=config;
   if(!previous||previous.revision!==config.revision)startBanner(host,openBannerNotice);
   else for(const img of host.querySelectorAll('.hub-uploaded-banner')){
    const match=config.assets?.find(a=>img.src.split('?')[0]===a.url.split('?')[0]);if(match&&img.src!==match.url)img.src=match.url;
   }
  }catch{/* Keep the last successfully loaded banner set on transient failure. */}}
  const bannerRefresh=()=>{if(sameUser())loadBanners();else window.removeEventListener('enl-banners-changed',bannerRefresh)};
  window.addEventListener('enl-banners-changed',bannerRefresh);
  startBanner(host,openBannerNotice);loadBanners();
  const bannerRenew=setInterval(()=>{if(!sameUser()){clearInterval(bannerRenew);window.removeEventListener('enl-banners-changed',bannerRefresh)}else if(active==='home')loadBanners()},3600000);
  const recentRefresh=()=>{if(sameUser())loadRecent();else window.removeEventListener('enl-activity-changed',recentRefresh)};window.addEventListener('enl-activity-changed',recentRefresh);
  navigation();loadContent();loadRecent();
  return {area,services,status,addSupportCard,afterCards,selectTab};
 }
 document.addEventListener('input',ev=>{
  const el=ev.target;
  if(el.closest?.('#view form:not(.activity-filters)')&&!el.closest('.platform-hub')&&el.type!=='search')el.dataset.worktabEdited='1';
 },true);
 document.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'&&document.querySelector('.hub-search')){ev.preventDefault();document.querySelector('.hub-search').click()}});
 function cleanup(){stopArtwork();document.querySelectorAll('.topbar .hub-search,.topbar .hub-bell,.topbar .hub-mobile-menu').forEach(n=>n.remove());}
 window.ENLHub={mount,decorateCard,cleanup,dialog,safetyIcons};
})();
