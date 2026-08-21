/* E&L Safety v3.4.1 - 88CC test field manager account */
(async function(){
  try{
    if(typeof data==='undefined'||!Array.isArray(data.sites)||!Array.isArray(data.users)||typeof sha256!=='function')return;
    const site=data.sites.find(s=>s.name==='88CC');
    if(!site){console.warn('88CC site not found');return;}
    const hash=await sha256('8580');
    let u=data.users.find(x=>x.username==='테스트');
    if(!u){
      u={id:'u-test-88cc',username:'테스트',name:'테스트',position:'현장소장',role:'field',siteId:site.id,passwordHash:hash,active:true,createdAt:nowISO(),updatedAt:nowISO()};
      data.users.push(u);
    }else{
      u.name='테스트';
      u.position='현장소장';
      u.role='field';
      u.siteId=site.id;
      u.passwordHash=hash;
      u.active=true;
      u.updatedAt=nowISO();
    }
    saveData();
    try{if(typeof render==='function')render();}catch(e){}
  }catch(e){console.warn('88CC test account seed failed',e);}
})();
