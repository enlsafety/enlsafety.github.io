const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={addEventListener(){}};vm.runInNewContext(fs.readFileSync('incident-analysis.js','utf8'),{window,console,Date,Map,Set,Number,String});
const a=window.ENLIncidentAnalysis;
const base={status:'reported',category:'person',eventType:'넘어짐',siteId:'s1',occurredAt:'2026-01-31T16:00:00Z',reportDetails:{medicalCost:1000,medicalCostPending:false}};
const items=[{...base,id:'one'},{...base,id:'two',category:'property',eventType:'설비/시설 파손',reportDetails:{repairCost:5000,repairCostPending:true}},
 {...base,id:'draft',status:'draft'},{...base,id:'void',bulkInvalidation:{active:true}},{...base,id:'three',occurredAt:'not-a-date',reportDetails:{}},
 {...base,id:'one',_syncVersion:2,reportDetails:{medicalCost:2000,medicalCostPending:false}}];
const s=a.summarize(items);
assert.equal(s.total,3);assert.equal(s.person,2);assert.equal(s.property,1);assert.equal(s.cost,2000);assert.equal(s.knownCost,1);assert.equal(s.missingDate,1);assert.equal(s.months[0].label,'2026-02');assert.equal(s.months[0].count,2);
assert.equal(a.summarize(items,'2026').total,2);assert.equal(a.summarize(items,'2026').months.length,12);assert.equal(a.summarize(items,'2026','absent').total,0);
assert.equal(a.dateKey({occurredAt:'2026-02-31'}),'');assert.equal(a.dateKey({occurredAt:'2026-06-30T15:00:00Z'}),'2026-07-01');
assert.equal(a.cost({...base,reportDetails:{medicalCost:0}}),null);assert.equal(a.cost({...base,reportDetails:{medicalCost:0,medicalCostPending:false}}),0);
assert.equal(a.cost({...base,reportDetails:{medicalCost:'1,234'}}),1234);assert.equal(a.cost({...base,reportDetails:{medicalCost:-1}}),null);
assert.equal(a.cost({...base,reportDetails:{medicalCost:100,medicalCostKnown:false}}),null);
for(const role of ['field','worker','admin',''])assert.equal(a.canRead({role}),false);
for(const role of ['manager','executive','safety','final'])assert.equal(a.canRead({role}),true);
assert.equal(a.summarize([]).total,0);assert.equal(a.summarize([]).cost,0);
console.log('PASS analysis totals, deduplication, void/draft exclusions, Korea dates, cost completeness, filters and roles');
