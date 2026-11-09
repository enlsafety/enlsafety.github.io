const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let code=fs.readFileSync('site-dashboard-v450.js','utf8');
code=code.slice(0,code.indexOf('const base=window.renderShell'))+'window.test={mapHtml,summary,marker,color,spreadPoints,canDashboard,risk,pos,rows,dashboardRows,master,cnt,mapXY,info,setMasters:v=>{masters=v;loaded=true;window.ENLContracts.setSites(v)}};})();';
const ctx={data:{sites:[],incidents:[]},Date,console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('site-contract-v451.js','utf8'),ctx);vm.runInContext(code,ctx);
const t=ctx.window.test,y=new Date().getFullYear();
const incident=(extra={})=>({siteId:'s01',occurredAt:`${y}-05-01`,status:'reported',...extra});
ctx.data.incidents=[incident({occurredAt:`${y-1}-12-01`,priority:'urgent'})];
assert.equal(t.risk('s01').level,'안전');
assert.equal(t.risk('s01').count,0);
assert.match(t.summary('s01'),/현재 미종결 1건/);
assert.match(t.summary('s01'),/미종결 긴급 관리등급/);
ctx.data.incidents[0].recordMode='historical_transfer';
assert.doesNotMatch(t.summary('s01'),/미종결 긴급 관리등급/);
ctx.data.incidents=Array.from({length:4},()=>incident({status:'closed'}));assert.equal(t.risk('s01').high,false);ctx.data.incidents.push(incident({status:'closed'}));assert.equal(t.risk('s01').high,true,'5 current-year accidents');
// Include this year's personal and property accidents, including closed transfers.
ctx.data.incidents=[
 incident({category:'person'}), incident({category:'property'}),
 incident({category:'property',status:'closed',recordMode:'historical_transfer'}),
 incident({category:'person',historicalImport:{enabled:true}}),
 incident({category:'property',occurredAt:`${y-1}-12-01`,recordMode:'historical_transfer'}),
 incident({siteId:'other',category:'person'})
];
assert.equal(t.risk('s01').count,4);
assert.equal(t.risk('s01').level,'주의');
ctx.data.incidents.push(incident({category:'person',status:'closed',historicalTransfer:{mode:'historical_transfer'}}));
assert.equal(t.risk('s01').count,5);
assert.equal(t.risk('s01').level,'고위험');
assert.match(t.mapHtml(),/안전: 올해 사고 0건[\s\S]*일반: 올해 사고 1~2건[\s\S]*주의: 올해 사고 3~4건[\s\S]*고위험: 올해 사고 5건/);
for(const extra of [{severity:'major'},{potentialMajor:true},{priority:'urgent'},{severity:'major',potentialMajor:true,priority:'urgent',leaveEstimate:'fatal'}]){
 ctx.data.incidents=[incident({category:'person',...extra})];
 assert.equal(t.risk('s01').level,'일반');
 assert.equal(t.color('s01'),'#20252b');
 ctx.data.incidents[0].status='closed';
 assert.equal(t.risk('s01').level,'일반');
}
// Regression for the reported single-fracture / manually important case. No personal data.
ctx.data.incidents=[incident({siteId:'s27',status:'approved',severity:'major',priority:'important',prioritySource:'manual',potentialMajor:false,pastReport:{drafterName:'fixture'}})];
assert.equal(t.risk('s27').level,'일반');assert.equal(t.color('s27'),'#20252b');assert.match(t.summary('s27'),/위험도: 일반/);assert.doesNotMatch(t.summary('s27'),/미종결 긴급 관리등급/);
assert.match(t.mapHtml(),/고위험: 올해 사고 5건 이상<\/span>/);assert.doesNotMatch(t.mapHtml(),/또는 중대재해/);
console.log('PASS: major injury and potential flags do not elevate a manually important accident; annual count determines map color');
ctx.window.ENL_SITE_MASTER_SEED=[{site_id:'s01',site_name:'검증',address:'주소',regular_count:3,daily_count:2}];ctx.data.sites=[{id:'s01',name:'검증'}];assert.equal(t.master('s01').address,'주소','undefined local field must not erase seed');
t.setMasters([{site_id:'s01',active:false}]);assert.equal(t.rows().length,1,'closed site remains available for history');assert.equal(t.dashboardRows().length,0);t.setMasters([]);assert.equal(t.rows().length,0,'successful empty server response is authoritative');
ctx.window.ENL_SITE_LOCATIONS={s01:{address:'주소',lat:35.4,lon:126.8}};assert.ok(t.pos({site_id:'s01',address:'주소'}));assert.equal(t.pos({site_id:'s01',address:'이전된 주소'}),null);assert.equal(t.pos({site_id:'s99',region:'서울'}),null);
const [x,j]=t.mapXY(33.33834117,126.348717);assert.ok(x>0&&x<100&&j>70&&j<100,'Jeju in viewport');
ctx.window.ENL_SITE_MASTER_SEED[0].site_name='<img onerror=alert(1)>';assert.ok(!t.info('s01').includes('<img'));
vm.runInContext(fs.readFileSync('site-locations-v450.js','utf8'),ctx);for(const p of Object.values(ctx.window.ENL_SITE_LOCATIONS)){assert.ok(p.source.startsWith('https://'));assert.ok(p.address);assert.ok(p.lat>33&&p.lat<39&&p.lon>124&&p.lon<132)}
t.setMasters([{site_id:'s01',site_name:'운영 사업장',active:true,address:'주소'},{site_id:'s34',site_name:'파주CC',active:false}]);assert.equal(t.rows().length,2,'ended site retained for historical lookup');assert.equal(t.dashboardRows().length,1,'ended site excluded from current dashboard');assert.equal(t.master('s34').site_name,'파주CC');
assert.equal(Object.keys(ctx.window.ENL_SITE_LOCATIONS).length,34);assert.ok(ctx.window.ENL_SITE_LOCATIONS.s34);
console.log('PASS: risk boundaries, historical exclusion, inactive records, address invalidation, escaping and coordinate bounds');

for(const role of ['safety','manager','executive','final'])assert.equal(t.canDashboard({role}),true);
for(const role of ['field','worker',''])assert.equal(t.canDashboard({role}),false);
assert.equal(t.canDashboard({role:'manager',active:false}),false);
for(const width of [280,600]){
 const points=Object.entries(ctx.window.ENL_SITE_LOCATIONS).map(([id,p])=>{const [x,y]=t.mapXY(p.lat,p.lon);return {id,x:x*width/100,y:y*width/100}}),before=JSON.stringify(points),spread=t.spreadPoints(points);
 assert.equal(JSON.stringify(points),before,'address projection must remain unchanged');
 spread.forEach((p,i)=>{if(points.every(q=>q.id===p.id||Math.hypot(q.x-points[i].x,q.y-points[i].y)>=9))assert.equal(JSON.stringify(p),JSON.stringify(points[i]),'isolated points must not move');assert.ok(Math.hypot(p.x-points[i].x,p.y-points[i].y)<=24.001);spread.slice(0,i).forEach(q=>assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=8.99,`${p.id} and ${q.id} overlap`))});
}
console.log('PASS: all 33 markers separated on desktop/mobile without coordinate mutation; HQ roles');

const close=[{id:'a',x:10,y:10},{id:'b',x:11,y:10},{id:'c',x:40,y:40}],sp=t.spreadPoints(close);
assert.equal(sp[0].x,10);assert.ok(Math.hypot(sp[1].x-11,sp[1].y-10)<=9.5,'minimal displacement for a close pair');assert.equal(JSON.stringify(sp[2]),JSON.stringify(close[2]));
console.log('PASS: only heavily overlapping points move; already distinct points stay exactly fixed');

ctx.ENLContracts.setSites([{site_id:'s01',active:true}]);
for(const [n,level,color] of [[0,'안전','#219653'],[1,'일반','#20252b'],[2,'일반','#20252b'],[3,'주의','#e88918'],[4,'주의','#e88918'],[5,'고위험','#d83f45'],[6,'고위험','#d83f45']]){ctx.data.incidents=Array.from({length:n},()=>incident());assert.equal(t.risk('s01').level,level);assert.equal(t.color('s01'),color)}
console.log('PASS: 0 green; 1/2 black; 3/4 orange; 5/6 red; open urgent status is independent of the map color');

ctx.data.incidents=Array.from({length:6},()=>incident({siteId:'s34',priority:'urgent'}));assert.equal(t.risk('s34').high,false);assert.equal(t.color('s34'),'#89939d');assert.equal(t.dashboardRows('all').length,2);console.log('PASS: closed sites never enter current high risk, even with 6 incidents or urgent records');
