'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('platform-dashboard.js','utf8');
(async()=>{
 for(const role of ['field','safety']){
  const dom=new JSDOM('<main></main>',{url:'https://isolated.test',runScripts:'outside-only'}),w=dom.window;
  const host=w.document.querySelector('main'),calls=[],u={id:'qa-field',role,position:'현장소장',siteId:'qa-site'};
  Object.assign(w,{u,admin:role==='safety',host,loaded:true,busy:false,data:{sites:[{id:'qa-site',name:'검수 사업장'}]},content:{publicationSites:[{site_id:'qa-site',site_name:'검수 사업장'}]},safe:x=>String(x??''),sameUser:()=>true,api:async b=>calls.push(b),refreshContentList:async()=>{},boardNodes:()=>[{tag:'p',children:[{text:'요청 내용'}]}],boardEditor:()=>({editor:{innerText:'요청 내용'},applySource(){},filesForSave:()=>[]}),dialog:()=>{const d=w.document.createElement('dialog');d.open=true;d.innerHTML='<div class="hub-dialog-body"></div>';d.close=()=>{d.open=false};host.append(d);return d}});
  w.eval('var status=document.createElement("p");'+source.slice(source.indexOf('  const boards={'),source.indexOf('  const sidebarBuiltins='))+"\nconst boardKey=kind=>Object.keys(boards).find(key=>boards[key].kind===kind);"+source.slice(source.indexOf('  async function editContent('),source.indexOf('  async function deleteBoardPost('))+'\nwindow.testEdit=editContent;');
  await w.testEdit({kind:'request'});const form=host.querySelector('form');assert.ok(form);assert.equal(form.elements.requestSite.disabled,role==='field');assert.equal(form.elements.shareSite,undefined);assert.equal(form.elements.pinned,undefined);
  form.elements.title.value='개선 요청';form.elements.requestSite.value='qa-site';await form.onsubmit({preventDefault(){}});
  assert.equal(calls.length,1);assert.equal(calls[0].kind,'request');assert.equal(calls[0].siteId,'qa-site');assert.deepEqual(JSON.parse(JSON.stringify(calls[0].publication)),{pinned:false,sites:['qa-site'],expiresAt:null});dom.window.close();
 }
 const dom=new JSDOM('<div class="app-shell"><main id="view"></main></div>',{runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{data:{incidents:[]},esc:x=>String(x??''),currentUser:()=>({role:'field',position:'현장소장',siteId:'qa-site'}),siteById:()=>({name:'검수 사업장'})});
 w.eval(fs.readFileSync('field-ui-v411.js','utf8'));const root=w.document.querySelector('main'),shell=w.document.querySelector('.app-shell');let target=null;
 shell.enlWorkspaceFrame={activateWorkTab:key=>target=key};w.enlRenderFieldHome(root,w.currentUser());root.querySelector('[data-field-platform-back]').click();assert.equal(target,'home');assert.equal(root.querySelectorAll('[data-field-task]').length,3);
 delete shell.enlWorkspaceFrame;let fallback=false;w.enlReturnToPlatform=()=>fallback=true;root.querySelector('[data-field-platform-back]').click();assert.equal(fallback,true);dom.window.close();
 assert.ok(!source.includes("title:'전체 게시글'"));assert.ok(source.includes("if(key==='boards')return selectTab('bulletins')"));
 console.log('PASS field/safety request editor submit, fixed site scope, minimal settings, field incident back navigation and notice default');
})().catch(e=>{console.error(e);process.exitCode=1});
