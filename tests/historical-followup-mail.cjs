const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const ctx={Deno:{env:{get:()=>''},serve:()=>{}},console};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('edge-functions/enl-email-v441/index.ts','utf8').replace(/^import .*;\n/gm,'')),ctx);
const out=ctx.followupMail({data:{title:'<script>danger</script>',eventLabel:'후속 개선조치 요구',followupId:'qa-id',dueDate:'2026-10-07',requirement:'표지판 설치',reviewNote:'확인'}} ,'QA 사업장');
assert.ok(out.subject.includes('후속 개선조치 요구'));assert.ok(out.html.includes('&lt;script&gt;'));assert.ok(!out.html.includes('<script>'));assert.ok(out.html.includes('?followup=qa-id'));assert.ok(out.text.includes('이관종결을 유지'));
const sw=fs.readFileSync('sw-v418.js','utf8');assert.ok(sw.includes('?followup=${encodeURIComponent'));
const attachment=fs.readFileSync('edge-functions/enl-attachment-v411/index.ts','utf8');assert.ok(attachment.includes('use_followup_authorized_endpoint'));
console.log('PASS: followup mail content/escaping/authenticated deep link and legacy attachment bypass guard');
