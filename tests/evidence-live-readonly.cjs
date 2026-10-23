'use strict';
// Read-only production verification. Credentials and original rows stay in private files.
// Only audit_list, backup_export and revision_list actions are permitted here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.argv[2],proofFile=process.argv[3];
if(!base||!proofFile)throw Error('private_backup_directory_and_proof_file_required');
const proof=JSON.parse(fs.readFileSync(proofFile,'utf8'));
const origin='https://enlsafety.github.io',url='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1/';
const read=t=>JSON.parse(fs.readFileSync(path.join(base,t+'.json'),'utf8')).rows.map(r=>JSON.parse(r.row_text));
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(sorted(v))).digest('hex');
function normalized(row,columns){return Object.fromEntries(columns.map(k=>[k,/^(created_at|changed_at)$/.test(k)&&row[k]?new Date(row[k]).toISOString():row[k]??null]));}
async function request(slug,body){
 if(!['audit_list','backup_export','revision_list'].includes(body.action))throw Error('non_read_action_rejected');
 const r=await fetch(url+slug,{method:'POST',headers:{'content-type':'application/json','x-enl-app':'incident-report-v2',origin},body:JSON.stringify({...proof,...body}),signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('read_api_http_'+r.status);
 const result=await r.json();if(!result.ok)throw Error('read_api_not_ok');return result;
}
(async()=>{
 const audits=read('enl_incident_audit'),backups=read('enl_incident_backups'),revisions=read('enl_incident_revisions');
 const ids=[...new Set(audits.map(r=>r.incident_id))],expected=new Map(audits.map(r=>[r.audit_id,r]));
 const actual=new Map();let snapshots=0;
 for(const incidentId of ids){const data=await request('enl-incident-compliance-v439',{action:'audit_list',incidentId});for(const row of data.audits||[])actual.set(row.audit_id,row);}
 for(const [id,before] of expected){const after=actual.get(id);if(!after||hash(normalized(before,Object.keys(before)))!==hash(normalized(after,Object.keys(before))))throw Error('audit_snapshot_or_metadata_mismatch');snapshots+=Number(before.before_payload!==null)+Number(before.after_payload!==null);}
 for(const before of backups){const data=await request('enl-incident-compliance-v439',{action:'backup_export',backupId:before.backup_id});if(hash(normalized(before,Object.keys(before)))!==hash(normalized(data.backup,Object.keys(before))))throw Error('backup_snapshot_or_metadata_mismatch');}
 for(const id of [...new Set(revisions.map(r=>r.incident_id))]){
  const data=await request('enl-incident-sync-v411',{action:'revision_list',incidentId:id});
  const list=new Map((data.revisions||[]).map(r=>[r.revision,r]));
  for(const row of revisions.filter(r=>r.incident_id===id)){
   const after=list.get(row.revision),columns=['revision','reason','editor_id','editor_name','created_at','changes'];
   if(!after||hash(normalized(row,columns))!==hash(normalized(after,columns)))throw Error('revision_content_or_metadata_mismatch');
   if('before_payload' in after||'after_payload' in after)throw Error('unexpected_full_snapshot_in_revision_api');
  }
 }
 console.log(JSON.stringify({suite:'evidence-live-readonly',productionWrites:0,auditRowsVerified:expected.size,auditSnapshotsVerified:snapshots,backupRowsVerified:backups.length,revisionRowsVerified:revisions.length,additionalLiveAuditRows:actual.size-expected.size,allContentsAndMetadataMatch:true}));
})().catch(e=>{console.error(JSON.stringify({suite:'evidence-live-readonly',failed:true,reason:/^(read_api_|audit_|backup_|revision_|unexpected_|non_read_)/.test(e.message)?e.message:'request_failed_no_private_data_logged'}));process.exitCode=1});
