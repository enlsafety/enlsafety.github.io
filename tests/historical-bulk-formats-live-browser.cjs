'use strict';
// Real parser/OCR integration with synthetic, non-sensitive fixtures generated outside the repository.
// Usage: ENL_BULK_FIXTURE_DIR=/tmp/enl-bulk-format-qa CHROMIUM_PATH=/path/to/headless_shell node tests/historical-bulk-formats-live-browser.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const dir=process.env.ENL_BULK_FIXTURE_DIR||'/tmp/enl-bulk-format-qa',results=[];
async function main(){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head></head><body></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const launch=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{};
 if(process.env.ENL_QA_USE_ENV_PROXY==='1'&&(process.env.HTTPS_PROXY||process.env.https_proxy)){const p=new URL(process.env.HTTPS_PROXY||process.env.https_proxy);launch.proxy={server:p.protocol+'//'+p.host,bypass:'127.0.0.1,localhost',...(p.username?{username:decodeURIComponent(p.username),password:decodeURIComponent(p.password)}:{})};
  // Trust only the known runtime interception CA, never disable TLS validation globally.
  const ca=process.env.CODEX_PROXY_CERT||process.env.SSL_CERT_FILE;if(!ca)throw Error('Known runtime proxy CA is required');
  const pub=execFileSync('openssl',['x509','-in',ca,'-pubkey','-noout']),der=execFileSync('openssl',['pkey','-pubin','-outform','DER'],{input:pub});
  launch.args=['--ignore-certificate-errors-spki-list='+createHash('sha256').update(der).digest('base64')];
 }
 const browser=await chromium.launch(launch);
 try{
  const page=await browser.newPage();page.on('pageerror',e=>console.log('BROWSER_ERROR',e.message));page.on('requestfailed',req=>console.log('REQUEST_FAILED',req.url().split('?')[0],req.failure()?.errorText));
  await page.goto('http://127.0.0.1:'+server.address().port);for(const f of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js'])await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
  const files=process.env.ENL_BULK_FORMAT_FILES?process.env.ENL_BULK_FORMAT_FILES.split(','):['two-incidents.csv','two-incidents.xlsx',...(fs.existsSync(path.join(dir,'time-incidents.xlsx'))?['time-incidents.xlsx']:[]),'two-incidents.xls','text-report.pdf','scan.png','scanned-report.pdf','scan.jpg','scan.webp'];
  for(const name of files){
   const started=Date.now();try{
    console.log('START',name);
    if(name==='two-incidents.xls'){
     const rows=JSON.parse(fs.readFileSync(path.join(dir,'rows.json'),'utf8'));
     const bytes=await page.evaluate(rows=>{if(!window.XLSX)throw Error('XLSX parser unavailable');const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet(rows),'사고목록');return Array.from(new Uint8Array(window.XLSX.write(wb,{type:'array',bookType:'xls'})));},rows);fs.writeFileSync(path.join(dir,name),Buffer.from(bytes));
    }
    const result=await page.evaluate(async({name,bytes})=>{
     const file=new File([new Uint8Array(bytes)],name);let timeout;
     try{const ex=await Promise.race([window.ENLHistoricalBulkExtract454.read(file),new Promise((_,r)=>{timeout=setTimeout(()=>r(Error('extraction_timeout_180s')),180000)})]);return {method:ex.method,units:ex.units,candidates:window.ENLHistoricalBulk.analyze([ex],[{site_id:'s1',site_name:'테스트CC'}]),hash:ex.hash};}finally{clearTimeout(timeout)}
    },{name,bytes:[...fs.readFileSync(path.join(dir,name))]});
    assert.equal(result.hash.length,64);
    if(/\.(csv|xlsx|xls)$/.test(name)){assert.equal(result.candidates.length,2);assert.ok(result.candidates.every(c=>c.state==='ready'),JSON.stringify(result.candidates.map(c=>c.validation)));assert.equal(result.candidates[0].values.occurredDate,'2025-05-10');assert.equal(result.candidates[1].values.medicalCost,'90000');if(name==='time-incidents.xlsx')assert.equal(result.candidates[0].values.occurredTime,'09:30');}
    else if(name==='text-report.pdf'){assert.equal(result.method,'text');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].state,'ready',JSON.stringify(result.candidates[0].validation));assert.equal(result.candidates[0].values.medicalCost,'120000');}
    else{assert.equal(result.method,'ocr');const recognized=result.units.map(u=>u.text||'').join('\n');assert.ok(recognized.includes('2025')&&recognized.includes('사고'),'actual Korean and numeric OCR text');assert.ok(result.candidates.length>0);assert.ok(result.candidates.every(c=>c.state==='review'&&c.validation.some(i=>i.code==='ocr')),'OCR must require source review');}
    fs.writeFileSync(path.join(dir,name+'.result.json'),JSON.stringify(result,null,2));const row={name,status:'PASS',method:result.method,candidates:result.candidates.length,recognizedFields:result.candidates.map(c=>Object.keys(c.values).length),milliseconds:Date.now()-started};results.push(row);console.log('PASS',JSON.stringify(row));
   }catch(e){const row={name,status:'FAIL',error:String(e.message).slice(0,1200),milliseconds:Date.now()-started};results.push(row);console.log('FAIL',JSON.stringify(row));}
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(dir,'browser-results.json'),JSON.stringify(results,null,2));}
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1)});
