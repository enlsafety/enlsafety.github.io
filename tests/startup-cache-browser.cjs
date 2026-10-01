const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  let p=decodeURIComponent(u.pathname);
  if(p==='/')p='/index.html';
  const file=path.join(root,p.replace(/^\//,''));
  if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('not found');return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
  fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',err=>err?reject(err):resolve()));
  const port=server.address().port,origin='http://127.0.0.1:'+port;
  const browser=await chromium.launch();
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  try{
    await page.goto(origin+'/stable412.html?source=pwa',{waitUntil:'domcontentloaded',timeout:15000});
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload({waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:10000});
    await page.waitForTimeout(300);

    await context.setOffline(true);
    const start=Date.now();
    await page.goto(origin+'/stable412.html?source=pwa',{waitUntil:'domcontentloaded',timeout:5000});
    await page.waitForSelector('.login-v411',{timeout:5000});
    const elapsed=Date.now()-start;
    assert.ok(elapsed<5000,'offline cached startup too slow: '+elapsed+'ms');
    console.log('PASS: installed-app shell and static assets open offline from cache in '+elapsed+'ms');
  }finally{
    await context.setOffline(false).catch(()=>{});
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);server.close(()=>{});process.exit(1)});