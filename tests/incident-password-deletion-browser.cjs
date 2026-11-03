'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const {tab,cases,noOverflow}=require('./field-entry-table-browser.cjs');
(async()=>{
 const browser=await chromium.launch(process.env.CHROME_EXE?{executablePath:process.env.CHROME_EXE}:{});let checks=0;
 try{
  for(const width of [320,390,820,1365]){
   const dataset=['draft','reported','supplement','supplement_submitted','rejected','approved','closed'].map((status,n)=>({...cases[0],id:'delete-'+n,status}));
   dataset.push({...dataset[5],id:'delete-parallel',corrective:{status:'approved'},executiveApproval:{state:'pending',stage:'parallel'}});
   dataset.push({...dataset[6],id:'delete-historical',historicalOrigin:{batchId:'qa',candidateId:'qa'},externalInitialApproval:{state:'verified'}});
   const {p,c}=await tab(browser,width,'safety',dataset),errors=[],requests=[];let outcome='wrong',deleted=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
   await c.route('**/enl-incident-compliance-v439',async route=>{const b=route.request().postDataJSON();requests.push(b);if(outcome==='wrong')return route.fulfill({status:403,json:{ok:false,message:'password_incorrect'}});deleted.push(b.incidentId);return route.fulfill({json:{ok:true,deleted:true,incidentId:b.incidentId}})});
   await p.waitForFunction(()=>typeof enlDeleteIncident==='function'&&data.incidents.length>0);
   await p.evaluate(()=>{currentUser().passwordHash='qa-hash';if(session.manager)session.manager.passwordHash='qa-hash';});
   for(const row of dataset){
    await p.evaluate(id=>openIncidentModal(id,true,currentUser()),row.id);
    await p.locator('[data-official-delete-id="'+row.id+'"]').waitFor();checks++;
    await p.locator('[data-close]').first().click();
   }
   await p.evaluate(()=>openIncidentModal('delete-1',true,currentUser()));await p.locator('[data-official-delete-id="delete-1"]').click();
   await p.locator('#official439DeleteForm').waitFor();
   assert.equal(await p.locator('[data-official-delete-id]').count(),0,'password dialog never redecorated');checks++;
   await p.locator('#official439DeleteForm [type="submit"]').click();assert.equal(requests.length,0,'empty form blocked');checks++;
   await p.locator('#official439DeleteReason').fill('격리 UI 검증');await p.locator('#official439DeletePassword').fill('wrong');
   await p.locator('#official439DeleteForm [type="submit"]').click();await p.getByText('비밀번호가 일치하지 않습니다. 다시 입력해 주세요.').waitFor();
   assert.equal(await p.locator('#official439DeletePassword').inputValue(),'');assert.equal(await p.evaluate(()=>data.incidents.some(i=>i.id==='delete-1')),true);checks+=2;
   await noOverflow(p);checks++;
   assert.equal(await p.locator('.wf440-safety-actions,[data-wf440-cause-save],[data-executive-summary]').count(),0,'deletion dialog contains no stale report approval actions');checks++;
   assert.equal(await p.locator('#official439DeleteForm').innerText().then(t=>t.includes('삭제 사유')),true);checks++;
   const rect=await p.locator('#official439DeleteForm').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);checks++;
   if(process.env.UI_CAPTURE_DIR){fs.mkdirSync(process.env.UI_CAPTURE_DIR,{recursive:true});await p.screenshot({path:process.env.UI_CAPTURE_DIR+'/delete-'+width+'.png'});}
   outcome='ok';await p.locator('#official439DeletePassword').fill('fresh-password');await p.locator('#official439DeleteForm [type="submit"]').click();
   await p.waitForFunction(()=>!data.incidents.some(i=>i.id==='delete-1'));assert.equal(requests.at(-1).password,'fresh-password');assert.equal(requests.at(-1).expectedVersion,1);assert.equal(requests.at(-1).reason,'격리 UI 검증');checks+=3;
   assert.equal(await p.evaluate(()=>Object.values(localStorage).some(x=>x.includes('fresh-password'))),false);checks++;
   await p.evaluate(()=>openModal('<div class="modal-head"><h2>관계없는 창</h2></div><div class="modal-actions"></div>'));await p.waitForTimeout(120);assert.equal(await p.locator('[data-official-delete-id]').count(),0);checks++;
   assert.deepEqual(errors,[]);await c.close();
  }
  for(const role of ['field','manager','executive']){const {p,c}=await tab(browser,390,role);await p.waitForFunction(()=>typeof enlDeleteIncident==='function'&&data.incidents.length>0);await p.evaluate(()=>openIncidentModal('sample-1',true,currentUser()));await p.waitForTimeout(150);assert.equal(await p.locator('[data-official-delete-id]').count(),0);await p.evaluate(()=>enlDeleteIncident(data.incidents[0]));assert.equal(await p.locator('#official439DeleteForm').count(),0);checks+=2;await c.close();}
  console.log(JSON.stringify({passed:checks,failed:0,widths:[320,390,820,1365],engine:'Chromium',productionRequests:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
