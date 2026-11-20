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
  const logoBars=Array.from({length:9},(_,i)=>`<rect x="${621+i*16}" y="54" width="10" height="51" fill="#080808"/>`).join('');
  const stamp=`<g transform="translate(680 1037) rotate(-10)" fill="none" stroke="#e00000">
    <circle r="39" stroke-width="2.4"/><circle r="33" stroke-width="1.6"/>
    <path d="M-30 -13h60 M-30 12h60 M-10 -30v60 M12 -30v60" stroke-width="1.4"/>
    <text y="-17" font-family="Malgun Gothic,sans-serif" font-size="11" font-weight="900" stroke="none" fill="#e00000" text-anchor="middle">주식회사</text>
    <text y="8" font-family="Malgun Gothic,sans-serif" font-size="26" font-weight="900" stroke="none" fill="#e00000" text-anchor="middle">이앤엘</text>
    <text y="28" font-family="Malgun Gothic,sans-serif" font-size="12" font-weight="900" stroke="none" fill="#e00000" text-anchor="middle">대표인</text></g>`;
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
  function catalog(m){
    enabled=!!m&&m.enabled!==false&&m.state!=='hidden'&&m.canEnter!==false&&(m.state==='live'||m.preview);
    if(!enabled)needCount=0;badges();
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