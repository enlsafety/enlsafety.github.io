/* E&L Accident Report App v4.1.0 - mobile interaction controller */
(function(){
  'use strict';
  const VERSION='4.1.0';
  const MOVE_THRESHOLD=10;
  const CLICK_GUARD_MS=320;
  let active=false,startX=0,startY=0,moved=false,suppressUntil=0;

  function point(e){const t=e.touches?.[0]||e.changedTouches?.[0];return t?{x:t.clientX,y:t.clientY}:null}
  function begin(e){if(e.touches&&e.touches.length!==1){active=false;return}const p=point(e);if(!p)return;active=true;startX=p.x;startY=p.y;moved=false}
  function move(e){if(!active||moved)return;const p=point(e);if(!p)return;if(Math.abs(p.x-startX)>MOVE_THRESHOLD||Math.abs(p.y-startY)>MOVE_THRESHOLD)moved=true}
  function end(){if(active&&moved)suppressUntil=Date.now()+CLICK_GUARD_MS;active=false;moved=false}
  function cancel(){active=false;moved=false;suppressUntil=0}
  function guardClick(e){if(Date.now()>suppressUntil)return;const interactive=e.target?.closest?.('button,a,[role="button"],[data-view],[data-home-go],[data-field-task],[data-manager-site],[data-manager-inc],[data-unified-action],summary');if(!interactive)return;e.preventDefault();e.stopImmediatePropagation();suppressUntil=0}

  document.addEventListener('touchstart',begin,{capture:true,passive:true});
  document.addEventListener('touchmove',move,{capture:true,passive:true});
  document.addEventListener('touchend',end,{capture:true,passive:true});
  document.addEventListener('touchcancel',cancel,{capture:true,passive:true});
  document.addEventListener('click',guardClick,true);

  const style=document.createElement('style');style.id='interaction410Css';style.textContent='button,a,[role="button"],summary{touch-action:manipulation;-webkit-tap-highlight-color:transparent}';document.head.appendChild(style);
  window.ENL_INTERACTION_VERSION=VERSION;
})();