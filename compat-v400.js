/* E&L Accident Report App v4.0.0 - compatibility guards */
(function(){
  const st=document.createElement('style');st.id='compat400Css';st.textContent=`.site-row400 a{pointer-events:none;color:inherit;text-decoration:none}`;if(!document.getElementById(st.id))document.head.appendChild(st);
  setTimeout(()=>{
    try{
      const u=currentUser?.();
      if(u?.role==='safety'&&typeof enlPlatformSection!=='undefined'&&enlPlatformSection==='admin'&&typeof renderShell==='function')renderShell(u);
    }catch(e){console.warn('v4 admin refresh skipped',e)}
  },120);
})();
