'use strict';
// Fixed staging only. Creates/removes only the two synthetic compiled fixture objects.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../private-secrets/storage-dedup/staging');
const base='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const suites={bootstrap:'enl-storage-bootstrap-v472',maintenance:'enl-storage-dedup-v472'};
const secret=kind=>({token:fs.readFileSync(path.join(root,kind,'token.txt'),'utf8').trim(),proof:JSON.parse(fs.readFileSync(path.join(root,kind,'proof.json'),'utf8'))});
const auth={bootstrap:secret('bootstrap'),maintenance:secret('maintenance')};
let passed=0;const checks=[];
const check=(actual,expected,label)=>{assert.equal(actual,expected,label);passed++;checks.push(label);};
async function call(kind,action,override={},wrongToken=false){
 const r=await fetch(base+suites[kind],{method:'POST',signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io','x-enl-maintenance-token':wrongToken?'0'.repeat(64):auth[kind].token},body:JSON.stringify({...auth[kind].proof,action,...override})});
 return {status:r.status,body:await r.json()};
}
async function signedDownload(entry,label){
 const r=await fetch(base+'enl-historical-bulk-v454',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({...auth.bootstrap.proof,action:'sign',batchId:entry.batchId,fileId:entry.fileId})});
 check(r.status,200,label+' sign');const j=await r.json();const d=await fetch(j.url,{signal:AbortSignal.timeout(20000)});check(d.status,200,label+' download');const bytes=Buffer.from(await d.arrayBuffer());check(bytes.length,entry.bytes,label+' bytes');check(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,label+' SHA256');
}
(async()=>{
 if(!process.argv.includes('--resume-relinked')){
 const initial=await Promise.all([call('bootstrap','status',{},true),call('bootstrap','status',{actorPasswordHash:'wrong'}),call('bootstrap','bootstrap',{sql:'select 1'})]);
 check(initial[0].status,403,'bootstrap missing/wrong token denied');
 check(initial[1].status,403,'bootstrap wrong application proof denied');
 check(initial[2].status,400,'bootstrap cannot accept SQL');
 const boot=await call('bootstrap','bootstrap');check(boot.status,200,'synthetic fixture bootstrap');check(boot.body.fixtureObjects,2,'exact two synthetic originals');
 const denied=await Promise.all([call('maintenance','status',{},true),call('maintenance','status',{actorPasswordHash:'wrong'}),call('maintenance','remove_duplicates',{paths:['arbitrary']}),call('maintenance','remove_duplicates')]);
 check(denied[0].status,403,'maintenance token denied');
 check(denied[1].status,403,'maintenance application proof denied');
 check(denied[2].status,400,'client object path rejected');
 check(denied[3].body.message,'phase_conflict','cannot delete before all gates');
 await Promise.all(manifest.entries.map((e,i)=>signedDownload(e,'before '+i)));
 check((await call('maintenance','verify_before')).status,200,'two original hashes verified remotely');
 check((await call('maintenance','relink')).status,200,'path-only relink transaction');
 await Promise.all(manifest.entries.map((e,i)=>signedDownload(e,'relinked '+i)));
 }
 check((await call('maintenance','verify_after')).status,200,'no references and canonical hash verified');
 const removed=await call('maintenance','remove_duplicates');check(removed.status,200,'one exact duplicate removed');check(removed.body.removed,1,'only one synthetic duplicate');check(removed.body.phase,'completed','maintenance completed');
 await Promise.all(manifest.entries.map((e,i)=>signedDownload(e,'after '+i)));
 check((await call('maintenance','remove_duplicates')).body.message,'already_completed','completed run rejects deletion');
 const status=await call('maintenance','status');check(status.body.removedObjects,1,'provenance counts the duplicate');
 const result={passed,failed:0,resumed:process.argv.includes('--resume-relinked'),suite:'storage-dedup-live-staging',project:'zgwxzfvvpqgdedyobwmg',rows:2,duplicatesRemoved:1,originalBytes:manifest.entries[0].bytes,checks};
 fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/storage-dedup-staging.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed,failed:0,suite:result.suite}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
