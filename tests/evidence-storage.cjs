'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const read=n=>fs.readFileSync('tests/fixtures/evidence-storage-'+n+'.sql','utf8');
(async()=>{const db=new PGlite();let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++};
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;
 create table enl_incident_audit(audit_id uuid primary key default gen_random_uuid(),incident_id text not null,site_id text not null,action text not null,editor_id text,editor_name text,editor_role text,editor_position text,changed_at timestamptz not null default now(),before_payload jsonb,after_payload jsonb);
 create table enl_incident_revisions(incident_id text,revision int,mutation_id text,reason text,editor_id text,editor_name text,created_at timestamptz default now(),changes jsonb not null,before_payload jsonb not null,after_payload jsonb not null,primary key(incident_id,revision));
 create table enl_incident_backups(backup_id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),created_by_id text,created_by_name text,created_by_role text,reason text,incident_count int,snapshot jsonb not null,source_version text);
 create function enl_evidence_append_only() returns trigger language plpgsql set search_path='' as $$begin raise exception 'evidence_is_append_only' using errcode='42501';end;$$;
 create trigger enl_audit_immutable before update or delete on enl_incident_audit for each row execute function enl_evidence_append_only();
 create trigger enl_revision_immutable before update or delete on enl_incident_revisions for each row execute function enl_evidence_append_only();
 create function private.enl_bulk_lifecycle_guard() returns trigger language plpgsql set search_path='' as $$declare p jsonb:='{}';x bool;begin select exists(select 1 from public.enl_incident_revisions r where r.before_payload=p) into x;return new;end;$$;`);
 const media='data:image/jpeg;base64,'+Buffer.from(Array.from({length:50000},(_,i)=>(i*73+11)%256)).toString('base64');
 const p={id:'qa-evidence',siteId:'qa-site',summary:'사고 원문',photos:[{name:'원본 사진.jpg',dataUrl:media}],reportDetails:{diagnosis:'민감정보 유지',empty:null,arr:[0,false,'',null]},officialRecord:{approval:{id:'safety',at:'2026-10-01'},erp:{documentNumber:'ERP-001'}}};
 let previous=null; const states=[];
 for(let n=0;n<8;n++){const current={...p,status:n===7?'closed':'approved',revision:n,reason:'수정 '+n};states.push(current);await db.query('insert into enl_incident_audit(incident_id,site_id,action,editor_id,editor_name,changed_at,before_payload,after_payload) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',['qa-evidence','qa-site',n?'update':'create','qa-safety','QA 안전','2026-10-01T00:00:00Z',previous===null?null:JSON.stringify(previous),JSON.stringify(current)]);previous=current;}
 await db.query('insert into enl_incident_revisions values($1,1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)',['qa-evidence','qa-mutation','승인 후 정정 사유','qa-safety','QA 안전','2026-10-02T00:00:00Z',JSON.stringify([{field:'photos',before:states[0].photos,after:states[1].photos}]),JSON.stringify(states[0]),JSON.stringify(states[1])]);
 await db.query('insert into enl_incident_backups(created_by_id,reason,incident_count,snapshot) values($1,$2,1,$3::jsonb)',['qa-safety','복구용',JSON.stringify([{incident_id:'qa-evidence',payload:states[7]}])]);
 const before=(await db.query('select coalesce(sum(octet_length(before_payload::text)),0)+coalesce(sum(octet_length(after_payload::text)),0) n from enl_incident_audit')).rows[0].n;
 const originalAudit=(await db.query('select * from enl_incident_audit order by audit_id')).rows;
 await db.exec(read('schema'));
 check((await db.query('select count(*) n from private.enl_evidence_objects')).rows[0].n===0,'schema stage leaves evidence untouched');
 for(const value of [null,false,0,'',[],{},[null,'1',1,{ref:'forged',value:{ref:'fake'}}],{ref:'forged',value:{ref:'fake'}},p]){
  const result=(await db.query('select private.enl_evidence_get(private.enl_evidence_put($1::jsonb)) value',[JSON.stringify(value)])).rows[0].value;
  assert.deepEqual(result,value);checks++;
 }
 const installGuard=fs.readFileSync('tests/fixtures/evidence-representation-guard.sql','utf8');
 for(const [query,error] of [
  ["update enl_incident_audit set editor_name='changed'",/evidence_content_or_metadata_changed/],
  ["update enl_incident_audit set after_payload='{}'",/evidence_content_or_metadata_changed/],
  ["update enl_incident_audit set after_hash=private.enl_evidence_put('{}'::jsonb)",/evidence_proposed_reference_mismatch/],
  ["update enl_incident_revisions set reason='changed'",/evidence_content_or_metadata_changed/],
  ["update enl_incident_backups set snapshot='[]'",/evidence_content_or_metadata_changed/],
  ['delete from enl_incident_audit',/evidence_is_append_only/],
  ["update private.enl_evidence_objects set value='{}'",/evidence_is_append_only/]
 ]){await assert.rejects(()=>db.transaction(async t=>{await t.exec(installGuard);await t.exec(query)}),error);checks++;}
 await assert.rejects(()=>db.transaction(async t=>{await t.exec(installGuard);await t.exec('grant select,update on enl_incident_audit to service_role;set local role service_role');await t.exec('update enl_incident_audit set editor_name=editor_name')}),/evidence_is_append_only/);checks++;
 check((await db.query("select bool_and(tgenabled='O') good from pg_trigger where tgname in ('enl_audit_immutable','enl_revision_immutable','enl_evidence_objects_immutable')")).rows[0].good,'original immutable triggers remain enabled after rejected changes');
 await db.transaction(async t=>t.exec(read('activate')));
 check((await db.query("select bool_and(p.proname='enl_evidence_append_only' and t.tgenabled='O') good from pg_trigger t join pg_proc p on t.tgfoid=p.oid where t.tgname in ('enl_audit_immutable','enl_revision_immutable')")).rows[0].good,'original unconditional append-only functions restored before commit');
 check((await db.query('select count(*) n from enl_incident_audit where before_payload is not null or after_payload is not null')).rows[0].n===0,'all historic snapshots reference dictionary');
 const hydrated=(await db.query('select (to_jsonb(a)-\'before_hash\'-\'after_hash\')||jsonb_build_object(\'before_payload\',private.enl_evidence_get(before_hash),\'after_payload\',private.enl_evidence_get(after_hash)) value from enl_incident_audit a order by audit_id')).rows.map(r=>r.value);
 // Driver timestamps differ from to_jsonb textual timestamps, so compare by SQL JSON.
 for(let n=0;n<originalAudit.length;n++){const a=originalAudit[n],b=hydrated[n];assert.deepEqual(b.before_payload,a.before_payload);assert.deepEqual(b.after_payload,a.after_payload);assert.equal(b.editor_id,a.editor_id);assert.equal(b.editor_name,a.editor_name);assert.equal(new Date(b.changed_at).toISOString(),new Date(a.changed_at).toISOString());checks++;}
 const stored=(await db.query('select sum(octet_length(value::text)) n from private.enl_evidence_objects')).rows[0].n;
 check(Number(stored)<Number(before)/4,'shared media and before/after snapshots deduplicate substantially');
 check((await db.query("select count(*) n from private.enl_evidence_objects where encoding='literal' and value=$1::jsonb",[JSON.stringify(media)])).rows[0].n===1,'one exact media string survives');
 const next={...p,revision:9};await db.query('insert into enl_incident_audit(incident_id,site_id,action,before_payload,after_payload) values($1,$2,$3,$4::jsonb,$5::jsonb)',['qa-evidence','qa-site','update',JSON.stringify(states[7]),JSON.stringify(next)]);
 const last=(await db.query('select before_payload,after_payload,private.enl_evidence_get(after_hash) hydrated from enl_incident_audit order by changed_at desc limit 1')).rows[0];check(last.before_payload===null&&last.after_payload===null,'new writes compact automatically');assert.deepEqual(last.hydrated,next);checks++;
 const changes=(await db.query('select private.enl_evidence_get(changes_hash) changes from enl_incident_revisions')).rows[0].changes;assert.deepEqual(changes,[{field:'photos',before:states[0].photos,after:states[1].photos}]);checks++;
 const backup=(await db.query('select private.enl_evidence_get(snapshot_hash) snapshot from enl_incident_backups')).rows[0].snapshot;assert.deepEqual(backup,[{incident_id:'qa-evidence',payload:states[7]}]);checks++;
 for(const table of ['enl_incident_audit','enl_incident_revisions','private.enl_evidence_objects']){await assert.rejects(()=>db.exec('delete from '+table),/evidence_is_append_only/);checks++;}
 await assert.rejects(()=>db.transaction(async t=>{await t.exec('set local role anon');await t.query('select * from private.enl_evidence_objects')}),/permission denied/);checks++;
 await assert.rejects(()=>db.transaction(async t=>{await t.exec('set local role authenticated');await t.query("select private.enl_evidence_get(repeat('0',64))")}),/permission denied/);checks++;
 await assert.rejects(()=>db.query("select private.enl_evidence_get(repeat('0',64))"),/evidence_reference_missing/);checks++;
 check((await db.query("select pg_get_functiondef('private.enl_bulk_lifecycle_guard()'::regprocedure) value")).rows[0].value.includes('coalesce(r.before_payload,private.enl_evidence_get(r.before_hash))=p'),'bulk guard validates hydrated prior state');
 await db.transaction(async t=>t.exec(read('rollback')));
 check((await db.query('select count(*) n from enl_incident_audit where after_payload is null')).rows[0].n===0,'rollback restores historic and newly created snapshots');
 assert.deepEqual((await db.query('select snapshot from enl_incident_backups')).rows[0].snapshot,backup);checks++;
 await assert.rejects(()=>db.exec('delete from enl_incident_audit'),/evidence_is_append_only/);checks++;
 console.log(JSON.stringify({suite:'evidence-storage',passed:checks,failed:0,fixtureAuditBytes:Number(before),dictionaryBytes:Number(stored)}));
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
