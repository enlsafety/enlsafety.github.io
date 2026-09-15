// Existing login/account UI, stateful mock API. No email or live DB claims.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const errors=[],alerts=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 const users=[{id:'qa-safety',name:'안전테스트',role:'safety',passwordHash:hash('proof123')},{id:'qa-manager',name:'관리테스트',role:'manager',passwordHash:hash('old1234')}];let token='',tokenOwner='';
 await page.route('**/*',async route=>{const u=new URL(route.request().url());
  if(u.hostname!=='127.0.0.1'){
   const body=route.request().postData()?JSON.parse(route.request().postData()):{};calls.push(body.action);let status=200,r={ok:true,users:[],sites:[],incidents:[],workflows:[],runs:[],events:[],epoch:1};
   const publicUser=x=>({id:x.id,name:x.name,role:x.role,active:true});
   if(body.action==='lookup')r.options=users.filter(x=>x.name===body.name).map(x=>({kind:'hq',affiliationId:x.id,affiliationLabel:'테스트 본사',role:x.role,requiresPassword:true}));
   if(body.action==='login_hq'){const x=users.find(x=>x.name===body.name&&x.passwordHash===body.passwordHash);if(x){token='fixture-session-'+crypto.randomUUID();tokenOwner=x.id;r.user=publicUser(x);r.sessionToken=token;}else{status=401;r={ok:false,message:'invalid_login'};}}
   if(body.action==='password_reset_safety'||body.action==='password_change_self'){
    assert.equal(route.request().headers()['x-enl-session'],token,'signed session not forwarded');const actor=users.find(x=>x.id===tokenOwner);
    if(body.action==='password_reset_safety'){
     if(actor?.role!=='safety'||body.actorPasswordHash!==actor.passwordHash){status=401;r={ok:false,message:'safety_password_incorrect'};}
     else users.find(x=>x.id===body.target.id).passwordHash=body.newPasswordHash;
    }else if(body.currentPasswordHash!==actor.passwordHash){status=401;r={ok:false,message:'current_password_incorrect'};}else{actor.passwordHash=body.newPasswordHash;token='invalidated';}
   }
   return route.fulfill({status,json:r,headers:{'Access-Control-Allow-Origin':'*'}});
  }
  const file=path.join(root,decodeURIComponent(u.pathname));if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css':'text/html; charset=utf-8',body:fs.readFileSync(file)});
 });
 await page.goto('http://127.0.0.1:8729/stable412.html');await page.locator('#loginName411').waitFor();assert.equal(await page.evaluate(()=>typeof window.openAdminPasswordReset),'function');
 async function login(name,pw,ok=true){await page.locator('#loginName411').fill(name);await page.locator('[data-login411-aff]').first().click();await page.locator('#loginPassword411').fill(pw);await page.locator('#loginSubmit411').click();if(ok)await page.locator('#userChip').waitFor();else await page.waitForFunction(()=>document.querySelector('#loginStatus411')?.classList.contains('err'));}
 async function logout(){await page.locator('#userChip').click();await page.locator('#logoutBtn').click();await page.locator('#loginName411').waitFor();assert.equal(await page.evaluate(()=>currentUser()),null);}
 await login('안전테스트','proof123');
 await page.evaluate(()=>window.openAdminPasswordReset({id:'qa-manager',name:'관리테스트',role:'manager'},currentUser()));
 await page.locator('#enl420SafetyProof').fill('wrong');await page.locator('#enl420TargetNew').fill('reset123');await page.locator('#enl420TargetNew2').fill('reset123');await page.getByRole('button',{name:'새 비밀번호 저장',exact:true}).click();await page.waitForTimeout(250);assert(alerts.some(x=>x.includes('본인 비밀번호가 맞지')));assert.equal(users[1].passwordHash,hash('old1234'));
 await page.locator('#enl420SafetyProof').fill('proof123');await page.getByRole('button',{name:'새 비밀번호 저장',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#enl420SafetyReset'));assert.equal(users[1].passwordHash,hash('reset123'));
 await logout();await login('관리테스트','old1234',false);await login('관리테스트','reset123');assert.equal(await page.evaluate(()=>currentUser().role),'manager');assert(!(await page.evaluate(()=>renderNav(currentUser()))).includes('ai-team'));
 await page.evaluate(()=>{window.enlOpenSafetyPasswordReset420({kind:'hq',id:'qa-safety'});window.openAdminPasswordReset({id:'qa-safety',role:'safety'},currentUser());});assert.equal(await page.locator('#enl420SafetyReset').count(),0);assert.equal(await page.locator('#hqPwReset411').count(),0);
 await page.evaluate(()=>window.enlOpenSelfPasswordChange420());await page.locator('#enl420Current').fill('reset123');await page.locator('#enl420New').fill('self1234');await page.locator('#enl420New2').fill('self1234');await page.locator('#enl420SelfForm button[type=submit]').click();await page.locator('#loginName411').waitFor();await page.reload();await page.locator('#loginName411').waitFor();assert.equal(await page.evaluate(()=>currentUser()),null,'old session resurrected');
 await login('관리테스트','self1234');await logout();assert.deepEqual(errors,[]);assert.equal(calls.filter(x=>x==='password_reset_safety').length,2);assert.equal(calls.filter(x=>x==='password_change_self').length,1);
 console.log(`PASS ${engine.name()}: startup, actual login UI, proof rejection, safety reset, old password rejected/new login, role guard, self change, token forwarding, logout/reload. Stateful mock API; live authentication untested.`);await browser.close();
}
