/* Record an actual incident detail view, independently of approval UI and entry route. */
(function(){
 'use strict';
 const completed=new Set(),pending=new Set(),attempts=new Map(),retryAt=new Map();
 let queued=false,lastKey='',retryTimer;
 const actor=()=>window.enlCurrentActor?.()||window.currentUser?.();
 function visibleView(){
  const u=actor();if(!u||!['manager','executive','final'].includes(u.role)||document.visibilityState==='hidden')return null;
  const modal=document.querySelector('#modalRoot .modal');
  if(!modal||!modal.getClientRects().length||getComputedStyle(modal).visibility==='hidden')return null;
  const id=modal.dataset.incidentView||modal.dataset.cumulativeIncident||modal.dataset.wf440Incident||modal.querySelector('[data-lifecycle-final]')?.dataset.lifecycleFinal;
  if(!id)return null;
  return {id:String(id),actor:u,key:JSON.stringify([String(u.id),String(id)])};
 }
 async function track(){
  queued=false;const view=visibleView();
  if(!view){lastKey='';clearTimeout(retryTimer);return;}
  if(lastKey!==view.key){clearTimeout(retryTimer);attempts.delete(view.key);retryAt.delete(view.key);lastKey=view.key;}
  if(completed.has(view.key)||pending.has(view.key)||(attempts.get(view.key)||0)>=3||(retryAt.get(view.key)||0)>Date.now()||typeof window.enlIncidentApi!=='function')return;
  pending.add(view.key);attempts.set(view.key,(attempts.get(view.key)||0)+1);
  try{
   const result=await window.enlIncidentApi({action:'view',incidentId:view.id,actor:view.actor});
   if(result?.ok!==true)throw Error('view_not_saved');
   completed.add(view.key);attempts.delete(view.key);
   // The database also dispatches independently if this window is closed immediately.
   if(String(actor()?.id)===String(view.actor.id))window.enlPushFlush?.();
  }catch(e){
   if(visibleView()?.key===view.key&&(attempts.get(view.key)||0)<3){
    const delay=1000*Math.pow(3,(attempts.get(view.key)||1)-1);retryAt.set(view.key,Date.now()+delay);
    clearTimeout(retryTimer);retryTimer=setTimeout(queue,delay);
   }
  }finally{pending.delete(view.key);}
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(track);}}
 function resume(){const view=visibleView();if(view){attempts.delete(view.key);retryAt.delete(view.key);}queue();}
 new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-incident-view','data-cumulative-incident','data-wf440-incident','hidden','style']});
 window.addEventListener('online',resume);
 document.addEventListener('visibilitychange',resume);
 queue();
})();
