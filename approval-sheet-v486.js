/* Read-only approval sheet shared by the incident modal and final PDF. */
(function(root){
 'use strict';
 const order=['이영균','이재민','김동석','박종태'];
 const planned=[{name:'이영균',position:'상무'},{name:'이재민',position:'상무'},{name:'김동석',position:'전무'},{name:'박종태',position:'부사장'},{name:'이실연',position:'사장'}];
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=v=>String(v||'').replace(/\s/g,'');
 const rank=u=>{const n=order.indexOf(key(u.name));return n<0?order.length:n;};
 function date(value){
  if(!value||!Number.isFinite(Date.parse(value)))return '';
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
  return {short:p.month+'.'+p.day+' '+p.hour+':'+p.minute,full:p.year+'.'+p.month+'.'+p.day+' '+p.hour+':'+p.minute};
 }
 const css=`
 .enl-approval486{margin:12px 0 18px;min-width:0;max-width:100%;box-sizing:border-box;break-inside:avoid}
 .enl-approval486-line,.enl-approval486-prep,.enl-approval486-decisions{display:flex;align-items:stretch;gap:6px;min-width:0}
 .enl-approval486-line{flex-wrap:wrap;row-gap:8px}
 .enl-approval486-prep{flex:2 1 12rem}
 .enl-approval486-decisions{flex:var(--decision-cols) 1 calc(var(--decision-cols) * 5rem)}
 .enl-approval486-label{flex:0 0 22px;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;letter-spacing:3px;background:#f0f2f4;border:1px solid #ccd3dc;font-size:12px;color:#42576b}
 .enl-approval486-group{flex:var(--approval-cols) 1 0;min-width:0;border:1px solid #ccd3dc;background:#fff}
 .enl-approval486-group[data-approval-group="executives"]{border-color:#aebdca;box-shadow:0 0 0 1px #eff3f6}
 .enl-approval486 table{table-layout:fixed;border-collapse:collapse;width:100%;min-width:0;margin:0}
 .enl-approval486 table+table{border-top:1px solid #ccd3dc}
 .enl-approval486 th,.enl-approval486 td{border:0;border-right:1px solid #d4dae2;text-align:center;padding:4px 2px;vertical-align:top;font-size:12px;line-height:1.4;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}
 .enl-approval486 tr>*:last-child{border-right:0}
 .enl-approval486 th{background:#f0f2f4;border-bottom:1px solid #ccd3dc;color:#40576d;font-weight:500}
 .enl-approval486 td{height:58px;color:#1b3d5e}
 .enl-approval486-reads{display:flex;gap:6px;min-width:0;margin-top:8px}
 .enl-approval486-reads .enl-approval486-group{flex:1}
 .enl-approval486-reads td{height:auto}
 .enl-approval486-reads p{margin:0;padding:7px;color:#586c7d;font-size:12px}
 .enl-approval486-name{display:block;font-weight:600}
 .enl-approval486-status{display:block;color:#687d8f;font-size:11px}
 .enl-approval486-status.done{color:#12876e}.enl-approval486-status.rejected{color:#b23b36}
 .enl-approval486 time{display:block;color:#5b7184;font-size:10px;font-variant-numeric:tabular-nums;white-space:normal}
 @media print{
  .enl-approval486-line{flex-wrap:nowrap}
  .enl-approval486-label{flex-basis:19px}
  .enl-approval486 th,.enl-approval486 td{font-size:10px;padding:5px 2px}
  .enl-approval486 time{font-size:9px}
 }`;
  const maxColumns=4;
  const renderCell=(x,readOnly)=>{
   const d=date(x.at);
   return '<td '+(readOnly?'data-reader-person':'data-approval-person')+'="'+e(x.id||x.role)+'"'+(x.note?' title="'+e(x.note)+'"':'')+'><span class="enl-approval486-name">'+e(x.name||'미지정')+'</span><span class="enl-approval486-status '+(x.done?'done':x.rejected?'rejected':'')+'">'+e(x.state)+'</span>'+(d?'<time datetime="'+e(x.at)+'" title="'+e(d.full)+'" aria-label="'+e(d.full)+'">'+e(d.short)+'</time>':'')+'</td>';
  };
  function group(items,name,label){
   if(!items.length)return '';
   const tables=[];
   for(let start=0;start<items.length;start+=maxColumns){
    const row=items.slice(start,start+maxColumns);
    tables.push('<table aria-label="'+label+'"><thead><tr>'+row.map(x=>'<th scope="col">'+e(x.role)+'</th>').join('')+'</tr></thead><tbody><tr>'+row.map(x=>renderCell(x,name==='readers')).join('')+'</tr></tbody></table>');
   }
   return '<div class="enl-approval486-group" data-approval-group="'+name+'" style="--approval-cols:'+Math.min(items.length,maxColumns)+'">'+tables.join('')+'</div>';
  }
 function renderReaders(readers){
  const cells=Array.isArray(readers)?readers.map(u=>({id:u.id,name:u.name,role:u.position||'본사실무자',state:u.first_viewed_at?'조회':'미조회',at:u.first_viewed_at,done:!!u.first_viewed_at})):null;
  const body=cells?(group(cells,'readers','본사 실무진 최초 조회')||'<p>대상자 없음</p>'):'<p>조회 기록 확인 불가</p>';
  return '<div class="enl-approval486-reads"><div class="enl-approval486-label">조회</div>'+body+'</div>';
 }
 function render(i,users=[],reads){
  const c=i.corrective||{},a=i.executiveApproval;
  // Existing approvals always use the immutable roster/signature snapshot.
  // Before the server creates a roster, display layout slots rather than cached accounts.
  const roster=Array.isArray(a?.roster)?a.roster:i.status==='closed'?[]:planned;
  const final=roster.filter(u=>u.id&&u.id===a?.finalApproverId||key(u.position)==='사장');
  const exec=roster.filter(u=>!final.includes(u)).slice().sort((x,y)=>rank(x)-rank(y)||key(x.name).localeCompare(key(y.name),'ko'));
  const reviewIsCurrent=!!c.reviewedAt&&(!c.submittedAt||Date.parse(c.reviewedAt)>=Date.parse(c.submittedAt));
  const safetyApproved=reviewIsCurrent&&(c.status==='approved'||!!a?.requestedAt&&c.reviewedAt===a.requestedAt);
  const safetyRejected=reviewIsCurrent&&c.status==='rejected';
  const first=[{role:'현장관리자',name:c.submittedBy||'',state:c.submittedAt?'기안':'제출대기',at:c.submittedAt,done:!!c.submittedAt},{role:'안전관리자',name:c.reviewedBy||c.planBy||'',state:safetyApproved?'승인':safetyRejected?'보완요청':'승인대기',at:safetyApproved||safetyRejected?c.reviewedAt:'',done:safetyApproved,rejected:safetyRejected}];
  if(i.pastReport){
   if(!first[0].name&&!c.submittedAt)Object.assign(first[0],{name:i.pastReport.drafterName,state:'당시 기안자 / 제출대기'});
   if(!first[1].name&&!c.reviewedAt)Object.assign(first[1],{name:i.pastReport.safetyManagerName,state:'당시 담당 / 승인대기'});
  }
  const approver=u=>{const s=(a?.signatures||[]).find(x=>x.id===u.id&&x.decision==='approve'),r=a?.state==='rejected'&&a.rejection?.id===u.id?a.rejection:null;return {id:u.id,role:u.position||'경영진',name:u.name||'',state:s?'승인':r?'반려':'결재대기',at:s?.at||r?.at,done:!!s,rejected:!!r,note:s?.note||r?.note};};
  const decisionCols=Math.min(exec.length,maxColumns)+Math.min(final.length,maxColumns);
  const decisions=decisionCols?'<div class="enl-approval486-decisions" style="--decision-cols:'+decisionCols+'">'+group(exec.map(approver),'executives','경영진 결재')+group(final.map(approver),'president','사장 최종결재')+'</div>':'';
  return '<section class="enl-approval486" data-approval-sheet aria-label="사고보고 결재란"><div class="enl-approval486-line"><div class="enl-approval486-prep"><div class="enl-approval486-label">결재</div>'+group(first,'origin','기안 및 안전관리자 확인')+'</div>'+decisions+'</div><div data-hq-readers>'+(reads===undefined?'':renderReaders(reads))+'</div></section>';
 }
 root.ENLApprovalSheet={render,renderReaders,css};
 if(typeof document!=='undefined'&&!document.getElementById('enlApprovalSheet486Css')){const style=document.createElement('style');style.id='enlApprovalSheet486Css';style.textContent=css;document.head.appendChild(style);}
})(globalThis);
