const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let code=fs.readFileSync('site-dashboard-v450.js','utf8');
code=code.slice(0,code.indexOf('const base=window.renderShell'))+'window.test={spreadPoints,canDashboard,risk,pos,rows,dashboardRows,master,cnt,mapXY,info,kpis,setMasters:v=>{masters=v;loaded=true}};})();';
const ctx={window:{},data:{sites:[],incidents:[]},Date,console};vm.createContext(ctx);vm.runInContext(code,ctx);
const t=ctx.window.test,y=new Date().getFullYear();
const incident=(extra={})=>({siteId:'s01',occurredAt:`${y}-05-01`,status:'reported',...extra});
ctx.data.incidents=[incident({occurredAt:`${y-1}-12-01`,priority:'urgent'})];
assert.equal(t.risk('s01').high,true,'unresolved urgent from prior year');assert.equal(t.risk('s01').count,0);assert.equal(t.risk('s01').open,1);
ctx.data.incidents[0].recordMode='historical_transfer';assert.equal(t.risk('s01').high,false,'historical urgent excluded');
ctx.data.incidents=Array.from({length:4},()=>incident({status:'closed'}));assert.equal(t.risk('s01').high,false);ctx.data.incidents.push(incident({status:'closed'}));assert.equal(t.risk('s01').high,true,'5 current-year accidents');
for(const extra of [{severity:'major'},{potentialMajor:true},{priority:'urgent'}]){ctx.data.incidents=[incident(extra)];assert.equal(t.risk('s01').high,true);ctx.data.incidents[0].status='closed';assert.equal(t.risk('s01').high,false)}
ctx.window.ENL_SITE_MASTER_SEED=[{site_id:'s01',site_name:'검증',address:'주소',regular_count:3,daily_count:2}];ctx.data.sites=[{id:'s01',name:'검증'}];assert.equal(t.master('s01').address,'주소','undefined local field must not erase seed');
t.setMasters([{site_id:'s01',active:false}]);assert.equal(t.rows().length,0,'inactive server site must not resurrect from seed');t.setMasters([]);assert.equal(t.rows().length,0,'successful empty server response is authoritative');
ctx.window.ENL_SITE_LOCATIONS={s01:{address:'주소',lat:35.4,lon:126.8}};assert.ok(t.pos({site_id:'s01',address:'주소'}));assert.equal(t.pos({site_id:'s01',address:'이전된 주소'}),null);assert.equal(t.pos({site_id:'s99',region:'서울'}),null);
const [x,j]=t.mapXY(33.33834117,126.348717);assert.ok(x>0&&x<100&&j>70&&j<100,'Jeju in viewport');
ctx.window.ENL_SITE_MASTER_SEED[0].site_name='<img onerror=alert(1)>';assert.ok(!t.info('s01').includes('<img'));
vm.runInContext(fs.readFileSync('site-locations-v450.js','utf8'),ctx);for(const p of Object.values(ctx.window.ENL_SITE_LOCATIONS)){assert.ok(p.source.startsWith('https://'));assert.ok(p.address);assert.ok(p.lat>33&&p.lat<39&&p.lon>124&&p.lon<132)}
t.setMasters([{site_id:'s01',site_name:'운영 사업장',address:'주소'},{site_id:'s34',site_name:'파주CC',active:true}]);assert.equal(t.rows().length,2,'ended site retained for historical lookup');assert.equal(t.dashboardRows().length,1,'ended site excluded from current dashboard');assert.equal(t.master('s34').site_name,'파주CC');
assert.equal(Object.keys(ctx.window.ENL_SITE_LOCATIONS).length,33);assert.equal(ctx.window.ENL_SITE_LOCATIONS.s34,undefined);
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
