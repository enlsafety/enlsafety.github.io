'use strict';
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<main id="view"></main><div id="modalHost"></div><nav class="hub-sidebar"><button data-hub="safetyCard">카드</button></nav>',{url:'https://isolated.test',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;const actor={id:'qa-safety',name:'QA',role:'safety'};w.currentUser=()=>actor;w.data={sites:[],incidents:[]};w.alert=()=>{};w.confirm=()=>true;
 const host=w.document.getElementById('modalHost');w.closeModal=()=>host.replaceChildren();w.openModal=html=>{host.innerHTML=html;};w.enlSiteDirectorySync=async()=>{};w.enlAuthApi=async()=>({people:[],personnel:[]});
 w.enlIncidentApi=async()=>({sites:[{site_id:'qa',site_name:'원본 사업장',active:true,regular_count:12,daily_count:3,safety_card_profile:{_source:'safety_card',corporation:'원본 법인'}}]});
 for(const p of ['site-contract-v451.js','site-admin-v415.js'])w.eval(fs.readFileSync(p,'utf8'));
 await w.enlRenderSiteAdmin411(w.document.getElementById('view'),actor);w.document.querySelector('[data-sa415-site="qa"]').click();await new Promise(r=>setImmediate(r));
 assert.ok([...host.querySelectorAll('#sa415SiteForm input,#sa415SiteForm textarea')].every(n=>n.readOnly));assert.equal(host.querySelector('#sa415Active').disabled,false);assert.ok(host.querySelector('#sa415CloseSite'));assert.match(host.textContent,/기준 원본/);assert.doesNotMatch(host.textContent,/직책과 전화번호를 수정하면 자동으로 반영/);
 let clicked=false;w.document.querySelector('[data-hub="safetyCard"]').onclick=()=>clicked=true;[...host.querySelectorAll('button')].find(b=>b.textContent==='안전관리카드에서 수정').click();assert.equal(clicked,true);assert.equal(host.childElementCount,0);
 dom.window.close();console.log('PASS site administrator views card-owned facts read-only, retains contract controls and can open safety cards');
})().catch(e=>{console.error(e);process.exitCode=1});
