(()=>{
'use strict';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
const button=(text,fn)=>{const n=make('button',text);n.type='button';n.onclick=fn;return n};
window.enlOpenDocumentPhoto=(source,description,trigger)=>{
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
