'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  let passed = 0;
  try {
    await db.exec(`create schema private; create role anon; create role authenticated;
      create table public.enl_personnel_audit(id int primary key, before_payload jsonb, after_payload jsonb);`);
    await db.exec(fs.readFileSync('supabase/migrations/20261110024000_redact_personnel_audit_credentials.sql', 'utf8'));
    await assert.rejects(db.query(`insert into public.enl_personnel_audit values (1, 'null'::jsonb, '{}'::jsonb)`),
      e => e.code === '22023' && e.message.includes('cannot delete from scalar'));
    passed++;
    await db.exec(fs.readFileSync('supabase/migrations/20261120004518_personnel_audit_null_safe_redaction.sql', 'utf8'));
    const snapshot = JSON.stringify({ name: 'QA clerk', job_title: '서무', pin_hash: 'synthetic-proof', password_hash: 'synthetic-password' });
    const safe = { name: 'QA clerk', job_title: '서무' };
    // Both missing-record encodings, plus malformed non-object snapshots.
    for (const absent of [null, 'null', 'false', '42', '"scalar"', '[{"pin_hash":"synthetic"}]']) {
      await db.query('insert into public.enl_personnel_audit values (1, $1::jsonb, $2::jsonb)', [absent, snapshot]);
      let row = (await db.query('select * from public.enl_personnel_audit')).rows[0];
      assert.equal(row.before_payload, null);
      assert.deepEqual(row.after_payload, safe);
      await db.query('update public.enl_personnel_audit set before_payload=$1::jsonb, after_payload=$2::jsonb', [snapshot, absent]);
      row = (await db.query('select * from public.enl_personnel_audit')).rows[0];
      assert.deepEqual(row.before_payload, safe);
      assert.equal(row.after_payload, null);
      await db.exec('delete from public.enl_personnel_audit');
      passed += 4;
    }
    await db.query('insert into public.enl_personnel_audit values (1, $1::jsonb, $1::jsonb)', [snapshot]);
    const row = (await db.query('select * from public.enl_personnel_audit')).rows[0];
    assert.deepEqual(row.before_payload, safe);
    assert.deepEqual(row.after_payload, safe);
    passed += 2;
    console.log(JSON.stringify({ suite: 'personnel-audit-redaction', passed, failed: 0, productionWrites: 0 }));
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
