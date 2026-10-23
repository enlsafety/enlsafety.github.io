'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const ROOT=path.resolve(__dirname,'..'),PROJECTS={production:'wjelumpbjklfrdjxbesj',staging:'zgwxzfvvpqgdedyobwmg'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const schema=fs.readFileSync(path.join(ROOT,'tests/fixtures/storage-dedup-schema.sql'),'utf8');
async function stageManifest(actorId){
 const db=new PGlite(),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/1x8AAAAASUVORK5CYII=','base64'),digest=sha(bytes);
 const batches=['6bdfc4bf-968c-493b-9f52-e184cf6aa472','a27b836c-e67c-45bd-a7cf-a47d0dcb7472'];
 const values=batches.map(id=>`(${literal(id)},${literal(digest)},${literal(id+'/'+digest)},'QA-v472-synthetic.png',${literal(digest)},${bytes.length},'text','[]'::jsonb)`).join(',');
 const insert=`insert into private.enl_historical_batches(id,owner_id) values ${batches.map(id=>`(${literal(id)},${literal(actorId)})`).join(',')} on conflict(id) do nothing;\ninsert into private.enl_historical_files(batch_id,file_id,path,name,hash,size,method,units) values ${values} on conflict(batch_id,file_id) do nothing;`;
 await db.exec('create schema private;create table private.enl_historical_files(batch_id uuid,file_id text,path text,name text,hash text,size bigint,method text,units jsonb);'+`insert into private.enl_historical_files values ${values}`);
 const rows=(await db.query("select to_jsonb(f) as row,encode(sha256(convert_to(to_jsonb(f)::text,'UTF8')),'hex') as sha256 from private.enl_historical_files f order by batch_id")).rows;await db.close();
 const manifest={version:1,migrationId:'enl-storage-dedup-20261023-v472',project:PROJECTS.staging,bucket:'enl-import-originals',entries:rows.map(x=>({batchId:x.row.batch_id,fileId:x.row.file_id,oldPath:x.row.path,canonicalPath:batches[0]+'/'+digest,sha256:digest,bytes:bytes.length,rowSha256:x.sha256}))};
 const files=batches.map(id=>({path:id+'/'+digest,sha256:digest,base64:bytes.toString('base64'),canonical:id===batches[0]}));
 const entries=manifest.entries,cleanupCheck=`do $cleanup$ declare r record;begin
 if (select count(*) from private.enl_historical_batches where id in (${batches.map(literal).join(',')}) and owner_id=${literal(actorId)})<>2 then raise exception 'fixture_owner_changed';end if;
 if (select count(*) from private.enl_historical_files where batch_id in (${batches.map(literal).join(',')}))<>2 then raise exception 'fixture_files_changed';end if;
 if (select count(*) from private.enl_storage_dedup_runs)<>1 or not exists(select 1 from private.enl_storage_dedup_runs where migration_id=${literal(manifest.migrationId)}) or exists(select 1 from private.enl_storage_dedup_events where migration_id<>${literal(manifest.migrationId)}) then raise exception 'maintenance_scope_changed';end if;
 for r in select f.path,encode(sha256(convert_to((to_jsonb(f)||jsonb_build_object('path',e.value->>'oldPath'))::text,'UTF8')),'hex') as original_sha,e.value from private.enl_historical_files f join jsonb_array_elements(${literal(JSON.stringify(entries))}::jsonb) e(value) on f.batch_id::text=e.value->>'batchId' and f.file_id=e.value->>'fileId' loop if r.path not in (r.value->>'oldPath',r.value->>'canonicalPath') or r.original_sha<>r.value->>'rowSha256' then raise exception 'fixture_metadata_changed';end if;end loop;
 if (select count(*) from private.enl_historical_files f join jsonb_array_elements(${literal(JSON.stringify(entries))}::jsonb) e(value) on f.batch_id::text=e.value->>'batchId' and f.file_id=e.value->>'fileId')<>2 then raise exception 'fixture_metadata_missing';end if;
 end;$cleanup$;`;
 const cleanup=`delete from private.enl_historical_files where batch_id in (${batches.map(literal).join(',')});delete from private.enl_historical_batches where id in (${batches.map(literal).join(',')});drop table private.enl_storage_dedup_events;drop table private.enl_storage_dedup_runs;drop function private.enl_storage_dedup_events_immutable();`;
 return {manifest,insert,files,cleanup,cleanupCheck};
}
async function build(environment,output,proofFile,backupProofFile){
 if(!PROJECTS[environment]||path.resolve(output).startsWith(ROOT+path.sep))throw Error('private_output_required');
 let proof=JSON.parse(fs.readFileSync(proofFile,'utf8'));proof=proof.proof||proof;
 const actorId=proof.actor.id,builtAt=Date.now(),expiresAt=builtAt+3600000;
 const source=environment==='staging'?await stageManifest(actorId):{manifest:JSON.parse(fs.readFileSync(path.resolve(ROOT,'../private-backup/storage_dedup_manifest.json'),'utf8')).manifest,insert:'',files:[],cleanup:''};
 const manifestSha=sha(stable(source.manifest));
 const savedBackup=JSON.parse(fs.readFileSync(backupProofFile||path.resolve(ROOT,'../private-secrets/storage-backup-proof.json'),'utf8'));
 if(!/^[a-f0-9]{64}$/.test(savedBackup.archiveSha256||'')||!/^libfile_[a-f0-9]+$/.test(savedBackup.libraryFileId||''))throw Error('private_backup_proof_required');
 if(environment==='production'&&(savedBackup.manifestSha256!==manifestSha||savedBackup.objectCount!==source.manifest.entries.length))throw Error('backup_manifest_mismatch');
 const backup={...savedBackup,manifestSha256:manifestSha,objectCount:source.manifest.entries.length,...(environment==='staging'?{syntheticFixture:true}: {})};
 const seed=`insert into private.enl_storage_dedup_runs(migration_id,manifest_sha256,manifest,backup_proof) values(${literal(source.manifest.migrationId)},${literal(manifestSha)},${literal(JSON.stringify(source.manifest))}::jsonb,${literal(JSON.stringify(backup))}::jsonb) on conflict(migration_id) do nothing;`;
 const preflight=`do $verify$ declare r record;begin for r in select f.path,encode(sha256(convert_to((to_jsonb(f)||jsonb_build_object('path',e.value->>'oldPath'))::text,'UTF8')),'hex') as original_sha,e.value from private.enl_historical_files f join jsonb_array_elements(${literal(JSON.stringify(source.manifest.entries))}::jsonb) e(value) on f.batch_id::text=e.value->>'batchId' and f.file_id=e.value->>'fileId' loop if r.path<>r.value->>'oldPath' or r.original_sha<>r.value->>'rowSha256' then raise exception 'baseline_mismatch';end if;end loop; if (select count(*) from private.enl_historical_files f join jsonb_array_elements(${literal(JSON.stringify(source.manifest.entries))}::jsonb) e(value) on f.batch_id::text=e.value->>'batchId' and f.file_id=e.value->>'fileId')<>${source.manifest.entries.length} then raise exception 'baseline_rows_mismatch';end if; if (select manifest_sha256 from private.enl_storage_dedup_runs where migration_id=${literal(source.manifest.migrationId)})<>${literal(manifestSha)} then raise exception 'manifest_mismatch';end if;end;$verify$;`;
 const sql={auth:'select user_id,role,active,password_hash from public.enl_hq_users where user_id=$1 limit 1',bootstrap:schema+'\n'+source.insert+'\n'+seed+'\n'+preflight,status:"select to_regclass('private.enl_storage_dedup_runs') is not null as schema_ready",cleanup:source.cleanup,cleanupCheck:source.cleanupCheck||''};
 fs.mkdirSync(output,{recursive:true,mode:0o700});fs.chmodSync(output,0o700);
 const result={environment,project:PROJECTS[environment],manifestSha256:manifestSha,rows:source.manifest.entries.length,duplicateObjects:source.manifest.entries.filter(e=>e.oldPath!==e.canonicalPath).length,expiresAt:new Date(expiresAt).toISOString()};
 for(const kind of ['bootstrap','maintenance']){
  const token=crypto.randomBytes(32).toString('hex'),gate={actorId,tokenSha256:sha(token),builtAt,expiresAt},dir=path.join(output,kind);fs.mkdirSync(dir,{recursive:true,mode:0o700});
  let code;
  if(kind==='bootstrap')code=fs.readFileSync(path.join(ROOT,'maintenance/storage-bootstrap-runner.ts'),'utf8').replace('/*__CONFIG__*/ null as any',JSON.stringify({...gate,project:PROJECTS[environment],staging:environment==='staging'})).replace('/*__SQL__*/ null as any',()=>JSON.stringify(sql)).replace('/*__FILES__*/ null as any',()=>JSON.stringify(source.files));
  else code=fs.readFileSync(path.join(ROOT,'edge-functions/enl-storage-dedup-v472/index.ts'),'utf8').replace("const PROJECT='wjelumpbjklfrdjxbesj';",`const PROJECT='${PROJECTS[environment]}';`).replace(/const MANIFEST_SHA256='[^']+';/,`const MANIFEST_SHA256='${manifestSha}';`).replace('EXPECTED_ROWS=55,EXPECTED_REMOVALS=31',`EXPECTED_ROWS=${source.manifest.entries.length},EXPECTED_REMOVALS=${result.duplicateObjects}`).replace('/*__MAINTENANCE_GATE__*/ null as any',JSON.stringify(gate));
  if(code.includes(token))throw Error('plaintext_token_in_source');
  for(const [name,value] of [['index.ts',code],['token.txt',token],['proof.json',JSON.stringify(proof)],['config.json',JSON.stringify({...result,kind,sourceSha256:sha(code)},null,2)]]){fs.writeFileSync(path.join(dir,name),value,{mode:0o600});fs.chmodSync(path.join(dir,name),0o600);}
 }
 for(const [name,value] of [['manifest.json',JSON.stringify(source.manifest,null,2)],['bootstrap.sql',sql.bootstrap]])fs.writeFileSync(path.join(output,name),value,{mode:0o600});
 console.log(JSON.stringify({...result,output}));return {...result,manifest:source.manifest,sql,files:source.files};
}
if(require.main===module)build(...process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={build,stageManifest,stable,sha};
