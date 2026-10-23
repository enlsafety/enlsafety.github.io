'use strict';
// Read-only application signing + exact-byte verification for all 55 retained aliases.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const label=process.argv[2];if(!['before-removal','after-removal'].includes(label))throw Error('invalid_verification_label');
const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../private-backup/storage_dedup_manifest.json'),'utf8')).manifest;
const proof=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../private-secrets/backup_sign_proof.json'),'utf8'));
if(manifest.project!=='wjelumpbjklfrdjxbesj'||manifest.entries.length!==55)throw Error('manifest_scope_mismatch');
(async()=>{
 let next=0,verified=0,bytes=0;const failures=[],unique=new Set();
 await Promise.all(Array.from({length:4},async()=>{while(next<manifest.entries.length){const index=next++,e=manifest.entries[index];try{
  const r=await fetch('https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-historical-bulk-v454',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({...proof,action:'sign',batchId:e.batchId,fileId:e.fileId})});
  if(r.status!==200)throw Error('sign_status_'+r.status);const j=await r.json();
  if(typeof j.url!=='string'||!j.url.startsWith('https://wjelumpbjklfrdjxbesj.supabase.co/storage/v1/'))throw Error('unexpected_download_origin');
  const d=await fetch(j.url,{signal:AbortSignal.timeout(30000)});if(d.status!==200)throw Error('download_status_'+d.status);const b=Buffer.from(await d.arrayBuffer());
  if(b.length!==e.bytes||crypto.createHash('sha256').update(b).digest('hex')!==e.sha256)throw Error('exact_bytes_mismatch');verified++;bytes+=b.length;unique.add(e.sha256);
 }catch(error){failures.push({index,code:/^(sign_status_|download_status_|unexpected_download_origin|exact_bytes_mismatch)/.test(error.message)?error.message:error.name});}}}));
 const result={project:manifest.project,label,aliases:manifest.entries.length,verified,verifiedBytes:bytes,uniqueOriginals:unique.size,failures};fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/storage-dedup-production-'+label+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e.name);process.exitCode=1});
