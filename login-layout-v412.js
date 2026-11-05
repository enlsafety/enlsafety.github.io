/* Login presentation lives in login-scene.css; retain keyboard visibility support. */
(()=>{
 const keepVisible=()=>{
  const el=document.activeElement,v=window.visualViewport;
  if(!v||!el?.matches('.login-v411 input,.email-gate-dialog input'))return;
  const r=el.getBoundingClientRect();
  if(r.bottom>v.offsetTop+v.height-12||r.top<v.offsetTop+8)el.scrollIntoView({block:'center',behavior:'auto'});
 };
 window.visualViewport?.addEventListener('resize',keepVisible);
})();
