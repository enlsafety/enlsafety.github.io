'use strict';
// Actual deployed-handler code with an isolated SQL double; never uses live credentials or data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const clone=x=>structuredClone(x);
const bulk=()=>({id:'qa-bulk',siteId:'qa-site',category:'person',status:'approved',eventType:'넘어짐',severity:'minor',summary:'격리 검증 사고',occurredAt:'2025-01-01',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',reporterId:'',reporterName:'',approvedAt:null,approvedBy:'',closedAt:null,corrective:null,reportDetails:{injuryDetail:'격리 검증',place:'격리 사업장'},acknowledgements:[],historicalOrigin:{batchId:'qa-batch',candidateId:'qa-candidate'},externalInitialApproval:{state:'verified',source:'ERP',documentNo:'QA-ERP'},reportWorkflow:{phase:'report_approved',initialApprovalSource:'ERP'}});
const ordinary=()=>({...bulk(),id:'qa-normal',historicalOrigin:undefined,externalInitialApproval:undefined,approvedAt:'2026-01-01T00:00:00Z',reporterId:'original'});
function harness(file){
 let handler,transaction=false,txActor=null;const syncMode=file.includes('enl-incident-sync-v411');const state={transactions:0,rollbacks:0,records:[bulk(),ordinary()],queries:[],writes:[],snapshot:[],raceBulk:false};
 const payloadParameter=value=>{if(!syncMode)return JSON.parse(value);assert.equal(value?.jsonParameter,true,'JSONB object must use sql.json, not a pre-stringified parameter');const payload=JSON.parse(JSON.stringify(value.value));assert.equal(typeof payload,'object');return payload};
 const preserveBulkOrigin=(before,after)=>{if(!before?.historicalOrigin?.batchId)return;assert.deepEqual(after.historicalOrigin,before.historicalOrigin,'BEFORE lifecycle guard must receive intact origin');assert.deepEqual(after.externalInitialApproval,before.externalInitialApproval,'BEFORE lifecycle guard must receive intact ERP approval')};
 const sql=async(parts,...args)=>{
  const q=parts.join('?').replace(/\s+/g,' ').trim();state.queries.push(q);
  if(q.startsWith("select set_config('enl.actor'")){assert.equal(transaction,true);txActor=JSON.parse(args[0]);assert.ok(['safety','field'].includes(txActor.role));return []}
  if(q.startsWith('lock ')){if(state.raceBulk)state.records.push(bulk());return [];}
  if(q.startsWith('select ')&&q.includes('enl_hq_users'))return [{user_id:'qa-safety',name:'격리 안전관리자',role:'safety',position:'',active:true,password_hash:'qa-proof'}];
  if(q.startsWith('select ')&&q.includes('enl_site_personnel'))return [{personnel_id:'qa-field',name:'격리 현장',site_id:'qa-site',access_role:'field',job_title:'현장소장',active:true,pin_hash:'qa-pin'}];
  if(q.startsWith('select ')&&q.includes('enl_site_master'))return [{site_id:'qa-site',active:true,start_date:'2020-01-01',contract_period:null}];
  if(q.startsWith('select ')&&q.includes('enl_incident_backups'))return [{backup_id:'qa-backup',snapshot:clone(state.snapshot)}];
  if(q.startsWith('select ')&&q.includes('enl_incident_shared')){
   if(q.startsWith('select incident_id from'))return state.records.filter(i=>i.historicalOrigin?.batchId&&i.historicalOrigin?.candidateId&&i.externalInitialApproval?.state==='verified').slice(0,1).map(i=>({incident_id:i.id}));
   if(q.includes('as "siteId"')){
    assert.match(q,/where not .*bulkInvalidation/,'aggregate query must exclude invalidated imports');
    return state.records.filter(i=>!i.bulkInvalidation?.active).map(i=>({siteId:i.siteId,occurredAt:i.occurredAt,status:i.status,category:i.category}));
   }
   const records=q.includes('where incident_id=')?state.records.filter(i=>i.id===args[0]):state.records;
   return records.map(i=>({incident_id:i.id,site_id:i.siteId,payload:clone(i),created_at:i.createdAt,updated_at:i.updatedAt}));
  }
  if(q.startsWith('insert into public.enl_incident_shared')){
   const p=payloadParameter(args[2]),idx=state.records.findIndex(i=>i.id===args[0]);
   if(syncMode){assert.equal(idx,-1,'existing records must use UPDATE to avoid bulk registration INSERT guard');assert.equal(transaction,true,'incident write requires transaction');assert.ok(txActor?.id,'verified actor is transaction local');assert.equal(p._syncBaseVersion,Number(state.records[idx]?._syncVersion||0));p._syncVersion=p._syncBaseVersion+1;delete p._syncBaseVersion;}
   if(idx>=0)state.records[idx]=p;else state.records.push(p);state.writes.push(q);return [{payload:clone(p)}];
  }
  if(q.startsWith('update public.enl_incident_shared')){const push=q.includes('set site_id='),p=payloadParameter(args[push?1:0]),idx=state.records.findIndex(i=>i.id===args[push?3:2]);if(syncMode){preserveBulkOrigin(state.records[idx],p);assert.equal(transaction,true);assert.ok(txActor?.id);assert.equal(p._syncBaseVersion,Number(state.records[idx]?._syncVersion||0));if(!push)assert.match(p._syncMutationId,/^ack:/);p._syncVersion=p._syncBaseVersion+1;delete p._syncBaseVersion;}state.records[idx]=p;state.writes.push(q);return [{payload:clone(p)}];}
  if(q.startsWith('delete from public.enl_incident_shared')){state.writes.push(q);state.records=q.includes('where')?state.records.filter(i=>i.id!==args[0]):[];return [];}
  if(q.startsWith('insert into public.enl_incident_audit')||q.startsWith('insert into public.enl_incident_backups')){if(syncMode)for(const p of args.slice(8))if(p!==null)payloadParameter(p);state.writes.push(q);return [];}
  throw Error('Unexpected isolated SQL: '+q);
 };sql.json=value=>({jsonParameter:true,value});sql.end=async()=>{};sql.begin=async fn=>{const before=clone(state.records),writes=state.writes.length;assert.equal(transaction,false);transaction=true;txActor=null;state.transactions++;try{return await fn(sql)}catch(e){state.records=before;state.writes.length=writes;state.rollbacks++;throw e}finally{transaction=false;txActor=null}};
 const context={Deno:{serve:f=>handler=f,env:{get:()=> 'isolated-db'}},postgres:()=>sql,Request,Response,TextEncoder,crypto,structuredClone,console};vm.createContext(context);
 vm.runInContext(fs.readFileSync('site-contract-v451.js','utf8'),context);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'')),context);
 const invoke=async(action,extra={},role='safety')=>{
  const response=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({action,actor:{id:role==='field'?'qa-field':'qa-safety',name:'격리 테스트',role,siteId:role==='field'?'qa-site':''},actorPasswordHash:'qa-proof',actorPinHash:'qa-pin',...extra})}));
  return {status:response.status,body:await response.json()};
 };return {state,invoke};
}
(async()=>{
 const {state,invoke}=harness('edge-functions/enl-incident-sync-v411/index.ts');
 let r=await invoke('acknowledge',{incidentId:'qa-bulk',documentType:'incident_report'});
 assert.equal(r.status,409);assert.equal(r.body.message,'external_initial_approval_no_duplicate_signature');assert.equal(state.writes.length,0);
 const edit=clone(state.records[0]);edit.summary='일반 수정으로 잘못 우회';
 r=await invoke('push',{incidents:[edit]});assert.equal(r.status,409);assert.equal(r.body.message,'bulk_update_requires_import_api');
 const spoof=clone(state.records[0]);spoof.historicalOrigin={batchId:'other',candidateId:'other'};
 assert.equal((await invoke('push',{incidents:[spoof]})).body.message,'bulk_record_scope_locked');
 const reopen=clone(state.records[0]);reopen.status='reported';
 assert.equal((await invoke('push',{incidents:[reopen]})).body.message,'bulk_initial_approval_locked');
 const invented=clone(state.records[0]);invented.approvedAt='2026-10-12T03:00:00Z';
 assert.equal((await invoke('push',{incidents:[invented]})).body.message,'bulk_initial_approval_locked');
 const created=bulk();created.id='qa-forged';assert.equal((await invoke('push',{incidents:[created]})).body.message,'bulk_registration_requires_import_api');
 const plan=clone(state.records[0]);plan.corrective={status:'planned',planDetail:'격리 계획',rootCause:'격리 원인',ownerName:'격리 현장',dueDate:'2026-10-20',planBy:'격리 안전관리자'};
 r=await invoke('push',{incidents:[plan]});assert.equal(r.status,200);assert.equal(r.body.pushed,1);assert.equal(state.records[0].status,'approved');assert.equal(state.records[0].reporterId,'');assert.equal(state.records[0].approvedAt,null);
 const submit=clone(state.records[0]);submit.corrective={...submit.corrective,status:'submitted',actionDetail:'격리 조치 실시',afterPhotos:[{id:'qa-photo'}]};
 r=await invoke('push',{incidents:[submit]},'field');assert.equal(r.status,200);assert.equal(state.records[0].corrective.status,'submitted');assert.equal(state.records[0].status,'approved');assert.equal(state.records[0].reporterId,'');
 const approve=clone(state.records[0]);approve.corrective={...approve.corrective,status:'approved',reviewedAt:'2026-10-12T03:00:00Z',reviewedBy:'격리 안전관리자'};
 r=await invoke('push',{incidents:[approve]});assert.equal(r.status,200);assert.equal(state.records[0].status,'closed');assert.equal(state.records[0].corrective.status,'approved');assert.equal(state.records[0].approvedAt,null);assert.equal(state.records[0].officialRecord.approval,undefined);
 const rollback=clone(state.records[0]);rollback.corrective=null;rollback.status='approved';
 assert.equal((await invoke('push',{incidents:[rollback]})).body.message,'bulk_followup_preservation_required');
 r=await invoke('acknowledge',{incidentId:'qa-bulk',documentType:'corrective_action'});assert.equal(r.status,200);assert.equal(r.body.receipt.documentType,'corrective_action');assert.equal(r.body.incident._syncVersion,state.records[0]._syncVersion,'acknowledge returns database-updated optimistic version');assert.ok(state.queries.some(q=>q.includes('for update')));
 const first=clone(state.records[1]);first.safetyNote='first mutation should roll back';
 const stale=clone(state.records[0]);stale.corrective={...stale.corrective,reviewNote:'stale attempt'};stale._syncBaseVersion=0;stale._syncMutationId='qa-stale';
 const unchanged=clone(state.records),writeCount=state.writes.length;r=await invoke('push',{incidents:[first,stale]});assert.equal(r.status,409);assert.equal(r.body.message,'enl_sync_conflict_version');assert.deepEqual(state.records,unchanged,'whole push rolls back after a later conflict');assert.equal(state.writes.length,writeCount);assert.ok(state.rollbacks>0);
 // The existing public-read serializer accepts verified ERP approval without forging approvedAt.
 const ctx={Deno:{serve:()=>{},env:{get:()=>''}},postgres:()=>{},Request,Response,TextEncoder,crypto,structuredClone,console};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-incident-sync-v411/index.ts','utf8').replace(/^import .*;\n/gm,'')),ctx);ctx.sample=clone(state.records[0]);
 assert.equal(vm.runInContext('publicIncident(sample).id',ctx),'qa-bulk');assert.equal(vm.runInContext('publicIncident(sample).approvedAt',ctx),'');
 state.records[0].bulkInvalidation={active:true,reason:'격리 무효'};
 r=await invoke('pull');assert.deepEqual(r.body.incidents.map(i=>i.id),['qa-normal']);
 r=await invoke('dashboard_read');assert.equal(r.body.metrics.length,1);
 const before=state.writes.length;r=await invoke('push',{incidents:[approve]});assert.equal(r.status,200);assert.equal(r.body.ignored,1);assert.equal(state.writes.length,before);
 assert.equal((await invoke('acknowledge',{incidentId:'qa-bulk',documentType:'corrective_action'})).body.message,'bulk_incident_invalidated');
 const h=harness('edge-functions/enl-incident-compliance-v439/index.ts');
 r=await h.invoke('delete_incident',{incidentId:'qa-bulk',reason:'격리 검증'});assert.equal(r.status,409);assert.equal(r.body.message,'bulk_delete_requires_invalidation');assert.equal(h.state.writes.length,0);
 r=await h.invoke('backup_restore',{backupId:'qa-backup',reason:'격리 검증'});assert.equal(r.status,409);assert.equal(h.state.writes.length,0);
 h.state.records=[ordinary()];h.state.snapshot=[{incident_id:'qa-bulk',site_id:'qa-site',payload:bulk()}];
 r=await h.invoke('backup_restore',{backupId:'qa-backup',reason:'격리 검증'});assert.equal(r.status,409);assert.equal(h.state.writes.length,0);
 h.state.snapshot=[];h.state.raceBulk=true;
 r=await h.invoke('backup_restore',{backupId:'qa-backup',reason:'격리 검증'});assert.equal(r.status,409);assert.ok(!h.state.writes.some(q=>q.startsWith('delete ')),'concurrent import must survive full restore');
 h.state.raceBulk=false;h.state.records=[ordinary()];
 r=await h.invoke('delete_incident',{incidentId:'qa-normal',reason:'격리 검증'});assert.equal(r.status,200,'ordinary compliance behavior retained');
 console.log('PASS: ERP initial approval block, normal prevention plan/field submit/safety close, public serializer, invalidation visibility/stale writes, bulk physical-delete/restore guards, ordinary deletion preservation');
})().catch(e=>{console.error(e);process.exit(1)});
