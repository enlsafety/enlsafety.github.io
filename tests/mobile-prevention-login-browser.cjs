const {chromium,webkit}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');

async function preventionButton(engine){
  const browser=await engine.launch();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.setContent('<!doctype html><html><head></head><body><div id="view"></div></body></html>');
    await page.evaluate(()=>{
      window.data={sites:[{id:'s01',name:'테스트 사업장'}],incidents:[
        {id:'inc-action',siteId:'s01',category:'property',eventType:'차량 충돌',status:'approved',occurredAt:'2026-10-02T09:00:00+09:00',corrective:{status:'planned',planAt:'2026-10-02T10:00:00+09:00',planDetail:'재발방지계획'}}
      ]};
      window.__u={id:'u1',personnelId:'u1',name:'현장소장',role:'field',position:'현장소장',siteId:'s01'};
      window.currentUser=()=>window.__u;
      window.siteById=id=>data.sites.find(s=>s.id===id);
      window.ENL_SITE_DIRECTORY=data.sites;
      window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      window.fmt=v=>String(v||'').replace('T',' ').slice(0,16);
      window.enlIncidentOverviewHtml=()=>'<div class="qa-overview">사고 상세</div>';
      window.enlIncidentQuickSummary=i=>({headline:i.eventType||'사고'});
      window.enlAddFieldBack=()=>{};
      window.openUnifiedCorrectiveModal=()=>{};
    });
    await page.addScriptTag({content:fs.readFileSync('field-incidents-v411.js','utf8')});
    await page.evaluate(()=>window.enlRenderFieldActions(document.getElementById('view'),window.__u));
    const button=page.locator('[data-field-action="inc-action"]');
    const label=button.locator('.field411-prevention-write');
    assert.equal(await label.locator(':scope > span').count(),2);
    assert.deepEqual(await label.locator(':scope > span').allTextContents(),['재발방지조치','작성하기']);
    const visual=await button.evaluate(el=>{
      const label=el.querySelector('.field411-prevention-write'),cs=getComputedStyle(label);
      return {display:cs.display,direction:cs.flexDirection,scroll:el.scrollWidth,client:el.clientWidth};
    });
    assert.equal(visual.display,'flex');
    assert.equal(visual.direction,'column');
    assert.ok(visual.scroll<=visual.client+1,'mobile prevention button must not overflow');
    console.log('PASS:',engine.name(),'mobile prevention action button wraps to two lines without clipping');
  }finally{await browser.close()}
}

async function completionDate(engine){
  const browser=await engine.launch();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.setContent('<!doctype html><html><head></head><body><div id="modalRoot"><div class="modal"><form id="prev429FieldForm" style="width:320px;max-width:100%;display:grid;grid-template-columns:minmax(0,1fr)"><label class="lbl"><span>실제 조치내용 *</span><textarea id="prev429ActionDetail"></textarea></label><div class="modal-actions"></div></form></div></div></body></html>');
    await page.evaluate(()=>{
      window.__u={id:'u1',name:'현장소장',role:'field',position:'현장소장',siteId:'s01'};
      window.currentUser=()=>window.__u;
      window.data={sites:[{id:'s01',name:'테스트 사업장'}],incidents:[]};
      window.siteById=id=>data.sites.find(s=>s.id===id);
      window.ENL_SITE_DIRECTORY=data.sites;
      window.currentView='actions';
      window.actionPhotos=[];
      window.closeModal=()=>{};
    });
    await page.addScriptTag({content:fs.readFileSync('workflow-enhancements-v432.js','utf8')});
    await page.waitForTimeout(80);
    const input=page.locator('#prev432CompletedDate');
    assert.equal(await input.count(),1);
    const visual=await input.evaluate(el=>{
      const form=el.closest('form'),label=el.closest('label'),r=el.getBoundingClientRect(),fr=form.getBoundingClientRect(),cs=getComputedStyle(el),ls=getComputedStyle(label);
      return {inputWidth:r.width,formWidth:fr.width,minWidth:cs.minWidth,maxWidth:cs.maxWidth,boxSizing:cs.boxSizing,labelWidth:label.getBoundingClientRect().width,labelMax:ls.maxWidth};
    });
    assert.ok(visual.inputWidth<=visual.formWidth+1,'completion date must stay inside mobile form');
    assert.ok(visual.labelWidth<=visual.formWidth+1,'completion date label must stay inside mobile form');
    assert.equal(visual.minWidth,'0px');
    assert.equal(visual.boxSizing,'border-box');
    console.log('PASS:',engine.name(),'mobile prevention completion date matches form width');
  }finally{await browser.close()}
}

async function loginAutoSelect(engine){
  const browser=await engine.launch();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.setContent('<!doctype html><html><head></head><body><div id="app"></div></body></html>');
    await page.evaluate(()=>{
      window.app=document.getElementById('app');
      window.currentUser=()=>null;window.roleName=()=>'';window.renderLogin=()=>{};window.openUserModal=()=>{};window.openAdminPasswordReset=()=>{};
      window.session={};window.data={users:[],sites:[{id:'s01',name:'유일사업장'},{id:'s02',name:'중복사업장A'},{id:'s03',name:'중복사업장B'}]};
      window.saveSession=()=>{};window.saveData=()=>{};window.nowISO=()=>new Date().toISOString();
      window.sha256=async v=>'hash-'+v;window.userById=()=>null;
      window.siteById=id=>data.sites.find(s=>s.id===id);window.ENL_SITE_DIRECTORY=data.sites;
      window.currentView='';window.enlPlatformSection='hub';window.ENL_PLATFORM_SECTION_KEY='qa';window.renderShell=()=>{};
      window.fetch=async (url,init)=>{
        const body=JSON.parse(init?.body||'{}');
        if(body.action==='lookup'){
          if(body.name==='김유일')return new Response(JSON.stringify({ok:true,options:[{kind:'site',siteId:'s01',affiliationLabel:'유일사업장',position:'현장소장',requiresPassword:true}]}),{status:200,headers:{'Content-Type':'application/json'}});
          if(body.name==='김동일')return new Response(JSON.stringify({ok:true,options:[
            {kind:'site',siteId:'s02',affiliationLabel:'중복사업장A',position:'현장소장',requiresPassword:true},
            {kind:'site',siteId:'s03',affiliationLabel:'중복사업장B',position:'현장소장',requiresPassword:true}
          ]}),{status:200,headers:{'Content-Type':'application/json'}});
          return new Response(JSON.stringify({ok:true,options:[]}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return new Response(JSON.stringify({ok:false,message:'qa_unexpected'}),{status:400,headers:{'Content-Type':'application/json'}});
      };
    });
    await page.addScriptTag({content:fs.readFileSync('auth-v411.js','utf8')});
    await page.evaluate(()=>window.enlRenderLogin());

    await page.fill('#loginName411','김유일');
    await page.waitForTimeout(520);
    assert.equal(await page.locator('#loginPassword411').count(),1,'unique name must go straight to password');
    assert.equal(await page.locator('.login411-summary-label').textContent(),'유일사업장');
    assert.equal(await page.locator('details.login411-aff').evaluate(el=>el.open),false);
    assert.equal(await page.locator('#loginPassword411').getAttribute('inputmode'),'numeric');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'loginPassword411','unique name should focus password keypad input');

    await page.fill('#loginName411','김동일');
    await page.waitForTimeout(520);
    assert.equal(await page.locator('#loginPassword411').count(),0,'duplicate name must not auto-select');
    assert.equal(await page.locator('.login411-aff-duplicate').count(),1);
    assert.equal(await page.locator('.login411-duplicate-warning').count(),1);
    assert.equal(await page.locator('[data-login411-aff]').count(),2);
    assert.equal(await page.locator('details.login411-aff').evaluate(el=>el.open),true);
    await page.locator('[data-login411-aff="0"]').click();
    assert.equal(await page.locator('#loginPassword411').count(),1,'duplicate flow keeps manual affiliation selection');
    assert.equal(await page.locator('.login411-summary-label').textContent(),'중복사업장A');
    console.log('PASS:',engine.name(),'unique affiliation auto-selects; duplicate-name flow stays manual');
  }finally{await browser.close()}
}

(async()=>{for(const engine of [chromium,webkit]){await preventionButton(engine);await completionDate(engine);await loginAutoSelect(engine)}})().catch(e=>{console.error(e);process.exit(1)});
