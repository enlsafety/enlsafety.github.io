'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');

const {tab,cases,noOverflow}=require('./field-entry-table-browser.cjs');
const capture=process.env.UI_CAPTURE_DIR;

async function image(p,name,selector){
  if(!capture)return;
  fs.mkdirSync(capture,{recursive:true});
  await p.evaluate(()=>document.fonts.ready);
  if(selector)await p.locator(selector).first().screenshot({path:path.join(capture,name+'.png')});
  else await p.screenshot({path:path.join(capture,name+'.png')});
}
async function check(engine,width,name){
 const browser=await engine.launch(engine===chromium&&process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});
 try{
 const base={...cases[0]};
 const dataset=[...cases,
 {...base,id:'supplement',status:'supplement'},
 {...base,id:'rejected',status:'rejected'},
 {...base,id:'pending',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'parallel'}},
 {...base,id:'closed',status:'closed',corrective:{status:'approved'}},
 {...base,id:'history',status:'closed',historicalImport:{enabled:true,erpApproved:true,workflowExempt:true,transferState:'closed'}}];
 const {p,c}=await tab(browser,width,'field',dataset),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.waitForFunction(()=>typeof window.enlFieldActionRecordCount==='function'&&data.incidents.some(i=>i.id==='history'));
 await p.locator('[data-field-task="records"] .field-six-total').waitFor();
 assert.equal(await p.locator('[data-field-task="records"] .field-six-total').innerText(),'7건','total appears on initial home after data sync');
 for(const position of ['현장소장','파트장','서무']){
 await p.evaluate(position=>{const u=currentUser();u.position=position;enlFieldHome(u)},position);
 const homeCount=async task=>Number((await p.locator(`[data-field-task="${task}"] .field-six-total`).innerText()).replace(/[^0-9]/g,''));
 assert.equal(await homeCount('records'),7,'all stages, same site');
 assert.equal(await homeCount('accident_action'),3,'accepted list, historical transfer excluded');
 await noOverflow(p);if(position==='현장소장')await image(p,name+'-home','.field-six-home');
 await p.locator('[data-field-task="records"]').click();
 await p.locator('[data-field-open]').first().waitFor();
 assert.equal(await p.locator('.field411-status-summary,.field411-status-tile').count(),0,'removed status menu');
 assert.equal(await p.locator('[data-field-open]').count(),7);
 assert.equal(await p.locator('[data-field-open="sample-3"]').count(),0);
 await noOverflow(p);if(position==='현장소장')await image(p,name+'-records','.field411-screen');
 await p.locator('[data-field-back]').click();
 await p.locator('[data-field-task="accident_action"]').click();
 await p.locator('.prev429-list').waitFor();assert.equal(await p.locator('[data-prev-card]').count(),3);
 await p.locator('[data-field-back]').click();
 }
 await p.evaluate(()=>{data.incidents=[];window.dispatchEvent(new CustomEvent('enl-incidents-pulled'))});
 assert.equal(await p.locator('[data-field-task="records"] .field-six-total').innerText(),'0건');
 assert.equal(await p.locator('[data-field-task="accident_action"] .field-six-total').innerText(),'0건');
 await p.evaluate(()=>{data.incidents=Array.from({length:1234},(_,i)=>({id:'large-'+i,siteId:'s01',status:'approved'}));window.dispatchEvent(new CustomEvent('enl-incident-saved'))});
 assert.equal(await p.locator('[data-field-task="records"] .field-six-total').innerText(),'1,234건');await noOverflow(p);
 const over=await p.locator('.field-six-btn').evaluateAll(xs=>xs.some(el=>el.scrollWidth>el.clientWidth+1));assert.equal(over,false,'large totals fit');
 assert.deepEqual(errors,[]);await c.close();console.log('PASS',name,width,'three manager positions, totals/list parity, no status menu, navigation, empty and large counts');
 }finally{await browser.close()}
}
(async()=>{await check(chromium,1365,'desktop');await check(chromium,320,'small-mobile');await check(chromium,390,'mobile');await check(chromium,820,'tablet');if(!process.env.UI_CHROMIUM_ONLY)await check(webkit,390,'iphone-webkit');})().catch(e=>{console.error(e);process.exitCode=1});
