'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./final-lifecycle.cjs');
(async()=>{const f=await fixture();try{
 const call=async(who,action,args={})=>{const r=await f.call(who,{action,...args});assert.equal(r.status,200,JSON.stringify(r));return r.body};
 const event=async(id,module,site,role)=>f.db.query('select private.enl_platform_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,module,id,site,'qa-'+role,'가상 작성자',role,'update','처리완료',id]);
 await event('own-field','tbm','qa-site','field');await event('own-hq','organization','qa-site','safety');
 await event('other-hq','risk','qa-other','safety');await event('other-field','tbm','qa-other','field');
 for(const role of ['safety','manager','executive','field'])await event('global-'+role,'common','',role);
 await event('unscoped-risk','risk','','safety');
 const own=(await call('field','activity_list',{feed:'all'})).rows;
 assert.deepEqual(own.map(x=>x.incident_id).sort(),['own-field','own-hq','global-safety','global-manager','global-executive'].sort());
 for(const role of ['safety','manager','executive'])assert.equal((await call(role,'activity_list',{feed:'all'})).rows.length,9);
 for(const feed of ['tbm','risk','organization','training','common','incident','msds']){const rows=(await call('field','activity_list',{feed})).rows;assert.ok(rows.every(x=>x.module_key===feed));assert.ok(rows.every(x=>own.some(y=>y.id===x.id)))}
 assert.equal((await call('field','activity_count',{feed:'all'})).unread,5);
 assert.equal((await call('field','activity_list',{feed:'all',site:'qa-other'})).rows.length,0);
 await call('field','activity_open',{feed:'all'});assert.equal((await call('field','activity_count',{feed:'all'})).unread,0);
 assert.equal((await f.call('field',{action:'activity_delete',feed:'all',mode:'all',confirmed:true})).status,403);
 await f.db.exec("update private.enl_platform_catalog set services=(select jsonb_agg(case when v->>'key'='history' then v||'{\"enabled\":false}'::jsonb else v end) from jsonb_array_elements(services) v)");
 for(const feed of ['all','tbm','common','organization'])assert.equal((await f.call('field',{action:'activity_list',feed})).status,403);
 assert.equal((await f.call('field',{action:'activity_list',feed:'incident'})).status,200);
 console.log('PASS all-role history scopes, category filters, cross-site isolation, common HQ records, read checkpoints and service gates');
}finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
