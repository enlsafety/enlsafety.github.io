'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const html=fs.readFileSync('stable412.html','utf8');
const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(x=>x[1]);
const imageUrl=name=>'https://enl-preview.test/files/'+name+'.svg';
const stored=(name)=>({path:'incident/'+name+'.jpg',name:name+'.jpg',kind:'image',mime:'image/jpeg'});
const picture=(name)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${name==='portrait'?300:640}" height="${name==='portrait'?600:360}"><rect width="100%" height="100%" fill="${name==='portrait'?'#e8b32e':'#4f91bc'}"/><rect x="30" y="30" width="140" height="150" fill="#173b66"/><text x="35" y="120" fill="white" font-size="28">${name}</text></svg>`;

async function launch(engine){
 let options={headless:true};
 if(process.env.ENL_QA_CHROMIUM==='sparticuz'){
  const {default:c}=await import('@sparticuz/chromium');
  options={...options,executablePath:await c.executablePath(),args:c.args.filter(x=>!/(single-process|disable-web-security|allow-running-insecure-content)/.test(x))};
 }
 return engine.launch(options);
}
async function run(engine,width){
 const browser=await launch(engine),context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<1000,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 const label=engine.name()+'-'+width;
 try{
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/files/')&&url.pathname.endsWith('.svg'))return route.fulfill({contentType:'image/svg+xml',body:picture(url.pathname.split('/').pop().slice(0,-4))});
   if(url.pathname.endsWith('.pdf'))return route.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-1.4\n% Synthetic attachment only\n%%EOF')});
   if(url.pathname!=='/fixture')return route.abort();
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><input id="incidentPhotoInput" type="file" hidden><input id="actionPhotoInput" type="file" hidden><main id="gallery"></main></body></html>'});
  });
  await page.goto('https://enl-preview.test/fixture');
  for(const file of styles)await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
  await page.addStyleTag({content:'#gallery{max-width:800px;margin:12px auto;padding:12px;box-sizing:border-box}'});
  if(process.env.QA_FONT_FILE)await page.addStyleTag({content:`@font-face{font-family:QA;src:url(data:font/woff2;base64,${fs.readFileSync(process.env.QA_FONT_FILE).toString('base64')})}body{font-family:QA,sans-serif}`});
  await page.evaluate(()=>{
   localStorage.setItem('enl_safety_v3',JSON.stringify({version:3,sites:[{id:'qa-site',name:'QA 사업장'}],users:[{id:'qa-safety',name:'QA 안전',role:'safety',active:true}],incidents:[]}));
   localStorage.setItem('enl_safety_session_v3',JSON.stringify({userId:'qa-safety',loggedAt:new Date().toISOString()}));
  });
  for(const file of ['core.js','report-v410.js','incident-review-v431.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
  await page.evaluate(originalImage=>{
   window.qaRequests=[];
   window.qaOriginalImage=originalImage;
   window.fetch=async(url,options)=>{
    const body=JSON.parse(options?.body||'{}');
    if(body.action!=='sign')throw Error('Unexpected attachment mutation: '+body.action);
    return new Promise(resolve=>qaRequests.push({paths:body.paths,resolve,done:false}));
   };
   window.qaRelease=(reverse=false,empty=false)=>{
    const pending=qaRequests.filter(x=>!x.done);if(reverse)pending.reverse();
    return pending.reduce((p,item)=>p.then(async()=>{
     item.done=true;
     const urls=Object.fromEntries(item.paths.map(path=>[path,window.qaOpeningOriginal?qaOriginalImage:'https://enl-preview.test/files/'+path.split('/').pop().replace('.jpg','.svg')]));
     item.resolve({ok:true,json:async()=>({ok:true,urls:empty?{}:urls})});
     // Give both independent preview writers time to paint, in either order.
     await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    }),Promise.resolve());
   };
  },'data:image/svg+xml;base64,'+Buffer.from(picture('front')).toString('base64'));
  const check=async(selector,expected)=>{
   await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' img')].every(i=>i.complete&&i.naturalWidth>0),selector);
   const cards=await page.locator(selector+' [data-attach-card]').evaluateAll(xs=>xs.map(card=>{
    const images=[...card.querySelectorAll('img')],box=card.getBoundingClientRect();
    return {count:images.length,iframes:card.querySelectorAll('iframe').length,sources:images.map(i=>i.src),inside:images.every(i=>{
     const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;
    })};
   }));
   assert.equal(cards.length,expected.length,label+' card count');
   cards.forEach((card,n)=>{
    assert.equal(card.count,expected[n]==='pdf'?0:1,label+' exactly one image per attachment: '+JSON.stringify(card));
    assert.equal(card.iframes,expected[n]==='pdf'?1:0,label+' PDF remains separate');
    if(expected[n]!=='pdf'){assert.ok(card.sources[0].includes(expected[n]),label+' correct image');assert.ok(card.inside,label+' preview stays within its card');}
   });
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' no horizontal overflow');
  };
  const files=[stored('front')];
  for(const reverse of [false,true]){
   await page.evaluate(files=>{qaRequests=[];window.qaFiles=files;const root=document.getElementById('gallery');root.innerHTML=enlAttachmentGalleryHtml(files);enlBindAttachmentOpen(root,files);},files);
   await page.evaluate(reverse=>qaRelease(reverse),reverse);
   await page.locator('#gallery').screenshot({path:'qa-output/attachment-'+(process.env.QA_PREVIEW_PHASE||'after')+'-'+label+'.png'});
   await check('#gallery',['front']);
   assert.equal(await page.evaluate(()=>qaRequests.length),1,'one signing request for one gallery binding');
  }
  const record={id:'qa-photo',siteId:'qa-site',category:'property',status:'approved',eventType:'설비/시설 파손',reportDetails:{incidentHow:'QA 사진 표시 확인'},photos:[stored('front'),stored('portrait'),{name:'new.jpg',kind:'image',previewUrl:imageUrl('new')}],supplement:{attachments:[{path:'incident/estimate.pdf',name:'estimate.pdf',mime:'application/pdf',kind:'pdf'}]},corrective:{actionDetail:'QA 조치 사진',afterPhotos:[stored('action')]}};
  for(let repeat=0;repeat<3;repeat++){
   await page.evaluate(record=>{qaRequests=[];window.qaRecord=record;const root=document.getElementById('gallery');root.innerHTML=enlCumulativeReportHtml(record);enlBindCumulativeReport(root,record);},record);
   await page.evaluate(reverse=>qaRelease(reverse),repeat%2===1);
   await check('[data-report-files="photos"]',['front','portrait','new']);
   await check('[data-report-files="supplement"]',['pdf']);
   await check('[data-report-files="action"]',['action']);
   assert.equal(await page.evaluate(()=>JSON.stringify(qaRecord)),JSON.stringify(record),'preview hydration must not alter saved attachment metadata');
  }
  await page.locator('[data-report-files="photos"]').screenshot({path:'qa-output/attachment-gallery-'+label+'.png'});
  // Opening an original still creates one usable image with fit/zoom controls.
  await page.evaluate(()=>window.qaOpeningOriginal=true);
  const popupEvent=context.waitForEvent('page');
  await page.locator('[data-report-files="photos"] [data-attach-open="0"]').click();
  const popup=await popupEvent;
  await page.evaluate(()=>qaRelease());
  await popup.waitForFunction(()=>document.querySelector('#photo')?.naturalWidth>0);
  assert.equal(await popup.locator('img').count(),1,'one original image');
  await popup.locator('#actual').click();await popup.locator('#fit').click();await popup.close();
  await page.evaluate(()=>window.qaOpeningOriginal=false);
  // A signing failure must leave a safe placeholder; rebinding can recover.
  await page.evaluate(files=>{qaRequests=[];window.qaFiles=files;const root=document.getElementById('gallery');root.innerHTML=enlAttachmentGalleryHtml(files);enlBindAttachmentOpen(root,files);},files);
  await page.evaluate(()=>qaRelease(false,true));
  assert.equal(await page.locator('#gallery img').count(),0);
  await page.evaluate(()=>enlBindAttachmentOpen(document.getElementById('gallery'),qaFiles));
  await page.evaluate(()=>qaRelease());await check('#gallery',['front']);
  // Existing refresh-on-expiry behavior must replace src, not append an image.
  await page.evaluate(()=>document.querySelector('#gallery img').dispatchEvent(new Event('error')));
  await page.evaluate(()=>qaRelease());await check('#gallery',['front']);
  assert.deepEqual(errors,[]);
  console.log('PASS single attachment preview:',label,'stored/new photos, response order, repeated open, scoped galleries, PDF, original, signing retry and expiry');
 }finally{await browser.close()}
}
(async()=>{
 fs.mkdirSync('qa-output',{recursive:true});
 for(const engine of process.env.ENL_QA_CHROMIUM==='sparticuz'?[chromium]:[chromium,webkit])for(const width of [1365,820,390])await run(engine,width);
})().catch(e=>{console.error(e);process.exitCode=1});
