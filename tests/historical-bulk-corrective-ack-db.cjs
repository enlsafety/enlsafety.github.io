'use strict';
// Execute only the captured optimistic guards and the real migrations in an
// isolated PostgreSQL WASM database. No remote connection or real user data.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const baseline=require('./fixtures/optimistic-sync-guards.json');
const migration=fs.readFileSync('supabase/migrations/20261012021349_corrective_ack_guard.sql','utf8');
const lifecycle=fs.readFileSync('supabase/migrations/20261012014807_historical_bulk_lifecycle_guard.sql','utf8');
const clone=structuredClone;
const identities={
 manager:{id:'qa-manager',name:'QA manager',role:'manager',position:'팀장',siteId:''},
 executive:{id:'qa-executive',name:'QA executive',role:'executive',position:'임원',siteId:''},
 field:{id:'qa-field',name:'QA field',role:'field',position:'현장소장',siteId:'qa-site'},
 fieldStaff:{id:'qa-field-staff',name:'QA staff',role:'field',position:'직원',siteId:'qa-site'},
 safety:{id:'qa-safety',name:'QA safety',role:'safety',position:'안전관리자',siteId:''}
};
const receipt=(a,at)=>({documentType:'corrective_action',userId:a.id,name:a.name,role:a.role,position:a.position,siteId:a.siteId,ackAt:at,label:'재발방지조치 결재'});
const original={id:'qa-incident',siteId:'qa-site',status:'closed',summary:'isolated fixture',reporterId:'qa-owner',approvedAt:null,approvedBy:'',corrective:{status:'approved',actionDetail:'isolated approved action'},historicalOrigin:{batchId:'qa-batch',candidateId:'qa-candidate'},externalInitialApproval:{state:'verified'},officialRecord:{},updatedAt:'2026-10-12T00:00:00.000Z',_syncVersion:4,_syncBaseVersion:3,_syncMutationId:'edge:prior',acknowledgements:[receipt({id:'qa-other',name:'QA other',role:'manager',position:'',siteId:''},'2026-10-11T00:00:00.000Z'),receipt(identities.manager,'2026-10-11T00:00:00.000Z')]};
function acknowledged(actor){const q=clone(original);q.updatedAt='2026-10-12T02:20:00.000Z';q._syncBaseVersion=4;q._syncMutationId=`ack:${actor.id}:${q.id}:qa-new`;q.acknowledgements=q.acknowledgements.filter(x=>!(x.userId===actor.id&&x.documentType==='corrective_action'));q.acknowledgements.push(receipt(actor,q.updatedAt));return q}
async function attempt(db,actor,next){
 let result;const rollback=new Error('isolated rollback');
 try{await db.transaction(async tx=>{if(actor)await tx.query("select set_config('enl.actor',$1,true)",[JSON.stringify({id:actor.id,role:actor.role})]);const rows=await tx.query('update public.enl_incident_shared set payload=$1::jsonb where incident_id=$2 returning payload',[JSON.stringify(next),'qa-incident']);result={ok:true,payload:rows.rows[0].payload};throw rollback})}
 catch(e){if(e!==rollback)result={ok:false,code:e.code,message:e.message}}
 return result;
}
async function reject(db,actor,next,message){const r=await attempt(db,actor,next);assert.equal(r.ok,false,`must reject ${message}`);assert.match(r.message,new RegExp(message));return r}
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated;
 create table public.enl_hq_users(user_id text primary key,name text,role text,position text,active boolean);
 create table public.enl_site_personnel(personnel_id text primary key,name text,access_role text,job_title text,site_id text,active boolean);
 create table public.enl_incident_shared(incident_id text primary key,site_id text,payload jsonb);
 create function public.enl_incident_push_trigger() returns trigger language plpgsql as $$begin return new; end;$$;`);
 for(const a of Object.values(identities)){if(a.role==='field')await db.query('insert into public.enl_site_personnel values($1,$2,$3,$4,$5,true)',[a.id,a.name,a.role,a.position,a.siteId]);else await db.query('insert into public.enl_hq_users values($1,$2,$3,$4,true)',[a.id,a.name,a.role,a.position])}
 await db.query('insert into public.enl_incident_shared values($1,$2,$3::jsonb)',[original.id,original.siteId,JSON.stringify(original)]);
 await db.exec(baseline.staging);
 await db.exec('create trigger trg_optimistic before update on public.enl_incident_shared for each row execute function public.enl_incident_optimistic_sync_guard()');
 await reject(db,identities.manager,acknowledged(identities.manager),'reader_write_forbidden');
 await db.exec(migration);
 await db.exec(lifecycle);
 for(const name of ['manager','executive','field']){const r=await attempt(db,identities[name],acknowledged(identities[name]));assert.equal(r.ok,true,`${name} own corrective ack: ${r.message}`);assert.equal(r.payload._syncVersion,5);assert.deepEqual(r.payload.corrective,original.corrective);assert.deepEqual(r.payload.externalInitialApproval,original.externalInitialApproval)}
 await reject(db,null,acknowledged(identities.manager),'verified_session_required');
 await reject(db,{...identities.manager,role:'safety'},acknowledged(identities.manager),'forbidden');
 await reject(db,identities.fieldStaff,acknowledged(identities.fieldStaff),'approved_report_read_only');
 for(const mutate of [q=>q.summary='tampered',q=>q.corrective.actionDetail='tampered',q=>q.officialRecord.finalApproval={id:'forged'},q=>q.acknowledgements.shift(),q=>q.acknowledgements[0].name='tampered',q=>q.acknowledgements.push(clone(q.acknowledgements.at(-1))),q=>q.acknowledgements.at(-1).role='safety',q=>q.acknowledgements.at(-1).name='spoofed',q=>q.acknowledgements.at(-1).extra='injected',q=>q.acknowledgements.at(-1).documentType='incident_report',q=>q._syncVersion=9,q=>q._syncMutationId='edge:unscoped']){
  const q=acknowledged(identities.manager);mutate(q);const r=await attempt(db,identities.manager,q);assert.equal(r.ok,false,'ack must not authorize unrelated, spoofed, duplicated or unscoped changes');assert.equal(r.code,'42501')
 }
 const stale=acknowledged(identities.manager);stale._syncBaseVersion=0;assert.equal((await reject(db,identities.manager,stale,'enl_sync_conflict_version')).code,'40001');
 for(const mutate of [q=>q.status='reported',q=>q.approvedAt='2026-10-12T00:00:00Z',q=>q.approvedBy='new approver',q=>q.officialRecord.approval={id:'new approver'}]){const q=acknowledged(identities.safety);mutate(q);await reject(db,identities.safety,q,'bulk_initial_approval_immutable')}
 const finish=clone(original);finish._syncBaseVersion=4;finish._syncMutationId='edge:qa-safety:finish';finish.officialRecord.finalApproval={id:'qa-safety'};assert.equal((await attempt(db,identities.safety,finish)).ok,true,'subsequent final approval remains allowed');
 const definition=async()=>String((await db.query("select pg_get_functiondef('public.enl_incident_optimistic_sync_guard()'::regprocedure) as definition")).rows[0].definition);
 const staged=await definition();await db.exec(migration);assert.equal(await definition(),staged,'migration is idempotent');
 await db.exec(baseline.production);const production=await definition();await db.exec(migration);assert.equal(await definition(),production,'existing production version-only guard is preserved byte for byte');
 await db.close();
 console.log('PASS: actual PostgreSQL guarded own corrective acknowledgement, spoof/tamper/initial approval denial, unchanged auth and version enforcement, final approval preservation, idempotent migration and production no-op');
})().catch(e=>{console.error(e);process.exit(1)});
