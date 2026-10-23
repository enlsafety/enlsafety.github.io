'use strict';
// Offline only: takes a PRIVATE backup directory. Never uploads production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const root=process.argv[2];if(!root)throw Error('private_backup_directory_required');
const suite=fs.readFileSync('tests/evidence-storage.cjs','utf8');
const setup=suite.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
const fixture=n=>fs.readFileSync('tests/fixtures/evidence-storage-'+n+'.sql','utf8');
(async()=>{const db=new PGlite();try{
 await db.exec(setup);
 const count={};for(const table of ['enl_incident_audit','enl_incident_revisions','enl_incident_backups']){
  const rows=JSON.parse(fs.readFileSync(path.join(root,table+'.json'),'utf8')).rows;count[table]=rows.length;
  for(const r of rows)await db.query('insert into '+table+' select * from jsonb_populate_record(null::'+table+',$1::jsonb)',[r.row_text]);
 }
 const sizeSql=`select 'audit' kind,coalesce(sum(octet_length(before_payload::text)),0)+coalesce(sum(octet_length(after_payload::text)),0) bytes from enl_incident_audit union all select 'revision',coalesce(sum(octet_length(before_payload::text)),0)+coalesce(sum(octet_length(after_payload::text)),0)+coalesce(sum(octet_length(changes::text)),0) from enl_incident_revisions union all select 'backup',coalesce(sum(octet_length(snapshot::text)),0) from enl_incident_backups`;
 const before=(await db.query(sizeSql)).rows;
 await db.exec(fixture('schema'));
 const start=Date.now();await db.transaction(t=>t.exec(fixture('activate')));const migrationMs=Date.now()-start;
 const after=(await db.query(`select count(*) nodes,sum(octet_length(value::text)) packed_json_bytes,sum(octet_length(value::text)+64+octet_length(encoding)+16) estimated_logical_bytes,pg_total_relation_size('private.enl_evidence_objects') physical_dictionary_bytes from private.enl_evidence_objects`)).rows[0];
 const refs=(await db.query(`select (select coalesce(sum(coalesce(octet_length(before_hash),0)+coalesce(octet_length(after_hash),0)),0) from enl_incident_audit)+(select coalesce(sum(coalesce(octet_length(before_hash),0)+coalesce(octet_length(after_hash),0)+coalesce(octet_length(changes_hash),0)),0) from enl_incident_revisions)+(select coalesce(sum(octet_length(snapshot_hash)),0) from enl_incident_backups) bytes`)).rows[0].bytes;
 const snapshotHash=(await db.query(`select encode(sha256(convert_to(jsonb_agg(hash order by hash)::text,'UTF8')),'hex') hash from private.enl_evidence_objects`)).rows[0].hash;
 const verification=(await db.query(fixture('verify'))).rows[0].jsonb_build_object;
 let originalWholeRowsMatched=0;
 for(const [name,table,key] of [['audit','enl_incident_audit',r=>r.audit_id],['revisions','enl_incident_revisions',r=>r.incident_id+':'+r.revision],['backups','enl_incident_backups',r=>r.backup_id]]){
  const hashes=new Map(verification[name].map(r=>[r.id,r.sha256]));
  for(const r of JSON.parse(fs.readFileSync(path.join(root,table+'.json'),'utf8')).rows){assert.equal(hashes.get(key(JSON.parse(r.row_text))),r.sha256);originalWholeRowsMatched++;}
 }
 // Roundtrip restoration verifies migration did not change any payload content.
 await db.transaction(t=>t.exec(fixture('rollback')));assert.deepEqual((await db.query(sizeSql)).rows,before);
 const result={source:'offline production backup',rowCounts:count,beforePayloadBytes:before,dictionary:after,rootReferenceBytes:Number(refs),migrationMs,dictionaryManifestHash:snapshotHash,originalWholeRowsMatched,wholeRowHashVerification:'passed',rollback:'passed'};
 console.log(JSON.stringify(result));
}finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
