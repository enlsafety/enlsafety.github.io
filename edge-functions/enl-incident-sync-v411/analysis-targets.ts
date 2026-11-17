import './analysis-target-policy.js';
export async function analysisTargetRequest(sql:any,actor:any,body:any,reply:any){
 if(!['safety','manager','executive'].includes(actor.role))return reply({ok:false,message:'forbidden'},403);
 const save=body.action==='platform_analysis_target_save';
 if(!save&&body.action!=='platform_analysis_target_get')return reply({ok:false,message:'invalid_action'},400);
 if(save&&actor.role!=='safety')return reply({ok:false,message:'safety_required'},403);
 const today=new Date(Date.now()+32400000).toISOString().slice(0,10),year=body.year,scope=String(body.siteId||'');
 if(!Number.isInteger(year)||year<2000||year>Math.min(2100,Number(today.slice(0,4)))||scope.length>120)return reply({ok:false,message:'invalid_scope'},400);
 if(scope){const [site]=await sql`select site_id from public.enl_site_master where site_id=${scope}`;if(!site)return reply({ok:false,message:'invalid_scope'},400)}
 const policy=(globalThis as any).ENLTargetPolicy;
 const snapshot=async(tx:any)=>{const rows=await tx`select payload from public.enl_incident_shared where (${scope}='' or site_id=${scope}) and payload->>'status' in ('reported','supplement','supplement_submitted','approved','closed')`;return policy.baseline(rows.map((r:any)=>r.payload),year,scope,today)};
 if(!save){const baseline=await snapshot(sql);const [record]=await sql`select revision,content,actor_name,saved_at from private.enl_analysis_targets where target_year=${year+1} and site_scope=${scope} order by revision desc limit 1`;return reply({ok:true,targetYear:year+1,baseline,baselineKey:JSON.stringify(baseline),record:record||null})}
 if(!Number.isInteger(body.revision)||body.revision<0||typeof body.baselineKey!=='string')return reply({ok:false,message:'invalid_target'},400);
 return sql.begin(async(tx:any)=>{
  await tx`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([year+1,scope])},2913))`;
  const [last]=await tx`select revision from private.enl_analysis_targets where target_year=${year+1} and site_scope=${scope} order by revision desc limit 1`;
  if((last?.revision||0)!==body.revision)return reply({ok:false,message:'target_changed'},409);
  const baseline=await snapshot(tx);
  if(JSON.stringify(baseline)!==body.baselineKey)return reply({ok:false,message:'baseline_changed'},409);
  let result;try{result=policy.derive(baseline,body.inputs||{})}catch(e){return reply({ok:false,message:e.message==='baseline_required'?'baseline_required':'invalid_target'},400)}
  const content={baseline,inputs:result.inputs,targets:result.targets};
  const [record]=await tx`insert into private.enl_analysis_targets(target_year,site_scope,revision,content,actor_id,actor_name) values(${year+1},${scope},${body.revision+1},${tx.json(content)},${actor.id},${actor.name}) returning revision,content,actor_name,saved_at`;
  return reply({ok:true,targetYear:year+1,baseline,baselineKey:JSON.stringify(baseline),record});
 });
}
