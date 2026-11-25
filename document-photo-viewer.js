(()=>{
'use strict';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
const button=(text,fn)=>{const n=make('button',text);n.type='button';n.onclick=fn;return n};
const isPdf=source=>typeof source==='string'&&source.startsWith('data:application/pdf;base64,');
let inputSequence=0;
async function prepare(file){
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))throw Error('photo_only');
  if(!(file.type||'').startsWith('image/')&&!/\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name))throw Error('invalid_file');
  return window.enlPrepareDocumentPhoto(file);
}
function preview(source,caption,onReady){
  const thumb=button('',()=>window.enlOpenDocumentPhoto(source,caption,thumb,ready));thumb.className='enl-proof-thumb';
  thumb.setAttribute('aria-haspopup','dialog');
  function ready(){thumb.dataset.loaded='true';thumb.dispatchEvent(new Event('evidence-ready'));onReady?.();}
  if(isPdf(source)){
    thumb.classList.add('enl-proof-pdf');thumb.setAttribute('aria-label',caption+' PDF 전체 페이지 열기');
    thumb.append(make('strong','PDF'),make('span',caption),make('span','PDF 열기 (전체 페이지)'));
  }else{
    const image=make('img');image.alt=caption;image.onload=ready;image.src=source;
    thumb.setAttribute('aria-label',caption+' 확대 보기');thumb.append(image,make('span','사진 클릭하여 확대 보기'));
  }
  return thumb;
}
function drop(input,control,{deferred=false}={}){
  input.id=input.id||'enl-document-file-'+(++inputSequence);
  input.accept='image/*,.jpg,.jpeg,.png,.webp,.heic,.heif';input.hidden=true;
  const zone=make('div',null,'enl-document-drop');zone.dataset.attachmentInput=input.id;
  const hint=make('span','출력하여 현장에 보관한 서류를 촬영한 사진을 끌어다 놓으세요. PDF는 제출할 수 없습니다.','attachment-drop-hint');
  const status=make('span',deferred?'수료일과 사진을 확인한 후 저장하세요.':'파일을 선택하거나 끌어다 놓으면 제출됩니다.','enl-document-drop-note');
  if(control.parentNode)control.replaceWith(zone);
  zone.append(control,hint,status,input);
  const sync=()=>{input.disabled=control.disabled;zone.setAttribute('aria-disabled',String(control.disabled));};
  sync();
  // Keep delegated drops subject to the same role, state and busy guards as clicks.
  const observer=new MutationObserver(()=>{if(!zone.isConnected){observer.disconnect();return;}sync();});
  observer.observe(control,{attributes:true,attributeFilter:['disabled']});
  const lifecycle=new MutationObserver(()=>{if(!zone.isConnected){observer.disconnect();lifecycle.disconnect();}});
  lifecycle.observe(document.body,{childList:true,subtree:true});
  return zone;
}
function complete(role,state){return state==='approved';}
function aggregate(states){const items=states.filter(s=>s!=null&&s!=='unimplemented');return !items.length||items.every(s=>s==='empty')?'empty':items.every(s=>s==='approved')?'approved':'progress';}
function status(state){return state==='approved'?'반기 확인완료':state==='empty'?'미작성':'작성중';}
function label(role,state){return status(state)+(state==='pending'?' / 안전관리자 승인 대기':'');}
function mark(control,done,text){control.classList.toggle('enl-submission-complete',done);control.textContent=(done?'✓ ':'')+text;}
window.enlDocumentEvidence={prepare,preview,drop,isPdf,complete,label,mark,aggregate,status,
  error:error=>({photo_only:'PDF는 제출할 수 없습니다. 서류를 출력해 현장에 보관하고, 출력물을 촬영한 사진을 올려 주세요.',invalid_file:'출력물을 촬영한 사진파일을 선택해 주세요.',too_large:'파일이 너무 큽니다. 사진은 25MB 이하로 선택해 주세요.'}[error?.message]||'파일을 읽지 못했습니다. 사진파일을 확인해 주세요.')};
let pdfEngine;
const pdfAssets=new URL('assets/vendor/pdfjs-5.6.205/',document.baseURI).href;
window.enlLoadDocumentPdf=()=>{
  if(!pdfEngine)pdfEngine=import(pdfAssets+'pdf.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc=pdfAssets+'pdf.worker.mjs';return lib;}).catch(error=>{pdfEngine=null;throw error;});
  return pdfEngine;
};
function openPdf(source,description,trigger,onReady){
  const host=trigger.closest('.policy-panel,.org-panel');if(!host)return;
  host.querySelector('.enl-photo-viewer')?.close();
  const bytes=Uint8Array.from(atob(source.split(',')[1]),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const dialog=make('dialog',null,'enl-photo-viewer enl-pdf-viewer'),bar=make('div',null,'enl-photo-toolbar');
  dialog.setAttribute('aria-label',description+' PDF 보기');
  const open=make('a','새 창에서 열기');open.href=url;open.target='_blank';open.rel='noopener noreferrer';open.onclick=()=>onReady?.();
  const download=make('a','PDF 내려받기');download.href=url;download.download=description.replace(/[\\/:*?"<>|]/g,'_')+'.pdf';
  const close=button('닫기',()=>dialog.close());close.autofocus=true;
  bar.append(make('strong','제출된 PDF'),open,download,close);
  const help=make('p','PDF를 불러오는 중입니다.','enl-photo-help');help.setAttribute('role','status');
  const viewport=make('div',null,'enl-photo-viewport enl-pdf-viewport'),canvas=make('canvas');viewport.append(canvas);
  canvas.setAttribute('role','img');
  let loading,pdf,renderTask,pageNumber=1,zoom=1,rendering=false,released=false;
  const pager=make('div',null,'enl-photo-toolbar'),count=make('output','불러오는 중');count.setAttribute('aria-live','polite');
  const previous=button('이전 페이지',()=>{pageNumber--;draw();}),next=button('다음 페이지',()=>{pageNumber++;draw();});
  const smaller=button('축소',()=>{zoom=Math.max(.5,zoom-.25);draw();}),larger=button('확대',()=>{zoom=Math.min(3,zoom+.25);draw();}),fit=button('화면 맞춤',()=>{zoom=1;draw();});
  const controls=[previous,next,smaller,larger,fit];controls.forEach(b=>b.disabled=true);pager.append(previous,count,next,smaller,larger,fit);
  dialog.append(bar,pager,help,viewport);host.append(dialog);
  const cleanup=()=>{if(released)return;released=true;renderTask?.cancel();loading?.destroy()?.catch(()=>{});URL.revokeObjectURL(url);observer.disconnect();};
  const observer=new MutationObserver(()=>{if(!dialog.isConnected)cleanup();});observer.observe(host,{childList:true,subtree:true});
  dialog.addEventListener('close',()=>{cleanup();dialog.remove();if(trigger.isConnected)trigger.focus();},{once:true});
  async function draw(){
    if(released||rendering||!pdf)return;rendering=true;controls.forEach(b=>b.disabled=true);
    try{
      const page=await pdf.getPage(pageNumber);if(released)return;
      const natural=page.getViewport({scale:1}),width=Math.max(240,viewport.clientWidth-24);
      const scale=Math.min(2,width/natural.width)*zoom,view=page.getViewport({scale});
      const density=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16000000/(view.width*view.height)));
      canvas.width=Math.ceil(view.width*density);canvas.height=Math.ceil(view.height*density);
      canvas.style.width=Math.round(view.width)+'px';canvas.style.height=Math.round(view.height)+'px';
      renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:density===1?null:[density,0,0,density,0,0]});
      await renderTask.promise;if(released)return;
      count.textContent=pageNumber+' / '+pdf.numPages+' 페이지';canvas.setAttribute('aria-label',description+' '+pageNumber+' / '+pdf.numPages+' 페이지');
      help.textContent='이전 / 다음 페이지로 전체 내용을 확인하세요. 원본 PDF도 내려받을 수 있습니다.';viewport.scrollTop=0;viewport.scrollLeft=0;
      onReady?.();page.cleanup();
    }catch(error){if(!released)help.textContent='PDF를 표시하지 못했습니다. 새 창에서 열거나 내려받아 확인하세요.';}
    finally{rendering=false;if(!released){previous.disabled=!pdf||pageNumber<=1;next.disabled=!pdf||pageNumber>=pdf.numPages;smaller.disabled=!pdf||zoom<=.5;larger.disabled=!pdf||zoom>=3;fit.disabled=!pdf;}}
  }
  dialog.showModal();
  (async()=>{
    try{
      const lib=await window.enlLoadDocumentPdf();if(released)return;
      loading=lib.getDocument({data:bytes,isEvalSupported:false,cMapUrl:pdfAssets+'cmaps/',cMapPacked:true,standardFontDataUrl:pdfAssets+'standard_fonts/',wasmUrl:pdfAssets+'wasm/'});
      pdf=await loading.promise;if(released)return;await draw();
    }catch(error){if(!released)help.textContent=error?.name==='PasswordException'?'암호가 있는 PDF입니다. 새 창에서 열거나 내려받아 확인하세요.':'PDF를 표시하지 못했습니다. 새 창에서 열거나 내려받아 확인하세요.';}
  })();
}
window.enlOpenDocumentPhoto=(source,description,trigger,onReady)=>{
  if(isPdf(source)){openPdf(source,description,trigger,onReady);return;}
  const host=trigger.closest('.policy-panel,.org-panel');
  if(!host)return;
  host.querySelector('.enl-photo-viewer')?.close();
  const dialog=make('dialog',null,'enl-photo-viewer');
  dialog.setAttribute('aria-label',description+' 확대 보기');
  const toolbar=make('div',null,'enl-photo-toolbar'),viewport=make('div',null,'enl-photo-viewport');
  const image=make('img');image.alt=description;image.draggable=false;
  image.tabIndex=0;image.setAttribute('role','button');
  const label=make('output','불러오는 중');label.setAttribute('aria-live','polite');
  let scale=1,fit=true;
  function resize(){
    if(!image.naturalWidth)return;
    image.style.width=fit?'100%':Math.round(image.naturalWidth*scale)+'px';
    image.style.height=fit?'100%':'auto';
    image.style.objectFit=fit?'contain':'initial';
    image.style.cursor=fit?'zoom-in':'zoom-out';
    image.setAttribute('aria-label',fit?'사진 클릭하여 원본 크기로 확대':'사진 클릭하여 화면에 맞추기');
    label.textContent=fit?'화면 맞춤':Math.round(scale*100)+'%';
    smaller.disabled=!fit&&scale<=.1;larger.disabled=!fit&&scale>=4;
    original.disabled=fitted.disabled=false;
  }
  function zoom(delta){
    if(!image.naturalWidth)return;
    if(fit)scale=Math.min(viewport.clientWidth/image.naturalWidth,viewport.clientHeight/image.naturalHeight);
    fit=false;scale=Math.max(.1,Math.min(4,scale+delta));resize();
  }
  function showFit(){fit=true;viewport.scrollTo(0,0);resize()}
  function showOriginal(){fit=false;scale=1;viewport.scrollTo(0,0);resize()}
  const smaller=button('축소',()=>zoom(-.25)),larger=button('확대',()=>zoom(.25));
  const original=button('원본 크기',showOriginal),fitted=button('화면 맞춤',showFit);
  const close=button('닫기',()=>dialog.close());close.autofocus=true;
  for(const control of [smaller,larger,original,fitted])control.disabled=true;
  image.onclick=()=>fit?showOriginal():showFit();
  image.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();image.click()}};
  toolbar.append(make('strong','게시 사진 확대 보기'),smaller,label,larger,original,fitted,close);
  viewport.tabIndex=0;viewport.setAttribute('aria-label','확대한 사진은 스크롤하여 다른 부분을 확인할 수 있습니다.');
  viewport.append(image);
  const help=make('p','사진을 누르면 원본 크기로 확대됩니다. 확대 버튼과 스크롤로 날짜와 글씨를 확인하세요.','enl-photo-help');
  dialog.append(toolbar,help,viewport);
  dialog.addEventListener('close',()=>{dialog.remove();if(trigger.isConnected)trigger.focus()},{once:true});
  // Native modal top layer keeps the viewer separate from the document layout.
  // Keeping it inside the workspace also removes the photo on navigation/logout.
  host.append(dialog);
  image.onload=resize;
  image.onerror=()=>{help.textContent='사진을 불러오지 못했습니다. 닫은 뒤 다시 열어 주세요.';label.textContent='불러오기 실패';};
  dialog.showModal();image.src=source;
};
})();
