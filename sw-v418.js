const ENL_SW_VERSION='4.4.32-startup-cache1';
const CACHE_NAME='enl-pwa-4432-startup1';
const OFFLINE_URL='/stable412.html?offline=1';
const ROOT_URL='/';
const PRECACHE=["/","/stable412.html?offline=1","/korea-map-natural-earth-10m.svg","/manifest.webmanifest","/pwa-icon-180.png","/pwa-icon-192.png","/style.css","/v3.css","/field-readability-v331.css","/field-form-v362.css","/accident-app-v375.css","/accident-app-v376.css","/accident-app-v377.css","/accident-app-v382.css","/report-v410.css","/field-ui-v411.css","/responsive-v432.css","/core.js","/session-refresh-v412.js","/admin.js","/v3-shell.js","/v3-actions.js","/site-directory-v410.js","/platform-state-v411.js","/auth-v411.js","/login-layout-v412.js","/site-master-seed-v400.js","/site-contract-v451.js","/site-master-ambiguity-v400.js","/incidents-v410.js","/incident-sync-v411.js","/site-directory-sync-v410.js","/site-admin-v415.js","/review-dashboard-v410.js","/interaction-v410.js","/app-control-v410.js","/report-v410.js","/field-ui-v411.js","/field-incidents-v411.js","/historical-followup-v452.js","/app-shell-v411.js","/incident-stats-v426.js","/security-v412.js","/workflow-lifecycle-v413.js","/reader-ui-v414.js","/incident-category-ui-v417.js","/incident-excel-v421.js","/workflow-v412.js","/account-security-v420.js","/pwa-push-v418.js","/notification-profile-v441.js","/ui-stability-v422.js","/reader-ack-ux-v423.js","/reader-experience-v424.js","/push-session-v425.js","/preapproval-edit-v427.js","/sync-conflict-v428.js","/workflow-prevention-v429.js","/incident-review-v431.js","/production-cleanup-v431.js","/workflow-enhancements-v432.js","/site-admin-hotfix-v433.js","/personnel-management-v434.js","/hq-notification-status-v437.js","/legal-review-v435.js","/industrial-report-v436.js","/closed-incident-reopen-v438.js","/official-records-v439.js","/incident-flow-v440.js","/management-approval-v448.js","/historical-transfer-v449.js","/required-fields-v453.js","/site-locations-v450.js","/site-dashboard-v450.js"];

async function putSafe(cache,key,response){
  try{if(response&&response.ok)await cache.put(key,response.clone())}catch(e){}
}
async function fetchWithTimeout(request,ms=5000){
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=ctl?setTimeout(()=>ctl.abort(),ms):null;
  try{return await fetch(request,{cache:'no-store',signal:ctl?.signal})}
  finally{if(timer)clearTimeout(timer)}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(PRECACHE.map(async url=>{
      try{const r=await fetch(new Request(url,{cache:'reload'}));if(r&&r.ok)await cache.put(url,r.clone())}catch(e){}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('enl-pwa-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const shellKey=url.pathname.endsWith('/stable412.html')?OFFLINE_URL:(url.pathname==='/'||url.pathname.endsWith('/index.html'))?ROOT_URL:null;
      const cached=shellKey?await cache.match(shellKey):await cache.match(req,{ignoreSearch:true});
      const refresh=(async()=>{
        try{
          const fresh=await fetchWithTimeout(req,4500);
          if(fresh&&fresh.ok)await putSafe(cache,shellKey||req,fresh);
          return fresh;
        }catch(e){return null}
      })();
      if(cached){event.waitUntil(refresh);return cached}
      const fresh=await refresh;
      if(fresh&&fresh.ok)return fresh;
      return (await cache.match(shellKey||OFFLINE_URL)) || (await cache.match(OFFLINE_URL)) || Response.error();
    })());
    return;
  }
  const staticAsset=['script','style','image','font','manifest'].includes(req.destination)||/\.(?:js|css|png|svg|ico|webmanifest)$/i.test(url.pathname);
  if(!staticAsset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try{
      const fresh=await fetch(req);
      if(fresh&&fresh.ok)putSafe(cache,url.pathname,fresh);
      return fresh;
    }catch(e){
      return (await cache.match(url.pathname,{ignoreSearch:true})) || Response.error();
    }
  })());
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch(e){try{data={body:event.data?.text()||''};}catch(_){data={};}}
  const title=String(data.title||'이앤엘 사고보고앱');
  const body=String(data.body||'새로운 알림이 있습니다.');
  const tag=String(data.tag||`enl-${Date.now()}`);
  const payload=data.data&&typeof data.data==='object'?data.data:{};
  event.waitUntil((async()=>{
    const options={
      body,
      tag,
      renotify:true,
      icon:'/pwa-icon-192.png',
      badge:'/pwa-icon-192.png',
      data:payload,
      vibrate:[160,80,160]
    };
    if(String(payload.kind||'')==='admin_push_test'){
      options.actions=[{action:'confirm',title:'확인'}];
      options.requireInteraction=true;
    }
    try{await self.registration.showNotification(title,options)}
    catch(e){
      delete options.actions;delete options.requireInteraction;
      await self.registration.showNotification(title,options);
    }
  })());
});

const PUSH_CONFIRM_API='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-push-admin-v437';
async function confirmAdminPushTest(d,method){
  const checkId=String(d?.checkId||'').trim(),confirmToken=String(d?.confirmToken||'').trim();
  if(!checkId||!confirmToken)return false;
  try{
    const r=await fetch(PUSH_CONFIRM_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-ENL-App':'incident-report-v2'},
      body:JSON.stringify({action:'ack_test_token',checkId,confirmToken,method}),
      cache:'no-store'
    });
    return r.ok;
  }catch(e){return false}
}

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const d=event.notification?.data&&typeof event.notification.data==='object'?event.notification.data:{};
  const incidentId=String(d.incidentId||'').trim();
  const kind=String(d.kind||'').trim();
  const action=String(event.action||'').trim();
  const target=d.followupId
    ? `https://enlsafety.github.io/stable412.html?followup=${encodeURIComponent(String(d.followupId))}`
    : incidentId
    ? `https://enlsafety.github.io/stable412.html?push=1&incident=${encodeURIComponent(incidentId)}${kind?`&kind=${encodeURIComponent(kind)}`:''}`
    : String(d.url||'https://enlsafety.github.io/');
  event.waitUntil((async()=>{
    if(kind==='admin_push_test'){
      await confirmAdminPushTest(d,action==='confirm'?'action':'notification');
      if(action==='confirm')return;
    }
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      try{
        if(new URL(client.url).origin===self.location.origin){await client.focus();if('navigate' in client)await client.navigate(target);return;}
      }catch(e){}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
