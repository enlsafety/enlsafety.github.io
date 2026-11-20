(()=>{
'use strict';
const docs={policy:'01. 안전보건경영방침',objectives:'02. 안전보건경영목표'};
const steps={empty:'게시 확인 전',pending:'안전관리자 확인 대기',approved:'최신화 완료',rejected:'사진 재제출 요청'};
const ns='http://www.w3.org/2000/svg';
const make=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=txt;if(cls)n.className=cls;return n};
const btn=(txt,fn,cls)=>{const n=make('button',txt,cls);n.type='button';n.onclick=fn;return n};
const when=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.replace(/-/g,'. ') : '';
const cleanYear=v=>Number.isInteger(Number(v))&&Number(v)>=2000&&Number(v)<=2100?Number(v):2026;
function poster(kind,settings){
  const year=cleanYear(settings.year),day=date(settings.date),goal=kind==='objectives';
  const title=goal?'안전 · 보건에 관한 CEO 경영목표':'안전 · 보건에 관한 CEO 경영방침';
  const filter='policy-shadow-'+kind,area=make('div',null,'policy-poster');
  area.dataset.documentKind=kind;
  // Every sentence is transcribed from the two uploaded, approved A4 source slides.
  const t=(x,y,str,size=18,bold=true,fill='#1a1b1e',anchor='start')=>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${bold?700:400}" fill="${fill}" text-anchor="${anchor}" font-family="Malgun Gothic,Apple SD Gothic Neo,Noto Sans CJK KR,Arial,sans-serif">${str}</text>`;
  // The alternating bar breaks mirror the EIGHTEEN&LIFE logomark in the source slide.
  const logoGaps=[[73,76],[80,83],[80,83],[86,89],[80,83],[86,89],[80,83],[80,83],[73,76]];
  const logoBars=logoGaps.map(([a,b],i)=>`<rect x="${621+i*16}" y="54" width="10" height="${a-54}" fill="#080808"/><rect x="${621+i*16}" y="${b}" width="10" height="${105-b}" fill="#080808"/>`).join('');
  // Vector trace of the red corporate seal embedded in both supplied original PPTX files.
  const stamp=`<g transform="translate(639 995) scale(.78)"><path d="M49,1L26,9L13,20L3,38L1,57L7,78L20,94L38,104L62,106L80,100L95,87L105,68L106,47L101,31L85,12L64,2ZM44,4L62,4L82,13L96,27L104,47L103,67L94,85L78,99L64,104L46,104L29,98L14,85L8,76L4,65L3,49L9,30L27,11ZM46,90L50,93L45,96L47,98L55,99L53,101L42,100L51,102L55,101L58,91L56,91L55,97L47,96L52,94L52,92ZM90,82L75,96L76,97L83,90L85,91L85,88L90,84L91,85ZM31,96L38,98L43,86L48,88L58,87L53,88L41,85L36,94L34,92L37,85L36,82L33,93L37,96ZM83,72L83,75L75,83L66,88L63,86L70,99L71,97L66,89L78,82L79,84L72,89L72,92L74,92L83,86L88,80L88,78L86,78L81,82L79,81L84,76ZM77,87L78,88L75,90L74,89ZM82,83L83,84L78,88L77,87ZM94,45L94,47L99,47L101,51L94,64L96,64L100,58L101,65L101,46ZM86,45L88,54L86,68L99,71L99,69L90,68L93,59L91,45L92,58L90,66L87,67L89,53ZM12,39L7,44L10,52L14,49L15,44ZM12,41L13,48L10,50L8,45ZM25,37L21,42L20,51L18,53L15,52L16,54L20,54ZM11,33L17,36L19,41L20,36L16,33L18,30L28,34L15,27L15,32ZM47,17L44,16L29,23L28,25L30,29L40,23L48,21L46,19ZM30,25L31,23L33,24ZM93,27L78,13L77,14L82,18L80,19L74,16L76,18L72,19L67,24L69,25L74,20L81,26L76,33L64,25L55,23L46,24L37,28L30,34L24,44L23,61L26,69L23,68L21,60L11,65L12,75L8,66L11,76L20,87L22,86L19,82L20,80L25,84L29,82L18,67L15,69L15,75L11,67L19,61L26,74L32,80L27,74L28,72L38,81L48,85L61,85L67,83L80,72L85,61L84,46L77,34L84,28L89,35L84,41L85,42L91,37L89,33L90,31L94,35L90,29L91,27L96,32ZM16,81L17,80L18,82L17,83ZM14,78L15,77L16,79L15,80ZM12,75L13,74L15,77L14,78ZM69,70L75,70L77,73L73,75ZM25,70L26,69L28,72L27,73ZM18,69L26,78L27,81L25,83L18,76ZM61,68L63,70L60,74L66,73L70,78L69,80L66,77L60,78L57,76L58,71ZM33,75L38,74L39,70L43,69L45,71L43,78L46,79L49,67L55,66L57,69L55,71L51,70L50,73L54,74L55,81L60,83L45,83ZM26,66L35,66L36,70L31,71ZM40,65L42,63L46,66L42,67ZM25,61L32,61L37,64L28,64ZM41,60L43,59L46,62L44,63ZM43,55L46,57L44,59L41,57ZM35,55L38,54L39,56L36,57ZM43,52L55,52L57,55L61,55L68,45L70,55L75,59L80,59L81,54L72,51L74,47L80,47L84,51L84,60L79,70L73,69L67,66L74,66L68,62L75,62L69,60L67,56L57,58L63,61L56,61L57,63L62,64L60,66L51,64L51,61L47,58L52,57ZM42,37L47,41L46,43L42,42L42,44L46,46L45,47L37,45L37,42ZM52,35L55,37L53,39L50,38ZM75,34L77,36L76,41L80,42L80,44L76,44L72,41ZM46,34L48,35L47,38L44,36ZM35,32L36,36L33,37L35,43L31,44L29,48L40,51L38,53L30,51L29,52L34,55L28,56L36,58L37,61L26,59L24,57L25,46L29,38ZM53,31L55,32L54,35L51,33ZM42,31L43,36L41,38L38,35ZM47,30L49,31L48,34L45,32ZM89,26L90,25L91,27L90,28ZM41,28L47,25L63,26L72,32L70,41L68,42L66,40L68,35L66,31L63,37L57,42L57,45L62,44L64,46L60,50L54,50L49,47L55,45L50,42L55,41L58,32L57,30L48,27L45,28L43,32ZM81,19L83,18L84,20ZM75,19L77,18L86,23L90,31L89,32ZM61,7L56,10L55,18L59,22L65,22L69,18L70,13L66,8ZM61,8L64,9L61,11L61,18L63,18L65,10L68,12L68,17L64,21L60,21L56,17L57,11ZM44,8L42,7L42,10L39,12L35,10L27,15L26,19L29,21L42,11L45,14ZM34,12L36,14L29,19L28,16ZM48,6L47,8L53,21Z" fill="#e20000" fill-rule="evenodd"/></g>`;
  const card=(cy,i,lines,heading)=>{
    const y=cy-55;
    let content='';
    if(heading){
      content+=t(136,cy-8,lines[0],24,true);
      content+=t(136,cy+30,lines[1],17,false);
    }else if(lines.length===1)content+=t(136,cy+7,lines[0],16.4,true);
    else{
      content+=t(136,cy-3,lines[0],16.2,true);
      content+=t(136,cy+18,lines[1],16.2,true);
    }
    return `<rect x="57" y="${y}" width="711" height="111" rx="19" fill="#fff" stroke="#d2eaf5" stroke-width="4" filter="url(#${filter})"/>
      <circle cx="98" cy="${cy}" r="22" fill="#6ec5f0" filter="url(#${filter})"/>
      ${t(98,cy+9,String(i),27,false,'#fff','middle')}${content}`;
  };
  const policyIntro=[
    '주식회사 이앤엘은 믿음과 가치를 창조하는 기업이라는 창업이념으로',
    '모든 직원의 생명보호와 현장의 안전을 최우선 목표로 하여',
    '임직원과 이해관계자 모두가 다음 사항을 적극 실천한다.'
  ];
  const goalIntro=[
    year+'년 주식회사 이앤엘은',
    '“중대산업재해 ZERO · 위험요인 선제관리 · 안전 기본수칙 100%”',
    '를 핵심 안전보건 목표로 추진한다.'
  ];
  const intro=goal?goalIntro:policyIntro;
  const cards=goal?
    card(491,1,['중대산업재해 ZERO','중대산업재해 0건, 중상해 사고 예방'],true)+
    card(656,2,['위험성평가 대상작업 및 고위험작업 전 점검 100%','농약, 화학제품, 예초, 기계, 차량, 경사면, 공사, 폭염 등 핵심위험 사전관리'],true)+
    card(825,3,['법정교육 이수 및 재발방지 개선조치 100%','법정 안전보건교육 이수율 100%, 사고 , 아차사고 개선조치 완료율 100%'],true)
    :
    card(441,1,['안전에 대하여 절대 타협하지 않으며, 모든 조직에 안전문화를 정착시킨다.'])+
    card(571,2,['불안전한 행동 및 환경을 포함한 위험요소를 사전에 파악하고 평가하여','예방대책과 개선활동을 지속적으로 실시한다.'])+
    card(701,3,['전 임직원은 안전보건 확보를 위한 참여와 소통에 솔선수범하고,','안전보건 관계법령 및 제반 규정을 철저히 준수한다.'])+
    card(831,4,['안전보건관리체계를 지속적으로 점검하고 개선하여','안전하고 쾌적한 사업장을 만든다.']);
  const introTop=goal?215:211,introHeight=goal?158:125;
  const introText=goal?
    t(413,265,intro[0],24,true,'#101820','middle')+
    t(413,304,intro[1],24,true,'#101820','middle')+
    t(413,348,intro[2],24,true,'#101820','middle')
    :
    t(413,251,intro[0],19,true,'#101820','middle')+
    t(413,287,intro[1],19,true,'#101820','middle')+
    t(413,322,intro[2],19,true,'#101820','middle');
  area.innerHTML=`<svg xmlns="${ns}" viewBox="0 0 827 1169" role="img" aria-label="${title} ${year}년 A4 출력 양식" preserveAspectRatio="xMidYMid meet">
    <defs><filter id="${filter}" x="-10%" y="-15%" width="125%" height="150%"><feDropShadow dx="1.5" dy="4" stdDeviation="2" flood-color="#000" flood-opacity=".22"/></filter></defs>
    <rect width="827" height="1169" fill="white"/>
    <rect width="827" height="165" fill="#195c89"/>
    <rect y="162" width="827" height="5" fill="#bedfeb"/>
    ${t(58,47,'E&L  |  SAFETY & HEALTH '+(goal?'OBJECTIVES ':'POLICY ')+year,11,false,'#cce8f5')}
    ${t(58,111,title,34,true,'#fff')}
    <rect x="58" y="122" width="82" height="29" rx="5" fill="#79c9f4"/>
    ${t(99,148,String(year),27,false,'#fff','middle')}
    <rect x="602" y="35" width="179" height="101" rx="18" fill="#fff"/>
    ${logoBars}
    ${t(692,123,'EIGHTEEN&LIFE',13,false,'#111','middle')}
    <rect x="57" y="${introTop}" width="713" height="${introHeight}" rx="21" fill="#eef6fb" filter="url(#${filter})"/>
    ${introText}
    ${cards}
    <path d="M113 968H714" stroke="#f4f7f9" stroke-width="7"/>
    ${t(413,1010,day,27,false,'#7292af','middle')}
    ${t(413,1055,'주식회사 이앤엘  대표이사  박 상 훈',25,true,'#1e4d78','middle')}
    ${stamp}
    ${t(413,1117,'EIGHTEEN&LIFE  ·  SAFETY FIRST',8,false,'#bdd0dd','middle')}
    </svg>`;
  return area;
}
function printPoster(kind,settings,siteName){
  const container=make('div',null,'policy-print-page');
  container.append(poster(kind,settings));
  container.id='enl-policy-print-page';
  const style=make('style','@page{size:A4 portrait;margin:0}');
  const before=document.title;
  const cleanup=()=>{container.remove();style.remove();document.title=before;window.removeEventListener('afterprint',cleanup)};
  document.getElementById('enl-policy-print-page')?.remove();
  document.body.append(container);document.head.append(style);
  document.title=(siteName||'이앤엘')+' '+docs[kind]+' '+settings.year;
  window.addEventListener('afterprint',cleanup,{once:true});
  try{window.print()}catch(e){cleanup();throw e}
}
function mount(host,u,api,sameUser){
  const admin=u.role==='safety',field=u.role==='field';
  let enabled=false,panel=null,main=null,nav=null,settings=null,sites=[],siteId=null,kind=null,request=0,busy=false,needCount=0;
  const status=(message)=>make('p',message,'policy-message');
  const hasWork=s=>s.active&&(admin?['pending'].includes(s.policyState)||['pending'].includes(s.objectivesState):
    field&&(s.policyState!=='approved'||s.objectivesState!=='approved'));
  function badges(){
    for(const el of host.querySelectorAll('[data-module="policy"],[data-hub="feature:policy"]')){
      let dot=el.querySelector('.policy-dot');
      if(!enabled||!needCount){dot?.remove();continue;}
      if(!dot){dot=make('span',null,'policy-dot');el.append(dot)}
      dot.title=admin?'확인이 필요한 사업장 '+needCount+'개':'현장 최신화 미완료';
      dot.setAttribute('aria-label',dot.title);
    }
  }
  let badgeRequest=0;
  async function refreshBadges(){
    if(!enabled||!sameUser())return;
    const id=++badgeRequest;
    try{
      const result=await api({action:'platform_policy_list'});
      if(id!==badgeRequest||!sameUser()||!enabled)return;
      needCount=(result.sites||[]).filter(hasWork).length;badges();
    }catch{/* Leave the last verified badge state unchanged during a transient outage. */}
  }
  function catalog(m){
    enabled=!!m&&m.enabled!==false&&m.state!=='hidden'&&m.canEnter!==false&&(m.state==='live'||m.preview);
    if(!enabled)needCount=0;badges();if(enabled)refreshBadges();
  }
  function canLeave(){return !busy}
  function canSuspend(){return !busy}
  function leave(){request++;siteId=null;kind=null;main=null;nav=null;panel?.replaceChildren();badges()}
  const current=()=>sites.find(s=>s.siteId===siteId);
  function siteState(s){
    if(!s.active)return '종료 사업장';
    if(s.complete)return '경영방침 및 목표 확인완료';
    if(s.policyState==='pending'||s.objectivesState==='pending')return '안전관리자 확인 대기';
    if(s.policyState==='rejected'||s.objectivesState==='rejected')return '사진 재제출 필요';
    return '최신화 미완료';
  }
  function stateClass(state){return state==='approved'?'is-approved':state==='pending'?'is-pending':state==='rejected'?'is-rejected':'is-empty'}
  function rail(){
    if(!nav)return;
    nav.replaceChildren();
    nav.append(make('h3','사업장 폴더 ('+sites.length+')'));
    for(const s of sites){
      const b=btn('',()=>chooseSite(s.siteId),'policy-folder');
      b.dataset.siteId=s.siteId;
      b.append(make('strong',s.folderName),make('small',siteState(s),'policy-badge '+(s.complete?'is-approved':s.policyState==='pending'||s.objectivesState==='pending'?'is-pending':'is-empty')));
      if(s.siteId===siteId)b.setAttribute('aria-current','page');
      nav.append(b);
      if(s.siteId===siteId){
        for(const [doc,label] of Object.entries(docs)){
          const sub=btn(label,()=>chooseDocument(doc),'policy-rail-child');
          if(kind===doc)sub.setAttribute('aria-current','page');nav.append(sub);
        }
      }
    }
  }
  function sitesPage(){
    if(!main)return;siteId=null;kind=null;rail();
    const heading=make('div',null,'policy-page-title');
    heading.append(make('h3','사업장별 경영방침 및 목표'),status('사업장을 선택해 고정 양식으로 된 경영방침과 목표를 출력하고 게시 여부를 확인하세요.'));
    const grid=make('div',null,'policy-site-grid');
    for(const s of sites){
      const b=btn('',()=>chooseSite(s.siteId),'policy-site-card');
      b.append(make('strong',s.folderName),make('small',siteState(s),'policy-badge '+(s.complete?'is-approved':s.policyState==='pending'||s.objectivesState==='pending'?'is-pending':'is-empty')));
      grid.append(b);
    }
    main.replaceChildren(heading,grid);
    if(!sites.length)main.append(status('조회 가능한 사업장이 없습니다.'));
  }
  function documentsPage(){
    const s=current();if(!s)return sitesPage();kind=null;rail();
    const back=btn('← 사업장 목록',sitesPage,'policy-back');
    const heading=make('div',null,'policy-page-title');
    heading.append(make('h3',s.folderName),status('두 문서의 게시 사진을 각각 제출하고 안전관리자 확인을 받아야 완료됩니다.'));
    const grid=make('div',null,'policy-document-grid');
    for(const [k,name] of Object.entries(docs)){
      const state=s[k==='policy'?'policyState':'objectivesState'];
      const card=btn('',()=>chooseDocument(k),'policy-document-card');
      card.append(make('strong',name),make('span',steps[state]||steps.empty,'policy-badge '+stateClass(state)));
      grid.append(card);
    }
    main.replaceChildren(back,heading,grid);
  }
  function chooseSite(id){siteId=id;kind=null;documentsPage()}
  async function reload(preserve=true){
    const seq=++request,oldSite=preserve?siteId:null,oldKind=preserve?kind:null;
    if(!main)return;
    main.replaceChildren(status('사업장별 최신화 상태를 불러오는 중입니다.'));
    try{
      const result=await api({action:'platform_policy_list'});
      if(seq!==request||!sameUser()||!main)return;
      sites=result.sites||[];settings=result.settings;
      siteId=sites.some(s=>s.siteId===oldSite)?oldSite:null;kind=siteId?oldKind:null;
      needCount=sites.filter(hasWork).length;badges();head();
      if(siteId&&kind)await chooseDocument(kind);
      else if(siteId)documentsPage();else sitesPage();
    }catch(e){if(seq===request&&main){main.replaceChildren(status('최신화 현황을 불러오지 못했습니다.'),btn('다시 불러오기',()=>reload(preserve)));}}
  }
  function head(){
    const h=panel?.querySelector('.policy-panel-head');if(!h)return;
    h.replaceChildren(make('div',null,'policy-heading'));
    const name=h.firstChild;name.append(make('h2','경영방침 및 목표'),make('p',settings?.year+'년 · 시행일 '+date(settings?.date),'policy-message'));
    const buttons=make('div',null,'policy-top-actions');
    buttons.append(btn('새로고침',()=>reload(true)));
    if(admin)buttons.append(btn('전체 수정',globalEdit,'policy-main-action'));
    h.append(buttons);
  }
  function globalEdit(){
    if(!admin||!settings||busy)return;
    const dialog=make('dialog',null,'policy-global-dialog');
    const form=make('form');form.innerHTML='<h3>경영방침 및 목표 전체 수정</h3><p>전 사업장에 적용되는 두 문서의 상단 연도와 하단 시행일을 함께 수정합니다.</p><label>상단 표시 연도<input name="year" type="number" min="2000" max="2100" step="1" required></label><label>하단 시행일<input name="date" type="date" required></label><p class="policy-dialog-warning">변경 내용을 저장하면 전 사업장의 최신화 확인이 초기화됩니다. 기존 게시 사진과 승인 이력은 보관됩니다. 날짜만 변경해도 재확인이 필요합니다.</p><div class="policy-dialog-actions"><button type="button" data-cancel>취소</button><button type="submit">전 사업장에 적용</button></div><p role="status"></p>';
    form.elements.year.value=settings.year;form.elements.date.value=settings.date;
    dialog.append(form);host.append(dialog);
    const note=form.querySelector('[role=status]'),submit=form.querySelector('[type=submit]');
    form.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.onclose=()=>dialog.remove();
    form.onsubmit=async e=>{
      e.preventDefault();if(busy)return;
      const year=Number(form.elements.year.value),dt=form.elements.date.value;
      if(year===settings.year&&dt===settings.date){dialog.close();return;}
      if(!confirm(year+'년, 시행일 '+dt+'로 전체 문서를 바꾸고 모든 사업장의 최신화 확인을 다시 진행할까요?'))return;
      busy=true;submit.disabled=true;note.textContent='적용 중입니다.';
      try{
        await api({action:'platform_policy_global_update',year,date:dt,revision:settings.revision});
        dialog.close();await reload(true);
      }catch(err){note.textContent=err.message==='settings_changed'?'다른 관리자의 수정이 반영됐습니다. 닫은 뒤 최신 정보를 확인하세요.':'전 사업장 수정에 실패했습니다. 다시 확인해 주세요.';}
      finally{busy=false;submit.disabled=false;}
    };
    dialog.showModal();
  }
  async function chooseDocument(doc){
    const s=current();if(!s||!settings)return;
    kind=doc;rail();const seq=++request;
    main.replaceChildren(status('경영방침 및 목표 원본 양식을 불러오는 중입니다.'));
    try{
      const data=await api({action:'platform_policy_open',siteId:s.siteId,kind:doc});
      if(seq!==request||!sameUser()||kind!==doc||siteId!==s.siteId||!main)return;
      settings=data.settings;head();renderDocument(data);
    }catch(err){if(seq===request&&main)main.replaceChildren(status('문서를 불러오지 못했습니다.'),btn('다시 불러오기',()=>chooseDocument(doc)));}
  }
  function renderDocument(data){
    const s=data.site,proof=data.proof,doc=data.kind,set=data.settings,st=proof?.state||'empty',locked=st==='approved'||st==='pending';
    const back=btn('← '+s.folderName+' 서류 목록',documentsPage,'policy-back');
    const heading=make('div',null,'policy-document-heading');
    const text=make('div');text.append(make('h3',s.siteName+' / '+docs[doc]),make('p',set.year+'년 · 시행일 '+date(set.date)+' · '+(steps[st]||steps.empty),'policy-message'));
    const actions=make('div',null,'policy-doc-actions');
    actions.append(btn('PDF 출력',()=>printPoster(doc,set,s.siteName),'policy-main-action'));
    const upload=make('input');upload.type='file';upload.accept='image/*';upload.hidden=true;
    const note=status(st==='empty'?'양식을 출력하여 현장에 게시한 후 실제 게시 사진을 제출해 주세요.':
      st==='pending'?'현장에서 사진을 제출했습니다. 안전관리자 확인 대기 중입니다.':
      st==='approved'?'안전관리자 확인이 완료된 문서입니다.':'반려 사유를 확인한 뒤 새 게시 사진을 제출해 주세요.');
    if(field&&s.active&&!locked)actions.append(btn(st==='rejected'?'게시 사진 다시 제출':'최신화 및 게시 사진 제출',()=>upload.click(),'policy-main-action'));
    actions.append(upload);heading.append(text,actions);
    const paper=poster(doc,set);
    const tip=make('p','원본 양식은 고정되어 있습니다. 연도와 시행일은 안전관리자의 ‘전체 수정’에서만 변경할 수 있습니다.','policy-help');
    const left=make('div',null,'policy-paper-panel');left.append(paper,tip);
    const right=make('aside',null,'policy-review-panel');
    right.append(make('h4','현장 게시 여부 확인'),make('div',steps[st]||steps.empty,'policy-badge '+stateClass(st)),note);
    if(proof){
      right.append(make('p','제출: '+proof.submittedBy+' / '+when(proof.submittedAt),'policy-help'));
      const image=make('img');image.src=proof.photo;image.alt=s.siteName+' 실제 '+docs[doc]+' 게시 사진';image.loading='lazy';image.className='policy-proof-photo';right.append(image);
      if(proof.reviewedAt)right.append(status('검토: '+proof.reviewedBy+' / '+when(proof.reviewedAt)));
      if(proof.reviewNote)right.append(status('재제출 사유: '+proof.reviewNote));
    }
    if(admin&&st==='pending'&&proof){
      const label=make('label',null,'policy-check-photo'),check=make('input');check.type='checkbox';
      label.append(check,' 출력 양식의 연도, 시행일, 현장 게시 상태를 사진으로 확인했습니다.');
      const approved=btn('확인완료',()=>decide('approved'),'policy-main-action');
      approved.disabled=true;check.onchange=()=>{approved.disabled=busy||!check.checked;};
      const reject=btn('재제출 요청',()=>decide('rejected'));
      right.append(label,approved,reject);
      async function decide(decision){
        if(busy||decision==='approved'&&!check.checked)return;
        let msg='';
        if(decision==='rejected'){
          const input=prompt('사진 재제출을 요청하는 사유를 입력해 주세요. (300자 이내)','');
          if(input===null)return;
          msg=input.trim();
          if(!msg||msg.length>300){alert('재제출 사유를 1~300자로 입력해 주세요.');return;}
        }else if(!confirm('실제 게시 사진과 '+docs[doc]+' 내용을 확인완료 처리할까요?'))return;
        busy=true;approved.disabled=reject.disabled=true;note.textContent='처리 중입니다.';
        try{
          await api({action:'platform_policy_decide',siteId:s.siteId,kind:doc,revision:set.revision,evidenceId:proof.id,decision,note:msg});
          await reload(true);
        }catch(err){note.textContent=['review_state_changed','settings_changed'].includes(err.message)?'다른 변경사항이 있습니다. 새로고침 후 확인해 주세요.':'확인 처리에 실패했습니다. 다시 시도해 주세요.';}
        finally{busy=false;approved.disabled=!check.checked;reject.disabled=false;}
      }
    }
    upload.onchange=async()=>{
      const file=upload.files?.[0];upload.value='';
      if(!file||busy||!field||!s.active||locked)return;
      if(!confirm('출력한 '+docs[doc]+'의 실제 현장 게시 사진을 안전관리자에게 제출할까요?'))return;
      busy=true;note.textContent='사진을 준비하고 제출하는 중입니다.';
      try{
        if(!window.enlPrepareDocumentPhoto)throw Error('photo_unavailable');
        const image=await window.enlPrepareDocumentPhoto(file);
        await api({action:'platform_policy_submit',siteId:s.siteId,kind:doc,revision:set.revision,photo:image.base64});
        await reload(true);
      }catch(err){note.textContent=['settings_changed','review_state_changed'].includes(err.message)?'상태가 변경됐습니다. 최신본을 새로고침해 주세요.':'사진을 제출하지 못했습니다. 사진 형식이나 네트워크를 확인해 주세요.';}
      finally{busy=false;}
    };
    const layout=make('div',null,'policy-document-layout');layout.append(left,right);
    main.replaceChildren(back,heading,layout);
  }
  async function open(){
    if(!panel){panel=make('section',null,'hub-tool-panel policy-panel');panel.dataset.listWorkspace='policy';host.append(panel);}
    panel.hidden=false;panel.replaceChildren();
    const h=make('div',null,'policy-panel-head'),layout=make('div',null,'policy-workspace');
    nav=make('nav',null,'policy-rail');nav.setAttribute('aria-label','경영방침 및 목표 사업장 목록');
    main=make('div',null,'policy-main');
    layout.append(nav,main);panel.append(h,layout);await reload(false);
  }
  return {open,catalog,leave,canLeave,canSuspend,badges};
}
window.enlPolicyManagement=mount;
})();