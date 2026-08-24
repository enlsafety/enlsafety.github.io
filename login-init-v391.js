/* Ensure the v3.9.1 name-first login replaces any legacy login already rendered. */
(function(){
  const has391=()=>!!document.querySelector('#workerLogin391,#managerLogin391,#hqLogin391');
  const apply=()=>{try{if(!currentUser()&&!has391()&&typeof renderLogin==='function')renderLogin()}catch(e){console.warn('v3.9.1 login init skipped',e)}};
  setTimeout(apply,0);
  setTimeout(apply,120);
  setTimeout(apply,500);
})();
