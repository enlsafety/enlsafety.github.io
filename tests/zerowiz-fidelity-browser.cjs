'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{chromium,webkit}=require('playwright');
const HOST='https://enlsafety.github.io';
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
(async()=>{
 for(const profile of [{name:'desktop',engine:chromium,width:1360},{name:'iphone',engine:webkit,width:390}]){
  const browser=await profile.engine.launch({headless:true});let page;const unexpected=[],errors=[];
  try{
   page=await browser.newPage({viewport:{width:profile.width,height:880},isMobile:profile.width<500,hasTouch:profile.width<500});
   page.on('pageerror',e=>errors.push(String(e.message)));
   page.on('request',r=>{const u=new URL(r.url());if(u.origin!==HOST)unexpected.push(r.url());});
   await page.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(url.origin!==HOST){unexpected.push(url.toString());return route.abort('blockedbyclient');}
     const rel=decodeURIComponent(url.pathname).slice(1);
     if(!rel||rel.includes('..')||!fs.existsSync(rel)||!fs.statSync(rel).isFile())return route.fulfill({status:404,body:'',contentType:'text/plain'});
     const body=fs.readFileSync(rel),ct=TYPES[path.extname(rel)]||'application/octet-stream';
     return route.fulfill({status:200,body,contentType:ct});
   });
   await page.goto(HOST+'/zerowiz-demo.html',{waitUntil:'domcontentloaded'});
   const frame=page.frameLocator('iframe.frame');
   await frame.locator('[data-zw-role]').first().waitFor({timeout:16000});
   assert.equal(await frame.locator('[data-zw-role]').count(),5,'five demo accounts');
   const safety=frame.locator('[data-zw-role="zw-safety"]');
   await safety.click();
   await frame.locator('.app-shell.shell-v411').waitFor({timeout:16000});
   const safetyView=await frame.locator('#view').innerText();
   assert.ok(safetyView.includes('전체 사업장 사고현황'),'real safety homepage is rendered');
   assert.ok(!safetyView.includes('소피아그린')&&!safetyView.includes('백양우리'),'real site names never shown');
   assert.ok(safetyView.includes('가상 솔빛 골프장'),'fake business appears in real safety site dashboard');
   assert.ok(await frame.locator('.shell411-nav').count()>0,'operational app nav present');
   const intro=await frame.locator('body').evaluate(()=>({origin:window.origin,api:window.ENL_ZEROWIZ_FIDELITY?.version,network:window.ENL_ZEROWIZ_FIDELITY?.getNetworkBlocks(),active:window.ENL_ZEROWIZ_FIDELITY?.getRole()}));
   assert.equal(intro.origin,'null','demo must run with opaque sandbox origin');
   assert.equal(intro.active,'zw-safety');
   assert.equal(intro.api,'2.0.0');
   await frame.locator('#zwRuntimeRoleSelect').selectOption('zw-field');
   await frame.locator('.app-shell.shell-v411').waitFor();
   const fieldView=await frame.locator('body').innerText();
   assert.ok(fieldView.includes('가상 솔빛 골프장'),'operational field shell');
   await frame.locator('[data-view="report"]').first().click().catch(async()=>{await frame.locator('button:has-text("사고 등록")').first().click()});
   await frame.locator('#unifiedReportForm').waitFor({timeout:10000});
   assert.equal(await frame.locator('#environmentCause410,#behaviorCause410').count(),0,'actual field report excludes cause input');
   assert.ok(await frame.locator('.report410-section').count()>=3,'real report section styles and fields');
   await frame.locator('#zwRuntimeRoleSelect').selectOption('zw-worker');
   await frame.locator('.app-shell.shell-v411').waitFor();
   assert.equal(await frame.locator('#zwRuntimeRoleSelect').inputValue(),'zw-worker');
   await frame.locator('#zwRuntimeRoleSelect').selectOption('zw-manager');
   await frame.locator('.app-shell.shell-v411').waitFor();
   assert.ok(await frame.locator('#view').count()>0);
   await frame.locator('#zwRuntimeRoleSelect').selectOption('zw-executive');
   await frame.locator('.app-shell.shell-v411').waitFor();
   const state=await frame.locator('body').evaluate(()=>({role:window.ENL_ZEROWIZ_FIDELITY.getRole(),counts:window.ENL_ZEROWIZ_FIDELITY.getRecords().length,network:window.ENL_ZEROWIZ_FIDELITY.getNetworkBlocks()}));
   assert.equal(state.role,'zw-executive');assert.equal(state.counts,11);
   assert.deepEqual(unexpected,[],'must not send any request to operational Supabase or external URLs');
   assert.deepEqual(errors,[],'operational UI scripts execute without errors in demo sandbox');
   console.log('PASS zerowiz fidelity '+profile.name+' live application layouts, 5 roles, role switch, real accident form, offline sandbox, zero external requests, '+state.counts+' synthetic incidents');
  }catch(e){
   console.error('DEMO UI DIAG',profile.name,String(e),{errors,unexpected},(await page?.locator('body')?.innerText().catch(()=>''))?.slice(0,1100));
   throw e;
  }finally{await page?.close();await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});