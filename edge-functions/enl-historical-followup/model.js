// Pure server-side policy. Never writes the linked incident.
export const states={requested:'조치요구',in_progress:'현장조치중',submitted:'조치결과 제출',revision_requested:'보완요청',completed:'개선조치 완료'};
export const fieldAllowed=a=>a?.role==='field'&&['현장소장','파트장','서무'].includes(a.position);
export const canRead=(a,row)=>['safety','manager','executive'].includes(a?.role)||(fieldAllowed(a)&&a.siteId===row.siteId);
export const historical=i=>i?.status==='closed'&&(i.recordMode==='historical_transfer'||i.historicalTransfer?.mode==='historical_transfer'||i.historicalImport?.enabled===true);
const fail=m=>{throw new Error(m)};
const text=(v,n=6000)=>{const s=String(v??'').trim();if(s.length>n)fail('입력 내용이 너무 깁니다.');return s};
const required=(v,n)=>text(v,n)||fail('필수 항목을 입력해 주세요.');
export function date(v){const s=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)fail('날짜를 확인해 주세요.');return s}
export const day=now=>new Date(now).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
function files(v){if(!Array.isArray(v))return [];if(v.length>12)fail('첨부는 항목별 12개까지 가능합니다.');return v.map(f=>({path:required(f.path,500),name:required(f.name,160),mime:required(f.mime,80),size:Number(f.size),kind:f.mime.startsWith('image/')?'image':'pdf'}))}
export function transition(prev,input,a,now){
 const action=input.action;
 if(action==='create'){
  if(a.role!=='safety')fail('forbidden');
  if(!['normal','important','urgent'].includes(input.priority))fail('중요도를 선택해 주세요.');
  const due=date(input.dueDate);if(due<day(now))fail('완료기한은 요구일 이후로 선택해 주세요.');
  return {id:input.id,incidentId:required(input.incidentId,160),siteId:required(input.siteId,160),title:required(input.title,200),reason:required(input.reason),requirement:required(input.requirement),priority:input.priority,assigneeId:text(input.assigneeId,160),assigneeName:text(input.assigneeName,100),requestedById:a.id,requestedByName:a.name,requestedAt:now,dueDate:due,status:'requested',requestAttachments:files(input.requestAttachments),note:text(input.note),fieldAction:null,review:null,createdAt:now,updatedAt:now,version:1};
 }
 if(!canRead(a,prev))fail('forbidden');
 if(prev.status==='completed')fail('완료된 조치는 수정할 수 없습니다.');
 if(Number(input.version)!==prev.version)fail('conflict');
 const next=structuredClone(prev);next.version++;next.updatedAt=now;
 if(['start','save','submit'].includes(action)){
  if(!fieldAllowed(a)||a.siteId!==prev.siteId)fail('forbidden');
  if(action==='start'){if(prev.status!=='requested')fail('invalid_transition');next.status='in_progress';return next}
  if(!['in_progress','revision_requested'].includes(prev.status))fail('invalid_transition');
  const f=input.fieldAction||{};next.fieldAction={actionText:text(f.actionText),actionDate:f.actionDate?date(f.actionDate):'',actorName:text(f.actorName,100),beforeAttachments:files(f.beforeAttachments),afterAttachments:files(f.afterAttachments),attachments:files(f.attachments),note:text(f.note),submittedById:prev.fieldAction?.submittedById||'',submittedByName:prev.fieldAction?.submittedByName||'',submittedAt:prev.fieldAction?.submittedAt||null};
  if(next.fieldAction.actionDate&&next.fieldAction.actionDate>day(now))fail('조치일은 미래 날짜일 수 없습니다.');
  if(next.fieldAction.actionDate&&next.fieldAction.actionDate<day(prev.requestedAt))fail('조치일은 이번 요구일 이후의 실제 조치일을 입력해 주세요.');
  if(action==='submit'){
   required(next.fieldAction.actionText);required(next.fieldAction.actorName);date(next.fieldAction.actionDate);
   if(!next.fieldAction.afterAttachments.some(f=>f.kind==='image'))fail('조치 후 사진을 첨부해 주세요.');
   Object.assign(next.fieldAction,{submittedById:a.id,submittedByName:a.name,submittedAt:now});next.status='submitted';
  }
  return next;
 }
 if(['revision','complete'].includes(action)){
  if(a.role!=='safety')fail('forbidden');if(prev.status!=='submitted')fail('invalid_transition');
  const note=action==='revision'?required(input.reviewNote):text(input.reviewNote);
  if(action==='revision'&&input.dueDate){const due=date(input.dueDate);if(due<day(now))fail('재제출기한을 확인해 주세요.');next.dueDate=due}
  next.review={decision:action,note,reviewerId:a.id,reviewerName:a.name,reviewedAt:now};next.status=action==='complete'?'completed':'revision_requested';return next;
 }
 fail('invalid_action');
}
export function eventKind(action){return ({create:'historical_followup_requested',submit:'historical_followup_submitted',revision:'historical_followup_revision',complete:'historical_followup_completed'})[action]||null}
export function attachments(row){return [...row.requestAttachments||[],...row.fieldAction?.beforeAttachments||[],...row.fieldAction?.afterAttachments||[],...row.fieldAction?.attachments||[]]}
