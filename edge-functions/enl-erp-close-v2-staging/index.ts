import postgres from 'npm:postgres@3.4.5';
import {Fault,assertReady,packageIncident,sha256,applyProviderResult,enforceClosureWrite,terminal,liveProvider} from '../../erp-close-v2/core.mjs';
import {fixture,MOCK_LINE,SCENARIOS} from '../../erp-close-v2/fixtures.mjs';

const PROJECT='zgwxzfvvpqgdedyobwmg';
const allowedOrigins=new Set(['https://enlsafety.github.io','http://localhost:4173','http://127.0.0.1:4173']);
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')||'',{prepare:false,max:1,idle_timeout:20,connect_timeout:10});
const now=()=>new Date().toISOString();
const audit=(tx:any,c:any,j:any,event:string,role:string,detail:any={})=>tx`insert into enl_erp_close_v2.audit(case_id,job_id,event,actor_role,detail) values(${c},${j},${event},${role},${tx.json(detail)})`;
const must=(a:any,role:string)=>{if(a.role!==role)throw new Fault(`${role}_only`,403);};
async function owned(tx:any,a:any,id:string,lock=false){
  const rows=lock?await tx`select * from enl_erp_close_v2.cases where id=${id} and run_id=${a.run_id} for update`:await tx`select * from enl_erp_close_v2.cases where id=${id} and run_id=${a.run_id}`;
  if(!rows[0])throw new Fault('not_found',404);return rows[0];
}
const latest=(tx:any,c:any)=>tx`select * from enl_erp_close_v2.jobs where case_id=${c.id} and revision=${c.revision}`;
function publicJob(j:any){if(!j)return null;return {id:j.id,state:j.state,documentId:j.document_id,clientReference:j.client_reference,attempts:j.attempts,error:j.error_code,nextAttemptAt:j.next_attempt_at,snapshotHash:j.snapshot.snapshotHash,attachmentCount:j.snapshot.attachments.length};}
async function view(a:any,id:string){
  const c=await owned(sql,a,id),[j]=await latest(sql,c);
  return {incident:c.payload,revision:c.revision,job:publicJob(j),provider:'mock',liveERP:false};
}
async function requestClosure(a:any,id:string){
  must(a,'safety');
  return await sql.begin(async(tx:any)=>{
    const c=await owned(tx,a,id,true),[old]=await latest(tx,c);
    if(old)return {job:publicJob(old),deduplicated:true};
    assertReady(c.payload,a.role);
    const snapshot=await packageIncident(c.payload,c.revision,MOCK_LINE);
    const [j]=await tx`insert into enl_erp_close_v2.jobs(case_id,revision,client_reference,snapshot,state,next_attempt_at) values(${c.id},${c.revision},${snapshot.clientReference},${tx.json(snapshot)},'queued',now()) returning *`;
    await audit(tx,c.id,j.id,'closure_requested',a.role,{snapshotHash:snapshot.snapshotHash});
    return {job:publicJob(j),deduplicated:false};
  });
}
// A fake ERP in a separate table/transaction, so a committed remote operation can
// survive an ambiguous response. This is deliberately NOT an HTTP ERP adapter.
async function mockSubmit(j:any,scenario:string){
  const [existing]=await sql`select * from enl_erp_close_v2.mock_documents where client_reference=${j.client_reference}`;
  if(existing?.submitted)return existing;
  if(scenario==='transient_before_submit'&&j.attempts===1)throw new Fault('mock_transport_unavailable',503);
  const docId=`MOCK-${j.id}`;
  await sql`insert into enl_erp_close_v2.mock_documents(id,client_reference,snapshot_hash,title,body,approval_line) values(${docId},${j.client_reference},${j.snapshot.snapshotHash},${j.snapshot.title},${j.snapshot.body},${sql.json(j.snapshot.approvalLine)}) on conflict(client_reference) do nothing`;
  if(scenario==='attachment_failure'&&j.attempts===1)throw new Fault('mock_attachment_failed',503);
  // Only submit after every immutable attachment's bytes pass its manifest hash.
  for(const f of j.snapshot.attachments){const bytes=Uint8Array.from(atob(f.base64),(c:string)=>c.charCodeAt(0));if(await sha256(bytes)!==f.sha256)throw new Fault('attachment_hash_mismatch');}
  const [doc]=await sql`update enl_erp_close_v2.mock_documents set attachments=${sql.json(j.snapshot.attachments)},submitted=true where client_reference=${j.client_reference} returning *`;
  if(scenario==='timeout_after_submit'&&j.attempts===1)throw new Fault('mock_response_lost',503);
  return doc;
}
async function step(a:any,id:string){
  must(a,'qa'); // deployment has no production scheduler or real ERP credentials
  const claimed=await sql.begin(async(tx:any)=>{
    const c=await owned(tx,a,id,true),[j]=await latest(tx,c);
    if(!j)throw new Fault('no_request');
    if(terminal(j.state)||j.state==='error')return {skip:true};
    if(j.lease_until&&new Date(j.lease_until).getTime()>Date.now())return {skip:true};
    if(j.next_attempt_at&&new Date(j.next_attempt_at).getTime()>Date.now())return {skip:true};
    const [claim]=await tx`update enl_erp_close_v2.jobs set state=${j.document_id?j.state:'submitting'},lease_until=now()+interval '30 seconds',attempts=attempts+1,updated_at=now() where id=${j.id} returning *`;
    return {c,j:claim};
  });
  if(claimed.skip)return view(a,id);
  const {c,j}=claimed;
  try{
    const doc=await mockSubmit(j,c.scenario);
    await sql.begin(async(tx:any)=>{
      const fresh=await owned(tx,a,id,true),[current]=await latest(tx,fresh);
      if(current.id!==j.id||terminal(current.state)||current.attempts!==j.attempts)return;
      const observed={id:doc.id,clientReference:doc.client_reference,snapshotHash:doc.snapshot_hash,result:doc.result,decidedAt:doc.decided_at,reason:doc.reason};
      const result=applyProviderResult(fresh.payload,{...current,document_id:doc.id},observed);
      await tx`update enl_erp_close_v2.jobs set document_id=${doc.id},state=${result.state},lease_until=null,error_code=${result.state==='status_unknown'?'unrecognized_erp_result':null},next_attempt_at=now()+interval '2 seconds',updated_at=now() where id=${j.id}`;
      await tx`update enl_erp_close_v2.cases set payload=${tx.json(result.incident)} where id=${c.id}`;
      await audit(tx,c.id,j.id,'provider_observed','integration',{result:result.state,documentId:doc.id});
    });
  }catch(err){
    const code=err instanceof Fault?err.message:'transport_error';
    const state=code==='mock_response_lost'?'submission_unknown':j.attempts>=5?'error':'retry_wait';
    const delay=Math.min(60,2**j.attempts);
    await sql.begin(async(tx:any)=>{
      await owned(tx,a,id,true);
      const [updated]=await tx`update enl_erp_close_v2.jobs set state=${state},error_code=${code},lease_until=null,next_attempt_at=now()+${delay}*interval '1 second',updated_at=now() where id=${j.id} and attempts=${j.attempts} and state not in ('approved','rejected') returning id`;
      if(updated)await audit(tx,c.id,j.id,'integration_error','integration',{code,retrySeconds:delay});
    });
  }
  return view(a,id);
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  const headers:any={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin&&allowedOrigins.has(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization, content-type';headers['Access-Control-Allow-Methods']='POST, GET, OPTIONS';}
  const respond=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers});
  try{
    if(new URL(Deno.env.get('SUPABASE_URL')||'https://invalid').hostname!==`${PROJECT}.supabase.co`)throw new Fault('staging_project_required',503);
    if(origin&&!allowedOrigins.has(origin))throw new Fault('origin_not_allowed',403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method==='GET')return respond({service:'enl-erp-close-v2-staging',provider:'mock',liveERP:false,productionWrites:false});
    if(req.method!=='POST')throw new Fault('method_not_allowed',405);
    const auth=req.headers.get('authorization')||'';
    if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(auth))throw new Fault('unauthorized',401);
    const hash=await sha256(auth.slice(7));
    const [a]=await sql`select run_id,role from enl_erp_close_v2.tokens where token_hash=${hash} and expires_at>now()`;
    if(!a)throw new Fault('unauthorized',401);
    const raw=await req.text();if(raw.length>16000)throw new Fault('request_too_large',413);
    let b:any;try{b=JSON.parse(raw);}catch{throw new Fault('invalid_json',400);}
    if(b.provider&&b.provider!=='mock')liveProvider();
    const id=String(b.id||'');
    if(b.action==='seed'){
      must(a,'qa');if(!SCENARIOS.includes(b.scenario||'normal'))throw new Fault('invalid_scenario',400);
      const caseId=`qa-${crypto.randomUUID()}`,payload=fixture(caseId);
      await sql`insert into enl_erp_close_v2.cases(id,run_id,payload,scenario) values(${caseId},${a.run_id},${sql.json(payload)},${b.scenario||'normal'})`;
      return respond(await view(a,caseId));
    }
    if(b.action==='due'){
      must(a,'qa');
      const rows=await sql`select c.id from enl_erp_close_v2.cases c join enl_erp_close_v2.jobs j on j.case_id=c.id and j.revision=c.revision where c.run_id=${a.run_id} and j.state not in ('approved','rejected','error') and (j.next_attempt_at is null or j.next_attempt_at<=now()) and (j.lease_until is null or j.lease_until<=now()) order by j.next_attempt_at nulls first limit 25`;
      return respond({caseIds:rows.map((r:any)=>r.id)});
    }
    if(b.action==='get')return respond(await view(a,id));
    if(b.action==='request')return respond(await requestClosure(a,id));
    if(b.action==='step')return respond(await step(a,id));
    if(b.action==='manual_close'||b.action==='update'){
      const c=await owned(sql,a,id),[j]=await latest(sql,c);
      enforceClosureWrite(c.payload,{...c.payload,status:'closed'},j);
      throw new Fault('writes_available_only_through_workflow');
    }
    if(b.action==='retry'){
      must(a,'safety');await sql.begin(async(tx:any)=>{
        const c=await owned(tx,a,id,true),[j]=await latest(tx,c);
        if(!j||!['error','retry_wait','submission_unknown','status_unknown'].includes(j.state))throw new Fault('not_retryable');
        if(j.lease_until&&new Date(j.lease_until).getTime()>Date.now())throw new Fault('worker_busy');
        await tx`update enl_erp_close_v2.jobs set state=${j.document_id?'status_unknown':'submission_unknown'},next_attempt_at=now(),error_code=null where id=${j.id}`;
        await audit(tx,id,j.id,'retry_requested',a.role);
      });return respond(await view(a,id));
    }
    if(b.action==='decide'){
      must(a,'qa');if(!['approved','rejected','처리완료'].includes(b.result))throw new Fault('invalid_mock_result',400);
      await sql.begin(async(tx:any)=>{
        const c=await owned(tx,a,id,true),[j]=await latest(tx,c);
        if(!j?.document_id||terminal(j.state))throw new Fault('not_pending');
        const [d]=await tx`update enl_erp_close_v2.mock_documents set result=${b.result},reason=${b.result==='rejected'?'가상 반려: 조치증빙 보완':null},decided_at=now() where id=${j.document_id} and submitted=true and result not in ('approved','rejected') returning id`;
        if(!d)throw new Fault('decision_already_final');
        await tx`update enl_erp_close_v2.jobs set next_attempt_at=now() where id=${j.id}`;
        await audit(tx,id,j.id,'mock_decision','qa',{result:b.result});
      });return respond({ok:true});
    }
    if(b.action==='qa_recheck'){
      must(a,'qa');await sql.begin(async(tx:any)=>{
        const c=await owned(tx,a,id,true),[j]=await latest(tx,c);
        if(j?.state!=='rejected')throw new Fault('rejection_required');
        const payload=fixture(id,c.revision+1);
        await tx`update enl_erp_close_v2.cases set revision=revision+1,payload=${tx.json(payload)} where id=${id}`;
        await audit(tx,id,j.id,'synthetic_evidence_rechecked','qa');
      });return respond(await view(a,id));
    }
    if(b.action==='audit'){
      must(a,'qa');await owned(sql,a,id);
      return respond({events:await sql`select event,actor_role,detail,created_at from enl_erp_close_v2.audit where case_id=${id} order by id`});
    }
    throw new Fault('unknown_action',400);
  }catch(e){return respond({error:e instanceof Fault?e.message:'internal_error'},e instanceof Fault?e.status:500);}
});
