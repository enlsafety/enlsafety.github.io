import fs from 'node:fs';
let src=fs.readFileSync('qa-functional-v3.mjs','utf8');
src=src.replaceAll('s0.id','s0.site_id').replaceAll('s0.name','s0.site_name').replaceAll('s.id','s.site_id').replaceAll('s.name','s.site_name');

// Functional behavior must be exercised through visible UI controls. API calls in
// the base harness are retained only for TEST fixture setup/cleanup and read-only
// server verification / supplemental integrity probes.
src=src.replace("await sp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});","await sp.locator('[data-shell-view=\"incidents\"]').click();");
src=src.replace("await wp.evaluate(()=>window.enlGoFieldTask('accident_report',currentUser()));","await wp.locator('[data-field-task=\"accident_report\"]').click();");
src=src.replaceAll("await p.evaluate(()=>{currentView='incidents';renderShell(currentUser())});","await p.locator('[data-field-task=\"records\"]').click();");
src=src.replace("await fp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});","await fp.locator('[data-field-task=\"records\"]').click();");

src=src.replace(
  "await p.evaluate(id=>window.enlOpenIncidentReview?.(id,true,currentUser()),id);await p.waitForTimeout(500);",
  "await p.locator('[data-shell-view=\"incidents\"]').click();await p.locator(`[data-inc-id=\"${id}\"]`).first().click();await p.locator('#modalRoot .modal').waitFor({timeout:8000});"
);
src=src.replace(
  "}else{fail('안전관리자 사고보고 UI 승인',{reason:'승인버튼 없음'});x=(await pull(safety)).find(i=>i.id===id);await push(safety,[{...x,status:'approved',approvedBy:safety.name,approvedAt:iso(),updatedAt:iso(5000)}]);}",
  "}else{fail('안전관리자 사고보고 UI 승인',{reason:'승인버튼 없음'});}"
);

src=src.replace(
  "await fp.evaluate(id=>window.openUnifiedCorrectiveModal?.(id,currentUser()),id);",
  "await fp.locator('.topbar .brand').click();await fp.locator('[data-field-task=\"accident_action\"]').click();await fp.evaluate(()=>{if(window.__qaSyncWrapped)return;window.__qaSyncWrapped=true;window.__qaSyncEvents=[];const raw=window.fetch.bind(window);window.fetch=async function(input,init){const url=typeof input==='string'?input:String(input?.url||'');let action='';try{action=JSON.parse(init?.body||'{}').action||''}catch(e){};const t=Date.now();try{const r=await raw(input,init);if(url.includes('/functions/v1/enl-incident-sync-v411'))window.__qaSyncEvents.push({action,status:r.status,ms:Date.now()-t});return r}catch(e){if(url.includes('/functions/v1/enl-incident-sync-v411'))window.__qaSyncEvents.push({action,error:String(e?.message||e),ms:Date.now()-t});throw e}}});await fp.locator(`[data-field-action=\"${id}\"]`).click();"
);
src=src.replace(
  "await dg;await fp.waitForTimeout(700);let x=(await pull(safety)).find(i=>i.id===id);x?.corrective?.status==='submitted'?pass('현장 사고조치 검토대기 제출'):fail('현장 사고조치 검토대기 제출',{status:x?.corrective?.status});",
  "const actionDialog=await dg;const localAfter=await fp.evaluate(id=>{const i=(data.incidents||[]).find(x=>String(x.id)===String(id));return {correctiveStatus:i?.corrective?.status||'',updatedAt:i?.updatedAt||'',serverReady:window.enlIncidentServerReady?.()||false,syncVersion:i?._syncVersion??null,syncBase:i?._syncBaseVersion??null,mutation:i?._syncMutationId||''}},id);const correctiveStart=Date.now();let x=null;for(let q=0;q<30;q++){x=(await pull(safety)).find(i=>i.id===id);if(x?.corrective?.status==='submitted')break;await fp.waitForTimeout(500);}const correctiveMs=Date.now()-correctiveStart;const syncEvents=await fp.evaluate(()=>window.__qaSyncEvents||[]);R.timings.push({action:'ui-corrective-submit-to-server',ms:correctiveMs,status:x?.corrective?.status||''});x?.corrective?.status==='submitted'?pass('현장 사고조치 검토대기 제출',{ms:correctiveMs,localAfter,syncEvents,dialog:actionDialog}):fail('현장 사고조치 검토대기 제출',{status:x?.corrective?.status,ms:correctiveMs,localAfter,syncEvents,dialog:actionDialog});"
);
src=src.replace(
  "await loginPage(sp,accounts.safety);await syncPage(sp);await sp.evaluate(id=>window.openUnifiedCorrectiveModal?.(id,currentUser()),id);",
  "await loginPage(sp,accounts.safety);await syncPage(sp);await sp.locator('[data-shell-view=\"actions\"]').click();await sp.locator(`[data-unified-action=\"${id}\"]`).click();"
);
src=src.replace(
  "}else{fail('안전관리자 사고조치 UI 승인',{reason:'승인버튼 없음'});x=(await pull(safety)).find(i=>i.id===id);await push(safety,[{...x,corrective:{...x.corrective,status:'approved',reviewedBy:safety.name,reviewedAt:iso()},updatedAt:iso(8000)}]);}",
  "}else{fail('안전관리자 사고조치 UI 승인',{reason:'승인버튼 없음'});}"
);

// Corrective approval is asynchronous: the visible UI action saves locally,
// then the incident sync pushes the approved corrective and automatic closure.
// Verify real server convergence with a bounded poll instead of a 700 ms race.
src=src.replace(
  "x=(await pull(safety)).find(i=>i.id===id);x?.status==='closed'&&x?.corrective?.status==='approved'?pass('조치승인 후 자동종결'):fail('조치승인 후 자동종결',{report:x?.status,corrective:x?.corrective?.status});",
  "const closeStart=Date.now();for(let q=0;q<30;q++){x=(await pull(safety)).find(i=>i.id===id);if(x?.status==='closed'&&x?.corrective?.status==='approved')break;await sp.waitForTimeout(500);}const closeMs=Date.now()-closeStart;R.timings.push({action:'ui-corrective-approve-to-closed',ms:closeMs,report:x?.status||'',corrective:x?.corrective?.status||''});x?.status==='closed'&&x?.corrective?.status==='approved'?pass('조치승인 후 자동종결',{ms:closeMs}):fail('조치승인 후 자동종결',{report:x?.status,corrective:x?.corrective?.status,ms:closeMs});"
);

// A conflict is now a successful safety control when one writer succeeds and
// the stale concurrent writer receives an explicit 409/enl_sync_conflict.
src=src.replace(
  /await phase\('동일 사고 동시수정',async\(\)=>\{[\s\S]*?\}\);\n\nawait phase\('중복요청 멱등성'/,
  `await phase('동일 사고 동시수정',async()=>{const a=accounts.site,b=accounts.part,id=\`test-\${run}-race\`;cleanupIds.push(id);await push(a,[incident(id,a.siteId,a,'[RACE]')]);const base=(await pull(safety)).find(x=>x.id===id),stamp=iso(15000),pa={...base,summary:'RACE-A',updatedAt:stamp},pb={...base,summary:'RACE-B',updatedAt:stamp};const req=(who,payload)=>api(SYNC,{action:'push',actor:who,role:who.role,siteId:who.siteId||'',incidents:[payload],deletedIds:[]},{allowError:true});const [x,y]=await Promise.all([req(a,pa),req(b,pb)]),final=(await pull(safety)).find(z=>z.id===id),all=[x,y],success=all.filter(r=>r.ok&&Number(r.j?.pushed)===1).length,conflicts=all.filter(r=>r.status===409||String(r.j?.message||'').includes('enl_sync_conflict')).length;if(success===1&&conflicts===1)pass('동시수정 충돌 감지',{a:{status:x.status,...x.j},b:{status:y.status,...y.j},final:final?.summary});else{fail('동시수정 충돌 감지',{a:{status:x.status,...x.j},b:{status:y.status,...y.j},final:final?.summary});R.errors.push({severity:'P1',root:'OPTIMISTIC_LOCK_NOT_ENFORCED',name:'동일 버전 동시수정 제어 실패'});}});\n\nawait phase('중복요청 멱등성'`
);

fs.writeFileSync('qa-functional-v4-generated.mjs',src);
await import(`./qa-functional-v4-generated.mjs?run=${Date.now()}`);
