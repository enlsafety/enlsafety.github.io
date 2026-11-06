/* Shared home banner catalogue and safety-only publishing editor. */
(()=>{
 'use strict';
 const defaults=['welcome','report','opening','fire','health'];
 const names={welcome:'골프장 메인 배너',report:'사고 발생 즉시 보고',opening:'안전보건관리 시스템 오픈',fire:'골프장 그린 화재예방',health:'2026년 건강검진 안내',tbm:'작업 전 안전확인',ppe:'보호구와 주변 확인',prevention:'재발방지'};
 const builtin={welcome:null,
 report:{key:'report',image:'report-now-r87.webp'},
 opening:{key:'opening',image:'opening-r86.webp'},
 fire:{key:'fire',eyebrow:'골프장 그린 화재예방',title:'작은 불씨도, 그린에서는 큰 위험입니다',body:'담배꽁초 투기 금지. 작업 전 화기와 소화기를 점검하세요.',image:'fire-r86.webp'},
 health:{key:'health',eyebrow:'2026년 건강검진 안내',title:'올해 건강검진, 12월 31일까지',body:'올해 검진 대상자는 대상 여부를 확인하고 검진기관에 미리 예약해 주세요.',image:'health-check-2026-r84.webp'},
 tbm:{key:'tbm',title:'작업 전, 위험요인부터 함께 확인해요',body:'오늘의 작업과 위험요인을 공유하고 안전한 작업방법을 함께 확인하세요.',art:'policy'},
 ppe:{key:'ppe',title:'작은 확인이 동료의 안전을 지킵니다',body:'차량 이동 전 주변을 살피고, 작업에 맞는 보호구를 확인하세요.',art:'ppe'},
 prevention:{key:'prevention',title:'사고 경험을 재발방지로 이어갑니다',body:'사고 원인을 살피고 개선조치가 현장에 정착했는지 확인하세요.',art:'emergency'}};
 const initial=()=>defaults.map(key=>({type:'builtin',key}));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=body=>window.enlIncidentApi({...body,actor:window.enlCurrentActor()},body.action==='platform_banner_upload'?60000:15000);
 function resolve(config){return (config?.items||initial()).flatMap(item=>{
  if(item.type==='builtin')return Object.hasOwn(builtin,item.key)&&!(item.key==='health'&&Date.now()>=Date.parse('2027-01-01T00:00:00+09:00'))?[builtin[item.key]]:[];
  const asset=config?.assets?.find(a=>a.id===item.assetId);return asset?[{key:'upload-'+asset.id,url:asset.url,title:item.title||asset.name,fit:item.fit}]:[];
 })}

 const backdrop=key=>'<img class="hub-design-background" src="assets/banners/'+key+'-r86.webp" alt="" decoding="async">';
 const artwork=key=>'<img class="hub-design-art" src="assets/safety-cards/'+key+'.webp" alt="">';
 const layouts={
  report:'<img class="hub-design-background" src="assets/banners/report-now-r87.webp" alt="" decoding="async"><div class="hub-report-copy"><small>사고보고, 미루지 마세요</small><h2>사고 발생 <em>즉시,</em><br>먼저 보고하세요.</h2><p>비용과 견적을 기다리지 마세요.</p><div class="hub-report-steps"><b>지금 <span>사고 내용 등록</span></b><i aria-hidden="true">→</i><b>추후 <span>비용과 견적 입력</span></b></div></div>',
  opening:backdrop('opening')+'<div class="hub-opening-copy"><small>WELCOME TO THE NEW WORKPLACE</small><h2>안전보건관리 시스템 <em>오픈!</em></h2><p>궁금한 점이나 개선 의견이 있나요?<br><b>내 프로필 안의 문의함</b>을 이용해 주세요.</p><span class="hub-opening-route">내 프로필 → 문의함</span></div>',
  fire:backdrop('fire')+'<div class="hub-fire-copy"><small>GOLF COURSE / FIRE PREVENTION</small><h2>작은 불씨,<br><em>큰 위험.</em></h2><p>담배꽁초 투기 금지<br>작업 전 화기와 소화기 점검</p><span>골프장 그린 화재예방</span></div><div class="hub-fire-checks"><strong>작업 전<br>꼭 확인!</strong><span><b>01</b> 담배꽁초 금지</span><span><b>02</b> 화기 사용 점검</span><span><b>03</b> 소화기 위치 확인</span></div>',
  health:'<img class="hub-design-background" src="assets/banners/health-check-2026-r84.webp" alt="" decoding="async">'+'<div class="hub-health-copy"><small>2026 HEALTH CHECK</small><h2>올해의 건강,<br>올해 안에 챙겨요.</h2><p>올해 검진 대상자는 대상 여부를 확인하고<br>검진기관에 미리 예약해 주세요.</p></div><div class="hub-health-date"><small>건강검진</small><strong>12.31</strong><span>올해 12월 말까지</span></div>',
  tbm:'<div class="hub-tbm-number" aria-hidden="true">TBM</div><div class="hub-tbm-copy"><small>작업 시작 전, 잠깐!</small><h2>오늘의 위험을<br>함께 확인해요.</h2><div class="hub-tbm-steps"><span>01 작업 공유</span><span>02 위험 확인</span><span>03 안전 실천</span></div></div>'+artwork('policy'),
  ppe:artwork('ppe')+'<div class="hub-ppe-copy"><small>READY, CHECK, GO.</small><h2>나의 작은 확인이<br>동료의 안전이 됩니다.</h2><p>이동 전 주변 확인<br>작업에 맞는 보호구 착용</p></div><span class="hub-ppe-stamp">작업 전 CHECK</span>',
  prevention:'<div class="hub-prevention-copy"><small>LEARN. IMPROVE. PREVENT.</small><h2>사고 경험을<br><em>다음의 안전으로.</em></h2><p>원인을 살피고, 개선하고,<br>현장에 정착했는지 확인하세요.</p></div><div class="hub-prevention-cycle"><span>원인 확인</span><span>개선조치</span><span>현장 정착</span></div>'
 };
 const markup=key=>layouts[key]||'';

 async function render(root,u){
  if(u?.role!=='safety'){root.textContent='안전관리자 전용 메뉴입니다.';return}
  root.classList.add('banner-manager');root.textContent='배너 설정을 불러오는 중입니다.';
  let revision,items=[],assets=[],busy=false,dirty=false;
  const actorId=u.id||u.personnelId;
  const live=()=>root.isConnected&&(window.enlCurrentActor()?.id||window.enlCurrentActor()?.personnelId)===actorId;
  function changed(){dirty=true;root.dataset.worktabEdited='1'}
  function error(e){return e?.message==='banner_changed'?'다른 곳에서 설정이 변경됐습니다. 다시 불러온 뒤 수정해 주세요.':e?.message==='invalid_banner_dimensions'?'가로형 이미지인지 확인해 주세요. 최소 320×80px, 최대 8192px, 3천만 화소까지 지원합니다.':'처리하지 못했습니다. 파일 형식과 연결 상태를 확인한 뒤 다시 시도해 주세요.'}
  function note(text){root.querySelector('[role=status]').textContent=text}
  function lock(value){busy=value;root.querySelectorAll('button,input,select').forEach(n=>n.disabled=value);root.setAttribute('aria-busy',String(value));if(!value)root.querySelectorAll('[data-boundary]').forEach(n=>n.disabled=true)}
  async function load(){
   try{const r=await api({action:'platform_banners'});if(!live())return;revision=r.revision;items=structuredClone(r.items);assets=r.assets||[];dirty=false;delete root.dataset.worktabEdited;paint()}
   catch{if(live()){root.innerHTML='<p role="status">배너 설정을 불러오지 못했습니다.</p><button type="button">다시 시도</button>';root.querySelector('button').onclick=load}}
  }
  const assetFor=item=>assets.find(a=>a.id===item.assetId);
  function preview(item,mobile=false){
   const a=assetFor(item),b=builtin[item.key],src=item.type==='image'?a?.url:item.key==='welcome'?'assets/banners/golf-r86.webp':b?.image?'assets/banners/'+b.image:b?.art?'assets/safety-cards/'+b.art+'.webp':'';
   return '<div class="banner-preview'+(mobile?' mobile':'')+'">'+(src?'<img src="'+esc(src)+'" alt="'+esc(item.title||names[item.key]||a?.name)+'" style="object-fit:'+(item.type==='image'?item.fit:'contain')+'">':'<span>이미지를 올려 주세요</span>')+'</div>';
  }
  function paint(){
   root.innerHTML='<div class="banner-admin-heading"><div><h2>메인 배너 관리</h2><p>10초마다 다음 배너로 넘어갑니다. 화살표나 번호를 눌러도 자동 전환은 계속됩니다.</p></div><button type="button" data-reload>다시 불러오기</button></div><div class="banner-admin-tools"><label>배너 개수 <select data-count>'+Array.from({length:13},(_,n)=>'<option value="'+n+'"'+(items.length===n?' selected':'')+'>'+n+'개'+(n===0?' (숨기기)':'')+'</option>').join('')+'</select></label><button type="button" data-save class="primary">저장하고 적용</button></div><p class="banner-admin-help">권장 이미지 1920×400px / JPG, PNG, WebP / 파일당 최대 5MB<br>가로형 이미지 320×80px 이상을 올려 주세요. 전체 보기는 이미지가 잘리지 않고, 채우기는 화면 비율에 따라 일부가 잘립니다. 2026년 건강검진 배너는 연말 이후 자동으로 표시되지 않습니다.</p><p role="status" aria-live="polite">'+(dirty?'수정 중입니다. 저장하고 적용을 눌러야 메인 화면에 반영됩니다.':'현재 '+items.length+'개가 설정되어 있습니다.')+'</p><div class="banner-admin-list"></div>';
   items.forEach((item,i)=>{
    const a=assetFor(item),card=document.createElement('article');card.className='banner-admin-card';card.dataset.slot=String(i);
    card.innerHTML='<header><h3>배너 '+(i+1)+'</h3><div><button type="button" data-up aria-label="배너 '+(i+1)+' 위로"'+(!i?' disabled data-boundary':'')+'>↑</button><button type="button" data-down aria-label="배너 '+(i+1)+' 아래로"'+(i===items.length-1?' disabled data-boundary':'')+'>↓</button><button type="button" data-remove>삭제</button></div></header><label>배너 내용 <select data-kind>'+Object.entries(names).map(([key,title])=>'<option value="'+key+'"'+(item.type==='builtin'&&item.key===key?' selected':'')+'>'+title+'</option>').join('')+'<option value="image"'+(item.type==='image'?' selected':'')+'>직접 올린 이미지</option></select></label>'+
     (item.type==='image'?'<label class="banner-drop" tabindex="0">이미지를 끌어 놓거나 눌러서 선택<input type="file" accept="image/jpeg,image/png,image/webp"><span>'+esc(a?a.name+' ('+a.width+'×'+a.height+'px)':'선택된 이미지 없음')+'</span></label><label>이미지 설명 <input data-title maxlength="100" value="'+esc(item.title)+'" placeholder="예: 겨울철 화재예방 안내"></label><label>표시 방식 <select data-fit><option value="contain"'+(item.fit==='contain'?' selected':'')+'>전체 보기 (잘림 없음)</option><option value="cover"'+(item.fit==='cover'?' selected':'')+'>채우기 (일부 잘림)</option></select></label>':'')+
     '<div class="banner-preview-grid"><div><small>PC 미리보기</small>'+preview(item)+'</div><div><small>모바일 미리보기</small>'+preview(item,true)+'</div></div>';
    root.querySelector('.banner-admin-list').append(card);
    card.querySelector('[data-kind]').onchange=e=>{items[i]=e.target.value==='image'?{type:'image',assetId:a?.id||'',fit:'contain',title:''}:{type:'builtin',key:e.target.value};changed();paint()};
    card.querySelector('[data-up]').onclick=()=>{[items[i-1],items[i]]=[items[i],items[i-1]];changed();paint()};
    card.querySelector('[data-down]').onclick=()=>{[items[i+1],items[i]]=[items[i],items[i+1]];changed();paint()};
    card.querySelector('[data-remove]').onclick=()=>{items.splice(i,1);changed();paint()};
    const file=card.querySelector('[type=file]'),drop=card.querySelector('.banner-drop');
    if(file){file.onchange=()=>upload(file.files?.[0],i);drop.onkeydown=e=>{if(e.target===drop&&['Enter',' '].includes(e.key)){e.preventDefault();file.click()}};
     drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');if(!busy)upload(e.dataTransfer.files?.[0],i)};
     card.querySelector('[data-title]').oninput=e=>{item.title=e.target.value;changed()};card.querySelector('[data-fit]').onchange=e=>{item.fit=e.target.value;changed();paint()};
    }
   });
   root.querySelector('[data-count]').onchange=e=>{const n=+e.target.value;items=items.slice(0,n);while(items.length<n)items.push({type:'image',assetId:'',fit:'contain',title:''});changed();paint()};
   root.querySelector('[data-reload]').onclick=()=>{if(!dirty||confirm('저장하지 않은 변경을 버리고 다시 불러올까요?'))load()};
   root.querySelector('[data-save]').onclick=save;
  }
  async function upload(file,index){
   if(!file||busy)return;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5242880){note('JPG, PNG, WebP 파일을 최대 5MB까지 올릴 수 있습니다.');return}
   changed();lock(true);note('이미지를 확인하고 올리는 중입니다.');
   try{
    const url=URL.createObjectURL(file);let dimensions;
    try{dimensions=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve([im.naturalWidth,im.naturalHeight]);im.onerror=reject;im.src=url})}finally{URL.revokeObjectURL(url)}
    const [w,h]=dimensions;if(w<320||h<80||w<h||w>8192||h>8192||w*h>30000000)throw new Error('invalid_banner_dimensions');
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file)});
    const r=await api({action:'platform_banner_upload',file:{name:file.name,mime:file.type,size:file.size,base64}});if(!live())return;
    assets.push(r.asset);items[index]={type:'image',assetId:r.asset.id,fit:items[index].fit||'contain',title:items[index].title||file.name.replace(/\.[^.]+$/,'').slice(0,100)};paint();note('이미지를 올렸습니다. 저장하고 적용을 누르면 반영됩니다.');
   }catch(e){if(live())note(error(e))}finally{if(live())lock(false)}
  }
  async function save(){
   if(busy)return;if(items.some(i=>i.type==='image'&&!i.assetId)){note('빈 배너에 이미지를 올리거나 배너 개수를 줄여 주세요.');return}
   lock(true);note('배너를 저장하는 중입니다.');
   try{const r=await api({action:'platform_banners_save',revision,items});if(!live())return;revision=r.revision;dirty=false;delete root.dataset.worktabEdited;root.querySelectorAll('[data-worktab-edited]').forEach(n=>delete n.dataset.worktabEdited);note('저장했습니다. 메인 배너에 적용되었습니다.');window.dispatchEvent(new CustomEvent('enl-banners-changed'))}
   catch(e){if(live())note(error(e))}finally{if(live())lock(false)}
  }
  await load();
 }
 window.ENLBanners={resolve,render,initial,markup};
})();
