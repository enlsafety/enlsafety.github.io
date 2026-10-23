'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),PROJECT='zgwxzfvvpqgdedyobwmg',SCHEMA='enl_final_qa_20261013',PRIVATE=SCHEMA+'_private';
const IDS=Object.freeze(['qa-live-1792732387807','qa-storage-1792732534118','qa-live-1792737764906','qa-storage-1792737792884']);
const TARGETS=Object.freeze(['enl_email_events','enl_push_events','enl_document_views','enl_incident_operations','enl_incident_revisions','enl_incident_audit','enl_incident_shared']);
const QA=Object.freeze([...TARGETS,'enl_hq_users','enl_site_personnel','enl_site_master','enl_incident_backups']);
const SECURITY=Object.freeze(['kokmatch_sessions','kokmatch_member_auth','kokmatch_state','kokmatch_groups','kokmatch_global_admins','kokmatch_v34_state_backup','kokmatch_v34_member_auth_backup','kokmatch_v34_auth_backup']);
const TRIGGERS=Object.freeze({enl_audit_immutable:'enl_incident_audit',enl_operation_immutable:'enl_incident_operations',enl_revision_immutable:'enl_incident_revisions',trg_enl_final_record_guard:'enl_incident_shared'});
const quote=s=>"'"+s.replaceAll("'","''")+"'",list=a=>a.map(quote).join(','),ids='array['+list(IDS)+']::text[]',digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const hashExpr=expr=>`encode(sha256(convert_to(${expr},'UTF8')),'hex')`;
const fp=(table,where='true')=>`(select jsonb_build_object('count',count(*),'sha256',${hashExpr("coalesce(string_agg(h,',' order by h collate \"C\"),'')")}) from (select ${hashExpr('to_jsonb(t)::text')} h from ${table} t where ${where}) x)`;
const guardDefinitions=`(select coalesce(jsonb_object_agg(t.tgname,pg_get_triggerdef(t.oid)),'{}'::jsonb) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='${SCHEMA}' and t.tgname in(${list(Object.keys(TRIGGERS))}) and t.tgenabled='O')`;
const qaFields=QA.map(t=>`${quote(t)},jsonb_build_object('keep',${fp(SCHEMA+'.'+t,TARGETS.includes(t)?`not coalesce(t.incident_id=any(${ids}),false)`:'true')},'remove',${fp(SCHEMA+'.'+t,TARGETS.includes(t)?`t.incident_id=any(${ids})`:'false')})`).join(',');
const qaSQL=`select jsonb_build_object('tables',jsonb_build_object(${qaFields},'enl_evidence_objects',jsonb_build_object('keep',${fp(PRIVATE+'.enl_evidence_objects')},'remove',${fp(PRIVATE+'.enl_evidence_objects','false')})),
 'ids',(select coalesce(jsonb_agg(incident_id order by incident_id),'[]'::jsonb) from ${SCHEMA}.enl_incident_shared where incident_id=any(${ids})),
 'guards',${guardDefinitions},
 'safeDeleteGraph',not exists(select 1 from pg_constraint where contype='f' and confrelid in(${TARGETS.map(t=>quote(SCHEMA+'.'+t)+'::regclass').join(',')}) and conrelid not in(${TARGETS.map(t=>quote(SCHEMA+'.'+t)+'::regclass').join(',')})) and not exists(select 1 from pg_trigger t where not t.tgisinternal and (t.tgtype::int & 8)=8 and t.tgrelid in(${TARGETS.map(t=>quote(SCHEMA+'.'+t)+'::regclass').join(',')}) and not (${Object.entries(TRIGGERS).map(([name,table])=>`(t.tgname=${quote(name)} and t.tgrelid=${quote(SCHEMA+'.'+table)}::regclass)`).join(' or ')})),
 'targetSiteValid',not exists(select 1 from ${SCHEMA}.enl_incident_shared where incident_id=any(${ids}) and (site_id is distinct from 'qa-site' or payload->>'id' is distinct from incident_id or payload->>'siteId' is distinct from 'qa-site'))
) as state`;
const securityCount=`select count(*)::int as count,coalesce(bool_and(c.relkind='r'),true) as ordinary from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in(${list(SECURITY)})`;
const schemaSQL=`(select ${hashExpr("coalesce(jsonb_agg(j order by name)::text,'[]')")} from (select c.relname name,jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',c.relowner::regrole::text,'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'constraints',(select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid=c.oid),'indexes',(select jsonb_agg(pg_get_indexdef(indexrelid) order by indexrelid::regclass::text) from pg_index where indrelid=c.oid),'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid=c.oid and not tgisinternal),'policies',(select jsonb_agg(jsonb_build_array(polname,polcmd,polroles,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) order by polname) from pg_policy where polrelid=c.oid)) j from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in(${list(SECURITY)})) q)`;
const invalidSecurity=[
 "select 1 from public.kokmatch_groups where group_id is distinct from 'enl_rls_qa_20261023' or name is distinct from 'QA ENL RLS 20261023'",
 "select 1 from public.kokmatch_global_admins where admin_id is distinct from 'qa_admin_20261023' or display_name is distinct from 'QA Admin 20261023'",
 ...['kokmatch_state','kokmatch_member_auth','kokmatch_v34_state_backup','kokmatch_v34_member_auth_backup','kokmatch_v34_auth_backup'].map(t=>`select 1 from public.${t} where club_id is distinct from 'enl_rls_qa_20261023'`),
 "select 1 from public.kokmatch_sessions where club_id is null or club_id not in('enl_rls_qa_20261023','__global__') or display_name is null or display_name not in('QA Member 20261023','QA Manager 20261023','QA Admin 20261023')"
];
const securitySQL=`select jsonb_build_object('tables',jsonb_build_object(${SECURITY.map(t=>quote(t)+','+fp('public.'+t)).join(',')}),'schemaSha256',${schemaSQL},'syntheticOnly',not exists(${invalidSecurity.join(' union all ')})) as state`;
const captureSQL=`select jsonb_build_object('qa',q.state,'security',s.state) as baseline from (${qaSQL}) q cross join (${securitySQL}) s`;
const temporaryGuard=`create function ${SCHEMA}.enl_v472_fixed_cleanup_guard() returns trigger language plpgsql set search_path='' as $guard$ begin
 if current_user='postgres' and tg_op='DELETE' and tg_table_schema='${SCHEMA}' and tg_table_name in(${list(Object.values(TRIGGERS))}) then
  if old.incident_id=any(${ids}) then return old; end if;
 end if; raise exception 'cleanup_scope_forbidden' using errcode='42501'; end $guard$;
 revoke all on function ${SCHEMA}.enl_v472_fixed_cleanup_guard() from public;
 ${Object.entries(TRIGGERS).map(([name,table])=>`create or replace trigger ${name} before delete or update on ${SCHEMA}.${table} for each row execute function ${SCHEMA}.enl_v472_fixed_cleanup_guard();`).join('\n')}`;
function canonical(v){return JSON.stringify(v&&typeof v==='object'?!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v.map(x=>JSON.parse(canonical(x))):v);}
function build({baseline,token,builtAt=Date.now(),expiresAt=builtAt+3600000}){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('invalid_token');
 if(expiresAt-builtAt>3600000||expiresAt<=builtAt)throw Error('invalid_expiry');
 if(!baseline?.qa?.safeDeleteGraph||!baseline.qa.targetSiteValid||!baseline.security?.syntheticOnly)throw Error('unsafe_baseline');
 if(canonical([...baseline.qa.ids].sort())!==canonical([...IDS].sort()))throw Error('exact_four_ids_required');
 for(const table of [...QA,'enl_evidence_objects'])for(const kind of ['keep','remove']){const f=baseline.qa.tables[table]?.[kind];if(!Number.isSafeInteger(f?.count)||f.count<0||!/^[a-f0-9]{64}$/.test(f?.sha256||''))throw Error('invalid_qa_baseline');}
 for(const table of SECURITY){const f=baseline.security.tables[table];if(!Number.isSafeInteger(f?.count)||f.count<0||!/^[a-f0-9]{64}$/.test(f?.sha256||''))throw Error('invalid_security_baseline');}
 if(!/^[a-f0-9]{64}$/.test(baseline.security.schemaSha256))throw Error('invalid_schema_hash');
 if(Object.keys(baseline.qa.guards).length!==4)throw Error('invalid_guards');
 for(const [name,table] of Object.entries(TRIGGERS)){
  const fn=name==='trg_enl_final_record_guard'?'enl_final_record_guard':'enl_evidence_append_only';
  const exact=`CREATE TRIGGER ${name} BEFORE DELETE OR UPDATE ON ${SCHEMA}.${table} FOR EACH ROW EXECUTE FUNCTION ${SCHEMA}.${fn}()`;
  if(baseline.qa.guards[name]!==exact)throw Error('unexpected_guard_definition');
 }
 const config={project:PROJECT,actorId:'qa-safety',ids:IDS,baseline,builtAt,expiresAt,tokenSha256:digest(token)};
 const sql={auth:`select role,active,password_hash from ${SCHEMA}.enl_hq_users where user_id=$1 limit 1`,qa:qaSQL,security:securitySQL,securityCount,
 lockQA:`set local lock_timeout='5s';set local statement_timeout='60s';set local idle_in_transaction_session_timeout='60s';lock table ${QA.map(t=>SCHEMA+'.'+t).concat(PRIVATE+'.enl_evidence_objects').join(',')} in access exclusive mode;`,
 lockSecurity:`lock table ${SECURITY.map(t=>'public.'+t).join(',')} in access exclusive mode;`,
 guard:temporaryGuard,
 deleteRows:TARGETS.map(t=>`delete from ${SCHEMA}.${t} where incident_id=any(${ids});`).join('\n'),
 restore:Object.values(baseline.qa.guards).map(s=>s.replace('CREATE TRIGGER ','CREATE OR REPLACE TRIGGER ')+';').join('\n')+`\ndrop function ${SCHEMA}.enl_v472_fixed_cleanup_guard();`,
 dropSecurity:`drop table ${SECURITY.map(t=>'public.'+t).join(',')};`};
 const source=fs.readFileSync(path.join(ROOT,'maintenance/staging-cleanup-runner.ts'),'utf8').replace('/*__CONFIG__*/ null as any',()=>JSON.stringify(config)).replace('/*__SQL__*/ null as any',()=>JSON.stringify(sql));
 if(source.includes(token))throw Error('plaintext_token_in_source');return {source,config,sql};
}
if(require.main===module){const [mode,output,baselineFile]=process.argv.slice(2);if(mode==='capture'){fs.writeFileSync(output,captureSQL);console.log(output);}else if(mode==='build'){
 if(path.resolve(output).startsWith(ROOT+path.sep)||!path.resolve(output).includes('/private-secrets/'))throw Error('private_secret_directory_required');
 const token=crypto.randomBytes(32).toString('hex'),built=build({baseline:JSON.parse(fs.readFileSync(baselineFile)),token});fs.mkdirSync(output,{recursive:true,mode:0o700});fs.chmodSync(output,0o700);
 for(const [name,value] of Object.entries({'index.ts':built.source,'token.txt':token,'config.json':JSON.stringify(built.config,null,2),'manifest.json':JSON.stringify({project:PROJECT,ids:IDS,expiresAt:new Date(built.config.expiresAt).toISOString(),sourceSha256:digest(built.source)},null,2)})){const file=path.join(output,name);fs.writeFileSync(file,value,{mode:0o600});fs.chmodSync(file,0o600);}
 console.log(JSON.stringify({output,project:PROJECT,expiresAt:new Date(built.config.expiresAt).toISOString(),sourceSha256:digest(built.source)}));
 }else throw Error('usage: capture output.sql | build private_output baseline.json');}
module.exports={build,captureSQL,qaSQL,securitySQL,securityCount,temporaryGuard,PROJECT,SCHEMA,PRIVATE,IDS,TARGETS,QA,SECURITY,TRIGGERS,canonical};
