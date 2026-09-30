const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let code=fs.readFileSync('site-dashboard-v450.js','utf8');
code=code.slice(0,code.indexOf('const base=window.renderShell'))+'window.test={risk,pos,rows,master,cnt,mapXY,info,kpis,setMasters:v=>{masters=v;loaded=true}};})();';
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
console.log('PASS: risk boundaries, historical exclusion, inactive records, address invalidation, escaping and coordinate bounds');
