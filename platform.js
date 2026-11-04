/* Common entry points share the signed-in actor and the existing incident workflow. */
(()=>{
  'use strict';
  const names={incident:'사고보고',risk:'위험성평가',tbm:'TBM',organization:'안전보건조직',training:'안전보건교육'};
  const icons={incident:'report',risk:'shield',tbm:'chat',organization:'users',training:'list'};
  const states={live:'운영 중',building:'구현 중',hidden:'숨김'};
  const roles={field:'현장관리자',manager:'본사실무자',executive:'경영진',worker:'일반근로자',safety:'안전관리자'};
  const duties={supervisor:'관리감독자',safety:'안전관리자',responsible:'안전보건관리책임자',health:'보건관리자'};
  const api=body=>window.enlIncidentApi({...body,actor:window.enlCurrentActor()});
  const e=v=>esc(String(v??''));
  const sessionKey=u=>JSON.stringify([u.id||u.personnelId,u.role,u.siteId||'']);
  function go(view,u){
    if(currentView==='platform'&&view!=='platform'){
      history.replaceState({...history.state,enlHub:sessionKey(u)},'');
      history.pushState({enlModuleEntry:sessionKey(u)},'');
    }
    currentView=view;window.renderShell(u);
  }
  window.enlReturnToPlatform=u=>{
    if(document.querySelector('#view form:not(.activity-filters)')&&!confirm('현재 입력 화면을 벗어나 통합 메인으로 이동할까요?'))return;
    if(history.state?.enlModuleEntry===sessionKey(u)){history.back();return;}
    go('platform',u);
  };
  window.addEventListener('popstate',ev=>{
    const u=currentUser?.();if(!u||ev.state?.enlHub!==sessionKey(u))return;
    if(document.querySelector('dialog[open],#modalRoot .modal,#view form:not(.activity-filters)')&&
      !confirm('현재 화면을 벗어나 통합 메인으로 이동할까요?')){history.pushState({enlModuleEntry:sessionKey(u)},'');return;}
    if(document.querySelector('#modalRoot .modal'))window.closeModal?.();
    go('platform',u);
  });
  window.enlDutyEditor=(parent,source,id)=>{
    if(!parent||currentUser()?.role!=='safety')return;
    const group=document.createElement('fieldset');group.className='platform-duties';
    group.innerHTML='<legend>법정 안전보건 직무 (복수 선택)</legend>'+Object.entries(duties).map(([k,v])=>'<label><input type="checkbox" value="'+k+'">'+v+'</label>').join('')+'<small>업무 분류용입니다. 법적 선임과 자격 요건은 별도로 확인합니다.</small>';
    const submit=parent.querySelector('[type=submit],#sa415AddWorkers');if(submit)submit.before(group);else parent.append(group);
    if(id){const key=document.createElement('small');key.textContent='공통 사용자 ID '+source+':'+id;group.append(key);}
    let changed=false;group.onchange=()=>{changed=true};
    if(id){
      group.disabled=true;api({action:'platform_duties',source,accountId:String(id)}).then(r=>{
        for(const b of group.querySelectorAll('input'))b.checked=r.duties.includes(b.value);
        group.disabled=false;
      }).catch(()=>{group.querySelector('small').textContent='직무를 불러오지 못했습니다. 기존 지정은 유지됩니다.'});
    }
    return ()=>changed?{duties:[...group.querySelectorAll('input:checked')].map(i=>i.value)}:{};
  };
  window.enlPlatformDirectory=async(root)=>{
    const host=document.createElement('section');host.className='panel';root.append(host);
    host.innerHTML='<h2>공통 사용자 및 직무 담당자</h2><form class="activity-filters"><label>이름, 사업장, 직책 또는 ID<input name="query" maxlength="100"></label><label>법정 직무<select name="duty"><option value="">전체</option>'+Object.entries(duties).map(([k,n])=>'<option value="'+k+'">'+n+'</option>').join('')+'</select></label><button>조회</button></form><div class="platform-accounts"></div><button data-more hidden>더 보기</button>';
    const form=host.querySelector('form'),list=host.querySelector('.platform-accounts'),more=host.querySelector('[data-more]');
    let seq=0,offset=0,query='',duty='';
    async function load(first){
      const token=++seq;more.disabled=true;
      if(first){offset=0;query=form.elements.query.value;duty=form.elements.duty.value;list.replaceChildren();}
      try{const r=await api({action:'platform_directory',query,duty,offset});if(token!==seq||!host.isConnected)return;
        for(const x of r.rows){const article=document.createElement('article');article.innerHTML='<strong>'+e(x.name)+' / '+e(x.site_name)+'</strong><span>'+e([x.department,x.position,roles[x.role]||x.role,x.active?'사용 중':'비활성'].filter(Boolean).join(' / '))+'</span><small>'+e(x.source+':'+x.id)+' / '+e(x.codes.map(k=>duties[k]).join(', ')||'직무 미지정')+'</small>';list.append(article);}
        offset+=r.rows.length;more.hidden=!r.more;if(!offset)list.textContent='조회 결과가 없습니다.';
      }catch{if(token===seq)list.textContent='사용자 목록을 불러오지 못했습니다.'}finally{if(token===seq)more.disabled=false;}
    }
    form.onsubmit=ev=>{ev.preventDefault();load(true)};more.onclick=()=>load(false);await load(true);
  };
  let openEditor=false;
  window.enlPlatformOpenEditor=u=>{openEditor=true;go('platform',u)};
  window.enlPlatformHome=async(root,u)=>{
    if(root.querySelector('.platform-hub'))return;
    const host=document.createElement('section');host.className='platform-hub';root.replaceChildren(host);
    host.innerHTML='<div class="platform-heading"><div class="ey">E&L SAFETY</div><h2>업무모듈 선택</h2><p>사용할 업무를 선택해 주세요.</p></div><div class="platform-modules"></div><section class="platform-services"><h2>공통 업무지원 서비스</h2><div class="platform-grid"></div></section><p role="status"></p>';
    host.querySelector('.platform-heading p').textContent=[u.name,roles[u.role]||'본사실무자',u.siteId?(siteById(u.siteId)?.name||u.siteId):(u.department||'본사')].filter(Boolean).join(' / ');
    const area=host.querySelector('.platform-modules'),services=host.querySelector('.platform-grid'),status=host.querySelector('[role=status]');
    const admin=u.role==='safety';
    const service=(name,enabled,open)=>{
      const b=document.createElement('button');b.type='button';b.disabled=!enabled;b.textContent=name+(enabled?'':' (구현 중)');b.onclick=open;services.append(b);return b;
    };
    if(window.enlHistoryAvailable?.(u)){
      const historyButton=service('통합 히스토리',true,()=>{window.enlRequestHistory();go('history',u)});historyButton.dataset.platformHistoryFeed='';window.enlRefreshHistoryCount?.();
    }
    for(const name of ['통합 결재함','알림센터','문서 및 증빙관리','통합 대시보드'])service(name,false);
    if(admin)service('시스템 관리',true,()=>go('more',u));
    let config;
    function cards(){
      area.innerHTML=(admin?'<button type="button" class="secondary platform-edit">모듈 편집</button>':'')+'<div class="platform-grid">'+config.modules.filter(m=>m.state!=='hidden').map(m=>
        '<button class="platform-card" type="button" data-module="'+e(m.key)+'" style="--pic:var(--icon-'+icons[m.key]+')"><span class="platform-icon"></span><strong>'+names[m.key]+'</strong><small>'+states[m.state]+'</small></button>').join('')+'</div>';
      area.querySelector('.platform-edit')?.addEventListener('click',edit);
      for(const b of area.querySelectorAll('[data-module]'))b.onclick=async()=>{
        b.disabled=true;status.textContent='';
        try{const r=await api({action:'platform_enter',key:b.dataset.module});if(!host.isConnected)return;
          if(r.key==='incident')go(['worker','field'].includes(u.role)?'home':'stats',u);
          else {area.innerHTML='<section class="panel"><h2>'+names[r.key]+'</h2><p>'+states[r.state]+'입니다. 세부 업무 화면은 준비 중입니다.</p><button type="button">← 업무모듈 선택</button></section>';area.querySelector('button').onclick=cards;}
        }catch{status.textContent='현재 진입할 수 없는 모듈입니다.';}finally{b.disabled=false;}
      };
    }
    function edit(){
      const draft=structuredClone(config.modules);
      function move(a,b){if(a===b||b<0||b>=draft.length)return;draft.splice(b,0,draft.splice(a,1)[0]);draw();}
      function draw(){
        area.innerHTML='<h3>모듈 순서 및 공개 설정</h3><p>위아래 버튼이나 이동 손잡이로 순서를 바꿀 수 있습니다.</p><div class="platform-order"></div><div class="platform-tools"><button data-save>전체 설정 저장</button><button data-cancel>취소</button></div>';
        const list=area.querySelector('.platform-order');let drag=-1;
        draft.forEach((m,i)=>{
          const row=document.createElement('section');row.dataset.index=i;const locked=m.key==='incident';
          row.innerHTML='<div class="platform-order-head"><span draggable="true" class="platform-grip" aria-label="끌어서 이동">☰</span><strong>'+names[m.key]+'</strong><button data-up aria-label="위로 이동">↑</button><button data-down aria-label="아래로 이동">↓</button></div>'+
            (locked?'<label>메인 카드 <select data-incident-state><option value="live">운영 중</option><option value="hidden">숨김</option></select></label><small>기존 사고보고서와 결재 연결은 계속 사용할 수 있습니다.</small>':'<label>공개 상태 <select>'+Object.entries(states).map(([k,n])=>'<option value="'+k+'" '+(m.state===k?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label><input type="checkbox" data-preview '+(m.preview?'checked':'')+'> 구현 중 시험 진입 허용</label><fieldset><legend>접근 가능한 역할</legend>'+Object.entries(roles).filter(([k])=>k!=='safety').map(([k,v])=>'<label><input type="checkbox" data-role="'+k+'" '+(m.roles.includes(k)?'checked':'')+'> '+v+'</label>').join('')+'</fieldset><label>시험 사용자 ID (쉼표로 구분)<input data-pilots value="'+e(m.pilots.join(', '))+'" placeholder="hq:본사ID 또는 site:현장ID"></label>');
          list.append(row);row.querySelector('[data-up]').disabled=i===0;row.querySelector('[data-down]').disabled=i===draft.length-1;
          row.querySelector('[data-up]').onclick=()=>move(i,i-1);row.querySelector('[data-down]').onclick=()=>move(i,i+1);
          const grip=row.querySelector('.platform-grip');grip.ondragstart=ev=>{drag=i;ev.dataTransfer.setData('text/plain',String(i))};row.ondragover=ev=>ev.preventDefault();row.ondrop=ev=>{ev.preventDefault();if(drag>=0)move(drag,i)};
          grip.ontouchend=ev=>{const t=ev.changedTouches[0],dest=document.elementFromPoint(t.clientX,t.clientY)?.closest('[data-index]');if(list.contains(dest))move(i,Number(dest.dataset.index))};
          if(locked){const select=row.querySelector('select');select.value=m.state;select.onchange=()=>m.state=select.value;return;}
          row.querySelector('select').onchange=ev=>m.state=ev.target.value;
          row.querySelector('[data-preview]').onchange=ev=>m.preview=ev.target.checked;
          row.querySelectorAll('[data-role]').forEach(box=>box.onchange=()=>m.roles=['safety',...Array.from(row.querySelectorAll('[data-role]:checked'),x=>x.dataset.role)]);
          row.querySelector('[data-pilots]').oninput=ev=>m.pilots=ev.target.value.split(',').map(x=>x.trim()).filter(Boolean);
        });
        area.querySelector('[data-cancel]').onclick=cards;
        area.querySelector('[data-save]').onclick=async ev=>{
          const button=ev.target;button.disabled=true;
          const hiding=draft.find(m=>m.key==='incident').state==='hidden'&&config.modules.find(m=>m.key==='incident').state!=='hidden';
          if(hiding&&!confirm('모든 사용자의 통합 메인에서 사고보고 카드를 숨길까요? 기존 사고 문서와 결재 링크는 유지됩니다.')){button.disabled=false;return;}
          try{await api({action:'platform_save',revision:config.revision,modules:draft,confirmHideIncident:hiding});await load();status.textContent='모듈 설정을 저장했습니다.'}
          catch(err){status.textContent=err.message==='catalog_changed'?'다른 관리자가 변경했습니다. 통합 메인을 다시 열어 최신 설정을 확인하세요.':'저장하지 못했습니다. 시험 사용자 ID와 연결 상태를 확인하세요.'}finally{button.disabled=false}
        };
      }draw();
    }
    async function load(){config=await api({action:'platform_catalog'});if(host.isConnected){if(admin&&openEditor){openEditor=false;edit()}else cards()}}
    try{await load()}catch{area.innerHTML='<p>모듈 설정을 불러오지 못했습니다.</p><button>다시 시도</button> <button>사고보고 열기</button>';area.firstElementChild.nextElementSibling.onclick=()=>{host.remove();window.enlPlatformHome(root,u)};area.lastElementChild.onclick=()=>go(['field','worker'].includes(u.role)?'home':'stats',u);}
  };
})();
