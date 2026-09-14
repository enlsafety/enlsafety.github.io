/* E&L AI Safety Team v4.4.0 - staging console */
(function(){
  'use strict';

  const VERSION='4.4.0-ui-mvp1';
  const API='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-ai-safety-v440';
  const CLIENT='incident-report-v2';
  const VIEW='ai-team';
  let credentialHash='';
  let healthState=null;
  let workflows=[];
  let busy=false;

  const txt=v=>String(v??'').trim();
  const roleNorm=v=>txt(v)==='final'?'manager':txt(v);
  const ex=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtSafe=v=>{try{return typeof fmt==='function'?fmt(v):new Date(v).toLocaleString('ko-KR')}catch{return txt(v)||'-'}};
  const actor=()=>typeof window.enlCurrentActor==='function'?window.enlCurrentActor(currentUser?.()):null;
  const siteName=id=>{try{return siteById?.(id)?.name||window.ENL_SITE_DIRECTORY?.find(s=>String(s.id)===String(id))?.name||id||'-'}catch{return id||'-'}};

  async function sha256Hex(s){
    if(typeof window.sha256==='function')return window.sha256(s);
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(s||'')));
    return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function ensureCredential(force=false){
    if(force)credentialHash='';
    if(credentialHash)return credentialHash;
    const u=currentUser?.();
    if(u?.passwordHash){credentialHash=txt(u.passwordHash);return credentialHash}
    const pw=prompt('AI 안전관리팀 연결 확인을 위해 안전관리자 비밀번호를 입력해 주세요.');
    if(!txt(pw))throw new Error('credential_cancelled');
    credentialHash=await sha256Hex(pw);
    return credentialHash;
  }
  async function post(body,{auth=true,retry=true,timeout=120000}={}){
    const headers={'Content-Type':'application/json','X-ENL-App':CLIENT};
    const payload={...body};
    if(auth){
      const a=actor();if(!a||roleNorm(a.role)!=='safety')throw new Error('forbidden');
      payload.actor=a;payload.passwordHash=await ensureCredential(false);
    }
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);
    try{
      const r=await fetch(API,{method:'POST',headers,body:JSON.stringify(payload),signal:ctl.signal,cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.ok===false){
        const e=new Error(j?.message||`http_${r.status}`);e.status=r.status;
        if(auth&&retry&&['authentication_required','session_required'].includes(e.message)){
          await ensureCredential(true);return post(body,{auth,retry:false,timeout});
        }
        throw e;
      }
      return j;
    }finally{clearTimeout(timer)}
  }
  async function loadHealth(){
    try{healthState=await post({action:'health'},{auth:false,timeout:15000});return healthState}
    catch(e){healthState={ok:false,message:e?.message||'연결 실패'};return healthState}
  }
  function incidentSnapshot(i){
    const c=i?.corrective||{};
    return {
      id:txt(i?.id),siteId:txt(i?.siteId),siteName:siteName(i?.siteId),occurredAt:txt(i?.occurredAt),category:txt(i?.category),eventType:txt(i?.eventType),severity:txt(i?.severity),leaveEstimate:txt(i?.leaveEstimate),potentialMajor:!!i?.potentialMajor,
      summary:txt(i?.summary),immediateAction:txt(i?.immediateAction),status:txt(i?.status),priority:txt(i?.priority),legalReview:!!i?.legalReview,legalReviewStatus:txt(i?.legalReviewStatus),
      corrective:{status:txt(c?.status),plan:txt(c?.plan||c?.content),completedAt:txt(c?.completedAt)}
    };
  }
  function statusLabel(v){return v==='queued'?'대기':v==='running'?'검토 중':v==='awaiting_approval'?'태영 확인 필요':v==='completed'?'완료':v==='failed'?'오류':v==='on_hold'?'보류':v==='re_review_requested'?'재검토 요청':'확인 필요'}
  function agentLabel(v){return v==='incident_manager'?'사고관리':v==='legal_reviewer'?'법령검토':v==='final_auditor'?'문서·최종검증':v==='safety_director'?'AI 안전본부장':v||'-'}
  function statusClass(v){return v==='completed'?'ok':v==='awaiting_approval'?'wait':v==='running'?'run':v==='failed'?'bad':v==='on_hold'||v==='re_review_requested'?'hold':''}
  function ensureCss(){
    if(document.getElementById('ai440Css'))return;
    const s=document.createElement('style');s.id='ai440Css';s.textContent=`
      .ai440{display:grid;gap:16px}.ai440-hero{padding:22px;border:1px solid #c9dfef;border-radius:20px;background:linear-gradient(135deg,#f8fcff,#eaf6ff);display:flex;justify-content:space-between;gap:18px;align-items:center}.ai440-hero h2{margin:3px 0 7px;color:#164f78}.ai440-hero p{margin:0;color:#5d7588;line-height:1.55}.ai440-ey{font-size:11px;letter-spacing:.14em;font-weight:950;color:#4d87ad}.ai440-health{min-width:220px;padding:12px 14px;border-radius:14px;border:1px solid #c6dceb;background:#fff;color:#34576f;font-size:13px;line-height:1.5}.ai440-health b{display:block;color:#194f77}.ai440-health.bad{border-color:#edcaca;background:#fff8f8;color:#8a4646}.ai440-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ai440-card{padding:14px;border:1px solid #d4e3ed;border-radius:15px;background:#fff}.ai440-card span{display:block;color:#70889a;font-size:12px;font-weight:800}.ai440-card b{display:block;margin-top:6px;color:#173f5d;font-size:26px}.ai440-card.wait{border-color:#e6ce91;background:#fffaf0}.ai440-card.bad{border-color:#ecc1c1;background:#fff8f8}.ai440-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:14px}.ai440-panel{padding:18px;border:1px solid #d3e2ed;border-radius:18px;background:#fff}.ai440-panel h3{margin:0 0 5px;color:#1d557c}.ai440-panel>p{margin:0 0 14px;color:#718596;font-size:13px;line-height:1.5}.ai440-team{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.ai440-agent{padding:12px 9px;border-radius:12px;background:#f5faff;border:1px solid #d2e5f2;text-align:center}.ai440-agent b{display:block;color:#1f5b84;font-size:13px}.ai440-agent small{display:block;margin-top:5px;color:#738899;font-size:11px;line-height:1.4}.ai440-select{width:100%;min-height:46px;padding:0 12px;border:1.5px solid #b9d3e4;border-radius:11px;background:#fff;color:#1e4058;font-size:14px}.ai440-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.ai440-btn{min-height:42px;padding:0 14px;border:0;border-radius:10px;background:#246b9d;color:#fff;font-weight:900;cursor:pointer}.ai440-btn.secondary{background:#edf6fc;color:#235f89;border:1px solid #bcd7e8}.ai440-btn.warn{background:#8a6725}.ai440-btn.danger{background:#9a4545}.ai440-btn:disabled{opacity:.5;cursor:not-allowed}.ai440-list{display:grid;gap:8px}.ai440-row{width:100%;border:1px solid #d9e5ed;border-radius:12px;background:#fff;padding:11px 12px;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;cursor:pointer}.ai440-row:hover{background:#f7fbfe}.ai440-row strong{display:block;color:#244b66;font-size:13px}.ai440-row small{display:block;margin-top:4px;color:#768a99;font-size:11px}.ai440-pill{align-self:center;padding:5px 8px;border-radius:999px;background:#edf3f7;color:#51697a;font-size:10px;font-weight:900;white-space:nowrap}.ai440-pill.ok{background:#e8f5ed;color:#38704d}.ai440-pill.wait{background:#fff2d7;color:#805c16}.ai440-pill.run{background:#e7f2ff;color:#2a6591}.ai440-pill.bad{background:#fde9e9;color:#934444}.ai440-pill.hold{background:#f2edf8;color:#68557d}.ai440-empty{padding:25px 10px;text-align:center;color:#8293a0;font-size:13px}.ai440-modal{position:fixed;inset:0;background:rgba(15,35,50,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:14px}.ai440-modalbox{width:min(780px,100%);max-height:88dvh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.24)}.ai440-modalhead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.ai440-modalhead h3{margin:0;color:#174f76}.ai440-close{border:0;background:#eef5f9;border-radius:9px;width:36px;height:36px;font-weight:900}.ai440-summary{margin-top:12px;padding:13px;border-radius:12px;background:#f2f8fc;color:#284b64;line-height:1.6;white-space:pre-wrap}.ai440-run{margin-top:9px;padding:10px 12px;border:1px solid #dbe7ee;border-radius:11px}.ai440-run b{color:#235b81}.ai440-find{margin-top:9px;padding:11px;border-left:4px solid #8fb9d5;background:#f8fbfd;border-radius:8px}.ai440-find.high,.ai440-find.critical{border-left-color:#bd5b5b;background:#fff8f8}.ai440-find h4{margin:0 0 5px;color:#25475e}.ai440-find p{margin:4px 0;color:#526c7e;font-size:12px;line-height:1.55;white-space:pre-wrap}.ai440-sources a{display:block;margin-top:5px;color:#1f6595;font-size:12px;overflow-wrap:anywhere}.ai440-note{margin-top:10px;width:100%;min-height:70px;border:1px solid #c8dbe8;border-radius:10px;padding:10px;box-sizing:border-box}.common-nav [data-view="ai-team"]{position:relative}.common-nav [data-view="ai-team"]::after{content:'AI';position:absolute;top:2px;right:4px;font-size:8px;color:#2f78a8;font-weight:950}
      @media(max-width:760px){.ai440-hero{display:grid;padding:16px}.ai440-health{min-width:0}.ai440-cards{grid-template-columns:repeat(2,1fr)}.ai440-grid{grid-template-columns:1fr}.ai440-team{grid-template-columns:repeat(2,1fr)}.common-nav{overflow-x:auto}.common-nav button{min-width:64px}}
    `;document.head.appendChild(s);
  }
  function addNav(html,u){
    if(roleNorm(u?.role)!=='safety'||typeof html!=='string'||html.includes('data-view="ai-team"'))return html;
    const btn=`<button data-view="ai-team" class="${currentView===VIEW?'on':''}">AI 안전팀</button>`;
    return html.replace('</nav>',btn+'</nav>');
  }
  const baseNav=window.renderNav;
  if(typeof baseNav==='function')window.renderNav=function(u){return addNav(baseNav.apply(this,arguments),u||currentUser?.())};
  const baseCurrent=window.renderCurrentView;
  if(typeof baseCurrent==='function')window.renderCurrentView=function(u){
    if(currentView===VIEW&&roleNorm(u?.role)==='safety')return renderAI(document.getElementById('view'),u);
    return baseCurrent.apply(this,arguments);
  };

  async function refreshWorkflows({silent=false}={}){
    if(busy)return;busy=true;
    try{
      const r=await post({action:'list_workflows',limit:40});workflows=r.workflows||[];if(currentView===VIEW)paintWorkflows();
    }catch(e){if(!silent&&e?.message!=='credential_cancelled')alert(messageFor(e))}
    finally{busy=false}
  }
  function messageFor(e){
    const m=e?.message||String(e||'');
    if(m==='openai_not_configured')return 'OpenAI API 키 연결이 아직 완료되지 않았습니다.';
    if(m==='authentication_required')return '안전관리자 인증에 실패했습니다. 비밀번호를 다시 확인해 주세요.';
    if(m==='credential_cancelled')return '인증이 취소되었습니다.';
    if(m==='forbidden')return '안전관리자 권한이 필요합니다.';
    if(m==='Failed to fetch')return 'AI 안전관리팀 서버에 연결하지 못했습니다.';
    return `AI 안전관리팀 처리 중 오류가 발생했습니다. (${m})`;
  }
  function counts(){return {running:workflows.filter(w=>w.status==='running'||w.status==='queued').length,waiting:workflows.filter(w=>w.status==='awaiting_approval').length,done:workflows.filter(w=>w.status==='completed').length,failed:workflows.filter(w=>w.status==='failed').length}}
  function paintCounts(){const c=counts();[['run',c.running],['wait',c.waiting],['done',c.done],['fail',c.failed]].forEach(([k,v])=>{const e=document.querySelector(`[data-ai440-count="${k}"]`);if(e)e.textContent=String(v)})}
  function paintWorkflows(){
    paintCounts();const wrap=document.getElementById('ai440WorkflowList');if(!wrap)return;
    if(!workflows.length){wrap.innerHTML='<div class="ai440-empty">아직 AI 검토 이력이 없습니다.</div>';return}
    wrap.innerHTML=workflows.map(w=>`<button class="ai440-row" data-ai440-workflow="${ex(w.id)}"><span><strong>${ex(siteName((data.incidents||[]).find(i=>String(i.id)===String(w.source_id))?.siteId)||'사고 검토')} · ${ex(w.input_summary||w.source_id||'-')}</strong><small>${ex(agentLabel(w.current_agent))} · ${ex(fmtSafe(w.created_at))}</small></span><span class="ai440-pill ${statusClass(w.status)}">${ex(statusLabel(w.status))}</span></button>`).join('');
    wrap.querySelectorAll('[data-ai440-workflow]').forEach(b=>b.onclick=()=>openWorkflow(b.dataset.ai440Workflow));
  }
  function incidentOptions(){
    const arr=typeof accessibleIncidents==='function'?accessibleIncidents(currentUser?.()):[...(data.incidents||[])];
    return arr.slice(0,80).map(i=>`<option value="${ex(i.id)}">${ex(siteName(i.siteId))} · ${ex(fmtSafe(i.occurredAt||i.createdAt))} · ${ex(typeof categoryName==='function'?categoryName(i.category):i.category||'사고')}</option>`).join('');
  }
  async function renderAI(root,u){
    ensureCss();
    root.innerHTML=`<div class="ai440">
      <section class="ai440-hero"><div><div class="ai440-ey">E&L AI SAFETY TEAM</div><h2>AI 안전관리팀</h2><p>사고관리 → 법령검토 → 문서·최종검증 → AI 안전본부장 순서로 검토하고, 책임이 필요한 판단은 안전관리자에게 올립니다.</p></div><div id="ai440Health" class="ai440-health"><b>연결 확인 중</b>AI 안전관리팀 상태를 확인하고 있습니다.</div></section>
      <div class="ai440-cards"><div class="ai440-card"><span>진행/대기</span><b data-ai440-count="run">0</b></div><div class="ai440-card wait"><span>태영 확인 필요</span><b data-ai440-count="wait">0</b></div><div class="ai440-card"><span>검토 완료</span><b data-ai440-count="done">0</b></div><div class="ai440-card bad"><span>오류</span><b data-ai440-count="fail">0</b></div></div>
      <div class="ai440-grid">
        <section class="ai440-panel"><h3>사고 1건 AI 검토</h3><p>사진과 사고자 이름은 전송하지 않고, 안전검토에 필요한 최소 정보만 서버에서 다시 정리합니다.</p><select id="ai440Incident" class="ai440-select"><option value="">사고 선택</option>${incidentOptions()}</select><div class="ai440-actions"><button id="ai440Review" class="ai440-btn">AI 안전관리팀 검토 시작</button><button id="ai440Refresh" class="ai440-btn secondary">현황 새로고침</button></div>
          <div class="ai440-team"><div class="ai440-agent"><b>사고관리</b><small>사실·누락·원인 후보</small></div><div class="ai440-agent"><b>법령검토</b><small>최신 공식근거 확인</small></div><div class="ai440-agent"><b>최종검증</b><small>모순·과잉판단 검증</small></div><div class="ai440-agent"><b>안전본부장</b><small>최종보고·승인 분류</small></div></div>
        </section>
        <section class="ai440-panel"><h3>최근 AI 업무</h3><p>완료·진행·승인대기 업무를 한 곳에서 확인합니다.</p><div id="ai440WorkflowList" class="ai440-list"><div class="ai440-empty">불러오는 중…</div></div></section>
      </div>
    </div>`;
    document.getElementById('ai440Refresh').onclick=()=>refreshWorkflows();
    document.getElementById('ai440Review').onclick=reviewSelected;
    const h=await loadHealth();const box=document.getElementById('ai440Health');
    if(box){
      if(h?.ok&&h.openaiConfigured){box.className='ai440-health';box.innerHTML=`<b>AI 서버 연결됨</b>${ex(h.version||VERSION)} · 전문 에이전트 준비 완료`}
      else if(h?.ok){box.className='ai440-health bad';box.innerHTML='<b>AI 모델 연결 대기</b>백엔드는 준비됐지만 OpenAI API 키 설정이 필요합니다.'}
      else{box.className='ai440-health bad';box.innerHTML=`<b>서버 연결 확인 필요</b>${ex(h?.message||'상태를 확인하지 못했습니다.')}`}
    }
    if(h?.ok&&h.openaiConfigured)refreshWorkflows({silent:true});else{workflows=[];paintWorkflows()}
  }
  async function reviewSelected(){
    if(!healthState?.openaiConfigured){alert('OpenAI API 키 연결 후 사용할 수 있습니다.');return}
    const id=document.getElementById('ai440Incident')?.value||'';if(!id){alert('검토할 사고를 선택해 주세요.');return}
    const i=(data.incidents||[]).find(x=>String(x.id)===String(id));if(!i){alert('사고 정보를 찾지 못했습니다.');return}
    const btn=document.getElementById('ai440Review');btn.disabled=true;const old=btn.textContent;btn.textContent='4개 에이전트 검토 중…';
    try{
      const r=await post({action:'review_incident',incidentId:id,incidentSnapshot:incidentSnapshot(i)},{timeout:180000});
      await refreshWorkflows({silent:true});
      alert(r.requiresHumanApproval?'AI 검토가 완료됐습니다. 안전관리자 확인이 필요한 결과가 있습니다.':'AI 검토가 완료됐습니다.');
      if(r.workflowId)openWorkflow(r.workflowId);
    }catch(e){alert(messageFor(e))}finally{btn.disabled=false;btn.textContent=old}
  }
  async function openWorkflow(id){
    try{
      const r=await post({action:'get_workflow',workflowId:id});renderWorkflowModal(r);
    }catch(e){alert(messageFor(e))}
  }
  function sourceLinks(arr){
    const seen=new Set(),out=[];for(const s of arr||[]){const url=txt(s?.url);if(!url||seen.has(url))continue;seen.add(url);out.push(`<a href="${ex(url)}" target="_blank" rel="noopener noreferrer">${ex(s?.title||url)}</a>`)}return out.join('')
  }
  function renderWorkflowModal(r){
    const w=r.workflow||{},runs=r.runs||[],findings=r.findings||[],approval=(r.approvals||[]).slice(-1)[0];
    const layer=document.createElement('div');layer.className='ai440-modal';
    layer.innerHTML=`<div class="ai440-modalbox"><div class="ai440-modalhead"><div><div class="ai440-ey">AI REVIEW</div><h3>${ex(statusLabel(w.status))}</h3><small>${ex(fmtSafe(w.created_at))}</small></div><button class="ai440-close" type="button">×</button></div>
      <div class="ai440-summary">${ex(w.result_summary||w.input_summary||'검토 결과를 준비 중입니다.')}</div>
      <div>${runs.map(x=>`<div class="ai440-run"><b>${ex(agentLabel(x.agent_id))}</b> · ${ex(statusLabel(x.status))}<br><small>${ex(x.result_summary||x.error_message||'처리 기록')}</small></div>`).join('')}</div>
      <div>${findings.map(f=>`<div class="ai440-find ${ex(f.severity||'')}"><h4>${ex(f.title||f.finding_type||'검토사항')}</h4><p>${ex(f.detail||'')}</p>${f.legal_obligation?`<p><b>법적 의무</b> ${ex(f.legal_obligation)}</p>`:''}${f.practical_recommendation?`<p><b>실무 권장</b> ${ex(f.practical_recommendation)}</p>`:''}${f.uncertainty?`<p><b>확인 필요</b> ${ex(f.uncertainty)}</p>`:''}<div class="ai440-sources">${sourceLinks(f.official_sources)}</div></div>`).join('')}</div>
      ${w.status==='awaiting_approval'?`<textarea id="ai440DecisionNote" class="ai440-note" placeholder="승인·보류·재검토 의견(선택)"></textarea><div class="ai440-actions"><button class="ai440-btn" data-ai440-decision="approved">승인</button><button class="ai440-btn warn" data-ai440-decision="held">보류</button><button class="ai440-btn secondary" data-ai440-decision="re_review">재검토 요청</button></div>`:approval?`<div class="ai440-summary"><b>최종 처리</b> ${ex(statusLabel(w.status))}${approval.decision_note?`<br>${ex(approval.decision_note)}`:''}</div>`:''}
    </div>`;
    document.body.appendChild(layer);layer.querySelector('.ai440-close').onclick=()=>layer.remove();layer.onclick=e=>{if(e.target===layer)layer.remove()};
    layer.querySelectorAll('[data-ai440-decision]').forEach(b=>b.onclick=async()=>{
      if(!confirm(`${b.textContent} 처리할까요?`))return;
      b.disabled=true;try{await post({action:'decide_workflow',workflowId:w.id,decision:b.dataset.ai440Decision,note:layer.querySelector('#ai440DecisionNote')?.value||''});layer.remove();await refreshWorkflows({silent:true});alert('처리했습니다.')}catch(e){b.disabled=false;alert(messageFor(e))}
    });
  }

  window.ENL_AI_SAFETY_VERSION=VERSION;
  window.enlAiSafetyApi=post;
  window.enlRenderAiSafetyTeam=renderAI;
})();
