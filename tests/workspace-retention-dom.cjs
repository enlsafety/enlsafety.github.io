/* Isolated full-app regression: tab switches must preserve live editor objects. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {orgFixture}=require('./organization.cjs');
const until=async(fn,label)=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+label)};
(async()=>{
 const f=await orgFixture();
 try{
 for(const name of ['20261117000000_risk_assessment_folders','20261117000100_open_risk_assessment_module','20261117042933_risk_assessment_records'])await f.db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
 for(const role of ['safety','field','manager','executive']){
  let confirms=0,answer=true;const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented:|Could not load (img|link)/.test(e.message))errors.push(e.message)});
  let html=fs.readFileSync('stable412.html','utf8').replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
  html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,url)=>{
   const file=url.split('?')[0];let source=fs.readFileSync(file,'utf8');
   if(file==='tests/integrated-home-fixture.js')source=source.replaceAll("['incident','history','notices','system'].includes(key)","['incident','organization','risk','history','notices','system'].includes(key)");
   return '<script>'+source.replace(/<\/script/gi,'<\\/script')+'</script>';
  }).replace(/<link[^>]*>/g,'');
  const dom=new JSDOM(html,{url:'https://isolated.test/stable412.html?role='+role,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   Object.assign(w,{TextEncoder,TextDecoder,structuredClone,Response,Request,Headers,AbortController,fetch:async()=>new Response('{}'),scrollTo:(x,y)=>{w.scrollX=x;w.scrollY=y;},confirm:()=>{confirms++;return answer;},alert:()=>{}});
   w.ResizeObserver=class{observe(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};
  }});
  const w=dom.window,d=w.document;
  try{
   await until(()=>d.querySelector('[data-module=risk]'),'catalog');await until(()=>w.enlIncidentServerReady?.(),'data ready');
   const original=w.enlIncidentApi;
   w.enlIncidentApi=async body=>{
    if(/^platform_(risk|org)_/.test(body.action)){
     await new Promise(r=>setTimeout(r,30));const payload={...body};delete payload.actor;const r=await f.call(role,payload);if(r.status!==200)throw Error(r.body.message);return r.body;
    }if(['platform_notices','activity_list'].includes(body.action))await new Promise(r=>setTimeout(r,60));return original(body);
   };
   const frame=d.querySelector('.app-shell').enlWorkspaceFrame;
   await frame.activateWorkTab('risk');await frame.activateWorkTab('home');
   await until(()=>d.querySelector('.risk-panel [data-site-id="qa-site"]'),'background folder loading');await frame.activateWorkTab('risk');
   d.querySelector('.risk-panel [data-site-id="qa-site"]').click();d.querySelector('[data-risk-kind=initial]').click();
   await until(()=>d.querySelector('[data-risk-template=office]'),'books');d.querySelector('[data-risk-template=office]').click();
   await frame.activateWorkTab('home');await until(()=>d.querySelector('.risk-paper'),'background document loading');await frame.activateWorkTab('risk');
   const evaluator=d.querySelector('[data-risk-field=evaluator]'),paper=d.querySelector('.risk-paper-scroll'),improvements=d.querySelector('.risk-improvements');
   if(['field','safety'].includes(role)){evaluator.value='유지 '+role;evaluator.dispatchEvent(new w.Event('input',{bubbles:true}));}
   improvements.open=true;paper.scrollLeft=250;w.scrollTo(0,420);const before=confirms;
   await frame.activateWorkTab('organization');await until(()=>d.querySelector('.org-panel:not(.risk-panel) [data-site-id="qa-site"]'),'org folders');
   d.querySelector('.org-panel:not(.risk-panel) [data-site-id="qa-site"]').click();
   const orgCard=d.querySelector('.org-panel:not(.risk-panel) .org-document-card');
   await frame.activateWorkTab('risk');await new Promise(r=>setTimeout(r,50));
   assert.equal(d.querySelector('[data-risk-field=evaluator]'),evaluator,'same input and handlers');assert.equal(paper.scrollLeft,250);assert.equal(w.scrollY,420);assert.equal(improvements.open,true);assert.equal(confirms,before,'switch does not discard or ask');
   await frame.activateWorkTab('organization');assert.equal(d.querySelector('.org-panel:not(.risk-panel) .org-document-card'),orgCard);
   await frame.activateWorkTab('incident');
   const root=d.querySelector('#view'),probe=d.createElement('input');probe.dataset.worktabEdited='1';probe.value='unsaved incident';root.append(probe);
   w.eval("incidentPhotos=[{id:'local-photo',base64:'test'}]");
   await frame.activateWorkTab('home');await frame.activateWorkTab('incident');
   assert.equal(d.querySelector('#view'),root,'same native view root');assert.equal(root.lastElementChild,probe);assert.equal(probe.value,'unsaved incident');assert.equal(w.eval('incidentPhotos[0].id'),'local-photo');
   if(role==='safety'){
    await frame.activateWorkTab('system');await until(()=>d.querySelector('.system-admin'),'system');
    await frame.activateWorkTab('incident');assert.equal(d.querySelector('#view'),root,'restored across shell rebuild');
   }
   await frame.activateWorkTab('notices');await frame.activateWorkTab('home');
   await new Promise(r=>setTimeout(r,120));await frame.activateWorkTab('notices');
   assert.doesNotMatch(d.querySelector('#view').textContent,/불러오는 중/,'background notice response retained');
   await frame.activateWorkTab('recent');await frame.activateWorkTab('home');
   await new Promise(r=>setTimeout(r,120));await frame.activateWorkTab('recent');
   assert.doesNotMatch(d.querySelector('#view').textContent,/기록을 불러오는 중/,'background history response retained');
   await frame.activateWorkTab('bulletins');const search=d.querySelector('.hub-board-filter [name=query]');search.value='미검색 입력';
   await frame.activateWorkTab('home');await frame.activateWorkTab('bulletins');assert.equal(d.querySelector('.hub-board-filter [name=query]'),search);assert.equal(search.value,'미검색 입력');
   await frame.activateWorkTab('risk');assert.equal(d.querySelector('[data-risk-field=evaluator]'),evaluator);
   if(['field','safety'].includes(role)){
    answer=false;await frame.activateWorkTab('home');d.querySelector('[aria-label="위험성평가 탭 닫기"]').click();await new Promise(r=>setTimeout(r,30));assert.ok(d.querySelector('[data-worktab=risk]'),'inactive dirty close cancellation');
    answer=true;d.querySelector('[aria-label="위험성평가 탭 닫기"]').click();await until(()=>!d.querySelector('[data-worktab=risk]'),'close risk');
    await frame.activateWorkTab('risk');await until(()=>d.querySelector('.risk-panel .org-site-card'),'reopened risk');assert.equal(d.querySelector('.risk-editor'),null,'explicit close resets');
   }
   assert.deepEqual(errors,[]);d.querySelector('#logoutBtn').click();assert.equal(d.querySelector('.risk-editor'),null);assert.equal(d.querySelector('[data-worktab]'),null);
   console.log('PASS retained tabs '+role+': async loading, dirty input, sheet scroll, details, native root, photos, system shell, close and logout');
  }finally{w.close();}
 }
 }finally{await f.db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
