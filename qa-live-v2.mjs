import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const BASE='https://wjelumpbjklfrdjxbesj.supabase.co/functions/v1';
const APP='https://enlsafety.github.io/stable412.html?qa=2';
const HEAD={'Content-Type':'application/json','X-ENL-App':'incident-report-v2'};
const SYNC=BASE+'/enl-incident-sync-v411', OLD=BASE+'/enl-incident-sync', LOGIN=BASE+'/enl-login-v411', HQOLD=BASE+'/enl-hq-auth';
const run='Q2'+Date.now(), suffix=run.slice(-6), pw='7788', pwHash=crypto.createHash('sha256').update(pw).digest('hex');
const out={run,startedAt:new Date().toISOString(),tests:[],timings:[],errors:[],notes:[],sites:[],cleanup:[]};
fs.mkdirSync('qa-artifacts-v2',{recursive:true});
let browsers=[]; let safety=null; const accounts={}; const cleanupIds=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const iso=(offset=0)=>new Date(Date.now()+offset).toISOString();
const actor=(id,name,role,siteId='',position='')=>({id,name,role,siteId,position});
function rec(name,status,detail={}){out.tests.push({name,status,...detail});console.log(`[${status}] ${name}`,JSON.stringify(detail));}
function pass(name,d={}){rec(name,'PASS',d)} function fail(name,d={}){rec(name,'FAIL',d)} function untested(name,d={}){rec(name,'미검증',d)}
async function api(url,body,{allowError=false}={}){const st=Date.now();let r,j;try{r=await fetch(url,{method:'POST',headers:HEAD,body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});j=await r.json().catch(()=>({}));}catch(e){out.timings.push({fn:url.split('/').pop(),action:body.action,ms:Date.now()-st,error:String(e)});if(!allowError)throw e;return {status:0,ok:false,j:{message:String(e)}}}out.timings.push({fn:url.split('/').pop(),action:body.action,ms:Date.now()-st,http:r.status});if(!allowError&&(!r.ok||j?.ok===false))throw new Error(`${body.action}:${r.status}:${j?.message||'error'}`);return {status:r.status,ok:r.ok&&j?.ok!==false,j};}
const pull=a=>api(SYNC,{action:'pull',actor:a,role:a.role,siteId:a.siteId||''}).then(x=>x.j.incidents||[]);
const push=(a,incidents,deletedIds=[])=>api(SYNC,{action:'push',actor:a,role:a.role,siteId:a.siteId||'',incidents,deletedIds});
function makeIncident(id,siteId,a,marker){return {id,siteId,category:'person',eventType:'베임·절상',severity:'minor',leaveEstimate:'none',potentialMajor:false,injuredName:a.name,job:'코스관리',summary:`${marker} 사고`,immediateAction:'작업을 중지하고 관리자에게 보고함',photos:[],occurredAt:iso(),createdAt:iso(),updatedAt:iso(1000),priority:'normal',prioritySource:'auto',status:'reported',safetyNote:'',approvedBy:'',approvedAt:null,closedAt:null,corrective:null,readReceipts:[],reporterName:a.name,reporterId:a.id,reportDetails:{templateVersion:'v411',reportType:'person',place:`${marker} A코스`,workAction:'예초 작업',incidentHow:'예초 작업 중 날카로운 가장자리에 장갑이 접촉한 상황을 가정함',environmentCause:'테스트 환경',behaviorCause:'작업 전 확인 미흡 가정',preventionPlan:'작업 전 위험요인 확인 및 보호구 점검',specialNote:`${marker} TEST DATA`,injuredName:a.name,job:'코스관리',injuryDetail:'왼손 경미한 베임 가정',recordedAt:iso()}};}
async function phase(name,fn){console.log(`\n=== ${name} ===`);try{await fn();}catch(e){fail(name,{error:String(e?.message||e)});out.errors.push({phase:name,severity:'P1',message:String(e?.stack||e)});}}
async function loginPage(page,a){const st=Date.now();await page.goto(APP,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('#loginName411').waitFor({timeout:15000});await page.locator('#loginName411').fill(a.name);await page.waitForTimeout(1000);let buttons=page.locator('[data-login411-aff]');await buttons.first().waitFor({timeout:15000});let target=a.siteName?buttons.filter({hasText:a.siteName}):buttons;if(!(await target.count()))target=buttons;await target.first().click();if(a.password){await page.locator('#loginPassword411').waitFor({timeout:8000});await page.locator('#loginPassword411').fill(a.password);const dlg=page.waitForEvent('dialog',{timeout:2000}).then(async d=>{await d.accept();return d.message()}).catch(()=>null);await page.locator('#loginSubmit411').click();await dlg;}await page.waitForFunction(()=>typeof currentUser==='function'&&!!currentUser(),null,{timeout:20000});out.timings.push({action:`ui-login-${a.role}`,ms:Date.now()-st});return page.evaluate(()=>currentUser());}
async function syncPage(page){await page.evaluate(async()=>{await window.enlIncidentSyncNow?.();});await page.waitForTimeout(300);}

await phase('1. 서버 권한 사전검증',async()=>{
 const rogue=await api(SYNC,{action:'pull',actor:actor('fake-safety','가짜안전','safety')},{allowError:true});
 const exposed=rogue.ok&&Array.isArray(rogue.j.incidents);
 if(exposed){fail('인증 없는 safety 역할 위조 차단',{http:rogue.status,count:rogue.j.incidents.length});out.errors.push({severity:'P0',root:'CUSTOM_AUTH_TRUST',name:'인증 없이 actor.role=safety로 전체 사고 조회 가능'});}else pass('인증 없는 safety 역할 위조 차단',{http:rogue.status});
 const hq=await api(HQOLD,{action:'list',actor:actor('fake','가짜','safety')},{allowError:true});
 if(hq.ok){fail('구형 HQ 관리자 API 역할 위조 차단',{http:hq.status,count:hq.j.users?.length||0});out.errors.push({severity:'P0',root:'CUSTOM_AUTH_TRUST',name:'구형 HQ API가 actor.role만으로 관리자 목록 허용'});}else pass('구형 HQ 관리자 API 역할 위조 차단',{http:hq.status});
});

await phase('2. TEST 계정·사업장 준비',async()=>{
 const sd=await api(OLD,{action:'site_directory',actor:actor('qa','QA','worker')});const sites=(sd.j.sites||[]).filter(x=>x.site_id&&x.site_id!=='site-hq').slice(0,8);out.sites=sites.map(x=>({id:x.site_id,name:x.site_name}));if(sites.length<3)throw new Error('활성 사업장 3개 미만');
 const sid=sites[0].site_id,siteName=sites[0].site_name;
 safety=actor(`hq-test-safety-${run}`,`TEST안전_${suffix}`,'safety','','안전관리자');
 await api(HQOLD,{action:'upsert',actor:actor('bootstrap','QA','safety'),user:{id:safety.id,name:safety.name,role:'safety',department:'QA',position:'안전관리자',active:true,passwordHash:pwHash}});accounts.safety={...safety,password:pw};
 for(const u of [{key:'manager',role:'manager',name:`TEST관리_${suffix}`,position:'관리자'},{key:'executive',role:'executive',name:`TEST경영_${suffix}`,position:'경영진'}]){const id=`hq-${u.key}-${run}`;await api(LOGIN,{action:'hq_upsert',actor:safety,user:{id,name:u.name,role:u.role,department:'QA',position:u.position,active:true,passwordHash:pwHash}});accounts[u.key]={...actor(id,u.name,u.role,'',u.position),password:pw};}
 for(const u of [{key:'worker',role:'worker',name:`TEST근로_${suffix}`,position:'일반근로자'},{key:'site',role:'field',name:`TEST소장_${suffix}`,position:'현장소장'},{key:'part',role:'field',name:`TEST파트_${suffix}`,position:'파트장'},{key:'clerk',role:'field',name:`TEST서무_${suffix}`,position:'서무'}]){const q=await api(OLD,{action:'personnel_upsert',actor:safety,role:'safety',siteId:sid,person:{siteId:sid,name:u.name,jobTitle:u.position,accessRole:u.role,pinHash:u.role==='field'?pwHash:'',active:true}});const id=String(q.j.person?.personnel_id||'');if(!id)throw new Error(`${u.key} 계정 생성 실패`);accounts[u.key]={...actor(id,u.name,u.role,sid,u.position),siteName,password:u.role==='field'?pw:''};}
 pass('TEST 계정 준비',{site:siteName,roles:Object.keys(accounts)});
});

await phase('3. 실제 UI - 근로자 사고등록·안전관리자 실시간 관찰',async()=>{
 const browser=await chromium.launch({headless:true});browsers.push(browser);const safetyCtx=await browser.newContext({viewport:{width:1365,height:900}}),workerCtx=await browser.newContext({viewport:{width:390,height:844}});const sp=await safetyCtx.newPage(),wp=await workerCtx.newPage();
 await loginPage(sp,accounts.safety);await sp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});await loginPage(wp,accounts.worker);
 const overflow=await wp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);overflow?fail('390px 모바일 가로넘침 없음'):pass('390px 모바일 가로넘침 없음');
 await wp.evaluate(()=>window.enlGoFieldTask('accident_report',currentUser()));await wp.locator('[data-report-type="person"]').click();const marker=`[TEST-${run}-UI]`;
 const vals=[['#incidentPlace410',`${marker} A코스`],['#workAction410','예초 작업 중'],['#incidentHow410','예초 작업 중 날카로운 가장자리에 장갑이 접촉한 상황 가정'],['#immediateAction','작업중지 후 관리자 보고'],['#injuredName',accounts.worker.name],['#job','코스관리'],['#injuryDetail410','왼손 경미한 베임 가정'],['#preventionPlan410','절단방지장갑 점검 및 TBM 실시'],['#specialNote410',`${marker} TEST DATA`]];for(const [sel,v] of vals)await wp.locator(sel).fill(v);
 await wp.locator('#eventType').selectOption({index:1}).catch(()=>{});fs.writeFileSync('qa-artifacts-v2/a.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=','base64'));fs.writeFileSync('qa-artifacts-v2/a.pdf','%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');await wp.locator('#incidentPhotoInput').setInputFiles(['qa-artifacts-v2/a.png','qa-artifacts-v2/a.pdf']);await wp.waitForTimeout(800);
 const st=Date.now();const dlg=wp.waitForEvent('dialog',{timeout:8000}).then(async d=>{const m=d.message();await d.accept();return m}).catch(()=>null);await wp.locator('button.report410-submit').click();const msg=await dlg;out.timings.push({action:'ui-worker-submit',ms:Date.now()-st,dialog:msg});
 let incident=null;for(let n=0;n<30;n++){const x=await pull(safety);incident=x.find(i=>JSON.stringify(i).includes(marker));if(incident)break;await sleep(500);}if(!incident)throw new Error('UI 등록 사고 서버 미반영');out.mainIncidentId=incident.id;pass('근로자 UI 사고등록',{id:incident.id});
 let realtime=false,rt=0;const rt0=Date.now();for(let n=0;n<35;n++){realtime=await sp.evaluate(m=>(data.incidents||[]).some(i=>JSON.stringify(i).includes(m)),marker);if(realtime){rt=Date.now()-rt0;break}await sp.waitForTimeout(500);}realtime?pass('안전관리자 화면 실시간 반영',{ms:rt}):fail('안전관리자 화면 실시간 반영',{waitedMs:Date.now()-rt0});out.timings.push({action:'realtime-worker-to-safety',ms:rt||Date.now()-rt0,success:realtime});
 await sp.screenshot({path:'qa-artifacts-v2/safety-realtime.png',fullPage:true});
 await safetyCtx.close();await workerCtx.close();await browser.close();browsers=browsers.filter(x=>x!==browser);
});

await phase('4. 실제 UI - 소장 수정·승인·조치·자동종결',async()=>{
 const id=out.mainIncidentId;if(!id)throw new Error('주 사고 ID 없음');const browser=await chromium.launch({headless:true});browsers.push(browser);const sc=await browser.newContext({viewport:{width:1365,height:900}}),fc=await browser.newContext({viewport:{width:430,height:900}}),sp=await sc.newPage(),fp=await fc.newPage();await loginPage(sp,accounts.safety);await loginPage(fp,accounts.site);await fp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});await syncPage(fp);
 const edit=fp.locator(`[data-field-edit="${id}"]`);if(await edit.count()){pass('현장소장 검토대기 사고 수정버튼');await edit.click();await fp.locator('#specialNote410').fill(`[TEST-${run}] 소장수정`);const dlg=fp.waitForEvent('dialog',{timeout:8000}).then(async d=>{await d.accept();}).catch(()=>null);await fp.locator('button.report410-submit').click();await dlg;await fp.waitForTimeout(700);}else fail('현장소장 검토대기 사고 수정버튼');
 let cur=(await pull(safety)).find(x=>x.id===id);String(cur?.reportDetails?.specialNote||'').includes('소장수정')?pass('소장 수정 서버반영',{modifier:cur?.lastModifiedBy}):fail('소장 수정 서버반영',{modifier:cur?.lastModifiedBy});
 await syncPage(sp);await sp.evaluate(id=>window.enlOpenIncidentReview?.(id,true,currentUser()),id);await sp.waitForTimeout(400);if(await sp.locator('#approveInc').count()){const dlg=sp.waitForEvent('dialog',{timeout:5000}).then(async d=>d.accept()).catch(()=>null);await sp.locator('#approveInc').click();await dlg;await sp.waitForTimeout(800);pass('안전관리자 사고보고 UI 승인');}else{fail('안전관리자 사고보고 UI 승인',{reason:'approveInc 버튼 없음'});cur=(await pull(safety)).find(x=>x.id===id);await push(safety,[{...cur,status:'approved',approvedBy:safety.name,approvedAt:iso(),updatedAt:iso(3000)}]);}
 cur=(await pull(safety)).find(x=>x.id===id);cur?.status==='approved'?pass('사고보고 승인 상태'):fail('사고보고 승인 상태',{status:cur?.status});
 await syncPage(fp);await fp.evaluate(()=>{currentView='incidents';renderShell(currentUser())});(await fp.locator(`[data-field-edit="${id}"]`).count())===0?pass('승인 후 현장 사고수정 UI 차단'):fail('승인 후 현장 사고수정 UI 차단');
 await fp.evaluate(id=>window.openUnifiedCorrectiveModal?.(id,currentUser()),id);await fp.locator('#unifiedCorrectiveForm').waitFor({timeout:12000});await fp.locator('#uRootCause').fill('작업 전 위험요인 확인 미흡 가정');await fp.locator('#uActionDetail').fill('TBM 및 보호구 재점검, 작업방법 재교육');await fp.locator('#uOwnerName').fill(accounts.site.name);await fp.locator('#uDueDate').fill(new Date(Date.now()+86400000).toISOString().slice(0,10));await fp.locator('#uActionStatus').selectOption('submitted');const d2=fp.waitForEvent('dialog',{timeout:5000}).then(async d=>d.accept()).catch(()=>null);await fp.locator('#unifiedCorrectiveForm button[type="submit"]').click();await d2;await fp.waitForTimeout(800);cur=(await pull(safety)).find(x=>x.id===id);cur?.corrective?.status==='submitted'?pass('현장소장 사고조치 검토대기 제출'):fail('현장소장 사고조치 검토대기 제출',{status:cur?.corrective?.status});
 await syncPage(sp);await sp.evaluate(id=>window.openUnifiedCorrectiveModal?.(id,currentUser()),id);await sp.waitForTimeout(400);if(await sp.locator('#approveCorrective411').count()){const d3=sp.waitForEvent('dialog',{timeout:5000}).then(async d=>d.accept()).catch(()=>null);await sp.locator('#approveCorrective411').click();await d3;await sp.waitForTimeout(800);pass('안전관리자 사고조치 UI 승인');}else{fail('안전관리자 사고조치 UI 승인',{reason:'버튼 없음'});cur=(await pull(safety)).find(x=>x.id===id);await push(safety,[{...cur,corrective:{...cur.corrective,status:'approved',reviewedBy:safety.name,reviewedAt:iso()},updatedAt:iso(5000)}]);}
 cur=(await pull(safety)).find(x=>x.id===id);cur?.status==='closed'&&cur?.corrective?.status==='approved'?pass('조치승인 후 자동종결'):fail('조치승인 후 자동종결',{report:cur?.status,corrective:cur?.corrective?.status});
 await sc.close();await fc.close();await browser.close();browsers=browsers.filter(x=>x!==browser);
});

await phase('5. 관리자·경영진 승인사고 조회',async()=>{
 const id=out.mainIncidentId;for(const key of ['manager','executive']){const a=accounts[key];const arr=await pull(a);arr.some(x=>x.id===id)?pass(`${key} 승인·종결 사고 조회`):fail(`${key} 승인·종결 사고 조회`);}
});

await phase('6. 여러 사업장 실전형 순차·동시 등록',async()=>{
 const sites=out.sites;const actors=sites.map((s,i)=>actor(`qa-field-${run}-${i}`,`TEST현장${i}_${suffix}`,'field',s.id,i%3===0?'현장소장':i%3===1?'파트장':'서무'));
 for(let i=0;i<Math.min(3,sites.length);i++){const id=`test-${run}-seq-${i}`;cleanupIds.push(id);const st=Date.now(),q=await push(actors[i],[makeIncident(id,sites[i].id,actors[i],`[TEST-${run}-SEQ${i}]`)]);out.timings.push({action:'sequential-site-push',site:sites[i].name,ms:Date.now()-st});q.j.pushed===1?pass(`순차등록 ${sites[i].name}`):fail(`순차등록 ${sites[i].name}`,q.j);await sleep(1200);}
 const jobs=[];for(let i=3;i<sites.length;i++){const id=`test-${run}-con-${i}`;cleanupIds.push(id);jobs.push(push(actors[i],[makeIncident(id,sites[i].id,actors[i],`[TEST-${run}-CON${i}]`)]));}const rr=await Promise.all(jobs);rr.every(x=>x.j.pushed===1)?pass('다중사업장 동시등록',{count:rr.length}):fail('다중사업장 동시등록',{responses:rr.map(x=>x.j)});const all=await pull(safety);cleanupIds.every(id=>all.some(x=>x.id===id))?pass('안전관리자 전체 사업장 수집',{count:cleanupIds.length}):fail('안전관리자 전체 사업장 수집',{expected:cleanupIds.length});
});

await phase('7. 사업장 격리·권한우회',async()=>{
 const sites=out.sites;if(sites.length<2)throw new Error('사업장 부족');const fake=actor('not-real-personnel','위조현장사용자','field',sites[1].id,'현장소장');const q=await api(SYNC,{action:'pull',actor:fake,role:'field',siteId:sites[1].id},{allowError:true});if(q.ok&&Array.isArray(q.j.incidents)){fail('미인증 현장사용자 타사업장 pull 차단',{site:sites[1].name,count:q.j.incidents.length});out.errors.push({severity:'P0',root:'CUSTOM_AUTH_TRUST',name:'존재하지 않는 field actor가 임의 siteId의 사고 조회 가능'});}else pass('미인증 현장사용자 타사업장 pull 차단',{http:q.status});
});

await phase('8. 승인사고 서버변조 차단',async()=>{
 const site=out.sites[0],field=actor(`field-lock-${run}`,`TEST잠금_${suffix}`,'field',site.id,'현장소장'),id=`test-${run}-approved-lock`;cleanupIds.push(id);await push(field,[makeIncident(id,site.id,field,'[LOCK]')]);let x=(await pull(safety)).find(i=>i.id===id);await push(safety,[{...x,status:'approved',approvedBy:safety.name,approvedAt:iso(),updatedAt:iso(3000)}]);x=(await pull(safety)).find(i=>i.id===id);const q=await push(field,[{...x,summary:'APPROVED-CONTENT-TAMPER',updatedAt:iso(10000)}]);const f=(await pull(safety)).find(i=>i.id===id);if(f?.summary==='APPROVED-CONTENT-TAMPER'){fail('승인완료 사고 서버수정 차단',{serverAccepted:q.j});out.errors.push({severity:'P0',root:'SERVER_STATE_GUARD',name:'field가 승인 사고 본문을 직접 push로 변경 가능'});}else pass('승인완료 사고 서버수정 차단');
});

await phase('9. 동시수정 충돌',async()=>{
 const site=out.sites[0],a=actor(`race-a-${run}`,'TEST소장A','field',site.id,'현장소장'),b=actor(`race-b-${run}`,'TEST파트B','field',site.id,'파트장'),id=`test-${run}-race`;cleanupIds.push(id);await push(a,[makeIncident(id,site.id,a,'[RACE]')]);const base=(await pull(safety)).find(i=>i.id===id),stamp=iso(15000);const [ra,rb]=await Promise.all([push(a,[{...base,summary:'RACE-A',updatedAt:stamp}]),push(b,[{...base,summary:'RACE-B',updatedAt:stamp}])]);const f=(await pull(safety)).find(i=>i.id===id);if(ra.j.pushed===1&&rb.j.pushed===1){fail('동시수정 충돌 감지',{a:ra.j,b:rb.j,final:f?.summary});out.errors.push({severity:'P1',root:'NO_OPTIMISTIC_LOCK',name:'동일 버전 동시 수정이 양쪽 모두 성공 처리되어 마지막 쓰기 덮어쓰기 가능'});}else pass('동시수정 충돌 감지',{a:ra.j,b:rb.j,final:f?.summary});
});

await phase('10. 중복요청·PWA·오프라인',async()=>{
 const site=out.sites[0],a=actor(`dup-${run}`,'TEST중복','field',site.id,'현장소장'),id=`test-${run}-dup`;cleanupIds.push(id);const inc=makeIncident(id,site.id,a,'[DUP]');const r1=await push(a,[inc]),r2=await push(a,[inc]);(r1.j.pushed===1&&r2.j.ignored>=1)?pass('동일 ID 중복 push 멱등 처리',{first:r1.j,second:r2.j}):fail('동일 ID 중복 push 멱등 처리',{first:r1.j,second:r2.j});
 const browser=await chromium.launch({headless:true});browsers.push(browser);const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),p=await ctx.newPage();await loginPage(p,accounts.worker);await p.waitForTimeout(1000);const sw=await p.evaluate(async()=>!!(await navigator.serviceWorker?.getRegistration()));sw?pass('PWA 서비스워커 등록'):fail('PWA 서비스워커 등록');await ctx.setOffline(true);let offlineLoaded=false;try{await p.reload({waitUntil:'domcontentloaded',timeout:10000});offlineLoaded=(await p.locator('body').innerText()).length>20;}catch{}offlineLoaded?pass('PWA 오프라인 재진입'):fail('PWA 오프라인 재진입');await ctx.setOffline(false);await ctx.close();await browser.close();browsers=browsers.filter(x=>x!==browser);untested('iPhone Safari/PWA 실기기',{reason:'현재 자동화 환경에 실제 iPhone/Safari 실기기 없음'});
});

await phase('11. 응답속도 요약',async()=>{
 const vals=out.timings.filter(x=>Number.isFinite(x.ms));const groups={};for(const x of vals){const k=x.action||x.fn;(groups[k]??=[]).push(x.ms);}out.performance=Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,{count:a.length,avgMs:Math.round(a.reduce((s,n)=>s+n,0)/a.length),maxMs:Math.max(...a)}]));pass('성능 측정 완료',{groups:Object.keys(out.performance).length});
});

console.log('\n=== CLEANUP ===');
try{if(safety&&cleanupIds.length){await push(safety,[],cleanupIds);out.cleanup.push({incidents:cleanupIds.length,status:'deleted'});}for(const k of ['worker','site','part','clerk']){const a=accounts[k];if(!a?.id)continue;await api(OLD,{action:'personnel_upsert',actor:safety,role:'safety',siteId:a.siteId,person:{personnelId:a.id,siteId:a.siteId,name:a.name,jobTitle:a.position,accessRole:a.role,pinHash:a.role==='field'?pwHash:'',active:false}});out.cleanup.push({account:k,status:'deactivated'});}for(const k of ['manager','executive']){const a=accounts[k];if(!a?.id)continue;await api(LOGIN,{action:'hq_upsert',actor:safety,user:{id:a.id,name:a.name,role:a.role,department:'QA',position:a.position,active:false,passwordHash:pwHash}});out.cleanup.push({account:k,status:'deactivated'});}if(safety)await api(HQOLD,{action:'upsert',actor:actor('bootstrap','QA','safety'),user:{id:safety.id,name:safety.name,role:'safety',department:'QA',position:'안전관리자',active:false,passwordHash:pwHash}});out.cleanup.push({account:'safety',status:'deactivated'});}catch(e){out.errors.push({severity:'P1',root:'QA_CLEANUP',name:'테스트 계정/데이터 정리 실패',message:String(e)});}
for(const b of [...browsers]){try{await b.close()}catch{}}
out.finishedAt=new Date().toISOString();out.summary={pass:out.tests.filter(x=>x.status==='PASS').length,fail:out.tests.filter(x=>x.status==='FAIL').length,untested:out.tests.filter(x=>x.status==='미검증').length,p0:out.errors.filter(x=>x.severity==='P0').length,p1:out.errors.filter(x=>x.severity==='P1').length};fs.writeFileSync('qa-artifacts-v2/result.json',JSON.stringify(out,null,2));console.log('QA_FINAL',JSON.stringify(out.summary));
