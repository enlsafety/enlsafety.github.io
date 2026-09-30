// Execute the deployed handler against an isolated SQL double. Never connects to production.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('edge-functions/enl-incident-sync-v411/index.ts','utf8');
let handler,account,queries=[];
const sql=async(parts,...args)=>{
 const query=parts.join('?');queries.push(query);assert.match(query,/^select /,'dashboard path must be read-only');
 if(query.includes('enl_hq_users'))return account?[account]:[];
 if(query.includes('enl_site_personnel'))return [{personnel_id:'u',site_id:'s01',access_role:account.role,active:true}];
 if(query.includes('enl_site_master'))return [{site_id:'s01',address:'정확 주소',total_count:10}];
 if(query.includes('enl_incident_shared')){assert.ok(!query.includes('payload from'));assert.ok(!/summary|reporter|photos|password|incident_id/.test(query));return [{siteId:'s01',occurredAt:'2026-01-01',status:'rejected',category:'person',historicalEnabled:true}];}
 throw Error('Unexpected query');
};sql.end=async()=>{};
const ctx={Deno:{serve:f=>handler=f,env:{get:()=> 'isolated-test'}},postgres:()=>sql,Request,Response,TextEncoder,crypto,structuredClone,console};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'')),ctx);
const invoke=async(role,proof='test-only-proof')=>{queries=[];const response=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({action:'dashboard_read',actor:{id:'u',role,siteId:'s01'},actorPasswordHash:proof})}));return {status:response.status,body:await response.json()}};
(async()=>{
 for(const role of ['safety','manager','executive','final']){
  account={user_id:'u',role,active:true,password_hash:'test-only-proof'};
  const r=await invoke(role);assert.equal(r.status,200);assert.equal(r.body.sites[0].address,'정확 주소');assert.equal(r.body.metrics[0].status,'rejected');assert.equal(r.body.metrics[0].historicalImport.enabled,true);assert.equal(queries.length,4);
  for(const proof of ['', 'incorrect']){const denied=await invoke(role,proof);assert.equal(denied.status,403);assert.equal(denied.body.message,'auth_proof_required');assert.ok(!queries.some(q=>/enl_site_master|enl_incident_shared/.test(q)));}
 }
 account={user_id:'u',role:'manager',active:true,password_hash:'test-only-proof'};assert.equal((await invoke('safety')).status,403,'role spoofing rejected');
 account.active=false;assert.equal((await invoke('manager')).status,403,'inactive account rejected');
 account=null;assert.equal((await invoke('executive')).status,403,'nonexistent account rejected');
 for(const role of ['field','worker']){account={role};assert.equal((await invoke(role)).status,403);assert.ok(!queries.some(q=>/enl_site_master|enl_incident_shared/.test(q)));}
 console.log('PASS: HQ role + credential validation, denied roles, read-only queries, minimal metric response');
})().catch(e=>{console.error(e);process.exit(1)});
