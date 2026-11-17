/* Offline DOM integration. Does not claim browser layout or device verification. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {TextEncoder,TextDecoder}=require('node:util');
const base=process.cwd();
const until=async(test,note)=>{for(let n=0;n<500;n++){if(test())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+note)};
function loadScript(file){
 let source=fs.readFileSync(file,'utf8');if(file!=='tests/integrated-home-fixture.js')return source;
 source=source.replace("if(b.action==='dashboard_read')out.sites=","if(b.action==='dashboard_read')out.metrics=[...Array.from({length:2},()=>({siteId:'s01',category:'person',status:'reported',occurredAt:new Date().getFullYear()+'-01-01'})),...Array.from({length:3},()=>({siteId:'s02',category:'property',status:'closed',occurredAt:new Date().getFullYear()+'-02-01'}))];if(b.action==='dashboard_read')out.sites=");
 source=source.replaceAll("['incident','history','notices','system'].includes(key)","['incident','organization','risk','history','notices','system'].includes(key)");
 return source.replace("if(b.action==='platform_catalog')", "if(b.action==='platform_risk_documents')out={ok:true,site:{site_id:'qa-site',site_name:'검수 골프장'},records:[],years:[],templates:[{id:'course',name:'코스관리',count:84},{id:'landscape',name:'조경',count:39},{id:'sprinkler',name:'스프링클러',count:31},{id:'pest',name:'방제',count:36},{id:'office',name:'사무실',count:14}]};if(b.action==='platform_org_list'||b.action==='platform_risk_list'){await new Promise(r=>setTimeout(r,60));out={ok:true,period:'2026-2',sites:[{site_id:'qa-site',site_name:'검수 골프장',folder_name:'검수 골프장',folder_revision:1,state:'draft',active:true}],candidates:[]};}\n  if(b.action==='platform_catalog')");
}
(async()=>{
 for(const role of ['safety','manager','executive','field']){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented:|Could not load (img|link)/.test(e.message))errors.push(e.message)});
 let source=fs.readFileSync('stable412.html','utf8').replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
 source=source.replace(/<script src="([^"]+)"><\/script>/g,(_,url)=>'<script>'+loadScript(url.split('?')[0]).replace(/<\/script/gi,'<\\/script')+'</script>').replace(/<link[^>]*>/g,'');
 const dom=new JSDOM(source,{url:'https://isolated.test/stable412.html?role='+role,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
 beforeParse(w){w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;w.Response=Response;w.Request=Request;w.Headers=Headers;w.AbortController=AbortController;w.fetch=async()=>new Response('{}');w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.confirm=()=>true;w.alert=()=>{};w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};}});
 const w=dom.window,d=w.document;
 try{
 await until(()=>w.ENLIncidentAnalysis&&d.querySelector('.app-shell'),'shell '+role);
 await until(()=>w.enlIncidentServerReady?.(),'incident server ready');
 // Use the existing shell route with an actor from the isolated fixture.
 w.eval("currentView='stats';renderShell(currentUser());");
 const nav=d.querySelector('[data-shell-view="analysis"]');
 if(role==='field'){
 assert.equal(nav,null);assert.equal(d.querySelector('.management-points'),null);w.eval("currentView='analysis';renderShell(currentUser());");assert.equal(d.querySelector('.incident-analysis'),null);assert.equal(w.enlIncidentAnalysisRecords().length,0);
 }else{
 await until(()=>d.querySelector('[data-sd450-map]'),'dashboard map');
 assert.equal(d.querySelectorAll('.stats426-cards .stats426-card').length,4);
 assert.match(d.querySelector('[data-stats-filter="all"] b').textContent,/1건/);
 assert.match(d.querySelector('.analysis-dashboard-cost').textContent,/대인.*대물/s);
 assert.equal(d.querySelectorAll('[data-sd450-map]').length,1);
 assert.ok(d.querySelector('.incident-overview > .stats426-cards'));
 assert.equal(d.querySelectorAll('.management-points').length,1);
 assert.match(d.querySelector('.management-points').textContent,/핵심 관리 포인트.*전년 동기 대비.*미종결 사고.*법정 보고 검토.*우선 관리 사업장/s);
 assert.ok(d.querySelector('.incident-overview > [data-sd450-map]'));
 for(const title of ['월별 사고 발생','사고유형별 분포','사업장별 사고 건수','우선 확인할 작업','업무별 발생 현황','추가 확인이 필요한 정보'])assert.equal([...d.querySelectorAll('.stats426 h3')].filter(h=>h.textContent===title).length,1,title+' appears once');
 assert.equal(d.querySelector('.stats426-donut'),null);
 const selected=d.querySelector('#stats426Year').value;
 d.querySelector('[data-stats-filter="all"]').click();assert.match(d.querySelector('#stats426Drill').textContent,/1건/);
 d.querySelector('[data-stats-close]').click();assert.equal(d.querySelector('#stats426Drill').textContent,'');
 const occurred=w.ENLIncidentAnalysis.dateKey(w.enlIncidentAnalysisRecords()[0]).slice(0,7);
 d.querySelector('[data-stats-month="'+occurred+'"]').click();assert.match(d.querySelector('[data-month-drill]').textContent,/1건/);assert.equal(d.querySelector('#stats426Drill').textContent,'');assert.ok(d.querySelector('[data-analysis-month-card] [data-month-drill].show'));
 w.eval('renderShell(currentUser())');assert.equal(d.querySelector('#stats426Year').value,selected);
 // Unknown-cost links open inline lists, then the existing report review with role permissions.
 d.querySelector('.analysis-dashboard-cost [data-cost-unknown]').click();
 assert.equal(d.querySelectorAll('[data-cost-drill] [data-inc-id]').length,1);
 d.querySelector('[data-cost-drill] [data-inc-id]').click();
 await until(()=>d.querySelector('#modalRoot [data-incident-view]'),'report review');
 assert.equal(!!d.querySelector('#modalRoot #editInc'),role==='safety','existing report editing is safety-only');
 w.closeModal();
 d.querySelector('.analysis-card table [data-cost-unknown]').click();
 assert.equal(d.querySelectorAll('[data-missing-drill] [data-inc-id]').length,1);
 assert.equal(d.querySelectorAll('.analysis-donut').length,2);
 assert.doesNotMatch(d.querySelector('.analysis-dashboard-cost').textContent,/입력된 피해비용/);
 const savedSource=w.enlIncidentAnalysisRecords;
 const costSource=[
 {id:'high',status:'reported',category:'person',siteId:'s01',occurredAt:'2026-02-02',eventType:'넘어짐',reportDetails:{medicalCost:8000}},
 {id:'low',status:'reported',category:'person',siteId:'s01',occurredAt:'2026-03-02',reportDetails:{medicalCost:1000}},
 {id:'zero',status:'reported',category:'person',siteId:'s01',occurredAt:'2026-04-02',reportDetails:{medicalCost:0,medicalCostKnown:true}},
 {id:'unknown',status:'reported',category:'person',siteId:'s01',occurredAt:'2026-05-02',reportDetails:{}},
 {id:'property-low',status:'closed',category:'property',siteId:'s02',occurredAt:'2026-03-02',reportDetails:{repairCost:3000}},
 {id:'property-high',status:'closed',category:'property',siteId:'s02',occurredAt:'2026-02-02',reportDetails:{repairCost:9000}}];
 w.enlIncidentAnalysisRecords=()=>costSource;
 const pointsCalls=w.__fixtureCalls.length;
 w.enlRenderIncidentStats(d.getElementById('view'),w.currentUser(),{year:'2026'});
 assert.equal(w.__fixtureCalls.length,pointsCalls,'summary makes no additional requests');
 assert.match(d.querySelector('.management-points').textContent,/미종결 사고4건/);
 assert.equal(d.querySelectorAll('.management-points-focus').length,1);
 assert.ok(d.querySelector('.analysis-cost-layout > .analysis-cost-heading'));
 assert.ok(d.querySelector('.analysis-cost-layout > .analysis-ratios'));
 assert.equal(d.querySelector('.analysis-cost-heading [data-cost-unknown]')!==null,true);
 assert.equal(d.querySelector('.analysis-donut-segment[data-cost-category="person"]').getAttribute('stroke'),'#c84550');
 assert.equal(d.querySelector('.analysis-donut-segment[data-cost-category="property"]').getAttribute('stroke'),'#287caf');
 assert.match(d.querySelectorAll('.analysis-ratio')[0].textContent,/대인4건67%/);
 assert.match(d.querySelectorAll('.analysis-ratio')[1].textContent,/대인9,000원43%/);
 for(const svg of d.querySelectorAll('.analysis-donut')){const segments=[...svg.querySelectorAll('.analysis-donut-segment')];const length=segments.reduce((sum,c)=>sum+Number(c.getAttribute('stroke-dasharray').split(' ')[0]),0);assert.ok(Math.abs(length-2*Math.PI*42)<1e-7,'chart arcs represent the complete denominator');}
 d.querySelector('.analysis-cost-breakdown [data-cost-category="person"]').click();
 assert.deepEqual([...d.querySelectorAll('[data-cost-drill] [data-inc-id]')].map(b=>b.dataset.incId),['high','low','zero','unknown']);
 assert.match(d.querySelector('[data-cost-drill]').textContent,/8,000원/);
 assert.equal(d.querySelector('[data-cost-drill] [data-inc-id="high"]').dataset.analysisRank,'1');
 assert.equal(d.querySelector('[data-cost-drill] [data-inc-id="low"]').dataset.analysisRank,'2');
 assert.equal(d.querySelector('[data-cost-drill] [data-inc-id="zero"]').dataset.analysisRank,'0');
 assert.equal(d.querySelector('[data-cost-drill] [data-inc-id="unknown"]').dataset.analysisRank,'0');

 d.querySelector('.analysis-ratio-legend [data-cost-category="property"]').click();
 assert.deepEqual([...d.querySelectorAll('[data-cost-drill] [data-inc-id]')].map(b=>b.dataset.incId),['property-high','property-low']);
 d.querySelector('.analysis-donut-segment[data-cost-category="person"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 assert.equal(d.querySelectorAll('[data-cost-drill] [data-inc-id]').length,4);
 d.querySelector('.analysis-dashboard-cost [data-cost-unknown]').click();
 assert.deepEqual([...d.querySelectorAll('[data-cost-drill] [data-inc-id]')].map(b=>b.dataset.incId),['unknown']);
 // Default map ranking, in-panel navigation, report open and outside reset.
 await until(()=>d.querySelector('[data-sd450-select="s02"]')&&d.querySelector('[data-sd450-select="s02"]').textContent.includes('3건'),'loaded map ranking');
 assert.equal(d.querySelector('[data-sd450-select]').dataset.sd450Select,'s02');assert.equal(d.querySelector('[data-sd450-select]').dataset.analysisRank,'1');
 assert.match(d.querySelector('[data-sd450-select="s01"]').textContent,/대인 2건 \/ 대물 0건/);
 d.querySelector('[data-sd450-select="s01"]').click();
 assert.equal(d.querySelector('#sd450Site').value,'s01');
 assert.equal(d.querySelectorAll('[data-sd450-incident]').length,4);
 d.querySelector('.sd450-map-head').click();assert.equal(d.querySelector('#sd450Site').value,'s01','inside white panel preserves selection');
 const savedOpen=w.enlOpenIncidentReview;let opened;
 w.enlOpenIncidentReview=(...args)=>{opened=args};
 d.querySelector('[data-sd450-incident]').click();assert.equal(opened[0],'unknown');assert.equal(opened[1],role==='safety');w.enlOpenIncidentReview=savedOpen;
 d.querySelector('.analysis-cost-heading').click();
 assert.equal(d.querySelector('#sd450Site').value,'');assert.ok(d.querySelector('.sd450-ranking'));
 assert.equal(d.querySelectorAll('.sd450-marker.selected,.sd450-marker.label-open').length,0);
 d.querySelector('[data-sd450-map-site="s01"]').click();assert.equal(d.querySelector('#sd450Site').value,'s01');
 d.body.click();assert.equal(d.querySelector('#sd450Site').value,'');

 const fixtureSource=[{id:'compare-26',status:'reported',category:'person',siteId:'qa-site',occurredAt:'2026-12-31',reportDetails:{medicalCost:1234}},{id:'compare-27',status:'closed',category:'property',siteId:'qa-site',occurredAt:'2026-12-31T16:00:00Z',reportDetails:{repairCost:5000}}];
 w.enlIncidentAnalysisRecords=()=>fixtureSource;
 w.enlRenderIncidentStats(d.getElementById('view'),w.currentUser(),{year:'2027'});
 assert.match(d.querySelector('.analysis-dashboard-cost').textContent,/5,000원.*대인미확인.*대물5,000원/s);
 assert.equal(d.querySelector('#stats426Year').value,'2027');
 assert.match(d.querySelector('.management-points > header').textContent,/2027년/);
 d.querySelector('[data-stats-month="2027-01"]').click();assert.match(d.querySelector('[data-month-drill]').textContent,/1건/);
 const yearControl=d.querySelector('#stats426Year');yearControl.value='2026';yearControl.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.match(d.querySelector('.management-points > header').textContent,/2026년/);
 assert.equal(d.querySelectorAll('.management-points').length,1);
 assert.match(d.querySelector('.analysis-dashboard-cost').textContent,/1,234원.*대인1,234원.*대물미확인/s);
 w.enlIncidentAnalysisRecords=savedSource;w.eval('renderShell(currentUser())');

 assert.ok(nav,'analysis tab '+role);assert.equal(nav.previousElementSibling?.dataset.lifecycleClosed,'1','analysis immediately after closed');const before=w.__fixtureCalls.length;nav.click();
 assert.ok(d.querySelector('.incident-analysis'),'analysis opens '+role);assert.equal(d.querySelectorAll('.analysis-kpis article').length,4);
 assert.ok(w.__fixtureCalls.slice(before).every(x=>x==='platform_analysis_target_get'),'analysis only reads shared goals once');assert.ok(w.__fixtureCalls.length-before<=1);
 assert.match(d.querySelector('.analysis-kpis').textContent,/전체 사고1건 등록/);
 const select=d.querySelector('[data-analysis-year]');select.value='2026';select.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(d.querySelectorAll('.strategy-month').length,12);
 w.eval('renderShell(currentUser())');assert.equal(d.querySelector('[data-analysis-year]').value,'2026','filter survives shell refresh');
 d.querySelector('[data-analysis-refresh]').click();await until(()=>!d.querySelector('[data-analysis-refresh]').disabled,'refresh unlock');
 assert.ok(d.querySelector('.analysis-strategy'));
 assert.match(d.querySelector('.strategy-rates').textContent,/산출 자료 부족/);
 assert.ok(d.querySelector('#strategy-plan'));assert.ok(d.querySelector('#strategy-focus'));
 assert.equal(d.querySelectorAll('.strategy-overview > .analysis-card').length,2,'two compact decision panels');
 assert.equal(d.querySelector('.strategy-support').open,false,'secondary records start collapsed');
 assert.ok(d.querySelectorAll('#strategy-plan > details').length<=3,'at most three focus/action rows');
 assert.equal(d.querySelectorAll('.strategy-sections,.strategy-roadmap,.strategy-plan-cards').length,0,'duplicated sections removed');
 const disclosure=d.querySelector('#strategy-plan > details');if(disclosure){assert.equal(disclosure.open,false);disclosure.querySelector('summary').click();assert.equal(disclosure.open,true,'action and evidence expand');}
 d.querySelector('.strategy-support > summary').click();assert.equal(d.querySelector('.strategy-support').open,true,'supporting data remains accessible');
 assert.equal(d.querySelectorAll('[data-sd450-map]').length,0,'strategy is separate from current dashboard map');
 const analysisReport=d.querySelector('[data-analysis-incident]');assert.ok(analysisReport,'analysis links its evidence');analysisReport.click();
 await until(()=>d.querySelector('#modalRoot [data-incident-view]'),'strategy report opens');
 assert.equal(!!d.querySelector('#modalRoot #editInc'),role==='safety','strategy preserves report editing roles');w.closeModal();
 const currentYear=new Date().getUTCFullYear();
 w.enlIncidentAnalysisRecords=()=>[{id:'strategy-previous',status:'closed',category:'property',siteId:'qa-site',eventType:'<img src=x onerror=alert(1)>',occurredAt:(currentYear-1)+'-01-01',reportDetails:{repairCost:2000}},{id:'strategy-now',status:'reported',category:'person',siteId:'qa-site',eventType:'넘어짐',summary:'<script>alert(1)</script>',occurredAt:currentYear+'-01-01',reportDetails:{medicalCost:1000}}];
 w.ENLIncidentAnalysis.render(d.getElementById('view'),w.currentUser(),{year:String(currentYear),site:''});
 assert.match(d.querySelector('.analysis-strategy').textContent,/전년도 사고목록 1건/);
 assert.equal(d.querySelectorAll('.analysis-strategy img,.analysis-strategy script').length,0,'report evidence is escaped');
 assert.equal(d.querySelectorAll('.strategy-month').length,12);
 w.enlIncidentAnalysisRecords=savedSource;w.eval('renderShell(currentUser())');
 // Saved source cannot be changed through the analysis snapshot.
 const snapshot=w.enlIncidentAnalysisRecords();snapshot[0].eventType='modified';assert.notEqual(w.enlIncidentAnalysisRecords()[0].eventType,'modified');
 }
 if(role==='safety'){
   const originalFetch=w.fetch;let failUpload=false;
   w.fetch=async(input,init)=>{
     if(String(input).includes('/enl-attachment-v411')){const request=JSON.parse(init.body);if(request.action==='upload'){await new Promise(r=>setTimeout(r,80));if(failUpload)throw Error('simulated timeout');return new Response(JSON.stringify({ok:true,attachment:{path:'qa/isolated.pdf',name:'test.pdf',mime:'application/pdf'}}));}return new Response(JSON.stringify({ok:true,urls:{}}));}
     return originalFetch(input,init);
   };
   const form=d.createElement('form');form.id='qa-upload';form.innerHTML='<button type="submit">저장</button>';d.body.append(form);
   let upload=w.eval("addFiles([], [{name:'test.pdf',type:'application/pdf',size:4,arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer}], 'incident', {form:document.getElementById('qa-upload')})");
   assert.equal(w.ENLProcessing.active(),true);assert.equal(form.querySelector('button').disabled,true);
   assert.equal((await upload).length,1);assert.equal(w.ENLProcessing.active(),false);assert.equal(form.querySelector('button').disabled,false);
   failUpload=true;upload=w.eval("addFiles([], [{name:'test.pdf',type:'application/pdf',size:4,arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer}], 'incident', {form:document.getElementById('qa-upload')})");
   assert.equal((await upload).length,0);assert.equal(w.ENLProcessing.active(),false);assert.equal(form.querySelector('button').disabled,false);assert.equal(d.querySelector('.enl-processing'),null);
   form.remove();w.fetch=originalFetch;
 }
 function checkMobileManagement(panel){
   assert.equal(panel.querySelectorAll('[data-mobile-folder-action]').length,role==='safety'?3:0,'mobile folder edit permission');
   if(role==='safety'){
     const mobile=panel.querySelector('.org-mobile-management');mobile.open=true;
     const create=mobile.querySelector('[data-mobile-folder-action="create"]');create.click();
     assert.ok(mobile.querySelector('form.org-manage'),'mobile folder form remains outside hidden rail');
     [...mobile.querySelectorAll('form button')].find(b=>b.textContent==='취소').click();
     assert.equal(mobile.querySelector('form'),null,'cancel closes form without saving');
   }
 }
 const frame=d.querySelector('.app-shell').enlWorkspaceFrame;
 await until(()=>d.querySelector('[data-hub="feature:organization"]'),'organization menu');
 const calls=w.__fixtureCalls.filter(x=>x==='platform_enter').length;
 await frame.activateWorkTab('organization');
 await until(()=>d.querySelector('.org-site-card'),'organization folders');
 assert.match(d.querySelector('.org-main').textContent,/검수 골프장/);
 d.querySelector('.org-site-card').click();assert.equal(d.querySelectorAll('.org-document-card').length,3);
 await frame.activateWorkTab('risk');await until(()=>d.querySelector('.risk-panel .org-site-card'),'risk folders');
 d.querySelector('.risk-panel .org-site-card').click();assert.equal(d.querySelectorAll('.risk-panel .org-document-card').length,2);
 d.querySelector('.risk-panel .org-document-card').click();await until(()=>d.querySelector('.risk-panel [data-risk-template]'),'risk templates');assert.equal(d.querySelectorAll('.risk-panel [data-risk-template]').length,5);
 w.dispatchEvent(new w.Event('focus'));assert.equal(d.querySelectorAll('.risk-panel [data-risk-template]').length,5,'focus preserves selected evaluation type');
 assert.equal(w.__fixtureCalls.filter(x=>x==='platform_enter').length,calls,'document entry uses its authorized list endpoint only');
 assert.equal(d.querySelectorAll('.risk-panel [data-folder-action]').length,role==='safety'?3:0,'folder edit permission');
 checkMobileManagement(d.querySelector('.risk-panel'));
 await frame.activateWorkTab('organization');await until(()=>d.querySelector('.org-panel:not(.risk-panel) .org-site-card'),'return to organization');
 assert.equal(d.querySelectorAll('.org-panel:not(.risk-panel) [data-folder-action]').length,role==='safety'?3:0);
 checkMobileManagement(d.querySelector('.org-panel:not(.risk-panel)'));
 assert.deepEqual(errors,[],'no script errors '+role);console.log('PASS DOM '+role+': cost ratios/sorting/unknowns, inline month and report links, map ranking/select/outside-reset, roles and existing navigation');
 }finally{w.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
