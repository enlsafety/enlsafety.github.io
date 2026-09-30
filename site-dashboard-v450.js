
/* E&L Accident Report App v4.4.19 - site profile + Korea distribution */
(function(){
'use strict';
const VERSION='4.4.19-region-labels1';
const roleNorm=v=>String(v||'')==='final'?'manager':String(v||'');
const isSafety=u=>roleNorm(u&&u.role)==='safety';
const E=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const T=v=>String(v==null?'':v).trim();
const N=v=>Math.max(0,Math.trunc(Number(v)||0));
const actor=u=>u?{id:u.id||u.personnelId||u.username||'',name:u.name||'',role:roleNorm(u.role),position:u.position||u.jobTitle||'',siteId:u.siteId||''}:null;
const isHistorical=i=>!!i&&(String(i.recordMode||'')==='historical_transfer'||String(i&&i.historicalTransfer&&i.historicalTransfer.mode||'')==='historical_transfer'||!!(i&&i.historicalImport&&i.historicalImport.enabled));
const view=()=>String(typeof currentView!=='undefined'?currentView:(window.currentView||''));
const MAP={w:760,h:760,pad:26,minLon:124.3,maxLon:132.2,minLat:32.8,maxLat:38.9,meanLat:35.85*Math.PI/180};
MAP.cos=Math.cos(MAP.meanLat);MAP.xmin=MAP.minLon*MAP.cos;MAP.xmax=MAP.maxLon*MAP.cos;MAP.scale=Math.min((MAP.w-2*MAP.pad)/(MAP.xmax-MAP.xmin),(MAP.h-2*MAP.pad)/(MAP.maxLat-MAP.minLat));MAP.usedW=(MAP.xmax-MAP.xmin)*MAP.scale;MAP.usedH=(MAP.maxLat-MAP.minLat)*MAP.scale;MAP.ox=(MAP.w-MAP.usedW)/2;MAP.oy=(MAP.h-MAP.usedH)/2;
let masters=[],loaded=false,loading=false,loadError=false,preview='';

function css(){
 if(document.getElementById('sd450Css'))return;
 const s=document.createElement('style');s.id='sd450Css';
 s.textContent='.sd450-info{border:1.5px solid #bcd3e3!important;background:linear-gradient(180deg,#f7fbfe,#fff)!important}.sd450-info-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:11px}.sd450-info-head h2{margin:0;color:#173b66;font-size:21px}.sd450-info-head p{margin:4px 0 0;color:#708497;font-size:12px}.sd450-info-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sd450-info-grid>div{padding:10px 11px;border:1px solid #d9e6ef;border-radius:10px;background:#fff;min-width:0}.sd450-info-grid b{display:block;color:#738697;font-size:10px;margin-bottom:4px}.sd450-info-grid span{display:block;color:#27465f;font-size:13px;font-weight:850;line-height:1.45;overflow-wrap:anywhere}.sd450-info-grid .wide{grid-column:span 2}.sd450-info-note{margin:9px 0 0;color:#7a8d9d;font-size:10px;line-height:1.45}.sd450-map-panel{overflow:hidden}.sd450-map-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.sd450-map-head h2{margin:0;color:#173b66;font-size:20px}.sd450-map-head p{margin:4px 0 0;color:#708497;font-size:12px;line-height:1.45}.sd450-map-badges{display:flex;gap:6px;flex-wrap:wrap}.sd450-map-badge{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:#eef6fb;color:#315d7b;border:1px solid #c8dce9;font-size:11px;font-weight:900}.sd450-map-badge.risk{background:#fff0f0;color:#9c3438;border-color:#e8b4b6}.sd450-map-layout{display:grid;grid-template-columns:minmax(300px,1.25fr) minmax(240px,.75fr);gap:14px;align-items:stretch;margin-top:12px}.sd450-map-wrap{min-height:430px;border:1px solid #d5e3ec;border-radius:16px;background:linear-gradient(180deg,#edf8ff,#f8fcff);display:grid;place-items:center;padding:8px;overflow:hidden}.sd450-map{width:min(100%,520px);height:auto;max-height:480px}.sd450-land{fill:#e9f2f7;stroke:#9fb8ca;stroke-width:2}.sd450-boundary{fill:none;stroke:#cbdbe6;stroke-width:1;stroke-dasharray:4 4}.sd450-jeju{fill:#e9f2f7;stroke:#9fb8ca;stroke-width:2}.sd450-site{cursor:pointer;outline:none}.sd450-site .point{stroke:#fff;stroke-width:2.2;filter:drop-shadow(0 2px 2px rgba(30,66,91,.18))}.sd450-site .hit{fill:transparent;stroke:transparent}.sd450-site:hover .point,.sd450-site:focus .point{stroke:#173b66;stroke-width:3}.sd450-site.high .point{fill:#d83f45!important}.sd450-site.high .ring{fill:none;stroke:#d83f45;stroke-width:2;opacity:.3}.sd450-map-side{display:grid;align-content:start;gap:9px}.sd450-legend{padding:12px;border:1px solid #d9e5ed;border-radius:12px;background:#fff;color:#526d82;font-size:12px;line-height:1.55}.sd450-legend b{color:#244e6c}.sd450-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}.sd450-dot.normal{background:#3d82af}.sd450-dot.high{background:#d83f45}.sd450-risk-list{display:grid;gap:6px}.sd450-risk-item{display:flex;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid #efc1c3;border-radius:10px;background:#fff6f6;color:#7d3437;font-size:11px}.sd450-risk-item b{color:#a33035}.sd450-map-note{color:#8191a0;font-size:10px;line-height:1.5}@media(max-width:900px){.sd450-info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sd450-map-layout{grid-template-columns:1fr}.sd450-map-wrap{min-height:390px}.sd450-map-side{grid-template-columns:1fr 1fr}.sd450-map-note{grid-column:1/-1}}@media(max-width:560px){.sd450-info-grid{grid-template-columns:1fr 1fr}.sd450-info-grid .wide{grid-column:1/-1}.sd450-map-wrap{min-height:330px;padding:4px}.sd450-map-side{grid-template-columns:1fr}.sd450-map-head h2{font-size:18px}.sd450-map{max-height:380px}}@media(max-width:380px){.sd450-info-grid{grid-template-columns:1fr}}';
 s.textContent+='.sd450-map-canvas{position:relative;width:min(100%,620px);aspect-ratio:1/1;margin:auto}.sd450-map-img{display:block;width:100%;height:100%;object-fit:contain}.sd450-marker{position:absolute;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 7px rgba(22,58,84,.28);cursor:pointer;padding:0;z-index:2}.sd450-marker:hover,.sd450-marker:focus-visible{outline:3px solid rgba(23,59,102,.28);outline-offset:2px;z-index:4}.sd450-marker.high{width:18px;height:18px;background:#d83f45!important;box-shadow:0 0 0 5px rgba(216,63,69,.16),0 2px 8px rgba(22,58,84,.28)}.sd450-marker-label{position:absolute;left:50%;top:19px;transform:translateX(-50%);padding:3px 6px;border-radius:7px;background:rgba(255,255,255,.94);border:1px solid #d7e3ec;color:#31536c;font-size:9px;font-weight:900;white-space:nowrap;display:none;pointer-events:none}.sd450-marker:hover .sd450-marker-label,.sd450-marker:focus-visible .sd450-marker-label{display:block}.sd450-map-source{margin-top:6px;color:#8a98a5;font-size:9px;text-align:center}.sd450-map-panel{margin-top:12px}@media(max-width:560px){.sd450-marker{width:13px;height:13px}.sd450-marker.high{width:16px;height:16px}.sd450-marker-label{display:none!important}}';s.textContent+=`.sd450-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.sd450-kpis>div{border:1px solid #d9e6ef;border-radius:12px;padding:14px;background:#f7fbfe}.sd450-kpis span{display:block;color:#526d82;font-size:12px}.sd450-kpis strong{display:block;color:#173b66;font-size:27px;margin-top:5px}.sd450-kpis small{font-size:12px;margin-left:4px}.sd450-summary-stats{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin:10px 0}.sd450-high{color:#ba222a}.sd450-map-side .sd450-info-grid{grid-template-columns:1fr 1fr}.sd450-map-side .sd450-info{padding:12px}.sd450-map-side button.primary{width:100%;min-height:44px;margin-top:10px}.sd450-select-label{color:#173b66;font-weight:700}.sd450-map-side select{min-height:44px;width:100%;max-width:100%;border:1px solid #bcd3e3;border-radius:10px;background:#fff;padding:8px}.sd450-marker{min-width:0;min-height:0}.sd450-marker.high .sd450-marker-label{display:block!important;color:#a33035;font-size:9px}.sd450-map-side{min-width:0}.sd450-map-wrap{min-width:0;align-content:start}.sd450-map-note{overflow-wrap:anywhere}@media(max-width:900px){.sd450-map-side{grid-template-columns:1fr}}@media(max-width:560px){.sd450-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sd450-map-layout{grid-template-columns:minmax(0,1fr)}.sd450-map-wrap{min-height:0}}`;
 document.head.appendChild(s);
}
function seed(id){return (window.ENL_SITE_MASTER_SEED||[]).find(x=>String(x.site_id)===String(id))||{}}
function live(id){return masters.find(x=>String(x.site_id)===String(id))||{}}
function local(id){const s=(data&&data.sites||[]).find(x=>String(x.id||x.site_id)===String(id))||{};return {site_id:s.id||s.site_id,site_name:s.name||s.site_name,region:s.region,address:s.address,regular_count:s.regular_count,daily_count:s.daily_count,total_count:s.total_count==null?s.workerCount:s.total_count,manager_name:s.manager_name,part_name:s.part_name,clerk_name:s.clerk_name,site_type:s.site_type,active:s.active}}
function master(id){return Object.assign({},seed(id),Object.fromEntries(Object.entries(local(id)).filter(([,v])=>v!==undefined)),live(id))}
function rows(){
 if(loaded)return masters.filter(s=>s.site_id&&s.site_id!=='site-hq'&&s.active!==false).map(s=>master(s.site_id)).sort((a,b)=>String(a.site_name).localeCompare(String(b.site_name),'ko'));
 const ids=new Set();
 (window.ENL_SITE_MASTER_SEED||[]).forEach(x=>x&&x.site_id&&ids.add(String(x.site_id)));
 (data&&data.sites||[]).forEach(x=>{const id=x&&(x.id||x.site_id);if(id&&id!=='site-hq')ids.add(String(id))});
 masters.forEach(x=>x&&x.site_id&&x.active!==false&&ids.add(String(x.site_id)));
 return Array.from(ids).map(master).filter(x=>x.site_id&&x.site_id!=='site-hq'&&x.active!==false).sort((a,b)=>String(a.site_name||a.site_id).localeCompare(String(b.site_name||b.site_id),'ko'));
}
// Contract-ended sites are excluded only from the current dashboard, not history or DB.
function dashboardRows(){return rows().filter(s=>String(s.site_id)!=='s34')}
function cnt(s){const r=N(s.regular_count),d=N(s.daily_count),t=N(s.total_count);return {regular:r,daily:d,total:t||r+d}}
function addr(s){if(T(s.address))return T(s.address);if(T(s.region))return T(s.region)+' (상세주소 미등록)';return '미등록'}
function info(id){
 const s=master(id),c=cnt(s);
 return '<section class="panel sd450-info" data-sd450-info><div class="sd450-info-head"><div><div class="ey">SITE PROFILE</div><h2>'+E(s.site_name||id)+' 사업장 정보</h2><p>사고목록과 함께 현재 등록된 사업장 기본정보를 표시합니다.</p></div></div><div class="sd450-info-grid"><div><b>총 인원</b><span>'+c.total+'명</span></div><div><b>상용</b><span>'+c.regular+'명</span></div><div><b>일용</b><span>'+c.daily+'명</span></div><div><b>사업장 구분</b><span>'+E(T(s.site_type)||'미등록')+'</span></div><div class="wide"><b>사업장 주소</b><span>'+E(addr(s))+'</span></div><div><b>현장소장</b><span>'+E(T(s.manager_name)||'미등록')+'</span></div><div><b>반장 / 파트장</b><span>'+E(T(s.part_name)||'미등록')+'</span></div><div><b>서무</b><span>'+E(T(s.clerk_name)||'미등록')+'</span></div></div><p class="sd450-info-note">※ 인원은 사업장 마스터 등록값 기준이며 법적 상시근로자수 산정과는 별도일 수 있습니다. 상세주소가 비어 있으면 등록된 지역까지만 표시합니다.</p></section>';
}
function siteInc(id){return (data&&data.incidents||[]).filter(i=>String(i.siteId||'')===String(id))}
function yearInc(id){const y=new Date().getFullYear();return (data&&data.incidents||[]).filter(i=>String(i.siteId||'')===String(id)&&new Date(i.occurredAt||0).getFullYear()===y)}
function risk(id){const a=yearInc(id),open=siteInc(id).filter(i=>String(i.status||'')!=='closed'),active=open.some(i=>!isHistorical(i)&&String(i.status||'')!=='closed'&&(String(i.priority||'')==='urgent'||String(i.severity||'')==='major'||i.potentialMajor===true));return {high:active||a.length>=5,count:a.length,open:open.length,activeHigh:active}}
function hash(s){let h=0;for(const ch of String(s||''))h=(h*31+ch.charCodeAt(0))>>>0;return h}
function color(id){const n=Number(String(id||'').replace(/\D/g,''))||hash(id),h=(n*137.508)%360,hue=(h<20||h>340)?(h+38)%360:h;return 'hsl('+hue.toFixed(1)+' 66% 43%)'}
function pos(s){
 const p=(window.ENL_SITE_LOCATIONS||{})[String(s.site_id||'')];
 // Invalidate the cached location when the registered address changes.
 return p&&p.address===T(s.address)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)?[p.lat,p.lon]:null;
}
function mapXY(lat,lon){const x=MAP.ox+(lon*MAP.cos-MAP.xmin)*MAP.scale,y=MAP.h-(MAP.oy+(lat-MAP.minLat)*MAP.scale);return [x/MAP.w*100,y/MAP.h*100]}
function marker(s){
 const p=pos(s);if(!p)return '';const z=mapXY(p[0],p[1]),r=risk(s.site_id),fill=r.high?'#d83f45':color(s.site_id),name=T(s.site_name)||s.site_id,region=T(s.region)||'지역 미등록';
 return '<button type="button" class="sd450-marker '+(r.high?'high':'')+'" data-sd450-map-site="'+E(s.site_id)+'" style="left:'+z[0].toFixed(3)+'%;top:'+z[1].toFixed(3)+'%;background:'+fill+'" aria-label="'+E(name)+(r.high?' 고위험':'')+'" title="'+E(name)+' · '+E(region)+' · 올해 사고 '+r.count+'건'+(r.high?' · 고위험':'')+'"><span class="sd450-marker-label">'+E(name)+(r.high?' · 고위험':'')+'</span></button>';
}
function mapHtml(){
 const a=dashboardRows(),mapped=a.filter(pos),unmapped=a.length-mapped.length,high=a.filter(s=>risk(s.site_id).high);
 const highList=high.length?high.map(s=>'<div class="sd450-risk-item"><span>'+E(s.site_name||s.site_id)+'</span><b>'+risk(s.site_id).count+'건</b></div>').join(''):'<div class="sd450-legend">현재 기준 고위험 사업장이 없습니다.</div>';
 return '<section class="panel sd450-map-panel" data-sd450-map><div class="sd450-map-head"><div><div class="ey">SITE DISTRIBUTION</div><h2>전국 사업장 분포</h2><p>대한민국 실제 해안선·도서·광역 행정경계 지도 위에 사업장을 표시합니다. 점을 누르면 사업장 요약정보를 확인할 수 있습니다.</p></div><div class="sd450-map-badges"><span class="sd450-map-badge">사업장 '+a.length+'곳</span><span class="sd450-map-badge risk">고위험 '+high.length+'곳</span></div></div><div class="sd450-map-layout"><div class="sd450-map-wrap"><div class="sd450-map-canvas"><img class="sd450-map-img" src="korea-map-natural-earth-10m.svg?v=4.4.19-r1" alt="대한민국 지도">'+mapped.map(marker).join('')+'</div><div class="sd450-map-source">지도 윤곽: Natural Earth 1:10m 공개 데이터 · 소피아그린 위치: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 기여자</a></div></div><aside class="sd450-map-side"><div class="sd450-legend"><b>표시 기준</b><br><span class="sd450-dot normal"></span>일반 사업장: 사업장별 고유색<br><span class="sd450-dot high"></span>고위험 사업장: 빨간색<br><br>고위험은 <b>올해 사고 5건 이상</b> 또는 <b>현재 미종결 긴급·중대 사고 보유</b> 기준입니다.</div><div class="sd450-risk-list">'+highList+'</div><div class="sd450-map-note">확인된 시설 좌표만 표시합니다. 주소 좌표를 임의의 지역 중심점으로 대체하지 않습니다.'+(unmapped?' 좌표 확인 필요 '+unmapped+'곳은 지도 점에서 제외했습니다.':'')+' 가까운 점이 겹치면 사업장 선택목록을 이용하세요. 파주CC는 계약 종료로 지도에서 제외합니다.</div></aside></div></section>';
}
function summary(id){
 const s=master(id),r=risk(id),p=(window.ENL_SITE_LOCATIONS||{})[id];
 return info(id)+'<div class="sd450-summary-stats"><b>올해 사고 '+r.count+'건</b><b>현재 미종결 '+r.open+'건</b><b class="'+(r.high?'sd450-high':'')+'">위험도: '+(r.high?'고위험':'일반')+'</b></div><p class="sd450-info-note">'+(pos(s)?'위치: 주소와 대조한 '+(p.accuracy==='building'?'건물':'시설 대표')+' 좌표 · '+E(p.sourceName):'좌표 확인 필요 · 지도에 임의 위치를 표시하지 않습니다.')+'</p><button type="button" class="primary" data-sd450-open="'+E(id)+'">사업장 사고목록 보기</button>';
}
function kpis(){
 const a=dashboardRows(),tot=a.reduce((r,s)=>{const c=cnt(s);r.regular+=c.regular;r.daily+=c.daily;r.total+=c.total;return r},{regular:0,daily:0,total:0});
 const incidents=data&&data.incidents||[],year=new Date().getFullYear();
 const values=[['전국 사업장 수',a.length,'곳'],['전체 인원',tot.total,'명'],['상용 인원',tot.regular,'명'],['일용 인원',tot.daily,'명'],['올해 사고 건수',incidents.filter(i=>new Date(i.occurredAt||0).getFullYear()===year).length,'건'],['현재 미종결 사고',incidents.filter(i=>String(i.status||'')!=='closed').length,'건'],['고위험 사업장 수',a.filter(s=>risk(s.site_id).high).length,'곳']];
 return '<section class="panel" data-sd450-kpis><h2>회사 전체 현황</h2><p class="sd450-info-note">'+year+'년 기준 · 사업장·인원은 파주CC(계약 종료) 제외 · 사고 건수는 전체 이력 기준 · 아래 사고통계 필터와 별도 집계 · '+(loaded?'인원은 사업장 마스터 등록값 합계입니다. 0명·미등록 값은 확인이 필요합니다.':loadError?'최신 사업장 정보를 불러오지 못했습니다. 이전 등록값을 표시합니다.':'최신 사업장 정보를 확인하고 있습니다…')+'</p><div class="sd450-kpis">'+values.map(([label,value,unit])=>'<div><span>'+label+'</span><strong>'+value.toLocaleString()+'<small>'+unit+'</small></strong></div>').join('')+'</div></section>';
}
function injectInfo(){
 if(view()!=='incidents')return;
 const root=document.getElementById('view');if(!root)return;
 const selected=typeof window.enlSafetySiteFilter==='function'?window.enlSafetySiteFilter():'';
 const old=root.querySelector('[data-sd450-info]');if(old)old.remove();
 if(selected)root.insertAdjacentHTML('afterbegin',info(selected));
}
function injectMap(u){
 if(!isSafety(u)||view()!=='stats')return;
 const root=document.getElementById('view');if(!root)return;
 const head=root.querySelector('.stats426-head');if(!head)return;
 root.querySelectorAll('[data-sd450-map],[data-sd450-kpis]').forEach(n=>n.remove());
 head.closest('.panel').insertAdjacentHTML('afterend',kpis()+mapHtml());
 const side=root.querySelector('.sd450-map-side'),a=dashboardRows();
 side.insertAdjacentHTML('afterbegin','<label class="sd450-select-label" for="sd450Site">사업장 선택</label><select id="sd450Site"><option value="">사업장을 선택하세요</option>'+a.map(s=>'<option value="'+E(s.site_id)+'">'+E(s.site_name)+(risk(s.site_id).high?' · 고위험':'')+(pos(s)?'':' · 좌표 확인 필요')+'</option>').join('')+'</select><div data-sd450-summary role="region" aria-label="사업장 요약" aria-live="polite"></div>');
 const select=root.querySelector('#sd450Site'),card=root.querySelector('[data-sd450-summary]');
 const show=id=>{preview=id;select.value=id;card.innerHTML=id?summary(id):'';const b=card.querySelector('[data-sd450-open]');if(b)b.onclick=()=>window.enlOpenSafetySiteIncidents(id)};
 select.onchange=()=>show(select.value);
 root.querySelectorAll('[data-sd450-map-site]').forEach(b=>b.onclick=()=>{show(b.dataset.sd450MapSite);card.scrollIntoView({block:'nearest',behavior:'smooth'})});
 if(a.some(s=>s.site_id===preview))show(preview);
}
function enhance(u=currentUser&&currentUser()){if(!isSafety(u)||!isSafety(currentUser&&currentUser()))return;css();injectMap(u);injectInfo()}
async function load(u=currentUser&&currentUser()){
 if(loaded||loading||!isSafety(u)||typeof window.enlIncidentApi!=='function')return;loading=true;
 try{const r=await window.enlIncidentApi({action:'site_list',actor:actor(u)},15000);if(!Array.isArray(r&&r.sites))throw new Error('Invalid site list');masters=r.sites.filter(Boolean);loaded=true;loadError=false;enhance(u)}catch(e){loadError=true;console.warn('[site-dashboard-v450] site master load skipped',e);enhance(u)}finally{loading=false}
}
const base=window.renderShell;if(typeof base==='function'){const wrap=function(u){const out=base.apply(this,arguments);setTimeout(()=>{enhance(u);load(u)},0);return out};window.renderShell=wrap;try{renderShell=wrap}catch(e){}}
const cur=window.renderCurrentView;if(typeof cur==='function')window.renderCurrentView=function(u){const out=cur.apply(this,arguments);setTimeout(()=>{enhance(u);load(u)},0);return out};
let queued=false;
const mo=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;const u=currentUser&&currentUser();if(!isSafety(u))return;const root=document.getElementById('view');if(!root)return;if(view()==='stats'&&root.querySelector('.stats426-cards')&&!root.querySelector('[data-sd450-map]'))enhance(u);if(view()==='incidents'&&window.enlSafetySiteFilter&&window.enlSafetySiteFilter()&&!root.querySelector('[data-sd450-info]'))enhance(u)})});
try{mo.observe(document.getElementById('app')||document.body,{childList:true,subtree:true})}catch(e){}
css();const u=currentUser&&currentUser();if(u){enhance(u);load(u)}
window.enlRefreshSiteDashboard450=()=>{loaded=false;load(currentUser&&currentUser())};
window.ENL_SITE_DASHBOARD_VERSION=VERSION;
})();
