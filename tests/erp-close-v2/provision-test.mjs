// Generates disposable MOCK-only test credentials OUTSIDE the repository.
// An authorized staging DB operator applies hashes.sql; raw tokens never leave credentials.json.
import fs from 'node:fs';import path from 'node:path';import {randomBytes,randomUUID,createHash} from 'node:crypto';
const destination=path.resolve(process.argv[2]||'');const repo=path.resolve(import.meta.dirname,'../..');
if(!process.argv[2]||destination===repo||destination.startsWith(repo+path.sep))throw Error('Choose a private directory outside the repository');
fs.mkdirSync(destination,{recursive:true,mode:0o700});
const runId=randomUUID(),otherRunId=randomUUID(),tokens=Object.fromEntries(['safety','field','qa','other','expired'].map(role=>[role,randomBytes(32).toString('base64url')]));
const rows=Object.entries(tokens).map(([r,token])=>`('${createHash('sha256').update(token).digest('hex')}','${r==='other'?otherRunId:runId}','${['other','expired'].includes(r)?'safety':r}',now()${r==='expired'?"-interval '1 minute'":"+interval '2 hours'"})`);
fs.writeFileSync(path.join(destination,'credentials.json'),JSON.stringify({runId,otherRunId,tokens}),{mode:0o600,flag:'wx'});
fs.writeFileSync(path.join(destination,'hashes.sql'),'insert into enl_erp_close_v2.tokens(token_hash,run_id,role,expires_at) values\n'+rows.join(',\n')+';\n',{mode:0o600,flag:'wx'});
console.log('Created credentials.json and hashes.sql in the specified private directory. Do not commit either file.');
