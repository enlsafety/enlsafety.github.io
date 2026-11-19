/* Isolated browser fixture: all external requests are blocked; no production credentials. */
(()=>{
 const role=new URLSearchParams(location.search).get('role')||'safety',actor={id:'fixture-'+role,name:'검수 담당',position:new URLSearchParams(location.search).get('position')||(role==='field'?'현장소장':role==='executive'?'상무':'안전관리자'),role,siteId:['field','worker'].includes(role)?'qa-site':'',active:true};
 localStorage.clear();sessionStorage.clear();localStorage.setItem('enl_setup_intro_seen_v1','1');localStorage.setItem('enl_safety_session_v3',JSON.stringify({manager:actor,loggedAt:new Date().toISOString()}));
 localStorage.setItem('enl.verified-session.v1',JSON.stringify({key:(['field','worker'].includes(role)?'site:':'hq:')+actor.id,token:'a'.repeat(64),expires:new Date(Date.now()+86400000).toISOString(),policy:{initial:false,nextPrompt:'2099-01-01'}}));
 const sites=[{site_id:'qa-site',site_name:'검수 골프장',active:true,manager_name:'검수 담당'}];
 const incidents=[{id:'qa-incident',siteId:'qa-site',category:'property',status:'reported',summary:'격리된 검수용 작업차량 접촉',eventType:'차량 접촉',occurredAt:'2026-11-04T01:00:00Z',updatedAt:new Date().toISOString(),reporterId:'fixture-field',reporterName:'검수 담당',reportDetails:{place:'검수 구역',incidentHow:'검수용 사고 내용'},photos:[],_syncVersion:1}];
 const moduleKeys=['incident','risk','tbm','organization','training','msds'],serviceKeys=['history','approvals','notices','documents','dashboard',...(role==='safety'?['system']:[])];
 const make=key=>({key,state:['incident','history','notices','system'].includes(key)?'live':'building',enabled:true,preview:false,pilots:[],roles:['safety','manager','executive','field','worker'],canEnter:['incident','history','notices','system'].includes(key)});
 const config={modules:moduleKeys.map(make),services:serviceKeys.map(make),revision:1};let records=[],favorites=[],serial=0;
 const additions={policy:'안전보건 경영방침 및 목표',law:'산업안전보건법령 요지',voice:'종사자 의견 청취',emergency:'비상사태 대비 및 대응',ppe:'보호구 지급 및 관리',ergonomics:'근골격계 유해위험요인조사',rules:'안전보건관리규정'};
 config.homeOrder=[...moduleKeys,'support',...(role==='safety'?['system']:[]),...Object.keys(additions)];
 config.modules.push(...Object.entries(additions).map(([key,displayName])=>({...make(key),enabled:false,displayName})));
 const safetyCards=new Map();
 const cardLinked=()=>({values:{D6:'검수 골프장',J6:'경기',N6:'이앤엘',D7:'검수 주소',N7:'2026-01-01',D8:'123-45-67890',J8:'확인 중',P8:'골프장',C9:'12',E9:'10',K9:'18홀',O9:'2026-11-19',D10:'2026-11-19',H10:'확인',D14:'검수 소장',F14:'010-0000-0000',H14:'조직도 책임자: 검수 소장',D15:'검수 반장',F15:'010-0000-0001',H15:'조직도 관리감독자: 검수 반장',D16:'검수 서무',F16:'010-0000-0002',H16:'서무',D22:'대행',H22:'월 2회',D23:'검수 대행기관',D24:'검수 담당',F24:'010-0000-0003',D25:'2026년',D26:'안전관리',D27:'검수 자료',L13:'1',P13:'3',L14:'2026-11-04',P14:'연동완료',J16:'2026-11-04',L16:'대물',M16:'격리된 검수용 작업차량 접촉',P16:'미등록',J17:'',L17:'',M17:'',P17:'',J18:'',L18:'',M18:'',P18:'',...Object.fromEntries(Array.from({length:8},(_,i)=>['P'+(23+i),i?'승인자료 없음':'작성완료 / 승인 전'])),P32:'승인완료'},sources:{},labels:{J19:'사고보고 등록 이력 자동 반영',J33:'실제 승인 기록 기준'},calculated:{N31:'조직도 승인 / 나머지 확인 필요'}});
 const realFetch=window.fetch.bind(window);window.__fixtureCalls=[];
 window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin)return realFetch(input,init);let b={};try{b=JSON.parse(init.body||'{}')}catch{}window.__fixtureCalls.push(b.action||url.pathname);
  let out={ok:true,epoch:1,incidents,sites,metrics:incidents,inquiries:[],count:0,users:[actor],readers:[],unread:0};let status=200;
  if(b.action==='dashboard_read')out.sites=Object.entries(window.ENL_SITE_LOCATIONS).filter(([id])=>id!=='s34').map(([id,loc])=>({site_id:id,site_name:'검수 '+id,address:loc.address,active:true}));
  if(b.action==='platform_analysis_target_get'){const baseline=window.ENLTargetPolicy.baseline(incidents,b.year,b.siteId||'');out={ok:true,baseline,baselineKey:JSON.stringify(baseline),targetYear:b.year+1,record:null};}
  if(b.action==='platform_storage_usage')out={ok:true,fileBytes:120984794,databaseBytes:12886016,projectDatabaseBytes:99056437,quota:{plan:'free',verifiedAt:'2026-11-17',fileBytes:1073741824,databaseBytes:524288000},fileCount:132,unknownFiles:0,checkedAt:'2026-11-17T07:00:00Z'};
  if(b.action==='platform_catalog')out={ok:true,...config};
  if(b.action==='platform_safety_card_list')out={ok:true,sites:sites.map(s=>({...s,revision:safetyCards.get(s.site_id)?.revision||1,source:safetyCards.get(s.site_id)?.source||'import',saved_at:new Date().toISOString()}))};
  if(b.action==='platform_safety_card_links')out={ok:true,linked:cardLinked()};
  if(b.action==='platform_safety_card_open'||b.action==='platform_safety_card_save'){
   const template=window.ENLSafetyCardModel.template;
   if(!safetyCards.has(b.siteId))safetyCards.set(b.siteId,{revision:1,template_version:template.version,source:'import',actor_name:'엑셀 원본',saved_at:new Date().toISOString(),content:{authority:'card-v1',masterValues:Object.fromEntries(window.ENLSafetyCardModel.masterKeys.map(k=>[k,cardLinked().values[k]||''])),values:{...Object.fromEntries(Object.keys(template.fields).map(k=>[k,''])),D6:'검수 골프장',C9:'12',E9:'10',P41:'미확인'},overrides:{},notes:{D43:'검수 원본 메모'},provenance:{}}});
   if(b.action==='platform_safety_card_save'){const prev=safetyCards.get(b.siteId),next=structuredClone(b.content);for(const key of window.ENLSafetyCardModel.masterKeys)if(Object.hasOwn(next.overrides||{},key)){next.masterValues[key]=next.overrides[key];delete next.overrides[key];}safetyCards.set(b.siteId,{...prev,content:next,revision:prev.revision+1,source:'edit',actor_name:actor.name,saved_at:new Date().toISOString()});}
   out={ok:true,linked:cardLinked(),site:sites.find(s=>s.site_id===b.siteId),document:structuredClone(safetyCards.get(b.siteId)),canEdit:['safety','field'].includes(role)};
  }

  if(b.action==='platform_enter'){const m=[...config.modules,...config.services].find(x=>x.key===b.key);if(!m||m.enabled===false||m.state==='hidden'||m.state!=='live'&&!m.preview){out={ok:false,message:'module_unavailable'};status=403}else out={ok:true,key:b.key,state:m.state}}
  if(b.action==='platform_home_cards'){
   config.omitted=b.omitted;
   if(b.newCard){const key='custom-'+(++serial);config.modules.push({...make(key),enabled:false,displayName:b.newCard.name,iconKey:b.newCard.icon});config.homeOrder.push(key);}
   out={ok:true,revision:++config.revision};
  }
  if(b.action==='platform_sidebar_order'){if(b.layoutVersion===2)config.sidebarMenuOrder=b.order;else config.sidebarOrder=b.order;out={ok:true,revision:++config.revision}}
  if(b.action==='platform_home_order'){config.homeOrder=b.order;config.revision++;out={ok:true,revision:config.revision}}
  if(b.action==='platform_save'){config[b.group||'modules']=b.modules;config.revision++;out={ok:true,revision:config.revision}}
  if(b.action==='platform_hub')out={ok:true,notices:records.filter(x=>x.kind==='notice'),events:records.filter(x=>x.kind==='event'),favorites};
  if(b.action==='platform_hub_favorites'){favorites=b.favorites;out={ok:true}}
  if(b.action==='platform_hub_save'){const old=records.find(x=>x.id===b.id);if(old)records=records.filter(x=>x.id!==b.id);const row={...b,id:b.id||'00000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),revision:(old?.revision||0)+1,site_id:b.siteId,starts_at:b.startsAt,ends_at:b.endsAt,created_at:new Date().toISOString()};records.push(row);out={ok:true,item:row}}
  if(b.action==='platform_board_list'){
   const filtered=records.filter(x=>x.kind!=='event'&&(b.kind==='all'||x.kind===b.kind)&&(!b.query||(x.title+x.body).includes(b.query)));
   const start=b.offset||0,limit=b.pageSize||50;out={ok:true,items:filtered.slice(start,start+limit).map(x=>({...x,asset_ids:(x.attachments||[]).map(f=>f.id)})),total:filtered.length,more:start+limit<filtered.length};
  }
  if(b.action==='platform_board_detail'){const item=records.find(x=>x.id===b.id);out={ok:true,item,files:(item?.attachments||[]).map(({base64,...f})=>f)}}
  if(b.action==='platform_board_file'){const item=records.find(x=>x.id===b.id);out={ok:true,file:item?.attachments?.find(x=>x.id===b.assetId)}}
  if(b.action==='platform_hub_archive'||b.action==='platform_board_delete'){records=records.filter(x=>x.id!==b.id);out={ok:true}}
  if(['activity_list','activity_open','activity_page'].includes(b.action))out={ok:true,rows:[{id:'1',incident_id:'qa-incident',module_key:'incident',sentence:'검수 골프장 사고보고 등록',actor_name:'검수 담당',happened_at:new Date().toISOString()}],more:false};
  if(b.action==='platform_notices')out={ok:true,rows:moduleKeys.map(key=>({key,push:true,email:true}))};
  if(b.action==='platform_directory')out={ok:true,rows:[],more:false};
  return new Response(JSON.stringify(out),{status,headers:{'content-type':'application/json'}});
 };
 if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('isolated fixture'));
})();
