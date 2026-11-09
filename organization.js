(() => {
  'use strict';
  const roles = ['field','safety','manager','executive'];
  const ns = 'http://www.w3.org/2000/svg';
  const defaults = () => ({lead:'',supervisor:'',teams:['코스관리','스프링쿨러','서무','기타'].map(name => ({name,regular:0,daily:0}))});
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
  function paper(chart, site, edit, template) {
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
      line(297.36,y+16,chart[key]||'소장 OOO',12,false,251,key);
    }
    chart.teams.forEach((team,i)=>{
      const x=i%2?429.52:165.35, y=i<2?674:729.12;
      line(x,y,team.name||'업무명',14,true,210,'team'+i);
      line(x,y+18,'상용 '+(team.regular??'')+'명　　　 일용 '+(team.daily??'')+'명',14,false,215,'regular'+i);
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
    let panel, sequence=0, listRequest=0, allowed=false, busy=false, dirty=false, pending=0, refreshTimer, shownPeriod, shownSite, template;
    let main,rail,railBody,folders=[],available=[],listingPeriod,managerForm;
    const admin=u.role==='safety';
    const onScreen=()=>sameUser()&&host.dataset.workspace==='organization';
    function badges(){
      for(const node of host.querySelectorAll('[data-module="organization"],[data-hub="feature:organization"]')){
        let dot=node.querySelector('.org-dot');
        if(!allowed||!pending){dot?.remove();continue}
        if(!dot){dot=el('span',null,'org-dot');node.append(dot)}
        dot.setAttribute('role','img');
        dot.setAttribute('aria-label','최신화 미확인 '+pending+'개 사업장');dot.title=dot.getAttribute('aria-label');
      }
    }
    async function readList(manageFolders=false){
      const token=++listRequest;
      const result=await api({action:'platform_org_list',manageFolders});
      if(token===listRequest && sameUser() && allowed){
        pending=result.sites.filter(s=>s.active!==false&&!s.checked).length;
        badges();
      }
      return result;
    }
    function refresh(){
      if(!allowed||!sameUser()||document.hidden)return;
      readList().then(result=>{
        if(onScreen()&&railBody&&!managerForm&&!busy){
          folders=result.sites;listingPeriod=result.period;paintRail();
        }
        if(onScreen()&&shownPeriod&&shownPeriod!==result.period&&!dirty&&!busy){
          shownPeriod=null;
          if(shownSite)folder(shownSite);else open();
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
      allowed=roles.includes(u.role)&&!!m&&m.enabled!==false&&m.state!=='hidden'&&m.canEnter!==false&&(m.state==='live'||m.preview);
      badges();
      if(allowed){refresh();schedule()}else{pending=0;clearTimeout(refreshTimer);}
    }
    function canLeave(){return !busy&&(!dirty||confirm('저장하지 않은 조직도 변경사항이 있어요. 화면을 이동할까요?'))}
    function leave(){sequence++;dirty=false;shownPeriod=null;shownSite=null;main=null;railBody=null;managerForm=null;panel?.replaceChildren()}
    function status(text){const p=el('p',text,'org-status');p.setAttribute('role','status');return p}
    function failure(err,retry,target=panel){
      target.replaceChildren(status('자료를 불러오지 못했습니다. 연결 상태를 확인해 주세요.'),button('다시 불러오기',retry));
    }
    function paintRail(){
      if(!railBody)return;
      const count=folders.filter(s=>s.active!==false&&!s.checked).length;
      rail.querySelector('summary').textContent='사업장 폴더 ('+folders.length+')';
      rail.querySelector('.org-summary').textContent=periodName(listingPeriod)+' 미확인 '+count+'곳';
      const scroll=railBody.scrollTop;
      railBody.replaceChildren();
      for(const s of folders){
        const b=button('',()=>folder(s.site_id),'org-folder');
        b.dataset.siteId=s.site_id;
        if(s.site_id===shownSite)b.setAttribute('aria-current','page');
        const state=s.active===false?'종료':s.checked?'확인 완료':s.revision?'작성 / 미확인':'미작성';
        b.append(el('span',s.folder_name||s.site_name),el('small',state,'org-state '+(s.active!==false&&!s.checked?'pending':'')));
        railBody.append(b);
      }
      railBody.scrollTop=scroll;
    }
    function closeManager(){managerForm?.remove();managerForm=null;}
    async function manage(action){
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
      form.append(submit,button('취소',closeManager),note);rail.querySelector('.org-manage-tools').after(form);
      form.onsubmit=async ev=>{
        ev.preventDefault();if(busy||!canLeave())return;
        const selected=action==='create'?available.find(s=>s.site_id===sites.value):site;
        if(!selected)return;
        busy=true;form.inert=true;
        try{
          await api({action:'platform_org_folder_'+action,siteId:selected.site_id,name:name.value,folderRevision:selected.folder_revision});
          dirty=false;busy=false;closeManager();if(onScreen())await open(action==='delete'?null:selected.site_id);
        }catch(err){note.textContent=err.message==='folder_changed'?'다른 사용자가 폴더를 변경했습니다. 메뉴를 다시 열어 주세요.':'폴더를 변경하지 못했습니다. 다시 시도해 주세요.';}
        finally{busy=false;form.inert=false;}
      };
    }
    async function open(preferred){
      if(!panel){panel=el('section',null,'hub-tool-panel org-panel');panel.dataset.listWorkspace='organization';host.append(panel)}
      panel.hidden=false;dirty=false;shownPeriod=null;shownSite=null;railBody=null;closeManager();
      const token=++sequence;
      panel.replaceChildren(status('사업장 폴더를 불러오는 중입니다.'));
      try{
        const result=await readList(admin);
        if(!onScreen()||token!==sequence)return;
        folders=result.sites;available=result.candidates||[];listingPeriod=shownPeriod=result.period;
        const layout=el('div',null,'org-workspace');
        rail=el('details',null,'org-rail');rail.open=innerWidth>750||!folders.length;
        rail.append(el('summary'),el('p','','org-summary'));
        if(admin){
          const tools=el('div',null,'org-manage-tools');
          for(const [key,title] of [['create','생성'],['rename','수정'],['delete','삭제']]){
            const b=button(title,()=>manage(key));b.setAttribute('aria-label','폴더 '+title);tools.append(b);
            if(key!=='create'&&!folders.length)b.disabled=true;
          }
          rail.append(tools);
        }
        railBody=el('nav',null,'org-rail-list');railBody.setAttribute('aria-label','사업장별 조직도');
        rail.append(railBody);main=el('div',null,'org-main');layout.append(rail,main);
        panel.replaceChildren(el('h2','안전보건조직'),layout);paintRail();
        const first=folders.find(s=>s.site_id===preferred)||folders[0];
        if(first)await folder(first.site_id);
        else main.append(status('조회 가능한 사업장 폴더가 없습니다.'));
      }catch(err){if(onScreen()&&token===sequence)failure(err,()=>open())}
    }
    async function folder(siteId,version){
      if(!canLeave())return;
      dirty=false;closeManager();shownSite=siteId;paintRail();if(innerWidth<=750)rail.open=false;const token=++sequence;
      main.replaceChildren(status('조직도를 불러오는 중입니다.'));
      try{
        const result=await api({action:'platform_org_open',siteId,revision:version,includeTemplate:!template});
        if(onScreen()&&token===sequence){
          if(result.template)template=result.template;
          renderFolder(result);
        }
      }catch(err){if(onScreen()&&token===sequence)failure(err,()=>folder(siteId,version),main)}
    }
    function renderFolder({site,history,document:doc,period}){
      shownPeriod=period;shownSite=site.site_id;
      const latest=history[0],historic=!!doc&&doc.revision!==latest?.revision;
      const editable=(admin||u.role==='field'&&site.active!==false)&&!historic;
      const checked=latest?.confirmed&&latest.period===period;
      let chart=structuredClone(doc?.chart||defaults());
      const head=el('div',null,'org-head'),title=el('div'),tools=el('div',null,'org-actions'),note=status('');
      title.append(el('h2',site.site_name+' 안전보건조직도'),el('span',periodName(period)+'　'+(site.active===false?'종료 사업장':checked?'최신화 확인':'최신화 미확인'),'org-state '+(!checked&&site.active!==false?'pending':'')));

      head.append(title,tools);main.replaceChildren(head);
      if(history.length){
        const label=el('label','저장 이력　','org-versions'),pick=el('select');label.append(pick);
        for(const v of history){
          const text=periodName(v.period)+' / '+when(v.saved_at)+' / '+v.actor_name+' / '+(v.confirmed?'최신화 확인':'저장')+' (v'+v.revision+')';
          pick.add(new Option(text,v.revision,false,v.revision===doc.revision));
        }
        pick.onchange=()=>{const rev=Number(pick.value);pick.value=doc.revision;folder(site.site_id,rev)};
        main.append(label);
      }
      if(!doc&&!editable){main.append(status('저장된 조직도가 없습니다.'));return}
      const form=editable?el('form',null,'org-form'):null, preview=el('div',null,'org-preview');
      const change=()=>{dirty=true;update();note.textContent='변경사항을 저장해 주세요.'};
      const printedSite=doc?.site_name||site.site_name;
      const reload=()=>folder(site.site_id);
      let save,check,print;
      function update(){
        if(save)save.disabled=busy||(!dirty&&!!doc);
        if(check)check.disabled=busy||dirty||!doc||checked;
        if(print)print.disabled=busy||dirty||!doc;
      }
      async function write(confirming){
        if(busy||(confirming&&(dirty||!doc||checked)))return;
        if(!confirming&&!form.reportValidity())return;
        if(confirming&&!confirm(periodName(period)+' 조직도의 담당자와 인원 현황이 최신인지 확인했습니까?'))return;
        busy=true;update();form.inert=true;note.textContent='저장 중입니다.';
        try{
          await api({action:confirming?'platform_org_confirm':'platform_org_save',siteId:site.site_id,folderRevision:site.folder_revision,period,revision:doc?.revision||0,...(confirming?{}:{chart})});
          busy=false;dirty=false;
          if(!onScreen())return;
          await folder(site.site_id);refresh();
          if(onScreen()&&panel.querySelector('.org-head'))panel.querySelector('.org-status').textContent=confirming?'이번 반기 최신화를 확인했습니다.':'조직도를 사업장 폴더에 저장했습니다.';
        }catch(err){
          if(!onScreen())return;
          note.replaceChildren(el('span',['chart_changed','folder_changed'].includes(err.message)?'다른 사용자가 수정했거나 반기가 바뀌었습니다. 최신본을 확인해 주세요.':'저장 결과를 확인하지 못했습니다. 입력값은 화면에 남아 있습니다.'),button('최신본 불러오기',reload));
        }finally{busy=false;form.inert=false;update();}
      }
      if(form){
        save=el('button','조직도 저장','org-primary');save.type='submit';
        if(u.role==='field')check=button('이번 반기 최신화 확인',()=>write(true));
        form.onsubmit=e=>{e.preventDefault();write(false)};
        const actions=el('div',null,'org-actions');actions.append(save);if(check)actions.append(check);
        const zoom=button('양식 확대',()=>{
          const large=preview.classList.toggle('org-zoomed');zoom.textContent=large?'전체 보기':'양식 확대';zoom.setAttribute('aria-pressed',String(large));
        },'org-zoom');zoom.setAttribute('aria-pressed','false');actions.append(zoom);
        form.append(actions,note,preview);main.append(form);
      }else{main.append(note,preview)}
      if(doc){
        print=button('PDF 출력',async()=>{
          if(dirty||busy)return;
          const sheet=preview.firstElementChild;
          try{await sheet.querySelector('img').decode();if(onScreen()&&sheet.isConnected&&!dirty)printChart(paper(doc.chart,printedSite,null,template),site.site_name+'_안전보건조직도_v'+doc.revision)}
          catch{note.textContent='출력 양식을 불러오지 못했습니다. 다시 시도해 주세요.'}
        });
        tools.append(print);
      }
      preview.append(paper(chart,printedSite,form?change:null,template));update();
    }
    const focus=()=>{if(sameUser()){refresh();schedule()}else{clearTimeout(refreshTimer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    return {catalog,badges,open,leave,canLeave};
  }
  window.enlOrganization=controller;
})();
