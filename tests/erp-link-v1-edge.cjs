/* Pure in-memory Edge Function contract tests: no network, no live credentials/data. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../edge-functions/enl-erp-link-v1/index.ts'), 'utf8')
  .replace(/^import .*;\s*$/gm, '');
const original = {
  id: 'qa-inc-001', status: 'closed', siteId: 'qa-site',
  corrective: { status: 'approved' }, historicalImport: null
};
const state = {
  incidents: new Map([['qa-inc-001', { site_id: 'qa-site', payload: structuredClone(original) }]]),
  links: new Map(), audit: []
};
const account = { user_id: 'qa-safe', active: true, role: 'safety', password_hash: 'test-proof-only' };
const iso = () => '2026-10-08T01:00:00Z';
const clone = x => x ? structuredClone(x) : x;
function query(strings, ...values) {
  const q = strings.join('?').replace(/\s+/g, ' ').toLowerCase();
  if (q.includes('from public.enl_hq_users')) {
    return Promise.resolve(values[0] === account.user_id ? [clone(account)] : []);
  }
  if (q.includes('from public.enl_incident_shared')) {
    const row = state.incidents.get(values[0]);
    return Promise.resolve(row ? [clone(row)] : []);
  }
  if (q.includes('select ') && q.includes('from public.enl_erp_document_links')) {
    const row = state.links.get(values[0]);
    return Promise.resolve(row ? [clone(row)] : []);
  }
  if (q.startsWith('insert into public.enl_erp_document_links')) {
    const [incidentId,siteId,doc,status,createdBy,updatedBy] = values;
    if (state.links.has(incidentId)) {
      const err = new Error('duplicate'); err.code = '23505'; throw err;
    }
    const row = { incident_id:incidentId,site_id:siteId,erp_document_no:doc,
      erp_status:status,revision:1,created_by:createdBy,updated_by:updatedBy,updated_at:iso() };
    state.links.set(incidentId,row); return Promise.resolve([clone(row)]);
  }
  if (q.startsWith('update public.enl_erp_document_links')) {
    const [doc,status,updatedBy,incidentId,revision] = values;
    const row = state.links.get(incidentId);
    if (!row || row.revision !== revision) return Promise.resolve([]);
    row.erp_document_no=doc;row.erp_status=status;row.updated_by=updatedBy;
    row.revision++;row.updated_at=iso();
    return Promise.resolve([clone(row)]);
  }
  if (q.startsWith('insert into public.enl_erp_document_link_audit')) {
    state.audit.push({
      incidentId:values[0],beforeNo:values[1],beforeStatus:values[2],
      afterNo:values[3],afterStatus:values[4],revision:values[5],user:values[6]
    });
    return Promise.resolve([]);
  }
  throw new Error('Unknown mock query: ' + q);
}
query.begin = cb => cb(query);
query.end = async () => {};
let server;
vm.runInNewContext(source, {
  Deno: { env: { get: () => 'postgres://test-only' }, serve: fn => { server=fn; } },
  postgres: () => query, Response, Request, console
}, { filename: 'enl-erp-link-v1/index.ts', timeout: 5000 });
assert.equal(typeof server,'function','server must register a handler');

async function call(action, fields, opts) {
  const body = {
    action,incidentId:'qa-inc-001',
    actor:{id:'qa-safe',role:'safety'},actorPasswordHash:'test-proof-only',
    ...fields
  };
  const headers = {
    'Content-Type':'application/json',
    'x-enl-app': 'incident-report-v2',
    origin:'https://enlsafety.github.io',
    ...(opts?.headers || {})
  };
  const response = await server(new Request('https://stage.example/functions/v1/enl-erp-link-v1', {
    method:'POST', headers, body: JSON.stringify(body)
  }));
  return {status:response.status, body:await response.json()};
}
test('rejects invalid password proof, made-up role and cross-origin requests', async ()=>{
  assert.equal((await call('get',{actorPasswordHash:'wrong'})).status,403);
  assert.equal((await call('get',{actor:{id:'qa-safe',role:'manager'}})).status,403);
  assert.equal((await call('get',{}, {headers:{origin:'https://untrusted.example'}})).status,403);
  assert.equal(state.links.size,0);
});
test('rejects incomplete, nonfinal, and historical accidents on server', async ()=>{
  const row=state.incidents.get('qa-inc-001');
  row.payload.status='approved';
  assert.equal((await call('get')).body.message,'not_finalized');
  row.payload.status='closed';row.payload.corrective.status='submitted';
  assert.equal((await call('get')).status,409);
  row.payload.corrective.status='approved';row.payload.recordMode='historical_transfer';
  assert.equal((await call('get')).status,409);
  delete row.payload.recordMode;
});
test('reads empty, creates new, updates exactly once per revision and appends audit', async ()=>{
  const empty=await call('get');
  assert.equal(empty.status,200);assert.equal(empty.body.record,null);
  const created=await call('save',{erpDocumentNo:'ENL-2026-001',erpStatus:'submitted',expectedRevision:0});
  assert.equal(created.status,200);assert.equal(created.body.record.revision,1);
  const duplicate=await call('save',{erpDocumentNo:'ENL-2026-002',erpStatus:'approved',expectedRevision:0});
  assert.equal(duplicate.status,409);
  const updated=await call('save',{erpDocumentNo:'ENL-2026-002',erpStatus:'approved',expectedRevision:1});
  assert.equal(updated.status,200);assert.equal(updated.body.record.revision,2);
  assert.equal(updated.body.record.erpStatus,'approved');
  const loaded=await call('get');
  assert.equal(loaded.body.record.erpDocumentNo,'ENL-2026-002');
  assert.equal(state.audit.length,2);
  assert.deepEqual([state.audit[0].revision,state.audit[1].revision],[1,2]);
  assert.equal(state.incidents.get('qa-inc-001').payload.status,'closed');
  assert.deepEqual(state.incidents.get('qa-inc-001').payload,original);
});
test('validates document number, state, and revision before any write', async ()=>{
  const invalid=[
    {erpDocumentNo:'',erpStatus:'submitted',expectedRevision:2},
    {erpDocumentNo:'x'.repeat(81),erpStatus:'submitted',expectedRevision:2},
    {erpDocumentNo:'ABC\nDE',erpStatus:'submitted',expectedRevision:2},
    {erpDocumentNo:'ENL-2026-001',erpStatus:'draft',expectedRevision:2},
    {erpDocumentNo:'ENL-2026-001',erpStatus:'submitted',expectedRevision:-1}
  ];
  for(const v of invalid)assert.equal((await call('save',v)).status,400);
  assert.equal(state.audit.length,2);
});
