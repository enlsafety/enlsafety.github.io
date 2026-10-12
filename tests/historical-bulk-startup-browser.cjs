'use strict';
// Full shipped HTML and scripts in a fresh browser profile. No mock globals and no login.
// Every external/backend request is blocked; this test never reaches a live API.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const repo=path.resolve(__dirname,'..');
const stable=fs.readFileSync(path.join(repo,'stable412.html'),'utf8');
const expectedBuild=stable.match(/name="enl-build" content="([^"]+)"/)[1];
const expectedAuth=fs.readFileSync(path.join(repo,'auth-v411.js'),'utf8').match(/const VERSION='([^']+)'/)[1];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
async function run(engine,origin,width){
 const options=engine.name()==='chromium'&&process.env.PW_CHROMIUM_EXECUTABLE?{executablePath:process.env.PW_CHROMIUM_EXECUTABLE}:{};
 const browser=await engine.launch(options);const context=await browser.newContext({viewport:{width,height:844},locale:'ko-KR',permissions:[]});
 const page=await context.newPage(),errors=[],blocked=[];
 try{
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin||!['GET','HEAD'].includes(request.method())){blocked.push({method:request.method(),host:url.hostname,path:url.pathname});return route.abort()}return route.continue()});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.waitForURL('**/stable412.html?**');
  for(let round=0;round<2;round++){
   if(round)await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForSelector('#loginName411',{state:'visible'});await page.waitForLoadState('networkidle');
   const state=await page.evaluate(()=>({auth:window.ENL_AUTH_VERSION,build:document.querySelector('meta[name="enl-build"]')?.content,version:window.ENL_DEPLOY_VERSION,reset:typeof window.openAdminPasswordReset,bulk:typeof window.enlStartHistoricalBulk454,bulkEdit:typeof window.enlOpenHistoricalCandidate454,authenticated:!!window.currentUser?.(),name:document.getElementById('loginName411')?.value,bulkCards:document.querySelectorAll('[data-bulk-v454]').length,overflow:document.documentElement.scrollWidth>innerWidth+1}));
   assert.equal(state.auth,expectedAuth,'authentication script reaches its final initialization');
   assert.equal(state.reset,'function','password-reset callback is explicitly exported');
   assert.equal(state.build,expectedBuild);assert.equal(state.version,expectedBuild.replace(/-r\d+$/,''));
   assert.equal(state.bulk,'function');assert.equal(state.bulkEdit,'function');
   assert.equal(state.authenticated,false);assert.equal(state.name,'');assert.equal(state.bulkCards,0);assert.equal(state.overflow,false);
   assert.deepEqual(errors,[],'fresh complete app and reload must not throw startup errors');
  }
  console.log('PASS',engine.name(),width,'full stable HTML + fresh scripts + reload, auth initialization, global reset callback, bulk entry wiring, anonymous UI, no runtime errors; live backend requests blocked:',blocked.length);
 }finally{await context.close();await browser.close()}
}
(async()=>{
 const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const file=path.resolve(repo,'.'+name);if(!file.startsWith(repo+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,content)=>{if(error){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':(types[path.extname(file)]||'application/octet-stream')+(path.extname(file)==='.png'?'':';charset=utf-8'),'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content)})
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 try{await run(chromium,origin,1366);if(!process.env.PW_SKIP_WEBKIT)await run(webkit,origin,390)}finally{await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exit(1)});
