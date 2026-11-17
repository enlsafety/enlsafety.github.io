/* Shared pure target calculations. No storage, network or forecast of actual accidents. */
(()=>{
 'use strict';
 const day=i=>{const v=String(i.occurredAt||i.occurredDate||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v?v:''}if(!v)return '';const d=new Date(v);return Number.isFinite(+d)?new Date(+d+32400000).toISOString().slice(0,10):''};
 const amount=i=>{const d=i.reportDetails||{},k=i.category==='person'?'medicalCost':i.category==='property'?'repairCost':null;if(!k||d[k+'Pending']===true||d[k+'Known']===false||d.costKnown===false||d[k]==null||String(d[k]).trim()==='')return null;const n=Number(String(d[k]).replace(/,/g,''));if(!Number.isFinite(n)||n<0||n>1e12)return null;if(n===0&&d[k+'Pending']!==false&&d[k+'Known']!==true&&d.costKnown!==true)return null;return n};
 function baseline(items,year,site='',today=new Date(+new Date()+32400000).toISOString().slice(0,10)){
  const end=Number(year)===Number(today.slice(0,4))?today:year+'-12-31';
  const unique=new Map();for(const i of items||[]){if(!i?.id||i.bulkInvalidation?.active||!['reported','supplement','supplement_submitted','approved','closed'].includes(i.status))continue;const old=unique.get(String(i.id));if(!old||Number(i._syncVersion||0)>=Number(old._syncVersion||0))unique.set(String(i.id),i)}
  const rows=[...unique.values()].filter(i=>{const d=day(i);return (!site||String(i.siteId||'')===site)&&d>=year+'-01-01'&&d<=end&&d<=today}),costs=rows.map(amount).filter(n=>n!==null);
  return {year:Number(year),end,count:rows.length,person:rows.filter(i=>i.category==='person').length,property:rows.filter(i=>i.category==='property').length,cost:costs.length?costs.reduce((a,b)=>a+b,0):null,knownCost:costs.length,unknownCost:rows.length-costs.length,partial:end!==year+'-12-31'};
 }
 function numeric(value,max,integer=false){if(!['string','number'].includes(typeof value)||String(value).trim()==='')throw Error('invalid_target');const n=Number(value);if(!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isInteger(n)))throw Error('invalid_target');return n}
 function percent(value){const n=numeric(value,100);if(Math.abs(n*100-Math.round(n*100))>1e-7)throw Error('invalid_target');return n}
 function derive(base,input){
  let count,cost=null,normalized;
  if(input.mode==='percent'){
   if(!base.count)throw Error('baseline_required');
   const countPercent=percent(input.countPercent),costPercent=base.cost===null?null:percent(input.costPercent);
   count=Math.floor(base.count*(10000-Math.round(countPercent*100))/10000);
   cost=base.cost===null?null:Math.floor(base.cost*(10000-Math.round(costPercent*100))/10000);
   normalized={mode:'percent',countPercent,costPercent};
  }else if(input.mode==='direct'){
   count=numeric(input.targetCount,1000000,true);cost=input.targetCost==null||String(input.targetCost).trim()===''?null:numeric(input.targetCost,1e12,true);
   normalized={mode:'direct',targetCount:count,targetCost:cost};
  }else throw Error('invalid_target');
  return {inputs:normalized,targets:{count,cost},countReduction:base.count?base.count-count:null,costReduction:base.cost===null||cost===null?null:base.cost-cost,effectivePercent:base.count?Math.round((base.count-count)/base.count*1000)/10:null};
 }
 globalThis.ENLTargetPolicy={baseline,derive};
})();
