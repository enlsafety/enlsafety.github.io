'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{fixture}=require('./final-lifecycle.cjs');
const {chromium,webkit}=require('playwright');
(async()=>{
  const f=await fixture(),password='qa-safety-fresh-password',hash=crypto.createHash('sha256').update(password).digest('hex');
  let checks=0;
  try {
    await f.db.query("update enl_hq_users set password_hash=$1 where user_id='qa-safety'",[hash]);
    const who=(role,body)=>f.raw({actor:f.actors[role],actorPasswordHash:role==='safety'?hash:'qa-proof',actorPinHash:'qa-proof',...body});
    const source={id:'qa-historical-typo',siteId:'qa-site',category:'property',
      status:'approved',recordMode:'historical_manual',summary:'카트 출입 중 장비 노타',
      eventType:'충돌',occurredAt:'2026-10-08T03:00:00Z',photos:[],corrective:null,
      reportDetails:{templateVersion:'historical-manual-v1',incidentHow:'자재와 카트 노타',place:'관리동 입구',damagedItem:'카트',damageDetail:'좌측 손상',repairCost:null},
      historicalImport:{enabled:true,sourceSystem:'ARCHIVE',erpApproved:false,workflowExempt:false,transferState:'approved',originalReporterName:'기록자',erpApprovalRef:'ERP-TPO',existingActionNote:'원본자료 확인'},
      historicalTransfer:{mode:'historical_manual',erpApproved:false,erpReference:'ERP-TPO',originalReporterName:'기록자',occurredDate:'2026-10-08',occurredTime:'12:00',occurredTimeKnown:true},
      approvedBy:'QA 안전',approvedAt:'2026-10-13T01:00:00Z',
      _syncBaseVersion:0,_syncMutationId:'create-history'};
    let r=await who('safety',{action:'push',incidents:[source]});
    assert.equal(r.status,200,JSON.stringify(r));checks++;
    let i=r.body.incidents[0];
    const approval={by:i.approvedBy,at:i.approvedAt};
    const request=(role,action,extra={})=>who(role,{action,incidentId:i.id,...extra});
    const count=async()=>Number((await f.db.query('select count(*)::int n from enl_incident_revisions')).rows[0].n);
    r=await request('manager','historical_reauth',{reauthPassword:password});assert.equal(r.status,403);checks++;
    r=await request('safety','historical_reauth',{reauthPassword:'wrong'});assert.equal(r.status,403);checks++;
    r=await request('safety','historical_reauth',{reauthPassword:''});assert.equal(r.status,400);checks++;
    assert.equal(await count(),0);checks++;
    r=await request('safety','historical_reauth',{reauthPassword:password});
    assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.verified,true);checks++;
    let ticket=r.body.reauthTicket;assert.ok(ticket.length>40);checks++;
    const send=(whoRole,changes,tok=ticket,reason='과거사고 오타 정정',extra={})=>request(whoRole,'correct_closed',{
      expectedVersion:i._syncVersion,mutationId:crypto.randomUUID(),reauthTicket:tok,reason,changes,...extra
    });
    r=await send('safety',{summary:'오타 수정'},'');assert.equal(r.status,403);checks++;
    r=await send('safety',{summary:'오타 수정'},'forged');assert.equal(r.status,403);checks++;
    r=await send('manager',{summary:'무단 수정'});assert.equal(r.status,403);checks++;
    r=await send('safety',{summary:'오타 수정'},ticket,'');assert.equal(r.status,400);checks++;
    r=await send('safety',{
      summary:'카트 출입 중 장비 오타 정정',
      reportDetails:{incidentHow:'자재와 카트 접촉'},
      historicalImport:{erpApprovalRef:'ERP-CORRECT'}
    });
    assert.equal(r.status,200,JSON.stringify(r));i=r.body.incident;checks++;
    assert.equal(i.status,'approved');assert.equal(i.approvedBy,approval.by);assert.equal(i.approvedAt,approval.at);checks++;
    assert.equal(i.reportDetails.incidentHow,'자재와 카트 접촉');checks++;
    assert.equal(i.historicalImport.erpApprovalRef,'ERP-CORRECT');assert.equal(i.historicalTransfer.erpReference,'ERP-CORRECT');checks++;
    assert.equal(i.historicalImport.erpApproved,false);checks++;
    assert.equal(i.officialRecord.revisionNumber,1);checks++;
    const rev=(await f.db.query("select before_payload,after_payload,reason from enl_incident_revisions where incident_id=$1",[i.id])).rows[0];
    assert.equal(rev.before_payload.reportDetails.incidentHow,'자재와 카트 노타');
    assert.equal(rev.after_payload.reportDetails.incidentHow,'자재와 카트 접촉');
    assert.equal(rev.reason,'과거사고 오타 정정');checks++;
    r=await send('safety',{summary:'기존 티켓 재사용'});assert.equal(r.status,403);checks++;
    r=await request('safety','historical_reauth',{reauthPassword:password});ticket=r.body.reauthTicket;checks++;
    r=await send('safety',{historicalImport:{erpApproved:true}});assert.equal(r.status,400);checks++;
    r=await send('safety',{reportDetails:{templateVersion:'tampered'}});assert.equal(r.status,400);checks++;
    r=await send('safety',{acknowledgements:[{userId:'fake'}]});assert.equal(r.status,400);checks++;
    assert.equal(await count(),1);checks++;
    const history=await request('safety','revision_list');assert.equal(history.status,200);assert.equal(history.body.revisions.length,1);checks++;
    for(const engine of [chromium,webkit]){
      const browser=await engine.launch(),page=await browser.newPage({viewport:{width:390,height:850}});
      try{
        // Browser crypto.randomUUID requires a trustworthy HTTPS origin.
        await page.route('https://enl-history-qa.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><div id="modalRoot"></div></body></html>'}));
        await page.goto('https://enl-history-qa.test/');
        assert.equal(await page.evaluate(()=>window.isSecureContext),true);
        await page.exposeFunction('qaIncidentAPI',async body=>{
          const result=await who('safety',body);
          if(result.status!==200)throw Error(result.body.message);
          return result.body;
        });
        await page.evaluate(({incident})=>{
          window.qaAlerts=[];window.data={incidents:[incident]};
          window.currentUser=()=>({id:'qa-safety',role:'safety',name:'QA 안전'});
          window.alert=msg=>qaAlerts.push(msg);
          window.esc=s=>String(s??'');
          window.openModal=html=>{document.getElementById('modalRoot').innerHTML='<div class="modal">'+html+'</div>';document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>window.closeModal()))};
          window.closeModal=()=>{document.getElementById('modalRoot').innerHTML=''};
          window.enlIncidentApi=qaIncidentAPI;
          window.enlAcceptSavedIncident=n=>{data.incidents[0]=n;};
          window.renderShell=()=>{};
        },{incident:i});
        await page.addScriptTag({content:fs.readFileSync('historical-correction-v461.js','utf8')});
        assert.equal(await page.evaluate(()=>window.enlOpenHistoricalCorrection(data.incidents[0],currentUser())),true);checks++;
        await page.locator('#historical461Password').fill('bad-password');
        await page.locator('#historical461PasswordForm button[type=submit]').click();
        await page.locator('#historical461PasswordError').getByText('비밀번호가 일치하지 않습니다.',{exact:false}).waitFor();checks++;
        assert.equal(await page.locator('#historical461EditForm').count(),0);checks++;
        await page.locator('#historical461Password').fill(password);
        await page.locator('#historical461PasswordForm button[type=submit]').click();
        await page.locator('#historical461EditForm').waitFor();checks++;
        const revisedLocal=engine.name()==='chromium'?'2026-10-07T14:20':'2026-10-06T10:35';
        const occurredInput=page.locator('[data-historical461-field="occurredAt"]');
        assert.equal(await occurredInput.getAttribute('type'),'datetime-local','known time is editable');checks++;
        await occurredInput.fill(revisedLocal);
        await page.locator('[data-historical461-field="reportDetails.incidentHow"]').fill(engine.name()+' 재정정');
        await page.locator('#historical461Reason').fill(engine.name()+' 기재오류 정정');
        await page.locator('#historical461EditForm button[type=submit]').click();
        await page.waitForTimeout(1200);
        const diagnosis=await page.evaluate(()=>({alerts:window.qaAlerts,err:document.querySelector('#historical461EditError')?.textContent,formPresent:!!document.querySelector('#historical461EditForm'),buttonDisabled:document.querySelector('#historical461EditForm button[type=submit]')?.disabled}));
        if(!diagnosis.alerts.length)throw Error('historical browser save blocked: '+JSON.stringify({engine:engine.name(),...diagnosis,secureContext:await page.evaluate(()=>window.isSecureContext),url:page.url()}));
        checks++;
        assert.match(await page.evaluate(()=>qaAlerts[0]),/서버|정정|저장/);checks++;
        i=await page.evaluate(()=>data.incidents[0]);
        assert.equal(i.reportDetails.incidentHow,engine.name()+' 재정정');checks++;
        assert.equal(i.occurredAt,engine.name()==='chromium'?'2026-10-07T05:20:00.000Z':'2026-10-06T01:35:00.000Z','KST time and UTC persisted');checks++;
        assert.equal(i.historicalTransfer.occurredDate,revisedLocal.slice(0,10),'historical mirrored date follows correction');checks++;
        assert.equal(i.historicalTransfer.occurredTime,revisedLocal.slice(11,16),'historical mirrored time follows correction');checks++;
        assert.equal(i.approvedBy,approval.by);assert.equal(i.approvedAt,approval.at);checks++;
        const audit=(await request('safety','revision_list')).body.revisions;
        assert.ok(audit[0].changes.some(d=>d.field==='occurredAt'),'server audit includes date before/after');checks++;
        assert.equal(i.siteContractSnapshot?.occurredDate,revisedLocal.slice(0,10),'contract snapshot corrected');checks++;
        assert.equal(i.status,'approved');checks++;
        // Exercise the actual incident-detail button; previously this route returned
        // before binding the click handler and left the button apparently inert.
        await page.evaluate(()=>{
          window.fmt=value=>String(value||'').replace('T',' ').slice(0,16);
          window.siteById=id=>({id,name:'QA 가상 사업장'});
          window.ENLContracts={badge:()=>'',incidentDetail:()=>''};
          window.enlAttachmentGalleryHtml=()=>'';window.enlBindAttachmentOpen=()=>{};
          window.categoryBadge=()=>'';window.priorityBadge=()=>'';window.actionBadge=()=>'';window.legalBadge=()=>'';window.badge=()=>'';window.nowISO=()=>new Date().toISOString();
        });
        await page.addScriptTag({content:fs.readFileSync('incidents-v410.js','utf8')});
        await page.evaluate(()=>window.openIncidentModal(data.incidents[0].id,true,currentUser()));
        await page.locator('#editInc').waitFor();checks++;
        await page.locator('#editInc').click();
        await page.locator('#historical461PasswordForm').waitFor();checks++;
      }finally{await browser.close()}
    }
    // Historical imported cause text remains correctable without fabricating a modern cause-analysis status.
    r=await request('safety','historical_reauth',{reauthPassword:password});
    assert.equal(r.status,200,JSON.stringify(r));checks++;
    r=await send('safety',{reportDetails:{environmentCause:'기존 이관자료의 환경적 원인 오기 정정'}},r.body.reauthTicket,'원본 과거자료의 환경적 요인 오타 수정');
    assert.equal(r.status,200,JSON.stringify(r));i=r.body.incident;checks++;
    assert.equal(i.reportDetails.environmentCause,'기존 이관자료의 환경적 원인 오기 정정');checks++;
    assert.equal(i.reportDetails.causeAnalysisStatus,undefined,'legacy correction does not fabricate current safety investigation');checks++;
    assert.equal(i.approvedAt,approval.at);assert.equal(i.status,'approved');checks++;
    const past=(await request('safety','revision_list')).body.revisions;
    assert.equal(past[0].reason,'원본 과거자료의 환경적 요인 오타 수정');checks++;
    console.log(JSON.stringify({passed:checks,failed:0,scope:'real isolated server + Chromium/WebKit password-gated historical corrections'}));
  }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
