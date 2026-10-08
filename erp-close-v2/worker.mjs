// Browser-independent runner for the MOCK staging bridge only.
// Intended for test execution; production scheduling/identity are release blockers.
import fs from 'node:fs';
import {STAGING_ENDPOINT} from './panel.mjs';
export async function runOnce(transport){
  const {caseIds}=await transport({action:'due'});const results=[];
  for(const id of caseIds){const r=await transport({action:'step',id});results.push({id,state:r.job?.state});}
  return results;
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const path=process.env.ERP_V2_TEST_CREDENTIALS;if(!path)throw new Error('ERP_V2_TEST_CREDENTIALS local path required');
  const {tokens}=JSON.parse(fs.readFileSync(path,'utf8'));
  const transport=async body=>{const r=await fetch(STAGING_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens.qa}`},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Staging worker HTTP ${r.status}`);return r.json();};
  let stopped=false;process.on('SIGINT',()=>stopped=true);process.on('SIGTERM',()=>stopped=true);
  do{
    const results=await runOnce(transport);console.log(JSON.stringify({provider:'mock',processed:results.length,states:results.map(x=>x.state)}));
    if(process.argv.includes('--once'))break;
    if(!stopped)await new Promise(r=>setTimeout(r,10000));
  }while(!stopped);
}
