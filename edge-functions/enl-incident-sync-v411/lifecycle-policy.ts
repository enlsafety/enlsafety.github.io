// The server owns transitions and evidence. Browser state is never approval proof.
const text = (v:any) => String(v ?? '').trim();
const canonical = (v:any):any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])) : v;
const equal = (a:any,b:any) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
const fail = (message:string,status=409):never => {throw Object.assign(new Error(message),{httpStatus:status});};
const accepted = (i:any) => ['approved','closed'].includes(text(i?.status));
export function isHistoricalEditable(i:any) {
  if(!i||i.bulkInvalidation?.active===true)return false;
  return ['historical_manual','historical_transfer'].includes(text(i.recordMode))
    ||text(i?.historicalTransfer?.mode)==='historical_transfer'
    ||i.historicalImport?.enabled===true
    ||!!(text(i.historicalOrigin?.batchId)&&text(i.historicalOrigin?.candidateId)
      &&['verified','unverifiable'].includes(text(i.externalInitialApproval?.state)));
}
// Cause analysis belongs to safety, not the reporting site. Status is explicit and reviewable.
const causeFacts=['environmentCause','behaviorCause','causeAnalysisNote'];
const causeFields=[...causeFacts,'causeAnalysisStatus','causeAnalyzedBy','causeAnalyzedById','causeAnalyzedAt'];
function causeDetails(i:any){return i?.reportDetails&&typeof i.reportDetails==='object'&&!Array.isArray(i.reportDetails)?i.reportDetails:{};}
function isCauseReady(d:any){return text(d?.causeAnalysisStatus)==='investigating'||(text(d?.causeAnalysisStatus)==='analyzed'&&causeFacts.some(k=>text(d?.[k])));}
function normalizeCause(prev:any,next:any,actor:any,now:string){
  // Existing approved records and imported historical records are immutable here.
  // Their allowed corrections run through the append-only revision transaction.
  if((prev&&accepted(prev))||isHistoricalEditable(prev||next))return;
  const old=causeDetails(prev),out=causeDetails(next);
  next.reportDetails={...out};
  if(actor.role!=='safety'){
    for(const k of causeFields){
      if(Object.prototype.hasOwnProperty.call(old,k))next.reportDetails[k]=structuredClone(old[k]);
      else delete next.reportDetails[k];
    }
    if(!prev)next.reportDetails.causeAnalysisStatus='not_reviewed';
    return;
  }
  const status=text(out.causeAnalysisStatus);
  if(status&&!['not_reviewed','investigating','analyzed'].includes(status))fail('cause_status_invalid',400);
  if(status==='analyzed'&&!causeFacts.some(k=>text(out[k])))fail('cause_details_required',400);
  for(const key of causeFacts)if(text(out[key]).length>4000)fail('cause_details_too_long',400);
  const changed=causeFacts.some(k=>!equal(old[k],out[k]))||!equal(text(old.causeAnalysisStatus),status);
  if(changed&&['investigating','analyzed'].includes(status)){
    next.reportDetails.causeAnalyzedBy=actor.name;
    next.reportDetails.causeAnalyzedById=actor.id;
    next.reportDetails.causeAnalyzedAt=now;
  }else{
    for(const k of ['causeAnalyzedBy','causeAnalyzedById','causeAnalyzedAt']){
      if(Object.prototype.hasOwnProperty.call(old,k))next.reportDetails[k]=structuredClone(old[k]);
      else delete next.reportDetails[k];
    }
  }
}
const costKeys = ['medicalCost','repairCost','damageAmount'];
const planKeys = ['rootCause','causeStatus','planDetail','ownerName','dueDate','planBy','planById','planAt','planUpdatedBy','planUpdatedAt'];
const managedKeys = ['officialRecord','executiveApproval','acknowledgements','readReceipts','historicalOrigin','externalInitialApproval','bulkInvalidation','recordMode','historicalImport','historicalTransfer'];
const stampKeys = ['approvedBy','approvedAt','closedAt','registeredAt','reporterId','reporterName'];
const envelopeKeys = ['_syncBaseVersion','_syncVersion','_syncMutationId','updatedAt','lastModifiedBy','lastModifiedRole','lastModifiedPosition','lastModifiedAt'];
const workflowKeys = ['corrective','reportWorkflow','reviewHistory','lifecycleHistory','safetyNote','priority','prioritySource','prioritySetBy','prioritySetAt','legalReview'];
function reportFacts(i:any){const x=structuredClone(i||{});for(const k of [...managedKeys,...stampKeys,...envelopeKeys,...workflowKeys,'status'])delete x[k];return x;}
export function validateLifecycle(prev:any,next:any,actor:any,now:string){
  if(!['field','worker','safety'].includes(actor.role))fail('forbidden',403);
  if(actor.role!=='safety'&&text(next.siteId)!==text(actor.siteId))fail('site_forbidden',403);
  if(prev&&text(prev.siteId)!==text(next.siteId))fail('incident_site_locked');
  if(!prev){
    normalizeCause(null,next,actor,now);
    if(next.recordMode==='historical_manual'){
      if(actor.role!=='safety'||next.status!=='approved'||next.corrective)fail('manual_archive_safety_approval_required',403);
    }else if(next.recordMode||next.historicalImport||next.historicalOrigin||next.status!=='reported'||next.corrective)fail('initial_report_state_required');
    next.officialRecord={};next.acknowledgements=[];next.readReceipts=[];
    next.createdAt=now;next.registeredAt=now;next.closedAt=null;
    return {costChanges:[]};
  }
  for(const key of managedKeys)if(!equal(prev[key],next[key]))fail('server_record_locked');
  for(const key of stampKeys)if(!equal(prev[key],next[key])&&!(['approvedBy','approvedAt','closedAt'].includes(key)&&actor.role==='safety'&&prev.status!=='closed'))fail('approval_history_locked');
  if(prev.status==='closed')fail('closed_revision_required');
  if(prev.executiveApproval?.state==='pending')fail('executive_review_in_progress');
  normalizeCause(prev,next,actor,now);
  if(actor.role==='safety'&&!accepted(prev)&&next.status==='approved'&&!isHistoricalEditable(next)&&!isCauseReady(next.reportDetails))fail('cause_analysis_required',409);
  const costChanges:any[]=[];
  if(accepted(prev)){
    const comparable=structuredClone(next);
    comparable.reportDetails={...(next.reportDetails||{})};
    for(const key of costKeys){
      const before=prev.reportDetails?.[key],after=next.reportDetails?.[key];
      if(equal(before,after))continue;
      const pending=before===null||before===undefined||before===''||(Number(before)===0&&prev.reportDetails?.[key+'Pending']===true);
      if(!pending||!Number.isSafeInteger(after)||after<0||after>999999999999)fail('cost_addition_only');
      comparable.reportDetails[key]=before;
      if(prev.reportDetails?.[key+'Pending']===true){comparable.reportDetails[key+'Pending']=true;next.reportDetails[key+'Pending']=false;}
      costChanges.push({field:key,before:before??null,after,byId:actor.id,by:actor.name,at:now});
    }
    if(!equal(reportFacts(prev),reportFacts(comparable)))fail('approved_record_locked');
    if(!['approved','closed'].includes(next.status))fail('approved_state_locked');
  }
  const oldC=prev.corrective||{},c=next.corrective||{};
  if(!equal(oldC.submissions,c.submissions))fail('submission_history_locked',403);
  const actionFields=['actionDetail','actionDate','actionCompletedDate','completedDate','actionOwner','additionalNotes','afterPhotos','submittedBy','submittedById','submittedAt'];
  const snapshot=(record:any)=>Object.fromEntries(['submittedBy','submittedById','submittedAt','actionDetail','actionDate','actionCompletedDate','completedDate','actionOwner','additionalNotes','afterPhotos'].filter(k=>record[k]!==undefined).map(k=>[k,structuredClone(record[k])]));
  const appendHistory=(action:string,note:string)=>{c.reviewHistory=[...(oldC.reviewHistory||[]),{action,by:actor.name,byId:actor.id,at:now,note}];};
  if(actor.role!=='safety'){
    if(next.status!==prev.status&&!(prev.status==='supplement'&&next.status==='supplement_submitted')&&!(prev.status==='rejected'&&next.status==='reported'))fail('safety_approval_required',403);
    for(const key of ['safetyNote',...(accepted(prev)?['priority','prioritySource','prioritySetBy','prioritySetAt','legalReview']:[])])if(!equal(prev[key],next[key]))fail('safety_fields_locked',403);
    if(!accepted(prev)){
      if(prev.prioritySource==='manual')for(const key of ['priority','prioritySource','prioritySetBy','prioritySetAt'])next[key]=prev[key];
      else if(next.prioritySource==='manual'||text(next.prioritySetBy))fail('safety_fields_locked',403);
      next.reviewHistory=structuredClone(prev.reviewHistory||[]);
      if(!equal(reportFacts(prev),reportFacts(next))||prev.status!==next.status){
        next.resubmittedBy=actor.name;next.resubmittedById=actor.id;next.resubmittedAt=now;
        next.reviewHistory.push({action:'resubmitted',by:actor.name,byId:actor.id,at:now});
      }
    }else if(!equal(prev.reviewHistory,next.reviewHistory))fail('safety_fields_locked',403);
    if(!equal(oldC,c)){
      if(actor.role!=='field'||!['현장소장','파트장','서무'].includes(actor.position)||prev.status!=='approved')fail('field_action_forbidden',403);
      if(!text(oldC.planDetail)||!text(oldC.planAt))fail('prevention_plan_required');
      if(['submitted','approved'].includes(oldC.status))fail('action_review_in_progress');
      const allowed=new Set(['status','actionDetail','actionDate','actionCompletedDate','completedDate','actionOwner','additionalNotes','afterPhotos','actionBy','actionById','actionStartedAt','actionUpdatedAt','submittedBy','submittedById','submittedAt','reviewHistory']);
      for(const key of new Set([...Object.keys(oldC),...Object.keys(c)]))if(!allowed.has(key)&&!equal(oldC[key],c[key]))fail('prevention_plan_locked');
      if(!['in_progress','submitted'].includes(c.status))fail('action_transition_invalid');
      if(c.status==='submitted'&&(!text(c.actionDetail)||!/^\d{4}-\d{2}-\d{2}$/.test(text(c.actionDate))||!text(c.actionOwner)||!Array.isArray(c.afterPhotos)||!c.afterPhotos.length))fail('action_evidence_required');
      const today=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
      const validDay=(value:any)=>{const day=text(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const parsed=new Date(day+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day&&day<=today;};
      if(text(c.actionDate)&&!validDay(c.actionDate))fail('action_date_invalid',400);
      c.actionBy=oldC.actionBy||actor.name;c.actionById=oldC.actionById||actor.id;c.actionUpdatedAt=now;
      if(c.status==='submitted'){c.submittedBy=actor.name;c.submittedById=actor.id;c.submittedAt=now;}
      if(c.actionCompletedDate!==undefined&&text(c.actionCompletedDate)){
        if(!validDay(c.actionCompletedDate)||c.actionCompletedDate<text(c.actionDate))fail('action_completion_date_invalid',400);
      }
      if(c.status==='submitted'){
        const previous=structuredClone(oldC.submissions||[]);
        if(!previous.length&&oldC.submittedAt)previous.push(snapshot(oldC));
        c.submissions=[...previous,{...snapshot(c),requestNote:oldC.status==='rejected'?text(oldC.reviewNote):''}];
      }
      appendHistory(c.status==='submitted'?'prevention_action_submitted':'prevention_action_draft',text(c.actionDetail));
    }
  }else{
    if(!['reported','supplement','supplement_submitted','rejected','approved','closed'].includes(next.status))fail('invalid_report_state');
    if(!accepted(prev)&&next.corrective)fail('report_approval_required');
    if(next.status==='supplement'&&!text(next.supplement?.requestNote))fail('supplement_reason_required');
    if(next.status==='rejected'&&!text(next.rejectionNote))fail('review_reason_required');
    if(!equal(oldC,c)){
      if(c.status==='approved'||next.status==='closed'){
        if(oldC.status!=='submitted'||!text(oldC.actionDetail)||!(oldC.afterPhotos||[]).length)fail('submitted_action_required');
        for(const key of [...planKeys,...actionFields])if(!equal(oldC[key],c[key]))fail('submitted_evidence_locked');
        c.reviewedBy=actor.name;c.reviewedById=actor.id;c.reviewedAt=now;next.status='approved';next.closedAt=null;appendHistory('prevention_action_confirmed',text(c.reviewNote));
      }else if(c.status==='rejected'&&oldC.status==='submitted'){
        if(oldC.status!=='submitted'||!text(c.reviewNote))fail('action_review_reason_required');
        for(const key of [...planKeys,...actionFields])if(!equal(oldC[key],c[key]))fail('submitted_evidence_locked');
        c.reviewedBy=actor.name;c.reviewedById=actor.id;c.reviewedAt=now;appendHistory('prevention_action_rejected',text(c.reviewNote));
      }else if(['planned','in_progress'].includes(c.status)||(c.status==='rejected'&&oldC.status==='rejected')){
        if(['submitted','approved'].includes(oldC.status))fail('action_review_in_progress');
        for(const key of [...actionFields,'reviewedBy','reviewedById','reviewedAt','reviewNote'])if(!equal(oldC[key],c[key]))fail('submitted_evidence_locked');
        if(!text(c.rootCause)||!text(c.planDetail)||!text(c.ownerName)||!/^\d{4}-\d{2}-\d{2}$/.test(text(c.dueDate)))fail('plan_fields_required');
        c.planBy=oldC.planBy||actor.name;c.planById=oldC.planById||actor.id;c.planAt=oldC.planAt||now;c.planUpdatedBy=actor.name;c.planUpdatedAt=now;appendHistory(oldC.planAt?'prevention_plan_updated':'prevention_plan_registered',text(c.planDetail));
      }else fail('action_transition_invalid');
    }
    if(next.status==='closed'&&!(oldC.status==='submitted'&&c.status==='approved'))fail('submitted_action_required');
  }
  if(next.corrective)next.corrective=c;
  return {costChanges};
}
export function correctedIncident(prev:any,changes:any,reason:string,actor:any,now:string){
  if(actor.role!=='safety')fail('forbidden',403);
  const historical=isHistoricalEditable(prev);
  if(!accepted(prev))fail('approved_or_closed_required');
  if(prev.executiveApproval?.state==='pending')fail('executive_review_in_progress');
  if(!text(reason)||text(reason).length>2000)fail('revision_reason_required',400);
  const allowed=new Set(['summary','occurredAt','eventType','category','injuredName','injuredAge','injuredGender','injuredPart','injuryType','job','severity','potentialMajor','leaveEstimate','immediateAction','reportDetails','photos','corrective',...(historical?['historicalImport']:[])]);
  const correctiveAllowed=new Set(['rootCause','causeStatus','planDetail','ownerName','dueDate','actionDetail','actionDate','actionOwner','additionalNotes','afterPhotos']);
  const historicalDetails=new Set(['place','workAction','incidentHow','environmentCause','behaviorCause','injuredName','workerName','job','injuryDetail','diagnosis','doctorOpinion','medicalCost','medicalCostPending','medicalCostDetail','repairCost','repairCostPending','repairCostDetail','damagedItem','damageDetail','preventionPlan','specialNote','causeAnalysisStatus','causeAnalysisNote']);
  const historicalMeta=new Set(['originalReporterName','erpApprovalRef','erpApprovalDate','existingActionNote','additionalActionNote','existingActionStatus']);
  const next=structuredClone(prev),diff:any[]=[];
  if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('invalid_changes',400);
  for(const [key,value] of Object.entries(changes)){
    if(!allowed.has(key))fail('revision_field_forbidden',400);

    if(key==='historicalImport'){
      if(!historical||!prev.historicalImport||!value||typeof value!=='object'||Array.isArray(value))fail('revision_field_forbidden',400);
      for(const [k,v] of Object.entries(value)){
        if(!historicalMeta.has(k))fail('revision_field_forbidden',400);
        if(k==='existingActionStatus'&&!['confirmed','partial','not_available'].includes(text(v)))fail('revision_field_forbidden',400);
        if(k==='erpApprovalDate'&&text(v)!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(text(v)))fail('revision_field_forbidden',400);
        if(text(v).length>4000)fail('revision_field_forbidden',400);
        if(!equal(prev.historicalImport[k],v)){
          next.historicalImport={...next.historicalImport,[k]:v};
          diff.push({field:'historicalImport.'+k,before:prev.historicalImport[k]??null,after:v});
          const mirror:any={originalReporterName:'originalReporterName',erpApprovalRef:'erpReference',erpApprovalDate:'erpApprovalDate',existingActionNote:'existingActionSummary'};
          if(mirror[k]&&next.historicalTransfer)next.historicalTransfer={...next.historicalTransfer,[mirror[k]]:v};
        }
      }
    }else if(key==='reportDetails'){
      if(!value||typeof value!=='object'||Array.isArray(value))fail('invalid_changes',400);
      const updated={...(prev.reportDetails||{})};
      for(const [k,v] of Object.entries(value)){
        if(equal(prev.reportDetails?.[k],v))continue;
        if(!historicalDetails.has(k))fail('revision_field_forbidden',400);
        if(causeFacts.includes(k)&&text(v).length>4000)fail('cause_details_too_long',400);
        if(k.endsWith('CostPending')){
          if(typeof v!=='boolean')fail('invalid_cost',400);
          const amount=(value as any)[k.replace('Pending','')]??updated[k.replace('Pending','')];
          if(v===true&&Number(amount)>0)fail('invalid_cost',400);
        }
        updated[k]=v;
        if(costKeys.includes(k)&&v!==null&&v!==undefined&&v!==''&&!(Number(v)===0&&(value as any)[k+'Pending']===true))updated[k+'Pending']=false;
      }
      const changedCause=causeFacts.some(k=>!equal(prev.reportDetails?.[k],updated[k]))||!equal(prev.reportDetails?.causeAnalysisStatus,updated.causeAnalysisStatus);
      if(changedCause){
        const statusChangedExplicitly=Object.prototype.hasOwnProperty.call(value,'causeAnalysisStatus');
        // Legacy historical material may be corrected without retroactively
        // claiming that today's safety analysis took place in the past.
        // If the editor explicitly supplies a review status, always validate it.
        if(!historical||statusChangedExplicitly){
          if(!['investigating','analyzed'].includes(text(updated.causeAnalysisStatus)))fail('cause_analysis_required',400);
          if(!isCauseReady(updated))fail('cause_details_required',400);
          updated.causeAnalyzedBy=actor.name;
          updated.causeAnalyzedById=actor.id;
          updated.causeAnalyzedAt=now;
        }
      }
      if(!equal(prev.reportDetails,updated)){
        diff.push({field:'reportDetails',before:prev.reportDetails??null,after:updated});
        next.reportDetails=updated;
      }
    }else if(key==='corrective'){
      if(!prev.corrective||!value||typeof value!=='object'||Array.isArray(value))fail('invalid_corrective_revision',400);
      for(const [k,v] of Object.entries(value)){if(!correctiveAllowed.has(k))fail('revision_field_forbidden',400);if(!equal(prev.corrective[k],v)){diff.push({field:'corrective.'+k,before:prev.corrective[k]??null,after:v});next.corrective[k]=v;}}
    }else if(!equal(prev[key],value)){diff.push({field:key,before:prev[key]??null,after:value});next[key]=value;}
  }
  if(changes.summary!==undefined&&prev.summary===prev.reportDetails?.generatedSummary){
    next.reportDetails={...next.reportDetails,generatedSummary:next.summary};
    const detailDiff=diff.find(d=>d.field==='reportDetails');if(detailDiff)detailDiff.after=next.reportDetails;
    else diff.push({field:'reportDetails',before:prev.reportDetails??null,after:next.reportDetails});
  }
  if(changes.severity!==undefined&&!['minor','moderate','major'].includes(changes.severity))fail('revision_field_forbidden',400);
  if(changes.potentialMajor!==undefined&&typeof changes.potentialMajor!=='boolean')fail('revision_field_forbidden',400);
  if(!diff.length)fail('no_changes',400);
  if(!text(next.summary)||!Number.isFinite(Date.parse(next.occurredAt)))fail('report_fields_required',400);
  if(diff.some(d=>d.field==='occurredAt')){
    const when=new Date(next.occurredAt);
    if(typeof next.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(next.occurredAt)||!Number.isFinite(when.getTime())||when.getUTCFullYear()<1900)fail('invalid_occurrence_date',400);
    if(when.getTime()>Date.now()+60000)fail('future_occurrence_invalid',400);
    const seoul=new Date(when.getTime()+9*3600000).toISOString(),day=seoul.slice(0,10),time=seoul.slice(11,16);
    // Historical reports keep copied occurrence date/time fields for listings and ERP evidence.
    if(next.historicalTransfer&&Object.prototype.hasOwnProperty.call(next.historicalTransfer,'occurredDate')){
      const known=next.historicalTransfer.occurredTimeKnown!==false;
      next.historicalTransfer={...next.historicalTransfer,occurredDate:day,occurredTime:known?time:''};
    }
    if(Object.prototype.hasOwnProperty.call(next,'occurredDate'))next.occurredDate=day;
    if(Object.prototype.hasOwnProperty.call(next,'occurredTime'))next.occurredTime=next.occurrenceTimeKnown===false?null:time;
    // Only refresh the old automated summary date. Manually authored text is never overwritten.
    if(!Object.prototype.hasOwnProperty.call(changes,'summary')&&
       typeof prev.summary==='string'&&prev.summary===prev.reportDetails?.generatedSummary&&
       /^\[사고 개요\]\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(prev.summary)){
      const year=+day.slice(0,4),month=+day.slice(5,7),date=+day.slice(8,10);
      const replacement=prev.summary.replace(/^(\[사고 개요\]\s*)\d{4}년\s*\d{1,2}월\s*\d{1,2}일(?:\s*\d{1,2}:\d{2}경)?/,
        (_m,prefix)=>prefix+year+'년 '+month+'월 '+date+'일 '+time+'경');
      if(replacement!==prev.summary){
        next.summary=replacement;
        diff.push({field:'summary',before:prev.summary,after:replacement});
        const previousDetail=next.reportDetails||{};
        next.reportDetails={...previousDetail,generatedSummary:replacement};
        const changed=diff.find(d=>d.field==='reportDetails');
        if(changed)changed.after=next.reportDetails;
        else diff.push({field:'reportDetails',before:prev.reportDetails??null,after:next.reportDetails});
      }
    }
  }
  for(const key of costKeys){const v=next.reportDetails?.[key];if(v!==null&&v!==undefined&&v!==''&&(!Number.isSafeInteger(v)||v<0))fail('invalid_cost',400);}
  const revision=Number(prev.officialRecord?.revisionNumber||0)+1;
  const affectsAction=diff.some(x=>x.field.startsWith('corrective.')||['summary','occurredAt','eventType','category','reportDetails','immediateAction','injuredName','injuredAge','injuredPart','injuryType','job','severity','potentialMajor','leaveEstimate'].includes(x.field));
  next.officialRecord={...prev.officialRecord,revisionNumber:revision,lastCorrection:{reason:text(reason),byId:actor.id,by:actor.name,at:now,revision},actionRecheckRequired:affectsAction||prev.officialRecord?.actionRecheckRequired===true,erpCorrectionRequired:!!prev.officialRecord?.erpManual?.submitted||prev.officialRecord?.erpCorrectionRequired===true};
  return {next,diff,revision};
}
