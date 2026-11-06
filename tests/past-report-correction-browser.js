// Run inside the isolated full-app fixture with qa-past-boot.js (all network mocked).
(async()=>{
 const profile=new URLSearchParams(location.search).get('qa');
 const check=(v,m)=>{if(!v)throw Error(m);qa.results.push('PASS '+m)};
 const wait=async(fn,label)=>{const end=Date.now()+7000;while(!fn()){if(Date.now()>end)throw Error('timeout '+label+' '+JSON.stringify(qa.dialogs));await new Promise(r=>setTimeout(r,20))}};
 const el=id=>document.getElementById(id);
 const enter=(id,value)=>{const input=el(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
 try{
 await wait(()=>typeof enlEditIncidentInReportForm==='function'&&data.incidents.length,'app boot');
 if(profile==='visual'){enlEditIncidentInReportForm(data.incidents[0],currentUser());return}
 for(const type of ['property','person']){
  const i=data.incidents.find(x=>x.id==='sample-1');i.category=type;i.pastReport={drafterName:'당시 소장',safetyManagerName:'당시 안전'};
  enlEditIncidentInReportForm(i,currentUser());await wait(()=>el('pastReportDrafter'),'edit form');
  check(el('pastReportDrafter').value==='당시 소장'&&el('pastReportSafety').value==='당시 안전',type+' existing names prefilled');
  check(el('pastReportMode').checked&&el('pastReportMode').disabled,'existing historical mode cannot be removed');
  check(!el('pastReportDrafter').disabled&&el('pastReportDrafter').required&&el('pastReportDrafter').maxLength===80,'name editable required bounded');
  enter('pastReportDrafter','');check(!el('pastReportDrafter').checkValidity(),'blank name blocked');
  enter('pastReportDrafter','수정한 소장');enter('pastReportSafety','수정한 안전');enter('safetyFactEditReason','원자료 재확인 후 담당자 정정');
  check(document.documentElement.scrollWidth<=innerWidth+1,'no horizontal page overflow');
  qa.lastCorrection=null;el('unifiedReportForm').requestSubmit();await wait(()=>qa.lastCorrection,'correction request');
  check(JSON.stringify(Object.keys(qa.lastCorrection.changes))==='["pastReport"]','only historical names changed');
  check(qa.lastCorrection.reason==='원자료 재확인 후 담당자 정정','reason sent');
  await wait(()=>!el('unifiedReportForm'),'save finished');
  const saved=data.incidents.find(x=>x.id===i.id);check(saved.status==='approved','approval preserved');
  enlEditIncidentInReportForm(saved,currentUser());await wait(()=>el('pastReportDrafter'),'reopen');
  check(el('pastReportDrafter').value==='수정한 소장'&&el('pastReportSafety').value==='수정한 안전','saved names reload');
  const summary=enlCumulativeReportHtml(saved,{presentation:'screen',includeOriginal:true});check(summary.includes('수정한 소장')&&summary.includes('수정한 안전'),'prevention cumulative report shows corrected historical names');
  const sheet=ENLApprovalSheet.render(saved);check(sheet.includes('수정한 소장')&&sheet.includes('수정한 안전'),'approval sheet fallback shows historical people');
  const actual=ENLApprovalSheet.render({...saved,corrective:{...saved.corrective,planBy:'현재 안전',submittedBy:'현재 소장',submittedAt:'2026-11-06T00:00:00Z'}});check(actual.includes('현재 소장')&&actual.includes('현재 안전')&&!actual.includes('수정한 소장'),'actual action actors take precedence');
 }
 const plain={...data.incidents[0],pastReport:undefined};enlEditIncidentInReportForm(plain,currentUser());check(!el('pastReportDrafter'),'ordinary existing report cannot become historical');
 enlOpenIncidentReport('property',currentUser());check(!el('pastReportMode').checked&&el('pastReportDrafter').disabled,'new report mode remains opt in');el('pastReportMode').click();check(!el('pastReportDrafter').disabled,'new historical registration still works');
 check(qa.errors.length===0,'no uncaught browser errors');
 parent.postMessage({qa:profile,ok:true,checks:qa.results.length,results:qa.results},location.origin);
 }catch(e){parent.postMessage({qa:profile,ok:false,error:e.message,results:qa.results,dialogs:qa.dialogs,errors:qa.errors},location.origin)}
})();
