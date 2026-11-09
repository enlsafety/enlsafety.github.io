const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./final-lifecycle.cjs');
async function boardFixture(){
 const f=await fixture();
 for(const migration of ['20261104234953_integrated_home_content','20261108234822_integrated_boards','20261109000000_board_rich_prechange_backup','20261109010000_board_rich_content','20261109035645_board_publication_settings']){
  await f.db.exec('begin;'+fs.readFileSync('supabase/migrations/'+migration+'.sql','utf8')+';commit;');
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
  await f.db.exec(`insert into private.enl_board_r93_backup_content(id,title,body) select id,title,body from private.enl_hub_content;
   insert into private.enl_board_r93_backup_files select * from private.enl_board_files;
   insert into private.enl_board_r93_backup_audit select * from private.enl_hub_content_audit;`);
  const remove=(who,revision)=>f.call(who,{action:'platform_board_delete',id:item.id,revision});
  assert.equal((await remove('field',2)).status,403);
  assert.equal((await remove('safety',1)).status,409);
  assert.equal((await f.call('safety',{action:'platform_hub_archive',id:item.id,revision:2})).status,409);
  // Force the final write to fail and check that prior deletes in this transaction roll back.
  await f.db.exec("alter table private.enl_hub_content_audit add constraint synthetic_delete_failure check(action<>'delete')");
  assert.ok((await remove('safety',2)).status>=500);
  assert.equal((await get('field')).status,200);
  assert.equal((await f.db.query('select count(*)::int n from private.enl_board_r93_backup_files where content_id=$1',[item.id])).rows[0].n,1);
  await f.db.exec('alter table private.enl_hub_content_audit drop constraint synthetic_delete_failure');
  assert.equal((await remove('safety',2)).status,200);
  assert.equal((await get('field')).status,404);
  assert.equal((await list('safety','resource')).body.items.length,0);
  assert.equal((await remove('safety',2)).status,409);
  for(const [table,key] of [['enl_hub_content','id'],['enl_board_files','content_id'],['enl_board_r93_backup_content','id'],['enl_board_r93_backup_files','content_id'],['enl_board_r93_backup_audit','content_id']]){
   assert.equal((await f.db.query('select count(*)::int n from private.'+table+' where '+key+'=$1',[item.id])).rows[0].n,0,table);
  }
  const audit=(await f.db.query('select action,before_record,after_record from private.enl_hub_content_audit where content_id=$1 order by id',[item.id])).rows;
  assert.deepEqual(audit.map(x=>x.action),['create','update','delete']);
  assert.ok(audit.every(x=>x.before_record===null&&x.after_record===null));
  assert.equal((await f.db.query('select count(*)::int n from private.enl_board_r93_backup_content')).rows[0].n,3);
  console.log('PASS board isolation, roles, site scopes, attachments, conflicts, permanent delete, rollback and legacy notices.');
 }finally{await f.db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
