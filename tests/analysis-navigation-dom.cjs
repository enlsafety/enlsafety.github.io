/* Offline DOM integration. Does not claim browser layout or device verification. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {TextEncoder,TextDecoder}=require('node:util');
const base=process.cwd();
const until=async(test,note)=>{for(let n=0;n<500;n++){if(test())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+note)};
function loadScript(file){
 let source=fs.readFileSync(file,'utf8');if(file!=='tests/integrated-home-fixture.js')return source;
 source=source.replaceAll("['incident','history','notices','system'].includes(key)","['incident','organization','risk','history','notices','system'].includes(key)");
 return source.replace("if(b.action==='platform_catalog')", "if(b.action==='platform_org_list'||b.action==='platform_risk_list'){await new Promise(r=>setTimeout(r,60));out={ok:true,period:'2026-2',sites:[{site_id:'qa-site',site_name:'검수 골프장',folder_name:'검수 골프장',folder_revision:1,state:'draft',active:true}],candidates:[]};}\n  if(b.action==='platform_catalog')");
}
(async()=>{
 for(const role of ['safety','manager','executive','field']){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented:|Could not load (img|link)/.test(e.message))errors.push(e.message)});
 let source=fs.readFileSync('stable412.html','utf8').replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
 source=source.replace(/<script src="([^"]+)"><\/script>/g,(_,url)=>'<script>'+loadScript(url.split('?')[0]).replace(/<\/script/gi,'<\\/script')+'</script>').replace(/<link[^>]*>/g,'');
 const dom=new JSDOM(source,{url:'https://isolated.test/stable412.html?role='+role,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
 beforeParse(w){w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;w.Response=Response;w.Request=Request;w.Headers=Headers;w.AbortController=AbortController;w.fetch=async()=>new Response('{}');w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.confirm=()=>true;w.alert=()=>{};w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};}});
 const w=dom.window,d=w.document;
 try{
 await until(()=>w.ENLIncidentAnalysis&&d.querySelector('.app-shell'),'shell '+role);
 await until(()=>w.enlIncidentServerReady?.(),'incident server ready');
 // Use the existing shell route with an actor from the isolated fixture.
 w.eval("currentView='stats';renderShell(currentUser());");
 const nav=d.querySelector('[data-shell-view="analysis"]');
 if(role==='field'){
 assert.equal(nav,null);w.eval("currentView='analysis';renderShell(currentUser());");assert.equal(d.querySelector('.incident-analysis'),null);assert.equal(w.enlIncidentAnalysisRecords().length,0);
 }else{
 await until(()=>d.querySelector('[data-sd450-map]'),'dashboard map');
 assert.equal(d.querySelectorAll('.stats426-cards .stats426-card').length,4);
 assert.match(d.querySelector('[data-stats-filter="all"] b').textContent,/1건/);
 assert.match(d.querySelector('.analysis-dashboard-cost').textContent,/대인.*대물/s);
 assert.equal(d.querySelectorAll('[data-sd450-map]').length,1);
 assert.ok(d.querySelector('.incident-overview > .stats426-cards'));
 assert.ok(d.querySelector('.incident-overview > [data-sd450-map]'));
 for(const title of ['월별 사고 발생','사고유형별 분포','사업장별 사고 건수','우선 확인할 작업','업무별 발생 현황','추가 확인이 필요한 정보'])assert.equal([...d.querySelectorAll('.stats426 h3')].filter(h=>h.textContent===title).length,1,title+' appears once');
 assert.equal(d.querySelector('.stats426-donut'),null);
 const selected=d.querySelector('#stats426Year').value;
 d.querySelector('[data-stats-filter="all"]').click();assert.match(d.querySelector('#stats426Drill').textContent,/1건/);
 d.querySelector('[data-stats-close]').click();assert.equal(d.querySelector('#stats426Drill').textContent,'');
 const occurred=w.ENLIncidentAnalysis.dateKey(w.enlIncidentAnalysisRecords()[0]).slice(0,7);
 d.querySelector('[data-stats-month="'+occurred+'"]').click();assert.match(d.querySelector('#stats426Drill').textContent,/1건/);
 w.eval('renderShell(currentUser())');assert.equal(d.querySelector('#stats426Year').value,selected);
 const savedSource=w.enlIncidentAnalysisRecords;
 const fixtureSource=[{id:'compare-26',status:'reported',category:'person',siteId:'qa-site',occurredAt:'2026-12-31',reportDetails:{medicalCost:1234}},{id:'compare-27',status:'closed',category:'property',siteId:'qa-site',occurredAt:'2026-12-31T16:00:00Z',reportDetails:{repairCost:5000}}];
 w.enlIncidentAnalysisRecords=()=>fixtureSource;
 w.enlRenderIncidentStats(d.getElementById('view'),w.currentUser(),{year:'2027'});
 assert.match(d.querySelector('.analysis-dashboard-cost').textContent,/5,000원.*대인미확인.*대물5,000원/s);
 assert.equal(d.querySelector('#stats426Year').value,'2027');
 d.querySelector('[data-stats-month="2027-01"]').click();assert.match(d.querySelector('#stats426Drill').textContent,/1건/);
 const yearControl=d.querySelector('#stats426Year');yearControl.value='2026';yearControl.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.match(d.querySelector('.analysis-dashboard-cost').textContent,/1,234원.*대인1,234원.*대물미확인/s);
 w.enlIncidentAnalysisRecords=savedSource;w.eval('renderShell(currentUser())');

 assert.ok(nav,'analysis tab '+role);const before=w.__fixtureCalls.length;nav.click();
 assert.ok(d.querySelector('.incident-analysis'),'analysis opens '+role);assert.equal(d.querySelectorAll('.analysis-kpis article').length,4);
 assert.equal(w.__fixtureCalls.length,before,'opening analysis does not add network calls');
 assert.match(d.querySelector('.analysis-kpis').textContent,/전체 사고1건/);
 const select=d.querySelector('[data-analysis-year]');select.value='2026';select.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(d.querySelectorAll('.analysis-month').length,12);
 w.eval('renderShell(currentUser())');assert.equal(d.querySelector('[data-analysis-year]').value,'2026','filter survives shell refresh');
 d.querySelector('[data-analysis-refresh]').click();await until(()=>!d.querySelector('[data-analysis-refresh]').disabled,'refresh unlock');
 assert.ok(d.querySelector('.incident-analysis'));
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
 const frame=d.querySelector('.app-shell').enlWorkspaceFrame;
 await until(()=>d.querySelector('[data-hub="feature:organization"]'),'organization menu');
 const calls=w.__fixtureCalls.filter(x=>x==='platform_enter').length;
 await frame.activateWorkTab('organization');
 await until(()=>d.querySelector('.org-site-card'),'organization folders');
 assert.match(d.querySelector('.org-main').textContent,/검수 골프장/);
 d.querySelector('.org-site-card').click();assert.equal(d.querySelectorAll('.org-document-card').length,3);
 await frame.activateWorkTab('risk');await until(()=>d.querySelector('.risk-panel .org-site-card'),'risk folders');
 d.querySelector('.risk-panel .org-site-card').click();assert.equal(d.querySelectorAll('.risk-panel .org-document-card').length,1);
 d.querySelector('.risk-panel .org-document-card').click();assert.match(d.querySelector('.risk-panel .org-main').textContent,/세부 입력 화면은 아직 준비 중/);
 w.dispatchEvent(new w.Event('focus'));assert.match(d.querySelector('.risk-panel .org-main').textContent,/세부 입력 화면은 아직 준비 중/,'focus preserves selected document');
 assert.equal(w.__fixtureCalls.filter(x=>x==='platform_enter').length,calls,'document entry uses its authorized list endpoint only');
 assert.equal(d.querySelectorAll('.risk-panel [data-folder-action]').length,role==='safety'?3:0,'folder edit permission');
 await frame.activateWorkTab('organization');await until(()=>d.querySelector('.org-panel:not(.risk-panel) .org-site-card'),'return to organization');
 assert.equal(d.querySelectorAll('.org-panel:not(.risk-panel) [data-folder-action]').length,role==='safety'?3:0);
 assert.deepEqual(errors,[],'no script errors '+role);console.log('PASS DOM '+role+': route, role gate, filters, refresh, immutable source, document navigation and reduced requests');
 }finally{w.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
