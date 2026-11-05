/* Isolated browser fixture: all external requests are blocked; no production credentials. */
(()=>{
 const role=new URLSearchParams(location.search).get('role')||'safety',actor={id:'fixture-'+role,name:'검수 담당',position:role==='field'?'현장소장':role==='executive'?'상무':'안전관리자',role,siteId:['field','worker'].includes(role)?'qa-site':'',active:true};
 localStorage.clear();sessionStorage.clear();localStorage.setItem('enl_setup_intro_seen_v1','1');localStorage.setItem('enl_safety_session_v3',JSON.stringify({manager:actor,loggedAt:new Date().toISOString()}));
 const sites=[{site_id:'qa-site',site_name:'검수 골프장',active:true,manager_name:'검수 담당'}];
 const incidents=[{id:'qa-incident',siteId:'qa-site',category:'property',status:'reported',summary:'격리된 검수용 작업차량 접촉',eventType:'차량 접촉',occurredAt:'2026-11-04T01:00:00Z',updatedAt:new Date().toISOString(),reporterId:'fixture-field',reporterName:'검수 담당',reportDetails:{place:'검수 구역',incidentHow:'검수용 사고 내용'},photos:[],_syncVersion:1}];
 const moduleKeys=['incident','risk','tbm','organization','training','msds'],serviceKeys=['history','approvals','notices','documents','dashboard',...(role==='safety'?['system']:[])];
 const make=key=>({key,state:['incident','history','notices','system'].includes(key)?'live':'building',enabled:true,preview:false,pilots:[],roles:['safety','manager','executive','field','worker'],canEnter:['incident','history','notices','system'].includes(key)});
 const config={modules:moduleKeys.map(make),services:serviceKeys.map(make),revision:1};let records=[],favorites=[],serial=0;
 const additions={policy:'안전보건 경영방침 및 목표',law:'산업안전보건법령 요지',voice:'종사자 의견 청취',emergency:'비상사태 대비 및 대응',ppe:'보호구 지급 및 관리',ergonomics:'근골격계 유해위험요인조사',rules:'안전보건관리규정'};
 config.homeOrder=[...moduleKeys,'support',...(role==='safety'?['system']:[]),...Object.keys(additions)];
 config.modules.push(...Object.entries(additions).map(([key,displayName])=>({...make(key),enabled:false,displayName})));
 const realFetch=window.fetch.bind(window);window.__fixtureCalls=[];
 window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin)return realFetch(input,init);let b={};try{b=JSON.parse(init.body||'{}')}catch{}window.__fixtureCalls.push(b.action||url.pathname);
  let out={ok:true,epoch:1,incidents,sites,metrics:incidents,inquiries:[],count:0,users:[actor],readers:[],unread:0};let status=200;
  if(b.action==='platform_catalog')out={ok:true,...config};
  if(b.action==='platform_enter'){const m=[...config.modules,...config.services].find(x=>x.key===b.key);if(!m||m.enabled===false||m.state==='hidden'||m.state!=='live'&&!m.preview){out={ok:false,message:'module_unavailable'};status=403}else out={ok:true,key:b.key,state:m.state}}
  if(b.action==='platform_home_cards'){
   config.omitted=b.omitted;
   if(b.newCard){const key='custom-'+(++serial);config.modules.push({...make(key),enabled:false,displayName:b.newCard.name,iconKey:b.newCard.icon});config.homeOrder.push(key);}
   out={ok:true,revision:++config.revision};
  }
  if(b.action==='platform_sidebar_order'){config.sidebarOrder=b.order;out={ok:true,revision:++config.revision}}
  if(b.action==='platform_home_order'){config.homeOrder=b.order;config.revision++;out={ok:true,revision:config.revision}}
  if(b.action==='platform_save'){config[b.group||'modules']=b.modules;config.revision++;out={ok:true,revision:config.revision}}
  if(b.action==='platform_hub')out={ok:true,notices:records.filter(x=>x.kind==='notice'),events:records.filter(x=>x.kind==='event'),favorites};
  if(b.action==='platform_hub_favorites'){favorites=b.favorites;out={ok:true}}
  if(b.action==='platform_hub_save'){const old=records.find(x=>x.id===b.id);if(old)records=records.filter(x=>x.id!==b.id);const row={...b,id:b.id||'00000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),revision:(old?.revision||0)+1,site_id:b.siteId,starts_at:b.startsAt,ends_at:b.endsAt,created_at:new Date().toISOString()};records.push(row);out={ok:true,item:row}}
  if(b.action==='platform_hub_archive'){records=records.filter(x=>x.id!==b.id);out={ok:true}}
  if(b.action==='activity_list')out={ok:true,rows:[{id:'1',incident_id:'qa-incident',module_key:'incident',sentence:'검수 골프장 사고보고 등록',actor_name:'검수 담당',happened_at:new Date().toISOString()}],more:false};
  if(b.action==='platform_notices')out={ok:true,rows:moduleKeys.map(key=>({key,push:true,email:true}))};
  if(b.action==='platform_directory')out={ok:true,rows:[],more:false};
  return new Response(JSON.stringify(out),{status,headers:{'content-type':'application/json'}});
 };
 if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('isolated fixture'));
})();
