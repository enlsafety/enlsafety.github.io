const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./final-lifecycle.cjs');
async function boardFixture(){
 const f=await fixture();
 for(const migration of ['20261104234953_integrated_home_content','20261108234822_integrated_boards','20261109010000_board_rich_content','20261109035645_board_publication_settings']){
  await f.db.exec(fs.readFileSync('supabase/migrations/'+migration+'.sql','utf8'));
 }
 return f;
}
module.exports={boardFixture};
if(require.main===module)(async()=>{
 const f=await boardFixture();
 try{
  const list=(who,kind)=>f.call(who,{action:'platform_board_list',kind});
  const save=(who,post)=>f.call(who,{action:'platform_hub_save',...post});
  const bytes=Buffer.from('%PDF-1.4\nboard fixture');
  const file={name:'점검표.pdf',base64:bytes.toString('base64'),size:bytes.length};
  for(const kind of ['notice','alert','news','resource']){
   const post={kind,title:'테스트 '+kind,body:'검수',siteId:'qa-site'};
   if(kind==='resource')post.file=file;
   assert.equal((await save('manager',post)).status,403);
   assert.equal((await save('safety',post)).status,200);
   assert.equal((await list('field',kind)).body.items.length,1);
   assert.equal((await list('other',kind)).body.items.length,0);
  }
  const rows=(await f.call('field',{action:'platform_hub'})).body;
  assert.deepEqual(rows.notices.map(x=>x.kind),['notice']);assert.equal(rows.events.length,0);
  const item=(await list('executive','resource')).body.items[0];
  assert.equal(item.file_name,file.name);assert.equal(item.bytes,undefined);
  const get=who=>f.call(who,{action:'platform_board_file',id:item.id});
  assert.equal((await get('other')).status,404);
  assert.equal(Buffer.from((await get('field')).body.file.base64,'base64').compare(bytes),0);
  assert.equal((await save('safety',{...item,kind:'resource',revision:9})).status,409);
  assert.equal((await save('safety',{kind:'resource',title:'오류',file:{...file,name:'test.exe'}})).status,400);
  assert.equal((await save('safety',{...item,siteId:'qa-site',title:'갱신'})).status,200);
  assert.equal((await get('field')).body.file.name,file.name);
  assert.equal((await f.call('safety',{action:'platform_hub_archive',id:item.id,revision:2})).status,200);
  assert.equal((await get('field')).status,404);
  assert.equal((await list('safety','resource')).body.items.length,0);
  console.log('PASS board isolation, roles, site scopes, attachments, conflicts, archive and legacy notices.');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
