/* Shared deterministic document interpretation. No generative facts or paid API. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.ENLHistoricalBulk=api;})(globalThis,function(){
'use strict';
const text=v=>String(v??'').trim(), norm=v=>text(v).replace(/\s+/g,'').toLowerCase();
const fields={siteName:['사업장','사업장명','현장명'],occurredDate:['발생일','사고일','발생날짜','사고발생일'],occurredTime:['발생시간','사고시간'],category:['사고구분','대인대물'],eventType:['사고유형','재해유형'],severity:['사고정도','중대성'],place:['사고장소','발생장소'],workAction:['당시작업','작업내용'],incidentHow:['사고경위','발생내용','사고내용'],cause:['사고원인','확인된원인'],name:['피해자','피해직원','작업자','성명'],job:['직종','업무'],injuryDetail:['부상내용','인적피해'],damagedItem:['파손물품','파손시설','피해물품'],damageDetail:['파손내용','물적피해'],cost:['피해비용','진료비','복구비용','수리비'],immediateAction:['당시조치','즉시조치','초기대응'],erpRef:['ERP문서번호','결재문서번호'],erpDate:['ERP결재일','결재일'],erpStatus:['ERP결재상태','결재상태'],recordNo:['사고번호','사고관리번호'],originalReporter:['원보고자','보고자'],diagnosis:['진단명'],leaveEstimate:['휴업예상','휴업정도'],title:['사고명','제목']};
const labels=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v[0]]));
const aliases=new Map(Object.entries(fields).flatMap(([k,v])=>v.map(a=>[norm(a),k])));
const missing=v=>!text(v)||/^(미상|미확인|확인중|알수없음|unknown|n\/a|-)$/i.test(norm(v));
function date(v){const m=text(v).match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})(?:일)?$/);if(!m)return '';const s=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(s);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
function value(k,v){v=text(v);if(['occurredDate','erpDate'].includes(k))return date(v)||v;if(k==='category')return ({대인:'person',대인사고:'person',대물:'property',대물사고:'property',혼합:'mixed',대인대물:'mixed'})[norm(v)]||v;if(k==='severity')return ({경미:'minor',보통:'moderate',중대:'major'})[v]||v;return v;}
function parseUnits(file){const segments=[];let segment={values:{},evidence:{},issues:[],sources:[file.id]};
 const finish=()=>{if(Object.keys(segment.values).length){segments.push(segment);segment={values:{},evidence:{},issues:[],sources:[file.id]};}};
 const add=(k,v,loc)=>{if(!text(v))return;const ev={fileId:file.id,location:loc,quote:text(v),method:file.method||'text'};v=value(k,v);if(segment.values[k]!==undefined&&norm(segment.values[k])!==norm(v)){if(['erpRef','recordNo'].includes(k)){finish();}else segment.issues.push({field:k,code:'conflict',message:`${labels[k]} 값 충돌: ${segment.values[k]} / ${v}`,evidence:[...(segment.evidence[k]||[]),ev]});}if(segment.values[k]===undefined)segment.values[k]=v;(segment.evidence[k]??=[]).push(ev);};
 for(const unit of file.units||[]){
  if(unit.rows){finish();const rows=unit.rows;let headers=null;for(let r=0;r<rows.length;r++){const row=rows[r].map(text),keys=row.map(c=>aliases.get(norm(c)));if(keys.filter(Boolean).length>=3){headers=keys;continue;}if(headers){finish();row.forEach((v,c)=>{if(headers[c])add(headers[c],v,`${unit.location} · ${r+1}행 ${c+1}열`)});finish();}else if(row.length>=2&&keys[0])add(keys[0],row.slice(1).join(' '),`${unit.location} · ${r+1}행`);}finish();continue;}
  let lastKey='';for(const [n,line] of text(unit.text).split(/\r?\n/).entries()){
   if(/^\s*(?:---+|사고\s*#\s*\d+)\s*$/.test(line)){finish();lastKey='';continue;}
   const m=line.match(/^\s*([^:：\t]{1,25})\s*[:：\t]\s*(.*)$/);const k=m&&aliases.get(norm(m[1]));
   if(k){if(['siteName','occurredDate'].includes(k)&&segment.values[k]!==undefined&&segment.values.incidentHow){finish();}add(k,m[2],`${unit.location} · ${n+1}줄`);lastKey=k;}
   else if(lastKey&&['incidentHow','cause','immediateAction','workAction','injuryDetail','damageDetail'].includes(lastKey)&&text(line)){segment.values[lastKey]+='\n'+text(line);segment.evidence[lastKey].push({fileId:file.id,location:`${unit.location} · ${n+1}줄`,quote:text(line),method:file.method||'text'});}
   else lastKey='';
  }
 }
 finish();if(!segments.length)segments.push({values:{},evidence:{},sources:[file.id],issues:[{code:'unstructured',message:'사고 단위와 항목을 식별하지 못했습니다. 원문을 확인하고 사고별 필수항목을 보완해 주세요.'}]});
 if(file.method==='ocr')for(const s of segments)s.issues.push({code:'ocr',message:'OCR 판독 결과를 원본과 대조해 주세요. 스캔·사진은 자동등록하지 않습니다.'});
 return segments;
}
function analyze(files,sites){const grouped=[];for(const file of files.filter(f=>!f.error)){for(const s of parseUnits(file)){
 const key=s.values.recordNo?'no:'+norm(s.values.recordNo):s.values.erpRef?'erp:'+norm(s.values.erpRef):'';
 const old=key&&grouped.find(x=>x.groupKey===key);
 if(old){for(const [k,v] of Object.entries(s.values)){if(old.values[k]!==undefined&&norm(old.values[k])!==norm(v))old.issues.push({code:'conflict',field:k,message:`${labels[k]} 값 충돌: ${old.values[k]} / ${v}`,evidence:[...(old.evidence[k]||[]),...(s.evidence[k]||[])]});else old.values[k]=v;old.evidence[k]=[...(old.evidence[k]||[]),...(s.evidence[k]||[])];}old.sources=[...new Set([...old.sources,...s.sources])];old.issues.push(...s.issues);}else grouped.push({...s,groupKey:key});
 }}return grouped.map((s,n)=>{const matches=sites.filter(x=>norm(x.site_name||x.name)===norm(s.values.siteName));if(matches.length===1)s.values.siteId=matches[0].site_id||matches[0].id;const hasPerson=!missing(s.values.injuryDetail)&&!['없음','해당없음'].includes(norm(s.values.injuryDetail)),hasProperty=!missing(s.values.damageDetail)&&!['없음','해당없음'].includes(norm(s.values.damageDetail));if(hasPerson&&hasProperty){s.values.category='mixed';s.issues.push({code:'mixed',message:'인적·물적 피해가 함께 있습니다. 한 사고로 유지하고 주 분류와 두 피해내용을 확인해 주세요.'});}else if(!s.values.category&&(hasPerson||hasProperty)){s.values.category=hasPerson?'person':'property';s.evidence.category=s.evidence[hasPerson?'injuryDetail':'damageDetail'];}return {...s,id:`candidate-${n+1}`,state:'review',revision:0,corrections:[]};});}
function validate(c,sites,today=new Date().toISOString().slice(0,10)){const v=c.values||{},issues=(c.issues||[]).filter(i=>!(c.resolvedCodes||[]).includes(i.code));const add=(field,message,code='missing')=>issues.push({field,code,message});
 for(const k of ['siteId','occurredDate','eventType','severity','place','workAction','incidentHow','immediateAction'])if(missing(v[k]))add(k,`${labels[k]||'사업장'}을 원본에서 확인해 주세요.`);
 if(!sites.some(s=>(s.site_id||s.id)===v.siteId))add('siteId','사업장 명칭을 실제 사업장 목록에서 확정해 주세요.','site');
 if(!date(v.occurredDate)||v.occurredDate>today)add('occurredDate','실제 발생일을 확인해 주세요. 미래 날짜는 등록할 수 없습니다.','date');
 if(!missing(v.occurredTime)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.occurredTime))add('occurredTime','발생시간은 HH:mm 또는 미상이어야 합니다.','time');
 if(!['person','property'].includes(v.category))add('category','대인/대물 주 분류를 확인해 주세요. 혼합 피해를 두 사고로 만들지 않습니다.','category');
 if(!['minor','moderate','major'].includes(v.severity))add('severity','사고정도(경미/보통/중대)를 원문 또는 확인 근거로 입력해 주세요.','severity');
 for(const k of v.category==='person'?['name','injuryDetail']:v.category==='property'?['damagedItem','damageDetail']:[])if(missing(v[k]))add(k,`${labels[k]} 확인이 필요합니다.`);
 if(!missing(v.cost)&&!/^\d+(?:\.\d+)?$/.test(v.cost.replace(/[,원\s]/g,'')))add('cost','비용은 확인된 숫자 또는 미확인으로 표시해 주세요.','cost');
 if(!['승인','승인완료','결재완료','approved'].includes(norm(v.erpStatus)))add('erpStatus','ERP 최초 보고의 최종 결재 완료 근거가 필요합니다.','erp');
 if(missing(v.erpRef)&&missing(v.erpDate))add('erpRef','ERP 문서번호 또는 결재일을 확인해 주세요.','erp');
 if(!missing(v.erpDate)&&(!date(v.erpDate)||v.erpDate>today))add('erpDate','ERP 결재일을 확인해 주세요.','date');
 for(const k of Object.keys(v).filter(k=>k!=='siteId'&&!missing(v[k]))){if(!(c.evidence?.[k]?.length)&&!(c.corrections||[]).some(e=>e.field===k&&text(e.reason)))add(k,`${labels[k]||k}의 원문 근거 또는 보완 근거가 필요합니다.`,'evidence');}
 return issues;}
function makeIncident(c,batchId,actor,at,id){const v=c.values,time=missing(v.occurredTime)?null:v.occurredTime,cost=missing(v.cost)?null:Number(v.cost.replace(/[,원\s]/g,''));return {id,siteId:v.siteId,category:v.category,eventType:v.eventType,severity:v.severity,occurredAt:time?`${v.occurredDate}T${time}:00+09:00`:v.occurredDate,occurredDate:v.occurredDate,occurrenceTimeKnown:time!==null,occurredTime:time,summary:v.incidentHow,immediateAction:v.immediateAction,injuredName:v.category==='person'?v.name:'',job:v.job||'',leaveEstimate:v.leaveEstimate||'unknown',potentialMajor:false,priority:v.severity==='major'?'urgent':v.category==='person'||v.severity==='moderate'?'important':'normal',status:'approved',corrective:null,approvedAt:null,approvedBy:'',closedAt:null,reporterId:'',reporterName:v.originalReporter||'',createdAt:at,registeredAt:at,updatedAt:at,acknowledgements:[],photos:[],reportDetails:{templateVersion:'historical-bulk-v1',reportType:v.category,place:v.place,workAction:v.workAction,incidentHow:v.incidentHow,environmentCause:v.cause||'',behaviorCause:'',preventionPlan:'',injuredName:v.category==='person'?v.name:'',workerName:v.category==='property'?v.name||'':'',job:v.job||'',injuryDetail:v.injuryDetail||'',damagedItem:v.damagedItem||'',damageDetail:v.damageDetail||'',diagnosis:v.diagnosis||'',medicalCost:v.category==='person'?cost:null,repairCost:v.category==='property'?cost:null,costKnown:cost!==null},historicalOrigin:{version:1,batchId,candidateId:c.id,recordNo:v.recordNo||'',sourceFileIds:c.sources},externalInitialApproval:{source:'ERP',state:'verified',documentNo:v.erpRef||null,approvalDate:missing(v.erpDate)?null:v.erpDate,verifiedBy:actor.id,verifiedAt:at},officialRecord:{externalInitialApprovalVerification:{action:'external_erp_initial_approval_verified',actorId:actor.id,at,source:'ERP',documentNo:v.erpRef||null,approvalDate:missing(v.erpDate)?null:v.erpDate}},reportWorkflow:{phase:'report_approved',initialApprovalSource:'ERP'},_syncBaseVersion:0,_syncMutationId:`bulk:${batchId}:${c.id}`};}
return {fields,labels,text,norm,missing,date,analyze,validate,makeIncident};
});
