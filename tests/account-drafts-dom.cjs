'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const code=fs.readFileSync('form-drafts.js','utf8'),clone=v=>JSON.parse(JSON.stringify(v));
const wait=()=>new Promise(r=>setTimeout(r,25));
const {Server}=require('./fixtures/account-draft-server.cjs');
async function client(server,{id='qa-field',initial,local={},autoResume=true}={}){
 const dom=new JSDOM('<div id="view"><p>목록</p></div>',{url:'https://enlsafety.github.io',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.requestAnimationFrame=cb=>w.setTimeout(()=>cb(Date.now()),8);let user={id,personnelId:id,role:'field',siteId:'qa-site',name:'검수'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.crypto.randomUUID=()=>crypto.randomUUID();Object.defineProperty(w.crypto,'subtle',{value:crypto.subtle});w.TextEncoder=TextEncoder;
 w.currentUser=()=>user;w.data={incidents:[]};w.uid=()=> 'inc-'+crypto.randomUUID();w.siteById=()=>({name:'검수 사업장'});w.incidentPhotos=[];w.actionPhotos=[];w.enlPersistAttachment=x=>clone(x);w.renderPhotoThumbs=()=>{};w.alert=()=>{};w.confirm=()=>true;
 w.enlIncidentApi=b=>server.call(b);for(const [k,v] of Object.entries(local))w.localStorage.setItem(k,JSON.stringify(v));
 w.eval(code);await wait();
 async function edit(){w.document.getElementById('view').innerHTML='<form id="unifiedReportForm"><label><span>사업장</span><select id="reportSite"><option value="qa-site">검수</option></select></label><label><span>사고 경위</span><textarea id="incidentHow410"></textarea></label><label><span>장소</span><input id="incidentPlace410"></label><div id="incidentThumbs"></div><button type="submit">제출</button></form>';
 const form=w.document.querySelector('form');const ctl=w.ENLFormDrafts.bind(form,user,'person',null);for(let n=0;n<8;n++){await wait();const resume=w.document.querySelector('.draft-resume-dialog .primary');if(autoResume&&resume)resume.click();if(!form.querySelector('textarea').disabled)break;}return {form,ctl};}
 const c={w,dom,edit,setUser:u=>user=u,close:()=>{w.requestAnimationFrame=()=>0;dom.window.close()}};return {...c,...await edit()};
}
function input(c,id,value){const el=c.w.document.getElementById(id);el.value=value;el.dispatchEvent(new c.w.Event('input',{bubbles:true}));}
(async()=>{const server=new Server(),clients=[];try{
 const pc=await client(server);clients.push(pc);input(pc,'incidentHow410','PC 사고 경위');assert.equal(await pc.ctl.flush(),true);let row=[...server.rows.values()][0];assert.equal(row.revision,1);assert.equal(pc.w.localStorage.length,0,'confirmed draft has no local duplicate');
 const mobile=await client(server);clients.push(mobile);assert.equal(mobile.w.document.getElementById('incidentHow410').value,'PC 사고 경위','second device resumes');assert.equal(mobile.form._draftIncidentId,pc.form._draftIncidentId);
 mobile.w.incidentPhotos=[{path:'incident/site-qa-site/qa-field/mobile.jpg',name:'현장사진'}];mobile.ctl.capture();assert.equal(await mobile.ctl.flush(),true);
 input(pc,'incidentPlace410','PC 장소');assert.equal(await pc.ctl.flush(),true,'nonoverlap automatically merges');row=[...server.rows.values()][0];assert.equal(row.content.files.length,1);assert.equal(row.content.values.incidentPlace410,'PC 장소');assert.equal(pc.w.incidentPhotos.length,1,'remote camera attachment retained');
 await mobile.ctl.check();input(pc,'incidentHow410','PC 변경');input(mobile,'incidentHow410','모바일 변경');await pc.ctl.flush();assert.equal(await mobile.ctl.flush(),false);assert.equal([...server.rows.values()][0].content.values.incidentHow410,'PC 변경','conflict never silently overwrites');
 assert.equal(mobile.form.querySelector('.draft-save-actions button:last-child').hidden,false);assert.equal(await mobile.ctl.prepare(),false,'conflict blocks submission');mobile.form.querySelector('.draft-save-actions button:last-child').click();await wait();let dialog=mobile.w.document.querySelector('.draft-conflict-dialog');assert.match(dialog.textContent,/PC 변경/);assert.match(dialog.textContent,/모바일 변경/);dialog.querySelectorAll('input[type=radio]')[1].checked=true;dialog.querySelector('button.primary').click();await wait();await mobile.ctl.flush();assert.equal([...server.rows.values()][0].content.values.incidentHow410,'모바일 변경');
 // Network failure keeps an outbox; retry uses exact mutation, even if response was lost.
 server.offline=true;input(mobile,'incidentPlace410','오프라인 내용');assert.equal(await mobile.ctl.flush(),false);assert.ok(mobile.w.localStorage.length>0);server.offline=false;server.lose=true;assert.equal(await mobile.ctl.flush(),false);const afterLost=[...server.rows.values()][0].revision;assert.equal(await mobile.ctl.flush(),true);assert.equal([...server.rows.values()][0].revision,afterLost);assert.equal(mobile.w.localStorage.length,0);
 // Preparation notices updates before a report is built and requires review once.
 input(mobile,'incidentPlace410','사진 촬영 장소');await mobile.ctl.flush();assert.equal(await pc.ctl.prepare(),false);assert.equal(pc.w.document.getElementById('incidentPlace410').value,'사진 촬영 장소');assert.ok(await pc.ctl.prepare());
 // A terminal draft cannot be saved/submitted by a stale device.
 row=[...server.rows.values()][0];row.state='submitted';row.content={};row.revision++;input(pc,'incidentHow410','늦은 수정');assert.equal(await pc.ctl.flush(),false);assert.equal(await pc.ctl.prepare(),false);assert.ok(pc.w.localStorage.length>0,'late changes remain recoverable');
 const stranger=await client(server,{id:'another'});clients.push(stranger);assert.equal(stranger.w.document.getElementById('incidentHow410').value,'');
 // Legacy local drafts move only after server acknowledgement.
 const legacyKey='enl-form-draft-v1/field/legacy/qa-site/person/new//old';const legacyClient=await client(server,{id:'legacy',local:{[legacyKey]:{time:Date.now(),kind:'person',reportId:'inc-legacy',version:'',id:'',revision:'oldrevision',values:{reportSite:'qa-site',incidentHow410:'기존 초안'},files:[],confirmed:[]}}});clients.push(legacyClient);assert.equal(legacyClient.w.localStorage.getItem(legacyKey),null);assert.equal(legacyClient.w.document.getElementById('incidentHow410').value,'기존 초안');
 // Exercise the actual async submit handler with a native DOM event (currentTarget resets after await).
 const submit=await client(server,{id:'submitter'});clients.push(submit);const w=submit.w;
 for(const [id,value] of Object.entries({occurredDate410:'2026-01-01',occurredTime410:'10:00',workAction410:'점검',immediateAction:'조치',injuredName:'검수',injuryDetail410:'검수',leaveEstimate:'none'})){const el=w.document.createElement('input');el.id=id;el.value=value;submit.form.append(el)}
 input(submit,'incidentHow410','사고 경위');input(submit,'incidentPlace410','검수 장소');w.incidentPhotos=[{path:'incident/site-qa-site/submitter/photo.jpg',name:'사진'}];submit.ctl.capture();await submit.ctl.flush();
 w.currentView='report';w.nowISO=()=>new Date().toISOString();w.computePriority=()=> 'normal';w.computeLegalReview=()=>false;w.renderShell=()=>{};w.structuredClone=structuredClone;
 let committed,submission;w.enlCommitOrNotify=async i=>{committed=i;return true};w.eval(fs.readFileSync('report-v410.js','utf8'));submit.form.addEventListener('submit',e=>{submission=w.submitUnifiedIncident(e,w.currentUser(),'person')});submit.form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await submission;
 assert.ok(committed,'actual form commits after asynchronous draft preparation');assert.ok(committed._formDraft.id);assert.equal(committed.photos.length,1);assert.equal(committed.reportDetails.incidentHow,'사고 경위');
 const merge=pc.w.ENLFormDrafts.merge,b={values:{a:'1',b:'2'},files:[]},l={values:{a:'L',b:'2'},files:[]},r={values:{a:'1',b:'R'},files:[]};assert.equal(merge(b,l,r).conflicts.length,0);assert.deepEqual(clone(merge(b,l,r).content.values),{a:'L',b:'R'});
 console.log('PASS separate-device resume, attachment preservation, disjoint merge, explicit same-field resolution, offline recovery, lost-response retries, stale submission blocking and legacy migration');
 }finally{clients.forEach(c=>c.close())}
})().catch(e=>{console.error(e);process.exitCode=1});
