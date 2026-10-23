(function bootstrap() {
"use strict";
const block=()=>{throw new Error("DEMO_NETWORK_BLOCKED")};
function isolatedStorage() {
 const entries=new Map();
 return {
  getItem:key=>entries.has(String(key))?entries.get(String(key)):null,
  setItem:(key,value)=>{entries.set(String(key),String(value))},
  removeItem:key=>{entries.delete(String(key))},
  clear:()=>entries.clear(),
  key:i=>[...entries.keys()][i]||null,
  get length(){return entries.size}
 };
}
const local=isolatedStorage(),tab=isolatedStorage();
Object.defineProperty(window,"localStorage",{value:local,configurable:false});
Object.defineProperty(window,"sessionStorage",{value:tab,configurable:false});
if(window.localStorage!==local||window.sessionStorage!==tab)throw new Error("DEMO_STORAGE_SANDBOX_FAILED");
window.ENL_DEMO_ISOLATED=true;
window.ENL_STABLE_MODE=true;
window.ENL_DEPLOY_VERSION="4.7.2-DEMO";
const SITES=[
{id:"zw-site01",name:"가상 솔빛 골프장",site_type:"코스관리",region:"경기",active:true},
{id:"zw-site02",name:"가상 푸른숲 골프장",site_type:"코스관리",region:"충청",active:true},
{id:"zw-site03",name:"가상 물류센터",site_type:"물류",region:"경기",active:true},
{id:"site-hq",name:"가상 본사",site_type:"본사",region:"경기",active:true}
];
const USERS=[
{id:"zw-safety",name:"데모 안전관리자",role:"safety",position:"안전관리자",department:"가상 안전관리팀",active:true,siteId:null},
{id:"zw-field",name:"데모 현장소장",role:"field",position:"현장소장",siteId:"zw-site01",department:"가상 솔빛 골프장",active:true},
{id:"zw-worker",name:"데모 현장근무자",role:"worker",position:"일반근로자",siteId:"zw-site01",department:"가상 솔빛 골프장",active:true},
{id:"zw-manager",name:"데모 본사관리자",role:"manager",position:"본사관리자",department:"가상 본사",siteId:null,active:true},
{id:"zw-executive",name:"데모 경영진",role:"executive",position:"경영진",department:"가상 본사",siteId:null,active:true}
].map(x=>({...x,personnelId:x.id,username:x.name,passwordHash:"DEMO_NO_REAL_PASSWORD",pinHash:"DEMO_NO_REAL_PASSWORD",access_role:x.role,jobTitle:x.position,pushEnabled:false,emailEnabled:false}));
const siteColumns=()=>SITES.map(s=>({...s,site_id:s.id,site_name:s.name,total_count:12,regular_count:9,daily_count:3,start_date:"2026-01-01",contract_end_date:"2027-12-31",address:"가상 위치 (실제 주소 아님)"}));
window.ENL_SITE_MASTER_SEED=siteColumns();
window.ENL_SITE_DIRECTORY=SITES.map(s=>({id:s.id,name:s.name,region:s.region}));
window.ENL_SITE_LOCATIONS={
 "zw-site01":{address:"가상 위치 (실제 주소 아님)",lat:37.28,lon:127.17,accuracy:"demo"},
 "zw-site02":{address:"가상 위치 (실제 주소 아님)",lat:36.87,lon:127.42,accuracy:"demo"},
 "zw-site03":{address:"가상 위치 (실제 주소 아님)",lat:37.01,lon:127.09,accuracy:"demo"}
};
function incident(id,siteId,status,summary,category="property",opts={}) {
 const timestamp="2026-10-12T02:10:00.000Z";
 const d={
 templateVersion:"v411",reportType:category,place:"가상 현장 작업구역",workAction:"정기 시설관리 및 안전작업",incidentHow:summary,
 environmentCause:"",behaviorCause:"",causeAnalysisNote:"",causeAnalysisStatus:"not_reviewed",
 preventionPlan:"작업 전 시설물 위치 확인 및 TBM 안전교육",repairCost:null,repairCostPending:true,
 damageDetail:"가상 시설물 긁힘",injuryDetail:"가상 경미 부상",recordedAt:timestamp,
 ...(opts.reportDetails||{})
 };
 const i={id,siteId,status,category,eventType:category==="person"?"베임/찔림":"접촉",
 summary,occurredAt:timestamp,createdAt:timestamp,registeredAt:timestamp,updatedAt:timestamp,
 reporterId:opts.reporterId||"zw-field",reporterName:opts.reporterName||"데모 현장소장",injuredName:category==="person"?"가상 근무자":"",severity:"minor",leaveEstimate:"none",potentialMajor:false,priority:"normal",prioritySource:"auto",job:"가상 코스관리",
 immediateAction:"작업 중지 및 안전구역 통제",reportDetails:d,photos:[],safetyNote:"",
 corrective:opts.corrective||null,approvedBy:"",approvedAt:null,closedAt:null,
 officialRecord:{revisionNumber:0},reviewHistory:[],reportWorkflow:{phase:status},acknowledgements:[],readReceipts:[],_syncVersion:1,
 ...opts
 };
 i.reportDetails=d;
 if(["approved","closed"].includes(status)){
  i.approvedBy="데모 안전관리자";i.approvedAt="2026-10-13T01:00:00.000Z";
  if(i.reportDetails.causeAnalysisStatus==="not_reviewed")i.reportDetails.causeAnalysisStatus="investigating";
 }
 if(status==="closed")i.closedAt="2026-10-14T02:00:00.000Z";
 return i;
}
const examples=[
 incident("ZW-001","zw-site01","reported","카트 이동 중 가상 안전표지판 접촉"),
 incident("ZW-002","zw-site01","reported","가상 예초기 날 정리 중 손가락 베임","person",{reporterId:"zw-worker",reporterName:"데모 현장근무자"}),
 incident("ZW-003","zw-site01","supplement","이동통로 미끄러짐 가상 사고","person",{reporterId:"zw-worker",reporterName:"데모 현장근무자",supplement:{status:"waiting",requestNote:"진료내역과 추가 사고경위 보완 필요"}}),
 incident("ZW-004","zw-site01","supplement_submitted","시설운반 중 도장면 긁힘 보완제출",{reportDetails:{repairCost:180000,repairCostPending:false},supplement:{status:"submitted",requestNote:"견적 추가 확인",submittedNote:"가상 견적 18만원 확인"}}),
 incident("ZW-005","zw-site01","approved","작업차량 회전 중 가상 경계석 접촉","property",{reportDetails:{causeAnalysisStatus:"analyzed",environmentCause:"가상 경계석 위치가 회전반경에 가까움",behaviorCause:"회전 전 측면 시설물 위치 미확인"}}),
 incident("ZW-006","zw-site01","approved","가상 장비보관실 문짝 파손","property",{corrective:{status:"planned",rootCause:"장비 보관동선 협소",planDetail:"보관구역 동선 분리 및 표지 부착",ownerName:"데모 현장소장",dueDate:"2026-10-25",planBy:"데모 안전관리자",planAt:"2026-10-13T03:00:00.000Z"}}),
 incident("ZW-007","zw-site01","approved","차량 후진 중 가상 안전휀스 접촉","property",{corrective:{status:"submitted",rootCause:"후방 사각지대 미확인",planDetail:"유도자 배치 및 후진구간 통제",ownerName:"데모 현장소장",dueDate:"2026-10-25",planAt:"2026-10-13T03:00:00.000Z",actionDetail:"가상 후진 동선 표시 완료",actionDate:"2026-10-14",actionOwner:"데모 현장소장",afterPhotos:[{name:"가상_조치사진.jpg",path:"demo/imaginary.jpg"}]}}),
 incident("ZW-008","zw-site02","closed","가상 2025년 조경장비 사고이력","property",{recordMode:"historical_transfer",reportDetails:{incidentHow:"가상 이전 사고 이관기록"}}),
 incident("ZW-009","zw-site02","closed","가상 교통동선 개선 종결사고","property",{corrective:{status:"approved",rootCause:"가상 동선 겹침",planDetail:"차량 동선 안내표시",actionDetail:"안전표지 설치 완료",actionDate:"2026-10-13",actionOwner:"가상 관리자",reviewedBy:"데모 안전관리자",reviewedAt:"2026-10-14T02:00:00.000Z"}}),
 incident("ZW-010","zw-site01","rejected","중복 등록된 가상 사고","property",{rejectionNote:"기존 가상 사고와 내용 중복"}),
 incident("ZW-011","zw-site03","reported","가상 물류 상자 전도 사고")
];
const demoFiles=new Map();
const db={users:USERS,sites:SITES,incidents:structuredClone(examples),audit:[],revisions:[],incoming:[],blocked:0};
function safeClone(x){return structuredClone(x)}
function result(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}})}
function reject(message,status=403){return result({ok:false,message},status)}
function canRead(i,role,actor) {
 if(["safety","manager","executive"].includes(role))return true;
 if(role==="field")return i.siteId===actor.siteId;
 return i.siteId===actor.siteId&&i.reporterId===actor.id;
}
function copyIncident(actor){
 return db.incidents.filter(i=>canRead(i,actor.role,actor)).map(safeClone);
}
function roleFor(x){return USERS.find(u=>u.id===x?.id)||null}
function patch(next,actor){
 const incoming=safeClone(next);const old=db.incidents.find(x=>x.id===incoming.id);
 if(!old){
  if(!["field","worker","safety"].includes(actor.role))return reject("demo_forbidden");
  if(actor.role!=="safety"&&incoming.siteId!==actor.siteId)return reject("demo_site_locked");
  incoming._syncVersion=1;
  incoming.reportDetails={...(incoming.reportDetails||{}),environmentCause:"",behaviorCause:"",causeAnalysisNote:"",causeAnalysisStatus:"not_reviewed"};
  db.incidents.unshift(incoming);return result({ok:true,incidents:[safeClone(incoming)],pushed:1});
 }
 if(["manager","executive"].includes(actor.role))return reject("demo_read_only");
 if(actor.role!=="safety"&&incoming.siteId!==actor.siteId)return reject("demo_site_locked");
 if(Number(incoming._syncBaseVersion??old._syncVersion)!==Number(old._syncVersion))return reject("enl_sync_conflict_version",409);
 if(["approved","closed"].includes(old.status)){
  if(incoming.status!==old.status&&!(incoming.status==="closed"&&actor.role==="safety"&&old.status==="approved"&&incoming.corrective?.status==="approved"))return reject("approved_record_locked",409);
  if(incoming.summary!==old.summary||incoming.reportDetails?.incidentHow!==old.reportDetails?.incidentHow)return reject("approved_record_locked",409);
 }
 if(actor.role!=="safety"){
  const d=old.reportDetails||{};
  incoming.reportDetails={...(incoming.reportDetails||{}),environmentCause:d.environmentCause||"",behaviorCause:d.behaviorCause||"",causeAnalysisNote:d.causeAnalysisNote||"",causeAnalysisStatus:d.causeAnalysisStatus||"not_reviewed"};
  if(incoming.status!==old.status&&["approved","closed"].includes(incoming.status))return reject("safety_approval_required",403);
 }
 if(incoming.status==="approved"&&old.status!=="approved"&&old.status!=="closed"){
  if(actor.role!=="safety")return reject("safety_approval_required",403);
  const d=incoming.reportDetails||{};
  if(d.causeAnalysisStatus!=="investigating"&&!(d.causeAnalysisStatus==="analyzed"&&(d.environmentCause||d.behaviorCause||d.causeAnalysisNote)))return reject("cause_analysis_required",409);
  incoming.approvedBy=actor.name;incoming.approvedAt=new Date().toISOString();
 }
 const oldC=old.corrective||{},c=incoming.corrective,now=new Date().toISOString();
 if(c&&JSON.stringify(c)!==JSON.stringify(oldC)){
  if(actor.role==='safety'&&['planned','in_progress','rejected'].includes(c.status)&&oldC.status!=='submitted'){
   c.planBy=oldC.planBy||actor.name;c.planById=oldC.planById||actor.id;c.planAt=oldC.planAt||now;c.planUpdatedAt=now;c.planUpdatedBy=actor.name;
  }
  if(actor.role==='field'&&c.status==='submitted'){
   if(!c.actionDetail||!c.actionDate||!c.actionOwner||!c.afterPhotos?.length)return reject('action_evidence_required',409);
   c.submittedBy=actor.name;c.submittedById=actor.id;c.submittedAt=now;
   c.submissions=[...(oldC.submissions||[]),{actionDetail:c.actionDetail,actionDate:c.actionDate,actionCompletedDate:c.actionCompletedDate,actionOwner:c.actionOwner,afterPhotos:safeClone(c.afterPhotos),submittedBy:actor.name,submittedAt:now,requestNote:oldC.status==='rejected'?oldC.reviewNote||'':''}];
  }
  if(actor.role==='safety'&&['approved','rejected'].includes(c.status)&&oldC.status==='submitted'){
   c.reviewedBy=actor.name;c.reviewedById=actor.id;c.reviewedAt=now;c.reviewHistory=[...(oldC.reviewHistory||[]),{action:c.status==='approved'?'prevention_action_confirmed':'prevention_action_rejected',by:actor.name,at:now,note:c.reviewNote||''}];
   if(c.status==='approved'){incoming.status='closed';incoming.closedAt=now;}
  }
 }
 incoming._syncVersion=Number(old._syncVersion||0)+1;
 const idx=db.incidents.indexOf(old);
 db.incidents[idx]=incoming;
 return result({ok:true,incidents:[safeClone(incoming)],pushed:1});
}
function call(req) {
 const body=req||{},action=String(body.action||""),actor=roleFor(body.actor)||USERS.find(u=>u.id===body.actor?.id)||USERS[0];
 if(action==="upload"){
  const file=body.file||{},mime=String(file.mime||""),base64=String(file.base64||"");
  if(!["safety","field","worker"].includes(actor.role))return reject("reader_upload_forbidden");
  if(!["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"].includes(mime)||!base64||Number(file.size)>8*1024*1024)return reject("invalid_demo_attachment",400);
  const scope=body.scope==="action"?"action":"incident",url="data:"+mime+";base64,"+base64;
  let path=[...demoFiles].find(([,value])=>value.url===url&&value.actorId===actor.id&&value.scope===scope)?.[0];
  if(!path){path="demo/"+scope+"/"+actor.id+"/"+(demoFiles.size+1);demoFiles.set(path,{url,actorId:actor.id,scope});}
  return result({ok:true,attachment:{storage:true,path,name:String(file.name||"가상 첨부"),mime,size:Number(file.size),kind:mime==="application/pdf"?"pdf":"image",optimization:file.optimization,previewUrl:url}});
 }
 if(action==="sign"){
  const urls={};for(const path of Array.isArray(body.paths)?body.paths:[]){const file=demoFiles.get(path);if(file)urls[path]=file.url;}
  return result({ok:true,urls});
 }
 if(action==="health")return result({ok:true,version:"ZERO-WIZ-OFFLINE"});
 if(action==="pull")return result({ok:true,incidents:copyIncident(actor)});
 if(action==="push"){
  const res=[];
  for(const raw of body.incidents||[]){
    const response=patch(raw,actor);
    if(!response.ok)return response;
    // locally generated response body can be read from mock Response once.
    const saved=db.incidents.find(x=>x.id===raw.id);
    if(saved)res.push(safeClone(saved));
  }
  return result({ok:true,incidents:res,pushed:res.length,ignored:0});
 }
 if(action==="site_directory"||action==="site_list")return result({ok:true,sites:siteColumns(),directory:siteColumns()});
 if(action==="dashboard_read")return result({ok:true,sites:siteColumns(),metrics:db.incidents.map(i=>({siteId:i.siteId,occurredAt:i.occurredAt,status:i.status,category:i.category,priority:i.priority}))});
 if(action==="hq_list")return result({ok:true,users:USERS.filter(u=>["safety","manager","executive"].includes(u.role))});
 if(action==="personnel_pull")return result({ok:true,personnel:USERS.filter(u=>["field","worker"].includes(u.role)&&u.siteId===body.siteId).map(u=>({personnel_id:u.id,site_id:u.siteId,name:u.name,job_title:u.position,access_role:u.role,active:true}))});
 if(action==="revision_list")return result({ok:true,revisions:db.revisions.filter(r=>r.incident_id===body.incidentId).map(safeClone)});
 if(action==="historical_reauth")return actor.role!=="safety"?reject("forbidden"):result({ok:true,verified:true,reauthTicket:"DEMO-ONLY-PASSWORD-PROOF",expiresAt:Date.now()+480000,incident:db.incidents.find(i=>i.id===body.incidentId)});
 if(action==="correct_closed"){
  const i=db.incidents.find(x=>x.id===body.incidentId);
  if(!i)return reject("not_found",404);
  if(actor.role!=="safety")return reject("forbidden");
  if(!["approved","closed"].includes(i.status))return reject("approved_or_closed_required",409);
  if(body.expectedVersion!=null&&Number(body.expectedVersion)!==Number(i._syncVersion))return reject("enl_sync_conflict_version",409);
  if(!String(body.reason||"").trim())return reject("revision_reason_required",400);
  const before=safeClone(i),changes=body.changes||{},details=changes.reportDetails||{};
  Object.assign(i,{...changes,reportDetails:{...i.reportDetails,...details}});
  i._syncVersion=Number(i._syncVersion||0)+1;
  i.officialRecord={...(i.officialRecord||{}),revisionNumber:Number(i.officialRecord?.revisionNumber||0)+1,lastCorrection:{reason:body.reason,byId:actor.id,by:actor.name,at:new Date().toISOString()}};
  const diff=Object.entries(changes).map(([field,val])=>({field,before:before[field]??null,after:val}));
  db.revisions.push({incident_id:i.id,revision:i.officialRecord.revisionNumber,editor_name:actor.name,created_at:new Date().toISOString(),reason:body.reason,changes:diff});
  return result({ok:true,incident:safeClone(i)});
 }
 if(action==="export_snapshot")return result({ok:true,incident:db.incidents.find(i=>i.id===body.incidentId),snapshotHash:"a".repeat(64)});
 if(action==="export_completed")return result({ok:true,generated:true});
 if(action==="acknowledge")return result({ok:true,incident:db.incidents.find(i=>i.id===body.incidentId)});
 if(action==="review_history"||action==="site_audit_pull")return result({ok:true,rows:[],audit:[]});
 if(action==="login_site"||action==="login_hq")return result({ok:false,message:"demo_login_use_role_selector"},401);
 if(action==="lookup")return result({ok:true,options:[]});
 return result({ok:true,users:[],sites:siteColumns(),incidents:copyIncident(actor),items:[],personnel:[],unread:0,notifications:[],views:[]});
}
window.fetch=async(input,options={})=>{
 const url=String(typeof input==="string"?input:input?.url||"");
 const apiPath=/\/functions\/v1\/([a-z0-9_-]+)/.exec(url);
 if(apiPath){
  db.incoming.push({endpoint:apiPath[1],body:String(options?.body||"").slice(0,120)});
  let body={};try{body=JSON.parse(String(options?.body||"{}"))}catch(e){}
  return call(body);
 }
 if(/(?:^|\/)version\.json(?:\?|$)/.test(url))return result({version:"4.7.0",currentStableVersion:"4.7.0",build:"DEMO"});
 db.blocked++;
 throw new Error("DEMO_NETWORK_BLOCKED:"+url.slice(0,100));
};
window.XMLHttpRequest=function(){return block()};
window.WebSocket=function(){return block()};
window.EventSource=function(){return block()};
try{Object.defineProperty(navigator,"sendBeacon",{value:()=>false,configurable:false})}catch(e){}
try{Object.defineProperty(navigator,"serviceWorker",{value:undefined,configurable:false})}catch(e){}
window.ENL_ZEROWIZ_SANDBOX={db,users:USERS,sites:SITES,getRequests:()=>db.incoming.slice(),getNetworkBlocks:()=>db.blocked,reset:()=>{db.incidents=structuredClone(examples);db.revisions=[];db.incoming=[];db.blocked=0;demoFiles.clear()}};
})();
