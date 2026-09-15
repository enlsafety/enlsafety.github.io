// Focused diagnostic-only QA. No real API calls or unrelated regression suites.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {requestWithBackoff} from '../edge/enl-ai-safety-v440/service-errors.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
let calls=0,transient;const secret='fake-private-key-for-diagnostic-test';
const reply=()=>new Response(JSON.stringify({error:{type:'requests',code:'rate_limit_exceeded',message:'Rate limit '+secret,param:null}}),{status:429,headers:{'retry-after':'1','x-request-id':'qa-request','x-ratelimit-remaining-requests':'0'}});
await requestWithBackoff({}, {headers:{Authorization:'Bearer '+secret},sleep:async()=>{},random:()=>0,fetcher:async()=>++calls===1?reply():new Response('{}'),onRetry:async e=>{transient=e.diagnostic;}});
assert.equal(transient.http_status,429);assert.equal(transient.retry_count,0);assert.equal(transient.headers['retry-after'],'1');assert(!transient.message.includes(secret));
let terminal;try{await requestWithBackoff({}, {headers:{Authorization:'Bearer '+secret},sleep:async()=>{},random:()=>0,fetcher:async()=>reply()});}catch(e){terminal=e.diagnostic;}
assert.equal(terminal.retry_count,2);assert.equal(terminal.code,'rate_limit_exceeded');
const id='10000000-0000-4000-8000-000000000001',stamp=new Date().toISOString();
const context={model:'qa-model',agent:'incident_manager',job_id:id};
const run={id:'run-1',workflow_id:id,agent_id:context.agent,status:'failed',started_at:stamp,completed_at:stamp,output_payload:{_meta:{error:{...terminal,...context,Authorization:secret,service_role_key:secret}}}};
const workflow={id,status:'failed',current_agent:context.agent,input_summary:'PRIVATE QUESTION MUST NOT ENTER REPORT',created_at:stamp};
const events=[{id:'e1',workflow_id:id,agent_run_id:run.id,agent_id:context.agent,event_type:'retry_scheduled',title:'재시도 대기',status:'retrying',created_at:stamp,metadata:{diagnostic:{...transient,...context}}}];
const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 if(route.request().url().includes('.supabase.co'))return route.fulfill({json:{ok:true,workflows:[workflow],workflow,runs:[run],events,findings:[],approvals:[]},headers:{'Access-Control-Allow-Origin':'*'}});
 if(route.request().url().endsWith('/ui.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(new URL('../../ai-safety-team-v440.js',import.meta.url),'utf8')});
 return route.fulfill({contentType:'text/html; charset=utf-8',body:`<main id="view"></main><script>var currentView='ai-team',user={id:'qa',role:'safety',passwordHash:'mock-only'},data={incidents:[]};var currentUser=()=>user;window.enlCurrentActor=()=>user;window.renderNav=()=>'';window.renderCurrentView=()=>{};</script><script src="/ui.js"></script><script>renderCurrentView(user)</script>`});
});
await page.goto('http://127.0.0.1:8729/diagnostic-test');await page.locator('#ai440WorkflowList [data-workflow]').click();const box=page.getByRole('textbox',{name:'진단정보 — 전달용'});await box.waitFor();const report=await box.inputValue(),rows=JSON.parse(report);
assert.equal(rows.length,2);assert(rows.every(r=>r.http_status===429&&r.job_id===id&&r.agent===context.agent&&r.model===context.model));assert.equal(rows[1].retry_count,2);assert.equal(rows[1].error.type,'requests');assert.equal(rows[1].headers['retry-after'],'1');
for(const value of [secret,'Authorization','service_role_key','PRIVATE QUESTION'])assert(!report.includes(value));assert(await box.getAttribute('readonly')!==null);assert.deepEqual(errors,[]);
await browser.close();console.log('PASS diagnostic-only: retry-then-success evidence, final 429 fields, secret removal, authenticated-detail report display and copyable JSON. No live API invoked.');
