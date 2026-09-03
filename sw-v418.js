const ENL_SW_VERSION='4.2.5-pwa3';
const CACHE_NAME='enl-pwa-425-r21';
const OFFLINE_URL='/stable412.html?offline=1';

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    try{const cache=await caches.open(CACHE_NAME);await cache.add(new Request(OFFLINE_URL,{cache:'reload'}));}catch(e){console.warn('offline shell cache skipped',e)}
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
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh&&fresh.ok){const cache=await caches.open(CACHE_NAME);cache.put(OFFLINE_URL,fresh.clone()).catch(()=>{});}
        return fresh;
      }catch(e){
        return (await caches.match(OFFLINE_URL)) || (await caches.match('/stable412.html')) || Response.error();
      }
    })());
  }
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch(e){try{data={body:event.data?.text()||''};}catch(_){data={};}}
  const title=String(data.title||'이앤엘 사고보고앱');
  const body=String(data.body||'새로운 알림이 있습니다.');
  const tag=String(data.tag||`enl-${Date.now()}`);
  const payload=data.data&&typeof data.data==='object'?data.data:{};
  event.waitUntil(self.registration.showNotification(title,{
    body,
    tag,
    renotify:true,
    icon:'/pwa-icon-192.png',
    badge:'/pwa-icon-192.png',
    data:payload,
    vibrate:[160,80,160]
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const d=event.notification?.data&&typeof event.notification.data==='object'?event.notification.data:{};
  const incidentId=String(d.incidentId||'').trim();
  const kind=String(d.kind||'').trim();
  const target=incidentId
    ? `https://enlsafety.github.io/stable412.html?push=1&incident=${encodeURIComponent(incidentId)}${kind?`&kind=${encodeURIComponent(kind)}`:''}`
    : String(d.url||'https://enlsafety.github.io/');
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      try{
        if(new URL(client.url).origin===self.location.origin){await client.focus();if('navigate' in client)await client.navigate(target);return;}
      }catch(e){}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
