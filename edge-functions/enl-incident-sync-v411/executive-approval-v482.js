/* Shared by the browser and authenticated Edge handlers. Roster titles are snapshots. */
(function(root){
 'use strict';
 const isPresident=u=>String(u?.position||'').replace(/\s/g,'')==='사장';
 function describe(a){
  const roster=Array.isArray(a?.roster)?a.roster:[],signed=Array.isArray(a?.signatures)?a.signatures:[];
  const presidents=roster.filter(isPresident),president=presidents.length===1?presidents[0]:null;
  const valid=!!president&&roster.every(u=>typeof u.id==='string'&&u.id)&&new Set(roster.map(u=>u.id)).size===roster.length&&(!a.finalApproverId||a.finalApproverId===president.id);
  const approved=id=>signed.some(s=>s.id===id&&s.decision==='approve');
  const parallel=roster.filter(u=>u.id!==president?.id),remaining=parallel.filter(u=>!approved(u.id));
  const stage=valid?(remaining.length?'parallel':'president'):'invalid';
  return {valid,president,parallel,remaining,stage,approved};
 }
 function canDecide(a,id){
  const p=describe(a);
  return a?.state==='pending'&&p.valid&&a.roster.some(u=>u.id===id)&&!p.approved(id)&&(id!==p.president.id||p.stage==='president');
 }
 root.ENLExecutiveApproval=Object.freeze({isPresident,describe,canDecide});
})(globalThis);
