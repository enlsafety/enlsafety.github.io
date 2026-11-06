// Served inside the isolated app fixture with synthetic data and all fetches mocked.
(async()=>{
 const profile=new URLSearchParams(location.search).get('qa'),el=id=>document.getElementById(id);
 const check=(v,m)=>{if(!v)throw Error(m);qa.results.push('PASS '+m)};
 const wait=async(fn,label)=>{const until=Date.now()+8000;while(!fn()){if(Date.now()>until)throw Error('timeout '+label+' '+JSON.stringify(qa.dialogs));await new Promise(r=>setTimeout(r,15));}};
 const open=()=>openIncidentModal('sample-1',true,currentUser());
 const note=()=>document.querySelector('[data-transfer-notice]');
 try{
  await wait(()=>typeof enlEditIncidentInReportForm==='function'&&data.incidents.length,'boot');
  if(profile==='visual'){open();return;}
  open();await wait(()=>document.querySelector('[data-approval-sheet]'),'approval sheet');
  check(!!document.querySelector('[data-hq-readers] .enl-approval486-reads'),'reader and approval rows exist together');
  check(!!document.querySelector('[data-hq-readers] [aria-busy="true"]'),'slow reader request has visible loading cells');
  check(document.querySelector('[data-approval-sheet]').textContent.includes('기안자 / 제출대기'),'drafter status wording');
  check(document.querySelector('[data-approval-sheet]').textContent.includes('담당 / 승인대기'),'safety status wording');
  check(note()?.open&&note().textContent.includes('이 사고는 기 결재 완료 후 이관된 사고내용입니다.'),'nested historical notice shown');
  const bounds=note().getBoundingClientRect();check(bounds.left>=0&&bounds.right<=innerWidth+1,'notice fits viewport');
  note().querySelector('button').click();check(!note()&&!!document.querySelector('#modalRoot .modal'),'confirm dismisses only nested notice');
  await wait(()=>document.querySelector('[data-hq-readers]')?.textContent.includes('검수 본사'),'reader response');
  check(!note(),'reader refresh does not reopen dismissed notice');
  const n=qa.readRequests;closeModal();open();await wait(()=>document.querySelector('[data-approval-sheet]'),'cached reopening');
  check(document.querySelector('[data-hq-readers]').textContent.includes('검수 본사'),'cached reader names shown immediately');check(qa.readRequests===n,'reopening reuses response');
  check(note()?.open,'notice shown again on new opening');note().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));check(!note()&&!!document.querySelector('#modalRoot .modal'),'escape closes notice only');
  qa.viewed=true;window.dispatchEvent(new CustomEvent('enl-report-view-saved',{detail:{incidentId:'sample-1'}}));await wait(()=>document.querySelector('[data-hq-readers] time'),'forced refresh after first view');check(qa.readRequests===n+1,'view save refreshes cache');
  qa.failReads=true;window.dispatchEvent(new CustomEvent('enl-report-view-saved',{detail:{incidentId:'sample-1'}}));await wait(()=>document.querySelector('[data-hq-readers]')?.textContent.includes('확인 불가'),'failed refresh');check(!document.querySelector('[data-hq-readers]')?.textContent.includes('미조회'),'failure never claims unviewed');qa.failReads=false;
  closeModal();let i=data.incidents.find(x=>x.id==='sample-1');i.corrective={status:'submitted',planDetail:'등록 계획',submittedAt:'2026-11-01T00:00:00Z',actionDetail:'등록 조치'};open();await wait(()=>document.querySelector('[data-approval-sheet]'),'completed action open');check(!note(),'both plan and action registered suppress notice');
  closeModal();delete i.pastReport;open();await wait(()=>document.querySelector('[data-approval-sheet]'),'ordinary open');check(!note(),'ordinary accident has no transfer notice');closeModal();
  for(const type of ['property','person']){
   i=data.incidents.find(x=>x.id==='sample-1');i.category=type;i.safetyNote='기존 검토의견';
   enlEditIncidentInReportForm(i,currentUser());await wait(()=>el('safetyReviewNote410'),'review editor');
   check(el('safetyReviewNote410').value==='기존 검토의견',type+' current review prefilled');
   el('safetyReviewNote410').value='추가 확인 후 검토의견 정정';el('safetyFactEditReason').value='현장 확인사항 반영';qa.lastCorrection=null;
   el('unifiedReportForm').requestSubmit();await wait(()=>qa.lastCorrection,'save review');
   check(JSON.stringify(qa.lastCorrection.changes)==='{"safetyNote":"추가 확인 후 검토의견 정정"}','only review note submitted');
   await wait(()=>!el('unifiedReportForm'),'save complete');
   const saved=data.incidents.find(x=>x.id==='sample-1');check(saved.safetyNote==='추가 확인 후 검토의견 정정'&&saved.status==='approved','review persisted without workflow reset');
  }
  check(qa.errors.length===0,'no uncaught runtime errors');
  parent.postMessage({qa:profile,ok:true,checks:qa.results.length,results:qa.results},location.origin);
 }catch(e){parent.postMessage({qa:profile,ok:false,error:e.message,results:qa.results,dialogs:qa.dialogs,errors:qa.errors},location.origin);}
})();
