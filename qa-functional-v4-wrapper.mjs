import fs from 'node:fs';
let src=fs.readFileSync('qa-functional-v3.mjs','utf8');
src=src.replaceAll('s0.id','s0.site_id').replaceAll('s0.name','s0.site_name').replaceAll('s.id','s.site_id').replaceAll('s.name','s.site_name');
fs.writeFileSync('qa-functional-v4-generated.mjs',src);
await import(`./qa-functional-v4-generated.mjs?run=${Date.now()}`);
