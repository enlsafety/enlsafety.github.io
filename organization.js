(() => {
  'use strict';
  const roles = ['worker','field','safety','manager','executive'];
  const ns = 'http://www.w3.org/2000/svg';
  const defaults = () => ({lead:'',supervisor:'',teams:['코스관리','스프링쿨러','서무','기타'].map(name => ({name,regular:0,daily:0}))});
  const documents={chart:'01. 조직도',appointment:'02. 임명장',evaluation:'03. 업무수행평가표'};
  const selectPrompt='사업장 목록이나 좌측 폴더에서 조회할 내용을 선택하세요.';
  const stages={empty:'미작성',draft:'출력물 제출 전',pending:'안전관리자 확인 대기',approved:'반기 확인완료'};
  const periodName = p => p.slice(0,4)+'년 '+(p.endsWith('1')?'상반기':'하반기');
  const when = d => new Date(d).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function button(label, run, cls) {
    const b = el('button',label,cls); b.type='button'; b.onclick=run; return b;
  }
  function paper(chart, site, edit, template, unsaved=false) {
    const box=el('div',null,'org-paper'), img=new Image();
    img.src=template; img.alt='이앤엘 본사 및 사업장 안전보건 조직도 양식';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 595.5 841.63');svg.setAttribute('aria-label',site+' 조직도 입력 내용');
    box.append(img,svg);
    const measure=document.createElement('canvas').getContext('2d');
    function line(x,y,label,size,bold,width,key) {
      const t=document.createElementNS(ns,'text');
      const font='"NanumSquare","Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
      measure.font=(bold?'bold ':'')+size+'px '+font;
      const actual=Math.min(size,size*width/Math.max(1,measure.measureText(label).width));
      for(const [k,v] of Object.entries({x,y,'text-anchor':'middle','font-size':actual,'font-weight':bold?700:400,'font-family':font,fill:'#1F2724'})) t.setAttribute(k,v);
      t.textContent=label;
      if(edit && key)return;
      svg.append(t);
    }
    line(297.36,440,site.endsWith('사업장')?site:site+' 사업장',11.8,true,390);
    for(const [y,title,key] of [[497,'현장 책임자','lead'],[570,'관리감독자','supervisor']]){
      line(297.36,y,title,key==='lead'?11.5:12,true,244);
      line(297.36,y+16,chart[key]||'직책과 성명',12,false,251,key);
    }
    chart.teams.forEach((team,i)=>{
      const x=i%2?429.52:165.35, y=i<2?674:729.12;
      line(x,y,team.name||'업무명',14,true,210,'team'+i);
      line(x,y+18,'상용 '+(unsaved?'—':team.regular??'')+'명　　　 일용 '+(unsaved?'—':team.daily??'')+'명',14,false,215,'regular'+i);
    });
    if(edit){
      const field=(key,caption,x,y,width,height,value,limit,change,num=false)=>{
        const input=el('input',null,'org-inline');input.setAttribute('aria-label',caption);
        input.name=key;input.value=value;input.required=true;input.autocomplete='off';
        if(num){input.type='number';input.min=0;input.max=9999;input.step=1;input.inputMode='numeric';}
        else{input.maxLength=limit;input.placeholder=caption.includes('직책')?'직책과 성명':'업무명';}
        Object.assign(input.style,{left:(x-width/2)/595.5*100+'%',top:y/841.63*100+'%',width:width/595.5*100+'%',height:height/841.63*100+'%'});
        input.oninput=()=>{change(num?(input.value===''?null:input.valueAsNumber):input.value);edit()};
        box.append(input);
      };
      field('lead','현장 책임자 직책과 성명',297.36,499,220,21,chart.lead,32,v=>chart.lead=v);
      field('supervisor','관리감독자 직책과 성명',297.36,573,220,21,chart.supervisor,32,v=>chart.supervisor=v);
      chart.teams.forEach((team,i)=>{
        const x=i%2?429.52:165.35,y=i<2?658:713.12;
        field('team'+i,(i+1)+'번째 업무명',x,y,146,19,team.name,18,v=>team.name=v);
        for(const [key,label,center] of [['regular','상용',x-51],['daily','일용',x+55]]){
          line(center-20,y+34,label,11,false,29);
          field(key+i,(i+1)+'번째 업무 '+label+' 인원',center+13,y+20,39,20,team[key],0,v=>team[key]=v,true);
          line(center+41,y+34,'명',11,false,15);
        }
      });
    }
    return box;
  }
  function printChart(box,title) {
    const page=el('div'); page.id='org-print-page'; page.append(box.cloneNode(true));
    const rules=el('style','@page { size:A4 portrait; margin:0 }');
    const old=document.title;
    const cleanup=()=>{page.remove();rules.remove();document.title=old;window.removeEventListener('afterprint',cleanup);};
    document.getElementById('org-print-page')?.remove();
    document.body.append(page);document.head.append(rules);document.title=title;
    window.addEventListener('afterprint',cleanup,{once:true});
    // Preserve the print DOM until the system dialog closes (including Safari).
    try{window.print()}catch(err){cleanup();throw err}
  }
  function controller(host,u,api,sameUser) {
    let panel, sequence=0, listRequest=0, allowed=false, busy=false, dirty=false, pending=0, shownRevision, refreshTimer, shownPeriod, shownSite, shownDoc, template;
    let main,rail,railBody,folders=[],available=[],listingPeriod,managerForm;
    const admin=u.role==='safety';
    const onScreen=()=>sameUser()&&host.dataset.workspace==='organization';
    function workState(site,state=site.state){
      if(site.active===false)return '';
      if(state==='approved')return 'approved';
      if(admin||u.role==='field'&&['empty','draft'].includes(state))return 'pending';
      return '';
    }
    function badges(){
      for(const node of host.querySelectorAll('[data-module="organization"],[data-hub="feature:organization"]')){
        let dot=node.querySelector('.org-dot');
        if(!allowed||!pending){dot?.remove();continue}
        if(!dot){dot=el('span',null,'org-dot');node.append(dot)}
        dot.setAttribute('role','img');
        dot.setAttribute('aria-label','이번 반기 조직도 확인 미완료 '+pending+'개 사업장');dot.title=dot.getAttribute('aria-label');
      }
    }
    const listFlights=new Map();
    async function readList(manageFolders=false){
      const token=++listRequest;
      const key=manageFolders===true;
      let flight=listFlights.get(key)||(!key&&listFlights.get(true));
      if(!flight){flight=api({action:'platform_org_list',manageFolders:key}).finally(()=>{if(listFlights.get(key)===flight)listFlights.delete(key);});listFlights.set(key,flight);}
      const result=await flight;
      if(token===listRequest && sameUser() && allowed){
        pending=result.sites.filter(site=>workState(site)==='pending').length;
        badges();
      }
      return result;
    }
    function refresh(){
      if(!allowed||!sameUser()||document.hidden)return;
      readList().then(result=>{
        if(onScreen()&&shownPeriod&&railBody&&!managerForm&&!busy){
          folders=result.sites;listingPeriod=result.period;paintRail();
          if(!shownDoc){
            const selected=folders.find(s=>s.site_id===shownSite);
            if(selected)paintDocuments(selected);else{shownSite=null;paintSites();}
          }
        }
        const current=result.sites.find(s=>s.site_id===shownSite);
        if(onScreen()&&shownSite&&!current&&!busy&&!dirty){open();return;}
        if(onScreen()&&shownDoc==='chart'&&shownPeriod&&!dirty&&!busy&&(shownPeriod!==result.period || current && shownRevision!==undefined && (current.revision||0)!==shownRevision)){
          shownPeriod=null;
          folder(shownSite);
        }
      }).catch(()=>{});
    }
    function schedule(){
      clearTimeout(refreshTimer);
      if(!allowed||!sameUser())return;
      const now=new Date(), korea=new Date(now.getTime()+9*3600000);
      const rollover=Date.UTC(korea.getUTCFullYear(),korea.getUTCMonth()<6?6:12,1)-9*3600000;
      refreshTimer=setTimeout(()=>{refresh();schedule()},Math.min(300000,Math.max(250,rollover-now.getTime()+100)));
    }
    function catalog(m) {
      const wasAllowed=allowed;
      allowed=roles.includes(u.role)&&!!m&&m.enabled!==false&&m.state!=='hidden'&&m.canEnter!==false&&(m.state==='live'||m.preview);
      badges();
      if(allowed){if(!wasAllowed){refresh();schedule()}}else{pending=0;clearTimeout(refreshTimer);}
    }
    function canLeave(){return !busy&&(!dirty||confirm('저장하지 않은 조직도 변경사항이 있어요. 화면을 이동할까요?'))}
    function leave(){sequence++;dirty=false;shownPeriod=null;shownSite=null;shownDoc=null;main=null;railBody=null;managerForm=null;panel?.replaceChildren()}
    function status(text){const p=el('p',text,'org-status');p.setAttribute('role','status');return p}
    function failure(err,retry,target=panel){
      target.replaceChildren(status('자료를 불러오지 못했습니다. 연결 상태를 확인해 주세요.'),button('다시 불러오기',retry));
    }
    function paintSites(){
      if(!main)return;
      const heading=el('div',null,'org-page-title');
      heading.append(el('h3','사업장 목록'),el('p','사업장을 선택하면 조직도, 임명장, 업무수행평가표 메뉴로 이동합니다.','org-status'));
      const grid=el('div',null,'org-site-grid');
      const collator=new Intl.Collator('ko-KR',{numeric:true,sensitivity:'base'});
      for(const site of [...folders].sort((a,b)=>collator.compare(a.folder_name||a.site_name,b.folder_name||b.site_name))){
        const card=button('',()=>selectFolder(site.site_id,true),'org-site-card');
        const name=el('strong',site.folder_name||site.site_name);
        const condition=site.active===false?'종료':stages[site.state]||'미작성';
        const small=el('span',condition,'org-state '+workState(site));
        card.append(name,small);card.setAttribute('aria-label',(site.folder_name||site.site_name)+' 서류 메뉴 열기');
        grid.append(card);
      }
      main.replaceChildren(heading,grid);
      if(!folders.length)main.append(status('조회 가능한 사업장 폴더가 없습니다.'));
    }
    function paintDocuments(site){
      if(!main)return;
      const back=button('← 사업장 목록',()=>selectFolder(null,true),'org-back');
      const head=el('div',null,'org-page-title');
      head.append(el('h3',site.folder_name||site.site_name),
        el('p','조회할 서류를 선택하세요.','org-status'));
      const grid=el('div',null,'org-document-grid');
      const subtitles={chart:'안전보건 조직 및 인원 현황',appointment:'임명장 메뉴 (작성 기능 준비 중)',evaluation:'업무수행평가표 메뉴 (작성 기능 준비 중)'};
      for(const [key,label] of Object.entries(documents)){
        const card=button('',()=>selectDocument(site,key),'org-document-card');
        card.append(el('strong',label),el('span',subtitles[key],'org-status'));
        grid.append(card);
      }
      main.replaceChildren(back,head,grid);
    }
    function selectFolder(siteId,force=false){
      if(!canLeave())return;
      ++sequence;dirty=false;closeManager();
      shownSite=force?siteId:(shownSite===siteId?null:siteId);shownDoc=null;shownRevision=undefined;
      paintRail();
      const site=folders.find(s=>s.site_id===shownSite);
      if(site)paintDocuments(site);else paintSites();
    }
    function selectDocument(site,key){
      if(key==='chart'){folder(site.site_id);return;}
      if(!canLeave())return;
      ++sequence;dirty=false;closeManager();
      shownSite=site.site_id;shownDoc=key;shownRevision=undefined;
      paintRail();if(innerWidth<=750)rail.open=false;
      const back=button('← '+(site.folder_name||site.site_name)+' 서류 목록',()=>selectFolder(site.site_id,true),'org-back');
      main.replaceChildren(back,el('h2',site.site_name+' / '+documents[key]),status('해당 서류의 작성 기능은 준비 중입니다.'));
    }
    function paintRail(){
      if(!railBody)return;
      const count=folders.filter(s=>s.active!==false&&!s.checked).length;
      rail.querySelector('summary').textContent='사업장 폴더 ('+folders.length+')';
      rail.querySelector('.org-summary').textContent=periodName(listingPeriod)+' 미승인 '+count+'곳';
      const scroll=railBody.scrollTop;
      const focus=railBody.contains(document.activeElement)?document.activeElement.dataset:null;
      panel.querySelectorAll('[data-needs-site]').forEach(b=>{b.disabled=!admin||!shownSite});
      railBody.replaceChildren();
      for(const s of folders){
        const expanded=s.site_id===shownSite;
        const b=button('',()=>selectFolder(s.site_id),'org-folder');
        b.dataset.siteId=s.site_id;
        b.setAttribute('aria-expanded',String(expanded));
        const state=s.active===false?'종료':stages[s.state]||'미작성';
        b.append(el('span',s.folder_name||s.site_name),el('small',state,'org-state '+workState(s)));
        railBody.append(b);
        if(expanded){
          const children=el('div',null,'org-submenu');
          children.setAttribute('role','group');children.setAttribute('aria-label',s.folder_name||s.site_name);
          for(const [key,label] of Object.entries(documents)){
            const sub=button(label,()=>selectDocument(s,key));
            sub.dataset.doc=key;sub.dataset.owner=s.site_id;
            if(shownDoc===key)sub.setAttribute('aria-current','page');
            children.append(sub);
          }
          railBody.append(children);
        }
      }
      if(focus){
        const next=Array.from(railBody.querySelectorAll('button')).find(b=>focus.doc?
          b.dataset.doc===focus.doc&&b.dataset.owner===focus.owner:b.dataset.siteId===focus.siteId);
        next?.focus({preventScroll:true});
      }
      railBody.scrollTop=scroll;
    }
    function closeManager(){managerForm?.remove();managerForm=null;}
    async function manage(action,mobile=false){
      if(!admin||busy)return;
      closeManager();
      const site=folders.find(s=>s.site_id===shownSite);
      if(action!=='create'&&!site)return;
      const form=el('form',null,'org-manage');managerForm=form;
      const name=el('input'), sites=el('select'), note=status('');
      const submit=el('button',action==='delete'?'폴더 삭제':'저장','org-primary');
      submit.type='submit';name.required=true;name.maxLength=72;
      const label=(title,control)=>{const l=el('label',title);l.append(control);form.append(l)};
      if(action==='create'){
        label('연결할 사업장',sites);
        for(const s of available)sites.add(new Option(s.site_name,s.site_id));
        sites.onchange=()=>{name.value=sites.selectedOptions[0]?.text||''};sites.onchange();
      }
      if(action!=='delete'){
        label('폴더 이름',name);
        if(site&&action==='rename')name.value=site.folder_name||site.site_name;
      }else form.append(el('p','「'+(site.folder_name||site.site_name)+'」 폴더를 목록에서 삭제할까요? 같은 사업장의 폴더를 다시 만들면 저장 이력을 볼 수 있습니다.'));
      if(action==='create'&&!available.length){submit.disabled=true;note.textContent='등록된 모든 사업장에 폴더가 있습니다.';}
      form.append(submit,button('취소',closeManager),note);(mobile?panel.querySelector('.org-mobile-management .org-manage-tools'):rail.querySelector('.org-manage-tools')).after(form);
      form.onsubmit=async ev=>{
        ev.preventDefault();if(busy||!canLeave())return;
        const selected=action==='create'?available.find(s=>s.site_id===sites.value):site;
        if(!selected)return;
        busy=true;form.inert=true;
        try{
          await api({action:'platform_org_folder_'+action,siteId:selected.site_id,name:name.value,folderRevision:selected.folder_revision});
          listFlights.clear();dirty=false;busy=false;closeManager();if(onScreen())await open(action==='delete'?null:selected.site_id);
        }catch(err){note.textContent=err.message==='folder_changed'?'다른 사용자가 폴더를 변경했습니다. 메뉴를 다시 열어 주세요.':'폴더를 변경하지 못했습니다. 다시 시도해 주세요.';}
        finally{busy=false;form.inert=false;}
      };
    }
    async function open(preferred){
      if(!panel){panel=el('section',null,'hub-tool-panel org-panel');panel.dataset.listWorkspace='organization';host.append(panel)}
      panel.hidden=false;dirty=false;shownPeriod=null;shownSite=null;shownDoc=null;shownRevision=undefined;closeManager();
      const token=++sequence;
      const layout=el('div',null,'org-workspace');
      rail=el('details',null,'org-rail');rail.open=true;
      rail.append(el('summary','사업장 폴더'),el('p','','org-summary'));
      railBody=el('nav',null,'org-rail-list');railBody.setAttribute('aria-label','사업장별 서류');
      railBody.append(status('사업장 폴더를 불러오는 중입니다.'));
      rail.append(railBody);main=el('div',null,'org-main');main.append(status(selectPrompt));layout.append(rail,main);
      panel.replaceChildren(el('h2','안전보건조직'),layout);
      try{
        const result=await readList(admin);
        if(!sameUser()||token!==sequence)return;
        folders=result.sites;available=result.candidates||[];listingPeriod=shownPeriod=result.period;
        {
          const tools=el('div',null,'org-manage-tools');
          const mobile=el('details',null,'org-mobile-management'), mobileTools=el('div',null,'org-manage-tools');
          mobile.append(el('summary','폴더 관리'),mobileTools);
          layout.before(mobile);
          tools.setAttribute('role','group');tools.setAttribute('aria-label','사업장 폴더 관리');
          for(const [key,title,path] of [
            ['create','생성','M3 8h10M8 3v10'],
            ['rename','수정','m3 10-.5 3.5 3.5-.5 7.5-7.5-3-3L3 10Zm6-6 3 3'],
            ['delete','삭제','M2.5 4.5h11M6 4.5v-2h4v2m-6 0 .7 9h6.6l.7-9M7 7v4m2-4v4']
          ]){
            const b=button(title,()=>manage(key));b.setAttribute('aria-label','폴더 '+title);b.dataset.folderAction=key;
            const icon=document.createElementNS(ns,'svg'),stroke=document.createElementNS(ns,'path');
            icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('aria-hidden','true');stroke.setAttribute('d',path);
            icon.append(stroke);b.prepend(icon);tools.append(b);b.disabled=!admin;
            if(key!=='create')b.dataset.needsSite='';
            const mobileButton=button(title,()=>manage(key,true));
            mobileButton.setAttribute('aria-label','폴더 '+title);mobileButton.dataset.mobileFolderAction=key;
            if(key!=='create')mobileButton.dataset.needsSite='';
            mobileTools.append(mobileButton);mobileButton.disabled=!admin;
          }
          railBody.before(tools);
        }
        shownSite=folders.find(s=>s.site_id===preferred)?.site_id||null;
        paintRail();
        if(shownSite){const selected=folders.find(s=>s.site_id===shownSite);if(selected)paintDocuments(selected);else paintSites();}
        else paintSites();
      }catch(err){if(sameUser()&&token===sequence)failure(err,()=>open(),main)}
    }
    async function folder(siteId,version){
      if(!canLeave())return;
      dirty=false;closeManager();shownSite=siteId;shownDoc='chart';shownRevision=undefined;paintRail();if(innerWidth<=750)rail.open=false;const token=++sequence;
      main.replaceChildren(status('조직도를 불러오는 중입니다.'));
      try{
        const result=await api({action:'platform_org_open',siteId,revision:version,includeTemplate:!template});
        if(sameUser()&&token===sequence){
          if(result.template)template=result.template;
          renderFolder(result);
        }
      }catch(err){if(sameUser()&&token===sequence)failure(err,()=>folder(siteId,version),main)}
    }
    function renderFolder({site,history,document:doc,period,state,confirmedPeriods=[]}){
      shownPeriod=period;shownSite=site.site_id;
      const latest=history[0],historic=!!doc&&doc.revision!==latest?.revision;
      shownRevision=latest?.revision||0;
      const writer=admin||u.role==='field'&&(site.active!==false||!!doc);
      const locked=state==='approved';
      const editable=writer&&!locked;
      const mayDelete=!!doc&&(admin||u.role==='field'&&!confirmedPeriods.includes(period)&&!confirmedPeriods.includes(doc.period));
      let chart=structuredClone(doc?.chart||defaults());
      const head=el('div',null,'org-head'),title=el('div'),tools=el('section',null,'org-actions org-workflow'),note=status('');
      tools.setAttribute('aria-label','조직도 진행 순서와 담당자');
      const flow=el('div',null,'org-flow-steps'),extra=el('div',null,'org-flow-extra'),guidance=el('p',null,'org-flow-guidance');
      guidance.setAttribute('role','status');
      tools.append(flow,guidance,extra);
      const steps=[];
      function actionCard(parent,control,heading,role,step,kind){
        const item=el('div',null,step?'org-flow-step':'org-flow-option');
        if(step){item.dataset.step=String(step);steps.push(item);}
        item.dataset.kind=kind;
        if(heading)item.append(el('strong',heading,'org-flow-heading'));
        item.append(control,el('span',role,'org-flow-role'));
        parent.append(item);return item;
      }
      title.append(el('h2',site.site_name+' 안전보건조직도'),el('span',periodName(period)+'　'+(site.active===false?'종료 사업장':stages[state]||'미작성'),'org-state '+workState(site,state)));

      head.append(title);
      const back=button('← '+(site.folder_name||site.site_name)+' 서류 목록',()=>selectFolder(site.site_id,true),'org-back');
      main.replaceChildren(back,head,tools);
      if(history.length){
        const label=el('label','저장 이력　','org-versions'),pick=el('select');label.append(pick);
        for(const v of history){
          const text=periodName(v.period)+' / '+when(v.saved_at)+' / '+v.actor_name+' / '+(v.review_event==='approve'?'최신화 승인':v.review_event==='reopen'?'최신화 수정':v.confirmed?'최신화 확인':'저장')+' (v'+v.revision+')';
          pick.add(new Option(text,v.revision,false,v.revision===doc.revision));
        }
        pick.onchange=()=>{const rev=Number(pick.value);pick.value=doc.revision;folder(site.site_id,rev)};
        main.append(label);
      }

      const form=editable?el('form',null,'org-form'):null, preview=el('div',null,'org-preview');
      const change=()=>{dirty=true;update();note.textContent=''};
      const printedSite=doc?.site_name||site.site_name;
      const reload=()=>folder(site.site_id);
      let save,check,approve,reopen,print,remove,review,photoLoaded=false;
      const upload=el('input');upload.type='file';upload.accept='image/*';upload.hidden=true;
      tools.append(upload);
      upload.onchange=async()=>{
        const file=upload.files[0];upload.value='';
        if(!file||busy||dirty||historic||!doc)return;
        busy=true;update();if(form)form.inert=true;
        try{
          const photo=await window.enlPrepareDocumentPhoto(file);
          busy=false;
          if(onScreen()&&upload.isConnected)await write('confirm',photo.base64);
        }catch{note.textContent='사진을 읽지 못했습니다. JPG 또는 PNG 사진을 다시 선택해 주세요.';}
        finally{busy=false;if(form)form.inert=false;update();}
      };
      function update(){
        if(save)save.disabled=busy||!editable||(!dirty&&!!doc);
        if(check)check.disabled=busy||dirty||historic||!doc||u.role!=='field'||site.active===false||locked||state==='pending';
        if(approve)approve.disabled=busy||dirty||historic||!admin||state!=='pending'||!photoLoaded||!review?.checked;
        if(reopen)reopen.disabled=busy||!writer||historic||!locked;
        if(print)print.disabled=busy||dirty||!doc;
        if(remove)remove.disabled=busy||dirty||!mayDelete;
        for(const item of steps){
          const n=Number(item.dataset.step);
          item.classList.toggle('is-done',!historic&&!dirty&&!!doc&&(n===1||state==='approved'||state==='pending'&&n<4));
          item.classList.toggle('is-next',!historic&&(dirty||!doc?n===1:state==='draft'?n===2||n===3:state==='pending'?n===4:false));
        }
        guidance.textContent=historic?'이전 저장본입니다.':
          dirty?'변경사항을 먼저 저장하세요.':
          !doc?'조직도 작성 후 저장하세요.':
          state==='approved'?'이번 반기 확인완료':
          state==='pending'?'안전관리자: 사진 대조에 체크 후 확인완료':
          '출력 후 현장 게시 사진을 제출하세요.';
      }
      async function write(op,photo){
        if(busy)return;
        const withChart=op==='save';
        if(withChart&&!form?.reportValidity())return;
        const prompts={
          confirm:periodName(period)+' 출력물 사진을 제출하고 안전관리자 확인을 요청할까요?',
          approve:periodName(period)+' 조직도와 출력물 사진 확인을 완료할까요?',
          reopen:'최신화 수정을 시작할까요? 사업장 표시가 빨간색으로 바뀌며 다시 확인과 승인을 받아야 합니다.'
        };
        if(prompts[op]&&!confirm(prompts[op]))return;
        busy=true;update();if(form)form.inert=true;note.textContent='처리 중입니다.';
        try{
          await api({action:'platform_org_'+op,siteId:site.site_id,folderRevision:site.folder_revision,period,
            revision:latest?.revision||0,...(withChart?{chart}:{}),...(photo?{photo}:{}),...(op==='approve'?{reviewedPhotoRevision:doc.photo_revision}:{})});
          busy=false;dirty=false;
          if(!onScreen())return;
          await folder(site.site_id);refresh();
          const message=panel.querySelector('.org-main .org-status');
          if(message)message.textContent={save:'조직도를 사업장 폴더에 저장했습니다.',confirm:'최신화를 확인했습니다. 안전관리자 승인 대기 중입니다.',
            approve:'최신화를 승인했습니다. 조직도가 확정되었습니다.',reopen:'최신화 수정을 시작했습니다.'}[op];
        }catch(err){
          if(!onScreen())return;
          note.replaceChildren(el('span',['chart_changed','folder_changed','chart_locked','review_state_changed'].includes(err.message)?
            '조직도 상태가 변경되었습니다. 최신본을 확인해 주세요.':'처리 결과를 확인하지 못했습니다. 최신본을 확인해 주세요.'),button('최신본 불러오기',reload));
        }finally{busy=false;if(form)form.inert=false;update();}
      }
      reopen=button('최신화 수정',()=>write('reopen'));
      save=button('조직도 저장',()=>write('save'),'org-primary');
      check=button('게시 사진 제출',()=>upload.click());
      approve=button('확인완료',()=>write('approve'),'org-primary');
      actionCard(flow,save,'1. 저장','현장 / 안전관리자',1,'save');
      actionCard(flow,check,'3. 사진 제출','현장 담당자',3,'submit');
      actionCard(flow,approve,'4. 확인','안전관리자',4,'approve');
      actionCard(extra,reopen,'','현장 / 안전관리자',null,'reopen');
      if(doc?.photo){
        const evidence=el('section',null,'org-evidence'),image=el('img');
        image.alt='사업장에서 제출한 조직도 출력물 사진';
        image.onload=()=>{photoLoaded=true;update();};
        image.src=doc.photo;
        const label=el('label');review=el('input');review.type='checkbox';
        review.checked=doc.review_event==='approve';review.disabled=!admin||historic||state!=='pending';review.onchange=update;
        label.append(review,' 조직도와 출력물 사진을 대조했습니다.');
        evidence.append(el('h3','제출된 출력물 사진'),image,label);main.append(evidence);
      }
      const zoom=button('양식 확대',()=>{
        const large=preview.classList.toggle('org-zoomed');
        zoom.textContent=large?'전체 보기':'양식 확대';zoom.setAttribute('aria-pressed',String(large));
      },'org-zoom');
      zoom.setAttribute('aria-pressed','false');
      if(form){
        form.onsubmit=e=>{e.preventDefault();if(!save.disabled)write('save')};
        form.append(note,preview);main.append(form);
      }else main.append(note,preview);
      {
        remove=button('저장본 삭제',async()=>{
          if(busy||dirty||!confirm(site.site_name+'의 '+periodName(doc.period)+' 저장본 v'+doc.revision+'을 삭제할까요?'))return;
          busy=true;update();if(form)form.inert=true;
          try{
            await api({action:'platform_org_delete',siteId:site.site_id,folderRevision:site.folder_revision,
              revision:latest.revision,targetRevision:doc.revision,period});
            busy=false;
            if(onScreen()){await folder(site.site_id);refresh();}
          }catch(err){
            note.replaceChildren(el('span',err.message==='confirmed_delete_forbidden'?'반기 확인을 마친 자료는 안전관리자만 삭제할 수 있습니다.':'삭제하지 못했습니다. 최신본을 확인해 주세요.'),button('최신본 불러오기',reload));
          }finally{busy=false;if(form)form.inert=false;update();}
        });actionCard(extra,remove,'',confirmedPeriods.includes(period)||confirmedPeriods.includes(doc?.period)?'안전관리자':'현장 / 안전관리자',null,'delete');
      }
      {
        print=button('PDF 출력',async()=>{
          if(dirty||busy)return;
          const sheet=preview.firstElementChild;
          try{await sheet.querySelector('img').decode();if(onScreen()&&sheet.isConnected&&!dirty)printChart(paper(doc.chart,printedSite,null,template),site.site_name+'_안전보건조직도_v'+doc.revision)}
          catch{note.textContent='출력 양식을 불러오지 못했습니다. 다시 시도해 주세요.'}
        });
        const printStep=actionCard(flow,print,'2. 출력','전체 사용자',2,'print');
        flow.insertBefore(printStep,flow.querySelector('[data-step="3"]'));
      }
      extra.append(zoom);
      preview.append(paper(chart,printedSite,form?change:null,template,!doc));update();
    }
    const focus=()=>{if(sameUser()){refresh();schedule()}else{clearTimeout(refreshTimer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    return {catalog,badges,open,leave,canLeave,canSuspend:()=>!busy};
  }
  window.enlOrganization=controller;
})();
