'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {tab}=require('./field-entry-table-browser.cjs');

const ready=p=>p.waitForFunction(()=>typeof ENLFormDrafts!=='undefined'&&data.incidents.some(i=>i.id==='sample-1'));
const draftKeys=()=>Object.keys(localStorage).filter(k=>k.startsWith('enl-form-draft-v1/'));
async function restart(p,c,logout=false){
  if(logout)await p.evaluate(()=>enlClearRefreshSession('global_update'));
  await p.close();
  const next=await c.newPage();
  await next.goto('http://ui.localhost/stable412.html?updated=1');
  await ready(next);return next;
}
async function run(engine,width){
  const browser=await engine.launch();
  try{
    for(const kind of ['person','plan','action']){
      const {p:first,c}=await tab(browser,width,kind==='action'?'field':'safety');
      let p=first;await ready(p);
      if(kind==='person'){
        await p.locator('[data-shell-view="report"]').click();await p.locator('[data-report-type="person"]').click();
        await p.locator('#pastReportMode').check();await p.locator('#pastReportDrafter').fill('시험 기안자');
        await p.locator('#reportSite').selectOption('s01');await p.locator('#occurredDate410').fill('2026-10-15');
      }else await p.evaluate(()=>openUnifiedCorrectiveModal('sample-1',currentUser()));
      const field={person:'#incidentHow410',plan:'#prev429PlanDetail',action:'#prev429ActionDetail'}[kind];
      const typed='자동저장 검수 '+kind;
      await p.locator(field).fill(typed);
      if(kind==='action'||kind==='person'){
        await p.route('**/functions/v1/enl-attachment-v411',route=>{
          const req=route.request();if(req.method()==='OPTIONS')return route.fulfill({status:204});
          return route.fulfill({json:req.postDataJSON().action==='sign'?{ok:true,urls:{}}:{ok:true,attachment:{path:'incident/site-s01/proof.pdf',name:'첨부.pdf',kind:'pdf',mime:'application/pdf',previewUrl:'https://expired.test/private-token'}}});
        });
        await p.locator(kind==='action'?'#actionPhotoInput':'#incidentPhotoInput').setInputFiles({name:'첨부.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF')});
        await p.waitForFunction(()=>Object.entries(localStorage).some(([k,v])=>k.startsWith('enl-form-draft-v1/')&&v.includes('proof.pdf')));
        assert.ok(!(await p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('enl-form-draft-v1/')).map(([,v])=>v).join(''))).includes('private-token'));
      }
      // Reload a fresh tab with no sessionStorage, including an update logout followed by the fixture login.
      p=await restart(p,c,kind!=='action');
      await p.locator('#localDraftList button').filter({hasText:'이어서 작성'}).click();
      assert.equal(await p.locator(field).inputValue(),typed);
      if(kind==='person'){
        assert.equal(await p.locator('#pastReportMode').isChecked(),true);
        assert.equal(await p.locator('#pastReportDrafter').inputValue(),'시험 기안자');
        assert.equal(await p.locator('#reportSite').inputValue(),'s01');
        assert.equal(await p.locator('#occurredDate410').inputValue(),'2026-10-15');
      }
      if(kind!=='plan')assert.match(await p.locator(kind==='action'?'#actionPhotoCount':'#incidentPhotoCount').innerText(),/1 \/ 8/);
      if(kind==='plan'){
        const submit=p.locator('#prev429PlanForm button[type=submit]');
        await p.locator('#prev429RootCause').fill('시험 원인');await p.locator('#prev429Owner').fill('시험 담당');await p.locator('#prev429Due').fill('2026-12-01');
        await p.evaluate(()=>{window.enlCommitOrNotify=async()=>false;});await submit.click();
        assert.equal((await p.evaluate(draftKeys)).length,1);
        await p.evaluate(()=>{window.enlCommitOrNotify=async()=>true;});p.on('dialog',d=>d.accept());await submit.click();
        await p.waitForFunction(()=>!document.querySelector('#prev429PlanForm'));
        assert.equal((await p.evaluate(draftKeys)).length,0);
      }else{
        if(kind==='person')await p.locator('[data-change-type]').click();else await p.evaluate(()=>closeModal());
        await p.locator('#localDraftList').waitFor();
        if(kind==='person'){
          await p.locator('button[data-report-type="person"]').click();
          assert.equal(await p.locator(field).inputValue(),'','a new accident must start empty');
          await p.locator('[data-change-type]').click();
        }else{
          await p.evaluate(()=>{data.incidents.find(i=>i.id==='sample-1')._syncVersion++;});
          await p.locator('#localDraftList').getByText('이어서 작성').click();
          assert.match(await p.locator('#localDraftList details').innerText(),new RegExp(typed));
          assert.equal(await p.locator('#prev429FieldForm').count(),0,'stale work never overwrites latest stage');
        }
        await p.evaluate(()=>{window.qaOwner=session.manager;session.manager={...qaOwner,id:'other-account'};renderShell(currentUser());});
        await p.locator('#localDraftList').waitFor({state:'detached'});
        await p.evaluate(()=>{session.manager=qaOwner;currentView='home';renderShell(currentUser());});
        await p.locator('#localDraftList').waitFor();p.on('dialog',d=>d.accept());
        await p.locator('#localDraftList').getByRole('button',{name:'삭제'}).click();
        assert.equal((await p.evaluate(draftKeys)).length,0);
      }
      await c.close();console.log('PASS',engine.name(),width,kind);
    }
  }finally{await browser.close();}
}
(async()=>{await run(chromium,1365);await run(webkit,390);})().catch(e=>{console.error(e);process.exitCode=1;});
