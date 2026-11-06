const fs=require('node:fs'),assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();try{
 await f.db.exec(fs.readFileSync('supabase/migrations/20261106062100_home_banner_management.sql','utf8'));
 const migration=fs.readFileSync('supabase/migrations/20261106064822_home_opening_banner.sql','utf8');
 await f.db.exec(migration);await f.db.exec(migration);
 let r=await f.call('safety',{action:'platform_banners'});
 assert.deepEqual(r.body.items.map(x=>x.key),['welcome','opening','fire','health','tbm','ppe','prevention']);assert.equal(r.body.revision,2);
 r=await f.call('safety',{action:'platform_banners_save',revision:2,items:r.body.items});assert.equal(r.status,200);
 assert.equal((await f.db.query('select count(*)::int n from private.enl_home_banner_audit')).rows[0].n,2);
 console.log('PASS opening placement, preserved order, idempotence, audit and safety save');
}finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
