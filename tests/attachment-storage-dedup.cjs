'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const {fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const f=await fixture();let handler,checks=0,signFailure=false,uploadCalls=0,downloads=0;
 const objects=new Map(),signed=[];
 const check=(a,b,label)=>{assert.equal(a,b,label);checks++};
 try{
  const sql=async(parts,...args)=>(await f.db.query(parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,''),args)).rows;sql.end=async()=>{};
  const storage={
   async upload(path,bytes,options){uploadCalls++;if(objects.has(path))return {error:{statusCode:'409',message:'The resource already exists'}};objects.set(path,{bytes:Buffer.from(bytes),options});return {error:null}},
   async download(path){downloads++;const x=objects.get(path);return x?{data:new Blob([x.bytes]),error:null}:{error:{message:'missing'}}},
   async createSignedUrl(path){if(signFailure){signFailure=false;return {error:{message:'qa_sign_failure'}}}signed.push(path);return {data:{signedUrl:'https://qa.invalid/'+path+'?generation='+signed.length},error:null}}
  };
  const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,createClient:()=>({storage:{from:()=>storage}}),Request,Response,TextEncoder,crypto,console,atob};vm.createContext(ctx);
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-attachment-v411/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),ctx);
  const call=async(who,body)=>{const r=await handler(new Request('https://qa.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2'},body:JSON.stringify({actor:f.actors[who],actorPasswordHash:'qa-proof',actorPinHash:'qa-proof',...body})}));return {status:r.status,body:await r.json()}};
  const bytes=fs.readFileSync('pwa-icon-512.png'),sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const file={name:'evidence.png',mime:'image/png',size:bytes.length,base64:bytes.toString('base64'),optimization:{sha256,sourceBytes:bytes.length,mode:'original',preservedOriginal:true}};
  signFailure=true;check((await call('field',{action:'upload',file})).status,500,'failed signed response is surfaced');check(objects.size,1,'first attempt stored exactly one object');
  let r=await call('field',{action:'upload',file});check(r.status,200,'retry after signed-response failure succeeds');const path=r.body.attachment.path;
  check(objects.size,1,'retry reuses same immutable object');check(downloads,1,'retry verifies stored bytes');check(r.body.attachment.sha256,sha256,'digest returned');check(r.body.attachment.optimization.preservedOriginal,true,'original evidence metadata retained');
  r=await call('field',{action:'upload',file:{...file,name:'renamed.png'}});check(r.status,200,'same bytes renamed');check(r.body.attachment.path,path,'renaming does not duplicate object');
  const before=uploadCalls;r=await call('field',{action:'upload',file:{...file,optimization:{sha256:'0'.repeat(64)}}});check(r.status,400,'client digest mismatch blocked');check(uploadCalls,before,'mismatch never touches storage');
  r=await call('other',{action:'upload',file});check(r.status,200,'other authorized owner upload');assert.notEqual(r.body.attachment.path,path,'same bytes remain isolated by owner');checks++;check(objects.size,2,'cross owner is not global dedup');
  check((await call('other',{action:'sign',paths:[path]})).status,403,'cross owner cannot sign evidence');
  r=await call('field',{action:'upload',scope:'action',file});check(r.status,200,'action upload');assert.notEqual(r.body.attachment.path,path,'incident and action scopes isolated');checks++;
  const old=objects.get(path);objects.set(path,{...old,bytes:Buffer.from('tampered')});r=await call('field',{action:'upload',file});check(r.status,500,'existing object digest mismatch blocks reuse');check(r.body.message,'attachment_integrity_mismatch','integrity error explicit');objects.set(path,old);
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),pdfFile={name:'original.pdf',mime:'application/pdf',size:pdf.length,base64:pdf.toString('base64')};
  r=await call('field',{action:'upload',file:pdfFile});check(r.status,200,'PDF uploads unchanged');check(r.body.attachment.kind,'pdf','PDF remains PDF');assert.deepEqual(objects.get(r.body.attachment.path).bytes,pdf,'PDF byte preservation');checks++;
  const renewed1=await call('field',{action:'sign',paths:[path]}),renewed2=await call('field',{action:'sign',paths:[path]});check(renewed1.status,200,'authorized signed URL');check(renewed2.status,200,'signed URL renewal');assert.notEqual(renewed1.body.urls[path],renewed2.body.urls[path],'fresh URL returned');checks++;
  // Retired attachment references must remain readable through authorized history.
  const initial={id:'qa-retired-evidence',siteId:'qa-site',status:'reported',category:'person',summary:'가상 이력 증빙',occurredAt:'2026-10-13T00:00:00Z',reportDetails:{incidentHow:'가상 사고'},photos:[{path}],supplement:{attachments:[{path:'incident/site-qa-site/private-medical.pdf'}]},corrective:null,_syncBaseVersion:0,_syncMutationId:'retired-create'};
  let created=await f.call('field',{action:'push',incidents:[initial]});check(created.status,200,'create incident with evidence');
  let current=created.body.incidents[0];current.photos=[];current._syncBaseVersion=current._syncVersion;current._syncMutationId='retired-edit';
  check((await f.call('field',{action:'push',incidents:[current]})).status,200,'replace current evidence without deleting history');
  check((await call('manager',{action:'sign',paths:[path]})).status,200,'authorized reader can sign retired photo via audit');
  check((await call('manager',{action:'sign',paths:['incident/site-qa-site/private-medical.pdf']})).status,403,'historic medical evidence remains restricted');
  check((await call('safety',{action:'sign',paths:['incident/site-qa-site/private-medical.pdf']})).status,200,'safety can inspect historic medical evidence');
  check((await call('other',{action:'sign',paths:[path]})).status,403,'history cannot bypass site isolation');
  await f.db.transaction(async t=>t.exec(fs.readFileSync('tests/fixtures/evidence-storage-activate.sql','utf8')));
  check((await call('manager',{action:'sign',paths:[path]})).status,200,'compacted audit hydrates historical photo authorization');
  check((await call('manager',{action:'sign',paths:['incident/site-qa-site/private-medical.pdf']})).status,403,'compacted history keeps medical restriction');
  fs.mkdirSync('qa-output',{recursive:true});fs.writeFileSync('qa-output/attachment-storage-dedup.json',JSON.stringify({passed:checks,failed:0,environment:'actual Edge handler with isolated PostgreSQL and simulated private Storage',objectCount:objects.size},null,2));
  console.log(JSON.stringify({passed:checks,failed:0,suite:'attachment-storage-dedup'}));
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
