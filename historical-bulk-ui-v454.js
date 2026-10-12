/* Private historical import workspace. Every mutation is authorized and audited by the server. */
(function(){
'use strict';
const PROD='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/enl-historical-bulk-v454';
const STAGE='https://zgwxzfvvpqgdedyobwmg.supabase.co/functions/v1/enl-historical-bulk-v454';
const CLIENT='incident-report-v2',core=window.ENLHistoricalBulk,extract=window.ENLHistoricalBulkExtract454;
const clean=v=>String(v==null?'':v).trim(),esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user=()=>{try{const u=currentUser?.();return u&&String(u.role)==='safety'?u:null}catch(_){return null}};
const endpoint=()=>window.ENL_HIST_BULK_API||((location.hostname==='enlsafety.github.io')?PROD:STAGE);
const names={ready:'등록 준비',review:'검토 필요',failed:'등록 실패',excluded:'제외',success:'등록 성공',voided:'무효'};
const supplementFields=new Set(['medicalCost','repairCost','damageAmount','cost','diagnosis','followupNote','injuryDetail','damageDetail','doctorOpinion','medicalCostDetail','repairCostDetail']);
const identityFields=new Set(['siteId','siteName','recordNo','erpRef','erpDate','erpStatus']);
let open=false,waiting=false,id='',state=null,sites=[],files=[],recent=[],selected='',message='',failure='',ownerId='',history=[],incidents=[];
let queue=[],uploadTarget='',stopRequested=false,activeFileController=null,progressTimer=null,task='',dirty=false,advanced=false,quickConsent=false,quickPending=[],filters={query:'',status:'',category:'',site:'',from:'',to:''};
const root=()=>document.getElementById('view'),cands=()=>Array.isArray(state?.candidates)?state.candidates:[];
const issues=c=>(c.validation||core.validate(c,sites));
const registered=c=>!!c?.incidentId||['success','voided'].includes(c?.state);
const activeValues=c=>{const p=incidents.find(x=>(x.incident_id||x.id)===c.incidentId)?.payload;return p&&core.valuesFromIncident?{...c.values,...core.valuesFromIncident(p,c.values)}:(c.values||{})};
const ready=c=>!registered(c)&&!['excluded','voided'].includes(c.state)&&issues(c).length===0;
const rememberedKey=()=> 'enl-historical-bulk-454:'+ownerId;
function remember(){try{if(id)sessionStorage.setItem(rememberedKey(),id);else sessionStorage.removeItem(rememberedKey())}catch(_){}}
function forget(){activeFileController?.abort();activeFileController=null;if(progressTimer){clearTimeout(progressTimer);progressTimer=null}id='';state=null;files=[];recent=[];selected='';incidents=[];history=[];queue=[];quickPending=[];quickConsent=false;advanced=false;dirty=false;filters={query:'',status:'',category:'',site:'',from:'',to:''}}
function proof(u){let p=clean(u.passwordHash),s;try{s=typeof session!=='undefined'?session?.manager:null}catch(_){}if(!p&&s&&clean(s.id)===clean(u.id))p=clean(s.passwordHash);if(!p)try{p=clean((data?.users||[]).find(x=>clean(x.id)===clean(u.id))?.passwordHash)}catch(_){}return p}
function errorText(e){
 const value=clean(e?.message||e),errors={auth_safety_required:'안전관리자 로그인 인증정보를 확인할 수 없어. 다시 로그인해 줘.',batch_owner_required:'다른 계정이 만든 작업은 열 수 없어. 본인 작업을 선택해 줘.',incident_revision_conflict:'사고정보가 변경됐어. 최신 내용을 불러온 뒤 다시 시도해 줘.',correction_reason_required:'확인·처리 사유를 2~500자로 입력해 줘.',candidate_identity_locked:'등록된 사업장·사고번호·ERP 결재근거는 변경할 수 없어. 잘못 이관했다면 무효처리 후 올바른 자료로 새로 등록해 줘.',candidate_workflow_locked:'후속조치나 결재가 진행돼 핵심정보 변경·무효처리가 제한돼. 비용·진단결과·후속자료만 보완해 줘.',candidate_invalid_update:'수정내용이 필수항목·원문근거·중복 검사에 맞지 않아. 수정내용을 확인해 줘.',candidate_restore_duplicate:'같은 사고가 이미 있어 복구할 수 없어. 중복 사고를 확인해 줘.',candidate_scope_mismatch:'이번 배치로 자동이관한 사고만 변경할 수 있어.',candidate_voided:'무효 상태 사고는 복구 후 수정하거나 자료를 추가해 줘.',candidate_locked:'이미 등록된 사고야. 등록 후 관리에서 수정해 줘.',candidate_excluded:'제외된 후보야. 복구 후 검토·등록해 줘.',candidate_not_registered:'등록 전 후보야. 먼저 검토·등록해 줘.',candidate_not_voided:'무효 상태가 아니야. 최신 상태를 불러와 줘.',candidate_not_excluded:'제외 상태가 아니야. 최신 상태를 불러와 줘.',reviewed_candidates_no_reset:'수정된 검토내용이 있어. 다시 분석하려면 기존 검토내용 초기화를 확인해 줘.',batch_registered_create_new:'등록된 사고가 있어 이 배치는 다시 분석할 수 없어. 추가 사고는 새 배치로 등록해 줘.',batch_limit_50_files_100mb:'배치당 50개·100MB를 넘을 수 없어. 새 배치에 나눠 올려 줘.',batch_limit_250_incidents:'한 배치에 250건을 넘을 수 없어. 사고자료를 나눠 올려 줘.',unsupported_file:'지원하지 않는 형식이야. HWP는 HWPX 또는 PDF로 변환해 줘.',file_too_large:'파일당 12MB까지 올릴 수 있어. 파일을 나누거나 압축해 줘.',invalid_file_size:'파일 크기가 올바르지 않아. 원본을 다시 선택해 줘.',invalid_extraction:'파일에서 추출한 내용이 제한을 넘었거나 올바르지 않아. 자료를 나눠 다시 올려 줘.',file_hash_mismatch:'업로드 중 파일 검증에 실패했어. 원본을 다시 선택해 줘.',source_upload_failed:'비공개 원본 저장에 실패했어. 연결을 확인하고 다시 시도해 줘.',source_sign_failed:'원본 열기 주소를 만들지 못했어. 잠시 후 다시 시도해 줘.',file_not_linked:'이 사고에 연결된 원본이 아니야.',file_not_found:'원본 파일을 찾지 못했어. 최신 상태를 불러와 줘.',final_confirmation_required:'사고 내용과 ERP 최초결재 근거의 최종 확인이 필요해.',invalid_field:'입력항목 형식이나 길이를 확인해 줘.',revision_conflict:'다른 작업에서 내용이 변경됐어. 새로고침 후 최신 내용으로 다시 시도해 줘.',incident_version_conflict:'사고의 후속정보가 변경됐어. 최신 내용을 다시 불러와 확인해 줘.',version_conflict:'사고정보가 변경됐어. 새로고침 후 다시 시도해 줘.',forbidden:'이 작업은 안전관리자만 사용할 수 있어.',unauthorized:'로그인 인증이 만료됐거나 일치하지 않아. 다시 로그인해 줘.',invalid_actor:'안전관리자 인증정보를 확인할 수 없어. 다시 로그인해 줘.',invalid_credentials:'로그인 인증정보가 일치하지 않아. 다시 로그인해 줘.',batch_not_found:'작업 배치를 찾을 수 없거나 접근 권한이 없어.',candidate_not_found:'해당 사고 후보를 찾을 수 없어. 최신 목록을 다시 불러와 줘.',batch_locked:'등록이 진행된 배치는 다시 분석할 수 없어. 새 배치에서 자료를 분석해 줘.',registered_candidate:'이미 등록된 사고야. 등록 후 수정 기능으로 보완해 줘.',workflow_locked:'후속조치나 결재가 진행 중이야. 핵심정보 변경·무효처리는 제한돼.',incident_workflow_locked:'후속조치나 결재가 진행 중이야. 핵심정보 변경·무효처리는 제한돼.',duplicate_file:'이미 저장된 같은 파일이야.',origin_not_allowed:'이 접속주소에서는 이관 서버 사용이 허용되지 않아. 운영 앱에서 다시 열어 줘.',file_limit:'배치당 최대 파일 수를 넘었어. 새 배치에 나눠 올려 줘.',batch_size_limit:'배치당 최대 용량을 넘었어. 파일을 나눠 올려 줘.',invalid_action:'현재 화면과 서버 기능 버전이 달라. 앱을 새로고침해 줘.',not_bulk_incident:'이번 배치로 자동이관한 사고만 수정·무효처리할 수 있어.',reason_required:'수정·확인 사유를 입력해 줘.',validation_failed:'필수항목 또는 원문 근거를 확인한 뒤 다시 시도해 줘.'};
 if(e?.name==='AbortError')return stopRequested?'사용자가 중단했어. 최신 저장상태 확인 후 이어할 수 있어.':'서버 응답시간을 초과했어. 저장됐을 수 있으니 최신 목록을 확인한 뒤 다시 시도해 줘.';
 if(value==='Failed to fetch'||value==='Load failed')return '서버에 연결하지 못했어. 네트워크를 확인하고 다시 시도해 줘.';
 return errors[value]||(/^[a-z][a-z0-9_]+$/.test(value)?'요청을 처리하지 못했어. 오류코드: '+value:value)||'요청 처리에 실패했어.';
}
async function call(action,extra={},opts={}){
 const u=user();if(!u||clean(u.id||u.personnelId)!==ownerId)throw Error('안전관리자 계정으로 다시 로그인해 줘.');const hash=proof(u);if(!hash)throw Error('인증정보가 없어. 다시 로그인해 줘.');
 const ctl=new AbortController(),cancel=()=>ctl.abort();
 opts.signal?.addEventListener('abort',cancel,{once:true});
 if(opts.signal?.aborted)cancel();
 const timer=setTimeout(cancel,90000);
 try{
  if(ctl.signal.aborted){const err=new Error('파일 처리 취소');err.name='AbortError';throw err}
  const res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json','X-ENL-App':CLIENT},cache:'no-store',signal:ctl.signal,body:JSON.stringify({action,actor:{id:u.id||u.personnelId,name:u.name,role:'safety'},actorPasswordHash:hash,...extra})});
  const out=await res.json().catch(()=>({}));
  if(!res.ok||out.ok===false)throw Error(out.message||out.error||'요청 처리 실패 '+res.status);
  return out;
 }finally{clearTimeout(timer);opts.signal?.removeEventListener('abort',cancel)}
}
function paintProgress(){
 if(progressTimer)return;
 progressTimer=setTimeout(()=>{progressTimer=null;if(open)render()},110);
}
function requestStop(){
 if(!waiting||stopRequested)return;
 stopRequested=true;
 if(quickPending.length)queue.push(...quickPending.splice(0).map(file=>({file,status:'pending',message:'중단됨 · 이어하기 가능'})));
 activeFileController?.abort();
 message='중단 요청됨 · 현재 파일의 판독·전송을 취소하고 저장 상태를 확인 중이야.';
 render();
}
function style(){if(document.getElementById('enlBulk454Style'))return;const n=document.createElement('style');n.id='enlBulk454Style';n.textContent=`
.bulk454{color:#234660;max-width:1140px;margin:auto;font:14px/1.5 Arial,"Malgun Gothic",sans-serif;overflow-wrap:anywhere}.bulk454 *{box-sizing:border-box;min-width:0}.bulk454 .panel454{padding:18px;margin:12px 0;background:#fff;border:1px solid #cedfea;border-radius:14px}.bulk454 h2{font-size:24px;margin:0 0 7px}.bulk454 h3{font-size:17px;margin:0 0 9px}.bulk454 p,.bulk454 small{color:#5d7586;line-height:1.55}.bulk454 button,.bulk454 select,.bulk454 textarea,.bulk454 input{font:inherit}.bulk454 button{cursor:pointer;border:1px solid #a9c5d8;background:#f5faff;border-radius:9px;padding:9px 13px;min-height:44px;color:#205576;font-weight:700;max-width:100%}.bulk454 button.main454{color:#fff;background:#1c608f;border-color:#1c608f}.bulk454 button.warn454{color:#964824;border-color:#d8ac98;background:#fff6f1}.bulk454 button:disabled{opacity:.53;cursor:not-allowed}.bulk454 button:focus-visible,.bulk454 input:focus-visible,.bulk454 select:focus-visible,.bulk454 textarea:focus-visible,.bulk454 .drop454:focus-visible{outline:3px solid #6ba9d0;outline-offset:2px}.bulk454 select,.bulk454 input,.bulk454 textarea{border:1px solid #b7cbd9;border-radius:8px;padding:9px;width:100%;min-height:44px;background:#fff;color:#26465e}.bulk454 :disabled:not(button){background:#f1f5f8;color:#6a7b87}.bulk454 textarea{min-height:78px;resize:vertical}.bulk454 label{display:grid;gap:5px;font-size:12px;font-weight:700}.bulk454 .row454{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:9px 0}.bulk454 .check454{display:flex;align-items:flex-start;gap:9px;font-weight:700}.bulk454 .check454 input{width:20px;height:20px;min-height:20px;flex-shrink:0;margin:2px 0}.bulk454 .drop454{padding:24px;text-align:center;background:#f4faff;border:2px dashed #82b1d0;border-radius:12px;cursor:pointer}.bulk454 .drop454.over{background:#dceffc}.bulk454 .drop454 strong{display:block;font-size:16px}.bulk454 .pill454{display:inline-block;background:#edf5fa;border-radius:20px;padding:5px 10px;font-size:12px}.bulk454 .notice454{padding:11px;margin:10px 0;background:#ecf7ee;border:1px solid #c5dcca;border-radius:9px;color:#286c45;white-space:pre-wrap}.bulk454 .error454{padding:11px;margin:10px 0;background:#fff4eb;border:1px solid #e7bf96;border-radius:9px;color:#874616;white-space:pre-wrap}.bulk454 .count454{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.bulk454 .count454>div{background:#f1f6fa;padding:12px;border-radius:9px}.bulk454 .count454 b{display:block;font-size:25px}.bulk454 .count454 span{font-size:12px;color:#698092}.bulk454 .grid454{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.bulk454 .filters454{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.bulk454 .record454{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(150px,1fr);gap:12px;align-items:start;padding:16px 0;border-bottom:1px solid #e0e9ef}.bulk454 .record454 h4{font-size:15px;margin:0 0 6px}.bulk454 .record454 p{font-size:12px;margin:6px 0}.bulk454 .issue454{margin:6px 0;padding:9px 11px;border-left:3px solid #d79649;background:#fff8f0;font-size:12px}.bulk454 .evidence454{font-size:12px;white-space:pre-wrap;max-height:320px;overflow:auto;padding:12px;background:#f7fafc;border:1px solid #d8e5ed;border-radius:10px}.bulk454 .history454{border-top:1px solid #d8e5ed;padding:12px 0}.bulk454 .history454 summary{cursor:pointer;font-weight:700}.bulk454 .diff454{display:grid;grid-template-columns:minmax(70px,.5fr) minmax(0,1fr) minmax(0,1fr);gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid #e5edf3}.bulk454 .progress454{width:100%;height:14px;accent-color:#1c608f}.bulk454 .queue454{padding:8px 0;border-bottom:1px solid #e2ebf1;font-size:12px}.bulk454 .top454{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.bulk454 .muted454{font-size:12px;color:#678092}.bulk454 .empty454{padding:22px 0;color:#60798b}.bulk454 [hidden]{display:none!important}.bulk454 .quick454{padding:24px}.bulk454 .quick454 h2{font-size:25px;letter-spacing:-.5px}.bulk454 .quick454 .drop454{padding:46px 16px;margin-top:18px;border-radius:16px;background:#f1f8ff}.bulk454 .quick454 .drop454 strong{font-size:21px;color:#184b78}.bulk454 .quick454 .drop454 p{margin:9px 0}.bulk454 .quick454 .count454{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:18px}.bulk454 .quick454 .count454 b{font-size:31px}.bulk454 .quick454 .quick-head454{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.bulk454 .quick454 .simple-records454>article:last-child{border-bottom:0}.bulk454 .quick454 details summary{cursor:pointer;color:#245679;font-weight:700}.bulk454 .quick454 .quick-guide454{margin:10px 0 0;font-size:13px}.bulk454 .quick454 [data-b-advanced]{background:white}@media(max-width:680px){.bulk454 .quick454{padding:14px}.bulk454 .quick454 .drop454{padding:28px 12px}.bulk454 .quick454 .drop454 strong{font-size:18px}.bulk454 .quick454 .count454>div{padding:10px}.bulk454 .quick454 .count454 b{font-size:24px}}
.bulk454 .review-field454{border:2px solid #e8a14c;border-radius:11px;background:#fff8ed;padding:10px;scroll-margin-top:25px}.bulk454 .review-field454 label{font-weight:800;color:#8b501e}.bulk454 .review-field454 input:not([type=checkbox]),.bulk454 .review-field454 select,.bulk454 .review-field454 textarea{border:2px solid #d78a2c;background:#fff}.bulk454 .review-field454:focus-within{border-color:#c87111;box-shadow:0 0 0 3px #f8d9ae}.bulk454 .review-guide454{color:#925219;font-size:12px;margin:4px 0 0;line-height:1.45}.bulk454 .review-jump454{border-left:4px solid #e59a36;background:#fff5e8;padding:9px;margin:5px 0;width:100%;text-align:left;border-radius:8px;color:#865015}.bulk454 .review-legacy454{margin:16px 0;padding:15px;border:1.5px solid #b7d2e2;border-radius:12px;background:#f6fafd}.bulk454 .review-legacy454.need454{border:2px solid #e59a36;background:#fff7eb}.bulk454 .review-legacy454 h3{margin:0 0 6px}.bulk454 .review-legacy454 .check454{margin:10px 0}.bulk454 .review-legacy454 select,.bulk454 .review-legacy454 textarea{font-size:14px}.bulk454 .review-legacy454 .legacy-warning454{color:#8d4b13;background:#fff0de;border-radius:8px;padding:10px;margin:8px 0;font-size:12px;line-height:1.5}@media(max-width:680px){.bulk454 h2{font-size:21px}.bulk454 .grid454{grid-template-columns:1fr}.bulk454 .count454{grid-template-columns:repeat(2,minmax(0,1fr))}.bulk454 .filters454{grid-template-columns:repeat(2,minmax(0,1fr))}.bulk454 .panel454{padding:13px}.bulk454 .record454{grid-template-columns:1fr;gap:3px}.bulk454 .record454 .row454{margin:5px 0}.bulk454 .drop454{padding:20px 12px}.bulk454 input,.bulk454 select,.bulk454 textarea{font-size:16px}.bulk454 .diff454{grid-template-columns:1fr}.bulk454 .row454>button{flex-grow:1}}
`;document.head.appendChild(n)}
function counts(){const a=cands();return {total:a.length,ready:a.filter(c=>ready(c)&&c.state!=='failed').length,success:a.filter(c=>c.state==='success').length,review:a.filter(c=>!registered(c)&&c.state!=='excluded'&&c.state!=='failed'&&!ready(c)).length,failed:a.filter(c=>c.state==='failed').length,excluded:a.filter(c=>['excluded','voided'].includes(c.state)).length}}
function displayState(c){return ready(c)&&c.state!=='failed'?'ready':c.state||'review'}
function category(c){const v=c.values||{},both=v.category==='mixed'||(!core.missing(v.injuryDetail)&&!core.missing(v.damageDetail)&&!['없음','해당없음'].includes(clean(v.injuryDetail).replace(/\s+/g,''))&&!['없음','해당없음'].includes(clean(v.damageDetail).replace(/\s+/g,'')));return both?'mixed':v.category}
const categoryName=k=>({person:'대인',property:'대물',mixed:'혼합 피해'})[k]||'미확정';
const candError=c=>clean(c.error?.message||c.error||c.lastError?.message||c.lastError||c.failureReason);
function banner(){return (failure?'<div class="error454" role="alert">'+esc(failure)+'</div>':'')+(message?'<div class="notice454" role="status">'+esc(message)+'</div>':'')}
function shell(inner){return '<section class="bulk454" aria-busy="'+waiting+'"><div class="row454"><button data-b-back>← 사고 종류 선택</button><span class="pill454">안전관리자 전용</span><span class="pill454">ERP 기결재·과거자료 확인불가 지원</span></div>'+banner()+inner+'</section>'}
function header(){return '<div class="panel454"><h2>과거사고 자동분석 · 일괄이관</h2><p>파일 업로드 → 사고별 자동분석 → 결과 확인 → 일괄등록 → 사후관리</p><small>ERP 기결재 사고와 ERP 도입 전·입사 전 결재자료 확인불가 사고를 구분해 등록해. 확인된 정상 건은 한 번의 최종 확인으로 등록하고, 누락·충돌·OCR 판독 건은 원본을 대조해 보완해 줘. 등록 후 재발방지계획과 후속 결재는 기존 절차를 이어가.</small></div>'}
function summary(){const n=counts(),labels={total:'전체 분석',ready:'등록 준비',success:'등록 성공',review:'검토 필요',failed:'등록 실패',excluded:'제외·무효'};return '<div class="count454">'+Object.entries(labels).map(([k,label])=>'<div data-b-count="'+k+'"><span>'+label+'</span><b>'+n[k]+'</b></div>').join('')+'</div><div class="row454">'+['person','property','mixed'].map(k=>'<span class="pill454">'+categoryName(k)+' '+cands().filter(c=>category(c)===k).length+'건</span>').join('')+'<small>분류 건수는 제외·무효를 포함한 전체 분석 기준</small></div>'}
function progressMarkup(){if(!queue.length)return '';const complete=queue.filter(x=>['saved','skipped','error'].includes(x.status)).length,labels={pending:'대기',extracting:'추출 중',uploading:'저장 중',saved:'저장 완료',skipped:'중복 건너뜀',error:'실패'};return '<div class="panel454"><div class="top454"><h3>파일 처리 '+complete+' / '+queue.length+'</h3>'+(advanced&&waiting&&task==='upload'?'<button data-b-stop '+(stopRequested?'disabled':'')+'>'+(stopRequested?'중단 처리 중…':'업로드 즉시 중단')+'</button>':'')+'</div><progress class="progress454" max="'+queue.length+'" value="'+complete+'" aria-label="파일 처리 진행률"></progress>'+queue.map(q=>'<div class="queue454"><b>'+esc(q.file.name)+'</b> · '+labels[q.status]+(q.message?' — '+esc(q.message):'')+'</div>').join('')+(!waiting&&advanced&&queue.some(x=>x.status==='pending'||x.status==='error')?'<div class="row454"><button data-b-resume>남은 파일·실패 파일 다시 처리</button></div>':'')+'</div>'}
function filterMarkup(){const option=(v,n,current)=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(n)+'</option>';return '<div class="filters454"><label>검색<input data-b-filter="query" value="'+esc(filters.query)+'" placeholder="사고명·피해자·ERP 번호"></label><label>처리상태<select data-b-filter="status">'+option('','전체 상태',filters.status)+Object.entries(names).map(([v,n])=>option(v,n,filters.status)).join('')+'</select></label><label>피해 구분<select data-b-filter="category">'+option('','전체 분류',filters.category)+['person','property','mixed'].map(k=>option(k,categoryName(k),filters.category)).join('')+'</select></label><label>사업장<select data-b-filter="site">'+option('','전체 사업장',filters.site)+sites.map(s=>option(s.site_id||s.id,s.site_name||s.name,filters.site)).join('')+'</select></label><label>발생일 시작<input type="date" data-b-filter="from" value="'+esc(filters.from)+'"></label><label>발생일 종료<input type="date" data-b-filter="to" value="'+esc(filters.to)+'"></label></div><div class="row454"><button data-b-filter-clear>필터 초기화</button></div>'}
function filtered(){const query=filters.query.toLowerCase();return cands().filter(c=>{const v=c.values||{};return (!query||Object.values(v).join(' ').toLowerCase().includes(query))&&(!filters.status||displayState(c)===filters.status)&&(!filters.category||category(c)===filters.category)&&(!filters.site||v.siteId===filters.site)&&(!filters.from||clean(v.occurredDate)>=filters.from)&&(!filters.to||clean(v.occurredDate)&&clean(v.occurredDate)<=filters.to)}).sort((a,b)=>clean(b.values?.occurredDate).localeCompare(clean(a.values?.occurredDate))||clean(a.values?.siteName).localeCompare(clean(b.values?.siteName)))}
function duplicates(c){return [...new Set(issues(c).flatMap(x=>x.incidentIds||[]).concat(c.duplicateIncidentIds||[]))]}
function recordMarkup(c){const v=c.values||{},is=issues(c),estimate=core.money(v.repairCost);return '<article class="record454"><div><h4>'+esc(v.title||v.eventType||'미분류 사고')+'</h4><div class="muted454">'+esc(v.occurredDate||'일자 미확인')+' · '+esc(v.siteName||sites.find(s=>(s.site_id||s.id)===v.siteId)?.site_name||'사업장 미확인')+'</div><p>'+esc((v.incidentHow||'사고 경위를 확인해 줘.').slice(0,150))+(Number.isFinite(estimate)?' · 수리견적 '+esc(estimate.toLocaleString('ko-KR'))+'원 (지급 미확인)':'')+'</p></div><div><div class="row454"><span class="pill454">'+esc(categoryName(category(c)))+'</span><span class="pill454">'+esc(names[displayState(c)]||c.state)+'</span></div><small>'+(!registered(c)&&is.length?'검토 '+is.length+'건 · '+esc(is[0]?.message):registered(c)?'사고 ID '+esc(c.incidentId||''):'필수항목·근거 확인 가능')+'</small>'+(candError(c)?'<div class="issue454">'+esc(errorText(candError(c)))+'</div>':'')+'</div><div class="row454"><button data-b-edit="'+esc(c.id)+'">'+(registered(c)?'등록 후 관리':'검토·수정')+'</button>'+(c.incidentId&&c.state!=='voided'?'<button data-b-detail="'+esc(c.incidentId)+'">사고 상세</button>':'')+duplicates(c).map(x=>'<button data-b-detail="'+esc(x)+'">중복 사고 보기</button>').join('')+'</div></article>'}

function safeAutoCandidate(c){
 // This is a conservative, explainable rule—not AI certainty. The server performs
 // authoritative verification, duplicate checks and an atomic INSERT at commit time.
 if(!quickConsent||core.isLegacy(c.values)||!ready(c)||c.state!=='ready'||(c.corrections||[]).length||(c.issues||[]).length||(c.resolvedCodes||[]).length)return false;
 const v=c.values||{},approved=['승인','승인완료','결재완료','approved'].includes(core.norm(v.erpStatus));
 if(!approved||(!clean(v.erpRef)&&!clean(v.erpDate))||!clean(v.siteId))return false;
 const refs=c.sources||[];
 if(!refs.length||!refs.every(fid=>files.some(f=>(f.file_id||f.hash)===fid&&f.method==='text')))return false;
 const proof=k=>(c.evidence?.[k]||[]).some(e=>e.method==='text'&&refs.includes(e.fileId)&&clean(e.quote)&&clean(e.location));
 return proof('erpStatus')&&(clean(v.erpRef)?proof('erpRef'):proof('erpDate'));
}
function quickMarkup(){
 const n=counts(),review=cands().filter(c=>!registered(c)&&!['excluded','voided'].includes(c.state)&&(!safeAutoCandidate(c)||c.state==='failed')),finished=cands().filter(registered),blocked=review.filter(c=>c.state==='failed').length+(state?.file_errors||[]).length;
 const opts=recent.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===id?'selected':'')+'>'+esc(String(x.created_at||'').slice(0,16).replace('T',' '))+' · '+(x.count||0)+'건</option>').join('');
 let out='<div class="panel454 quick454"><div class="quick-head454"><div><h2>과거사고 파일 자동이관</h2><p>파일을 넣으면 사고별 분류·중복검사·자동등록까지 진행해.</p></div><button data-b-advanced>상세 관리</button></div>'+(waiting&&['upload','analyze','commit'].includes(task)?'<div class="row454"><button class="warn454" data-b-stop '+(stopRequested?'disabled':'')+'>'+(stopRequested?'중단 처리 중…':task==='upload'?'업로드 즉시 중단':'현재 단계 후 중단')+'</button></div>':'')+(!waiting&&queue.some(x=>x.status==='pending'||x.status==='error')?'<div class="row454"><button class="main454" data-b-resume>남은 파일 이어하기</button></div>':'');
 out+='<div class="drop454" id="b-drop" tabindex="0" role="button"><strong>사고기록 파일을 전부 여기에 놓아 줘</strong><p>파일 여러 개를 한 번에 선택하거나 계속 끌어다 놓을 수 있어.</p><small>PDF · Excel · CSV · DOCX · HWPX · 사진 | 파일당 12MB, 작업당 50개·100MB</small></div><input hidden id="b-files" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.hwpx,.jpg,.jpeg,.png,.webp">';
 out+='<p class="quick-guide454">처음 업로드할 때 과거 사고기록 원본임을 확인해. <b>근거가 확실한 건만 자동등록</b>하고, OCR·누락·충돌·결재근거 미확인 건은 등록하지 않고 검토함에 보관해.</p>';
 if(id&&files.length&&!cands().length)out+='<div class="row454"><button class="main454" data-b-quick-retry>저장된 '+files.length+'개 파일 자동처리</button></div>';
 out+='<div class="count454"><div data-b-count="success"><span>등록 완료</span><b>'+n.success+'</b></div><div data-b-count="review"><span>확인할 사고</span><b>'+review.length+'</b></div><div data-b-count="failed"><span>처리 실패</span><b>'+blocked+'</b></div></div>';
 if(quickPending.length)out+='<p class="muted454" role="status">추가 파일 '+quickPending.length+'개가 현재 처리 뒤 자동으로 이어져.</p>';
 if(waiting)out+='<div class="notice454" role="status">'+esc(task==='commit'?'중복을 확인하며 안전한 사고만 등록 중이야.':'원본을 읽고 사고별로 분류하는 중이야.')+'</div>';
 out+='</div>';
 if(queue.length)out+='<details class="panel454" '+(waiting?'open':'')+'><summary>파일 처리 현황 '+queue.filter(x=>['saved','skipped','error'].includes(x.status)).length+' / '+queue.length+'</summary>'+progressMarkup()+'</details>';
 if(id){
  out+='<div class="panel454 quick454"><div class="top454"><div><h3>내가 확인할 사고 '+review.length+'건</h3><small>내용이 불명확하거나 ERP 결재 증빙이 부족한 사고만 표시돼.</small></div></div>';
  out+=(state?.file_errors||[]).map(x=>'<div class="issue454">'+esc(x.name)+' · '+esc(errorText(x.message))+'</div>').join('');
  out+='<div class="simple-records454">'+(review.length?review.map(recordMarkup).join(''):'<div class="empty454">'+(finished.length?'현재 검토할 사고가 없어.':'업로드하면 자동으로 사고를 찾고 분류할게.')+'</div>')+'</div>';
  out+='<details><summary>등록 완료·제외 사고 '+finished.length+'건 보기</summary>'+finished.map(recordMarkup).join('')+'</details>';
  out+='<div class="row454"><button data-b-export>결과 CSV 저장</button><button data-b-refresh>최신 상태</button></div></div>';
 }
 out+='<details class="panel454 quick454"><summary>이전 작업 불러오기 · 작업별 원본 확인</summary><div class="row454"><select id="b-history" aria-label="이전 작업"><option value="">작업 선택</option>'+opts+'</select><button data-b-history>불러오기</button></div>'+(id?'<small>현재 작업: '+esc(id)+' · 원본 '+files.length+'개</small><details><summary>원본파일 목록</summary>'+files.map(f=>'<div class="queue454">'+esc(f.name)+'</div>').join('')+'</details>':'<small>첫 파일 업로드 시 작업이 자동 생성돼.</small>')+'</details>';
 return shell(out);
}

function listMarkup(){if(!advanced)return quickMarkup();const opts=recent.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===id?'selected':'')+'>'+esc(String(x.created_at||'').slice(0,16).replace('T',' '))+' · '+(x.count??(x.candidates||[]).length)+'건</option>').join('');let out='<div class="row454"><button data-b-advanced>← 간편 자동이관으로 돌아가기</button></div>'+header()+'<div class="panel454"><h3>1. 작업 시작·이어하기</h3><label class="check454"><input id="b-confirm" type="checkbox">ERP 최초 보고가 기결재된 과거사고 자료임을 확인함</label><div class="row454"><button class="main454" data-b-new>새 분석 시작</button><select id="b-history" aria-label="이전 작업" style="max-width:340px"><option value="">이전 작업 선택</option>'+opts+'</select><button data-b-history>작업 불러오기</button></div><small>저장된 파일·검토내용·등록결과는 다시 이어서 처리할 수 있어. 파일당 12MB, 배치당 50개·100MB. 중단한 미저장 파일은 다시 선택해 줘.</small>'+(id?'<div class="row454"><small>현재 작업 '+esc(id)+'</small><button data-b-refresh>최신 상태 불러오기</button></div>':'')+'</div>';
 if(id){const locked=cands().some(registered);out+='<div class="panel454"><h3>2. 파일 업로드·자동분석</h3>'+(locked?'<p>이 배치는 등록된 사고가 있어 재분석을 제한해. 추가 사고자료는 새 배치로, 등록 사고의 증빙은 “등록 후 관리”에서 첨부해 줘.</p>':'<div class="drop454" id="b-drop" tabindex="0" role="button"><strong>파일을 끌어놓거나 클릭해서 선택</strong><p>PDF · Excel(XLSX/XLS/CSV) · DOCX · HWPX · 사진(JPG/PNG/WEBP)</p><small>스캔 PDF·사진은 OCR로 읽은 뒤 원본 대조가 필요해. HWP는 HWPX 또는 PDF로 변환해 줘.</small></div><input hidden id="b-files" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.hwpx,.jpg,.jpeg,.png,.webp"><div class="row454"><button class="main454" data-b-analyze '+(!files.length?'disabled':'')+'>'+(cands().length?'자료 다시 분석':'사고별 자동분석')+'</button></div>')+'<details><summary>저장된 원본 '+files.length+'개</summary>'+files.map(f=>'<div class="queue454">'+esc(f.name)+' · '+Math.ceil((f.size||0)/1024)+' KB</div>').join('')+'</details></div>'+progressMarkup();
 out+='<div class="panel454"><h3>3. 분석 결과·등록 후 관리</h3>'+summary()+(state?.file_errors||[]).map(x=>'<div class="issue454">파일 처리 실패 · '+esc(x.name)+' : '+esc(errorText(x.message))+'</div>').join('')+filterMarkup()+'<div id="b-records">'+filtered().map(recordMarkup).join('')+(!filtered().length?'<div class="empty454">'+(cands().length?'조건에 맞는 사고가 없어. 필터를 확인해 줘.':'파일을 업로드하고 자동분석을 실행해 줘.')+'</div>':'')+'</div><div class="row454"><button data-b-export>전체 결과 CSV 내려받기</button><button class="main454" data-b-commit-ready '+(!cands().some(ready)?'disabled':'')+'>등록 준비·재시도 건 일괄등록</button>'+(waiting&&task==='commit'?'<button data-b-stop>현재 사고 후 중단</button>':'')+'</div><small>정상 건만 한 번의 최종 확인으로 등록해. 검토 필요·제외·무효 건은 일괄등록하지 않아.</small></div>'}return shell(out)}
function workflowLocked(c){if(typeof c.workflowStarted==='boolean')return c.workflowStarted;const p=incidents.find(x=>(x.incident_id||x.id)===c.incidentId)?.payload;return c.workflowStarted===true||c.coreFieldsLocked===true||!!p&&(p.status==='closed'||!!p.corrective||!!p.preventionPlan||!!p.managementApproval||!!p.actionApproval||!!p.closedAt||!!p.reportWorkflow?.correctiveApproval)}
function historyMarkup(c){const rows=history.filter(x=>x.candidate_id===c.id||x.detail?.candidateId===c.id||x.detail?.candidate_id===c.id||(c.incidentId&&x.detail?.incidentId===c.incidentId));const labels={registered:'사고 등록',source_linked:'원본 연결',bulk_source_added:'후속 원본 첨부',save:'후보 검토·수정',candidate_saved:'후보 검토·수정',update_incident:'등록 사고 수정',void_incident:'사고 무효처리',restore_incident:'사고 복구',exclude:'후보 제외',restore_candidate:'후보 복구',commit:'사고 등록',upload:'증빙 첨부'};let out=rows.map(x=>{const d=x.detail||{},asValues=v=>v?.reportDetails&&core.valuesFromIncident?core.valuesFromIncident(v,c.values):v?.values||v||{},before=asValues(d.before),after=asValues(d.after);const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));const val=v=>v==null?'—':typeof v==='object'?JSON.stringify(v):String(v);return '<details class="history454"><summary>'+esc(labels[x.action]||x.action)+' · '+esc(String(x.created_at||'').replace('T',' ').slice(0,19))+'</summary><p>수정자 '+esc(x.actor_name||x.actor_id||'기록 확인 필요')+' · 사유 '+esc(d.reason||'—')+'</p>'+keys.map(k=>'<div class="diff454"><b>'+esc(core.labels?.[k]||k)+'</b><span>변경 전: '+esc(val(before[k]))+'</span><span>변경 후: '+esc(val(after[k]))+'</span></div>').join('')+'</details>'}).join('');if(!out)out=(c.corrections||[]).map(x=>'<div class="history454"><b>'+esc(core.labels?.[x.field]||x.field)+'</b><p>'+esc(x.reason||'')+' · '+esc(x.at||'')+'</p></div>').join('');return '<div class="panel454"><h3>수정·처리 이력 '+rows.length+'건</h3>'+(out||'<small>아직 기록된 변경이 없어.</small>')+'</div>'}
function legacyApprovalMarkup(c,val,issues,isRegistered){
 const mode=clean(val.legacyApprovalMode),reason=clean(val.legacyApprovalReason);
 const hasLegacyIssue=issues.some(x=>['erpStatus','erpRef','erpDate','legacyApprovalMode','legacyApprovalReason','legacyApprovalConfirmed'].includes(x.field));
 const opts=[['','ERP 결재정보 확인 가능 / 일반 입력'],['pre_erp','ERP 시스템 도입 이전 사고'],['pre_employment','입사 전 결재 완료·문서번호 조회 불가']]
  .map(([v,t])=>'<option value="'+esc(v)+'" '+(mode===v?'selected':'')+'>'+esc(t)+'</option>').join('');
 return '<section class="review-legacy454 '+(hasLegacyIssue?'need454':'')+'" id="b-legacy-section" data-b-review-field="legacyApprovalMode">'
  +'<h3>기존 ERP 결재자료 확인 상태</h3>'
  +'<p>기존 ERP 문서번호를 조회할 수 없으면 사유를 남겨 과거사고로 등록할 수 있어. 기존 결재를 확인했다고 기록하지 않으며 새 안전관리자 검토대기로 등록돼.</p>'
  +'<label>기존 결재정보 상태<select id="b-legacy-mode" aria-label="ERP 결재정보 확인 상태" '+(isRegistered?'disabled':'')+'>'+opts+'</select></label>'
  +'<div id="b-legacy-extra" '+(!mode?'hidden':'')+'>'
  +'<label>ERP 문서번호 확인불가 사유 (10~500자)<textarea id="b-legacy-reason" maxlength="500" rows="3" placeholder="예: 사고 발생 당시 ERP 도입 전이어서 문서번호가 없고, 서면 사고경위서만 보관 중임." '+(isRegistered?'disabled':'')+'>'+esc(reason)+'</textarea></label>'
  +'<label class="check454"><input id="b-legacy-confirm" type="checkbox" '+(val.legacyApprovalConfirmed==='confirmed'?'checked':'')+' '+(isRegistered?'disabled':'')+'>원본 사고기록을 확인했으며, 과거 결재 여부는 검증할 수 없음을 명확히 기록하는 데 동의함</label>'
  +'<p class="legacy-warning454">확인불가 사고는 ERP 결재완료로 표시되지 않아. 안전관리자 검토·승인 후 기존 후속조치 절차로 연결돼.</p>'
  +'</div></section>';
}
function detailMarkup(c){const val=activeValues(c),labels=core.labels||{},all=core.fields||{},isRegistered=registered(c),locked=workflowLocked(c),inactive=['voided','excluded'].includes(c.state),disabled=k=>inactive||(isRegistered&&(identityFields.has(k)||locked&&!supplementFields.has(k)));const attrs=k=>' data-b-field="'+esc(k)+'"'+(disabled(k)?' disabled':'');const input=key=>{const v=esc(val[key]??''),name=esc(key==='repairCost'?'수리견적금액 (지급 여부 미확인)':key==='incidentHow'&&c.summaryMeta?.kind==='ocr_evidence_summary'?'사고경위 · 자동요약(원본 대조 필요)':labels[key]||key);if(key==='category')return '<label>대인·대물 주 분류<select'+attrs(key)+'><option value="">선택</option>'+[['person','대인'],['property','대물'],['mixed','혼합 — 주 분류 확인 필요']].map(([k,n])=>'<option value="'+k+'" '+(val[key]===k?'selected':'')+'>'+n+'</option>').join('')+'</select></label>';if(key==='severity')return '<label>사고 정도<select'+attrs(key)+'><option value="">선택</option>'+[['minor','경미'],['moderate','보통'],['major','중대']].map(([k,n])=>'<option value="'+k+'" '+(val[key]===k?'selected':'')+'>'+n+'</option>').join('')+'</select></label>';if(['incidentHow','injuryDetail','damageDetail','workAction','immediateAction','cause','followupNote','doctorOpinion','medicalCostDetail','repairCostDetail'].includes(key))return '<label>'+name+'<textarea rows="3"'+attrs(key)+'>'+v+'</textarea></label>';return '<label>'+name+'<input type="'+(['occurredDate','erpDate'].includes(key)?'date':'text')+'"'+(/Cost$|^cost$|^damageAmount$/.test(key)?' inputmode="decimal"':'')+attrs(key)+' value="'+v+'"></label>'};
 const opts=sites.map(s=>'<option value="'+esc(s.site_id||s.id)+'" '+(val.siteId===(s.site_id||s.id)?'selected':'')+'>'+esc(s.site_name||s.name)+'</option>').join('');const sourceButtons=files.filter(f=>(c.sources||[]).includes(f.file_id)).map(f=>'<button data-b-original="'+esc(f.file_id)+'">'+esc(f.name)+' · 원본 보기</button>').join('');const is=issues(c);let out='<button data-b-list>← 결과 목록</button><div class="panel454"><h2>'+ (isRegistered?'등록 사고 관리':'사고 검토·수정')+'</h2><div class="row454"><span class="pill454">'+esc(names[displayState(c)]||c.state)+'</span>'+(c.incidentId?'<small>사고 ID '+esc(c.incidentId)+'</small>':'')+'</div><div class="row454">'+sourceButtons+duplicates(c).map(x=>'<button data-b-detail="'+esc(x)+'">기존 중복 사고 보기</button>').join('')+(c.incidentId&&c.state!=='voided'?'<button data-b-detail="'+esc(c.incidentId)+'">사고 상세·후속조치 확인</button>':'')+'</div>'+(isRegistered&&locked?'<div class="issue454">후속조치·결재가 진행된 사고야. 핵심 사고정보와 무효처리는 잠기며, 확인된 비용·진단결과·후속메모를 보완할 수 있어.</div>':'')+(c.state==='voided'?'<div class="issue454">이 사고는 무효 상태로 일반 사고목록·통계에서 제외돼. 기록·원본·변경이력은 보존되고 복구할 수 있어.</div>':'')+(c.state==='excluded'?'<div class="issue454">이 후보는 일괄등록에서 제외돼. 필요하면 복구한 뒤 검토해 줘.</div>':'');
 if(isRegistered&&!inactive)out+='<p class="muted454">등록된 사업장·사고번호·ERP 결재근거는 보존돼. 식별정보가 잘못됐다면 무효처리 후 올바른 자료로 새로 등록해 줘.</p>';

 const estimateMoney=core.money(val.repairCost);
 if(Number.isFinite(estimateMoney))out+='<div class="notice454" data-b-estimate="1"><b>견적서에서 확인된 예상 수리비 '+esc(estimateMoney.toLocaleString('ko-KR'))+'원</b> · 실제 지급 여부는 확인되지 않았어.</div>';
 if(c.summaryMeta?.kind==='ocr_evidence_summary')out+='<p class="muted454" data-b-summary-note="1">사고경위는 OCR 문구를 근거로 요약한 문장이야. 원본의 장소와 사고내용을 대조하고, 미확인 당시조치·사고정도·ERP 결재 사항은 별도로 확인해 줘.</p>';
 if(!isRegistered)out+='<h3>확인·보완 '+is.length+'건</h3>'+(is.map(x=>'<button type="button" class="review-jump454" data-b-jump="'+esc(['erpStatus','erpRef','erpDate','legacyApprovalMode','legacyApprovalReason','legacyApprovalConfirmed'].includes(x.field)?'legacyApprovalMode':x.field||(x.code==='ocr'?'incidentHow':''))+'">'+esc(x.message)+' ↗</button>').join('')||'<div class="notice454">필수항목과 근거가 충족돼. 결과를 확인하고 바로 등록할 수 있어.</div>');if(candError(c))out+='<div class="error454">'+esc(errorText(candError(c)))+'</div>';
 const allKeys=['siteId',...Object.keys(all).filter(k=>k!=='siteId'&&!['legacyApprovalMode','legacyApprovalReason','legacyApprovalConfirmed'].includes(k))];
 const buildField=k=>{
  const problem=is.filter(x=>x.field===k),ocrWarning=k==='incidentHow'&&is.some(x=>x.code==='ocr');
  const flagged=problem.length>0||ocrWarning;
  const original=k==='siteId'?'<label>사업장<select'+attrs('siteId')+'><option value="">선택</option>'+opts+'</select></label>':input(k);
  const note=problem.map(x=>x.message).slice(0,3).join(' · ')||(ocrWarning?'OCR로 자동 추출된 사고경위를 원본과 대조해 주세요.':'');
  return '<div class="'+(flagged?'review-field454':'review-wrapper454')+'" data-b-review-field="'+esc(k)+'">'+original+(flagged?'<p class="review-guide454" role="note">확인·보완 필요: '+esc(note)+'</p>':'')+'</div>';
 };
 // In the default simple mode, surface only the most useful fields and current
 // missing/conflicting fields. Advanced mode still shows the unchanged full form.
 const focus=new Set(isRegistered?['medicalCost','repairCost','damageAmount','diagnosis','followupNote']:['siteId','occurredDate','category','incidentHow','place','damagedItem','damageDetail','repairCost','followupNote']);
 if(!advanced)for(const item of is)if(item.field&&allKeys.includes(item.field))focus.add(item.field);
 const prominent=advanced?allKeys:allKeys.filter(k=>focus.has(k)),extra=advanced?[]:allKeys.filter(k=>!focus.has(k));
 out+='<div class="grid454">'+prominent.map(buildField).join('')+'</div>';
 if(extra.length)out+='<details class="panel454"><summary>그 밖의 사고정보 '+extra.length+'개 펼치기</summary><div class="grid454">'+extra.map(buildField).join('')+'</div></details>';
 out+=legacyApprovalMarkup(c,val,is,isRegistered);
 const ev=Object.entries(c.evidence||{}).flatMap(([key,arr])=>(arr||[]).map(e=>'<div><b>'+esc(labels[key]||key)+' · '+esc(e.location)+'</b><div>'+esc(e.quote)+'</div></div>')).join('<hr>');out+='<details class="panel454"><summary>원본 추출 근거 보기</summary><div class="evidence454">'+(ev||'자동 근거를 찾지 못했어. 원본을 직접 대조해 줘.')+'</div></details><label>확인·수정·처리 사유<textarea id="b-reason" placeholder="대조한 원본과 변경 이유를 기록해 줘."></textarea></label>';
 if(!isRegistered&&!inactive)out+='<label class="check454"><input id="b-resolve" type="checkbox">OCR·충돌·불명확 항목을 원본과 직접 대조했어.</label><div class="row454"><button data-b-save>검토 내용 저장</button><button class="main454" data-b-commit>이 사고 등록</button><button class="warn454" data-b-exclude>후보 제외</button></div>';
 else if(c.state==='excluded')out+='<div class="row454"><button data-b-restore-candidate>후보 복구</button></div>';
 else if(c.state==='voided')out+='<div class="row454"><button data-b-restore-incident>무효 사고 복구</button></div>';
 else out+='<div class="row454"><button class="main454" data-b-update>수정·보완 저장</button><button class="warn454" data-b-void '+(locked?'disabled':'')+'>잘못 등록한 사고 무효처리</button></div><div class="panel454"><h3>후속자료·증빙 추가</h3><p>이 사고에 연결할 원본을 선택해 줘. 첨부한 자료는 자동 재분석하지 않으며 확인된 내용은 위 항목에 보완해.</p><input id="b-attach" type="file" multiple aria-label="등록 사고 후속증빙 첨부" accept=".pdf,.xlsx,.xls,.csv,.docx,.hwpx,.jpg,.jpeg,.png,.webp"></div>';
 out+='</div>'+progressMarkup()+historyMarkup(c);return shell(out)}
function leaveDetail(){return !dirty||confirm('저장하지 않은 입력내용이 있어. 저장하지 않고 이동할까?')}
function bind(){const node=root();if(!node)return;const on=(selector,fn)=>node.querySelector(selector)?.addEventListener('click',fn);on('[data-b-advanced]',()=>{if(waiting||!leaveDetail())return;advanced=!advanced;render()});node.querySelectorAll('[data-b-jump]').forEach(b=>b.addEventListener('click',()=>{
  const key=b.dataset.bJump;
  const el=key==='legacyApprovalMode'?node.querySelector('#b-legacy-mode'):node.querySelector('[data-b-field="'+key+'"]');
  if(!el)return;
  const details=el.closest('details');if(details)details.open=true;
  el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true});
 }));
 on('[data-b-back]',()=>{if(waiting||!leaveDetail())return;open=false;selected='';dirty=false;currentView='report';renderShell(user())});on('[data-b-list]',()=>{if(waiting||!leaveDetail())return;selected='';dirty=false;render()});
 on('[data-b-quick-retry]',()=>run(async()=>{if(!id||!files.length)throw Error('저장된 파일이 없어. 먼저 파일을 올려 줘.');if(!quickConsent){if(!confirm('과거사고 원본자료를 확인했어? ERP 결재 증빙이 확실한 사고만 자동등록하고, ERP 확인불가 건은 안전관리자 검토로 남길까?'))return;quickConsent=true;}task='analyze';message='기존 저장 파일을 분석 중이야.';render();await call('analyze',{batchId:id});await getBatch();const result=await autoCommitStrict();await recentBatches();message='기존 파일 자동처리 완료 · 등록 '+result.ok+'건 · 검토 대기 '+cands().filter(c=>!registered(c)&&c.state!=='excluded').length+'건.';failure=result.failures.join('\n')}));
 on('[data-b-new]',()=>{const confirmed=!!node.querySelector('#b-confirm')?.checked;run(async()=>{if(!confirmed)throw Error('ERP 기결재 자료라는 사실을 확인해야 해.');const newId=crypto.randomUUID();await call('create',{batchId:newId,historicalConfirmed:true});id=newId;selected='';queue=[];filters={query:'',status:'',category:'',site:'',from:'',to:''};await getBatch();await recentBatches();message='배치를 만들었어. 파일을 올려 줘.'})});
 on('[data-b-history]',()=>{const next=clean(node.querySelector('#b-history')?.value);run(async()=>{if(!next)throw Error('이전 작업을 선택해 줘.');await getBatch(next);selected='';queue=[];message='저장된 작업을 불러왔어. 미저장 파일이 있으면 다시 선택해 줘.'})});on('[data-b-refresh]',()=>run(async()=>{await getBatch();message='서버의 최신 상태를 불러왔어.'}));
 on('[data-b-analyze]',()=>run(async()=>{if(cands().length&&!confirm('다시 분석하면 등록 전 후보의 검토·수정내용이 새 추출 결과로 바뀔 수 있어. 다시 분석할까?'))return;message='저장된 자료를 사고별로 분석하고 있어.';render();await call('analyze',{batchId:id,resetConfirmed:cands().length>0});await getBatch();message='분석 완료. 등록 준비 건은 목록을 확인한 뒤 한 번에 등록할 수 있어.'}));on('[data-b-export]',exportCsv);on('[data-b-commit-ready]',()=>run(bulkCommit));
 node.querySelectorAll('[data-b-edit]').forEach(b=>b.onclick=()=>{if(waiting)return;selected=b.dataset.bEdit;dirty=false;render()});node.querySelectorAll('[data-b-detail]').forEach(b=>b.onclick=()=>run(()=>openDetail(b.dataset.bDetail)));
 node.querySelectorAll('[data-b-original]').forEach(b=>b.onclick=()=>{if(waiting)return;const popup=window.open('','_blank');if(popup)popup.opener=null;run(async()=>{try{const out=await call('sign',{batchId:id,candidateId:selected,fileId:b.dataset.bOriginal});const url=new URL(out.url);if(!['https:','http:'].includes(url.protocol))throw Error('원본 주소가 올바르지 않아.');if(popup)popup.location.replace(url.href);else window.open(url.href,'_blank','noopener,noreferrer')}catch(e){popup?.close();throw e}})});
 on('[data-b-save]',()=>{const x=collect();run(async()=>{await save(x);message='검토내용을 저장하고 필수항목·근거를 다시 검사했어.'})});
 on('[data-b-commit]',()=>{const x=collect();run(async()=>{if(!confirm(x.values.legacyApprovalMode?'원본을 확인했으며 ERP 결재는 미검증인 채 안전관리자 검토대기로 등록할까?':'사고 내용과 ERP 최초결재 근거를 확인했어? 확인한 내용으로 등록할까?'))return;let c=cands().find(c=>c.id===selected);if(dirty||x.resolveIssues||x.reason)c=await save(x);if(!c||issues(c).length)throw Error('필수항목·원문 검토사항을 보완하고 저장해 줘.');const out=await call('commit',{batchId:id,candidateId:c.id,revision:c.revision,finalConfirmed:true,legacyExceptionConfirmed:!!c.values.legacyApprovalMode});await getBatch();dirty=false;if(out.candidate?.state==='success')try{await window.enlIncidentPullNow?.()}catch(_){}message=out.candidate?.state==='success'?'사고를 등록했어. 등록 후 관리와 기존 재발방지 절차를 이어갈 수 있어.':'중복 또는 추가 검토사항으로 등록이 보류됐어.'})});
 on('[data-b-update]',()=>{const x=collect();run(()=>mutate('update_incident',x,'수정·보완 내용을 저장하고 변경이력을 기록했어.'))});
 [['[data-b-exclude]','exclude','이 후보를 등록 대상에서 제외할까? 필요하면 복구할 수 있어.','후보를 제외했어.'],['[data-b-restore-candidate]','restore_candidate','후보를 복구하고 다시 검증할까?','후보를 복구했어. 검토 후 등록해 줘.'],['[data-b-void]','void_incident','잘못 등록한 사고를 무효처리할까? 일반 목록·통계에서 제외되며 원본과 이력은 보존돼.','사고를 무효처리했어. 원본·변경이력은 보존돼.'],['[data-b-restore-incident]','restore_incident','사고를 복구해 일반 목록·통계에 다시 반영할까?','사고를 복구했어.']].forEach(([selector,action,question,notice])=>on(selector,()=>{const x=collect();run(async()=>{if(!x.reason)throw Error('처리 사유를 입력해 줘.');if(!confirm(question))return;await mutate(action,x,notice)})}));
 node.querySelectorAll('[data-b-stop]').forEach(button=>button.addEventListener('click',requestStop));
 on('[data-b-resume]',()=>{
  stopRequested=false;
  run(async()=>{
   await upload([],uploadTarget,true,!advanced&&!uploadTarget);
   if(stopRequested||advanced||uploadTarget||!files.length)return;
   if(cands().some(c=>registered(c)||c.state==='excluded'||(c.corrections||[]).length))return;
   task='analyze';message='중단한 파일의 처리를 마쳤어. 사고 자동분석 중이야.';render();
   await call('analyze',{batchId:id,resetConfirmed:cands().length>0});await getBatch();
   const result=await autoCommitStrict();
   message='이어하기 완료 · 등록 '+result.ok+'건 · 검토 필요 '+cands().filter(c=>!registered(c)&&c.state!=='excluded').length+'건.';
   failure=result.failures.join('\n');
  });
 });
 const drop=node.querySelector('#b-drop'),file=node.querySelector('#b-files');if(drop&&file){drop.onclick=()=>file.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click()}};file.onchange=e=>{const list=[...e.target.files];file.value='';if(advanced){stopRequested=false;run(()=>upload(list))}else queueQuickFiles(list)};drop.ondragover=e=>{e.preventDefault();if(!waiting)drop.classList.add('over')};drop.ondragleave=e=>{e.preventDefault();drop.classList.remove('over')};drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');if(advanced){if(!waiting){stopRequested=false;run(()=>upload([...e.dataTransfer.files]))}}else queueQuickFiles([...e.dataTransfer.files])}}
 const legacyChoice=node.querySelector('#b-legacy-mode');
 if(legacyChoice){
  const applyLegacy=()=>{
   const chosen=!!legacyChoice.value,details=node.querySelector('#b-legacy-extra');
   if(details)details.hidden=!chosen;
   for(const field of ['erpRef','erpDate','erpStatus']){
    const el=node.querySelector('[data-b-field="'+field+'"]');
    if(!el||el.dataset.legacyLocked==='1')continue;
    if(chosen){
     if(el.dataset.oldErpValue===undefined)el.dataset.oldErpValue=el.value;
     el.value='';el.disabled=true;
    }else{
     if(el.dataset.oldErpValue!==undefined){el.value=el.dataset.oldErpValue;delete el.dataset.oldErpValue;}
     el.disabled=false;
    }
   }
  };
  legacyChoice.onchange=()=>{applyLegacy();dirty=true;};
  if(legacyChoice.value)applyLegacy();
 }
 const legacyReason=node.querySelector('#b-legacy-reason'),legacyConfirm=node.querySelector('#b-legacy-confirm');
 if(legacyReason)legacyReason.addEventListener('input',()=>dirty=true);
 if(legacyConfirm)legacyConfirm.addEventListener('change',()=>dirty=true);
 const siteSelect=node.querySelector('[data-b-field="siteId"]');if(siteSelect)siteSelect.onchange=()=>{const site=sites.find(s=>(s.site_id||s.id)===siteSelect.value),name=node.querySelector('[data-b-field="siteName"]');if(name)name.value=site?.site_name||site?.name||'';dirty=true};
 const attach=node.querySelector('#b-attach');if(attach)attach.onchange=e=>{const list=[...e.target.files],target=selected;attach.value='';if(!leaveDetail())return;dirty=false;stopRequested=false;run(()=>upload(list,target))};
 node.querySelectorAll('[data-b-field],#b-reason,#b-resolve').forEach(el=>el.addEventListener('input',()=>dirty=true));node.querySelectorAll('[data-b-filter]').forEach(el=>el.onchange=()=>{filters[el.dataset.bFilter]=el.value;render()});on('[data-b-filter-clear]',()=>{filters={query:'',status:'',category:'',site:'',from:'',to:''};render()});
 if(waiting)node.querySelectorAll('button:not([data-b-stop]),input:not(#b-files),select,textarea').forEach(x=>x.disabled=true);
}
function render(){if(!open||!root())return;if(!user()||clean(user().id||user().personnelId)!==ownerId){open=false;forget();return}style();const c=selected?cands().find(x=>x.id===selected):null;root().innerHTML=c?detailMarkup(c):listMarkup();bind()}
async function run(work){if(waiting)return;waiting=true;failure='';message='';const snapshot=selected?collect():null;render();try{await work()}catch(e){failure=errorText(e)}finally{const wasLoading=task==='load';waiting=false;task='';render();if(wasLoading&&quickPending.length&&!advanced)queueQuickFiles([]);if(snapshot&&dirty&&snapshot.candidateId===selected){root()?.querySelectorAll('[data-b-field]').forEach(el=>{if(Object.prototype.hasOwnProperty.call(snapshot.values,el.dataset.bField))el.value=snapshot.values[el.dataset.bField]});const reason=root()?.querySelector('#b-reason');if(reason)reason.value=snapshot.reason;const resolve=root()?.querySelector('#b-resolve');if(resolve)resolve.checked=snapshot.resolveIssues;const mode=root()?.querySelector('#b-legacy-mode'),note=root()?.querySelector('#b-legacy-reason'),ack=root()?.querySelector('#b-legacy-confirm'),details=root()?.querySelector('#b-legacy-extra');if(mode)mode.value=snapshot.values.legacyApprovalMode||'';if(note)note.value=snapshot.values.legacyApprovalReason||'';if(ack)ack.checked=snapshot.values.legacyApprovalConfirmed==='confirmed';if(details)details.hidden=!snapshot.values.legacyApprovalMode}}}
async function getBatch(next=id){const out=await call('get',{batchId:next});id=next;state=out.batch;files=out.files||[];history=out.history||[];incidents=out.incidents||[];const summary=recent.find(x=>x.id===id);if(summary)summary.count=cands().length;remember()}
async function recentBatches(){const out=await call('list');recent=out.batches||[]}
async function load(){await run(async()=>{task='load';const opts=await call('options');sites=opts.sites||[];await recentBatches();if(id){try{await getBatch()}catch(e){id='';remember();throw e}}})}

async function prepareQuickBatch(){
 if(!quickConsent){
  if(!confirm('이 파일들이 과거 사고기록 자료임을 확인해. ERP 결재가 확인된 정상 사고만 자동등록하고, ERP 자료 확인불가 건은 별도 사유를 입력해 수동 검토하도록 할까?'))return false;
  quickConsent=true;
 }
 // Never overwrite reviewed work or reanalyze a batch that already registered
 // incidents. Subsequent file drops start another safe, resumable batch.
 const stale=cands().some(c=>registered(c)||c.state==='excluded'||(c.corrections||[]).length);
 if(!id||stale||files.length>=50){
  const newId=crypto.randomUUID();
  await call('create',{batchId:newId,historicalConfirmed:true});
  id=newId;selected='';queue=[];filters={query:'',status:'',category:'',site:'',from:'',to:''};
  await getBatch();await recentBatches();
 }
 return true;
}
async function autoCommitStrict(){
 const selectedReady=cands().filter(safeAutoCandidate);
 let ok=0,reviewed=0,failed=0;const failures=[];
 task='commit';
 for(const item of selectedReady){
  if(stopRequested)break;
  message='ERP 기결재 근거를 확인한 정상 사고를 자동등록 중이야. '+(ok+reviewed+failed+1)+' / '+selectedReady.length;render();
  try{
   const c=cands().find(x=>x.id===item.id);
   if(!c||!safeAutoCandidate(c))continue;
   const out=await call('commit',{batchId:id,candidateId:c.id,revision:c.revision,finalConfirmed:true});
   if(out.candidate?.state==='success')ok++;else reviewed++;
  }catch(e){failed++;failures.push((item.values?.recordNo||item.id)+' : '+errorText(e))}
  await getBatch();
 }
 if(ok)try{await window.enlIncidentPullNow?.()}catch(_){}
 return {ok,reviewed,failed,failures};
}
function queueQuickFiles(next){
 const fresh=[...next].filter(f=>f&&f.size>0);if(!fresh.length&&!quickPending.length)return;
 quickPending.push(...fresh);
 if(!waiting)stopRequested=false;
  if(waiting){message='추가 파일 '+quickPending.length+'개가 대기 중이야.';render();return}
 run(async()=>{
  let allRegistered=0,allFailed=0,allUploads=0;const errors=[];
  // Extra drops received during extraction join the same analysis.
  // Drops received after a committed batch begin a fresh batch automatically.
  while(quickPending.length){
   if(!await prepareQuickBatch()){quickPending=[];message='ERP 기결재 확인 후 다시 파일을 올려 줘.';return}
   do{
    while(quickPending.length&&!stopRequested){
     const nextBatch=quickPending.splice(0);
     await upload(nextBatch,'',false,true);
     allUploads+=queue.filter(x=>x.status==='saved').length;
     if(queue.some(x=>x.status==='error')){allFailed+=queue.filter(x=>x.status==='error').length;errors.push(...queue.filter(x=>x.status==='error').map(x=>x.file.name+' : '+x.message))}
    }
    if(stopRequested)break;
    if(!files.length)break;
    task='analyze';message='사고별 자동분류·원본 연결·중복검사를 진행 중이야.';render();
    await call('analyze',{batchId:id,resetConfirmed:cands().length>0});
    await getBatch();
   }while(quickPending.length&&!stopRequested);
   if(stopRequested)break;
   if(quickPending.length)continue;
   const result=await autoCommitStrict();
   allRegistered+=result.ok;allFailed+=result.failed;errors.push(...result.failures);
   if(quickPending.length)continue;
   break;
  }
  await recentBatches();
  const pending=cands().filter(c=>!registered(c)&&c.state!=='excluded').length;
  message=(stopRequested?'중단됨 · ':'')+'파일 저장 '+allUploads+'개 · 자동등록 '+allRegistered+'건 · 확인 필요 '+pending+'건'+(allFailed?' · 실패 '+allFailed+'건':'')+'.';
  failure=errors.join('\n');
 });
}

async function upload(list,candidateId='',resume=false,deferAnalysis=false){
 if(!id)throw Error('분석 배치를 먼저 만들어 줘.');
 if(!resume&&!list.length)return;
 if(!resume){queue=list.map(file=>({file,status:'pending',message:''}));uploadTarget=candidateId}
 task='upload';
 for(const item of queue){
  if(stopRequested)break;
  if(!['pending','error'].includes(item.status))continue;
  const ctl=new AbortController();activeFileController=ctl;
  try{
   item.status='extracting';item.message='파일 중복 확인 중';message='원본을 확인하는 중이야. 중단하면 현재 판독·전송도 취소돼.';render();
   // Hash first: do not spend many minutes OCR-ing an already stored photo/PDF.
   const digest=await extract.fingerprint(item.file,ctl.signal);
   if(ctl.signal.aborted||stopRequested){item.status='pending';break;}
   const existing=files.find(f=>(f.file_id||f.hash)===digest.hash),target=cands().find(c=>c.id===candidateId);
   if(existing&&(!candidateId||(target?.sources||[]).includes(existing.file_id))){
    item.status='skipped';item.message='같은 원본이 이미 저장돼 있어.';render();continue;
   }
   item.message='원문 추출 중';render();
   const extracted=await extract.read(item.file,v=>{item.message=v;paintProgress()},{signal:ctl.signal});
   if(ctl.signal.aborted||stopRequested){item.status='pending';break;}
   item.status='uploading';item.message='서버로 전송 중';render();
   await call('upload',{batchId:id,file:extracted,...(candidateId?{candidateId}:{})},{signal:ctl.signal});
   if(ctl.signal.aborted||stopRequested){item.status='pending';item.message='서버 저장 여부 확인 필요';break;}
   // The server is authoritative. Avoid a slow full batch download per file;
   // refresh once per group, and always reconcile after cancellation.
   if(!existing)files.push({file_id:extracted.id,hash:extracted.hash,name:extracted.name,size:extracted.size,method:extracted.method});
   item.status='saved';item.message='';
  }catch(e){
   if(stopRequested||ctl.signal.aborted){item.status='pending';item.message='중단됨 · 저장 여부 확인 후 재개할 수 있어.';break;}
   item.status='error';item.message=errorText(e);
   try{await call('file_error',{batchId:id,name:item.file.name,message:item.message})}catch(_){}
  }finally{if(activeFileController===ctl)activeFileController=null;render();}
 }
 // Canceled HTTP uploads can finish on the server despite client abort.
 // Re-read server state so resuming by fingerprint remains safe.
 await getBatch();
 const saved=queue.filter(x=>x.status==='saved').length,failed=queue.filter(x=>x.status==='error').length,skipped=queue.filter(x=>x.status==='skipped').length;
 message=(stopRequested?'중단 완료 · ':'')+'저장 '+saved+'개 · 중복 건너뜀 '+skipped+'개 · 실패 '+failed+'개.';
 if(stopRequested){message+=' 남은 파일은 이어하기로 처리해 줘.';return;}
 if(failed)failure='실패한 파일의 사유를 확인해 줘. 다른 파일은 정상 저장됐어.';
 if(!candidateId&&saved&&!deferAnalysis&&!cands().some(c=>registered(c)||c.state==='excluded'||c.corrections?.length)){
  task='analyze';message='원본을 저장했어. 사고별 자동분석 중이야.';render();
  await call('analyze',{batchId:id});await getBatch();
  message='분석 완료 · 파일 저장 '+saved+'개 · 중복 건너뜀 '+skipped+'개 · 실패 '+failed+'개.';
 }
}
function collect(){
 const node=root(),values={};node?.querySelectorAll('[data-b-field]').forEach(x=>values[x.dataset.bField]=clean(x.value));
 const mode=node?.querySelector('#b-legacy-mode')?.value||'',legacyReason=clean(node?.querySelector('#b-legacy-reason')?.value);
 values.legacyApprovalMode=mode;values.legacyApprovalReason=mode?legacyReason:'';values.legacyApprovalConfirmed=mode&&node?.querySelector('#b-legacy-confirm')?.checked?'confirmed':'';
 if(mode){values.erpStatus='';values.erpRef='';values.erpDate='';}
 const reason=clean(node?.querySelector('#b-reason')?.value)||(mode&&legacyReason.length>=10?legacyReason:'');
 return {candidateId:selected,reason,resolveIssues:!!node?.querySelector('#b-resolve')?.checked,values};
}
async function save(x){if(!x.reason)throw Error('수정·확인 근거를 작성해 줘.');const c=cands().find(c=>c.id===x.candidateId);if(!c)throw Error('사고를 찾지 못했어.');const out=await call('save',{batchId:id,candidateId:c.id,revision:c.revision,values:x.values,reason:x.reason,resolveIssues:x.resolveIssues});await getBatch();dirty=false;return out.candidate||cands().find(y=>y.id===c.id)}
async function mutate(action,x,notice){if(!x.reason)throw Error('수정·처리 사유를 입력해 줘.');const c=cands().find(c=>c.id===x.candidateId);if(!c)throw Error('사고를 찾지 못했어.');const payload={batchId:id,candidateId:c.id,revision:c.revision,reason:x.reason};if(registered(c))payload.incidentVersion=c.incidentVersion;if(action==='update_incident')payload.values=x.values;await call(action,payload);await getBatch();dirty=false;message=notice;if(registered(c))try{await window.enlIncidentPullNow?.()}catch(_){message+=' 일반 사고목록은 새로고침하면 최신 상태가 반영돼.'}}
async function bulkCommit(){const pending=cands().filter(c=>ready(c)&&!core.isLegacy(c.values));if(!pending.length)throw Error('등록할 준비가 된 사고가 없어. 검토사항을 보완해 줘.');if(!confirm('정상 '+pending.length+'건의 사고 내용과 ERP 최초결재 근거를 확인했어? 한 번에 등록할까? 검토 필요·제외 건은 보류돼.'))return;task='commit';stopRequested=false;let ok=0,blocked=0,failed=0;const errors=[];
 for(const item of pending){if(stopRequested)break;message='사고 등록 '+(ok+blocked+failed+1)+' / '+pending.length;render();try{const c=cands().find(c=>c.id===item.id)||item;const out=await call('commit',{batchId:id,candidateId:c.id,revision:c.revision,finalConfirmed:true});if(out.candidate?.state==='success')ok++;else blocked++}catch(e){failed++;errors.push((item.values?.recordNo||item.values?.title||item.id)+' : '+errorText(e))}await getBatch()}
 message=(stopRequested?'중단 · ':'')+'등록 성공 '+ok+'건 · 추가 검토 '+blocked+'건 · 요청 실패 '+failed+'건. 저장된 사고는 재시도해도 중복등록하지 않아.';failure=errors.join('\n');await recentBatches();if(ok)try{await window.enlIncidentPullNow?.()}catch(_){message+=' 일반 사고목록을 새로고침해 줘.'}}
async function openDetail(incidentId){if(!leaveDetail())return;try{await window.enlIncidentPullNow?.()}catch(_){}const exists=typeof data!=='undefined'&&(data.incidents||[]).some(x=>clean(x.id)===clean(incidentId));if(!exists)throw Error('일반 사고목록에서 해당 기록을 아직 불러오지 못했어. 최신 상태를 불러온 뒤 다시 열어 줘.');if(typeof window.enlOpenIncidentReview==='function')window.enlOpenIncidentReview(incidentId,false,user());else if(typeof window.openIncidentModal==='function')window.openIncidentModal(incidentId,false,user());else throw Error('사고 상세 화면을 불러오지 못했어.')}
function exportCsv(){if(!state)return;const head=['후보번호','사고번호','사업장','발생일','사고유형','대인대물','상태','검토사유','실패사유','등록ID','중복사고ID','원본파일','진료비','수리비','총피해액','진단결과'];const rows=[head,...cands().map(c=>{const v=activeValues(c);return [c.id,v.recordNo,v.siteName,v.occurredDate,v.eventType,categoryName(category(c)),names[displayState(c)]||c.state,issues(c).map(i=>i.message).join('; '),candError(c),c.incidentId,duplicates(c).join('; '),files.filter(f=>(c.sources||[]).includes(f.file_id)).map(f=>f.name).join('; '),v.medicalCost,v.repairCost,v.damageAmount,v.diagnosis]})];const safeCell=x=>{const raw=String(x??''),safe=/^[\s\uFEFF]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"'};const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(safeCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='과거사고_이관결과_'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function start(u=user()){advanced=false;if(!u||String(u.role)!=='safety')return alert('안전관리자 계정에서만 사용할 수 있어.');if(!core||!extract)return alert('일괄분석 모듈이 준비되지 않았어. 새로고침해 줘.');if(ownerId!==clean(u.id||u.personnelId))forget();ownerId=clean(u.id||u.personnelId);if(!id)try{id=clean(sessionStorage.getItem(rememberedKey()))}catch(_){}open=true;selected='';dirty=false;message='';failure='';currentView='report';renderShell(u);load()}
function addCard(node,u){if(!node||u?.role!=='safety')return;const grid=node.querySelector('.report-type-grid');if(!grid||grid.querySelector('[data-bulk-v454]'))return;const el=document.createElement('button');el.type='button';el.dataset.bulkV454='1';el.className='report-type-card hist449-card';el.innerHTML='<span class="report-type-no">04</span><strong>과거사고 자동이관</strong><small>파일 일괄분석 · 검토·등록 · 수정·무효처리</small>';grid.appendChild(el);el.onclick=()=>start(u)}
const old=window.renderUnifiedReport;if(typeof old==='function'){const wrapper=function(node,u){if(open&&u?.role==='safety'&&clean(u.id||u.personnelId)===ownerId)return render();if(open){open=false;forget();ownerId=''}const result=old.apply(this,arguments);setTimeout(()=>addCard(node,u),0);return result};window.renderUnifiedReport=wrapper;try{renderUnifiedReport=wrapper}catch(_){}}
window.enlOpenHistoricalCandidate454=async function(batchId,candidateId){const u=user();if(!u)return alert('안전관리자 계정에서만 사용할 수 있어.');if(waiting)return;if(!leaveDetail())return;try{window.closeModal?.()}catch(_){}if(ownerId!==clean(u.id||u.personnelId))forget();ownerId=clean(u.id||u.personnelId);open=true;dirty=false;selected='';currentView='report';renderShell(u);await run(async()=>{const opts=await call('options');sites=opts.sites||[];await recentBatches();await getBatch(clean(batchId));if(!cands().some(c=>c.id===clean(candidateId)))throw Error('candidate_not_found');selected=clean(candidateId)});};
window.addEventListener('beforeunload',e=>{if(open&&(waiting||dirty)){e.preventDefault();e.returnValue=''}});window.enlStartHistoricalBulk454=start;window.ENL_HIST_BULK_VERSION='4.5.5-simple-auto';
})();
