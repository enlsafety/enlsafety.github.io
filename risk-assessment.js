(() => {
  'use strict';
  // Initial risk-assessment workspace. Assessment records are intentionally not created here.
  const roles=['field','safety','manager','executive'];
  const ns='http://www.w3.org/2000/svg';
  const sortKo=new Intl.Collator('ko-KR',{numeric:true,sensitivity:'base'});
  const $=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==undefined&&text!==null)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  const button=(text,run,cls)=>{
    const node=$('button',text,cls);node.type='button';node.onclick=run;return node;
  };
  function mount(host,user,api,sameUser){
    const admin=user.role==='safety';
    let panel,rail,railBody,main,managerForm,sites=[],candidates=[],selected=null,docOpen=false;
    let sequence=0,busy=false,enabled=false,listFlight;
    function readList(){if(!listFlight){const flight=api({action:'platform_risk_list',manageFolders:admin}).finally(()=>{if(listFlight===flight)listFlight=null;});listFlight=flight;}return listFlight;}
    const onScreen=()=>sameUser()&&host.dataset.workspace==='risk';
    const message=text=>{const node=$('p',text,'org-status');node.setAttribute('role','status');return node;};
    const canLeave=()=>!busy;
    function closeManager(){managerForm?.remove();managerForm=null;}
    function leave(){sequence++;closeManager();selected=null;docOpen=false;panel?.replaceChildren();}
    function catalog(item){
      enabled=roles.includes(user.role)&&!!item&&item.enabled!==false&&item.state!=='hidden'&&item.canEnter!==false&&(item.state==='live'||item.preview);
      if(!enabled&&panel)panel.hidden=true;
    }
    function selectedSite(){return sites.find(s=>s.site_id===selected);}
    function drawRail(){
      if(!railBody)return;
      const oldScroll=railBody.scrollTop;
      rail.querySelector('summary').textContent='사업장 폴더 ('+sites.length+')';
      rail.querySelector('.org-summary').textContent='위험성평가 사업장별 관리';
      panel.querySelectorAll('[data-needs-site]').forEach(b=>b.disabled=!selected);
      railBody.replaceChildren();
      for(const site of sites){
        const expanded=site.site_id===selected;
        const row=button('',()=>choose(site.site_id),'org-folder');
        row.dataset.siteId=site.site_id;row.setAttribute('aria-expanded',String(expanded));
        row.append($('span',site.folder_name||site.site_name));
        if(site.active===false)row.append($('small','종료','org-state'));
        railBody.append(row);
        if(expanded){
          const submenu=$('div',null,'org-submenu');submenu.setAttribute('role','group');submenu.setAttribute('aria-label',(site.folder_name||site.site_name)+' 위험성평가');
          const child=button('01. 위험성평가',()=>chooseDoc(site));
          if(docOpen)child.setAttribute('aria-current','page');
          submenu.append(child);railBody.append(submenu);
        }
      }
      railBody.scrollTop=oldScroll;
    }
    function drawSites(){
      if(!main)return;
      const heading=$('div',null,'org-page-title');
      heading.append($('h3','사업장 목록'),message('사업장을 선택하면 해당 사업장의 위험성평가 메뉴로 이동합니다.'));
      const grid=$('div',null,'org-site-grid');
      for(const site of sites){
        const row=button('',()=>choose(site.site_id),'org-site-card');
        row.append($('strong',site.folder_name||site.site_name),$('span',site.active===false?'종료 사업장':'위험성평가 메뉴','org-status'));
        row.setAttribute('aria-label',(site.folder_name||site.site_name)+' 위험성평가 메뉴 열기');
        grid.append(row);
      }
      main.replaceChildren(heading,grid);
      if(!sites.length)main.append(message('조회 가능한 사업장 폴더가 없습니다.'));
    }
    function drawDocuments(site){
      if(!main)return;
      const heading=$('div',null,'org-page-title');
      heading.append($('h3',site.folder_name||site.site_name),message('조회할 항목을 선택하세요.'));
      const grid=$('div',null,'org-document-grid');
      const card=button('',()=>chooseDoc(site),'org-document-card');
      card.append($('strong','01. 위험성평가'),$('span','세부 평가양식과 작성 절차는 준비 중입니다.','org-status'));
      grid.append(card);
      main.replaceChildren(button('← 사업장 목록',()=>choose(null),'org-back'),heading,grid);
    }
    function choose(siteId){
      if(!canLeave())return;
      ++sequence;closeManager();docOpen=false;
      selected=siteId===selected?null:siteId;
      drawRail();
      const site=selectedSite();
      if(site)drawDocuments(site);else drawSites();
    }
    function chooseDoc(site){
      if(!canLeave())return;
      ++sequence;closeManager();selected=site.site_id;docOpen=true;drawRail();
      if(innerWidth<=750)rail.open=false;
      const back=button('← '+(site.folder_name||site.site_name)+' 서류 목록',()=>{selected=null;choose(site.site_id);},'org-back');
      const heading=$('div',null,'org-page-title');
      heading.append($('h3',(site.folder_name||site.site_name)+' / 01. 위험성평가'));
      main.replaceChildren(back,heading,message('위험성평가의 세부 입력 화면은 아직 준비 중입니다. 이 화면에서는 평가서나 승인 기록을 생성하지 않습니다.'));
    }
    async function manage(action,mobile=false){
      if(!admin||busy||!rail)return;
      closeManager();
      const site=selectedSite();
      if(action!=='create'&&!site)return;
      const form=$('form',null,'org-manage');managerForm=form;
      const name=$('input'),select=$('select'),note=message('');
      const submit=$('button',action==='delete'?'폴더 삭제':'저장','org-primary');
      submit.type='submit';name.maxLength=72;name.required=action!=='delete';
      const labeled=(title,control)=>{const label=$('label',title);label.append(control);form.append(label);};
      if(action==='create'){
        labeled('연결할 사업장',select);
        for(const s of candidates)select.add(new Option(s.site_name,s.site_id));
        select.onchange=()=>{name.value=select.selectedOptions[0]?.text||'';};select.onchange();
      }
      if(action!=='delete'){
        labeled('폴더 이름',name);
        if(action==='rename')name.value=site.folder_name||site.site_name;
      }else form.append(message('「'+(site.folder_name||site.site_name)+'」 폴더를 목록에서 숨길까요? 위험성평가 폴더에만 적용되며 안전보건조직에는 영향을 주지 않습니다.'));
      if(action==='create'&&!candidates.length){submit.disabled=true;note.textContent='등록된 모든 사업장에 폴더가 있습니다.';}
      form.append(submit,button('취소',closeManager),note);
      (mobile?panel.querySelector('.org-mobile-management .org-manage-tools'):rail.querySelector('.org-manage-tools')).after(form);
      form.onsubmit=async ev=>{
        ev.preventDefault();
        if(busy||!canLeave())return;
        const item=action==='create'?candidates.find(s=>s.site_id===select.value):site;
        if(!item)return;
        busy=true;form.inert=true;
        try{
          await api({action:'platform_risk_folder_'+action,siteId:item.site_id,name:name.value,folderRevision:item.folder_revision});
          listFlight=null;busy=false;closeManager();
          if(onScreen())await open(action==='delete'?null:item.site_id);
        }catch(err){
          note.textContent=err.message==='folder_changed'?'다른 사용자가 폴더를 변경했습니다. 다시 불러와 주세요.':'폴더 변경에 실패했습니다. 다시 시도해 주세요.';
        }finally{busy=false;form.inert=false;}
      };
    }
    async function open(preferred){
      if(!panel){panel=$('section',null,'hub-tool-panel org-panel risk-panel');panel.dataset.listWorkspace='risk';host.append(panel);}
      panel.hidden=false;closeManager();selected=null;docOpen=false;
      const token=++sequence;
      const layout=$('div',null,'org-workspace');
      rail=$('details',null,'org-rail');rail.open=true;
      rail.append($('summary','사업장 폴더'),$('p','','org-summary'));
      railBody=$('nav',null,'org-rail-list');railBody.setAttribute('aria-label','위험성평가 사업장별 폴더');
      railBody.append(message('사업장 폴더를 불러오는 중입니다.'));
      rail.append(railBody);
      main=$('div',null,'org-main');main.append(message('사업장을 선택해 주세요.'));
      layout.append(rail,main);panel.replaceChildren($('h2','위험성평가'),layout);
      try{
        const result=await readList();
        if(!onScreen()||token!==sequence)return;
        sites=Array.isArray(result.sites)?result.sites.sort((a,b)=>sortKo.compare(a.folder_name||a.site_name,b.folder_name||b.site_name)):[];
        candidates=Array.isArray(result.candidates)?result.candidates:[];
        if(admin){
          const tools=$('div',null,'org-manage-tools');
          const mobile=$('details',null,'org-mobile-management'), mobileTools=$('div',null,'org-manage-tools');
          mobile.append($('summary','폴더 관리'),mobileTools);
          layout.before(mobile);
          tools.setAttribute('role','group');tools.setAttribute('aria-label','위험성평가 폴더 관리');
          for(const [key,title,path] of [
            ['create','생성','M3 8h10M8 3v10'],
            ['rename','수정','m3 10-.5 3.5 3.5-.5 7.5-7.5-3-3L3 10Zm6-6 3 3'],
            ['delete','삭제','M2.5 4.5h11M6 4.5v-2h4v2m-6 0 .7 9h6.6l.7-9M7 7v4m2-4v4']
          ]){
            const control=button(title,()=>manage(key));
            control.setAttribute('aria-label','폴더 '+title);control.dataset.folderAction=key;
            const svg=document.createElementNS(ns,'svg'),stroke=document.createElementNS(ns,'path');
            svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');
            stroke.setAttribute('d',path);svg.append(stroke);control.prepend(svg);
            if(key!=='create')control.dataset.needsSite='';
            const mobileButton=button(title,()=>manage(key,true));
            mobileButton.setAttribute('aria-label','폴더 '+title);mobileButton.dataset.mobileFolderAction=key;
            if(key!=='create')mobileButton.dataset.needsSite='';
            mobileTools.append(mobileButton);
            tools.append(control);
          }
          railBody.before(tools);
        }
        selected=sites.find(s=>s.site_id===preferred)?.site_id||null;
        drawRail();if(selected)drawDocuments(selectedSite());else drawSites();
      }catch(err){
        if(onScreen()&&token===sequence)main.replaceChildren(message('사업장 폴더를 불러오지 못했습니다. 연결을 확인해 주세요.'),button('다시 불러오기',()=>open(preferred)));
      }
    }
    const focus=()=>{
      if(!sameUser()){window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);return;}
      if(onScreen()&&!busy&&!document.hidden&&!managerForm&&!docOpen)open(selected).catch(()=>{});
    };
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    return {catalog,canLeave,leave,open};
  }
  window.enlRiskAssessment=mount;
})();
