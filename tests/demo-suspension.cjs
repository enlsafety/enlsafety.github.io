'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const auth=fs.readFileSync('auth-v411.js','utf8');
const app={innerHTML:''},name={dataset:{},addEventListener(){}};
const styles=new Map();
const context={app,window:{ENL_DEPLOY_VERSION:'4.7.3'},session:{},currentUser(){},roleName(){},renderLogin(){},
 document:{getElementById(id){return id==='loginName411'?name:styles.get(id)||null},querySelector(){return null},createElement(){return {}},head:{appendChild(el){styles.set(el.id,el)}}}};
vm.runInNewContext(auth,context);
for(let attempt=0;attempt<3;attempt++){
 context.window.enlRenderLogin();
 assert.ok(app.innerHTML.includes('id="loginName411"')&&app.innerHTML.includes('id="loginAff411"')&&app.innerHTML.includes('id="loginPwWrap411"'),'normal login controls remain');
 assert.ok(!/zerowiz|데모|demo-entry/.test(app.innerHTML),'demo link is absent from generated DOM on every login render');
}
for(const file of ['zerowiz-demo.html','zerowiz-demo-app.html']){
 const html=fs.readFileSync(file,'utf8');
 assert.ok(!/<iframe|<form|<script\s+src=/i.test(html),'closed entry cannot load demo or role controls: '+file);
 assert.ok(/http-equiv="refresh"/.test(html)&&html.includes('href="stable412.html?entry=login'),'no-script login fallback: '+file);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 const redirects=[];for(const [,script]of scripts)vm.runInNewContext(script,{location:{replace(url){redirects.push(url)}}});
 assert.deepEqual(redirects,['stable412.html?entry=login&build=473-r2']);
 const retained=fs.readFileSync('docs/disabled-demo/'+file+'.txt','utf8');
 assert.ok(retained.includes(file==='zerowiz-demo.html'?'id="zwRolePanel"':'zerowiz-fidelity-boot.js'),'original demo retained for reopening');
}
console.log('PASS: demo absent on repeated login renders, both direct URLs redirect without loading demo code, no-JS fallback and reopen source retained');
