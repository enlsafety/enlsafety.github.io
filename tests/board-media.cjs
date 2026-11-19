'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('platform-dashboard.js','utf8');
const render=vm.runInNewContext(source.slice(source.indexOf(' const boardTags='),source.indexOf(' function boardColor('))+'\nboardMediaIcons');
const picture={tag:'div',children:[{tag:'p',children:[{tag:'img',assetId:'inline'}]}]};
const cases=[
 [{},undefined,[]],
 [{document:[picture],asset_ids:['inline']},undefined,['image']],
 [{document:[picture],asset_ids:['inline','pdf']},undefined,['image','attachment']],
 [{document:[],asset_ids:['png-download']},undefined,['attachment']],
 [{file_name:'기존 자료.pdf'},undefined,['attachment']],
 [{document:[picture]},[{id:'inline'},{id:'pdf'}],['image','attachment']],
 [{document:[picture]},[{id:'inline'}],['image']],
 [{document:[{tag:'script',children:[{tag:'img',assetId:'invalid'}]}],asset_ids:[]},undefined,[]],
 [{document:[{text:'<img src=x>',tag:'img',assetId:'ignored'}]},undefined,[]],
 [{document:[{tag:'img',assetId:'x" onerror="alert(1)'}],asset_ids:[]},undefined,['image']]
];
for(const [item,files,expected] of cases){const dom=new JSDOM(render(item,files));const root=dom.window.document;assert.deepEqual([...root.querySelectorAll('[data-post-media]')].map(el=>el.dataset.postMedia),expected);assert.equal(root.querySelectorAll('[onerror],script,img').length,0);for(const icon of root.querySelectorAll('[data-post-media]')){assert.equal(icon.getAttribute('role'),'img');assert.ok(icon.getAttribute('aria-label'));assert.equal(icon.querySelector('svg').getAttribute('aria-hidden'),'true');}dom.window.close();}
console.log('PASS board indicators: nested inline images, download-only images, mixed media, legacy files, empty/removed files, accessible labels and untrusted document safety.');
