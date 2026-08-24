/* E&L Accident Report App v4.0.4 - prevent duplicate login rerenders */
(function(){
  if(typeof renderLogin!=='function')return;
  const base=renderLogin;
  renderLogin=function(){
    if(document.querySelector('.login-v404'))return;
    return base.apply(this,arguments);
  };
  try{if(!currentUser?.()&&!document.querySelector('.login-v404'))base()}catch(e){console.warn('login stabilizer skipped',e)}
})();
