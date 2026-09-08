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
  "await fp.locator('.topbar .brand').click();await fp.locator('[data-field-task=\"accident_action\"]').click();await fp.locator(`[data-field-action=\"${id}\"]`).click();"
);
src=src.replace(
  "await dg;await fp.waitForTimeout(700);let x=(await pull(safety)).find(i=>i.id===id);x?.corrective?.status==='submitted'?pass('현장 사고조치 검토대기 제출'):fail('현장 사고조치 검토대기 제출',{status:x?.corrective?.status});",
  "const actionDialog=await dg;const correctiveStart=Date.now();let x=null;for(let q=0;q<20;q++){x=(await pull(safety)).find(i=>i.id===id);if(x?.corrective?.status==='submitted')break;await fp.waitForTimeout(500);}const correctiveMs=Date.now()-correctiveStart;R.timings.push({action:'ui-corrective-submit-to-server',ms:correctiveMs,status:x?.corrective?.status||''});x?.corrective?.status==='submitted'?pass('현장 사고조치 검토대기 제출',{ms:correctiveMs,dialog:actionDialog}):fail('현장 사고조치 검토대기 제출',{status:x?.corrective?.status,ms:correctiveMs,dialog:actionDialog});"
);
src=src.replace(
  "await loginPage(sp,accounts.safety);await syncPage(sp);await sp.evaluate(id=>window.openUnifiedCorrectiveModal?.(id,currentUser()),id);",
  "await loginPage(sp,accounts.safety);await syncPage(sp);await sp.locator('[data-shell-view=\"actions\"]').click();await sp.locator(`[data-unified-action=\"${id}\"]`).click();"
);
src=src.replace(
  "}else{fail('안전관리자 사고조치 UI 승인',{reason:'승인버튼 없음'});x=(await pull(safety)).find(i=>i.id===id);await push(safety,[{...x,corrective:{...x.corrective,status:'approved',reviewedBy:safety.name,reviewedAt:iso()},updatedAt:iso(8000)}]);}",
  "}else{fail('안전관리자 사고조치 UI 승인',{reason:'승인버튼 없음'});}"
);

fs.writeFileSync('qa-functional-v4-generated.mjs',src);
await import(`./qa-functional-v4-generated.mjs?run=${Date.now()}`);
