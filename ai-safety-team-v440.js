/* E&L AI Safety Team v4.4.0 - staging console */
(function(){
  'use strict';

  const VERSION='4.4.0-control-room3';
  const API='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-ai-safety-v440';
  const CLIENT='incident-report-v2';
  const VIEW='ai-team';
  let credentialHash='';
  let healthState=null;
  let workflows=[];
  let busy=false;
  let owner='',generation=0,timer=null,tab='control',room={runs:[],events:[]},selected='',modal=null,detail=null,agentFilter='',failures=0,lastSync=null;
  let pendingReview=null,reviewPending=false,decisionPending=false,detailRequest=0;
  const AGENTS=['incident_manager','legal_reviewer','final_auditor','safety_director'];

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
    const identity=txt(actor()?.id);if(identity!==owner){credentialHash='';owner=identity;}
    if(force)credentialHash='';
    if(credentialHash)return credentialHash;
    const u=currentUser?.();
    if(u?.passwordHash){credentialHash=txt(u.passwordHash);return credentialHash}
    const pw=prompt('AI 안전관리팀 연결 확인을 위해 안전관리자 비밀번호를 입력해 주세요.');
    if(!txt(pw))throw new Error('credential_cancelled');
    credentialHash=await sha256Hex(pw);
    return credentialHash;
  }
  async function post(body,{auth=true,retry=false,timeout=20000}={}){
    const requestOwner=txt(actor()?.id);
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
      if(auth&&(txt(actor()?.id)!==requestOwner||roleNorm(actor()?.role)!=='safety'))throw new Error('forbidden');
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
    stop();return baseCurrent.apply(this,arguments);
  };

  function active(){return typeof currentView!=='undefined'&&currentView===VIEW&&roleNorm(actor()?.role)==='safety';}
  function stop(){pendingReview=null;clearTimeout(timer);generation++;credentialHash='';owner='';workflows=[];room={runs:[],events:[]};closeModal();}
  function closeModal(){detailRequest++;if(modal){const back=modal.returnFocus;modal.remove();modal=null;detail=null;agentFilter='';back?.focus?.();}}
  function elapsed(start,end){if(!start)return '—';const seconds=Math.max(0,Math.floor(((end?Date.parse(end):Date.now())-Date.parse(start))/1000));return Number.isFinite(seconds)?`${Math.floor(seconds/60)}분 ${seconds%60}초`:'—';}
  function clock(v){return v?new Date(v).toLocaleTimeString('en-GB',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';}
  function stageLabel(s){return ({retrying:'재시도 대기',received:'업무수신',analyzing:'분석중',checking_sources:'자료확인',verifying:'검증중',handoff:'인계중',completed:'완료',failed:'오류',needs_review:'확인 필요'})[s]||statusLabel(s);}
  function sourceLinks(arr){const seen=new Set();return (arr||[]).filter(s=>{try{const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password||!['law.go.kr','moel.go.kr','kosha.or.kr'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||seen.has(s.url))return false;seen.add(s.url);return true;}catch{return false;}}).map(s=>`<a href="${ex(s.url)}" target="_blank" rel="noopener noreferrer">${ex(s.title||s.url)}${s.url.includes('kosha.or.kr')?' · 공단 자료(법령과 구분)':''}</a>`).join('');}
  function controlCss(){ensureCss();if(document.getElementById('aiControlCss'))return;const s=document.createElement('style');s.id='aiControlCss';s.textContent=`
   .ai440 *{box-sizing:border-box}.ai440>*,#ai440ControlPane,.ai440-panel{min-width:0}.ai440-select,.ai440-note{font-size:16px}.ai440-btn,.ai440-close{min-height:44px}.ai440-close{width:44px}.ai440-modal{padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}.ai440-modalbox{max-height:calc(var(--ai-visible-height,100dvh) - 32px)}.ai440 select{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;appearance:none}.ai440{color:#244b66;min-width:0}.ai440 button:focus-visible,.ai440-modal button:focus-visible{outline:3px solid #0b78b8;outline-offset:3px}.ai440-tabs{display:flex;gap:8px;flex-wrap:wrap}.ai440-tabs button[aria-selected=true]{background:#164f78;color:#fff}.ai440-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.ai440-seats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.ai440-seat{position:relative;text-align:left;padding:18px;border:1px solid #cbdde9;border-radius:16px;background:#fff;color:#234a64;cursor:pointer;min-width:0}.ai440-seat h3{font-size:15px;margin:12px 0}.ai440-seat p{font-size:13px;line-height:1.5;overflow-wrap:anywhere}.ai440-seat small{display:block;color:#61798b;line-height:1.6}.ai440-seat.is-running{border-color:#2783b2;box-shadow:inset 0 3px #2783b2}.ai440-seat.is-failed{border-color:#b45b59}.ai440-seat progress{display:block;width:100%;height:8px;margin:12px 0;accent-color:#2678a5}.ai440-light{display:inline-block;width:8px;height:8px;border-radius:50%;background:#9bafbb;margin-right:7px}.is-running .ai440-light{background:#1383b6;animation:aiGlow 2s ease-in-out infinite}.is-failed .ai440-light{background:#b64646}.is-completed .ai440-light{background:#38845c}@keyframes aiGlow{50%{opacity:.35}}@media(prefers-reduced-motion:reduce){.ai440-light{animation:none!important}}.ai440-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0}.ai440-node{position:relative;padding:12px 7px;border:1px solid #d0e0eb;border-radius:10px;text-align:center;font-size:12px;background:#f4f8fb}.ai440-node:not(:last-child):after{content:'→';position:absolute;right:-14px;top:12px;color:#7296ae}.ai440-node.current{background:#e3f3ff;border-color:#2783b2;font-weight:900}.ai440-node.done{background:#eef8f1;color:#34704f}.ai440-control-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px}.ai440-timeline{list-style:none;padding:0;margin:0;max-height:510px;overflow:auto}.ai440-timeline li{display:grid;grid-template-columns:68px minmax(0,1fr);gap:12px;border-bottom:1px solid #e5edf3;padding:13px 0;font-size:12px;line-height:1.55}.ai440-timeline time{font-variant-numeric:tabular-nums;color:#6f8594}.ai440-timeline strong,.ai440-timeline small{display:block;overflow-wrap:anywhere}.ai440-timeline small{color:#738795}.ai440-timeline button{min-height:44px;border:0;padding:0;background:none;text-align:left;color:#244b66;cursor:pointer}.ai440-connection{font-size:12px;color:#387555}.ai440-connection.stale{color:#a06b20}.ai440-muted{font-size:12px;color:#6b8294;line-height:1.6}.ai440-error{color:#943e3e;background:#fff4f3;padding:12px;border-radius:10px}.ai440-row strong{overflow-wrap:anywhere}.ai440-row{min-width:0}.ai440-modalbox{width:min(1000px,100%);box-sizing:border-box;overflow-wrap:anywhere}.ai440-modalbox *{box-sizing:border-box}.ai440-detail-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;margin:12px 0}.ai440-usage{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.ai440-usage div{background:#f1f7fb;border-radius:10px;padding:12px;font-size:12px}.ai440-usage b{display:block;margin-top:5px;font-size:18px}.ai440-detail-actions{position:sticky;bottom:-18px;background:#fff;padding:12px 0;border-top:1px solid #d8e4ed}.ai440-run small{display:block;line-height:1.6;white-space:pre-wrap}.ai440-modalhead{position:sticky;top:-18px;background:#fff;padding:10px 0;z-index:1}.ai440-close{flex-shrink:0;cursor:pointer}.ai440-agent-picker{max-width:100%;margin:12px 0}.ai440-notice{font-size:12px;padding:10px;border-radius:10px;background:#f1f7fc;line-height:1.6}
   @media(max-width:900px){.ai440-seats{grid-template-columns:repeat(2,minmax(0,1fr))}.ai440-control-grid{grid-template-columns:1fr}.ai440-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
   @media(max-width:480px){.ai440-seats{grid-template-columns:1fr}.ai440-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ai440-seat{padding:15px}.ai440-flow{gap:10px}.ai440-node{font-size:10px;padding:10px 3px}.ai440-node:not(:last-child):after{right:-10px}.ai440-panel{padding:14px}.ai440-usage{grid-template-columns:1fr}.ai440-modal{padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}.ai440-modalbox{padding:14px}.ai440-row{grid-template-columns:minmax(0,1fr)}.ai440-pill{justify-self:start}.ai440-hero h2{font-size:21px}.ai440-btn{white-space:normal;line-height:1.5;padding:9px 12px}.ai440-detail-actions{bottom:-14px}.ai440-timeline li{gap:6px;grid-template-columns:60px minmax(0,1fr)}}
  `;document.head.appendChild(s);}
  function incidentOptions(){const arr=typeof accessibleIncidents==='function'?accessibleIncidents(currentUser?.()):data.incidents||[];return arr.slice(0,100).map(i=>`<option value="${ex(i.id)}">${ex(siteName(i.siteId))} · ${ex(i.summary||i.category||'사고')}</option>`).join('');}
  async function renderAI(root){
   if(!root||!active())return;const nextOwner=txt(actor()?.id);if(owner&&owner!==nextOwner)stop();owner=nextOwner;clearTimeout(timer);const ticket=++generation;controlCss();
   root.innerHTML=`<div class="ai440"><section class="ai440-hero"><div><div class="ai440-ey">E&L AI SAFETY CONTROL ROOM</div><h2>AI 안전관리본부 상황실</h2><p>검토 과정과 인계 현황을 확인하고, 책임이 필요한 판단을 승인합니다.</p></div><div><b>STAGING</b><div id="ai440Connection" class="ai440-connection" role="status">연결 확인 중…</div></div></section><div class="ai440-tabs" role="tablist" aria-label="AI 안전팀 화면"><button class="ai440-btn secondary" role="tab" data-ai-tab="review">업무지시/검토</button><button class="ai440-btn secondary" role="tab" data-ai-tab="control">상황실</button></div><div id="ai440Error" role="alert"></div><section id="ai440ReviewPane" class="ai440-panel"><h3>사고 검토 지시</h3><p>사진과 사고자 이름은 전송하지 않고, 스테이징에 저장된 사고의 최소 업무정보를 검토합니다.</p><label for="ai440Incident">검토할 사고</label><select id="ai440Incident" class="ai440-select"><option value="">사고 선택</option>${incidentOptions()}</select><label for="ai440Question">또는 안전관리 업무 질의</label><textarea id="ai440Question" class="ai440-note" maxlength="4000" placeholder="사고를 선택하지 않고 일반·법령 질의를 입력할 수 있습니다. (10자 이상)"></textarea><div class="ai440-actions"><button id="ai440Review" class="ai440-btn">검토 시작</button><button id="ai440Refresh" class="ai440-btn secondary">연결 다시 확인</button></div><p class="ai440-muted">검토 지시 후 상황실에서 진행 상태를 확인할 수 있습니다. 법적 최종판정은 사람이 승인합니다.</p></section><div id="ai440ControlPane"><div id="ai440Stats" class="ai440-stats"></div><div id="ai440Seats" class="ai440-seats" style="margin-top:14px"></div><section class="ai440-panel" style="margin-top:14px"><h3>업무 인계 흐름</h3><select id="ai440FlowSelect" class="ai440-select" aria-label="인계 흐름을 볼 업무"></select><div id="ai440Flow"></div><p class="ai440-muted">진행률은 확인된 업무 단계 기준입니다. AI의 내부 추론은 저장하거나 표시하지 않습니다.</p></section></div><div class="ai440-control-grid"><section class="ai440-panel"><h3>LIVE TIMELINE</h3><p>서버에 저장된 업무 이벤트 · 최신순 120개</p><div id="ai440Timeline"></div></section><section class="ai440-panel"><h3>AI 업무 목록</h3><p>진행·승인대기·보류·오류와 최근 완료 업무</p><div id="ai440WorkflowList" class="ai440-list"></div></section></div></div>`;
   root.querySelectorAll('[data-ai-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.aiTab;paintTab();});paintTab();
   document.getElementById('ai440Review').onclick=reviewSelected;document.getElementById('ai440Incident').onchange=e=>{document.getElementById('ai440Question').disabled=!!e.target.value;};
   document.getElementById('ai440Refresh').onclick=()=>{credentialHash='';failures=0;refreshRoom(ticket);};
   document.getElementById('ai440FlowSelect').onchange=e=>{selected=e.target.value;paintFlow();};
   await refreshRoom(ticket);
  }
  function paintTab(){document.querySelectorAll('[data-ai-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.aiTab===tab)));document.getElementById('ai440ReviewPane').hidden=tab!=='review';document.getElementById('ai440ControlPane').hidden=tab!=='control';}
  async function refreshRoom(ticket=generation){
   clearTimeout(timer);if(!active()||ticket!==generation)return;
   if(busy){timer=setTimeout(()=>refreshRoom(ticket),1000);return;}busy=true;
   try{const r=await post({action:'control_room'});if(ticket!==generation||!active())return;workflows=r.workflows||[];room={runs:r.runs||[],events:r.events||[]};failures=0;lastSync=Date.now();document.getElementById('ai440Error').textContent='';paintRoom();
    if(modal&&detail){const id=detail.workflow.id;const d=await post({action:'get_workflow',workflowId:id});if(ticket===generation&&modal&&detail?.workflow.id===id){detail=d;paintDetail();}}
   }catch(e){if(ticket!==generation)return;failures++;const box=document.getElementById('ai440Error');if(box){box.className='ai440-error';box.textContent=messageFor(e);}if(['authentication_required','credential_cancelled','forbidden'].includes(e.message)){credentialHash='';failures=99;}}
   finally{busy=false;if(ticket===generation&&active()){const c=document.getElementById('ai440Connection');if(c){c.className='ai440-connection'+(failures?' stale':'');c.textContent=failures?`연결 끊김 · ${lastSync?'마지막 확인 '+clock(lastSync):'연결 다시 확인 필요'}`:'자동 갱신 · 3초 · '+clock(lastSync);}if(failures<99)timer=setTimeout(()=>refreshRoom(ticket),document.hidden?15000:Math.min(30000,3000*2**Math.min(failures,3)));}}
  }
  function messageFor(e){return ({incident_not_synced:'선택한 사고가 스테이징에 없습니다. 스테이징 사고 동기화를 먼저 확인해 주세요.',authentication_required:'안전관리자 인증이 만료되었습니다. 업무지시/검토 탭에서 연결을 다시 확인해 주세요.',credential_cancelled:'인증이 취소되었습니다. 연결 다시 확인을 눌러 주세요.',forbidden:'안전관리자 권한이 필요합니다.',state_changed_or_busy:'업무 상태가 변경됐거나 처리 중입니다. 최신 상태를 확인해 주세요.',request_failed:'요청을 처리하지 못했습니다. 진행 중 업무 수와 서버 연결을 확인해 주세요.'})[e?.message]||'서버 연결을 확인하지 못했습니다. 잠시 후 다시 시도합니다.';}
  function latestRun(agent){return room.runs.filter(r=>r.agent_id===agent).sort((a,b)=>(b.status==='running')-(a.status==='running')||b.created_at.localeCompare(a.created_at))[0];}
  function eventFor(run){return room.events.filter(e=>e.agent_run_id===run?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)||(b.event_seq||0)-(a.event_seq||0));}
  function patchHTML(target,html){
   if(!target||target._aiMarkup===html)return;target._aiMarkup=html;
   const template=document.createElement('template');template.innerHTML=html;
   const scrollNodes=[...target.querySelectorAll('.ai440-timeline'),target.closest('.ai440-modalbox')].filter(Boolean);
   const positions=scrollNodes.map(el=>({el,top:el.scrollTop,height:el.scrollHeight,anchor:[...el.querySelectorAll('[data-event]')].find(n=>n.getBoundingClientRect().top>=el.getBoundingClientRect().top)})).map(x=>({...x,anchorTop:x.anchor?.getBoundingClientRect().top}));
   const key=n=>n.nodeType===1?(n.getAttribute('data-agent')||n.getAttribute('data-event')||n.getAttribute('data-workflow')||n.id):null;
   function sync(parent,fresh){
    let cursor=parent.firstChild;const keyed=new Map([...parent.childNodes].filter(key).map(n=>[key(n),n]));
    for(const incoming of [...fresh.childNodes]){
     const k=key(incoming);let existing=k?keyed.get(k):cursor;
     if(existing&&(existing.nodeType!==incoming.nodeType||existing.nodeName!==incoming.nodeName||(!k&&key(existing))))existing=null;
     if(!existing){parent.insertBefore(incoming.cloneNode(true),cursor);continue;}
     if(existing!==cursor)parent.insertBefore(existing,cursor);
     if(incoming.nodeType===3){if(existing.nodeValue!==incoming.nodeValue)existing.nodeValue=incoming.nodeValue;}
     else if(incoming.nodeType===1){for(const a of [...existing.attributes])if(!incoming.hasAttribute(a.name))existing.removeAttribute(a.name);for(const a of [...incoming.attributes])if(existing.getAttribute(a.name)!==a.value)existing.setAttribute(a.name,a.value);sync(existing,incoming);}
     cursor=existing.nextSibling;
    }
    while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
   }
   sync(target,template.content);
   for(const x of positions){if(!x.el.isConnected)continue;if(x.anchor?.isConnected&&x.top>0)x.el.scrollTop=x.top+x.anchor.getBoundingClientRect().top-x.anchorTop;else x.el.scrollTop=x.top;}
  }
  function paintRoom(){
   const working=new Set(room.runs.filter(r=>r.status==='running').map(r=>r.agent_id));
   const counts=[['근무 중 에이전트',working.size],['진행 중 업무',workflows.filter(w=>['queued','running'].includes(w.status)).length],['태영 확인 필요',workflows.filter(w=>['awaiting_approval','on_hold'].includes(w.status)).length],['오류',workflows.filter(w=>w.status==='failed').length],['긴급 검토',workflows.filter(w=>w.priority==='urgent'&&!['completed','cancelled','re_review_requested'].includes(w.status)).length]];
   patchHTML(document.getElementById('ai440Stats'),counts.map(([label,n])=>`<div class="ai440-card"><span>${label}</span><b>${n}</b></div>`).join(''));
   patchHTML(document.getElementById('ai440Seats'),AGENTS.map(agent=>{const run=latestRun(agent),events=eventFor(run),w=workflows.find(w=>w.id===run?.workflow_id),status=run?.status==='running'?(events[0]?.status||'analyzing'):(run?.status||'queued'),progress=run?.status==='completed'?100:Math.max(0,...events.map(e=>e.progress||0)),jobs=room.runs.filter(r=>r.agent_id===agent&&r.status==='running').length;return `<button class="ai440-seat is-${ex(run?.status||'queued')}" data-agent="${agent}"><span class="ai440-light"></span><span class="ai440-pill ${statusClass(run?.status)}">${stageLabel(status)}${jobs>1?' · '+jobs+'건':''}</span><h3>${agentLabel(agent)}</h3><p>${ex(w?.input_summary||'새 검토 업무를 기다리고 있습니다.')}</p><small>시작 ${clock(run?.started_at)} · ${elapsed(run?.started_at,run?.completed_at)}</small><progress value="${progress}" max="100" aria-label="${agentLabel(agent)} 진행률"></progress><small>${progress}% · ${run?.status==='completed'?'담당 검토 완료':stageLabel(status)}</small>${events.slice(0,3).map(e=>`<small>· ${ex(e.title)}</small>`).join('')}</button>`;}).join(''));
   document.querySelectorAll('[data-agent]').forEach(b=>b.onclick=()=>{const run=latestRun(b.dataset.agent);if(run)openWorkflow(run.workflow_id,b.dataset.agent);else alert('아직 담당 업무 기록이 없습니다.');});
   if(!workflows.some(w=>w.id===selected))selected=workflows.find(w=>['running','queued'].includes(w.status))?.id||workflows[0]?.id||'';
   const select=document.getElementById('ai440FlowSelect');const options=workflows.map(w=>`<option value="${ex(w.id)}">${ex(w.input_summary||w.source_id)} · ${statusLabel(w.status)}</option>`).join('');if(select.innerHTML!==options)select.innerHTML=options;select.value=selected;paintFlow();
   patchHTML(document.getElementById('ai440Timeline'),timeline(room.events,true));
   patchHTML(document.getElementById('ai440WorkflowList'),workflows.length?workflows.map(w=>`<button class="ai440-row" data-workflow="${ex(w.id)}"><span><strong>${ex(w.input_summary||w.source_id)}</strong><small>${fmtSafe(w.created_at)} · ${ex(agentLabel(w.current_agent))}${w.retry_of?' · 재검토':''}</small></span><span class="ai440-pill ${statusClass(w.status)}">${w.priority==='urgent'?'긴급 · ':''}${statusLabel(w.status)}</span></button>`).join(''):'<div class="ai440-empty">아직 검토 업무가 없습니다.</div>');
   document.querySelectorAll('[data-workflow]').forEach(b=>b.onclick=()=>openWorkflow(b.dataset.workflow));
  }
  function flow(w,runs){return `<div class="ai440-flow">${AGENTS.map(a=>{const r=runs.find(r=>r.agent_id===a);return `<div class="ai440-node ${r?.status==='running'?'current':r?.status==='completed'?'done':''}">${agentLabel(a)}<br>${r?statusLabel(r.status):'대기'}</div>`;}).join('')}</div>`;}
  function paintFlow(){const w=workflows.find(w=>w.id===selected);patchHTML(document.getElementById('ai440Flow'),w?flow(w,room.runs.filter(r=>r.workflow_id===w.id)):'<div class="ai440-empty">업무를 지시하면 인계 흐름이 표시됩니다.</div>');}
  function timeline(events,links=false){return events.length?`<ol class="ai440-timeline">${events.map(e=>`<li data-event="${ex(e.id)}"><time>${clock(e.created_at)}</time><div>${links?`<button data-workflow="${ex(e.workflow_id)}">`:''}<strong>${ex(agentLabel(e.agent_id))} · ${ex(e.title)}</strong>${links?'</button>':''}<small>${ex(e.detail||'')}${links?' · 업무 '+ex(e.workflow_id.slice(0,8)):''}</small></div></li>`).join('')}</ol>`:'<div class="ai440-empty">저장된 업무 이벤트가 없습니다.</div>';}
  async function reviewSelected(){if(reviewPending)return;const select=document.getElementById('ai440Incident'),id=select?.value,question=txt(document.getElementById('ai440Question')?.value);if(!id&&question.length<10){document.getElementById('ai440Question')?.focus();return;}reviewPending=true;const btn=document.getElementById('ai440Review');btn.disabled=true;btn.textContent='업무 접수 중…';try{const requestKey=id||question;if(!pendingReview||pendingReview.id!==requestKey)pendingReview={id:requestKey,requestId:crypto.randomUUID()};const r=await post({action:id?'review_incident':'review_question',...(id?{incidentId:id}:{question}),requestId:pendingReview.requestId});pendingReview=null;selected=r.workflowId;tab='control';paintTab();await refreshRoom();await openWorkflow(r.workflowId);}catch(e){alert(messageFor(e));}finally{reviewPending=false;btn.disabled=false;btn.textContent='검토 시작';}}
  async function openWorkflow(id,agent=''){
   const ticket=generation,openTicket=++detailRequest;try{const r=await post({action:'get_workflow',workflowId:id});if(ticket!==generation||openTicket!==detailRequest||!active())return;closeModal();detail=r;agentFilter=agent;modal=document.createElement('div');modal.className='ai440-modal';modal.returnFocus=document.activeElement;
    modal.innerHTML=`<section class="ai440-modalbox" role="dialog" aria-modal="true" aria-labelledby="ai440DetailTitle"><div class="ai440-modalhead"><h3 id="ai440DetailTitle">${agent?agentLabel(agent)+' 상세':'업무 상세'}</h3><button class="ai440-close" aria-label="닫기">×</button></div><div id="ai440DetailContent"></div><div class="ai440-detail-actions"><label for="ai440DecisionNote">검토 의견</label><textarea id="ai440DecisionNote" class="ai440-note" placeholder="승인·보류·재검토 의견(선택)"></textarea><div id="ai440Decisions" class="ai440-actions"></div><p class="ai440-muted">법적 최종판정은 안전관리자가 확인합니다.</p></div></section>`;
    document.body.appendChild(modal);modal.querySelector('.ai440-close').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal();};modal.onkeydown=e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,textarea,a,select')].filter(x=>!x.disabled&&x.offsetParent!==null),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};paintDetail();modal.querySelector('.ai440-close').focus();
   }catch(e){alert(messageFor(e));}
  }
  function paintDetail(){if(!modal||!detail)return;const w=detail.workflow,runs=(detail.runs||[]).filter(r=>!agentFilter||r.agent_id===agentFilter),events=(detail.events||[]).filter(e=>!agentFilter||e.agent_id===agentFilter),findings=(detail.findings||[]).filter(f=>!agentFilter||f.agent_id===agentFilter),usage=runs.map(r=>r.output_payload?._meta?.usage).filter(Boolean),sum=k=>usage.reduce((n,u)=>n+(Number(u[k])||0),0),sources=runs.flatMap(r=>r.output_payload?.official_sources||[]),conflicts=findings.filter(f=>f.finding_type==='contradiction');
   const html=`<div class="ai440-summary">${ex(w.input_summary)}</div><div class="ai440-detail-meta"><span>${statusLabel(w.status)}</span><span>우선순위: ${ex(({urgent:'긴급',high:'높음',normal:'보통',low:'낮음'})[w.priority]||w.priority)}</span><span>사람 승인: ${w.requires_human_approval?'필요':'불필요'}</span><span>총 처리시간: ${elapsed(w.started_at,w.completed_at)}</span></div>${flow(w,detail.runs||[])}${agentFilter?`<p class="ai440-notice">선택 업무: ${ex(w.id.slice(0,8))} · 다음 단계: ${agentFilter==='safety_director'?'최종 취합 / 사람 확인':agentLabel(AGENTS[AGENTS.indexOf(agentFilter)+1])}</p>`:''}<div class="ai440-summary">${ex(agentFilter?runs[0]?.result_summary||'담당 검토 진행 중':w.result_summary||'검토 진행 중')}</div>${conflicts.length?`<div class="ai440-error"><b>의견 충돌 감지 · 사용자 확인 필요</b>${conflicts.map(f=>`<p>${ex(f.detail)}</p>`).join('')}</div>`:''}<div class="ai440-usage">${[['input_tokens','입력 토큰'],['output_tokens','출력 토큰'],['total_tokens','전체 토큰']].map(([k,label])=>`<div>${label}<b>${usage.length?sum(k).toLocaleString():'미집계'}</b></div>`).join('')}</div><p class="ai440-muted">${usage.length}/${runs.length}개 에이전트의 실제 사용량 · 가격 기준 미연결로 비용은 표시하지 않습니다.</p>${runs.map(r=>`<div class="ai440-run"><b>${agentLabel(r.agent_id)}</b> · ${statusLabel(r.status)}<small>시작 ${clock(r.started_at)} · ${elapsed(r.started_at,r.completed_at)} · 토큰 ${r.output_payload?._meta?.usage?.total_tokens??'미집계'}</small><small>${ex(r.result_summary||r.error_message||'처리 중')}</small>${(r.output_payload?.missing_information||[]).map(m=>`<small>확인 필요: ${ex(m)}</small>`).join('')}</div>`).join('')}<h4>검토 사항</h4>${findings.map(f=>`<div class="ai440-find ${ex(f.severity)}"><h4>${ex(f.title)}</h4><p>${ex(f.detail)}</p>${f.legal_obligation?`<p>법적 의무 검토: ${ex(f.legal_obligation)}</p>`:''}${f.practical_recommendation?`<p>실무 권장: ${ex(f.practical_recommendation)}</p>`:''}${f.uncertainty?`<p>확인 필요: ${ex(f.uncertainty)}</p>`:''}</div>`).join('')||'<p class="ai440-muted">아직 검토 사항이 없습니다.</p>'}<h4>공식 근거</h4><div class="ai440-sources">${sourceLinks(sources)||'<p class="ai440-muted">확인된 공식 검색 근거가 없습니다.</p>'}</div><h4>업무 타임라인</h4>${timeline(events)}${(detail.approvals||[]).map(a=>`<p class="ai440-notice">승인 기록: ${ex(({pending:'대기',approved:'승인',held:'보류',recheck_requested:'재검토 요청'})[a.status]||a.status)} · ${ex(a.decision_note||'')}</p>`).join('')}`;
   const content=modal.querySelector('#ai440DetailContent');patchHTML(content,html);
   const actionBox=modal.querySelector('#ai440Decisions'),allowed=['awaiting_approval','on_hold'].includes(w.status),cooldown=w.retry_not_before&&Date.parse(w.retry_not_before)>Date.now(),actions=w.status==='failed'?[['retry','실패 업무 재시도']]:allowed?[['approved','승인'],['held','보류'],['re_review','재검토 요청']]:w.status==='completed'?[['re_review','완료 업무 재검토']]:[];
   const signature=actions.map(a=>a[0]).join()+cooldown;if(actionBox.dataset.signature!==signature){actionBox.dataset.signature=signature;actionBox.innerHTML=actions.map(([key,label])=>`<button class="ai440-btn ${key==='approved'?'':'secondary'}" data-decision="${key}" ${cooldown?'disabled':''}>${cooldown?'잠시 후 재시도':label}</button>`).join('');actionBox.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>decide(b.dataset.decision));}
   modal.querySelector('.ai440-detail-actions').hidden=!actions.length;modal.querySelector('#ai440DecisionNote').hidden=!(allowed||w.status==='completed');
  }
  async function decide(decision){if(!detail||decisionPending)return;decisionPending=true;const id=detail.workflow.id,note=modal.querySelector('#ai440DecisionNote').value;modal.querySelectorAll('[data-decision]').forEach(b=>b.disabled=true);try{const r=await post({action:decision==='retry'?'retry_workflow':'decide_workflow',workflowId:id,decision,note});closeModal();await refreshRoom();await openWorkflow(r.workflowId);}catch(e){alert(messageFor(e));modal?.querySelectorAll('[data-decision]').forEach(b=>b.disabled=false);}finally{decisionPending=false;}}
  function viewportSize(){document.documentElement.style.setProperty('--ai-visible-height',(window.visualViewport?.height||window.innerHeight)+'px');}
  window.visualViewport?.addEventListener('resize',viewportSize);window.addEventListener('pageshow',()=>{viewportSize();if(active()&&failures<99)refreshRoom();});viewportSize();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active()&&failures<99)refreshRoom();});
  window.ENL_AI_SAFETY_VERSION=VERSION;window.enlAiSafetyApi=post;window.enlRenderAiSafetyTeam=renderAI;
})();
