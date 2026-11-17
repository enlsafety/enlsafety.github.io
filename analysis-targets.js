/* Shared, explicit annual goals. Reads once per view/scope; no polling or automatic writes. */
(()=>{
 'use strict';
 const cache=new Map(),drafts=new Map(),e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),n=v=>Number(v).toLocaleString('ko-KR');
 const identity=u=>JSON.stringify([u?.id||u?.personnelId,u?.role,u?.siteId||'']);
 const keyOf=(u,year,site)=>JSON.stringify([identity(u),year,site||'']);
 const errors={target_changed:'다른 사용자가 목표를 변경했습니다. 입력은 유지했습니다. 최신 목표를 불러온 뒤 다시 확인해 주세요.',baseline_changed:'기준 사고자료가 변경됐습니다. 입력은 유지했습니다. 최신 자료를 불러온 뒤 목표를 다시 확인해 주세요.',invalid_target:'목표 건수는 0 이상의 정수, 감소율은 0~100%로 입력해 주세요.',baseline_required:'기준 실적이 없어 감소율을 계산할 수 없습니다. 목표치를 직접 입력해 주세요.',safety_required:'안전관리자만 목표를 저장할 수 있습니다.'};
 async function mount(host,{year,site='',u}){
  if(!host||!window.ENLIncidentAnalysis?.canRead(u))return;
  const owner=identity(u),key=keyOf(u,year,site),policy=window.ENLTargetPolicy;
  const current=()=>host.isConnected&&identity(typeof currentUser==='function'?currentUser():u)===owner;
  let data,editing=false,busy=false,inputs,result;
  const api=body=>window.enlIncidentApi({...body,actor:u,year,siteId:site});
  const writable=u.role==='safety';
  const message=err=>errors[err?.message]||'목표를 확인하거나 저장하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  async function load(force=false){
   if(busy)return;busy=true;host.innerHTML='<p role="status">감소 목표를 불러오는 중입니다.</p>';
   try{const draft=!force?drafts.get(key):null,cached=cache.get(key);data=draft?draft.data:!force&&cached&&Date.now()-cached.at<60000?cached.data:await api({action:'platform_analysis_target_get'});if(!data?.baseline||!data?.baselineKey)throw Error('invalid_response');if(!current())return;cache.set(key,{at:Date.now(),data});editing=!!draft?.editing;busy=false;paint();}
   catch(err){if(!current())return;busy=false;host.innerHTML='<p role="status">'+e(message(err))+'</p><button type="button" data-goal-retry>다시 불러오기</button>';host.querySelector('[data-goal-retry]').onclick=()=>load(true);}
  }
  function defaults(){return data.baseline.count?{mode:'percent',countPercent:20,costPercent:20}:{mode:'direct',targetCount:'',targetCost:''}}
  function drawSummary(base,value,label){
   const target=value?.targets,actual=policy.baseline(window.enlIncidentAnalysisRecords?.()||[],year+1,site);
   const delta=value?.countReduction,effective=value?.effectivePercent;
   const countChange=delta===null||delta===undefined?'기준 실적 없음':delta<0?'기준보다 '+n(-delta)+'건 높은 상한':delta===0?'현재 건수 유지':n(delta)+'건 감소 / '+n(effective)+'%';
   const costDelta=value?.costReduction,costChange=costDelta===null||costDelta===undefined?'기준 금액 또는 목표 미설정':costDelta<0?'기준보다 '+n(-costDelta)+'원 높은 상한':costDelta===0?'현재 금액 유지':n(costDelta)+'원 감소';
   const limit=target?.count;
   host.querySelector('[data-goal-summary]').innerHTML=`<div class="strategy-goal-metrics"><div><span>사고 건수 / ${e(label)}</span><strong>${base.count?n(base.count)+'건':'기준자료 없음'} <i>→</i> ${limit==null?'미설정':n(limit)+'건 이하'}</strong><small>${e(countChange)}</small></div><div><span>피해금액 / ${e(label)}</span><strong>${base.cost===null?'기준금액 없음':n(base.cost)+'원'} <i>→</i> ${target?.cost==null?'미설정':n(target.cost)+'원 이하'}</strong><small>${e(costChange)}</small></div></div><p class="strategy-goal-actual">${year+1}년 실적: ${actual.count?n(actual.count)+'건 등록'+(limit==null?'':actual.count>limit?' / 목표 상한 '+n(actual.count-limit)+'건 초과':' / 목표 상한보다 '+n(limit-actual.count)+'건 적음'):'등록자료 없음 / 달성 여부 판단 전'}${actual.cost!==null?' / 확인된 피해금액 '+n(actual.cost)+'원':''}</p><p class="strategy-goal-basis">기준: ${base.year}.1.1 ~ ${base.end.replaceAll('-','.')} ${base.partial?'누적 실적 / 연간 환산 아님':''}${base.unknownCost?' / 피해금액 '+base.unknownCost+'건 미확인':''}. 목표는 다음 해 연간 상한이며 실제 실적이나 달성 보장이 아닙니다.</p>`;
  }
  function paint(){
   const record=data.record,saved=record?.content;inputs=drafts.has(key)?{...drafts.get(key).inputs}:editing?{...(saved?.inputs||defaults())}:saved?.inputs||defaults();
   const canEdit=writable&&editing,base=canEdit?data.baseline:saved?.baseline||data.baseline;
   host.innerHTML=`<div class="strategy-card-head"><h3>${year+1}년 사고 감소 목표</h3><span>${site?'선택 사업장':'전체 사업장'} / ${saved&&!editing?'저장된 목표':'검토 예시, 미저장'}</span></div><div data-goal-summary aria-live="polite"></div>${canEdit?`<form data-goal-form><div class="strategy-goal-controls"><label>설정 방식<select data-goal-field="mode"><option value="percent"${inputs.mode==='percent'?' selected':''}${!data.baseline.count?' disabled':''}>감소율로 설정</option><option value="direct"${inputs.mode==='direct'?' selected':''}>목표치 직접 입력</option></select></label><label data-goal-label="count"></label><label data-goal-label="cost"></label><button type="submit" class="primary">목표 저장</button>${saved?'<button type="button" data-goal-cancel>취소</button>':''}</div><p class="strategy-goal-help">${saved?'저장하면 최신 기준자료로 목표가 갱신됩니다.':inputs.mode==='percent'?'20%는 조정 가능한 예시이며 저장 전에는 공통 목표로 확정되지 않습니다.':'기준자료가 없어도 0건 등 원하는 연간 목표를 직접 입력할 수 있습니다.'} 건수는 소수점을 버려 요청한 감소율 이상을 충족하도록 계산합니다.</p></form>`:writable?'<button type="button" data-goal-edit>'+(saved?'목표 수정':'목표 설정')+'</button>':'<p class="strategy-goal-help">목표는 안전관리자가 저장하며 본사실무자와 경영진이 함께 조회합니다.</p>'}<p class="strategy-goal-note" role="status">${saved?'저장: '+e(record.actor_name)+' / '+e(String(record.saved_at).slice(0,10))+' / '+record.revision+'차':''}</p><button type="button" class="strategy-goal-reload" data-goal-reload>최신 목표 불러오기</button>`;
   const note=host.querySelector('.strategy-goal-note');
   function update(){try{result=policy.derive(base,inputs);drawSummary(base,result,canEdit?'입력 중, 미저장':saved?'저장 목표':'20% 검토 예시');note.textContent=canEdit?'입력한 목표는 저장 후 다른 사용자에게 표시됩니다.':saved?'저장: '+record.actor_name+' / '+String(record.saved_at).slice(0,10):'예시 목표입니다. 아직 저장되지 않았습니다.';}catch{result=null;drawSummary(base,null,'미설정');note.textContent='목표 건수와 감소율을 확인해 주세요. 기준자료가 없으면 목표 건수를 직접 입력할 수 있습니다.';}}
   function fields(){
    const percent=inputs.mode==='percent',countName=percent?'countPercent':'targetCount',costName=percent?'costPercent':'targetCost';
    host.querySelector('[data-goal-label="count"]').innerHTML=(percent?'사고 감소율 (%)':'사고 목표 (건 이하)')+`<input type="number" data-goal-field="${countName}" min="0" max="${percent?100:1000000}" step="${percent?'0.01':'1'}" required value="${e(inputs[countName]??'')}">`;
    host.querySelector('[data-goal-label="cost"]').innerHTML=(percent?'금액 감소율 (%)':'금액 목표 (원 이하, 선택)')+`<input type="number" data-goal-field="${costName}" min="0" max="${percent?100:1e12}" step="${percent?'0.01':'1'}"${percent&&base.cost!==null?' required':''}${percent&&base.cost===null?' disabled':''} value="${e(percent&&base.cost===null?'':inputs[costName]??'')}">`;
    host.querySelectorAll('input[data-goal-field]').forEach(input=>input.oninput=()=>{inputs[input.dataset.goalField]=input.value;drafts.set(key,{data,inputs:{...inputs},editing});update()});
   }
   if(canEdit){fields();host.querySelector('[data-goal-field="mode"]').onchange=ev=>{inputs=ev.target.value==='percent'?{mode:'percent',countPercent:20,costPercent:20}:{mode:'direct',targetCount:result?.targets.count??'',targetCost:result?.targets.cost??''};drafts.set(key,{data,inputs:{...inputs},editing});fields();update()};
    host.querySelector('[data-goal-form]').onsubmit=async ev=>{ev.preventDefault();if(busy||!result||!current())return;busy=true;const controls=[...host.querySelectorAll('button,input,select')],disabled=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);note.textContent='목표 저장 중...';
     try{const out=await api({action:'platform_analysis_target_save',revision:data.record?.revision||0,baselineKey:data.baselineKey,inputs:result.inputs});if(!out?.record)throw Error('invalid_response');if(!current())return;data=out;drafts.delete(key);cache.set(key,{at:Date.now(),data});editing=false;busy=false;paint();}
     catch(err){if(current())note.textContent=message(err)}finally{busy=false;controls.forEach((x,i)=>x.disabled=disabled[i]);}
    };
   }
   host.querySelector('[data-goal-edit]')?.addEventListener('click',()=>{editing=true;paint()});host.querySelector('[data-goal-cancel]')?.addEventListener('click',()=>{drafts.delete(key);editing=false;paint()});
   host.querySelector('[data-goal-reload]').onclick=()=>{if(canEdit&&!confirm('현재 입력을 초기화하고 최신 목표와 기준자료를 불러올까요?'))return;drafts.delete(key);load(true)};
   update();
  }
  await load();
 }
 window.ENLAnalysisTargets={mount,invalidate:()=>cache.clear()};
})();
