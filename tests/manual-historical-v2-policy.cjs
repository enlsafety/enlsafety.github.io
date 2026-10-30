'use strict';
// Isolated, synthetic verification of the production manual-archive server guard.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const read=p=>fs.readFileSync(p,'utf8');
const edge=read('edge-functions/enl-incident-sync-v411/index.ts');
const a=edge.indexOf('function canonicalValue('),b=edge.indexOf('async function reportHash(',a);
const c=edge.indexOf('const isManualArchive='),d=edge.indexOf('function isHistoricalTransfer(',c);
assert.ok(a>0&&b>a&&c>0&&d>c,'policy implementation present');
const definitions=edge.slice(a,b)+'\n'+edge.slice(c,d);
const code=stripTypeScriptTypes(definitions,{mode:'strip'});
const ctx={structuredClone,console};
vm.createContext(ctx);
vm.runInContext(
 "const clean=v=>String(v??'').trim();function rejectWrite(message,status=409){throw Object.assign(new Error(message),{status})};\n"+
 code+'\nglobalThis.guard=manualArchiveIntegrity;globalThis.isManual=isManualArchive;',ctx
);
const guard=(old,fresh,role,name='안전관리자')=>ctx.guard(old,fresh,{id:role==='safety'?'safe1':'field1',role,name});
const clone=o=>structuredClone(o);
const base=()=>({
 id:'manual-qa-1',siteId:'qa-site',recordMode:'historical_manual',status:'approved',
 category:'property',occurredAt:'2025-07-14T16:40:00+09:00',summary:'관리동 복귀 중 자재와 카트 접촉',
 immediateAction:'사고 당시 확인된 조치',approvedBy:'안전관리자',approvedAt:'2026-10-13T00:00:00Z',
 historicalImport:{enabled:true,erpApproved:false,workflowExempt:false,transferState:'approved'},
 historicalTransfer:{mode:'historical_manual',erpApproved:false},
 reportDetails:{incidentHow:'관리동 복귀 중 자재와 카트 접촉',medicalCost:null,repairCost:null},
 corrective:null
});
const rejects=(fn,pattern)=>assert.throws(fn,err=>pattern.test(err.message),pattern.toString());
const fresh=base();
assert.equal(ctx.isManual(fresh),true);
assert.doesNotThrow(()=>guard(null,fresh,'safety'));
rejects(()=>guard(null,fresh,'field'),/manual_archive_safety_approval_required/);
rejects(()=>guard(null,{...clone(fresh),approvedBy:'다른사람'},'safety'),/manual_archive_safety_approval_required/);
rejects(()=>guard(null,{...clone(fresh),historicalImport:{...fresh.historicalImport,erpApproved:true}},'safety'),/manual_archive_erp_not_verified/);
const price=clone(fresh);price.reportDetails.repairCost=135700;
assert.doesNotThrow(()=>guard(fresh,price,'field'));
rejects(()=>guard(price,{...clone(price),reportDetails:{...price.reportDetails,repairCost:900000}},'field'),/manual_archive_existing_supplement_locked/);
rejects(()=>guard(fresh,{...clone(fresh),reportDetails:{...fresh.reportDetails,medicalCost:-10}},'field'),/manual_archive_cost_invalid/);
rejects(()=>guard(fresh,{...clone(fresh),reportDetails:{...fresh.reportDetails,repairCost:'1,000'}},'field'),/manual_archive_cost_invalid/);
rejects(()=>guard(fresh,{...clone(fresh),summary:'위조된 사고내용'},'field'),/manual_archive_report_locked/);
rejects(()=>guard(fresh,{...clone(fresh),siteId:'other-site'},'field'),/manual_archive_report_locked/);
rejects(()=>guard(fresh,{...clone(fresh),approvedAt:'2026-10-14T00:00:00Z'},'safety'),/manual_archive_initial_approval_locked/);
rejects(()=>guard(fresh,{...clone(fresh),status:'reported'},'safety'),/manual_archive_state_locked/);
const premature=clone(fresh);premature.corrective={status:'approved'};
rejects(()=>guard(fresh,premature,'safety'),/manual_archive_action_not_submitted/);
const submitted=clone(fresh);submitted.corrective={status:'submitted',actionDetail:'작업자 조치 후 사진 제출'};
const approved=clone(submitted);approved.status='closed';approved.corrective={...approved.corrective,status:'approved',reviewedBy:'안전관리자'};
rejects(()=>guard(submitted,approved,'field'),/manual_archive_safety_close_only/);
assert.doesNotThrow(()=>guard(submitted,approved,'safety'));
rejects(()=>guard(approved,{...clone(approved),status:'approved'},'safety'),/manual_archive_state_locked/);
const attach=read('workflow-prevention-v429.js');
assert.match(attach,/prev429Extra-medicalCost|prev429Extra-/);
assert.match(attach,/next\.reportDetails=\{\.\.\.next\.reportDetails,\[k\]:amount\}/);
const old=read('historical-transfer-v449.js');
for(const t of ["recordMode:'historical_manual'","status:'approved'","approvedBy:u.name","closedAt:null","corrective:null","SAFETY_MANUAL_ARCHIVE","enlIncidentApi"])assert.ok(old.includes(t),t);
assert.ok(!old.includes("ERP 기결재 사고 이력등록"),'old automatic close wording removed');
const stable=read('stable412.html'),sw=read('sw-v418.js');
for(const t of ['historical-bulk-core-v454.js','historical-bulk-extract-v454.js','historical-bulk-ui-v454.js']){
 assert.ok(!stable.includes(t),'retired auto JS not loaded: '+t);
 assert.ok(!sw.includes('/'+t),'retired auto JS not pre-cached: '+t);
}
assert.match(read('edge-functions/enl-historical-bulk-v454/index.ts'),/automatic_import_retired/);
assert.match(read('incident-excel-v421.js'),/put\('재발방지계획',c\.planDetail/);
assert.match(read('edge-functions/enl-email-v441/index.ts'),/role_event_policy/);
assert.match(read('edge-functions/enl-push-v418/index.ts'),/role_event_policy/);
assert.match(read('management-approval-v448.js'),/과거 결재기록 \(읽기 전용\)/);assert.doesNotMatch(read('management-approval-v448.js'),/action:'acknowledge'|data-enl448-sign/);
console.log('PASS manual archive safety authorization, locked original narrative, additive cost, reviewed closure, retired auto import, final workbook and HQ notice suppression');
