/* E&L Accident Report App v3.9.1 - canonical site directory repair */
(function(){
  const SITES=[
    ['s01','백양우리',9],['s02','진양밸리',31],['s03','모나크',19],['s04','양산',36],['s05','뉴스프링빌',5],['s06','힐드로사이',31],['s07','파인힐스',28],['s08','오창에딘버러',18],['s09','레인보우힐스',47],['s10','금산에딘버러',19],['s11','곤지암GC',41],['s12','밀양에스파크',19],['s13','프린세스',19],['s14','비콘힐스',24],['s15','알펜시아 회원제',34],['s16','알펜시아700',22],['s17','파인파크',7],['s18','킹즈락',26],['s19','남한강에스파크',33],['s20','청양예미지',28],['s21','360도',22],['s22','소피아그린',31],['s23','힐데스하임',27],['s24','용평',20],['s25','버치힐',16],['s26','파인리즈',52],['s27','빛고을',14],['s28','캐슬렉스 서울',23],['s29','캐슬렉스 제주',21],['s30','비에이비스타',49],['s31','진해 신항',33],['s32','88CC',19],['s33','동탄 사무실',33]
  ];
  function repair(){
    if(typeof data==='undefined')return false;
    if(!Array.isArray(data.sites))data.sites=[];
    const old=new Map(data.sites.map(s=>[String(s.id||''),s]));
    const canonical=SITES.map(([id,name,workerCount])=>({...(old.get(id)||{}),id,name,workerCount:(old.get(id)?.workerCount??workerCount)}));
    const extras=data.sites.filter(s=>s?.id&&!SITES.some(x=>x[0]===s.id));
    data.sites=[...canonical,...extras];
    try{saveData()}catch(e){}
    window.ENL_SITE_DIRECTORY=[...canonical];
    return true;
  }
  repair();
  setTimeout(repair,300);

  // Older devices may have the one-time account seed marked complete before the full directory was stored.
  // Re-run the legacy seed only when most field accounts are missing.
  setTimeout(()=>{
    try{
      const managers=(data.users||[]).filter(x=>x?.role==='field').length;
      if(managers>=40)return;
      localStorage.removeItem('enl_site_account_seed_v340_done');
      const s=document.createElement('script');
      s.src='site-accounts-v340.js?reseed=391&t='+Date.now();
      s.onload=()=>{repair();window.dispatchEvent(new Event('enl-directory-ready'))};
      document.head.appendChild(s);
    }catch(e){console.warn('directory reseed skipped',e)}
  },200);
})();
