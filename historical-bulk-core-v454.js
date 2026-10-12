/* Shared deterministic document interpretation. No generative facts or paid API. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.ENLHistoricalBulk=api;})(globalThis,function(){
'use strict';
const text=v=>String(v??'').trim(),norm=v=>text(v).replace(/\s+/g,'').toLowerCase();
const fields={
 siteName:['사업장','사업장명','현장명'],occurredDate:['발생일','사고일','발생날짜','사고발생일','발생일자','사고발생일자','사고일자'],occurredTime:['발생시간','사고시간'],category:['사고구분','대인대물'],eventType:['사고유형','재해유형'],severity:['사고정도','중대성','부상정도','피해정도'],place:['사고장소','발생장소'],workAction:['당시작업','작업내용','사고직전작업'],incidentHow:['사고경위','발생내용','사고내용','사고발생경위'],cause:['사고원인','확인된원인'],name:['피해자','피해직원','작업자','성명','피해직원명'],job:['직종','업무'],injuryDetail:['부상내용','인적피해'],damagedItem:['파손물품','파손시설','피해물품','파손물품/시설'],damageDetail:['파손내용','물적피해'],
 cost:['피해비용','비용'],medicalCost:['진료비','병원비','치료비'],repairCost:['복구비용','수리비','수리비용','복구예상비용'],damageAmount:['피해금액','총피해금액'],medicalCostDetail:['진료비상세내역','진료비상세'],repairCostDetail:['견적/비용상세내역','견적비용상세내역','복구비용상세'],
 immediateAction:['당시조치','즉시조치','초기대응','사고직후조치'],erpRef:['ERP문서번호','결재문서번호'],erpDate:['ERP결재일','결재일'],erpStatus:['ERP결재상태','결재상태'],recordNo:['사고번호','사고관리번호'],originalReporter:['원보고자','보고자'],diagnosis:['진단명','진단결과'],doctorOpinion:['의사소견','치료/의사소견','치료기간'],leaveEstimate:['휴업예상','휴업정도'],followupNote:['후속자료','사후보완내용','조치방안','조치계획'],title:['사고명','제목']
};
const labels=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v[0]]));
const aliasNorm=v=>norm(v).replace(/[：:*＊]+$/g,'');
const aliases=new Map(Object.entries(fields).flatMap(([k,v])=>v.map(a=>[aliasNorm(a),k])));
const missing=v=>!text(v)||/^(미상|미확인|확인중|알수없음|unknown|n\/a|-)$/i.test(norm(v));
const presentDamage=v=>!missing(v)&&!['없음','해당없음','무','없다','0'].includes(norm(v));
const seoulToday=()=>new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
function date(v){const m=text(v).match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})(?:일)?\.?$/);if(!m)return '';const s=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,d=new Date(s);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
function value(k,v){
 v=text(v);if(['occurredDate','erpDate'].includes(k))return date(v)||v;
 if(k==='occurredTime'){const m=v.match(/^(오전|오후)?\s*(\d{1,2})(?:\s*[:시]\s*)(\d{1,2})(?:분)?$/);if(m){let h=Number(m[2]),min=Number(m[3]);if(m[1]&&h>=1&&h<=12)h=h%12+(m[1]==='오후'?12:0);if(h<24&&min<60)return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;}}
 if(k==='category')return ({대인:'person',대인사고:'person',대물:'property',대물사고:'property',혼합:'mixed',대인대물:'mixed','대인/대물':'mixed','대인·대물':'mixed','대인및대물':'mixed'})[norm(v)]||v;
 if(k==='severity')return ({경미:'minor',보통:'moderate',중대:'major'})[v]||v;
 return v;
}
const emptySegment=id=>({values:{},evidence:{},issues:[],sources:[id]});
function parseUnits(file){
 const segments=[];let segment=emptySegment(file.id),currentMethod=file.method||'text',lastKey='';
 const finish=()=>{if(Object.keys(segment.values).length){segments.push(segment);segment=emptySegment(file.id);}lastKey='';};
 const add=(k,raw,loc)=>{
  if(!text(raw))return;
  // "피해정도" can be a description (e.g. a broken cart curtain), not a
  // minor/moderate/major grade. Preserve the original OCR quotation.
  if(k==='severity'&&currentMethod==='ocr'&&!['minor','moderate','major'].includes(value(k,raw))){
   if(/파손|훼손|찢어|파열|수리|손상/.test(raw))k='damageDetail';
   else if(/부상|골절|열상|타박|출혈|화상|치료/.test(raw))k='injuryDetail';
  }
  const ev={fileId:file.id,location:loc,quote:text(raw),method:currentMethod},v=value(k,raw);
  if(segment.values[k]!==undefined&&norm(segment.values[k])!==norm(v)){
   if(['erpRef','recordNo'].includes(k)||['siteName','occurredDate'].includes(k)&&segment.values.incidentHow){finish();}
   else segment.issues.push({field:k,code:'conflict',message:`${labels[k]} 값이 문서에서 서로 다릅니다.`,evidence:[...(segment.evidence[k]||[]),ev]});
  }
  if(segment.values[k]===undefined||missing(segment.values[k])&&!missing(v))segment.values[k]=v;
  (segment.evidence[k]??=[]).push(ev);
 };
 const lines=(src,location)=>{
  for(const [n,line] of text(src).split(/\r?\n/).entries()){
   if(/^\s*(?:---+|사고\s*(?:#|번호)?\s*\d+\s*[:：]?)\s*$/.test(line)){finish();lastKey='';continue;}
   const cells=line.split(/\t+| {2,}/).map(text).filter(Boolean),cellKeys=cells.map(cell=>aliases.get(aliasNorm(cell)));
   if(cellKeys.filter(Boolean).length>=2&&cellKeys[0]){
    for(let c=0;c<cells.length;c++)if(cellKeys[c]){let end=c+1;while(end<cells.length&&!cellKeys[end])end++;add(cellKeys[c],cells.slice(c+1,end).join(' '),`${location} · ${n+1}줄`);lastKey=cellKeys[c];c=end-1;}
    continue;
   }
   const m=line.match(/^\s*([^:：\t]{1,35})\s*[:：\t]\s*(.*)$/);let k=m&&aliases.get(aliasNorm(m[1])),raw=m?.[2];
   if(!k){const separated=line.match(/^\s*(.+?)\s{2,}(.+)$/);if(separated){k=aliases.get(aliasNorm(separated[1]));raw=separated[2];}}
   if(!k&&currentMethod==='ocr'){
    const bar=line.match(/^\s*([^:：|｜]{2,15})\s*[|｜]\s*(.*)$/);
    if(bar){k=aliases.get(aliasNorm(bar[1]));raw=bar[2];}
   }
   if(k){
    if(['siteName','occurredDate'].includes(k)&&segment.values[k]!==undefined&&norm(segment.values[k])!==norm(value(k,raw))&&segment.values.incidentHow)finish();
    add(k,raw,`${location} · ${n+1}줄`);lastKey=k;
   }else if(lastKey&&['incidentHow','cause','immediateAction','workAction','injuryDetail','damageDetail','doctorOpinion','followupNote'].includes(lastKey)&&text(line)&&!(currentMethod==='ocr'&&['damageDetail','injuryDetail','followupNote'].includes(lastKey))){
    segment.values[lastKey]+='\n'+text(line);segment.evidence[lastKey].push({fileId:file.id,location:`${location} · ${n+1}줄`,quote:text(line),method:currentMethod});
   }else lastKey='';
  }
 };
 const recoverOcrForm=unit=>{
  const rows=text(unit.text).split(/\r?\n/).map(text),at=i=>(text(unit.location)||'OCR')+' · '+(i+1)+'줄';
  const push=(k,v,i)=>{if(text(v))add(k,v,at(i));};
  const form=rows.some(x=>/사고\s*경위\s*서|사고\s*일자|사고\s*장소|사고\s*내용|발생\s*경위/.test(x));
  const quote=rows.some(x=>/견\s*적\s*서|합계\s*금액/.test(x));
  if(form){
   const first=rows.findIndex(x=>/(?:\d{1,2}월\s*\d{1,2}일|\d{4}[./-]\d{1,2}[./-]\d{1,2}).{0,20}\d{1,2}\s*시\s*\d{1,2}\s*분/.test(x)&&!/보고일자|견적/.test(x));
   if(first>=0){
    const parts=[];
    for(let i=first;i<Math.min(rows.length,first+6);i++){
     if(i>first&&/^\s*(?:피해\s*정도|조치\s*방안|조치\s*계획|위와\s*같이|보고자)/.test(rows[i]))break;
     const v=rows[i].replace(/\s*발생\s*경위\s*/,' ').trim();
     if(v)parts.push(v);
    }
    if(parts.join(' ').length>=24&&!segment.values.incidentHow)push('incidentHow',parts.join('\n'),first);
    const time=rows[first].match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분/);
    if(time){let h=Number(time[2]);if(time[1]&&h>=1&&h<=12)h=h%12+(time[1]==='오후'?12:0);
     if(h<24&&Number(time[3])<60)push('occurredTime',String(h).padStart(2,'0')+':'+time[3].padStart(2,'0'),first);}
   }
   const titleAt=rows.findIndex(x=>x.length>=4&&x.length<=34&&!/피해\s*정도|견적|합계|번호/.test(x)&&/파손|훼손|충돌|추락|낙상|넘어짐|끼임|베임|전도|화재/.test(x));
   if(titleAt>=0){
    if(!segment.values.title)push('title',rows[titleAt],titleAt);
    const kind=rows[titleAt].match(/파손|훼손|충돌|추락|낙상|넘어짐|끼임|베임|전도|화재/);
    if(kind&&!segment.values.eventType)push('eventType',kind[0],titleAt);
   }
   const damage=text(segment.values.damageDetail),item=damage.match(/^(.{2,45}?)\s*(?:파손|훼손|손상|찢어짐|파열)/);
   if(item&&!segment.values.damagedItem){
    const i=rows.findIndex(x=>/피해\s*정도/.test(x));
    push('damagedItem',item[1].replace(/\s*\(.*$/,'').trim(),Math.max(0,i));
   }
   // A future \"조치방안\" belongs to follow-up, not the immediate action.
   const planAt=rows.findIndex(x=>/조치\s*(?:방안|계획)/.test(x));
   if(planAt>=0&&!segment.evidence.followupNote?.some(e=>e.method==='text')){
    const lines=[],positions=[];
    for(let i=planAt;i<Math.min(rows.length,planAt+4);i++){
     if(i>planAt&&/^\s*(?:위와\s*같이|보고자|주식회사|작성일)/.test(rows[i]))break;
     const content=rows[i].replace(/^\s*조치\s*(?:방안|계획)\s*[:：|｜]?\s*/,'').trim();
     if(content){lines.push(content);positions.push(i);}
    }
    // A scanned label can appear after its first sentence because of
    // table cell reading order. Preserve that nearby sentence only when it
    // clearly describes prevention/work-method measures.
    const before=rows[planAt-1]||'';
    if(/주의|예방|적재|규격|재발|조치|개선/.test(before)&&!/피해\s*정도|발생\s*경위/.test(before)){lines.unshift(before);positions.unshift(planAt-1);}
    if(lines.join(' ').length>=10){
     const cleanPlan=lines.join('\n');
     segment.values.followupNote=cleanPlan;
     segment.evidence.followupNote=lines.map((quote,n)=>({fileId:file.id,location:at(positions[n]),quote,method:'ocr'}));
    }
   }
   if(!segment.values.workAction){
    const i=rows.findIndex(x=>/수거하여|수거\s*작업|예초\s*작업|방제\s*작업|청소\s*작업|관리동으로\s*복귀/.test(x));
    if(i>=0){
     const m=rows[i].match(/(?:[^\s,]{0,15}\s*)?(?:수거하여|수거\s*작업|예초\s*작업|방제\s*작업|청소\s*작업|관리동으로\s*복귀)[^\n,.]{0,28}/);
     if(m)push('workAction',m[0].trim(),i);
    }
   }
  }
  if(quote){
   // \"합계금액\" is a quoted repair cost. It is not proof of payment.
   const i=rows.findIndex(x=>/합계\s*금액/.test(x));
   if(i>=0&&!segment.values.repairCost){
    const prices=[...rows.slice(i,i+2).join(' ').matchAll(/(?:\d{1,3}(?:,\d{3})+|\d{4,10})(?:\.\d{1,2})?/g)]
      .map(x=>x[0]).filter(v=>Number.isFinite(money(v))&&money(v)>0);
    if(prices.length)push('repairCost',prices[prices.length-1],i);
   }
  }
 };

 for(const unit of file.units||[]){
  if(!unit||typeof unit!=='object')continue;
  currentMethod=unit.method||file.method||'text';const location=text(unit.location)||'본문';
  if(Array.isArray(unit.rows)){
   lastKey='';
   // A labeled form may span several tables/pages. Only actual data rows define a new incident.
   let headers=null;
   for(let r=0;r<unit.rows.length;r++){
    if(!Array.isArray(unit.rows[r]))continue;
    const row=unit.rows[r].map(text),keys=row.map(c=>aliases.get(aliasNorm(c))),keyCount=keys.filter(Boolean).length,filled=row.filter(Boolean).length;
    if(keyCount>=2&&(keyCount===filled||keyCount>=3&&keyCount>filled/2)){finish();headers=keys;continue;}
    if(!filled){if(headers)finish();continue;}
    if(headers){finish();row.forEach((v,c)=>{if(headers[c])add(headers[c],v,`${location} · ${r+1}행 ${c+1}열`)});finish();}
    else if(keyCount){
     for(let c=0;c<row.length;c++)if(keys[c]){let end=c+1;while(end<row.length&&!keys[end])end++;add(keys[c],row.slice(c+1,end).join(' '),`${location} · ${r+1}행 ${c+1}~${end}열`);c=end-1;}
    }else if(row.length===1)lines(row[0],`${location} · ${r+1}행`);
   }
   continue;
  }
  lines(unit.text,location);
  if(currentMethod==='ocr'){recoverOcrForm(unit);lastKey='';}
 }
 finish();
 if(!segments.length)segments.push({...emptySegment(file.id),issues:[{code:'unstructured',message:'사고 단위와 항목을 식별하지 못했습니다. 원문을 확인하고 사고별 필수항목을 보완해 주세요.'}]});
 for(const s of segments)if(Object.values(s.evidence).flat().some(e=>e.method==='ocr')||file.method==='ocr'&&!Object.keys(s.evidence).length)s.issues.push({code:'ocr',message:'OCR 판독 결과를 원본과 대조해 주세요. 스캔·사진은 자동등록하지 않습니다.'});
 return segments;
}
function identityConflict(a,b){return ['siteName','siteId','occurredDate','recordNo'].some(k=>!missing(a[k])&&!missing(b[k])&&norm(a[k])!==norm(b[k]));}
function sameIncidentIdentity(a,b){
 if(identityConflict(a,b))return false;
 if(!missing(a.recordNo)&&!missing(b.recordNo)&&norm(a.recordNo)===norm(b.recordNo))return true;
 const siteMatch=(!missing(a.siteId)&&!missing(b.siteId)&&a.siteId===b.siteId)||(!missing(a.siteName)&&!missing(b.siteName)&&norm(a.siteName)===norm(b.siteName));
 return !!(siteMatch&&!missing(a.occurredDate)&&a.occurredDate===b.occurredDate&&!missing(a.incidentHow)&&norm(a.incidentHow)===norm(b.incidentHow));
}
function mergeInto(old,s){
 for(const [k,v] of Object.entries(s.values)){
  if(!missing(old.values[k])&&!missing(v)&&norm(old.values[k])!==norm(v))old.issues.push({code:'conflict',field:k,message:`${labels[k]} 값이 연결된 자료에서 서로 다릅니다.`,evidence:[...(old.evidence[k]||[]),...(s.evidence[k]||[])]});
  else if(missing(old.values[k]))old.values[k]=v;
  old.evidence[k]=[...(old.evidence[k]||[]),...(s.evidence[k]||[])];
 }
 old.sources=[...new Set([...old.sources,...s.sources])];old.issues.push(...s.issues);
}
function analyze(files,sites){
 const grouped=[];
 // Sort for stable candidate identifiers after a resumed analysis.
 for(const file of [...files].filter(f=>!f.error).sort((a,b)=>text(a.id).localeCompare(text(b.id))))for(const s of parseUnits(file)){
  const sameRecord=grouped.filter(x=>!missing(s.values.recordNo)&&norm(x.values.recordNo)===norm(s.values.recordNo));
  const sameERP=grouped.filter(x=>!missing(s.values.erpRef)&&norm(x.values.erpRef)===norm(s.values.erpRef));
  const sameIdentity=grouped.filter(x=>sameIncidentIdentity(x.values,s.values));
  const refs=sameRecord.length?sameRecord:sameERP;
  let matches=sameIdentity;
  // A uniquely addressed supplementary document may have no full accident narrative.
  if(!matches.length&&refs.length===1&&!identityConflict(refs[0].values,s.values)&&(!s.values.incidentHow||!refs[0].values.incidentHow))matches=refs;
  if(matches.length===1){mergeInto(matches[0],s);continue;}
  if(refs.length||matches.length>1){
   const issue={code:'duplicate_reference',message:'같은 문서번호에 다른 사고가 있거나 연결 대상이 불명확합니다. 사고별 원문을 비교해 주세요.'};
   s.issues.push(issue);for(const x of refs)x.issues.push({...issue});
  }
  grouped.push(s);
 }
 return grouped.map((s,n)=>{
  let matches=sites.filter(x=>norm(x.site_name||x.name)===norm(s.values.siteName));
   if(!matches.length){
    const refs=files.filter(f=>s.sources.includes(f.id)),hits=[];
    for(const f of refs)for(const u of f.units||[]){
     if(!u.text||(u.method||f.method)!=='ocr')continue;
     for(const site of sites){
      const name=norm(site.site_name||site.name);
      if(name.length<4)continue;
      const line=text(u.text).split(/\r?\n/).find(x=>norm(x).includes(name));
      if(line)hits.push({site,line,fileId:f.id,location:u.location||'OCR'});
     }
    }
    const ids=[...new Set(hits.map(x=>x.site.site_id||x.site.id))];
    if(ids.length===1){
     const hit=hits.find(x=>(x.site.site_id||x.site.id)===ids[0]);
     s.values.siteName=hit.site.site_name||hit.site.name;
     s.evidence.siteName=[...(s.evidence.siteName||[]),{fileId:hit.fileId,location:hit.location,quote:hit.line,method:'ocr'}];
     matches=[hit.site];
    }
   }
   if(matches.length===1)s.values.siteId=matches[0].site_id||matches[0].id;
  const hasPerson=presentDamage(s.values.injuryDetail),hasProperty=presentDamage(s.values.damageDetail)||presentDamage(s.values.damagedItem);
  if(hasPerson&&hasProperty){
   s.values.category='mixed';s.evidence.category=[...(s.evidence.category||[]),...(s.evidence.injuryDetail||[]),...(s.evidence.damageDetail||s.evidence.damagedItem||[])];
   s.issues.push({code:'mixed',message:'인적·물적 피해가 함께 있습니다. 한 사고로 유지하고 주 분류와 두 피해내용을 확인해 주세요.'});
  }else if(!s.values.category&&(hasPerson||hasProperty)){s.values.category=hasPerson?'person':'property';s.evidence.category=s.evidence[hasPerson?'injuryDetail':presentDamage(s.values.damageDetail)?'damageDetail':'damagedItem'];}
  else if(s.values.category==='person'&&hasProperty||s.values.category==='property'&&hasPerson)s.issues.push({code:'category_conflict',message:'사고 분류와 기재된 피해가 다릅니다. 주 분류와 피해내용을 확인해 주세요.'});
  const c={...s,id:`candidate-${n+1}`,state:'review',revision:0,corrections:[]};c.validation=validate(c,sites);c.state=c.validation.length?'review':'ready';return c;
 });
}
function money(v){if(missing(v))return null;const s=text(v).replace(/^(?:₩|KRW)\s*/i,'').replace(/\s*원$/,'').replace(/\s/g,'');if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s))return NaN;const n=Number(s.replace(/,/g,''));return Number.isFinite(n)&&n<=Number.MAX_SAFE_INTEGER?n:NaN;}
function validate(c,sites,today=seoulToday()){
 const v=c.values||{},issues=(c.issues||[]).filter(i=>!(c.resolvedCodes||[]).includes(i.code)),add=(field,message,code='missing')=>issues.push({field,code,message});
 for(const k of ['eventType','place','workAction','incidentHow','immediateAction'])if(missing(v[k]))add(k,`${labels[k]||'사업장'}을 원본에서 확인해 주세요.`);
 if(!sites.some(s=>(s.site_id||s.id)===v.siteId))add('siteId','사업장 명칭을 실제 사업장 목록에서 확정해 주세요.','site');
 if(!date(v.occurredDate)||date(v.occurredDate)>today)add('occurredDate','실제 발생일을 확인해 주세요. 미래 날짜는 등록할 수 없습니다.','date');
 if(!missing(v.occurredTime)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.occurredTime))add('occurredTime','발생시간은 HH:mm 또는 미상이어야 합니다.','time');
 if(!['person','property'].includes(v.category))add('category','대인/대물 주 분류를 확인해 주세요. 혼합 피해를 두 사고로 만들지 않습니다.','category');
 if(!['minor','moderate','major'].includes(v.severity))add('severity','사고정도(경미/보통/중대)를 원문 또는 확인 근거로 입력해 주세요.','severity');
 for(const k of v.category==='person'?['name','injuryDetail']:v.category==='property'?['damagedItem','damageDetail']:[])if(missing(v[k]))add(k,`${labels[k]} 확인이 필요합니다.`);
 for(const k of ['cost','medicalCost','repairCost','damageAmount'])if(!missing(v[k])&&!Number.isFinite(money(v[k])))add(k,`${labels[k]}는 확인된 0 이상의 숫자 또는 미확인으로 표시해 주세요.`,'cost');
 if(!['승인','승인완료','결재완료','approved'].includes(norm(v.erpStatus)))add('erpStatus','ERP 최초 보고의 최종 결재 완료 근거가 필요합니다.','erp');
 if(missing(v.erpRef)&&missing(v.erpDate))add('erpRef','ERP 문서번호 또는 결재일을 확인해 주세요.','erp');
 if(!missing(v.erpDate)&&(!date(v.erpDate)||date(v.erpDate)>today))add('erpDate','ERP 결재일을 확인해 주세요.','date');
 if(date(v.erpDate)&&date(v.occurredDate)&&date(v.erpDate)<date(v.occurredDate))add('erpDate','ERP 결재일이 사고발생일보다 빠릅니다. 원문 날짜와 문서 연결을 확인해 주세요.','date');
 if(!Array.isArray(c.sources)||!c.sources.length)add('sources','비공개 원본자료 연결이 필요합니다.','evidence');
 for(const k of Object.keys(v).filter(k=>k!=='siteId'&&!missing(v[k]))){
  const evidence=c.evidence?.[k]?.some(e=>text(e.quote)&&text(e.location)&&c.sources?.includes(e.fileId));
  const correction=(c.corrections||[]).some(e=>e.field===k&&text(e.reason));
  if(!evidence&&!correction)add(k,`${labels[k]||k}의 원문 근거 또는 보완 근거가 필요합니다.`,'evidence');
 }
 return issues;
}
function details(v){
 const generic=money(v.cost),medical=missing(v.medicalCost)?(v.category==='person'?generic:null):money(v.medicalCost),repair=missing(v.repairCost)?(v.category==='property'?generic:null):money(v.repairCost);
 return {templateVersion:'historical-bulk-v1',reportType:v.category,place:v.place,workAction:v.workAction,incidentHow:v.incidentHow,environmentCause:v.cause||'',behaviorCause:'',preventionPlan:'',injuredName:presentDamage(v.injuryDetail)?v.name||'':'',workerName:v.category==='property'?v.name||'':'',job:v.job||'',injuryDetail:v.injuryDetail||'',damagedItem:v.damagedItem||'',damageDetail:v.damageDetail||'',diagnosis:v.diagnosis||'',doctorOpinion:v.doctorOpinion||'',medicalCost:medical,repairCost:repair,damageAmount:money(v.damageAmount),medicalCostDetail:v.medicalCostDetail||'',repairCostDetail:v.repairCostDetail||'',followupNote:v.followupNote||'',medicalCostKnown:medical!==null,repairCostKnown:repair!==null,repairCostPending:repair===null,costKnown:medical!==null||repair!==null||money(v.damageAmount)!==null};
}
function incidentFields(v){const time=missing(v.occurredTime)?null:v.occurredTime,day=date(v.occurredDate)||v.occurredDate;return {siteId:v.siteId,category:v.category,eventType:v.eventType,severity:v.severity,occurredAt:time?`${day}T${time}:00+09:00`:day,occurredDate:day,occurrenceTimeKnown:time!==null,occurredTime:time,summary:v.incidentHow,immediateAction:v.immediateAction,injuredName:presentDamage(v.injuryDetail)?v.name||'':'',job:v.job||'',leaveEstimate:v.leaveEstimate||'unknown'};}
function makeIncident(c,batchId,actor,at,id){
 const v=c.values;return {id,...incidentFields(v),potentialMajor:false,priority:v.severity==='major'?'urgent':v.category==='person'||v.severity==='moderate'?'important':'normal',status:'approved',corrective:null,approvedAt:null,approvedBy:'',closedAt:null,reporterId:'',reporterName:v.originalReporter||'',createdAt:at,registeredAt:at,updatedAt:at,acknowledgements:[],photos:[],reportDetails:details(v),historicalOrigin:{version:1,type:'bulk_ai_import',batchId,candidateId:c.id,recordNo:v.recordNo||'',sourceFileIds:[...c.sources]},externalInitialApproval:{source:'ERP',state:'verified',documentNo:v.erpRef||null,approvalDate:missing(v.erpDate)?null:date(v.erpDate),verifiedBy:actor.id,verifiedAt:at},officialRecord:{externalInitialApprovalVerification:{action:'external_erp_initial_approval_verified',actorId:actor.id,at,source:'ERP',documentNo:v.erpRef||null,approvalDate:missing(v.erpDate)?null:date(v.erpDate)}},reportWorkflow:{phase:'report_approved',initialApprovalSource:'ERP'},_syncBaseVersion:0,_syncMutationId:`bulk:${batchId}:${c.id}`};
}
function valuesFromIncident(existing,originalValues={}){
 const d=existing.reportDetails||{},v={...originalValues},assign=(k,x)=>{if(x!==undefined&&x!==null)v[k]=String(x);};
 for(const k of ['siteId','category','eventType','severity','occurredTime','job','leaveEstimate'])assign(k,existing[k]);
 assign('occurredDate',existing.occurredDate||String(existing.occurredAt||'').slice(0,10));
 if(existing.occurrenceTimeKnown===false)v.occurredTime='';
 assign('incidentHow',d.incidentHow??existing.summary);assign('immediateAction',existing.immediateAction);
 assign('name',existing.category==='property'?(d.workerName||d.injuredName||existing.injuredName):(d.injuredName??existing.injuredName));
 assign('cause',d.environmentCause);assign('originalReporter',existing.reporterName);
 for(const k of ['place','workAction','injuryDetail','damagedItem','damageDetail','diagnosis','doctorOpinion','medicalCost','repairCost','damageAmount','medicalCostDetail','repairCostDetail','followupNote']){
  if(Object.prototype.hasOwnProperty.call(d,k))v[k]=d[k]===null?'':String(d[k]);
 }
 return v;
}
function patchIncident(existing,values,actor,at){
 // Auth, importer-origin scope, current revision and audit logging are enforced by the caller.
 const result=JSON.parse(JSON.stringify(existing)),v=values,nextDetails=details(v);
 Object.assign(result,incidentFields(v),{updatedAt:at});
 // Imported facts must never reset prevention, approvals, ERP verification, sources, void state or attachments.
 delete nextDetails.templateVersion;delete nextDetails.behaviorCause;delete nextDetails.preventionPlan;
 result.reportDetails={...(existing.reportDetails||{}),...nextDetails};
 result.reporterName=v.originalReporter||'';
 return result;
}
return {fields,labels,text,norm,missing,date,money,parseUnits,sameIncidentIdentity,analyze,validate,makeIncident,valuesFromIncident,patchIncident};
});
