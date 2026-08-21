/* E&L Safety v3.4.2 - 88CC test field manager account */
(function(){
  async function ensure88Test(){
    try{
      if(typeof data==='undefined'||!Array.isArray(data.sites)||!Array.isArray(data.users)||typeof sha256!=='function')return false;
      let site=data.sites.find(s=>s.name==='88CC'||s.id==='s32');
      if(!site){
        site={id:'s32',name:'88CC',workerCount:19,createdAt:nowISO(),updatedAt:nowISO()};
        data.sites.push(site);
      }else{
        site.name='88CC';
      }
      const hash=await sha256('8580');
      let u=data.users.find(x=>x.username==='테스트'||x.id==='u-test-88cc');
      if(!u){
        u={id:'u-test-88cc',username:'테스트',name:'테스트',position:'현장소장',role:'field',siteId:site.id,passwordHash:hash,active:true,createdAt:nowISO(),updatedAt:nowISO()};
        data.users.push(u);
      }else{
        u.id='u-test-88cc';
        u.username='테스트';
        u.name='테스트';
        u.position='현장소장';
        u.role='field';
        u.siteId=site.id;
        u.passwordHash=hash;
        u.active=true;
        u.updatedAt=nowISO();
      }
      saveData();
      return true;
    }catch(e){console.warn('88CC test account seed failed',e);return false;}
  }

  // 기존 대량 계정 시드가 비동기로 끝나면서 계정을 덮어쓰는 경우를 막기 위해 재확인한다.
  ensure88Test();
  setTimeout(ensure88Test,800);
  setTimeout(ensure88Test,2500);

  // 테스트 로그인 시에는 로그인 검사 직전에 계정을 반드시 보정한다.
  try{
    const baseDoLogin=doLogin;
    doLogin=async function(e){
      const id=document.getElementById('loginId')?.value?.trim();
      const pw=document.getElementById('loginPw')?.value;
      if(id==='테스트'&&pw==='8580')await ensure88Test();
      return baseDoLogin(e);
    };
  }catch(e){console.warn('88CC login hook skipped',e);}

  setTimeout(()=>{try{if(typeof render==='function')render();}catch(e){}},900);
})();
