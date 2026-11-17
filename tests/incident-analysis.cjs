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
const split=a.summarize([
 {...base,id:'person',reportDetails:{medicalCost:'1,234'}},
 {...base,id:'property',category:'property',reportDetails:{repairCost:5000}},
 {...base,id:'unknown',category:'property',reportDetails:{repairCost:8000,repairCostPending:true}},
 {...base,id:'zero',reportDetails:{medicalCost:0,medicalCostKnown:true}}
],'2026');
assert.equal(split.personCost,1234);assert.equal(split.propertyCost,5000);assert.equal(split.cost,6234);
assert.equal(split.knownPersonCost,2);assert.equal(split.knownPropertyCost,1);
assert.match(a.costBreakdown(split),/대인.*1,234원.*대물.*5,000원/);
assert.match(a.costBreakdown(a.summarize([])),/대인.*미확인.*대물.*미확인/);
assert.equal((a.detailHtml(split,true).match(/data-stats-month=/g)||[]).length,12);
assert.equal((a.detailHtml(split,false).match(/data-stats-month=/g)||[]).length,0);
console.log('PASS cost split, unknown and confirmed zero, shared month drill rendering');
