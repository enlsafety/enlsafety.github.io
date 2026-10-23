/* Actual browser optimizer -> isolated staging Edge -> private Storage -> signed read.
 * No production network request is sent. Only this run's synthetic objects are removed.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sharp=require('sharp'),playwright=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'qa-output');
const STAGE='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-final-lifecycle-qa-20261013';
const PRODUCTION='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-attachment-v411';
const ORIGIN='https://enlsafety.github.io',digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const actor={id:'qa-field',name:'Synthetic QA',role:'field',siteId:'qa-site'};
async function api(body,target='attachment'){
 const r=await fetch(STAGE,{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2','x-enl-qa-target':target,origin:ORIGIN},body:JSON.stringify(body)});
 return {status:r.status,body:await r.text()};
}
async function run(engine){
 const runId=engine+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex');
 const original=await sharp(Buffer.from(`<svg width="2048" height="1536"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#8db5dc"/><stop offset="1" stop-color="#edf0e4"/></linearGradient></defs><rect width="2048" height="1536" fill="url(#sky)"/><path d="M0 790 Q480 610 900 720 T2048 650 V1536 H0Z" fill="#7e9951"/><rect x="390" y="450" width="1160" height="650" fill="#bfb59e"/><path d="M290 450 L970 200 L1660 450 Z" fill="#826a52"/><rect x="540" y="620" width="280" height="420" fill="#536d77"/><rect x="1110" y="630" width="260" height="210" fill="#7d9da8"/><text x="100" y="1380" font-size="32" font-family="sans-serif">SYNTHETIC QA ${runId}</text></svg>`)).jpeg({quality:100}).toBuffer();
 const pdf=Buffer.from('%PDF-1.4\n% Synthetic staging byte test '+runId+'\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
 const browser=await playwright[engine].launch({headless:true}),page=await browser.newPage();
 const uploads=[],paths=new Set(),requests=[],blocked=[],pageErrors=[];let checks=0;
 page.on('pageerror',e=>pageErrors.push(e.message));
 const check=(fn)=>{fn();checks++;};
 try{
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url===ORIGIN+'/qa-attachment-staging')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div><input type="file" id="incidentPhotoInput"><input type="file" id="actionPhotoInput"></body></html>'});
   if(url===PRODUCTION){
    const body=JSON.parse(route.request().postData()||'{}');requests.push(body.action);
    if(body.action==='upload')uploads.push(body);
    const response=await api(body);let parsed;try{parsed=JSON.parse(response.body);}catch{}
    if(response.status!==200)console.error(JSON.stringify({engine,action:body.action,status:response.status,message:parsed?.message||'non_json_response'}));
    if(parsed?.attachment?.path)paths.add(parsed.attachment.path);
    return route.fulfill({status:response.status,contentType:'application/json',headers:{'access-control-allow-origin':ORIGIN},body:response.body});
   }
   if(url.startsWith('https://zgwxzfvvpqgdedyobwmg.supabase.co/storage/v1/object/sign/enl-final-qa-20261013/')){
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    return route.fulfill({status:response.status,headers:{'content-type':response.headers.get('content-type')||'application/octet-stream','access-control-allow-origin':ORIGIN},body:Buffer.from(await response.arrayBuffer())});
   }
   if(url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
   blocked.push(new URL(url).origin);return route.abort();
  });
  await page.goto(ORIGIN+'/qa-attachment-staging');
  await page.evaluate(actor=>{
   localStorage.setItem('enl_safety_v3',JSON.stringify({version:3,sites:[{id:'qa-site',name:'Synthetic QA'}],users:[{...actor,pinHash:'qa-proof',active:true}],incidents:[]}));
   localStorage.setItem('enl_safety_session_v3',JSON.stringify({userId:actor.id}));
  },actor);
  for(const name of ['attachment-image-v472.js','core.js'])await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,name),'utf8')});
  const output=await page.evaluate(async({image,pdf})=>{
   const file=(b64,name,type)=>new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],name,{type});
   const original=file(image,'synthetic-scene.jpg','image/jpeg'),pdfDocument=file(pdf,'synthetic-document.pdf','application/pdf');
   const compressed=await uploadAttachment(original,'incident');
   const retried=await uploadAttachment(original,'incident');
   const protectedFile=await uploadAttachment(original,'action',{preserveOriginal:true});
   const pdfFile=await uploadAttachment(pdfDocument,'incident');
   const signed=await signAttachments([compressed.path,protectedFile.path,pdfFile.path]);
   const downloads=[];
   for(const attachment of [compressed,protectedFile,pdfFile]){
    const r=await fetch(signed[attachment.path]);if(!r.ok)throw Error('Signed download failed '+r.status);
    const bytes=new Uint8Array(await r.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    downloads.push({attachment,bytes:btoa(binary)});
   }
   const img=new Image();img.src=signed[compressed.path];await img.decode();
   return {compressed,retried,protectedFile,pdfFile,downloads,dimensions:[img.naturalWidth,img.naturalHeight],persisted:persistAttachment(compressed)};
  },{image:original.toString('base64'),pdf:pdf.toString('base64')});
  check(()=>assert.deepEqual(blocked,[],'no unexpected network origin'));
  check(()=>assert.deepEqual(pageErrors,[],'full scripts load without browser errors'));
  check(()=>assert.equal(uploads.length,4));
  check(()=>assert.equal(output.compressed.optimization.mode,'full_resolution','representative image compresses after quality gate'));
  check(()=>assert.ok(output.compressed.size<original.length));
  check(()=>assert.deepEqual(output.dimensions,[2048,1536],'signed image decodes with original dimensions'));
  check(()=>assert.equal(output.compressed.path,output.retried.path,'actual retry deduplicates'));
  check(()=>assert.equal(paths.size,3,'exactly three unique staging objects'));
  check(()=>assert.equal(output.protectedFile.optimization.mode,'original'));
  check(()=>assert.deepEqual(Buffer.from(uploads[2].file.base64,'base64'),original,'protected original request exact'));
  check(()=>assert.deepEqual(Buffer.from(uploads[3].file.base64,'base64'),pdf,'PDF request exact'));
  for(const [idx,requestIndex] of [[0,0],[1,2],[2,3]]){
   const downloaded=Buffer.from(output.downloads[idx].bytes,'base64'),sent=Buffer.from(uploads[requestIndex].file.base64,'base64');
   check(()=>assert.deepEqual(downloaded,sent,'actual private Storage signed bytes match browser output'));
   check(()=>assert.equal(digest(downloaded),output.downloads[idx].attachment.sha256,'server verified digest matches download'));
   check(()=>assert.equal(output.downloads[idx].attachment.optimization.sourceSha256,digest(idx===2?pdf:original),'source evidence digest preserved'));
  }
  check(()=>assert.equal(output.persisted.previewUrl,undefined,'DB reference omits signed URL'));
  check(()=>assert.equal(output.persisted.base64,undefined,'DB reference omits image bytes'));
  return {engine,passed:checks,failed:0,runId,sourceBytes:original.length,outputBytes:output.compressed.size,savingPercent:Number(((1-output.compressed.size/original.length)*100).toFixed(2)),requests:requests.length,objects:paths.size};
 }finally{
  await browser.close();
  if(paths.size){const r=await api({actor,actorPinHash:'qa-proof',paths:[...paths]},'attachment_cleanup');assert.equal(r.status,200,'cleanup only current synthetic objects');}
 }
}
(async()=>{const results=[];for(const engine of ['chromium','webkit'])results.push(await run(engine));fs.mkdirSync(OUT,{recursive:true});const report={at:new Date().toISOString(),scope:'Actual staging Edge/Storage. Browser route forwards production endpoint requests only to staging; no production writes. Linux Chromium/WebKit, not physical iPhone/Safari.',results,cleanup:'All unique synthetic objects created by this run removed'};fs.writeFileSync(path.join(OUT,'attachment-browser-staging.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
