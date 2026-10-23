'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),PROJECT='zgwxzfvvpqgdedyobwmg',QA='enl_final_qa_20261013',REVIEWED_SQL_SHA256='3fba2dfbc8be364f071a2923c31b21438e9d4304551b21bf13ba43e6a7d274de';
const USERS=['qa-storage-sign-20261023-owner','qa-storage-sign-20261023-other'],BATCH='da5ca9ec-4547-4cd2-9aeb-fd066f9eb472';
const TABLES=['private.enl_delivery_claims','private.enl_enrollment_codes','private.enl_historical_batches','private.enl_historical_files','private.enl_historical_import_audit','private.enl_mutations','private.enl_revoked_sessions','private.enl_uploads','public.enl_app_control','public.enl_document_views','public.enl_erp_document_link_audit','public.enl_erp_document_links','public.enl_hq_users','public.enl_incident_audit','public.enl_incident_comments','public.enl_incident_shared','public.enl_industrial_accident_report_audit','public.enl_industrial_accident_reports','public.enl_personnel_audit','public.enl_push_config','public.enl_push_deliveries','public.enl_push_events','public.enl_push_subscriptions','public.enl_safety_inquiries','public.enl_site_audit','public.enl_site_master','public.enl_site_personnel'];
const digest=s=>crypto.createHash('sha256').update(s).digest('hex'),q=s=>"'"+s.replaceAll("'","''")+"'";
const hash=s=>`encode(sha256(convert_to(${s},'UTF8')),'hex')`;
const fp=(table,where)=>`(select jsonb_build_object('count',count(*),'sha256',${hash("coalesce(string_agg(h,',' order by h collate \"C\"),'')")}) from (select ${hash('to_jsonb(t)::text')} h from ${table} t where ${where}) x)`;
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
function queries(cleanupSQL){
 const file=cleanupSQL.match(/file_id='([a-f0-9]{64})'/)?.[1];if(!file)throw Error('fixed_file_id_missing');
 const target={'public.enl_hq_users':`t.user_id in(${USERS.map(q).join(',')})`,'private.enl_historical_batches':`t.id=${q(BATCH)}`,'private.enl_historical_files':`t.batch_id=${q(BATCH)} and t.file_id=${q(file)}`};
 const inventory=`(select coalesce(jsonb_agg(schemaname||'.'||tablename order by schemaname,tablename),'[]'::jsonb) from pg_tables where schemaname in('public','private') and left(tablename,4)='enl_')`;
 const tables=[...TABLES,'storage.objects','storage.buckets'];
 const targets=Object.keys(target).map(t=>q(t)+'::regclass').join(',');
 const refs=TABLES.map(table=>`exists(select 1 from ${table} t where ${target[table]?`not coalesce((${target[table]}),false)`:'true'} and (${[...USERS,BATCH].map(id=>`strpos(to_jsonb(t)::text,${q(id)})>0`).join(' or ')}))`).join(' or ');
 const topology=`not exists(select 1 from pg_class where oid in(${targets}) and relkind<>'r') and not exists(select 1 from pg_inherits where inhparent in(${targets}) or inhrelid in(${targets})) and not exists(select 1 from pg_rewrite where ev_class in(${targets}) and ev_type='4')`;
 const state=`select jsonb_build_object('inventory',${inventory},'tables',jsonb_build_object(${tables.map(table=>q(table)+`,jsonb_build_object('keep',${fp(table,target[table]?`not coalesce((${target[table]}),false)`:'true')},'remove',${fp(table,target[table]||'false')})`).join(',')}),'noDeleteTriggers',not exists(select 1 from pg_trigger t where not t.tgisinternal and (t.tgtype::int & 8)=8 and t.tgrelid in(${targets})),'safeDeleteTopology',(${topology}),'noRetainedReferences',not (${refs}),'fixtureOwnerValid',not exists(select 1 from private.enl_historical_batches t where t.id=${q(BATCH)} and (t.owner_id is null or t.owner_id not in(${USERS.map(q).join(',')})))) as state`;

 return {file,state,auth:`select active,role,password_hash from ${QA}.enl_hq_users where user_id=$1 limit 1`,lock:`set local lock_timeout='5s';set local statement_timeout='60s';set local idle_in_transaction_session_timeout='60s';lock table ${TABLES.join(',')} in share row exclusive mode;`,cleanup:cleanupSQL};
}
function build({cleanupSQL,expectedSqlSha256=REVIEWED_SQL_SHA256,baseline,token,builtAt=Date.now(),expiresAt=builtAt+3600000}){
 if(digest(cleanupSQL)!==expectedSqlSha256)throw Error('unreviewed_sql');if(!/^[a-f0-9]{64}$/.test(token))throw Error('invalid_token');if(expiresAt<=builtAt||expiresAt-builtAt>3600000)throw Error('invalid_expiry');
 const sql=queries(cleanupSQL);if(canonical(baseline.inventory)!==canonical(TABLES)||['noDeleteTriggers','safeDeleteTopology','noRetainedReferences','fixtureOwnerValid'].some(k=>baseline[k]!==true))throw Error('unsafe_inventory');
 for(const table of [...TABLES,'storage.objects','storage.buckets'])for(const kind of ['keep','remove']){const f=baseline.tables[table]?.[kind];if(!Number.isSafeInteger(f?.count)||f.count<0||!/^[a-f0-9]{64}$/.test(f?.sha256||''))throw Error('invalid_baseline');}
 const expected={'public.enl_hq_users':2,'private.enl_historical_batches':1,'private.enl_historical_files':1};for(const table of Object.keys(baseline.tables))if(baseline.tables[table].remove.count!==(expected[table]||0))throw Error('exact_fixture_count_required');
 const config={project:PROJECT,actorId:'qa-safety',builtAt,expiresAt,tokenSha256:digest(token),sqlSha256:expectedSqlSha256,baseline};
 const source=fs.readFileSync(path.join(ROOT,'maintenance/storage-sign-cleanup-runner.ts'),'utf8').replace('/*__CONFIG__*/ null as any',()=>JSON.stringify(config)).replace('/*__SQL__*/ null as any',()=>JSON.stringify(sql));if(source.includes(token))throw Error('plaintext_token');return {source,config,sql};
}
if(require.main===module){const [mode,sqlFile,output,baselineFile]=process.argv.slice(2);const cleanupSQL=fs.readFileSync(sqlFile,'utf8');if(digest(cleanupSQL)!==REVIEWED_SQL_SHA256)throw Error('unreviewed_sql');
 if(mode==='capture'){fs.writeFileSync(output,queries(cleanupSQL).state);console.log(output);}
 else if(mode==='build'){if(path.resolve(output).startsWith(ROOT+path.sep)||!path.resolve(output).includes('/private-secrets/'))throw Error('private_secret_directory_required');const token=crypto.randomBytes(32).toString('hex'),built=build({cleanupSQL,baseline:JSON.parse(fs.readFileSync(baselineFile)),token});fs.mkdirSync(output,{recursive:true,mode:0o700});fs.chmodSync(output,0o700);const manifest={project:PROJECT,sourceSha256:digest(built.source),sqlSha256:REVIEWED_SQL_SHA256,expiresAt:new Date(built.config.expiresAt).toISOString()};for(const [name,value] of Object.entries({'index.ts':built.source,'token.txt':token,'config.json':JSON.stringify(built.config,null,2),'manifest.json':JSON.stringify(manifest,null,2)})){fs.writeFileSync(path.join(output,name),value,{mode:0o600});fs.chmodSync(path.join(output,name),0o600);}console.log(JSON.stringify({output,...manifest}));}
 else throw Error('usage: capture reviewed.sql output.sql | build reviewed.sql private_output baseline.json');
}
module.exports={build,queries,digest,canonical,PROJECT,QA,TABLES,USERS,BATCH,REVIEWED_SQL_SHA256};
