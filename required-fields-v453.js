/* E&L Accident Report App v4.4.29 - unified required field UX */
(function(){
  'use strict';
  const VERSION='4.4.30-starred-selects1';
  const EMPTY='enl432-required-empty',FILLED='enl432-required-filled';

  const text=v=>String(v==null?'':v).trim();
  const isControl=el=>!!el&&el.matches?.('input,textarea,select');

  function hasStarMarker(el){
    const label=el.closest?.('label');
    if(!label)return false;
    const copy=label.cloneNode(true);
    copy.querySelectorAll('input,textarea,select,option,button,small').forEach(n=>n.remove());
    return /\*/.test(copy.textContent||'');
  }

  function requiredState(el){
    const starred=hasStarMarker(el);
    if(el.tagName==='SELECT')return starred;
    return !!el.required||starred;
  }

  function prepareSelect(el){
    if(el.tagName!=='SELECT'||el.multiple||el.dataset.enl453Prepared==='1')return;
    const opts=Array.from(el.options||[]);
    const hasBlank=opts.some(o=>String(o.value)==='');
    const hasExplicit=opts.some(o=>o.hasAttribute('selected')&&String(o.value)!=='');
    if(!hasBlank){
      const ph=document.createElement('option');
      ph.value='';ph.textContent='선택하세요';ph.disabled=true;ph.hidden=true;
      el.insertBefore(ph,el.firstChild);
      if(!hasExplicit&&el.dataset.enlPreserveDefault!=='1')el.value='';
    }
    el.dataset.enl453Prepared='1';
  }

  function filled(el){
    if(el.type==='checkbox'||el.type==='radio')return !!el.checked;
    return text(el.value)!=='';
  }

  function state(el){
    if(!isControl(el))return;
    if(el.type==='hidden'||el.disabled||el.readOnly){
      el.classList.remove(EMPTY,FILLED);
      el.closest?.('label')?.classList.remove('enl432-label-empty');
      return;
    }
    const required=requiredState(el);
    if(required&&!el.required)el.required=true;
    if(!required){
      el.classList.remove(EMPTY,FILLED);
      el.closest?.('label')?.classList.remove('enl432-label-empty');
      return;
    }
    prepareSelect(el);
    const ok=filled(el);
    el.classList.toggle(EMPTY,!ok);
    el.classList.toggle(FILLED,ok);
    el.closest?.('label')?.classList.toggle('enl432-label-empty',!ok);
    el.setAttribute('aria-required','true');
  }

  function scan(root=document){
    if(isControl(root))state(root);
    root.querySelectorAll?.('input,textarea,select').forEach(state);
  }

  document.addEventListener('input',e=>state(e.target),true);
  document.addEventListener('change',e=>state(e.target),true);
  document.addEventListener('focusin',e=>state(e.target),true);
  document.addEventListener('invalid',e=>state(e.target),true);
  document.addEventListener('reset',e=>setTimeout(()=>scan(e.target),0),true);

  let queued=false;
  const queue=()=>{
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;scan(document)});
  };
  const mo=new MutationObserver(ms=>{
    for(const m of ms){
      if(m.type==='attributes'){queue();continue}
      for(const n of m.addedNodes)if(n.nodeType===1){queue();break}
    }
  });
  const start=()=>{scan(document);mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['required','disabled','readonly']})};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});

  window.enlRefreshRequiredFields453=()=>scan(document);
  window.ENL_REQUIRED_FIELDS_VERSION=VERSION;
})();