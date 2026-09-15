// Real OpenAI QA only. No mocks and no automatic model downgrade.
// Requires an authorized, temporary staging safety account JSON outside the repo:
// {id, credential}, where credential is its existing app authentication hash.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const endpoint='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-ai-safety-v440';
const q=JSON.parse(fs.readFileSync(process.env.ENL_QA_CREDENTIAL_FILE));
const results=[],report=new URL('./artifacts/real-e2e.json',import.meta.url);fs.mkdirSync(new URL('./artifacts/',import.meta.url),{recursive:true});
async function api(body){const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':'incident-report-v2'},body:JSON.stringify({...body,actor:{id:q.id,role:'safety'},passwordHash:q.credential}),signal:AbortSignal.timeout(25000)});const r=await res.json();if(!res.ok)throw Error(r.message||'http_'+res.status);return r;}
async function finish(id){const deadline=Date.now()+9*60000;while(Date.now()<deadline){const r=await api({action:'get_workflow',workflowId:id});if(!['queued','running'].includes(r.workflow.status))return r;await new Promise(r=>setTimeout(r,3000));}throw Error('workflow deadline');}
const cases=[['A','골프장 작업 중 넘어짐 사고가 발생했는데 현장에서 지금 무엇부터 해야 하나?'],['B','상시근로자 500명 이상 사업장에서 안전보건 관련 법적 의무를 검토해줘.'],['C','우리 사업장 안전관리자 몇 명 선임해야 돼?'],['D','근로자가 예초 작업 중 돌에 맞아 눈 주변을 다쳤고 보호안경은 착용하지 않았다. 사고조사와 재발방지대책, 법적 검토까지 해줘.']];
try{
 results.push({configuration:await api({action:'inspect_ai_configuration'})});
 for(const [name,question] of cases){
  const body={action:'review_question',question:'[QA 합성 질의] '+question,requestId:crypto.randomUUID()};
  const [first,duplicate]=await Promise.all([api(body),api(body)]);assert.equal(first.workflowId,duplicate.workflowId,'duplicate request created work');
  let r=await finish(first.workflowId);results.push({case:name,...r});fs.writeFileSync(report,JSON.stringify(results,null,2));
  if(r.workflow.status==='failed'){const diagnostics=r.runs.map(x=>x.output_payload?._meta?.error).filter(Boolean);console.log(JSON.stringify({case:name,status:'EXTERNAL_OR_RUNTIME_FAILURE',diagnostics}));process.exitCode=2;break;}
  assert.equal(r.runs.length,4);assert(r.runs.every(x=>x.status==='completed'));assert.equal(new Set(r.runs.map(x=>x.agent_id)).size,4);assert.equal(r.events.filter(e=>e.event_type==='handoff').length,3);
  if(name==='B'){assert(r.runs.find(x=>x.agent_id==='legal_reviewer').output_payload.official_sources.length>0);assert(r.workflow.requires_human_approval);}
  if(name==='C'){assert(r.events.some(e=>e.event_type==='missing_info_found'));assert(r.workflow.requires_human_approval);}
  if(r.workflow.status==='awaiting_approval'){await api({action:'decide_workflow',workflowId:r.workflow.id,decision:'held',note:'QA 보류 검증'});await api({action:'decide_workflow',workflowId:r.workflow.id,decision:'approved',note:'QA 합성자료에 한한 승인'});}
  r=await api({action:'get_workflow',workflowId:r.workflow.id});assert.equal(r.workflow.status,'completed');console.log('PASS real OpenAI case',name,r.workflow.id);
  if(name==='D'){const reviewed=await api({action:'decide_workflow',workflowId:r.workflow.id,decision:'re_review',note:'QA: 눈 손상 응급조치와 공식 근거를 다시 검토'});assert.notEqual(reviewed.workflowId,r.workflow.id);const next=await finish(reviewed.workflowId);results.push({case:'G',...next});assert.equal(next.runs.length,4);assert(next.runs.every(x=>x.status==='completed'));assert.equal(next.events.filter(e=>e.event_type==='handoff').length,3);}
 }
}finally{fs.writeFileSync(report,JSON.stringify(results,null,2));}
