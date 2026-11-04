/* One event per visible detail opening. Retries retain the same visit ID. */
(function(){
 'use strict';
 const sessions=new WeakMap();
 let queued=false,retryTimer;
 const actor=()=>window.enlCurrentActor?.()||window.currentUser?.();
 function visibleView(){
   const u=actor();if(!u||document.visibilityState==='hidden')return null;
   const modal=document.querySelector('#modalRoot .modal');
   if(!modal||!modal.getClientRects().length||getComputedStyle(modal).visibility==='hidden')return null;
   const id=modal.dataset.incidentView||modal.dataset.cumulativeIncident||modal.querySelector('[data-lifecycle-final]')?.dataset.lifecycleFinal;
   if(!id)return null;
   const key=JSON.stringify([u.id,u.role,id]);
   let visit=sessions.get(modal);
   if(!visit||visit.key!==key){visit={key,id,actor:u,token:crypto.randomUUID(),attempts:0};sessions.set(modal,visit);}
   return visit;
 }
 async function track(){
   queued=false;const v=visibleView();
   if(!v||v.done||v.pending||v.attempts>=3||v.retryAt>Date.now()||typeof window.enlIncidentApi!=='function')return;
   v.pending=true;v.attempts++;
   try{
     const result=await window.enlIncidentApi({action:'view',incidentId:v.id,visitId:v.token,actor:v.actor});
     if(result?.ok!==true)throw Error('view_not_saved');
     v.done=true;
     if(actor()?.id===v.actor.id){
       if(['manager','final'].includes(v.actor.role))window.dispatchEvent(new CustomEvent('enl-report-view-saved',{detail:{incidentId:v.id}}));
       if(['manager','executive','final'].includes(v.actor.role))window.enlPushFlush?.();
       window.dispatchEvent(new Event('enl-activity-changed'));
     }
   }catch{
     if(v===visibleView()&&v.attempts<3){const delay=1000*3**(v.attempts-1);v.retryAt=Date.now()+delay;clearTimeout(retryTimer);retryTimer=setTimeout(queue,delay);}
   }finally{v.pending=false;}
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(track);}}
 function resume(){const v=visibleView();if(v){v.attempts=0;v.retryAt=0;}queue();}
 new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-incident-view','data-cumulative-incident','hidden','style']});
 window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);queue();
})();
