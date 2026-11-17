const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<body><main><button id="nav">이동</button></main><section id="already"></section></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;w.eval(fs.readFileSync('processing-state.js','utf8'));d.getElementById('already').inert=true;
 let calls=0;d.getElementById('nav').onclick=()=>calls++;
 const end1=w.ENLProcessing.begin(),end2=w.ENLProcessing.begin();
 assert.equal(d.querySelectorAll('.enl-processing').length,1);assert.equal(d.querySelector('main').inert,true);
 d.getElementById('nav').click();assert.equal(calls,0);assert.equal(w.ENLProcessing.active(),true);
 await new Promise(r=>setTimeout(r,200));assert.equal(d.querySelector('.enl-processing').style.opacity,'1');
 end1();end1();assert.equal(w.ENLProcessing.active(),true);end2();assert.equal(w.ENLProcessing.active(),false);
 assert.equal(d.querySelector('.enl-processing'),null);assert.equal(d.getElementById('already').inert,true);assert.ok(!d.querySelector('main').inert);
 d.getElementById('nav').click();assert.equal(calls,1);
 let end;try{end=w.ENLProcessing.begin();throw Error('upload timeout')}catch{}finally{end()}
 assert.equal(d.querySelector('.enl-processing'),null);
 const dialog=d.createElement('dialog');dialog.setAttribute('open','');dialog.innerHTML='<button>원래 버튼</button>';d.body.append(dialog);
 const end3=w.ENLProcessing.begin();assert.ok(dialog.querySelector('.enl-processing'));assert.equal(dialog.inert,undefined);end3();
 dom.window.close();console.log('PASS local processing lock, nested operations, duplicate release, prior inert state, error release and dialog layering');
})();
