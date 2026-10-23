// Generate an isolated staging bundle from the exact checked-out production handlers.
// No production URL or production table/bucket is reachable through this bundle.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dest='qa-output/stage-source',schema='enl_final_qa_20261013',bucket='enl-final-qa-20261013';
fs.mkdirSync(dest,{recursive:true});
const hashes={},sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
function dependency(file){
 const name=path.basename(file),source=fs.readFileSync(file,'utf8');
 if(hashes[file])return;
 hashes[file]=sha256(source);
 fs.writeFileSync(path.join(dest,name),source.replaceAll('public.',schema+'.').replaceAll('private.',schema+'_private.'));
 for(const match of source.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+)["']/g))dependency(path.resolve(path.dirname(file),match[1]));
}
for(const [file,source,handler] of [['lifecycle.ts','edge-functions/enl-incident-sync-v411/index.ts','handleLifecycle'],['attachment.ts','edge-functions/enl-attachment-v411/index.ts','handleAttachment']]){
 const original=fs.readFileSync(source,'utf8');hashes[source]=sha256(original);
 let s=original.replaceAll('public.',schema+'.').replaceAll('private.',schema+'_private.').replace('const BUCKET="enl-incident-files"',`const BUCKET="${bucket}"`);
 if(!s.includes('Deno.serve(async(req:Request)=>{'))throw Error('Unrecognized handler wrapper: '+source);
 s=s.replace('Deno.serve(async(req:Request)=>{',`export async function ${handler}(req:Request){`);
 const end=s.lastIndexOf('});');if(end<0)throw Error(source);s=s.slice(0,end)+'}'+s.slice(end+3);
 fs.writeFileSync(path.join(dest,file),s);
 for(const match of original.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+)["']/g))dependency(path.resolve(path.dirname(source),match[1]));
}
fs.writeFileSync(path.join(dest,'index.ts'),`import {handleLifecycle} from './lifecycle.ts';
import {handleAttachment} from './attachment.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import postgres from 'npm:postgres@3.4.5';
Deno.serve(async(req:Request)=>{
 if(!Deno.env.get('SUPABASE_URL')?.includes('zgwxzfvvpqgdedyobwmg.supabase.co'))return new Response('staging_project_required',{status:503});
 const target=req.headers.get('x-enl-qa-target');
 if(target==='attachment')return handleAttachment(req);
 if(target==='attachment_cleanup'){
  const body=await req.json(),actor=body.actor||{},paths=body.paths||[];
  const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1});
  try{const users=await sql\`select pin_hash,site_id from ${schema}.enl_site_personnel where personnel_id=\${actor.id} and active=true and access_role='field'\`;
   const u=users[0];if(!u||u.pin_hash!==body.actorPinHash||u.site_id!==actor.siteId||!Array.isArray(paths)||!paths.length||paths.some((p:string)=>typeof p!=='string'||p.includes('..')||(!p.startsWith('incident/site-'+u.site_id+'/'+actor.id+'/')&&!p.startsWith('action/site-'+u.site_id+'/'+actor.id+'/'))))return new Response('forbidden',{status:403});
   const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const {error}=await db.storage.from('${bucket}').remove(paths);if(error)throw error;return Response.json({ok:true});
  }finally{await sql.end({timeout:1});}
 }
 return handleLifecycle(req);
});
`);
const files=fs.readdirSync(dest).filter(n=>/\.(ts|js)$/.test(n));
for(const file of files){const s=fs.readFileSync(path.join(dest,file),'utf8');if(/\b(?:from|into|update|join)\s+public\./i.test(s)||s.includes('"enl-incident-files"'))throw Error('Production storage reference in QA bundle: '+file);}
fs.writeFileSync('qa-output/stage-source-manifest.json',JSON.stringify({project:'zgwxzfvvpqgdedyobwmg',schema,bucket,generatedAt:new Date().toISOString(),sources:hashes,files:files.map(name=>({name,sha256:sha256(fs.readFileSync(path.join(dest,name)))}))},null,2));
console.log(dest);
