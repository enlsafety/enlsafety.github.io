'use strict';
// Browser regression: mixed PDF text headers + scanned body/estimate.
// Everything here is synthetic. No production reports, API or login.
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http');
const {chromium,webkit}=require('playwright');

async function run(engine){
 const server=http.createServer((_,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body>hybrid PDF isolated QA</body></html>')});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await engine.launch();
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   const reports=[
    {native:'사고경위서\n보고서 2025.07.15',raster:true,ocr:'사고경위서\n사고일자 2025.07.14\n사업장명 가상CC\n작업자가 예초작업을 수행하던 중 바닥에 놓인 시설물과 접촉하여 시설물이 파손됨.\n피해정도 시설물 파손'},
    {native:'견 적 서\n2025.07.16 수신',raster:true,ocr:'견 적 서\n합계금액 금 일십삼만오천칠백원 (\\ 135,700)\n공급가액 123,364원\n부가세 12,336원'},
    {native:'사고경위서\n사고일자 2025.05.11\n사고장소 실험실\n사고내용 시료 운반 중 컵 파손',raster:true,ocr:'읽을 수 없는 광고 이미지',expected:'native'},
    {native:'사고발생일자 2025.06.02',raster:false,ocr:'OCR가 실행되면 안 됩니다',expected:'native'}
   ];
   window.__qa={calls:[],ops:[],reports};
   window.pdfjsLib={
    OPS:{paintImageXObject:85,paintJpegXObject:82,paintInlineImageXObject:86,paintImageXObjectRepeat:87},
    GlobalWorkerOptions:{},
    getDocument:()=>({
     promise:Promise.resolve({
      numPages:reports.length,
      getPage:async n=>{
       const report=reports[n-1];
       return {
        getTextContent:async()=>({items:[{str:report.native,transform:[1,0,0,1,0,0],width:120}]}),
        getOperatorList:async()=>{window.__qa.ops.push(n);return {fnArray:report.raster?[85]:[]}},
        getViewport:()=>({width:110+n,height:50}),
        render:()=>({promise:Promise.resolve(),cancel:()=>{}})
       };
      },
      destroy:async()=>{}
     }),destroy:async()=>{}
    })
   };
   window.Tesseract={createWorker:async()=>({
    recognize:async canvas=>{const n=canvas.width-110;window.__qa.calls.push(n);return {data:{text:reports[n-1].ocr,confidence:91}};},
    terminate:async()=>{}
   })};
  });
  await page.addScriptTag({content:fs.readFileSync('historical-bulk-extract-v454.js','utf8')});
  const result=await page.evaluate(async()=>{
   const bytes=new Uint8Array([37,80,68,70,45,49,46,55,10,49,10]);
   const file=new File([bytes],'가상사고경위서.pdf',{type:'application/pdf'});
   const e=await window.ENLHistoricalBulkExtract454.read(file);
   window.ENLHistoricalBulkExtract454.releaseOcrWorker();
   return {method:e.method,units:e.units,hash:e.hash,calls:window.__qa.calls,ops:window.__qa.ops};
  });
  assert.equal(result.units.length,4);
  assert.equal(result.method,'ocr');
  assert.equal(result.units[0].method,'ocr','scanned incident body selected despite selectable header');
  assert.match(result.units[0].text,/예초작업/);
  assert.equal(result.units[1].method,'ocr','embedded quote recovered despite selectable footer');
  assert.match(result.units[1].text,/135,700/);
  assert.equal(result.units[2].method,'text','short but valid native layer beats poor OCR from a logo');
  assert.match(result.units[2].text,/시료 운반/);
  assert.equal(result.units[3].method,'text','pure native page is not unnecessarily OCRed');
  assert.deepEqual(result.calls,[1,2,3],'OCR only raster pages with sparse text');
  assert.deepEqual(result.ops,[1,2,3,4],'raster check used without enumerating images');
  assert.equal(result.hash.length,64);
  assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),'hybrid PDF incident and quote OCR, native-text protection and unchanged fingerprinting');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
(async()=>{await run(chromium);await run(webkit)})().catch(e=>{console.error(e);process.exit(1)});
