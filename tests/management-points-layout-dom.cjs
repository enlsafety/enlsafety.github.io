/* Offline DOM behavior; pixel layout is verified separately in the browser. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<div id="view"><section class="stats426"><header class="stats426-head"><select id="stats426Year"><option>2026</option><option>2025</option></select></header><div class="stats426-cards"></div><aside class="management-points"></aside><section id="stats426Drill"></section></section></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;w.currentView="stats";let ready=false,reads=0;
 const rows=[{id:'a',siteId:'A',category:'property',status:'reported',eventType:'파손',occurredAt:'2026-01-01'},{id:'b',siteId:'B',category:'property',status:'closed',eventType:'파손',occurredAt:'2025-01-01'}];
 w.siteById=id=>({name:'사업장 '+id});w.enlIncidentAnalysisRecords=()=>{reads++;return rows};w.enlIncidentServerReady=()=>ready;
 for(const file of ['incident-analysis.js','management-points.js'])w.eval(fs.readFileSync(file,'utf8'));
 const root=d.querySelector('#view'),stats=d.querySelector('.stats426'),cards=d.querySelector('.stats426-cards'),points=d.querySelector('.management-points');
 const settle=()=>new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
 w.ENLManagementPoints.mount(root);assert.match(points.textContent,/최신 서버 자료 확인 전/);
 const overview=d.createElement('div');overview.className='incident-overview';stats.prepend(overview);overview.append(d.querySelector('.stats426-head'),cards);await settle();
 assert.equal(points.parentElement,overview,'late map layout reserves summary cell');
 ready=true;w.dispatchEvent(new w.Event('enl-incidents-pulled'));
 assert.doesNotMatch(points.textContent,/최신 서버 자료 확인 전/);assert.match(points.textContent,/미종결 사고1건/);assert.match(points.textContent,/사업장 A/);
 w.siteById=id=>({name:'최신 명칭 '+id});w.dispatchEvent(new w.Event('enl-site-directory-synced'));assert.match(points.textContent,/최신 명칭 A/);
 for(const width of [1920,1536,1366,1050,901,900,390,1366]){w.innerWidth=width;w.dispatchEvent(new w.Event('resize'));await settle();assert.equal(points.parentElement,overview,'stable DOM placement at '+width);assert.equal(points.getAttribute('style'),null,'no measured absolute placement');}
 rows[0].status='closed';w.dispatchEvent(new w.Event('enl-incident-saved'));assert.match(points.textContent,/미종결 사고0건/);
 d.querySelector('#stats426Year').value='2025';w.dispatchEvent(new w.Event('enl-incidents-pulled'));assert.match(points.textContent,/2025년/);assert.match(points.textContent,/최신 명칭 B/);
 const before=reads;root.replaceChildren();await settle();w.dispatchEvent(new w.Event('enl-incidents-pulled'));assert.equal(reads,before,'listeners cleaned on navigation');dom.window.close();
 console.log('PASS stable summary placement, unchanged snapshot readiness, save refresh, selected year and navigation cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
