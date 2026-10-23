'use strict';
// Operator invokes one reviewed phase at a time; project and endpoint are fixed.
const fs=require('node:fs'),path=require('node:path');
const action=process.argv[2],kind=process.argv[3]==='bootstrap'?'bootstrap':'maintenance';
const allowed=kind==='bootstrap'?['status','bootstrap']:['status','verify_before','relink','verify_after','remove_duplicates'];
if(!allowed.includes(action))throw Error('invalid_fixed_phase');
const root=path.resolve(__dirname,'../../private-secrets/storage-dedup/production',kind);
(async()=>{
 const proof=JSON.parse(fs.readFileSync(path.join(root,'proof.json'))),token=fs.readFileSync(path.join(root,'token.txt'),'utf8').trim();
 const r=await fetch('https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/'+(kind==='bootstrap'?'enl-storage-bootstrap-v472':'enl-storage-dedup-v472'),{method:'POST',signal:AbortSignal.timeout(90000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io','x-enl-maintenance-token':token},body:JSON.stringify({...proof,action})});
 const body=await r.json();console.log(JSON.stringify({status:r.status,kind,action,...body}));if(r.status!==200)process.exitCode=1;
})().catch(e=>{console.error(e.name);process.exitCode=1});
