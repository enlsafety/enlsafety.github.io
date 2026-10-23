'use strict';
// Explicit fixed staging endpoint; credentials and fixture never enter this repository.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=JSON.parse(fs.readFileSync('../private-secrets/stage_sign_fixture.json','utf8'));
const url='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-historical-bulk-v454';
async function call(body,proof=fixture.proof,origin='https://enlsafety.github.io'){
 const r=await fetch(url,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin},body:JSON.stringify({...proof,...body})});
 return {status:r.status,body:await r.json()};
}
(async()=>{
 let passed=0;const check=(actual,expected,label)=>{assert.equal(actual,expected,label);passed++};
 const base={action:'sign',batchId:fixture.batchId,fileId:fixture.fileId};
 for(const action of ['create','upload','analyze','commit','save','update_incident','void_incident','restore_incident'])check((await call({action})).status,410,'retired '+action);
 check((await call(base,{...fixture.proof,actorPasswordHash:'wrong'})).status,403,'invalid proof denied');
 check((await call(base,fixture.otherProof)).status,403,'other batch owner denied');
 check((await call({...base,fileId:'not-a-file'})).status,400,'unregistered file denied');
 check((await call({...base,candidateId:'missing'})).status,400,'unlinked candidate denied');
 check((await call(base,fixture.proof,'https://not-enl.example')).status,403,'foreign origin denied');
 check((await call({action:'list'})).status,200,'list remains read-only');
 check((await call({action:'get',batchId:fixture.batchId})).status,200,'metadata remains readable');
 const signed=await call(base);check(signed.status,200,'authorized source sign');
 const downloaded=await fetch(signed.body.url,{signal:AbortSignal.timeout(20000)});check(downloaded.status,200,'signed original download');
 const bytes=Buffer.from(await downloaded.arrayBuffer());check(bytes.length,Number(fixture.size),'original byte size');
 check(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.sha256,'original SHA-256');
 fs.mkdirSync('qa-output',{recursive:true});const result={passed,failed:0,project:'zgwxzfvvpqgdedyobwmg',suite:'import-original-read-only-sign',originalBytes:bytes.length,sha256Verified:true,productionMutations:0};
 fs.writeFileSync('qa-output/import-original-sign-staging.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1});
