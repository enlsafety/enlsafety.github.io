/* E&L v4.0.0 - mark employee-roster site assignment ambiguities */
(function(){
  const notes={
    s15:'사원명부 팀명이 알펜시아로 통합되어 일반근로자의 회원제/700 세부 소속 확인 필요',
    s16:'사원명부 팀명이 알펜시아로 통합되어 일반근로자의 회원제/700 세부 소속 확인 필요',
    s24:'사원명부 팀명이 용평,버치힐로 통합되어 일반근로자의 용평/버치힐 세부 소속 확인 필요',
    s25:'사원명부 팀명이 용평,버치힐로 통합되어 일반근로자의 용평/버치힐 세부 소속 확인 필요'
  };
  for(const s of (window.ENL_SITE_MASTER_SEED||[])){
    const n=notes[s.site_id];if(!n)continue;
    s.needs_verification=true;
    const old=String(s.verification_note||'').trim();
    if(!old.includes(n))s.verification_note=old?`${old} / ${n}`:n;
  }
})();
