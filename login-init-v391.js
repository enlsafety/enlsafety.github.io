/* Ensure the v3.9.1 name-first login replaces any legacy login already rendered. */
(function(){setTimeout(()=>{try{if(!currentUser()&&typeof renderLogin==='function')renderLogin()}catch(e){console.warn('v3.9.1 login init skipped',e)}},0)})();
