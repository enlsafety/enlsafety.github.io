/* E&L Accident Report App v4.2.9 - recurrence prevention workflow */
(function(){
  'use strict';

  const VERSION='4.4.40-prevention-autodraft1';
  const LEGACY_SENTINEL='후속 단계에서 안전관리자가 별도 수립';
  const MANAGER_POSITIONS=['현장소장','파트장','서무'];
  const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
  const isSafety=u=>roleNorm(u?.role)==='safety';
  const isReader=u=>['manager','executive'].includes(roleNorm(u?.role));
  const isField=u=>['field','worker'].includes(String(u?.role||''));
  const isSiteManager=u=>isField(u)&&MANAGER_POSITIONS.includes(String(u?.position||u?.jobTitle||''));
  const text=v=>String(v??'').trim();
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const now=()=>typeof nowISO==='function'?nowISO():new Date().toISOString();
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch(e){return id||'-'}};
  const userId=u=>String(u?.personnelId||u?.id||'');
  const sameSite=(i,u)=>String(i?.siteId||'')===String(u?.siteId||'');
  const isHistorical=i=>!!i&&(String(i.recordMode||'')==='historical_transfer'||String(i?.historicalTransfer?.mode||'')==='historical_transfer'||(i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&i?.historicalImport?.workflowExempt===true&&String(i?.historicalImport?.transferState||'')==='closed'));
  const norm=v=>String(v||'').replace(/\s+/g,'').trim().toLocaleLowerCase('ko-KR');
  const isAuthor=(i,u)=>{const rid=String(i?.reporterId||'');if(rid&&userId(u))return rid===userId(u);return !rid&&norm(i?.reporterName)===norm(u?.name)};
  const historicalClosed=i=>!!i&&i?.historicalImport?.enabled===true&&i?.historicalImport?.erpApproved===true&&i?.historicalImport?.workflowExempt===true&&String(i?.historicalImport?.transferState||'')==='closed'&&String(i?.status||'')==='closed';
  const reportAccepted=i=>!!i&&!historicalClosed(i)&&['approved','closed'].includes(String(i.status||''));
  const isFinalized=i=>!!i&&!historicalClosed(i)&&String(i.status)==='closed'&&String(i.corrective?.status)==='approved';
  const hasPlan=c=>!!c&&(!!text(c.planDetail)||!!c.planAt);
  const attachmentsHtml=arr=>typeof window.enlAttachmentGalleryHtml==='function'?window.enlAttachmentGalleryHtml(arr||[]):'';
  const bindAttachments=(root,arr)=>{try{window.enlBindAttachmentOpen?.(root,arr||[])}catch(e){}};
  const persistAttachments=arr=>(arr||[]).map(a=>typeof window.enlPersistAttachment==='function'?window.enlPersistAttachment(a):a);
  const quick=i=>typeof window.enlIncidentQuickSummary==='function'?window.enlIncidentQuickSummary(i):{headline:i?.eventType||'사고',site:siteName(i?.siteId),when:i?.occurredAt?(typeof fmt==='function'?fmt(i.occurredAt):i.occurredAt):'-'};
  const overview=i=>typeof window.enlIncidentOverviewHtml==='function'?window.enlIncidentOverviewHtml(i,{compact:true}):`<p class="summary">${ex(i?.summary||'-')}</p>`;


  function targetDate(days){
    const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+Number(days||0));
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function suggestedOwner(i){
    const rank=new Map(MANAGER_POSITIONS.map((p,n)=>[p,n]));
    const users=Array.isArray(data?.users)?data.users:[];
    const candidates=users.filter(x=>String(x?.siteId||'')===String(i?.siteId||'')&&x?.active!==false&&isField(x)&&rank.has(text(x?.position||x?.jobTitle)))
      .sort((a,b)=>(rank.get(text(a?.position||a?.jobTitle))??99)-(rank.get(text(b?.position||b?.jobTitle))??99)||text(a?.name).localeCompare(text(b?.name),'ko'));
    const p=candidates[0],position=text(p?.position||p?.jobTitle),name=text(p?.name);
    if(!p)return '현장소장';
    if(name&&position&&name.includes(position))return name;
    return [position,name].filter(Boolean).join(' ')||'현장소장';
  }
  function incidentDraftSource(i){
    const d=i?.reportDetails||{};
    return [i?.eventType,i?.summary,d.workAction,d.incidentHow,d.environmentCause,d.behaviorCause,i?.immediateAction,d.injuryDetail,d.diagnosis,d.damagedItem,d.damageDetail,d.specialNote].map(text).filter(Boolean).join(' ');
  }
  function hazardDraft(i){
    const d=i?.reportDetails||{},event=text(i?.eventType),source=incidentDraftSource(i);
    const finish='조치 완료 후 현장소장이 이행 여부를 확인하고 사진 등 증빙을 남겨 안전관리자에게 제출한다.';
    if(event==='붕괴/전도'||/강풍|안전망|방풍|펜스|휀스|구조물.{0,12}(전도|붕괴)|전도.{0,12}구조물/.test(source)){
      return {
        cause:'구조물의 고정·지지 상태와 기상조건 변화에 따른 작업중지·접근통제 기준이 충분히 확보되지 않아 전도·붕괴 위험이 현실화된 것으로 판단됨.',
        plan:'1. 사고 관련 구조물과 동일·유사 구조물의 고정·지지·기초 상태를 즉시 점검하고 불량부는 보강 또는 사용중지한다.\n2. 강풍 등 기상 악화 시 작업중지 및 접근금지 기준을 정하고, 위험구역을 표시·통제한다.\n3. 구조물 설치·해체·이동 작업 전 고정상태와 주변 인원 유무를 확인하는 절차를 작업방법에 반영하고 TBM으로 공유한다.\n4. '+finish
      };
    }
    if(/골프공|타구|티샷|샷.{0,8}(위험|충돌)|페어웨이|그린.{0,8}작업/.test(source)){
      return {
        cause:'골프 경기구역과 작업구역의 분리, 작업자와 경기운영 인력 간 사전 연락 및 타구 접근 시 작업중지 기준이 충분하지 않아 타구 위험에 노출된 것으로 판단됨.',
        plan:'1. 코스 작업 전 경기 진행 여부를 확인하고 작업구역과 타구 위험구역을 구분해 작업자 접근을 통제한다.\n2. 캐디·경기운영·현장 작업자 간 연락방법을 정하고, 타구가 예상되거나 플레이가 접근하면 즉시 작업을 중지하고 안전구역으로 대피한다.\n3. 반복 노출 구간은 작업시간 조정, 감시자 배치, 방호시설 등 추가 통제수단을 검토·적용한다.\n4. '+finish
      };
    }
    if(event==='차량/중장비'||/지게차|카트|차량|중장비|굴삭기|로더|후진|충돌|부딪힘/.test(source)){
      return {
        cause:'차량·장비와 보행자 또는 시설물의 동선 분리, 사각지대 확인, 정지·유도 절차가 충분하지 않아 충돌 위험이 발생한 것으로 판단됨.',
        plan:'1. 사고 지점의 차량·장비 동선과 보행 동선을 분리하고 교차구간·사각지대에는 정지선, 표지, 반사경 등 필요한 통제수단을 보완한다.\n2. 후진·협소구간·시야불량 작업은 유도자 배치 또는 작업구역 출입통제를 적용하고 제한속도·정지·확인 절차를 준수한다.\n3. 운전자와 작업자에게 현장 동선 및 충돌예방 수칙을 TBM으로 재교육하고 동일 위험구간을 함께 점검한다.\n4. '+finish
      };
    }
    if(event==='넘어짐'||/미끄러|걸려|넘어짐|미끄럼|단차|바닥.{0,8}(젖|불량)/.test(source)){
      return {
        cause:'통행로의 바닥상태·단차·장애물 등 넘어짐 위험요인의 제거와 작업 전 확인이 충분하지 않아 보행 중 균형을 잃은 것으로 판단됨.',
        plan:'1. 사고 장소와 동일 통행로의 미끄럼·단차·장애물·배수 상태를 즉시 점검하고 위험요인을 제거 또는 보수한다.\n2. 미끄럼 위험구간은 미끄럼방지 조치와 경고표지를 적용하고, 통행로 적치물 관리 기준을 정해 상시 확보한다.\n3. 작업 전 통행로 상태 확인과 적정 안전화를 포함한 넘어짐 예방수칙을 TBM으로 공유한다.\n4. '+finish
      };
    }
    if(event==='추락'||/추락|고소작업|사다리|개구부|안전대/.test(source)){
      return {
        cause:'고소작업의 추락방지설비, 작업발판·사다리 상태, 안전대 체결 및 작업 전 확인 절차가 충분하지 않아 추락 위험이 발생한 것으로 판단됨.',
        plan:'1. 작업발판·사다리·개구부·난간 등 추락 위험설비를 점검하고 필요한 방호조치를 완료하기 전까지 해당 작업을 중지한다.\n2. 안전대 부착설비와 체결방법을 확인하고 고소작업 전 작업장소·설비·보호구 점검 절차를 적용한다.\n3. 동일 고소작업자에게 추락예방 작업방법과 금지사항을 TBM으로 재교육하고 작업 중 준수 여부를 확인한다.\n4. '+finish
      };
    }
    if(event==='끼임'||/끼임|협착|말림|회전체|컨베이어/.test(source)){
      return {
        cause:'설비의 위험점 방호, 정비·청소 시 정지 및 에너지 차단, 손 접근 금지 절차가 충분하지 않아 끼임 위험이 발생한 것으로 판단됨.',
        plan:'1. 해당 설비를 즉시 정지·점검하고 방호덮개·인터록 등 위험점 방호상태를 보완한 뒤 안전확인 후 사용한다.\n2. 정비·청소·이물제거 시 전원 차단 및 재가동 방지 절차를 작업방법에 반영하고 손을 위험점에 넣는 작업을 금지한다.\n3. 동일 설비 작업자에게 끼임 예방 및 에너지 차단 절차를 재교육하고 관리감독자가 준수 여부를 확인한다.\n4. '+finish
      };
    }
    if(event==='베임/찔림'||/베임|찔림|절단|칼|날붙이|예초기|절삭/.test(source)){
      return {
        cause:'날카로운 공구·설비의 방호상태와 안전한 취급방법, 작업에 적합한 보호구 사용 확인이 충분하지 않아 베임·찔림 위험이 발생한 것으로 판단됨.',
        plan:'1. 사용 공구·설비의 파손, 날, 덮개·방호장치 상태를 점검하고 불량품은 즉시 교체 또는 사용중지한다.\n2. 절단 방향, 손 위치, 보관·운반방법 등 안전 작업방법을 정하고 작업 특성에 맞는 보호구를 지급·착용한다.\n3. 동일 작업자에게 공구 취급 및 베임·찔림 예방수칙을 TBM으로 재교육한다.\n4. '+finish
      };
    }
    if(event==='감전'||/감전|누전|전기|활선|콘센트|전선/.test(source)){
      return {
        cause:'전기설비의 절연·접지·누전보호 상태와 전원 차단 확인, 손상 전기기기 사용통제가 충분하지 않아 감전 위험이 발생한 것으로 판단됨.',
        plan:'1. 관련 전기설비의 전원을 차단하고 전선·플러그·접지·누전차단기 상태를 점검해 이상 설비는 수리 전까지 사용중지한다.\n2. 전기작업은 전원 차단과 무전압 확인 후 실시하도록 절차를 정하고 임의 활선작업을 금지한다.\n3. 동일 구역의 전기기기와 이동식 전기설비를 추가 점검하고 감전예방 수칙을 작업자에게 재교육한다.\n4. '+finish
      };
    }
    if(event==='화재/폭발'||/화재|폭발|용접|용단|인화성|가연성|점화원/.test(source)){
      return {
        cause:'점화원과 가연·인화성 물질의 분리, 화기작업 통제 및 소화설비 확인이 충분하지 않아 화재·폭발 위험이 발생한 것으로 판단됨.',
        plan:'1. 점화원과 가연·인화성 물질을 분리하고 누출·잔류물·주변 가연물을 제거한 뒤 안전상태를 확인한다.\n2. 화기작업은 작업 전 위험확인, 소화기 비치, 불티 비산방지, 필요 시 화재감시자 배치 등 통제절차를 적용한다.\n3. 관련 작업자에게 화재·폭발 예방과 비상조치 방법을 재교육하고 동일 위험구역을 추가 점검한다.\n4. '+finish
      };
    }
    if(event==='질식/중독'||/밀폐공간|산소농도|유해가스|질식|중독/.test(source)){
      return {
        cause:'유해가스·산소결핍 가능성에 대한 사전 측정, 환기, 출입통제 및 감시체계가 충분하지 않아 질식·중독 위험이 발생한 것으로 판단됨.',
        plan:'1. 해당 구역 출입을 통제하고 작업 전 산소 및 유해가스 농도를 측정해 안전기준 충족 여부를 확인한다.\n2. 필요한 환기, 감시인 배치, 출입관리 및 구조장비 등 밀폐공간 작업절차를 적용한다.\n3. 작업자와 감시인에게 질식·중독 예방 및 비상구조 절차를 재교육하고 작업 전 점검을 기록한다.\n4. '+finish
      };
    }
    if(event==='근골격'||/중량물|들기|운반|근골격|반복작업|부담작업/.test(source)){
      return {
        cause:'중량물 취급방법, 보조장비 사용, 반복·부담작업의 작업자세와 작업분담이 충분히 관리되지 않아 신체부담이 증가한 것으로 판단됨.',
        plan:'1. 중량·반복 작업의 취급방법과 작업높이를 점검하고 운반구·리프트 등 보조장비 사용 또는 2인 작업을 적용한다.\n2. 불필요한 반복·비틀림·과도한 힘 사용을 줄이도록 작업순서와 작업방법을 조정한다.\n3. 작업자에게 올바른 취급자세와 근골격계 부담 예방수칙을 교육하고 동일 작업의 부담요인을 재점검한다.\n4. '+finish
      };
    }
    if(event==='설비/시설 파손'||/파손|고장|설비|시설물/.test(source)){
      return {
        cause:'설비·시설의 이상징후 확인, 예방점검 및 이상 발견 시 사용중지·보수 절차가 충분하지 않아 손상 또는 2차 위험이 발생한 것으로 판단됨.',
        plan:'1. 손상된 설비·시설은 사용을 중지하거나 접근을 통제하고 원상복구 또는 교체 후 안전상태를 확인한다.\n2. 동일 형식의 설비·시설을 추가 점검하고 점검주기와 이상 발견 시 보고·사용중지 기준을 보완한다.\n3. 관련 작업자에게 설비 이상 발견 시 조치절차와 임의 사용 금지사항을 공유한다.\n4. '+finish
      };
    }
    return {
      cause:'작업 전 위험요인 확인, 작업구역 통제 및 안전 작업방법의 준수 여부 확인이 충분하지 않아 사고 위험이 현실화된 것으로 판단됨.',
      plan:'1. 사고 발생 장소와 동일·유사 작업의 위험요인을 즉시 점검하고 확인된 위험요인을 제거·보완한다.\n2. 해당 작업의 안전 작업방법, 작업구역 통제, 필요한 보호구 및 금지사항을 정리해 작업 전 TBM으로 공유한다.\n3. 동일 유형 작업을 추가 점검해 같은 위험요인이 남아 있지 않은지 확인한다.\n4. '+finish
    };
  }
  function autoPreventionDraft(i){
    const d=i?.reportDetails||{},hazard=hazardDraft(i);
    const mechanism=text(d.incidentHow)||text(i?.summary)||text(i?.eventType)||'사고 발생';
    const cause=[`발생 메커니즘: ${mechanism}`];
    if(text(d.environmentCause))cause.push(`환경적 요인: ${text(d.environmentCause)}`);
    if(text(d.behaviorCause))cause.push(`행동적 요인: ${text(d.behaviorCause)}`);
    cause.push(`관리상 원인: ${hazard.cause}`);
    const days=(i?.potentialMajor===true||String(i?.priority||'')==='urgent')?3:(String(i?.priority||'')==='important'||String(i?.category||'')==='person')?7:14;
    return {rootCause:cause.join('\n'),planDetail:hazard.plan,ownerName:suggestedOwner(i),dueDate:targetDate(days)};
  }

  let actionFilter={status:'',siteId:'',title:''};

  function statusText(i){
    if(historicalClosed(i))return '과거사고 이관종결';
    const c=i?.corrective||{},s=String(c.status||'');
    if(isFinalized(i)||s==='approved')return '재발방지조치 확인완료';
    if(!hasPlan(c))return '재발방지계획 수립대기';
    if(s==='planned')return '현장 재발방지조치 대기';
    if(s==='in_progress')return '재발방지조치 작성중';
    if(s==='submitted')return '안전관리자 확인대기';
    if(s==='rejected')return '재발방지조치 보완요청';
    return '현장 재발방지조치 대기';
  }
  function preventionBadge(i){
    if(historicalClosed(i)){const label='과거사고 이관종결';return typeof badge==='function'?badge('p-done',label):`<span class="field411-badge">${ex(label)}</span>`;}
    const c=i?.corrective||{},s=String(c.status||''),label=statusText(i);
    if(typeof badge!=='function')return `<span class="field411-badge">${ex(label)}</span>`;
    return badge(s==='approved'?'p-done':s==='rejected'?'p-rejected':s==='submitted'?'p-review':'p-normal',label);
  }

  function installGlobalLabels(){
    try{
      window.actionStatusName=v=>v==='planned'?'현장 재발방지조치 대기':v==='in_progress'?'재발방지조치 작성중':v==='submitted'?'안전관리자 확인대기':v==='rejected'?'재발방지조치 보완요청':v==='approved'?'재발방지조치 확인완료':'재발방지계획 수립대기';
      actionStatusName=window.actionStatusName;
    }catch(e){}
    try{window.actionBadge=i=>preventionBadge(i);actionBadge=window.actionBadge}catch(e){}
  }

  function ensureCss(){
    if(document.getElementById('prevention429Css'))return;
    const s=document.createElement('style');s.id='prevention429Css';s.textContent=`
      .prev429-list{display:grid;gap:10px}.prev429-card{border:1.5px solid #d7e3ec;border-radius:14px;background:#fff;padding:14px}.prev429-card.rejected{border-color:#e2b2b2;background:#fffafa}.prev429-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.prev429-card h3{margin:9px 0 6px;color:#173b66;font-size:17px}.prev429-meta{display:flex;gap:6px;flex-wrap:wrap}.prev429-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.prev429-grid>div{padding:10px;border:1px solid #dfe8ef;border-radius:10px;background:#f7fafc;min-width:0}.prev429-grid b{display:block;font-size:10px;color:#667c8f;margin-bottom:4px}.prev429-grid span{display:block;color:#29475f;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:keep-all}.prev429-plan{grid-column:1/-1;border-color:#c7ddec!important;background:#f3f9fd!important}.prev429-action{grid-column:1/-1;border-color:#cfe2d7!important;background:#f5faf7!important}.prev429-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.prev429-actions button{min-height:42px;border:1px solid #b9cbd8;border-radius:9px;background:#fff;color:#264f6e;padding:0 13px;font-weight:900}.prev429-actions button.primary{border-color:#1e5d91;background:#1e5d91;color:#fff}.prev429-actions button:disabled{opacity:.55;cursor:not-allowed}.prev429-wait{margin-top:9px;padding:10px 11px;border-radius:10px;background:#fff8e9;border:1px solid #ead8a9;color:#71551d;font-size:12px;line-height:1.5}.prev429-reject{margin-top:9px;padding:10px 11px;border-radius:10px;background:#fff0f0;border:1px solid #e8bcbc;color:#8b3737;font-size:12px;line-height:1.5}.prev429-note{padding:10px 11px;border:1px solid #d4e3ed;border-radius:10px;background:#f5fafd;color:#3b607c;font-size:12px;line-height:1.55}.prev429-modal-section{margin-top:12px;border:1px solid #d9e5ed;border-radius:12px;background:#fff;overflow:hidden}.prev429-modal-section>h3{margin:0;padding:10px 12px;background:#eef6fb;color:#174d78;font-size:14px}.prev429-modal-body{padding:12px;display:grid;gap:9px}.prev429-kv{display:grid;grid-template-columns:115px minmax(0,1fr);gap:10px;line-height:1.5}.prev429-kv>b{font-size:12px;color:#577084}.prev429-kv>span{font-size:13px;color:#29465d;white-space:pre-wrap}.prev429-confirm{border:2px solid #b9d8c5;background:#f6fbf8}.prev429-confirm>h3{background:#eaf6ef;color:#286044}.prev429-hidden-legacy{display:none!important}.prev429-flow{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.prev429-flow span{display:inline-flex;align-items:center;min-height:27px;padding:0 8px;border-radius:999px;background:#eef4f8;color:#526d82;border:1px solid #d2e0ea;font-size:10px;font-weight:900}.prev429-flow span.on{background:#1e5d91;color:#fff;border-color:#1e5d91}.prev429-flow span.done{background:#eaf6ef;color:#2e6949;border-color:#bdd9c7}.prev429-nav-alert{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;margin-left:6px;border-radius:999px;background:#cf3636;color:#fff!important;font-size:11px;font-weight:950;line-height:1;box-shadow:0 3px 8px rgba(174,44,44,.25)}.shell411-nav button.prev429-nav-attention{border-color:#cf4a4a!important;background:#fff4f4!important;color:#9b2e2e!important;box-shadow:0 0 0 2px rgba(207,54,54,.08)}.shell411-nav button.prev429-nav-attention.on{background:#a92d2d!important;color:#fff!important;border-color:#a92d2d!important}.shell411-nav button.prev429-nav-attention.on .prev429-nav-alert{background:#fff;color:#a92d2d!important}@media(max-width:620px){.prev429-grid{grid-template-columns:1fr}.prev429-plan,.prev429-action{grid-column:auto}.prev429-kv{grid-template-columns:1fr;gap:3px}.prev429-actions button{flex:1 1 145px}}
    `;document.head.appendChild(s);
  }

  function flowHtml(i){
    const c=i?.corrective||{},accepted=reportAccepted(i),plan=hasPlan(c),fieldDone=['submitted','rejected','approved'].includes(String(c.status||'')),closed=isFinalized(i);
    const steps=[['접수완료',accepted],['재발방지계획',plan],['현장 조치등록',fieldDone],['안전관리자 확인',String(c.status||'')==='approved'],['종결',closed]];
    let currentFound=false;
    return `<div class="prev429-flow">${steps.map(([label,done])=>{let cls=done?'done':'';if(!done&&!currentFound){cls='on';currentFound=true}return `<span class="${cls}">${ex(label)}</span>`}).join('')}</div>`;
  }

  function stripSentinelSummary(s){
    return String(s||'').replace(new RegExp(`\\s*\\[재발 방지 대책\\]\\s*${LEGACY_SENTINEL.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,'g'),'').replace(/\s{2,}/g,' ').trim();
  }
  function cleanupSentinel(){
    let dirty=false;
    for(const i of data?.incidents||[]){
      const d=i?.reportDetails;if(!d||text(d.preventionPlan)!==LEGACY_SENTINEL)continue;
      d.preventionPlan='';if(d.generatedSummary)d.generatedSummary=stripSentinelSummary(d.generatedSummary);if(i.summary)i.summary=stripSentinelSummary(i.summary);dirty=true;
    }
    if(dirty){try{saveData()}catch(e){}}
  }

  function patchReportForm(root=document){
    const form=root.querySelector?.('#unifiedReportForm');if(!form||form.dataset.prevention429==='1')return;form.dataset.prevention429='1';
    const prevention=form.querySelector('#preventionPlan410'),preventionLabel=prevention?.closest('label'),targetSection=prevention?.closest('.report410-section');
    const immediate=form.querySelector('#immediateAction'),immediateLabel=immediate?.closest('label'),originSection=immediate?.closest('.report410-section');
    if(targetSection){
      const head=targetSection.querySelector('.report410-section-head b');if(head)head.textContent='5. 사고조치 내용';
      const small=targetSection.querySelector('.report410-section-head small');if(small)small.textContent='사고 직후 실제로 실시한 응급처치·작업중지·현장통제·병원이송·보고 등의 조치를 입력합니다.';
      if(immediateLabel){const span=immediateLabel.querySelector('span');if(span)span.textContent='사고조치 내용 *';targetSection.insertBefore(immediateLabel,preventionLabel||targetSection.querySelector('.report410-grid')||targetSection.firstChild)}
    }
    if(originSection&&originSection!==targetSection){const small=originSection.querySelector('.report410-section-head small');if(small)small.textContent='사고 직전 작업과 발생 과정을 확인된 사실대로 입력합니다.'}
    if(prevention){if(!text(prevention.value))prevention.value=LEGACY_SENTINEL;prevention.required=false;preventionLabel?.classList.add('prev429-hidden-legacy');preventionLabel?.setAttribute('aria-hidden','true')}
    form.addEventListener('submit',()=>setTimeout(cleanupSentinel,0),true);
  }

  function preventionPlanMissing(u=currentUser?.()){if(!isSafety(u))return 0;return [...(data?.incidents||[])].filter(i=>reportAccepted(i)&&!historicalClosed(i)&&String(i.status||'')==='approved'&&!hasPlan(i.corrective)).length}
  function patchPreventionNav(u=currentUser?.()){
    const btn=document.querySelector('.shell411-nav [data-shell-view="actions"]');if(!btn||!isSafety(u))return;
    const count=preventionPlanMissing(u),existing=btn.querySelector('.prev429-nav-alert');btn.classList.toggle('prev429-nav-attention',count>0);
    const label=[...btn.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(label&&text(label.textContent)!=='재발방지 관리')label.textContent='재발방지 관리';else if(!label&&!existing)btn.prepend('재발방지 관리');
    if(count>0){const badge=existing||document.createElement('span');if(!existing){badge.className='prev429-nav-alert';btn.appendChild(badge)}if(badge.textContent!==String(count))badge.textContent=String(count);badge.setAttribute('aria-label',`재발방지계획 수립대기 ${count}건`)}
    else if(existing)existing.remove();
  }

  function reportUiRewrite(root=document){
    patchReportForm(root);patchPreventionNav();
    root.querySelectorAll?.('.inc411-kv').forEach(row=>{const key=row.querySelector('b'),val=row.querySelector('span');if(!key)return;const k=text(key.textContent);if(k==='즉시 조치')key.textContent='사고조치 내용';if(k==='재발방지대책'){if(!val||['','-',LEGACY_SENTINEL].includes(text(val.textContent)))row.remove();else key.textContent='기존 재발방지대책(전환 전)'}});
    const approve=root.querySelector?.('#approveInc');if(approve&&text(approve.textContent)!=='사고 접수완료')approve.textContent='사고 접수완료';
    root.querySelectorAll?.('option[value="approved"]').forEach(o=>{if(text(o.textContent)==='승인')o.textContent='접수완료'});
    root.querySelectorAll?.('.field411-badge,.pill,.shell411-recent-status span,.inc411-card-tags span,.shell411-stat span,.shell411-site span').forEach(el=>{const t=text(el.textContent);if(t==='승인')el.textContent='접수완료';else if(t==='사고조치 검토대기')el.textContent='재발방지조치 확인대기';else if(t==='조치 미작성')el.textContent='계획 수립대기'});
    root.querySelectorAll?.('.field411-meta span,.field411-public-state .field411-badge,.field411-manager-note,.shell411-head p,.section-head p').forEach(el=>{
      const t=text(el.textContent),map={'조치 보고승인 대기':'재발방지 접수대기','조치 미작성':'재발방지계획 수립대기','조치 조치예정':'현장 재발방지조치 대기','조치 조치중':'재발방지조치 작성중','조치 검토대기':'재발방지조치 확인대기','조치 반려':'재발방지조치 보완요청','조치 승인완료':'재발방지조치 확인완료','사고보고와 사고조치의 검토상태를 각각 확인합니다.':'사고 접수부터 재발방지계획·현장조치·확인완료까지 진행상태를 확인합니다.','사고보고 상태와 사고조치 상태를 함께 표시합니다.':'사고 접수상태와 재발방지 진행상태를 함께 표시합니다.','조치 미작성은 사고보고가 승인·종결된 건 중 아직 사고조치가 작성되지 않은 건입니다.':'계획 수립대기는 사고 접수완료 후 아직 안전관리자가 재발방지계획을 등록하지 않은 건입니다.','사고보고와 사고조치는 각각 별도 상태로 관리됩니다. 사고보고 승인 후 사고조치를 작성하고, 제출된 조치는 안전관리자가 별도로 검토·승인합니다.':'사고 접수완료 후 안전관리자가 재발방지계획을 수립하고, 현장에서 조치결과를 등록하면 안전관리자가 확인 후 종결합니다.'};if(map[t])el.textContent=map[t];
    });
    root.querySelectorAll?.('h2,h3,p,small,button').forEach(el=>{const t=text(el.textContent);if(t==='승인 사고')el.textContent='접수완료 사고';else if(t==='승인 사고 조회')el.textContent='접수완료 사고 조회';else if(t==='승인 사고 현황')el.textContent='접수완료 사고 현황';else if(t==='승인 사고조치')el.textContent='확인완료 재발방지조치';else if(t==='사고조치 검토대기')el.textContent='재발방지조치 확인대기';else if(t==='조치 미작성')el.textContent='계획 수립대기';else if(t==='사고 조치')el.textContent='재발방지 관리';else if(t==='종결 사고조치')el.textContent='종결 재발방지조치';else if(t==='사고보고 승인')el.textContent='사고 접수완료';else if(t==='사고조치 승인')el.textContent='재발방지조치 확인완료';else if(t==='최종 조치')el.textContent='최종 재발방지조치'});
    root.querySelectorAll?.('[data-lifecycle-final]').forEach(section=>{const id=section.getAttribute('data-lifecycle-final'),i=(data?.incidents||[]).find(x=>String(x.id)===String(id)),c=i?.corrective||{},grid=section.querySelector('.lifecycle413-final-grid');if(grid&&text(c.planDetail)&&!grid.querySelector('[data-prevention-plan]')){const first=grid.children[0],div=document.createElement('div');div.dataset.preventionPlan='1';div.innerHTML=`<b>재발방지계획</b><span>${ex(c.planDetail)}</span>`;if(first?.nextSibling)grid.insertBefore(div,first.nextSibling);else grid.appendChild(div)}});
  }

  function eligibleForAction(u){
    let arr=[...(data?.incidents||[])].filter(reportAccepted);if(isField(u)){arr=arr.filter(i=>sameSite(i,u));if(!isSiteManager(u))arr=arr.filter(i=>isAuthor(i,u))}if(isReader(u))arr=arr.filter(i=>String(i.corrective?.status||'')==='approved');return arr.sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0));
  }

  function cardHtml(i,u){
    const c=i?.corrective||{},q=quick(i),rejected=String(c.status||'')==='rejected',plan=hasPlan(c),action=text(c.actionDetail),safety=isSafety(u),field=isField(u),reader=isReader(u);let button='상세 확인',disabled=false;
    if(safety){if(isFinalized(i))button='종결 내용 확인';else if(!plan)button='재발방지계획 등록';else if(c.status==='submitted')button='재발방지조치 확인';else if(c.status==='rejected')button='보완조치 대기';else button='재발방지계획 확인·수정'}
    else if(field){if(!plan){button='안전관리자 계획 수립대기';disabled=true}else if(c.status==='submitted'){button='안전관리자 확인 중';disabled=true}else if(c.status==='approved')button='확인완료 내용 보기';else if(c.status==='rejected')button='보완 후 다시 제출';else if(action)button='재발방지조치 수정·제출';else button='재발방지조치 등록'}else if(reader)button='재발방지조치 확인';
    return `<article class="prev429-card ${rejected?'rejected':''}" data-prev-card="${ex(i.id)}"><div class="prev429-top"><div class="prev429-meta">${typeof categoryBadge==='function'?categoryBadge(i.category):''}${typeof statusBadge==='function'?statusBadge(i.status):''}${preventionBadge(i)}</div><span>${ex(q.when||'')}</span></div><h3>${ex(q.site||siteName(i.siteId))} · ${ex(q.headline||i.eventType||'사고')}</h3>${overview(i)}${flowHtml(i)}${rejected&&c.reviewNote?`<div class="prev429-reject"><b>안전관리자 보완요청</b><br>${ex(c.reviewNote)}</div>`:''}${!plan&&field?'<div class="prev429-wait">안전관리자가 사고 접수 후 재발방지계획을 수립하면 현장에서 조치내용을 등록할 수 있습니다.</div>':''}<div class="prev429-grid"><div><b>원인 분석</b><span>${ex(c.rootCause||'미등록')}</span></div><div><b>담당 / 완료목표</b><span>${ex(c.ownerName||'미지정')} · ${ex(c.dueDate||'미지정')}</span></div><div class="prev429-plan"><b>안전관리자 재발방지계획</b><span>${ex(c.planDetail||'미등록')}</span></div><div class="prev429-action"><b>현장 재발방지조치</b><span>${ex(c.actionDetail||'미등록')}</span></div></div><div class="prev429-actions"><button type="button" class="primary" data-prev-open="${ex(i.id)}" ${disabled?'disabled':''}>${ex(button)}</button></div></article>`;
  }

  function filterMatches(i,status){const c=i?.corrective||{},s=String(c.status||'');if(!status)return true;if(status==='plan_missing')return !hasPlan(c);if(status==='planned')return hasPlan(c)&&(!s||s==='planned');return s===status}

  function renderUnifiedActions429(root,u){
    ensureCss();const reader=isReader(u),safety=isSafety(u),base=eligibleForAction(u),preset={...actionFilter};const heading=preset.title||(reader?'확인완료 재발방지조치':safety?'재발방지 관리':'재발방지조치'),description=reader?'안전관리자가 최종 확인한 재발방지조치만 조회합니다.':safety?'접수완료된 사고의 재발방지계획을 수립하고, 현장이 등록한 조치를 확인해 종결합니다.':'안전관리자가 수립한 재발방지계획에 따라 조치하고 결과를 등록합니다.';
    root.innerHTML=`<section class="panel"><div class="section-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>${ex(heading)}</h2><p>${ex(description)}</p></div></div>${reader?'':`<div class="toolbar"><div class="left">${isField(u)?'':`<select id="prev429Site"><option value="">전체 사업장</option>${(data?.sites||[]).map(s=>`<option value="${ex(s.id)}" ${String(preset.siteId)===String(s.id)?'selected':''}>${ex(s.name)}</option>`).join('')}</select>`}<select id="prev429Status"><option value="" ${!preset.status?'selected':''}>전체 진행상태</option><option value="plan_missing" ${preset.status==='plan_missing'?'selected':''}>계획 수립대기</option><option value="planned" ${preset.status==='planned'?'selected':''}>현장 조치대기</option><option value="in_progress" ${preset.status==='in_progress'?'selected':''}>현장 작성중</option><option value="submitted" ${preset.status==='submitted'?'selected':''}>안전관리자 확인대기</option><option value="rejected" ${preset.status==='rejected'?'selected':''}>보완요청</option><option value="approved" ${preset.status==='approved'?'selected':''}>확인완료</option></select></div></div>`}<div id="prev429List" class="prev429-list"></div></section>`;
    const refresh=()=>{let arr=[...base];const site=isField(u)?'':(document.getElementById('prev429Site')?.value||preset.siteId||''),st=reader?'approved':(document.getElementById('prev429Status')?.value||preset.status||'');if(site)arr=arr.filter(i=>String(i.siteId)===String(site));if(st)arr=arr.filter(i=>filterMatches(i,st));const list=document.getElementById('prev429List');if(!list)return;list.innerHTML=arr.map(i=>cardHtml(i,u)).join('')||'<div class="empty">표시할 재발방지 관리 건이 없습니다.</div>';list.querySelectorAll('[data-prev-open]').forEach(b=>{if(!b.disabled)b.onclick=()=>openCorrectiveModal429(b.dataset.prevOpen,u)})};
    ['prev429Site','prev429Status'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{actionFilter={status:document.getElementById('prev429Status')?.value||'',siteId:document.getElementById('prev429Site')?.value||'',title:''};refresh()}));refresh();reportUiRewrite(root);
  }

  function renderFieldActions429(root,u){
    ensureCss();const arr=eligibleForAction(u);root.innerHTML=`<section class="field411-screen"><section class="panel"><div class="field411-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>재발방지조치</h2><p>안전관리자가 수립한 재발방지계획을 확인하고 실제 실시한 조치와 증빙을 등록합니다.</p></div></div><div class="prev429-note">사고 최초보고 단계에서는 사고 직후 조치까지만 작성합니다. 재발방지계획은 사고 접수완료 후 안전관리자가 별도로 수립합니다.</div></section><div class="prev429-list">${arr.map(i=>cardHtml(i,u)).join('')||'<div class="field411-empty">사고가 접수완료된 뒤 안전관리자가 재발방지계획을 등록하면 이 화면에 표시됩니다.</div>'}</div></section>`;window.enlAddFieldBack?.(root,u);root.querySelectorAll('[data-prev-open]').forEach(b=>{if(!b.disabled)b.onclick=()=>openCorrectiveModal429(b.dataset.prevOpen,u)});reportUiRewrite(root);
  }

  function historyPush(c,entry){c.reviewHistory=Array.isArray(c.reviewHistory)?c.reviewHistory:[];c.reviewHistory.push(entry)}
  function openReadOnly(i,u){
    const c=i.corrective||{},files=attachmentsHtml(c.afterPhotos||[]);openModal(`<div class="modal-head"><div><div class="ey">RECURRENCE PREVENTION</div><h2>${ex(siteName(i.siteId))} · ${ex(i.eventType||'사고')}</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}<section class="prev429-modal-section"><h3>재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'-')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'기존 사고조치 기록(전환 전)')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'-')} · ${ex(c.dueDate||'-')}</span></div><div class="prev429-kv"><b>계획 수립</b><span>${ex(c.planBy||'-')} · ${ex(c.planAt&&typeof fmt==='function'?fmt(c.planAt):(c.planAt||'-'))}</span></div></div></section><section class="prev429-modal-section prev429-confirm"><h3>현장 재발방지조치 및 확인</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>현장 조치내용</b><span>${ex(c.actionDetail||'-')}</span></div><div class="prev429-kv"><b>현장 제출</b><span>${ex(c.submittedBy||'-')} · ${ex(c.submittedAt&&typeof fmt==='function'?fmt(c.submittedAt):(c.submittedAt||'-'))}</span></div><div class="prev429-kv"><b>안전관리자 확인</b><span>${ex(c.reviewedBy||'-')} · ${ex(c.reviewedAt&&typeof fmt==='function'?fmt(c.reviewedAt):(c.reviewedAt||'-'))}</span></div>${c.reviewNote?`<div class="prev429-kv"><b>확인의견</b><span>${ex(c.reviewNote)}</span></div>`:''}</div></section>${files?`<section class="prev429-modal-section"><h3>조치 증빙 사진 · PDF</h3><div class="prev429-modal-body">${files}</div></section>`:''}`);bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[]);
  }

  function openSafetyPlanModal(i,u){
    const c=i.corrective||{},plan=hasPlan(c),locked=(plan&&['submitted','approved'].includes(String(c.status||'')))||isFinalized(i),files=attachmentsHtml(c.afterPhotos||[]);
    if(locked){
      if(c.status==='submitted'){
        openModal(`<div class="modal-head"><div><div class="ey">SAFETY CONFIRMATION</div><h2>${ex(siteName(i.siteId))} · 재발방지조치 확인</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}<section class="prev429-modal-section"><h3>안전관리자 재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'-')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'-')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'-')} · ${ex(c.dueDate||'-')}</span></div></div></section><section class="prev429-modal-section prev429-confirm"><h3>현장 재발방지조치</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>조치내용</b><span>${ex(c.actionDetail||'-')}</span></div><div class="prev429-kv"><b>제출자</b><span>${ex(c.submittedBy||'-')} · ${ex(c.submittedAt&&typeof fmt==='function'?fmt(c.submittedAt):(c.submittedAt||'-'))}</span></div>${files?`<div>${files}</div>`:''}</div></section><label class="lbl"><span>확인의견 / 보완요청 사유</span><textarea id="prev429Review" rows="3" placeholder="확인 의견은 선택사항이며, 보완요청 시 사유는 필수입니다.">${ex(c.reviewNote||'')}</textarea></label><div class="modal-actions"><button type="button" class="btn-reject" id="prev429Reject">보완요청</button><button type="button" class="btn-green" id="prev429Approve">재발방지조치 확인완료</button></div>`);
        bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[]);
        document.getElementById('prev429Approve')?.addEventListener('click',()=>{const ts=now(),note=text(document.getElementById('prev429Review')?.value);c.status='approved';c.reviewNote=note;c.reviewedBy=u.name;c.reviewedById=userId(u);c.reviewedAt=ts;historyPush(c,{action:'prevention_action_confirmed',by:u.name,at:ts,note});i.corrective=c;i.status='closed';i.closedAt=ts;i.updatedAt=ts;saveData();closeModal();renderShell(u);alert('재발방지조치 확인이 완료되어 사고가 종결되었습니다.')});
        document.getElementById('prev429Reject')?.addEventListener('click',()=>{const note=text(document.getElementById('prev429Review')?.value);if(!note)return alert('보완요청 사유를 입력해 주세요.');const ts=now();c.status='rejected';c.reviewNote=note;c.reviewedBy=u.name;c.reviewedById=userId(u);c.reviewedAt=ts;historyPush(c,{action:'prevention_action_rejected',by:u.name,at:ts,note});i.corrective=c;i.updatedAt=ts;saveData();closeModal();renderShell(u);alert('현장에 재발방지조치 보완을 요청했습니다.')});return;
      }
      return openReadOnly(i,u);
    }
    const draft=autoPreventionDraft(i),rootCauseValue=text(c.rootCause)||draft.rootCause,planDetailValue=text(c.planDetail)||draft.planDetail,ownerValue=text(c.ownerName)||draft.ownerName,dueValue=text(c.dueDate)||draft.dueDate;
    openModal(`<div class="modal-head"><div><div class="ey">PREVENTION PLAN</div><h2>${ex(siteName(i.siteId))} · 재발방지계획 ${plan?'확인·수정':'등록'}</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}${c.status==='rejected'&&c.reviewNote?`<div class="prev429-reject"><b>현장 조치 보완요청 중</b><br>${ex(c.reviewNote)}</div>`:''}<form id="prev429PlanForm"><label class="lbl"><span>원인 분석 *</span><textarea id="prev429RootCause" rows="3" required placeholder="사고 발생의 직접·간접 원인을 사실에 근거해 정리합니다.">${ex(rootCauseValue)}</textarea></label><label class="lbl"><span>재발방지계획 *</span><textarea id="prev429PlanDetail" rows="4" required placeholder="설비개선, 작업방법 변경, 보호구, 교육 등 재발방지를 위해 실시해야 할 계획을 구체적으로 입력합니다.">${ex(planDetailValue)}</textarea></label><div class="formgrid"><label class="lbl"><span>조치 담당자 *</span><input id="prev429Owner" value="${ex(ownerValue)}" required placeholder="예: 현장소장 홍길동"></label><label class="lbl"><span>완료 목표일 *</span><input id="prev429Due" type="date" value="${ex(dueValue)}" required></label></div><button class="primary full" type="submit">${plan?'재발방지계획 수정 저장':'재발방지계획 등록'}</button></form>`);
    document.getElementById('prev429PlanForm').onsubmit=e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;const ts=now(),prevStatus=String(c.status||'');c.rootCause=text(document.getElementById('prev429RootCause')?.value);c.planDetail=text(document.getElementById('prev429PlanDetail')?.value);c.ownerName=text(document.getElementById('prev429Owner')?.value);c.dueDate=text(document.getElementById('prev429Due')?.value);c.planBy=c.planBy||u.name;c.planById=c.planById||userId(u);c.planAt=c.planAt||ts;c.planUpdatedBy=u.name;c.planUpdatedAt=ts;if(!plan)c.status=text(c.actionDetail)?'in_progress':'planned';else if(!prevStatus||prevStatus==='none')c.status='planned';historyPush(c,{action:plan?'prevention_plan_updated':'prevention_plan_registered',by:u.name,at:ts,note:c.planDetail});i.corrective=c;i.updatedAt=ts;saveData();closeModal();renderShell(u);alert(plan?'재발방지계획을 수정했습니다.':'재발방지계획을 등록했습니다. 현장에서 재발방지조치를 등록할 수 있습니다.')};
  }

  function openFieldActionModal(i,u){
    const c=i.corrective||{};if(!hasPlan(c))return alert('안전관리자가 재발방지계획을 등록한 뒤 조치할 수 있습니다.');if(c.status==='submitted')return alert('재발방지조치가 안전관리자 확인대기 중입니다.');if(c.status==='approved'||isFinalized(i))return openReadOnly(i,u);
    actionPhotos=[...(c.afterPhotos||[])];const rejected=String(c.status||'')==='rejected';
    openModal(`<div class="modal-head"><div><div class="ey">FIELD PREVENTION ACTION</div><h2>${ex(siteName(i.siteId))} · 재발방지조치 등록</h2><div style="margin-top:7px">${preventionBadge(i)}</div></div><button class="x" data-close>×</button></div>${overview(i)}${flowHtml(i)}<section class="prev429-modal-section"><h3>안전관리자 재발방지계획</h3><div class="prev429-modal-body"><div class="prev429-kv"><b>원인 분석</b><span>${ex(c.rootCause||'-')}</span></div><div class="prev429-kv"><b>재발방지계획</b><span>${ex(c.planDetail||'-')}</span></div><div class="prev429-kv"><b>담당 / 목표일</b><span>${ex(c.ownerName||'-')} · ${ex(c.dueDate||'-')}</span></div></div></section>${rejected&&c.reviewNote?`<div class="prev429-reject"><b>안전관리자 보완요청</b><br>${ex(c.reviewNote)}</div>`:''}<form id="prev429FieldForm"><label class="lbl"><span>실제 실시한 재발방지조치 *</span><textarea id="prev429ActionDetail" rows="5" required placeholder="재발방지계획에 따라 현장에서 실제 실시한 조치 결과를 입력합니다.">${ex(c.actionDetail||'')}</textarea></label>${typeof photoPickerHtml==='function'?photoPickerHtml('action'):''}<div class="modal-actions"><button type="button" class="btn-gray" id="prev429Draft">임시저장</button><button type="submit" class="btn-blue">안전관리자 확인요청</button></div></form>`);
    try{renderPhotoThumbs('action');bindPhotoButtons()}catch(e){bindAttachments(document.getElementById('modalRoot'),c.afterPhotos||[])}
    const save=status=>{const detail=text(document.getElementById('prev429ActionDetail')?.value);if(!detail)return alert('실제로 실시한 재발방지조치 내용을 입력해 주세요.');const ts=now();c.actionDetail=detail;c.afterPhotos=persistAttachments(actionPhotos);c.status=status;c.actionBy=c.actionBy||u.name;c.actionById=c.actionById||userId(u);c.actionStartedAt=c.actionStartedAt||ts;c.actionUpdatedAt=ts;if(status==='submitted'){c.submittedBy=u.name;c.submittedById=userId(u);c.submittedAt=ts}historyPush(c,{action:status==='submitted'?'prevention_action_submitted':'prevention_action_draft',by:u.name,at:ts,note:detail});i.corrective=c;i.updatedAt=ts;saveData();actionPhotos=[];closeModal();renderShell(u);alert(status==='submitted'?'재발방지조치를 안전관리자 확인대기로 제출했습니다.':'재발방지조치를 임시저장했습니다.')};
    document.getElementById('prev429Draft')?.addEventListener('click',()=>save('in_progress'));document.getElementById('prev429FieldForm').onsubmit=e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;save('submitted')};
  }

  function openCorrectiveModal429(id,u=currentUser?.()){
    const i=(data?.incidents||[]).find(x=>String(x.id)===String(id));if(!i)return alert('사고기록을 찾지 못했습니다.');if(!reportAccepted(i))return alert('안전관리자가 사고 접수완료 처리한 뒤 재발방지 절차를 진행할 수 있습니다.');if(isField(u)&&!sameSite(i,u))return alert('소속 사업장의 사고만 확인할 수 있습니다.');if(isSafety(u))return openSafetyPlanModal(i,u);if(isField(u))return openFieldActionModal(i,u);return openReadOnly(i,u);
  }

  function installRoutes(){
    window.renderUnifiedActions=renderUnifiedActions429;window.enlRenderFieldActions=renderFieldActions429;window.openUnifiedCorrectiveModal=openCorrectiveModal429;window.enlResetActionFilter=()=>{actionFilter={status:'',siteId:'',title:''}};window.enlSetActionFilter=filter=>{actionFilter={status:filter?.status||'',siteId:filter?.siteId||'',title:filter?.title||''}};window.enlOpenActionQueue=(u,filter={})=>{const mapped=filter?.status==='submitted'?'submitted':filter?.status||'';window.enlSetActionFilter({...filter,status:mapped,title:filter?.title==='사고조치 검토대기'?'재발방지조치 확인대기':filter?.title||''});currentView='actions';renderShell(u||currentUser())};
  }
  function wrapShell(){const base=window.renderShell;if(typeof base!=='function'||base.__prevention429)return;const wrapped=function(u){const out=base.call(this,u);installRoutes();setTimeout(()=>reportUiRewrite(document),0);return out};wrapped.__prevention429=true;window.renderShell=wrapped;try{renderShell=wrapped}catch(e){}}

  ensureCss();installGlobalLabels();installRoutes();wrapShell();cleanupSentinel();const observer=new MutationObserver(()=>reportUiRewrite(document));observer.observe(document.body,{childList:true,subtree:true});reportUiRewrite(document);window.enlPreventionPlanMissingCount=preventionPlanMissing;window.enlPreventionFlowV429={version:VERSION,hasPlan,statusText,open:openCorrectiveModal429,patchReportForm,cleanupSentinel};window.ENL_PREVENTION_FLOW_VERSION=VERSION;
})();
