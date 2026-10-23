'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-storage-'+n+'.sql'),'utf8');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const projects={production:{project:'wjelumpbjklfrdjxbesj',schema:'public',privateSchema:'private'},staging:{project:'zgwxzfvvpqgdedyobwmg',schema:'enl_final_qa_20261013',privateSchema:'enl_final_qa_20261013_private'}};
function mapSQL(sql,config){return sql.replace(/\bprivate\./g,config.privateSchema+'.').replace(/\bpublic\./g,config.schema+'.').replace(/tg_table_schema<>'public'/g,"tg_table_schema<>'"+config.schema+"'").replace(config.privateSchema+".enl_bulk_lifecycle_guard()'::regprocedure",(config.schema==='public'?config.privateSchema:config.schema)+".enl_bulk_lifecycle_guard()'::regprocedure");}
function baselineFromBackup(root){
 const result={};
 for(const [kind,table,key] of [['audit','enl_incident_audit',r=>r.audit_id],['revisions','enl_incident_revisions',r=>r.incident_id+':'+r.revision],['backups','enl_incident_backups',r=>r.backup_id]]){
  const backup=JSON.parse(fs.readFileSync(path.join(root,table+'.json'),'utf8'));
  if(backup.project!==projects.production.project)throw Error('backup_project_mismatch');
  const rows=backup.rows.map(r=>{if(digest(r.row_text)!==r.sha256)throw Error('backup_hash_mismatch');return {id:key(JSON.parse(r.row_text)),hash:r.sha256};}).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  result[kind]={count:rows.length,sha256:digest(rows.map(r=>r.hash).join(','))};
 }
 return result;
}
function build({environment,actorId,baseline,token,builtAt=Date.now(),expiresAt=builtAt+3600000}){
 const target=projects[environment];if(!target)throw Error('unknown_environment');
 if(!actorId||typeof actorId!=='string'||!token||!/^([a-f0-9]{64})$/.test(token))throw Error('invalid_config');
 for(const kind of ['audit','revisions','backups'])if(!Number.isSafeInteger(baseline[kind]?.count)||baseline[kind].count<0||!/^[a-f0-9]{64}$/.test(baseline[kind]?.sha256))throw Error('invalid_baseline');
 if(expiresAt-builtAt>3600000||expiresAt<=builtAt)throw Error('invalid_expiry');
 const s=target.schema,p=target.privateSchema;
 const sql={
  auth:`select user_id,role,active,password_hash from ${s}.enl_hq_users where user_id=$1 limit 1`,
  lock:`set local lock_timeout='5s';set local statement_timeout='60s';set local idle_in_transaction_session_timeout='60s';lock table ${s}.enl_incident_audit,${s}.enl_incident_revisions,${s}.enl_incident_backups in share row exclusive mode;`,
  baseline:mapSQL(read('baseline'),target),activation:mapSQL(read('activate'),target),
  status:`select jsonb_build_object(
   'audit',(select count(*) from ${s}.enl_incident_audit),
   'revisions',(select count(*) from ${s}.enl_incident_revisions),
   'backups',(select count(*) from ${s}.enl_incident_backups),
   'dictionaryObjects',(select count(*) from ${p}.enl_evidence_objects),
   'dictionaryHashesValid',(select coalesce(bool_and(encode(sha256(convert_to(${p}.enl_evidence_get(hash)::text,'UTF8')),'hex')=hash),true) from ${p}.enl_evidence_objects),
   'compactedSnapshots',(select count(*) from ${s}.enl_incident_audit where before_hash is not null or after_hash is not null)+(select count(*) from ${s}.enl_incident_revisions where before_hash is not null or after_hash is not null or changes_hash is not null)+(select count(*) from ${s}.enl_incident_backups where snapshot_hash is not null),
   'compactionTriggers',(select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid in ('${s}.enl_incident_audit'::regclass,'${s}.enl_incident_revisions'::regclass,'${s}.enl_incident_backups'::regclass) and t.tgname in ('enl_audit_compact_insert','enl_revision_compact_insert','enl_backup_compact_insert') and t.tgenabled='O' and p.proname='enl_evidence_compact_insert'),
   'immutableGuards',(select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid in ('${s}.enl_incident_audit'::regclass,'${s}.enl_incident_revisions'::regclass,'${p}.enl_evidence_objects'::regclass) and t.tgname in ('enl_audit_immutable','enl_revision_immutable','enl_evidence_objects_immutable') and t.tgenabled='O' and p.proname='enl_evidence_append_only')
  ) as state`
 };
 const config={...target,actorId,baseline,tokenSha256:digest(token),builtAt,expiresAt,activationSha256:digest(sql.activation)};
 const source=fs.readFileSync(path.join(ROOT,'maintenance/evidence-activation-runner.ts'),'utf8').replace('/*__CONFIG__*/ null as any',()=>JSON.stringify(config)).replace('/*__SQL__*/ null as any',()=>JSON.stringify(sql));
 if(source.includes(token))throw Error('plaintext_token_in_source');
 return {source,config,sql};
}
if(require.main===module){
 const [environment,privateOutput,baselineSource,proofFile]=process.argv.slice(2);
 if(!environment||!privateOutput||!baselineSource||!proofFile)throw Error('usage: environment private_output backup_dir_or_baseline_json private_proof_json');
 if(path.resolve(privateOutput).startsWith(ROOT+path.sep))throw Error('private_output_must_be_outside_repo');
 const proof=JSON.parse(fs.readFileSync(proofFile,'utf8'));
 const baseline=environment==='production'?baselineFromBackup(baselineSource):JSON.parse(fs.readFileSync(baselineSource,'utf8'));
 const token=crypto.randomBytes(32).toString('hex');
 const {source,config,sql}=build({environment,actorId:proof.actor.id,baseline,token});
 fs.mkdirSync(privateOutput,{recursive:true,mode:0o700});fs.chmodSync(privateOutput,0o700);
 const write=(n,v)=>{fs.writeFileSync(path.join(privateOutput,n),v,{mode:0o600});fs.chmodSync(path.join(privateOutput,n),0o600);};
 write('index.ts',source);write('token.txt',token);write('config.json',JSON.stringify(config,null,2));
 write('activation.sql',sql.activation);write('baseline.sql',sql.baseline);
 write('manifest.json',JSON.stringify({project:config.project,schema:config.schema,builtAt:new Date(config.builtAt).toISOString(),expiresAt:new Date(config.expiresAt).toISOString(),sourceSha256:digest(source),activationSha256:config.activationSha256,baseline:config.baseline},null,2));
 console.log(JSON.stringify({output:privateOutput,project:config.project,expiresAt:new Date(config.expiresAt).toISOString(),sourceSha256:digest(source)}));
}
module.exports={build,baselineFromBackup,mapSQL,projects,digest};
