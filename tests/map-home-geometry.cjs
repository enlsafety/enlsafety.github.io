'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('site-dashboard-v450.js','utf8');
const context={window:{},Math,Number,console};vm.createContext(context);
vm.runInContext(fs.readFileSync('site-locations-v450.js','utf8'),context);
vm.runInContext(source.slice(source.indexOf('const MAP='),source.indexOf('let masters='))+source.slice(source.indexOf('function mapXY('),source.indexOf('function marker('))+source.slice(source.indexOf('function spreadPoints('),source.indexOf('function touchMap(')),context);
const states=[{w:620,h:620/.94,fit:'cover'},{w:340,h:340,fit:'cover'},{w:285,h:420,fit:'contain'},{w:470,h:500,fit:'cover'}];
for(const {w,h,fit} of states){
 const imageSize=fit==='cover'?Math.max(w,h):Math.min(w,h),z=1.2;
 const formula=source.slice(source.indexOf('   mapState.x=w/2'),source.indexOf('\n  }',source.indexOf('   mapState.x=w/2')));
 Object.assign(context,{w,h,imageSize,z,mapState:{}});vm.runInContext(formula,context);
 const {x:tx,y:ty}=context.mapState;
 const projected=(x,y)=>[(x/760*imageSize+(w-imageSize)/2)*z+tx,(y/760*imageSize+(h-imageSize)/2)*z+ty];
 const north=projected(344.84,73.25)[1],south=projected(344.84,673.27)[1];
 assert.ok(north>=8&&south<=h-8,'Gangwon and Jeju must be inside viewport');
 assert.ok(Math.abs((north+south)/2-h/2)<.02,'north/south margins centered');
 assert.ok(Math.abs((projected(189.84,373.26)[0]+projected(499.84,373.26)[0])/2-w/2)<.02,'mainland centered horizontally');
 const points=Object.entries(context.window.ENL_SITE_LOCATIONS).filter(([id])=>id!=='s34').map(([id,p])=>{
  const xy=vm.runInContext(`mapXY(${p.lat},${p.lon})`,context);
  return {id,x:(xy[0]*imageSize/100+(w-imageSize)/2)*z,y:(xy[1]*imageSize/100+(h-imageSize)/2)*z};
 });
 context.points=points;const spread=vm.runInContext('spreadPoints(points)',context);
 assert.equal(spread.length,33);
 for(const p of spread)assert.ok(p.x+tx>=9&&p.x+tx<=w-9&&p.y+ty>=9&&p.y+ty<=h-9,`${p.id} fully visible ${w}x${h}`);
 console.log('PASS 120% centered outline and all 33 markers',w,h,fit);
}
const classes=new Set(),handlers={};let anchors=0;
Object.assign(context,{b:{classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},addEventListener:(n,f)=>handlers[n]=f,matches:()=>true},viewport:{},anchorLabel:()=>anchors++});
vm.runInContext(source.slice(source.indexOf('  const peek='),source.indexOf('  b.onclick=',source.indexOf('  const peek='))),context);
handlers.pointerenter({pointerType:'touch'});assert.equal(classes.size,0);
handlers.pointerenter({pointerType:'mouse'});assert.ok(classes.has('label-peek'));assert.equal(anchors,1);
handlers.pointerleave();assert.equal(classes.size,0);
handlers.focus();assert.ok(classes.has('label-peek'));handlers.blur();assert.equal(classes.size,0);
console.log('PASS mouse preview, keyboard focus, touch exclusion and hover dismissal');
