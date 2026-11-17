/* Small, safety-only sidebar readout; never includes filenames or secrets. */
(()=>{
 'use strict';
 const cache=new Map(),flights=new Map(),ttl=300000;
 const bytes=n=>{if(!Number.isFinite(n)||n<0)return '확인 필요';const units=['B','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<4){n/=1024;i++;}return n.toLocaleString('ko-KR',{maximumFractionDigits:i?1:0})+' '+units[i];};
 function mount(parent,u,api,sameUser){
  if(u?.role!=='safety')return null;
  const key=JSON.stringify([u.id||u.personnelId,u.role]);
  const box=document.createElement('section');box.className='hub-storage-usage';box.setAttribute('aria-label','앱 서버 저장 현황');
  box.innerHTML='<header><strong>서버 저장 현황</strong><button type="button" aria-label="저장 현황 새로고침">갱신</button></header><div class="hub-storage-total">확인 중...</div><div class="hub-storage-bar" role="img" aria-label="사용량 확인 중"><i></i><i></i></div><dl><div><dt>첨부파일</dt><dd>—</dd></div><div><dt>앱 DB</dt><dd>—</dd></div></dl><small role="status">현재 보관량 확인 중</small>';
  parent.append(box);const button=box.querySelector('button'),status=box.querySelector('[role=status]');
  const active=()=>box.isConnected&&sameUser();
  function paint(data){
   const {fileBytes,databaseBytes}=data,total=fileBytes+databaseBytes;
   box.querySelector('.hub-storage-total').textContent=bytes(total)+(data.unknownFiles?' + 미확인':'');
   const numbers=box.querySelectorAll('dd');numbers[0].textContent=bytes(fileBytes);numbers[1].textContent=bytes(databaseBytes);
   const bar=box.querySelector('.hub-storage-bar'),parts=bar.querySelectorAll('i');parts[0].style.width=(total?fileBytes/total*100:0)+'%';parts[1].style.width=(total?databaseBytes/total*100:0)+'%';
   bar.setAttribute('aria-label','확인된 용량 구성: 첨부파일 '+bytes(fileBytes)+', 앱 DB '+bytes(databaseBytes));
   const date=new Date(data.checkedAt),stamp=Number.isFinite(+date)?date.toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}):'시각 미확인';
   status.textContent='파일/DB 구성비 / '+stamp+' 확인'+(data.unknownFiles?' / 파일 '+data.unknownFiles+'개 용량 미확인':'');
   box.title='앱 첨부파일과 앱 테이블(인덱스 포함)의 현재 보관량입니다. 그래프는 구성비이며 저장 한도 대비 사용률이 아닙니다. 서버 로그, 별도 백업과 다른 프로젝트는 제외합니다.';
  }
  async function refresh(force=false){
   if(!active()||button.disabled)return;
   const saved=cache.get(key);if(!force&&saved&&Date.now()-saved.at<ttl){paint(saved.data);return;}
   button.disabled=true;status.textContent='사용량 확인 중...';
   try{
    if(!flights.has(key))flights.set(key,Promise.resolve().then(()=>api({action:'platform_storage_usage'},15000)).then(data=>{
     if(!data?.ok||[data.fileBytes,data.databaseBytes,data.fileCount,data.unknownFiles].some(v=>!Number.isSafeInteger(v)||v<0))throw Error('invalid_usage');
     cache.set(key,{at:Date.now(),data});return data;
    }).finally(()=>flights.delete(key)));
    const data=await flights.get(key);if(active())paint(data);
   }catch{if(active()){if(saved){paint(saved.data);status.textContent='갱신 실패 / 이전 확인 수치';}else{box.querySelector('.hub-storage-total').textContent='확인 필요';status.textContent='저장 현황을 불러오지 못했습니다.';}}}
   finally{if(active())button.disabled=false;}
  }
  button.onclick=()=>refresh(true);refresh();return box;
 }
 window.ENLStorageUsage={mount,bytes};
})();
