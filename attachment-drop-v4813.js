/* File drops use the same input/change handlers as the existing file picker. */
(function(){
  'use strict';
  if(window.ENLAttachmentDrop)return;
  window.ENLAttachmentDrop=true;
  const selector='[data-attachment-input]';
  const style=document.createElement('style');
  style.textContent=`${selector}{border:1px dashed #aac6dc;border-radius:12px;padding:12px;min-width:0;box-sizing:border-box}
    ${selector}.attachment-drop-active{border-color:#2676b5;background-color:#edf7ff;box-shadow:inset 0 0 0 1px #2676b5}
    .attachment-drop-hint{display:block;color:#55758e;font-size:13px;line-height:1.5;margin:6px 0 10px}
    @media(pointer:coarse){.attachment-drop-hint{display:none}}`;
  document.head.appendChild(style);
  const isFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
  const zoneAt=e=>e.target instanceof Element?e.target.closest(selector):null;
  const inputFor=zone=>document.getElementById(zone?.dataset.attachmentInput);
  const busy=(zone,input)=>!input||input.type!=='file'||input.matches(':disabled')||
    !!zone.closest('[aria-busy="true"]')||input.form?.getAttribute('aria-busy')==='true';
  function clear(){document.querySelectorAll('.attachment-drop-active').forEach(el=>el.classList.remove('attachment-drop-active'))}
  function accepts(input,file){
    const rules=input.accept.toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
    const mime=(typeof inferMime==='function'?inferMime(file):file.type||'').toLowerCase();
    const name=file.name.toLowerCase();
    return !rules.length||rules.some(rule=>rule.startsWith('.')?name.endsWith(rule):
      rule.endsWith('/*')?mime.startsWith(rule.slice(0,-1)):mime===rule);
  }
  for(const type of ['dragenter','dragover'])document.addEventListener(type,e=>{
    if(!isFiles(e))return;
    e.preventDefault();
    const zone=zoneAt(e),input=inputFor(zone);
    clear();
    if(zone&&!busy(zone,input)){
      zone.classList.add('attachment-drop-active');
      e.dataTransfer.dropEffect='copy';
    }else e.dataTransfer.dropEffect='none';
  });
  document.addEventListener('dragleave',e=>{
    const zone=zoneAt(e);
    if(zone&&(!(e.relatedTarget instanceof Node)||!zone.contains(e.relatedTarget)))zone.classList.remove('attachment-drop-active');
  });
  document.addEventListener('dragend',clear);
  window.addEventListener('blur',clear);
  document.addEventListener('drop',e=>{
    if(!isFiles(e))return;
    // Prevent browser navigation even when files miss the attachment region.
    e.preventDefault();clear();
    const zone=zoneAt(e);
    if(!zone)return;
    const input=inputFor(zone);
    if(busy(zone,input)){alert('첨부파일 처리와 저장이 끝난 뒤 추가해 주세요.');return}
    let files=Array.from(e.dataTransfer.files),folders=false;
    const items=Array.from(e.dataTransfer.items||[]).filter(item=>item.kind==='file');
    if(items.length){
      files=items.flatMap(item=>{
        if(item.webkitGetAsEntry?.()?.isDirectory){folders=true;return []}
        const file=item.getAsFile();return file?[file]:[];
      });
    }
    if(folders)alert('폴더는 첨부할 수 없습니다. 폴더 안의 파일을 선택해 주세요.');
    const accepted=files.filter(file=>accepts(input,file));
    if(accepted.length!==files.length)alert('허용되지 않는 파일 형식은 제외했습니다. 이 첨부 구역에서 지원하는 파일을 선택해 주세요.');
    if(!accepted.length)return;
    try{
      const transfer=new DataTransfer();
      // Deferred-upload forms keep their pending selection until submission.
      const combined=input.multiple?[...input.files,...accepted]:accepted.slice(0,1);
      combined.forEach(file=>transfer.items.add(file));
      input.files=transfer.files;
    }catch(error){alert('이 브라우저에서는 파일 선택 버튼으로 첨부해 주세요.');return}
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
})();
