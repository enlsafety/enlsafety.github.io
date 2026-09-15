export function scrubDiagnostic(value: unknown, secrets: string[] = []): string {
  let text=String(value ?? '');for(const secret of secrets.filter(s=>s.length>4))text=text.split(secret).join('[key removed]');
  return text.replace(/\bsk-[A-Za-z0-9_-]+/g, '[key removed]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [removed]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\b(?:org|proj)-[A-Za-z0-9_-]+/g, '[account removed]').slice(0, 700);
}
export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : null;
}
export function diagnostic(response: Response, raw: any, secrets: string[] = []) {
  const type = scrubDiagnostic(raw?.error?.type,secrets), code = scrubDiagnostic(raw?.error?.code,secrets);
  const message = scrubDiagnostic(raw?.error?.message || raw?.message || 'Upstream response did not include an error message',secrets);
  const text = `${type} ${code} ${message}`.toLowerCase();
  const category = /insufficient_quota|billing_hard_limit|billing_not_active|credit_balance_too_low|exceeded your current quota|(?:credits?|credit balance).*(?:exhausted|expired|insufficient|depleted)/.test(text) ? 'quota'
    : response.status === 401 ? 'authentication'
    : response.status === 403 ? 'permission'
    : /model_not_found|invalid_model/.test(text) || response.status === 404 ? 'model'
    : response.status === 429 ? 'rate_limit'
    : response.status >= 500 ? 'upstream_unavailable' : 'invalid_request';
  const headers: Record<string, string> = {};
  for (const key of ['x-request-id','retry-after','retry-after-ms','x-ratelimit-limit-requests','x-ratelimit-limit-tokens','x-ratelimit-remaining-requests','x-ratelimit-remaining-tokens','x-ratelimit-reset-requests','x-ratelimit-reset-tokens']) {
    const value=response.headers.get(key); if(value) headers[key]=scrubDiagnostic(value,secrets);
  }
  return {http_status:response.status,type,code,param:raw?.error?.param==null?null:scrubDiagnostic(raw.error.param,secrets),message,category,headers,observed_at:new Date().toISOString()};
}
export class AIServiceError extends Error {
  diagnostic: ReturnType<typeof diagnostic>;
  constructor(detail: ReturnType<typeof diagnostic>) {super(`ai_service_${detail.category}`);this.diagnostic=detail;}
}
export function friendlyError(error: any): string | null {
  const category=error?.diagnostic?.category;
  return ({quota:'AI 서비스의 사용 한도 또는 크레딧을 확인해야 합니다. 확인 전 자동 재시도하지 않습니다.',authentication:'AI 서비스 인증 설정을 확인해야 합니다.',permission:'현재 AI 프로젝트의 모델 접근 권한을 확인해야 합니다.',model:'설정된 AI 모델을 사용할 수 없습니다. 모델 설정을 확인해 주세요.',rate_limit:'AI 요청이 일시적으로 집중되었습니다. 잠시 후 재시도해 주세요.',upstream_unavailable:'AI 서비스가 일시적으로 응답하지 않습니다. 잠시 후 재시도해 주세요.',invalid_request:'AI 요청 설정을 확인해야 합니다.'} as Record<string,string>)[category]||null;
}

// Explicit HTTP rejection only: transport/timeouts are not replayed because a POST
// may already have been accepted upstream. One run owns all bounded attempts.
export async function requestWithBackoff(body: unknown, options: {
 headers: Record<string,string>; onRetry?: (event:any)=>Promise<void>;
 fetcher?: typeof fetch; sleep?: (ms:number)=>Promise<void>; clock?: ()=>number;
 random?: ()=>number; budgetMs?:number;
}) {
 const fetcher=options.fetcher||fetch,clock=options.clock||Date.now;
 const sleep=options.sleep||((ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 const started=clock(),deadline=started+(options.budgetMs||90000),clientRequestId=crypto.randomUUID();
 for(let attempt=1;attempt<=3;attempt++){
  const remaining=deadline-clock();if(remaining<=0)throw new DOMException('AI request deadline exceeded','TimeoutError');
  const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{...options.headers,'X-Client-Request-Id':clientRequestId},body:JSON.stringify(body),signal:AbortSignal.timeout(Math.max(1,remaining))});
  const raw=await response.json().catch(()=>null);
  if(response.ok)return {raw,attempts:attempt,requestId:response.headers.get('x-request-id'),duration_ms:clock()-started};
  const d=diagnostic(response,raw,[(options.headers.Authorization||'').replace(/^Bearer /,'')]);const error=new AIServiceError(d);
  const serverMs=Number(response.headers.get('retry-after-ms'));
  const headerWait=serverMs>0?serverMs:retryAfterMs(response.headers.get('retry-after'),clock());
  const wait=Math.max(headerWait||0,1000*2**(attempt-1)+Math.floor((options.random||Math.random)()*300));
  Object.assign(d,{attempts:attempt,retry_count:attempt-1,duration_ms:clock()-started,retry_not_before:d.category==='rate_limit'?new Date(clock()+wait).toISOString():null});
  if(!['rate_limit','upstream_unavailable'].includes(d.category)||attempt>=3||wait+1000>=deadline-clock())throw error;
  await options.onRetry?.({attempt,next_attempt:attempt+1,delay_ms:wait,category:d.category});
  await sleep(wait);
 }
 throw new Error('unreachable');
}
