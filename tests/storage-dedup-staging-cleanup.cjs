'use strict';
// Calls only the fixed, staging-only cleanup: two compiled synthetic originals.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../private-secrets/storage-dedup/staging/bootstrap');
(async()=>{
 const proof=JSON.parse(fs.readFileSync(path.join(root,'proof.json'))),token=fs.readFileSync(path.join(root,'token.txt'),'utf8').trim();
 const r=await fetch('https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-storage-bootstrap-v472',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json','x-enl-maintenance-token':token},body:JSON.stringify({...proof,action:'cleanup'})});
 const body=await r.json();if(r.status!==200||body.cleaned!==true)throw Error(JSON.stringify({status:r.status,code:body.code,sqlstate:body.sqlstate}));
 console.log(JSON.stringify({ok:true,cleaned:true,syntheticRows:2,syntheticBatches:2}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
