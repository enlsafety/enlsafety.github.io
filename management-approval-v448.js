/* Server-authenticated executive closure; historical acknowledgements remain read-only. */
(function(){
 'use strict';// 4.8.0-executive-closure
 let queued=false;
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'-';
 const actor=()=>{const u=currentUser();return {id:u.id||u.personnelId,role:u.role,siteId:u.siteId||''}};
 const policy=()=>window.ENLExecutiveApproval;
 const stageLabel=a=>policy().describe(a).stage==='president'?'사장 최종결재대기':'경영진 결재 진행 중';
 const signatures=i=>window.ENLApprovalSheet?.render(i,typeof data!=='undefined'?data.users||[]:[])||'';
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
   win.document.open();win.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(r.documentNumber||'기존 종결 사고기록')+'</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:14px/1.6 Arial,"Malgun Gothic",sans-serif;color:#182f42;margin:20px;overflow-wrap:anywhere}h1{font-size:24px}h3{font-size:17px;background:#eaf3fa;padding:8px}.report410-record-row{display:grid;grid-template-columns:145px 1fr;border-bottom:1px solid #d9e2e9;padding:7px;white-space:pre-wrap}.report410-record-row b{padding-right:12px}.report410-stage{margin:18px 0}.report410-section{margin:12px 0}.report410-section-head{font-weight:bold;padding:5px 0;border-bottom:2px solid #a8baca;break-after:avoid}.report410-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.report410-wide{grid-column:1/-1}.lbl,.report410-check{display:block;margin:6px 0;break-inside:avoid}.lbl>span,.report410-check>span{display:block;font-size:12px;font-weight:bold;color:#486275}.report410-read-value{white-space:pre-wrap;padding:4px 0;border-bottom:1px solid #d9e2e9;min-height:25px}.report410-record-row{break-inside:avoid}small{font-size:12px}@media screen and (max-width:500px){body{margin:12px}.report410-grid{display:block}.report410-record-row{grid-template-columns:105px 1fr}}img{max-width:100%;max-height:220mm;object-fit:contain}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b8c8d5;padding:8px;text-align:left}tr,img{break-inside:avoid}button{padding:12px;margin:4px;cursor:pointer}.attach-open411,.attach-remove411,iframe{display:none}.attach-grid411{display:block}.attach-card411{margin:10px 0}.attach-file411{border:1px solid #ddd;padding:8px}@media print{body{margin:0}.print-tools{display:none}h3{break-after:avoid}a{color:inherit}}'+(window.ENLApprovalSheet?.css||'')+'</style></head><body><div class="print-tools"><button id="print" disabled>사진 불러오는 중</button><p>인쇄 대상에서 PDF 저장을 선택하세요. PDF 첨부파일은 원본 파일을 별도로 확인해 주세요.</p></div>'+signatures(record)+'<h1>이앤엘 사고 종결보고서</h1><p>문서번호: '+e(r.documentNumber||'기존 종결기록 (자동채번 시행 전)')+'<br>종결일시: '+e(time(record.closedAt))+'</p>'+report+'<p>이 문서는 '+(r.archived?'최종 결재 당시 보존된 기록':'기존 종결 기록')+'을 출력한 것입니다.</p></body></html>');win.document.close();win.document.getElementById('print').onclick=()=>win.print();
   const all=[...(record.photos||[]),...(record.supplement?.attachments||[]),...(record.corrective?.afterPhotos||[])];
   // Hydrate protected images using the same authorized signing service as the app.
   const paths=all.filter(x=>x&&typeof x==='object'&&x.path).map(x=>x.path);
   const urls=paths.length?await signAttachments(paths):{};
   const groups={photos:record.photos||[],supplement:record.supplement?.attachments||[],action:record.corrective?.afterPhotos||[]};
   for(const group of win.document.querySelectorAll('[data-report-files]')){const all=groups[group.dataset.reportFiles]||[];const cards=[...group.querySelectorAll('.attach-card411')];
   cards.forEach((card,n)=>{const file=all[n];if(!file)return;const url=typeof file==='string'?file:(urls[file.path]||file.dataUrl||file.url);const kind=window.enlAttachmentKind?.(file)||(file.mime==='application/pdf'||/\.pdf(?:[?#]|$)/i.test(file.name||url||'')?'pdf':'image');card.textContent='';if(url&&kind==='image'){const img=win.document.createElement('img');img.src=url;img.alt=file.name||'첨부사진';img.onerror=()=>{card.textContent=(file.name||'첨부사진')+': 사진을 불러오지 못했습니다.'};card.appendChild(img)}else{card.textContent=(file.name||'첨부파일')+(kind==='pdf'?' (PDF 원본 별도 확인)':' (사진을 불러오지 못했습니다.)')}});}
   const images=[...win.document.images],print=win.document.getElementById('print');
   const readiness=win.document.createElement('p');readiness.setAttribute('role','status');win.document.querySelector('.print-tools').appendChild(readiness);
   const updatePrint=()=>{
    if(win.closed)return;
    const failed=images.some(img=>img.complete&&!img.naturalWidth),ready=images.every(img=>img.complete&&img.naturalWidth>0);
    print.disabled=!ready;print.textContent=ready?'인쇄 / PDF로 저장':failed?'사진을 불러오지 못했습니다':'사진 불러오는 중';
    readiness.textContent=failed?'사진이 누락되지 않도록 인쇄를 보류했습니다. 이 창을 닫고 보고서를 다시 열어 주세요.':ready?'':'사진을 모두 불러온 뒤 인쇄할 수 있습니다.';
   };
   images.forEach(img=>{img.addEventListener('load',updatePrint);img.addEventListener('error',updatePrint)});updatePrint();
  }catch(err){win.document.body.textContent='종결 기록을 불러오지 못했습니다. '+error(err)}
 }
 window.enlPrintFinalDocument=printDocument;
 const queueMarkup=new WeakMap();
 const labels={required:'결재필요',scheduled:'결재대기',tracking:'결재대기',signed:'결재완료',completed:'결재완료'};
 const pendingReview=i=>i?.status==='approved'&&i.corrective?.status==='approved'&&i.executiveApproval?.state==='pending';
 function badge(kind){
  const label=labels[kind];
  const detail=kind==='signed'?'본인 결재 완료':kind==='completed'?'최종결재 완료':label;
  return '<span class="exec-required-badge" data-exec-kind="'+kind+'" aria-label="'+detail+'" title="'+detail+'">'+label.slice(0,2)+'<br>'+label.slice(2)+'</span>';
 }
 function approvalRow(i,kind){
  const q=window.enlIncidentQuickSummary?.(i),site=q?.site||window.siteById?.(i.siteId)?.name||i.siteId||'사업장 미확인';
  const when=q?.when||(i.occurredAt?fmt(i.occurredAt):'');
  const action=kind!=='required'?'진행상태 보기':policy().describe(i.executiveApproval).stage==='president'?'최종결재하기':'결재하기';
  return '<button type="button" class="exec-queue-row" data-exec-mark="'+kind+'" '+(kind==='required'?'data-exec-required ':'')+'data-exec-open="'+e(i.id)+'">'+badge(kind)+'<span class="exec-queue-text"><strong>'+e(site)+' / '+e(i.eventType||'사고')+'</strong><small>'+e(when)+'</small>'+(q?.circumstance?'<span>'+e(q.circumstance)+'</span>':'')+'</span><span class="exec-queue-action">'+action+'</span></button>';
 }
 function markApprovalRows(root,kinds){
  const selector=kinds.size?'button[data-inc-id],button[data-safety-inc],button[data-reader-open],button[data-stats-inc],button[data-lifecycle-open],[data-prev-card]':'[data-exec-mark]:not([data-exec-open])';
  for(const row of root.querySelectorAll(selector)){
   const id=row.dataset.incId||row.dataset.safetyInc||row.dataset.readerOpen||row.dataset.statsInc||row.dataset.lifecycleOpen||row.dataset.prevCard;
   const kind=kinds.get(id),old=row.querySelector('.exec-required-badge');
   if(row.dataset.execMark===kind&&old?.dataset.execKind===kind)continue;
   old?.remove();row.toggleAttribute('data-exec-required',kind==='required');
   if(kind){
    row.dataset.execMark=kind;
    let slot=row;
    if(row.dataset.lifecycleOpen)slot=row.firstElementChild||row;
    else if(!row.dataset.safetyInc)slot=row.querySelector('.inc411-card-side,.reader414-state,.state,.prev429-meta')||row;
    slot.insertAdjacentHTML('beforeend',badge(kind));
   }else delete row.dataset.execMark;
  }
 }
 function updateApprovalQueue(root,u){
  const executive=u?.role==='executive'&&u.active!==false,safety=u?.role==='safety'&&u.active!==false;
  const list=[],waiting=[],kinds=new Map();
  const reader=['manager','final'].includes(u?.role)&&u.active!==false;
  if(executive||safety||reader)for(const i of data.incidents||[]){
   const a=i.executiveApproval,id=String(i.id);
   if(i.status==='closed'&&a?.state==='approved'){kinds.set(id,'completed');continue;}
   if(!pendingReview(i))continue;
   const plan=policy().describe(a);
   if(!plan.valid)continue;
   let kind;
   if(executive&&plan.approved(u.id)){kinds.set(id,'signed');continue;}
   if(safety||reader)kind='tracking';
   else if(policy().canDecide(a,u.id))kind='required';
   else if(plan.stage==='parallel'&&plan.president.id===u.id&&!plan.approved(u.id))kind='scheduled';
   else continue;
   kinds.set(id,kind);
   (kind==='scheduled'?waiting:list).push(i);
  }
  const outstanding=list.length+waiting.length;
  const tab=document.querySelector('.shell411-nav [data-shell-view="incidents"]');
  if(tab){
   const total=executive?outstanding:0;
   let number=tab.querySelector('.exec-tab-count');
   if(total){
    if(!number){number=document.createElement('span');number.className='exec-tab-count';number.setAttribute('aria-hidden','true');tab.appendChild(number);}
    if(number.textContent!==String(total))number.textContent=String(total);
    tab.dataset.execCount=String(total);
    tab.setAttribute('aria-label','사고 조회, 결재필요 '+list.length+'건, 결재대기 '+waiting.length+'건');
   }else if(number||tab.hasAttribute('data-exec-count')){
    number?.remove();delete tab.dataset.execCount;tab.removeAttribute('aria-label');
   }
  }
  markApprovalRows(root,kinds);
  let box=root.querySelector('[data-executive-queue]');
  if(!executive&&!(safety&&list.length&&['incidents','stats','home','dashboard'].includes(currentView))){box?.remove();return;}
  if(!box){
   box=document.createElement('section');box.dataset.executiveQueue='';box.className='panel';root.prepend(box);
   box.addEventListener('click',event=>{const button=event.target.closest('[data-exec-open]');if(button)openIncidentModal(button.dataset.execOpen)});
  }
  const count=outstanding?'<span class="exec-tab-count">'+outstanding+'</span>':'0건';
  const html='<h2>'+(safety?'경영진 결재현황':'내 결재')+' '+count+'</h2>'+list.map(i=>approvalRow(i,kinds.get(String(i.id)))).join('')+
   (waiting.length?'<p>사장 최종결재 대기 '+waiting.length+'건</p>'+waiting.map(i=>approvalRow(i,'scheduled')).join(''):'');
  if(queueMarkup.get(box)!==html){queueMarkup.set(box,html);box.innerHTML=html;}
 }
 function decorate(){
  queued=false;const u=currentUser?.(),root=document.querySelector('#view');
  if(root)updateApprovalQueue(root,u);
  if(!u)return;
  const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
  const id=modal.dataset.incidentView||modal.dataset.cumulativeIncident||modal.dataset.wf440Incident||modal.querySelector('[data-lifecycle-final]')?.dataset.lifecycleFinal;
  const i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return;
  const sig=i.id+':'+i._syncVersion+':'+u.id;if(modal.dataset.executiveSignature===sig)return;modal.dataset.executiveSignature=sig;
  modal.querySelector('[data-executive-record]')?.remove();const box=document.createElement('section');box.dataset.executiveRecord='';box.className='panel';const a=i.executiveApproval;
  box.innerHTML=signatures(i)+(a?'<h3>'+(a.state==='pending'?stageLabel(a):a.state==='rejected'?'경영진 반려 / 안전관리자 재검토':'경영진 결재 완료')+'</h3>'+(a.state==='pending'&&policy().describe(a).stage==='parallel'?'<p>경영진 '+policy().describe(a).parallel.length+'명 결재 후 사장 최종결재</p>':'')+(a.rejection&&a.state==='rejected'?'<p>반려 사유: '+e(a.rejection.note)+'</p>':''):'')+(i.officialRecord?.documentNumber?'<p>문서번호: <b>'+e(i.officialRecord.documentNumber)+'</b></p>':'');
  if(u.role==='executive'&&u.active!==false&&pendingReview(i)&&policy().canDecide(a,u.id)){
   for(const [d,label] of [['approve',policy().describe(a).stage==='president'?'사장 최종결재':'결재 승인'],['reject','반려']]){const b=document.createElement('button');b.textContent=label;b.className=d==='approve'?'primary':'secondary';b.onclick=()=>decide(i,d,b);box.appendChild(b)}
  }
  if(i.status==='closed'&&['manager','executive','safety','final'].includes(u.role)){const b=document.createElement('button');b.textContent='종결보고서 PDF 출력';b.onclick=()=>printDocument(i);box.appendChild(b)}
  if((i.acknowledgements||[]).length){const old=document.createElement('details');old.dataset.priorApprovals='';old.innerHTML='<summary>과거 결재기록 (읽기 전용)</summary>'+i.acknowledgements.map(s=>'<p>'+e(s.name)+' / '+e(s.ackAt||s.readAt||'')+'</p>').join('');box.appendChild(old)}
  if(box.childNodes.length){const head=modal.querySelector('.modal-head');if(head)head.insertAdjacentElement('afterend',box);else modal.prepend(box);}
 }
 const style=document.createElement('style');style.textContent='[data-executive-record]{min-width:0;max-width:100%;box-sizing:border-box}[data-executive-record]>h3{font-size:14px}[data-executive-record]>p{font-size:12px}[data-executive-record] button,[data-executive-queue] button{min-height:44px;margin:5px;max-width:100%;white-space:normal}';
 style.textContent+=`
 .exec-tab-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 3px;margin-left:5px;border-radius:999px;background:#b4232c;color:#fff;font:bold 12px/1 Arial,sans-serif;vertical-align:middle;box-sizing:border-box}
 .shell411-nav button[data-exec-count]>.enl424-nav-dot{display:none}
 #view [data-exec-mark]{--exec-accent:#626b75;--exec-line:#a3acb4;--exec-bg:#f7f8fa;border:2px solid var(--exec-line);background:var(--exec-bg)}
 #view [data-exec-mark="required"]{--exec-accent:#b4232c;--exec-line:#b4232c;--exec-bg:#fff8f8}
 #view [data-exec-mark="signed"],#view [data-exec-mark="completed"]{--exec-accent:#187548;--exec-line:#a8cdb9;--exec-bg:#f5fbf7}
 #view [data-exec-mark]:focus-visible{outline:3px solid #204e79;outline-offset:2px}
 #view .exec-required-badge{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;flex:none;width:36px;height:36px;border-radius:50%;padding:0;background:var(--exec-accent);color:white;font-size:11px;font-weight:800;line-height:1.15;text-align:center;vertical-align:middle;white-space:nowrap}
 [data-executive-queue] .exec-queue-row{width:100%;margin:6px 0 0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;text-align:left;color:#263e52;cursor:pointer}
 .exec-queue-text{display:grid;gap:3px;min-width:0;overflow-wrap:anywhere}.exec-queue-text strong{font-size:14px}.exec-queue-text small,.exec-queue-text>span{font-size:12px;font-weight:500}
 .exec-queue-action{font-size:12px;font-weight:bold;color:var(--exec-accent)}
 .inc411-card[data-exec-mark]>.inc411-card-side{display:grid;justify-items:end;align-items:center;gap:6px}
 @media(max-width:720px){
  .inc411-card[data-exec-mark]{grid-template-columns:minmax(0,1fr) auto}
  .inc411-card[data-exec-mark]>.inc411-card-side{grid-column:2;grid-row:1;min-width:0}
  .inc411-card[data-exec-mark]>.inc411-card-main{grid-column:1/-1}
 }
 .shell411-recent button[data-exec-mark]{grid-template-columns:115px minmax(0,1fr) auto auto;grid-template-areas:'meta main status approval'}
 .shell411-recent button>.exec-required-badge{grid-area:approval;justify-self:end}
 @media(max-width:700px){.shell411-recent button[data-exec-mark]{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'meta approval' 'main main' 'status status'}}
 .stats426-drill-row .state .exec-required-badge{margin-left:4px}
 `;document.head.appendChild(style);
 const queue=()=>{if(!queued){queued=true;requestAnimationFrame(decorate)}};window.addEventListener('enl-incident-saved',queue);window.addEventListener('enl-incidents-pulled',queue);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});queue();
})();
