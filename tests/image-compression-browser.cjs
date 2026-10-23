/* Deterministic synthetic image regression fixtures. No production records or photos. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sharp = require('sharp');
const playwright = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'qa-output');
const FIX = path.join(OUT, 'image-fixtures');
fs.mkdirSync(FIX, {recursive:true});
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
function seededPixels(width,height) {
  const pixels = Buffer.alloc(width*height*3); let seed=321029;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    const n=((seed>>>24)-128)*.13;
    const offset=(y*width+x)*3;
    const floor=y>height*.58;
    pixels[offset] = Math.max(0,Math.min(255, (floor?150:80)+x/width*48+n+10*Math.sin(x/110)));
    pixels[offset+1] = Math.max(0,Math.min(255,(floor?143:108)+y/height*34+n));
    pixels[offset+2] = Math.max(0,Math.min(255,(floor?125:121)+x/width*22+n));
  }
  return pixels;
}
async function fixtures(){
  const width=2304,height=1728;
  const overlay=Buffer.from(`<svg width="${width}" height="${height}"><rect x="290" y="260" width="1550" height="1050" rx="38" fill="#8c9499" stroke="#535a60" stroke-width="24"/><rect x="390" y="340" width="970" height="330" rx="12" fill="#ffd63a"/><text x="425" y="395" font-size="38" font-family="sans-serif" font-weight="bold" fill="#101018">EVIDENCE QUALITY TEST - SYNTHETIC</text><text x="425" y="445" font-size="28" font-family="sans-serif" fill="#111">Equipment ID: ENL-2026-1023 / 220V / 60Hz</text><text x="425" y="490" font-size="18" font-family="sans-serif" fill="#111">Small print: 0.25 mm / 2026-10-23 14:32:07 / A8B3-1I0O</text><text x="425" y="527" font-size="13" font-family="sans-serif" fill="#111">Fine print: ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 2026-10-23</text><text x="425" y="563" font-size="16" font-family="sans-serif" fill="#b81621">RED LABEL: damage mark 0.50 mm / inspection 2026-10-23</text><text x="425" y="600" font-size="16" font-family="sans-serif" fill="#1033ba">BLUE LABEL: serial no. ENL-09-82-44 / 380V</text><path d="M490 820L541 840L561 879L602 890L628 934L680 958L710 1004L740 1017" fill="none" stroke="#24272b" stroke-width="1.5"/><path d="M603 890L595 925L570 951" fill="none" stroke="#20252b" stroke-width="1"/><circle cx="1590" cy="520" r="125" fill="#4a5961" stroke="#b8c0c2" stroke-width="8"/><circle cx="1590" cy="520" r="80" fill="#293a44"/><rect x="1490" y="760" width="180" height="270" fill="#69544b"/><path d="M1497 790L1664 998M1497 840L1658 960" stroke="#b36a49" stroke-width="2"/><text x="420" y="1160" font-size="24" fill="#fff" font-family="sans-serif">SYNTHETIC ONLY - no actual incident or personal information</text></svg>`);
  const scene=sharp(seededPixels(width,height),{raw:{width,height,channels:3}}).composite([{input:overlay}]);
  await scene.clone().jpeg({quality:99,chromaSubsampling:'4:4:4'}).toFile(path.join(FIX,'scene-detail.jpg'));
  await scene.clone().webp({quality:98}).toFile(path.join(FIX,'scene-detail.webp'));
  await scene.clone().png().toFile(path.join(FIX,'scene-detail.png'));

  const generalSvg=Buffer.from('<svg width="2048" height="1536"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#8db5dc"/><stop offset="1" stop-color="#edf0e4"/></linearGradient><linearGradient id="grass"><stop stop-color="#537f42"/><stop offset="1" stop-color="#a0ac5c"/></linearGradient><linearGradient id="wall"><stop stop-color="#ded5bf"/><stop offset="1" stop-color="#aaa490"/></linearGradient></defs><rect width="2048" height="1536" fill="url(#sky)"/><path d="M0 790 Q480 610 900 720 T2048 650 V1536 H0Z" fill="url(#grass)"/><rect x="390" y="450" width="1160" height="650" fill="url(#wall)"/><path d="M290 450 L970 200 L1660 450 Z" fill="#826a52"/><rect x="540" y="620" width="280" height="420" fill="#536d77"/><rect x="1110" y="630" width="260" height="210" fill="#7d9da8"/><path d="M1240 630V840M1110 735H1370" stroke="#cbc8ba" stroke-width="15"/><path d="M650 1040L400 1536H1350L800 1040" fill="#c6baa3"/><circle cx="1750" cy="700" r="170" fill="#55764d"/><rect x="1730" y="740" width="32" height="400" fill="#856546"/></svg>');
  await sharp(generalSvg).jpeg({quality:100}).toFile(path.join(FIX,'general-scene.jpg'));
  await sharp(generalSvg).withIccProfile('p3').jpeg({quality:100}).toFile(path.join(FIX,'color-profile.jpg'));
  await sharp(generalSvg).withIccProfile('srgb').jpeg({quality:100}).toFile(path.join(FIX,'srgb-profile.jpg'));
  await sharp(generalSvg).toColourspace('rgb16').png().toFile(path.join(FIX,'high-depth.png'));
  const rotated=await sharp(generalSvg).jpeg({quality:100}).withMetadata({orientation:6}).toBuffer();
  const parts=[rotated.subarray(0,2)];let pos=2;
  while(pos<rotated.length){const marker=rotated[pos+1];if(marker===0xda){parts.push(rotated.subarray(pos));break;}const len=rotated.readUInt16BE(pos+2),end=pos+len+2;if(!(marker===0xe2&&rotated.subarray(pos+4,pos+15).toString()==='ICC_PROFILE'))parts.push(rotated.subarray(pos,end));pos=end;}
  fs.writeFileSync(path.join(FIX,'orientation6.jpg'),Buffer.concat(parts));
  const textSvg=Buffer.from('<svg width="1300" height="800"><rect width="1300" height="800" fill="white"/><text x="40" y="60" font-size="30" font-family="sans-serif">Document and label fidelity - synthetic</text>'+Array.from({length:20},(_,i)=>`<text x="40" y="${115+i*30}" font-size="${11+(i%6)}" font-family="sans-serif" fill="${['#111','#c12032','#1f35b8'][i%3]}">Row ${i+1} - 2026-10-23 / Serial A8B3-I10O / pressure 0.25 MPa / 1234567890</text>`).join('')+'</svg>');
  await sharp(textSvg).png().toFile(path.join(FIX,'fine-document.png'));
  await sharp(Buffer.from('<svg width="900" height="600"><rect x="100" y="100" width="500" height="320" rx="20" fill="#13a8dc" fill-opacity=".5"/><text x="120" y="280" font-size="32" font-family="sans-serif" fill="#97122a">Transparent evidence label 123</text></svg>')).png().toFile(path.join(FIX,'alpha.png'));
  fs.writeFileSync(path.join(FIX,'document.pdf'),Buffer.from('%PDF-1.4\n% SYNTHETIC UNMODIFIED BYTE TEST\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'));
  fs.writeFileSync(path.join(FIX,'unsupported.heic'),Buffer.from([0,0,0,24,102,116,121,112,104,101,105,99,0,0,0,0,104,101,105,99]));
  return [
    ['general-scene.jpg','image/jpeg'],['color-profile.jpg','image/jpeg'],['srgb-profile.jpg','image/jpeg'],['high-depth.png','image/png'],['scene-detail.jpg','image/jpeg'],['scene-detail.png','image/png'],['scene-detail.webp','image/webp'],['fine-document.png','image/png'],['alpha.png','image/png'],['orientation6.jpg','image/jpeg'],['document.pdf','application/pdf'],['unsupported.heic','image/heic']
  ].map(([name,mime])=>({name,mime,bytes:fs.readFileSync(path.join(FIX,name))}));
}
async function runBrowser(engine, inputs) {
  const browser=await playwright[engine].launch({headless:true});
  const page=await browser.newPage({viewport:{width:1400,height:1060}});
  const rows=[];
  try {
    await page.route('http://localhost:9987/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'}));
    await page.goto('http://localhost:9987/');
    await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'attachment-image-v472.js'),'utf8')});
    async function prepare(input, options={}, forceNull=false) {
      return page.evaluate(async ({name,mime,b64,options,forceNull})=>{
        const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
        const file=new File([bytes],name,{type:mime});
        const readDimensions=blob=>new Promise(resolve=>{const image=new Image(),url=URL.createObjectURL(blob);image.onload=()=>{URL.revokeObjectURL(url);resolve([image.naturalWidth,image.naturalHeight])};image.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};image.src=url});
        const native=HTMLCanvasElement.prototype.toBlob;
        if(forceNull)HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)};
        let result;
        try {result=await ENLImageOptimizer.prepare(file,options);} finally{HTMLCanvasElement.prototype.toBlob=native;}
        const outBytes=new Uint8Array(await result.file.arrayBuffer());
        let binary='';for(let i=0;i<outBytes.length;i+=32768)binary+=String.fromCharCode(...outBytes.subarray(i,i+32768));
        return {optimization:result.optimization,name:result.file.name,mime:result.file.type,size:result.file.size,b64:btoa(binary),sourceDimensions:await readDimensions(file),outputDimensions:await readDimensions(result.file)};
      },{name:input.name,mime:input.mime,b64:input.bytes.toString('base64'),options,forceNull});
    }
    for(const input of inputs) {
      const result=await prepare(input);
      const bytes=Buffer.from(result.b64,'base64');
      assert.equal(bytes.length,result.size,input.name+' bytes');
      if(input.name.endsWith('.webp'))assert.notEqual(result.optimization.reason,'animated_image','static WebP must not be classified as animated');
      if(result.sourceDimensions)assert.deepEqual(result.outputDimensions,result.sourceDimensions,input.name+' must preserve decoded resolution/orientation');
      assert.ok(result.size<=input.bytes.length,input.name+' never grows');
      assert.equal(result.optimization.sourceBytes,input.bytes.length,input.name+' source size');
      assert.equal(result.optimization.outputBytes,result.size,input.name+' output size');
      if(result.optimization.sourceSha256)assert.equal(result.optimization.sourceSha256,digest(input.bytes),input.name+' source hash');
      if(result.optimization.sha256)assert.equal(result.optimization.sha256,digest(bytes),input.name+' output hash');
      if(input.mime==='application/pdf'||input.mime==='image/heic'||input.name==='color-profile.jpg'||input.name==='high-depth.png')assert.deepEqual(bytes,input.bytes,input.name+' bytes must remain untouched');
      if(input.name==='srgb-profile.jpg'){assert.equal(result.optimization.sourceColorProfile,'verified_srgb','standard numeric sRGB profile recognized');assert.equal(result.optimization.mode,'full_resolution','standard sRGB source compresses after quality check');}
      if(input.name==='alpha.png') {
        const a=await sharp(input.bytes).ensureAlpha().raw().toBuffer(),b=await sharp(bytes).ensureAlpha().raw().toBuffer();
        for(let i=3;i<a.length;i+=4)assert.equal(b[i],a[i],'alpha channel exact');
      }
      const filename=`image-${engine}-${input.name.replace(/\.[^.]+$/,'')}.${result.mime==='image/webp'?'webp':result.mime==='image/jpeg'?'jpg':result.mime==='image/png'?'png':input.name.split('.').pop()}`;
      fs.writeFileSync(path.join(OUT,filename),bytes);
      rows.push({fixture:input.name,sourceBytes:input.bytes.length,outputBytes:result.size,savingPercent:Number(((1-result.size/input.bytes.length)*100).toFixed(2)),sourceDimensions:result.sourceDimensions,outputDimensions:result.outputDimensions,optimization:result.optimization});
      if(input.name==='general-scene.jpg'||input.name==='scene-detail.jpg'||input.name==='fine-document.png') {
        const before='data:'+input.mime+';base64,'+input.bytes.toString('base64'),after='data:'+result.mime+';base64,'+result.b64;
        await page.evaluate(({before,after,doc})=>{
          const crop=doc?{x:35,y:105,w:620,h:180}:{x:420,y:470,w:780,h:150};
          const crack={x:480,y:810,w:300,h:220};
          document.body.innerHTML='<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#eef2f6;font-family:sans-serif;color:#142a3b}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:14px 0}figure{margin:0;min-width:0;overflow:hidden;background:white;padding:12px;border:1px solid #bdc9d2}figcaption{font-weight:bold;margin-bottom:8px}img.full{display:block;width:100%;height:350px;object-fit:contain}.crop{height:200px;overflow:hidden;background:#fff}.crop img{display:block;max-width:none;transform:translate('+(-crop.x)+'px,'+(-crop.y)+'px);}.crack{height:255px;overflow:hidden;background:#fff}.crack img{display:block;max-width:none;transform:translate('+(-crack.x*1.15)+'px,'+(-crack.y*1.15)+'px) scale(1.15);transform-origin:0 0}</style><h2>Synthetic image quality comparison</h2><div class="pair"><figure><figcaption>Original - equal fitted view</figcaption><img class="full" src="'+before+'"></figure><figure><figcaption>Optimized - equal fitted view</figcaption><img class="full" src="'+after+'"></figure></div><div class="pair"><figure><figcaption>Original - source crop at native size</figcaption><div class="crop"><img src="'+before+'"></div></figure><figure><figcaption>Optimized - source crop at native size</figcaption><div class="crop"><img src="'+after+'"></div></figure></div>'+(doc?'':'<div class="pair"><figure><figcaption>Original - source detail at 115%</figcaption><div class="crack"><img src="'+before+'"></div></figure><figure><figcaption>Optimized - source detail at 115%</figcaption><div class="crack"><img src="'+after+'"></div></figure></div>');
        },{before,after,doc:input.name==='fine-document.png'});
        await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
        await page.screenshot({path:path.join(OUT,`image-${engine}-${input.name}-comparison.png`),fullPage:true});
      }
    }
    assert.ok(rows.some(r=>r.optimization.mode==='full_resolution'),'at least one compressed output must pass measured quality');
    const original=await prepare(inputs[0],{preserveOriginal:true});
    assert.deepEqual(Buffer.from(original.b64,'base64'),inputs[0].bytes,'explicit original protection exact bytes');
    const nullCanvas=await prepare(inputs[0],{},true);
    assert.deepEqual(Buffer.from(nullCanvas.b64,'base64'),inputs[0].bytes,'canvas encoder failure original fallback exact bytes');
    await page.evaluate(()=>{
      document.body.innerHTML='<div id="app"></div><input id="incidentPhotoInput" type="file"><input id="actionPhotoInput" type="file">';
      localStorage.setItem('enl_safety_v3',JSON.stringify({version:3,sites:[{id:'qa-site',name:'Synthetic test'}],users:[{id:'qa-field',name:'Synthetic QA',role:'field',siteId:'qa-site',active:true}],incidents:[]}));
      localStorage.setItem('enl_safety_session_v3',JSON.stringify({userId:'qa-field'}));
    });
    await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'core.js'),'utf8')});
    const pipeline=await page.evaluate(async({pdfB64,imageB64})=>{
      window.__requests=[];let failNext=true,signCount=0;
      window.fetch=async(url,init)=>{const body=JSON.parse(init.body);window.__requests.push(body);if(body.action==='sign'){signCount++;return {ok:true,json:async()=>({ok:true,urls:Object.fromEntries(body.paths.map(p=>[p,'https://files.test/renewed-'+signCount]))})};}if(failNext){failNext=false;return {ok:false,json:async()=>({ok:false,message:'storage_failure'})};}return {ok:true,json:async()=>({ok:true,attachment:{path:'incident/qa/'+window.__requests.length,name:body.file.name,mime:body.file.mime,size:body.file.size,kind:body.file.mime==='application/pdf'?'pdf':'image'}})};};
      const file=(b64,name,type)=>new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],name,{type});
      const pdf=file(pdfB64,'proof.pdf','application/pdf');let firstFailure='';
      try{await uploadAttachment(pdf,'incident')}catch(e){firstFailure=e.message}
      const saved=await uploadAttachment(pdf,'incident');
      const image=await uploadAttachment(file(imageB64,'label.png','image/png'),'action',{preserveOriginal:true});
      const uploads=window.__requests.filter(x=>x.action==='upload');
      const persisted=enlPersistAttachment({...saved,previewUrl:'https://expired.test',url:'https://expired.test',storageUrl:'https://expired.test',dataUrl:'data:huge',base64:'duplicate'});
      let viewerHTML='',openedPdf='';window.open=()=>({document:{open(){},write(html){viewerHTML=html},close(){},getElementById(){return null}},focus(){},location:{replace(url){openedPdf=url}},close(){}});
      await openAttachment({path:'incident/qa/expired.jpg',mime:'image/jpeg',name:'old.jpg',previewUrl:'https://expired.test/old.jpg'});
      const imageViewerHTML=viewerHTML;
      await openAttachment({path:'incident/qa/expired.pdf',mime:'application/pdf',name:'old.pdf',previewUrl:'https://expired.test/old.pdf'});
      return {firstFailure,pdfBase64:uploads[1].file.base64,pdfSourceHash:uploads[1].file.optimization.sourceSha256,imageBase64:uploads[2].file.base64,imageMode:uploads[2].file.optimization.mode,uploadCount:uploads.length,persisted,viewerHTML:imageViewerHTML,openedPdf};
    },{pdfB64:inputs.find(x=>x.mime==='application/pdf').bytes.toString('base64'),imageB64:inputs.find(x=>x.name==='fine-document.png').bytes.toString('base64')});
    assert.ok(pipeline.firstFailure,'failed upload returns an actionable error');
    assert.equal(pipeline.uploadCount,3,'one failed PDF request, one explicit retry, one original-protected image');
    assert.deepEqual(Buffer.from(pipeline.pdfBase64,'base64'),inputs.find(x=>x.mime==='application/pdf').bytes,'PDF upload preserves bytes');
    assert.equal(pipeline.pdfSourceHash,digest(inputs.find(x=>x.mime==='application/pdf').bytes),'PDF upload records source SHA-256');
    assert.deepEqual(Buffer.from(pipeline.imageBase64,'base64'),inputs.find(x=>x.name==='fine-document.png').bytes,'protected image upload preserves bytes');
    assert.equal(pipeline.imageMode,'original');
    assert.ok(pipeline.viewerHTML.includes('https://files.test/renewed-'));assert.ok(!pipeline.viewerHTML.includes('expired.test'),'expired image URL must be replaced');assert.ok(pipeline.openedPdf.startsWith('https://files.test/renewed-'),'PDF open requests a fresh signed URL');
    for(const key of ['base64','dataUrl','previewUrl','url','storageUrl'])assert.equal(pipeline.persisted[key],undefined,'storage reference drops ephemeral or duplicate '+key);
    const lockResult=await page.evaluate(async()=>{
      document.body.insertAdjacentHTML('beforeend','<form id="image-lock-form"><button id="was-disabled" disabled>Already disabled</button><button id="save-image" type="submit">Save</button>'+photoPickerHtml('incident')+'</form>');
      const form=document.getElementById('image-lock-form'),pending=[];let submitted=0;
      form.addEventListener('submit',e=>{e.preventDefault();submitted++});window.alert=()=>{};
      window.fetch=async(url,init)=>{const body=JSON.parse(init.body);if(body.action==='sign')return {ok:true,json:async()=>({ok:true,urls:{}})};return new Promise(resolve=>pending.push(()=>resolve({ok:true,json:async()=>({ok:true,attachment:{path:'incident/qa/deduplicated',name:'test.pdf',mime:'application/pdf',kind:'pdf',size:4}})})));};
      const f=new File(['%PDF'],'test.pdf',{type:'application/pdf'}),one=addFiles([], [f], 'incident'),two=addFiles([], [f], 'incident');
      while(pending.length<2)await new Promise(r=>setTimeout(r,5));
      const during={busy:form.getAttribute('aria-busy'),saveDisabled:document.getElementById('save-image').disabled};
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      pending.shift()();await one;const afterOne=form.getAttribute('aria-busy');
      pending.shift()();const files=await two;const afterBoth={busy:form.getAttribute('aria-busy'),saveDisabled:document.getElementById('save-image').disabled,priorDisabled:document.getElementById('was-disabled').disabled,submitted};
      const third=addFiles(files,[f],'incident');while(!pending.length)await new Promise(r=>setTimeout(r,5));pending.shift()();const merged=await third;
      return {during,afterOne,afterBoth,deduplicatedCount:merged.length};
    });
    assert.equal(lockResult.during.busy,'true');assert.equal(lockResult.during.saveDisabled,true);
    assert.equal(lockResult.afterOne,'true','first completion cannot unlock concurrent upload');
    assert.equal(lockResult.afterBoth.busy,null);assert.equal(lockResult.afterBoth.saveDisabled,false);assert.equal(lockResult.afterBoth.priorDisabled,true);assert.equal(lockResult.afterBoth.submitted,0);
    assert.equal(lockResult.deduplicatedCount,1,'identical storage object retry creates one attachment reference');
    return {engine,status:'passed',fixtureCount:inputs.length,checks:['decoded resolution and orientation','never increases size','bytes and hashes','PDF byte preservation','HEIC original protection','ICC color profile preservation','verified standard sRGB optimization','16-bit PNG original protection','alpha exact','explicit original protection','encoder failure fallback','upload failure and explicit retry','PDF and protected image request bytes','persistent attachment drops signed URLs and duplicate bytes','concurrent upload form lock','original disabled state restored','same storage path reference deduplicated','expired image and PDF URLs renewed'],rows};
  } finally {await browser.close();}
}
(async()=>{
  const inputs=await fixtures();const results=[];
  for(const engine of ['chromium','webkit']){
    try{results.push(await runBrowser(engine,inputs));}
    catch(error){results.push({engine,status:'failed',error:String(error.stack||error)});}
  }
  const report={createdAt:new Date().toISOString(),sampleScope:'Deterministic synthetic fixtures only. This is not an average from actual incident images. Linux WebKit is not real iPhone or macOS Safari.',results};
  fs.writeFileSync(path.join(OUT,'image-compression-browser.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(results.some(r=>r.status!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
