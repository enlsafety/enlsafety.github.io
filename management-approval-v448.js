/* Server-authenticated executive closure; historical acknowledgements remain read-only. */
(function(){
 'use strict';// 4.8.0-executive-closure
 let queued=false;
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'-';
 const actor=()=>{const u=currentUser();return {id:u.id||u.personnelId,role:u.role,siteId:u.siteId||''}};
 const policy=()=>window.ENLExecutiveApproval;
 const stageLabel=a=>policy().describe(a).stage==='president'?'사장 최종결재대기':'경영진 결재 진행 중';
 const signatures=i=>window.ENLApprovalSheet.render(i,typeof data!=='undefined'?data.users||[]:[]);
 const error=err=>err?.message==='approval_turn_not_ready'?'아직 결재 차례가 아닙니다. 사장 최종결재는 다른 경영진의 결재가 모두 완료된 후 가능합니다.':err?.message==='president_approver_required'?'최종결재 사장 계정 설정을 확인해 주세요.':String(err?.message||'').includes('conflict')?'결재 단계가 변경되었습니다. 사고를 다시 열고 확인해 주세요.':String(err?.message||'').includes('auth')?'다시 로그인한 뒤 처리해 주세요.':'처리를 완료하지 못했습니다. 사고를 다시 열어 상태를 확인해 주세요.';
 async function decide(i,decision,button){
  const note=decision==='reject'?prompt('반려 사유를 입력해 주세요.'):'';if(decision==='reject'&&!note?.trim())return;
  if(!confirm(decision==='approve'?'사고보고와 재발방지조치를 확인하고 결재할까요?':'반려하고 안전관리자에게 재검토를 요청할까요?'))return;
  button.disabled=true;const requestActor=actor();
  try{const r=await window.enlIncidentApi({action:'executive_decide',incidentId:i.id,expectedVersion:i._syncVersion,approvalRound:i.executiveApproval.round,actor:requestActor,decision,note:note||''});if(currentUser()?.id!==requestActor.id)return;window.enlAcceptSavedIncident(r.incident);closeModal();renderShell(currentUser());alert(r.incident.status==='closed'?'사장 최종결재가 완료되어 종결되었습니다. 문서번호: '+r.incident.officialRecord.documentNumber:decision==='reject'?'안전관리자에게 재검토를 요청했습니다.':r.incident.executiveApproval.stage==='president'?'경영진 결재가 모두 완료되어 사장 최종결재를 요청했습니다.':'결재를 완료했습니다. 다른 경영진의 결재를 기다립니다.');}catch(err){alert(error(err));}finally{button.disabled=false;}
 }
 async function printDocument(i){
  const win=window.open('','_blank');if(!win)return alert('팝업을 허용한 뒤 다시 눌러 주세요.');win.document.body.textContent='서버의 종결 기록을 불러오는 중입니다.';
  try{
   const r=await window.enlIncidentApi({action:'final_document',incidentId:i.id,actor:actor()}),record=r.incident;
   const report=window.enlCumulativeReportHtml(record);
   win.document.open();win.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+e(r.documentNumber||'기존 종결 사고기록')+'</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:14px/1.6 Arial,"Malgun Gothic",sans-serif;color:#182f42;margin:20px;overflow-wrap:anywhere}h1{font-size:24px}h3{font-size:17px;background:#eaf3fa;padding:8px}.report410-record-row{display:grid;grid-template-columns:145px 1fr;border-bottom:1px solid #d9e2e9;padding:7px;white-space:pre-wrap}.report410-record-row b{padding-right:12px}.report410-stage{margin:18px 0}.report410-section{margin:12px 0}.report410-section-head{font-weight:bold;padding:5px 0;border-bottom:2px solid #a8baca;break-after:avoid}.report410-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.report410-wide{grid-column:1/-1}.lbl,.report410-check{display:block;margin:6px 0;break-inside:avoid}.lbl>span,.report410-check>span{display:block;font-size:12px;font-weight:bold;color:#486275}.report410-read-value{white-space:pre-wrap;padding:4px 0;border-bottom:1px solid #d9e2e9;min-height:25px}.report410-record-row{break-inside:avoid}small{font-size:12px}@media screen and (max-width:500px){body{margin:12px}.report410-grid{display:block}.report410-record-row{grid-template-columns:105px 1fr}}img{max-width:100%;max-height:220mm;object-fit:contain}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b8c8d5;padding:8px;text-align:left}tr,img{break-inside:avoid}button{padding:12px;margin:4px;cursor:pointer}.attach-open411,.attach-remove411,iframe{display:none}.attach-grid411{display:block}.attach-card411{margin:10px 0}.attach-file411{border:1px solid #ddd;padding:8px}@media print{body{margin:0}.print-tools{display:none}h3{break-after:avoid}a{color:inherit}}'+window.ENLApprovalSheet.css+'</style></head><body><div class="print-tools"><button id="print" disabled>사진 불러오는 중</button><p>인쇄 대상에서 PDF 저장을 선택하세요. PDF 첨부파일은 원본 파일을 별도로 확인해 주세요.</p></div>'+signatures(record)+'<h1>이앤엘 사고 종결보고서</h1><p>문서번호: '+e(r.documentNumber||'기존 종결기록 (자동채번 시행 전)')+'<br>종결일시: '+e(time(record.closedAt))+'</p>'+report+'<p>이 문서는 '+(r.archived?'최종 결재 당시 보존된 기록':'기존 종결 기록')+'을 출력한 것입니다.</p></body></html>');win.document.close();win.document.getElementById('print').onclick=()=>win.print();
   const all=[...(record.photos||[]),...(record.supplement?.attachments||[]),...(record.corrective?.afterPhotos||[])];
   // Hydrate protected images using the same authorized signing service as the app.
   const paths=all.filter(x=>x&&typeof x==='object'&&x.path).map(x=>x.path);
   const urls=paths.length?await signAttachments(paths):{};
   const groups={photos:record.photos||[],supplement:record.supplement?.attachments||[],action:record.corrective?.afterPhotos||[]};
   for(const group of win.document.querySelectorAll('[data-report-files]')){const all=groups[group.dataset.reportFiles]||[];const cards=[...group.querySelectorAll('.attach-card411')];
   cards.forEach((card,n)=>{const file=all[n];if(!file)return;const url=typeof file==='string'?file:(urls[file.path]||file.dataUrl||file.url);const kind=window.enlAttachmentKind?.(file)||(file.mime==='application/pdf'||/\.pdf(?:[?#]|$)/i.test(file.name||url||'')?'pdf':'image');card.textContent='';if(url&&kind==='image'){const img=win.document.createElement('img');img.src=url;img.alt=file.name||'첨부사진';img.onerror=()=>{card.textContent=(file.name||'첨부사진')+': 사진을 불러오지 못했습니다.'};card.appendChild(img)}else{card.textContent=(file.name||'첨부파일')+(kind==='pdf'?' (PDF 원본 별도 확인)':' (사진을 불러오지 못했습니다.)')}});}
   await Promise.all([...win.document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,10000)})));
   const print=win.document.getElementById('print');print.disabled=false;print.textContent='인쇄 / PDF로 저장';
  }catch(err){win.document.body.textContent='종결 기록을 불러오지 못했습니다. '+error(err)}
 }
 window.enlPrintFinalDocument=printDocument;
 function decorate(){
  queued=false;const u=currentUser?.();if(!u)return;
  const root=document.querySelector('#view');
  if(root&&u.role==='executive'){
   const assigned=(data.incidents||[]).filter(i=>i.executiveApproval?.state==='pending'&&i.executiveApproval.roster.some(x=>x.id===u.id)&&!i.executiveApproval.signatures.some(x=>x.id===u.id));
   const list=assigned.filter(i=>policy().canDecide(i.executiveApproval,u.id)),waiting=assigned.filter(i=>!policy().canDecide(i.executiveApproval,u.id));
   const sig=JSON.stringify(assigned.map(i=>[i.id,i._syncVersion]));let box=root.querySelector('[data-executive-queue]');
   if(!box){box=document.createElement('section');box.dataset.executiveQueue='';box.className='panel';root.prepend(box)}
   if(box.dataset.signature!==sig){box.dataset.signature=sig;box.innerHTML='<h2>내 결재대기 '+list.length+'건</h2>'+list.map(i=>'<button type="button" data-exec-open="'+e(i.id)+'">'+e(siteName(i.siteId))+' / '+e(i.eventType)+' / '+(policy().describe(i.executiveApproval).stage==='president'?'최종결재하기':'결재하기')+'</button>').join('')+(waiting.length?'<p>경영진 결재 완료 후 최종결재 예정 '+waiting.length+'건</p>'+waiting.map(i=>'<button type="button" data-exec-open="'+e(i.id)+'">'+e(siteName(i.siteId))+' / '+e(i.eventType)+' / 진행상태 보기</button>').join(''):'');box.querySelectorAll('[data-exec-open]').forEach(b=>b.onclick=()=>openIncidentModal(b.dataset.execOpen));}
  }
  const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
  const id=modal.dataset.incidentView||modal.dataset.cumulativeIncident||modal.dataset.wf440Incident||modal.querySelector('[data-lifecycle-final]')?.dataset.lifecycleFinal;
  const i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return;
  const sig=i.id+':'+i._syncVersion+':'+u.id;if(modal.dataset.executiveSignature===sig)return;modal.dataset.executiveSignature=sig;
  modal.querySelector('[data-executive-record]')?.remove();const box=document.createElement('section');box.dataset.executiveRecord='';box.className='panel';const a=i.executiveApproval;
  box.innerHTML=signatures(i)+(a?'<h3>'+(a.state==='pending'?stageLabel(a):a.state==='rejected'?'경영진 반려 / 안전관리자 재검토':'경영진 결재 완료')+'</h3>'+(a.state==='pending'&&policy().describe(a).stage==='parallel'?'<p>사장을 제외한 경영진은 순서 없이 결재합니다. 전원 완료 후 사장이 최종결재합니다.</p>':'')+(a.rejection&&a.state==='rejected'?'<p>반려 사유: '+e(a.rejection.note)+'</p>':''):'')+(i.officialRecord?.documentNumber?'<p>문서번호: <b>'+e(i.officialRecord.documentNumber)+'</b></p>':'');
  if(u.role==='executive'&&policy().canDecide(a,u.id)){
   for(const [d,label] of [['approve',policy().describe(a).stage==='president'?'사장 최종결재':'결재 승인'],['reject','반려']]){const b=document.createElement('button');b.textContent=label;b.className=d==='approve'?'primary':'secondary';b.onclick=()=>decide(i,d,b);box.appendChild(b)}
  }
  if(i.status==='closed'&&['manager','executive','safety','final'].includes(u.role)){const b=document.createElement('button');b.textContent='종결보고서 PDF 출력';b.onclick=()=>printDocument(i);box.appendChild(b)}
  if((i.acknowledgements||[]).length){const old=document.createElement('details');old.dataset.priorApprovals='';old.innerHTML='<summary>과거 결재기록 (읽기 전용)</summary>'+i.acknowledgements.map(s=>'<p>'+e(s.name)+' / '+e(s.ackAt||s.readAt||'')+'</p>').join('');box.appendChild(old)}
  if(box.childNodes.length){const head=modal.querySelector('.modal-head');if(head)head.insertAdjacentElement('afterend',box);else modal.prepend(box);}
 }
 const style=document.createElement('style');style.textContent='[data-executive-record]{min-width:0;max-width:100%;box-sizing:border-box}[data-executive-record]>h3{font-size:14px}[data-executive-record]>p{font-size:12px}[data-executive-record] button,[data-executive-queue] button{min-height:44px;margin:5px;max-width:100%;white-space:normal}';document.head.appendChild(style);
 const queue=()=>{if(!queued){queued=true;requestAnimationFrame(decorate)}};new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});queue();
})();
