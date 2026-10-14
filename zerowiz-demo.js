(function demoClient(){
 'use strict';
 const DEMO_KEY='enl_zerowiz_demo_state_v1',ACTOR_KEY='enl_zerowiz_demo_actor_v1';
 const SITES=[{id:'d-golf1',name:'솔빛CC (가상)'},{id:'d-golf2',name:'푸른숲CC (가상)'},{id:'d-logistics',name:'평택물류센터 (가상)'}];
 const USERS=[
  {id:'safety',role:'safety',name:'데모 안전관리자',position:'안전관리자',department:'안전관리팀',siteId:''},
  {id:'field',role:'field',name:'데모 현장소장',position:'현장소장',department:'솔빛CC (가상)',siteId:'d-golf1'},
  {id:'worker',role:'worker',name:'데모 현장근무자',position:'코스관리원',department:'솔빛CC (가상)',siteId:'d-golf1'},
  {id:'manager',role:'manager',name:'데모 본사관리자',position:'본사관리자',department:'본사',siteId:''},
  {id:'executive',role:'executive',name:'데모 경영진',position:'경영진',department:'본사',siteId:''}
 ];
 const ROLE={safety:'안전관리자',field:'현장관리자',worker:'현장근무자',manager:'본사관리자',executive:'경영진'};
 const STATUS={reported:'즉시보고 검토대기',supplement:'보완대기',supplement_submitted:'보완검토대기',rejected:'사고보고 반려',approved:'사고보고 승인',closed:'사고 종결'};
 const CAUSE={not_reviewed:'안전관리자 분석 대기',investigating:'조사 중 · 원인 미확정',analyzed:'원인분석 완료'};
 const CATEGORY={person:'대인사고',property:'대물사고'};
 const DATA_FIELDS=['summary','eventType','category','occurredAt','reportDetails'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clean=v=>String(v??'').trim();
 const iso=()=>new Date().toISOString();
 const time=t=>t?new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'-';
 const site=id=>SITES.find(s=>s.id===id)?.name||'가상 사업장';
 const safeCopy=x=>JSON.parse(JSON.stringify(x));
 const dateForInput=t=>{const n=t?new Date(t):new Date();return new Date(n.getTime()+9*3600000).toISOString().slice(0,16)};
 const uniq=()=>`D-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
 const root=document.getElementById('demo');
 if(!root)throw Error('DEMO_ROOT_MISSING');
 function incidentFixture(id,o){
  const d={place:'가상 작업구역',workAction:'시설·장비 관리 작업',incidentHow:'가상 사고경위 확인 중',injuryDetail:'',damageDetail:'',environmentCause:'',behaviorCause:'',causeAnalysisNote:'',causeAnalysisStatus:'not_reviewed',repairCost:null};
  const x={id,siteId:'d-golf1',reporterId:'field',reporterName:'데모 현장소장',category:'property',eventType:'접촉',summary:'가상 사고보고',occurredAt:'2026-10-13T01:10:00.000Z',status:'reported',immediateAction:'작업 중지 및 주변 통제',priority:'normal',reportDetails:d,photos:[],corrective:null,supplement:null,approvedBy:'',approvedAt:null,closedAt:null,recordMode:'ordinary',officialRecord:{revisionNumber:0},revisions:[],history:[],createdAt:'2026-10-13T01:30:00.000Z'};
  const next={...x,...o,reportDetails:{...d,...(o?.reportDetails||{})}};
  if(['approved','closed'].includes(next.status)&&next.reportDetails.causeAnalysisStatus==='not_reviewed')next.reportDetails.causeAnalysisStatus='investigating';
  if(['approved','closed'].includes(next.status)){next.approvedBy='데모 안전관리자';next.approvedAt='2026-10-13T06:40:00.000Z'}
  if(next.status==='closed')next.closedAt='2026-10-14T04:40:00.000Z';
  next.history=[{action:'가상 사고등록',by:next.reporterName,at:next.createdAt}];
  return next;
 }
 function initialData(){
  const a=[
   incidentFixture('DEMO-001',{summary:'카트 이동 중 가상 안전표지판 접촉',eventType:'접촉',reportDetails:{place:'솔빛CC 4홀 진입로',incidentHow:'카트 이동 중 통로 옆 표지판 하단부와 접촉함',damageDetail:'표지판 지주 휨'}}),
   incidentFixture('DEMO-002',{reporterId:'worker',reporterName:'데모 현장근무자',category:'person',summary:'예초작업 중 가상 손가락 베임',eventType:'베임/찔림',reportDetails:{place:'솔빛CC 6홀',workAction:'예초구역 정리',incidentHow:'장비 정리 중 날카로운 물품에 손가락이 접촉함',injuryDetail:'가상 경상 · 진료예정'}}),
   incidentFixture('DEMO-003',{reporterId:'worker',reporterName:'데모 현장근무자',status:'supplement',category:'person',summary:'가상 이동통로 미끄러짐',eventType:'넘어짐',supplement:{requestNote:'진료결과 및 추가 경위를 확인해 주세요.',requestedBy:'데모 안전관리자'},reportDetails:{incidentHow:'작업 구역 보행 중 미끄러짐',injuryDetail:'가상 타박상'}}),
   incidentFixture('DEMO-004',{status:'supplement_submitted',summary:'가상 시설물 운반 중 외벽 긁힘',supplement:{requestNote:'수리비 견적 추가 확인',submittedNote:'가상 견적서 확인 후 비용 15만원으로 보완함'},reportDetails:{repairCost:150000,damageDetail:'도장면 긁힘'}}),
   incidentFixture('DEMO-005',{status:'approved',summary:'가상 차량 후방 이동 중 경계석 접촉',reportDetails:{causeAnalysisStatus:'analyzed',environmentCause:'후방 시야가 제한되는 가상 구조물 배치',behaviorCause:'작업 전 회전반경 확인 누락 확인',causeAnalyzedBy:'데모 안전관리자',causeAnalyzedAt:'2026-10-13T06:35:00.000Z'}}),
   incidentFixture('DEMO-006',{status:'approved',summary:'가상 조경장비 보관 중 문짝 파손',corrective:{status:'planned',rootCause:'보관구역 작업동선 관리 미흡',planDetail:'장비 이동동선 분리 및 표지 부착',ownerName:'데모 현장소장',dueDate:'2026-10-25'},reportDetails:{causeAnalysisStatus:'analyzed',environmentCause:'장비 보관공간이 좁음'}}),
   incidentFixture('DEMO-007',{status:'approved',summary:'가상 작업차량 주변 안전휀스 접촉',corrective:{status:'submitted',rootCause:'회전반경 확보 미흡',planDetail:'유도자 배치 및 동선구분',ownerName:'데모 현장소장',dueDate:'2026-10-25',actionDetail:'동선 구분 및 가상 안전표지 부착',actionDate:'2026-10-14',actionOwner:'데모 현장소장',afterPhotos:[{name:'가상조치사진.jpg'}]},reportDetails:{causeAnalysisStatus:'analyzed',behaviorCause:'주행 전 주변 확인 절차 누락'}}),
   incidentFixture('DEMO-008',{siteId:'d-golf2',status:'closed',recordMode:'historical_transfer',summary:'이관된 가상 2025년 잔디깎기 장비 사고',corrective:null,reportDetails:{incidentHow:'2025년 가상 기록 이관',causeAnalysisStatus:'not_reviewed',damageDetail:'가상 장비수리 기록'}}),
   incidentFixture('DEMO-009',{siteId:'d-golf2',status:'closed',summary:'가상 교통동선 개선 완료 사고',corrective:{status:'approved',rootCause:'통행 동선 복잡',planDetail:'통로 표시',actionDetail:'통행 경계선 설치',actionOwner:'가상 현장',actionDate:'2026-10-14',reviewedBy:'데모 안전관리자'},reportDetails:{causeAnalysisStatus:'analyzed',causeAnalysisNote:'가상 현장 조사에 따른 분석 완료'}}),
   incidentFixture('DEMO-010',{status:'rejected',summary:'중복 등록된 가상 사고',rejectionNote:'유형과 발생시각 확인 후 재제출 필요'}),
   incidentFixture('DEMO-011',{siteId:'d-logistics',summary:'가상 물류센터 상자 전도',eventType:'낙하/전도',reportDetails:{place:'가상 물류 A구역',incidentHow:'상자가 적재대에서 전도되어 주변을 통제함'}})
  ];
  return {version:1,incidents:a};
 }
 let data;try{const s=JSON.parse(sessionStorage.getItem(DEMO_KEY)||'null');data=s?.version===1&&Array.isArray(s.incidents)?s:initialData()}catch(e){data=initialData()}
 let actor=null;try{actor=USERS.find(u=>u.id===sessionStorage.getItem(ACTOR_KEY))||null}catch(e){}
 let view='dashboard',currentId='',editor='',flash='',filterStatus='all',filterQuery='';
 const nowUser=()=>actor;
 const visible=i=>{if(!actor)return false;if(['safety','manager','executive'].includes(actor.role))return true;if(i.siteId!==actor.siteId)return false;return actor.role==='field'||i.reporterId===actor.id};
 const visibleIncidents=()=>data.incidents.filter(visible).sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt)));
 const record=id=>data.incidents.find(i=>i.id===id&&visible(i));
 const factualEditAllowed=i=>i&&(actor.role==='field'&&i.siteId===actor.siteId||actor.role==='worker'&&i.reporterId===actor.id);
 const isSafety=()=>actor?.role==='safety';
 function can(action,i){
  if(!actor)return false;
  if(action==='new')return ['field','worker'].includes(actor.role);
  if(!i||!visible(i))return false;
  const s=i.status,c=i.corrective?.status;
  if(action==='cause')return isSafety()&&['reported','supplement','supplement_submitted','rejected'].includes(s)&&i.recordMode!=='historical_transfer';
  if(action==='approve')return isSafety()&&['reported','supplement_submitted'].includes(s);
  if(action==='supplement-request')return isSafety()&&['reported','supplement_submitted'].includes(s);
  if(action==='report-reject')return isSafety()&&['reported','supplement_submitted'].includes(s);
  if(action==='supplement-submit')return factualEditAllowed(i)&&s==='supplement';
  if(action==='resubmit')return factualEditAllowed(i)&&s==='rejected';
  if(action==='plan')return isSafety()&&s==='approved'&&!['submitted','approved'].includes(c)&&i.recordMode!=='historical_transfer';
  if(action==='action-submit')return actor.role==='field'&&i.siteId===actor.siteId&&s==='approved'&&['planned','rejected','in_progress'].includes(c);
  if(action==='action-approve'||action==='action-reject')return isSafety()&&s==='approved'&&c==='submitted';
  if(action==='correction')return isSafety()&&['approved','closed'].includes(s);
  return false;
 }
 function save(){
  try{sessionStorage.setItem(DEMO_KEY,JSON.stringify(data))}catch(e){flash='임시 저장 공간이 부족합니다. 데이터를 초기화하거나 첨부 이름을 줄여주세요.'}
 }
 function history(i,action,extra=''){i.history??=[];i.history.push({action,extra,by:actor?.name||'데모 시스템',at:iso()});}
 function notice(s){flash=s;render()}
 function mutate(i,fn,action){
  fn(i);history(i,action);save();view='detail';notice(action+' — 브라우저 임시 데이터에 반영됐어.');
 }
 function field(label,name,value='',wide=false,kind='text',placeholder='',required=false){
  const props=`name="${esc(name)}" ${required?'required':''} ${placeholder?'placeholder="'+esc(placeholder)+'"':''}`;
  let control='';
  if(kind==='textarea')control=`<textarea ${props} rows="3">${esc(value)}</textarea>`;
  else if(kind==='date')control=`<input ${props} type="date" value="${esc(value)}">`;
  else if(kind==='datetime-local')control=`<input ${props} type="datetime-local" value="${esc(value)}">`;
  else if(kind==='number')control=`<input ${props} type="number" min="0" step="1" value="${esc(value)}">`;
  else control=`<input ${props} type="text" value="${esc(value)}">`;
  return `<label class="field ${wide?'wide':''}"><span>${esc(label)}${required?' *':''}</span>${control}</label>`;
 }
 function selectField(label,name,options,current='',wide=false){
  return `<label class="field ${wide?'wide':''}"><span>${esc(label)}</span><select name="${esc(name)}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
 }
 function pill(status){return `<span class="pill ${esc(status)}">${esc(STATUS[status]||status)}</span>`}
 function kv(a,b){return `<div class="kv"><b>${esc(a)}</b><span>${esc(b??'-')}</span></div>`}
 function userOptions(){return USERS.map(u=>`<button type="button" class="role-card" data-role="${u.id}"><div><b>${ROLE[u.role]}</b><span>${esc(u.name)}<br>${esc(u.department)}</span></div><em>이 계정으로 데모 시작 →</em></button>`).join('')}
 function loginView(){
  return `<div class="login-wrap"><section class="panel">
  <div class="login-lead"><h2>제로위즈 ERP 기술검토 전용 데모</h2><p>현재 사고보고앱의 업무 단계를 가상 자료로 체험하는 환경이야. 아래 다섯 계정 중 하나를 선택하면 별도 비밀번호 없이 진입해. 모든 계정·사고·사업장은 가상이고 실제 로그인과 연결되지 않아.</p></div>
  <div class="hint warn" style="margin-bottom:16px"><strong>운영과 완전 분리</strong><br>데모 화면은 운영 Supabase · 메일 · 푸시 · 첨부 저장소로 통신하지 않아. 가상 데이터는 이 브라우저 탭의 세션에만 저장돼. 다른 PC 또는 다른 브라우저 탭과 공유되지 않아.</div>
  <div class="roles">${userOptions()}</div>
  <div class="login-foot"><span>5개 역할별 화면 · 가상 사고 및 결재이력 · 데모 초기화 기능 제공</span><a href="stable412.html">실제 운영 앱 로그인으로 돌아가기</a></div>
  </section></div>`;
 }
 function stat(n,name,tip=''){return `<div class="stat"><span>${esc(name)}</span><b>${n}</b><small>${esc(tip)}</small></div>`}
 function dashboard(){
  const all=visibleIncidents(),pending=all.filter(i=>['reported','supplement','supplement_submitted'].includes(i.status)),approved=all.filter(i=>i.status==='approved'),closed=all.filter(i=>i.status==='closed');
  const recent=all.slice(0,7);
  return `<div class="page-head"><div><h2>${ROLE[actor.role]} 업무 현황</h2><p>${actor.role==='safety'?'전체 가상 사업장 · 사고등록부터 종결까지 검토':'조회 가능한 가상 사고와 진행 상태를 확인해.'}</p></div>${can('new')?'<button class="primary" data-nav="new">+ 사고등록</button>':''}</div>
  <div class="stats">${stat(all.length,'조회 가능 사고','가상 이력')}${stat(pending.length,'보고·보완 진행','검토 및 보완')}${stat(approved.length,'사고보고 승인','후속조치 진행')}${stat(closed.length,'사고 종결','결재 이력 보존')}</div>
  <div class="grid"><section class="panel col-7"><h3>최근 사고 현황</h3><div class="stack">${recent.map(i=>`<button class="inc-card" data-open="${esc(i.id)}"><span><strong>${esc(i.summary)}</strong><small>${esc(i.id)} · ${esc(site(i.siteId))} · ${esc(time(i.occurredAt))}</small></span>${pill(i.status)}</button>`).join('')||'<p>조회 가능한 사고가 없어.</p>'}</div><div class="actions"><button data-nav="incidents">전체 사고조회 →</button></div></section>
  <section class="panel col-5"><h3>검토 시나리오</h3><div class="stack">
  <div class="hint"><strong>1. 현장 보고</strong><br>현장소장 또는 근무자가 즉시보고 등록</div>
  <div class="hint"><strong>2. 안전관리자 검토</strong><br>원인분석 · 미확정 표시 · 보완 · 사고 승인</div>
  <div class="hint"><strong>3. 후속조치</strong><br>재발방지계획 → 현장 조치증빙 제출</div>
  <div class="hint"><strong>4. 종결 · 사후정정</strong><br>안전관리자 종결 및 변경이력 보존</div>
  </div><div class="actions"><button data-nav="tech">ERP 연계 데이터 설명 →</button></div></section></div>`;
 }
 function listView(){
  const arr=visibleIncidents().filter(i=>(filterStatus==='all'||i.status===filterStatus)&&(!filterQuery||(`${i.summary} ${i.id} ${site(i.siteId)}`).toLowerCase().includes(filterQuery.toLowerCase())));
  return `<div class="page-head"><div><h2>사고보고 전체이력</h2><p>현재 선택한 역할의 조회권한만 적용돼. 인적사항 및 승인 전 의료정보는 본사·경영진 화면에서 제한해.</p></div>${can('new')?'<button class="primary" data-nav="new">+ 사고등록</button>':''}</div>
  <section class="panel"><div class="filters"><label class="field"><span>사고 검색</span><input id="filterQuery" placeholder="사고번호 · 장소 · 사고 요약" value="${esc(filterQuery)}"></label>${selectField('진행상태','filterStatus',[['all','모든 진행상태'],...Object.entries(STATUS)],filterStatus)}</div>
  <div class="stack">${arr.map(i=>`<button data-open="${esc(i.id)}" class="inc-card"><span><strong>${esc(i.summary)}</strong><small>${esc(site(i.siteId))} · ${esc(i.id)} · ${esc(time(i.occurredAt))} · ${esc(CATEGORY[i.category])}</small></span>${pill(i.status)}</button>`).join('')||'<p class="hint">이 조건에 해당하는 가상 사고가 없어.</p>'}</div></section>`;
 }
 function actionBtns(i){
  const btn=(name,label,kind='')=>`<button type="button" class="${kind}" data-action="${name}">${label}</button>`;
  const a=[];
  if(can('cause',i))a.push(btn('cause','사고원인 분석'));
  if(can('supplement-request',i))a.push(btn('supplement-request','보완요청','warn'));
  if(can('approve',i))a.push(btn('approve','사고보고 최종승인','positive'));
  if(can('report-reject',i))a.push(btn('report-reject','반려','negative'));
  if(can('supplement-submit',i))a.push(btn('supplement-submit','보완내용 작성'));
  if(can('resubmit',i))a.push(btn('resubmit','사고내용 보완 후 재제출'));
  if(can('plan',i))a.push(btn('plan','재발방지계획 수립'));
  if(can('action-submit',i))a.push(btn('action-submit','현장 조치결과 제출'));
  if(can('action-approve',i))a.push(btn('action-approve','후속조치 최종 승인','positive'));
  if(can('action-reject',i))a.push(btn('action-reject','조치 보완요청','warn'));
  if(can('correction',i))a.push(btn('correction','승인 후 사고정보·원인분석 정정'));
  return a.join('');
 }
 function incidentView(){
  const i=record(currentId);if(!i)return `<section class="panel">권한이 없거나 찾을 수 없는 사고야.<div class="actions"><button data-nav="incidents">사고현황으로</button></div></section>`;
  const d=i.reportDetails||{},reader=['manager','executive'].includes(actor.role),person=i.category==='person',c=i.corrective||null;
  const medical=person&&reader?'※ 본사·경영진 조회권한에 따라 상세 의료·개인정보 제한':(d.injuryDetail||'-');
  const analysis=d.causeAnalysisStatus||'not_reviewed';
  return `<div class="page-head"><div><h2>${esc(i.summary)}</h2><p>${esc(i.id)} · ${esc(site(i.siteId))} · ${esc(time(i.occurredAt))}</p></div><button data-nav="incidents">← 목록으로</button></div>
  <div class="panel" style="margin-bottom:14px"><div class="row"><div class="actions" style="margin-top:0">${pill(i.status)}<span class="pill ${esc(analysis)}">${esc(CAUSE[analysis]||CAUSE.not_reviewed)}</span><span class="pill">${esc(CATEGORY[i.category])}</span></div><small>가상 사고 / 운영 데이터 아님</small></div>
  <div class="actions">${actionBtns(i)||'<span class="hint">현재 역할 또는 사고 단계에서 수행할 수 있는 조치가 없어.</span>'}</div>
  ${can('approve',i)&&analysis==='not_reviewed'?'<div class="hint warn" style="margin-top:12px">안전관리자가 사고원인 분석을 입력하거나 조사 중·미확정을 선택한 뒤 승인할 수 있어.</div>':''}</div>
  <div class="grid">
  <section class="panel col-6"><h3>사고보고 원본</h3>${kv('발생 일시',time(i.occurredAt))}${kv('사업장',site(i.siteId))}${kv('사고유형',i.eventType)}${kv('보고자',reader?'현장 담당자 (세부정보 제한)':i.reporterName)}${kv('발생 장소',d.place)}${kv('사고 당시 작업',d.workAction)}${kv('사고경위',d.incidentHow)}${kv('즉시조치',i.immediateAction)}${kv(person?'부상내용':'파손내용',person?medical:d.damageDetail)}${kv('신고 당시 비용',d.repairCost==null?'사후 확인 예정':Number(d.repairCost).toLocaleString('ko-KR')+'원')}</section>
  <section class="panel col-6"><h3>안전관리자 사고원인 분석</h3>${kv('원인분석 상태',CAUSE[analysis]||CAUSE.not_reviewed)}${kv('환경적 요인',d.environmentCause||'-')}${kv('행동적 요인',d.behaviorCause||'-')}${kv('기타·종합 원인',d.causeAnalysisNote||'-')}${kv('분석 담당',d.causeAnalyzedBy||'-')}${kv('분석 변경시각',time(d.causeAnalyzedAt))}<div class="hint" style="margin-top:12px">원인분석과 최초 신고내용은 별도로 관리돼. 추정 사실은 미확정으로 표기할 수 있어.</div></section>
  <section class="panel col-6"><h3>사고보고 결재·후속조치</h3>${kv('최초 승인자',i.approvedBy||'미승인')}${kv('최초 승인일',time(i.approvedAt))}${kv('종결일',time(i.closedAt))}${kv('보완요청',i.supplement?.requestNote||'-')}${kv('보완 답변',i.supplement?.submittedNote||'-')}${kv('재발방지 원인',c?.rootCause||'-')}${kv('재발방지 계획',c?.planDetail||'-')}${kv('조치 상태',c?.status||'미수립')}${kv('현장 조치',c?.actionDetail||'-')}${kv('증빙 자료명',c?.afterPhotos?.map(a=>a.name).join(' · ')||'-')}${kv('개정번호',i.officialRecord?.revisionNumber||0)}<p class="hint warn">데모 첨부는 파일명 또는 가상 증빙표시만 남아. 원본 업로드·푸시·메일은 발생하지 않아.</p></section>
  <section class="panel col-6"><h3>단계별 처리·정정이력</h3><div class="timeline">${(i.history||[]).slice().reverse().map(h=>`<div class="event"><strong>${esc(h.action)}</strong><span>${esc(h.extra||h.by||'')}</span><small>${esc(time(h.at))} · ${esc(h.by)}</small></div>`).join('')}</div>${(i.revisions||[]).length?`<h4 style="margin-top:20px">승인 후 변경 이력</h4><div class="stack">${i.revisions.slice().reverse().map(r=>`<details><summary>개정 ${r.revision} · ${esc(r.reason)} · ${esc(r.by)}</summary><div class="timeline">${r.changes.map(c=>`<div class="event"><strong>${esc(c.field)}</strong><small>수정 전: ${esc(c.before??'미입력')}</small><small>수정 후: ${esc(c.after??'미입력')}</small></div>`).join('')}</div></details>`).join('')}</div>`:''}</section>
  </div>`;
 }
 function siteOptions(current){
  return SITES.map(s=>[s.id,s.name]).filter(x=>!actor?.siteId||actor.siteId===x[0]);
 }
 function editorView(){
  const i=record(currentId),d=i?.reportDetails||{},c=i?.corrective||{},mode=editor;
  const approveCause=mode==='cause'||mode==='correction';
  const title={cause:'안전관리자 사고원인 분석',correction:'승인 후 정정 및 개정이력',supplement_request:'보완요청',supplement_submit:'보완자료 제출',resubmit:'사고 보완 후 재제출',plan:'재발방지계획 수립',action_submit:'현장 조치결과 제출',report_reject:'사고보고 반려',action_reject:'현장 조치 보완요청'}[mode]||'사고 수정';
  if(!i)return '<section class="panel">사고기록 조회 권한이 없어.</section>';
  let body='';
  if(approveCause){
   body=`${mode==='correction'?field('사고 요약','summary',i.summary,true):''}
    <div class="hint wide">사고의 책임이나 원인을 추측해서 단정하지 말아줘. 조사 중이라면 ‘조사 중·미확정’을 선택해. 검증한 원인만 입력하도록 설계했어.</div>
    ${field('환경적 요인','environmentCause',d.environmentCause,true,'textarea','확인된 작업환경 및 시설물 관련 요인')}
    ${field('행동적 요인','behaviorCause',d.behaviorCause,true,'textarea','확인된 작업방법 관련 요인')}
    ${field('기타·종합 원인','causeAnalysisNote',d.causeAnalysisNote,true,'textarea','원인분석 근거, 추가 확인사항')}
    <label class="check wide"><input type="checkbox" name="pending" ${d.causeAnalysisStatus==='investigating'?'checked':''}><span>조사 중 · 사고원인 미확정<small style="display:block;font-weight:400">체크하면 원인을 확정하지 않고 계속 조사 중인 상태로 기록돼.</small></span></label>`;
   if(mode==='correction')body+=field('수정 사유','reason','',true,'textarea','예: 현장 재조사 결과 확보에 따라 원인 수정',true);
  }else if(mode==='supplement_request'||mode==='report_reject'||mode==='action_reject'){
   body=field('요청·반려 사유','reason','',true,'textarea','추가 확인이 필요한 항목을 구체적으로 작성해 주세요.',true);
  }else if(mode==='supplement_submit'){
   body=field('보완내용','note',i.supplement?.submittedNote||'',true,'textarea','확인된 진료결과·사고경위·견적 등을 입력',true);
   body+=field('확정 비용(선택)','repairCost',d.repairCost??'',true,'number');
  }else if(mode==='resubmit'){
   body=field('사고 요약','summary',i.summary,true,'textarea','',true)+field('사고 경위','incidentHow',d.incidentHow||'',true,'textarea','',true)+field('즉시 조치','immediateAction',i.immediateAction||'',true,'textarea');
  }else if(mode==='plan'){
   body=field('재발방지 원인','rootCause',c.rootCause||'',true,'textarea','조사 중이면 추정이라고 명시',true)+field('재발방지계획','planDetail',c.planDetail||'',true,'textarea','',true)+field('조치 담당자','ownerName',c.ownerName||'데모 현장소장',false,'text','',true)+field('목표일','dueDate',c.dueDate||'2026-10-25',false,'date','',true);
  }else if(mode==='action_submit'){
   body=field('현장 조치결과','actionDetail',c.actionDetail||'',true,'textarea','',true)+field('조치 시행일','actionDate',c.actionDate||new Date().toISOString().slice(0,10),false,'date','',true)+field('조치 담당자','actionOwner',c.actionOwner||actor.name,false,'text','',true)+`<label class="check wide"><input type="checkbox" name="evidence" required><span>가상 조치사진·PDF 증빙을 제출한 것으로 시뮬레이션합니다.<small style="display:block;font-weight:400">실제 파일은 열거나 업로드하지 않아.</small></span></label>`;
  }
  return `<div class="page-head"><div><h2>${esc(title)}</h2><p>${esc(i.id)} · ${esc(site(i.siteId))}</p></div><button data-nav="detail">← 사고기록으로</button></div>
   <section class="panel"><form id="demoForm" data-form="${esc(mode)}"><div class="form-grid">${body}</div><div class="actions"><button class="primary" type="submit">${mode==='correction'?'사유와 변경 이력 저장':'브라우저 임시 자료에 저장'}</button><button type="button" data-nav="detail">취소</button></div></form><p style="font-size:12px;color:#748a9a">운영서버 전송·실제 알림·실제 결재는 발생하지 않아.</p></section>`;
 }
 function newReport(){
  if(!can('new'))return '<section class="panel">사고 등록 권한이 없어.</section>';
  const sc=SITES.find(s=>s.id===actor.siteId);
  return `<div class="page-head"><div><h2>현장 즉시보고 등록</h2><p>사고 원인은 입력하지 않아. 안전관리자가 승인 전 별도 분석하도록 구성했어.</p></div><button data-nav="dashboard">← 홈</button></div>
  <section class="panel"><form id="demoForm" data-form="new"><div class="form-grid">
    ${field('사업장','siteLabel',sc?.name||'',true)}
    ${selectField('사고 구분','category',[['property','대물사고'],['person','대인사고']],'property')}
    ${field('발생 일시','occurredAt',dateForInput(),false,'datetime-local','',true)}
    ${field('사고 유형','eventType','접촉',false,'text','예: 접촉 · 베임/찔림 · 넘어짐',true)}
    ${field('사고 장소','place','',true,'text','예: 4홀 진입로',true)}
    ${field('사고 당시 작업','workAction','',true,'textarea','',true)}
    ${field('사고 경위','incidentHow','',true,'textarea','발생 경위를 사실에 근거해 작성',true)}
    ${field('즉시 조치','immediateAction','',true,'textarea','응급조치·작업중지·현장통제',true)}
    ${field('피해 상황','damageDetail','',true,'textarea','인적 부상 또는 시설물 피해',true)}
    ${field('사고 요약','summary','',true,'textarea','간략한 사고 요약',true)}
    <div class="hint wide">환경적 요인·행동적 요인 입력은 현장에서는 제공하지 않아. 사고접수 후 안전관리자 검토 단계에서만 분석할 수 있어.</div>
    </div><div class="actions"><button class="primary" type="submit">가상 사고보고 제출</button><button data-nav="dashboard" type="button">취소</button></div></form></section>`;
 }
 function techView(){
  const payload={
   environment:'ZERO-WIZ-ISOLATED-DEMO',
   incidentId:'DEMO-001',siteId:'d-golf1',category:'property',status:'reported',
   occurredAt:'2026-10-13T01:10:00Z',reporterRole:'field',
   reportDetails:{place:'솔빛CC 4홀 진입로',incidentHow:'가상 사고경위',causeAnalysisStatus:'not_reviewed',environmentCause:'',behaviorCause:''},
   corrective:{status:'planned',planDetail:'가상 계획',dueDate:'2026-10-25'},officialRecord:{revisionNumber:0}
  };
  return `<div class="page-head"><div><h2>ERP 연계 기술검토 참고</h2><p>업무 흐름과 필드 구조를 제로위즈 기술검토에 활용할 수 있어. 실제 서버 API와는 연결되지 않아.</p></div><button data-export>가상 데이터 JSON 내려받기</button></div>
   <div class="grid"><section class="panel col-6"><h3>권한별 검토 범위</h3>${USERS.map(u=>kv(ROLE[u.role],`${u.role==='safety'?'사고승인·원인분석·재발방지계획·종결·정정':u.role==='field'?'동일 현장 사고접수·보완·조치결과 제출':u.role==='worker'?'본인 신고 및 보완':u.role==='manager'?'본사 사고현황·기록 조회':'경영진 사고현황·통계 조회'}`)).join('')}</section>
   <section class="panel col-6"><h3>ERP 연계 분석 체크포인트</h3><div class="stack"><div class="hint">① 사고번호 · 발생일시 · 현장 · 사고유형 · 재해구분</div><div class="hint">② 안전관리자 사고원인 분석 상태와 승인자·승인시각</div><div class="hint">③ 재발방지계획 · 조치증빙 · 종결상태</div><div class="hint">④ 승인 후 정정 사유와 불변 원본/개정이력</div><div class="hint warn">가상 JSON은 참고 구조이며 ERP 연동용 실제 API 명세 확정본이 아니야.</div></div></section>
   <section class="panel col-12"><h3>가상 사고 데이터 구조 예시</h3><pre>${esc(JSON.stringify(payload,null,2))}</pre></section></div>`;
 }
 function render(){
  const body=!actor?loginView():view==='dashboard'?dashboard():view==='incidents'?listView():view==='detail'?incidentView():view==='editor'?editorView():view==='new'?newReport():techView();
  root.innerHTML=`<div class="demo-banner"><strong>DEMO / 제로위즈 기술검토</strong>가상 데이터 전용 · 운영 사고보고앱 및 외부 서버와 연결 없음</div><div class="shell">
    <header class="top"><div class="brand"><div class="brand-mark">E&L</div><div><h1>이앤엘 사고보고 · 데모</h1><p>ZERO-WIZ ERP 기술검토 전용 / 브라우저 임시 저장</p></div></div>
    <div class="tools">${actor?`<div class="actor-pill"><b>${esc(actor.name)}</b>${esc(actor.department)}</div><button type="button" data-logout>다른 계정</button><button type="button" class="negative" data-reset>데모 초기화</button>`:'<a href="stable412.html" class="buttonlike">운영 앱 로그인</a>'}</div></header>
    ${actor?`<nav aria-label="데모 메뉴">${[['dashboard','업무 홈'],['incidents','사고조회'],...(can('new')?[['new','사고등록']]:[]),['tech','ERP 기술검토']].map(([v,l])=>`<button type="button" data-nav="${v}" class="${v===view||((view==='detail'||view==='editor')&&v==='incidents')?'active':''}">${l}</button>`).join('')}</nav>`:''}
    ${flash?`<div class="notice" role="status">${esc(flash)}</div>`:''}
    <main id="demoMain">${body}</main>
    <footer class="demo-foot"><span>운영 계정·서버·알림과 분리된 기능 시연 · 현재 브라우저 탭에만 임시 저장</span><span>임시 공유용 DEMO — 다른 기기와 동기화되지 않음</span></footer>
   </div>`;
 }
 function beginEditor(mode,id){
  const i=record(id),permitted={
   cause:'cause',correction:'correction',
   supplement_request:'supplement-request',supplement_submit:'supplement-submit',
   resubmit:'resubmit',plan:'plan',action_submit:'action-submit',
   report_reject:'report-reject',action_reject:'action-reject'
  }[mode];
  if(!i||!can(permitted,i))return notice('현재 역할 또는 사고 단계에서는 이 기능을 사용할 수 없어.');
  editor=mode;currentId=id;flash='';view='editor';render();
 }
 function setActor(id){
  const chosen=USERS.find(u=>u.id===id);if(!chosen)return;
  actor=chosen;try{sessionStorage.setItem(ACTOR_KEY,actor.id)}catch(e){}
  view='dashboard';currentId='';filterQuery='';filterStatus='all';flash='계정을 전환했어. 변경된 가상 자료는 이 탭 안에서 공유돼.';render();
 }
 function performAction(action){
  const i=record(currentId);if(!i)return notice('가상 사고기록을 찾을 수 없어.');
  if(!can(action,i))return notice('해당 계정에 수행 권한이 없는 작업이야.');
  if(action==='approve'){
   const d=i.reportDetails||{};
   if(!['analyzed','investigating'].includes(d.causeAnalysisStatus)||(d.causeAnalysisStatus==='analyzed'&&!d.environmentCause&&!d.behaviorCause&&!d.causeAnalysisNote))
    return notice('승인 불가: 안전관리자 사고원인 분석을 저장하거나 조사 중·미확정으로 체크해 줘.');
   return mutate(i,x=>{x.status='approved';x.approvedBy=actor.name;x.approvedAt=iso();x.rejectionNote=''},'사고보고 최종승인');
  }
  if(action==='action-approve'){
   return mutate(i,x=>{x.corrective.status='approved';x.corrective.reviewedBy=actor.name;x.corrective.reviewedAt=iso();x.status='closed';x.closedAt=iso()},'재발방지조치 최종승인 · 사고 종결');
  }
  const forms={
   cause:'cause',correction:'correction','supplement-request':'supplement_request',
   'report-reject':'report_reject','supplement-submit':'supplement_submit',
   resubmit:'resubmit',plan:'plan','action-submit':'action_submit','action-reject':'action_reject'
  };
  if(forms[action])return beginEditor(forms[action],i.id);
 }
 function diffChange(a,b,name){const old=clean(a),next=clean(b);return old===next?null:{field:name,before:old,after:next}}
 function postForm(form){
  const mode=form.dataset.form,fd=new FormData(form),v=k=>clean(fd.get(k)),i=record(currentId);
  function need(action){if(!can(action,i))throw Error('이 계정에 현재 업무 조치 권한이 없어.')}
  const actions={cause:'cause',correction:'correction',supplement_request:'supplement-request',supplement_submit:'supplement-submit',resubmit:'resubmit',plan:'plan',action_submit:'action-submit',report_reject:'report-reject',action_reject:'action-reject'};
  if(mode==='new'){
   if(!can('new'))throw Error('사고등록 권한이 없어.');
   if(!v('summary')||!v('eventType')||!v('incidentHow')||!v('place'))throw Error('필수 사고경위·장소·요약을 입력해 줘.');
   const happened=new Date(v('occurredAt'));if(!Number.isFinite(happened.getTime()))throw Error('발생일시를 확인해 줘.');
   const id=uniq();const item={
    id,siteId:actor.siteId,reporterId:actor.id,reporterName:actor.name,category:v('category')==='person'?'person':'property',eventType:v('eventType'),
    summary:v('summary'),occurredAt:happened.toISOString(),status:'reported',priority:'normal',immediateAction:v('immediateAction'),
    reportDetails:{place:v('place'),workAction:v('workAction'),incidentHow:v('incidentHow'),damageDetail:v('damageDetail'),
     environmentCause:'',behaviorCause:'',causeAnalysisNote:'',causeAnalysisStatus:'not_reviewed',repairCost:null},
    photos:[],corrective:null,supplement:null,approvedBy:'',approvedAt:null,closedAt:null,recordMode:'ordinary',
    officialRecord:{revisionNumber:0},revisions:[],history:[],createdAt:iso()
   };
   history(item,'현장 사고보고 등록');data.incidents.unshift(item);save();currentId=id;view='detail';return notice('가상 사고가 접수됐어. 안전관리자 계정에서 검토할 수 있어.');
  }
  need(actions[mode]);
  if(mode==='cause'||mode==='correction'){
   const d=i.reportDetails||{},before=safeCopy(d),pending=fd.get('pending')!==null;
   const vals={environmentCause:v('environmentCause'),behaviorCause:v('behaviorCause'),causeAnalysisNote:v('causeAnalysisNote'),causeAnalysisStatus:pending?'investigating':'analyzed'};
   if(!pending&&!vals.environmentCause&&!vals.behaviorCause&&!vals.causeAnalysisNote)throw Error('확인된 원인을 입력하거나 조사 중·미확정을 선택해 줘.');
   const changes=Object.keys(vals).map(k=>diffChange(before[k],vals[k],`reportDetails.${k}`)).filter(Boolean);
   if(mode==='correction'){
    changes.unshift(diffChange(i.summary,v('summary'),'summary'));if(!changes.some(Boolean))throw Error('정정할 내용이 없어.');
    if(v('reason').length<2)throw Error('정정 사유를 2자 이상 입력해 줘.');
    const rev=Number(i.officialRecord.revisionNumber||0)+1;
    i.revisions.push({revision:rev,reason:v('reason'),by:actor.name,at:iso(),changes:changes.filter(Boolean)});
    i.officialRecord.revisionNumber=rev;
    if(i.corrective)i.officialRecord.actionRecheckRequired=true;
    i.summary=v('summary');
   }
   Object.assign(i.reportDetails,vals,{causeAnalyzedBy:actor.name,causeAnalyzedAt:iso()});
   history(i,mode==='correction'?'승인 후 원인·사고정보 정정':'안전관리자 사고원인 분석 저장',mode==='correction'?v('reason'):CAUSE[vals.causeAnalysisStatus]);
  }else if(mode==='supplement_request'){
   if(!v('reason'))throw Error('보완요청 사유를 작성해 줘.');
   i.status='supplement';i.supplement={requestNote:v('reason'),requestedBy:actor.name,requestedAt:iso()};history(i,'사고보고 보완요청',v('reason'));
  }else if(mode==='report_reject'){
   if(!v('reason'))throw Error('반려사유를 작성해 줘.');
   i.status='rejected';i.rejectionNote=v('reason');history(i,'사고보고 반려',v('reason'));
  }else if(mode==='supplement_submit'){
   if(!v('note'))throw Error('보완 내용을 입력해 줘.');
   i.supplement={...i.supplement,submittedNote:v('note'),submittedBy:actor.name,submittedAt:iso()};
   if(v('repairCost')!=='')i.reportDetails.repairCost=Math.max(0,Number(v('repairCost')))||0;
   i.status='supplement_submitted';history(i,'현장 보완자료 제출',v('note'));
  }else if(mode==='resubmit'){
   if(!v('summary')||!v('incidentHow'))throw Error('보완한 사고내용을 입력해 줘.');
   i.summary=v('summary');i.reportDetails.incidentHow=v('incidentHow');i.immediateAction=v('immediateAction');
   i.status='reported';history(i,'반려사고 수정 후 재제출');
  }else if(mode==='plan'){
   if(!v('rootCause')||!v('planDetail')||!v('ownerName')||!v('dueDate'))throw Error('재발방지계획의 필수 항목을 입력해 줘.');
   i.corrective={...(i.corrective||{}),status:'planned',rootCause:v('rootCause'),planDetail:v('planDetail'),ownerName:v('ownerName'),dueDate:v('dueDate'),planBy:actor.name,planAt:iso()};
   history(i,'재발방지계획 수립');
  }else if(mode==='action_submit'){
   if(!v('actionDetail')||!v('actionDate')||!v('actionOwner')||fd.get('evidence')===null)throw Error('조치결과·조치일자·담당자·가상 증빙확인을 입력해 줘.');
   Object.assign(i.corrective,{status:'submitted',actionDetail:v('actionDetail'),actionDate:v('actionDate'),actionOwner:v('actionOwner'),afterPhotos:[{name:'가상_현장조치_증빙.jpg',demo:true}],submittedBy:actor.name,submittedAt:iso()});
   history(i,'현장 재발방지조치 및 증빙 제출');
  }else if(mode==='action_reject'){
   if(!v('reason'))throw Error('조치 보완 사유를 작성해 줘.');
   i.corrective.status='rejected';i.corrective.reviewNote=v('reason');history(i,'안전관리자 조치 보완요청',v('reason'));
  }
  save();view='detail';notice('가상 업무 처리를 저장했어. 역할을 전환해서 다음 단계를 확인할 수 있어.');
 }
 function exportData(){
  if(!actor)return;
  const arr=visibleIncidents().map(i=>{
   const r=safeCopy(i);
   if(['manager','executive'].includes(actor.role)&&r.category==='person'){
    r.reporterName='비공개';r.reportDetails.injuryDetail='상세 비공개';
   }
   return r;
  });
  const blob=new Blob([JSON.stringify({system:'제로위즈 사고보고 기술검토 가상 데이터',exportedAt:iso(),role:actor.role,incidents:arr},null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='ZEROWIZ_DEMO_SAMPLE_DATA.json';anchor.hidden=true;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
  notice('가상 데이터 JSON을 내려받았어. 이 파일에는 실제 운영 사고정보가 없어.');
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest?.('button,[data-role],[data-export]');
  if(!target||!root.contains(target))return;
  if(target.dataset.role){setActor(target.dataset.role);return}
  if(target.hasAttribute('data-logout')){actor=null;try{sessionStorage.removeItem(ACTOR_KEY)}catch(e){}flash='';view='dashboard';render();return}
  if(target.hasAttribute('data-reset')){
   if(!confirm('현재 탭의 가상 사고·정정 내용을 초기화할까? 운영자료에는 영향이 없어.'))return;
   data=initialData();save();currentId='';view='dashboard';notice('데모 가상자료를 초기 상태로 되돌렸어.');return;
  }
  if(target.dataset.nav){view=target.dataset.nav;flash='';render();return}
  if(target.dataset.open){currentId=target.dataset.open;view='detail';flash='';render();return}
  if(target.dataset.action){performAction(target.dataset.action);return}
  if(target.hasAttribute('data-export'))exportData();
 });
 document.addEventListener('submit',event=>{
  if(event.target.id!=='demoForm'||!root.contains(event.target))return;
  event.preventDefault();
  try{postForm(event.target)}catch(err){flash='처리하지 못했어: '+(err?.message||String(err));render()}
 });
 document.addEventListener('change',event=>{
  if(!root.contains(event.target))return;
  if(event.target.name==='filterStatus'){filterStatus=event.target.value;render()}
 });
 document.addEventListener('keydown',event=>{
  if(event.target.id==='filterQuery'&&event.key==='Enter'){event.preventDefault();filterQuery=event.target.value.trim();render()}
 });
 try{save()}catch(e){}
 window.ENL_ZEROWIZ_DEMO={version:'1.0.0',getState:()=>safeCopy(data),getActor:()=>actor?.role||null,storageMode:'session-only'};
 render();
})();
