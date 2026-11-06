/* Integrated home: transparent illustration atlas, vector pictograms and existing scoped routes. */
(()=>{
 'use strict';
 const safe=v=>esc(String(v??''));
 const api=body=>window.enlIncidentApi({...body,actor:window.enlCurrentActor()});
 const paths={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',calendar:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2"/>',notice:'<path d="M3 10h5l11-6v16L8 14H3zM7 14l2 7h3l-2-6M22 9v6"/>',clock:'<circle cx="12" cy="13" r="9"/><path d="M9 1h6m-3 3v9l4 2"/>',file:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',grid:'<rect x="2" y="2" width="8" height="8" rx="2"/><rect x="14" y="2" width="8" height="8" rx="2"/><rect x="2" y="14" width="8" height="8" rx="2"/><rect x="14" y="14" width="8" height="8" rx="2"/>'};
 Object.assign(paths,{
  approvals:'<path d="M11 4H4v17h17v-9M9 16l1-5L19 2l3 3-9 9zM17 4l3 3"/>',
  bell:'<path d="M18.5 9a6.5 6.5 0 0 0-13 0c0 4.7-.7 6.3-2.1 8.2a.8.8 0 0 0 .7 1.3h15.8a.8.8 0 0 0 .7-1.3c-1.4-1.9-2.1-3.5-2.1-8.2Z"/><path d="M10 21a2.3 2.3 0 0 0 4 0M12 2.5v-1"/>',
  person:'<circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><path d="M3 21c.6-4.7 4.1-7.2 9-7.2s8.4 2.5 9 7.2" fill="currentColor" stroke="none"/>',
  grid:'<rect x="2" y="2" width="8" height="8" rx="1.5" fill="#244479" stroke="none"/><rect x="14" y="2" width="8" height="8" rx="1.5" fill="#31598e" stroke="none"/><rect x="2" y="14" width="8" height="8" rx="1.5" fill="#2373ff" stroke="none"/><rect x="14" y="14" width="8" height="8" rx="1.5" fill="#1555ed" stroke="none"/>'
 });
 const svg=(key,extra={})=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[key]||extra[key]||paths.file)+'</svg>';
 // A compact vector vocabulary for navigation, separate from the large card illustrations.
 const sidebarKeys=new Set('home incident risk tbm organization training msds support system policy law voice emergency ppe ergonomics rules favorites history approvals notices documents dashboard bulletins schedule'.split(' '));
 function sidebarIcon(key,custom){
  const id=sidebarKeys.has(key)?key:'module';
  const use='<use href="assets/sidebar-pictograms-r58.svg#'+id+'"/>';
  const glyph=custom?'<g transform="translate(0 1) scale(.74)">'+use+'</g><text x="23" y="22" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" font-weight="800" fill="currentColor" stroke="none">'+custom+'</text>':use;
  return '<svg class="hub-nav-picto" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</svg>';
 }
 const descriptions={incident:'사고 발생 시<br>신속한 보고 및 관리',risk:'작업 공정별 위험요인<br>발굴 및 개선관리',tbm:'작업 전 안전회의<br><span>(Tool Box Meeting) 관리</span>',organization:'안전보건 조직 및<br>역할 책임 관리',training:'법정 직무 특별교육의<br>계획, 운영, 이력관리',msds:'화학물질정보<br>(MSDS) 등록 관리',support:'전자결재, 문서관리,<br>기준정보 등 공통업무 지원',system:'사용자, 권한, 코드,<br>환경설정 등 시스템 운영'};
 const safetyIcons={policy:'방침과 목표',law:'법령 요지',voice:'의견 청취',emergency:'비상 대응',ppe:'보호구',ergonomics:'근골격계 조사',rules:'관리규정'};
 Object.assign(descriptions,{policy:'방침 및 추진 목표',law:'주요 법령 확인',voice:'의견 접수 및 조치',emergency:'비상계획 및 훈련',ppe:'지급 내역 및 점검',ergonomics:'부담작업 조사',rules:'규정 및 개정 이력'});
 const day=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(d||new Date());
 const time=v=>v?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)):'';
 const date=v=>v?day(new Date(v)).replaceAll('-','.'):'';
 function relative(v){const t=Date.parse(v);if(!Number.isFinite(t))return '';const m=Math.max(0,Math.floor((Date.now()-t)/60000));return m<1?'방금 전':m<60?m+'분 전':m<1440?Math.floor(m/60)+'시간 전':date(v)}
 function dialog(host,title){const d=document.createElement('dialog');d.className='hub-dialog';d.innerHTML='<header><h2>'+safe(title)+'</h2><button type="button" aria-label="닫기">×</button></header><div class="hub-dialog-body"></div>';host.append(d);d.querySelector('header button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();return d;}
 const artworkCells={incident:0,risk:1,tbm:2,organization:3,training:4,msds:5,support:6,system:7};
 let artworkImage,stopArtwork=()=>{};
 function loadArtwork(){
  if(!artworkImage)artworkImage=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{artworkImage=null;reject(new Error('artwork_load_failed'))};im.src='assets/hub-icons-r43.png'});
  return artworkImage;
 }
 function renderArtwork(host){
  stopArtwork();let stopped=false,frame=0,observer,ratioQuery;
  const nodes=Array.from(host.querySelectorAll('.hub-art'));
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint)};
  function watchRatio(){ratioQuery?.removeEventListener('change',onRatio);ratioQuery=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');ratioQuery.addEventListener('change',onRatio)}
  function onRatio(){watchRatio();schedule()}
  async function paint(){
   let im;try{im=await loadArtwork()}catch{return}
   if(stopped||!host.isConnected)return;
   const dpr=window.devicePixelRatio||1,cell=im.naturalWidth/3;
   // Keep both hover steps on physical pixels at fractional screen scales.
   host.style.setProperty('--hub-hover-lift',(-2*Math.max(1,Math.round(dpr))/dpr)+'px');
   for(const node of nodes){
    if(!node.isConnected)continue;
    const key=Object.keys(artworkCells).find(k=>node.classList.contains('hub-art-'+k));if(key===undefined)continue;
    const width=node.getBoundingClientRect().width;if(!width)continue;
    const physical=Math.max(1,Math.round(width*dpr)),size=physical/dpr;
    const pixels=Math.max(physical,Math.round(size*2)); // At least 2x sampling, including ordinary desktop displays.
    let canvas=node.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');node.append(canvas)}
    canvas.width=pixels;canvas.height=pixels;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const n=artworkCells[key];ctx.drawImage(im,(n%3)*cell,Math.floor(n/3)*cell,cell,cell,0,0,pixels,pixels);
    // Align the finished bitmap to physical pixels; avoid a transformed raster layer.
    node.classList.add('hub-art-ready');const rect=node.getBoundingClientRect();
    canvas.style.width=size+'px';canvas.style.height=size+'px';
    canvas.style.left=(Math.round(rect.left*dpr)/dpr-rect.left)+'px';
    canvas.style.top=(Math.round((rect.top-size/2)*dpr)/dpr-rect.top)+'px';
   }
  }
  observer=new ResizeObserver(schedule);nodes.forEach(n=>{observer.observe(n);if(n.parentElement)observer.observe(n.parentElement)});
  window.addEventListener('resize',schedule);watchRatio();schedule();
  stopArtwork=()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);ratioQuery?.removeEventListener('change',onRatio)};
 }
 function decorateCard(row,m,support){if(support&&m.key!=='system')return;
  const b=row.querySelector('.platform-card'),icon=b.querySelector('.platform-icon');icon.className='hub-art hub-art-'+m.key;icon.replaceChildren();
  const art=m.iconKey||m.key;
  if(Object.hasOwn(safetyIcons,art)){
   row.classList.add('hub-safety-card');
   icon.className='hub-art hub-safety-art';
   const img=document.createElement('img');img.src='assets/safety-cards/'+art+'.webp';img.alt='';img.width=320;img.height=320;icon.append(img);
  }
  if(row.dataset.state==='live' && row.dataset.on==='true')b.querySelector('small').textContent='운영중';
  b.querySelector('strong').classList.add('hub-card-title');
  b.insertAdjacentHTML('beforeend','<span class="hub-card-description">'+(descriptions[m.key]||'')+'</span><span class="hub-card-arrow" aria-hidden="true">'+svg('arrow')+'</span>');
 }
 let stopBanner=()=>{};
 function startBanner(host){
  stopBanner();const hero=host.querySelector('.hub-hero'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,position=1,moving=false,pendingAuto=false,timer=0,settleTimer=0,frame=0,stopped=false,touch=null;
  if(!hero.enlOriginalBanner)hero.enlOriginalBanner=Array.from(hero.children).map(n=>n.cloneNode(true));
  const slides=window.ENLBanners?.resolve(host.bannerConfig)||[null];
  hero.hidden=!slides.length;if(!slides.length)return;
  hero.classList.add('hub-carousel');hero.setAttribute('aria-label','안전보건 안내 배너');hero.setAttribute('aria-roledescription','슬라이드');hero.tabIndex=0;
  const track=document.createElement('div');track.className='hub-banner-track no-motion';
  for(const s of slides){
   const slide=document.createElement('section');slide.className='hub-banner-slide';
   if(!s){slide.classList.add('hub-slide-original');slide.append(...hero.enlOriginalBanner.map(n=>n.cloneNode(true)))}
   else if(s.url){slide.classList.add('hub-slide-upload');const img=document.createElement('img');img.className='hub-uploaded-banner';img.src=s.url;img.alt=s.title;img.style.objectFit=s.fit;slide.append(img)}
   else {slide.classList.add('hub-slide-campaign');if(s.image)slide.classList.add('hub-slide-scene');slide.dataset.campaign=s.key;
    slide.innerHTML=(s.image?'<img class="hub-campaign-background" src="assets/banners/'+s.image+'" alt="" width="2172" height="724" decoding="async">':'')+
     '<div class="hub-campaign-copy"><small>'+safe(s.eyebrow||'SAFE WORKPLACE')+'</small><h2>'+safe(s.title)+'</h2><p>'+safe(s.body)+'</p></div>'+
     (s.art?'<img class="hub-campaign-art" src="assets/safety-cards/'+s.art+'.webp" width="320" height="320" alt="">':'');
   }track.append(slide);
  }
  const first=track.firstElementChild.cloneNode(true);track.prepend(track.lastElementChild.cloneNode(true));track.append(first);
  const controls=document.createElement('div');controls.className='hub-banner-controls';controls.hidden=slides.length<2;
  controls.innerHTML='<button type="button" data-prev aria-label="이전 배너"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div data-dots aria-label="배너 선택"></div><button type="button" data-next aria-label="다음 배너"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>';
  hero.replaceChildren(track,controls);
  const nodes=Array.from(track.children);
  slides.forEach((_,n)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(n+1)+' / '+slides.length+'번 배너 보기');b.onclick=()=>move(n,n-index);controls.querySelector('[data-dots]').append(b)});
  function paint(){
   hero.dataset.slide=String(index);hero.dataset.slideCount=String(slides.length);
   track.style.transform='translate3d('+(-position*100)+'%,0,0)';
   nodes.forEach((node,n)=>{node.inert=n!==index+1;node.setAttribute('aria-hidden',String(n!==index+1));if(n>0&&n<=slides.length)node.setAttribute('aria-label',n+' / '+slides.length)});
   controls.querySelectorAll('[data-dots] button').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===index)));
  }
  function finish(){
   clearTimeout(settleTimer);if(stopped)return;
   if(position===0||position===slides.length+1){position=index+1;track.classList.add('no-motion');paint();void track.offsetWidth;}
   moving=false;track.classList.toggle('no-motion',motion.matches);
   if(pendingAuto){pendingAuto=false;move(index+1,1)}
  }
  function move(next,direction){
   if(stopped||moving)return;
   const target=(next+slides.length)%slides.length;if(target===index)return;
   position=direction>0&&index===slides.length-1&&target===0?slides.length+1:direction<0&&index===0&&target===slides.length-1?0:target+1;
   index=target;moving=!motion.matches;track.classList.toggle('no-motion',motion.matches);paint();
   if(moving)settleTimer=setTimeout(finish,850);else finish();
  }
  track.addEventListener('transitionend',e=>{if(e.target===track&&e.propertyName==='transform')finish()});
  function tick(){
   if(!host.isConnected){stop();return}
   if(!document.hidden&&(!host.dataset.workspace||host.dataset.workspace==='home')){
    if(moving)pendingAuto=true;else move(index+1,1);
   }
  }
  controls.querySelector('[data-prev]').onclick=()=>move(index-1,-1);controls.querySelector('[data-next]').onclick=()=>move(index+1,1);
  hero.onpointerenter=null;hero.onpointerleave=null;
  hero.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(index+(e.key==='ArrowLeft'?-1:1),e.key==='ArrowLeft'?-1:1)}};
  hero.onpointerdown=e=>{touch=e.pointerType==='touch'&&!e.target.closest('button,a')?{x:e.clientX,y:e.clientY}:null};
  hero.onpointerup=e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)move(index+(dx<0?1:-1),dx<0?1:-1)};
  hero.onpointercancel=()=>{touch=null};
  const reduce=()=>{finish();track.classList.toggle('no-motion',motion.matches)};motion.addEventListener('change',reduce);
  function stop(){stopped=true;clearInterval(timer);clearTimeout(settleTimer);cancelAnimationFrame(frame);motion.removeEventListener('change',reduce)}
  stopBanner=stop;paint();frame=requestAnimationFrame(()=>{if(!stopped)track.classList.toggle('no-motion',motion.matches)});if(slides.length>1)timer=setInterval(tick,10000);
 }
 function mount(host,u,{go,icons,names,featureName,manageCards}){
  const admin=u.role==='safety',userKey=JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);let catalog=null,content={notices:[],events:[],favorites:[]},loaded=false,contentError='',recent=[],recentError='',busy=false;
  const sameUser=()=>{const a=currentUser?.();return a&&JSON.stringify([a.id||a.personnelId,a.role,a.siteId||''])===userKey&&host.isConnected};
  const action=(key,label,cls='')=>'<button type="button" class="'+cls+'" data-hub="'+key+'"'+(key==='notifications'?' aria-label="알림센터"':key==='menu'?' aria-label="메뉴 열기"':key==='search'?' aria-label="통합검색"':'')+'>'+label+'</button>';
  const panel=(key,title,icon,more)=>'<section class="hub-panel hub-'+key+'"><header><h2>'+svg(icon,icons)+title+'</h2>'+action(key,more||'더보기 ›')+'</header><div data-list="'+key+'"><p class="hub-empty">불러오는 중입니다.</p></div></section>';
  host.innerHTML='<aside class="hub-sidebar"><div class="hub-logo"><img src="assets/enl-wordmark.svg" width="102" height="52" alt="이앤엘 E&amp;L"></div><nav aria-label="통합시스템 메뉴"></nav><section class="hub-favorites"><header><h2>'+sidebarIcon('favorites')+'즐겨찾기</h2>'+action('favorites','＋')+'</header><div></div></section><div class="hub-sidebar-wave" aria-hidden="true"></div></aside><button class="hub-sidebar-backdrop" type="button" data-hub="close-menu" aria-label="메뉴 닫기"></button><section class="hub-hero"><div class="hub-hero-image" role="img" aria-label="골프장 풍경과 이앤엘 문구: 안전이 일상이 되는 안전보건관리 통합시스템"></div><div class="hub-welcome"><h2>'+safe(u.name||'사용자')+' 님, 환영합니다!</h2><p>이앤엘 안전보건관리 통합시스템에서<br>사업장의 안전과 건강한 일터를 함께 만들어갑니다.</p></div></section><div class="hub-middle"><section class="hub-features"><header class="hub-section-heading"><h2>'+svg('grid')+'주요 업무기능</h2><p>안전보건 업무를 한 곳에서 통합 관리하세요.</p>'+action('guide','ⓘ 모듈 안내')+(admin?action('manage-cards','카드 관리','hub-card-manager')+action('edit','편집','hub-edit-toggle'):'')+'</header><div class="platform-modules feature-list"></div></section><div class="hub-right">'+panel('recent','최근 업무 기록','clock')+panel('approvals','통합결재 대기 <span data-approval-count></span>','approvals')+'</div></div><div class="hub-bottom">'+panel('bulletins','공지사항','notice')+panel('schedule','오늘의 일정 <small>'+safe(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date()))+'</small>','calendar','전체 일정 ›')+'</div><p class="hub-status" role="status" aria-live="polite"></p><section class="hub-support hub-tool-panel" hidden><h2>공통업무지원서비스</h2><section class="platform-services feature-list"><div class="platform-grid"></div></section></section><section class="hub-module-preview hub-tool-panel" hidden><h2></h2><p>이 업무의 세부 기능은 구현 중입니다.</p></section>';
  const area=host.querySelector('.platform-modules'),services=host.querySelector('.platform-services .platform-grid'),status=host.querySelector('.hub-status');
  const recentLink=host.querySelector('[data-hub=recent]');
  recentLink.hidden=!window.enlHistoryAvailable?.(u);
  recentLink.dataset.recentHistory='';recentLink.dataset.historyScope='all';
  function bindHeader(){
   const topbar=host.closest('.app-shell')?.querySelector('.topbar');
   if(!topbar)return;
   cleanup();
   const avatar=topbar.querySelector('.user-chip .avatar');
   if(avatar)avatar.innerHTML=svg('person');
   topbar.querySelector('.user-chip')?.setAttribute('aria-label',(u.name||'사용자')+' 계정 메뉴');
   topbar.querySelector('.topbar-tools').insertAdjacentHTML('beforeend',action('search',svg('search')+'<span>업무, 문서, 교육, 사고 등 통합검색</span><kbd>Ctrl + K</kbd>','hub-search')+action('notifications',svg('bell'),'hub-bell'));
   topbar.querySelector('.brand').insertAdjacentHTML('beforebegin',action('menu','☰','hub-mobile-menu'));
   topbar.querySelectorAll('[data-hub]').forEach(b=>b.onclick=()=>dispatch(b.dataset.hub));
  }
  bindHeader();
  function items(){return catalog?[...catalog.modules,...catalog.services]:[];}
  const entry=key=>items().find(x=>x.key===key);
  async function allowed(key){const m=entry(key);if(!m||m.enabled===false||m.state==='hidden'||m.canEnter===false||m.state!=='live'&&!m.preview){status.textContent='현재 접근할 수 없는 업무입니다.';return false}try{await api({action:'platform_enter',key});return sameUser()}catch{status.textContent='접근 권한 또는 연결 상태를 확인해 주세요.';return false}}
  function clickFeature(key){return selectTab(key);}
  function support(){return selectTab('support');}
  function addSupportCard(grid){const r=document.createElement('article');r.className='hub-support-card feature-card-wrap';r.dataset.key='support';r.dataset.state='live';r.dataset.on='true';r.innerHTML=action('support','<span class="hub-art hub-art-support" aria-hidden="true"></span><strong class="hub-card-title">공통업무지원<wbr>서비스</strong><span class="hub-card-description">'+descriptions.support+'</span><small>운영중</small><span class="hub-card-arrow" aria-hidden="true">'+svg('arrow')+'</span>','platform-card');r.firstElementChild.onclick=support;grid.append(r);return r}
  // Tab membership belongs to this signed-in dashboard and disappears with it on logout.
  const opened=['home'];
  const builtins={home:'통합 홈',support:'공통업무지원서비스',bulletins:'공지사항',schedule:'전체 일정',recent:'최근 업무 기록',inquiry:admin?'문의함':'안전관리자 문의'};
  let stripSignature='';
  let active='home',request=0,incidentView='',inquiryOrigin='home';
  const strip=document.createElement('nav');
  strip.className='hub-worktabs';strip.setAttribute('aria-label','열린 업무');
  function tabTitle(key){
    if(Object.hasOwn(builtins,key))return builtins[key];
    const m=entry(key);return m?featureName(m):(names[key]||key);
  }
  function paintTabs(){
    const header=host.closest('.app-shell')?.querySelector('.topbar');
    if(!header)return;
    if(header.nextElementSibling!==strip)header.after(strip);
    host.querySelectorAll('.hub-sidebar nav [data-hub]').forEach(b=>{
      b.classList.toggle('on',b.dataset.hub===(['home','support'].includes(active)?active:'feature:'+active));
    });
    const signature=JSON.stringify([active,opened.map(k=>[k,tabTitle(k)])]);
    if(signature===stripSignature)return;
    stripSignature=signature;
    const hadFocus=strip.contains(document.activeElement);
    strip.replaceChildren();
    for(const key of opened){
      const item=document.createElement('div'),pick=document.createElement('button');
      item.className='hub-worktab';pick.type='button';pick.dataset.worktab=key;
      pick.innerHTML=sidebarIcon(sidebarKeys.has(key)?key:entry(key)?.iconKey)+'<span>'+safe(tabTitle(key))+'</span>';
      if(active===key){item.classList.add('selected');pick.setAttribute('aria-current','page');}
      pick.onclick=()=>selectTab(key);item.append(pick);
      if(key!=='home'){
        const close=document.createElement('button');close.type='button';close.className='hub-tab-close';
        close.setAttribute('aria-label',tabTitle(key)+' 탭 닫기');close.textContent='×';
        close.onclick=()=>closeTab(key);item.append(close);
      }
      strip.append(item);
    }
    const picked=strip.querySelector('[aria-current="page"]');
    if(hadFocus)picked?.focus({preventScroll:true});
    if(picked){const a=picked.parentElement.getBoundingClientRect(),b=strip.getBoundingClientRect();if(a.right>b.right)strip.scrollLeft+=a.right-b.right+8;else if(a.left<b.left)strip.scrollLeft+=a.left-b.left-8;}
  }
  function canLeave(){
    const changed=document.querySelector('#view [data-worktab-edited],#view [data-wf440-dirty="1"]');
    if(window.enlIncidentSaveInProgress?.()){
      alert('저장 중입니다. 저장이 끝나면 탭을 이동해 주세요.');return false;
    }
    return !changed||confirm('작성 중인 내용이 있어요. 현재 화면을 벗어날까요?');
  }
  function placeFrame(view){
    const atHome=active==='home';
    if(atHome&&host.dataset.workspace&&host.dataset.workspace!=='home')host.reloadCatalog?.();
    host.classList.toggle('hub-incident-workspace',!atHome);
    host.dataset.workspace=active;
    if(atHome){if(host.parentElement!==view)view.replaceChildren(host);}
    else if(host.nextElementSibling!==view)view.before(host);
    host.querySelector('.hub-support').hidden=active!=='support';
    const preview=host.querySelector('.hub-module-preview');
    preview.hidden=Object.hasOwn(builtins,active)||['incident','system','history','notices','approvals'].includes(active);
    for(const panel of host.querySelectorAll('[data-list-workspace]'))panel.hidden=panel.dataset.listWorkspace!==active;
    if(!preview.hidden)preview.querySelector('h2').textContent=tabTitle(active);
    paintTabs();
  }
  function showTab(key,historyScope='all'){
    const view=host.closest('.app-shell').querySelector('#view');
    if(active==='incident')incidentView=currentView;
    if(key==='inquiry')inquiryOrigin=active;
    if(!opened.includes(key))opened.push(key);
    active=key;host.classList.remove('hub-menu-open','hub-editing');
    host.querySelector('.hub-edit-toggle')?.replaceChildren('편집');
    status.textContent='';
    placeFrame(view);
    const native={home:'platform',system:'system-admin',history:'common-history',recent:'history',inquiry:['field','worker'].includes(u.role)?'field-inquiry':'inquiry',notices:'notice-center',incident:incidentView||(['field','worker'].includes(u.role)?'home':'stats')};
    if(key==='history'||key==='recent')window.enlRequestHistory?.(historyScope);
    go(native[key]||'platform-tool');
    if(key==='approvals')approvalWorkspace();
    if(key==='bulletins'||key==='schedule')listContent(key==='bulletins'?'notice':'event');
    if(key==='home'){renderArtwork(host);loadContent();loadRecent();loadBanners();}
    window.scrollTo(0,0);
  }
  async function selectTab(key,closing=false,historyScope='all'){
    if(key==='recent'&&!window.enlHistoryAvailable?.(u))return false;
    const token=++request;
    if(key===active){host.classList.remove('hub-menu-open');return true;}
    if(!Object.hasOwn(builtins,key)&&!(await allowed(key))){
      if(!closing)return false;
      key='home';
    }
    if(token!==request||!sameUser()||!canLeave())return false;
    showTab(key,historyScope);return true;
  }
  async function closeTab(key){
    if(key==='home')return;
    const index=opened.indexOf(key);if(index<0)return;
    if(key===active){
      const next=key==='inquiry'&&opened.includes(inquiryOrigin)?inquiryOrigin:key==='recent'?'home':opened[index-1];
      if(!await selectTab(next,true))return;
    }else ++request;
    const remove=opened.indexOf(key);if(remove<0||active===key)return;
    opened.splice(remove,1);
    if(key==='incident')incidentView='';
    paintTabs();strip.querySelector('[aria-current]')?.focus({preventScroll:true});
  }
  host.activateWorkTab=selectTab;
  host.leaveInquiry=()=>selectTab(opened.includes(inquiryOrigin)?inquiryOrigin:'home');
  host.syncWorkView=(view,actor)=>{
    if(JSON.stringify([actor.id||actor.personnelId,actor.role,actor.siteId||''])!==userKey)return;
    const fixed={platform:'home',history:'recent',inquiry:'inquiry','field-inquiry':'inquiry','common-history':'history','notice-center':'notices','system-admin':'system',more:'system'};
    const next=fixed[currentView]||(currentView==='platform-tool'?active:'incident');
    if(!opened.includes(next))opened.push(next);
    active=next;placeFrame(view);
  };
  host.restoreIncidentFrame=(view,actor)=>{
    if(JSON.stringify([actor.id||actor.personnelId,actor.role,actor.siteId||''])!==userKey)return;
    view.closest('.app-shell').enlWorkspaceFrame=host;
    view.before(host);host.syncWorkView(view,actor);bindHeader();
  };
  paintTabs();
  function menuPictogram(key){
    if(sidebarKeys.has(key))return sidebarIcon(key);
    const customModules=catalog.modules.filter(m=>!sidebarKeys.has(m.key)).sort((a,b)=>a.key.localeCompare(b.key));
    return sidebarIcon(entry(key)?.iconKey,customModules.findIndex(m=>m.key===key)+1);
  }
  let sidebarDraft=null, sidebarRevision=0, moving='', savingSidebar=false;
  const sidebar=host.querySelector('.hub-sidebar');
  const editPanel=document.createElement('div');
  if(admin){
    editPanel.className='hub-sidebar-editor';
    editPanel.innerHTML='<button type="button" data-edit>편집모드</button><button type="button" data-cancel hidden>취소</button><small role="status"></small>';
    sidebar.querySelector('.hub-favorites').after(editPanel);
    editPanel.querySelector('[data-edit]').onclick=async()=>{
      if(!catalog||savingSidebar)return;
      if(!sidebarDraft){
        sidebarRevision=catalog.revision;sidebarDraft=[...(catalog.sidebarOrder||catalog.homeOrder)];
        navigation();return;
      }
      savingSidebar=true;navigation();
      try{
        const next=[...sidebarDraft];
        const r=await api({action:'platform_sidebar_order',order:next,revision:sidebarRevision});
        if(!sameUser())return;
        catalog.sidebarOrder=next;catalog.revision=r.revision;sidebarDraft=null;
        editPanel.querySelector('small').textContent='순서를 저장했습니다.';
        await host.reloadCatalog();
      }catch(err){
        if(err.message==='catalog_changed'){
          sidebarDraft=null;await host.reloadCatalog();
          editPanel.querySelector('small').textContent='다른 변경을 불러왔습니다. 다시 편집해 주세요.';
        }else editPanel.querySelector('small').textContent='저장에 실패했습니다. 다시 시도해 주세요.';
      }finally{savingSidebar=false;navigation();}
    };
    editPanel.querySelector('[data-cancel]').onclick=()=>{sidebarDraft=null;editPanel.querySelector('small').textContent='';navigation();};
  }
  const inquiry=document.createElement('button');
  inquiry.type='button';inquiry.className='hub-inquiry';inquiry.dataset.wfInquirySidebar='';
  inquiry.textContent=builtins.inquiry;inquiry.onclick=()=>selectTab('inquiry');sidebar.append(inquiry);
  function moveSidebar(key,target){
    if(!sidebarDraft||savingSidebar)return;
    const from=sidebarDraft.indexOf(key),to=sidebarDraft.indexOf(target);
    if(from<0||to<0||from===to)return;
    sidebarDraft.splice(to,0,sidebarDraft.splice(from,1)[0]);navigation();
  }
  function navigation(){
    const nav=sidebar.querySelector('nav');
    nav.innerHTML=action('home',sidebarIcon('home')+'<span>홈</span>',active==='home'?'on':'');
    nav.firstElementChild.onclick=()=>dispatch('home');
    if(admin){
      const edit=editPanel.querySelector('[data-edit]'),cancel=editPanel.querySelector('[data-cancel]');
      edit.textContent=sidebarDraft?'순서 저장':'편집모드';edit.disabled=!catalog||savingSidebar;
      edit.setAttribute('aria-pressed',String(!!sidebarDraft));cancel.hidden=!sidebarDraft;cancel.disabled=savingSidebar;
    }
    const order=sidebarDraft||catalog?.sidebarOrder||catalog?.homeOrder||[];
    for(const [i,key] of order.entries()){
      const m=entry(key),support=key==='support';
      const hidden=catalog.omitted?.includes(key)||m?.state==='hidden';
      if((!m&&!support)||(!admin&&hidden))continue;
      const label=menuPictogram(key)+'<span>'+safe(support?'공통업무지원서비스':featureName(m))+'</span>';
      const row=document.createElement('div');row.className='hub-sidebar-row';
      row.innerHTML=action(support?key:'feature:'+key,label,active===key?'on':'');
      const button=row.firstElementChild;
      if(hidden){row.classList.add('is-hidden');button.insertAdjacentHTML('beforeend','<small>숨김</small>');}
      if(hidden||sidebarDraft){button.setAttribute('aria-disabled','true');}
      else button.onclick=()=>dispatch(button.dataset.hub);
      if(sidebarDraft){
        row.classList.add('is-editing');row.draggable=!savingSidebar;
        row.ondragstart=e=>{moving=key;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',key);};
        row.ondragover=e=>{if(moving){e.preventDefault();e.dataTransfer.dropEffect='move';}};
        row.ondrop=e=>{e.preventDefault();moveSidebar(moving,key);moving='';};row.ondragend=()=>moving='';
        for(const [offset,symbol,name] of [[-1,'↑','위로'],[1,'↓','아래로']]){
          const step=document.createElement('button');step.type='button';step.textContent=symbol;step.className='hub-order-step';
          step.disabled=savingSidebar||!order[i+offset];step.setAttribute('aria-label',button.textContent+' '+name);
          step.onclick=()=>moveSidebar(key,order[i+offset]);row.append(step);
        }
      }
      nav.append(row);
    }
    paintFavorites();
  }
  function favoriteChoices(){return [...items().filter(m=>m.state!=='hidden'&&!catalog?.omitted?.includes(m.key)&&(m.key!=='system'||admin)).map(m=>({key:m.key,title:featureName(m)})),{key:'bulletins',title:'공지사항'},{key:'schedule',title:'전체 일정'}]}
  function paintFavorites(){const box=host.querySelector('.hub-favorites>div'),choices=favoriteChoices();box.replaceChildren();for(const key of content.favorites){const x=choices.find(v=>v.key===key);if(!x)continue;const b=document.createElement('button');b.type='button';b.innerHTML=menuPictogram(key)+'<span>'+safe(x.title)+'</span>';b.onclick=()=>dispatch(['bulletins','schedule'].includes(key)?key:'feature:'+key);box.append(b)}if(!box.children.length)box.innerHTML='<p>자주 쓰는 메뉴를 추가하세요.</p>'}
  function favorites(){const d=dialog(host,'즐겨찾기 설정'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<form class="hub-form">'+favoriteChoices().map(x=>'<label class="hub-check"><input type="checkbox" name="favorite" value="'+x.key+'" '+(content.favorites.includes(x.key)?'checked':'')+'>'+safe(x.title)+'</label>').join('')+'<button type="submit">저장</button><p role="status"></p></form>';box.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,b=form.querySelector('button');b.disabled=true;try{const favorites=Array.from(form.querySelectorAll(':checked'),x=>x.value);await api({action:'platform_hub_favorites',favorites});if(!sameUser())return;content.favorites=favorites;paintFavorites();d.close()}catch{form.querySelector('[role=status]').textContent='저장하지 못했습니다. 다시 시도해 주세요.'}finally{b.disabled=false}}}
  function scopedIncidents(){return (data.incidents||[]).filter(i=>!i.bulkInvalidation?.active&&(!['field','worker'].includes(u.role)||String(i.siteId)===String(u.siteId)))}
  function approvals(){const m=entry('incident');if(!m||m.enabled===false||m.state!=='live'||m.canEnter===false)return [];return scopedIncidents().filter(i=>i.status!=='closed'&&(u.role==='safety'?!!window.enlSafetyWork?.(i)?.report||i.corrective?.status==='submitted':u.role==='executive'?window.ENLExecutiveApproval?.canDecide(i.executiveApproval,u.id):false))}
  async function openIncident(id){if(!await allowed('incident'))return;const i=scopedIncidents().find(x=>x.id===id);if(!i){status.textContent='현재 조회할 수 없는 사고입니다.';return}host.querySelectorAll('dialog[open]').forEach(d=>d.close());if(window.enlOpenIncidentReview)window.enlOpenIncidentReview(id,u.role==='safety',u);else if(typeof openIncidentModal==='function')openIncidentModal(id,u.role==='safety',u);else go('incidents');}
  function rowButton(box,title,detail,callback,icon='file'){const b=document.createElement('button');b.type='button';b.className='hub-data-row';b.innerHTML=svg(icon)+'<strong>'+safe(title)+'</strong><time>'+safe(detail)+'</time>';b.onclick=callback;box.append(b);return b}
  const approvalCategories={all:'전체',incident:'사고보고',risk:'위험성평가',tbm:'TBM',organization:'안전보건조직',training:'안전보건교육'};
  function approvalBody(box,compact=false){
    const selected=box.dataset.category||'all';box.replaceChildren();
    const tabs=document.createElement('nav');tabs.className='hub-category-tabs';tabs.setAttribute('aria-label','결재 업무 분류');
    for(const [key,label] of Object.entries(approvalCategories)){
      const b=document.createElement('button');b.type='button';b.dataset.approvalCategory=key;
      b.textContent=label+(['all','incident'].includes(key)?' '+approvals().length:' / 준비 중');b.setAttribute('aria-pressed',String(key===selected));
      b.onclick=()=>{box.dataset.category=key;approvalBody(box,compact)};tabs.append(b);
    }
    box.append(tabs);const rows=document.createElement('div');box.append(rows);
    if(!['all','incident'].includes(selected)){rows.innerHTML='<p class="hub-empty">'+safe(approvalCategories[selected])+' 결재 기능은 준비 중입니다.</p>';return;}
    const pending=approvals();
    for(const i of (compact?pending.slice(0,3):pending))rowButton(rows,'[사고보고] '+(siteById(i.siteId)?.name||'')+' '+(i.eventType||'사고보고'),relative(i.updatedAt),()=>openIncident(i.id));
    if(!pending.length)rows.innerHTML='<p class="hub-empty">본인에게 배정된 결재 대기 업무가 없습니다.</p>';
  }
  function paintApprovals(){host.querySelector('[data-approval-count]').textContent=approvals().length+'건';approvalBody(host.querySelector('[data-list=approvals]'),true);const box=host.querySelector('[data-list-workspace=approvals] [data-approval-list]');if(box)approvalBody(box)}
  function approvalWorkspace(){let panel=host.querySelector('[data-list-workspace=approvals]');if(!panel){panel=document.createElement('section');panel.className='hub-tool-panel';panel.dataset.listWorkspace='approvals';panel.innerHTML='<div class="section-head"><h2>통합결재 대기</h2><button type="button">새로고침</button></div><p>본인에게 배정된 결재를 업무별로 확인합니다.</p><div data-approval-list></div>';host.append(panel);panel.querySelector('button').onclick=async()=>{const b=panel.querySelector('button');b.disabled=true;try{await window.enlIncidentPullNow?.(false);if(sameUser())paintApprovals()}finally{b.disabled=false}}}panel.hidden=false;approvalBody(panel.querySelector('[data-approval-list]'))}
  function openApprovalList(){return selectTab('approvals')}
  function paintRecent(){const box=host.querySelector('[data-list=recent]');box.replaceChildren();for(const r of recent.slice(0,4))rowButton(box,r.sentence||r.incident_title,relative(r.happened_at),()=>openActivity(r));if(!recent.length)box.innerHTML='<p class="hub-empty">'+safe(recentError||'최근 업무 기록이 없습니다.')+'</p>'}
  function openActivity(r){const d=dialog(host,'작업 기록'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<p>'+safe(r.sentence)+'</p><p>'+safe(r.actor_name||'')+' / '+safe(date(r.happened_at))+' '+safe(time(r.happened_at))+'</p>';if(r.module_key==='incident'&&scopedIncidents().some(i=>i.id===r.incident_id)){const b=document.createElement('button');b.textContent='사고 내용 보기';b.onclick=()=>openIncident(r.incident_id);box.append(b)}}
  async function loadRecent(){recentLink.hidden=!window.enlHistoryAvailable?.(u);if(recentLink.hidden){recentError='조회 가능한 작업 기록이 없습니다.';paintRecent();return}try{const r=await api({action:'activity_list',feed:'all'});if(!sameUser())return;recent=r.rows||[];recentError=''}catch{recentError='작업 기록을 불러오지 못했습니다.'}if(sameUser())paintRecent()}
  function paintContent(){for(const [kind,rows] of [['bulletins',content.notices],['schedule',content.events.filter(x=>day(new Date(x.starts_at))<=day()&&day(new Date(x.ends_at||x.starts_at))>=day())]]){const box=host.querySelector('[data-list='+kind+']');box.replaceChildren();for(const x of rows.slice(0,4)){const b=rowButton(box,x.title,kind==='bulletins'?date(x.created_at):time(x.starts_at)+' ~ '+time(x.ends_at),()=>readContent(x),kind==='bulletins'?'notice':'calendar');if(kind==='bulletins'){b.classList.add('hub-notice-row');b.querySelector('svg').outerHTML='<span class="hub-tag '+safe(x.label)+'">'+({important:'중요',info:'안내',general:'일반'}[x.label]||'안내')+'</span>'}else b.classList.add('hub-event-row')}
   if(!rows.length)box.innerHTML='<p class="hub-empty">'+safe(contentError||(loaded?(kind==='bulletins'?'등록된 공지사항이 없습니다.':'오늘 등록된 일정이 없습니다.'):'불러오는 중입니다.'))+'</p>';
  }paintFavorites()}
  async function loadContent(){try{const r=await api({action:'platform_hub'});if(!sameUser())return;content={notices:r.notices||[],events:r.events||[],favorites:r.favorites||[]};loaded=true;contentError=''}catch{contentError='자료를 불러오지 못했습니다. 더보기에서 다시 시도하세요.'}if(sameUser())paintContent()}
  function readContent(x){const d=dialog(host,x.kind==='notice'?'공지사항':'일정 상세'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<h3>'+safe(x.title)+'</h3><p class="hub-detail-meta">'+safe(x.site_name||'전체 사업장')+' / '+safe(x.kind==='notice'?date(x.created_at):date(x.starts_at)+' '+time(x.starts_at)+' ~ '+time(x.ends_at))+'</p><p class="hub-detail-body">'+safe(x.body)+'</p>'+(admin?action('edit-content','수정'):'');if(admin)box.querySelector('button').onclick=()=>{d.close();editContent(x)}}
  function editContent(item){const kind=item.kind,d=dialog(host,(kind==='notice'?'공지사항':'일정')+(item.id?' 수정':' 등록')),box=d.querySelector('.hub-dialog-body');
   box.innerHTML='<form class="hub-form"><label>제목<input name="title" required maxlength="150"></label><label>대상 사업장<select name="site"><option value="">전체 사업장</option></select></label>'+(kind==='notice'?'<label>분류<select name="label"><option value="info">안내</option><option value="important">중요</option><option value="general">일반</option></select></label>':'<label>시작<input name="start" type="datetime-local" required></label><label>종료<input name="end" type="datetime-local" required></label>')+'<label>내용<textarea name="body" rows="5" maxlength="10000"></textarea></label><div class="hub-form-actions"><button type="submit">저장</button>'+(item.id?'<button type="button" data-archive>보관 처리</button>':'')+'</div><p role="status"></p></form>';
   const f=box.querySelector('form'),note=f.querySelector('[role=status]');for(const site of data.sites||[]){const id=site.id||site.site_id,name=site.name||site.site_name;if(id){const opt=new Option(name,id);f.elements.site.add(opt)}}f.elements.title.value=item.title||'';f.elements.body.value=item.body||'';f.elements.site.value=item.site_id||'';
   if(kind==='notice')f.elements.label.value=item.label||'info';else{const local=v=>v?day(new Date(v))+'T'+time(v):day()+'T09:00';f.elements.start.value=local(item.starts_at);f.elements.end.value=item.ends_at?local(item.ends_at):day()+'T10:00'}
   f.onsubmit=async ev=>{ev.preventDefault();if(busy)return;const b={action:'platform_hub_save',id:item.id||null,revision:item.revision,kind,title:f.elements.title.value,body:f.elements.body.value,siteId:f.elements.site.value,label:kind==='notice'?f.elements.label.value:'info',startsAt:kind==='event'?new Date(f.elements.start.value+':00+09:00').toISOString():null,endsAt:kind==='event'?new Date(f.elements.end.value+':00+09:00').toISOString():null};if(kind==='event'&&b.endsAt<b.startsAt){note.textContent='종료 시각은 시작 시각 이후여야 합니다.';return}busy=true;f.inert=true;try{await api(b);if(!sameUser())return;d.close();await loadContent();if(active==='bulletins'||active==='schedule')listContent(kind);status.textContent='저장했습니다.'}catch(err){note.textContent=err.message==='content_changed'?'다른 변경이 있습니다. 닫은 뒤 다시 조회해 주세요.':'저장하지 못했습니다. 입력과 연결 상태를 확인하세요.'}finally{busy=false;f.inert=false}};
   f.querySelector('[data-archive]')?.addEventListener('click',async()=>{if(busy||!confirm('이 항목을 메인 화면에서 보관 처리할까요? 원본은 서버에 남습니다.'))return;busy=true;f.inert=true;try{await api({action:'platform_hub_archive',id:item.id,revision:item.revision});d.close();await loadContent();if(active==='bulletins'||active==='schedule')listContent(kind)}catch{note.textContent='처리하지 못했습니다. 다시 조회해 주세요.'}finally{busy=false;f.inert=false}});
  }
  async function listContent(kind){let listedEvents=content.events;const key=kind==='notice'?'bulletins':'schedule';
    let d=host.querySelector('[data-list-workspace="'+key+'"]');
    if(!d){d=document.createElement('section');d.className='hub-tool-panel';d.dataset.listWorkspace=key;host.append(d);}
    d.hidden=false;d.innerHTML='<h2>'+tabTitle(key)+'</h2><div></div>';const box=d.lastElementChild;box.innerHTML='<div class="hub-list-tools">'+(admin?action('new','＋ '+(kind==='notice'?'공지 등록':'일정 등록')):'')+action('reload','새로고침')+'</div>'+(kind==='event'?'<label class="hub-date-filter">조회 날짜 <input type="date" value="'+day()+'"></label>':'')+'<div data-content-list></div>';if(admin)box.querySelector('[data-hub=new]').onclick=()=>editContent({kind});const paint=()=>{const target=box.querySelector('[data-content-list]'),selected=box.querySelector('input')?.value;target.replaceChildren();let rows=kind==='notice'?content.notices:listedEvents.filter(x=>!selected||day(new Date(x.starts_at))<=selected&&day(new Date(x.ends_at))>=selected);for(const x of rows)rowButton(target,x.title,kind==='notice'?date(x.created_at):time(x.starts_at)+' ~ '+time(x.ends_at),()=>readContent(x));if(!rows.length)target.innerHTML='<p class="hub-empty">'+safe(contentError||'등록된 항목이 없습니다.')+'</p>'};box.querySelector('input')?.addEventListener('change',async()=>{const selected=box.querySelector('input').value;if(!selected)return;try{const r=await api({action:'platform_hub',date:selected});if(!box.isConnected||!sameUser())return;listedEvents=r.events||[];paint()}catch{box.querySelector('[data-content-list]').textContent='일정을 불러오지 못했습니다.'}});box.querySelector('[data-hub=reload]').onclick=async()=>{if(kind==='event'){const selected=box.querySelector('input').value||day();try{const r=await api({action:'platform_hub',date:selected});listedEvents=r.events||[]}catch{contentError='일정을 불러오지 못했습니다.'}}else await loadContent();if(box.isConnected)paint()};paint();}
  function search(){const d=dialog(host,'통합검색'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<label class="hub-search-label">검색어<input type="search" placeholder="메뉴, 사고, 공지사항, 일정 검색" maxlength="100"></label><p>조회 권한이 있는 현재 자료에서 검색합니다.</p><div data-results></div>';const input=box.querySelector('input'),out=box.querySelector('[data-results]');const paint=()=>{out.replaceChildren();const q=input.value.trim().toLocaleLowerCase();if(!q)return;let count=0;for(const m of items().filter(m=>m.state!=='hidden'&&featureName(m).toLocaleLowerCase().includes(q))){rowButton(out,featureName(m),'업무 메뉴',()=>{d.close();clickFeature(m.key)});count++}if(entry('incident')?.state==='live'&&entry('incident')?.enabled!==false&&entry('incident')?.canEnter!==false)for(const i of scopedIncidents().filter(i=>[i.eventType,i.summary,siteById(i.siteId)?.name].join(' ').toLocaleLowerCase().includes(q)).slice(0,30)){rowButton(out,i.eventType||'사고보고',siteById(i.siteId)?.name||'',()=>openIncident(i.id));count++}for(const x of [...content.notices,...content.events].filter(x=>[x.title,x.body].join(' ').toLocaleLowerCase().includes(q))){rowButton(out,x.title,x.kind==='notice'?'공지사항':'일정',()=>readContent(x));count++}if(!count)out.innerHTML='<p class="hub-empty">검색 결과가 없습니다.</p>'};input.oninput=paint;input.focus()}
  function guide(){const d=dialog(host,'모듈 안내');d.querySelector('.hub-dialog-body').innerHTML='<p>운영 중인 업무는 카드를 눌러 바로 이용할 수 있습니다. 구현 중인 업무는 관리자가 허용한 시험 사용자만 진입합니다.</p><p>공지사항과 일정은 안전관리자가 등록하고 대상 사업장의 사용자에게 공유합니다.</p>'+(admin?'<p>편집을 누르면 이름 수정, 접근 설정, 순서 이동 도구가 나타납니다. 손잡이를 끌거나 접근 설정의 앞으로/뒤로 버튼으로 순서를 변경하세요.</p>':'')}
  function dispatch(key){if(key.startsWith('feature:'))return clickFeature(key.slice(8));if(key==='home'){if(host.classList.contains('hub-incident-workspace'))return window.enlReturnToPlatform(u);host.classList.remove('hub-menu-open');window.scrollTo({top:0,behavior:'smooth'})}else if(key==='menu'||key==='close-menu')host.classList.toggle('hub-menu-open',key==='menu');else if(key==='support')support();else if(key==='search')search();else if(key==='notifications')clickFeature('notices');else if(key==='manage-cards'&&admin)manageCards();else if(key==='edit'){host.classList.toggle('hub-editing');host.querySelector('.hub-edit-toggle').textContent=host.classList.contains('hub-editing')?'편집 완료':'편집'}else if(key==='guide')guide();else if(key==='favorites')favorites();else if(key==='bulletins'||key==='schedule')selectTab(key);else if(key==='approvals')openApprovalList();else if(key==='recent')selectTab('recent');}
  host.querySelectorAll('[data-hub]').forEach(b=>b.onclick=()=>dispatch(b.dataset.hub));
  function afterCards(c){catalog=c;historyShortcuts();navigation();paintTabs();paintApprovals();renderArtwork(host);}
  function historyShortcuts(){
    let nav=host.querySelector('.hub-history-shortcuts');if(!nav){nav=document.createElement('nav');nav.className='hub-history-shortcuts hub-category-tabs';nav.setAttribute('aria-label','업무 기록 바로가기');host.querySelector('.hub-support>h2').after(nav)}
    const m=entry('history');nav.hidden=!window.enlHistoryAvailable?.(u)||!m||m.canEnter===false||m.enabled===false||m.state!=='live';nav.replaceChildren();
    for(const [key,label] of Object.entries({all:'통합기록',incident:'사고보고기록',organization:'안전보건조직기록',tbm:'TBM기록',risk:'위험성평가기록',training:'교육기록',common:'공통업무기록'})){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{const already=active==='history';if(!await selectTab('history',false,key))return;if(already){window.enlRequestHistory?.(key);window.enlRenderHistory?.(host.closest('.app-shell').querySelector('#view'),key)}};nav.append(b);
    }
  }
  const refresh=()=>{if(sameUser())paintApprovals();else window.removeEventListener('enl-incidents-pulled',refresh)};window.addEventListener('enl-incidents-pulled',refresh);
  if(!window.enlHistoryAvailable)window.addEventListener('enl-history-ready',()=>{if(sameUser())loadRecent()},{once:true});
  async function loadBanners(){try{const config=await api({action:'platform_banners'});if(!sameUser())return;
   const previous=host.bannerConfig;if(previous&&previous.revision>config.revision)return;host.bannerConfig=config;
   if(!previous||previous.revision!==config.revision)startBanner(host);
   else for(const img of host.querySelectorAll('.hub-uploaded-banner')){
    const match=config.assets?.find(a=>img.src.split('?')[0]===a.url.split('?')[0]);if(match&&img.src!==match.url)img.src=match.url;
   }
  }catch{/* Keep the last successfully loaded banner set on transient failure. */}}
  const bannerRefresh=()=>{if(sameUser())loadBanners();else window.removeEventListener('enl-banners-changed',bannerRefresh)};
  window.addEventListener('enl-banners-changed',bannerRefresh);
  startBanner(host);loadBanners();
  const bannerRenew=setInterval(()=>{if(!sameUser()){clearInterval(bannerRenew);window.removeEventListener('enl-banners-changed',bannerRefresh)}else if(active==='home')loadBanners()},3600000);
  const recentRefresh=()=>{if(sameUser())loadRecent();else window.removeEventListener('enl-activity-changed',recentRefresh)};window.addEventListener('enl-activity-changed',recentRefresh);
  navigation();loadContent();loadRecent();
  return {area,services,status,addSupportCard,afterCards,selectTab};
 }
 document.addEventListener('input',ev=>{
  const el=ev.target;
  if(el.closest?.('#view form:not(.activity-filters)')&&!el.closest('.platform-hub')&&el.type!=='search')el.dataset.worktabEdited='1';
 },true);
 document.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'&&document.querySelector('.hub-search')){ev.preventDefault();document.querySelector('.hub-search').click()}});
 function cleanup(){stopArtwork();document.querySelectorAll('.topbar .hub-search,.topbar .hub-bell,.topbar .hub-mobile-menu').forEach(n=>n.remove());}
 window.ENLHub={mount,decorateCard,cleanup,dialog,safetyIcons};
})();
