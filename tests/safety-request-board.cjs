'use strict';
const assert=require('node:assert/strict'),{boardFixture}=require('./integrated-boards.cjs');
(async()=>{const f=await boardFixture();try{
 await f.db.exec("insert into enl_site_master(site_id,site_name,active) values('other-site','QA 다른 사업장',true);insert into enl_site_personnel values('qa-peer','qa-site','QA 파트장','파트장','field',true,'qa-proof'),('qa-worker','qa-site','QA 근로자','일반근로자','worker',true,'qa-proof')");
 f.actors.peer={id:'qa-peer',role:'field',siteId:'qa-site'};f.actors.worker={id:'qa-worker',role:'worker',siteId:'qa-site'};
 const save=(who,p)=>f.call(who,{action:'platform_hub_save',...p});
 const bytes=Buffer.from('%PDF-1.4 synthetic request');const asset={id:crypto.randomUUID(),name:'요청자료.pdf',mime:'application/pdf',size:bytes.length,base64:bytes.toString('base64')};
 const post={kind:'request',title:'작업구역 개선 요청',body:'격리된 검수 자료',siteId:'qa-site',document:[{tag:'p',children:[{text:'격리된 검수 자료'}]}],attachments:[asset],publication:{pinned:false,sites:['qa-site'],expiresAt:null}};
 const r=await save('field',post);assert.equal(r.status,200,JSON.stringify(r));const {id}=r.body.item;
 assert.equal(r.body.item.created_by,'qa-field');
 for(const who of ['field','peer','worker','safety','manager','executive'])assert.equal((await f.call(who,{action:'platform_board_detail',id})).status,200,who);
 for(const action of ['platform_board_detail','platform_board_file'])assert.equal((await f.call('other',{action,id,assetId:asset.id})).status,404);
 assert.equal((await f.call('other',{action:'platform_board_list',kind:'request'})).body.total,0);
 assert.equal((await f.call('field',{action:'platform_board_list',kind:'request'})).body.items[0].author_name,'QA 현장');
 for(const who of ['peer','other','worker','manager','executive']){
  assert.equal((await save(who,{...post,id,revision:1})).status,403,who);
  assert.equal((await f.call(who,{action:'platform_board_delete',id,revision:1})).status,403,who);
 }
 for(const kind of ['notice','alert','news','resource','event'])assert.equal((await save('field',{...post,kind})).status,403);
 assert.equal((await save('field',{...post,siteId:'other-site'})).status,403);
 assert.equal((await save('field',{...post,publication:{...post.publication,sites:['qa-site','other-site']}})).status,400);
 assert.equal((await save('field',{...post,id,revision:1,title:'내 요청 수정'})).status,200);
 assert.equal((await save('field',{...post,id,revision:1})).status,409,'stale update protected');
 assert.equal((await save('safety',{...post,id,revision:2})).status,200);
 assert.equal((await f.call('field',{action:'platform_board_file',id,assetId:asset.id})).body.file.base64.replace(/\s/g,''),asset.base64);
 assert.equal((await f.call('field',{action:'platform_board_delete',id,revision:2})).status,409);
 assert.equal((await f.call('field',{action:'platform_board_delete',id,revision:3})).status,200);
 assert.equal((await f.call('field',{action:'platform_board_detail',id})).status,404);
 console.log('PASS requests: author and site scopes, read roles, forbidden writes, attachments, revisions, safety management and owner delete');
}finally{await f.db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
