'use strict';
const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');const {TextEncoder,TextDecoder}=require('node:util');
const windows=[];
const until=async(fn,label)=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+label)};
const catalogPatch=`
const documentNames={organization:'01. 안전보건 조직',policy:'02. 경영방침 및 목표',training:'03. 교육관리',msds:'05. 물질안전보건자료',law:'06. 법령요지',voice:'07. 종사자 의견청취',risk:'08. 위험성평가',emergency:'09. 비상사태 대비 및 대응',ppe:'10. 보호구관리',ergonomics:'11. 근골격계 위험요인'};
config.documentMenus=Object.entries(documentNames).map(([key,displayName])=>({key,displayName}));
for(const m of config.modules)if(documentNames[m.key])m.displayName=documentNames[m.key];
`;
(async()=>{for(const role of ['safety','field','manager','executive']){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented:|Could not load (img|link)/.test(e.message))errors.push(e.message)});
 let html=fs.readFileSync('stable412.html','utf8').replace('<head>','<head><script src="tests/integrated-home-fixture.js"></script>');
 html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,url)=>{const file=url.split('?')[0];let code=fs.readFileSync(file,'utf8');if(file==='tests/integrated-home-fixture.js')code=code.replace(' const realFetch=',catalogPatch+' const realFetch=');return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';}).replace(/<link[^>]*>/g,'');
 const dom=new JSDOM(html,{url:'https://isolated.test/stable412.html?role='+role,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){Object.assign(w,{TextEncoder,TextDecoder,structuredClone,Response,Request,Headers,AbortController,fetch:async()=>new Response('{}'),scrollTo:()=>{},confirm:()=>true,alert:()=>{}});w.CSS={escape:value=>String(value).replace(/[^a-zA-Z0-9_-]/g,c=>String.fromCharCode(92)+c)};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};}});
 const w=dom.window,d=w.document;
 try{
  await until(()=>d.querySelector('.hub-document-menus'),'document group');const hub=d.querySelector('.platform-hub'),nav=d.querySelector('.hub-sidebar nav');
  assert.equal(d.querySelector('.hub-wordmark').getAttribute('aria-label'),'이앤엘 E&L');assert.match(d.querySelector('.hub-wordmark').textContent,/E&L/);
  assert.equal(d.querySelectorAll('.hub-document-menus [data-hub]').length,17);
  assert.ok([...nav.querySelectorAll('use')].every(n=>n.getAttribute('href').startsWith('assets/sidebar-outline-r188.svg#')));
  assert.equal(!!nav.querySelector('[data-hub="feature:system"]'),role==='safety');assert.equal(!!d.querySelector('.hub-sidebar-editor [data-edit]'),role==='safety');
  if(role==='safety'){
   await until(()=>d.querySelector('.hub-storage-amount')?.textContent.includes('MB'),'storage readout');
   const usage=d.querySelector('.hub-storage-usage');assert.ok(usage);assert.ok(usage.previousElementSibling.classList.contains('hub-inquiry'));assert.ok(usage.nextElementSibling.classList.contains('hub-sidebar-editor'));
   assert.equal(w.__fixtureCalls.filter(x=>x==='platform_storage_usage').length,1);
  }else{assert.equal(d.querySelector('.hub-storage-usage'),null);assert.equal(w.__fixtureCalls.filter(x=>x==='platform_storage_usage').length,0);}
  assert.equal(d.querySelector('.hub-training-menus').open,false,'education initially collapsed');
  const docIcons=[...d.querySelectorAll('.hub-document-menus use')].map(e=>e.getAttribute('href'));assert.equal(new Set(docIcons).size,docIcons.length,'distinct category pictograms');
  assert.equal(d.querySelectorAll('.hub-training-menus .hub-document-dot').length,0,'unimplemented education has no alerts');
  const education=d.querySelector('.hub-training-menus>summary');education.click();assert.equal(d.querySelector('.hub-training-menus').open,false);
  for(const b of d.querySelectorAll('.hub-training-menus button')){assert.ok(b.disabled);assert.match(b.textContent,/구현중/);}
  const incident=d.querySelector('.hub-document-menus [data-hub="feature:incident"]');
  hub.setDocumentApprovalState('incident',0,'',1);assert.equal(incident.querySelector('.is-approved')?.textContent,'✓');
  hub.setDocumentApprovalState('incident',0,'',0);assert.equal(incident.querySelector('.hub-document-dot'),null,'no false approval for zero documents');
  hub.setDocumentApprovalState('incident',1,'미승인',1);assert.ok(incident.querySelector('.hub-document-dot:not(.is-approved)'));
  hub.setDocumentApprovalState('policy',3,'미승인',3);assert.equal(nav.querySelector('[data-hub="feature:policy"] .hub-document-dot'),null,'unimplemented never gets alerts');
  assert.ok(nav.querySelector('[data-hub="feature:tbm"]').disabled);
  const keys=[...nav.querySelectorAll('[data-hub]')].map(n=>n.dataset.hub);
  let group=d.querySelector('.hub-document-menus');assert.equal(group.open,true);group.querySelector('summary').click();await until(()=>!group.open,'collapse');
  await hub.reloadCatalog();group=d.querySelector('.hub-document-menus');assert.equal(group.open,false,'collapse retained on catalog refresh');group.querySelector('summary').click();await until(()=>group.open,'expand');
  assert.deepEqual([...nav.querySelectorAll('[data-hub]')].map(n=>n.dataset.hub),keys,'collapse never drops menu entries');
  const disabled=nav.querySelector('[data-hub="feature:policy"]'),workspace=hub.dataset.workspace;assert.ok(disabled.disabled);disabled.click();assert.equal(hub.dataset.workspace,workspace,'disabled menu cannot navigate');
  d.querySelector('.hub-mobile-menu').click();assert.equal(hub.classList.contains('hub-menu-open'),true);d.querySelector('.hub-sidebar-backdrop').click();assert.equal(hub.classList.contains('hub-menu-open'),false);
  assert.ok(d.querySelector('.topbar .enl-system-mark'),'approved app icon retained');assert.ok(d.querySelector('.hub-inquiry'),'support retained');assert.deepEqual(errors,[]);
  console.log('PASS sidebar '+role+': menu identity, collapse/reopen, selected state, mobile drawer, admin controls and app branding');
 }catch(e){console.error(e);throw e;}finally{windows.push(w);}
}})().then(()=>{for(const w of windows)w.close();process.exit(0);}).catch(e=>{console.error(e);process.exit(1)});
