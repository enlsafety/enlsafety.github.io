'use strict';
/*
 * LIVE, synthetic-fixture-only integration checks. This file cannot target production.
 * Run only after all staging functions/migrations have been deployed:
 *   node tests/historical-bulk-live-staging.cjs --run-fixed-staging
 *   node tests/historical-bulk-live-staging.cjs --resume-registration
 *   node tests/historical-bulk-live-staging.cjs --resume-workflow
 * Credentials: ../bulk-qa-session.json (never printed).
 * Cleanup manifest: ../bulk-qa-created.json; cleanup is intentionally performed by
 * the supervising operator, using this manifest rather than broad SQL deletes.
 * Network/HTTP success is tested independently of local parser/UI test suites.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID, createHash, webcrypto } = require('node:crypto');
const Core = require('../historical-bulk-core-v454.js');
const ROOT = path.resolve(__dirname, '..');
const SESSION_FILE = path.resolve(ROOT, '../bulk-qa-session.json');
const MANIFEST_FILE = path.resolve(ROOT, '../bulk-qa-created.json');
const STAGING = 'https://zgwxzfvvpqgdedyobwmg.supabase.co';
const PRODUCTION_REF = 'wjelumpbjklfrdjxbesj';
const ORIGIN = 'https://enlsafety.github.io';
const BULK = 'enl-historical-bulk-v454';
const SYNC = 'enl-incident-sync-v411';
const COMPLIANCE = 'enl-incident-compliance-v439';
const args = new Set(process.argv.slice(2));
if (!args.has('--run-fixed-staging') && !args.has('--resume-registration') && !args.has('--resume-workflow')) {
  console.log('No network calls made. After staging deployment use --run-fixed-staging.');
  process.exit(0);
}
if (process.env.SUPABASE_URL || process.env.BULK_QA_URL) {
  throw Error('Endpoint environment overrides are prohibited by this staging test.');
}
const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
const ensure = (condition, label) => { if (!condition) throw Error(label); };
ensure(session.runId && /^[a-zA-Z0-9_-]{4,80}$/.test(session.runId), 'Invalid synthetic run identifier');
for (const key of ['safety', 'otherSafety', 'manager']) {
  ensure(session[key]?.id && session[key]?.passwordHash, `Missing ${key} fixture credentials`);
}
ensure(session.site?.site_id && session.site?.site_name, 'Missing isolated site fixture');
const prior = fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')) : null;
if (prior && prior.runId === session.runId && prior.batchIds?.length && !args.has('--resume-workflow') && !args.has('--resume-registration')) {
  throw Error('This run already created fixtures. Clean only its manifest IDs before restarting, or use --resume-workflow.');
}
if (prior && prior.runId !== session.runId && prior.batchIds?.length && prior.cleaned !== true) {
  throw Error('The previous manifest has uncleaned fixtures; preserve and clean it before a new run.');
}
let manifest = args.has('--resume-workflow') || args.has('--resume-registration') ? prior : {
  runId: session.runId, project: 'zgwxzfvvpqgdedyobwmg', startedAt: new Date().toISOString(),
  batchIds: [], incidentIds: [], storagePaths: [], checks: [], phase: 'initial', cleaned: false
};
ensure(manifest?.runId === session.runId, 'Resume manifest does not match the session');
const checkpoint = () => fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
const pass = label => {
  manifest.checks.push({ name: label, status: 'pass', at: new Date().toISOString() });
  checkpoint(); console.log('PASS ' + label);
};
const skip = label => {
  manifest.checks.push({ name: label, status: 'not-tested', at: new Date().toISOString() });
  checkpoint(); console.log('NOT TESTED ' + label);
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const creds = key => {
  const u = session[key];
  if (!u) return {};
  const role = key === 'manager' ? 'manager' : key === 'field' ? 'field' : 'safety';
  return { actor: { id: u.id, role, name: '합성 QA 사용자', siteId: u.siteId || (role === 'field' ? session.site.site_id : '') },
    actorPasswordHash: u.passwordHash, actorPinHash: u.pinHash };
};
function endpoint(name) {
  ensure([BULK, SYNC, COMPLIANCE].includes(name), 'Unapproved function name');
  const url = new URL(`/functions/v1/${name}`, STAGING);
  ensure(url.hostname === 'zgwxzfvvpqgdedyobwmg.supabase.co' && !url.href.includes(PRODUCTION_REF), 'Staging target guard');
  return url;
}
async function invoke(name, action, data = {}, who = 'safety', options = {}) {
  const headers = { 'content-type': 'application/json', 'x-enl-app': 'incident-report-v2', origin: ORIGIN, ...options.headers };
  const res = await fetch(endpoint(name), {
    method: options.method || 'POST', headers,
    body: JSON.stringify({ ...(who ? creds(who) : {}), action, ...data }),
    signal: AbortSignal.timeout(45000)
  });
  const type = res.headers.get('content-type') || '';
  ensure(type.includes('application/json'), `Non-JSON response for ${name}/${action}`);
  const body = await res.json();
  return { status: res.status, body, headers: res.headers };
}
const api = (action, data, who, options) => invoke(BULK, action, data, who, options);
function ok(r, label) {
  // Never interpolate a full response, SQL error, source document, or credential.
  const code = /^[a-z_0-9-]{1,100}$/.test(r.body?.message || '') ? ` (${r.body.message})` : '';
  ensure(r.status === 200 && r.body.ok === true, `${label}: HTTP ${r.status}${code}`);
  return r.body;
}
function denied(r, code, label, status) {
  ensure(r.body.ok === false && r.body.message === code && (!status || r.status === status), label);
}
const headers = ['사업장명', '발생일', '발생시간', '사고구분', '사고유형', '사고정도', '사고장소', '당시작업', '사고경위', '즉시조치', '피해자', '부상내용', '파손물품', '파손내용', 'ERP문서번호', 'ERP결재일', 'ERP결재상태', '사고번호', '진료비', '수리비'];
const keys = ['siteName', 'occurredDate', 'occurredTime', 'category', 'eventType', 'severity', 'place', 'workAction', 'incidentHow', 'immediateAction', 'name', 'injuryDetail', 'damagedItem', 'damageDetail', 'erpRef', 'erpDate', 'erpStatus', 'recordNo', 'medicalCost', 'repairCost'];
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function values(label, patch = {}) {
  return { siteName: session.site.site_name, occurredDate: session.fixtureDate || today(), occurredTime: '09:20',
    category: '대인', eventType: '넘어짐', severity: '경미', place: '합성 QA 장소', workAction: '합성 QA 작업',
    incidentHow: `${session.runId}-${label} 합성 검증자료`, immediateAction: '합성 자료상 응급조치',
    name: `가상근로자-${label}`, injuryDetail: '합성 타박상', erpRef: `${session.runId}-ERP-${label}`,
    erpDate: session.fixtureDate || today(), erpStatus: '결재완료', recordNo: `${session.runId}-${label}`, ...patch };
}
const rowOf = v => keys.map(k => v[k] || '');
// Use the shipped CSV decoder/extractor rather than constructing its unit output.
const extractionContext = { window: {}, TextDecoder, Uint8Array, crypto: webcrypto, btoa: s => Buffer.from(s, 'binary').toString('base64') };
vm.createContext(extractionContext);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'historical-bulk-extract-v454.js'), 'utf8'), extractionContext);
async function csv(name, rows, method = 'text') {
  const content = '\uFEFF' + rows.map(row => row.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const bytes = Buffer.from(content, 'utf8');
  const file = await extractionContext.window.ENLHistoricalBulkExtract454.read({
    name: `${session.runId}-${name}.csv`, size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer
  });
  if (method === 'ocr') { file.method = 'ocr'; file.units.forEach(unit => { unit.method = 'ocr'; unit.confidence = 32; }); }
  return JSON.parse(JSON.stringify(file));
}
async function createBatch() {
  const id = randomUUID(); manifest.batchIds.push(id); checkpoint();
  ok(await api('create', { batchId: id, erpConfirmed: true }), 'Create isolated batch'); return id;
}
async function upload(batchId, file, candidateId) {
  const storagePath = `${batchId}/${file.id}`;
  if (!manifest.storagePaths.includes(storagePath)) { manifest.storagePaths.push(storagePath); checkpoint(); }
  return ok(await api('upload', { batchId, file, ...(candidateId ? { candidateId } : {}) }), 'Upload synthetic source');
}
const get = async batchId => ok(await api('get', { batchId }), 'Read own batch');
const byRecord = (cs, label) => {
  const c = cs.find(x => x.values.recordNo === `${session.runId}-${label}`);
  ensure(c, `Missing synthetic candidate ${label}`); return c;
};
async function current(batchId, candidateId) {
  const out = await get(batchId), c = out.batch.candidates.find(x => x.id === candidateId);
  ensure(c, 'Current candidate missing');
  return { c, p: out.incidents.find(x => x.incident_id === c.incidentId)?.payload, out };
}
async function actionOn(action, batchId, candidateId, extra = {}) {
  const { c } = await current(batchId, candidateId);
  return api(action, { batchId, candidateId, revision: c.revision, incidentVersion: c.incidentVersion, reason: '합성 QA 검증 사유', ...extra });
}
async function commit(batchId, candidateId) {
  const { c } = await current(batchId, candidateId);
  const out = ok(await api('commit', { batchId, candidateId, revision: c.revision, finalConfirmed: true }), 'Register synthetic candidate');
  if (out.candidate.incidentId && !manifest.incidentIds.includes(out.candidate.incidentId)) {
    manifest.incidentIds.push(out.candidate.incidentId); checkpoint();
  }
  return out.candidate;
}
async function metricsCount() {
  const out = ok(await invoke(SYNC, 'dashboard_read'), 'Read staging dashboard');
  return out.metrics.filter(x => x.siteId === session.site.site_id).length;
}
async function mainTests() {
  denied(await api('options', {}, null), 'auth_safety_required', 'Unauthenticated request must be rejected', 403);
  denied(await api('options', {}, 'safety', { headers: { origin: 'https://untrusted.example' } }), 'invalid_origin', 'Invalid Origin must be rejected', 403);
  denied(await api('options', {}, 'manager'), 'auth_safety_required', 'Manager must not use safety-only importer', 403);
  denied(await api('options', { actor: { id: session.manager.id, role: 'safety' }, actorPasswordHash: session.manager.passwordHash }), 'auth_safety_required', 'Role spoof must be rejected', 403);
  const opts = ok(await api('options'), 'Staging options');
  ensure(opts.sites.some(s => s.site_id === session.site.site_id), 'Isolated site must be in server options');
  ensure(opts.paidAI === false && /^4\.5\.4-lifecycle-/.test(opts.version), 'Expected deployed lifecycle version');
  manifest.bulkVersion = opts.version; pass('Actual staging version, contract_period options, Origin/auth/role guards');

  const batchId = await createBatch(); manifest.mainBatchId = batchId; checkpoint();
  denied(await api('get', { batchId }, 'otherSafety'), 'batch_owner_required', 'Other safety owner must be rejected', 403);
  denied(await api('create', { batchId, erpConfirmed: true }, 'otherSafety'), 'batch_owner_required', 'Other owner cannot take over existing UUID', 403);
  pass('Batch ownership isolation');
  const person = values('PERSON');
  const property = values('PROPERTY', { category: '대물', eventType: '부딪힘', name: '', injuryDetail: '', damagedItem: '합성 장비', damageDetail: '합성 긁힘', repairCost: '20000' });
  const mixed = values('MIXED', { damagedItem: '합성 장비', damageDetail: '합성 파손' });
  const missing = values('MISSING', { workAction: '' });
  const erp = values('ERP-MISSING', { erpStatus: '미확인' });
  const files = [
    await csv('multi', [headers, ...[person, property, mixed, missing, erp].map(rowOf)]),
    await csv('additional-evidence', [['사고번호', '진료비'], [person.recordNo, '10000']]),
    await csv('ocr-review', [headers, rowOf(values('OCR', { occurredTime: '99:90' }))], 'ocr')
  ];
  const local = Core.analyze(files, opts.sites);
  ensure(local.length === 6 && byRecord(local, 'PERSON').sources.length === 2, 'Shipped extraction and merging fixture precondition');
  for (const file of files) await upload(batchId, file);
  ensure((await upload(batchId, files[0])).reused === true, 'Identical original upload should reuse hash');
  const bad = { ...files[0], hash: '0'.repeat(64) };
  denied(await api('upload', { batchId, file: bad }), 'file_hash_mismatch', 'Source hash mismatch must be rejected');
  const analyzed = ok(await api('analyze', { batchId }), 'Analyze uploaded originals');
  ensure(analyzed.candidates.length === 6, 'One multi-row file and supplemental source yield six incidents');
  const cs = analyzed.candidates;
  ensure(byRecord(cs, 'PERSON').state === 'ready' && byRecord(cs, 'PROPERTY').state === 'ready', 'Evidence-complete person/property auto ready');
  ensure(byRecord(cs, 'PERSON').sources.length === 2 && byRecord(cs, 'PERSON').values.medicalCost === '10000', 'Multiple evidence merge');
  ensure(byRecord(cs, 'MIXED').values.category === 'mixed' && byRecord(cs, 'MIXED').state === 'review', 'Mixed injury remains one review candidate');
  ensure(byRecord(cs, 'MISSING').validation.some(x => x.field === 'workAction'), 'Missing facts remain review');
  ensure(byRecord(cs, 'ERP-MISSING').validation.some(x => x.code === 'erp'), 'ERP approval evidence required');
  ensure(byRecord(cs, 'OCR').validation.some(x => x.code === 'ocr') && byRecord(cs, 'OCR').state === 'review', 'OCR uncertainty must block auto ready');
  pass('Multi-file/multi-incident extraction, evidence merging, person/property/mixed, missing/OCR/ERP review');
  const listed = ok(await api('list'), 'Resume list');
  ensure(listed.batches.some(x => x.id === batchId), 'Saved batch appears in resume list');
  ensure((await get(batchId)).files.length === 3, 'Repeated upload does not duplicate original rows');
  ok(await api('file_error', { batchId, name: 'unsupported.hwp', message: '합성 HWP 변환 안내' }), 'Record individual file error');
  ensure((await get(batchId)).batch.file_errors.some(x => x.name === 'unsupported.hwp'), 'File processing failure persisted');
  pass('Resume persistence, per-file error status and duplicate-upload protection');

  const a = byRecord(cs, 'PERSON'), b = byRecord(cs, 'PROPERTY'), m = byRecord(cs, 'MIXED'), n = byRecord(cs, 'MISSING'), o = byRecord(cs, 'OCR');
  const signed = ok(await api('sign', { batchId, candidateId: a.id, fileId: files[0].id }), 'Sign private original');
  ensure(new URL(signed.url).hostname === new URL(STAGING).hostname, 'Signed URL must remain in staging');
  const sourceResponse = await fetch(signed.url, { signal: AbortSignal.timeout(15000) });
  ensure(sourceResponse.ok && digest(Buffer.from(await sourceResponse.arrayBuffer())) === files[0].hash, 'Signed original bytes match uploaded bytes');
  denied(await api('sign', { batchId, candidateId: a.id, fileId: files[0].id }, 'otherSafety'), 'batch_owner_required', 'Other owner must not sign originals', 403);
  const publicResponse = await fetch(`${STAGING}/storage/v1/object/public/enl-import-originals/${batchId}/${files[0].id}`, { signal: AbortSignal.timeout(15000) });
  ensure(!publicResponse.ok, 'Original must not be publicly retrievable');
  pass('Private original byte verification, owner-only signing and public access denial');
  ok(await actionOn('exclude', batchId, n.id), 'Exclude candidate');
  ensure((await current(batchId, n.id)).c.state === 'excluded', 'Excluded state persists');
  denied(await actionOn('save', batchId, n.id, { values: { workAction: '합성 확인 작업' } }), 'candidate_excluded', 'Excluded candidate cannot silently edit');
  ok(await actionOn('restore_candidate', batchId, n.id), 'Restore excluded candidate');
  ok(await actionOn('save', batchId, n.id, { values: { workAction: '합성 원문 재확인 작업' }, resolveIssues: true }), 'Fill missing fact');
  ensure((await current(batchId, n.id)).c.state === 'ready', 'Manual evidence-backed correction becomes ready');
  denied(await api('save', { batchId, candidateId: n.id, revision: 0, reason: '합성 오래된 편집', values: {} }), 'revision_conflict', 'Stale candidate edit must conflict', 409);
  ok(await actionOn('exclude', batchId, n.id), 'Exclude unnecessary corrected candidate');
  ok(await actionOn('save', batchId, m.id, { values: { category: 'person' }, resolveIssues: true }), 'Confirm mixed primary category');
  ensure((await current(batchId, m.id)).c.state === 'ready', 'Mixed damage can register after source verification');
  ok(await actionOn('save', batchId, o.id, { values: { occurredTime: '09:30' }, resolveIssues: true }), 'Correct OCR time against synthetic source');
  ensure((await current(batchId, o.id)).c.state === 'ready', 'Explicit OCR review becomes ready');
  denied(await api('analyze', { batchId }), 'reviewed_candidates_no_reset', 'Resume reanalysis must preserve manual reviews');
  pass('Pre-registration correction, classification review, exclusion/restore and stale revision protection');
  manifest.phase = 'registration'; checkpoint();
}
async function registrationTests() {
  const batchId = manifest.mainBatchId;
  ensure(batchId, 'No registration checkpoint available');
  const cs = (await get(batchId)).batch.candidates;
  const a = byRecord(cs, 'PERSON'), b = byRecord(cs, 'PROPERTY'), person = values('PERSON');
  const countBefore = await metricsCount();
  const first = await commit(batchId, a.id);
  ensure(first.state === 'success' && first.incidentId, 'Ready candidate registers with one final confirmation');
  const once = await current(batchId, a.id), p = once.p;
  ensure(p.externalInitialApproval.state === 'verified' && p.approvedAt === null && !p.approvedBy && p.reportWorkflow.initialApprovalSource === 'ERP', 'Initial ERP approval preserved without new app approval');
  ensure(p.corrective === null && p.status === 'approved' && !p.officialRecord.approval, 'Normal prevention workflow remains available');
  const replays = await Promise.all([commit(batchId, a.id), commit(batchId, a.id)]);
  ensure(replays.every(x => x.incidentId === first.incidentId), 'Concurrent registration retries must be idempotent');
  const curB = (await current(batchId, b.id)).c;
  denied(await api('commit', { batchId, candidateId: b.id, revision: curB.revision }), 'final_confirmation_required', 'Unconfirmed registration must fail');
  ensure((await current(batchId, b.id)).c.state === 'failed', 'Per-candidate registration failure persists');
  const second = await commit(batchId, b.id);
  ensure(second.state === 'success' && second.incidentId !== first.incidentId, 'Failed candidate retry can register once');
  ensure((await metricsCount()) === countBefore + 2, 'Two registered incidents appear in dashboard');
  pass('Single final confirmation, atomic/idempotent commits, partial failure retry and initial dashboard integration');
  denied(await api('analyze', { batchId }), 'batch_registered_create_new', 'Registered batch cannot be reanalyzed');
  denied(await actionOn('save', batchId, a.id, { values: { medicalCost: '1' } }), 'candidate_locked', 'Pre-registration endpoint cannot edit registered record');
  denied(await invoke(SYNC, 'acknowledge', { incidentId: first.incidentId, documentType: 'incident_report' }), 'external_initial_approval_no_duplicate_signature', 'No duplicate initial approval signature', 409);
  pass('Registered candidate endpoint scope and duplicate ERP first-approval guard');

  ok(await actionOn('update_incident', batchId, a.id, { values: { medicalCost: '45670', damageAmount: '45670', diagnosis: '합성 추적진단', followupNote: '합성 후속자료 확인' } }), 'Post-registration cost and diagnosis update');
  const changed = await current(batchId, a.id);
  ensure(changed.p.reportDetails.medicalCost === 45670 && changed.p.reportDetails.diagnosis === '합성 추적진단', 'Edited facts reflected in shared incident');
  ensure(changed.c.corrections.some(x => x.field === 'medicalCost' && x.before === '10000' && x.after === '45670' && x.actorId === session.safety.id && x.reason), 'Field-level before/after/actor/reason history retained');
  ensure(changed.out.history.some(x => x.action === 'update_incident' && x.detail.before && x.detail.after && x.detail.reason), 'Import audit stores before and after');
  denied(await actionOn('update_incident', batchId, a.id, { values: { erpRef: '불허 변경' } }), 'candidate_identity_locked', 'ERP identity cannot be edited');
  denied(await api('update_incident', { batchId, candidateId: a.id, revision: changed.c.revision, incidentVersion: 0, reason: '합성 오래된 수정', values: { medicalCost: '9' } }), 'incident_revision_conflict', 'Stale incident version must conflict', 409);
  const attachment = await csv('post-registration-attachment', [['사고번호', '후속자료'], [person.recordNo, '합성 추가 증빙']]);
  await upload(batchId, attachment, a.id);
  const attached = await current(batchId, a.id);
  ensure(attached.c.sources.includes(attachment.id) && attached.p.historicalOrigin.sourceFileIds.includes(attachment.id), 'Post-registration attachment linked to candidate and incident');
  pass('Post-registration edits, cost/diagnosis supplement, audit history, version lock and new evidence attachment');

  ok(await actionOn('void_incident', batchId, b.id), 'Invalidate imported accident');
  ensure((await current(batchId, b.id)).c.state === 'voided', 'Invalidation state shown in import results');
  ensure((await metricsCount()) === countBefore + 1, 'Invalidated incident excluded from dashboard count');
  const pulled = ok(await invoke(SYNC, 'pull'), 'Read incident list');
  ensure(!pulled.incidents.some(x => x.id === second.incidentId), 'Invalidated incident excluded from normal list');
  denied(await actionOn('update_incident', batchId, b.id, { values: { repairCost: '9' } }), 'candidate_voided', 'Invalidated record cannot be edited');
  ok(await actionOn('restore_incident', batchId, b.id), 'Restore invalidated accident');
  ensure((await metricsCount()) === countBefore + 2, 'Restored incident counted again');
  pass('Logical invalidation/restore, ordinary-list visibility and dashboard statistics');

  const duplicateBatch = await createBatch();
  await upload(duplicateBatch, await csv('duplicate-record', [headers, rowOf(person)]));
  const duplicate = ok(await api('analyze', { batchId: duplicateBatch }), 'Analyze duplicate source').candidates[0];
  ensure(duplicate.validation.some(x => x.code === 'duplicate'), 'Existing incident duplicate detected');
  const blocked = await commit(duplicateBatch, duplicate.id);
  ensure(blocked.state === 'review' && !blocked.incidentId, 'Duplicate cannot register');
  ok(await actionOn('void_incident', batchId, a.id), 'Invalidate original for duplicate restoration race test');
  ok(await actionOn('save', duplicateBatch, duplicate.id, { values: {}, resolveIssues: true }), 'Revalidate after original invalidation');
  const replacement = await commit(duplicateBatch, duplicate.id);
  ensure(replacement.state === 'success', 'A corrected replacement can be registered after original invalidation');
  denied(await actionOn('restore_incident', batchId, a.id), 'candidate_restore_duplicate', 'Restoration must not create an active duplicate');
  ok(await actionOn('void_incident', duplicateBatch, duplicate.id), 'Invalidate synthetic replacement');
  ok(await actionOn('restore_incident', batchId, a.id), 'Restore original after replacement invalidation');
  pass('Existing duplicate prevention and duplicate-safe invalidation restoration');

  manifest.workflowBatchId = batchId; manifest.workflowCandidateId = a.id;
  manifest.phase = 'workflow'; checkpoint();
}
async function workflowTests() {
  const batchId = manifest.workflowBatchId, id = manifest.workflowCandidateId;
  ensure(batchId && id, 'No workflow checkpoint available');
  const refreshed = async () => current(batchId, id);
  const push = async (transform, who = 'safety') => {
    const { p } = await refreshed(), next = structuredClone(p);
    transform(next);
    next._syncBaseVersion = Number(p._syncVersion || 0); next._syncMutationId = `qa:${session.runId}:${randomUUID()}`;
    const out = ok(await invoke(SYNC, 'push', { incidents: [next] }, who), 'Advance existing prevention workflow');
    ensure(out.pushed === 1, 'Workflow update must persist once');
  };
  let { p } = await refreshed();
  if (!p.corrective) {
    await push(next => { next.corrective = { status: 'planned', planDetail: '합성 재발방지계획', rootCause: '합성 확인원인', ownerName: '합성 현장', dueDate: today(), planBy: '합성 안전관리자' }; });
  }
  ensure((await refreshed()).p.corrective?.status, 'Prevention plan persists on imported incident');
  denied(await actionOn('void_incident', batchId, id), 'candidate_workflow_locked', 'Started followup blocks invalidation');
  denied(await actionOn('update_incident', batchId, id, { values: { incidentHow: '불허 핵심 내용 변경' } }), 'candidate_workflow_locked', 'Started followup blocks core incident rewrite');
  ok(await actionOn('update_incident', batchId, id, { values: { medicalCost: '56780', followupNote: '후속 진행 중 합성 진료비 보완' } }), 'Cost supplement allowed during followup');
  ensure((await refreshed()).p.corrective.planDetail === '합성 재발방지계획', 'Supplement preserves prevention details');
  pass('Existing prevention plan integration and progressed-workflow edit/invalidation protections');
  p = (await refreshed()).p;
  if (p.corrective.status !== 'approved') {
    if (session.field) {
      await push(next => { next.corrective = { ...next.corrective, status: 'submitted', actionDetail: '합성 현장 개선조치 완료', afterPhotos: [] }; }, 'field');
      pass('Actual field-role corrective action submission');
    } else {
      await push(next => { next.corrective = { ...next.corrective, status: 'submitted', actionDetail: '합성 현장 개선조치 완료', afterPhotos: [] }; });
      skip('Field-role submission: no isolated field fixture credential; safety path only');
    }
    await push(next => { next.corrective = { ...next.corrective, status: 'rejected', reviewNote: '합성 보완 요청' }; });
    ensure((await refreshed()).p.corrective.status === 'rejected', 'Safety supplementation request persists');
    await push(next => { next.corrective = { ...next.corrective, status: 'submitted', actionDetail: '합성 보완 완료' }; }, session.field ? 'field' : 'safety');
    await push(next => { next.corrective = { ...next.corrective, status: 'approved', reviewedBy: '합성 안전관리자', reviewedAt: new Date().toISOString() }; });
  }
  const final = await refreshed();
  ensure(final.p.status === 'closed' && final.p.corrective.status === 'approved' && final.p.officialRecord.finalApproval, 'Normal safety final review closes import');
  ensure(final.p.approvedAt === null && !final.p.officialRecord.approval && final.p.externalInitialApproval.state === 'verified', 'Followup closure does not fabricate first approval');
  const ack = ok(await invoke(SYNC, 'acknowledge', { incidentId: final.p.id, documentType: 'corrective_action' }, 'manager'), 'Manager signs followup approval');
  ensure(ack.receipt.documentType === 'corrective_action', 'Corrective approval is not blocked by ERP first-approval exemption');
  denied(await invoke(SYNC, 'acknowledge', { incidentId: final.p.id, documentType: 'incident_report' }, 'manager'), 'external_initial_approval_no_duplicate_signature', 'ERP first signature still blocked after closure', 409);
  denied(await invoke(COMPLIANCE, 'delete_incident', { incidentId: final.p.id, reason: '합성 삭제 방지 검증' }), 'bulk_delete_requires_invalidation', 'Compliance API cannot physically delete bulk import', 409);
  pass('Safety review/request/resubmit/close and manager followup approval, first-approval and physical-delete guards');
  manifest.phase = 'completed'; manifest.completedAt = new Date().toISOString(); checkpoint();
  console.log(`DONE ${manifest.checks.filter(x => x.status === 'pass').length} passed; ${manifest.checks.filter(x => x.status === 'not-tested').length} not tested. Synthetic fixtures remain for manifest-scoped cleanup.`);
}
(async () => {
  checkpoint();
  if (!args.has('--resume-workflow')) {
    if (!args.has('--resume-registration')) await mainTests();
    await registrationTests();
  }
  await workflowTests();
})().catch(error => {
  // Assertions contain only static labels and short known codes, never live data.
  manifest.failedAt = new Date().toISOString();
  manifest.failure = String(error.message || error).slice(0, 300);
  checkpoint(); console.error('FAIL ' + manifest.failure); process.exitCode = 1;
});
