// Executes real Edge handler with an in-memory SQL double; no production connection.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
let handler,records=new Map(),master={site_id:'s34',active:false,start_date:'2026-03',contract_end_date:'2026-04'},writes=0;
const sql=async(parts,...args)=>{const q=parts.join('?');
 if(q.includes('from public.enl_hq_users'))return [{user_id:'qa',name:'QA',role:'safety',active:true,password_hash:'test'}];
 if(q.includes('from public.enl_incident_shared'))return records.has(args[0])?[{payload:records.get(args[0]),site_id:'s34'}]:[];
 if(q.includes('from public.enl_site_master'))return [master];
 if(q.startsWith('insert into public.enl_incident_shared')){const p=JSON.parse(args[2]);records.set(args[0],p);writes++;return [{payload:p}]}
 if(q.startsWith('insert into public.enl_incident_audit'))return [];
 throw Error('Unexpected SQL '+q);
};sql.end=async()=>{};
const ctx={Deno:{serve:f=>handler=f,env:{get:()=> 'isolated'}},postgres:()=>sql,Request,Response,TextEncoder,crypto,structuredClone,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('site-contract-v451.js','utf8'),ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-incident-sync-v411/index.ts','utf8').replace(/^import .*;\n/gm,'')),ctx);
const make=(id,date)=>({id,siteId:'s34',occurredAt:date+'T00:00:00+09:00',status:'closed',recordMode:'historical_transfer',historicalTransfer:{mode:'historical_transfer',erpApproved:true,occurredDate:date},historicalImport:{enabled:true,erpApproved:true,workflowExempt:true,transferState:'closed'},photos:[]});
async function invoke(i){const r=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({action:'push',actor:{id:'qa',role:'safety'},actorPasswordHash:'test',incidents:[i]})}));return {status:r.status,body:await r.json()}}
(async()=>{
 for(let n=1;n<=3;n++){const r=await invoke(make('paju'+n,'2026-03-15'));assert.equal(r.status,200,JSON.stringify(r));const s=records.get('paju'+n).siteContractSnapshot;assert.equal(s.statusAtOccurrence,'active');assert.equal(s.currentStatus,'closed');assert.equal(s.contractEndDate,'2026-04');assert.equal(s.outsideContractPeriod,false)}
 const outside=make('outside','2026-07-10');assert.equal((await invoke(outside)).status,409);assert.equal(writes,3,'unconfirmed date must not persist');
 outside.siteContractSnapshot={confirmation:{confirmed:true,byId:'spoofed'}};assert.equal((await invoke(outside)).status,200);assert.equal(records.get('outside').siteContractSnapshot.confirmation.byId,'qa');
 const prev=structuredClone(records.get('paju1')),snap=JSON.stringify(prev.siteContractSnapshot);master.active=true;const edit={...prev,summary:'safe edit',siteContractSnapshot:{currentStatus:'spoofed'}};assert.equal((await invoke(edit)).status,200);assert.equal(JSON.stringify(records.get('paju1').siteContractSnapshot),snap,'snapshot immutable on unrelated edit');
 const normal={id:'normal',siteId:'s34',status:'reported',occurredAt:'2026-03-14T15:00:00Z',photos:[]};assert.equal((await invoke(normal)).status,200);assert.equal(records.get('normal').siteContractSnapshot.occurredDate,'2026-03-15');
 console.log('PASS: 3 Paju transfers, month precision, outside-date 409/confirmation, authoritative actor, immutable snapshot, normal report snapshot/KST');
})().catch(e=>{console.error(e);process.exit(1)});
