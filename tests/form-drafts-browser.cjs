/* Cross-context server drafts. Run in browser CI; no production records or accounts. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright'),{Server}=require('./fixtures/account-draft-server.cjs');
async function run(engine){
 const browser=await engine.launch(),server=new Server(),contexts=[];
 try{
  async function client(width){
   const c=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});contexts.push(c);
   await c.route('https://draft.test/**',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="view"></div>'}));
   const p=await c.newPage();await p.exposeFunction('draftApi',b=>server.call(b));await p.goto('https://draft.test/');
   await p.evaluate(()=>{
    window.user={id:'qa-field',personnelId:'qa-field',role:'field',siteId:'qa-site',name:'검수'};window.currentUser=()=>user;window.data={incidents:[]};window.uid=()=> 'inc-'+crypto.randomUUID();window.siteById=()=>({name:'검수'});window.incidentPhotos=[];window.actionPhotos=[];window.enlPersistAttachment=x=>x;window.renderPhotoThumbs=()=>{};window.enlIncidentApi=async b=>{try{return await draftApi(b)}catch(e){e.status=/draft_not_found/.test(e.message)?404:409;e.message=e.message.replace(/^.*?(draft_\w+).*$/,'$1');throw e}};
   });
   await p.addStyleTag({content:fs.readFileSync('safety-ui.css','utf8')});await p.addScriptTag({content:fs.readFileSync('form-drafts.js','utf8')});
   await p.evaluate(()=>{document.getElementById('view').innerHTML='<form id="unifiedReportForm"><label><span>사업장</span><select id="reportSite"><option value="qa-site">검수</option></select></label><label><span>사고 경위</span><textarea id="incidentHow410"></textarea></label><label><span>장소</span><input id="incidentPlace410"></label><div id="incidentThumbs"></div><button type="submit">제출</button></form>';window.ctl=ENLFormDrafts.bind(document.querySelector('form'),user,'person',null)});
   if(width<600)await p.locator('.draft-resume-dialog .primary').click();await p.locator('#incidentHow410').waitFor();await p.waitForFunction(()=>!document.getElementById('incidentHow410').disabled);return p;
  }
  const pc=await client(1440);await pc.locator('#incidentHow410').fill('PC 내용');assert.equal(await pc.evaluate(()=>ctl.flush()),true);
  const mobile=await client(390);assert.equal(await mobile.locator('#incidentHow410').inputValue(),'PC 내용');
  await mobile.evaluate(()=>{incidentPhotos=[{path:'incident/site-qa-site/qa-field/photo.jpg',name:'모바일 사진'}];ctl.capture()});await mobile.evaluate(()=>ctl.flush());
  await pc.locator('#incidentPlace410').fill('PC 장소');assert.equal(await pc.evaluate(()=>ctl.flush()),true);assert.equal(await pc.evaluate(()=>incidentPhotos.length),1);
  await mobile.evaluate(()=>ctl.check());await pc.locator('#incidentHow410').fill('PC 수정');await mobile.locator('#incidentHow410').fill('모바일 수정');await pc.evaluate(()=>ctl.flush());assert.equal(await mobile.evaluate(()=>ctl.flush()),false);
  await mobile.getByRole('button',{name:'변경 내용 비교'}).click();const dialog=mobile.locator('.draft-conflict-dialog');await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+2),true,'phone dialog has no horizontal overflow');assert.ok(await dialog.getByText('PC 수정',{exact:true}).count());assert.ok(await dialog.getByText('모바일 수정',{exact:true}).count());await dialog.locator('input[type=radio]').nth(1).check();await dialog.getByRole('button',{name:'선택한 내용으로 저장'}).click();await mobile.waitForFunction(()=>document.querySelector('.draft-save-status').textContent.startsWith('서버 저장 완료'));
  assert.equal([...server.rows.values()][0].content.values.incidentHow410,'모바일 수정');
  console.log('PASS '+engine.name()+' separate desktop/mobile contexts, shared draft/photos and mobile conflict dialog');
 }finally{await Promise.all(contexts.map(c=>c.close()));await browser.close()}
}
(async()=>{await run(chromium);await run(webkit)})().catch(e=>{console.error(e);process.exitCode=1});
