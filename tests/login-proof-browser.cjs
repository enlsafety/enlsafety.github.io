/* Isolated browser contract checks: no production network or credentials. */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const proofs={hq:digest('qa-hq-password'),field:digest('qa-field-password'),target:digest('qa-new-password'),changed:digest('qa-field-changed')};
async function run(engine){
 const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><div id="modalRoot"></div></body></html>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const localOrigin='http://127.0.0.1:'+server.address().port+'/';
 const browser=await engine.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
 try{
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>r.request().url()===localOrigin?r.continue():r.abort());
  await page.goto(localOrigin);
  // Credentials are synthetic; disable even loopback traffic before injecting them.
  await page.context().setOffline(true);
  await page.evaluate(proofs=>{
   window.qaRequests=[];window.qaProofs=proofs;window.qaStrict=true;window.qaAccountFail=false;
   window.qaHq=[{id:'qa-safety',name:'QA 안전',role:'safety',department:'QA 본사',active:true}];
   window.app=document.getElementById('app');window.currentUser=()=>null;window.roleName=()=>'';window.renderLogin=()=>{};window.openUserModal=()=>{};window.openAdminPasswordReset=()=>{};
   window.session={};window.data={users:[],sites:[{id:'qa-site',name:'QA 사업장'}]};window.currentView='home';window.enlPlatformSection='hub';window.ENL_PLATFORM_SECTION_KEY='qa-platform';
   window.saveSession=()=>{};window.saveData=()=>{};window.nowISO=()=>new Date().toISOString();window.uid=p=>p+'-qa-created';
   window.userById=id=>data.users.find(u=>u.id===id);window.siteById=id=>data.sites.find(s=>s.id===id);window.ENL_SITE_DIRECTORY=data.sites;
   window.sha256=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
   window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.renderShell=()=>{app.innerHTML='<div id="view"></div>'};window.openModal=html=>document.getElementById('modalRoot').innerHTML=html;window.closeModal=()=>document.getElementById('modalRoot').innerHTML='';
   window.fetch=async(url,init)=>{
    const body=JSON.parse(init?.body||'{}');qaRequests.push({url:String(url),body});
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(body.action==='lookup')return reply({ok:true,options:body.name==='QA 안전'?[{kind:'hq',affiliationId:'qa-hq',affiliationLabel:'QA 본사',role:'safety',requiresPassword:true}]:[{kind:'site',siteId:'qa-site',affiliationLabel:'QA 사업장',position:'현장소장',requiresPassword:true}]});
    if(body.action==='login_hq')return body.passwordHash===proofs.hq?reply({ok:true,user:qaHq[0]}):reply({ok:false,message:'invalid_login'},403);
    if(body.action==='login_site')return body.passwordHash===proofs.field?reply({ok:true,person:{personnel_id:'qa-field',name:'QA 현장',job_title:'현장소장',site_id:'qa-site',access_role:'field',active:true}}):reply({ok:false,message:'invalid_login'},403);
    if(body.action==='password_change_self'){if(qaAccountFail||body.currentPasswordHash!==proofs.field)return reply({ok:false,message:'current_password_incorrect'},403);proofs.field=body.newPasswordHash;return reply({ok:true})}
    const protectedAction=['hq_list','hq_upsert','personnel_pull','personnel_upsert','personnel_delete'].includes(body.action);
    const validSafety=body.actor?.id==='qa-safety'&&body.actor?.role==='safety'&&body.actorPasswordHash===proofs.hq;
    const validField=body.actor?.id==='qa-field'&&body.actor?.role==='field'&&body.actor?.siteId==='qa-site'&&body.actorPinHash===proofs.field&&(!body.siteId||body.siteId==='qa-site')&&(!body.person?.siteId||body.person.siteId==='qa-site');
    if(qaStrict&&protectedAction&&!(validSafety||(!body.action.startsWith('hq_')&&validField)))return reply({ok:false,message:'forbidden'},403);
    if(body.action==='hq_list')return reply({ok:true,users:qaHq});
    if(body.action==='hq_upsert'){const {passwordHash,...user}=body.user;const at=qaHq.findIndex(x=>x.id===user.id);if(at<0)qaHq.push(user);else qaHq[at]=user;return reply({ok:true,user})}
    if(body.action==='personnel_pull')return reply({ok:true,personnel:[]});
    if(body.action==='personnel_upsert')return reply({ok:true,person:body.person});
    return reply({ok:true});
   };
  },proofs);
  await page.addScriptTag({content:fs.readFileSync('auth-v411.js','utf8')});
  await page.evaluate(()=>{window.qaOriginalAuthApi=enlAuthApi;enlRenderLogin()});
  await page.fill('#loginName411','QA 안전');await page.locator('#loginPassword411').waitFor();
  await page.fill('#loginPassword411','qa-hq-password');await page.click('#loginSubmit411');
  await page.waitForFunction(()=>qaRequests.some(x=>x.body.action==='hq_list'));
  let requests=await page.evaluate(()=>qaRequests);
  for(const action of ['lookup','login_hq']){const b=requests.find(x=>x.body.action===action).body;assert.equal(b.actorPasswordHash,undefined);assert.equal(b.actorPinHash,undefined)}
  assert.equal(requests.find(x=>x.body.action==='login_hq').body.passwordHash,proofs.hq);
  assert.equal(requests.find(x=>x.body.action==='hq_list').body.actorPasswordHash,proofs.hq);checks.push('HQ login and automatic protected listing');
  await page.addScriptTag({content:fs.readFileSync('ui-stability-v422.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('personnel-management-v434.js','utf8')});
  await page.evaluate(()=>openUserModal(null,currentUser()));
  await page.fill('#hqName422','QA 생성');await page.selectOption('#hqRole422','manager');await page.fill('#hqPw422','qa-new-password');await page.click('#hqSave422');
  await page.locator('#hqUserForm422').waitFor({state:'detached'});
  requests=await page.evaluate(()=>qaRequests);
  let body=requests.filter(x=>x.body.action==='hq_upsert').at(-1).body;
  assert.equal(body.actorPasswordHash,proofs.hq);assert.equal(body.user.passwordHash,proofs.target);assert.equal(body.actor.role,'safety');assert.equal(body.user.role,'manager');checks.push('Active HQ account creation separates actor and target proof');
  await page.evaluate(()=>openUserModal(userById('hq-qa-created'),currentUser()));await page.fill('#hqDept422','QA 수정');await page.click('#hqSave422');await page.locator('#hqUserForm422').waitFor({state:'detached'});
  body=(await page.evaluate(()=>qaRequests.filter(x=>x.body.action==='hq_upsert').at(-1))).body;
  assert.equal(body.actorPasswordHash,proofs.hq);assert.equal(body.user.passwordHash,undefined);checks.push('Active HQ edit preserves target password');
  await page.evaluate(()=>enlAuthApi({action:'personnel_pull',actor:enlCurrentActor(),siteId:'qa-site'}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPasswordHash,proofs.hq);checks.push('Active personnel API receives safety proof');
  await page.evaluate(()=>{qaStrict=false;session.manager.passwordHash='';data.users.find(x=>x.id==='qa-safety').passwordHash=qaProofs.hq;return enlAuthApi({action:'hq_list',actor:enlCurrentActor()})});
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPasswordHash,proofs.hq);checks.push('Same-ID local proof fallback after session refresh');
  await page.evaluate(()=>enlAuthApi({action:'hq_list',actor:{id:'qa-other',role:'safety'}}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPasswordHash,undefined);assert.equal(body.actorPinHash,undefined);checks.push('Actor mismatch never borrows logged-in proof');
  await page.evaluate(()=>enlAuthApi({action:'hq_list',actor:enlCurrentActor(),actorPasswordHash:'explicit-wrong-proof'}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPasswordHash,'explicit-wrong-proof');checks.push('Explicit supplied proof is not silently replaced');
  await page.evaluate(()=>enlAuthApi({action:'lookup',name:'QA 현장',actor:enlCurrentActor()}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPasswordHash,undefined);assert.equal(body.actorPinHash,undefined);checks.push('Public lookup never receives injected proof');
  await page.evaluate(()=>{session={};return enlAuthApi({action:'hq_list',actor:{id:'qa-safety',role:'safety'}})});
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPasswordHash,undefined);checks.push('Logged-out caller never borrows locally saved proof');
  await page.evaluate(()=>{qaStrict=true;enlRenderLogin()});await page.fill('#loginName411','QA 현장');await page.locator('#loginPassword411').waitFor();await page.fill('#loginPassword411','qa-field-password');await page.click('#loginSubmit411');
  await page.waitForFunction(()=>currentUser()?.id==='qa-field');
  assert.equal(await page.evaluate(()=>currentUser().pinHash),proofs.field);
  await page.evaluate(()=>qaOriginalAuthApi({action:'personnel_pull',actor:enlCurrentActor(),siteId:'qa-site'}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPinHash,proofs.field);assert.equal(body.actor.role,'field');checks.push('Field login preserves pin proof for protected personnel reads');
  await page.evaluate(()=>qaOriginalAuthApi({action:'personnel_upsert',actor:enlCurrentActor(),siteId:'qa-site',person:{siteId:'qa-site',name:'QA 근로자',accessRole:'worker',jobTitle:'일반근로자'}}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPinHash,proofs.field);checks.push('Legacy field personnel save includes pin proof');
  await page.evaluate(()=>{session.manager.pinHash='';data.users.push({id:'qa-field',name:'QA 현장',role:'field',passwordHash:qaProofs.field});return qaOriginalAuthApi({action:'personnel_pull',actor:enlCurrentActor(),siteId:'qa-site'})});
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPinHash,proofs.field);checks.push('Legacy field local password maps to pin proof');
  await page.evaluate(()=>{session.manager.pinHash=qaProofs.field;return enlAuthApi({action:'personnel_pull',actor:enlCurrentActor(),siteId:'qa-site'})});
  const separate=await page.evaluate(()=>qaRequests.at(-1));assert.ok(separate.url.endsWith('/enl-personnel-v434'));assert.equal(separate.body.actor.siteId,'qa-site');assert.equal(separate.body.actorPinHash,proofs.field);checks.push('Active personnel wrapper forwards field proof on separate API');
  await page.evaluate(()=>enlRenderPersonnelPage(currentUser()));await page.locator('#pm434Name').fill('QA 새근로자');await page.locator('#pm434Form button[type=submit]').click();
  await page.waitForFunction(()=>qaRequests.some(r=>r.url.endsWith('/enl-personnel-v434')&&r.body.action==='personnel_upsert'));
  body=await page.evaluate(()=>qaRequests.filter(r=>r.url.endsWith('/enl-personnel-v434')&&r.body.action==='personnel_upsert').at(-1).body);assert.equal(body.actorPinHash,proofs.field);assert.equal(body.person.accessRole,'worker');checks.push('Active field worker form forwards actor proof and worker role');
  await page.evaluate(()=>enlAuthApi({action:'personnel_delete',actor:enlCurrentActor(),personnelId:'qa-worker'}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPinHash,proofs.field);checks.push('Active personnel delete includes current field proof');
  const crossSite=await page.evaluate(()=>enlAuthApi({action:'personnel_pull',actor:enlCurrentActor(),siteId:'qa-other-site'}).then(()=>null,e=>e.message));assert.equal(crossSite,'forbidden');checks.push('Cross-site denial remains visible to caller');
  await page.addScriptTag({content:fs.readFileSync('account-security-v420.js','utf8')});
  await page.evaluate(()=>{qaAccountFail=true;enlOpenSelfPasswordChange420()});await page.fill('#enl420Current','qa-field-password');await page.fill('#enl420New','qa-field-changed');await page.fill('#enl420New2','qa-field-changed');await page.click('#enl420SelfForm button[type=submit]');
  await page.waitForFunction(()=>qaRequests.some(r=>r.body.action==='password_change_self'));await page.waitForFunction(()=>!document.querySelector('#enl420SelfForm button[type=submit]').disabled);
  assert.equal(await page.evaluate(()=>currentUser().pinHash),proofs.field);checks.push('Failed password change preserves current field proof');
  await page.evaluate(()=>{qaAccountFail=false});await page.click('#enl420SelfForm button[type=submit]');await page.locator('#enl420SelfForm').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>currentUser().pinHash),proofs.changed);assert.equal(await page.evaluate(()=>session.manager.pinHash),proofs.changed);
  await page.evaluate(()=>enlAuthApi({action:'personnel_pull',actor:enlCurrentActor(),siteId:'qa-site'}));
  body=(await page.evaluate(()=>qaRequests.at(-1))).body;assert.equal(body.actorPinHash,proofs.changed);assert.equal(body.actorPasswordHash,proofs.changed);checks.push('Successful field password change immediately refreshes API PIN proof');
  assert.deepEqual(errors,[]);return {engine:engine.name(),passed:checks.length,checks,errors};
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
(async()=>{const results=[];for(const engine of [chromium,webkit])results.push(await run(engine));fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/login-proof-browser.json',JSON.stringify({isolated:true,productionRequests:0,results},null,2));console.log(JSON.stringify({results},null,2))})().catch(e=>{console.error(e);process.exitCode=1});
