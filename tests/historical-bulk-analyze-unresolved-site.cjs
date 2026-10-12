'use strict';
// Regression: OCR/unknown-site documents must remain candidates for review,
// never abort the entire batch because a PostgreSQL placeholder is undefined.
// Fully isolated handler + SQL mock. No production records or credentials.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('edge-functions/enl-historical-bulk-v454/index.ts','utf8');
const core=fs.readFileSync('edge-functions/enl-historical-bulk-v454/historical-bulk-core.js','utf8');
const headers=['사업장명','사고일','사고구분','사고유형','사고정도','사고장소','당시작업','사고경위','당시조치','피해자','부상내용','ERP문서번호','ERP결재일','ERP결재상태','사고번호'];
const values=['테스트CC','2025-05-10','대인','베임','경미','3홀','예초작업','손에 가벼운 상처','응급처치','QA직원','손 상처','QA-ERP-1','2025-05-11','결재완료','QA-OLD-1'];
const matched={id:'resolved',name:'qa.csv',method:'text',units:[{location:'표1',rows:[headers,values]}]};
const missing={id:'missing',name:'qa-scan.pdf',method:'ocr',units:[{location:'1페이지',method:'ocr',text:'인식된 항목이 없는 별도 영수증'}]};
const refOnly={id:'ref-only',name:'qa-other.pdf',method:'ocr',units:[{location:'1페이지',method:'ocr',text:'사고번호: QA-OLD-77'}]};
function makeHarness(files){
 let handler;
 const state={batch:{id:'11111111-1111-4111-8111-111111111111',owner_id:'qa-safety',candidates:[],file_errors:[]},files,queries:[],binds:[],noDuplicateQueries:0};
 const sql=async(parts,...args)=>{
  const q=parts.join('?').replace(/\s+/g,' ').trim();
  state.queries.push(q);state.binds.push(args);
  assert.ok(!args.includes(undefined),'undefined SQL parameter must never be bound');
  if(q.includes('select user_id,name,role,active,password_hash from public.enl_hq_users'))return [{user_id:'qa-safety',name:'QA safety',role:'safety',active:true,password_hash:'qa-proof'}];
  if(q.includes('select * from private.enl_historical_batches'))return [structuredClone(state.batch)];
  if(q.includes('pg_advisory_xact_lock'))return [];
  if(q.includes('from public.enl_site_master'))return [{site_id:'s1',site_name:'테스트CC',active:true,start_date:'2020-01-01',contract_period:null}];
  if(q.includes('select file_id as id,name,method,units'))return state.files.map(f=>structuredClone(f));
  if(q.includes('select file_id from private.enl_historical_files'))return state.files.map(f=>({file_id:f.id}));
  if(q.includes('select incident_id,payload from public.enl_incident_shared')){state.noDuplicateQueries++;return [];}
  if(q.startsWith('update private.enl_historical_batches')){const p=args.find(x=>x&&x.__json);assert.ok(p,'candidate JSON payload expected');state.batch.candidates=structuredClone(p.value);return [];}
  if(q.startsWith('insert into private.enl_historical_import_audit'))return [];
  throw Error('Unexpected isolated SQL query: '+q);
 };
 sql.json=value=>({__json:true,value});
 sql.begin=async fn=>fn(sql);
 sql.end=async()=>{};
 const context={Deno:{serve:f=>handler=f,env:{get:name=>name==='SUPABASE_URL'?'https://zgwxzfvvpqgdedyobwmg.supabase.co':'isolated-qa'}},
  postgres:()=>sql,createClient:()=>{throw Error('storage should not be accessed for analyze');},
  Request,Response,TextEncoder,crypto:webcrypto,structuredClone,console};
 vm.createContext(context);
 vm.runInContext(core,context);
 vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*;\s*$/gm,'')),context);
 async function analyze(){
  const response=await handler(new Request('https://qa.local',{method:'POST',
   headers:{origin:'https://enlsafety.github.io','x-enl-app':'incident-report-v2','content-type':'application/json'},
   body:JSON.stringify({action:'analyze',batchId:state.batch.id,actor:{id:'qa-safety'},actorPasswordHash:'qa-proof'})}));
  return {status:response.status,body:await response.json()};
 }
 return {state,analyze};
}
(async()=>{
 const h=makeHarness([missing,matched,refOnly]);
 const out=await h.analyze();
 assert.equal(out.status,200,JSON.stringify(out.body));
 assert.equal(out.body.ok,true);
 assert.equal(out.body.candidates.length,3);
 const unknown=out.body.candidates.filter(x=>!x.values.siteId);
 assert.equal(unknown.length,2);
 assert.ok(unknown.every(x=>x.state==='review'));
 assert.ok(unknown.every(x=>x.validation.some(i=>i.code==='site')));
 assert.equal(out.body.candidates.find(x=>x.values.siteId==='s1').state,'ready');
 assert.equal(h.state.noDuplicateQueries,2,'no-identifier OCR skips duplicate query; known IDs remain checked');
 assert.equal(h.state.batch.candidates.length,3,'analyzed candidates persisted only within isolated batch');
 const many=makeHarness(Array.from({length:24},(_,i)=>({...missing,id:'unknown-'+i})));
 const again=await many.analyze();
 assert.equal(again.status,200,JSON.stringify(again.body));
 assert.equal(again.body.candidates.length,24,'many unidentified OCR files must not block the whole batch');
 assert.ok(again.body.candidates.every(x=>x.state==='review'));
 assert.equal(many.state.noDuplicateQueries,0,'undefined site and record numbers never reach duplicate SQL');
 console.log('PASS: actual Edge analyze handler preserves unknown-site OCR candidates and recognized accident, 24-file batch; no undefined SQL bindings');
})().catch(e=>{console.error(e);process.exit(1)});
