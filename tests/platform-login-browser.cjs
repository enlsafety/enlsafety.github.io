const {webkit,chromium}=require('playwright'),{tab}=require('./field-entry-table-browser.cjs'),assert=require('node:assert/strict');
(async()=>{for(const [engine,width] of [[chromium,1365],[webkit,390]]){const b=await engine.launch();try{
 const {p}=await tab(b,width,'safety');let submitted='',loginBody;
 await p.route('**/functions/v1/**',async route=>{const req=route.request(),body=req.method()==='POST'?req.postDataJSON():{};
 let data;if(body.action==='lookup')data={options:[{kind:'hq',affiliationId:'dept:qa',affiliationLabel:'QA본사',requiresPassword:true,accountKey:'hq:qa-login',hasEmail:width>500,companyLocal:width>500?'qa.saved':''}]};
 if(body.action==='register_company_email'){submitted=body.companyLocal;data={email:submitted+'@enlife.co.kr'};assert.equal(body.registrationPassword,'gate-test');}
 if(body.action==='login_hq')loginBody=body;
 if(body.action==='login_hq')data={user:{id:'qa-login',name:'통합검수',department:'QA',role:'safety',active:true}};
 if(body.action==='platform_catalog')data={revision:1,services:[],modules:['incident','risk','tbm','organization','training'].map(key=>({key,state:key==='incident'?'live':'building'}))};
 if(!data)return route.fallback();return route.fulfill({json:{ok:true,...data}});
 });
 await p.evaluate(()=>{session=null;renderLogin()});await p.locator('#loginName411').fill('통합검수');await p.locator('#loginPassword411').waitFor();
 await p.waitForFunction(()=>document.activeElement?.id==='loginPassword411');
 await p.keyboard.type('focus-check');
 assert.equal(await p.locator('#loginPassword411').inputValue(),'focus-check');
 await p.locator('#loginPassword411').fill('');
 assert.equal(await p.locator('#loginAff411').innerText(),'QA본사');
 assert.equal(await p.locator('#loginAff411 select,#loginAff411 button,#loginAff411 details').count(),0);
 const email=p.locator('#companyLocal411');if(width>500){assert.equal(await email.inputValue(),'qa.saved');assert.ok(await email.evaluate(x=>x.readOnly));}
 else{const a=await p.locator('#loginName411').boundingBox(),b=await p.locator('#loginAff411').boundingBox();assert.ok(Math.abs(a.y-b.y)<2);await email.fill('qa.new');
 const rects=await p.locator('.company-address>*').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().x));assert.ok(rects[0]<rects[1]&&rects[1]<rects[2]);
 await p.locator('[data-enroll]').click();const d=p.locator('.email-gate-dialog');await d.locator('[name=login]').fill('isolated');await d.locator('[name=gate]').fill('gate-test');await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});assert.ok(await email.evaluate(x=>x.readOnly));assert.equal(await p.locator('.system-title-line').first().evaluate(x=>getComputedStyle(x).display),'block');}
 await p.locator('#loginPassword411').fill('isolated');await p.locator('#loginSubmit411').click();
 await p.locator('[data-module=incident]').waitFor();await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>currentView),'platform');assert.equal(submitted,width>500?'':'qa.new');assert.equal(loginBody.companyLocal,undefined);console.log('PASS fresh HQ login lands in portal',engine.name());
 }finally{await b.close()}}})().catch(e=>{console.error(e);process.exitCode=1});
