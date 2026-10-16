'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();let checks=0;
 const yes=(v,msg)=>{assert.ok(v,msg);checks++};
 const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++};
 let i;
 try{
   const first={id:'qa-cause-analysis',siteId:'qa-site',status:'reported',category:'property',
     summary:'가상 사업장 카트 충돌',eventType:'접촉',occurredAt:'2026-10-12T03:00:00Z',
     reportDetails:{incidentHow:'카트가 시설물에 접촉',environmentCause:'현장 직원이 주장한 원인',behaviorCause:'부주의 단정',causeAnalysisStatus:'analyzed',causeAnalysisNote:'불확실한 결론'},photos:[],corrective:null,_syncBaseVersion:0,_syncMutationId:'qa-first-cause'};
   let r=await f.call('field',{action:'push',incidents:[first]});
   eq(r.status,200,'initial field report');i=r.body.incidents[0];
   eq(i.reportDetails.causeAnalysisStatus,'not_reviewed','site initial status sanitized');
   eq(i.reportDetails.environmentCause,undefined,'site environmental statement discarded');
   eq(i.reportDetails.behaviorCause,undefined,'site behavioral statement discarded');
   eq(i.reportDetails.causeAnalysisNote,undefined,'site causation statement discarded');
   const push=async(role,modify)=>{
     const next=structuredClone(i);modify(next);next._syncBaseVersion=i._syncVersion;next._syncMutationId=crypto.randomUUID();
     const res=await f.call(role,{action:'push',incidents:[next]});
     if(res.status===200&&res.body.incidents[0])i=res.body.incidents[0];
     return res;
   };
   r=await push('safety',x=>{x.status='approved'});eq(r.status,409,'approval without analysis choice blocked');eq(r.body.message,'cause_analysis_required','specific approval feedback');
   r=await push('safety',x=>{x.status='approved';x.reportDetails.causeAnalysisStatus='analyzed'});eq(r.status,400,'analyzed without evidence blocked');
   r=await push('field',x=>{x.summary='현장 보완된 사고경위';x.reportDetails.causeAnalysisStatus='analyzed';x.reportDetails.behaviorCause='작업자 과실 단정';});
   eq(r.status,200,'field factual resubmission permitted');eq(i.reportDetails.causeAnalysisStatus,'not_reviewed','field cannot approve analysis');eq(i.reportDetails.behaviorCause,undefined,'field cause tamper discarded');
   r=await push('safety',x=>{x.reportDetails.causeAnalysisStatus='investigating';});
   eq(r.status,200,'safety can mark investigation pending without guessed cause');
   eq(i.reportDetails.causeAnalysisStatus,'investigating','investigation state saved');
   eq(i.reportDetails.causeAnalyzedBy,'QA 안전','server records reviewer');yes(Number.isFinite(Date.parse(i.reportDetails.causeAnalyzedAt)),'server records analysis timestamp');
   const already=i.reportDetails.causeAnalyzedAt;
   r=await push('field',x=>{x.summary+=' · 추가 사실';x.reportDetails.causeAnalysisStatus='analyzed';x.reportDetails.environmentCause='조작된 환경';x.reportDetails.causeAnalyzedBy='가짜';});
   eq(r.status,200,'new factual content from field allowed');eq(i.reportDetails.causeAnalysisStatus,'investigating','field cannot change pending status');eq(i.reportDetails.environmentCause,undefined,'field cannot write environmental cause');eq(i.reportDetails.causeAnalyzedBy,'QA 안전','field cannot impersonate analyst');
   r=await push('safety',x=>{x.status='approved';x.approvedAt='1999-01-01';x.approvedBy='client';});
   eq(r.status,200,'approved with pending investigation');eq(i.status,'approved','status approved');eq(i.reportDetails.causeAnalysisStatus,'investigating','pending kept on approved');eq(i.reportDetails.causeAnalyzedAt,already,'approval does not fabricate another analysis');
   const approval={by:i.approvedBy,at:i.approvedAt};
   r=await push('safety',x=>{x.reportDetails.causeAnalysisStatus='analyzed';x.reportDetails.environmentCause='승인 이후 확인';});
   eq(r.status,409,'ordinary push cannot change approved cause');
   const correct=(role,patch,reason='현장 재조사에 따른 사실관계 정정',other={})=>f.call(role,{action:'correct_closed',incidentId:i.id,expectedVersion:i._syncVersion,mutationId:crypto.randomUUID(),changes:{reportDetails:patch},reason,...other});
   r=await correct('safety',{causeAnalysisStatus:'analyzed'});eq(r.status,400,'no confirmed cause cannot be saved after approval');
   r=await correct('field',{environmentCause:'임의 수정',causeAnalysisStatus:'investigating'});eq(r.status,403,'field cannot make audited correction');
   const before=structuredClone(i),newCause={environmentCause:'시설물 위치 확인 절차 미흡',behaviorCause:'작업 전 회전반경 확인 누락 확인',causeAnalysisNote:'현장 사진 및 진술 대조 후 정리',causeAnalysisStatus:'analyzed'};
   r=await correct('safety',newCause);assert.equal(r.status,200,JSON.stringify(r));checks++;i=r.body.incident;
   eq(i.status,'approved','revision preserves approved status');eq(i.approvedBy,approval.by,'approver immutable');eq(i.approvedAt,approval.at,'approval date immutable');
   eq(i.reportDetails.environmentCause,newCause.environmentCause,'environment persisted');eq(i.reportDetails.behaviorCause,newCause.behaviorCause,'behavior persisted');eq(i.reportDetails.causeAnalysisNote,newCause.causeAnalysisNote,'root note persisted');eq(i.reportDetails.causeAnalysisStatus,'analyzed','confirmed state persisted');eq(i.reportDetails.causeAnalyzedBy,'QA 안전','corrected by server authenticated safety');
   eq(i.officialRecord.revisionNumber,1,'revision counter incremented');eq(i.officialRecord.actionRecheckRequired,true,'preventive followup requires recheck');
   const rows=(await f.db.query('select before_payload,after_payload,changes,reason from enl_incident_revisions where incident_id=$1',[i.id])).rows;
   eq(rows.length,1,'one audit row');eq(rows[0].before_payload.reportDetails.causeAnalysisStatus,'investigating','audit old status');eq(rows[0].after_payload.reportDetails.causeAnalysisStatus,'analyzed','audit new status');
   eq(rows[0].reason,'현장 재조사에 따른 사실관계 정정','revision reason saved');
   const replay=(await f.call('safety',{action:'pull'})).body.incidents.find(x=>x.id===i.id);
   eq(replay.reportDetails.environmentCause,newCause.environmentCause,'persisted after DB reload');
   const history=await f.call('manager',{action:'revision_list',incidentId:i.id});eq(history.status,200,'authorized history visible');eq(history.body.revisions.length,1,'history readable');
   eq(history.body.revisions[0].changes[0].field,'reportDetails','reportDetails revision recorded');
   const oldVersion=before._syncVersion;
   r=await correct('safety',{causeAnalysisStatus:'investigating'},'재조사 착수',{expectedVersion:oldVersion});eq(r.status,409,'stale revision guarded');
   eq(Number((await f.db.query("select count(*)::int n from enl_incident_revisions")).rows[0].n),1,'conflicting attempt created no revision');
   const official=fs.readFileSync('official-records-v439.js','utf8'),excel=fs.readFileSync('incident-excel-v421.js','utf8');
   assert.equal(official.split("'분석상태: '+causeStatus").length-1,2,'official UI and printed PDF both show cause review status');checks++;
   assert.ok(official.includes("d.causeAnalysisNote?'기타·종합 원인: '"),'official record displays other confirmed cause');checks++;
   for(const token of ["'분석상태 / 담당'","'기타·종합 원인'","stamp(d.causeAnalyzedBy,d.causeAnalyzedAt)"])assert.ok(excel.includes(token),'Excel cause evidence '+token);
   checks+=3;
   console.log('PASS safety cause analysis: '+checks+' checks, role isolation, mandatory review, pending approval, audited correction, DB re-read');
 }finally{await f.db.close();}
})().catch(err=>{console.error(err);process.exitCode=1});