// The server owns transitions and evidence. Browser state is never approval proof.
const text = (v:any) => String(v ?? '').trim();
const canonical = (v:any):any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])) : v;
const equal = (a:any,b:any) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
const fail = (message:string,status=409):never => {throw Object.assign(new Error(message),{httpStatus:status});};
const accepted = (i:any) => ['approved','closed'].includes(text(i?.status));
const costKeys = ['medicalCost','repairCost','damageAmount'];
const planKeys = ['rootCause','causeStatus','planDetail','ownerName','dueDate','planBy','planById','planAt','planUpdatedBy','planUpdatedAt'];
const managedKeys = ['officialRecord','acknowledgements','readReceipts','historicalOrigin','externalInitialApproval','bulkInvalidation','recordMode','historicalImport','historicalTransfer'];
const stampKeys = ['approvedBy','approvedAt','closedAt','registeredAt','reporterId','reporterName'];
const envelopeKeys = ['_syncBaseVersion','_syncVersion','_syncMutationId','updatedAt','lastModifiedBy','lastModifiedRole','lastModifiedPosition','lastModifiedAt'];
const workflowKeys = ['corrective','reportWorkflow','reviewHistory','lifecycleHistory','safetyNote','priority','prioritySource','prioritySetBy','prioritySetAt','legalReview'];
function reportFacts(i:any){const x=structuredClone(i||{});for(const k of [...managedKeys,...stampKeys,...envelopeKeys,...workflowKeys,'status'])delete x[k];return x;}
export function validateLifecycle(prev:any,next:any,actor:any,now:string){
  if(!['field','worker','safety'].includes(actor.role))fail('forbidden',403);
  if(actor.role!=='safety'&&text(next.siteId)!==text(actor.siteId))fail('site_forbidden',403);
  if(prev&&text(prev.siteId)!==text(next.siteId))fail('incident_site_locked');
  if(!prev){
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
      const allowed=new Set(['status','actionDetail','actionDate','actionOwner','additionalNotes','afterPhotos','actionBy','actionById','actionStartedAt','actionUpdatedAt','submittedBy','submittedById','submittedAt','reviewHistory']);
      for(const key of new Set([...Object.keys(oldC),...Object.keys(c)]))if(!allowed.has(key)&&!equal(oldC[key],c[key]))fail('prevention_plan_locked');
      if(!['in_progress','submitted'].includes(c.status))fail('action_transition_invalid');
      if(c.status==='submitted'&&(!text(c.actionDetail)||!/^\d{4}-\d{2}-\d{2}$/.test(text(c.actionDate))||!text(c.actionOwner)||!Array.isArray(c.afterPhotos)||!c.afterPhotos.length))fail('action_evidence_required');
      c.actionBy=oldC.actionBy||actor.name;c.actionById=oldC.actionById||actor.id;c.actionUpdatedAt=now;
      if(c.status==='submitted'){c.submittedBy=actor.name;c.submittedById=actor.id;c.submittedAt=now;}
      c.reviewHistory=oldC.reviewHistory||[];
    }
  }else{
    if(!['reported','supplement','supplement_submitted','rejected','approved','closed'].includes(next.status))fail('invalid_report_state');
    if(!accepted(prev)&&next.corrective)fail('report_approval_required');
    if(next.status==='supplement'&&!text(next.supplement?.requestNote))fail('supplement_reason_required');
    if(next.status==='rejected'&&!text(next.rejectionNote))fail('review_reason_required');
    if(!equal(oldC,c)){
      if(c.status==='approved'||next.status==='closed'){
        if(oldC.status!=='submitted'||!text(oldC.actionDetail)||!(oldC.afterPhotos||[]).length)fail('submitted_action_required');
        for(const key of [...planKeys,'actionDetail','actionDate','actionOwner','additionalNotes','afterPhotos','submittedBy','submittedById','submittedAt'])if(!equal(oldC[key],c[key]))fail('submitted_evidence_locked');
        c.reviewedBy=actor.name;c.reviewedById=actor.id;c.reviewedAt=now;next.status='closed';next.closedAt=now;
      }else if(c.status==='rejected'){
        if(oldC.status!=='submitted'||!text(c.reviewNote))fail('action_review_reason_required');
        c.reviewedBy=actor.name;c.reviewedById=actor.id;c.reviewedAt=now;
      }else if(['planned','in_progress'].includes(c.status)){
        if(['submitted','approved'].includes(oldC.status))fail('action_review_in_progress');
        if(!text(c.rootCause)||!text(c.planDetail)||!text(c.ownerName)||!/^\d{4}-\d{2}-\d{2}$/.test(text(c.dueDate)))fail('plan_fields_required');
        c.planBy=oldC.planBy||actor.name;c.planById=oldC.planById||actor.id;c.planAt=oldC.planAt||now;c.planUpdatedBy=actor.name;c.planUpdatedAt=now;
      }else fail('action_transition_invalid');
    }
    if(next.status==='closed'&&!(oldC.status==='submitted'&&c.status==='approved'))fail('submitted_action_required');
  }
  if(next.corrective)next.corrective=c;
  return {costChanges};
}
export function correctedIncident(prev:any,changes:any,reason:string,actor:any,now:string){
  if(actor.role!=='safety')fail('forbidden',403);
  if(prev.status!=='closed')fail('closed_incident_required');
  if(!text(reason)||text(reason).length>2000)fail('revision_reason_required',400);
  const allowed=new Set(['summary','occurredAt','eventType','category','injuredName','injuredAge','injuredGender','injuredPart','injuryType','leaveEstimate','immediateAction','reportDetails','photos','corrective']);
  const correctiveAllowed=new Set(['rootCause','causeStatus','planDetail','ownerName','dueDate','actionDetail','actionDate','actionOwner','additionalNotes','afterPhotos']);
  const next=structuredClone(prev),diff:any[]=[];
  if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('invalid_changes',400);
  for(const [key,value] of Object.entries(changes)){
    if(!allowed.has(key))fail('revision_field_forbidden',400);
    if(key==='corrective'){
      if(!prev.corrective||!value||typeof value!=='object'||Array.isArray(value))fail('invalid_corrective_revision',400);
      for(const [k,v] of Object.entries(value)){if(!correctiveAllowed.has(k))fail('revision_field_forbidden',400);if(!equal(prev.corrective[k],v)){diff.push({field:'corrective.'+k,before:prev.corrective[k]??null,after:v});next.corrective[k]=v;}}
    }else if(!equal(prev[key],value)){diff.push({field:key,before:prev[key]??null,after:value});next[key]=value;}
  }
  if(!diff.length)fail('no_changes',400);
  if(!text(next.summary)||!Number.isFinite(Date.parse(next.occurredAt)))fail('report_fields_required',400);
  for(const key of costKeys){const v=next.reportDetails?.[key];if(v!==null&&v!==undefined&&v!==''&&(!Number.isSafeInteger(v)||v<0))fail('invalid_cost',400);}
  const revision=Number(prev.officialRecord?.revisionNumber||0)+1;
  const affectsAction=diff.some(x=>x.field.startsWith('corrective.')||['summary','occurredAt','eventType','category','reportDetails'].includes(x.field));
  next.officialRecord={...prev.officialRecord,revisionNumber:revision,lastCorrection:{reason:text(reason),byId:actor.id,by:actor.name,at:now,revision},actionRecheckRequired:affectsAction||prev.officialRecord?.actionRecheckRequired===true,erpCorrectionRequired:!!prev.officialRecord?.erpManual?.submitted||prev.officialRecord?.erpCorrectionRequired===true};
  return {next,diff,revision};
}
