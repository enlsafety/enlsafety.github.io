'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const activationPath='supabase/migrations/20261023064500_evidence_storage_activate.sql';
const migration=fs.readFileSync(activationPath,'utf8').replace(/\r\n/g,'\n');
const reviewed=fs.readFileSync('tests/fixtures/evidence-storage-activate.sql','utf8').replace(/\r\n/g,'\n');
const schema=fs.readFileSync('supabase/migrations/20261023053224_enl_evidence_storage_schema_20261023.sql','utf8').replace(/\r\n/g,'\n');
const baselineSql=fs.readFileSync('tests/fixtures/evidence-storage-baseline.sql','utf8');
const setup=fs.readFileSync('tests/evidence-storage.cjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
async function fixture(){
 const db=new PGlite();await db.exec(setup);
 const before={id:'qa-migration',summary:'최초 보고',photos:[{dataUrl:'data:image/png;base64,'+'A'.repeat(3000)}]},after={...before,summary:'정정된 보고'};
 await db.query("insert into enl_incident_audit(incident_id,site_id,action,editor_name,before_payload,after_payload) values('qa-migration','qa-site','create','QA 안전',null,$1::jsonb)",[JSON.stringify(before)]);
 await db.query("insert into enl_incident_revisions(incident_id,revision,reason,changes,before_payload,after_payload) values('qa-migration',1,'가상 정정',$1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify([{field:'summary',before:before.summary,after:after.summary}]),JSON.stringify(before),JSON.stringify(after)]);
 await db.query("insert into enl_incident_backups(reason,snapshot) values('가상 백업',$1::jsonb)",[JSON.stringify([before])]);
 await db.exec(schema);return db;
}
const baseline=async db=>(await db.query(baselineSql)).rows[0].baseline;
const count=async db=>Number((await db.query('select count(*) n from private.enl_evidence_objects')).rows[0].n);
async function fails(db,error){try{await assert.rejects(()=>db.exec(migration),error)}finally{await db.exec('rollback')}}
(async()=>{let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
 const embedded=migration.split('execute $reviewed_evidence_activation$\n')[1].split('$reviewed_evidence_activation$;')[0];assert.equal(embedded,reviewed);checks++;assert.equal(schema,fs.readFileSync('tests/fixtures/evidence-storage-schema.sql','utf8').replace(/\r\n/g,'\n'));checks++;
 let db=await fixture();try{
  const before=await baseline(db);await db.exec(migration);assert.deepEqual(await baseline(db),before);checks++;
  check(await count(db)>0,'first apply compacts evidence');
  const exact=(await db.query("select jsonb_agg(to_jsonb(d) order by hash) state from private.enl_evidence_objects d")).rows[0].state;
  await db.exec(migration);assert.deepEqual(await baseline(db),before);checks++;
  assert.deepEqual((await db.query("select jsonb_agg(to_jsonb(d) order by hash) state from private.enl_evidence_objects d")).rows[0].state,exact);checks++;
  check((await db.query("select count(*) n from pg_trigger where tgname in ('enl_audit_compact_insert','enl_revision_compact_insert','enl_backup_compact_insert') and tgenabled='O'")).rows[0].n===3,'reapply keeps three active insert triggers');
  await db.exec('alter table public.enl_incident_audit disable trigger enl_audit_compact_insert');
  await fails(db,/evidence_migration_partial_activation/);checks++;assert.deepEqual(await baseline(db),before);checks++;
  await db.exec('alter table public.enl_incident_audit enable trigger enl_audit_compact_insert;alter table public.enl_incident_revisions disable trigger enl_revision_immutable');
  await fails(db,/evidence_migration_immutable_guard_invalid/);checks++;
  await db.exec('alter table public.enl_incident_revisions enable trigger enl_revision_immutable');
  await db.exec('alter table public.enl_incident_backups drop constraint enl_incident_backups_snapshot_hash_fkey');
  await fails(db,/evidence_migration_reference_constraints_invalid/);checks++;
  await db.exec('alter table public.enl_incident_backups add constraint enl_incident_backups_snapshot_hash_fkey foreign key(snapshot_hash) references private.enl_evidence_objects(hash)');
  await db.query("insert into private.enl_evidence_objects(hash,encoding,value,original_bytes) values($1,'literal','{}',2)",['0'.repeat(64)]);
  await fails(db,/evidence_hash_mismatch/);checks++;
 }finally{await db.close()}
 db=await fixture();try{
  const before=await baseline(db);
  await db.exec('create trigger enl_audit_compact_insert before insert on public.enl_incident_audit for each row execute function private.enl_evidence_compact_insert()');
  await fails(db,/evidence_migration_partial_activation/);checks++;
  check(await count(db)===0,'partial trigger failure has no new dictionary writes');assert.deepEqual(await baseline(db),before);checks++;
  await db.exec('drop trigger enl_audit_compact_insert on public.enl_incident_audit');
  await db.query("select private.enl_evidence_put('{}'::jsonb)");
  await fails(db,/evidence_migration_partial_data/);checks++;
 }finally{await db.close()}
 db=await fixture();try{
  const before=await baseline(db);
  // Force the reviewed fixture to fail AFTER its updates and new trigger DDL.
  await db.exec("create or replace function private.enl_bulk_lifecycle_guard() returns trigger language plpgsql set search_path='' as $$begin return new;end;$$;");
  await fails(db,/unrecognized_bulk_guard/);checks++;
  check(await count(db)===0,'late failure rolls back dictionary writes');assert.deepEqual(await baseline(db),before);checks++;
  check((await db.query("select count(*) n from pg_trigger where tgname like '%compact_insert'")).rows[0].n===0,'late failure rolls back compaction triggers');
  check((await db.query("select bool_and(t.tgenabled='O' and t.tgfoid='public.enl_evidence_append_only()'::regprocedure) good from pg_trigger t where t.tgname in ('enl_audit_immutable','enl_revision_immutable','enl_evidence_objects_immutable')")).rows[0].good,'late failure restores unconditional immutable guards');
  check((await db.query("select count(*) n from pg_attribute where attrelid='public.enl_incident_revisions'::regclass and attname in ('before_payload','after_payload','changes') and attnotnull")).rows[0].n===3,'late failure restores required inline columns');
 }finally{await db.close()}
 console.log(JSON.stringify({suite:'evidence-activation-migration',passed:checks,failed:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
