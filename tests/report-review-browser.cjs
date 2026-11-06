'use strict';
// Full app, synthetic actors and records; production network access is blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
(async()=>{for(const profile of [{engine:chromium,width:1365,name:'desktop'},{engine:webkit,width:390,name:'mobile'}]){
 const browser=await profile.engine.launch();try{const page=await browser.newPage({viewport:{width:profile.width,height:900}}),origin='https://enl-review-qa.test';
 await page.addInitScript(()=>addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.qa)window.qaResult=event.data;}));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
  let filename=url.pathname.slice(1),body,type;
  if(filename==='qa-boot.js'){body=fs.readFileSync('tests/fixtures/report-review-boot.js');type='text/javascript';}
  else if(filename==='qa-run.js'){body=fs.readFileSync('tests/report-review-browser.js');type='text/javascript';}
  else if(filename==='stable412.html'){body=fs.readFileSync(filename,'utf8').replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="connect-src \'none\';object-src \'none\'"><script src="qa-boot.js"></script>').replace('</body>','<script src="qa-run.js"></script></body>');type='text/html';}
  else {const target=path.resolve(filename);if(!target.startsWith(process.cwd()+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.fulfill({status:404,body:''});body=fs.readFileSync(target);type=({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(filename)]||'application/octet-stream';}
  return route.fulfill({status:200,contentType:type,body});
 });
 await page.goto(origin+'/stable412.html?qa='+profile.name);await page.waitForFunction(()=>window.qaResult,{timeout:30000});const result=await page.evaluate(()=>window.qaResult);assert.equal(result.ok,true,JSON.stringify(result));console.log('PASS report review '+profile.name+': '+result.checks+' checks');
 }finally{await browser.close();}
}})().catch(error=>{console.error(error);process.exitCode=1});
