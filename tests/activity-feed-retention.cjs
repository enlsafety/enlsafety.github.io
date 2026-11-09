// Run against a disposable PostgreSQL database. Substitute a recorder for pg_cron.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();
 try{
  const q=(role,action,args)=>f.call(role,{action,feed:'all',...args});
  const event=async(key,age,kind='common')=>(await f.db.query(
   "insert into private.enl_activity_events(source_key,incident_id,happened_at,actor_role,actor_id,kind,module_key) values($1,'qa-record',now()-$2::interval,'safety','qa-safety','update',$3) returning id::text",[key,age,kind])).rows[0].id;
  const old=await event('expired','31 days');
  await f.db.query("insert into private.enl_activity_reads values('qa-safety',$1)",[old]);
  await f.db.exec("create schema cron; create table cron.jobs(name text,spec text,command text);create function cron.schedule(text,text,text) returns void language sql as $$insert into cron.jobs values($1,$2,$3)$$;");
  assert.equal((await q('safety','activity_list',{recentOnly:true})).body.rows.length,0);
  const manual=await event('eligible-before-migration','1 hour');
  await f.db.query("insert into private.enl_activity_reads values('qa-safety',$1)",[manual]);
  assert.equal((await q('safety','activity_remove',{mode:'one',id:manual,confirmed:true})).body.removed,1);
  assert.equal((await f.db.query('select 1 from private.enl_activity_reads where event_id=$1',[manual])).rows.length,0);
  const sql=fs.readFileSync('supabase/migrations/20261109063000_activity_feed_retention.sql','utf8');
  await f.db.exec('begin;'+sql+'commit;');
  assert.equal((await f.db.query('select count(*)::int n from private.enl_activity_reads')).rows[0].n,0);
  const {command,spec}= (await f.db.query('select * from cron.jobs')).rows[0];assert.equal(spec,'*/5 * * * *');
  await event('expired-since-run','721 hours');
  const keep=await event('current','719 hours');
  assert.ok(!(await q('safety','activity_list',{})).body.rows.some(x=>x.id===old));
  assert.equal((await q('safety','activity_list',{})).body.rows.length,1);
  await f.db.exec(command);
  const first={mode:'one',id:keep,confirmed:true};
  for(const role of ['manager','field','executive'])assert.equal((await q(role,'activity_remove',first)).status,403);
  assert.equal((await f.raw({actor:f.actors.safety,action:'activity_remove',...first})).status,403);
  assert.equal((await q('safety','activity_remove',{...first,confirmed:false})).status,400);
  assert.equal((await q('safety','activity_remove',first)).body.removed,1);
  assert.equal((await q('safety','activity_remove',first)).body.removed,0);
  const incident={id:'qa-keep',siteId:'qa-site',status:'reported',category:'property',summary:'fixture',eventType:'접촉',occurredAt:new Date().toISOString(),reportDetails:{place:'QA'},corrective:null,photos:[],_syncBaseVersion:0,_syncMutationId:'create'};
  assert.equal((await q('field','push',{incidents:[incident]})).status,200);
  const source=async()=>JSON.stringify((await f.db.query("select payload from public.enl_incident_shared where incident_id='qa-keep'")).rows);
  const before=await source();assert.notEqual(before,'[]');
  const today=(await f.db.query("select to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') as local_date")).rows[0].local_date;
  const scope={mode:'range',feed:'common',fromDate:today,toDate:today};
  await event('bulk-before','0 days');
  let pre=(await q('safety','activity_remove_preview',scope)).body;assert.equal(pre.count,1);
  await event('bulk-later','0 days');
  assert.equal((await q('safety','activity_remove',{...scope,confirmed:true,previewToken:pre.token})).status,409);
  pre=(await q('safety','activity_remove_preview',scope)).body;assert.equal(pre.count,2);
  assert.equal((await q('safety','activity_remove',{...scope,confirmed:true,previewToken:pre.token})).body.removed,2);
  const all={mode:'all'};pre=(await q('safety','activity_remove_preview',all)).body;assert.ok(pre.count>0);
  assert.equal((await q('safety','activity_remove',{...all,confirmed:true,previewToken:pre.token})).body.removed,pre.count);
  assert.equal(await source(),before);assert.ok((await f.db.query("select 1 from public.enl_incident_audit where incident_id='qa-keep'")).rows.length);
  assert.equal((await q('safety','activity_count',{})).body.unread,0);
  const audit=(await q('safety','activity_cleanup_audit',{})).body.rows;
  assert.ok(audit.every(x=>x.scope.permanent&&x.count>0&&!x.reason));
  console.log('PASS 30-day expiry, physical purge, account and role checks, scope preview, changed-set protection, audit and intact source documents');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
