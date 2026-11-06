'use strict';
// Every network request is fulfilled locally. No production writes or messages.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const {tab,noOverflow}=require('./field-entry-table-browser.cjs');
const pdf={name:'evidence.pdf',type:'application/pdf',text:'%PDF-1.4\n%%EOF'};
async function drag(p,selector,files=[pdf],type='drop'){
 return p.evaluate(({selector,files,type})=>{
  const dt=new DataTransfer();for(const f of files)dt.items.add(new File([f.text||'test'],f.name,{type:f.type||''}));
  const event=new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt});
  document.querySelector(selector).dispatchEvent(event);return event.defaultPrevented;
 },{selector,files,type});
}
async function run(engine,width){
 const b=await engine.launch(engine===chromium?{executablePath:process.env.CHROME_EXE||'/usr/bin/chromium',args:['--no-sandbox']}:{});
 try{
  const {p,c}=await tab(b,width,'field'),uploads=[],dialogs=[],errors=[];
  p.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});p.on('pageerror',e=>errors.push(e.message));
  let release=null,hold=false,fail=false;
  const followup={id:'followup-test',title:'검수용 후속조치',status:'in_progress',siteId:'s01',dueDate:'2026-12-01',priority:'normal',requestedAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z',fieldAction:{},version:1};
  await c.route('**/functions/v1/enl-historical-followup',async route=>{
   const body=route.request().postDataJSON();
   if(body.action==='list')return route.fulfill({json:{ok:true,rows:[followup]}});
   if(body.action==='upload'){
    uploads.push(body);if(hold)await new Promise(r=>release=r);
    return route.fulfill({json:{ok:true,attachment:{path:'historical/'+body.file.name,name:body.file.name,mime:body.file.mime}}});
   }
   if(body.action==='save')followup.fieldAction=body.fieldAction;
   return route.fulfill({json:{ok:true}});
  });
  await c.route('**/functions/v1/enl-attachment-v411',async route=>{
   const body=route.request().postDataJSON();
   if(body.action==='sign')return route.fulfill({json:{ok:true,urls:{}}});
   uploads.push(body);if(hold)await new Promise(r=>release=r);
   if(fail){fail=false;return route.fulfill({status:400,json:{ok:false}})}
   return route.fulfill({json:{ok:true,attachment:{path:body.scope+'/'+body.file.name,name:body.file.name,mime:body.file.mime,kind:body.file.mime==='application/pdf'?'pdf':'file',size:body.file.size}}});
  });
  await p.waitForFunction(()=>typeof enlOpenIncidentReport==='function');
  for(const category of ['person','property']){
   await p.evaluate(category=>enlOpenIncidentReport(category,currentUser()),category);
   const zone='[data-attachment-input="incidentPhotoInput"]';await p.locator(zone).waitFor();
   assert.equal(await drag(p,zone,[pdf],'dragover'),true);
   assert.equal(await p.locator(zone).evaluate(el=>el.classList.contains('attachment-drop-active')),true);
   await drag(p,zone,[{...pdf,name:category+'.pdf'},{name:category+'.xlsx',type:'',text:'fixture'}]);
   await p.waitForFunction(()=>incidentPhotos.length===2);
   assert.equal(await p.locator('#incidentPhotoCount').innerText(),'2 / 8개');
   assert.equal(await p.locator(zone+'.attachment-drop-active').count(),0);
   const count=uploads.length;assert.equal(await drag(p,'body'),true);assert.equal(uploads.length,count);
   await drag(p,zone,[{name:'script.exe',type:'application/octet-stream'}]);assert.equal(uploads.length,count);
   await p.locator('#incidentThumbs [data-rm]').first().click();assert.equal(await p.evaluate(()=>incidentPhotos.length),1);
   await p.locator('#incidentPhotoInput').setInputFiles({name:'picker.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.text)});
   await p.waitForFunction(()=>incidentPhotos.length===2);await noOverflow(p);
   if(process.env.UI_CAPTURE_DIR){fs.mkdirSync(process.env.UI_CAPTURE_DIR,{recursive:true});await p.locator(zone).screenshot({path:process.env.UI_CAPTURE_DIR+'/'+engine.name()+'-'+width+'-'+category+'.png'})}
  }
  const zone='[data-attachment-input="incidentPhotoInput"]';hold=true;release=null;
  await drag(p,zone,[{...pdf,name:'slow.pdf'}]);await p.waitForFunction(()=>document.querySelector('#unifiedReportForm').getAttribute('aria-busy')==='true');
  await drag(p,zone,[{...pdf,name:'blocked.pdf'}]);
  assert.equal(await p.evaluate(()=>document.getElementById('incidentPhotoInput').files[0].name),'slow.pdf');
  await p.waitForFunction(()=>document.querySelector('#unifiedReportForm button[type="submit"]').disabled);
  while(!release)await new Promise(r=>setTimeout(r,10));hold=false;release();
  await p.waitForFunction(()=>incidentPhotos.length===3);assert.ok(!uploads.some(u=>u.file.name==='blocked.pdf'));
  fail=true;await drag(p,zone,[{...pdf,name:'retry.pdf'}]);await p.waitForFunction(()=>!document.querySelector('#unifiedReportForm').hasAttribute('aria-busy'));
  assert.equal(await p.evaluate(()=>incidentPhotos.length),3);
  await drag(p,zone,[{...pdf,name:'retry.pdf'}]);await p.waitForFunction(()=>incidentPhotos.length===4);
  await drag(p,zone,Array.from({length:6},(_,n)=>({...pdf,name:'limit-'+n+'.pdf'})));await p.waitForFunction(()=>incidentPhotos.length===8);
  const limitCount=uploads.length;await drag(p,zone,[{...pdf,name:'over-limit.pdf'}]);assert.equal(uploads.length,limitCount);
  await p.evaluate(()=>{const i=data.incidents.find(i=>i.id==='sample-1');i.status='supplement';i.supplement={requestedFields:[],attachments:[]};enlOpenIncidentSupplement(i,currentUser())});
  await p.locator('#wf440SupplementFile').waitFor();await drag(p,'[data-attachment-input="wf440SupplementFile"]');
  await p.waitForFunction(()=>document.querySelector('#wf440SupplementFiles').textContent.includes('evidence.pdf'));
  const before=uploads.length;await drag(p,'[data-attachment-input="wf440SupplementFile"]',[{name:'wrong.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}]);assert.equal(uploads.length,before);
  await p.evaluate(()=>{const i=data.incidents.find(i=>i.id==='sample-1');i.status='approved';i.corrective={status:'planned',planDetail:'검수 계획'};openUnifiedCorrectiveModal(i.id,currentUser())});
  await p.locator('#actionPhotoBtn').waitFor();await drag(p,'[data-attachment-input="actionPhotoInput"]');await p.waitForFunction(()=>actionPhotos.length===1);assert.equal(uploads.at(-1).scope,'action');await noOverflow(p);
  await p.evaluate(()=>enlOpenHistoricalFollowup('followup-test'));await p.locator('#hfField').waitFor();
  for(const name of ['beforeAttachments','afterAttachments','attachments']){
   await p.locator('#hfFiles-'+name).setInputFiles({name:'selected.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.text)});
   await drag(p,'[data-attachment-input="hfFiles-'+name+'"]',[{...pdf,name:'dropped.pdf'}]);
   assert.deepEqual(await p.locator('#hfFiles-'+name).evaluate(el=>[...el.files].map(f=>f.name)),['selected.pdf','dropped.pdf']);
  }
  await noOverflow(p);hold=true;release=null;await p.locator('[data-hf-save]').click();
  await p.waitForFunction(()=>document.querySelector('#hfField').getAttribute('aria-busy')==='true');
  await drag(p,'[data-attachment-input="hfFiles-afterAttachments"]',[{...pdf,name:'blocked.pdf'}]);
  assert.equal(await p.locator('#hfFiles-afterAttachments').evaluate(el=>el.files.length),2);
  while(!release)await new Promise(r=>setTimeout(r,10));hold=false;release();
  await p.waitForFunction(()=>!document.querySelector('#hfField')?.hasAttribute('aria-busy'));
  for(const name of ['beforeAttachments','afterAttachments','attachments'])assert.equal(followup.fieldAction[name].length,2);
  for(const message of ['허용되지 않는','처리와 저장','업로드에 실패','최대 8개'])assert.ok(dialogs.some(s=>s.includes(message)),message);
  assert.deepEqual(errors,[]);await c.close();console.log('PASS attachment drop',engine.name(),width,'report, supplement, action, follow-up, limits, busy, retry, picker, layout');
 }finally{await b.close()}
}
(async()=>{await run(chromium,1365);await run(chromium,390);if(process.env.UI_WEBKIT)await run(webkit,390)})().catch(e=>{console.error(e);process.exitCode=1});
