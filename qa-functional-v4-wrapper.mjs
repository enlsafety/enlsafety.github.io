import fs from 'node:fs';
let src=fs.readFileSync('qa-functional-v3.mjs','utf8');

// Normalize current site-directory API field names.
src=src.replaceAll('s0.id','s0.site_id').replaceAll('s0.name','s0.site_name').replaceAll('s.id','s.site_id').replaceAll('s.name','s.site_name');

// Exercise production behavior through visible UI controls wherever possible.
src=src.replace("await sp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});","await sp.locator('[data-shell-view=\"incidents\"]').click();");
src=src.replace("await wp.evaluate(()=>window.enlGoFieldTask('accident_report',currentUser()));","await wp.locator('[data-field-task=\"accident_report\"]').click();");
src=src.replaceAll("await p.evaluate(()=>{currentView='incidents';renderShell(currentUser())});","await p.locator('[data-field-task=\"records\"]').click();");
src=src.replace("await fp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});","await fp.locator('[data-field-task=\"records\"]').click();");

// v4.2.9: recurrence prevention is no longer authored in the initial field report.
src=src.replace("['#preventionPlan410','보호구 확인 및 TBM'],",'');
src=src.replace(
  "R.mainIncidentId=item.id;cleanupIds.push(item.id);pass('근로자 UI 사고 서버저장',{id:item.id});",
  "R.mainIncidentId=item.id;cleanupIds.push(item.id);pass('근로자 UI 사고 서버저장',{id:item.id});String(item?.reportDetails?.preventionPlan||'').trim()===''?pass('최초보고 재발방지계획 분리'):fail('최초보고 재발방지계획 분리',{preventionPlan:item?.reportDetails?.preventionPlan});String(item?.immediateAction||'').includes('작업중지 후 관리자 보고')?pass('최초보고 사고조치내용 저장'):fail('최초보고 사고조치내용 저장',{immediateAction:item?.immediateAction});"
);

// Safety acceptance must also be tested through the actual incident-review UI.
src=src.replace(
  "await p.evaluate(id=>window.enlOpenIncidentReview?.(id,true,currentUser()),id);await p.waitForTimeout(500);",
  "await p.locator('[data-shell-view=\"incidents\"]').click();await p.locator(`[data-inc-id=\"${id}\"]`).first().click();await p.locator('#modalRoot .modal').waitFor({timeout:8000});"
);
src=src.replace(
  "}else{fail('안전관리자 사고보고 UI 승인',{reason:'승인버튼 없음'});x=(await pull(safety)).find(i=>i.id===id);await push(safety,[{...x,status:'approved',approvedBy:safety.name,approvedAt:iso(),updatedAt:iso(5000)}]);}",
  "}else{fail('안전관리자 사고 접수완료 UI',{reason:'접수완료 버튼 없음'});}"
);
src=src.replace("pass('안전관리자 사고보고 UI 승인')","pass('안전관리자 사고 접수완료 UI')");
src=src.replace("x?.status==='approved'?pass('사고보고 승인 상태'):fail('사고보고 승인 상태',{status:x?.status});","x?.status==='approved'?pass('사고 접수완료 상태'):fail('사고 접수완료 상태',{status:x?.status});");

// Replace the legacy field-authored corrective flow with the production v4.2.9 lifecycle:
// safety plan -> field action -> safety confirmation -> automatic closure.
src=src.replace(
  /await phase\('승인 후 수정차단·사고조치·자동종결',async\(\)=>\{[\s\S]*?\}\);\n\nawait phase\('관리자·경영진 조회'/,
  `await phase('접수 후 재발방지계획·현장조치·자동종결',async()=>{const id=R.mainIncidentId;const browser=await chromium.launch({headless:true});browsers.push(browser);const fc=await browser.newContext({viewport:{width:430,height:900}}),sc=await browser.newContext({viewport:{width:1365,height:900}}),fp=await fc.newPage(),sp=await sc.newPage();
  await loginPage(fp,accounts.site);await fp.locator('[data-field-task="records"]').click();await syncPage(fp);(await fp.locator('[data-field-edit="'+id+'"]').count())===0?pass('접수완료 후 현장 사고수정 차단'):fail('접수완료 후 현장 사고수정 차단');

  await loginPage(sp,accounts.safety);await syncPage(sp);await sp.locator('[data-shell-view="actions"]').click();await sp.locator('[data-prev-open="'+id+'"]').waitFor({timeout:12000});await sp.locator('[data-prev-open="'+id+'"]').click();await sp.locator('#prev429PlanForm').waitFor({timeout:12000});await sp.locator('#prev429RootCause').fill('작업 전 위험확인 미흡 가정');await sp.locator('#prev429PlanDetail').fill('작업 전 위험요인 확인, 보호구 점검 및 TBM 실시');await sp.locator('#prev429Owner').fill(accounts.site.name);await sp.locator('#prev429Due').fill(new Date(Date.now()+86400000).toISOString().slice(0,10));const pd=sp.waitForEvent('dialog',{timeout:6000}).then(async d=>{const m=d.message();await d.accept();return m}).catch(()=>null);await sp.locator('#prev429PlanForm button[type="submit"]').click();const planDialog=await pd;let x=null;const planStart=Date.now();for(let q=0;q<30;q++){x=(await pull(safety)).find(i=>i.id===id);if(x?.corrective?.status==='planned'&&String(x?.corrective?.planDetail||'').includes('보호구 점검'))break;await sp.waitForTimeout(500);}const planMs=Date.now()-planStart;R.timings.push({action:'ui-prevention-plan-to-server',ms:planMs,status:x?.corrective?.status||'',dialog:planDialog});x?.corrective?.status==='planned'&&String(x?.corrective?.planDetail||'').includes('보호구 점검')?pass('안전관리자 재발방지계획 등록',{ms:planMs}):fail('안전관리자 재발방지계획 등록',{status:x?.corrective?.status,plan:x?.corrective?.planDetail,ms:planMs});

  await syncPage(fp);await fp.locator('.topbar .brand').click().catch(()=>{});await fp.locator('[data-field-task="accident_action"]').click();await fp.locator('[data-prev-open="'+id+'"]').waitFor({timeout:12000});await fp.locator('[data-prev-open="'+id+'"]').click();await fp.locator('#prev429FieldForm').waitFor({timeout:12000});await fp.locator('#prev429ActionDetail').fill('TBM 실시, 보호구 착용상태 점검 및 작업 전 위험요인 확인 완료');const ad=fp.waitForEvent('dialog',{timeout:6000}).then(async d=>{const m=d.message();await d.accept();return m}).catch(()=>null);await fp.locator('#prev429FieldForm button[type="submit"]').click();const actionDialog=await ad;const actionStart=Date.now();for(let q=0;q<30;q++){x=(await pull(safety)).find(i=>i.id===id);if(x?.corrective?.status==='submitted')break;await fp.waitForTimeout(500);}const actionMs=Date.now()-actionStart;R.timings.push({action:'ui-prevention-action-to-server',ms:actionMs,status:x?.corrective?.status||'',dialog:actionDialog});x?.corrective?.status==='submitted'?pass('현장 재발방지조치 확인대기 제출',{ms:actionMs}):fail('현장 재발방지조치 확인대기 제출',{status:x?.corrective?.status,ms:actionMs});

  await syncPage(sp);await sp.locator('[data-shell-view="actions"]').click();await sp.locator('[data-prev-open="'+id+'"]').waitFor({timeout:12000});await sp.locator('[data-prev-open="'+id+'"]').click();await sp.locator('#prev429Approve').waitFor({timeout:12000});const cd=sp.waitForEvent('dialog',{timeout:6000}).then(async d=>{const m=d.message();await d.accept();return m}).catch(()=>null);await sp.locator('#prev429Approve').click();const confirmDialog=await cd;const closeStart=Date.now();for(let q=0;q<40;q++){x=(await pull(safety)).find(i=>i.id===id);if(x?.status==='closed'&&x?.corrective?.status==='approved')break;await sp.waitForTimeout(500);}const closeMs=Date.now()-closeStart;R.timings.push({action:'ui-prevention-confirm-to-closed',ms:closeMs,report:x?.status||'',corrective:x?.corrective?.status||'',dialog:confirmDialog});x?.status==='closed'&&x?.corrective?.status==='approved'?pass('재발방지조치 확인완료 후 자동종결',{ms:closeMs}):fail('재발방지조치 확인완료 후 자동종결',{report:x?.status,corrective:x?.corrective?.status,ms:closeMs});
  await fc.close();await sc.close();await browser.close();browsers=browsers.filter(x=>x!==browser);});

await phase('관리자·경영진 조회'`
);

// A conflict is a successful control when one writer succeeds and the stale writer gets 409.
src=src.replace(
  /await phase\('동일 사고 동시수정',async\(\)=>\{[\s\S]*?\}\);\n\nawait phase\('중복요청 멱등성'/,
  `await phase('동일 사고 동시수정',async()=>{const a=accounts.site,b=accounts.part,id=\`test-\${run}-race\`;cleanupIds.push(id);await push(a,[incident(id,a.siteId,a,'[RACE]')]);const base=(await pull(safety)).find(x=>x.id===id),stamp=iso(15000),pa={...base,summary:'RACE-A',updatedAt:stamp},pb={...base,summary:'RACE-B',updatedAt:stamp};const req=(who,payload)=>api(SYNC,{action:'push',actor:who,role:who.role,siteId:who.siteId||'',incidents:[payload],deletedIds:[]},{allowError:true});const [x,y]=await Promise.all([req(a,pa),req(b,pb)]),final=(await pull(safety)).find(z=>z.id===id),all=[x,y],success=all.filter(r=>r.ok&&Number(r.j?.pushed)===1).length,conflicts=all.filter(r=>r.status===409||String(r.j?.message||'').includes('enl_sync_conflict')).length;if(success===1&&conflicts===1)pass('동시수정 충돌 감지',{a:{status:x.status,...x.j},b:{status:y.status,...y.j},final:final?.summary});else{fail('동시수정 충돌 감지',{a:{status:x.status,...x.j},b:{status:y.status,...y.j},final:final?.summary});R.errors.push({severity:'P1',root:'OPTIMISTIC_LOCK_NOT_ENFORCED',name:'동일 버전 동시수정 제어 실패'});}});\n\nawait phase('중복요청 멱등성'`
);

fs.writeFileSync('qa-functional-v4-generated.mjs',src);
await import(`./qa-functional-v4-generated.mjs?run=${Date.now()}`);
