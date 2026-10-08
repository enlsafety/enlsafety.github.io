import {assertReady,terminal} from './core.mjs';
export const STAGING_ENDPOINT='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-erp-close-v2-staging';
const names={queued:'결재 요청 대기',submitting:'ERP 전송 중',retry_wait:'연동 재시도 대기',submission_unknown:'상신 여부 확인 필요',pending:'ERP 결재 진행 중',status_unknown:'ERP 상태 확인 필요',approved:'ERP 승인 · 최종 종결',rejected:'ERP 반려 · 조치 보완요청',error:'연동 오류 · 확인 필요'};
export function panelState(view,role,busy=false,error=''){
  const job=view?.job;let ready=false;
  try{assertReady(view?.incident,role);ready=true;}catch{}
  return {label:job?names[job.state]||'ERP 상태 확인 필요':'ERP 종결결재 요청 전',
    canRequest:role==='safety'&&ready&&!job&&!busy,
    showRequest:role==='safety',canRetry:role==='safety'&&['retry_wait','submission_unknown','status_unknown','error'].includes(job?.state)&&!busy,
    polling:!!job&&!terminal(job.state),error,busy,documentId:job?.documentId||'',isClosed:view?.incident?.status==='closed'&&job?.state==='approved'};
}
// Browser-side role checks are presentation only. Every POST is authorized server-side.
export function controller({id,role,transport,onChange=()=>{}}){
  let view=null,busy=false,error='';
  const emit=()=>onChange(panelState(view,role,busy,error),view);
  async function refresh(){try{view=await transport({action:'get',id});error='';}catch{error='결재 상태를 확인하지 못했어. 마지막 확인 상태를 유지하고 있어.';}emit();return view;}
  async function act(action){
    const p=panelState(view,role,busy,error);if(action==='request'?!p.canRequest:!p.canRetry)return false;
    busy=true;error='';emit();
    try{await transport({action,id});await refresh();return true;}
    catch{error='요청 결과를 확인하지 못했어. 상태를 새로고침한 후 다시 시도해줘.';return false;}
    finally{busy=false;emit();}
  }
  return {refresh,request:()=>act('request'),retry:()=>act('retry'),state:()=>panelState(view,role,busy,error)};
}
export function stagingTransport(token){
  // Token is retained in this closure only, never localStorage, URL or application data.
  return async body=>{
    const r=await fetch(STAGING_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),credentials:'omit',cache:'no-store'});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'request_failed');return data;
  };
}
export function mountClosurePanel(root,options){
  root.replaceChildren();const doc=root.ownerDocument;
  const el=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;root.append(n);return n;};
  el('h2','사고종결 결재');
  const label=el('p','상태 확인 중'),ref=el('p',''),error=el('p','');error.setAttribute('role','alert');label.setAttribute('aria-live','polite');
  const request=el('button','ERP 사고종결 결재 요청'),retry=el('button','연동 재시도'),refresh=el('button','상태 새로고침');
  for(const b of [request,retry,refresh])b.type='button';
  let timer,disposed=false;
  const c=controller({...options,onChange:(p,v)=>{
    label.textContent=p.label;ref.textContent=p.documentId?`문서번호: ${p.documentId}`:'';error.textContent=p.error;
    request.hidden=!p.showRequest;request.disabled=!p.canRequest;retry.hidden=!p.canRetry;refresh.disabled=p.busy;
    options.onChange?.(p,v);clearTimeout(timer);
    if(!disposed&&p.polling)timer=setTimeout(()=>c.refresh(),options.pollMs||10000);
  }});
  request.addEventListener('click',()=>c.request());retry.addEventListener('click',()=>c.retry());refresh.addEventListener('click',()=>c.refresh());
  c.refresh();return {controller:c,dispose(){disposed=true;clearTimeout(timer);root.replaceChildren();}};
}
