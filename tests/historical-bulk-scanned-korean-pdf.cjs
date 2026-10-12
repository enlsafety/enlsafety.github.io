'use strict';
// Synthetic scanned Korean accident report. No actual incident or personal
// information is committed in this public-repository regression fixture.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('../historical-bulk-core-v454.js');
const sites=[{site_id:'s1',site_name:'해솔골프장'},{site_id:'s2',site_name:'가상연구소'}];
const file={id:'synthetic-pdf-1',name:'스캔 경위서.pdf',method:'ocr',units:[
 {location:'1페이지',method:'ocr',confidence:85,text:[
  '사고경위서',
  '보고자        성             191           보고일자       2025.07.14',
  '이앤엘 해솔골프장',
  '카트 풍우막 훼손',
  '사고일자                          2025.07.14',
  '사고장소                          89흘 카트로',
  '카트 교차 중 적재물(나뭇가지)에 의한 카트 풍우막 훼손',
  '7월 14일 16시 40분경 R7홀에서 가지를 수거하여 관리동으로 복귀하',
  '던 중 R9홀 카트로에 정차 중인 카트와 교차 시 적재함의 가지로',
  '발생경위 카트 풍우막이 찢어짐.',
  '피해정도                  캐디 카트 풍우막 파손 (견적서 첨부)',
  '폐가지를 수거할 때 적재함 규격을 넘어가지 않도록 주의를 기울이겠습니다.',
  '조치방안 |더 기울이며 차후 유사 사고를 예방하겠습니다.',
  '회사에서 풍우막 구매를 진행하여 지급 예정',
  '위와 같이 사고경위서를 제출합니다.',
 ].join('\n')},
 {location:'2페이지',method:'ocr',confidence:70,text:[
  '견 적 서',
  '2025년 7월 15일',
  '이앤엘 귀하',
  '합계금액 십삼만오천칠백원 (W 135,700 )',
  '(공급가액+세액)'
 ].join('\n')},
 {location:'3페이지',method:'ocr',confidence:40,text:'## eeeee\n바ㅂ = ='},
]};
const candidates=Core.analyze([file],sites);
assert.equal(candidates.length,1,'multiple scanned pages must form one accident, not 3 ghost records');
const c=candidates[0],v=c.values;
assert.equal(v.siteId,'s1','unique site-master name in an unlabeled OCR row is matched');
assert.equal(v.occurredDate,'2025-07-14','accident date, not quote date');
assert.equal(v.occurredTime,'16:40');
assert.equal(v.category,'property','damaged cart curtain is a property accident');
assert.equal(v.eventType,'훼손');
assert.equal(v.title,'카트 풍우막 훼손');
assert.ok(v.place.includes('카트로'),'OCR mistakes must remain visible for review');
assert.ok(v.incidentHow.includes('16:40경'));
assert.ok(v.incidentHow.includes('수거해 관리동으로 복귀하던 중'));
assert.ok(v.incidentHow.includes('다른 카트와 교차'));
assert.ok(v.incidentHow.includes('나뭇가지'));
assert.ok(v.incidentHow.length<190,'automatic incident narrative should be a concise report sentence');
assert.equal(c.summaryMeta?.kind,'ocr_evidence_summary');
assert.ok(c.evidence.incidentHow.some(x=>x.quote.includes('발생경위')),'narrative evidence must preserve actual source lines');
assert.ok(v.workAction.includes('수거하여'));
assert.ok(v.damagedItem.includes('풍우막'));
assert.ok(v.damageDetail.includes('파손'));
assert.equal(v.repairCost,'135,700','quote grand total extracted as prospective repair cost');
assert.ok(v.followupNote.includes('적재함 규격'));
assert.ok(v.followupNote.includes('구매를 진행하여 지급 예정'));
assert.ok(!v.followupNote.includes('사고경위서를 제출합니다'),'footer must not contaminate mitigation plan');
for(const x of ['immediateAction','severity','erpStatus','erpRef','erpDate'])assert.ok(Core.missing(v[x]),x+' must not be invented');
assert.equal(c.state,'review','no OCR auto-registration');
for(const x of ['ocr','severity','erp'])assert.ok(c.validation.some(issue=>issue.code===x),x+' warning must remain');
assert.ok(c.validation.some(issue=>issue.field==='immediateAction'),'actual immediate action still missing');
assert.equal(c.validation.filter(issue=>issue.field==='severity').length,1,'no duplicate severity warnings');
assert.ok(!c.validation.some(issue=>issue.field==='siteId'||issue.field==='occurredDate'),'no repeated false missing warnings');
for(const key of ['siteName','occurredDate','incidentHow','damageDetail','repairCost','followupNote']) {
 const refs=c.evidence[key]||[];
 assert.ok(refs.length>0,key+' source evidence missing');
 assert.ok(refs.every(e=>e.fileId===file.id&&e.method==='ocr'));
}
assert.ok(c.evidence.repairCost.some(e=>String(e.location).includes('2페이지')));
assert.ok(c.evidence.incidentHow.some(e=>String(e.location).includes('1페이지')));
// Deliberately garble the scanned narrative: readable short causal line
// plus corrupt paragraph fragments must still yield clean report prose.
const garbled={...file,id:'synthetic-noisy-2',units:[{...file.units[0],text:file.units[0].text
 .replace('R7홀에서 가지를 수거하여','07훌에서 URINE 수거하여')
 .replace('R9홀 카트로에 정차 중인 카트','ROE 카트로에 정차중이던 카트')
 .replace('적재함의 가지로','적재함에서 삐져나온 LIRIK')
 .replace('카트 풍우막이 찢어짐.','카트 품우막이 HOI.')
 .replace('적재물(나뭇가지)','적재물(나못가지)')},...file.units.slice(1)]};
const noisy=Core.analyze([garbled],sites)[0];
assert.ok(noisy.values.incidentHow.includes('16:40경'));
assert.ok(noisy.values.incidentHow.includes('나뭇가지'));
assert.ok(noisy.values.incidentHow.includes('적재함 밖으로 돌출된'));
assert.ok(!/URINE|ROE|LIRIK|HOI/.test(noisy.values.incidentHow));
assert.ok(noisy.evidence.incidentHow.some(e=>/URINE|LIRIK/.test(e.quote)),'bad OCR retained for source comparison');
assert.equal(noisy.values.repairCost,'135,700');
assert.equal(noisy.state,'review','OCR must not bypass verification');
const noQuote=Core.analyze([{...file,units:[file.units[0],file.units[2]]}],sites)[0];
assert.ok(Core.missing(noQuote.values.repairCost),'no amount should be fabricated without quote');
assert.equal(noQuote.values.category,'property');
const plain=Core.analyze([{id:'text-form',method:'text',units:[{location:'시트1',rows:[
['사업장명','사고일','사고구분','사고유형','사고정도','사고장소','당시작업','사고경위','당시조치','파손물품','파손내용','ERP문서번호','ERP결재일','ERP결재상태'],
['해솔골프장','2025-05-11','대물','파손','경미','관리동','카트 정비','수리 중 기물 파손','작업 중지','유리창','유리창 파손','QA-ERP-11','2025-05-12','결재완료']
]}]}],sites)[0];
assert.equal(plain.state,'ready','ordinary structured spreadsheet must retain existing behavior');
assert.equal(plain.validation.length,0);
assert.equal(fs.readFileSync('historical-bulk-core-v454.js','utf8'),fs.readFileSync('edge-functions/enl-historical-bulk-v454/historical-bulk-core.js','utf8'));
console.log('PASS: multi-page Korean scanned form, exact observed facts, site identification, property loss, embedded quote, no fake ERP approval or immediate response, structured Excel regression');
