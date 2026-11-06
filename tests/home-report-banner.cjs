const fs=require('node:fs'),assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();try{
 for(const file of ['20261106062100_home_banner_management.sql','20261106064822_home_opening_banner.sql'])await f.db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 const migration=fs.readFileSync('supabase/migrations/20261106071336_home_immediate_report_banner.sql','utf8');
 await f.db.exec(migration);await f.db.exec(migration);
 let r=await f.call('safety',{action:'platform_banners'});
 assert.deepEqual(r.body.items.map(x=>x.key),['welcome','report','opening','fire','health']);assert.equal(r.body.revision,3);
 assert.equal((await f.db.query('select count(*)::int n from private.enl_home_banner_audit')).rows[0].n,2);
 assert.equal((await f.call('field',{action:'platform_banners_save',revision:3,items:r.body.items})).status,403);
 assert.equal((await f.call('safety',{action:'platform_banners_save',revision:3,items:r.body.items})).status,200);
 // An uploaded slot and its exact metadata survive the release migration.
 await f.db.exec(`update private.enl_home_banner_config set items='[{"type":"image","assetId":"00000000-0000-4000-8000-000000000001","title":"keep","fit":"contain"},{"type":"builtin","key":"fire"},{"type":"builtin","key":"tbm"}]'::jsonb where singleton`);
 await f.db.exec(migration);
 const row=(await f.db.query('select items from private.enl_home_banner_config')).rows[0];assert.equal(row.items[0].title,'keep');assert.equal(row.items[0].fit,'contain');assert.deepEqual(row.items.slice(1).map(x=>x.key),['report','fire']);
 console.log('PASS five-card order, retired cards removed, idempotence, audit, role guards, safety save and uploaded slot preservation');
}finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
