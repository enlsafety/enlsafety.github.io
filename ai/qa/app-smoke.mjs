import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});const page=await context.newPage();let remote=0,baseline=true;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){remote++;return route.fulfill({json:{ok:true,incidents:[],users:[],sites:[],workflows:[],runs:[],events:[],epoch:1},headers:{'Access-Control-Allow-Origin':'*'}});}if(baseline&&u.pathname.endsWith("ai-safety-team-v440.js"))return route.fulfill({contentType:"application/javascript",body:""});const file=path.join(root,decodeURIComponent(u.pathname));if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css':'text/html; charset=utf-8',body:fs.readFileSync(file)});});
await page.goto('http://127.0.0.1:8729/stable412.html');await page.waitForTimeout(1500);const baselineErrors=[...errors];errors.length=0;baseline=false;await page.reload();await page.waitForTimeout(1000);
assert(await page.locator('input').count()>0,'existing login renders');
await page.evaluate(()=>{data.sites=[{id:'qa',name:'QA 가상사업장',active:true}];data.incidents=[];session={manager:{id:'qa',name:'QA',role:'safety',passwordHash:'fixture-only'}};document.body.innerHTML='<div id="view"></div>';});
const nav=await page.evaluate(()=>renderNav(currentUser()));assert(nav.includes('ai-team'));
for(const view of ['dashboard','incidents','actions','sites','users','ai-team']){await page.evaluate(v=>{currentView=v;renderCurrentView(currentUser());},view);await page.waitForTimeout(100);assert((await page.locator('#view').innerText()).length>0,view);}
await page.evaluate(()=>{session={manager:{id:'field-qa',name:'현장 QA',role:'field',siteId:'qa'}};currentView='report';renderCurrentView(currentUser());});await page.getByText('대인사고',{exact:true}).click();assert(await page.locator('form').count()>0);assert(await page.locator('textarea').count()>0);assert(!(await page.evaluate(()=>renderNav(currentUser()))).includes('ai-team'));assert.equal(await page.locator('.ai440').count(),0);
assert.deepEqual(errors,baselineErrors);console.log('Unchanged pre-existing startup errors:',baselineErrors);console.log(`PASS: actual app scripts, login, safety navigation, dashboard/incidents/actions/sites/users, field report and safety-only AI; ${remote} remote requests intercepted, no production access`);await browser.close();





