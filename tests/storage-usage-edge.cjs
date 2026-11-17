'use strict';
const assert=require('node:assert/strict');const {fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();try{
 await f.db.exec("create schema storage; create table storage.objects(bucket_id text,metadata jsonb); insert into storage.objects values ('enl-incident-files','{\"size\":1024}'),('enl-import-originals','{\"size\":2048}'),('enl-incident-files','{}'),('other-app','{\"size\":90000}');");
 const request=who=>f.call(who,{action:'platform_storage_usage'});
 for(const role of ['manager','executive','field','other'])assert.equal((await request(role)).status,403,role+' denied');
 const first=await request('safety');assert.equal(first.status,200);assert.equal(first.body.fileBytes,3072);assert.equal(first.body.fileCount,3);assert.equal(first.body.unknownFiles,1);assert.ok(Number.isSafeInteger(first.body.databaseBytes));assert.ok(first.body.databaseBytes>0);assert.ok(first.body.checkedAt);assert.ok(first.body.projectDatabaseBytes>=first.body.databaseBytes);assert.equal(first.body.quota.fileBytes,1073741824);assert.equal(first.body.quota.databaseBytes,524288000);assert.equal(first.body.quota.fileScope,'organization_shared');
 assert.deepEqual(Object.keys(first.body).sort(),['ok','fileBytes','databaseBytes','fileCount','unknownFiles','checkedAt','scope','projectDatabaseBytes','quota'].sort(),'only aggregate fields leave server');
 await f.db.exec("insert into storage.objects values ('enl-incident-files','{\"size\":1000}')");
 assert.equal((await request('safety')).body.fileBytes,3072,'five-minute server cache reused');
 assert.equal((await request('manager')).status,403,'cache cannot bypass authorization');
 console.log('PASS actual endpoint: safety-only, project scope, unknown sizes, aggregate-only response and cached authorization');
}finally{await f.db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
