/* 이앤엘 과거사고 일괄분석: 안전관리자 한정 검토/이관 화면. */
(function(){
'use strict';
const PROD='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-historical-bulk-v454';
const STAGE='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-historical-bulk-v454';
const CLIENT='incident-report-v2';
const core=window.ENLHistoricalBulk,extract=window.ENLHistoricalBulkExtract454;
const clean=v=>String(v==null?'':v).trim();
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user=()=>{try{const u=currentUser?.();return u&&String(u.role)==='safety'?u:null}catch(_){return null}};
const endpoint=()=>window.ENL_HIST_BULK_API||((location.hostname==='enlsafety.github.io')?PROD:STAGE);
let open=false,waiting=false,id='',state=null,sites=[],files=[],recent=[],selected='',message='',failure='';
function proof(u){
 let p=clean(u.passwordHash),s;
 try{s=typeof session!=='undefined'?session?.manager:null}catch(_){}
 if(!p&&s&&clean(s.id)===clean(u.id))p=clean(s.passwordHash);
 if(!p)try{p=clean((data?.users||[]).find(x=>clean(x.id)===clean(u.id))?.passwordHash)}catch(_){}
 return p;
}
async function call(action,extra={}){
 const u=user();if(!u)throw Error('안전관리자 계정으로 로그인해 줘.');
 const hash=proof(u);if(!hash)throw Error('인증정보가 없어. 다시 로그인해 줘.');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),30000);
 try{
  const res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},cache:'no-store',signal:ctl.signal,body:JSON.stringify({action,actor:{id:u.id||u.personnelId,name:u.name,role:'safety'},actorPasswordHash:hash,...extra})});
  const out=await res.json().catch(()=>({}));
  if(!res.ok||out.ok===false)throw Error(out.message||'요청 처리 실패 '+res.status);
  return out;
 }finally{clearTimeout(timer)}
}
function style(){
 if(document.getElementById('enlBulk454Style'))return;
 const n=document.createElement('style');n.id='enlBulk454Style';
 n.textContent=[
 '.bulk454{color:#234660;max-width:1140px;margin:auto;font:14px/1.5 Arial,"Malgun Gothic",sans-serif;}',
 '.bulk454 *{box-sizing:border-box}.bulk454 .panel454{padding:16px;margin:12px 0;background:#fff;border:1px solid #cedfea;border-radius:14px;}',
 '.bulk454 h2{font-size:24px;margin:0 0 7px}.bulk454 h3{font-size:17px;margin:0 0 9px}.bulk454 p,.bulk454 small{color:#5d7586;line-height:1.55;}',
 '.bulk454 button,.bulk454 select,.bulk454 textarea,.bulk454 input{font:inherit}.bulk454 button{cursor:pointer;border:1px solid #a9c5d8;background:#f5faff;border-radius:9px;padding:9px 13px;min-height:43px;color:#205576;font-weight:800}',
 '.bulk454 button.main454{color:#fff;background:#1c608f;border-color:#1c608f}.bulk454 button:disabled{opacity:.53;cursor:not-allowed}',
 '.bulk454 select,.bulk454 input,.bulk454 textarea{border:1px solid #b7cbd9;border-radius:8px;padding:9px;width:100%;min-height:40px;background:#fff;color:#26465e}',
 '.bulk454 textarea{min-height:78px;resize:vertical}.bulk454 label{display:grid;gap:5px;font-size:12px;font-weight:800}',
 '.bulk454 .row454{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:9px 0}.bulk454 .check454{display:flex;align-items:flex-start;gap:9px;font-weight:700}',
 '.bulk454 .check454 input{width:18px;height:18px;min-height:18px;flex-shrink:0;margin:2px 0}',
 '.bulk454 .drop454{padding:24px;text-align:center;background:#f4faff;border:2px dashed #82b1d0;border-radius:12px;cursor:pointer}',
 '.bulk454 .drop454.over{background:#dceffc}.bulk454 .drop454 strong{display:block;font-size:16px}.bulk454 .pill454{display:inline-block;background:#edf5fa;border-radius:20px;padding:5px 10px;margin:4px;font-size:12px}',
 '.bulk454 .notice454{padding:10px;margin:10px 0;background:#ecf7ee;border:1px solid #c5dcca;border-radius:9px;color:#286c45;white-space:pre-wrap}',
 '.bulk454 .error454{padding:10px;margin:10px 0;background:#fff4eb;border:1px solid #e7bf96;border-radius:9px;color:#874616;white-space:pre-wrap}',
 '.bulk454 .count454{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.bulk454 .count454>div{background:#f1f6fa;padding:12px;border-radius:9px}',
 '.bulk454 .count454 b{display:block;font-size:25px}.bulk454 .count454 span{font-size:12px;color:#698092}',
 '.bulk454 .grid454{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
 '.bulk454 .scroll454{overflow-x:auto}.bulk454 table{border-collapse:collapse;width:100%;font-size:12px}.bulk454 th,.bulk454 td{border-bottom:1px solid #e0e9ef;padding:9px 7px;text-align:left}',
 '.bulk454 th{background:#f1f6fa;white-space:nowrap}.bulk454 .issue454{margin:6px 0;padding:9px 11px;border-left:3px solid #d79649;background:#fff8f0;font-size:12px}',
 '.bulk454 .evidence454{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;padding:10px;background:#f7fafc;border:1px solid #d8e5ed;border-radius:10px}',
 '.bulk454 .top454{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}',
 '@media(max-width:680px){.bulk454 .grid454,.bulk454 .count454{grid-template-columns:1fr}.bulk454 .panel454{padding:12px}.bulk454 table{min-width:620px}}'
 ].join('');
 document.head.appendChild(n);
}
const root=()=>document.getElementById('view');
const cands=()=>Array.isArray(state?.candidates)?state.candidates:[];
const issues=c=>(c.validation||core.validate(c,sites));
function counts(){return {success:cands().filter(c=>c.state==='success').length,review:cands().filter(c=>c.state==='review').length,failed:cands().filter(c=>c.state==='failed').length+(state?.file_errors||[]).length}}
function banner(){return (failure?'<div class="error454" role="alert">'+esc(failure)+'</div>':'')+(message?'<div class="notice454" role="status">'+esc(message)+'</div>':'')}
function shell(inner){return '<section class="bulk454"><div class="row454"><button data-b-back>← 사고 종류 선택</button><span class="pill454">안전관리자 전용</span><span class="pill454">ERP 연결 없음</span></div>'+banner()+inner+'</section>'}
function header(){return '<div class="panel454"><h2>과거사고 자동분석 · 일괄이관</h2><p>파일을 한꺼번에 올려 사고별 필수항목을 추출하고 대인·대물을 분류해. 누락·충돌·OCR 결과는 안전관리자가 반드시 원본과 대조한 뒤 등록할 수 있어.</p><small>ERP에서 이미 최초 사고보고 결재가 끝난 사고만 대상이야. 이관 즉시 종결하지 않고 재발방지계획부터 일반 사고처리 절차를 적용해.</small></div>'}
function summary(){
 const n=counts();
 return '<div class="count454"><div><span>등록 성공</span><b>'+n.success+'</b></div><div><span>검토 필요</span><b>'+n.review+'</b></div><div><span>실패</span><b>'+n.failed+'</b></div></div>';
}
function listMarkup(){
 const opts=recent.map(x=>'<option value="'+esc(x.id)+'">'+esc(String(x.created_at||'').slice(0,16).replace('T',' '))+' ('+(x.candidates||[]).length+'건)</option>').join('');
 let output=header()+'<div class="panel454"><h3>1. 작업 배치</h3><label class="check454"><input id="b-confirm" type="checkbox">ERP 최초 보고 결재 완료 여부를 확인할 과거사고 자료임을 확인함</label><div class="row454"><button class="main454" data-b-new>새 분석 시작</button><select id="b-history" style="max-width:340px"><option value="">이전 작업 선택</option>'+opts+'</select><button data-b-history>작업 불러오기</button></div><small>파일당 최대 12MB, 배치당 50개·100MB. 원본은 비공개 저장소에 보관돼.</small>';
 if(id)output+='<p>배치 ID: <code>'+esc(id)+'</code></p>';
 output+='</div>';
 if(id){
  output+='<div class="panel454"><h3>2. 자료 업로드</h3><div class="drop454" id="b-drop" tabindex="0" role="button"><strong>파일을 여기에 끌어놓거나 클릭해서 선택</strong><small>PDF · Excel(XLSX/XLS/CSV) · DOCX · HWPX · 사진(JPG/PNG/WEBP)</small><p>문서 추출·OCR은 브라우저에서 처리되며 텍스트·원본이 비공개 서버로 전송돼.</p></div><input hidden id="b-files" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.hwpx,.jpg,.jpeg,.png,.webp"><div>';
  output+=files.map(f=>'<span class="pill454">'+esc(f.name)+' ('+Math.ceil((f.size||0)/1024)+' KB)</span>').join('');
  output+='</div><div class="row454"><button class="main454" data-b-analyze '+(!files.length?'disabled':'')+'>사고별 자동분석</button></div></div>';
  output+='<div class="panel454"><h3>3. 분석·검토 결과</h3>'+summary();
  output+=(state?.file_errors||[]).map(x=>'<div class="issue454">'+esc(x.name)+' : '+esc(x.message)+'</div>').join('');
  output+='<div class="scroll454"><table><thead><tr><th>사고 요약</th><th>분류</th><th>처리상태</th><th>검토사항</th><th>작업</th></tr></thead><tbody>';
  output+=cands().map(c=>'<tr><td>'+esc(c.values?.title||c.values?.eventType||'미분류 사고')+'<br><small>'+esc(c.values?.occurredDate||'일자 미확인')+' / '+esc(c.values?.siteName||'사업장 미확인')+'</small></td><td>'+esc(c.values?.category==='person'?'대인':c.values?.category==='property'?'대물':'미확정')+'</td><td>'+esc(c.state==='success'?'등록완료':c.state==='failed'?'실패':'검토대기')+'</td><td>'+issues(c).length+'건</td><td><button data-b-edit="'+esc(c.id)+'">'+(c.state==='success'?'등록결과':'원문 검토·수정')+'</button></td></tr>').join('');
  if(!cands().length)output+='<tr><td colspan="5">자료를 업로드하고 자동분석을 실행해 줘.</td></tr>';
  output+='</tbody></table></div><div class="row454"><button data-b-export>결과 CSV 내려받기</button><button class="main454" data-b-commit-ready>검토완료 건 일괄등록</button></div></div>';
 }
 return shell(output);
}
function detailMarkup(c){
 const val=c.values||{},labels=core.labels||{},all=core.fields||{};
 const top='<div class="panel454"><h2>사고 1건 검토</h2><p>원본자료를 열어 발생일·분류·내용·ERP 최초결재 근거를 확인해. 변경사유와 검토자 기록은 보존돼.</p>';
 const fs=files.filter(f=>(c.sources||[]).includes(f.file_id)).map(f=>'<button data-b-original="'+esc(f.file_id)+'">'+esc(f.name)+' · 원본 보기</button>').join('');
 const input=(key)=>{
  const v=esc(val[key]||''),name=esc(labels[key]||key);
  if(key==='category')return '<label>대인·대물<select data-b-field="category"><option value="">선택</option><option value="person" '+(val[key]==='person'?'selected':'')+'>대인</option><option value="property" '+(val[key]==='property'?'selected':'')+'>대물</option></select></label>';
  if(key==='severity')return '<label>사고 정도<select data-b-field="severity"><option value="">선택</option><option value="minor" '+(val[key]==='minor'?'selected':'')+'>경미</option><option value="moderate" '+(val[key]==='moderate'?'selected':'')+'>보통</option><option value="major" '+(val[key]==='major'?'selected':'')+'>중대</option></select></label>';
  if(['incidentHow','injuryDetail','damageDetail','workAction','immediateAction','cause'].includes(key))return '<label>'+name+'<textarea rows="3" data-b-field="'+esc(key)+'">'+v+'</textarea></label>';
  return '<label>'+name+'<input type="text" data-b-field="'+esc(key)+'" value="'+v+'"></label>';
 };
 const options=sites.map(s=>'<option value="'+esc(s.site_id||s.id)+'" '+(val.siteId===(s.site_id||s.id)?'selected':'')+'>'+esc(s.site_name||s.name)+'</option>').join('');
 const issueList=issues(c).map(x=>'<div class="issue454">'+esc(x.message)+'</div>').join('')||'<div class="notice454">기본 필수항목 충족. 원본 대조 후 등록해 줘.</div>';
 let result=top+'<div class="row454">'+fs+'</div><h3>확인·보완 '+issues(c).length+'건</h3>'+issueList;
 result+='<div class="grid454"><label>사업장<select data-b-field="siteId"><option value="">선택</option>'+options+'</select></label>';
 result+=Object.keys(all).map(input).join('')+'</div>';
 const ev=Object.entries(c.evidence||{}).flatMap(([key,arr])=>(arr||[]).slice(0,4).map(e=>'<div><b>'+esc(labels[key]||key)+' · '+esc(e.location)+'</b><div>'+esc(e.quote)+'</div></div>')).join('<hr>');
 result+='<div class="panel454"><h3>원본 추출 근거</h3><div class="evidence454">'+(ev||'자동 근거를 찾지 못했어. 직접 원본을 대조해 줘.')+'</div></div>';
 if(c.state==='success')result+='<div class="notice454">등록완료 · 사고 ID '+esc(c.incidentId||'')+'</div>';
 else result+='<label>확인·수정 사유 (필수)<textarea id="b-reason" placeholder="원본 ERP 결재자료와 사고 경위서를 대조함"></textarea></label><label class="check454"><input id="b-resolve" type="checkbox">OCR·충돌·불명확 항목을 원본과 직접 대조했어.</label><div class="row454"><button data-b-save>검토 내용 저장</button><button class="main454" data-b-commit>이 사고 등록</button></div>';
 return shell('<button data-b-list>← 결과 목록</button>'+result+'</div>');
}
function bind(){
 const container=root();if(!container)return;
 container.querySelector('[data-b-back]')?.addEventListener('click',()=>{open=false;selected='';currentView='report';renderShell(user())});
 container.querySelector('[data-b-list]')?.addEventListener('click',()=>{selected='';render()});
 container.querySelector('[data-b-new]')?.addEventListener('click',()=>run(async()=>{
  if(!root().querySelector('#b-confirm')?.checked)throw Error('ERP 기결재 자료라는 사실을 확인해야 해.');
  id=crypto.randomUUID();await call('create',{batchId:id,erpConfirmed:true});await getBatch();message='배치를 만들었어. 파일을 올려줘.';
 }));
 container.querySelector('[data-b-history]')?.addEventListener('click',()=>run(async()=>{const val=clean(root().querySelector('#b-history')?.value);if(!val)throw Error('이전 작업을 선택해 줘.');id=val;await getBatch()}));
 container.querySelector('[data-b-analyze]')?.addEventListener('click',()=>run(async()=>{await call('analyze',{batchId:id});await getBatch();message='사고별 자동분석 완료. 각 사고를 검토해 줘.'}));
 container.querySelector('[data-b-export]')?.addEventListener('click',exportCsv);
 container.querySelector('[data-b-commit-ready]')?.addEventListener('click',()=>run(bulkCommit));
 container.querySelectorAll('[data-b-edit]').forEach(b=>b.onclick=()=>{selected=b.dataset.bEdit;render()});
 container.querySelectorAll('[data-b-original]').forEach(b=>b.onclick=async()=>{
  const popup=window.open('','_blank');try{const out=await call('sign',{batchId:id,candidateId:selected,fileId:b.dataset.bOriginal});if(popup)popup.location=out.url;else window.open(out.url,'_blank','noopener')}catch(e){popup?.close();failure=e.message;render()}
 });
 container.querySelector('[data-b-save]')?.addEventListener('click',()=>{const change=collect();run(async()=>{const updated=await save(change);message='검토 내용 저장 완료.';selected=updated.id})});
 container.querySelector('[data-b-commit]')?.addEventListener('click',()=>{const change=collect();run(async()=>{
  if(!confirm('ERP 최초결재 근거와 원문을 대조했어? 기존 사고는 덮어쓰지 않아.'))return;
  const updated=await save(change);
  if(updated.validation?.length)throw Error('필수 검토 '+updated.validation.length+'건이 남아 있어.');
  const out=await call('commit',{batchId:id,candidateId:updated.id,revision:updated.revision,finalConfirmed:true});
  await getBatch();selected=out.candidate?.state==='success'?'':updated.id;
  message=out.candidate?.state==='success'?'사고 등록 완료. 재발방지계획 메뉴에서 확인해 줘.':'중복 또는 추가 검토로 등록 보류됨';
 })});
 const drop=container.querySelector('#b-drop'),file=container.querySelector('#b-files');
 if(drop&&file){
  drop.onclick=()=>file.click();
  drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click()}};
  file.onchange=e=>{const list=[...e.target.files];file.value='';run(()=>upload(list))};
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};
  drop.ondragleave=e=>{e.preventDefault();drop.classList.remove('over')};
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');run(()=>upload([...e.dataTransfer.files]))};
 }
 if(waiting)container.querySelectorAll('button:not([data-b-back])').forEach(x=>x.disabled=true);
}
function render(){
 if(!open||!root())return;
 style();const c=selected?cands().find(x=>x.id===selected):null;
 root().innerHTML=c?detailMarkup(c):listMarkup();
 bind();
}
async function run(work){
 if(waiting)return;waiting=true;failure='';message='';render();
 try{await work()}catch(e){failure=e?.message||String(e)}
 finally{waiting=false;render()}
}
async function getBatch(){const out=await call('get',{batchId:id});state=out.batch;files=out.files||[]}
async function load(){await run(async()=>{const out=await call('list');recent=out.batches||[];if(id)await getBatch()})}
async function upload(list){
 if(!id)throw Error('분석 배치를 먼저 만들어 줘.');
 if(!list.length)return;
 for(const file of list){
  try{
   message='원본 추출 중: '+file.name;render();
   const extracted=await extract.read(file,v=>{message=file.name+' · '+v;render()});
   await call('upload',{batchId:id,file:extracted});
  }catch(e){failure+=(failure?'\n':'')+file.name+' : '+(e.message||e);try{await call('file_error',{batchId:id,name:file.name,message:e.message||String(e)})}catch(_){}}
 }
 await getBatch();if(!failure)message='파일 저장 완료. “사고별 자동분석”을 눌러 줘.';
}
function collect(){
 const node=root(),values={};node.querySelectorAll('[data-b-field]').forEach(x=>values[x.dataset.bField]=clean(x.value));
 return {reason:clean(node.querySelector('#b-reason')?.value),resolveIssues:!!node.querySelector('#b-resolve')?.checked,values};
}
async function save(x){
 if(!x.reason)throw Error('수정·확인 근거를 작성해 줘.');
 const c=cands().find(x=>x.id===selected);if(!c)throw Error('사고를 찾지 못했어.');
 const out=await call('save',{batchId:id,candidateId:c.id,revision:c.revision,values:x.values,reason:x.reason,resolveIssues:x.resolveIssues});
 await getBatch();return out.candidate;
}
async function bulkCommit(){
 const ready=cands().filter(c=>c.state==='review'&&c.corrections?.length&&!issues(c).length);
 if(!ready.length)throw Error('원본 검토·저장을 완료한 사고가 없어.');
 if(!confirm('원본·ERP 결재근거를 확인한 '+ready.length+'건을 일괄등록할까?'))return;
 let ok=0,blocked=0;for(const c of ready){
  try{const out=await call('commit',{batchId:id,candidateId:c.id,revision:c.revision,finalConfirmed:true});if(out.candidate?.state==='success')ok++;else blocked++}catch(_){blocked++}
 }
 await getBatch();message='등록 완료 '+ok+'건, 추가검토 '+blocked+'건';
}
function exportCsv(){
 if(!state)return;const head=['사고번호','사업장','발생일','사고유형','대인대물','상태','검토사유','등록ID'];
 const rows=[head,...cands().map(c=>[c.values?.recordNo,c.values?.siteName,c.values?.occurredDate,c.values?.eventType,c.values?.category,c.state,issues(c).map(i=>i.message).join('; '),c.incidentId])];
 const value='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([value],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');
 a.href=url;a.download='과거사고_검토결과_'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function start(u=user()){
 if(!u||String(u.role)!=='safety')return alert('안전관리자 계정에서만 사용할 수 있어.');
 if(!core||!extract)return alert('일괄분석 모듈이 준비되지 않았어. 새로고침해 줘.');
 open=true;selected='';message='';failure='';currentView='report';renderShell(u);load();
}
function addCard(node,u){
 if(!node||u?.role!=='safety')return;
 const grid=node.querySelector('.report-type-grid');if(!grid||grid.querySelector('[data-bulk-v454]'))return;
 const el=document.createElement('button');el.type='button';el.dataset.bulkV454='1';
 el.className='report-type-card hist449-card';
 el.innerHTML='<span class="report-type-no">04</span><strong>과거사고 자동이관</strong><small>파일 일괄분석 · 누락 검토 · 안전관리자 승인 후 등록</small>';
 grid.appendChild(el);el.onclick=()=>start(u);
}
const old=window.renderUnifiedReport;
if(typeof old==='function'){
 const wrapper=function(node,u){if(open&&u?.role==='safety')return render();const result=old.apply(this,arguments);setTimeout(()=>addCard(node,u),0);return result};
 window.renderUnifiedReport=wrapper;try{renderUnifiedReport=wrapper}catch(_){}
}
window.enlStartHistoricalBulk454=start;
window.ENL_HIST_BULK_VERSION='4.5.4';
})();