const {webkit,chromium}=require('playwright'),{tab}=require('./field-entry-table-browser.cjs'),assert=require('node:assert/strict');
(async()=>{for(const [engine,width] of [[chromium,1365],[webkit,390]]){const b=await engine.launch();try{
 const {p}=await tab(b,width,'safety',undefined,false);const hq=width>500,accountKey=hq?'hq:qa-login':'site:qa-login';
 let submitted='',loginBody,changes=0;
 await p.route('**/functions/v1/**',async route=>{const req=route.request(),body=req.method()==='POST'?req.postDataJSON():{};
 let data;if(body.action==='lookup')data={options:[{kind:hq?'hq':'site',siteId:'s01',affiliationId:'dept:qa',affiliationLabel:'QA본사',requiresPassword:true,accountKey:body.name==='다른사용자'?'hq:other-account':accountKey,hasEmail:width>500||!!submitted,companyLocal:width>500?'qa.saved':submitted}]};
 if(body.action==='email_code_send'){
   if(body.companyLocal==='duplicate')return route.fulfill({status:409,json:{ok:false,message:'email_in_use'}});
   data={};
 }
 if(body.action==='password_change_self'){
   const hash=v=>require('node:crypto').createHash('sha256').update(v).digest('hex');
   if(body.currentPasswordHash!==hash('isolated'))return route.fulfill({status:401,json:{ok:false,message:'current_password_incorrect'}});
   assert.equal(body.newPasswordHash,hash('changed-in-fixture'));changes++;data={};
 }
 if(body.action==='email_code_verify'){assert.equal(body.code,'123456');submitted=body.companyLocal;data={email:submitted+'@enlife.co.kr'};}
 if(['login_hq','login_site'].includes(body.action)){
   const expected=changes?'changed-in-fixture':'isolated';
   const hash=require('node:crypto').createHash('sha256').update(expected).digest('hex');
   if(hash!==body.passwordHash)return route.fulfill({status:401,json:{ok:false,message:'invalid_login'}});
   loginBody=body;
 }
 if(body.action==='login_hq')data={user:{id:'qa-login',name:'통합검수',department:'QA',role:'safety',active:true}};
 if(body.action==='login_site')data={person:{personnel_id:'qa-login',site_id:'s01',name:'통합검수',job_title:'현장소장',access_role:'field',active:true}};
 if(body.action==='platform_catalog')data={revision:1,services:[],modules:['incident','risk','tbm','organization','training'].map(key=>({key,state:key==='incident'?'live':'building'}))};
 if(!data)return route.fallback();return route.fulfill({json:{ok:true,...data}});
 });
 await p.evaluate(()=>{session=null;renderLogin();
   window.confirm=()=>true;window.alert=()=>{};
   Object.defineProperty(window,'PasswordCredential',{configurable:true,value:undefined});

 });
 // A previous version recorded that it opened the dialog, even without acknowledgement.
 await p.evaluate(k=>localStorage.setItem('enl.firstPasswordPrompt.v1.'+k,'1'),accountKey);
 await p.locator('#loginName411').fill('통합검수');await p.locator('#loginPassword411').waitFor();
 await p.waitForFunction(id=>document.activeElement?.id===id,width>500?'loginPassword411':'companyLocal411');
 await p.locator('#loginPassword411').focus();
 await p.keyboard.type('focus-check');
 assert.equal(await p.locator('#loginPassword411').inputValue(),'focus-check');
 await p.locator('#loginPassword411').fill('');
 assert.equal(await p.locator('#loginAff411').innerText(),'QA본사');
 assert.equal(await p.locator('#loginAff411 select,#loginAff411 button,#loginAff411 details').count(),0);
 const email=p.locator('#companyLocal411');if(width>500){assert.equal(await email.inputValue(),'qa.saved');assert.ok(await email.evaluate(x=>x.readOnly));}
 else{const a=await p.locator('#loginName411').boundingBox(),b=await p.locator('#loginAff411').boundingBox();assert.ok(Math.abs(a.y-b.y)<2);await email.fill('qa.new');
 const rects=await p.locator('.company-address>*').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().x));assert.ok(rects[0]<rects[1]&&rects[1]<rects[2]);
 await email.fill('duplicate');await p.locator('[data-enroll]').click();const d=p.locator('.email-gate-dialog'),proof=d.locator('[name=proof]');
 assert.equal(await proof.getAttribute('placeholder'),'초기 비밀번호: 본인 휴대폰 뒷번호 4자리');
 const opacity=()=>proof.evaluate(el=>getComputedStyle(el,'::placeholder').opacity);
 assert.equal(await opacity(),'1');await proof.focus();assert.equal(await opacity(),'0');await proof.blur();assert.equal(await opacity(),'1');
 await proof.fill('isolated');await d.locator('[type=submit]').click();await d.getByText('이미 다른 사용자에게 등록된 이메일입니다.',{exact:false}).waitFor();
 assert.equal(await d.locator('[name=code]').isVisible(),false);await d.locator('[data-cancel]').click();
 await email.fill('qa.new');await p.locator('[data-enroll]').click();await d.locator('[name=proof]').fill('isolated');await d.locator('[type=submit]').click();await d.locator('[name=code]').fill('123456');await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});assert.ok(await email.evaluate(x=>x.readOnly));assert.equal(await p.locator('.login-brand h1').innerText(),'이앤엘 안전보건관리\n통합시스템');}
 await p.locator('#loginPassword411').fill('isolated');if(width>500)await p.locator('#rememberId411').check();await p.locator('#rememberPw411').check();await p.locator('#loginSubmit411').click();
 const device=p.locator('dialog.enl420-device-dialog');
 await device.waitFor();assert.equal(await device.locator('input[type=password]').count(),3);
 if(width>500){
   await device.locator('[name=currentPw]').fill('wrong');await device.locator('[name=newPw]').fill('changed-in-fixture');
   await device.locator('[name=repeatPw]').fill('mismatch');await device.locator('[type=submit]').click();
   await device.getByText('새 비밀번호가 서로 다릅니다.').waitFor();assert.equal(changes,0);
   await device.locator('[name=repeatPw]').fill('changed-in-fixture');await device.locator('[type=submit]').click();
   await device.getByText('현재 비밀번호가 맞지 않습니다.').waitFor();
   await device.locator('[name=currentPw]').fill('isolated');await device.locator('[type=submit]').click();
 }else await device.getByText('다음에 변경').click();
 await device.waitFor({state:'detached'});assert.equal(changes,width>500?1:0);
 await p.locator('[data-module=incident]').waitFor();await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>currentView),'platform');assert.equal(submitted,width>500?'':'qa.new');assert.equal(loginBody.companyLocal,undefined);const logout=async()=>{await p.locator('#userChip').click();await p.locator('#logoutBtn').click();await p.locator('#loginName411').waitFor();assert.equal(await p.evaluate(()=>currentUser()),null)};
 await logout();await p.reload();
 assert.equal(await p.locator('#loginName411').inputValue(),width>500?'통합검수':'');
 if(width<=500)await p.locator('#loginName411').fill('통합검수');
 const ready=()=>p.locator('#loginPassword411[placeholder="●●●●●●●●"]').waitFor();
 await ready();
 await p.getByText('이 기기에 기억된 비밀번호로 바로 로그인할 수 있습니다.').waitFor();
 assert.equal(await p.locator('#loginPassword411').inputValue(),'');
 await p.locator('#loginSubmit411').click();await p.locator('[data-module=incident]').waitFor();
 await logout();if(width<=500)await p.locator('#loginName411').fill('통합검수');
 await ready();
 await p.locator('#loginName411').fill('다른사용자');
 await p.waitForFunction(()=>document.querySelector('#loginPwForm411 [name=username]')?.value==='hq:other-account');
 assert.ok(!await p.locator('#rememberPw411').isChecked());
 assert.ok(await p.locator('#loginPassword411').evaluate(el=>el.required&&!el.value));
 await p.locator('#loginName411').fill('통합검수');await ready();
 await p.locator('#rememberPw411').uncheck();
 assert.equal(await p.evaluate(()=>localStorage.getItem('enl.login.rememberPasswordFor')),null);
 assert.equal(await p.locator('#loginPassword411').inputValue(),'');
 await p.locator('#loginPassword411').fill(width>500?'changed-in-fixture':'isolated');
 await p.locator('#loginSubmit411').click();await p.locator('[data-module=incident]').waitFor();assert.equal(await device.count(),0);
 await logout();if(width<=500)await p.locator('#loginName411').fill('통합검수');
 await p.locator('#loginPassword411').waitFor();
 assert.ok(await p.locator('#loginPassword411').evaluate(el=>el.required&&!el.value));
 assert.ok(!await p.locator('#rememberPw411').isChecked());
 // Exercise a legacy consent-only installation with no browser password manager.
 await p.evaluate(k=>localStorage.setItem('enl.login.rememberPasswordFor',k),accountKey);
 await p.reload();if(width<=500)await p.locator('#loginName411').fill('통합검수');
 await p.getByText('기억하기는 켜져 있습니다.',{exact:false}).waitFor();
 await p.locator('#loginPassword411').fill(width>500?'changed-in-fixture':'isolated');
 await p.locator('#loginSubmit411').click();await p.locator('[data-module=incident]').waitFor();
 if(width>500){
   await p.evaluate(()=>localStorage.removeItem('enl.login.deviceCredential'));
   await p.reload();await p.locator('[data-module=incident]').waitFor();
 }
 await logout();if(width<=500)await p.locator('#loginName411').fill('통합검수');
 await ready();await p.locator('#loginSubmit411').click();await p.locator('[data-module=incident]').waitFor();
 await logout();
 const meta=require(process.cwd()+'/version.json');
 await p.route('**/version.json?*',r=>r.fulfill({json:{...meta,build:meta.build.replace(/\d+$/,v=>String(Number(v)+1))}}));
 await p.waitForFunction(()=>window.enlCheckLatestVersion());
 const notice=p.getByRole('dialog',{name:'새 버전이 있습니다'});await notice.waitFor();
 assert.deepEqual(await notice.getByRole('button').allTextContents(),['나중에','지금 업데이트']);
 const centered=await notice.evaluate(el=>{
   const box=el.getBoundingClientRect();
   return el.matches(':modal')&&Math.abs(box.x+box.width/2-innerWidth/2)<2&&Math.abs(box.y+box.height/2-innerHeight/2)<2;
 });
 assert.ok(centered,'update choice stays in the center of the viewport');
 const previousUrl=p.url();
 await notice.getByRole('button',{name:'나중에'}).click();
 await p.evaluate(()=>window.enlCheckLatestVersion());
 assert.equal(await notice.count(),0);assert.equal(p.url(),previousUrl);
 // No after-the-fact popup when a current page opens with legacy acknowledgement data.
 await p.evaluate(build=>localStorage.setItem('enl_update_applied_notice',build),meta.version+'-r'+meta.build.split('-r')[1]);
 await p.unroute('**/version.json?*');await p.reload();
 await p.evaluate(()=>window.enlCheckLatestVersion());
 assert.equal(await p.locator('#enlUpdateNotice').count(),0);
 console.log('PASS verified login and independent consent across login screens',engine.name(),width);
 }finally{await b.close()}}})().catch(e=>{console.error(e);process.exitCode=1});
