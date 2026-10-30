'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module'),{chromium,webkit}=require('playwright'),{fixture}=require('./final-lifecycle.cjs');
const proof=crypto.createHash('sha256').update('qa-password').digest('hex');
const mailCtx={Deno:{env:{get:()=>''},serve(){}},console};vm.createContext(mailCtx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-email-v441/index.ts','utf8').replace(/^import .*;\r?\n/gm,''))+';globalThis.createMail=mailContent;',mailCtx);
const users=[{id:'qa-safety',name:'QA 안전',role:'safety',position:'안전관리자'},{id:'qa-parallel',name:'QA 임원',role:'executive',position:'부사장'},{id:'qa-executive',name:'QA 사장',role:'executive',position:'사장'}];
async function run(engine,width){
 let options={headless:true};if(process.env.ENL_QA_CHROMIUM==='sparticuz'){const {default:c}=await import('@sparticuz/chromium');options={...options,executablePath:await c.executablePath(),args:c.args.filter(x=>!/(single-process|disable-web-security|allow-running-insecure-content)/.test(x))};}
 const browser=await engine.launch(options),f=await fixture();let cases=0;
 try{
  await f.db.query('update enl_hq_users set password_hash=$1',[proof]);await f.db.query("insert into enl_hq_users(user_id,name,role,position,active,password_hash) values('qa-parallel','QA 임원','executive','부사장',true,$1)",[proof]);
  for(const stage of ['parallel','president'])for(const user of users){
   const id='qa-link-'+stage+'-'+user.id,i={id,siteId:'qa-site',category:'property',status:'approved',summary:'가상 결재 링크 검증',eventType:'접촉',occurredAt:'2026-10-30T00:00:00Z',photos:[],reportDetails:{incidentHow:'가상 사고경위',place:'검증 구역'},corrective:{status:'approved',rootCause:'가상 원인',planDetail:'가상 조치계획',actionDetail:'가상 조치완료',afterPhotos:[]},_syncVersion:1,executiveApproval:{state:'pending',mode:'parallel_then_president',round:1,stage,finalApproverId:'qa-executive',roster:users.filter(u=>u.role==='executive'),signatures:stage==='president'?[{id:'qa-parallel',decision:'approve',at:'2026-10-30T00:10:00Z'}]:[]}};
   await f.db.query('insert into enl_incident_shared(incident_id,site_id,payload) values($1,$2,$3)',[id,i.siteId,JSON.stringify(i)]);
   const mail=mailCtx.createMail(i,'QA 사업장',false,'executive_approval_requested'),url=mail.text.match(/https:\/\/enlsafety\.github\.io\/\S+/)[0];
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<1000,serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
   await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());if(u.origin==='https://enlsafety.github.io')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><div id="modalRoot"></div></body></html>'});
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type,x-enl-app'}});
    const b=req.postDataJSON();requests.push(b);let r;
    if(u.pathname.endsWith('/enl-incident-sync-v411'))r=await f.raw(b);
    else if(b.action==='lookup')r={status:200,body:{ok:true,options:[{kind:'hq',affiliationId:'qa-hq',affiliationLabel:'QA 본사',role:user.role,requiresPassword:true}]}};
    else if(b.action==='login_hq')r=b.passwordHash===proof?{status:200,body:{ok:true,user}}:{status:403,body:{ok:false}};
    else if(b.action==='hq_list')r={status:200,body:{ok:true,users}};
    else r={status:200,body:{ok:true}};
    if(b.action==='view'&&r.status===200)await page.evaluate(()=>window.qaViewSaved=true);
    return route.fulfill({status:r.status,contentType:'application/json',body:JSON.stringify(r.body),headers:{'access-control-allow-origin':'*'}});
   });
   await page.goto(url);
   await page.evaluate(()=>{
    window.app=document.getElementById('app');window.currentUser=()=>null;window.roleName=String;window.renderLogin=()=>{};window.openUserModal=()=>{};window.openAdminPasswordReset=()=>{};
    window.session={};window.data={users:[],incidents:[],sites:[{id:'qa-site',name:'QA 사업장'}]};window.currentView='home';window.enlPlatformSection='hub';window.ENL_PLATFORM_SECTION_KEY='qa';window.actionPhotos=[];window.incidentPhotos=[];
    window.saveSession=window.saveData=()=>{};window.nowISO=()=>new Date().toISOString();window.userById=id=>data.users.find(u=>u.id===id);window.siteById=id=>data.sites.find(s=>s.id===id);window.siteName=()=> 'QA 사업장';window.ENL_SITE_DIRECTORY=data.sites;window.uid=p=>p+'-qa';
    window.sha256=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
    window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.fmt=String;window.won=String;window.eventTypeOptions=v=>'<option>'+esc(v||'접촉')+'</option>';window.categoryBadge=window.badge=()=>'';window.computePriority=()=> 'normal';
    window.renderShell=()=>{app.innerHTML='<div id="view"></div>'};window.openModal=html=>document.getElementById('modalRoot').innerHTML='<div class="modal-bg"><div class="modal">'+html+'</div></div>';window.closeModal=()=>document.getElementById('modalRoot').innerHTML='';window.enlAttachmentGalleryHtml=()=>'';window.enlBindAttachmentOpen=()=>{};
   });
   for(const file of ['style.css','report-v410.css'])await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
   if(process.env.QA_FONT_FILE)await page.addStyleTag({content:'@font-face{font-family:QA;src:url(data:font/woff2;base64,'+fs.readFileSync(process.env.QA_FONT_FILE).toString('base64')+')}body{font-family:QA,sans-serif!important}'});
   for(const file of ['auth-v411.js','incidents-v410.js','incident-sync-v411.js','report-v410.js','workflow-lifecycle-v413.js','push-session-v425.js','incident-flow-v440.js','executive-approval-v482.js','approval-sheet-v486.js','management-approval-v448.js','incident-view-v485.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
   await page.evaluate(()=>enlRenderLogin());assert.equal(await page.locator('[data-executive-record]').count(),0,'no report before login');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('enl_pending_push_incident_v425')).incidentId),id);
   await page.fill('#loginName411',user.name);await page.locator('#loginPassword411').waitFor();await page.fill('#loginPassword411','qa-password');await page.click('#loginSubmit411');
   await page.locator('[data-executive-record]').waitFor();await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-executive-record'));
   assert.equal(await page.locator('#modalRoot .modal').getAttribute('data-cumulative-incident'),id,'correct report opens after real login handler and authenticated pull');
   const expected=user.id==='qa-parallel'&&stage==='parallel'?'결재 승인':user.id==='qa-executive'&&stage==='president'?'사장 최종결재':null;
   assert.equal(await page.getByRole('button',{name:'결재 승인',exact:true}).count(),expected==='결재 승인'?1:0);assert.equal(await page.getByRole('button',{name:'사장 최종결재',exact:true}).count(),expected==='사장 최종결재'?1:0);
   if(user.role==='executive'){await page.waitForFunction(()=>window.qaViewSaved===true);assert.ok(requests.some(x=>x.action==='view'&&x.incidentId===id&&x.actorPasswordHash===proof),'login deep link records authenticated view');}
   const position=await page.locator('[data-executive-record]').boundingBox();assert.ok(position.y<900&&position.y+position.height>0,'approval area visible');
   assert.equal(await page.evaluate(()=>localStorage.getItem('enl_pending_push_incident_v425')),null);assert.ok(requests.some(x=>x.action==='pull'&&x.actorPasswordHash===proof));assert.ok(!requests.some(x=>x.action==='executive_decide'),'opening a link never approves');assert.deepEqual(errors,[]);
   if(user.role==='safety'){await page.evaluate(()=>document.fonts.ready);fs.mkdirSync('qa-output',{recursive:true});await page.screenshot({path:'qa-output/approval-link-'+engine.name()+'-'+width+'-'+stage+'.png'});}
   cases++;await context.close();
  }
  console.log('PASS approval email login deep links',engine.name(),width,cases,'role/stage cases');
 }finally{await browser.close();await f.db.close()}
}
(async()=>{await run(chromium,1365);await run(process.env.ENL_QA_CHROMIUM==='sparticuz'?chromium:webkit,390)})().catch(e=>{console.error(e);process.exitCode=1});
