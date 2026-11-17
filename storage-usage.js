/* Small, safety-only sidebar readout; never includes filenames or secrets. */
(()=>{
 'use strict';
 const cache=new Map(),flights=new Map(),ttl=300000;
 const bytes=n=>{if(!Number.isFinite(n)||n<0)return '확인 필요';const units=['B','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<4){n/=1024;i++;}return n.toLocaleString('ko-KR',{maximumFractionDigits:i?1:0})+' '+units[i];};
 function mount(parent,u,api,sameUser){
  if(u?.role!=='safety')return null;
  const key=JSON.stringify([u.id||u.personnelId,u.role]);
  const box=document.createElement('section');box.className='hub-storage-usage';box.setAttribute('aria-label','앱 서버 저장 현황');
  box.innerHTML='<header><strong>서버 저장 현황</strong><button type="button" aria-label="저장 현황 새로고침">갱신</button></header><div class="hub-storage-total">한도 확인 중...</div><div class="hub-storage-item" data-kind="file"><div class="hub-storage-label"><strong>이 앱 첨부파일</strong><b>—</b></div><div class="hub-storage-bar" role="img"><i></i></div><div class="hub-storage-amount">—</div></div><div class="hub-storage-item" data-kind="database"><div class="hub-storage-label"><strong>운영 서버 DB</strong><b>—</b></div><div class="hub-storage-bar" role="img"><i></i></div><div class="hub-storage-amount">—</div></div><small class="hub-storage-scope">파일은 조직 공용 한도 기준</small><small role="status">현재 보관량 확인 중</small>';
  parent.append(box);const button=box.querySelector('button'),status=box.querySelector('[role=status]');
  const active=()=>box.isConnected&&sameUser();
  function paint(data){
   const q=data.quota,validLimit=n=>Number.isSafeInteger(n)&&n>0;
   function row(kind,used,limit,unknown){
    const item=box.querySelector('[data-kind='+kind+']'),bar=item.querySelector('.hub-storage-bar');
    const available=Number.isSafeInteger(used)&&used>=0,known=available&&validLimit(limit)&&!unknown;
    const percent=known?used/limit*100:null;
    const label=percent===null?'확인 필요':(percent>0&&percent<0.1?'<0.1':percent.toLocaleString('ko-KR',{maximumFractionDigits:1}))+'%';
    item.querySelector('b').textContent=label;
    item.querySelector('.hub-storage-amount').textContent=(available?bytes(used):'확인 필요')+' / '+(validLimit(limit)?bytes(limit):'한도 확인 필요')+(unknown?' + 미확인':'');
    bar.querySelector('i').style.width=percent===null?'0%':Math.min(100,percent)+'%';
    item.dataset.level=percent===null?'unknown':percent>=90?'danger':percent>=80?'warning':'normal';
    const scope=kind==='file'?'조직 공용 한도 중 이 앱 파일':'운영 서버 전체 DB';
    bar.setAttribute('aria-label',scope+' '+label);bar.dataset.unknown=String(percent===null);
   }
   row('file',data.fileBytes,q?.fileBytes,data.unknownFiles>0);
   row('database',data.projectDatabaseBytes,q?.databaseBytes,false);
   box.querySelector('.hub-storage-total').textContent=q?.plan==='free'?'Free 기준 / '+String(q.verifiedAt||'미확인').replace(/^\d{4}-/,'').replace('-','/')+' 확인':'한도 확인 필요';
   const date=new Date(data.checkedAt),stamp=Number.isFinite(+date)?date.toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}):'시각 미확인';
   status.textContent=stamp+' 사용량 확인';
   box.title='파일은 조직 공용 한도 중 이 앱의 사용량으로, 다른 프로젝트의 파일 사용량은 제외합니다. 남은 용량을 뜻하지 않습니다. DB는 시스템 기본 데이터를 포함한 운영 프로젝트 전체 데이터베이스입니다. 한도는 '+(q?.verifiedAt||'미확인')+'에 확인한 요금제 기준이며 요금제 변경 시 재확인이 필요합니다.';

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
