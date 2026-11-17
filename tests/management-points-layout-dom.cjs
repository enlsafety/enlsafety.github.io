/* Tests placement logic, not browser pixel rendering. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<div id="view"><section class="stats426"><div class="incident-overview"><header class="stats426-head"></header><div class="stats426-cards"></div><div data-sd450-map></div></div><aside class="management-points"><div class="management-points-body"></div></aside><section id="stats426Drill"></section></section></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let callback,disconnected=0;
 w.ResizeObserver=class{constructor(cb){callback=cb}observe(){}disconnect(){disconnected++}};
 w.eval(fs.readFileSync('management-points.js','utf8'));
 const root=d.querySelector('#view'),overview=d.querySelector('.incident-overview'),cards=d.querySelector('.stats426-cards'),map=d.querySelector('[data-sd450-map]'),points=d.querySelector('.management-points');
 let bottom=720;overview.getBoundingClientRect=()=>({top:20,left:10});cards.getBoundingClientRect=()=>({bottom:450,left:10,width:195});map.getBoundingClientRect=()=>({bottom});
 const settle=()=>new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
 w.innerWidth=1366;w.ENLManagementPoints.mount(root);await settle();
 assert.equal(points.parentElement,overview);assert.equal(points.style.getPropertyValue('--points-height'),'');assert.equal(points.style.getPropertyValue('--points-top'),'442px');assert.equal(map.getAttribute('style'),null);
 points.getBoundingClientRect=()=>({height:300});callback();await settle();assert.equal(points.parentElement,d.querySelector('.stats426'),'long content falls back rather than clipping');points.getBoundingClientRect=()=>({height:180});
 bottom=550;callback();await settle();assert.equal(points.parentElement,d.querySelector('.stats426'));assert.ok(!points.classList.contains('management-points-rail'));
 bottom=720;w.innerWidth=390;w.dispatchEvent(new w.Event('resize'));await settle();assert.equal(points.parentElement,d.querySelector('.stats426'));
 w.innerWidth=1366;w.dispatchEvent(new w.Event('resize'));await settle();assert.equal(points.parentElement,overview);
 root.replaceChildren();await settle();assert.ok(disconnected>0,'observers removed on navigation');dom.window.close();console.log('PASS free-space placement, short screen/mobile fallback, unchanged map and navigation cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
