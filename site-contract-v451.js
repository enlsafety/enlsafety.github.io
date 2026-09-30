/* Shared contract semantics. Month precision is retained; no dates are fabricated. */
(function(g){
'use strict';
const text=v=>String(v??'').trim(),esc=v=>text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let live=new Map();
function datePart(v){const s=text(v),m=/^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);if(!m)return '';const y=+m[1],mo=+m[2],d=m[3]?+m[3]:1;if(mo<1||mo>12||d<1||d>new Date(Date.UTC(y,mo,0)).getUTCDate())return '';return s}
function period(s={}){const raw=[text(s.start_date),text(s.contract_end_date)].filter(Boolean).join(' ~ '),start=datePart(s.start_date),end=datePart(s.contract_end_date),ordered=!start||!end||start.slice(0,Math.min(start.length,end.length))<=end.slice(0,Math.min(start.length,end.length)),verified=!!(start&&end&&ordered);return {start:ordered?start:'',end:ordered?end:'',raw,precision:start.length===7||end.length===7?'month':start&&end?'day':'unknown',verified}}

function site(id){const seed=(g.ENL_SITE_MASTER_SEED||[]).find(s=>String(s.site_id)===String(id))||{},local=typeof data!=='undefined'?(data.sites||[]).find(s=>String(s.id)===String(id))||{}:{};return {...local,...seed,...live.get(String(id)),site_id:String(id)}}
const status=s=>s?.active===false?'closed':'active';
const closed=id=>status(site(id))==='closed';
function matches(id,filter='all'){return filter==='all'||(filter==='closed'?closed(id):!closed(id))}
function assess(s,date){const p=period(s),d=datePart(text(date).slice(0,10));let state='unknown',outside=null,reason='';if(d){if(p.start&&d.slice(0,p.start.length)<p.start){state='not_started';outside=true;reason='선택한 사고 발생일은 이앤엘의 해당 사업장 계약기간 이전입니다.'}else if(p.end&&d.slice(0,p.end.length)>p.end){state='closed';outside=true;reason='선택한 사고 발생일은 이앤엘의 해당 사업장 계약기간 이후입니다.'}else if(p.verified){state='active';outside=false}}
return {...p,statusAtOccurrence:state,outsideContractPeriod:outside,warning:reason||(state==='unknown'?'계약기간이 없거나 확인이 필요하여 사고 당시 계약상태를 판정할 수 없습니다.':''),currentStatus:status(s)}}
function snapshot(s,date,actor={},confirmed=false){const a=assess(s,date);return {version:1,siteId:text(s.site_id||s.id),occurredDate:text(date).slice(0,10),currentStatus:a.currentStatus,statusAtOccurrence:a.statusAtOccurrence,contractStartDate:a.start||null,contractEndDate:a.end||null,contractPeriodText:a.raw,datePrecision:a.precision,outsideContractPeriod:a.outsideContractPeriod,capturedAt:new Date().toISOString(),confirmation:confirmed?{confirmed:true,byId:text(actor.id||actor.personnelId),byName:text(actor.name),at:new Date().toISOString()}:null}}
function capture(id,date,actor,confirmed){return snapshot(site(id),date,actor,confirmed)}
function periodText(id){const p=period(site(id));return p.verified?p.start.replace(/-/g,'.')+' ~ '+p.end.replace(/-/g,'.')+(p.precision==='month'?' (월 기준·정확한 일자 미확인)':''):p.raw?p.raw+' · 확인 필요':'확인 필요'}
function badge(id){return closed(id)?'<span class="contract451-badge" style="display:inline-block;background:#eef0f2;color:#58636e;border:1px solid #ccd2d8;border-radius:6px;padding:2px 6px;font-size:11px;margin-left:5px">계약종료</span>':''}
function detail(id){return '<div class="contract451-detail" style="font-size:12px;line-height:1.6;color:#586b7b">운영상태: '+(closed(id)?'계약종료':'운영중')+' · 계약기간: '+esc(periodText(id))+'</div>'}
function incidentDetail(i){const s=i?.siteContractSnapshot,labels={active:'운영중',closed:'계약종료',not_started:'계약시작 전',unknown:'확인 필요'};return detail(i.siteId)+'<div class="contract451-snapshot" style="font-size:12px;line-height:1.6">사고 당시 계약상태: '+(s?esc(labels[s.statusAtOccurrence]||'확인 필요'):'확인 필요 (기존 기록·스냅샷 없음)')+(s?' · 등록 당시 계약기간: '+esc((s.contractStartDate||'미확인')+' ~ '+(s.contractEndDate||'미확인')):'')+(s?.datePrecision==='month'?' · 월 단위 판정':'')+(s?.outsideContractPeriod===true?' · 계약기간 외 등록'+(s?.confirmation?.confirmed?' (안전관리자 확인)':' (확인 필요)'):'')+'</div>'}
function list(){const ids=new Set([...(g.ENL_SITE_MASTER_SEED||[]).map(s=>s.site_id),...(typeof data!=='undefined'?data.sites||[]:[]).map(s=>s.id),...live.keys()]);return [...ids].filter(id=>id&&id!=='site-hq').map(site).sort((a,b)=>Number(a.active===false)-Number(b.active===false)||text(a.site_name||a.name).localeCompare(text(b.site_name||b.name),'ko'))}
function options(sel){return '<option value="">사업장 선택</option>'+['active','closed'].map(st=>'<optgroup label="'+(st==='active'?'현재 운영중':'계약종료')+'">'+list().filter(s=>status(s)===st).map(s=>'<option value="'+esc(s.site_id)+'" '+(String(sel)===s.site_id?'selected':'')+'>'+esc(s.site_name||s.name||s.site_id)+'</option>').join('')+'</optgroup>').join('')}
function setSites(rows){for(const r of rows||[])if(r.site_id)live.set(String(r.site_id),{...live.get(String(r.site_id)),...r});if(g.dispatchEvent&&typeof Event!=='undefined')g.dispatchEvent(new Event('enl-contracts-ready'))}
g.ENLContracts={datePart,period,assess,snapshot,capture,site,closed,matches,badge,detail,incidentDetail,options,list,setSites,periodText};
})(globalThis);
