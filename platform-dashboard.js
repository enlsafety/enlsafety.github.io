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
 const sidebarKeys=new Set('home incident risk tbm organization training msds support system policy law voice emergency ppe ergonomics rules favorites incident-home incident-status incident-report incident-list incident-actions incident-settings incident-inquiry incident-stats incident-closed history approvals notices documents dashboard bulletins schedule'.split(' '));
 function sidebarIcon(key,custom){
  const id=sidebarKeys.has(key)?key:'module';
  const use='<use href="assets/sidebar-pictograms-r58.svg#'+id+'"/>';
  const glyph=custom?'<g transform="translate(0 1) scale(.74)">'+use+'</g><text x="23" y="22" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" font-weight="800" fill="currentColor" stroke="none">'+custom+'</text>':use;
  return '<svg class="hub-nav-picto" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</svg>';
 }
 function incidentNavIcon(button){
  if(button.hasAttribute('data-wf-inquiry-nav'))return 'incident-inquiry';
  if(button.hasAttribute('data-lifecycle-closed'))return 'incident-closed';
  return ({home:'incident-status',report:'incident-report',incidents:'incident-list',actions:'incident-actions',history:'history',more:'incident-settings',stats:'incident-stats'})[button.dataset.shellView]||'module';
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
 function mount(host,u,{go,enterIncident,icons,names,featureName,manageCards}){
  const admin=u.role==='safety',userKey=JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);let catalog=null,content={notices:[],events:[],favorites:[]},loaded=false,contentError='',recent=[],recentError='',busy=false;
  const sameUser=()=>{const a=currentUser?.();return a&&JSON.stringify([a.id||a.personnelId,a.role,a.siteId||''])===userKey&&host.isConnected};
  const action=(key,label,cls='')=>'<button type="button" class="'+cls+'" data-hub="'+key+'"'+(key==='notifications'?' aria-label="알림센터"':key==='menu'?' aria-label="메뉴 열기"':key==='search'?' aria-label="통합검색"':'')+'>'+label+'</button>';
  const panel=(key,title,icon,more)=>'<section class="hub-panel hub-'+key+'"><header><h2>'+svg(icon,icons)+title+'</h2>'+action(key,more||'더보기 ›')+'</header><div data-list="'+key+'"><p class="hub-empty">불러오는 중입니다.</p></div></section>';
  host.innerHTML='<aside class="hub-sidebar"><div class="hub-logo"><img src="assets/enl-wordmark.svg" width="102" height="52" alt="이앤엘 E&amp;L"></div><nav aria-label="통합시스템 메뉴"></nav><section class="hub-favorites"><header><h2>'+sidebarIcon('favorites')+'즐겨찾기</h2>'+action('favorites','＋')+'</header><div></div></section><div class="hub-sidebar-wave" aria-hidden="true"></div></aside><button class="hub-sidebar-backdrop" type="button" data-hub="close-menu" aria-label="메뉴 닫기"></button><section class="hub-hero"><div class="hub-hero-image" role="img" aria-label="골프장 풍경과 이앤엘 문구: 안전이 일상이 되는 안전보건관리 통합시스템"></div><div class="hub-welcome"><h2>'+safe(u.name||'사용자')+' 님, 환영합니다!</h2><p>이앤엘 안전보건관리 통합시스템에서<br>사업장의 안전과 건강한 일터를 함께 만들어갑니다.</p></div></section><div class="hub-middle"><section class="hub-features"><header class="hub-section-heading"><h2>'+svg('grid')+'주요 업무기능</h2><p>안전보건 업무를 한 곳에서 통합 관리하세요.</p>'+action('guide','ⓘ 모듈 안내')+(admin?action('manage-cards','카드 관리','hub-card-manager')+action('edit','편집','hub-edit-toggle'):'')+'</header><div class="platform-modules feature-list"></div></section><div class="hub-right">'+panel('recent','최근 작업','clock')+panel('approvals','결재 대기 <span data-approval-count></span>','approvals')+'</div></div><div class="hub-bottom">'+panel('bulletins','공지사항','notice')+panel('schedule','오늘의 일정 <small>'+safe(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date()))+'</small>','calendar','전체 일정 ›')+'</div><p class="hub-status" role="status" aria-live="polite"></p><dialog class="hub-dialog hub-support"><header><h2>공통업무지원서비스</h2><button type="button" data-hub="close-support" aria-label="닫기">×</button></header><section class="platform-services feature-list"><div class="platform-grid"></div></section></dialog>';
  const area=host.querySelector('.platform-modules'),services=host.querySelector('.platform-services .platform-grid'),status=host.querySelector('.hub-status');
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
  host.restoreIncidentFrame=(view,actor)=>{
    if(JSON.stringify([actor.id||actor.personnelId,actor.role,actor.siteId||''])!==userKey)return;
    view.before(host);bindHeader();syncIncidentMenu();
  };
  function items(){return catalog?[...catalog.modules,...catalog.services]:[];}
  const entry=key=>items().find(x=>x.key===key);
  async function allowed(key){const m=entry(key);if(!m||m.enabled===false||m.state==='hidden'||m.canEnter===false||m.state!=='live'&&!m.preview){status.textContent='현재 접근할 수 없는 업무입니다.';return false}try{await api({action:'platform_enter',key});return sameUser()}catch{status.textContent='접근 권한 또는 연결 상태를 확인해 주세요.';return false}}
  function clickFeature(key){const b=host.querySelector('[data-module="'+key+'"],[data-service="'+key+'"]');if(b)b.click();else status.textContent='현재 접근할 수 없는 업무입니다.';host.classList.remove('hub-menu-open')}
  function support(){host.querySelector('.hub-support').showModal()}
  function addSupportCard(grid){const r=document.createElement('article');r.className='hub-support-card feature-card-wrap';r.dataset.key='support';r.dataset.state='live';r.dataset.on='true';r.innerHTML=action('support','<span class="hub-art hub-art-support" aria-hidden="true"></span><strong class="hub-card-title">공통업무지원<wbr>서비스</strong><span class="hub-card-description">'+descriptions.support+'</span><small>운영중</small><span class="hub-card-arrow" aria-hidden="true">'+svg('arrow')+'</span>','platform-card');r.firstElementChild.onclick=support;grid.append(r);return r}
  let expanded=false,observer,nativeMenu,pending=false;
  const shell=()=>host.closest('.app-shell');
  function setExpanded(value){
    expanded=value;
    const parent=host.querySelector('[data-hub=incident-menu]'),group=host.querySelector('.hub-incident-group');
    if(!parent||!group)return;
    parent.setAttribute('aria-expanded',String(value));group.hidden=!value;
    if(value)syncIncidentMenu();
  }
  function syncIncidentMenu(){
    if(!host.isConnected){observer?.disconnect();return;}
    const group=host.querySelector('.hub-incident-links'),nav=shell()?.querySelector('.shell411-nav');
    if(!group||!expanded)return;
    if(nav!==nativeMenu){
      observer?.disconnect();nativeMenu=nav;
      if(nav){observer=new MutationObserver(syncIncidentMenu);observer.observe(nav,{childList:true,subtree:true,attributes:true,characterData:true});}
    }
    const buttons=Array.from(nav?.querySelectorAll('button')||[]).filter(b=>!b.disabled&&!b.hidden&&b.getAttribute('aria-hidden')!=='true'&&getComputedStyle(b).display!=='none');
    const entries=buttons.map(b=>({label:Array.from(b.childNodes,n=>n.textContent.trim()).filter(Boolean).join(' '),active:host.classList.contains('hub-incident-workspace')&&b.classList.contains('on')}));
    const signature=JSON.stringify(entries);
    if(group.dataset.signature===signature&&group._sources?.every((b,i)=>b===buttons[i]))return;
    group.dataset.signature=signature;group._sources=buttons;group.replaceChildren();
    entries.forEach(({label,active},i)=>{
      const b=document.createElement('button');b.type='button';b.innerHTML=sidebarIcon(incidentNavIcon(buttons[i]))+'<span>'+safe(label)+'</span>';
      if(active)b.setAttribute('aria-current','page');
      b.onclick=()=>activateIncident(buttons[i]);group.append(b);
    });
  }
  async function activateIncident(target){
    if(pending)return;
    pending=true;
    try{if(await allowed('incident')&&(!target||target.isConnected&&!target.disabled))openWorkspace(target);}
    finally{pending=false;}
  }
  function openWorkspace(target){
    if(!sameUser())return;
    if(currentView!=='platform'&&host.classList.contains('hub-incident-workspace')&&document.querySelector('#view form:not(.activity-filters)')&&!confirm('현재 입력 화면을 벗어날까요?'))return;
    status.textContent='';
    const view=shell().querySelector('#view');
    host.classList.add('hub-incident-workspace');host.classList.remove('hub-menu-open','hub-editing');
    if(view.contains(host))view.before(host);
    host.querySelector('[data-hub=home]')?.classList.remove('on');
    host.querySelector('[data-hub=incident-menu]')?.classList.add('on');
    setExpanded(true);enterIncident(target);window.scrollTo(0,0);
    queueMicrotask(syncIncidentMenu);
  }
  function menuPictogram(key){
    if(sidebarKeys.has(key))return sidebarIcon(key);
    const customModules=catalog.modules.filter(m=>!sidebarKeys.has(m.key)).sort((a,b)=>a.key.localeCompare(b.key));
    return sidebarIcon(entry(key)?.iconKey,customModules.findIndex(m=>m.key===key)+1);
  }
  function navigation(){
    const nav=host.querySelector('.hub-sidebar > nav');
    nav.innerHTML=action('home',sidebarIcon('home')+'<span>홈</span>',host.classList.contains('hub-incident-workspace')?'':'on');
    for(const key of catalog.homeOrder){
      const m=entry(key);
      if(key==='support'){nav.insertAdjacentHTML('beforeend',action('support',sidebarIcon('support')+'<span>공통업무지원서비스</span>'));continue;}
      if(!m||(!admin&&m.state==='hidden'))continue;
      const label=menuPictogram(key)+'<span>'+safe(featureName(m))+'</span>';
      if(key==='incident'){
        nav.insertAdjacentHTML('beforeend',action('incident-menu',label+'<i aria-hidden="true">⌄</i>')+'<div class="hub-incident-group" id="hub-incident-group" hidden>'+action('incident-home',sidebarIcon('incident-home')+'<span>사고보고 홈</span>')+'<div class="hub-incident-links"></div></div>');
        nav.querySelector('[data-hub=incident-menu]').setAttribute('aria-controls','hub-incident-group');
      }else nav.insertAdjacentHTML('beforeend',action('feature:'+key,label));
    }
    nav.querySelectorAll('[data-hub]').forEach(b=>b.onclick=()=>dispatch(b.dataset.hub));setExpanded(expanded);paintFavorites();
  }
  function favoriteChoices(){return [...items().filter(m=>m.state!=='hidden'&&(m.key!=='system'||admin)).map(m=>({key:m.key,title:featureName(m)})),{key:'bulletins',title:'공지사항'},{key:'schedule',title:'전체 일정'}]}
  function paintFavorites(){const box=host.querySelector('.hub-favorites>div'),choices=favoriteChoices();box.replaceChildren();for(const key of content.favorites){const x=choices.find(v=>v.key===key);if(!x)continue;const b=document.createElement('button');b.type='button';b.innerHTML=menuPictogram(key)+'<span>'+safe(x.title)+'</span>';b.onclick=()=>dispatch(['bulletins','schedule'].includes(key)?key:'feature:'+key);box.append(b)}if(!box.children.length)box.innerHTML='<p>자주 쓰는 메뉴를 추가하세요.</p>'}
  function favorites(){const d=dialog(host,'즐겨찾기 설정'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<form class="hub-form">'+favoriteChoices().map(x=>'<label class="hub-check"><input type="checkbox" name="favorite" value="'+x.key+'" '+(content.favorites.includes(x.key)?'checked':'')+'>'+safe(x.title)+'</label>').join('')+'<button type="submit">저장</button><p role="status"></p></form>';box.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,b=form.querySelector('button');b.disabled=true;try{const favorites=Array.from(form.querySelectorAll(':checked'),x=>x.value);await api({action:'platform_hub_favorites',favorites});if(!sameUser())return;content.favorites=favorites;paintFavorites();d.close()}catch{form.querySelector('[role=status]').textContent='저장하지 못했습니다. 다시 시도해 주세요.'}finally{b.disabled=false}}}
  function scopedIncidents(){return (data.incidents||[]).filter(i=>!i.bulkInvalidation?.active&&(!['field','worker'].includes(u.role)||String(i.siteId)===String(u.siteId)))}
  function approvals(){const m=entry('incident');if(!m||m.enabled===false||m.state!=='live'||m.canEnter===false)return [];return scopedIncidents().filter(i=>i.status!=='closed'&&(u.role==='safety'?!!window.enlSafetyWork?.(i)?.report||i.corrective?.status==='submitted':u.role==='executive'?window.ENLExecutiveApproval?.canDecide(i.executiveApproval,u.id):false))}
  async function openIncident(id){if(!await allowed('incident'))return;const i=scopedIncidents().find(x=>x.id===id);if(!i){status.textContent='현재 조회할 수 없는 사고입니다.';return}host.querySelectorAll('dialog[open]').forEach(d=>d.close());if(window.enlOpenIncidentReview)window.enlOpenIncidentReview(id,u.role==='safety',u);else if(typeof openIncidentModal==='function')openIncidentModal(id,u.role==='safety',u);else go('incidents');}
  function rowButton(box,title,detail,callback,icon='file'){const b=document.createElement('button');b.type='button';b.className='hub-data-row';b.innerHTML=svg(icon)+'<strong>'+safe(title)+'</strong><time>'+safe(detail)+'</time>';b.onclick=callback;box.append(b);return b}
  function paintApprovals(){const box=host.querySelector('[data-list=approvals]'),rows=approvals();box.replaceChildren();host.querySelector('[data-approval-count]').textContent=rows.length+'건';for(const i of rows.slice(0,3))rowButton(box,(siteById(i.siteId)?.name||'')+' '+(i.eventType||'사고보고'),relative(i.updatedAt),()=>openIncident(i.id));if(!rows.length)box.innerHTML='<p class="hub-empty">'+(['safety','executive'].includes(u.role)?'현재 결재할 업무가 없습니다.':'본인에게 배정된 결재 업무가 없습니다.')+'</p>'}
  function openApprovalList(){const d=dialog(host,'결재 대기'),box=d.querySelector('.hub-dialog-body');for(const i of approvals())rowButton(box,(siteById(i.siteId)?.name||'')+' '+(i.eventType||'사고보고'),date(i.updatedAt),()=>openIncident(i.id));if(!box.children.length)box.innerHTML='<p class="hub-empty">현재 결재할 업무가 없습니다.</p>'}
  function paintRecent(){const box=host.querySelector('[data-list=recent]');box.replaceChildren();for(const r of recent.slice(0,4))rowButton(box,r.sentence||r.incident_title,relative(r.happened_at),()=>openActivity(r));if(!recent.length)box.innerHTML='<p class="hub-empty">'+safe(recentError||'최근 작업 기록이 없습니다.')+'</p>'}
  function openActivity(r){const d=dialog(host,'작업 기록'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<p>'+safe(r.sentence)+'</p><p>'+safe(r.actor_name||'')+' / '+safe(date(r.happened_at))+' '+safe(time(r.happened_at))+'</p>';if(r.module_key==='incident'&&scopedIncidents().some(i=>i.id===r.incident_id)){const b=document.createElement('button');b.textContent='사고 내용 보기';b.onclick=()=>openIncident(r.incident_id);box.append(b)}}
  async function loadRecent(){if(!window.enlHistoryAvailable?.(u)){recentError='조회 가능한 작업 기록이 없습니다.';paintRecent();return}try{const r=await api({action:'activity_list'});if(!sameUser())return;recent=r.rows||[];recentError=''}catch{recentError='작업 기록을 불러오지 못했습니다.'}if(sameUser())paintRecent()}
  function paintContent(){for(const [kind,rows] of [['bulletins',content.notices],['schedule',content.events.filter(x=>day(new Date(x.starts_at))<=day()&&day(new Date(x.ends_at||x.starts_at))>=day())]]){const box=host.querySelector('[data-list='+kind+']');box.replaceChildren();for(const x of rows.slice(0,4)){const b=rowButton(box,x.title,kind==='bulletins'?date(x.created_at):time(x.starts_at)+' ~ '+time(x.ends_at),()=>readContent(x),kind==='bulletins'?'notice':'calendar');if(kind==='bulletins'){b.classList.add('hub-notice-row');b.querySelector('svg').outerHTML='<span class="hub-tag '+safe(x.label)+'">'+({important:'중요',info:'안내',general:'일반'}[x.label]||'안내')+'</span>'}else b.classList.add('hub-event-row')}
   if(!rows.length)box.innerHTML='<p class="hub-empty">'+safe(contentError||(loaded?(kind==='bulletins'?'등록된 공지사항이 없습니다.':'오늘 등록된 일정이 없습니다.'):'불러오는 중입니다.'))+'</p>';
  }paintFavorites()}
  async function loadContent(){try{const r=await api({action:'platform_hub'});if(!sameUser())return;content={notices:r.notices||[],events:r.events||[],favorites:r.favorites||[]};loaded=true;contentError=''}catch{contentError='자료를 불러오지 못했습니다. 더보기에서 다시 시도하세요.'}if(sameUser())paintContent()}
  function readContent(x){const d=dialog(host,x.kind==='notice'?'공지사항':'일정 상세'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<h3>'+safe(x.title)+'</h3><p class="hub-detail-meta">'+safe(x.site_name||'전체 사업장')+' / '+safe(x.kind==='notice'?date(x.created_at):date(x.starts_at)+' '+time(x.starts_at)+' ~ '+time(x.ends_at))+'</p><p class="hub-detail-body">'+safe(x.body)+'</p>'+(admin?action('edit-content','수정'):'');if(admin)box.querySelector('button').onclick=()=>{d.close();editContent(x)}}
  function editContent(item){const kind=item.kind,d=dialog(host,(kind==='notice'?'공지사항':'일정')+(item.id?' 수정':' 등록')),box=d.querySelector('.hub-dialog-body');
   box.innerHTML='<form class="hub-form"><label>제목<input name="title" required maxlength="150"></label><label>대상 사업장<select name="site"><option value="">전체 사업장</option></select></label>'+(kind==='notice'?'<label>분류<select name="label"><option value="info">안내</option><option value="important">중요</option><option value="general">일반</option></select></label>':'<label>시작<input name="start" type="datetime-local" required></label><label>종료<input name="end" type="datetime-local" required></label>')+'<label>내용<textarea name="body" rows="5" maxlength="10000"></textarea></label><div class="hub-form-actions"><button type="submit">저장</button>'+(item.id?'<button type="button" data-archive>보관 처리</button>':'')+'</div><p role="status"></p></form>';
   const f=box.querySelector('form'),note=f.querySelector('[role=status]');for(const site of data.sites||[]){const id=site.id||site.site_id,name=site.name||site.site_name;if(id){const opt=new Option(name,id);f.elements.site.add(opt)}}f.elements.title.value=item.title||'';f.elements.body.value=item.body||'';f.elements.site.value=item.site_id||'';
   if(kind==='notice')f.elements.label.value=item.label||'info';else{const local=v=>v?day(new Date(v))+'T'+time(v):day()+'T09:00';f.elements.start.value=local(item.starts_at);f.elements.end.value=item.ends_at?local(item.ends_at):day()+'T10:00'}
   f.onsubmit=async ev=>{ev.preventDefault();if(busy)return;const b={action:'platform_hub_save',id:item.id||null,revision:item.revision,kind,title:f.elements.title.value,body:f.elements.body.value,siteId:f.elements.site.value,label:kind==='notice'?f.elements.label.value:'info',startsAt:kind==='event'?new Date(f.elements.start.value+':00+09:00').toISOString():null,endsAt:kind==='event'?new Date(f.elements.end.value+':00+09:00').toISOString():null};if(kind==='event'&&b.endsAt<b.startsAt){note.textContent='종료 시각은 시작 시각 이후여야 합니다.';return}busy=true;f.inert=true;try{await api(b);if(!sameUser())return;d.close();await loadContent();status.textContent='저장했습니다.'}catch(err){note.textContent=err.message==='content_changed'?'다른 변경이 있습니다. 닫은 뒤 다시 조회해 주세요.':'저장하지 못했습니다. 입력과 연결 상태를 확인하세요.'}finally{busy=false;f.inert=false}};
   f.querySelector('[data-archive]')?.addEventListener('click',async()=>{if(busy||!confirm('이 항목을 메인 화면에서 보관 처리할까요? 원본은 서버에 남습니다.'))return;busy=true;f.inert=true;try{await api({action:'platform_hub_archive',id:item.id,revision:item.revision});d.close();await loadContent()}catch{note.textContent='처리하지 못했습니다. 다시 조회해 주세요.'}finally{busy=false;f.inert=false}});
  }
  async function listContent(kind){let listedEvents=content.events;const d=dialog(host,kind==='notice'?'공지사항':'전체 일정'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<div class="hub-list-tools">'+(admin?action('new','＋ '+(kind==='notice'?'공지 등록':'일정 등록')):'')+action('reload','새로고침')+'</div>'+(kind==='event'?'<label class="hub-date-filter">조회 날짜 <input type="date" value="'+day()+'"></label>':'')+'<div data-content-list></div>';if(admin)box.querySelector('[data-hub=new]').onclick=()=>{d.close();editContent({kind})};const paint=()=>{const target=box.querySelector('[data-content-list]'),selected=box.querySelector('input')?.value;target.replaceChildren();let rows=kind==='notice'?content.notices:listedEvents.filter(x=>!selected||day(new Date(x.starts_at))<=selected&&day(new Date(x.ends_at))>=selected);for(const x of rows)rowButton(target,x.title,kind==='notice'?date(x.created_at):time(x.starts_at)+' ~ '+time(x.ends_at),()=>readContent(x));if(!rows.length)target.innerHTML='<p class="hub-empty">'+safe(contentError||'등록된 항목이 없습니다.')+'</p>'};box.querySelector('input')?.addEventListener('change',async()=>{const selected=box.querySelector('input').value;if(!selected)return;try{const r=await api({action:'platform_hub',date:selected});if(!d.isConnected||!sameUser())return;listedEvents=r.events||[];paint()}catch{box.querySelector('[data-content-list]').textContent='일정을 불러오지 못했습니다.'}});box.querySelector('[data-hub=reload]').onclick=async()=>{if(kind==='event'){const selected=box.querySelector('input').value||day();try{const r=await api({action:'platform_hub',date:selected});listedEvents=r.events||[]}catch{contentError='일정을 불러오지 못했습니다.'}}else await loadContent();if(d.isConnected)paint()};paint();}
  function search(){const d=dialog(host,'통합검색'),box=d.querySelector('.hub-dialog-body');box.innerHTML='<label class="hub-search-label">검색어<input type="search" placeholder="메뉴, 사고, 공지사항, 일정 검색" maxlength="100"></label><p>조회 권한이 있는 현재 자료에서 검색합니다.</p><div data-results></div>';const input=box.querySelector('input'),out=box.querySelector('[data-results]');const paint=()=>{out.replaceChildren();const q=input.value.trim().toLocaleLowerCase();if(!q)return;let count=0;for(const m of items().filter(m=>m.state!=='hidden'&&featureName(m).toLocaleLowerCase().includes(q))){rowButton(out,featureName(m),'업무 메뉴',()=>{d.close();clickFeature(m.key)});count++}if(entry('incident')?.state==='live'&&entry('incident')?.enabled!==false&&entry('incident')?.canEnter!==false)for(const i of scopedIncidents().filter(i=>[i.eventType,i.summary,siteById(i.siteId)?.name].join(' ').toLocaleLowerCase().includes(q)).slice(0,30)){rowButton(out,i.eventType||'사고보고',siteById(i.siteId)?.name||'',()=>openIncident(i.id));count++}for(const x of [...content.notices,...content.events].filter(x=>[x.title,x.body].join(' ').toLocaleLowerCase().includes(q))){rowButton(out,x.title,x.kind==='notice'?'공지사항':'일정',()=>readContent(x));count++}if(!count)out.innerHTML='<p class="hub-empty">검색 결과가 없습니다.</p>'};input.oninput=paint;input.focus()}
  function guide(){const d=dialog(host,'모듈 안내');d.querySelector('.hub-dialog-body').innerHTML='<p>운영 중인 업무는 카드를 눌러 바로 이용할 수 있습니다. 구현 중인 업무는 관리자가 허용한 시험 사용자만 진입합니다.</p><p>공지사항과 일정은 안전관리자가 등록하고 대상 사업장의 사용자에게 공유합니다.</p>'+(admin?'<p>편집을 누르면 이름 수정, 접근 설정, 순서 이동 도구가 나타납니다. 손잡이를 끌거나 접근 설정의 앞으로/뒤로 버튼으로 순서를 변경하세요.</p>':'')}
  function dispatch(key){if(key==='incident-menu'){
    if(expanded)setExpanded(false);else if(!pending){pending=true;allowed('incident').then(ok=>{if(ok)setExpanded(true)}).finally(()=>pending=false);}
    return;
  }if(key==='incident-home')return activateIncident();if(key.startsWith('feature:'))return clickFeature(key.slice(8));if(key==='home'){if(host.classList.contains('hub-incident-workspace'))return window.enlReturnToPlatform(u);host.classList.remove('hub-menu-open');window.scrollTo({top:0,behavior:'smooth'})}else if(key==='menu'||key==='close-menu')host.classList.toggle('hub-menu-open',key==='menu');else if(key==='support')support();else if(key==='close-support')host.querySelector('.hub-support').close();else if(key==='search')search();else if(key==='notifications')clickFeature('notices');else if(key==='manage-cards'&&admin)manageCards();else if(key==='edit'){host.classList.toggle('hub-editing');host.querySelector('.hub-edit-toggle').textContent=host.classList.contains('hub-editing')?'편집 완료':'편집'}else if(key==='guide')guide();else if(key==='favorites')favorites();else if(key==='bulletins')listContent('notice');else if(key==='schedule')listContent('event');else if(key==='approvals')openApprovalList();else if(key==='recent'){const d=dialog(host,'최근 작업'),box=d.querySelector('.hub-dialog-body');for(const r of recent)rowButton(box,r.sentence,relative(r.happened_at),()=>openActivity(r));if(!recent.length)box.innerHTML='<p class="hub-empty">'+safe(recentError||'최근 작업 기록이 없습니다.')+'</p>'}}
  host.querySelectorAll('[data-hub]').forEach(b=>b.onclick=()=>dispatch(b.dataset.hub));
  function afterCards(c){catalog=c;navigation();paintApprovals();renderArtwork(host);}
  const refresh=()=>{if(sameUser())paintApprovals();else window.removeEventListener('enl-incidents-pulled',refresh)};window.addEventListener('enl-incidents-pulled',refresh);
  loadContent();loadRecent();
  return {area,services,status,addSupportCard,afterCards,openWorkspace,showPreparing:title=>{const d=dialog(host,title);d.querySelector('.hub-dialog-body').textContent='이 업무의 세부 기능은 구현 중입니다.'}};
 }
 document.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'&&document.querySelector('.hub-search')){ev.preventDefault();document.querySelector('.hub-search').click()}});
 function cleanup(){stopArtwork();document.querySelectorAll('.topbar .hub-search,.topbar .hub-bell,.topbar .hub-mobile-menu').forEach(n=>n.remove());}
 window.ENLHub={mount,decorateCard,cleanup,dialog,safetyIcons};
})();
