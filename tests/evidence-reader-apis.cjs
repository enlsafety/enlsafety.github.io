'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();let checks=0;try{
 await f.db.exec("alter table enl_incident_backups add column created_by_id text,add column created_by_name text,add column created_by_role text,add column incident_count int,add column source_version text;");
 const incident={id:'qa-evidence-readers',siteId:'qa-site',status:'reported',category:'person',summary:'가상 증빙',reportDetails:{incidentHow:'가상경위',diagnosis:'비공개 진단',doctorOpinion:'비공개 소견'},photos:[],corrective:null,_syncBaseVersion:0,_syncMutationId:'readers-first'};
 const created=await f.call('field',{action:'push',incidents:[incident]});assert.equal(created.status,200);checks++;
 const before=created.body.incidents[0],after={...before,reportDetails:{...before.reportDetails,incidentHow:'정정 경위',diagnosis:'변경 진단'}};
 const changes=[{field:'reportDetails',before:before.reportDetails,after:after.reportDetails}];
 await f.db.query('insert into enl_incident_revisions(incident_id,revision,mutation_id,reason,editor_id,editor_name,changes,before_payload,after_payload) values($1,1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)',[incident.id,'readers-revision','가상 정정 사유','qa-safety','QA 안전',JSON.stringify(changes),JSON.stringify(before),JSON.stringify(after)]);
 await f.db.transaction(t=>t.exec(fs.readFileSync('tests/fixtures/evidence-storage-activate.sql','utf8')));
 let handler,tx=null;const sql=async(parts,...args)=>{const query=parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'');return(await(tx||f.db).query(query,args)).rows;};sql.json=JSON.stringify;sql.end=async()=>{};sql.begin=async cb=>f.db.transaction(async t=>{tx=t;try{return await cb(sql)}finally{tx=null}});
 const ctx={Deno:{env:{get:()=> 'isolated'},serve:h=>handler=h},postgres:()=>sql,Request,Response,TextEncoder,crypto,structuredClone,console};vm.createContext(ctx);
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-incident-compliance-v439/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),ctx);
 async function call(who,body){const r=await handler(new Request('https://isolated.test',{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin:'https://enlsafety.github.io'},body:JSON.stringify({actor:f.actors[who],actorPasswordHash:'qa-proof',...body})}));return {status:r.status,body:await r.json()};}
 let r=await call('safety',{action:'audit_list',incidentId:incident.id});assert.equal(r.status,200);assert.deepEqual(r.body.audits[0].after_payload,before);checks+=2;
 r=await call('manager',{action:'audit_list',incidentId:incident.id});assert.equal(r.status,403);checks++;
 r=await call('safety',{action:'backup_create',reason:'가상 회귀검증'});assert.equal(r.status,200);const id=r.body.backupId;checks++;
 const row=(await f.db.query('select snapshot,snapshot_hash from enl_incident_backups where backup_id=$1',[id])).rows[0];assert.equal(row.snapshot,null);assert.match(row.snapshot_hash,/^[a-f0-9]{64}$/);checks+=2;
 r=await call('safety',{action:'backup_export',backupId:id});assert.equal(r.status,200);assert.deepEqual(r.body.backup.snapshot[0].payload,before);checks+=2;
 for(const role of ['safety','manager','executive']){r=await f.call(role,{action:'revision_list',incidentId:incident.id});assert.equal(r.status,200);const change=r.body.revisions[0].changes[0];assert.equal(change.after.incidentHow,'정정 경위');assert.equal(change.after.diagnosis,role==='safety'?'변경 진단':undefined);assert.equal('before_payload' in r.body.revisions[0],false);checks+=4;}
 console.log(JSON.stringify({suite:'evidence-reader-apis',passed:checks,failed:0}));
}finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
