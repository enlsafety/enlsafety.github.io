const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const fixture = {
  id:'SAMPLE-20261023-01', siteId:'sample-site', category:'person', status:'reported',
  occurredAt:'2026-10-23T01:20:00.000Z', reporterName:'김현장 (예시)',
  eventType:'베임', leaveEstimate:'under3', severity:'minor',
  immediateAction:'작업을 중지하고 상처를 지혈한 뒤 병원으로 이동함.',
  reportDetails:{place:'A코스 3홀 우측 경사면', injuredName:'홍길동 (예시)', job:'코스관리',
    workAction:'경사면의 칡넝쿨을 낫으로 제거하고 있었음.',
    incidentHow:'넝쿨을 잡고 낫질하던 중 왼쪽 엄지손가락이 낫에 닿아 베임.',
    injuryDetail:'왼쪽 엄지손가락 약 2cm 베임.', diagnosis:'엄지손가락 열상', medicalCost:50000,
    causeAnalysisStatus:'investigating', environmentCause:'넝쿨이 얽혀 작업공간이 좁았음.',
    preventionPlan:'작업 전 손 위치와 절단 방향을 확인하고 작업방법을 다시 교육할 예정.',
    specialNote:'양식 확인을 위한 가상 사고입니다.'},
  corrective:{status:'pending', ownerName:'김현장 (예시)', dueDate:'2026-10-25'}
};
function context(document) {
  const scope = {window:{}, TextEncoder, Uint8Array, Uint32Array, DataView, Blob, console};
  if (document) Object.assign(scope,document);
  vm.createContext(scope);
  for (const file of ['incident-excel-v421.js','incident-one-page-excel-v471.js']) vm.runInContext(fs.readFileSync(file,'utf8'),scope,{filename:file});
  scope.window.siteById = () => ({name:'예시 골프장'});
  return scope;
}
function unzip(bytes) {
  const b = Buffer.from(bytes), files = {};
  let p = 0;
  while (b.readUInt32LE(p) === 0x04034b50) {
    assert.equal(b.readUInt16LE(p+8),0);
    const size=b.readUInt32LE(p+18),nameLen=b.readUInt16LE(p+26),extra=b.readUInt16LE(p+28);
    const name=b.toString('utf8',p+30,p+30+nameLen),start=p+30+nameLen+extra;
    files[name]=b.toString('utf8',start,start+size); p=start+size;
  }
  return files;
}
const scope=context();
const build=i=>scope.window.enlBuildOnePageIncidentWorkbook(i);
const main=bytes=>unzip(bytes)['xl/worksheets/sheet1.xml'];
const normal=build(fixture),xml=main(normal);
assert.match(xml,/paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/);
assert.match(xml,/dimension ref="A1:L45"/);
assert.match(xml,/left="0.47244" right="0.47244" top="0.47244" bottom="0.47244"/);
assert.match(xml,/<col min="1" max="12" width="7.5"/);
assert.match(xml,/사고보고서/);assert.match(xml,/승인 전/);assert.doesNotMatch(xml,/승인 완료/);
assert.match(xml,/<c r="I10" s="7"><v>50000<\/v>/);
const timeCell=Number(xml.match(/<c r="I6" s="6"><v>([^<]+)/)[1]);
assert.ok(Math.abs((timeCell%1)-(10+20/60)/24)<0.000001,'Korean 10:20 irrespective of computer timezone');
assert.doesNotMatch(unzip(normal)['xl/workbook.xml'],/내용 전문/,'ordinary report should fit without extra sheets');

const property=structuredClone(fixture);
property.category='property';property.reportDetails={place:'주차장',workerName:'홍길동',job:'장비 운전',damagedItem:'안내판',damageDetail:'안내판 하단 찌그러짐',repairCost:0,workAction:'작업차량 이동',incidentHow:'차량이 안내판에 닿음'};
assert.match(main(build(property)),/<c r="I10" s="7"><v>0<\/v>/,'confirmed zero is not missing');
property.reportDetails.repairCostPending=true;
assert.match(main(build(property)),/사후 보완 예정/);
const medicalPending=structuredClone(fixture);medicalPending.reportDetails.medicalCost=0;medicalPending.reportDetails.medicalCostPending=true;
assert.match(main(build(medicalPending)),/사후 보완 예정/);
const progressing=structuredClone(fixture);progressing.corrective.status='in_progress';
assert.match(main(build(progressing)),/조치 진행 중/);
property.occurrenceTimeKnown=false;property.occurredDate='2020-03-03';
assert.match(main(build(property)),/2020-03-03.*시간 미확인/s);
assert.doesNotMatch(main(build(property)),/<c r="I6" s="6">/);

const long=structuredClone(fixture);
long.reportDetails.incidentHow='=HYPERLINK("https://example.invalid") & <원문>\n'+Array.from({length:40},(_,n)=>`원문 ${n+1}: 긴 사고경위는 빠짐없이 보존됩니다.`).join('\n');
const longBytes=build(long),longZip=unzip(longBytes);
assert.match(longZip['xl/workbook.xml'],/내용 전문/);
assert.match(longZip['xl/worksheets/sheet1.xml'],/전문 1/);
assert.match(longZip['xl/worksheets/sheet2.xml'],/원문 40/);
assert.match(longZip['xl/worksheets/sheet2.xml'],/&amp; &lt;원문&gt;/);
assert.doesNotMatch(longZip['xl/worksheets/sheet2.xml'],/<f[ >]/,'user text must not become executable formulas');

const history=structuredClone(fixture);
history.historicalImport={workflowExempt:true,existingActionNote:'과거자료 확인 중'};
assert.match(main(build(history)),/과거자료 이관/);
assert.doesNotMatch(main(build(history)),/승인 전/);
const pending=structuredClone(fixture);delete pending.occurredAt;delete pending.reportDetails.medicalCost;
assert.match(main(build(pending)),/<c r="I10" s="4" t="inlineStr"><is><t xml:space="preserve">미확인/);

// Exercise the actual download path with popup opening forbidden and role changes.
const urls=[],clicks=[],revoked=[],alerts=[],timers=[];
scope.data={incidents:[fixture]};
scope.window.currentUser=()=>({id:'field',role:'field'});
scope.window.enlCanViewIncidentOriginal=()=>true;
scope.window.open=()=>{throw Error('popup forbidden')};
scope.alert=message=>alerts.push(message);
scope.URL={createObjectURL:blob=>{urls.push(blob);return 'blob:qa';},revokeObjectURL:url=>revoked.push(url)};
scope.document={createElement:()=>({style:{},click(){clicks.push(this.download)},remove(){}}),body:{appendChild(){}}};
scope.setTimeout=(fn,ms)=>timers.push({fn,ms});
const button={disabled:false,textContent:'엑셀 사고보고서 출력'};
scope.window.enlDownloadOnePageIncidentExcel(fixture.id,button);
assert.equal(clicks.length,1);assert.match(clicks[0],/2026-10-23.*\.xlsx$/);
assert.equal(alerts.length,0);assert.equal(button.disabled,false);
assert.equal(timers[0].ms,60000);timers[0].fn();assert.deepEqual(revoked,['blob:qa']);
scope.window.enlCanViewIncidentOriginal=()=>false;
scope.window.enlDownloadOnePageIncidentExcel(fixture.id,button);
assert.equal(clicks.length,1);assert.match(alerts.pop(),/권한/);
scope.window.enlCanViewIncidentOriginal=()=>true;
scope.document.createElement=()=>({style:{},click(){throw Error('download failed')},remove(){}});
scope.window.enlDownloadOnePageIncidentExcel(fixture.id,button);
assert.equal(revoked.length,2);assert.equal(button.disabled,false);

if (process.env.QA_OUTPUT) {
  const dir=path.resolve(process.env.QA_OUTPUT);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'사고보고서_출력예시.xlsx'),normal);
  fs.writeFileSync(path.join(dir,'long-report.xlsx'),longBytes);
  fs.writeFileSync(path.join(dir,'property-report.xlsx'),build(property));
  fs.writeFileSync(path.join(dir,'sample.json'),JSON.stringify(fixture));
}
console.log('PASS A4 dimensions, Korean time, all report states, costs, long-text preservation, formula safety, role checks, popup-free download and cleanup');
module.exports={fixture};
