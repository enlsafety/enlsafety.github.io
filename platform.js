/* Common entry points share the signed-in actor and the existing incident workflow. */
(()=>{
  'use strict';
  const names={incident:'사고보고',risk:'위험성평가',tbm:'TBM',organization:'안전보건조직',training:'안전보건교육',history:'통합 히스토리',approvals:'통합 결재함',notices:'알림센터',documents:'문서 및 증빙관리',dashboard:'통합 대시보드',system:'시스템 관리'};
  const icons={incident:'report',risk:'shield',tbm:'chat',organization:'users',training:'education',history:'history',approvals:'approve',notices:'bell',documents:'archive',dashboard:'stats',system:'settings'};
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
    if(document.querySelector('#view form:not(.activity-filters):not(.activity-history form)')&&!confirm('현재 입력 화면을 벗어나 통합 메인으로 이동할까요?'))return;
    if(history.state?.enlModuleEntry===sessionKey(u)){history.back();return;}
    go('platform',u);
  };
  window.addEventListener('popstate',ev=>{
    const u=currentUser?.();if(!u||ev.state?.enlHub!==sessionKey(u))return;
    if(document.querySelector('dialog[open],#modalRoot .modal,#view form:not(.activity-filters):not(.activity-history form)')&&
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
  window.enlNoticeCenter=async root=>{
    if(root.querySelector('.notice-center'))return;
    const host=document.createElement('section');host.className='panel notice-center';root.replaceChildren(host);
    host.innerHTML='<h2>알림센터</h2><p>업무별로 받을 알림을 선택하세요. 긴급 알림은 수신 설정과 관계없이 지정된 대상에게 발송됩니다.</p><div data-rows></div><p role="status"></p>';
    const status=host.querySelector('[role=status]'),list=host.querySelector('[data-rows]');
    async function load(){
      list.replaceChildren();status.textContent='설정을 불러오는 중입니다.';
      try{const r=await api({action:'platform_notices'});if(!host.isConnected)return;
        for(const item of r.rows){
          const row=document.createElement('div');row.className='notice-row';row.innerHTML='<strong>'+names[item.key]+'</strong>';
          for(const [key,label] of [['push','앱 푸시'],['email','이메일']]){
            const b=document.createElement('button');b.type='button';b.setAttribute('role','switch');b.setAttribute('aria-label',names[item.key]+' '+label);
            const paint=()=>{b.setAttribute('aria-checked',String(item[key]));b.textContent=label+' '+(item[key]?'ON':'OFF')};paint();
            b.onclick=async()=>{const enabled=!item[key];row.inert=true;
              try{await api({action:'platform_notice_set',key:item.key,channel:key,enabled});item[key]=enabled;paint();status.textContent=names[item.key]+' '+label+' 설정을 저장했습니다.'}
              catch{status.textContent='저장 결과를 확인하지 못했습니다. 다시 조회해 주세요.'}
              finally{row.inert=false}
            };row.append(b);
          }list.append(row);
        }status.textContent='';
      }catch{status.textContent='설정을 불러오지 못했습니다.';const b=document.createElement('button');b.textContent='다시 조회';b.onclick=load;list.append(b);}
    }
    await load();
  };
  window.enlPlatformOpenEditor=u=>go('platform',u);
  window.enlOpenSystemAdmin=u=>{
    if(u?.role!=='safety')return;
    go('system-admin',u);
    return document.querySelector('#view > .system-admin')?.ready;
  };
  window.enlPlatformHome=async(root,u)=>{
    if(root.querySelector('.platform-hub'))return;
    const host=document.createElement('section');host.className='platform-hub';root.replaceChildren(host);
    host.innerHTML='<div class="platform-heading"><div class="ey">E&L SAFETY</div><h2>업무기능 선택</h2><p>사용할 업무를 선택해 주세요.</p></div><div class="platform-modules feature-list"></div><section class="platform-services feature-list"><h2>공통 업무지원 서비스</h2><div class="platform-grid"></div></section><p role="status"></p>';
    host.querySelector('.platform-heading p').textContent=[u.name,roles[u.role]||'본사실무자',u.siteId?(siteById(u.siteId)?.name||u.siteId):(u.department||'본사')].filter(Boolean).join(' / ');
    const area=host.querySelector('.platform-modules'),services=host.querySelector('.platform-grid'),status=host.querySelector('[role=status]');
    const admin=u.role==='safety';
    if(admin){
      const hint=document.createElement('small');
      hint.textContent='☰를 짧게 누르면 접근 설정, 위아래로 끌면 순서가 바뀝니다.';
      host.querySelector('.platform-heading').append(hint);
    }
    let config,saving=false;
    const groupFor=key=>config.services.some(s=>s.key===key)?'services':'modules';
    const itemsFor=key=>config[groupFor(key)];
    const isOn=m=>m.enabled!==false&&m.state!=='hidden'&&(m.state==='live'||m.preview);
    async function save(modules){
      if(saving)return false;
      const group=groupFor(modules[0].key);
      const before=config.modules.find(m=>m.key==='incident'),after=modules.find(m=>m.key==='incident');
      const disable=!!after&&isOn(before)&&!isOn(after),hide=!!after&&before.state!=='hidden'&&after.state==='hidden';
      if((disable||hide)&&!confirm('모든 사용자의 통합 메인에서 사고보고 진입을 끌까요?'))return false;
      saving=true;area.inert=services.inert=true;
      try{const r=await api({action:'platform_save',group,revision:config.revision,modules,confirmDisableIncident:disable,confirmHideIncident:hide});
        config={...config,revision:r.revision??config.revision+1,[group]:modules};cards();status.textContent='설정을 저장했습니다.';return true;
      }catch(err){
        status.textContent=err.message==='catalog_changed'?'다른 관리자가 먼저 변경했습니다. 최신 설정을 다시 확인해 주세요.':'저장하지 못했습니다. 연결 상태와 사용자 설정을 확인하세요.';
        if(err.message==='catalog_changed')await load();return false;
      }finally{saving=false;area.inert=services.inert=false;}
    }
    function move(key,destination){
      const modules=[...itemsFor(key)],i=modules.findIndex(m=>m.key===key),j=modules.findIndex(m=>m.key===destination);
      if(i<0||j<0||i===j)return;modules.splice(j,0,modules.splice(i,1)[0]);return save(modules);
    }
    function settings(m,grip){
      const draft=structuredClone(m),dialog=document.createElement('dialog');dialog.className='feature-settings';
      dialog.innerHTML='<form><h3>'+names[m.key]+' 접근 설정</h3><label>공개 상태<select name="state">'+Object.entries(states).filter(([k])=>k!=='building'||m.key!=='incident').map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><fieldset><legend>접근할 수 있는 역할</legend>'+Object.entries(roles).filter(([k])=>k!=='safety'&&m.key!=='system'&&!(m.key==='history'&&k==='worker')).map(([k,v])=>'<label><input type="checkbox" data-role="'+k+'"> '+v+'</label>').join('')+'</fieldset><section data-trial><strong>시험 사용자</strong><p>구현 중에는 허용 역할에 해당하고 아래에 지정된 사용자만 진입합니다.</p><div data-selected></div><label>이름 또는 사업장<input name="search" autocomplete="off"></label><button type="button" data-search>사용자 찾기</button><div data-results></div></section><div class="feature-actions"><button type="button" data-up>앞으로</button><button type="button" data-down>뒤로</button><button type="button" data-close>닫기</button><button type="submit">저장</button></div><small role="status"></small></form>';
      host.append(dialog);const form=dialog.querySelector('form'),note=form.querySelector('[role=status]'),index=itemsFor(m.key).indexOf(m);
      form.elements.state.value=m.state;
      if(m.key==='system')form.querySelector('fieldset').append('안전관리자 전용');
      function showTrial(){form.querySelector('[data-trial]').hidden=form.elements.state.value!=='building'||m.key==='system'}
      form.elements.state.onchange=showTrial;showTrial();
      for(const box of form.querySelectorAll('[data-role]'))box.checked=m.roles.includes(box.dataset.role);
      const labels=new Map();
      function selected(){const box=form.querySelector('[data-selected]');box.replaceChildren();for(const id of draft.pilots){
        const b=document.createElement('button');b.type='button';b.textContent=(labels.get(id)||id)+' ×';b.onclick=()=>{draft.pilots=draft.pilots.filter(p=>p!==id);selected()};box.append(b);}}
      selected();let lookup=0;
      form.querySelector('[data-search]').onclick=async()=>{
        const seq=++lookup,q=form.elements.search.value.trim(),box=form.querySelector('[data-results]');box.replaceChildren();if(!q){note.textContent='이름 또는 사업장을 입력해 주세요.';return;}
        try{const r=await api({action:'platform_directory',query:q});if(seq!==lookup||!dialog.isConnected)return;
          for(const x of r.rows.filter(x=>x.active)){const id=x.source+':'+x.id,b=document.createElement('button');b.type='button';labels.set(id,x.name+' / '+x.site_name);b.textContent=labels.get(id);b.onclick=()=>{if(!draft.pilots.includes(id))draft.pilots.push(id);selected()};box.append(b);}
          selected();note.textContent=box.children.length?(r.more?'검색어를 더 구체적으로 입력하면 범위를 좁힐 수 있습니다.':''):'검색 결과가 없습니다.';
        }catch{note.textContent='사용자를 불러오지 못했습니다.'}
      };
      form.elements.search.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();form.querySelector('[data-search]').click()}};
      const close=()=>dialog.close();form.querySelector('[data-close]').onclick=close;
      for(const [sel,offset] of [['[data-up]',-1],['[data-down]',1]]){
        const b=form.querySelector(sel),target=itemsFor(m.key)[index+offset];b.disabled=!target;b.onclick=async()=>{if(await move(m.key,target.key))close()};
      }
      form.onsubmit=async ev=>{ev.preventDefault();draft.state=form.elements.state.value;draft.roles=['safety',...Array.from(form.querySelectorAll('[data-role]:checked'),x=>x.dataset.role)];
        if(draft.state==='building'&&m.state!=='building')draft.preview=draft.enabled!==false;
        if(await save(itemsFor(m.key).map(x=>x.key===m.key?draft:x)))close();else note.textContent=status.textContent;};
      dialog.onclose=()=>{dialog.remove();host.querySelector('[data-key="'+m.key+'"] .feature-grip')?.focus()};
      dialog.onclick=ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)close()}};
      dialog.showModal();const r=grip.getBoundingClientRect();
      dialog.style.left=Math.max(8,Math.min(r.right-dialog.offsetWidth,innerWidth-dialog.offsetWidth-8))+'px';dialog.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-dialog.offsetHeight-8))+'px';
    }
    function bindGrip(grip,row,module,grid){
      let gesture=null,suppressClick=false;
      grip.title='눌러서 접근 설정, 위아래로 끌어서 순서 변경';
      grip.onclick=ev=>{if(ev.detail===0||!suppressClick)settings(module,grip);suppressClick=false};
      grip.oncontextmenu=ev=>ev.preventDefault();
      function preview(){
        const g=gesture,box=grid.getBoundingClientRect(),y=g.y-box.top;
        const last=g.slots.length-1;
        // Keep the grabbed point under the pointer. Test against the unshifted slots, including gaps.
        const top=Math.max(g.slots[0].top,Math.min(g.slots[last].top,y-g.offset));
        const center=top+g.slots[g.from].height/2;
        g.to=g.slots.reduce((best,slot,i)=>Math.abs(slot.center-center)<Math.abs(g.slots[best].center-center)?i:best,g.from);
        g.slots.forEach((slot,i)=>{
          let shift=0;
          if(i===g.from)shift=top-slot.top;
          else if(i>g.from&&i<=g.to)shift=g.slots[i-1].top-slot.top;
          else if(i<g.from&&i>=g.to)shift=g.slots[i+1].top-slot.top;
          slot.row.style.transform=shift?'translateY('+shift+'px)':'';
        });
      }
      function frame(){
        const g=gesture;
        if(!g?.active)return;
        if(!grid.isConnected){finish(false);return}
        const box=grid.getBoundingClientRect();
        if(g.y<56&&box.top<0)window.scrollBy(0,-10);
        if(g.y>innerHeight-56&&box.bottom>innerHeight)window.scrollBy(0,10);
        preview();g.frame=requestAnimationFrame(frame);
      }
      function finish(commit){
        const g=gesture;if(!g)return;
        gesture=null;window.removeEventListener('blur',cancel);
        if(grip.hasPointerCapture(g.id))grip.releasePointerCapture(g.id);
        if(!g.active)return;
        cancelAnimationFrame(g.frame);row.classList.remove('moving');
        for(const slot of g.slots)slot.row.style.transform='';
        if(commit&&g.from!==g.to)move(module.key,g.slots[g.to].row.dataset.key);
      }
      const cancel=()=>finish(false);
      grip.onpointerdown=ev=>{
        if(!ev.isPrimary||ev.button!==0||gesture||saving)return;
        suppressClick=false;
        const rect=row.getBoundingClientRect();
        gesture={id:ev.pointerId,y:ev.clientY,startY:ev.clientY,offset:ev.clientY-rect.top,active:false};
        grip.setPointerCapture(ev.pointerId);window.addEventListener('blur',cancel);
      };
      grip.onpointermove=ev=>{
        const g=gesture;if(!g||ev.pointerId!==g.id)return;g.y=ev.clientY;
        if(!g.active){
          if(Math.abs(g.y-g.startY)<6)return;
          const base=grid.getBoundingClientRect().top;
          g.slots=Array.from(grid.querySelectorAll('.feature-card-wrap'),el=>{
            const r=el.getBoundingClientRect(),top=r.top-base;
            return {row:el,top,height:r.height,center:top+r.height/2};
          });
          g.from=g.slots.findIndex(slot=>slot.row===row);
          g.active=suppressClick=true;row.classList.add('moving');frame();
        }else preview();
      };
      grip.onpointerup=ev=>{
        const g=gesture;if(!g||ev.pointerId!==g.id)return;
        const box=grid.getBoundingClientRect();
        if(g.active){g.y=ev.clientY;preview()}
        finish(ev.clientX>=box.left&&ev.clientX<=box.right&&ev.clientY>=box.top-16&&ev.clientY<=box.bottom+16);
      };
      grip.onpointercancel=grip.onlostpointercapture=ev=>{if(gesture?.id===ev.pointerId)cancel()};
    }
    function cards(){
      const grid=document.createElement('div');grid.className='platform-grid';area.replaceChildren(grid);services.replaceChildren();
      draw(grid,config.modules,false);draw(services,config.services,true);
      const future=document.createElement('div');future.className='feature-future';future.innerHTML='<span aria-hidden="true">＋</span>추가 예정';grid.append(future);
      window.enlRefreshHistoryCount?.(true);
    }
    function draw(grid,items,support){
      for(const m of items.filter(m=>(admin||m.state!=='hidden')&&(m.key!=='history'||window.enlHistoryAvailable?.(u))&&(m.key!=='system'||admin))){
        const row=document.createElement('article');row.className='feature-card-wrap';row.dataset.key=m.key;row.dataset.state=m.state;row.dataset.on=String(isOn(m));
        row.innerHTML='<button class="platform-card" type="button" style="--pic:var(--icon-'+icons[m.key]+')"><span class="platform-icon"></span><strong>'+names[m.key]+'</strong><small>'+states[m.state]+(!isOn(m)&&m.state==='live'?' / 접근 꺼짐':'')+'</small></button>';
        const button=row.firstElementChild;
        button.dataset[support?'service':'module']=m.key;button.setAttribute('aria-label',names[m.key]);
        if(m.key==='history'&&isOn(m)&&m.canEnter!==false)button.dataset.platformHistoryFeed='';
        grid.append(row);button.onclick=async()=>{
          if(!isOn(m)||m.canEnter===false){status.textContent='현재 진입할 수 없는 '+(support?'서비스':'모듈')+'입니다.';return;}
          if(m.key==='system'){window.enlOpenSystemAdmin(u);return;}
          try{const r=await api({action:'platform_enter',key:m.key});if(!host.isConnected)return;
            if(r.key==='incident')go(['worker','field'].includes(u.role)?'home':'stats',u);
            else if(r.key==='history'){window.enlRequestHistory();go('common-history',u)}
            else if(r.key==='notices')go('notice-center',u);
            else{const box=support?services:area;box.innerHTML='<section class="panel"><h2>'+names[r.key]+'</h2><p>세부 업무 화면은 준비 중입니다.</p><button>← '+(support?'공통 업무지원 서비스':'업무기능 선택')+'</button></section>';box.querySelector('button').onclick=cards;}
          }catch{status.textContent='현재 진입할 수 없는 '+(support?'서비스':'모듈')+'입니다.'}
        };
        if(!admin)continue;
        const tools=document.createElement('div');tools.className='feature-controls';
        tools.innerHTML='<button type="button" role="switch" aria-label="'+names[m.key]+' 진입" aria-checked="'+isOn(m)+'">'+(isOn(m)?'ON':'OFF')+'</button><button type="button" class="feature-grip" aria-haspopup="dialog" aria-label="'+names[m.key]+' 접근 설정 및 순서 이동">☰</button>';row.append(tools);
        tools.firstElementChild.onclick=()=>{
          const enabled=!isOn(m),updated={...m,enabled};
          if(enabled&&updated.state==='hidden')updated.state=['incident','history','notices','system'].includes(m.key)?'live':'building';
          if(updated.state==='building')updated.preview=enabled;
          save(itemsFor(m.key).map(x=>x===m?updated:x));
        };
        bindGrip(tools.lastElementChild,row,m,grid);
      }

    }
    async function load(){config=await api({action:'platform_catalog'});if(host.isConnected)cards()}
    try{await load()}catch{area.innerHTML='<p>업무기능을 불러오지 못했습니다.</p><button>다시 시도</button>';area.querySelector('button').onclick=()=>{host.remove();window.enlPlatformHome(root,u)};}
  };
})();
