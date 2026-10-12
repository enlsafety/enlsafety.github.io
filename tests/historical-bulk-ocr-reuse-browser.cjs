'use strict';
// Browser unit checks actual extractor; fake Tesseract ensures deterministic
// worker reuse + termination on cancellation without downloading OCR models.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
async function run(engine){
 const server=http.createServer((_,res)=>{res.setHeader('content-type','text/html;charset=utf-8');res.end('<html><body>isolated extractor test</body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch(),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.__test={creates:0,recognizes:0,terminates:0,pause:false,waiting:false};
   window.Tesseract={createWorker:async()=>{
    window.__test.creates++;
    return {
     recognize:async()=>{
      window.__test.recognizes++;
      if(window.__test.pause){window.__test.waiting=true;await new Promise(()=>{})}
      return {data:{text:'사업장명: 테스트CC\n사고일: 2025-05-10',confidence:85}};
     },
     terminate:async()=>{window.__test.terminates++}
    }
   }};
  });
  await page.addScriptTag({content:fs.readFileSync('historical-bulk-extract-v454.js','utf8')});
  await page.evaluate(async()=>{
   const e=window.ENLHistoricalBulkExtract454;
   const a=await e.read(new File(['image1'],'a.png',{type:'image/png'}));
   const b=await e.read(new File(['image2'],'b.png',{type:'image/png'}));
   if(a.units[0].method!=='ocr'||b.units[0].method!=='ocr')throw Error('method must remain OCR');
  });
  assert.deepEqual(await page.evaluate(()=>({creates:window.__test.creates,recognizes:window.__test.recognizes,terminates:window.__test.terminates})),{creates:1,recognizes:2,terminates:0},'one OCR worker reused across two images');
  await page.evaluate(()=>{
   const ctrl=new AbortController(),e=window.ENLHistoricalBulkExtract454;
   window.__test.pause=true;
   window.__work=e.read(new File(['image3'],'c.png',{type:'image/png'}),null,{signal:ctrl.signal})
    .then(()=>({ok:true}),err=>({ok:false,name:err.name}));
   window.__stop=()=>ctrl.abort();
  });
  await page.waitForFunction(()=>window.__test.waiting===true);
  await page.evaluate(()=>window.__stop());
  const result=await page.evaluate(()=>window.__work);
  assert.deepEqual(result,{ok:false,name:'AbortError'},'abort promptly rejects the hung worker recognition');
  await page.waitForFunction(()=>window.__test.terminates===1);
  await page.evaluate(async()=>{
   window.__test.pause=false;
   const e=window.ENLHistoricalBulkExtract454;
   await e.read(new File(['image4'],'d.png',{type:'image/png'}));
   e.releaseOcrWorker();
  });
  await page.waitForFunction(()=>window.__test.terminates===2);
  assert.deepEqual(await page.evaluate(()=>({creates:window.__test.creates,recognizes:window.__test.recognizes})),{creates:2,recognizes:4},'fresh worker after canceled OCR; same engine reused beforehand');
  assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),'cached OCR worker, cancel busy recognition, release, restart');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium);await run(webkit)})().catch(e=>{console.error(e);process.exit(1)});
