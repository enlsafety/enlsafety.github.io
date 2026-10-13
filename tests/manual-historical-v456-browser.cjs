'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
async function run(engine,width){
 const server=http.createServer((_,res)=>{res.setHeader('content-type','text/html;charset=utf-8');res.end('<html><body><div id="view"></div></body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:860}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  // Synthetic account, isolated browser, no backend requests.
  await page.evaluate(()=>window.__qaSetup=true);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium,1366);await run(webkit,390)})().catch(e=>{console.error(e);process.exit(1)});
