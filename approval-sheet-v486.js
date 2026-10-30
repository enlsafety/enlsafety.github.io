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
 const css=`.enl-approval486{margin:12px 0 18px;min-width:0;max-width:100%;box-sizing:border-box;break-inside:avoid}.enl-approval486-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:1px 0 5px}.enl-approval486-line{display:flex;gap:9px;align-items:stretch;min-width:650px}.enl-approval486-label{width:25px;flex:0 0 25px;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;letter-spacing:4px;background:#f0f2f4;border:1px solid #ccd3dc;font-size:12px;color:#42576b}.enl-approval486-group{flex:var(--approval-cols) 1 0;min-width:0;border:1px solid #ccd3dc;background:#fff}.enl-approval486-group[data-approval-group="executives"]{border-color:#aebdca;box-shadow:0 0 0 2px #eff3f6}.enl-approval486 table{table-layout:fixed;border-collapse:collapse;width:100%;margin:0}.enl-approval486 th,.enl-approval486 td{border:0;border-right:1px solid #d4dae2;text-align:center;padding:6px 3px;vertical-align:top;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.enl-approval486 tr>*:last-child{border-right:0}.enl-approval486 th{background:#f0f2f4;border-bottom:1px solid #ccd3dc;color:#40576d;font-weight:500;white-space:nowrap}.enl-approval486 td{height:76px;color:#1b3d5e}.enl-approval486-name{display:block;font-weight:600}.enl-approval486-status{display:block;color:#687d8f;font-size:11px}.enl-approval486-status.done{color:#12876e}.enl-approval486-status.rejected{color:#b23b36}.enl-approval486 time{display:block;color:#78899a;font-size:10px;white-space:nowrap}.enl-approval486-note{display:none;margin:5px 0 0;font-size:11px;color:#667c8d}@media screen and (max-width:700px){.enl-approval486-note{display:block}}@media print{.enl-approval486-scroll{overflow:visible;padding:0}.enl-approval486-line{min-width:0;gap:6px}.enl-approval486-label{width:19px;flex-basis:19px}.enl-approval486 th,.enl-approval486 td{font-size:10px;padding:5px 2px}.enl-approval486 time{font-size:9px}.enl-approval486-note{display:none}}`;
 function render(i,users=[]){
  const c=i.corrective||{},a=i.executiveApproval;
  // Existing approvals always use the immutable roster/signature snapshot.
  const configured=users.filter(u=>u.active!==false&&u.role==='executive');
  const roster=Array.isArray(a?.roster)?a.roster:i.status==='closed'?[]:configured.length?configured:planned;
  const final=roster.filter(u=>u.id&&u.id===a?.finalApproverId||key(u.position)==='사장');
  const exec=roster.filter(u=>!final.includes(u)).slice().sort((x,y)=>rank(x)-rank(y)||key(x.name).localeCompare(key(y.name),'ko'));
  const reviewIsCurrent=!!c.reviewedAt&&(!c.submittedAt||Date.parse(c.reviewedAt)>=Date.parse(c.submittedAt));
  const safetyApproved=reviewIsCurrent&&(c.status==='approved'||!!a?.requestedAt&&c.reviewedAt===a.requestedAt);
  const safetyRejected=reviewIsCurrent&&c.status==='rejected';
  const first=[{role:'현장관리자',name:c.submittedBy||'',state:c.submittedAt?'기안':'제출대기',at:c.submittedAt,done:!!c.submittedAt},{role:'안전관리자',name:c.reviewedBy||c.planBy||'',state:safetyApproved?'승인':safetyRejected?'보완요청':'승인대기',at:safetyApproved||safetyRejected?c.reviewedAt:'',done:safetyApproved,rejected:safetyRejected}];
  const approver=u=>{const s=(a?.signatures||[]).find(x=>x.id===u.id&&x.decision==='approve'),r=a?.state==='rejected'&&a.rejection?.id===u.id?a.rejection:null;return {id:u.id,role:u.position||'경영진',name:u.name||'',state:s?'승인':r?'반려':'결재대기',at:s?.at||r?.at,done:!!s,rejected:!!r,note:s?.note||r?.note};};
  const group=(items,name)=>!items.length?'':'<div class="enl-approval486-group" data-approval-group="'+name+'" style="--approval-cols:'+items.length+'"><table aria-label="'+(name==='origin'?'기안 및 안전관리자 확인':name==='executives'?'경영진 결재':'사장 최종결재')+'"><thead><tr>'+items.map(x=>'<th scope="col">'+e(x.role)+'</th>').join('')+'</tr></thead><tbody><tr>'+items.map(x=>{const d=date(x.at);return '<td data-approval-person="'+e(x.id||x.role)+'"'+(x.note?' title="'+e(x.note)+'"':'')+'><span class="enl-approval486-name">'+e(x.name||'미지정')+'</span><span class="enl-approval486-status '+(x.done?'done':x.rejected?'rejected':'')+'">'+e(x.state)+'</span>'+(d?'<time datetime="'+e(x.at)+'" title="'+e(d.full)+'" aria-label="'+e(d.full)+'">'+e(d.short)+'</time>':'')+'</td>'}).join('')+'</tr></tbody></table></div>';
  return '<section class="enl-approval486" data-approval-sheet aria-label="사고보고 결재란"><div class="enl-approval486-scroll" tabindex="0" aria-label="결재란 좌우 스크롤"><div class="enl-approval486-line"><div class="enl-approval486-label">결재</div>'+group(first,'origin')+group(exec.map(approver),'executives')+group(final.map(approver),'president')+'</div></div><p class="enl-approval486-note">좌우로 밀어 전체 결재란을 확인하세요.</p></section>';
 }
 root.ENLApprovalSheet={render,css};
 if(typeof document!=='undefined'&&!document.getElementById('enlApprovalSheet486Css')){const style=document.createElement('style');style.id='enlApprovalSheet486Css';style.textContent=css;document.head.appendChild(style);}
})(globalThis);
