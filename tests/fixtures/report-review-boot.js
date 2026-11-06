const qaActor={id:'sample-field',name:'검수 안전',position:'안전관리자',role:'safety',siteId:'s01',active:true,pinHash:'qa-proof',passwordHash:'qa-proof'};
localStorage.clear();sessionStorage.clear();
localStorage.setItem('enl_setup_intro_seen_v1','1');
localStorage.setItem('enl_safety_session_v3',JSON.stringify({manager:qaActor,loggedAt:new Date().toISOString()}));
const qaIncident={id:'sample-1',siteId:'s01',category:'property',status:'approved',summary:'검수용 사고',safetyNote:'기존 검토의견',pastReport:{drafterName:'당시 소장',safetyManagerName:'당시 안전'},eventType:'부딪힘',priority:'normal',occurredAt:'2026-11-01T04:10:00Z',updatedAt:'2026-11-01T04:30:00Z',reporterId:'sample-field',reporterName:'검수 소장',reportDetails:{place:'검수 구역',incidentHow:'검수용 내용'},corrective:{status:'planned',planDetail:'검수 계획'},photos:[],_syncVersion:1};
const qaFollowup={id:'followup-test',title:'검수용 후속조치',status:'in_progress',siteId:'s01',dueDate:'2026-12-01',priority:'normal',requestedAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z',fieldAction:{},version:1};
window.qa={uploads:[],dialogs:[],errors:[],hold:false,release:null,fail:false,results:[]};
window.alert=message=>qa.dialogs.push(message);window.confirm=()=>true;
window.addEventListener('error',e=>qa.errors.push(e.message));
window.fetch=async(url,init)=>{
 let body={};try{body=JSON.parse(init?.body||'{}')}catch{}
 let result={ok:true,epoch:1,incidents:[qaIncident],sites:[{site_id:'s01',site_name:'검수CC',active:true}],metrics:[],inquiries:[],count:0,users:[qaActor],readers:[]},status=200;
 if(String(url).includes('enl-historical-followup')){
  result={ok:true};if(body.action==='list')result.rows=[qaFollowup];
  if(body.action==='save')qaFollowup.fieldAction=body.fieldAction;
 }
 if(body.action==='upload'){
  qa.uploads.push(body);if(qa.hold)await new Promise(resolve=>qa.release=resolve);
  if(qa.fail){qa.fail=false;status=400;result={ok:false}}else result={ok:true,attachment:{path:(body.scope||'historical')+'/'+body.file.name,name:body.file.name,mime:body.file.mime,kind:body.file.mime==='application/pdf'?'pdf':'file',size:body.file.size}};
 }
 if(body.action==='correct_closed'){qa.lastCorrection=body;Object.assign(qaIncident,body.changes);qaIncident._syncVersion++;result={ok:true,incident:structuredClone(qaIncident)};}
 if(body.action==='view_list'){qa.readRequests=(qa.readRequests||0)+1;await new Promise(r=>setTimeout(r,800));if(qa.failReads){status=500;result={ok:false,message:'qa_read_failure'};}else result={ok:true,readers:[{id:'hq-1',name:'검수 본사',position:'부장',first_viewed_at:qa.viewed?'2026-11-01T00:00:00Z':null}]};}
 if(body.action==='sign')result={ok:true,urls:{}};
 return new Response(JSON.stringify(result),{status,headers:{'content-type':'application/json'}});
};
if('serviceWorker' in navigator)navigator.serviceWorker.register=async()=>({});
