const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./final-lifecycle.cjs');
(async()=>{
 const storage=new Map();let calls=0,fail=false;
 const f=await fixture({fetchMock:async(url,init)=>{
  calls++;if(fail)return new Response('{}',{status:503});
  const path=url.split('/storage/v1/')[1];
  if(path.startsWith('object/sign/')){assert.ok(storage.has(path.replace('object/sign/','object/')));return new Response(JSON.stringify({signedURL:'/object/sign/'+path.slice(12)+'?token=QA'}))}
  if(init.method==='POST'){storage.set(path,init.body);return new Response('{}')}
  throw new Error('unexpected storage request');
 }});
 await f.db.exec(fs.readFileSync('supabase/migrations/20261106062100_home_banner_management.sql','utf8'));
 let checks=0;const check=(x,msg)=>{assert.ok(x,msg);checks++};
 for(const who of ['safety','field','manager','executive']){const r=await f.call(who,{action:'platform_banners'});check(r.status===200&&r.body.items.length===6,who+' reads defaults');}
 check((await f.raw({actor:f.actors.safety,action:'platform_banners'})).status===403,'proof required');
 for(const who of ['field','manager','executive'])for(const action of ['platform_banners_save','platform_banner_upload'])check((await f.call(who,{action,revision:1,items:[]})).status===403,'server authorization '+who+action);
 check(calls===0,'unauthorized requests never access storage');
 const buf=fs.readFileSync('assets/banners/golf-fire-r84.webp'),file={name:'qa.webp',mime:'image/webp',size:buf.length,base64:buf.toString('base64')};
 let r=await f.call('safety',{action:'platform_banner_upload',file});assert.equal(r.status,200,JSON.stringify(r));const asset=r.body.asset;
 check(asset.width===2172&&asset.height===724&&asset.url.includes('/home-banners/'),'real WebP parsed and signed');
 check((await f.call('safety',{action:'platform_banners'})).body.items.length===6,'upload does not publish');
 check((await f.call('safety',{action:'platform_banner_upload',file:{...file,mime:'image/svg+xml'}})).status===400,'SVG rejected');
 check((await f.call('safety',{action:'platform_banner_upload',file:{...file,base64:Buffer.from('invalid').toString('base64'),size:7}})).status===400,'invalid magic rejected');
 check((await f.call('safety',{action:'platform_banner_upload',file:{...file,size:5242881}})).status===400,'oversize rejected');
 check((await f.call('safety',{action:'platform_banners_save',revision:1,items:Array(13).fill({type:'builtin',key:'welcome'})})).status===400,'count limit');
 check((await f.call('safety',{action:'platform_banners_save',revision:1,items:[{type:'image',assetId:crypto.randomUUID(),fit:'contain',title:'unknown'}]})).status===400,'unregistered asset rejected');
 const items=[{type:'image',assetId:asset.id,fit:'contain',title:'QA upload'},{type:'builtin',key:'fire'}];
 r=await f.call('safety',{action:'platform_banners_save',revision:1,items});check(r.status===200&&r.body.revision===2,'publish');
 r=await f.call('field',{action:'platform_banners'});check(r.body.items[0].assetId===asset.id&&r.body.assets.length===1,'published order and signed image visible to field');
 r=await f.call('safety',{action:'platform_banners_save',revision:1,items:[]});check(r.status===409,'stale update protected');
 fail=true;r=await f.call('safety',{action:'platform_banner_upload',file});check(r.status!==200,'storage failure reported');fail=false;
 check((await f.call('field',{action:'platform_banners'})).body.revision===2,'storage failure leaves published state');
 r=await f.call('safety',{action:'platform_banners_save',revision:2,items:[]});check(r.status===200,'zero hides all');
 r=await f.call('safety',{action:'platform_banners'});check(r.body.items.length===0&&r.body.assets.length===0,'no signing of unpublished assets');
 check(storage.size===1,'removal retains immutable original');
 check((await f.db.query('select count(*)::int n from private.enl_home_banner_audit')).rows[0].n===2,'only successful saves audited');
 const tableSecurity=await f.db.query("select relrowsecurity,has_table_privilege('anon',oid,'select') a,has_table_privilege('authenticated',oid,'select') b from pg_class where relname like 'enl_home_banner_%' and relkind='r'");
 check(tableSecurity.rows.every(r=>r.relrowsecurity&&!r.a&&!r.b),'private table RLS and no direct client access');
 await f.db.close();console.log('PASS banner management '+checks+' checks');
})().catch(e=>{console.error(e);process.exitCode=1});
