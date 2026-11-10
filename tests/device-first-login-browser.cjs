const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {fixture}=require('./login-proof-edge.cjs');
(async()=>{
 const f=await fixture(true),b=await chromium.launch();
 const pw='qa-browser-password',hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 await f.db.query("update enl_hq_users set email='qa.safety@enlife.co.kr',password_hash=$1 where user_id='qa-auth-safety-472'",[hash(pw)]);
 let last;
 try{
  async function open(width){
   const origin=width===393?"https://mobile-workspace.test":"https://workspace.test";
   const p=await b.newPage({viewport:{width,height:900}});p.setDefaultTimeout(12000);
   p.on('pageerror',e=>console.log('page error',e.message));p.on('dialog',d=>d.accept());
   await p.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===origin){
     const file=path.join(process.cwd(),u.pathname);
     if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
     return route.fulfill({body:fs.readFileSync(file),contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
    }
    if(!u.pathname.startsWith('/functions/v1/'))return route.abort();
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});
    const body=req.postDataJSON()||{},isAuth=u.pathname.endsWith('enl-login-v411'),isAccount=u.pathname.endsWith('enl-account-v420');
    const r=isAuth||isAccount?await f.call(body,isAuth?'login':'account'):{status:200,body:{ok:true,epoch:1,incidents:[],sites:[],revision:1,services:[],modules:[{key:'incident',state:'live',enabled:true,canEnter:true},{key:'risk',state:'building',enabled:false}],favorites:[],rows:[],events:[],notices:[],items:[],users:[],unread:0}};
    if(body.action==='login_hq')last=r.body.message||'ok';
    return route.fulfill({status:r.status,json:r.body,headers:{'Access-Control-Allow-Origin':'*'}});
   });
   await p.addInitScript(()=>localStorage.setItem('enl_setup_intro_seen_v1','1'));await p.goto(origin+'/stable412.html');return p;
  }
  const start=async(p,password,first=true)=>{
   await p.locator('#loginName411').fill('QA 안전');const gate=p.getByRole('button',{name:'이메일 인증',exact:true});
   if(first){
    await gate.waitFor();assert.ok(await p.locator('#loginPassword411').isHidden());
    assert.equal(await gate.evaluate(b=>b===document.activeElement),true);
    const originalCount=f.mailbox.length;
    await gate.click();const prompt=p.getByRole('dialog',{name:'아이디 최초 이메일 인증'});
    await prompt.getByRole('button',{name:'취소'}).click();
    await gate.click();await prompt.waitFor();
    assert.equal(f.mailbox.length,originalCount);
   }else{await p.locator('#loginPassword411').waitFor();assert.ok(await gate.isHidden())}
   await p.locator('#loginPassword411').fill(password);await p.locator('#loginSubmit411').click();
  };
  const p=await open(1440);await start(p,pw);
  const otp=p.locator('dialog:has(#deviceOtpTitle)');await otp.waitFor();assert.equal(last,'device_code_required');
  await otp.locator('[name=code]').fill(f.mailbox.at(-1).code);await otp.getByText('인증하고 로그인').click();
  const d=p.locator('.enl420-device-dialog');await d.waitFor();await d.locator('.enl420-actions [data-close]').click();
  await p.locator('.hub-sidebar [data-hub=boards]').click();await d.waitFor();
  await d.locator('[name=currentPw]').fill(pw);await d.locator('[name=newPw]').fill('qa-changed-new');await d.locator('[name=repeatPw]').fill('qa-changed-new');await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});
  await p.locator('[data-worktab=home]').click();await p.waitForTimeout(350);assert.equal(await d.count(),0);
  await f.db.exec("update private.enl_password_schedule set next_prompt=now()-interval '1 minute' where account_key='hq:qa-auth-safety-472'");
  await p.locator('.hub-sidebar [data-hub=boards]').click();await d.getByRole('heading',{name:'정기 비밀번호 변경'}).waitFor();await d.getByRole('button',{name:'다음에',exact:true}).click();
  await d.waitFor({state:'detached'});await p.locator('[data-worktab=home]').click();await p.waitForTimeout(250);assert.equal(await d.count(),0);
  await p.locator('#userChip').click();await p.locator('#logoutBtn').click();await start(p,'qa-changed-new',false);await p.locator('[data-module=incident]').waitFor();assert.equal(f.mailbox.length,1);
  const mobile=await open(393);await start(mobile,'qa-changed-new',false);
  await mobile.locator('[data-module=incident]').waitFor();assert.equal(f.mailbox.length,1);assert.equal(await mobile.locator('.enl420-device-dialog').count(),0);
  await f.db.exec("update enl_hq_users set email='' where user_id='qa-auth-safety-472';update private.enl_password_schedule set demo_password_only=true where account_key='hq:qa-auth-safety-472'");
  const demo=await open(1024);await demo.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await demo.reload();await start(demo,'qa-changed-new',false);
  await demo.locator('[data-module=incident]').waitFor();assert.equal(f.mailbox.length,1);
  console.log('PASS complete UI: first OTP, initial reminder twice on navigation, password change, annual deferral, trusted relogin, new mobile browser and cross-device schedule');
 }finally{await b.close();await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
