/* Local UI lock only: no polling, network calls, blur or animation. */
(()=>{
  'use strict';
  let count=0,overlay,timer,previousFocus,locked=[];
  const events=['click','dblclick','pointerdown','keydown','submit','drop'];
  const guard=event=>{if(count){event.preventDefault();event.stopImmediatePropagation();}};
  function begin(){
    if(count++===0){
      previousFocus=document.activeElement;
      overlay=document.createElement('div');overlay.className='enl-processing';overlay.tabIndex=-1;
      overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
      overlay.textContent='처리중...';
      overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(70,78,87,.38);color:#fff;font:700 28px/1.5 sans-serif;text-shadow:0 1px 4px #263442;opacity:0;touch-action:none;cursor:wait;';
      const dialog=document.querySelector('dialog[open]'),parent=dialog||document.body;
      const targets=[...document.body.children,...(dialog?[...dialog.children]:[])].filter(node=>node!==dialog&&!node.contains(dialog)&&!['SCRIPT','STYLE','LINK'].includes(node.tagName));
      locked=targets.map(node=>({node,inert:node.inert}));locked.forEach(({node})=>node.inert=true);
      parent.append(overlay);overlay.focus({preventScroll:true});
      for(const type of events)document.addEventListener(type,guard,true);
      timer=setTimeout(()=>{if(overlay)overlay.style.opacity='1';},180);
    }
    let ended=false;
    return ()=>{
      if(ended)return;ended=true;if(--count)return;
      clearTimeout(timer);overlay?.remove();overlay=null;
      for(const {node,inert} of locked)node.inert=inert;locked=[];
      for(const type of events)document.removeEventListener(type,guard,true);
      if(previousFocus?.isConnected&&!previousFocus.disabled)previousFocus.focus({preventScroll:true});
    };
  }
  window.ENLProcessing={begin,active:()=>count>0};
})();
